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

        var normalized = ExtractActivityTypeToken(activityType);

        return normalized switch
        {
            "racket" => "squash",
            "racquet" => "squash",
            "racquet sport" => "squash",
            _ => normalized
        };
    }

    private static string ExtractActivityTypeToken(string activityType)
    {
        var candidate = activityType.Trim();
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
