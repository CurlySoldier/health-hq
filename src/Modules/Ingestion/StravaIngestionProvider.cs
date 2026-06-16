using System.Net.Http.Json;
using System.Text.Json;
using HealthHq.Shared.Contracts;
using HealthHq.Shared.Infrastructure;
using Microsoft.Extensions.Options;

namespace HealthHq.Modules.Ingestion;

public sealed class StravaIngestionProvider : IOAuthActivityIngestionProvider
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly IDocumentStore _documentStore;
    private readonly StravaOptions _options;
    private readonly StravaSettingsManager _settingsManager;
    private readonly IExternalActivityMapper<StravaActivityDto> _mapper;

    public StravaIngestionProvider(
        IHttpClientFactory httpClientFactory,
        IDocumentStore documentStore,
        IOptions<StravaOptions> options,
        StravaSettingsManager settingsManager,
        IExternalActivityMapper<StravaActivityDto> mapper)
    {
        _httpClientFactory = httpClientFactory;
        _documentStore = documentStore;
        _options = options.Value;
        _settingsManager = settingsManager;
        _mapper = mapper;
    }

    public string ProviderKey => "strava";

    public string GetAuthorizeUrl(string state)
    {
        var query = new Dictionary<string, string>
        {
            ["client_id"] = _options.ClientId,
            ["redirect_uri"] = _options.RedirectUri,
            ["response_type"] = "code",
            ["approval_prompt"] = "auto",
            ["scope"] = "read,activity:read_all",
            ["state"] = state
        };

        var queryString = string.Join("&", query.Select(x => $"{Uri.EscapeDataString(x.Key)}={Uri.EscapeDataString(x.Value)}"));
        return $"https://www.strava.com/oauth/authorize?{queryString}";
    }

    public async Task ExchangeCodeAsync(string code, CancellationToken cancellationToken = default)
    {
        if (!await _settingsManager.IsEnabledAsync(cancellationToken))
        {
            throw new InvalidOperationException("Strava integration is disabled.");
        }

        var client = _httpClientFactory.CreateClient();
        var response = await client.PostAsJsonAsync("https://www.strava.com/oauth/token", new
        {
            client_id = _options.ClientId,
            client_secret = _options.ClientSecret,
            code,
            grant_type = "authorization_code"
        }, cancellationToken);

        response.EnsureSuccessStatusCode();
        var token = await response.Content.ReadFromJsonAsync<StravaTokenResponse>(cancellationToken: cancellationToken)
                    ?? throw new InvalidOperationException("Token exchange failed.");

        await SaveConnectionAsync(token, cancellationToken);
    }

    public async Task<SyncResult> SyncActivitiesAsync(CancellationToken cancellationToken = default)
    {
        if (!await _settingsManager.IsEnabledAsync(cancellationToken))
        {
            throw new InvalidOperationException("Strava integration is disabled.");
        }

        var connection = await _documentStore.GetByIdAsync<ProviderConnection>(DocumentTypes.ProviderConnection, ProviderKey, cancellationToken);
        if (connection is null)
        {
            throw new InvalidOperationException("Strava is not connected.");
        }

        var activeConnection = connection;
        if (connection.ExpiresAt <= DateTimeOffset.UtcNow.AddMinutes(2))
        {
            activeConnection = await RefreshTokenAsync(connection.RefreshToken, cancellationToken);
        }

        var checkpoint = await _documentStore.GetByIdAsync<SyncCheckpoint>(DocumentTypes.SyncCheckpoint, ProviderKey, cancellationToken);
        var after = checkpoint?.LastSyncedAt ?? DateTimeOffset.UtcNow.AddDays(-60);

        var client = _httpClientFactory.CreateClient();
        client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", activeConnection.AccessToken);

        var afterUnix = after.ToUnixTimeSeconds();
        var url = $"https://www.strava.com/api/v3/athlete/activities?per_page=200&after={afterUnix}";
        var response = await client.GetAsync(url, cancellationToken);
        response.EnsureSuccessStatusCode();
        var activities = await response.Content.ReadFromJsonAsync<List<StravaActivityDto>>(cancellationToken: cancellationToken) ?? [];

        var imported = 0;
        var latest = after;

        foreach (var item in activities)
        {
            var externalActivity = _mapper.Map(item);
            var streamData = await TryFetchActivityStreamsAsync(client, item.Id, cancellationToken);
            if (streamData is not null)
            {
                var stream = streamData.Value;
                externalActivity = externalActivity with
                {
                    RoutePoints = stream.RoutePoints,
                    HeartRateSamples = stream.HeartRateSamples
                };
            }

            var normalized = ActivityRecordFactory.Create(ProviderKey, externalActivity);

            await _documentStore.UpsertAsync(
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

        var newCheckpoint = new SyncCheckpoint(ProviderKey, ProviderKey, latest, DateTimeOffset.UtcNow);
        await _documentStore.UpsertAsync(DocumentTypes.SyncCheckpoint, ProviderKey, newCheckpoint, cancellationToken: cancellationToken);
        return new SyncResult(imported, latest);
    }

    private async Task SaveConnectionAsync(StravaTokenResponse token, CancellationToken cancellationToken)
    {
        var connection = new ProviderConnection(
            Id: ProviderKey,
            Provider: ProviderKey,
            AccessToken: token.AccessToken,
            RefreshToken: token.RefreshToken,
            ExpiresAt: DateTimeOffset.FromUnixTimeSeconds(token.ExpiresAtUnix),
            CreatedAt: DateTimeOffset.UtcNow,
            UpdatedAt: DateTimeOffset.UtcNow
        );

        await _documentStore.UpsertAsync(DocumentTypes.ProviderConnection, ProviderKey, connection, cancellationToken: cancellationToken);
    }

    private async Task<ProviderConnection> RefreshTokenAsync(string refreshToken, CancellationToken cancellationToken)
    {
        var client = _httpClientFactory.CreateClient();
        var response = await client.PostAsJsonAsync("https://www.strava.com/oauth/token", new
        {
            client_id = _options.ClientId,
            client_secret = _options.ClientSecret,
            grant_type = "refresh_token",
            refresh_token = refreshToken
        }, cancellationToken);

        response.EnsureSuccessStatusCode();
        var token = await response.Content.ReadFromJsonAsync<StravaTokenResponse>(cancellationToken: cancellationToken)
                    ?? throw new InvalidOperationException("Token refresh failed.");

        await SaveConnectionAsync(token, cancellationToken);
        return await _documentStore.GetByIdAsync<ProviderConnection>(DocumentTypes.ProviderConnection, ProviderKey, cancellationToken)
               ?? throw new InvalidOperationException("Connection not found after refresh.");
    }

    private async Task<(List<ActivityRoutePoint> RoutePoints, List<ActivityHeartRateSample> HeartRateSamples)?> TryFetchActivityStreamsAsync(
        HttpClient client,
        long activityId,
        CancellationToken cancellationToken)
    {
        var url = $"https://www.strava.com/api/v3/activities/{activityId}/streams?keys=time,heartrate,latlng&key_by_type=true";
        var response = await client.GetAsync(url, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            return null;
        }

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var document = await JsonDocument.ParseAsync(stream, cancellationToken: cancellationToken);
        var root = document.RootElement;

        var offsets = ReadIntArray(root, "time");
        var heartRates = ReadIntArray(root, "heartrate");
        var routePoints = ReadLatLngArray(root, "latlng");

        List<ActivityHeartRateSample>? heartRateSamples = null;
        if (heartRates.Count > 0)
        {
            heartRateSamples = new List<ActivityHeartRateSample>(heartRates.Count);
            for (var index = 0; index < heartRates.Count; index++)
            {
                var offset = index < offsets.Count ? offsets[index] : index;
                heartRateSamples.Add(new ActivityHeartRateSample(offset, heartRates[index]));
            }
        }

        if (routePoints.Count == 0 && (heartRateSamples is null || heartRateSamples.Count == 0))
        {
            return null;
        }

        return (routePoints, heartRateSamples ?? []);
    }

    private static List<int> ReadIntArray(JsonElement root, string key)
    {
        if (!root.TryGetProperty(key, out var streamNode)
            || streamNode.ValueKind != JsonValueKind.Object
            || !streamNode.TryGetProperty("data", out var data)
            || data.ValueKind != JsonValueKind.Array)
        {
            return [];
        }

        var values = new List<int>();
        foreach (var item in data.EnumerateArray())
        {
            if (item.ValueKind == JsonValueKind.Number && item.TryGetInt32(out var number))
            {
                values.Add(number);
            }
        }

        return values;
    }

    private static List<ActivityRoutePoint> ReadLatLngArray(JsonElement root, string key)
    {
        if (!root.TryGetProperty(key, out var streamNode)
            || streamNode.ValueKind != JsonValueKind.Object
            || !streamNode.TryGetProperty("data", out var data)
            || data.ValueKind != JsonValueKind.Array)
        {
            return [];
        }

        var points = new List<ActivityRoutePoint>();
        foreach (var item in data.EnumerateArray())
        {
            if (item.ValueKind != JsonValueKind.Array)
            {
                continue;
            }

            var iterator = item.EnumerateArray();
            if (!iterator.MoveNext())
            {
                continue;
            }

            var first = iterator.Current;
            if (!iterator.MoveNext())
            {
                continue;
            }

            var second = iterator.Current;
            if (first.ValueKind == JsonValueKind.Number
                && second.ValueKind == JsonValueKind.Number
                && first.TryGetDouble(out var latitude)
                && second.TryGetDouble(out var longitude))
            {
                points.Add(new ActivityRoutePoint(latitude, longitude));
            }
        }

        return points;
    }
}
