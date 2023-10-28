using FluentMigrator.Runner;
using Microsoft.Extensions.DependencyInjection;
using System.Reflection;

using TestFarmGridsMigrator.Configuration;

Console.WriteLine("Upgrade TestFarmGrids database.");

var configuration = new MigratorConfiguration();

var serviceProvider = new ServiceCollection()
    .AddFluentMigratorCore()
    .ConfigureRunner(runnerBuilder =>
    {
        var connectionString = configuration.DatabaseConnectionString.Replace("###NAME###", configuration.DatabaseName);
        runnerBuilder
            .AddSqlServer2016()
            .WithGlobalConnectionString(connectionString)
            .ScanIn(Assembly.GetEntryAssembly()).For.Migrations();
    })
    .AddLogging(loggingBuilder =>
    {
        loggingBuilder.AddFluentMigratorConsole();
    })
    .AddSingleton<IMigratorConfiguration, MigratorConfiguration>(services =>
    {
        return configuration;
    })
    .BuildServiceProvider(false);

serviceProvider.GetRequiredService<IMigrationRunner>().MigrateUp();

Console.WriteLine("TestFarmGrids database upgrade finished.");
