using HealthHq.Shared.Contracts;
using HealthHq.Shared.Infrastructure;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace HealthHq.Modules.Ingestion;

public static class IngestionModule
{
    public static IServiceCollection AddIngestionModule(this IServiceCollection services)
    {
        services.AddSingleton<StravaSettingsManager>();
        services.AddSingleton<StravaIngestionProvider>();
        services.AddSingleton<IActivityIngestionProvider>(sp => sp.GetRequiredService<StravaIngestionProvider>());
        services.AddSingleton<IOAuthActivityIngestionProvider>(sp => (IOAuthActivityIngestionProvider)sp.GetRequiredService<StravaIngestionProvider>());
        services.AddSingleton<IExternalActivityMapper<StravaActivityDto>, StravaExternalActivityMapper>();
        services.AddSingleton<GarminSettingsManager>();
        services.AddSingleton<GarminActivityImporter>();
        services.AddSingleton<IActivityIngestionProvider>(sp => sp.GetRequiredService<GarminActivityImporter>());
        services.AddSingleton<IExternalActivityMapper<GarminActivityProjection>, GarminExternalActivityMapper>();
        services.AddHostedService<StravaPollingWorker>();
        services.AddHostedService<GarminPollingWorker>();
        return services;
    }

    public static IEndpointRouteBuilder MapIngestionEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/ingestion/providers", async (StravaSettingsManager settingsManager, CancellationToken cancellationToken) =>
        {
            var providers = new List<string> { "garmin" };
            if (await settingsManager.IsEnabledAsync(cancellationToken))
            {
                providers.Add("strava");
            }

            return Results.Ok(providers);
        });

        app.MapGet("/api/ingestion/strava/settings", async (StravaSettingsManager settingsManager, IDocumentStore store, CancellationToken cancellationToken) =>
        {
            var enabled = await settingsManager.IsEnabledAsync(cancellationToken);
            var connection = await store.GetByIdAsync<ProviderConnection>(DocumentTypes.ProviderConnection, "strava", cancellationToken);
            return Results.Ok(new
            {
                enabled,
                connected = connection is not null,
                updatedAt = (await settingsManager.GetAsync(cancellationToken))?.UpdatedAt
            });
        });

        app.MapPut("/api/ingestion/strava/settings", async (StravaSettingsUpsertRequest request, StravaSettingsManager settingsManager, CancellationToken cancellationToken) =>
        {
            var saved = await settingsManager.UpsertAsync(request.Enabled, cancellationToken);
            return Results.Ok(new { enabled = saved.Enabled, saved.UpdatedAt });
        });

        app.MapGet("/api/ingestion/strava/connect-url", async (IEnumerable<IOAuthActivityIngestionProvider> providers, StravaSettingsManager settingsManager, CancellationToken cancellationToken) =>
        {
            if (!await settingsManager.IsEnabledAsync(cancellationToken))
            {
                return Results.BadRequest(new { message = "Strava integration is disabled." });
            }

            var provider = GetRequiredOAuthProvider(providers, "strava");
            var state = Guid.NewGuid().ToString("N");
            return Results.Ok(new { provider = provider.ProviderKey, url = provider.GetAuthorizeUrl(state), state });
        });

        app.MapGet("/api/ingestion/strava/connect", async (IEnumerable<IOAuthActivityIngestionProvider> providers, StravaSettingsManager settingsManager, CancellationToken cancellationToken) =>
        {
            if (!await settingsManager.IsEnabledAsync(cancellationToken))
            {
                return Results.BadRequest(new { message = "Strava integration is disabled." });
            }

            var provider = GetRequiredOAuthProvider(providers, "strava");
            var state = Guid.NewGuid().ToString("N");
            return Results.Redirect(provider.GetAuthorizeUrl(state));
        });

        app.MapGet("/api/ingestion/strava/oauth/callback", async (string code, IEnumerable<IOAuthActivityIngestionProvider> providers, StravaSettingsManager settingsManager, CancellationToken cancellationToken) =>
        {
            if (!await settingsManager.IsEnabledAsync(cancellationToken))
            {
                return Results.BadRequest(new { message = "Strava integration is disabled." });
            }

            var provider = GetRequiredOAuthProvider(providers, "strava");
            await provider.ExchangeCodeAsync(code, cancellationToken);
            return Results.Redirect("/");
        });

        app.MapPost("/api/ingestion/strava/sync", async (IEnumerable<IActivityIngestionProvider> providers, IDocumentStore store, StravaSettingsManager settingsManager, CancellationToken cancellationToken) =>
        {
            if (!await settingsManager.IsEnabledAsync(cancellationToken))
            {
                return Results.BadRequest(new { message = "Strava integration is disabled." });
            }

            var provider = GetRequiredProvider(providers, "strava");
            var runId = Guid.NewGuid().ToString("N");
            await store.UpsertAsync(DocumentTypes.SyncRun, runId, new SyncRun(runId, provider.ProviderKey, DateTimeOffset.UtcNow, null, "running", 0, null), recordedAt: DateTimeOffset.UtcNow, cancellationToken: cancellationToken);
            try
            {
                var result = await provider.SyncActivitiesAsync(cancellationToken);
                await store.UpsertAsync(DocumentTypes.SyncRun, runId, new SyncRun(runId, provider.ProviderKey, DateTimeOffset.UtcNow, DateTimeOffset.UtcNow, "completed", result.ImportedCount, null), recordedAt: DateTimeOffset.UtcNow, cancellationToken: cancellationToken);
                return Results.Ok(result);
            }
            catch (Exception ex)
            {
                await store.UpsertAsync(DocumentTypes.SyncRun, runId, new SyncRun(runId, provider.ProviderKey, DateTimeOffset.UtcNow, DateTimeOffset.UtcNow, "failed", 0, ex.Message), recordedAt: DateTimeOffset.UtcNow, cancellationToken: cancellationToken);
                throw;
            }
        });

        app.MapGet("/api/ingestion/strava/status", async (IDocumentStore store, StravaSettingsManager settingsManager, CancellationToken cancellationToken) =>
        {
            var enabled = await settingsManager.IsEnabledAsync(cancellationToken);
            if (!enabled)
            {
                return Results.Ok(new
                {
                    enabled,
                    connected = false,
                    expiresAt = (DateTimeOffset?)null,
                    lastSyncedAt = (DateTimeOffset?)null,
                    recentRuns = Array.Empty<SyncRun>()
                });
            }

            var connection = await store.GetByIdAsync<ProviderConnection>(DocumentTypes.ProviderConnection, "strava", cancellationToken);
            var checkpoint = await store.GetByIdAsync<SyncCheckpoint>(DocumentTypes.SyncCheckpoint, "strava", cancellationToken);
            var runs = await store.ListAsync<SyncRun>(DocumentTypes.SyncRun, 10, cancellationToken);

            return Results.Ok(new
            {
                enabled,
                connected = connection is not null,
                expiresAt = connection?.ExpiresAt,
                lastSyncedAt = checkpoint?.LastSyncedAt,
                recentRuns = runs.Where(x => x.Provider == "strava").OrderByDescending(x => x.StartedAt).Take(5)
            });
        });

        app.MapPost("/api/ingestion/garmin/settings", async (GarminSettingsUpsertRequest request, GarminSettingsManager settingsManager, CancellationToken cancellationToken) =>
        {
            var saved = await settingsManager.UpsertAsync(request, cancellationToken);
            return Results.Ok(new
            {
                configured = true,
                hasUsername = !string.IsNullOrWhiteSpace(saved.Username),
                hasPassword = !string.IsNullOrWhiteSpace(saved.EncryptedPassword),
                credentialsUpdatedAt = saved.UpdatedAt
            });
        });

        app.MapPost("/api/ingestion/garmin/sync", async (IEnumerable<IActivityIngestionProvider> providers, IDocumentStore store, GarminSettingsManager settingsManager, CancellationToken cancellationToken) =>
        {
            var provider = GetRequiredProvider(providers, "garmin");
            await settingsManager.EnsureRuntimeFilesAsync(cancellationToken);

            var runId = Guid.NewGuid().ToString("N");
            await store.UpsertAsync(DocumentTypes.SyncRun, runId, new SyncRun(runId, provider.ProviderKey, DateTimeOffset.UtcNow, null, "running", 0, null), recordedAt: DateTimeOffset.UtcNow, cancellationToken: cancellationToken);
            try
            {
                var result = await provider.SyncActivitiesAsync(cancellationToken);
                await store.UpsertAsync(DocumentTypes.SyncRun, runId, new SyncRun(runId, provider.ProviderKey, DateTimeOffset.UtcNow, DateTimeOffset.UtcNow, "completed", result.ImportedCount, null), recordedAt: DateTimeOffset.UtcNow, cancellationToken: cancellationToken);
                return Results.Ok(result);
            }
            catch (Exception ex)
            {
                await store.UpsertAsync(DocumentTypes.SyncRun, runId, new SyncRun(runId, provider.ProviderKey, DateTimeOffset.UtcNow, DateTimeOffset.UtcNow, "failed", 0, ex.Message), recordedAt: DateTimeOffset.UtcNow, cancellationToken: cancellationToken);
                throw;
            }
        });

        app.MapPost("/api/ingestion/garmin/backfill", async (IEnumerable<IActivityIngestionProvider> providers, IDocumentStore store, GarminSettingsManager settingsManager, CancellationToken cancellationToken) =>
        {
            var provider = GetRequiredProvider(providers, "garmin");
            await settingsManager.EnsureRuntimeFilesAsync(cancellationToken);
            await store.DeleteAsync(DocumentTypes.SyncCheckpoint, "garmin", cancellationToken);

            var runId = Guid.NewGuid().ToString("N");
            await store.UpsertAsync(DocumentTypes.SyncRun, runId, new SyncRun(runId, provider.ProviderKey, DateTimeOffset.UtcNow, null, "running", 0, null), recordedAt: DateTimeOffset.UtcNow, cancellationToken: cancellationToken);
            try
            {
                var result = await provider.SyncActivitiesAsync(cancellationToken);
                await store.UpsertAsync(DocumentTypes.SyncRun, runId, new SyncRun(runId, provider.ProviderKey, DateTimeOffset.UtcNow, DateTimeOffset.UtcNow, "completed", result.ImportedCount, null), recordedAt: DateTimeOffset.UtcNow, cancellationToken: cancellationToken);
                return Results.Ok(result);
            }
            catch (Exception ex)
            {
                await store.UpsertAsync(DocumentTypes.SyncRun, runId, new SyncRun(runId, provider.ProviderKey, DateTimeOffset.UtcNow, DateTimeOffset.UtcNow, "failed", 0, ex.Message), recordedAt: DateTimeOffset.UtcNow, cancellationToken: cancellationToken);
                throw;
            }
        });

        app.MapGet("/api/ingestion/garmin/status", async (IDocumentStore store, GarminSettingsManager settingsManager, CancellationToken cancellationToken) =>
        {
            var settings = await settingsManager.GetAsync(cancellationToken);
            var checkpoint = await store.GetByIdAsync<SyncCheckpoint>(DocumentTypes.SyncCheckpoint, "garmin", cancellationToken);
            var runs = await store.ListAsync<SyncRun>(DocumentTypes.SyncRun, 20, cancellationToken);
            var dbPath = settingsManager.GetActivitiesDatabasePath();
            var dbExists = File.Exists(dbPath);
            DateTimeOffset? dbLastWrite = null;
            if (dbExists)
            {
                dbLastWrite = new DateTimeOffset(File.GetLastWriteTimeUtc(dbPath), TimeSpan.Zero);
            }

            var response = new GarminStatusResponse(
                Configured: settings is not null,
                HasUsername: !string.IsNullOrWhiteSpace(settings?.Username),
                HasPassword: !string.IsNullOrWhiteSpace(settings?.EncryptedPassword),
                CredentialsUpdatedAt: settings?.UpdatedAt,
                ActivitiesDatabaseExists: dbExists,
                ActivitiesDatabaseLastWriteUtc: dbLastWrite,
                LastImportedAt: checkpoint?.LastSyncedAt,
                RecentRuns: runs.Where(x => x.Provider == "garmin").OrderByDescending(x => x.StartedAt).Take(5)
            );

            return Results.Ok(response);
        });

        app.MapGet("/api/ingestion/import-status", async (IDocumentStore store, StravaSettingsManager settingsManager, CancellationToken cancellationToken) =>
        {
            var stravaEnabled = await settingsManager.IsEnabledAsync(cancellationToken);
            var activityCount = stravaEnabled
                ? await store.CountAsync(DocumentTypes.Activity, cancellationToken)
                : (await store.ListAsync<ActivityRecord>(DocumentTypes.Activity, 10_000, cancellationToken))
                    .Count(x => !string.Equals(x.Source, "strava", StringComparison.OrdinalIgnoreCase));
            var stepsDaysCount = await store.CountAsync(DocumentTypes.DailySteps, cancellationToken);
            var sleepDaysCount = await store.CountAsync(DocumentTypes.SleepSummary, cancellationToken);
            var importedPayloadCount = await store.CountAsync(DocumentTypes.ImportedPayload, cancellationToken);

            var runs = await store.ListAsync<SyncRun>(DocumentTypes.SyncRun, 250, cancellationToken);
            var orderedRuns = runs
                .Where(x => stravaEnabled || !string.Equals(x.Provider, "strava", StringComparison.OrdinalIgnoreCase))
                .OrderByDescending(x => x.StartedAt)
                .ToArray();

            async Task<object> BuildProviderStatusAsync(string provider)
            {
                var providerRuns = orderedRuns.Where(x => string.Equals(x.Provider, provider, StringComparison.OrdinalIgnoreCase)).ToArray();
                var lastRun = providerRuns.FirstOrDefault();
                var checkpoint = await store.GetByIdAsync<SyncCheckpoint>(DocumentTypes.SyncCheckpoint, provider, cancellationToken);

                return new
                {
                    provider,
                    totalRuns = providerRuns.Length,
                    failedRuns = providerRuns.Count(x => string.Equals(x.Status, "failed", StringComparison.OrdinalIgnoreCase)),
                    importedTotal = providerRuns
                        .Where(x => string.Equals(x.Status, "completed", StringComparison.OrdinalIgnoreCase))
                        .Sum(x => x.ImportedCount),
                    lastRunAt = lastRun?.StartedAt,
                    lastRunStatus = lastRun?.Status,
                    lastRunImportedCount = lastRun?.ImportedCount,
                    lastFailure = providerRuns.FirstOrDefault(x => string.Equals(x.Status, "failed", StringComparison.OrdinalIgnoreCase))?.Error,
                    lastImportedAt = checkpoint?.LastSyncedAt
                };
            }

            var providers = new List<object>
            {
                await BuildProviderStatusAsync("garmin")
            };
            if (stravaEnabled)
            {
                providers.Add(await BuildProviderStatusAsync("strava"));
            }

            var recentFailures = orderedRuns
                .Where(x => string.Equals(x.Status, "failed", StringComparison.OrdinalIgnoreCase))
                .Take(20)
                .Select(x => new
                {
                    x.Id,
                    x.Provider,
                    x.StartedAt,
                    x.FinishedAt,
                    x.Error
                });

            return Results.Ok(new
            {
                totals = new
                {
                    activities = activityCount,
                    stepDays = stepsDaysCount,
                    sleepDays = sleepDaysCount,
                    manualImports = importedPayloadCount
                },
                recentRuns = orderedRuns.Take(20),
                providers,
                recentFailures
            });
        });

        return app;
    }

    private static IActivityIngestionProvider GetRequiredProvider(IEnumerable<IActivityIngestionProvider> providers, string providerKey)
    {
        return providers.FirstOrDefault(x => string.Equals(x.ProviderKey, providerKey, StringComparison.OrdinalIgnoreCase))
               ?? throw new InvalidOperationException($"Provider '{providerKey}' is not registered.");
    }

    private static IOAuthActivityIngestionProvider GetRequiredOAuthProvider(IEnumerable<IOAuthActivityIngestionProvider> providers, string providerKey)
    {
        return providers.FirstOrDefault(x => string.Equals(x.ProviderKey, providerKey, StringComparison.OrdinalIgnoreCase))
               ?? throw new InvalidOperationException($"OAuth provider '{providerKey}' is not registered.");
    }
}
