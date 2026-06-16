using System.Text.Json;
using HealthHq.Shared.Contracts;
using HealthHq.Shared.Infrastructure;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace HealthHq.Modules.Imports;

public sealed record ImportRequest(string PayloadType, JsonElement Payload);

public static class ImportsModule
{
    private static readonly JsonSerializerOptions SerializerOptions = new(JsonSerializerDefaults.Web);

    public static IServiceCollection AddImportsModule(this IServiceCollection services) => services;

    public static IEndpointRouteBuilder MapImportsEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/imports", async (ImportRequest request, IDocumentStore store, CancellationToken cancellationToken) =>
        {
            var payloadJson = request.Payload.GetRawText();
            var imported = new ImportedPayload(Guid.NewGuid().ToString("N"), request.PayloadType, payloadJson, DateTimeOffset.UtcNow);
            await store.UpsertAsync(DocumentTypes.ImportedPayload, imported.Id, imported, recordedAt: imported.ImportedAt, cancellationToken: cancellationToken);

            return request.PayloadType.ToLowerInvariant() switch
            {
                "meal-plan" => await SaveMealPlanAsync(payloadJson, store, cancellationToken),
                "discount" => await SaveDiscountsAsync(payloadJson, store, cancellationToken),
                "recipe" => await SaveRecipesAsync(payloadJson, store, cancellationToken),
                "recipes" => await SaveRecipesAsync(payloadJson, store, cancellationToken),
                "training-plan" => await SaveTrainingPlanAsync(payloadJson, store, cancellationToken),
                _ => Results.Ok(new { imported = true, payloadId = imported.Id })
            };
        });

        app.MapGet("/api/imports", async (IDocumentStore store, CancellationToken cancellationToken) =>
        {
            var imports = await store.ListAsync<ImportedPayload>(DocumentTypes.ImportedPayload, 100, cancellationToken);
            return Results.Ok(imports);
        });

        return app;
    }

    private static async Task<IResult> SaveMealPlanAsync(string payloadJson, IDocumentStore store, CancellationToken cancellationToken)
    {
        var mealPlan = JsonSerializer.Deserialize<MealPlan>(payloadJson, SerializerOptions);
        if (mealPlan is null)
        {
            return Results.BadRequest(new { message = "Invalid meal-plan payload." });
        }

        var normalized = mealPlan with
        {
            Id = string.IsNullOrWhiteSpace(mealPlan.Id) ? Guid.NewGuid().ToString("N") : mealPlan.Id,
            CreatedAt = DateTimeOffset.UtcNow
        };
        await store.UpsertAsync(DocumentTypes.MealPlan, normalized.Id, normalized, recordedAt: normalized.CreatedAt, cancellationToken: cancellationToken);
        return Results.Ok(normalized);
    }

    private static async Task<IResult> SaveDiscountsAsync(string payloadJson, IDocumentStore store, CancellationToken cancellationToken)
    {
        var discounts = JsonSerializer.Deserialize<List<DiscountRecord>>(payloadJson, SerializerOptions);
        if (discounts is null)
        {
            return Results.BadRequest(new { message = "Invalid discount payload." });
        }

        foreach (var discount in discounts)
        {
            var normalized = discount with
            {
                Id = string.IsNullOrWhiteSpace(discount.Id) ? Guid.NewGuid().ToString("N") : discount.Id,
                CreatedAt = DateTimeOffset.UtcNow
            };
            await store.UpsertAsync(DocumentTypes.Discount, normalized.Id, normalized, recordedAt: normalized.CreatedAt, cancellationToken: cancellationToken);
        }

        return Results.Ok(new { imported = discounts.Count });
    }

    private static async Task<IResult> SaveTrainingPlanAsync(string payloadJson, IDocumentStore store, CancellationToken cancellationToken)
    {
        var plan = JsonSerializer.Deserialize<TrainingPlan>(payloadJson, SerializerOptions);
        if (plan is null)
        {
            return Results.BadRequest(new { message = "Invalid training-plan payload." });
        }

        var normalized = plan with
        {
            Id = string.IsNullOrWhiteSpace(plan.Id) ? Guid.NewGuid().ToString("N") : plan.Id,
            CreatedAt = DateTimeOffset.UtcNow
        };
        await store.UpsertAsync(DocumentTypes.TrainingPlan, normalized.Id, normalized, recordedAt: normalized.CreatedAt, cancellationToken: cancellationToken);
        return Results.Ok(normalized);
    }

    private static async Task<IResult> SaveRecipesAsync(string payloadJson, IDocumentStore store, CancellationToken cancellationToken)
    {
        JsonDocument payloadDocument;
        try
        {
            payloadDocument = JsonDocument.Parse(payloadJson);
        }
        catch
        {
            return Results.BadRequest(new { message = "Invalid recipe payload." });
        }

        using (payloadDocument)
        {
            var recipePayload = UnwrapNestedPayload(payloadDocument.RootElement);
            List<Recipe>? recipes;
            if (recipePayload.ValueKind is JsonValueKind.Object)
            {
                var recipe = recipePayload.Deserialize<Recipe>(SerializerOptions);
                recipes = recipe is null ? null : new List<Recipe> { recipe };
            }
            else if (recipePayload.ValueKind is JsonValueKind.Array)
            {
                recipes = recipePayload.Deserialize<List<Recipe>>(SerializerOptions);
            }
            else
            {
                return Results.BadRequest(new { message = "Recipe payload must be an object or array." });
            }

            if (recipes is null)
            {
                return Results.BadRequest(new { message = "Invalid recipe payload." });
            }

            foreach (var recipe in recipes)
            {
                if (!TryNormalizeRecipe(recipe, out var normalizedRecipe, out var errorMessage))
                {
                    return Results.BadRequest(new { message = errorMessage });
                }

                await store.UpsertAsync(DocumentTypes.Recipe, normalizedRecipe.Id, normalizedRecipe, recordedAt: normalizedRecipe.UpdatedAt, cancellationToken: cancellationToken);
            }

            return Results.Ok(new { imported = recipes.Count });
        }
    }

    private static JsonElement UnwrapNestedPayload(JsonElement root)
    {
        var current = root;
        while (current.ValueKind is JsonValueKind.Object && current.TryGetProperty("payload", out var nested))
        {
            if (nested.ValueKind is not (JsonValueKind.Object or JsonValueKind.Array))
            {
                break;
            }

            current = nested;
        }

        return current;
    }

    private static bool TryNormalizeRecipe(Recipe recipe, out Recipe normalizedRecipe, out string? errorMessage)
    {
        errorMessage = null;

        static List<string> NormalizeList(List<string>? values)
        {
            if (values is null)
            {
                return new List<string>();
            }

            return values
                .Select(item => item.Trim())
                .Where(item => !string.IsNullOrWhiteSpace(item))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
        }

        if (string.IsNullOrWhiteSpace(recipe.Name))
        {
            normalizedRecipe = recipe;
            errorMessage = "Recipe name is required.";
            return false;
        }

        var now = DateTimeOffset.UtcNow;
        var ingredients = NormalizeList(recipe.Ingredients);
        var steps = NormalizeList(recipe.Steps);

        if (ingredients.Count == 0)
        {
            normalizedRecipe = recipe;
            errorMessage = "Recipe ingredients are required.";
            return false;
        }

        if (steps.Count == 0)
        {
            normalizedRecipe = recipe;
            errorMessage = "Recipe steps are required.";
            return false;
        }

        normalizedRecipe = recipe with
        {
            Id = string.IsNullOrWhiteSpace(recipe.Id) ? Guid.NewGuid().ToString("N") : recipe.Id,
            Name = recipe.Name.Trim(),
            Description = string.IsNullOrWhiteSpace(recipe.Description) ? null : recipe.Description.Trim(),
            Ingredients = ingredients,
            Steps = steps,
            Tags = NormalizeList(recipe.Tags),
            CreatedAt = recipe.CreatedAt == default ? now : recipe.CreatedAt,
            UpdatedAt = recipe.UpdatedAt == default ? now : recipe.UpdatedAt
        };

        return true;
    }
}
