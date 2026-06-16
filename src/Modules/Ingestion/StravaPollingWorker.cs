using HealthHq.Shared.Contracts;
using HealthHq.Shared.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HealthHq.Modules.Ingestion;

public sealed class StravaPollingWorker : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<StravaPollingWorker> _logger;
    private readonly StravaOptions _options;
    private readonly StravaSettingsManager _settingsManager;

    public StravaPollingWorker(
        IServiceProvider serviceProvider,
        ILogger<StravaPollingWorker> logger,
        IOptions<StravaOptions> options,
        StravaSettingsManager settingsManager)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        _options = options.Value;
        _settingsManager = settingsManager;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(Math.Max(_options.PollingIntervalMinutes, 30)));

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                if (await _settingsManager.IsEnabledAsync(stoppingToken))
                {
                    await PollOnceAsync(stoppingToken);
                }
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Strava polling run failed.");
            }

            await timer.WaitForNextTickAsync(stoppingToken);
        }
    }

    private async Task PollOnceAsync(CancellationToken cancellationToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var store = scope.ServiceProvider.GetRequiredService<IDocumentStore>();
        var provider = scope.ServiceProvider
            .GetServices<IActivityIngestionProvider>()
            .FirstOrDefault(x => string.Equals(x.ProviderKey, "strava", StringComparison.OrdinalIgnoreCase))
            ?? throw new InvalidOperationException("Provider 'strava' is not registered.");

        var runId = Guid.NewGuid().ToString("N");
        await store.UpsertAsync(DocumentTypes.SyncRun, runId, new SyncRun(runId, provider.ProviderKey, DateTimeOffset.UtcNow, null, "running", 0, null), recordedAt: DateTimeOffset.UtcNow, cancellationToken: cancellationToken);

        try
        {
            var result = await provider.SyncActivitiesAsync(cancellationToken);
            await store.UpsertAsync(DocumentTypes.SyncRun, runId, new SyncRun(runId, provider.ProviderKey, DateTimeOffset.UtcNow, DateTimeOffset.UtcNow, "completed", result.ImportedCount, null), recordedAt: DateTimeOffset.UtcNow, cancellationToken: cancellationToken);
        }
        catch (Exception ex)
        {
            await store.UpsertAsync(DocumentTypes.SyncRun, runId, new SyncRun(runId, provider.ProviderKey, DateTimeOffset.UtcNow, DateTimeOffset.UtcNow, "failed", 0, ex.Message), recordedAt: DateTimeOffset.UtcNow, cancellationToken: cancellationToken);
            throw;
        }
    }
}
