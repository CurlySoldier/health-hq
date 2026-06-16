namespace HealthHq.Shared.Infrastructure;

public sealed class DataOptions
{
    public const string SectionName = "Data";
    public string DataDirectory { get; init; } = "data";
    public string DatabaseFileName { get; init; } = "healthhq.db";
    public string KeyDirectoryName { get; init; } = "keys";
}
