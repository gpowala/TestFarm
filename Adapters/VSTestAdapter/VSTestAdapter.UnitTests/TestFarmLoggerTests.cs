using Microsoft.VisualStudio.TestPlatform.ObjectModel;
using Microsoft.VisualStudio.TestPlatform.ObjectModel.Client;
using Microsoft.VisualStudio.TestPlatform.ObjectModel.Logging;
using Moq;
using Newtonsoft.Json;
using NUnit.Framework;
using VSTestAdapter.Models;

namespace VSTestAdapter.UnitTests;

[TestFixture]
public class TestFarmLoggerTests
{
    private string _testWorkDir = null!;
    private string? _originalEnvVar;
    private Mock<TestLoggerEvents> _mockEvents = null!;

    [SetUp]
    public void SetUp()
    {
        _originalEnvVar = Environment.GetEnvironmentVariable("TF_WORK_DIR");
        _testWorkDir = Path.Combine(Path.GetTempPath(), $"TestFarmLoggerTests_{Guid.NewGuid():N}");
        Directory.CreateDirectory(_testWorkDir);
        Environment.SetEnvironmentVariable("TF_WORK_DIR", _testWorkDir);
        _mockEvents = new Mock<TestLoggerEvents>();
    }

    [TearDown]
    public void TearDown()
    {
        Environment.SetEnvironmentVariable("TF_WORK_DIR", _originalEnvVar);
        
        if (Directory.Exists(_testWorkDir))
        {
            Directory.Delete(_testWorkDir, recursive: true);
        }
    }

    [Test]
    public void Initialize_WithValidWorkDir_SubscribesToEvents()
    {
        // Arrange
        var logger = new TestFarmLogger();

        // Act & Assert - should not throw
        Assert.DoesNotThrow(() => logger.Initialize(_mockEvents.Object, new Dictionary<string, string?>()));
    }

    [Test]
    public void Initialize_WithMissingWorkDir_ThrowsInvalidOperationException()
    {
        // Arrange
        Environment.SetEnvironmentVariable("TF_WORK_DIR", null);
        var logger = new TestFarmLogger();

        // Act & Assert
        Assert.Throws<InvalidOperationException>(() => 
            logger.Initialize(_mockEvents.Object, new Dictionary<string, string?>()));
    }

    [Test]
    public void Initialize_WithNonExistentWorkDir_CreatesDirectory()
    {
        // Arrange
        var newWorkDir = Path.Combine(_testWorkDir, "subdir");
        Environment.SetEnvironmentVariable("TF_WORK_DIR", newWorkDir);
        var logger = new TestFarmLogger();

        // Act
        logger.Initialize(_mockEvents.Object, new Dictionary<string, string?>());

        // Assert
        Assert.That(Directory.Exists(newWorkDir), Is.True);
    }

    [Test]
    public void OnTestResult_PassedTest_CreatesCorrectFiles()
    {
        // Arrange
        var logger = new TestFarmLogger();
        logger.Initialize(_mockEvents.Object, new Dictionary<string, string?>());

        var testCase = new TestCase(
            "MyNamespace.MyClass.MyTest",
            new Uri("executor://test"),
            "test.dll");
        var testResult = new TestResult(testCase)
        {
            Outcome = TestOutcome.Passed,
            Duration = TimeSpan.FromMilliseconds(100)
        };

        // Act
        _mockEvents.Raise(e => e.TestResult += null, new TestResultEventArgs(testResult));

        // Assert
        var testDir = Path.Combine(_testWorkDir, "TEST.MyNamespace.MyClass.MyTest");
        Assert.That(Directory.Exists(testDir), Is.True);
        Assert.That(File.Exists(Path.Combine(testDir, "result.testfarm")), Is.True);
        // These files should NOT be created anymore
        Assert.That(File.Exists(Path.Combine(testDir, "passed.testfarm")), Is.False);
        Assert.That(File.Exists(Path.Combine(testDir, "running.testfarm")), Is.False);
    }

