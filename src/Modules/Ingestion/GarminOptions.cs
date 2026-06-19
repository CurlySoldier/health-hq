namespace HealthHq.Modules.Ingestion;

public sealed class GarminOptions
{
    public const string SectionName = "Garmin";
    public int PollingIntervalMinutes { get; init; } = 30;
    public string RuntimeDirectory { get; init; } = "garmin";
    public string ActivitiesDatabaseRelativePath { get; init; } = "garmin/HealthData/DBs/garmin_activities.db";
    public string DefaultStartDate { get; init; } = "01/01/2026";
    public int DefaultDownloadLatestActivities { get; init; } = 25;
}
