using HealthHq.Shared.Contracts;

namespace HealthHq.Modules.Ingestion;

public sealed record ExternalActivity(
    string ExternalId,
    DateTimeOffset StartTime,
    DateTimeOffset EndTime,
    double DurationMinutes,
    int? Steps,
    double? DistanceKm,
    int? AverageHeartRate,
    int? MaxHeartRate,
    double? LoadScore,
    string Type,
    string RawJson,
    string? Name = null,
    IReadOnlyList<ActivityRoutePoint>? RoutePoints = null,
    IReadOnlyList<ActivityHeartRateSample>? HeartRateSamples = null
);

public sealed record SyncResult(int ImportedCount, DateTimeOffset LastActivityAt);
