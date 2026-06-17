using HealthHq.Shared.Contracts;
using HealthHq.Shared.Infrastructure;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace HealthHq.Modules.BodyMetrics;

public sealed record BodyMetricInput(DateOnly Day, decimal HeightCm, decimal WeightKg);
public sealed record VitalSignInput(DateTimeOffset MeasuredAt, int Systolic, int Diastolic, int Pulse);

public static class BodyMetricsModule
{
    public static IServiceCollection AddBodyMetricsModule(this IServiceCollection services) => services;

    public static IEndpointRouteBuilder MapBodyMetricsEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/body-metrics", async (IDocumentStore store, CancellationToken cancellationToken) =>
        {
            var entries = await store.ListAsync<BodyMetricEntry>(DocumentTypes.BodyMetric, 365, cancellationToken);
            return Results.Ok(entries.OrderByDescending(x => x.Day));
        });

        app.MapPost("/api/body-metrics", async (BodyMetricInput input, IDocumentStore store, CancellationToken cancellationToken) =>
        {
            var bmi = CalculateBmi(input.HeightCm, input.WeightKg);
            var entry = new BodyMetricEntry(
                Id: input.Day.ToString("yyyyMMdd"),
                Day: input.Day,
                HeightCm: input.HeightCm,
                WeightKg: input.WeightKg,
                Bmi: bmi,
                Category: CategoryFor(bmi),
                CreatedAt: DateTimeOffset.UtcNow
            );

            await store.UpsertAsync(DocumentTypes.BodyMetric, entry.Id, entry, recordedAt: DateTimeOffset.UtcNow, cancellationToken: cancellationToken);
            return Results.Ok(entry);
        });

        app.MapDelete("/api/body-metrics/{id}", async (string id, IDocumentStore store, CancellationToken cancellationToken) =>
        {
            var existing = await store.GetByIdAsync<BodyMetricEntry>(DocumentTypes.BodyMetric, id, cancellationToken);
            if (existing is null)
            {
                return Results.NotFound(new { message = "Body metric entry not found." });
            }

            await store.DeleteAsync(DocumentTypes.BodyMetric, id, cancellationToken);
            return Results.Ok(new { deleted = true, id });
        });

        app.MapGet("/api/vital-signs", async (IDocumentStore store, CancellationToken cancellationToken) =>
        {
            var entries = await store.ListAsync<VitalSignEntry>(DocumentTypes.VitalSign, 500, cancellationToken);
            return Results.Ok(entries.OrderByDescending(x => x.MeasuredAt));
        });

        app.MapPost("/api/vital-signs", async (VitalSignInput input, IDocumentStore store, CancellationToken cancellationToken) =>
        {
            var validationMessage = ValidateVitalSign(input);
            if (validationMessage is not null)
            {
                return Results.BadRequest(new { message = validationMessage });
            }

            var measuredAtUtc = input.MeasuredAt.ToUniversalTime();
            var entry = new VitalSignEntry(
                Id: Guid.NewGuid().ToString("N"),
                MeasuredAt: measuredAtUtc,
                Systolic: input.Systolic,
                Diastolic: input.Diastolic,
                Pulse: input.Pulse,
                CreatedAt: DateTimeOffset.UtcNow
            );

            await store.UpsertAsync(DocumentTypes.VitalSign, entry.Id, entry, recordedAt: entry.MeasuredAt, cancellationToken: cancellationToken);
            return Results.Ok(entry);
        });

        app.MapDelete("/api/vital-signs/{id}", async (string id, IDocumentStore store, CancellationToken cancellationToken) =>
        {
            var existing = await store.GetByIdAsync<VitalSignEntry>(DocumentTypes.VitalSign, id, cancellationToken);
            if (existing is null)
            {
                return Results.NotFound(new { message = "Vital sign entry not found." });
            }

            await store.DeleteAsync(DocumentTypes.VitalSign, id, cancellationToken);
            return Results.Ok(new { deleted = true, id });
        });

        return app;
    }

    private static decimal CalculateBmi(decimal heightCm, decimal weightKg)
    {
        var m = heightCm / 100m;
        if (m <= 0)
        {
            return 0;
        }

        return Math.Round(weightKg / (m * m), 2);
    }

    private static string CategoryFor(decimal bmi)
    {
        if (bmi < 18.5m)
        {
            return "underweight";
        }

        if (bmi < 25m)
        {
            return "healthy";
        }

        if (bmi < 30m)
        {
            return "overweight";
        }

        return "obese";
    }

    private static string? ValidateVitalSign(VitalSignInput input)
    {
        if (input.Systolic is < 70 or > 260)
        {
            return "Use a realistic systolic value (70-260 mmHg).";
        }

        if (input.Diastolic is < 40 or > 160)
        {
            return "Use a realistic diastolic value (40-160 mmHg).";
        }

        if (input.Pulse is < 30 or > 230)
        {
            return "Use a realistic pulse value (30-230 bpm).";
        }

        if (input.Diastolic >= input.Systolic)
        {
            return "Diastolic should be lower than systolic.";
        }

        return null;
    }
}
