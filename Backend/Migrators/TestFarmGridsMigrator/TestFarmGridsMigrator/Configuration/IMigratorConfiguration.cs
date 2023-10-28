using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace TestFarmGridsMigrator.Configuration
{
    public interface IMigratorConfiguration
    {
        string DatabaseConnectionString { get; set; }
        string DatabaseName { get; set; }
    }
}
