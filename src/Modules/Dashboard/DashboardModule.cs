using HealthHq.Shared.Contracts;
using HealthHq.Shared.Infrastructure;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using System.Text.Json;

namespace HealthHq.Modules.Dashboard;

public static class DashboardModule
{
    public static IServiceCollection AddDashboardModule(this IServiceCollection services) => services;

    public static IEndpointRouteBuilder MapDashboardEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/dashboard/activities/{id}", async (string id, IDocumentStore store, CancellationToken cancellationToken) =>
        {
            var activity = await store.GetByIdAsync<ActivityRecord>(DocumentTypes.Activity, id, cancellationToken);
            if (activity is null)
            {
                return Results.NotFound(new { message = "Activity not found." });
            }

            var stravaEnabled = await IsStravaEnabledAsync(store, cancellationToken);
            if (!stravaEnabled && IsStravaSource(activity.Source))
            {
                return Results.NotFound(new { message = "Activity not found." });
            }

            var type = NormalizeActivityType(activity.Type);
            var rawPayload = TryParseRawJson(activity.RawJson);
            var routePoints = activity.RoutePoints ?? ExtractRoutePoints(rawPayload);
            var heartRateSamples = activity.HeartRateSamples ?? ExtractHeartRateSamples(rawPayload);

            return Results.Ok(new
            {
                activity.Id,
                activity.Source,
                activity.ExternalId,
                name = string.IsNullOrWhiteSpace(activity.Name) ? type : activity.Name,
                activity.StartTime,
                endTime = GetEffectiveEndTime(activity),
                durationMinutes = Math.Round(GetEffectiveDurationMinutes(activity), 2),
                activity.DistanceKm,
                activity.Steps,
                activity.AverageHeartRate,
                activity.MaxHeartRate,
                loadScore = Math.Round(activity.LoadScore ?? GetEffectiveDurationMinutes(activity), 2),
                recordedLoadScore = activity.LoadScore,
                type,
                routePoints,
                heartRateSamples,
                raw = rawPayload
            });
        });

        app.MapGet("/api/dashboard/steps/{day}", async (string day, IDocumentStore store, CancellationToken cancellationToken) =>
        {
            if (!DateOnly.TryParse(day, out var parsedDay))
            {
                return Results.BadRequest(new { message = "Invalid day. Use yyyy-MM-dd." });
            }

            var (fromInclusive, toInclusive) = ToUtcDayRange(parsedDay);
            var records = await store.ListByRecordedAtAsync<DailyStepsRecord>(DocumentTypes.DailySteps, fromInclusive, toInclusive, cancellationToken);
            var steps = records.OrderByDescending(x => x.TotalSteps).FirstOrDefault();
            if (steps is null)
            {
                return Results.NotFound(new { message = "Steps data not found for that day." });
            }

            return Results.Ok(new
            {
                steps.Id,
                steps.Source,
                steps.Day,
                steps.TotalSteps,
                steps.DistanceKm,
                steps.ActiveKilocalories,
                raw = TryParseRawJson(steps.RawJson)
            });
        });

        app.MapGet("/api/dashboard/sleep/{day}", async (string day, IDocumentStore store, CancellationToken cancellationToken) =>
        {
            if (!DateOnly.TryParse(day, out var parsedDay))
            {
                return Results.BadRequest(new { message = "Invalid day. Use yyyy-MM-dd." });
            }

            var (fromInclusive, toInclusive) = ToUtcDayRange(parsedDay);
            var records = await store.ListByRecordedAtAsync<SleepSummaryRecord>(DocumentTypes.SleepSummary, fromInclusive, toInclusive, cancellationToken);
            var sleep = records.OrderByDescending(x => x.SleepHours).FirstOrDefault();
            if (sleep is null)
            {
                return Results.NotFound(new { message = "Sleep data not found for that day." });
            }

            return Results.Ok(new
            {
                sleep.Id,
                sleep.Source,
                sleep.Day,
                sleep.SleepHours,
                sleep.DeepSleepHours,
                sleep.LightSleepHours,
                sleep.RemSleepHours,
                sleep.AwakeHours,
                sleep.SleepScore,
                raw = TryParseRawJson(sleep.RawJson)
            });
        });

        app.MapGet("/api/dashboard/summary", async (IDocumentStore store, CancellationToken cancellationToken) =>
        {
            var summary = await BuildSummaryAsync(store, cancellationToken);
            return Results.Ok(summary);
        });

        app.MapGet("/api/dashboard/insights", async (IDocumentStore store, CancellationToken cancellationToken) =>
        {
            var now = DateTimeOffset.UtcNow;
            var ninetyDaysAgo = now.AddDays(-90);
            var fourteenDaysAgo = now.AddDays(-14);
            var stravaEnabled = await IsStravaEnabledAsync(store, cancellationToken);

            var summary = await BuildSummaryAsync(store, cancellationToken);
            var activities90 = await store.ListByRecordedAtAsync<ActivityRecord>(DocumentTypes.Activity, ninetyDaysAgo, now, cancellationToken);
            activities90 = FilterVisibleActivities(activities90, stravaEnabled);
            var bodyMetrics = await store.ListAsync<BodyMetricEntry>(DocumentTypes.BodyMetric, 180, cancellationToken);
            var dailySteps = await store.ListByRecordedAtAsync<DailyStepsRecord>(DocumentTypes.DailySteps, ninetyDaysAgo, now, cancellationToken);
            var sleepSummaries = await store.ListByRecordedAtAsync<SleepSummaryRecord>(DocumentTypes.SleepSummary, ninetyDaysAgo, now, cancellationToken);

            var recentActivities = activities90
                .OrderByDescending(x => x.StartTime)
                .Take(120)
                .Select(x => new
                {
                    id = x.Id,
                    source = x.Source,
                    type = NormalizeActivityType(x.Type),
                    name = string.IsNullOrWhiteSpace(x.Name) ? NormalizeActivityType(x.Type) : x.Name,
                    startTime = x.StartTime,
                    durationMinutes = Math.Round(GetEffectiveDurationMinutes(x), 1),
                    distanceKm = x.DistanceKm is null ? (double?)null : Math.Round(x.DistanceKm.Value, 2),
                    averageHeartRate = x.AverageHeartRate,
                    maxHeartRate = x.MaxHeartRate,
                    loadScore = Math.Round(x.LoadScore ?? GetEffectiveDurationMinutes(x), 2)
                })
                .ToArray();

            var dailyByDay = activities90
                .GroupBy(x => DateOnly.FromDateTime(x.StartTime.UtcDateTime))
                .ToDictionary(
                    g => g.Key,
                    g => new
                    {
                        count = g.Count(),
                        duration = Math.Round(g.Sum(GetEffectiveDurationMinutes), 1),
                        load = Math.Round(g.Sum(x => x.LoadScore ?? GetEffectiveDurationMinutes(x)), 1)
                    });

            var firstDay = DateOnly.FromDateTime(now.UtcDateTime.Date.AddDays(-89));
            var lastDay = DateOnly.FromDateTime(now.UtcDateTime.Date);
            var activityDailyTrend = new List<object>(90);
            for (var day = firstDay; day <= lastDay; day = day.AddDays(1))
            {
                if (dailyByDay.TryGetValue(day, out var values))
                {
                    activityDailyTrend.Add(new
                    {
                        day,
                        count = values.count,
                        durationMinutes = values.duration,
                        load = values.load
                    });
                    continue;
                }

                activityDailyTrend.Add(new
                {
                    day,
                    count = 0,
                    durationMinutes = 0d,
                    load = 0d
                });
            }

            var bodyTrend = bodyMetrics
                .OrderBy(x => x.Day)
                .Select(x => new
                {
                    day = x.Day,
                    weightKg = x.WeightKg,
                    bmi = x.Bmi,
                    category = x.Category
                })
                .ToArray();

            var stepsTrend = dailySteps
                .OrderBy(x => x.Day)
                .Select(x => new
                {
                    day = x.Day,
                    totalSteps = x.TotalSteps,
                    distanceKm = x.DistanceKm,
                    activeKilocalories = x.ActiveKilocalories
                })
                .ToArray();

            var sleepTrend = sleepSummaries
                .OrderBy(x => x.Day)
                .Select(x => new
                {
                    day = x.Day,
                    sleepHours = x.SleepHours,
                    deepSleepHours = x.DeepSleepHours,
                    lightSleepHours = x.LightSleepHours,
                    remSleepHours = x.RemSleepHours,
                    awakeHours = x.AwakeHours,
                    sleepScore = x.SleepScore
                })
                .ToArray();

            var previousWeekStart = now.AddDays(-14);
            var previousWeekEnd = now.AddDays(-7);
            var previousWeekCount = activities90.Count(x => x.StartTime >= previousWeekStart && x.StartTime < previousWeekEnd);
            var currentWeekCount = summary.ActivityCountLast7Days;
            var trendDirection = currentWeekCount == previousWeekCount
                ? "holding steady"
                : currentWeekCount > previousWeekCount ? "up" : "down";
            var trendDelta = currentWeekCount - previousWeekCount;

            var bodyOrdered = bodyMetrics.OrderBy(x => x.Day).ToArray();
            var latestMetric = bodyOrdered.LastOrDefault();
            var comparisonMetric = bodyOrdered.LastOrDefault(x => x.Day <= DateOnly.FromDateTime(fourteenDaysAgo.UtcDateTime.Date));
            var weightDelta = latestMetric is null || comparisonMetric is null
                ? (decimal?)null
                : Math.Round(latestMetric.WeightKg - comparisonMetric.WeightKg, 2);

            var bmiStart = bodyOrdered.TakeLast(4).FirstOrDefault()?.Bmi;
            var bmiEnd = bodyOrdered.TakeLast(4).LastOrDefault()?.Bmi;

            var insights = new[]
            {
                new
                {
                    key = "acwr-status",
                    title = "Training load status",
                    status = AcwrStatus(summary.Acwr),
                    message = summary.Acwr switch
                    {
                        < 0.8 => $"ACWR {summary.Acwr:F2}: low load, consider building volume carefully.",
                        <= 1.3 => $"ACWR {summary.Acwr:F2}: in the optimal range.",
                        <= 1.5 => $"ACWR {summary.Acwr:F2}: caution zone, monitor fatigue.",
                        _ => $"ACWR {summary.Acwr:F2}: elevated risk, reduce load and recover."
                    }
                },
                new
                {
                    key = "activity-momentum",
                    title = "Activity momentum",
                    status = trendDirection,
                    message = $"{currentWeekCount} activities in the last 7 days ({(trendDelta >= 0 ? "+" : string.Empty)}{trendDelta} vs prior 7 days)."
                },
                new
                {
                    key = "weight-trend",
                    title = "14-day weight change",
                    status = weightDelta switch
                    {
                        null => "insufficient-data",
                        < 0 => "down",
                        > 0 => "up",
                        _ => "steady"
                    },
                    message = weightDelta is null
                        ? "Add at least two body metric entries across 14 days to unlock this trend."
                        : $"Weight is {(weightDelta < 0 ? "down" : weightDelta > 0 ? "up" : "steady")} by {Math.Abs(weightDelta.Value):F2} kg over 14 days."
                },
                new
                {
                    key = "bmi-trajectory",
                    title = "BMI trajectory",
                    status = bmiStart is null || bmiEnd is null ? "insufficient-data" : bmiEnd > bmiStart ? "up" : bmiEnd < bmiStart ? "down" : "steady",
                    message = bmiStart is null || bmiEnd is null
                        ? "Add a few more measurements to reveal BMI trajectory."
                        : $"BMI moved from {bmiStart:F2} to {bmiEnd:F2} across your latest check-ins."
                }
            };

            return Results.Ok(new
            {
                summary,
                recentActivities,
                activityDailyTrend,
                dailyStepsTrend = stepsTrend,
                sleepDailyTrend = sleepTrend,
                bodyMetricsTrend = bodyTrend,
                insights,
                generatedAt = now
            });
        });

        return app;
    }

    private static async Task<DashboardSummary> BuildSummaryAsync(IDocumentStore store, CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var sevenDaysAgo = now.AddDays(-7);
        var twentyEightDaysAgo = now.AddDays(-28);
        var stravaEnabled = await IsStravaEnabledAsync(store, cancellationToken);

        var activities7 = FilterVisibleActivities(
            await store.ListByRecordedAtAsync<ActivityRecord>(DocumentTypes.Activity, sevenDaysAgo, now, cancellationToken),
            stravaEnabled);
        var activities28 = FilterVisibleActivities(
            await store.ListByRecordedAtAsync<ActivityRecord>(DocumentTypes.Activity, twentyEightDaysAgo, now, cancellationToken),
            stravaEnabled);
        var vitalityThisWeek = await store.ListAsync<VitalityRecord>(DocumentTypes.VitalityRecord, 30, cancellationToken);
        var bodyMetrics = await store.ListAsync<BodyMetricEntry>(DocumentTypes.BodyMetric, 30, cancellationToken);
        var dailySteps = await store.ListByRecordedAtAsync<DailyStepsRecord>(DocumentTypes.DailySteps, sevenDaysAgo, now, cancellationToken);
        var sleepSummaries = await store.ListByRecordedAtAsync<SleepSummaryRecord>(DocumentTypes.SleepSummary, sevenDaysAgo, now, cancellationToken);
        var meals = await store.ListAsync<MealPlan>(DocumentTypes.MealPlan, 20, cancellationToken);
        var discounts = await store.ListAsync<DiscountRecord>(DocumentTypes.Discount, 200, cancellationToken);

        var acute = activities7.Sum(x => x.LoadScore ?? GetEffectiveDurationMinutes(x));
        var chronic = activities28.Sum(x => x.LoadScore ?? GetEffectiveDurationMinutes(x)) / 4d;
        var acwr = chronic <= 0 ? 0 : Math.Round(acute / chronic, 2);

        var weekStart = DateOnly.FromDateTime(DateTime.UtcNow.Date.AddDays(-(int)DateTime.UtcNow.DayOfWeek + (int)DayOfWeek.Monday));
        var weekEnd = weekStart.AddDays(6);
        var points = vitalityThisWeek.Where(x => x.Day >= weekStart && x.Day <= weekEnd).Sum(x => x.Points);

        var latestMetric = bodyMetrics.OrderByDescending(x => x.Day).FirstOrDefault();
        var averageSteps = dailySteps.Count == 0 ? (int?)null : (int)Math.Round(dailySteps.Average(x => x.TotalSteps));
        var averageSleepHours = sleepSummaries.Count == 0 ? (double?)null : Math.Round(sleepSummaries.Average(x => x.SleepHours), 2);
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var activeDiscounts = discounts.Count(x => x.ValidFrom <= today && x.ValidTo >= today);

        return new DashboardSummary(
            ActivityCountLast7Days: activities7.Count,
            AcuteLoad: Math.Round(acute, 2),
            ChronicLoad: Math.Round(chronic, 2),
            Acwr: acwr,
            VitalityPointsThisWeek: points,
            AverageStepsLast7Days: averageSteps,
            AverageSleepHoursLast7Days: averageSleepHours,
            LatestBmi: latestMetric?.Bmi,
            LatestWeightKg: latestMetric?.WeightKg,
            LatestWeightCategory: latestMetric?.Category,
            ActiveMealPlans: meals.Count,
            ActiveDiscounts: activeDiscounts
        );
    }

    private static string AcwrStatus(double acwr)
    {
        return acwr switch
        {
            < 0.8 => "low",
            <= 1.3 => "optimal",
            <= 1.5 => "caution",
            _ => "elevated"
        };
    }

    private static List<ActivityRecord> FilterVisibleActivities(IEnumerable<ActivityRecord> activities, bool stravaEnabled)
    {
        return activities
            .Where(x => stravaEnabled || !IsStravaSource(x.Source))
            .ToList();
    }

    private static bool IsStravaSource(string source)
    {
        return string.Equals(source, "strava", StringComparison.OrdinalIgnoreCase);
    }

    private static async Task<bool> IsStravaEnabledAsync(IDocumentStore store, CancellationToken cancellationToken)
    {
        var settings = await store.GetByIdAsync<IngestionProviderSettings>(DocumentTypes.IngestionProviderSettings, "strava", cancellationToken);
        return settings?.Enabled ?? false;
    }

    private static string NormalizeActivityType(string? type)
    {
        if (string.IsNullOrWhiteSpace(type))
        {
            return "unknown";
        }

        var normalized = ExtractActivityTypeToken(type);

        return normalized switch
        {
            "racket" => "squash",
            "racquet" => "squash",
            "racquet sport" => "squash",
            _ => normalized
        };
    }

    private static string ExtractActivityTypeToken(string type)
    {
        var candidate = type.Trim();
        if (candidate.Length == 0)
        {
            return "unknown";
        }

        if (candidate.Contains("UnknownEnumValue", StringComparison.OrdinalIgnoreCase))
        {
            return "unknown";
        }

        if (candidate.StartsWith('<') && candidate.EndsWith('>'))
        {
            candidate = candidate[1..^1].Trim();
        }

        var colonIndex = candidate.IndexOf(':');
        if (colonIndex >= 0)
        {
            candidate = candidate[..colonIndex].Trim();
        }

        var lastDotIndex = candidate.LastIndexOf('.');
        if (lastDotIndex >= 0 && lastDotIndex < candidate.Length - 1)
        {
            candidate = candidate[(lastDotIndex + 1)..].Trim();
        }

        if (candidate.Length == 0 || int.TryParse(candidate, out _))
        {
            return "unknown";
        }

        return candidate.ToLowerInvariant();
    }

    private static double GetEffectiveDurationMinutes(ActivityRecord activity)
    {
        if (activity.DurationMinutes > 1.1)
        {
            return activity.DurationMinutes;
        }

        var spanMinutes = (activity.EndTime - activity.StartTime).TotalMinutes;
        if (spanMinutes > 1.1)
        {
            return spanMinutes;
        }

        return activity.DurationMinutes;
    }

    private static DateTimeOffset GetEffectiveEndTime(ActivityRecord activity)
    {
        if (activity.EndTime > activity.StartTime)
        {
            return activity.EndTime;
        }

        var minutes = GetEffectiveDurationMinutes(activity);
        if (minutes > 0)
        {
            return activity.StartTime.AddMinutes(minutes);
        }

        return activity.EndTime;
    }

    private static List<ActivityRoutePoint> ExtractRoutePoints(object? raw)
    {
        if (raw is not JsonElement root)
        {
            return [];
        }

        return FindFirstLatLngArray(root) ?? [];
    }

    private static List<ActivityHeartRateSample> ExtractHeartRateSamples(object? raw)
    {
        if (raw is not JsonElement root)
        {
            return [];
        }

        return FindFirstHeartRateSeries(root) ?? [];
    }

    private static List<ActivityRoutePoint>? FindFirstLatLngArray(JsonElement node)
    {
        if (node.ValueKind == JsonValueKind.Array)
        {
            var points = TryReadLatLngPoints(node);
            if (points.Count > 0)
            {
                return points;
            }
        }

        if (node.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        foreach (var property in node.EnumerateObject())
        {
            var nested = FindFirstLatLngArray(property.Value);
            if (nested is { Count: > 0 })
            {
                return nested;
            }
        }

        return null;
    }

    private static List<ActivityHeartRateSample>? FindFirstHeartRateSeries(JsonElement node)
    {
        if (node.ValueKind == JsonValueKind.Object)
        {
            if (node.TryGetProperty("heartrate", out var heartrate)
                && heartrate.ValueKind == JsonValueKind.Object
                && heartrate.TryGetProperty("data", out var values)
                && values.ValueKind == JsonValueKind.Array)
            {
                var offsets = node.TryGetProperty("time", out var time)
                    && time.ValueKind == JsonValueKind.Object
                    && time.TryGetProperty("data", out var timeValues)
                    && timeValues.ValueKind == JsonValueKind.Array
                    ? ReadIntArray(timeValues)
                    : [];

                return ReadHeartRateSeries(values, offsets);
            }

            foreach (var property in node.EnumerateObject())
            {
                var nested = FindFirstHeartRateSeries(property.Value);
                if (nested is { Count: > 0 })
                {
                    return nested;
                }
            }
        }
        else if (node.ValueKind == JsonValueKind.Array)
        {
            var standaloneSeries = ReadHeartRateSeries(node, []);
            if (standaloneSeries.Count > 0)
            {
                return standaloneSeries;
            }

            foreach (var item in node.EnumerateArray())
            {
                var nested = FindFirstHeartRateSeries(item);
                if (nested is { Count: > 0 })
                {
                    return nested;
                }
            }
        }

        return null;
    }

    private static List<ActivityRoutePoint> TryReadLatLngPoints(JsonElement node)
    {
        var points = new List<ActivityRoutePoint>();
        foreach (var item in node.EnumerateArray())
        {
            if (item.ValueKind != JsonValueKind.Array)
            {
                continue;
            }

            var pair = item.EnumerateArray().ToArray();
            if (pair.Length < 2)
            {
                continue;
            }

            if (pair[0].ValueKind == JsonValueKind.Number
                && pair[1].ValueKind == JsonValueKind.Number
                && pair[0].TryGetDouble(out var latitude)
                && pair[1].TryGetDouble(out var longitude)
                && latitude is >= -90 and <= 90
                && longitude is >= -180 and <= 180)
            {
                points.Add(new ActivityRoutePoint(latitude, longitude));
            }
        }

        return points;
    }

    private static List<int> ReadIntArray(JsonElement node)
    {
        var values = new List<int>();
        foreach (var item in node.EnumerateArray())
        {
            if (item.ValueKind == JsonValueKind.Number && item.TryGetInt32(out var number))
            {
                values.Add(number);
            }
        }

        return values;
    }

    private static List<ActivityHeartRateSample> ReadHeartRateSeries(JsonElement heartRateValues, IReadOnlyList<int> offsets)
    {
        var samples = new List<ActivityHeartRateSample>();
        var index = 0;
        foreach (var item in heartRateValues.EnumerateArray())
        {
            if (item.ValueKind != JsonValueKind.Number || !item.TryGetInt32(out var heartRate) || heartRate <= 0)
            {
                index++;
                continue;
            }

            var offset = index < offsets.Count ? offsets[index] : index;
            samples.Add(new ActivityHeartRateSample(offset, heartRate));
            index++;
        }

        return samples;
    }

    private static object? TryParseRawJson(string rawJson)
    {
        if (string.IsNullOrWhiteSpace(rawJson))
        {
            return null;
        }

        try
        {
            return JsonSerializer.Deserialize<object>(rawJson);
        }
        catch
        {
            return rawJson;
        }
    }

    private static (DateTimeOffset FromInclusive, DateTimeOffset ToInclusive) ToUtcDayRange(DateOnly day)
    {
        var from = new DateTimeOffset(day.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);
        var to = from.AddDays(1).AddTicks(-1);
        return (from, to);
    }
}
