namespace HealthHq.Modules.Ingestion;

public interface IActivityIngestionProvider
{
    string ProviderKey { get; }
    Task<SyncResult> SyncActivitiesAsync(CancellationToken cancellationToken = default);
}

public interface IOAuthActivityIngestionProvider : IActivityIngestionProvider
{
    string GetAuthorizeUrl(string state);
    Task ExchangeCodeAsync(string code, CancellationToken cancellationToken = default);
}
