using FluentMigrator;
using Microsoft.Data.SqlClient;

using TestFarmGridsMigrator.Configuration;

namespace TestFarmGridsMigrator.Migrations
{
    [Migration(202310281435)]
    public partial class M202310281435_EnsureDatabaseExists : ForwardOnlyMigration
    {
        public M202310281435_EnsureDatabaseExists(IMigratorConfiguration configuration)
        {
            EnsureDatabaseExists(configuration);
        }

        public override void Up()
        {
            // Just ensure that database is created.
        }

        private void EnsureDatabaseExists(IMigratorConfiguration configuration)
        {
            using (var connection = new SqlConnection(configuration.DatabaseConnectionString.Replace("###NAME###", "master")))
            {
                var commandString
                    = $"IF NOT EXISTS (SELECT name FROM master.dbo.sysdatabases WHERE name = N'{configuration.DatabaseName}') "
                    + $"CREATE DATABASE {configuration.DatabaseName}";

                using (var command = new SqlCommand(commandString, connection))
                {
                    connection.Open();
                    _ = command.ExecuteNonQuery();
                }
            }
        }
    }
}
