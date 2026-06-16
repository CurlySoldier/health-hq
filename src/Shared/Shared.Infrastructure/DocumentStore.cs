using System.Text.Json;
using Microsoft.Data.Sqlite;
using Microsoft.Extensions.Options;

namespace HealthHq.Shared.Infrastructure;

public interface IDocumentStore
{
    Task UpsertAsync(string docType, string id, object payload, string? externalKey = null, DateTimeOffset? recordedAt = null, CancellationToken cancellationToken = default);
    Task DeleteAsync(string docType, string id, CancellationToken cancellationToken = default);
    Task<T?> GetByIdAsync<T>(string docType, string id, CancellationToken cancellationToken = default);
    Task<T?> GetByExternalKeyAsync<T>(string docType, string externalKey, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<T>> ListAsync<T>(string docType, int limit = 100, CancellationToken cancellationToken = default);
    Task<IReadOnlyList<T>> ListByRecordedAtAsync<T>(string docType, DateTimeOffset fromInclusive, DateTimeOffset toInclusive, CancellationToken cancellationToken = default);
    Task<int> CountAsync(string docType, CancellationToken cancellationToken = default);
    Task<int> CountByRecordedAtAsync(string docType, DateTimeOffset fromInclusive, DateTimeOffset toInclusive, CancellationToken cancellationToken = default);
}

public sealed class SqliteDocumentStore : IDocumentStore
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = false
    };

    private readonly string _connectionString;

    public SqliteDocumentStore(IOptions<DataOptions> options)
    {
        var dataDirectory = Path.GetFullPath(options.Value.DataDirectory);
        Directory.CreateDirectory(dataDirectory);
        var dbPath = Path.Combine(dataDirectory, options.Value.DatabaseFileName);
        _connectionString = new SqliteConnectionStringBuilder
        {
            DataSource = dbPath,
            Mode = SqliteOpenMode.ReadWriteCreate,
            Cache = SqliteCacheMode.Shared
        }.ToString();
    }

    public async Task InitializeAsync(CancellationToken cancellationToken = default)
    {
        await using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        const string sql = """
                           CREATE TABLE IF NOT EXISTS documents (
                               doc_type TEXT NOT NULL,
                               id TEXT NOT NULL,
                               external_key TEXT NULL,
                               recorded_at TEXT NULL,
                               payload_json TEXT NOT NULL,
                               created_at TEXT NOT NULL,
                               updated_at TEXT NOT NULL,
                               PRIMARY KEY (doc_type, id)
                           );
                           CREATE UNIQUE INDEX IF NOT EXISTS idx_documents_doc_type_external_key
                               ON documents(doc_type, external_key);
                           CREATE INDEX IF NOT EXISTS idx_documents_doc_type_recorded_at
                               ON documents(doc_type, recorded_at);
                           """;

        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task UpsertAsync(string docType, string id, object payload, string? externalKey = null, DateTimeOffset? recordedAt = null, CancellationToken cancellationToken = default)
    {
        var now = DateTimeOffset.UtcNow;
        var payloadJson = JsonSerializer.Serialize(payload, SerializerOptions);
        await using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);

        const string sql = """
                           INSERT INTO documents (doc_type, id, external_key, recorded_at, payload_json, created_at, updated_at)
                           VALUES ($docType, $id, $externalKey, $recordedAt, $payloadJson, $createdAt, $updatedAt)
                           ON CONFLICT(doc_type, id)
                           DO UPDATE SET
                               external_key = excluded.external_key,
                               recorded_at = excluded.recorded_at,
                               payload_json = excluded.payload_json,
                               updated_at = excluded.updated_at;
                           """;

        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        command.Parameters.AddWithValue("$docType", docType);
        command.Parameters.AddWithValue("$id", id);
        command.Parameters.AddWithValue("$externalKey", (object?)externalKey ?? DBNull.Value);
        command.Parameters.AddWithValue("$recordedAt", recordedAt?.ToString("O") ?? (object)DBNull.Value);
        command.Parameters.AddWithValue("$payloadJson", payloadJson);
        command.Parameters.AddWithValue("$createdAt", now.ToString("O"));
        command.Parameters.AddWithValue("$updatedAt", now.ToString("O"));
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task DeleteAsync(string docType, string id, CancellationToken cancellationToken = default)
    {
        await using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        const string sql = "DELETE FROM documents WHERE doc_type = $docType AND id = $id;";

        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        command.Parameters.AddWithValue("$docType", docType);
        command.Parameters.AddWithValue("$id", id);
        await command.ExecuteNonQueryAsync(cancellationToken);
    }

    public async Task<T?> GetByIdAsync<T>(string docType, string id, CancellationToken cancellationToken = default)
    {
        await using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        const string sql = "SELECT payload_json FROM documents WHERE doc_type = $docType AND id = $id LIMIT 1;";

        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        command.Parameters.AddWithValue("$docType", docType);
        command.Parameters.AddWithValue("$id", id);
        var result = await command.ExecuteScalarAsync(cancellationToken);
        return Deserialize<T>(result);
    }

    public async Task<T?> GetByExternalKeyAsync<T>(string docType, string externalKey, CancellationToken cancellationToken = default)
    {
        await using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        const string sql = "SELECT payload_json FROM documents WHERE doc_type = $docType AND external_key = $externalKey LIMIT 1;";

        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        command.Parameters.AddWithValue("$docType", docType);
        command.Parameters.AddWithValue("$externalKey", externalKey);
        var result = await command.ExecuteScalarAsync(cancellationToken);
        return Deserialize<T>(result);
    }

    public async Task<IReadOnlyList<T>> ListAsync<T>(string docType, int limit = 100, CancellationToken cancellationToken = default)
    {
        await using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        const string sql = "SELECT payload_json FROM documents WHERE doc_type = $docType ORDER BY updated_at DESC LIMIT $limit;";

        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        command.Parameters.AddWithValue("$docType", docType);
        command.Parameters.AddWithValue("$limit", limit);

        var list = new List<T>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            var payload = reader.GetString(0);
            var item = JsonSerializer.Deserialize<T>(payload, SerializerOptions);
            if (item is not null)
            {
                list.Add(item);
            }
        }

        return list;
    }

    public async Task<IReadOnlyList<T>> ListByRecordedAtAsync<T>(string docType, DateTimeOffset fromInclusive, DateTimeOffset toInclusive, CancellationToken cancellationToken = default)
    {
        await using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        const string sql = """
                           SELECT payload_json
                           FROM documents
                           WHERE doc_type = $docType
                             AND recorded_at IS NOT NULL
                             AND recorded_at >= $fromInclusive
                             AND recorded_at <= $toInclusive
                           ORDER BY recorded_at DESC;
                           """;

        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        command.Parameters.AddWithValue("$docType", docType);
        command.Parameters.AddWithValue("$fromInclusive", fromInclusive.ToString("O"));
        command.Parameters.AddWithValue("$toInclusive", toInclusive.ToString("O"));

        var list = new List<T>();
        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        while (await reader.ReadAsync(cancellationToken))
        {
            var payload = reader.GetString(0);
            var item = JsonSerializer.Deserialize<T>(payload, SerializerOptions);
            if (item is not null)
            {
                list.Add(item);
            }
        }

        return list;
    }

    public async Task<int> CountByRecordedAtAsync(string docType, DateTimeOffset fromInclusive, DateTimeOffset toInclusive, CancellationToken cancellationToken = default)
    {
        await using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        const string sql = """
                           SELECT COUNT(1)
                           FROM documents
                           WHERE doc_type = $docType
                             AND recorded_at IS NOT NULL
                             AND recorded_at >= $fromInclusive
                             AND recorded_at <= $toInclusive;
                           """;

        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        command.Parameters.AddWithValue("$docType", docType);
        command.Parameters.AddWithValue("$fromInclusive", fromInclusive.ToString("O"));
        command.Parameters.AddWithValue("$toInclusive", toInclusive.ToString("O"));

        var result = await command.ExecuteScalarAsync(cancellationToken);
        return Convert.ToInt32(result);
    }

    public async Task<int> CountAsync(string docType, CancellationToken cancellationToken = default)
    {
        await using var connection = new SqliteConnection(_connectionString);
        await connection.OpenAsync(cancellationToken);
        const string sql = "SELECT COUNT(1) FROM documents WHERE doc_type = $docType;";

        await using var command = connection.CreateCommand();
        command.CommandText = sql;
        command.Parameters.AddWithValue("$docType", docType);

        var result = await command.ExecuteScalarAsync(cancellationToken);
        return Convert.ToInt32(result);
    }

    private static T? Deserialize<T>(object? scalar)
    {
        if (scalar is not string payload)
        {
            return default;
        }

        return JsonSerializer.Deserialize<T>(payload, SerializerOptions);
    }
}
