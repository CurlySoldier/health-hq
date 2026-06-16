using System.Globalization;
using System.Text.Json;
using HealthHq.Shared.Contracts;
using HealthHq.Shared.Infrastructure;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Logging;

namespace HealthHq.Modules.Ingestion;

public sealed class GarminActivityImporter : IActivityIngestionProvider
{
    private const string ProviderKey = "garmin";

    private readonly GarminSettingsManager _settingsManager;
    private readonly IDocumentStore _store;
    private readonly ILogger<GarminActivityImporter> _logger;
    private readonly IExternalActivityMapper<GarminActivityProjection> _mapper;

    public GarminActivityImporter(
        GarminSettingsManager settingsManager,
        IDocumentStore store,
        ILogger<GarminActivityImporter> logger,
        IExternalActivityMapper<GarminActivityProjection> mapper)
    {
        _settingsManager = settingsManager;
        _store = store;
        _logger = logger;
        _mapper = mapper;
    }

    string IActivityIngestionProvider.ProviderKey => ProviderKey;

    public Task<SyncResult> SyncActivitiesAsync(CancellationToken cancellationToken = default)
    {
        return ImportAsync(cancellationToken);
    }

    public async Task<SyncResult> ImportAsync(CancellationToken cancellationToken)
    {
        var checkpoint = await _store.GetByIdAsync<SyncCheckpoint>(DocumentTypes.SyncCheckpoint, ProviderKey, cancellationToken);
        var lastSyncedAt = checkpoint?.LastSyncedAt ?? DateTimeOffset.MinValue;

        var imported = 0;
        var latest = lastSyncedAt;

        await ImportDailyStepsAsync(cancellationToken);
        await ImportSleepSummariesAsync(cancellationToken);

        var databasePath = _settingsManager.GetActivitiesDatabasePath();
        if (File.Exists(databasePath))
        {
            var activitySync = await ImportActivitiesAsync(databasePath, lastSyncedAt, cancellationToken);
            imported = activitySync.ImportedCount;
            latest = activitySync.LastActivityAt;
        }
        else
        {
            _logger.LogInformation("Garmin activities database not found at {Path}.", databasePath);
        }

        if (latest == DateTimeOffset.MinValue)
        {
            latest = DateTimeOffset.UtcNow;
        }

        var newCheckpoint = new SyncCheckpoint(ProviderKey, ProviderKey, latest, DateTimeOffset.UtcNow);
        await _store.UpsertAsync(DocumentTypes.SyncCheckpoint, ProviderKey, newCheckpoint, cancellationToken: cancellationToken);

        return new SyncResult(imported, latest);
    }

