using System.Text.Json;
using HealthHq.Shared.Contracts;

namespace HealthHq.Modules.Ingestion;

public sealed record GarminActivityProjection(
    string ExternalId,
    DateTimeOffset StartTime,
    DateTimeOffset? EndTime,
    double? MovingSeconds,
    double? ElapsedSeconds,
    double? DistanceValue,
    int? AverageHeartRate,
    int? MaxHeartRate,
    string? ActivityType,
    string? ActivityName,
    IReadOnlyList<ActivityRoutePoint>? RoutePoints,
    IReadOnlyList<ActivityHeartRateSample>? HeartRateSamples,
    double? LoadScore,
    string SourceTable
);

public sealed class GarminExternalActivityMapper : IExternalActivityMapper<GarminActivityProjection>
{
    public ExternalActivity Map(GarminActivityProjection source)
    {
        var durationSeconds = NormalizeDurationSeconds(source.MovingSeconds, source.ElapsedSeconds);
        if (durationSeconds <= 0 && source.EndTime.HasValue && source.EndTime > source.StartTime)
        {
            durationSeconds = (source.EndTime.Value - source.StartTime).TotalSeconds;
        }

        if (durationSeconds <= 0)
        {
            durationSeconds = 60;
        }

        var hasValidEnd = source.EndTime.HasValue && source.EndTime.Value > source.StartTime;
        var endTime = hasValidEnd ? source.EndTime!.Value : source.StartTime.AddSeconds(durationSeconds);
        var distanceKm = source.DistanceValue;
        if (distanceKm.HasValue && distanceKm.Value > 1000)
        {
            distanceKm = Math.Round(distanceKm.Value / 1000d, 2);
        }

        return new ExternalActivity(
            ExternalId: source.ExternalId,
            StartTime: source.StartTime,
            EndTime: endTime,
            DurationMinutes: Math.Round(durationSeconds / 60d, 2),
            Steps: null,
            DistanceKm: distanceKm,
            AverageHeartRate: source.AverageHeartRate,
            MaxHeartRate: source.MaxHeartRate,
            LoadScore: source.LoadScore,
            Type: NormalizeActivityType(source.ActivityType),
            RawJson: JsonSerializer.Serialize(new
            {
                source.ExternalId,
                source.StartTime,
                endTime,
                source.MovingSeconds,
                source.ElapsedSeconds,
                distanceKm,
                source.AverageHeartRate,
                source.MaxHeartRate,
                source.ActivityType,
                source.LoadScore,
                sourceTable = source.SourceTable
            }),
            Name: string.IsNullOrWhiteSpace(source.ActivityName) ? BuildName(source) : source.ActivityName,
            RoutePoints: source.RoutePoints,
            HeartRateSamples: source.HeartRateSamples
        );
    }

    private static double NormalizeDurationSeconds(double? movingSeconds, double? elapsedSeconds)
    {
        var durationSeconds = Math.Max(movingSeconds ?? 0, elapsedSeconds ?? 0);
        if (durationSeconds > 172_800)
        {
            return durationSeconds / 1000d;
        }

        return durationSeconds;
    }

    private static string NormalizeActivityType(string? activityType)
    {
        if (string.IsNullOrWhiteSpace(activityType))
        {
            return "unknown";
        }

        return activityType.Trim().ToLowerInvariant() switch
        {
            "racket" => "squash",
            "racquet" => "squash",
            "racquet sport" => "squash",
            _ => activityType.Trim()
        };
    }

    private static string BuildName(GarminActivityProjection source)
    {
        var normalizedType = NormalizeActivityType(source.ActivityType);
        if (normalizedType == "unknown")
        {
            return "Garmin activity";
        }

        return normalizedType;
    }
}
