using Newtonsoft.Json;
using NUnit.Framework;
using VSTestAdapter.Models;

namespace VSTestAdapter.UnitTests;

[TestFixture]
public class TestsRunConfigTests
{
    private string _testDir = null!;

    [SetUp]
    public void SetUp()
    {
        _testDir = Path.Combine(Path.GetTempPath(), $"TestsRunConfigTests_{Guid.NewGuid():N}");
        Directory.CreateDirectory(_testDir);
    }

    [TearDown]
    public void TearDown()
    {
        if (Directory.Exists(_testDir))
        {
            Directory.Delete(_testDir, recursive: true);
        }
    }

    [Test]
    public void LoadFromFile_WithValidConfig_ReturnsConfig()
    {
        // Arrange
        var configPath = Path.Combine(_testDir, "config.json");
        var config = new
        {
            TestFarmApiBaseUrl = "http://localhost:3000/api",
            ParentTestResultId = 456
        };
        File.WriteAllText(configPath, JsonConvert.SerializeObject(config));

        // Act
        var result = TestsRunConfig.LoadFromFile(configPath);

        // Assert
        Assert.That(result.TestFarmApiBaseUrl, Is.EqualTo("http://localhost:3000/api"));
        Assert.That(result.ParentTestResultId, Is.EqualTo(456));
    }

    [Test]
    public void LoadFromFile_WithNonExistentFile_ThrowsFileNotFoundException()
    {
        // Arrange
        var configPath = Path.Combine(_testDir, "nonexistent.json");

        // Act & Assert
        Assert.Throws<FileNotFoundException>(() => TestsRunConfig.LoadFromFile(configPath));
    }

    [Test]
    public void LoadFromFile_WithEmptyJson_ThrowsInvalidOperationException()
    {
        // Arrange
        var configPath = Path.Combine(_testDir, "empty.json");
        File.WriteAllText(configPath, "null");

        // Act & Assert
        Assert.Throws<InvalidOperationException>(() => TestsRunConfig.LoadFromFile(configPath));
    }

    [Test]
    public void LoadFromFile_WithInvalidJson_ThrowsJsonException()
    {
        // Arrange
        var configPath = Path.Combine(_testDir, "invalid.json");
        File.WriteAllText(configPath, "not valid json {{{");

        // Act & Assert
        Assert.Throws<JsonReaderException>(() => TestsRunConfig.LoadFromFile(configPath));
    }

    [Test]
    public void LoadFromFile_WithDifferentApiUrl_ReturnsCorrectUrl()
    {
        // Arrange
        var configPath = Path.Combine(_testDir, "config.json");
        var config = new
        {
            TestFarmApiBaseUrl = "https://testfarm.example.com/api/v2",
            ParentTestResultId = 888
        };
        File.WriteAllText(configPath, JsonConvert.SerializeObject(config));

        // Act
        var result = TestsRunConfig.LoadFromFile(configPath);

        // Assert
        Assert.That(result.TestFarmApiBaseUrl, Is.EqualTo("https://testfarm.example.com/api/v2"));
        Assert.That(result.ParentTestResultId, Is.EqualTo(888));
    }

    [Test]
    public void LoadFromFile_WithZeroId_ReturnsZeroId()
    {
        // Arrange
        var configPath = Path.Combine(_testDir, "config.json");
        var config = new
        {
            TestFarmApiBaseUrl = "http://localhost/api",
            ParentTestResultId = 0
        };
        File.WriteAllText(configPath, JsonConvert.SerializeObject(config));

        // Act
        var result = TestsRunConfig.LoadFromFile(configPath);

        // Assert
        Assert.That(result.ParentTestResultId, Is.EqualTo(0));
    }

    [Test]
    public void LoadFromFile_WithNegativeId_ReturnsNegativeId()
    {
        // Arrange
        var configPath = Path.Combine(_testDir, "config.json");
        var config = new
        {
            TestFarmApiBaseUrl = "http://localhost/api",
            ParentTestResultId = -100
        };
        File.WriteAllText(configPath, JsonConvert.SerializeObject(config));

        // Act
        var result = TestsRunConfig.LoadFromFile(configPath);

        // Assert
        Assert.That(result.ParentTestResultId, Is.EqualTo(-100));
    }
}