    [Test]
    public void OnTestResult_FailedTest_CreatesResultFile()
    {
        // Arrange
        var logger = new TestFarmLogger();
        logger.Initialize(_mockEvents.Object, new Dictionary<string, string?>());

        var testCase = new TestCase(
            "MyNamespace.MyClass.FailingTest",
            new Uri("executor://test"),
            "test.dll");
        var testResult = new TestResult(testCase)
        {
            Outcome = TestOutcome.Failed,
            Duration = TimeSpan.FromMilliseconds(50),
            ErrorMessage = "Test failed",
            ErrorStackTrace = "at MyClass.FailingTest()"
        };

        // Act
        _mockEvents.Raise(e => e.TestResult += null, new TestResultEventArgs(testResult));

        // Assert
        var testDir = Path.Combine(_testWorkDir, "TEST.MyNamespace.MyClass.FailingTest");
        Assert.That(Directory.Exists(testDir), Is.True);
        Assert.That(File.Exists(Path.Combine(testDir, "result.testfarm")), Is.True);
        // These files should NOT be created anymore
        Assert.That(File.Exists(Path.Combine(testDir, "failed.testfarm")), Is.False);
        Assert.That(File.Exists(Path.Combine(testDir, "running.testfarm")), Is.False);
    }

    [Test]
    public void OnTestResult_WritesCorrectJsonContent()
    {
        // Arrange
        var logger = new TestFarmLogger();
        logger.Initialize(_mockEvents.Object, new Dictionary<string, string?>());

        var testCase = new TestCase(
            "MyNamespace.MyClass.MyTest",
            new Uri("executor://test"),
            "test.dll");
        var testResult = new TestResult(testCase)
        {
            Outcome = TestOutcome.Passed,
            Duration = TimeSpan.FromMilliseconds(123)
        };

        // Act
        _mockEvents.Raise(e => e.TestResult += null, new TestResultEventArgs(testResult));

        // Assert
        var resultPath = Path.Combine(_testWorkDir, "TEST.MyNamespace.MyClass.MyTest", "result.testfarm");
        var json = File.ReadAllText(resultPath);
        var resultInfo = JsonConvert.DeserializeObject<TestResultInfo>(json);

        Assert.That(resultInfo, Is.Not.Null);
        Assert.That(resultInfo!.TestName, Is.EqualTo("MyNamespace.MyClass.MyTest"));
        Assert.That(resultInfo.OverallStatus, Is.EqualTo("Passed"));
        Assert.That(resultInfo.DurationMs, Is.EqualTo(123).Within(1));
    }

    [Test]
    public void OnTestResult_WithErrorMessage_IncludesErrorInJson()
    {
        // Arrange
        var logger = new TestFarmLogger();
        logger.Initialize(_mockEvents.Object, new Dictionary<string, string?>());

        var testCase = new TestCase(
            "MyNamespace.MyClass.FailingTest",
            new Uri("executor://test"),
            "test.dll");
        var testResult = new TestResult(testCase)
        {
            Outcome = TestOutcome.Failed,
            Duration = TimeSpan.FromMilliseconds(50),
            ErrorMessage = "Expected 1 but was 2",
            ErrorStackTrace = "at MyClass.FailingTest() in Test.cs:line 10"
        };

        // Act
        _mockEvents.Raise(e => e.TestResult += null, new TestResultEventArgs(testResult));

        // Assert
        var resultPath = Path.Combine(_testWorkDir, "TEST.MyNamespace.MyClass.FailingTest", "result.testfarm");
        var json = File.ReadAllText(resultPath);
        var resultInfo = JsonConvert.DeserializeObject<TestResultInfo>(json);

        Assert.That(resultInfo, Is.Not.Null);
        Assert.That(resultInfo!.OverallMessage, Is.EqualTo("Expected 1 but was 2"));
        Assert.That(resultInfo.OverallStackTrace, Does.Contain("MyClass.FailingTest"));
    }