    private async Task<(int ImportedCount, DateTimeOffset LastActivityAt)> ImportActivitiesAsync(
        string databasePath,
        DateTimeOffset lastSyncedAt,
        CancellationToken cancellationToken)
    {
        var imported = 0;
        var latest = lastSyncedAt;

        await using var connection = new SqliteConnection(new SqliteConnectionStringBuilder
        {
            DataSource = databasePath,
            Mode = SqliteOpenMode.ReadOnly,
            Cache = SqliteCacheMode.Shared
        }.ToString());

        await connection.OpenAsync(cancellationToken);

        var tableName = await ResolveActivitiesTableAsync(connection, cancellationToken);
        if (string.IsNullOrWhiteSpace(tableName))
        {
            _logger.LogWarning("Could not find an activities table in Garmin DB.");
            return (0, lastSyncedAt);
        }

        var columns = await GetColumnsAsync(connection, tableName, cancellationToken);
        var idColumn = FirstExisting(columns, "activity_id", "id", "activityid");
        var startColumn = FirstExisting(columns, "start_time", "begin_timestamp", "start", "start_timestamp", "start_datetime");
        var endColumn = FirstExisting(columns, "stop_time", "end_time", "end", "end_timestamp");
        var movingSecondsColumn = FirstExisting(columns, "moving_time", "moving_time_seconds", "duration", "duration_seconds");
        var elapsedSecondsColumn = FirstExisting(columns, "elapsed_time", "elapsed_time_seconds", "elapsed");
        var distanceColumn = FirstExisting(columns, "distance", "distance_m", "distance_meter", "distance_meters");
        var avgHrColumn = FirstExisting(columns, "average_hr", "avg_hr", "avg_heart_rate");
        var maxHrColumn = FirstExisting(columns, "max_hr", "max_heart_rate", "maximum_hr");
        var typeColumn = FirstExisting(columns, "sport", "sport_type", "type", "activity_type");
        var nameColumn = FirstExisting(columns, "name", "activity_name", "title");
        var loadColumn = FirstExisting(columns, "suffer_score", "training_load", "load_score", "training_effect");

        if (idColumn is null || startColumn is null)
        {
            _logger.LogWarning("Garmin activities table {Table} is missing required columns.", tableName);
            return (0, lastSyncedAt);
        }

        var selectColumns = new List<string>
        {
            $"{Quote(idColumn)} AS external_id",
            $"{Quote(startColumn)} AS start_time"
        };

        AddSelect(selectColumns, endColumn, "end_time");
        AddSelect(selectColumns, movingSecondsColumn, "moving_seconds");
        AddSelect(selectColumns, elapsedSecondsColumn, "elapsed_seconds");
        AddSelect(selectColumns, distanceColumn, "distance_value");
        AddSelect(selectColumns, avgHrColumn, "avg_hr");
        AddSelect(selectColumns, maxHrColumn, "max_hr");
        AddSelect(selectColumns, typeColumn, "activity_type");
        AddSelect(selectColumns, nameColumn, "activity_name");
        AddSelect(selectColumns, loadColumn, "load_score");

        var query = $"SELECT {string.Join(", ", selectColumns)} FROM {Quote(tableName)};";
        await using var command = connection.CreateCommand();
        command.CommandText = query;

        var hasActivityRecordsTable = await TableExistsAsync(connection, "activity_records", cancellationToken);
        var projections = new List<GarminActivityProjection>();

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            var externalId = reader["external_id"]?.ToString();
            if (string.IsNullOrWhiteSpace(externalId))
            {
                continue;
            }

            var startTime = ParseDateTimeOffset(reader["start_time"]);
            if (startTime is null || startTime <= lastSyncedAt)
            {
                continue;
            }

            projections.Add(new GarminActivityProjection(
                ExternalId: externalId,
                StartTime: startTime.Value,
                EndTime: ParseDateTimeOffset(reader["end_time"]),
                MovingSeconds: ParseDouble(reader["moving_seconds"]),
                ElapsedSeconds: ParseDouble(reader["elapsed_seconds"]),
                DistanceValue: ParseDouble(reader["distance_value"]),
                AverageHeartRate: ParseInt(reader["avg_hr"]),
                MaxHeartRate: ParseInt(reader["max_hr"]),
                ActivityType: reader["activity_type"]?.ToString(),
                ActivityName: reader["activity_name"]?.ToString(),
                RoutePoints: null,
                HeartRateSamples: null,
                LoadScore: ParseDouble(reader["load_score"]),
                SourceTable: tableName
            ));
        }

        foreach (var projection in projections)
        {
            cancellationToken.ThrowIfCancellationRequested();

            var projected = projection;
            if (hasActivityRecordsTable)
            {
                var streams = await ReadActivityStreamsAsync(connection, projection.ExternalId, projection.StartTime, cancellationToken);
                projected = projection with
                {
                    RoutePoints = streams.RoutePoints,
                    HeartRateSamples = streams.HeartRateSamples
                };
            }

            var externalActivity = _mapper.Map(projected);
            var normalized = ActivityRecordFactory.Create(ProviderKey, externalActivity);

            await _store.UpsertAsync(
                DocumentTypes.Activity,
                normalized.Id,
                normalized,
                externalKey: $"{ProviderKey}:{externalActivity.ExternalId}",
                recordedAt: normalized.StartTime,
                cancellationToken: cancellationToken);

            imported++;
            if (normalized.StartTime > latest)
            {
                latest = normalized.StartTime;
            }
        }

        if (latest == DateTimeOffset.MinValue)
        {
            latest = DateTimeOffset.UtcNow;
        }

