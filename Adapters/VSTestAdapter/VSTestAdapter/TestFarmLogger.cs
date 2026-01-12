using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;
using Microsoft.VisualStudio.TestPlatform.ObjectModel;
using Microsoft.VisualStudio.TestPlatform.ObjectModel.Client;
using Microsoft.VisualStudio.TestPlatform.ObjectModel.Logging;
using VSTestAdapter.Models;
using VSTestAdapter.Services;

namespace VSTestAdapter;

[FriendlyName("TestFarmLogger")]
[ExtensionUri("logger://TestFarmLogger")]
public sealed class TestFarmLogger : ITestLoggerWithParameters
{
    private string? _workDir;
    private bool _hasFailures;
    private TestsRunConfig? _config;
    private TestFarmApiClient? _apiClient;
    private readonly TestResultTracker _resultTracker = new();
    
    private static readonly JsonSerializerSettings JsonSettings = new()
    {
        Formatting = Formatting.Indented,
        ContractResolver = new CamelCasePropertyNamesContractResolver()
    };

    /// <summary>
    /// Gets the path to the tests run configuration file, if provided.
    /// </summary>
    public string? TestsRunConfigPath { get; private set; }

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

            // Process TestsRunConfig parameter
            if (parameters.TryGetValue("TestsRunConfig", out var configPath) && !string.IsNullOrEmpty(configPath))
            {
                Console.WriteLine($"[TestFarmLogger] TestsRunConfig parameter: {configPath}");
                
                if (!File.Exists(configPath))
                {
                    Console.WriteLine($"[TestFarmLogger] ERROR: TestsRunConfig file not found: {configPath}");
                    throw new FileNotFoundException($"TestsRunConfig file not found: {configPath}", configPath);
                }
                
                TestsRunConfigPath = configPath;
                _config = TestsRunConfig.LoadFromFile(configPath);
                _apiClient = new TestFarmApiClient(_config.TestFarmApiBaseUrl);
                
                Console.WriteLine($"[TestFarmLogger] TestsRunConfig loaded: {configPath}");
                Console.WriteLine($"[TestFarmLogger] API Base URL: {_config.TestFarmApiBaseUrl}");
                Console.WriteLine($"[TestFarmLogger] ParentTestResultId: {_config.ParentTestResultId}");
            }
            
            events.DiscoveredTests += OnDiscoveredTests;
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

