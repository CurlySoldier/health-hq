using System.Globalization;
using System.Text.Json;
using HealthHq.Modules.Ingestion;
using HealthHq.Shared.Contracts;
using HealthHq.Shared.Infrastructure;
using Microsoft.Extensions.DependencyInjection;

namespace HealthHq.App.Host;

public static class DemoDataSeeder
{
    public static async Task SeedAsync(IServiceProvider serviceProvider, CancellationToken cancellationToken = default)
    {
        using var scope = serviceProvider.CreateScope();
        var store = scope.ServiceProvider.GetRequiredService<IDocumentStore>();
        var hasData = await store.ListAsync<TrainingPlan>(DocumentTypes.TrainingPlan, 1, cancellationToken);
        if (hasData.Count > 0)
        {
            return;
        }

        await SeedGarminStepsAsync(store, cancellationToken);
        await SeedConnectionsAsync(store, cancellationToken);
        await SeedTrainingAsync(store, cancellationToken);
        await SeedNutritionAsync(store, cancellationToken);
        await SeedShoppingAsync(store, cancellationToken);
        await SeedVitalityAsync(store, cancellationToken);
        await SeedBodyMetricsAsync(store, cancellationToken);
        await SeedVitalSignsAsync(store, cancellationToken);
        await SeedImportsAsync(store, cancellationToken);
        await SeedGarminSettingsAsync(scope.ServiceProvider, cancellationToken);
    }

