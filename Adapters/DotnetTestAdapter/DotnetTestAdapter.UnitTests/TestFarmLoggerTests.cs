using NUnit.Framework;
using Moq;
using Microsoft.VisualStudio.TestPlatform.ObjectModel;
using Microsoft.VisualStudio.TestPlatform.ObjectModel.Client;
using Microsoft.VisualStudio.TestPlatform.ObjectModel.Logging;
using TestFarmTestLogger;

namespace DotnetTestAdapter.UnitTests;

[TestFixture]
public class TestFarmLoggerTests
{
    private string _tempDir = null!;

    [SetUp]
    public void SetUp()
    {
        _tempDir = Path.Combine(Path.GetTempPath(), "LoggerTests_" + Guid.NewGuid().ToString("N")[..8]);
        Directory.CreateDirectory(_tempDir);
    }

    [TearDown]
    public void TearDown()
    {
        if (Directory.Exists(_tempDir))
        {
            Directory.Delete(_tempDir, true);
        }
    }

    [Test]
    public void Initialize_WithValidWorkDir_Succeeds()
    {
        var originalWorkDir = Environment.GetEnvironmentVariable("TF_WORK_DIR");
        try
        {
            Environment.SetEnvironmentVariable("TF_WORK_DIR", _tempDir);

            var logger = new TestFarmLogger();
            var events = new Mock<TestLoggerEvents>();
            var parameters = new Dictionary<string, string?>();

            logger.Initialize(events.Object, parameters);

            // Should not throw
            Assert.Pass();
        }
        finally
        {
            Environment.SetEnvironmentVariable("TF_WORK_DIR", originalWorkDir);
        }
    }

    [Test]
    public void Initialize_WithoutWorkDir_Throws()
    {
        var originalWorkDir = Environment.GetEnvironmentVariable("TF_WORK_DIR");
        try
        {
            Environment.SetEnvironmentVariable("TF_WORK_DIR", null);

            var logger = new TestFarmLogger();
            var events = new Mock<TestLoggerEvents>();
            var parameters = new Dictionary<string, string?>();

            Assert.Throws<InvalidOperationException>(() =>
                logger.Initialize(events.Object, parameters));
        }
        finally
        {
            Environment.SetEnvironmentVariable("TF_WORK_DIR", originalWorkDir);
        }
    }

    [Test]
    public void Initialize_WithTestsRunConfig_LoadsConfig()
    {
        var originalWorkDir = Environment.GetEnvironmentVariable("TF_WORK_DIR");
        try
        {
            Environment.SetEnvironmentVariable("TF_WORK_DIR", _tempDir);

            var configPath = Path.Combine(_tempDir, "config.json");
            File.WriteAllText(configPath, @"{
                ""TestFarmApiBaseUrl"": ""https://testfarm.example.com/api"",
                ""ParentTestResultId"": 123
            }");

            var logger = new TestFarmLogger();
            var events = new Mock<TestLoggerEvents>();
            var parameters = new Dictionary<string, string?>
            {
                { "TestsRunConfig", configPath }
            };

            logger.Initialize(events.Object, parameters);

            Assert.That(logger.TestsRunConfigPath, Is.EqualTo(configPath));
        }
        finally
        {
            Environment.SetEnvironmentVariable("TF_WORK_DIR", originalWorkDir);
        }
    }

    [Test]
    public void Initialize_WithMissingConfigFile_Throws()
    {
        var originalWorkDir = Environment.GetEnvironmentVariable("TF_WORK_DIR");
        try
        {
            Environment.SetEnvironmentVariable("TF_WORK_DIR", _tempDir);

            var logger = new TestFarmLogger();
            var events = new Mock<TestLoggerEvents>();
            var parameters = new Dictionary<string, string?>
            {
                { "TestsRunConfig", Path.Combine(_tempDir, "nonexistent.json") }
            };

            Assert.Throws<FileNotFoundException>(() =>
                logger.Initialize(events.Object, parameters));
        }
        finally
        {
            Environment.SetEnvironmentVariable("TF_WORK_DIR", originalWorkDir);
        }
    }
}
