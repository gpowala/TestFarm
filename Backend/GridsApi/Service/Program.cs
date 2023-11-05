using Microsoft.Data.SqlClient;
using Service.Configuration;
using Service.DatabaseModels;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton<ServiceConfiguration, ServiceConfigurationImpl>();
builder.Services.AddScoped<Context, ContextImpl>();

var app = builder.Build();

app.MapGet("/AddHostToGrid?host_name={hostName}&&grid_name={gridName}", async (string hostName, string gridName, Context context) =>
{
    try
    {
        if (!context.Grids.Any(g => g.Name == gridName))
        {
            context.Grids.Add(new Grid
            {
                Name = gridName,
                Status = "Running",
                CreationTimestamp = DateTime.Now,
                LastUpdateTimestamp = DateTime.Now
            });
            await context.SaveChangesAsync();
        }
    }
    catch (SqlException ex)
    {
        const int violationOfUniqueConstraint = 2601;
        if (ex.Number == violationOfUniqueConstraint)
        {

        }
    }

    context.Hosts.Add(new Host
    {
    });
});

app.Run();
