using System.Text.Json;

namespace HealthHq.Modules.Ingestion;

public sealed class StravaExternalActivityMapper : IExternalActivityMapper<StravaActivityDto>
{
    public ExternalActivity Map(StravaActivityDto source)
    {
        var endTime = source.StartDate.AddSeconds(Math.Max(source.ElapsedTimeSeconds, source.MovingTimeSeconds));

        return new ExternalActivity(
            ExternalId: source.Id.ToString(),
            StartTime: source.StartDate,
            EndTime: endTime,
            DurationMinutes: Math.Round(source.MovingTimeSeconds / 60d, 2),
            Steps: null,
            DistanceKm: Math.Round(source.DistanceMeters / 1000d, 2),
            AverageHeartRate: source.AverageHeartRate.HasValue ? (int)Math.Round(source.AverageHeartRate.Value) : null,
            MaxHeartRate: source.MaxHeartRate.HasValue ? (int)Math.Round(source.MaxHeartRate.Value) : null,
            LoadScore: source.SufferScore,
            Type: source.Type,
            RawJson: JsonSerializer.Serialize(source),
            Name: source.Name
        );
    }
}
