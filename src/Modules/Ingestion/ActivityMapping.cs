using HealthHq.Shared.Contracts;

namespace HealthHq.Modules.Ingestion;

public interface IExternalActivityMapper<in TSource>
{
    ExternalActivity Map(TSource source);
}

public static class ActivityRecordFactory
{
    public static ActivityRecord Create(string providerKey, ExternalActivity externalActivity)
    {
        return new ActivityRecord(
            Id: $"{providerKey}-{externalActivity.ExternalId}",
            Source: providerKey,
            ExternalId: externalActivity.ExternalId,
            StartTime: externalActivity.StartTime,
            EndTime: externalActivity.EndTime,
            DurationMinutes: externalActivity.DurationMinutes,
            Steps: externalActivity.Steps,
            DistanceKm: externalActivity.DistanceKm,
            AverageHeartRate: externalActivity.AverageHeartRate,
            MaxHeartRate: externalActivity.MaxHeartRate,
            LoadScore: externalActivity.LoadScore,
            Type: externalActivity.Type,
            RawJson: externalActivity.RawJson,
            Name: externalActivity.Name,
            RoutePoints: externalActivity.RoutePoints?.ToList(),
            HeartRateSamples: externalActivity.HeartRateSamples?.ToList()
        );
    }
}
