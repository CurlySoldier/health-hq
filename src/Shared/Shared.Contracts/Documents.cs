namespace HealthHq.Shared.Contracts;

public interface IJsonEntity
{
    string Id { get; init; }
}

public sealed record ActivityRecord(
    string Id,
    string Source,
    string ExternalId,
    DateTimeOffset StartTime,
    DateTimeOffset EndTime,
    double DurationMinutes,
    int? Steps,
    double? DistanceKm,
    int? AverageHeartRate,
    int? MaxHeartRate,
    double? LoadScore,
    string Type,
    string RawJson,
    string? Name = null,
    List<ActivityRoutePoint>? RoutePoints = null,
    List<ActivityHeartRateSample>? HeartRateSamples = null
) : IJsonEntity;

public sealed record ActivityRoutePoint(double Latitude, double Longitude);

public sealed record ActivityHeartRateSample(int OffsetSeconds, int HeartRate);

public sealed record DailyStepsRecord(
    string Id,
    string Source,
    DateOnly Day,
    int TotalSteps,
    double? DistanceKm,
    int? ActiveKilocalories,
    string RawJson
) : IJsonEntity;

public sealed record SleepSummaryRecord(
    string Id,
    string Source,
    DateOnly Day,
    double SleepHours,
    double DeepSleepHours,
    double LightSleepHours,
    double RemSleepHours,
    double AwakeHours,
    int? SleepScore,
    string RawJson
) : IJsonEntity;

public sealed record ProviderConnection(
    string Id,
    string Provider,
    string AccessToken,
    string RefreshToken,
    DateTimeOffset ExpiresAt,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt
) : IJsonEntity;

public sealed record SyncCheckpoint(
    string Id,
    string Provider,
    DateTimeOffset LastSyncedAt,
    DateTimeOffset UpdatedAt
) : IJsonEntity;

public sealed record SyncRun(
    string Id,
    string Provider,
    DateTimeOffset StartedAt,
    DateTimeOffset? FinishedAt,
    string Status,
    int ImportedCount,
    string? Error
) : IJsonEntity;

public sealed record TrainingPlan(
    string Id,
    string WeekKey,
    string PayloadJson,
    DateTimeOffset CreatedAt
) : IJsonEntity;

public sealed record MealPlan(
    string Id,
    string Name,
    string PayloadJson,
    DateTimeOffset CreatedAt
) : IJsonEntity;

public sealed record Recipe(
    string Id,
    string Name,
    string? Description,
    List<string> Ingredients,
    List<string> Steps,
    int? PrepMinutes,
    int? CookMinutes,
    List<string> Tags,
    DateTimeOffset CreatedAt,
    DateTimeOffset UpdatedAt
) : IJsonEntity;

public sealed record DiscountRecord(
    string Id,
    string StoreName,
    string ItemName,
    decimal OriginalPrice,
    decimal DiscountedPrice,
    string Unit,
    DateOnly ValidFrom,
    DateOnly ValidTo,
    DateTimeOffset CreatedAt
) : IJsonEntity;

public sealed record ShoppingList(
    string Id,
    string Name,
    string PayloadJson,
    decimal EstimatedTotal,
    decimal EstimatedSavings,
    DateTimeOffset CreatedAt
) : IJsonEntity;

public sealed record VitalityRecord(
    string Id,
    DateOnly Day,
    int Points,
    string PayloadJson,
    DateTimeOffset CreatedAt
) : IJsonEntity;

public sealed record BodyMetricEntry(
    string Id,
    DateOnly Day,
    decimal HeightCm,
    decimal WeightKg,
    decimal Bmi,
    string Category,
    DateTimeOffset CreatedAt
) : IJsonEntity;

public sealed record VitalSignEntry(
    string Id,
    DateTimeOffset MeasuredAt,
    int Systolic,
    int Diastolic,
    int Pulse,
    DateTimeOffset CreatedAt
) : IJsonEntity;

public sealed record ImportedPayload(
    string Id,
    string PayloadType,
    string PayloadJson,
    DateTimeOffset ImportedAt
) : IJsonEntity;

public sealed record IngestionProviderSettings(
    string Id,
    bool Enabled,
    DateTimeOffset UpdatedAt
) : IJsonEntity;

public sealed record DashboardSummary(
    int ActivityCountLast7Days,
    double AcuteLoad,
    double ChronicLoad,
    double Acwr,
    int VitalityPointsThisWeek,
    int? AverageStepsLast7Days,
    double? AverageSleepHoursLast7Days,
    decimal? LatestBmi,
    decimal? LatestWeightKg,
    string? LatestWeightCategory,
    int ActiveMealPlans,
    int ActiveDiscounts
);
