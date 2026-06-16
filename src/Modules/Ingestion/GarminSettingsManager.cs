using System.Globalization;
using System.Text.Json;
using HealthHq.Shared.Infrastructure;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Options;

namespace HealthHq.Modules.Ingestion;

public sealed class GarminSettingsManager
{
    private const string SettingsDocType = "garmin_settings";
    private const string SettingsId = "garmin";

    private readonly IDocumentStore _store;
    private readonly IDataProtector _protector;
    private readonly GarminOptions _garminOptions;
    private readonly DataOptions _dataOptions;

    public GarminSettingsManager(
        IDocumentStore store,
        IDataProtectionProvider dataProtectionProvider,
        IOptions<GarminOptions> garminOptions,
        IOptions<DataOptions> dataOptions)
    {
        _store = store;
        _protector = dataProtectionProvider.CreateProtector("ingestion.garmin.credentials.v1");
        _garminOptions = garminOptions.Value;
        _dataOptions = dataOptions.Value;
    }

    public async Task<GarminSettingsDocument?> GetAsync(CancellationToken cancellationToken)
    {
        return await _store.GetByIdAsync<GarminSettingsDocument>(SettingsDocType, SettingsId, cancellationToken);
    }

    public async Task<GarminSettingsDocument> UpsertAsync(GarminSettingsUpsertRequest request, CancellationToken cancellationToken)
    {
        var existing = await GetAsync(cancellationToken);
        var username = string.IsNullOrWhiteSpace(request.Username) ? existing?.Username : request.Username.Trim();
        if (string.IsNullOrWhiteSpace(username))
        {
            throw new InvalidOperationException("Garmin username is required.");
        }

        var password = string.IsNullOrWhiteSpace(request.Password)
            ? (existing is null ? null : Decrypt(existing.EncryptedPassword))
            : request.Password;

        if (string.IsNullOrWhiteSpace(password))
        {
            throw new InvalidOperationException("Garmin password is required.");
        }

        var startDate = NormalizeStartDate(request.StartDate, existing?.StartDate ?? _garminOptions.DefaultStartDate);
        var downloadLatestActivities = request.DownloadLatestActivities is > 0
            ? request.DownloadLatestActivities.Value
            : existing?.DownloadLatestActivities ?? _garminOptions.DefaultDownloadLatestActivities;

        var document = new GarminSettingsDocument(
            Id: SettingsId,
            Username: username,
            EncryptedPassword: _protector.Protect(password),
            StartDate: startDate,
            DownloadLatestActivities: downloadLatestActivities,
            UpdatedAt: DateTimeOffset.UtcNow);

        await _store.UpsertAsync(SettingsDocType, SettingsId, document, recordedAt: DateTimeOffset.UtcNow, cancellationToken: cancellationToken);
        await WriteRuntimeFilesAsync(document, cancellationToken);
        return document;
    }

    public async Task EnsureRuntimeFilesAsync(CancellationToken cancellationToken)
    {
        var settings = await GetAsync(cancellationToken);
        if (settings is null)
        {
            return;
        }

        await WriteRuntimeFilesAsync(settings, cancellationToken);
    }

    public string GetRuntimeRoot()
    {
        if (Path.IsPathRooted(_garminOptions.RuntimeDirectory))
        {
            return _garminOptions.RuntimeDirectory;
        }

        return Path.Combine(Path.GetFullPath(_dataOptions.DataDirectory), _garminOptions.RuntimeDirectory);
    }

    public string GetActivitiesDatabasePath()
    {
        if (Path.IsPathRooted(_garminOptions.ActivitiesDatabaseRelativePath))
        {
            return _garminOptions.ActivitiesDatabaseRelativePath;
        }

        return Path.Combine(Path.GetFullPath(_dataOptions.DataDirectory), _garminOptions.ActivitiesDatabaseRelativePath);
    }

    private async Task WriteRuntimeFilesAsync(GarminSettingsDocument settings, CancellationToken cancellationToken)
    {
        var runtimeRoot = GetRuntimeRoot();
        var configDirectory = Path.Combine(runtimeRoot, ".GarminDb");
        Directory.CreateDirectory(configDirectory);

        var passwordPath = Path.Combine(configDirectory, "garmin_password.txt");
        var configPath = Path.Combine(configDirectory, "GarminConnectConfig.json");

        await File.WriteAllTextAsync(passwordPath, Decrypt(settings.EncryptedPassword), cancellationToken);
        TrySetUnixPermissions(passwordPath);

        var config = new
        {
            db = new { type = "sqlite" },
            garmin = new { domain = "garmin.com" },
            credentials = new
            {
                user = settings.Username,
                secure_password = false,
                password = string.Empty,
                password_file = passwordPath
            },
            data = new
            {
                weight_start_date = settings.StartDate,
                sleep_start_date = settings.StartDate,
                rhr_start_date = settings.StartDate,
                hrv_start_date = settings.StartDate,
                monitoring_start_date = settings.StartDate,
                download_latest_activities = settings.DownloadLatestActivities,
                download_all_activities = 1000
            },
            directories = new
            {
                relative_to_home = true,
                base_dir = "HealthData",
                mount_dir = "/Volumes/GARMIN"
            },
            enabled_stats = new
            {
                monitoring = true,
                steps = true,
                itime = true,
                sleep = true,
                rhr = true,
                hrv = true,
                weight = true,
                activities = true
            },
            course_views = new { steps = Array.Empty<int>() },
            modes = new { },
            activities = new { display = Array.Empty<string>() },
            settings = new
            {
                metric = false,
                default_display_activities = new[] { "walking", "running", "cycling" }
            },
            checkup = new { look_back_days = 90 }
        };

        var json = JsonSerializer.Serialize(config, new JsonSerializerOptions(JsonSerializerDefaults.Web) { WriteIndented = true });
        await File.WriteAllTextAsync(configPath, json, cancellationToken);
        TrySetUnixPermissions(configPath);
    }

    private static string NormalizeStartDate(string? value, string fallback)
    {
        var candidate = string.IsNullOrWhiteSpace(value) ? fallback : value;
        if (DateTime.TryParse(candidate, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var parsed))
        {
            return parsed.ToString("MM/dd/yyyy", CultureInfo.InvariantCulture);
        }

        return fallback;
    }

    private string Decrypt(string encrypted)
    {
        return _protector.Unprotect(encrypted);
    }

    private static void TrySetUnixPermissions(string path)
    {
        try
        {
            File.SetUnixFileMode(path, UnixFileMode.UserRead | UnixFileMode.UserWrite);
        }
        catch
        {
            // Best-effort file hardening for platforms that support Unix mode bits.
        }
    }
}