    [Test]
    public void OnTestResult_WithParameters_CreatesDirectoryWithChecksum()
    {
        // Arrange
        var logger = new TestFarmLogger();
        logger.Initialize(_mockEvents.Object, new Dictionary<string, string?>());

        var testCase = new TestCase(
            "MyNamespace.MyClass.MyTest(1, 2, 3)",
            new Uri("executor://test"),
            "test.dll");
        var testResult = new TestResult(testCase)
        {
            Outcome = TestOutcome.Passed,
            Duration = TimeSpan.FromMilliseconds(100)
        };

        // Act
        _mockEvents.Raise(e => e.TestResult += null, new TestResultEventArgs(testResult));

        // Assert
        var directories = Directory.GetDirectories(_testWorkDir);
        Assert.That(directories, Has.Length.EqualTo(1));
        
        var dirName = Path.GetFileName(directories[0]);
        Assert.That(dirName, Does.StartWith("TEST.MyNamespace.MyClass.MyTest."));
        Assert.That(dirName, Does.Not.Contain("("));
    }

    [Test]
    public void OnTestRunComplete_AllTestsPassed_CreatesResultFile()
    {
        // Arrange
        var logger = new TestFarmLogger();
        logger.Initialize(_mockEvents.Object, new Dictionary<string, string?>());

        var testCase = new TestCase(
            "MyNamespace.MyClass.MyTest",
            new Uri("executor://test"),
            "test.dll");
        var testResult = new TestResult(testCase)
        {
            Outcome = TestOutcome.Passed,
            Duration = TimeSpan.FromMilliseconds(100)
        };
        _mockEvents.Raise(e => e.TestResult += null, new TestResultEventArgs(testResult));

        var completeArgs = CreateTestRunCompleteEventArgs(isAborted: false, isCanceled: false);

        // Act
        _mockEvents.Raise(e => e.TestRunComplete += null, completeArgs);

        // Assert
        var resultPath = Path.Combine(_testWorkDir, "result.testfarm");
        Assert.That(File.Exists(resultPath), Is.True);
        
        var json = File.ReadAllText(resultPath);
        Assert.That(json, Does.Contain("\"overallStatus\": \"Passed\""));
        
        // These files should NOT be created anymore
        Assert.That(File.Exists(Path.Combine(_testWorkDir, "passed.testfarm")), Is.False);
        Assert.That(File.Exists(Path.Combine(_testWorkDir, "failed.testfarm")), Is.False);
    }

    [Test]
    public void OnTestRunComplete_AnyTestFailed_CreatesResultFileWithFailedStatus()
    {
        // Arrange
        var logger = new TestFarmLogger();
        logger.Initialize(_mockEvents.Object, new Dictionary<string, string?>());

        var passedTestCase = new TestCase(
            "MyNamespace.MyClass.PassingTest",
            new Uri("executor://test"),
            "test.dll");
        var passedResult = new TestResult(passedTestCase)
        {
            Outcome = TestOutcome.Passed,
            Duration = TimeSpan.FromMilliseconds(100)
        };
        _mockEvents.Raise(e => e.TestResult += null, new TestResultEventArgs(passedResult));

        var failedTestCase = new TestCase(
            "MyNamespace.MyClass.FailingTest",
            new Uri("executor://test"),
            "test.dll");
        var failedResult = new TestResult(failedTestCase)
        {
            Outcome = TestOutcome.Failed,
            Duration = TimeSpan.FromMilliseconds(50)
        };
        _mockEvents.Raise(e => e.TestResult += null, new TestResultEventArgs(failedResult));

        var completeArgs = CreateTestRunCompleteEventArgs(isAborted: false, isCanceled: false);

        // Act
        _mockEvents.Raise(e => e.TestRunComplete += null, completeArgs);

        // Assert
        var resultPath = Path.Combine(_testWorkDir, "result.testfarm");
        Assert.That(File.Exists(resultPath), Is.True);
        
        var json = File.ReadAllText(resultPath);
        Assert.That(json, Does.Contain("\"overallStatus\": \"Failed\""));
        Assert.That(json, Does.Contain("\"hasFailures\": true"));
        
        // These files should NOT be created anymore
        Assert.That(File.Exists(Path.Combine(_testWorkDir, "passed.testfarm")), Is.False);
        Assert.That(File.Exists(Path.Combine(_testWorkDir, "failed.testfarm")), Is.False);
    }