    private void OnDiscoveredTests(object? sender, DiscoveredTestsEventArgs e)
    {
        try
        {
            var discoveredTests = e.DiscoveredTestCases;
            
            if (discoveredTests == null || !discoveredTests.Any())
            {
                Console.WriteLine("[TestFarmLogger] No tests discovered.");
                return;
            }
            
            Console.WriteLine($"[TestFarmLogger] Discovered {discoveredTests.Count()} tests.");
            
            // Register tests with API if config is available
            if (_apiClient != null && _config != null)
            {
                foreach (var testCase in discoveredTests)
                {
                    var testName = TestNameHelper.GetTestFarmTestName(testCase);
                    Console.WriteLine($"[TestFarmLogger] Registering discovered test: {testName}");
                    
                    // Register asynchronously but wait for completion
                    RegisterTestWithApiAsync(testName).GetAwaiter().GetResult();
                }
                
                Console.WriteLine($"[TestFarmLogger] Finished registering {discoveredTests.Count()} discovered tests.");
            }
            else
            {
                Console.WriteLine("[TestFarmLogger] No API config - skipping test registration during discovery.");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[TestFarmLogger] ERROR during test discovery: {ex}");
        }
    }

    private void OnTestResult(object? sender, TestResultEventArgs e)
    {
        try
        {
            var testResult = e.Result;
            var testCase = testResult.TestCase;
            
            // Track if any test failed
            if (testResult.Outcome == TestOutcome.Failed)
            {
                _hasFailures = true;
            }
            
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
            
            // Step 1: Get test result ID (should have been registered during discovery, but register now as fallback)
            int? testResultId = null;
            if (_apiClient != null && _config != null)
            {
                testResultId = _resultTracker.GetTestResultId(testName);
                
                if (!testResultId.HasValue)
                {
                    // Fallback: register the test now if it wasn't discovered
                    // This can happen if DiscoveredTests event didn't fire or was missed
                    Console.WriteLine($"[TestFarmLogger] Test not found in tracker, registering now: {testName}");
                    testResultId = RegisterTestWithApiAsync(testName).GetAwaiter().GetResult();
                }
            }
            
            // Step 2: Write result file
            var resultFilePath = WriteResultFile(testResult, testDir);
            
            // Step 3: Complete test and upload output via API
            if (_apiClient != null && testResultId.HasValue)
            {
                var status = MapOutcomeToStatus(testResult.Outcome);
                CompleteTestWithApiAsync(testResultId.Value, status, resultFilePath).GetAwaiter().GetResult();
            }
            
            Console.WriteLine($"[TestFarmLogger] Successfully processed: {testName}");
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[TestFarmLogger] ERROR processing test result: {ex}");
        }
    }

    private async Task<int?> RegisterTestWithApiAsync(string testName)
    {
        // Check if already registered (e.g., during discovery phase)
        var existingId = _resultTracker.GetTestResultId(testName);
        if (existingId.HasValue)
        {
            Console.WriteLine($"[TestFarmLogger] Test already registered: {testName} -> TestResultId: {existingId.Value}");
            return existingId.Value;
        }

        try
        {
            var request = new AddChildTestRequest
            {
                ParentTestResultId = _config!.ParentTestResultId,
                Name = testName
            };

            var response = await _apiClient!.AddChildTestToRunAsync(request).ConfigureAwait(false);
            
            if (response?.TestResult != null)
            {
                var testResultId = response.TestResult.Id;
                _resultTracker.RegisterTestResultId(testName, testResultId);
                return testResultId;
            }

            Console.WriteLine($"[TestFarmLogger] WARNING: Failed to register test with API: {testName}");
            return null;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[TestFarmLogger] ERROR registering test with API: {ex}");
            return null;
        }
    }

    private async Task CompleteTestWithApiAsync(int testResultId, string status, string resultFilePath)
    {
        try
        {
            // Complete the test with status
            var completed = await _apiClient!.CompleteChildTestAsync(testResultId, status).ConfigureAwait(false);
            
            if (!completed)
            {
                Console.WriteLine($"[TestFarmLogger] WARNING: Failed to complete test with API. TestResultId: {testResultId}");
            }

            // Upload the result file as output
            if (File.Exists(resultFilePath))
            {
                var uploaded = await _apiClient.UploadOutputAsync(testResultId, resultFilePath).ConfigureAwait(false);
                
                if (!uploaded)
                {
                    Console.WriteLine($"[TestFarmLogger] WARNING: Failed to upload output. TestResultId: {testResultId}");
                }
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[TestFarmLogger] ERROR completing test with API: {ex}");
        }
    }

    private static string MapOutcomeToStatus(TestOutcome outcome)
    {
        return outcome switch
        {
            TestOutcome.Passed => "passed",
            TestOutcome.Failed => "failed",
            TestOutcome.Skipped => "canceled",
            TestOutcome.NotFound => "canceled",
            TestOutcome.None => "canceled",
            _ => "failed"
        };
    }

    private void OnTestRunComplete(object? sender, TestRunCompleteEventArgs e)
    {
        Console.WriteLine($"[TestFarmLogger] Test run completed. IsAborted: {e.IsAborted}, IsCanceled: {e.IsCanceled}");
        
        try
        {
            if (string.IsNullOrEmpty(_workDir))
            {
                Console.WriteLine("[TestFarmLogger] ERROR: Cannot create result file - TF_WORK_DIR is not set.");
                return;
            }

            // Determine overall status - consider aborted/canceled runs as failures
            var overallPassed = !_hasFailures && !e.IsAborted && !e.IsCanceled;
            var resultFilePath = Path.Combine(_workDir, "result.testfarm");
            
            var runResult = new
            {
                OverallStatus = overallPassed ? "Passed" : "Failed",
                HasFailures = _hasFailures,
                IsAborted = e.IsAborted,
                IsCanceled = e.IsCanceled
            };
            
            var json = JsonConvert.SerializeObject(runResult, JsonSettings);
            
            Console.WriteLine($"[TestFarmLogger] Creating result file: {resultFilePath}");
            File.WriteAllText(resultFilePath, json);
            Console.WriteLine($"[TestFarmLogger] Result file created successfully");

            // Dispose API client
            _apiClient?.Dispose();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[TestFarmLogger] ERROR creating result file: {ex}");
        }
    }

    private string WriteResultFile(TestResult testResult, string testDir)
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
        
        Console.WriteLine($"[TestFarmLogger] Wrote result to: {resultPath}");
        
        return resultPath;
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
