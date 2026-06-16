namespace HealthHq.Modules.Ingestion;

public sealed class StravaOptions
{
    public const string SectionName = "Strava";
    public bool EnabledByDefault { get; init; }
    public string ClientId { get; init; } = string.Empty;
    public string ClientSecret { get; init; } = string.Empty;
    public string RedirectUri { get; init; } = "http://localhost:8080/api/ingestion/strava/oauth/callback";
    public int PollingIntervalMinutes { get; init; } = 30;
}