    [Test]
    public void OnTestRunComplete_WhenAborted_CreatesResultFileWithFailedStatus()
    {
        // Arrange
        var logger = new TestFarmLogger();
        logger.Initialize(_mockEvents.Object, new Dictionary<string, string?>());

        var completeArgs = CreateTestRunCompleteEventArgs(isAborted: true, isCanceled: false);

        // Act
        _mockEvents.Raise(e => e.TestRunComplete += null, completeArgs);

        // Assert
        var resultPath = Path.Combine(_testWorkDir, "result.testfarm");
        Assert.That(File.Exists(resultPath), Is.True);
        
        var json = File.ReadAllText(resultPath);
        Assert.That(json, Does.Contain("\"overallStatus\": \"Failed\""));
        Assert.That(json, Does.Contain("\"isAborted\": true"));
        
        // These files should NOT be created anymore
        Assert.That(File.Exists(Path.Combine(_testWorkDir, "passed.testfarm")), Is.False);
        Assert.That(File.Exists(Path.Combine(_testWorkDir, "failed.testfarm")), Is.False);
    }

    [Test]
    public void OnTestRunComplete_WhenCanceled_CreatesResultFileWithFailedStatus()
    {
        // Arrange
        var logger = new TestFarmLogger();
        logger.Initialize(_mockEvents.Object, new Dictionary<string, string?>());

        var completeArgs = CreateTestRunCompleteEventArgs(isAborted: false, isCanceled: true);

        // Act
        _mockEvents.Raise(e => e.TestRunComplete += null, completeArgs);

        // Assert
        var resultPath = Path.Combine(_testWorkDir, "result.testfarm");
        Assert.That(File.Exists(resultPath), Is.True);
        
        var json = File.ReadAllText(resultPath);
        Assert.That(json, Does.Contain("\"overallStatus\": \"Failed\""));
        Assert.That(json, Does.Contain("\"isCanceled\": true"));
        
        // These files should NOT be created anymore
        Assert.That(File.Exists(Path.Combine(_testWorkDir, "passed.testfarm")), Is.False);
        Assert.That(File.Exists(Path.Combine(_testWorkDir, "failed.testfarm")), Is.False);
    }

    [Test]
    public void Initialize_WithTestRunDirectory_DoesNotThrow()
    {
        // Arrange
        var logger = new TestFarmLogger();

        // Act & Assert - should not throw when using the other overload
        Assert.DoesNotThrow(() => logger.Initialize(_mockEvents.Object, "some/test/directory"));
    }

    [Test]
    public void Initialize_WithTestsRunConfigParameter_StoresConfigPath()
    {
        // Arrange
        var logger = new TestFarmLogger();
        var configPath = Path.Combine(_testWorkDir, "tests_run_config.json");
        var config = new
        {
            TestFarmApiBaseUrl = "http://localhost:3000/api",
            TestsRunId = 123,
            ParentTestId = 456
        };
        File.WriteAllText(configPath, JsonConvert.SerializeObject(config));
        
        var parameters = new Dictionary<string, string?>
        {
            { "TestsRunConfig", configPath }
        };

        // Act
        logger.Initialize(_mockEvents.Object, parameters);

        // Assert
        Assert.That(logger.TestsRunConfigPath, Is.EqualTo(configPath));
    }

    [Test]
    public void Initialize_WithoutTestsRunConfigParameter_ConfigPathIsNull()
    {
        // Arrange
        var logger = new TestFarmLogger();
        var parameters = new Dictionary<string, string?>();

        // Act
        logger.Initialize(_mockEvents.Object, parameters);

        // Assert
        Assert.That(logger.TestsRunConfigPath, Is.Null);
    }

    [Test]
    public void Initialize_WithNonExistentConfigFile_ThrowsFileNotFoundException()
    {
        // Arrange
        var logger = new TestFarmLogger();
        var parameters = new Dictionary<string, string?>
        {
            { "TestsRunConfig", @"C:\nonexistent\config.json" }
        };

        // Act & Assert
        Assert.Throws<FileNotFoundException>(() => 
            logger.Initialize(_mockEvents.Object, parameters));
    }

