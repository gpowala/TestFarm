using NUnit.Framework;
using TestFarmTestLogger.Models;

namespace DotnetTestAdapter.UnitTests;

[TestFixture]
public class TestsRunConfigTests
{
    private string _tempDir = null!;

    [SetUp]
    public void SetUp()
    {
        _tempDir = Path.Combine(Path.GetTempPath(), "ConfigTests_" + Guid.NewGuid().ToString("N")[..8]);
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
    public void LoadFromFile_ValidJson_ReturnsConfig()
    {
        var json = @"{
            ""TestFarmApiBaseUrl"": ""https://testfarm.example.com/api"",
            ""ParentTestResultId"": 123
        }";

        var filePath = Path.Combine(_tempDir, "config.json");
        File.WriteAllText(filePath, json);

        var config = TestsRunConfig.LoadFromFile(filePath);

        Assert.That(config.TestFarmApiBaseUrl, Is.EqualTo("https://testfarm.example.com/api"));
        Assert.That(config.ParentTestResultId, Is.EqualTo(123));
    }

    [Test]
    public void LoadFromFile_FileNotFound_Throws()
    {
        Assert.Throws<FileNotFoundException>(() =>
            TestsRunConfig.LoadFromFile(Path.Combine(_tempDir, "nonexistent.json")));
    }
}
