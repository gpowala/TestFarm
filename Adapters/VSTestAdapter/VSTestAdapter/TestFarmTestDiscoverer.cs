using Microsoft.VisualStudio.TestPlatform.ObjectModel;
using Microsoft.VisualStudio.TestPlatform.ObjectModel.Adapter;
using Microsoft.VisualStudio.TestPlatform.ObjectModel.Logging;
using VSTestAdapter.Models;
using VSTestAdapter.Services;
using System.Xml;

namespace VSTestAdapter;

[FileExtension(".dll")]
[FileExtension(".exe")]
[DefaultExecutorUri("executor://TestFarmExecutor")]
public sealed class TestFarmTestDiscoverer : ITestDiscoverer
{
    public void DiscoverTests(
        IEnumerable<string> sources,
        IDiscoveryContext discoveryContext,
        IMessageLogger logger,
        ITestCaseDiscoverySink discoverySink)
    {
        // This discoverer outputs test names in TestFarm format, the actual test discovery is handled by the underlying framework adapters, we just format the output

        logger.SendMessage(TestMessageLevel.Informational, "[TestFarmDiscoverer] Discovery started");

        foreach (var source in sources)
        {
            logger.SendMessage(TestMessageLevel.Informational, $"[TestFarmDiscoverer] Source: {source}");
        }

        // Try to get TestsRunConfig from runsettings to register tests during discovery
        var configPath = ExtractTestsRunConfigPath(discoveryContext.RunSettings?.SettingsXml);

        if (!string.IsNullOrEmpty(configPath) && File.Exists(configPath))
        {
            logger.SendMessage(TestMessageLevel.Informational, $"[TestFarmDiscoverer] Found TestsRunConfig: {configPath}");

            try
            {
                var config = TestsRunConfig.LoadFromFile(configPath);
                logger.SendMessage(TestMessageLevel.Informational, $"[TestFarmDiscoverer] API Base URL: {config.TestFarmApiBaseUrl}");
                logger.SendMessage(TestMessageLevel.Informational, $"[TestFarmDiscoverer] ParentTestResultId: {config.ParentTestResultId}");

                // Note: We cannot register tests here because the discoverer doesn't receive the discovered tests
                // The actual test discovery is done by the underlying framework adapters (NUnit, xUnit, MSTest, etc.)
                // Registration will happen in the TestFarmLogger when tests are executed
            }
            catch (Exception ex)
            {
                logger.SendMessage(TestMessageLevel.Warning, $"[TestFarmDiscoverer] Failed to load TestsRunConfig: {ex.Message}");
            }
        }
        else
        {
            logger.SendMessage(TestMessageLevel.Informational, "[TestFarmDiscoverer] No TestsRunConfig found in runsettings");
        }
    }

    private static string? ExtractTestsRunConfigPath(string? settingsXml)
    {
        if (string.IsNullOrEmpty(settingsXml))
        {
            return null;
        }

        try
        {
            var doc = new XmlDocument();
            doc.LoadXml(settingsXml);

            // Look for TestFarmLogger parameters in the runsettings
            // Expected format:
            // <RunSettings>
            //   <LoggerRunSettings>
            //     <Loggers>
            //       <Logger friendlyName="TestFarmLogger">
            //         <Configuration>
            //           <TestsRunConfig>path/to/config.json</TestsRunConfig>
            //         </Configuration>
            //       </Logger>
            //     </Loggers>
            //   </LoggerRunSettings>
            // </RunSettings>

            var configNode = doc.SelectSingleNode("//Logger[@friendlyName='TestFarmLogger']/Configuration/TestsRunConfig");
            if (configNode != null)
            {
                return configNode.InnerText;
            }

            // Also try TestRunParameters
            // <RunSettings>
            //   <TestRunParameters>
            //     <Parameter name="TestsRunConfig" value="path/to/config.json" />
            //   </TestRunParameters>
            // </RunSettings>
            var paramNode = doc.SelectSingleNode("//TestRunParameters/Parameter[@name='TestsRunConfig']/@value");
            if (paramNode != null)
            {
                return paramNode.Value;
            }

            return null;
        }
        catch
        {
            return null;
        }
    }
}
