using System.Text.Json;
using System.Text.Json.Nodes;
using HealthHq.Shared.Contracts;
using HealthHq.Shared.Infrastructure;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace HealthHq.Modules.Nutrition;

public static class NutritionModule
{
    public static IServiceCollection AddNutritionModule(this IServiceCollection services) => services;

    public static IEndpointRouteBuilder MapNutritionEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/api/nutrition/meal-plans", async (IDocumentStore store, CancellationToken cancellationToken) =>
        {
            var plans = await store.ListAsync<MealPlan>(DocumentTypes.MealPlan, 100, cancellationToken);
            return Results.Ok(plans);
        });

        app.MapPost("/api/nutrition/meal-plans", async (MealPlan plan, IDocumentStore store, CancellationToken cancellationToken) =>
        {
            var payload = plan with { Id = string.IsNullOrWhiteSpace(plan.Id) ? Guid.NewGuid().ToString("N") : plan.Id, CreatedAt = DateTimeOffset.UtcNow };
            await store.UpsertAsync(DocumentTypes.MealPlan, payload.Id, payload, recordedAt: DateTimeOffset.UtcNow, cancellationToken: cancellationToken);
            return Results.Ok(payload);
        });

        app.MapPut("/api/nutrition/meal-plans/{id}", async (string id, MealPlan plan, IDocumentStore store, CancellationToken cancellationToken) =>
        {
            var existing = await store.GetByIdAsync<MealPlan>(DocumentTypes.MealPlan, id, cancellationToken);
            if (existing is null)
            {
                return Results.NotFound(new { message = "Meal plan not found." });
            }

            var payload = plan with
            {
                Id = id,
                CreatedAt = existing.CreatedAt
            };
            await store.UpsertAsync(DocumentTypes.MealPlan, payload.Id, payload, recordedAt: DateTimeOffset.UtcNow, cancellationToken: cancellationToken);
            return Results.Ok(payload);
        });

        app.MapGet("/api/nutrition/recipes", async (IDocumentStore store, CancellationToken cancellationToken) =>
        {
            var recipes = await store.ListAsync<Recipe>(DocumentTypes.Recipe, 500, cancellationToken);
            return Results.Ok(recipes);
        });

        app.MapGet("/api/nutrition/recipes/{id}", async (string id, IDocumentStore store, CancellationToken cancellationToken) =>
        {
            var recipe = await store.GetByIdAsync<Recipe>(DocumentTypes.Recipe, id, cancellationToken);
            return recipe is null ? Results.NotFound() : Results.Ok(recipe);
        });

        app.MapPost("/api/nutrition/recipes", async (Recipe recipe, IDocumentStore store, CancellationToken cancellationToken) =>
        {
            var now = DateTimeOffset.UtcNow;
            var payload = NormalizeRecipe(
                recipe with
                {
                    Id = string.IsNullOrWhiteSpace(recipe.Id) ? Guid.NewGuid().ToString("N") : recipe.Id,
                    CreatedAt = now,
                    UpdatedAt = now
                });

            await store.UpsertAsync(DocumentTypes.Recipe, payload.Id, payload, recordedAt: now, cancellationToken: cancellationToken);
            return Results.Ok(payload);
        });

        app.MapPut("/api/nutrition/recipes/{id}", async (string id, Recipe recipe, IDocumentStore store, CancellationToken cancellationToken) =>
        {
            var existing = await store.GetByIdAsync<Recipe>(DocumentTypes.Recipe, id, cancellationToken);
            if (existing is null)
            {
                return Results.NotFound(new { message = "Recipe not found." });
            }

            var payload = NormalizeRecipe(
                recipe with
                {
                    Id = id,
                    CreatedAt = existing.CreatedAt,
                    UpdatedAt = DateTimeOffset.UtcNow
                });

            await store.UpsertAsync(DocumentTypes.Recipe, payload.Id, payload, recordedAt: DateTimeOffset.UtcNow, cancellationToken: cancellationToken);
            return Results.Ok(payload);
        });

        app.MapDelete("/api/nutrition/recipes/{id}", async (string id, IDocumentStore store, CancellationToken cancellationToken) =>
        {
            var existing = await store.GetByIdAsync<Recipe>(DocumentTypes.Recipe, id, cancellationToken);
            if (existing is null)
            {
                return Results.NotFound(new { message = "Recipe not found." });
            }

            await store.DeleteAsync(DocumentTypes.Recipe, id, cancellationToken);

            var plans = await store.ListAsync<MealPlan>(DocumentTypes.MealPlan, 200, cancellationToken);
            var updatedPlans = 0;
            var clearedSlots = 0;

            foreach (var plan in plans)
            {
                var (updatedPayload, changed, clearedForPlan) = ClearRecipeReferences(plan.PayloadJson, id);
                if (!changed)
                {
                    continue;
                }

                updatedPlans++;
                clearedSlots += clearedForPlan;

                var updatedPlan = plan with { PayloadJson = updatedPayload };
                await store.UpsertAsync(DocumentTypes.MealPlan, updatedPlan.Id, updatedPlan, recordedAt: DateTimeOffset.UtcNow, cancellationToken: cancellationToken);
            }

            return Results.Ok(new { deleted = true, updatedPlans, clearedSlots });
        });

        app.MapGet("/api/nutrition/discounts", async (IDocumentStore store, CancellationToken cancellationToken) =>
        {
            var records = await store.ListAsync<DiscountRecord>(DocumentTypes.Discount, 500, cancellationToken);
            return Results.Ok(records);
        });

        app.MapPost("/api/nutrition/discounts", async (DiscountRecord discount, IDocumentStore store, CancellationToken cancellationToken) =>
        {
            var payload = discount with { Id = string.IsNullOrWhiteSpace(discount.Id) ? Guid.NewGuid().ToString("N") : discount.Id, CreatedAt = DateTimeOffset.UtcNow };
            await store.UpsertAsync(DocumentTypes.Discount, payload.Id, payload, recordedAt: DateTimeOffset.UtcNow, cancellationToken: cancellationToken);
            return Results.Ok(payload);
        });

        return app;
    }

    private static Recipe NormalizeRecipe(Recipe recipe)
    {
        static List<string> NormalizeList(List<string> values) =>
            values.Select(item => item.Trim()).Where(item => !string.IsNullOrWhiteSpace(item)).Distinct(StringComparer.OrdinalIgnoreCase).ToList();

        return recipe with
        {
            Name = recipe.Name.Trim(),
            Description = string.IsNullOrWhiteSpace(recipe.Description) ? null : recipe.Description.Trim(),
            Ingredients = NormalizeList(recipe.Ingredients),
            Steps = NormalizeList(recipe.Steps),
            Tags = NormalizeList(recipe.Tags)
        };
    }

    private static (string PayloadJson, bool Changed, int ClearedSlots) ClearRecipeReferences(string payloadJson, string recipeId)
    {
        JsonNode? root;
        try
        {
            root = JsonNode.Parse(payloadJson);
        }
        catch
        {
            return (payloadJson, false, 0);
        }

        if (root is not JsonObject rootObject || rootObject["days"] is not JsonArray days)
        {
            return (payloadJson, false, 0);
        }

        var changed = false;
        var clearedSlots = 0;

        foreach (var node in days)
        {
            if (node is not JsonObject day)
            {
                continue;
            }

            foreach (var key in new[] { "breakfastRecipeId", "lunchRecipeId", "dinnerRecipeId" })
            {
                if (day[key]?.GetValue<string>() != recipeId)
                {
                    continue;
                }

                day[key] = null;
                changed = true;
                clearedSlots++;
            }
        }

        if (!changed)
        {
            return (payloadJson, false, 0);
        }

        return (rootObject.ToJsonString(), true, clearedSlots);
    }
}
