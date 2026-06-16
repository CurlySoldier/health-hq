using HealthHq.Shared.Contracts;
using HealthHq.Shared.Infrastructure;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace HealthHq.Modules.Vitality;

public static class VitalityModule
{
    public static IServiceCollection AddVitalityModule(this IServiceCollection services) => services;

    public static IEndpointRouteBuilder MapVitalityEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/vitality/summary", async (IDocumentStore store, CancellationToken cancellationToken) =>
        {
            var weekStart = DateOnly.FromDateTime(DateTime.UtcNow.Date.AddDays(-(int)DateTime.UtcNow.DayOfWeek + (int)DayOfWeek.Monday));
            var weekEnd = weekStart.AddDays(6);
            var entries = await store.ListAsync<VitalityRecord>(DocumentTypes.VitalityRecord, 30, cancellationToken);
            var points = entries.Where(x => x.Day >= weekStart && x.Day <= weekEnd).Sum(x => x.Points);
            return Results.Ok(new { weeklyPoints = points, target = 300, remaining = Math.Max(0, 300 - points) });
        });

        app.MapPost("/api/vitality/recalculate", async (IDocumentStore store, CancellationToken cancellationToken) =>
        {
            var now = DateTimeOffset.UtcNow;
            var from = now.AddDays(-30);
            var stravaEnabled = (await store.GetByIdAsync<IngestionProviderSettings>(DocumentTypes.IngestionProviderSettings, "strava", cancellationToken))?.Enabled ?? false;
            var activities = (await store.ListByRecordedAtAsync<ActivityRecord>(DocumentTypes.Activity, from, now, cancellationToken))
                .Where(x => stravaEnabled || !string.Equals(x.Source, "strava", StringComparison.OrdinalIgnoreCase))
                .ToList();

            static double EffectiveDurationMinutes(ActivityRecord activity)
            {
                if (activity.DurationMinutes > 1.1)
                {
                    return activity.DurationMinutes;
                }

                var spanMinutes = (activity.EndTime - activity.StartTime).TotalMinutes;
                return spanMinutes > 1.1 ? spanMinutes : activity.DurationMinutes;
            }

            var grouped = activities
                .GroupBy(x => DateOnly.FromDateTime(x.StartTime.UtcDateTime))
                .Select(group =>
                {
                    var stepPoints = group.Sum(x => (x.Steps ?? 0) / 1000);
                    var durationPoints = group.Sum(x => (int)Math.Round(EffectiveDurationMinutes(x) / 10));
                    return new VitalityRecord(Guid.NewGuid().ToString("N"), group.Key, stepPoints + durationPoints, "{}", DateTimeOffset.UtcNow);
                })
                .ToList();

            foreach (var entry in grouped)
            {
                await store.UpsertAsync(DocumentTypes.VitalityRecord, $"{entry.Day:yyyyMMdd}", entry with { Id = $"{entry.Day:yyyyMMdd}" }, recordedAt: entry.CreatedAt, cancellationToken: cancellationToken);
            }

            return Results.Ok(new { updated = grouped.Count });
        });

        app.MapGet("/api/vitality/heart-rate-zones", (int age) =>
        {
            var maxHr = 220 - age;
            return Results.Ok(new
            {
                age,
                estimatedMaxHeartRate = maxHr,
                zones = new
                {
                    intensity60 = Math.Round(maxHr * 0.6),
                    intensity70 = Math.Round(maxHr * 0.7),
                    intensity80 = Math.Round(maxHr * 0.8)
                }
            });
        });

        return app;
    }
}
