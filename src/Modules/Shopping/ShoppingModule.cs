using System.Text.Json;
using HealthHq.Shared.Contracts;
using HealthHq.Shared.Infrastructure;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace HealthHq.Modules.Shopping;

public sealed record ShoppingListRequest(string Name, List<string> Ingredients);

public static class ShoppingModule
{
    public static IServiceCollection AddShoppingModule(this IServiceCollection services) => services;

    public static IEndpointRouteBuilder MapShoppingEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/api/shopping/generate", async (ShoppingListRequest request, IDocumentStore store, CancellationToken cancellationToken) =>
        {
            var discounts = await store.ListAsync<DiscountRecord>(DocumentTypes.Discount, 500, cancellationToken);
            var activeDiscounts = discounts.Where(x => x.ValidFrom <= DateOnly.FromDateTime(DateTime.UtcNow) && x.ValidTo >= DateOnly.FromDateTime(DateTime.UtcNow)).ToList();

            var lines = request.Ingredients.Select(ingredient =>
            {
                var match = activeDiscounts.FirstOrDefault(d => d.ItemName.Contains(ingredient, StringComparison.OrdinalIgnoreCase));
                if (match is null)
                {
                    return new { ingredient, store = "n/a", discounted = false, price = 0m, savings = 0m };
                }

                var savings = Math.Max(0, match.OriginalPrice - match.DiscountedPrice);
                return new { ingredient, store = match.StoreName, discounted = true, price = match.DiscountedPrice, savings };
            }).ToList();

            var estimatedTotal = lines.Sum(x => x.price);
            var estimatedSavings = lines.Sum(x => x.savings);
            var payloadJson = JsonSerializer.Serialize(lines);

            var list = new ShoppingList(
                Id: Guid.NewGuid().ToString("N"),
                Name: request.Name,
                PayloadJson: payloadJson,
                EstimatedTotal: estimatedTotal,
                EstimatedSavings: estimatedSavings,
                CreatedAt: DateTimeOffset.UtcNow
            );

            await store.UpsertAsync(DocumentTypes.ShoppingList, list.Id, list, recordedAt: list.CreatedAt, cancellationToken: cancellationToken);
            return Results.Ok(list);
        });

        app.MapGet("/api/shopping/lists", async (IDocumentStore store, CancellationToken cancellationToken) =>
        {
            var lists = await store.ListAsync<ShoppingList>(DocumentTypes.ShoppingList, 100, cancellationToken);
            return Results.Ok(lists);
        });

        return app;
    }
}
