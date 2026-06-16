using HealthHq.Modules.BodyMetrics;
using HealthHq.Modules.Dashboard;
using HealthHq.Modules.Imports;
using HealthHq.Modules.Ingestion;
using HealthHq.Modules.Nutrition;
using HealthHq.Modules.Shopping;
using HealthHq.Modules.Training;
using HealthHq.Modules.Vitality;
using HealthHq.Shared.Infrastructure;
using Microsoft.AspNetCore.DataProtection;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<DataOptions>(builder.Configuration.GetSection(DataOptions.SectionName));
builder.Services.Configure<StravaOptions>(builder.Configuration.GetSection(StravaOptions.SectionName));
builder.Services.Configure<GarminOptions>(builder.Configuration.GetSection(GarminOptions.SectionName));

var dataOptions = builder.Configuration.GetSection(DataOptions.SectionName).Get<DataOptions>() ?? new DataOptions();
var dataDirectory = Path.GetFullPath(dataOptions.DataDirectory);
Directory.CreateDirectory(dataDirectory);
var keyDirectory = Path.Combine(dataDirectory, dataOptions.KeyDirectoryName);
Directory.CreateDirectory(keyDirectory);
builder.Services
    .AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo(keyDirectory));

builder.Services.AddHttpClient();
builder.Services.AddSingleton<SqliteDocumentStore>();
builder.Services.AddSingleton<IDocumentStore>(sp => sp.GetRequiredService<SqliteDocumentStore>());

builder.Services
    .AddIngestionModule()
    .AddTrainingModule()
    .AddNutritionModule()
    .AddShoppingModule()
    .AddVitalityModule()
    .AddBodyMetricsModule()
    .AddImportsModule()
    .AddDashboardModule();

builder.Services.AddEndpointsApiExplorer();

var app = builder.Build();

var store = app.Services.GetRequiredService<SqliteDocumentStore>();
await store.InitializeAsync();
await HealthHq.App.Host.DemoDataSeeder.SeedAsync(app.Services);

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapGet("/api/health", () => Results.Ok(new { status = "ok" }));

app.MapIngestionEndpoints();
app.MapTrainingEndpoints();
app.MapNutritionEndpoints();
app.MapShoppingEndpoints();
app.MapVitalityEndpoints();
app.MapBodyMetricsEndpoints();
app.MapImportsEndpoints();
app.MapDashboardEndpoints();

app.MapFallbackToFile("index.html");

app.Run();