    private static async Task SeedGarminStepsAsync(IDocumentStore store, CancellationToken cancellationToken)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        for (var i = 13; i >= 0; i--)
        {
            var day = today.AddDays(-i);
            var steps = new DailyStepsRecord(
                Id: $"garmin-{day:yyyyMMdd}",
                Source: "garmin",
                Day: day,
                TotalSteps: 7200 + ((13 - i) * 420),
                DistanceKm: Math.Round(5.2 + ((13 - i) * 0.25), 2),
                ActiveKilocalories: 340 + ((13 - i) * 8),
                RawJson: "{}");

            var recordedAt = new DateTimeOffset(day.ToDateTime(TimeOnly.MinValue), TimeSpan.Zero);
            await store.UpsertAsync(DocumentTypes.DailySteps, steps.Id, steps, externalKey: $"garmin:{day:yyyy-MM-dd}", recordedAt: recordedAt, cancellationToken: cancellationToken);
        }
    }

    private static async Task SeedConnectionsAsync(IDocumentStore store, CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var stravaConnection = new ProviderConnection(
            Id: "strava",
            Provider: "strava",
            AccessToken: "demo-access-token",
            RefreshToken: "demo-refresh-token",
            ExpiresAt: now.AddHours(6),
            CreatedAt: now.AddDays(-10),
            UpdatedAt: now.AddHours(-1));

        await store.UpsertAsync(DocumentTypes.ProviderConnection, stravaConnection.Id, stravaConnection, cancellationToken: cancellationToken);

        var checkpoints = new[]
        {
            new SyncCheckpoint("strava", "strava", now.AddHours(-20), now.AddHours(-1)),
            new SyncCheckpoint("garmin", "garmin", now.AddHours(-8), now.AddHours(-1))
        };

        foreach (var checkpoint in checkpoints)
        {
            await store.UpsertAsync(DocumentTypes.SyncCheckpoint, checkpoint.Id, checkpoint, cancellationToken: cancellationToken);
        }

        var runs = new[]
        {
            new SyncRun("seed-run-strava-1", "strava", now.AddHours(-24), now.AddHours(-24).AddMinutes(2), "completed", 2, null),
            new SyncRun("seed-run-strava-2", "strava", now.AddHours(-2), now.AddHours(-2).AddMinutes(1), "completed", 1, null),
            new SyncRun("seed-run-garmin-1", "garmin", now.AddHours(-12), now.AddHours(-12).AddMinutes(3), "completed", 2, null),
            new SyncRun("seed-run-garmin-2", "garmin", now.AddHours(-5), now.AddHours(-5).AddMinutes(1), "completed", 1, null)
        };

        foreach (var run in runs)
        {
            await store.UpsertAsync(DocumentTypes.SyncRun, run.Id, run, recordedAt: run.StartedAt, cancellationToken: cancellationToken);
        }
    }

    private static async Task SeedTrainingAsync(IDocumentStore store, CancellationToken cancellationToken)
    {
        var plan = new TrainingPlan(
            Id: "seed-training-1",
            WeekKey: $"{DateTime.UtcNow:yyyy}-W{ISOWeek.GetWeekOfYear(DateTime.UtcNow):00}",
            PayloadJson: JsonSerializer.Serialize(new
            {
                focus = "Build endurance",
                sessions = new[]
                {
                    new { day = "Mon", workout = "Easy 45m run" },
                    new { day = "Wed", workout = "Tempo intervals" },
                    new { day = "Sat", workout = "Long run 90m" }
                }
            }),
            CreatedAt: DateTimeOffset.UtcNow.AddDays(-2));

        await store.UpsertAsync(DocumentTypes.TrainingPlan, plan.Id, plan, recordedAt: plan.CreatedAt, cancellationToken: cancellationToken);
    }

    private static async Task SeedNutritionAsync(IDocumentStore store, CancellationToken cancellationToken)
    {
        var now = DateTimeOffset.UtcNow;
        var recipes = new[]
        {
            new Recipe(
                Id: "seed-recipe-1",
                Name: "Protein Overnight Oats",
                Description: "Prep-ahead oats with Greek yogurt and berries.",
                Ingredients: new List<string> { "Rolled oats", "Greek yogurt", "Milk", "Bananas", "Berries", "Honey" },
                Steps: new List<string>
                {
                    "Combine oats, yogurt, and milk in a jar.",
                    "Stir in sliced banana and berries.",
                    "Refrigerate overnight and top with honey before serving."
                },
                PrepMinutes: 10,
                CookMinutes: 0,
                Tags: new List<string> { "breakfast", "high-protein" },
                CreatedAt: now.AddDays(-5),
                UpdatedAt: now.AddDays(-5)),
            new Recipe(
                Id: "seed-recipe-2",
                Name: "Chicken Power Bowl",
                Description: "Lean chicken with greens, grains, and crunchy veg.",
                Ingredients: new List<string> { "Chicken breast", "Brown rice", "Spinach", "Cucumber", "Olive oil", "Lemon" },
                Steps: new List<string>
                {
                    "Cook rice according to package instructions.",
                    "Pan-sear seasoned chicken until cooked through.",
                    "Assemble spinach, rice, sliced chicken, and chopped cucumber.",
                    "Dress with olive oil and lemon."
                },
                PrepMinutes: 15,
                CookMinutes: 20,
                Tags: new List<string> { "lunch", "meal-prep" },
                CreatedAt: now.AddDays(-5),
                UpdatedAt: now.AddDays(-5)),
            new Recipe(
                Id: "seed-recipe-3",
                Name: "Salmon Rice Plate",
                Description: "Simple omega-3 rich dinner with veg.",
                Ingredients: new List<string> { "Salmon Fillet", "Rice", "Broccoli", "Garlic", "Olive oil", "Lemon" },
                Steps: new List<string>
                {
                    "Bake salmon with garlic, olive oil, and lemon.",
                    "Steam broccoli until tender.",
                    "Serve with rice and lemon wedge."
                },
                PrepMinutes: 10,
                CookMinutes: 25,
                Tags: new List<string> { "dinner", "high-protein" },
                CreatedAt: now.AddDays(-4),
                UpdatedAt: now.AddDays(-4)),
            new Recipe(
                Id: "seed-recipe-4",
                Name: "Turkey Hummus Wrap",
                Description: "Quick wrap for busy lunch breaks.",
                Ingredients: new List<string> { "Wholegrain wrap", "Turkey slices", "Hummus", "Spinach", "Tomato" },
                Steps: new List<string>
                {
                    "Spread hummus on wrap.",
                    "Layer turkey, spinach, and tomato.",
                    "Roll tightly and slice in half."
                },
                PrepMinutes: 8,
                CookMinutes: 0,
                Tags: new List<string> { "lunch" },
                CreatedAt: now.AddDays(-4),
                UpdatedAt: now.AddDays(-4))
        };

        var meal = new MealPlan(
            Id: "seed-meal-1",
            Name: "Performance Week",
            PayloadJson: JsonSerializer.Serialize(new
            {
                weekStart = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-2)).ToString("yyyy-MM-dd"),
                days = new[]
                {
                    new { day = "Monday", breakfastRecipeId = "seed-recipe-1", lunchRecipeId = "seed-recipe-2", dinnerRecipeId = "seed-recipe-3" },
                    new { day = "Tuesday", breakfastRecipeId = "seed-recipe-1", lunchRecipeId = "seed-recipe-4", dinnerRecipeId = "seed-recipe-3" },
                    new { day = "Wednesday", breakfastRecipeId = "seed-recipe-1", lunchRecipeId = "seed-recipe-2", dinnerRecipeId = "seed-recipe-3" },
                    new { day = "Thursday", breakfastRecipeId = "seed-recipe-1", lunchRecipeId = "seed-recipe-4", dinnerRecipeId = "seed-recipe-3" },
                    new { day = "Friday", breakfastRecipeId = "seed-recipe-1", lunchRecipeId = "seed-recipe-2", dinnerRecipeId = "seed-recipe-3" },
                    new { day = "Saturday", breakfastRecipeId = "seed-recipe-1", lunchRecipeId = "seed-recipe-4", dinnerRecipeId = "seed-recipe-3" },
                    new { day = "Sunday", breakfastRecipeId = "seed-recipe-1", lunchRecipeId = "seed-recipe-2", dinnerRecipeId = "seed-recipe-3" }
                }
            }),
            CreatedAt: now.AddDays(-3));

        var legacyMeal = new MealPlan(
            Id: "seed-meal-legacy-1",
            Name: "Legacy Text Plan",
            PayloadJson: JsonSerializer.Serialize(new
            {
                days = new[]
                {
                    new { day = "Monday", breakfast = "Oats", lunch = "Chicken bowl", dinner = "Salmon + rice" },
                    new { day = "Tuesday", breakfast = "Greek yogurt", lunch = "Turkey wrap", dinner = "Pasta + veg" }
                }
            }),
            CreatedAt: now.AddDays(-6));

        var discounts = new[]
        {
            new DiscountRecord("seed-discount-1", "FreshMart", "Bananas", 2.49m, 1.79m, "kg", DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-2)), DateOnly.FromDateTime(DateTime.UtcNow.AddDays(5)), DateTimeOffset.UtcNow.AddDays(-1)),
            new DiscountRecord("seed-discount-2", "FreshMart", "Salmon Fillet", 14.99m, 10.99m, "kg", DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-1)), DateOnly.FromDateTime(DateTime.UtcNow.AddDays(6)), DateTimeOffset.UtcNow.AddDays(-1)),
            new DiscountRecord("seed-discount-3", "GrocerPlus", "Greek Yogurt", 4.99m, 3.49m, "tub", DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-3)), DateOnly.FromDateTime(DateTime.UtcNow.AddDays(3)), DateTimeOffset.UtcNow.AddDays(-2))
        };

        foreach (var recipe in recipes)
        {
            await store.UpsertAsync(DocumentTypes.Recipe, recipe.Id, recipe, recordedAt: recipe.UpdatedAt, cancellationToken: cancellationToken);
        }

        await store.UpsertAsync(DocumentTypes.MealPlan, meal.Id, meal, recordedAt: meal.CreatedAt, cancellationToken: cancellationToken);
        await store.UpsertAsync(DocumentTypes.MealPlan, legacyMeal.Id, legacyMeal, recordedAt: legacyMeal.CreatedAt, cancellationToken: cancellationToken);
        foreach (var discount in discounts)
        {
            await store.UpsertAsync(DocumentTypes.Discount, discount.Id, discount, recordedAt: discount.CreatedAt, cancellationToken: cancellationToken);
        }
    }

    private static async Task SeedShoppingAsync(IDocumentStore store, CancellationToken cancellationToken)
    {
        var lines = new[]
        {
            new { ingredient = "Bananas", store = "FreshMart", discounted = true, price = 1.79m, savings = 0.70m },
            new { ingredient = "Salmon", store = "FreshMart", discounted = true, price = 10.99m, savings = 4.00m },
            new { ingredient = "Spinach", store = "n/a", discounted = false, price = 0m, savings = 0m }
        };

        var shopping = new ShoppingList(
            Id: "seed-shopping-1",
            Name: "Meal Prep Week",
            PayloadJson: JsonSerializer.Serialize(lines),
            EstimatedTotal: 12.78m,
            EstimatedSavings: 4.70m,
            CreatedAt: DateTimeOffset.UtcNow.AddDays(-1));

        await store.UpsertAsync(DocumentTypes.ShoppingList, shopping.Id, shopping, recordedAt: shopping.CreatedAt, cancellationToken: cancellationToken);
    }

    private static async Task SeedVitalityAsync(IDocumentStore store, CancellationToken cancellationToken)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var entries = new[]
        {
            new VitalityRecord("seed-vitality-1", today.AddDays(-3), 58, "{}", DateTimeOffset.UtcNow.AddDays(-3)),
            new VitalityRecord("seed-vitality-2", today.AddDays(-2), 61, "{}", DateTimeOffset.UtcNow.AddDays(-2)),
            new VitalityRecord("seed-vitality-3", today.AddDays(-1), 74, "{}", DateTimeOffset.UtcNow.AddDays(-1)),
            new VitalityRecord("seed-vitality-4", today, 49, "{}", DateTimeOffset.UtcNow)
        };

        foreach (var entry in entries)
        {
            await store.UpsertAsync(DocumentTypes.VitalityRecord, entry.Id, entry, recordedAt: entry.CreatedAt, cancellationToken: cancellationToken);
        }
    }

    private static async Task SeedBodyMetricsAsync(IDocumentStore store, CancellationToken cancellationToken)
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var entries = new[]
        {
            new BodyMetricEntry("seed-body-1", today.AddDays(-21), 178, 80.1m, 25.28m, "overweight", DateTimeOffset.UtcNow.AddDays(-21)),
            new BodyMetricEntry("seed-body-2", today.AddDays(-14), 178, 79.2m, 25.00m, "overweight", DateTimeOffset.UtcNow.AddDays(-14)),
            new BodyMetricEntry("seed-body-3", today.AddDays(-7), 178, 78.4m, 24.75m, "healthy", DateTimeOffset.UtcNow.AddDays(-7)),
            new BodyMetricEntry("seed-body-4", today, 178, 77.8m, 24.56m, "healthy", DateTimeOffset.UtcNow)
        };

        foreach (var entry in entries)
        {
            await store.UpsertAsync(DocumentTypes.BodyMetric, entry.Id, entry, recordedAt: entry.CreatedAt, cancellationToken: cancellationToken);
        }
    }

    private static async Task SeedVitalSignsAsync(IDocumentStore store, CancellationToken cancellationToken)
    {
        var todayUtc = DateTime.UtcNow.Date;
        var entries = new[]
        {
            new VitalSignEntry("seed-vitals-1", new DateTimeOffset(todayUtc.AddDays(-4).AddHours(6), TimeSpan.Zero), 124, 79, 63, new DateTimeOffset(todayUtc.AddDays(-4).AddHours(6), TimeSpan.Zero)),
            new VitalSignEntry("seed-vitals-2", new DateTimeOffset(todayUtc.AddDays(-3).AddHours(18), TimeSpan.Zero), 129, 82, 68, new DateTimeOffset(todayUtc.AddDays(-3).AddHours(18), TimeSpan.Zero)),
            new VitalSignEntry("seed-vitals-3", new DateTimeOffset(todayUtc.AddDays(-2).AddHours(7), TimeSpan.Zero), 121, 77, 61, new DateTimeOffset(todayUtc.AddDays(-2).AddHours(7), TimeSpan.Zero)),
            new VitalSignEntry("seed-vitals-4", new DateTimeOffset(todayUtc.AddDays(-2).AddHours(20), TimeSpan.Zero), 133, 84, 72, new DateTimeOffset(todayUtc.AddDays(-2).AddHours(20), TimeSpan.Zero)),
            new VitalSignEntry("seed-vitals-5", new DateTimeOffset(todayUtc.AddDays(-1).AddHours(6), TimeSpan.Zero), 118, 75, 58, new DateTimeOffset(todayUtc.AddDays(-1).AddHours(6), TimeSpan.Zero)),
            new VitalSignEntry("seed-vitals-6", new DateTimeOffset(todayUtc.AddHours(7), TimeSpan.Zero), 122, 78, 62, new DateTimeOffset(todayUtc.AddHours(7), TimeSpan.Zero))
        };

        foreach (var entry in entries)
        {
            await store.UpsertAsync(DocumentTypes.VitalSign, entry.Id, entry, recordedAt: entry.MeasuredAt, cancellationToken: cancellationToken);
        }
    }

    private static async Task SeedImportsAsync(IDocumentStore store, CancellationToken cancellationToken)
    {
        var imports = new[]
        {
            new ImportedPayload("seed-import-1", "meal-plan", "{\"name\":\"Performance Week\"}", DateTimeOffset.UtcNow.AddDays(-3)),
            new ImportedPayload("seed-import-2", "discount", "[{\"storeName\":\"FreshMart\"}]", DateTimeOffset.UtcNow.AddDays(-2)),
            new ImportedPayload("seed-import-3", "training-plan", "{\"weekKey\":\"seed\"}", DateTimeOffset.UtcNow.AddDays(-1))
        };

        foreach (var imported in imports)
        {
            await store.UpsertAsync(DocumentTypes.ImportedPayload, imported.Id, imported, recordedAt: imported.ImportedAt, cancellationToken: cancellationToken);
        }
    }

    private static async Task SeedGarminSettingsAsync(IServiceProvider serviceProvider, CancellationToken cancellationToken)
    {
        var manager = serviceProvider.GetRequiredService<GarminSettingsManager>();
        var current = await manager.GetAsync(cancellationToken);
        if (current is not null)
        {
            return;
        }

        var request = new GarminSettingsUpsertRequest(
            Username: "demo.garmin.user@example.com",
            Password: "demo-password",
            StartDate: DateTime.UtcNow.AddYears(-1).ToString("yyyy-MM-dd"),
            DownloadLatestActivities: 25);

        await manager.UpsertAsync(request, cancellationToken);
    }
}
