using HealthHq.Shared.Contracts;
using HealthHq.Shared.Infrastructure;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace HealthHq.Modules.Ingestion;

public sealed class GarminPollingWorker : BackgroundService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<GarminPollingWorker> _logger;
    private readonly GarminOptions _options;

    public GarminPollingWorker(IServiceProvider serviceProvider, ILogger<GarminPollingWorker> logger, IOptions<GarminOptions> options)
    {
        _serviceProvider = serviceProvider;
        _logger = logger;
        _options = options.Value;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromMinutes(Math.Max(_options.PollingIntervalMinutes, 5)));

        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await PollOnceAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Garmin polling run failed.");
            }

            await timer.WaitForNextTickAsync(stoppingToken);
        }
    }

    private async Task PollOnceAsync(CancellationToken cancellationToken)
    {
        using var scope = _serviceProvider.CreateScope();
        var store = scope.ServiceProvider.GetRequiredService<IDocumentStore>();
        var settingsManager = scope.ServiceProvider.GetRequiredService<GarminSettingsManager>();
        var provider = scope.ServiceProvider
            .GetServices<IActivityIngestionProvider>()
            .FirstOrDefault(x => string.Equals(x.ProviderKey, "garmin", StringComparison.OrdinalIgnoreCase))
            ?? throw new InvalidOperationException("Provider 'garmin' is not registered.");

        await settingsManager.EnsureRuntimeFilesAsync(cancellationToken);

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
