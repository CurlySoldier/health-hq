using System.Text.Json.Serialization;

namespace HealthHq.Modules.Ingestion;

public sealed record StravaTokenResponse(
    [property: JsonPropertyName("access_token")] string AccessToken,
    [property: JsonPropertyName("refresh_token")] string RefreshToken,
    [property: JsonPropertyName("expires_at")] long ExpiresAtUnix
);

public sealed record StravaActivityDto(
    [property: JsonPropertyName("id")] long Id,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("type")] string Type,
    [property: JsonPropertyName("start_date")] DateTimeOffset StartDate,
    [property: JsonPropertyName("elapsed_time")] int ElapsedTimeSeconds,
    [property: JsonPropertyName("moving_time")] int MovingTimeSeconds,
    [property: JsonPropertyName("distance")] double DistanceMeters,
    [property: JsonPropertyName("average_heartrate")] double? AverageHeartRate,
    [property: JsonPropertyName("max_heartrate")] double? MaxHeartRate,
    [property: JsonPropertyName("suffer_score")] double? SufferScore
);
