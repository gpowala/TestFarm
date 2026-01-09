using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;
using Microsoft.VisualStudio.TestPlatform.ObjectModel;
using Microsoft.VisualStudio.TestPlatform.ObjectModel.Client;
using Microsoft.VisualStudio.TestPlatform.ObjectModel.Logging;
using VSTestAdapter.Models;

namespace VSTestAdapter;

[FriendlyName("TestFarmLogger")]
[ExtensionUri("logger://TestFarmLogger")]
public sealed class TestFarmLogger : ITestLoggerWithParameters
{
    private string? _workDir;
    private static readonly JsonSerializerSettings JsonSettings = new()
    {
        Formatting = Formatting.Indented,
        ContractResolver = new CamelCasePropertyNamesContractResolver()
    };

    public void Initialize(TestLoggerEvents events, string testRunDirectory)
    {
        Initialize(events, new Dictionary<string, string?>());
    }

    public void Initialize(TestLoggerEvents events, Dictionary<string, string?> parameters)
    {
        try
        {
            _workDir = Environment.GetEnvironmentVariable("TF_WORK_DIR");
            
            Console.WriteLine($"[TestFarmLogger] Initializing. TF_WORK_DIR = '{_workDir}'");
            
            if (string.IsNullOrEmpty(_workDir))
            {
                Console.WriteLine("[TestFarmLogger] ERROR: TF_WORK_DIR environment variable is not set.");
                throw new InvalidOperationException("TF_WORK_DIR environment variable is not set.");
            }

            // Verify the directory exists or can be created
            if (!Directory.Exists(_workDir))
            {
                Console.WriteLine($"[TestFarmLogger] Creating TF_WORK_DIR: {_workDir}");
                Directory.CreateDirectory(_workDir);
            }

            events.TestResult += OnTestResult;
            events.TestRunComplete += OnTestRunComplete;
            
            Console.WriteLine("[TestFarmLogger] Initialized successfully.");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[TestFarmLogger] ERROR during initialization: {ex}");
            throw;
        }
    }

    private void OnTestResult(object? sender, TestResultEventArgs e)
    {
        try
        {
            var testResult = e.Result;
            var testCase = testResult.TestCase;
            
            // Debug: show raw values
            Console.WriteLine($"[TestFarmLogger] FullyQualifiedName: {testCase.FullyQualifiedName}");
            Console.WriteLine($"[TestFarmLogger] DisplayName: {testCase.DisplayName}");
            
            var testName = TestNameHelper.GetTestFarmTestName(testCase);
            Console.WriteLine($"[TestFarmLogger] TestFarm name: {testName}");
            Console.WriteLine($"[TestFarmLogger] Outcome: {testResult.Outcome}");
            
            // Directory format: TEST.TEST_CLASS_NAME.TEST_NAME or TEST.TEST_CLASS_NAME.TEST_NAME.CRC32
            var testDirName = $"TEST.{testName}";
            var testDir = Path.Combine(_workDir!, testDirName);
            Console.WriteLine($"[TestFarmLogger] Test directory: {testDir}");
            
            // Step 1: Create directory and running.testfarm file
            CreateRunningFile(testDir);
            
            // Step 2: Write result file
            WriteResultFile(testResult, testDir);
            
            Console.WriteLine($"[TestFarmLogger] Successfully processed: {testName}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[TestFarmLogger] ERROR processing test result: {ex}");
        }
    }

    private void OnTestRunComplete(object? sender, TestRunCompleteEventArgs e)
    {
        Console.WriteLine($"[TestFarmLogger] Test run completed. IsAborted: {e.IsAborted}, IsCanceled: {e.IsCanceled}");
    }

    private void CreateRunningFile(string testDir)
    {
        Console.WriteLine($"[TestFarmLogger] Creating directory: {testDir}");
        Directory.CreateDirectory(testDir);
        
        var runningFilePath = Path.Combine(testDir, "running.testfarm");
        Console.WriteLine($"[TestFarmLogger] Creating running file: {runningFilePath}");
        
        File.WriteAllText(runningFilePath, string.Empty);
        Console.WriteLine($"[TestFarmLogger] Created running file successfully");
    }

    private void WriteResultFile(TestResult testResult, string testDir)
    {
        Directory.CreateDirectory(testDir);
        
        var duration = testResult.Duration;
        
        var resultInfo = new TestResultInfo
        {
            TestName = testResult.TestCase.FullyQualifiedName,
            OverallStatus = testResult.Outcome.ToString(),
            OverallMessage = testResult.ErrorMessage,
            OverallStackTrace = testResult.ErrorStackTrace,
            Assertions = ExtractAssertions(testResult),
            Duration = duration.ToString(@"hh\:mm\:ss\.fff"),
            DurationMs = duration.TotalMilliseconds
        };

        var json = JsonConvert.SerializeObject(resultInfo, JsonSettings);
        
        // Write to .off file first, then rename (atomic operation)
        var resultOffPath = Path.Combine(testDir, "result.testfarm.off");
        var resultPath = Path.Combine(testDir, "result.testfarm");
        
        Console.WriteLine($"[TestFarmLogger] Writing to: {resultOffPath}");
        File.WriteAllText(resultOffPath, json);
        
        // Delete existing result file if present
        if (File.Exists(resultPath))
        {
            File.Delete(resultPath);
        }
        
        Console.WriteLine($"[TestFarmLogger] Renaming to: {resultPath}");
        File.Move(resultOffPath, resultPath);
        
        // Remove running file
        var runningFilePath = Path.Combine(testDir, "running.testfarm");
        if (File.Exists(runningFilePath))
        {
            File.Delete(runningFilePath);
        }
        
        Console.WriteLine($"[TestFarmLogger] Wrote result to: {resultPath}");
    }

    private static IEnumerable<AssertionInfo> ExtractAssertions(TestResult testResult)
    {
        var assertions = new List<AssertionInfo>();
        
        foreach (var message in testResult.Messages)
        {
            if (message.Category == TestResultMessage.StandardErrorCategory ||
                message.Category == TestResultMessage.AdditionalInfoCategory)
            {
                assertions.Add(new AssertionInfo
                {
                    Status = testResult.Outcome.ToString(),
                    Message = message.Text,
                    StackTrace = null
                });
            }
        }

        if (!string.IsNullOrEmpty(testResult.ErrorMessage))
        {
            assertions.Add(new AssertionInfo
            {
                Status = testResult.Outcome.ToString(),
                Message = testResult.ErrorMessage,
                StackTrace = testResult.ErrorStackTrace
            });
        }

        return assertions;
    }
}