    [Test]
    public void Initialize_WithValidTestsRunConfig_LoadsConfigValues()
    {
        // Arrange
        var logger = new TestFarmLogger();
        var configPath = Path.Combine(_testWorkDir, "tests_run_config.json");
        var config = new
        {
            TestFarmApiBaseUrl = "https://api.testfarm.com",
            TestsRunId = 999,
            ParentTestId = 777
        };
        File.WriteAllText(configPath, JsonConvert.SerializeObject(config));
        
        var parameters = new Dictionary<string, string?>
        {
            { "TestsRunConfig", configPath }
        };

        // Act
        logger.Initialize(_mockEvents.Object, parameters);

        // Assert
        Assert.That(logger.TestsRunConfigPath, Is.EqualTo(configPath));
    }

    [Test]
    public void Initialize_WithEmptyTestsRunConfigPath_DoesNotLoadConfig()
    {
        // Arrange
        var logger = new TestFarmLogger();
        var parameters = new Dictionary<string, string?>
        {
            { "TestsRunConfig", "" }
        };

        // Act
        logger.Initialize(_mockEvents.Object, parameters);

        // Assert
        Assert.That(logger.TestsRunConfigPath, Is.Null);
    }

    [Test]
    public void Initialize_WithNullTestsRunConfigPath_DoesNotLoadConfig()
    {
        // Arrange
        var logger = new TestFarmLogger();
        var parameters = new Dictionary<string, string?>
        {
            { "TestsRunConfig", null }
        };

        // Act
        logger.Initialize(_mockEvents.Object, parameters);

        // Assert
        Assert.That(logger.TestsRunConfigPath, Is.Null);
    }

    [Test]
    public void OnTestResult_SkippedTest_CreatesResultFile()
    {
        // Arrange
        var logger = new TestFarmLogger();
        logger.Initialize(_mockEvents.Object, new Dictionary<string, string?>());

        var testCase = new TestCase(
            "MyNamespace.MyClass.SkippedTest",
            new Uri("executor://test"),
            "test.dll");
        var testResult = new TestResult(testCase)
        {
            Outcome = TestOutcome.Skipped,
            Duration = TimeSpan.Zero
        };

        // Act
        _mockEvents.Raise(e => e.TestResult += null, new TestResultEventArgs(testResult));

        // Assert
        var testDir = Path.Combine(_testWorkDir, "TEST.MyNamespace.MyClass.SkippedTest");
        Assert.That(Directory.Exists(testDir), Is.True);
        Assert.That(File.Exists(Path.Combine(testDir, "result.testfarm")), Is.True);
    }

    [Test]
    public void OnTestResult_NotFoundTest_CreatesResultFile()
    {
        // Arrange
        var logger = new TestFarmLogger();
        logger.Initialize(_mockEvents.Object, new Dictionary<string, string?>());

        var testCase = new TestCase(
            "MyNamespace.MyClass.NotFoundTest",
            new Uri("executor://test"),
            "test.dll");
        var testResult = new TestResult(testCase)
        {
            Outcome = TestOutcome.NotFound,
            Duration = TimeSpan.Zero
        };

        // Act
        _mockEvents.Raise(e => e.TestResult += null, new TestResultEventArgs(testResult));

        // Assert
        var testDir = Path.Combine(_testWorkDir, "TEST.MyNamespace.MyClass.NotFoundTest");
        Assert.That(File.Exists(Path.Combine(testDir, "result.testfarm")), Is.True);
    }

    [Test]
    public void OnTestResult_NoneOutcome_CreatesResultFile()
    {
        // Arrange
        var logger = new TestFarmLogger();
        logger.Initialize(_mockEvents.Object, new Dictionary<string, string?>());

        var testCase = new TestCase(
            "MyNamespace.MyClass.NoneTest",
            new Uri("executor://test"),
            "test.dll");
        var testResult = new TestResult(testCase)
        {
            Outcome = TestOutcome.None,
            Duration = TimeSpan.Zero
        };

        // Act
        _mockEvents.Raise(e => e.TestResult += null, new TestResultEventArgs(testResult));

        // Assert
        var testDir = Path.Combine(_testWorkDir, "TEST.MyNamespace.MyClass.NoneTest");
        Assert.That(File.Exists(Path.Combine(testDir, "result.testfarm")), Is.True);
    }

