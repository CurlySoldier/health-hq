using HealthHq.Shared.Contracts;
using HealthHq.Shared.Infrastructure;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;
using System.Globalization;
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

        app.MapGet("/api/dashboard/resting-heart-rate", async (HttpRequest request, IDocumentStore store, CancellationToken cancellationToken) =>
        {
            var range = ResolveDateRange(request, defaultDays: 90);
            var rollingWindow = 30;
            var queryFromDay = range.FromDay.AddDays(-(rollingWindow - 1));
            var (queryFrom, queryTo) = ToUtcDayRange(queryFromDay, range.ToDay);
            var steps = await store.ListByRecordedAtAsync<DailyStepsRecord>(DocumentTypes.DailySteps, queryFrom, queryTo, cancellationToken);

            var restingByDay = steps
                .GroupBy(x => x.Day)
                .ToDictionary(group => group.Key, group =>
                {
                    foreach (var item in group)
                    {
                        if (TryExtractRestingHeartRate(item.RawJson, out var restingHeartRate))
                        {
                            return (double?)restingHeartRate;
                        }
                    }

                    return (double?)null;
                });

            var allDays = EnumerateDays(queryFromDay, range.ToDay).ToArray();
            var allValues = allDays
                .Select(day => restingByDay.TryGetValue(day, out var value) ? value : null)
                .ToArray();

            var rolling7 = ComputeRollingAverage(allValues, 7);
            var rolling30 = ComputeRollingAverage(allValues, 30);
            var rolling30StdDev = ComputeRollingStandardDeviation(allValues, 30);

            var points = allDays
                .Select((day, index) => new { day, index })
                .Where(x => x.day >= range.FromDay)
                .Select(x =>
                {
                    var resting = allValues[x.index];
                    var baseline = rolling30[x.index];
                    var stdDev = rolling30StdDev[x.index];
                    var isAnomaly = resting.HasValue
                        && baseline.HasValue
                        && stdDev.HasValue
                        && resting.Value > baseline.Value + stdDev.Value;

                    return new
                    {
                        day = x.day,
                        restingHr = resting,
                        rolling7 = rolling7[x.index],
                        rolling30 = baseline,
                        baseline30 = baseline,
                        stdDev30 = stdDev,
                        isAnomaly
                    };
                })
                .ToArray();

            return Results.Ok(new
            {
                fromDay = range.FromDay,
                toDay = range.ToDay,
                points,
                availableDays = points.Count(x => x.restingHr is not null)
            });
        });

        app.MapGet("/api/dashboard/sleep-stages", async (HttpRequest request, IDocumentStore store, CancellationToken cancellationToken) =>
        {
            var range = ResolveDateRange(request, defaultDays: 90);
            var queryFromDay = range.FromDay.AddDays(-6);
            var (queryFrom, queryTo) = ToUtcDayRange(queryFromDay, range.ToDay);
            var sleepRecords = await store.ListByRecordedAtAsync<SleepSummaryRecord>(DocumentTypes.SleepSummary, queryFrom, queryTo, cancellationToken);

            var byDay = sleepRecords
                .GroupBy(x => x.Day)
                .ToDictionary(group => group.Key, group => group.OrderByDescending(x => x.SleepHours).First());

            var allDays = EnumerateDays(queryFromDay, range.ToDay).ToArray();
            var totalSleepValues = allDays
                .Select(day => byDay.TryGetValue(day, out var record) ? (double?)record.SleepHours : null)
                .ToArray();
            var rolling7 = ComputeRollingAverage(totalSleepValues, 7);

            var points = allDays
                .Select((day, index) => new { day, index })
                .Where(x => x.day >= range.FromDay)
                .Select(x =>
                {
                    if (!byDay.TryGetValue(x.day, out var record))
                    {
                        return new
                        {
                            day = x.day,
                            hasData = false,
                            deepHours = 0d,
                            lightHours = 0d,
                            remHours = 0d,
                            awakeHours = 0d,
                            totalSleepHours = 0d,
                            rolling7SleepHours = rolling7[x.index],
                            bedtimeMinute = (int?)null,
                            wakeMinute = (int?)null
                        };
                    }

                    var (bedtime, wakeTime) = ExtractSleepSchedule(record.RawJson);
                    return new
                    {
                        day = x.day,
                        hasData = true,
                        deepHours = record.DeepSleepHours,
                        lightHours = record.LightSleepHours,
                        remHours = record.RemSleepHours,
                        awakeHours = record.AwakeHours,
                        totalSleepHours = record.SleepHours,
                        rolling7SleepHours = rolling7[x.index],
                        bedtimeMinute = bedtime is null ? (int?)null : (int)Math.Round(bedtime.Value.TimeOfDay.TotalMinutes),
                        wakeMinute = wakeTime is null ? (int?)null : (int)Math.Round(wakeTime.Value.TimeOfDay.TotalMinutes)
                    };
                })
                .ToArray();

            return Results.Ok(new
            {
                fromDay = range.FromDay,
                toDay = range.ToDay,
                points,
                availableDays = points.Count(x => x.hasData)
            });
        });

        app.MapGet("/api/dashboard/steps-heatmap", async (HttpRequest request, IDocumentStore store, CancellationToken cancellationToken) =>
        {
            var range = ResolveDateRange(request, defaultDays: 365);
            var (fromInclusive, toInclusive) = ToUtcDayRange(range.FromDay, range.ToDay);
            var stepRecords = await store.ListByRecordedAtAsync<DailyStepsRecord>(DocumentTypes.DailySteps, fromInclusive, toInclusive, cancellationToken);

            var byDay = stepRecords
                .GroupBy(x => x.Day)
                .ToDictionary(group => group.Key, group => group.Max(x => x.TotalSteps));

            var points = EnumerateDays(range.FromDay, range.ToDay)
                .Select(day =>
                {
                    var hasData = byDay.TryGetValue(day, out var steps);
                    return new
                    {
                        day,
                        steps = hasData ? steps : 0,
                        hasData
                    };
                })
                .ToArray();

            var nonZero = points.Where(x => x.hasData).Select(x => x.steps).ToArray();

            return Results.Ok(new
            {
                fromDay = range.FromDay,
                toDay = range.ToDay,
                points,
                minSteps = nonZero.Length == 0 ? 0 : nonZero.Min(),
                maxSteps = nonZero.Length == 0 ? 0 : nonZero.Max(),
                defaultGoal = 10000
            });
        });

        app.MapGet("/api/dashboard/monthly-life", async (HttpRequest request, IDocumentStore store, CancellationToken cancellationToken) =>
        {
            var month = ResolveTargetMonth(request);
            var monthStart = new DateOnly(month.Year, month.Month, 1);
            var monthEnd = monthStart.AddMonths(1).AddDays(-1);
            var previousStart = monthStart.AddMonths(-1);
            var previousEnd = monthStart.AddDays(-1);
            var queryStart = previousStart;
            var queryEnd = monthEnd;

            var (fromInclusive, toInclusive) = ToUtcDayRange(queryStart, queryEnd);
            var stravaEnabled = await IsStravaEnabledAsync(store, cancellationToken);

            var activities = FilterVisibleActivities(
                await store.ListByRecordedAtAsync<ActivityRecord>(DocumentTypes.Activity, fromInclusive, toInclusive, cancellationToken),
                stravaEnabled);
            var steps = await store.ListByRecordedAtAsync<DailyStepsRecord>(DocumentTypes.DailySteps, fromInclusive, toInclusive, cancellationToken);
            var sleep = await store.ListByRecordedAtAsync<SleepSummaryRecord>(DocumentTypes.SleepSummary, fromInclusive, toInclusive, cancellationToken);

            var current = BuildMonthlyLifeSnapshot(monthStart, monthEnd, activities, steps, sleep);
            var previous = BuildMonthlyLifeSnapshot(previousStart, previousEnd, activities, steps, sleep);

            return Results.Ok(new
            {
                month = monthStart.ToString("yyyy-MM", CultureInfo.InvariantCulture),
                current,
                previous,
                deltas = new
                {
                    avgRestingHr = ComputeDelta(current.AvgRestingHr, previous.AvgRestingHr),
                    avgSleepHours = ComputeDelta(current.AvgSleepHours, previous.AvgSleepHours),
                    avgDeepSleepPct = ComputeDelta(current.AvgDeepSleepPct, previous.AvgDeepSleepPct),
                    totalSteps = ComputeDelta(current.TotalSteps, previous.TotalSteps),
                    totalActiveMinutes = ComputeDelta(current.TotalActiveMinutes, previous.TotalActiveMinutes),
                    longestActivityScore = ComputeDelta(current.LongestActivityScore, previous.LongestActivityScore),
                    activeDays = ComputeDelta(current.ActiveDays, previous.ActiveDays)
                }
            });
        });

        app.MapGet("/api/dashboard/correlation", async (HttpRequest request, IDocumentStore store, CancellationToken cancellationToken) =>
        {
            var range = ResolveDateRange(request, defaultDays: 90);
            var metricA = request.Query["metricA"].FirstOrDefault() ?? "activeMinutes";
            var metricB = request.Query["metricB"].FirstOrDefault() ?? "deepSleepMinutes";
            var lag = ParseIntQuery(request, "lag", 1, -7, 7);

            var queryFrom = range.FromDay.AddDays(Math.Min(0, lag));
            var queryTo = range.ToDay.AddDays(Math.Max(0, lag));
            var (fromInclusive, toInclusive) = ToUtcDayRange(queryFrom, queryTo);

            var stravaEnabled = await IsStravaEnabledAsync(store, cancellationToken);
            var activities = FilterVisibleActivities(
                await store.ListByRecordedAtAsync<ActivityRecord>(DocumentTypes.Activity, fromInclusive, toInclusive, cancellationToken),
                stravaEnabled);
            var steps = await store.ListByRecordedAtAsync<DailyStepsRecord>(DocumentTypes.DailySteps, fromInclusive, toInclusive, cancellationToken);
            var sleep = await store.ListByRecordedAtAsync<SleepSummaryRecord>(DocumentTypes.SleepSummary, fromInclusive, toInclusive, cancellationToken);

            var activityByDay = activities.GroupBy(x => DateOnly.FromDateTime(x.StartTime.UtcDateTime)).ToDictionary(x => x.Key, x => x.ToArray());
            var stepsByDay = steps.GroupBy(x => x.Day).ToDictionary(x => x.Key, x => x.OrderByDescending(y => y.TotalSteps).First());
            var sleepByDay = sleep.GroupBy(x => x.Day).ToDictionary(x => x.Key, x => x.OrderByDescending(y => y.SleepHours).First());

            var snapshots = EnumerateDays(queryFrom, queryTo)
                .ToDictionary(
                    day => day,
                    day => BuildDailyMetricSnapshot(
                        day,
                        activityByDay.TryGetValue(day, out var activitiesOnDay) ? activitiesOnDay : [],
                        stepsByDay.TryGetValue(day, out var stepsOnDay) ? stepsOnDay : null,
                        sleepByDay.TryGetValue(day, out var sleepOnDay) ? sleepOnDay : null));

            var points = new List<CorrelationPoint>();
            foreach (var day in EnumerateDays(range.FromDay, range.ToDay))
            {
                var compareDay = day.AddDays(lag);
                if (!snapshots.TryGetValue(day, out var first) || !snapshots.TryGetValue(compareDay, out var second))
                {
                    continue;
                }

                if (!TryGetDailyMetricValue(first, metricA, out var xValue)
                    || !TryGetDailyMetricValue(second, metricB, out var yValue))
                {
                    continue;
                }

                points.Add(new CorrelationPoint(
                    Day: day,
                    CompareDay: compareDay,
                    X: Math.Round(xValue, 3),
                    Y: Math.Round(yValue, 3)));
            }

            var coefficient = ComputePearsonCorrelation(points.Select(x => x.X), points.Select(x => x.Y));

            return Results.Ok(new
            {
                fromDay = range.FromDay,
                toDay = range.ToDay,
                metricA,
                metricB,
                lag,
                points,
                correlation = coefficient,
                metricOptions = DailyMetricOptions
            });
        });

        app.MapGet("/api/dashboard/activity-next-sleep/candidates", async (HttpRequest request, IDocumentStore store, CancellationToken cancellationToken) =>
        {
            var range = ResolveDateRange(request, defaultDays: 90);
            var (fromInclusive, toInclusive) = ToUtcDayRange(range.FromDay, range.ToDay);
            var stravaEnabled = await IsStravaEnabledAsync(store, cancellationToken);
            var activities = FilterVisibleActivities(
                await store.ListByRecordedAtAsync<ActivityRecord>(DocumentTypes.Activity, fromInclusive, toInclusive, cancellationToken),
                stravaEnabled);

            var candidates = activities
                .OrderByDescending(x => x.StartTime)
                .Take(180)
                .Select(x => new
                {
                    x.Id,
                    x.StartTime,
                    name = string.IsNullOrWhiteSpace(x.Name) ? NormalizeActivityType(x.Type) : x.Name,
                    type = NormalizeActivityType(x.Type),
                    durationMinutes = Math.Round(GetEffectiveDurationMinutes(x), 1),
                    x.DistanceKm
                })
                .ToArray();

            return Results.Ok(new { candidates });
        });

        app.MapGet("/api/dashboard/activity-next-sleep/{activityId}", async (string activityId, IDocumentStore store, CancellationToken cancellationToken) =>
        {
            var activity = await store.GetByIdAsync<ActivityRecord>(DocumentTypes.Activity, activityId, cancellationToken);
            if (activity is null)
            {
                return Results.NotFound(new { message = "Activity not found." });
            }

            var stravaEnabled = await IsStravaEnabledAsync(store, cancellationToken);
            if (!stravaEnabled && IsStravaSource(activity.Source))
            {
                return Results.NotFound(new { message = "Activity not found." });
            }

            var nightDay = DateOnly.FromDateTime(activity.StartTime.UtcDateTime);
            var (nightFrom, nightTo) = ToUtcDayRange(nightDay);
            var nightSleepRecords = await store.ListByRecordedAtAsync<SleepSummaryRecord>(DocumentTypes.SleepSummary, nightFrom, nightTo, cancellationToken);
            var nightSleep = nightSleepRecords.OrderByDescending(x => x.SleepHours).FirstOrDefault();

            var thirtyDayStart = nightDay.AddDays(-29);
            var (avgFrom, avgTo) = ToUtcDayRange(thirtyDayStart, nightDay);
            var averageRangeSleep = await store.ListByRecordedAtAsync<SleepSummaryRecord>(DocumentTypes.SleepSummary, avgFrom, avgTo, cancellationToken);
            var averageSleepHours = averageRangeSleep.Count == 0 ? (double?)null : Math.Round(averageRangeSleep.Average(x => x.SleepHours), 2);
            var averageDeepHours = averageRangeSleep.Count == 0 ? (double?)null : Math.Round(averageRangeSleep.Average(x => x.DeepSleepHours), 2);

            var rawPayload = TryParseRawJson(activity.RawJson);

            return Results.Ok(new
            {
                activity = new
                {
                    activity.Id,
                    activity.Source,
                    name = string.IsNullOrWhiteSpace(activity.Name) ? NormalizeActivityType(activity.Type) : activity.Name,
                    type = NormalizeActivityType(activity.Type),
                    activity.StartTime,
                    endTime = GetEffectiveEndTime(activity),
                    durationMinutes = Math.Round(GetEffectiveDurationMinutes(activity), 2),
                    activity.DistanceKm,
                    activity.Steps,
                    activity.AverageHeartRate,
                    activity.MaxHeartRate,
                    loadScore = Math.Round(activity.LoadScore ?? GetEffectiveDurationMinutes(activity), 2),
                    routePoints = activity.RoutePoints ?? ExtractRoutePoints(rawPayload),
                    heartRateSamples = activity.HeartRateSamples ?? ExtractHeartRateSamples(rawPayload)
                },
                nightDay,
                sleep = nightSleep is null
                    ? null
                    : new
                    {
                        nightSleep.Day,
                        totalSleepHours = nightSleep.SleepHours,
                        deepSleepHours = nightSleep.DeepSleepHours,
                        lightSleepHours = nightSleep.LightSleepHours,
                        remSleepHours = nightSleep.RemSleepHours,
                        awakeHours = nightSleep.AwakeHours,
                        schedule = ExtractSleepSchedule(nightSleep.RawJson)
                    },
                comparison = new
                {
                    averageSleepHours,
                    averageDeepHours,
                    sleepDelta = nightSleep is null || !averageSleepHours.HasValue ? (double?)null : Math.Round(nightSleep.SleepHours - averageSleepHours.Value, 2),
                    deepDelta = nightSleep is null || !averageDeepHours.HasValue ? (double?)null : Math.Round(nightSleep.DeepSleepHours - averageDeepHours.Value, 2)
                }
            });
        });

        app.MapGet("/api/dashboard/weekly-training-load", async (HttpRequest request, IDocumentStore store, CancellationToken cancellationToken) =>
        {
            var range = ResolveDateRange(request, defaultDays: 365);
            var firstWeekStart = GetIsoWeekStart(range.FromDay);
            var queryFrom = firstWeekStart.AddDays(-28);
            var queryTo = range.ToDay;
            var (fromInclusive, toInclusive) = ToUtcDayRange(queryFrom, queryTo);
            var stravaEnabled = await IsStravaEnabledAsync(store, cancellationToken);
            var activities = FilterVisibleActivities(
                await store.ListByRecordedAtAsync<ActivityRecord>(DocumentTypes.Activity, fromInclusive, toInclusive, cancellationToken),
                stravaEnabled);
            var steps = await store.ListByRecordedAtAsync<DailyStepsRecord>(DocumentTypes.DailySteps, fromInclusive, toInclusive, cancellationToken);
            var restingByDay = steps
                .GroupBy(x => x.Day)
                .ToDictionary(group => group.Key, group =>
                {
                    foreach (var item in group)
                    {
                        if (TryExtractRestingHeartRate(item.RawJson, out var restingHr))
                        {
                            return restingHr;
                        }
                    }

                    return (int?)null;
                });

            var weekly = activities
                .Select(activity =>
                {
                    var day = DateOnly.FromDateTime(activity.StartTime.UtcDateTime);
                    var weekStart = GetIsoWeekStart(day);
                    var duration = GetEffectiveDurationMinutes(activity);
                    var load = ComputeSimpleLoadMetric(duration, activity.AverageHeartRate, restingByDay.TryGetValue(day, out var rhr) ? rhr : null);
                    return new
                    {
                        weekStart,
                        weekKey = GetIsoWeekKey(day),
                        type = NormalizeActivityType(activity.Type),
                        duration,
                        distanceKm = activity.DistanceKm ?? 0,
                        calories = 0d,
                        load
                    };
                })
                .GroupBy(x => x.weekStart)
                .OrderBy(group => group.Key)
                .Select(group =>
                {
                    var byType = group
                        .GroupBy(x => x.type)
                        .Select(typeGroup => new WeeklyActivityTypeLoad(
                            Type: typeGroup.Key,
                            DurationMinutes: Math.Round(typeGroup.Sum(x => x.duration), 1),
                            DistanceKm: Math.Round(typeGroup.Sum(x => x.distanceKm), 2),
                            Calories: Math.Round(typeGroup.Sum(x => x.calories), 1),
                            Load: Math.Round(typeGroup.Sum(x => x.load), 1)))
                        .OrderByDescending(x => x.DurationMinutes)
                        .ToArray();

                    return new WeeklyLoadPoint(
                        WeekStart: group.Key,
                        WeekKey: GetIsoWeekKey(group.Key),
                        TotalDurationMinutes: Math.Round(group.Sum(x => x.duration), 1),
                        TotalDistanceKm: Math.Round(group.Sum(x => x.distanceKm), 2),
                        TotalCalories: Math.Round(group.Sum(x => x.calories), 1),
                        TotalLoad: Math.Round(group.Sum(x => x.load), 1),
                        ByType: byType,
                        TrailingAverageDuration: null,
                        SpikeWarning: false,
                        DetrainingWarning: false);
                })
                .Where(x => x.WeekStart >= firstWeekStart)
                .ToList();

            var enriched = ApplyWeeklyWarningFlags(weekly);

            return Results.Ok(new
            {
                fromDay = range.FromDay,
                toDay = range.ToDay,
                points = enriched
            });
        });

        app.MapGet("/api/dashboard/hr-zone-distribution", async (HttpRequest request, IDocumentStore store, CancellationToken cancellationToken) =>
        {
            var period = request.Query["period"].FirstOrDefault()?.ToLowerInvariant() == "month" ? "month" : "week";
            var maxHr = ParseIntQuery(request, "maxHr", 190, 120, 230);
            var range = ResolveDateRange(request, defaultDays: 90);
            var (fromInclusive, toInclusive) = ToUtcDayRange(range.FromDay, range.ToDay);
            var stravaEnabled = await IsStravaEnabledAsync(store, cancellationToken);
            var activities = FilterVisibleActivities(
                await store.ListByRecordedAtAsync<ActivityRecord>(DocumentTypes.Activity, fromInclusive, toInclusive, cancellationToken),
                stravaEnabled);

            var grouped = activities
                .Select(activity =>
                {
                    var day = DateOnly.FromDateTime(activity.StartTime.UtcDateTime);
                    var keyDay = period == "month"
                        ? new DateOnly(day.Year, day.Month, 1)
                        : GetIsoWeekStart(day);
                    var samples = activity.HeartRateSamples ?? ExtractHeartRateSamples(TryParseRawJson(activity.RawJson));
                    var zones = ComputeHrZoneSeconds(samples, GetEffectiveDurationMinutes(activity), activity.AverageHeartRate, maxHr);
                    return new { keyDay, zones };
                })
                .GroupBy(x => x.keyDay)
                .OrderBy(x => x.Key)
                .Select(group => new
                {
                    periodStart = group.Key,
                    label = period == "month" ? group.Key.ToString("yyyy-MM", CultureInfo.InvariantCulture) : GetIsoWeekKey(group.Key),
                    zone1Minutes = Math.Round(group.Sum(x => x.zones.Zone1Seconds) / 60d, 1),
                    zone2Minutes = Math.Round(group.Sum(x => x.zones.Zone2Seconds) / 60d, 1),
                    zone3Minutes = Math.Round(group.Sum(x => x.zones.Zone3Seconds) / 60d, 1),
                    zone4Minutes = Math.Round(group.Sum(x => x.zones.Zone4Seconds) / 60d, 1),
                    zone5Minutes = Math.Round(group.Sum(x => x.zones.Zone5Seconds) / 60d, 1),
                    totalMinutes = Math.Round(group.Sum(x => x.zones.TotalSeconds) / 60d, 1)
                })
                .ToArray();

            return Results.Ok(new
            {
                period,
                maxHr,
                fromDay = range.FromDay,
                toDay = range.ToDay,
                points = grouped
            });
        });

        app.MapGet("/api/dashboard/stress-body-battery/{day}", async (string day, IDocumentStore store, CancellationToken cancellationToken) =>
        {
            if (!DateOnly.TryParse(day, out var parsedDay))
            {
                return Results.BadRequest(new { message = "Invalid day. Use yyyy-MM-dd." });
            }

            var (fromInclusive, toInclusive) = ToUtcDayRange(parsedDay);
            var stepRecords = await store.ListByRecordedAtAsync<DailyStepsRecord>(DocumentTypes.DailySteps, fromInclusive, toInclusive, cancellationToken);
            var selected = stepRecords.OrderByDescending(x => x.TotalSteps).FirstOrDefault();

            if (selected is null)
            {
                return Results.Ok(new
                {
                    day = parsedDay,
                    available = false,
                    message = "No monitoring summary found for this day.",
                    stressPoints = Array.Empty<object>(),
                    bodyBatteryPoints = Array.Empty<object>(),
                    activityBlocks = Array.Empty<object>(),
                    sleepWindow = (object?)null
                });
            }

            var stressPoints = ExtractNamedSeries(selected.RawJson, new[] { "stress", "stressLevel", "stress_level" })
                .Select(x => new { minute = x.Minute, value = x.Value })
                .ToArray();
            var bodyBatteryPoints = ExtractNamedSeries(selected.RawJson, new[] { "bodyBattery", "body_battery", "bodyBatteryLevel" })
                .Select(x => new { minute = x.Minute, value = x.Value })
                .ToArray();

            var stravaEnabled = await IsStravaEnabledAsync(store, cancellationToken);
            var activities = FilterVisibleActivities(
                await store.ListByRecordedAtAsync<ActivityRecord>(DocumentTypes.Activity, fromInclusive, toInclusive, cancellationToken),
                stravaEnabled)
                .Where(x => DateOnly.FromDateTime(x.StartTime.UtcDateTime) == parsedDay)
                .Select(x =>
                {
                    var startMinute = x.StartTime.UtcDateTime.Hour * 60 + x.StartTime.UtcDateTime.Minute;
                    var end = GetEffectiveEndTime(x).UtcDateTime;
                    var endMinute = end.Hour * 60 + end.Minute;
                    if (endMinute < startMinute)
                    {
                        endMinute = startMinute;
                    }

                    return new
                    {
                        x.Id,
                        name = string.IsNullOrWhiteSpace(x.Name) ? NormalizeActivityType(x.Type) : x.Name,
                        startMinute,
                        endMinute
                    };
                })
                .ToArray();

            var sleepRecords = await store.ListByRecordedAtAsync<SleepSummaryRecord>(DocumentTypes.SleepSummary, fromInclusive, toInclusive, cancellationToken);
            var sleepRecord = sleepRecords.OrderByDescending(x => x.SleepHours).FirstOrDefault();
            var schedule = sleepRecord is null
                ? (Bedtime: (DateTimeOffset?)null, WakeTime: (DateTimeOffset?)null)
                : ExtractSleepSchedule(sleepRecord.RawJson);

            return Results.Ok(new
            {
                day = parsedDay,
                available = stressPoints.Length > 0 || bodyBatteryPoints.Length > 0,
                message = stressPoints.Length == 0 && bodyBatteryPoints.Length == 0
                    ? "No stress/body battery series were found in monitoring data for this day."
                    : "Series detected.",
                stressPoints,
                bodyBatteryPoints,
                activityBlocks = activities,
                sleepWindow = schedule.Bedtime.HasValue && schedule.WakeTime.HasValue
                    ? new
                    {
                        startMinute = schedule.Bedtime.Value.UtcDateTime.Hour * 60 + schedule.Bedtime.Value.UtcDateTime.Minute,
                        endMinute = schedule.WakeTime.Value.UtcDateTime.Hour * 60 + schedule.WakeTime.Value.UtcDateTime.Minute
                    }
                    : null
            });
        });

        app.MapGet("/api/dashboard/running", async (HttpRequest request, IDocumentStore store, CancellationToken cancellationToken) =>
        {
            var range = ResolveRunningDateRange(request, defaultDays: 90);
            var (fromInclusive, toInclusive) = ToUtcDayRange(range.FromDay, range.ToDay);
            var stravaEnabled = await IsStravaEnabledAsync(store, cancellationToken);
            var allActivities = FilterVisibleActivities(
                await store.ListByRecordedAtAsync<ActivityRecord>(DocumentTypes.Activity, fromInclusive, toInclusive, cancellationToken),
                stravaEnabled);

            var runningActivities = allActivities
                .Where(IsRunningActivity)
                .OrderBy(x => x.StartTime)
                .ToArray();

            var payload = BuildRunningInsightsPayload(range, runningActivities);
            return Results.Ok(payload);
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

    private static (DateTimeOffset FromInclusive, DateTimeOffset ToInclusive) ToUtcDayRange(DateOnly fromDay, DateOnly toDay)
    {
        var from = new DateTimeOffset(fromDay.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);
        var to = new DateTimeOffset(toDay.ToDateTime(TimeOnly.MaxValue), TimeSpan.Zero);
        return (from, to);
    }

    private static DateRange ResolveDateRange(HttpRequest request, int defaultDays)
    {
        var toDay = DateOnly.FromDateTime(DateTime.UtcNow.Date);
        var fromRaw = request.Query["from"].FirstOrDefault();
        var toRaw = request.Query["to"].FirstOrDefault();

        if (DateOnly.TryParse(fromRaw, out var parsedFrom) && DateOnly.TryParse(toRaw, out var parsedTo))
        {
            if (parsedTo < parsedFrom)
            {
                (parsedFrom, parsedTo) = (parsedTo, parsedFrom);
            }

            var clampedFrom = parsedFrom < toDay.AddDays(-730) ? toDay.AddDays(-730) : parsedFrom;
            var clampedTo = parsedTo > toDay ? toDay : parsedTo;
            if (clampedTo < clampedFrom)
            {
                clampedFrom = clampedTo;
            }

            return new DateRange(clampedFrom, clampedTo);
        }

        var rangeRaw = request.Query["range"].FirstOrDefault();
        var days = rangeRaw switch
        {
            "30" => 30,
            "90" => 90,
            "365" => 365,
            _ => defaultDays
        };

        return new DateRange(toDay.AddDays(-(days - 1)), toDay);
    }

    private static IEnumerable<DateOnly> EnumerateDays(DateOnly fromInclusive, DateOnly toInclusive)
    {
        for (var day = fromInclusive; day <= toInclusive; day = day.AddDays(1))
        {
            yield return day;
        }
    }

    private static int ParseIntQuery(HttpRequest request, string key, int defaultValue, int min, int max)
    {
        var raw = request.Query[key].FirstOrDefault();
        if (!int.TryParse(raw, NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed))
        {
            return defaultValue;
        }

        return Math.Min(max, Math.Max(min, parsed));
    }

    private static DailyMetricSnapshot BuildDailyMetricSnapshot(
        DateOnly day,
        IReadOnlyList<ActivityRecord> activities,
        DailyStepsRecord? steps,
        SleepSummaryRecord? sleep)
    {
        var activeMinutes = activities.Sum(GetEffectiveDurationMinutes);
        var activeCalories = steps?.ActiveKilocalories;
        var restingHr = steps is null || !TryExtractRestingHeartRate(steps.RawJson, out var rhr) ? (double?)null : rhr;
        var stepsValue = steps?.TotalSteps;

        var sleepHours = sleep?.SleepHours;
        var deepSleepMinutes = sleep is null ? (double?)null : sleep.DeepSleepHours * 60d;
        var sleepEfficiency = sleep is null
            ? (double?)null
            : sleep.SleepHours + sleep.AwakeHours <= 0
                ? (double?)null
                : (sleep.SleepHours / (sleep.SleepHours + sleep.AwakeHours)) * 100d;

        return new DailyMetricSnapshot(
            Day: day,
            ActiveMinutes: Math.Round(activeMinutes, 2),
            ActiveCalories: activeCalories,
            Steps: stepsValue,
            SleepHours: sleepHours,
            SleepEfficiency: sleepEfficiency,
            RestingHr: restingHr,
            DeepSleepMinutes: deepSleepMinutes);
    }

    private static bool TryGetDailyMetricValue(DailyMetricSnapshot snapshot, string metricKey, out double value)
    {
        value = default;
        var normalized = metricKey.Trim().ToLowerInvariant();

        double? selected = normalized switch
        {
            "activeminutes" => snapshot.ActiveMinutes,
            "activecalories" => snapshot.ActiveCalories,
            "steps" => snapshot.Steps,
            "sleephours" => snapshot.SleepHours,
            "sleepefficiency" => snapshot.SleepEfficiency,
            "restinghr" => snapshot.RestingHr,
            "deepsleepminutes" => snapshot.DeepSleepMinutes,
            _ => null
        };

        if (!selected.HasValue || !double.IsFinite(selected.Value))
        {
            return false;
        }

        value = selected.Value;
        return true;
    }

    private static double? ComputePearsonCorrelation(IEnumerable<double> xValues, IEnumerable<double> yValues)
    {
        var x = xValues.ToArray();
        var y = yValues.ToArray();
        if (x.Length < 2 || y.Length < 2 || x.Length != y.Length)
        {
            return null;
        }

        var xMean = x.Average();
        var yMean = y.Average();
        var numerator = 0d;
        var xVariance = 0d;
        var yVariance = 0d;
        for (var index = 0; index < x.Length; index++)
        {
            var xDelta = x[index] - xMean;
            var yDelta = y[index] - yMean;
            numerator += xDelta * yDelta;
            xVariance += xDelta * xDelta;
            yVariance += yDelta * yDelta;
        }

        if (xVariance <= 0 || yVariance <= 0)
        {
            return null;
        }

        return Math.Round(numerator / Math.Sqrt(xVariance * yVariance), 4);
    }

    private static DateOnly GetIsoWeekStart(DateOnly day)
    {
        var dayOfWeek = (int)day.DayOfWeek;
        var offset = dayOfWeek == 0 ? -6 : 1 - dayOfWeek;
        return day.AddDays(offset);
    }

    private static string GetIsoWeekKey(DateOnly day)
    {
        var week = ISOWeek.GetWeekOfYear(day.ToDateTime(TimeOnly.MinValue));
        var year = ISOWeek.GetYear(day.ToDateTime(TimeOnly.MinValue));
        return $"{year}-W{week:D2}";
    }

    private static double ComputeSimpleLoadMetric(double durationMinutes, int? averageHeartRate, int? restingHeartRate)
    {
        if (!averageHeartRate.HasValue || !restingHeartRate.HasValue || restingHeartRate <= 0)
        {
            return durationMinutes;
        }

        var ratio = Math.Max(0.5, Math.Min(3.5, averageHeartRate.Value / (double)restingHeartRate.Value));
        return durationMinutes * ratio;
    }

    private static IReadOnlyList<WeeklyLoadPoint> ApplyWeeklyWarningFlags(IReadOnlyList<WeeklyLoadPoint> points)
    {
        var updated = points.ToList();
        var lowStreak = 0;
        for (var index = 0; index < updated.Count; index++)
        {
            var trailing = updated
                .Skip(Math.Max(0, index - 4))
                .Take(index - Math.Max(0, index - 4))
                .Select(x => x.TotalDurationMinutes)
                .ToArray();

            var trailingAverage = trailing.Length == 0 ? (double?)null : trailing.Average();
            var spike = trailingAverage.HasValue && trailingAverage.Value > 0 && updated[index].TotalDurationMinutes > trailingAverage.Value * 1.5;
            var low = trailingAverage.HasValue && trailingAverage.Value > 0 && updated[index].TotalDurationMinutes < trailingAverage.Value * 0.25;
            lowStreak = low ? lowStreak + 1 : 0;

            updated[index] = updated[index] with
            {
                TrailingAverageDuration = trailingAverage.HasValue ? Math.Round(trailingAverage.Value, 2) : null,
                SpikeWarning = spike,
                DetrainingWarning = lowStreak >= 2
            };
        }

        return updated;
    }

    private static HrZoneSeconds ComputeHrZoneSeconds(
        IReadOnlyList<ActivityHeartRateSample>? samples,
        double durationMinutes,
        int? averageHeartRate,
        int maxHeartRate)
    {
        var zoneSeconds = new double[5];
        if (samples is { Count: > 1 })
        {
            var ordered = samples.OrderBy(x => x.OffsetSeconds).ToArray();
            for (var index = 0; index < ordered.Length; index++)
            {
                var current = ordered[index];
                var nextOffset = index < ordered.Length - 1 ? ordered[index + 1].OffsetSeconds : current.OffsetSeconds + 1;
                var durationSeconds = Math.Max(1, nextOffset - current.OffsetSeconds);
                zoneSeconds[ResolveHrZone(current.HeartRate, maxHeartRate)] += durationSeconds;
            }
        }
        else if (averageHeartRate.HasValue)
        {
            zoneSeconds[ResolveHrZone(averageHeartRate.Value, maxHeartRate)] += Math.Max(0, durationMinutes * 60d);
        }

        return new HrZoneSeconds(zoneSeconds[0], zoneSeconds[1], zoneSeconds[2], zoneSeconds[3], zoneSeconds[4]);
    }

    private static int ResolveHrZone(int heartRate, int maxHeartRate)
    {
        var ratio = heartRate / (double)Math.Max(maxHeartRate, 1);
        if (ratio < 0.6) return 0;
        if (ratio < 0.7) return 1;
        if (ratio < 0.8) return 2;
        if (ratio < 0.9) return 3;
        return 4;
    }

    private static List<MinuteValuePoint> ExtractNamedSeries(string rawJson, string[] keys)
    {
        var result = new List<MinuteValuePoint>();
        if (string.IsNullOrWhiteSpace(rawJson))
        {
            return result;
        }

        try
        {
            using var document = JsonDocument.Parse(rawJson);
            var seenMinutes = new HashSet<int>();
            CollectNamedSeriesPoints(document.RootElement, keys, result, seenMinutes);
            return result.OrderBy(x => x.Minute).ToList();
        }
        catch
        {
            return result;
        }
    }

    private static void CollectNamedSeriesPoints(JsonElement node, string[] keys, List<MinuteValuePoint> points, HashSet<int> seenMinutes)
    {
        if (node.ValueKind == JsonValueKind.Object)
        {
            foreach (var property in node.EnumerateObject())
            {
                if (keys.Any(key => string.Equals(key, property.Name, StringComparison.OrdinalIgnoreCase)))
                {
                    foreach (var point in ConvertNodeToSeriesPoints(property.Value))
                    {
                        if (seenMinutes.Add(point.Minute))
                        {
                            points.Add(point with { Value = Math.Round(point.Value, 2) });
                        }
                    }
                }

                CollectNamedSeriesPoints(property.Value, keys, points, seenMinutes);
            }
        }
        else if (node.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in node.EnumerateArray())
            {
                CollectNamedSeriesPoints(item, keys, points, seenMinutes);
            }
        }
    }

    private static List<MinuteValuePoint> ConvertNodeToSeriesPoints(JsonElement node)
    {
        var points = new List<MinuteValuePoint>();
        if (node.ValueKind == JsonValueKind.Array)
        {
            var index = 0;
            foreach (var item in node.EnumerateArray())
            {
                if (item.ValueKind == JsonValueKind.Number && item.TryGetDouble(out var scalarValue))
                {
                    points.Add(new MinuteValuePoint(index, scalarValue));
                    index++;
                    continue;
                }

                if (item.ValueKind == JsonValueKind.Object)
                {
                    if (TryGetPropertyIgnoreCase(item, "value", out var valueNode)
                        && valueNode.ValueKind == JsonValueKind.Number
                        && valueNode.TryGetDouble(out var value))
                    {
                        var minute = index;
                        if (TryGetPropertyIgnoreCase(item, "minute", out var minuteNode)
                            && TryReadInt(minuteNode, out var parsedMinute))
                        {
                            minute = parsedMinute;
                        }
                        else if (TryGetPropertyIgnoreCase(item, "timestamp", out var timestampNode)
                                 && ParseTimestampValue(timestampNode) is { } timestamp)
                        {
                            minute = timestamp.UtcDateTime.Hour * 60 + timestamp.UtcDateTime.Minute;
                        }

                        points.Add(new MinuteValuePoint(Math.Max(0, Math.Min(1439, minute)), value));
                        index++;
                    }
                }
            }

            return points;
        }

        if (node.ValueKind == JsonValueKind.Object
            && TryGetPropertyIgnoreCase(node, "data", out var data)
            && data.ValueKind == JsonValueKind.Array)
        {
            return ConvertNodeToSeriesPoints(data);
        }

        return points;
    }

    private static bool TryGetPropertyIgnoreCase(JsonElement node, string propertyName, out JsonElement value)
    {
        value = default;
        if (node.ValueKind != JsonValueKind.Object)
        {
            return false;
        }

        foreach (var property in node.EnumerateObject())
        {
            if (string.Equals(property.Name, propertyName, StringComparison.OrdinalIgnoreCase))
            {
                value = property.Value;
                return true;
            }
        }

        return false;
    }

    private static double?[] ComputeRollingAverage(IReadOnlyList<double?> values, int window)
    {
        var result = new double?[values.Count];
        for (var index = 0; index < values.Count; index++)
        {
            var start = Math.Max(0, index - window + 1);
            var windowValues = new List<double>();
            for (var i = start; i <= index; i++)
            {
                if (values[i].HasValue)
                {
                    windowValues.Add(values[i]!.Value);
                }
            }

            result[index] = windowValues.Count == 0 ? null : Math.Round(windowValues.Average(), 2);
        }

        return result;
    }

    private static double?[] ComputeRollingStandardDeviation(IReadOnlyList<double?> values, int window)
    {
        var result = new double?[values.Count];
        for (var index = 0; index < values.Count; index++)
        {
            var start = Math.Max(0, index - window + 1);
            var windowValues = new List<double>();
            for (var i = start; i <= index; i++)
            {
                if (values[i].HasValue)
                {
                    windowValues.Add(values[i]!.Value);
                }
            }

            result[index] = windowValues.Count < 2 ? null : Math.Round(StandardDeviation(windowValues), 2);
        }

        return result;
    }

    private static double StandardDeviation(IReadOnlyList<double> values)
    {
        if (values.Count < 2)
        {
            return 0;
        }

        var mean = values.Average();
        var variance = values.Sum(x => Math.Pow(x - mean, 2)) / values.Count;
        return Math.Sqrt(Math.Max(variance, 0));
    }

    private static bool TryExtractRestingHeartRate(string rawJson, out int restingHeartRate)
    {
        restingHeartRate = default;
        if (string.IsNullOrWhiteSpace(rawJson))
        {
            return false;
        }

        try
        {
            using var document = JsonDocument.Parse(rawJson);
            var root = document.RootElement;
            var candidates = new[]
            {
                "restingHeartRate",
                "restingHeartRateInBeatsPerMinute",
                "resting_heart_rate",
                "rhr",
                "avgRestingHeartRate"
            };

            foreach (var candidate in candidates)
            {
                if (TryReadIntProperty(root, candidate, out restingHeartRate) && restingHeartRate is > 20 and < 220)
                {
                    return true;
                }
            }
        }
        catch
        {
            return false;
        }

        return false;
    }

    private static (DateTimeOffset? Bedtime, DateTimeOffset? WakeTime) ExtractSleepSchedule(string rawJson)
    {
        if (string.IsNullOrWhiteSpace(rawJson))
        {
            return (null, null);
        }

        try
        {
            using var document = JsonDocument.Parse(rawJson);
            var root = document.RootElement;
            var bedtime =
                TryReadTimestamp(root, "sleepStartTimestampLocal")
                ?? TryReadTimestamp(root, "sleepStartTimestampGMT")
                ?? TryReadTimestamp(root, "bedtime")
                ?? TryReadTimestamp(root, "sleepStartTime");
            var wakeTime =
                TryReadTimestamp(root, "sleepEndTimestampLocal")
                ?? TryReadTimestamp(root, "sleepEndTimestampGMT")
                ?? TryReadTimestamp(root, "wakeTime")
                ?? TryReadTimestamp(root, "sleepEndTime");

            return (bedtime, wakeTime);
        }
        catch
        {
            return (null, null);
        }
    }

    private static bool TryReadIntProperty(JsonElement node, string propertyName, out int value)
    {
        value = default;

        if (node.ValueKind == JsonValueKind.Object)
        {
            foreach (var property in node.EnumerateObject())
            {
                if (string.Equals(property.Name, propertyName, StringComparison.OrdinalIgnoreCase)
                    && TryReadInt(property.Value, out value))
                {
                    return true;
                }

                if (TryReadIntProperty(property.Value, propertyName, out value))
                {
                    return true;
                }
            }
        }
        else if (node.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in node.EnumerateArray())
            {
                if (TryReadIntProperty(item, propertyName, out value))
                {
                    return true;
                }
            }
        }

        return false;
    }

    private static bool TryReadInt(JsonElement valueNode, out int value)
    {
        value = default;

        return valueNode.ValueKind switch
        {
            JsonValueKind.Number when valueNode.TryGetInt32(out value) => true,
            JsonValueKind.Number when valueNode.TryGetDouble(out var asDouble) => TryConvertDoubleToInt(asDouble, out value),
            JsonValueKind.String when int.TryParse(valueNode.GetString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out value) => true,
            _ => false
        };
    }

    private static DateTimeOffset? TryReadTimestamp(JsonElement node, string propertyName)
    {
        if (node.ValueKind == JsonValueKind.Object)
        {
            foreach (var property in node.EnumerateObject())
            {
                if (string.Equals(property.Name, propertyName, StringComparison.OrdinalIgnoreCase))
                {
                    var timestamp = ParseTimestampValue(property.Value);
                    if (timestamp.HasValue)
                    {
                        return timestamp;
                    }
                }

                var nested = TryReadTimestamp(property.Value, propertyName);
                if (nested.HasValue)
                {
                    return nested;
                }
            }
        }
        else if (node.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in node.EnumerateArray())
            {
                var nested = TryReadTimestamp(item, propertyName);
                if (nested.HasValue)
                {
                    return nested;
                }
            }
        }

        return null;
    }

    private static DateTimeOffset? ParseTimestampValue(JsonElement node)
    {
        if (node.ValueKind == JsonValueKind.Number)
        {
            if (!node.TryGetInt64(out var numeric))
            {
                return null;
            }

            return Math.Abs(numeric) > 20_000_000_000
                ? DateTimeOffset.FromUnixTimeMilliseconds(numeric)
                : DateTimeOffset.FromUnixTimeSeconds(numeric);
        }

        if (node.ValueKind != JsonValueKind.String)
        {
            return null;
        }

        var raw = node.GetString();
        if (string.IsNullOrWhiteSpace(raw))
        {
            return null;
        }

        if (long.TryParse(raw, NumberStyles.Integer, CultureInfo.InvariantCulture, out var asLong))
        {
            return Math.Abs(asLong) > 20_000_000_000
                ? DateTimeOffset.FromUnixTimeMilliseconds(asLong)
                : DateTimeOffset.FromUnixTimeSeconds(asLong);
        }

        if (DateTimeOffset.TryParse(raw, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var asOffset))
        {
            return asOffset;
        }

        return null;
    }

    private static bool TryConvertDoubleToInt(double input, out int value)
    {
        if (input < int.MinValue || input > int.MaxValue)
        {
            value = default;
            return false;
        }

        value = (int)Math.Round(input);
        return true;
    }

    private static DateOnly ResolveTargetMonth(HttpRequest request)
    {
        var monthRaw = request.Query["month"].FirstOrDefault();
        if (!string.IsNullOrWhiteSpace(monthRaw)
            && DateOnly.TryParseExact(monthRaw + "-01", "yyyy-MM-dd", CultureInfo.InvariantCulture, DateTimeStyles.None, out var month))
        {
            return month;
        }

        var now = DateTime.UtcNow;
        return new DateOnly(now.Year, now.Month, 1);
    }

    private static MonthlyLifeSnapshot BuildMonthlyLifeSnapshot(
        DateOnly fromDay,
        DateOnly toDay,
        IReadOnlyList<ActivityRecord> activities,
        IReadOnlyList<DailyStepsRecord> steps,
        IReadOnlyList<SleepSummaryRecord> sleep)
    {
        var activityByMonth = activities
            .Where(x => DateOnly.FromDateTime(x.StartTime.UtcDateTime) >= fromDay && DateOnly.FromDateTime(x.StartTime.UtcDateTime) <= toDay)
            .ToArray();
        var stepsByMonth = steps.Where(x => x.Day >= fromDay && x.Day <= toDay).ToArray();
        var sleepByMonth = sleep.Where(x => x.Day >= fromDay && x.Day <= toDay).ToArray();

        var restingHeartRateValues = stepsByMonth
            .Select(step => TryExtractRestingHeartRate(step.RawJson, out var rhr) ? (double?)rhr : null)
            .Where(x => x.HasValue)
            .Select(x => x!.Value)
            .ToArray();

        var totalSleep = sleepByMonth.Sum(x => x.SleepHours);
        var totalDeep = sleepByMonth.Sum(x => x.DeepSleepHours);
        var groupedSteps = stepsByMonth.GroupBy(x => x.Day).Select(g => g.Max(x => x.TotalSteps)).ToArray();
        var durations = activityByMonth.Select(GetEffectiveDurationMinutes).ToArray();
        var longestByDistance = activityByMonth
            .Where(x => x.DistanceKm.HasValue)
            .OrderByDescending(x => x.DistanceKm)
            .FirstOrDefault();
        var longestByDuration = activityByMonth
            .OrderByDescending(GetEffectiveDurationMinutes)
            .FirstOrDefault();

        var longestScore = Math.Max(
            longestByDistance?.DistanceKm ?? 0,
            longestByDuration is null ? 0 : GetEffectiveDurationMinutes(longestByDuration));
        var longestLabel = longestByDistance is not null && (longestByDistance.DistanceKm ?? 0) >= (longestByDuration is null ? 0 : GetEffectiveDurationMinutes(longestByDuration))
            ? $"{longestByDistance.DistanceKm:0.0} km"
            : longestByDuration is null
                ? "-"
                : FormatDurationForSummary(GetEffectiveDurationMinutes(longestByDuration));

        return new MonthlyLifeSnapshot(
            AvgRestingHr: restingHeartRateValues.Length == 0 ? null : Math.Round(restingHeartRateValues.Average(), 1),
            AvgSleepHours: sleepByMonth.Length == 0 ? null : Math.Round(sleepByMonth.Average(x => x.SleepHours), 2),
            AvgDeepSleepPct: totalSleep <= 0 ? null : Math.Round((totalDeep / totalSleep) * 100, 1),
            TotalSteps: groupedSteps.Sum(),
            TotalActiveMinutes: Math.Round(durations.Sum(), 1),
            LongestActivityLabel: longestLabel,
            LongestActivityScore: Math.Round(longestScore, 2),
            ActiveDays: activityByMonth.Select(x => DateOnly.FromDateTime(x.StartTime.UtcDateTime)).Distinct().Count());
    }

    private static double? ComputeDelta(double? current, double? previous)
    {
        if (!current.HasValue || !previous.HasValue)
        {
            return null;
        }

        return Math.Round(current.Value - previous.Value, 2);
    }

    private static double ComputeDelta(double current, double previous)
    {
        return Math.Round(current - previous, 2);
    }

    private static int ComputeDelta(int current, int previous)
    {
        return current - previous;
    }

    private static string FormatDurationForSummary(double totalMinutes)
    {
        var rounded = Math.Max(0, (int)Math.Round(totalMinutes));
        if (rounded >= 60)
        {
            var hours = rounded / 60;
            var minutes = rounded % 60;
            return minutes > 0 ? $"{hours}h {minutes}m" : $"{hours}h";
        }

        return $"{rounded}m";
    }

    private static object BuildRunningInsightsPayload(DateRange range, IReadOnlyList<ActivityRecord> activities)
    {
        var runs = activities
            .Select(ToRunningRunPoint)
            .Where(x => x is not null)
            .Select(x => x!)
            .OrderBy(x => x.StartTime)
            .ToList();

        var maxHrReference = runs
            .Select(x => x.MaxHeartRate)
            .Where(x => x.HasValue)
            .Select(x => x!.Value)
            .DefaultIfEmpty(190)
            .Max();

        runs = runs
            .Select(run =>
            {
                var normalizedPaceElevation = run.PaceMinPerKm.HasValue && run.ElevationGainPerKm.HasValue
                    ? Math.Round(Math.Max(0.1, run.PaceMinPerKm.Value - (run.ElevationGainPerKm.Value * 0.003)), 3)
                    : (double?)null;

                var normalizedPaceHr = run.PaceMinPerKm.HasValue && run.AverageHeartRate.HasValue
                    ? Math.Round(Math.Max(0.1, run.PaceMinPerKm.Value * (run.AverageHeartRate.Value / (0.8 * Math.Max(maxHrReference, 1)))), 3)
                    : (double?)null;

                return run with
                {
                    NormalizedPaceElevation = normalizedPaceElevation,
                    NormalizedPaceHr = normalizedPaceHr
                };
            })
            .ToList();

        var totalDistance = runs.Sum(x => x.DistanceKm ?? 0d);
        var totalDuration = runs.Sum(x => x.DurationMinutes);
        var avgPace = totalDistance > 0.001 ? totalDuration / totalDistance : (double?)null;

        var weeklyDistance = runs
            .GroupBy(x => GetIsoWeekStart(x.Day))
            .ToDictionary(g => g.Key, g => g.Sum(x => x.DistanceKm ?? 0d));

        var currentWeek = GetIsoWeekStart(DateOnly.FromDateTime(DateTime.UtcNow.Date));
        var weeklyStreak = 0;
        for (var weekCursor = currentWeek; weekCursor >= currentWeek.AddYears(-3); weekCursor = weekCursor.AddDays(-7))
        {
            if (!weeklyDistance.TryGetValue(weekCursor, out var distance) || distance <= 0.001)
            {
                break;
            }

            weeklyStreak++;
        }

        var bestEverPace = runs
            .Where(x => x.PaceMinPerKm.HasValue && (x.DistanceKm ?? 0) >= 1)
            .OrderBy(x => x.PaceMinPerKm)
            .ThenByDescending(x => x.DistanceKm)
            .FirstOrDefault();

        var pacePoints = runs
            .Where(x => x.PaceMinPerKm.HasValue)
            .Select((run, index) =>
            {
                var windowStart = Math.Max(0, index - 9);
                var rollingWindow = runs
                    .Skip(windowStart)
                    .Take(index - windowStart + 1)
                    .Select(x => x.PaceMinPerKm)
                    .Where(x => x.HasValue)
                    .Select(x => x!.Value)
                    .ToArray();

                return new
                {
                    day = run.Day,
                    activityId = run.Id,
                    paceMinPerKm = run.PaceMinPerKm,
                    distanceKm = run.DistanceKm,
                    averageHeartRate = run.AverageHeartRate,
                    maxHeartRate = run.MaxHeartRate,
                    elevationGainPerKm = run.ElevationGainPerKm,
                    normalizedPaceElevation = run.NormalizedPaceElevation,
                    normalizedPaceHr = run.NormalizedPaceHr,
                    rolling10RunPace = rollingWindow.Length == 0 ? (double?)null : Math.Round(rollingWindow.Average(), 3)
                };
            })
            .ToArray();

        var weeklyVolume = BuildRunningWeeklyVolume(range, runs);
        var monthlyVolume = BuildRunningMonthlyVolume(range, runs);
        var efficiencyMonthly = BuildRunningEfficiencyMonthly(range, runs);
        var fadeTrend = runs
            .Where(x => x.FadeIndex.HasValue)
            .Select(x => new
            {
                day = x.Day,
                activityId = x.Id,
                fadeIndex = Math.Round(x.FadeIndex!.Value, 3)
            })
            .ToArray();

        var prTable = BuildRunningPrTable(runs);
        var predictor = BuildRunningRacePrediction(range, runs);

        return new
        {
            fromDay = range.FromDay,
            toDay = range.ToDay,
            summary = new
            {
                totalRuns = runs.Count,
                totalDistanceKm = Math.Round(totalDistance, 2),
                totalDurationMinutes = Math.Round(totalDuration, 1),
                avgPaceMinPerKm = avgPace is null ? (double?)null : Math.Round(avgPace.Value, 3),
                currentWeeklyStreak = weeklyStreak,
                bestEverPace = bestEverPace is null
                    ? null
                    : new
                    {
                        day = bestEverPace.Day,
                        activityId = bestEverPace.Id,
                        paceMinPerKm = Math.Round(bestEverPace.PaceMinPerKm!.Value, 3),
                        distanceKm = bestEverPace.DistanceKm
                    }
            },
            paceTrend = new
            {
                points = pacePoints
            },
            volumeTrend = new
            {
                weekly = weeklyVolume,
                monthly = monthlyVolume
            },
            efficiencyTrend = new
            {
                monthly = efficiencyMonthly
            },
            pacingConsistency = new
            {
                fadeTrend,
                runs = runs.Select(x => new
                {
                    day = x.Day,
                    activityId = x.Id,
                    name = x.Name,
                    fadeIndex = x.FadeIndex,
                    splits = x.Splits.Select(split => new
                    {
                        split.DistanceKm,
                        split.DurationMinutes,
                        split.PaceMinPerKm,
                        split.AverageHeartRate,
                        split.ElevationGainM,
                        split.CadenceSpm
                    })
                })
            },
            prTable,
            racePredictor = predictor,
            runs = runs.Select(x => new
            {
                day = x.Day,
                activityId = x.Id,
                name = x.Name,
                distanceKm = x.DistanceKm,
                durationMinutes = x.DurationMinutes,
                paceMinPerKm = x.PaceMinPerKm,
                averageHeartRate = x.AverageHeartRate,
                maxHeartRate = x.MaxHeartRate,
                elevationGainM = x.ElevationGainM,
                cadenceSpm = x.CadenceSpm,
                fadeIndex = x.FadeIndex,
                efficiencyRatio = x.EfficiencyRatio,
                zone34Ratio = x.Zone34Ratio,
                elevationGainPerKm = x.ElevationGainPerKm,
                normalizedPaceElevation = x.NormalizedPaceElevation,
                normalizedPaceHr = x.NormalizedPaceHr
            })
        };
    }

    private static RunningRunPoint? ToRunningRunPoint(ActivityRecord activity)
    {
        var durationMinutes = Math.Round(Math.Max(0, GetEffectiveDurationMinutes(activity)), 3);
        if (durationMinutes <= 0.01)
        {
            return null;
        }

        var distanceKm = activity.DistanceKm.HasValue && activity.DistanceKm.Value > 0
            ? (double?)Math.Round(activity.DistanceKm.Value, 3)
            : null;
        var pace = distanceKm.HasValue && distanceKm.Value > 0.01
            ? (double?)Math.Round(durationMinutes / distanceKm.Value, 3)
            : null;

        var elevationGain = ExtractElevationGainMeters(activity.RawJson);
        var cadence = ExtractCadenceSpm(activity.RawJson);
        var splits = ExtractSplits(activity.RawJson, durationMinutes, distanceKm);
        var fadeIndex = ComputeFadeIndex(splits);
        var efficiencyRatio = activity.AverageHeartRate.HasValue && pace.HasValue && pace.Value > 0
            ? (double?)Math.Round(activity.AverageHeartRate.Value / pace.Value, 4)
            : null;

        var elevationGainPerKm = elevationGain.HasValue && distanceKm.HasValue && distanceKm.Value > 0.001
            ? (double?)Math.Round(elevationGain.Value / distanceKm.Value, 3)
            : null;

        var zone34Ratio = ComputeZone34Ratio(activity);

        return new RunningRunPoint(
            Id: activity.Id,
            Day: DateOnly.FromDateTime(activity.StartTime.UtcDateTime),
            StartTime: activity.StartTime,
            Name: string.IsNullOrWhiteSpace(activity.Name) ? NormalizeActivityType(activity.Type) : activity.Name!,
            DurationMinutes: durationMinutes,
            DistanceKm: distanceKm,
            PaceMinPerKm: pace,
            AverageHeartRate: activity.AverageHeartRate,
            MaxHeartRate: activity.MaxHeartRate,
            ElevationGainM: elevationGain,
            CadenceSpm: cadence,
            Splits: splits,
            FadeIndex: fadeIndex,
            EfficiencyRatio: efficiencyRatio,
            ElevationGainPerKm: elevationGainPerKm,
            NormalizedPaceElevation: null,
            NormalizedPaceHr: null,
            Zone34Ratio: zone34Ratio);
    }

    private static bool IsRunningActivity(ActivityRecord activity)
    {
        var normalized = NormalizeActivityType(activity.Type)
            .Replace(' ', '_')
            .Replace('-', '_');

        return normalized switch
        {
            "running" => true,
            "run" => true,
            "trail_running" => true,
            "trailrun" => true,
            "trail_run" => true,
            "treadmill_running" => true,
            "treadmillrun" => true,
            "virtual_run" => true,
            "virtualrun" => true,
            _ => normalized.Contains("run", StringComparison.OrdinalIgnoreCase)
                 && !normalized.Contains("walk", StringComparison.OrdinalIgnoreCase)
        };
    }

    private static DateRange ResolveRunningDateRange(HttpRequest request, int defaultDays)
    {
        var toDay = DateOnly.FromDateTime(DateTime.UtcNow.Date);
        var fromRaw = request.Query["from"].FirstOrDefault();
        var toRaw = request.Query["to"].FirstOrDefault();
        if (DateOnly.TryParse(fromRaw, out var parsedFrom) && DateOnly.TryParse(toRaw, out var parsedTo))
        {
            if (parsedTo < parsedFrom)
            {
                (parsedFrom, parsedTo) = (parsedTo, parsedFrom);
            }

            if (parsedTo > toDay)
            {
                parsedTo = toDay;
            }

            if (parsedFrom < new DateOnly(2000, 1, 1))
            {
                parsedFrom = new DateOnly(2000, 1, 1);
            }

            return new DateRange(parsedFrom, parsedTo);
        }

        var rangeRaw = request.Query["range"].FirstOrDefault()?.Trim().ToLowerInvariant();
        if (rangeRaw == "ytd")
        {
            return new DateRange(new DateOnly(toDay.Year, 1, 1), toDay);
        }

        if (rangeRaw == "all")
        {
            return new DateRange(new DateOnly(2000, 1, 1), toDay);
        }

        var days = rangeRaw switch
        {
            "90" => 90,
            "30" => 30,
            "365" => 365,
            _ => defaultDays
        };

        return new DateRange(toDay.AddDays(-(days - 1)), toDay);
    }

    private static IReadOnlyList<object> BuildRunningWeeklyVolume(DateRange range, IReadOnlyList<RunningRunPoint> runs)
    {
        var firstWeek = GetIsoWeekStart(range.FromDay);
        var lastWeek = GetIsoWeekStart(range.ToDay);
        var byWeek = runs
            .GroupBy(x => GetIsoWeekStart(x.Day))
            .ToDictionary(g => g.Key, g => g.Sum(x => x.DistanceKm ?? 0d));

        var values = new List<(DateOnly WeekStart, double DistanceKm)>();
        for (var week = firstWeek; week <= lastWeek; week = week.AddDays(7))
        {
            var distance = byWeek.TryGetValue(week, out var value) ? value : 0d;
            values.Add((week, distance));
        }

        var lowStreak = 0;
        var output = new List<object>(values.Count);
        for (var index = 0; index < values.Count; index++)
        {
            var trailing = values
                .Skip(Math.Max(0, index - 4))
                .Take(index - Math.Max(0, index - 4))
                .Select(x => x.DistanceKm)
                .ToArray();

            var trailingAverage = trailing.Length == 0 ? (double?)null : trailing.Average();
            var spikeWarning = trailingAverage.HasValue
                && trailingAverage.Value > 0.001
                && values[index].DistanceKm > trailingAverage.Value * 1.3;

            var low = trailingAverage.HasValue
                && trailingAverage.Value > 0.001
                && values[index].DistanceKm < trailingAverage.Value * 0.5;
            lowStreak = low ? lowStreak + 1 : 0;

            output.Add(new
            {
                weekStart = values[index].WeekStart,
                weekKey = GetIsoWeekKey(values[index].WeekStart),
                distanceKm = Math.Round(values[index].DistanceKm, 2),
                trailing4WeekDistanceKm = trailingAverage.HasValue ? Math.Round(trailingAverage.Value, 2) : (double?)null,
                spikeWarning,
                detrainingWarning = lowStreak >= 3
            });
        }

        return output;
    }

    private static IReadOnlyList<object> BuildRunningMonthlyVolume(DateRange range, IReadOnlyList<RunningRunPoint> runs)
    {
        var firstMonth = new DateOnly(range.FromDay.Year, range.FromDay.Month, 1);
        var lastMonth = new DateOnly(range.ToDay.Year, range.ToDay.Month, 1);
        var byMonth = runs
            .GroupBy(x => new DateOnly(x.Day.Year, x.Day.Month, 1))
            .ToDictionary(g => g.Key, g => g.Sum(x => x.DistanceKm ?? 0d));

        var output = new List<object>();
        for (var month = firstMonth; month <= lastMonth; month = month.AddMonths(1))
        {
            output.Add(new
            {
                month,
                label = month.ToString("yyyy-MM", CultureInfo.InvariantCulture),
                distanceKm = Math.Round(byMonth.TryGetValue(month, out var value) ? value : 0d, 2)
            });
        }

        return output;
    }

    private static IReadOnlyList<object> BuildRunningEfficiencyMonthly(DateRange range, IReadOnlyList<RunningRunPoint> runs)
    {
        var monthly = runs
            .Where(x => x.EfficiencyRatio.HasValue)
            .GroupBy(x => new DateOnly(x.Day.Year, x.Day.Month, 1))
            .OrderBy(g => g.Key)
            .Select(group => new
            {
                month = group.Key,
                label = group.Key.ToString("yyyy-MM", CultureInfo.InvariantCulture),
                ratio = Math.Round(group.Average(x => x.EfficiencyRatio!.Value), 4),
                runCount = group.Count()
            })
            .ToArray();

        if (monthly.Length > 0)
        {
            return monthly;
        }

        var firstMonth = new DateOnly(range.FromDay.Year, range.FromDay.Month, 1);
        var lastMonth = new DateOnly(range.ToDay.Year, range.ToDay.Month, 1);
        var output = new List<object>();
        for (var month = firstMonth; month <= lastMonth; month = month.AddMonths(1))
        {
            output.Add(new
            {
                month,
                label = month.ToString("yyyy-MM", CultureInfo.InvariantCulture),
                ratio = (double?)null,
                runCount = 0
            });
        }

        return output;
    }

    private static object BuildRunningPrTable(IReadOnlyList<RunningRunPoint> runs)
    {
        var targets = new[]
        {
            new { Label = "1k", DistanceKm = 1d },
            new { Label = "5k", DistanceKm = 5d },
            new { Label = "10k", DistanceKm = 10d },
            new { Label = "half", DistanceKm = 21.0975d },
            new { Label = "marathon", DistanceKm = 42.195d }
        };

        var distancePrs = targets
            .Select(target =>
            {
                var best = runs
                    .Where(run => run.DistanceKm.HasValue
                                  && run.DurationMinutes > 0
                                  && run.DistanceKm.Value >= target.DistanceKm * 0.95
                                  && run.DistanceKm.Value <= target.DistanceKm * 1.05)
                    .Select(run => new
                    {
                        run.Id,
                        run.Day,
                        run.DistanceKm,
                        run.DurationMinutes,
                        EquivalentDurationMinutes = run.DurationMinutes * (target.DistanceKm / Math.Max(run.DistanceKm!.Value, 0.001)),
                        run.PaceMinPerKm
                    })
                    .OrderBy(x => x.EquivalentDurationMinutes)
                    .ThenBy(x => x.DurationMinutes)
                    .FirstOrDefault();

                return best is null
                    ? new
                    {
                        label = target.Label,
                        targetDistanceKm = target.DistanceKm,
                        activityId = (string?)null,
                        day = (DateOnly?)null,
                        distanceKm = (double?)null,
                        durationMinutes = (double?)null,
                        equivalentDurationMinutes = (double?)null,
                        paceMinPerKm = (double?)null
                    }
                    : new
                    {
                        label = target.Label,
                        targetDistanceKm = target.DistanceKm,
                        activityId = (string?)best.Id,
                        day = (DateOnly?)best.Day,
                        distanceKm = best.DistanceKm,
                        durationMinutes = (double?)Math.Round(best.DurationMinutes, 2),
                        equivalentDurationMinutes = (double?)Math.Round(best.EquivalentDurationMinutes, 2),
                        paceMinPerKm = best.PaceMinPerKm
                    };
            })
            .ToArray();

        var longestRun = runs
            .Where(x => x.DistanceKm.HasValue)
            .OrderByDescending(x => x.DistanceKm)
            .ThenBy(x => x.DurationMinutes)
            .FirstOrDefault();

        var mostElevation = runs
            .Where(x => x.ElevationGainM.HasValue)
            .OrderByDescending(x => x.ElevationGainM)
            .ThenByDescending(x => x.DistanceKm)
            .FirstOrDefault();

        return new
        {
            distancePrs,
            longestRun = longestRun is null
                ? null
                : new
                {
                    activityId = longestRun.Id,
                    day = longestRun.Day,
                    distanceKm = longestRun.DistanceKm,
                    durationMinutes = longestRun.DurationMinutes,
                    paceMinPerKm = longestRun.PaceMinPerKm
                },
            mostElevation = mostElevation is null
                ? null
                : new
                {
                    activityId = mostElevation.Id,
                    day = mostElevation.Day,
                    elevationGainM = mostElevation.ElevationGainM,
                    distanceKm = mostElevation.DistanceKm,
                    durationMinutes = mostElevation.DurationMinutes
                }
        };
    }

    private static object BuildRunningRacePrediction(DateRange range, IReadOnlyList<RunningRunPoint> runs)
    {
        var recentStart = range.ToDay.AddDays(-89);
        var recent = runs
            .Where(x => x.Day >= recentStart
                        && x.DistanceKm.HasValue
                        && x.DistanceKm.Value >= 3
                        && x.DurationMinutes > 0)
            .Select(x => new
            {
                Run = x,
                Speed = x.DistanceKm!.Value / x.DurationMinutes
            })
            .OrderByDescending(x => x.Speed)
            .ThenByDescending(x => x.Run.DistanceKm)
            .FirstOrDefault();

        if (recent is null)
        {
            return new
            {
                source = (object?)null,
                predictions = Array.Empty<object>()
            };
        }

        var sourceDistance = recent.Run.DistanceKm!.Value;
        var sourceDuration = recent.Run.DurationMinutes;
        var targets = new[]
        {
            new { Label = "5k", DistanceKm = 5d },
            new { Label = "10k", DistanceKm = 10d },
            new { Label = "half", DistanceKm = 21.0975d },
            new { Label = "marathon", DistanceKm = 42.195d }
        };

        var predictions = targets
            .Select(target =>
            {
                var predictedMinutes = sourceDuration * Math.Pow(target.DistanceKm / sourceDistance, 1.06);
                var actual = runs
                    .Where(run => run.DistanceKm.HasValue
                                  && run.DistanceKm.Value >= target.DistanceKm * 0.95
                                  && run.DistanceKm.Value <= target.DistanceKm * 1.05)
                    .OrderBy(run => run.DurationMinutes)
                    .FirstOrDefault();

                return new
                {
                    label = target.Label,
                    distanceKm = target.DistanceKm,
                    predictedMinutes = Math.Round(predictedMinutes, 2),
                    actualMinutes = actual is null ? (double?)null : Math.Round(actual.DurationMinutes, 2),
                    actualActivityId = actual?.Id,
                    deltaMinutes = actual is null ? (double?)null : Math.Round(actual.DurationMinutes - predictedMinutes, 2)
                };
            })
            .ToArray();

        return new
        {
            source = new
            {
                activityId = recent.Run.Id,
                day = recent.Run.Day,
                distanceKm = sourceDistance,
                durationMinutes = sourceDuration,
                paceMinPerKm = recent.Run.PaceMinPerKm
            },
            predictions
        };
    }

    private static double? ComputeZone34Ratio(ActivityRecord activity)
    {
        var samples = activity.HeartRateSamples ?? ExtractHeartRateSamples(TryParseRawJson(activity.RawJson));
        var maxHeartRate = activity.MaxHeartRate ?? 190;
        var zones = ComputeHrZoneSeconds(samples, GetEffectiveDurationMinutes(activity), activity.AverageHeartRate, maxHeartRate);
        if (zones.TotalSeconds <= 0)
        {
            return null;
        }

        return Math.Round((zones.Zone3Seconds + zones.Zone4Seconds) / zones.TotalSeconds, 4);
    }

    private static double? ComputeFadeIndex(IReadOnlyList<RunningSplitPoint> splits)
    {
        if (splits.Count < 2)
        {
            return null;
        }

        var totalDistance = splits.Sum(x => x.DistanceKm);
        if (totalDistance <= 0.001)
        {
            return null;
        }

        var half = totalDistance / 2d;
        var firstHalfMinutes = 0d;
        var firstHalfDistance = 0d;
        var secondHalfMinutes = 0d;
        var secondHalfDistance = 0d;
        var covered = 0d;

        foreach (var split in splits)
        {
            var segmentDistance = Math.Max(0, split.DistanceKm);
            var segmentMinutes = Math.Max(0, split.DurationMinutes);
            if (segmentDistance <= 0.0001 || segmentMinutes <= 0.0001)
            {
                continue;
            }

            var start = covered;
            var end = covered + segmentDistance;

            var firstPartDistance = Math.Max(0, Math.Min(end, half) - start);
            var secondPartDistance = Math.Max(0, end - Math.Max(start, half));
            var minutesPerKm = segmentMinutes / segmentDistance;

            if (firstPartDistance > 0)
            {
                firstHalfDistance += firstPartDistance;
                firstHalfMinutes += firstPartDistance * minutesPerKm;
            }

            if (secondPartDistance > 0)
            {
                secondHalfDistance += secondPartDistance;
                secondHalfMinutes += secondPartDistance * minutesPerKm;
            }

            covered = end;
        }

        if (firstHalfDistance <= 0.001 || secondHalfDistance <= 0.001)
        {
            return null;
        }

        var firstHalfPace = firstHalfMinutes / firstHalfDistance;
        var secondHalfPace = secondHalfMinutes / secondHalfDistance;
        return Math.Round(secondHalfPace - firstHalfPace, 4);
    }

    private static IReadOnlyList<RunningSplitPoint> ExtractSplits(string rawJson, double durationMinutes, double? totalDistanceKm)
    {
        if (string.IsNullOrWhiteSpace(rawJson))
        {
            return Array.Empty<RunningSplitPoint>();
        }

        try
        {
            using var document = JsonDocument.Parse(rawJson);
            if (!TryFindNamedArray(document.RootElement, out var splitsArray, "splits", "laps", "activity_laps", "activitylaps", "lap_summaries", "lapsummaries"))
            {
                return Array.Empty<RunningSplitPoint>();
            }

            var result = new List<RunningSplitPoint>();
            foreach (var item in splitsArray.EnumerateArray())
            {
                if (item.ValueKind != JsonValueKind.Object)
                {
                    continue;
                }

                var distanceKm = TryReadDistanceKmFromSplit(item);
                var splitMinutes = TryReadDurationMinutesFromSplit(item);
                var pace = TryReadNumericProperty(item, "pace", "avg_pace", "average_pace", "pace_min_per_km");
                var hr = TryReadIntProperty(item, "avg_hr", "average_hr", "averageHeartRate", "heartrate");
                var elevationGain = TryReadNumericProperty(item, "elevation_gain", "elevationGain", "total_ascent", "ascent");
                var cadence = TryReadIntProperty(item, "cadence", "avg_cadence", "average_cadence", "averageRunningCadenceInStepsPerMinute");

                if ((!distanceKm.HasValue || distanceKm.Value <= 0.001) && (!splitMinutes.HasValue || splitMinutes.Value <= 0.001))
                {
                    continue;
                }

                if (!splitMinutes.HasValue && distanceKm.HasValue && pace.HasValue)
                {
                    splitMinutes = pace.Value * distanceKm.Value;
                }

                if (!pace.HasValue && splitMinutes.HasValue && distanceKm.HasValue && distanceKm.Value > 0.001)
                {
                    pace = splitMinutes.Value / distanceKm.Value;
                }

                var finalDistance = distanceKm ?? 0;
                var finalMinutes = splitMinutes ?? 0;
                if (finalDistance <= 0.001 || finalMinutes <= 0.001)
                {
                    continue;
                }

                result.Add(new RunningSplitPoint(
                    DistanceKm: Math.Round(finalDistance, 3),
                    DurationMinutes: Math.Round(finalMinutes, 3),
                    PaceMinPerKm: pace.HasValue ? Math.Round(pace.Value, 3) : (double?)null,
                    AverageHeartRate: hr,
                    ElevationGainM: elevationGain,
                    CadenceSpm: cadence));
            }

            if (result.Count > 1)
            {
                return result;
            }
        }
        catch
        {
            return Array.Empty<RunningSplitPoint>();
        }

        return Array.Empty<RunningSplitPoint>();
    }

    private static double? TryReadDistanceKmFromSplit(JsonElement split)
    {
        var value = TryReadNumericProperty(split,
            "distance_km",
            "distanceKm",
            "lap_distance_km",
            "distance",
            "distance_m",
            "distance_meter",
            "distance_meters",
            "lapDistance");

        if (!value.HasValue || !double.IsFinite(value.Value) || value.Value <= 0)
        {
            return null;
        }

        if (value.Value > 1000)
        {
            return value.Value / 1000d;
        }

        if (value.Value > 60)
        {
            return value.Value / 1000d;
        }

        return value.Value;
    }

    private static double? TryReadDurationMinutesFromSplit(JsonElement split)
    {
        var candidates = new[]
        {
            "duration_minutes",
            "durationMinutes",
            "moving_time_minutes",
            "elapsed_time_minutes",
            "duration",
            "time",
            "moving_time",
            "elapsed_time",
            "duration_seconds",
            "time_seconds",
            "moving_time_seconds"
        };

        foreach (var candidate in candidates)
        {
            if (!TryReadNumericPropertyWithMatchedKey(split, out var matchedKey, out var value, candidate))
            {
                continue;
            }

            if (!double.IsFinite(value) || value <= 0)
            {
                continue;
            }

            var key = matchedKey.ToLowerInvariant();
            if (key.Contains("hour", StringComparison.Ordinal))
            {
                return value * 60d;
            }

            if (key.Contains("minute", StringComparison.Ordinal) || key.EndsWith("_min", StringComparison.Ordinal))
            {
                return value;
            }

            if (key.Contains("second", StringComparison.Ordinal) || key.EndsWith("_sec", StringComparison.Ordinal))
            {
                return value / 60d;
            }

            if (value >= 120)
            {
                return value / 60d;
            }

            return value;
        }

        return null;
    }

    private static double? ExtractElevationGainMeters(string rawJson)
    {
        return TryReadNumericPropertyFromJson(rawJson,
            "elevation_gain",
            "elevationGain",
            "total_elevation_gain",
            "totalAscent",
            "ascent",
            "total_ascent",
            "totalClimb");
    }

    private static int? ExtractCadenceSpm(string rawJson)
    {
        return TryReadIntPropertyFromJson(rawJson,
            "cadence",
            "avg_cadence",
            "average_cadence",
            "averageCadence",
            "averageRunningCadenceInStepsPerMinute");
    }

    private static double? TryReadNumericPropertyFromJson(string rawJson, params string[] candidates)
    {
        if (string.IsNullOrWhiteSpace(rawJson))
        {
            return null;
        }

        try
        {
            using var document = JsonDocument.Parse(rawJson);
            return TryReadNumericProperty(document.RootElement, candidates);
        }
        catch
        {
            return null;
        }
    }

    private static int? TryReadIntPropertyFromJson(string rawJson, params string[] candidates)
    {
        if (string.IsNullOrWhiteSpace(rawJson))
        {
            return null;
        }

        try
        {
            using var document = JsonDocument.Parse(rawJson);
            return TryReadIntProperty(document.RootElement, candidates);
        }
        catch
        {
            return null;
        }
    }

    private static double? TryReadNumericProperty(JsonElement node, params string[] candidates)
    {
        return TryReadNumericPropertyWithMatchedKey(node, out _, out var value, candidates)
            ? value
            : null;
    }

    private static bool TryReadNumericPropertyWithMatchedKey(JsonElement node, out string matchedKey, out double value, params string[] candidates)
    {
        matchedKey = string.Empty;
        value = default;
        var normalizedCandidates = candidates
            .Select(NormalizeFieldKey)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        return TryReadNumericPropertyCore(node, normalizedCandidates, out matchedKey, out value);
    }

    private static bool TryReadNumericPropertyCore(JsonElement node, HashSet<string> normalizedCandidates, out string matchedKey, out double value)
    {
        matchedKey = string.Empty;
        value = default;

        if (node.ValueKind == JsonValueKind.Object)
        {
            foreach (var property in node.EnumerateObject())
            {
                var normalized = NormalizeFieldKey(property.Name);
                if (normalizedCandidates.Contains(normalized)
                    && TryReadDouble(property.Value, out value))
                {
                    matchedKey = property.Name;
                    return true;
                }

                if (TryReadNumericPropertyCore(property.Value, normalizedCandidates, out matchedKey, out value))
                {
                    return true;
                }
            }
        }
        else if (node.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in node.EnumerateArray())
            {
                if (TryReadNumericPropertyCore(item, normalizedCandidates, out matchedKey, out value))
                {
                    return true;
                }
            }
        }

        return false;
    }

    private static int? TryReadIntProperty(JsonElement node, params string[] candidates)
    {
        var value = TryReadNumericProperty(node, candidates);
        if (!value.HasValue)
        {
            return null;
        }

        var rounded = (int)Math.Round(value.Value);
        return rounded is > 0 and < 300 ? rounded : null;
    }

    private static bool TryReadDouble(JsonElement node, out double value)
    {
        value = default;
        if (node.ValueKind == JsonValueKind.Number)
        {
            return node.TryGetDouble(out value);
        }

        if (node.ValueKind == JsonValueKind.String
            && double.TryParse(node.GetString(), NumberStyles.Float | NumberStyles.AllowThousands, CultureInfo.InvariantCulture, out value))
        {
            return true;
        }

        return false;
    }

    private static bool TryFindNamedArray(JsonElement node, out JsonElement array, params string[] candidates)
    {
        array = default;
        var normalizedCandidates = candidates
            .Select(NormalizeFieldKey)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        return TryFindNamedArrayCore(node, normalizedCandidates, out array);
    }

    private static bool TryFindNamedArrayCore(JsonElement node, HashSet<string> normalizedCandidates, out JsonElement array)
    {
        array = default;

        if (node.ValueKind == JsonValueKind.Object)
        {
            foreach (var property in node.EnumerateObject())
            {
                var normalized = NormalizeFieldKey(property.Name);
                if (normalizedCandidates.Contains(normalized) && property.Value.ValueKind == JsonValueKind.Array)
                {
                    array = property.Value;
                    return true;
                }

                if (TryFindNamedArrayCore(property.Value, normalizedCandidates, out array))
                {
                    return true;
                }
            }
        }
        else if (node.ValueKind == JsonValueKind.Array)
        {
            foreach (var item in node.EnumerateArray())
            {
                if (TryFindNamedArrayCore(item, normalizedCandidates, out array))
                {
                    return true;
                }
            }
        }

        return false;
    }

    private static string NormalizeFieldKey(string raw)
    {
        var chars = raw
            .Where(char.IsLetterOrDigit)
            .Select(char.ToLowerInvariant)
            .ToArray();
        return new string(chars);
    }

    private sealed record RunningSplitPoint(
        double DistanceKm,
        double DurationMinutes,
        double? PaceMinPerKm,
        int? AverageHeartRate,
        double? ElevationGainM,
        int? CadenceSpm);

    private sealed record RunningRunPoint(
        string Id,
        DateOnly Day,
        DateTimeOffset StartTime,
        string Name,
        double DurationMinutes,
        double? DistanceKm,
        double? PaceMinPerKm,
        int? AverageHeartRate,
        int? MaxHeartRate,
        double? ElevationGainM,
        int? CadenceSpm,
        IReadOnlyList<RunningSplitPoint> Splits,
        double? FadeIndex,
        double? EfficiencyRatio,
        double? ElevationGainPerKm,
        double? NormalizedPaceElevation,
        double? NormalizedPaceHr,
        double? Zone34Ratio);

    private static readonly object[] DailyMetricOptions =
    [
        new { key = "activeMinutes", label = "Active minutes" },
        new { key = "activeCalories", label = "Active calories" },
        new { key = "steps", label = "Steps" },
        new { key = "sleepHours", label = "Total sleep hours" },
        new { key = "sleepEfficiency", label = "Sleep efficiency" },
        new { key = "restingHr", label = "Resting heart rate" },
        new { key = "deepSleepMinutes", label = "Deep sleep minutes" }
    ];

    private sealed record DateRange(DateOnly FromDay, DateOnly ToDay);

    private sealed record DailyMetricSnapshot(
        DateOnly Day,
        double? ActiveMinutes,
        double? ActiveCalories,
        double? Steps,
        double? SleepHours,
        double? SleepEfficiency,
        double? RestingHr,
        double? DeepSleepMinutes);

    private sealed record CorrelationPoint(DateOnly Day, DateOnly CompareDay, double X, double Y);

    private sealed record WeeklyActivityTypeLoad(string Type, double DurationMinutes, double DistanceKm, double Calories, double Load);

    private sealed record WeeklyLoadPoint(
        DateOnly WeekStart,
        string WeekKey,
        double TotalDurationMinutes,
        double TotalDistanceKm,
        double TotalCalories,
        double TotalLoad,
        IReadOnlyList<WeeklyActivityTypeLoad> ByType,
        double? TrailingAverageDuration,
        bool SpikeWarning,
        bool DetrainingWarning);

    private sealed record HrZoneSeconds(double Zone1Seconds, double Zone2Seconds, double Zone3Seconds, double Zone4Seconds, double Zone5Seconds)
    {
        public double TotalSeconds => Zone1Seconds + Zone2Seconds + Zone3Seconds + Zone4Seconds + Zone5Seconds;
    }

    private sealed record MinuteValuePoint(int Minute, double Value);

    private sealed record MonthlyLifeSnapshot(
        double? AvgRestingHr,
        double? AvgSleepHours,
        double? AvgDeepSleepPct,
        int TotalSteps,
        double TotalActiveMinutes,
        string LongestActivityLabel,
        double LongestActivityScore,
        int ActiveDays);
}
