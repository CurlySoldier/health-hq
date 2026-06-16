using HealthHq.Shared.Contracts;

namespace HealthHq.Modules.Ingestion;

public sealed record GarminSettingsDocument(
    string Id,
    string Username,
    string EncryptedPassword,
    string StartDate,
    int DownloadLatestActivities,
    DateTimeOffset UpdatedAt
);

public sealed record GarminSettingsUpsertRequest(
    string Username,
    string? Password,
    string? StartDate,
    int? DownloadLatestActivities
);

public sealed record GarminStatusResponse(
    bool Configured,
    bool HasUsername,
    bool HasPassword,
    DateTimeOffset? CredentialsUpdatedAt,
    bool ActivitiesDatabaseExists,
    DateTimeOffset? ActivitiesDatabaseLastWriteUtc,
    DateTimeOffset? LastImportedAt,
    IEnumerable<SyncRun> RecentRuns
);
