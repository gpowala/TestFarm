using Microsoft.VisualStudio.TestPlatform.ObjectModel;
using Microsoft.VisualStudio.TestPlatform.ObjectModel.Adapter;
using Microsoft.VisualStudio.TestPlatform.ObjectModel.Logging;

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
    }
}