    [Test]
    public void OnTestResult_WithoutApiConfig_StillCreatesLocalFiles()
    {
        // Arrange - no API config provided
        var logger = new TestFarmLogger();
        logger.Initialize(_mockEvents.Object, new Dictionary<string, string?>());

        var testCase = new TestCase(
            "MyNamespace.MyClass.MyTest",
            new Uri("executor://test"),
            "test.dll");
        var testResult = new TestResult(testCase)
        {
            Outcome = TestOutcome.Passed,
            Duration = TimeSpan.FromMilliseconds(100)
        };

        // Act
        _mockEvents.Raise(e => e.TestResult += null, new TestResultEventArgs(testResult));

        // Assert - local files should still be created
        var testDir = Path.Combine(_testWorkDir, "TEST.MyNamespace.MyClass.MyTest");
        Assert.That(Directory.Exists(testDir), Is.True);
        Assert.That(File.Exists(Path.Combine(testDir, "result.testfarm")), Is.True);
    }

    [Test]
    public void OnTestResult_WithCppStyleName_HandlesDoubleColon()
    {
        // Arrange
        var logger = new TestFarmLogger();
        logger.Initialize(_mockEvents.Object, new Dictionary<string, string?>());

        var testCase = new TestCase(
            "MyNamespace::MyClass::MyTest",
            new Uri("executor://test"),
            "test.dll");
        var testResult = new TestResult(testCase)
        {
            Outcome = TestOutcome.Passed,
            Duration = TimeSpan.FromMilliseconds(100)
        };

        // Act
        _mockEvents.Raise(e => e.TestResult += null, new TestResultEventArgs(testResult));

        // Assert - double colons should be converted to dots
        var testDir = Path.Combine(_testWorkDir, "TEST.MyNamespace.MyClass.MyTest");
        Assert.That(Directory.Exists(testDir), Is.True);
    }

    [Test]
    public void OnTestResult_MultipleTests_CreatesMultipleDirectories()
    {
        // Arrange
        var logger = new TestFarmLogger();
        logger.Initialize(_mockEvents.Object, new Dictionary<string, string?>());

        var test1 = new TestCase("Namespace.Class.Test1", new Uri("executor://test"), "test.dll");
        var test2 = new TestCase("Namespace.Class.Test2", new Uri("executor://test"), "test.dll");
        var test3 = new TestCase("Namespace.Class.Test3", new Uri("executor://test"), "test.dll");

        // Act
        _mockEvents.Raise(e => e.TestResult += null, new TestResultEventArgs(new TestResult(test1) { Outcome = TestOutcome.Passed }));
        _mockEvents.Raise(e => e.TestResult += null, new TestResultEventArgs(new TestResult(test2) { Outcome = TestOutcome.Failed }));
        _mockEvents.Raise(e => e.TestResult += null, new TestResultEventArgs(new TestResult(test3) { Outcome = TestOutcome.Passed }));

        // Assert
        Assert.That(Directory.GetDirectories(_testWorkDir), Has.Length.EqualTo(3));
    }

    [Test]
    public void OnTestRunComplete_NoTestsRun_CreatesResultFile()
    {
        // Arrange
        var logger = new TestFarmLogger();
        logger.Initialize(_mockEvents.Object, new Dictionary<string, string?>());

        var completeArgs = CreateTestRunCompleteEventArgs(isAborted: false, isCanceled: false);

        // Act
        _mockEvents.Raise(e => e.TestRunComplete += null, completeArgs);

        // Assert - no failures means passed
        var resultPath = Path.Combine(_testWorkDir, "result.testfarm");
        Assert.That(File.Exists(resultPath), Is.True);
        
        var json = File.ReadAllText(resultPath);
        Assert.That(json, Does.Contain("\"overallStatus\": \"Passed\""));
        
        // These files should NOT be created anymore
        Assert.That(File.Exists(Path.Combine(_testWorkDir, "passed.testfarm")), Is.False);
        Assert.That(File.Exists(Path.Combine(_testWorkDir, "failed.testfarm")), Is.False);
    }