        return (imported, latest);
    }

    private static async Task<bool> TableExistsAsync(SqliteConnection connection, string tableName, CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = $tableName LIMIT 1;";
        command.Parameters.AddWithValue("$tableName", tableName);
        var scalar = await command.ExecuteScalarAsync(cancellationToken);
        return scalar is not null;
    }

    private static async Task<(List<ActivityRoutePoint> RoutePoints, List<ActivityHeartRateSample> HeartRateSamples)> ReadActivityStreamsAsync(
        SqliteConnection connection,
        string externalId,
        DateTimeOffset startTime,
        CancellationToken cancellationToken)
    {
        await using var command = connection.CreateCommand();
        command.CommandText = @"
            SELECT timestamp, position_lat, position_long, hr
            FROM activity_records
            WHERE activity_id = $activityId
            ORDER BY record ASC;";
        command.Parameters.AddWithValue("$activityId", externalId);

        var routePoints = new List<ActivityRoutePoint>();
        var heartRateSamples = new List<ActivityHeartRateSample>();

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            var timestamp = ParseDateTimeOffset(reader["timestamp"]);
            var offsetSeconds = timestamp.HasValue
                ? Math.Max(0, (int)Math.Round((timestamp.Value - startTime).TotalSeconds))
                : heartRateSamples.Count;

            var latitude = ParseDouble(reader["position_lat"]);
            var longitude = ParseDouble(reader["position_long"]);
            if (latitude.HasValue
                && longitude.HasValue
                && double.IsFinite(latitude.Value)
                && double.IsFinite(longitude.Value)
                && latitude.Value is >= -90 and <= 90
                && longitude.Value is >= -180 and <= 180)
            {
                routePoints.Add(new ActivityRoutePoint(latitude.Value, longitude.Value));
            }

            var heartRate = ParseInt(reader["hr"]);
            if (heartRate is > 0)
            {
                heartRateSamples.Add(new ActivityHeartRateSample(offsetSeconds, heartRate.Value));
            }
        }

        return (routePoints, heartRateSamples);
    }

    private async Task ImportDailyStepsAsync(CancellationToken cancellationToken)
    {
        var runtimeRoot = _settingsManager.GetRuntimeRoot();
        var monitoringDirectory = Path.Combine(runtimeRoot, "HealthData", "FitFiles", "Monitoring");
        if (!Directory.Exists(monitoringDirectory))
        {
            return;
        }

        foreach (var file in Directory.EnumerateFiles(monitoringDirectory, "daily_summary_*.json", SearchOption.AllDirectories))
        {
            cancellationToken.ThrowIfCancellationRequested();

            try
            {
                var rawJson = await File.ReadAllTextAsync(file, cancellationToken);
                using var document = JsonDocument.Parse(rawJson);
                var root = document.RootElement;

                if (!TryGetDateOnly(root, "calendarDate", out var day) || !TryGetInt(root, "totalSteps", out var totalSteps))
                {
                    continue;
                }

                var distanceKm = TryGetDouble(root, "totalDistanceMeters") is { } meters
                    ? Math.Round(meters / 1000d, 2)
                    : (double?)null;
                var activeKilocalories = TryGetInt(root, "activeKilocalories", out var calories) ? calories : (int?)null;

                var stepsRecord = new DailyStepsRecord(
                    Id: $"{ProviderKey}-{day:yyyyMMdd}",
                    Source: ProviderKey,
                    Day: day,
                    TotalSteps: totalSteps,
                    DistanceKm: distanceKm,
                    ActiveKilocalories: activeKilocalories,
                    RawJson: rawJson);

                await _store.UpsertAsync(
                    DocumentTypes.DailySteps,
                    stepsRecord.Id,
                    stepsRecord,
                    externalKey: $"{ProviderKey}:{day:yyyy-MM-dd}",
                    recordedAt: new DateTimeOffset(day.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero),
                    cancellationToken: cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Unable to import Garmin daily steps from {File}.", file);
            }
        }
    }

    private async Task ImportSleepSummariesAsync(CancellationToken cancellationToken)
    {
        var runtimeRoot = _settingsManager.GetRuntimeRoot();
        var sleepDirectory = Path.Combine(runtimeRoot, "HealthData", "Sleep");
        if (!Directory.Exists(sleepDirectory))
        {
            return;
        }

        foreach (var file in Directory.EnumerateFiles(sleepDirectory, "sleep_*.json", SearchOption.AllDirectories))
        {
            cancellationToken.ThrowIfCancellationRequested();

            try
            {
                var rawJson = await File.ReadAllTextAsync(file, cancellationToken);
                using var document = JsonDocument.Parse(rawJson);
                var root = document.RootElement;
                if (!root.TryGetProperty("dailySleepDTO", out var dailySleep) || dailySleep.ValueKind != JsonValueKind.Object)
                {
                    continue;
                }

                if (!TryGetDateOnly(dailySleep, "calendarDate", out var day) || !TryGetInt(dailySleep, "sleepTimeSeconds", out var sleepSeconds))
                {
                    continue;
                }

                var deepSleepSeconds = TryGetInt(dailySleep, "deepSleepSeconds", out var deep) ? deep : 0;
                var lightSleepSeconds = TryGetInt(dailySleep, "lightSleepSeconds", out var light) ? light : 0;
                var remSleepSeconds = TryGetInt(dailySleep, "remSleepSeconds", out var rem) ? rem : 0;
                var awakeSleepSeconds = TryGetInt(dailySleep, "awakeSleepSeconds", out var awake) ? awake : 0;

                var sleepRecord = new SleepSummaryRecord(
                    Id: $"{ProviderKey}-{day:yyyyMMdd}",
                    Source: ProviderKey,
                    Day: day,
                    SleepHours: Math.Round(sleepSeconds / 3600d, 2),
                    DeepSleepHours: Math.Round(deepSleepSeconds / 3600d, 2),
                    LightSleepHours: Math.Round(lightSleepSeconds / 3600d, 2),
                    RemSleepHours: Math.Round(remSleepSeconds / 3600d, 2),
                    AwakeHours: Math.Round(awakeSleepSeconds / 3600d, 2),
                    SleepScore: null,
                    RawJson: rawJson);

                await _store.UpsertAsync(
                    DocumentTypes.SleepSummary,
                    sleepRecord.Id,
                    sleepRecord,
                    externalKey: $"{ProviderKey}:{day:yyyy-MM-dd}",
                    recordedAt: new DateTimeOffset(day.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero),
                    cancellationToken: cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Unable to import Garmin sleep summary from {File}.", file);
            }
        }
    }

    private static bool TryGetDateOnly(JsonElement element, string propertyName, out DateOnly day)
    {
        day = default;
        if (!element.TryGetProperty(propertyName, out var property) || property.ValueKind != JsonValueKind.String)
        {
            return false;
        }

        return DateOnly.TryParse(property.GetString(), CultureInfo.InvariantCulture, DateTimeStyles.None, out day);
    }

    private static bool TryGetInt(JsonElement element, string propertyName, out int value)
    {
        value = default;
        if (!element.TryGetProperty(propertyName, out var property))
        {
            return false;
        }

        return property.ValueKind switch
        {
            JsonValueKind.Number when property.TryGetInt32(out value) => true,
            JsonValueKind.Number when property.TryGetDouble(out var asDouble) => TryConvertDoubleToInt(asDouble, out value),
            JsonValueKind.String when int.TryParse(property.GetString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out value) => true,
            _ => false
        };
    }

    private static double? TryGetDouble(JsonElement element, string propertyName)
    {
        if (!element.TryGetProperty(propertyName, out var property))
        {
            return null;
        }

        if (property.ValueKind == JsonValueKind.Number && property.TryGetDouble(out var value))
        {
            return value;
        }

        if (property.ValueKind == JsonValueKind.String
            && double.TryParse(property.GetString(), NumberStyles.Float | NumberStyles.AllowThousands, CultureInfo.InvariantCulture, out value))
        {
            return value;
        }

        return null;
    }

    private static bool TryConvertDoubleToInt(double input, out int value)
    {
        if (input < int.MinValue || input > int.MaxValue)
        {
            value = default;
            return false;
        }

        value = (int)Math.Round(input);
        return true;
    }

    private static async Task<string?> ResolveActivitiesTableAsync(SqliteConnection connection, CancellationToken cancellationToken)
    {
        const string sql = "SELECT name FROM sqlite_master WHERE type = 'table';";
        await using var command = connection.CreateCommand();
        command.CommandText = sql;

        var tables = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            if (!reader.IsDBNull(0))
            {
                tables.Add(reader.GetString(0));
            }
        }

        var orderedCandidates = new[] { "activities", "activity", "garmin_activities", "activities_table" };
        foreach (var candidate in orderedCandidates)
        {
            if (tables.Contains(candidate))
            {
                return candidate;
            }
        }

        return tables.FirstOrDefault(x => x.Contains("activit", StringComparison.OrdinalIgnoreCase));
    }

    private static async Task<HashSet<string>> GetColumnsAsync(SqliteConnection connection, string tableName, CancellationToken cancellationToken)
    {
        var columns = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        await using var command = connection.CreateCommand();
        command.CommandText = $"PRAGMA table_info({Quote(tableName)});";
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            if (!reader.IsDBNull(1))
            {
                columns.Add(reader.GetString(1));
            }
        }

        return columns;
    }

    private static string? FirstExisting(HashSet<string> columns, params string[] candidates)
    {
        foreach (var candidate in candidates)
        {
            if (columns.Contains(candidate))
            {
                return candidate;
            }
        }

        return null;
    }

    private static void AddSelect(List<string> selectColumns, string? sourceColumn, string alias)
    {
        if (string.IsNullOrWhiteSpace(sourceColumn))
        {
            selectColumns.Add($"NULL AS {alias}");
            return;
        }

        selectColumns.Add($"{Quote(sourceColumn)} AS {alias}");
    }

    private static string Quote(string identifier)
    {
        return $"\"{identifier.Replace("\"", "\"\"")}\"";
    }

    private static DateTimeOffset? ParseDateTimeOffset(object? raw)
    {
        if (raw is null || raw is DBNull)
        {
            return null;
        }

        if (raw is DateTimeOffset dto)
        {
            return dto;
        }

        if (raw is DateTime dt)
        {
            return new DateTimeOffset(dt, TimeSpan.Zero);
        }

        if (raw is long l)
        {
            if (l > 10_000_000_000)
            {
                return DateTimeOffset.FromUnixTimeMilliseconds(l);
            }

            return DateTimeOffset.FromUnixTimeSeconds(l);
        }

        if (raw is int i)
        {
            return DateTimeOffset.FromUnixTimeSeconds(i);
        }

        var str = raw.ToString();
        if (string.IsNullOrWhiteSpace(str))
        {
            return null;
        }

        if (long.TryParse(str, NumberStyles.Integer, CultureInfo.InvariantCulture, out var unix))
        {
            if (unix > 10_000_000_000)
            {
                return DateTimeOffset.FromUnixTimeMilliseconds(unix);
            }

            return DateTimeOffset.FromUnixTimeSeconds(unix);
        }

        if (DateTimeOffset.TryParse(str, CultureInfo.InvariantCulture, DateTimeStyles.AssumeUniversal, out var parsed))
        {
            return parsed;
        }

        return null;
    }

    private static double? ParseDouble(object? raw)
    {
        if (raw is null || raw is DBNull)
        {
            return null;
        }

        return raw switch
        {
            double d => d,
            float f => f,
            decimal m => (double)m,
            long l => l,
            int i => i,
            _ when double.TryParse(raw.ToString(), NumberStyles.Float | NumberStyles.AllowThousands, CultureInfo.InvariantCulture, out var parsed) => parsed,
            _ when TryParseDurationSeconds(raw.ToString(), out var durationSeconds) => durationSeconds,
            _ => null
        };
    }

    private static bool TryParseDurationSeconds(string? candidate, out double seconds)
    {
        seconds = default;
        if (string.IsNullOrWhiteSpace(candidate) || !candidate.Contains(':'))
        {
            return false;
        }

        if (TimeSpan.TryParse(candidate, CultureInfo.InvariantCulture, out var parsed))
        {
            seconds = parsed.TotalSeconds;
            return seconds >= 0;
        }

        var parts = candidate.Split(':', StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries);
        if (parts.Length is < 2 or > 3)
        {
            return false;
        }

        if (!double.TryParse(parts[^1], NumberStyles.Float, CultureInfo.InvariantCulture, out var secondsPart))
        {
            return false;
        }

        if (!int.TryParse(parts[^2], NumberStyles.Integer, CultureInfo.InvariantCulture, out var minutesPart))
        {
            return false;
        }

        var hoursPart = 0;
        if (parts.Length == 3 && !int.TryParse(parts[0], NumberStyles.Integer, CultureInfo.InvariantCulture, out hoursPart))
        {
            return false;
        }

        seconds = (hoursPart * 3600d) + (minutesPart * 60d) + secondsPart;
        return seconds >= 0;
    }

    private static int? ParseInt(object? raw)
    {
        if (raw is null || raw is DBNull)
        {
            return null;
        }

        if (raw is int i)
        {
            return i;
        }

        if (int.TryParse(raw.ToString(), NumberStyles.Integer, CultureInfo.InvariantCulture, out var parsed))
        {
            return parsed;
        }

        var asDouble = ParseDouble(raw);
        return asDouble.HasValue ? (int)Math.Round(asDouble.Value) : null;
    }
}
