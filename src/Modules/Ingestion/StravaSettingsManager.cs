using HealthHq.Shared.Contracts;
using HealthHq.Shared.Infrastructure;
using Microsoft.Extensions.Options;

namespace HealthHq.Modules.Ingestion;

public sealed class StravaSettingsManager
{
    private const string ProviderKey = "strava";

    private readonly IDocumentStore _store;
    private readonly StravaOptions _options;

    public StravaSettingsManager(IDocumentStore store, IOptions<StravaOptions> options)
    {
        _store = store;
        _options = options.Value;
    }

    public async Task<IngestionProviderSettings?> GetAsync(CancellationToken cancellationToken)
    {
        return await _store.GetByIdAsync<IngestionProviderSettings>(DocumentTypes.IngestionProviderSettings, ProviderKey, cancellationToken);
    }

    public async Task<bool> IsEnabledAsync(CancellationToken cancellationToken)
    {
        var settings = await GetAsync(cancellationToken);
        return settings?.Enabled ?? _options.EnabledByDefault;
    }

    public async Task<IngestionProviderSettings> UpsertAsync(bool enabled, CancellationToken cancellationToken)
    {
        var settings = new IngestionProviderSettings(
            Id: ProviderKey,
            Enabled: enabled,
            UpdatedAt: DateTimeOffset.UtcNow);

        await _store.UpsertAsync(
            DocumentTypes.IngestionProviderSettings,
            ProviderKey,
            settings,
            recordedAt: settings.UpdatedAt,
            cancellationToken: cancellationToken);

        return settings;
    }
}