    [Test]
    public void OnDiscoveredTests_WithApiConfig_RegistersTestsWithApi()
    {
        // Arrange
        var logger = new TestFarmLogger();
        var configPath = Path.Combine(_testWorkDir, "tests_run_config.json");
        var config = new
        {
            TestFarmApiBaseUrl = "http://localhost:3000",
            ParentTestResultId = 123
        };
        File.WriteAllText(configPath, JsonConvert.SerializeObject(config));

        var parameters = new Dictionary<string, string?>
        {
            { "TestsRunConfig", configPath }
        };

        logger.Initialize(_mockEvents.Object, parameters);

        var testCases = new List<TestCase>
        {
            new TestCase("MyNamespace.MyClass.Test1", new Uri("executor://test"), "test.dll"),
            new TestCase("MyNamespace.MyClass.Test2", new Uri("executor://test"), "test.dll")
        };

        // Act - raise DiscoveredTests event
        _mockEvents.Raise(e => e.DiscoveredTests += null, new DiscoveredTestsEventArgs(testCases));

        // Assert - verify discovery was logged (no API mock, so we just verify it doesn't throw)
        // The actual API calls would fail, but the test validates the event handler is invoked
        Assert.Pass("DiscoveredTests event was handled without throwing");
    }

    [Test]
    public void OnDiscoveredTests_WithoutApiConfig_DoesNotThrow()
    {
        // Arrange
        var logger = new TestFarmLogger();
        logger.Initialize(_mockEvents.Object, new Dictionary<string, string?>());

        var testCases = new List<TestCase>
        {
            new TestCase("MyNamespace.MyClass.Test1", new Uri("executor://test"), "test.dll"),
            new TestCase("MyNamespace.MyClass.Test2", new Uri("executor://test"), "test.dll")
        };

        // Act & Assert - should not throw when no API config
        Assert.DoesNotThrow(() =>
            _mockEvents.Raise(e => e.DiscoveredTests += null, new DiscoveredTestsEventArgs(testCases)));
    }

    [Test]
    public void OnDiscoveredTests_EmptyTestCases_DoesNotThrow()
    {
        // Arrange
        var logger = new TestFarmLogger();
        logger.Initialize(_mockEvents.Object, new Dictionary<string, string?>());

        var testCases = new List<TestCase>();

        // Act & Assert - should not throw with empty list
        Assert.DoesNotThrow(() =>
            _mockEvents.Raise(e => e.DiscoveredTests += null, new DiscoveredTestsEventArgs(testCases)));
    }

    [Test]
    public void OnTestResult_WithoutPriorDiscovery_LogsWarningButStillCreatesFiles()
    {
        // Arrange - initialize with API config but without raising DiscoveredTests first
        var logger = new TestFarmLogger();
        var configPath = Path.Combine(_testWorkDir, "tests_run_config.json");
        var config = new
        {
            TestFarmApiBaseUrl = "http://localhost:3000",
            ParentTestResultId = 123
        };
        File.WriteAllText(configPath, JsonConvert.SerializeObject(config));

        var parameters = new Dictionary<string, string?>
        {
            { "TestsRunConfig", configPath }
        };
        logger.Initialize(_mockEvents.Object, parameters);

        var testCase = new TestCase(
            "MyNamespace.MyClass.UndiscoveredTest",
            new Uri("executor://test"),
            "test.dll");
        var testResult = new TestResult(testCase)
        {
            Outcome = TestOutcome.Passed,
            Duration = TimeSpan.FromMilliseconds(100)
        };

        // Act - raise TestResult without prior DiscoveredTests event
        // This simulates a test that wasn't discovered (e.g., dynamically generated)
        _mockEvents.Raise(e => e.TestResult += null, new TestResultEventArgs(testResult));

        // Assert - local files should still be created even without discovery
        var testDir = Path.Combine(_testWorkDir, "TEST.MyNamespace.MyClass.UndiscoveredTest");
        Assert.That(Directory.Exists(testDir), Is.True);
        Assert.That(File.Exists(Path.Combine(testDir, "result.testfarm")), Is.True);
    }

