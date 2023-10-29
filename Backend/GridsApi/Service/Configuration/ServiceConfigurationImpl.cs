using System.Diagnostics;
using System.Reflection;

namespace Service.Configuration
{
    public class ServiceConfigurationImpl : ServiceConfiguration
    {
        public string DatabaseConnectionString { get; set; }
        public string DatabaseName { get; set; }

        public ServiceConfigurationImpl()
        {
            var assembly = Assembly.GetEntryAssembly();
            if (assembly == null)
            {
                throw new ArgumentNullException(nameof(assembly), "Failed to load configuration.");
            }

            var path = Path.GetDirectoryName(assembly.Location);
            if (path == null)
            {
                throw new ArgumentNullException(nameof(path), "Failed to load configuration.");
            }

            var settingsFilename = "appsettings.json";

            var configRoot = new ConfigurationBuilder()
                .SetBasePath(path)
                .AddJsonFile(settingsFilename, true, true)
                .Build();

            configRoot.Bind(this);

            Debug.Assert(!string.IsNullOrEmpty(DatabaseConnectionString));
            Debug.Assert(!string.IsNullOrEmpty(DatabaseName));
        }
    }
}
