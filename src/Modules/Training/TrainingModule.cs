using HealthHq.Shared.Contracts;
using HealthHq.Shared.Infrastructure;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace HealthHq.Modules.Training;

public static class TrainingModule
{
    public static IServiceCollection AddTrainingModule(this IServiceCollection services) => services;

    public static IEndpointRouteBuilder MapTrainingEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/training/acwr", async (IDocumentStore store, CancellationToken cancellationToken) =>
        {
            var now = DateTimeOffset.UtcNow;
            var acuteStart = now.AddDays(-7);
            var chronicStart = now.AddDays(-28);
            var stravaEnabled = (await store.GetByIdAsync<IngestionProviderSettings>(DocumentTypes.IngestionProviderSettings, "strava", cancellationToken))?.Enabled ?? false;
            var activities7 = (await store.ListByRecordedAtAsync<ActivityRecord>(DocumentTypes.Activity, acuteStart, now, cancellationToken))
                .Where(x => stravaEnabled || !string.Equals(x.Source, "strava", StringComparison.OrdinalIgnoreCase))
                .ToList();
            var activities28 = (await store.ListByRecordedAtAsync<ActivityRecord>(DocumentTypes.Activity, chronicStart, now, cancellationToken))
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

            var acute = activities7.Sum(x => x.LoadScore ?? EffectiveDurationMinutes(x));
            var chronic = activities28.Sum(x => x.LoadScore ?? EffectiveDurationMinutes(x)) / 4d;
            var acwr = chronic <= 0 ? 0 : Math.Round(acute / chronic, 2);

            var risk = acwr switch
            {
                < 0.8 => "Low load - detraining risk",
                <= 1.3 => "Optimal zone",
                <= 1.5 => "Caution zone",
                _ => "Elevated injury risk"
            };

            return Results.Ok(new { acute, chronic = Math.Round(chronic, 2), acwr, risk });
        });

        app.MapGet("/api/training/plans", async (IDocumentStore store, CancellationToken cancellationToken) =>
        {
            var plans = await store.ListAsync<TrainingPlan>(DocumentTypes.TrainingPlan, 52, cancellationToken);
            return Results.Ok(plans);
        });

        app.MapGet("/api/training/plans/{id}", async (string id, IDocumentStore store, CancellationToken cancellationToken) =>
        {
            var plan = await store.GetByIdAsync<TrainingPlan>(DocumentTypes.TrainingPlan, id, cancellationToken);
            return plan is null ? Results.NotFound(new { message = "Training plan not found." }) : Results.Ok(plan);
        });

        app.MapPost("/api/training/plans", async (TrainingPlan plan, IDocumentStore store, CancellationToken cancellationToken) =>
        {
            var payload = plan with { Id = string.IsNullOrWhiteSpace(plan.Id) ? Guid.NewGuid().ToString("N") : plan.Id, CreatedAt = DateTimeOffset.UtcNow };
            await store.UpsertAsync(DocumentTypes.TrainingPlan, payload.Id, payload, recordedAt: DateTimeOffset.UtcNow, cancellationToken: cancellationToken);
            return Results.Ok(payload);
        });

        app.MapPut("/api/training/plans/{id}", async (string id, TrainingPlan plan, IDocumentStore store, CancellationToken cancellationToken) =>
        {
            var existing = await store.GetByIdAsync<TrainingPlan>(DocumentTypes.TrainingPlan, id, cancellationToken);
            if (existing is null)
            {
                return Results.NotFound(new { message = "Training plan not found." });
            }

            var payload = plan with
            {
                Id = id,
                CreatedAt = existing.CreatedAt
            };

            await store.UpsertAsync(DocumentTypes.TrainingPlan, payload.Id, payload, recordedAt: DateTimeOffset.UtcNow, cancellationToken: cancellationToken);
            return Results.Ok(payload);
        });

        app.MapDelete("/api/training/plans/{id}", async (string id, IDocumentStore store, CancellationToken cancellationToken) =>
        {
            var existing = await store.GetByIdAsync<TrainingPlan>(DocumentTypes.TrainingPlan, id, cancellationToken);
            if (existing is null)
            {
                return Results.NotFound(new { message = "Training plan not found." });
            }

            await store.DeleteAsync(DocumentTypes.TrainingPlan, id, cancellationToken);
            return Results.Ok(new { deleted = true, id });
        });

        return app;
    }
}