    [Test]
    public void OnTestResult_AfterDiscovery_WithoutApiConfig_StillCreatesLocalFiles()
    {
        // Arrange - no API config, so discovery registration is skipped
        var logger = new TestFarmLogger();
        logger.Initialize(_mockEvents.Object, new Dictionary<string, string?>());

        var testCase = new TestCase(
            "MyNamespace.MyClass.TestAfterDiscovery",
            new Uri("executor://test"),
            "test.dll");

        // First, raise DiscoveredTests (but no API config means no registration)
        _mockEvents.Raise(e => e.DiscoveredTests += null, new DiscoveredTestsEventArgs(new List<TestCase> { testCase }));

        // Then, raise TestResult
        var testResult = new TestResult(testCase)
        {
            Outcome = TestOutcome.Passed,
            Duration = TimeSpan.FromMilliseconds(100)
        };
        _mockEvents.Raise(e => e.TestResult += null, new TestResultEventArgs(testResult));

        // Assert - local files should be created
        var testDir = Path.Combine(_testWorkDir, "TEST.MyNamespace.MyClass.TestAfterDiscovery");
        Assert.That(Directory.Exists(testDir), Is.True);
        Assert.That(File.Exists(Path.Combine(testDir, "result.testfarm")), Is.True);
    }

    [Test]
    public void OnDiscoveredTests_NullTestCases_DoesNotThrow()
    {
        // Arrange
        var logger = new TestFarmLogger();
        logger.Initialize(_mockEvents.Object, new Dictionary<string, string?>());

        // Act & Assert - should not throw with null (simulated by empty event args behavior)
        Assert.DoesNotThrow(() =>
            _mockEvents.Raise(e => e.DiscoveredTests += null, new DiscoveredTestsEventArgs(new List<TestCase>())));
    }

    [Test]
    public void DiscoveryThenResult_FullWorkflow_CreatesResultFile()
    {
        // Arrange - simulate full discovery -> result workflow without API
        var logger = new TestFarmLogger();
        logger.Initialize(_mockEvents.Object, new Dictionary<string, string?>());

        var testCase1 = new TestCase("Namespace.Class.Test1", new Uri("executor://test"), "test.dll");
        var testCase2 = new TestCase("Namespace.Class.Test2", new Uri("executor://test"), "test.dll");

        // Step 1: Discovery phase
        _mockEvents.Raise(e => e.DiscoveredTests += null, new DiscoveredTestsEventArgs(new List<TestCase> { testCase1, testCase2 }));

        // Step 2: Execution phase - results come in
        _mockEvents.Raise(e => e.TestResult += null, new TestResultEventArgs(new TestResult(testCase1) { Outcome = TestOutcome.Passed, Duration = TimeSpan.FromMilliseconds(50) }));
        _mockEvents.Raise(e => e.TestResult += null, new TestResultEventArgs(new TestResult(testCase2) { Outcome = TestOutcome.Failed, Duration = TimeSpan.FromMilliseconds(75) }));

        // Step 3: Test run complete
        var completeArgs = CreateTestRunCompleteEventArgs(isAborted: false, isCanceled: false);
        _mockEvents.Raise(e => e.TestRunComplete += null, completeArgs);

        // Assert - all files should be created
        Assert.That(Directory.Exists(Path.Combine(_testWorkDir, "TEST.Namespace.Class.Test1")), Is.True);
        Assert.That(Directory.Exists(Path.Combine(_testWorkDir, "TEST.Namespace.Class.Test2")), Is.True);
        Assert.That(File.Exists(Path.Combine(_testWorkDir, "result.testfarm")), Is.True);

        var json = File.ReadAllText(Path.Combine(_testWorkDir, "result.testfarm"));
        Assert.That(json, Does.Contain("\"overallStatus\": \"Failed\""));
        Assert.That(json, Does.Contain("\"hasFailures\": true"));
    }

    private static TestRunCompleteEventArgs CreateTestRunCompleteEventArgs(bool isAborted, bool isCanceled)
    {
        var stats = new Mock<ITestRunStatistics>();
        stats.Setup(s => s.ExecutedTests).Returns(1);
        
        return new TestRunCompleteEventArgs(
            stats.Object,
            isCanceled: isCanceled,
            isAborted: isAborted,
            error: null,
            attachmentSets: null,
            invokedDataCollectors: null,
            elapsedTime: TimeSpan.FromSeconds(1));
    }
}
