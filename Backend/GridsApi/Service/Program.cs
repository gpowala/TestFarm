using Microsoft.AspNetCore.Mvc;

using Service.Configuration;
using Service.DatabaseModels;
using Service.Repositories;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton<ServiceConfiguration, ServiceConfigurationImpl>();
builder.Services.AddScoped<Context, ContextImpl>();
builder.Services.AddScoped<Repository<Service.DatabaseModels.Grid>, Service.Repositories.Grids>();
builder.Services.AddScoped<Repository<Service.DatabaseModels.Host>, Service.Repositories.Hosts>();

var app = builder.Build();

app.MapPost("/AddHostToGrid", async ([FromBody] string hostName, [FromBody] string hostType, [FromBody] string hostDetailsJson, [FromBody] string gridName, Repository<Service.DatabaseModels.Grid> grids, Repository<Service.DatabaseModels.Host> hosts) =>
{
    try
    {
        var gridId = await grids.AddAsync(new Service.DatabaseModels.Grid
        {
            Name = gridName,
            CreationTimestamp = DateTime.Now,
            LastUpdateTimestamp = DateTime.Now
        });

        var hostId = await hosts.AddAsync(new Service.DatabaseModels.Host
        {
            Name = hostName,
            Type = hostType,
            Status = "running",

            HostDetailsJson = hostDetailsJson,

            CreationTimestamp = DateTime.UtcNow,
            LastUpdateTimestamp = DateTime.UtcNow,

            GridId = gridId
        });

        return Results.Json(new { GridId = gridId, GridName = gridName, HostId = hostId, HostName = hostName, HostType = hostType });
    }
    catch (Exception ex)
    {
        return Results.BadRequest($"Failed to add host {hostName} to grid {gridName} with error: {ex.Message}");
    }
});

app.Run();
