using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;
using Microsoft.VisualStudio.TestPlatform.ObjectModel;
using Microsoft.VisualStudio.TestPlatform.ObjectModel.Client;
using Microsoft.VisualStudio.TestPlatform.ObjectModel.Logging;
using TestFarmTestLogger.Models;
using TestFarmTestLogger.Services;

namespace TestFarmTestLogger;

[FriendlyName("TestFarmLogger")]
[ExtensionUri("logger://TestFarmLogger")]
public sealed class TestFarmLogger : ITestLoggerWithParameters
{
    private string? _workDir;
    private string? _testType;
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
            if (parameters.TryGetValue("WorkDir", out var workDir))
            {
                _workDir = workDir;
            }

            if (parameters.TryGetValue("Type", out var type))
            {
                _testType = type;
            }

            Console.WriteLine($"[TestFarmLogger] Initializing. WorkDir = '{_workDir}'");
            Console.WriteLine($"[TestFarmLogger] Initializing. Type = '{_testType}'");

            if (string.IsNullOrEmpty(_workDir))
            {
                Console.WriteLine("[TestFarmLogger] ERROR: WorkDir parameter is not set.");
                throw new InvalidOperationException("WorkDir parameter is not set.");
            }

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

            if (_apiClient != null && _config != null)
            {
                foreach (var testCase in discoveredTests)
                {
                    var testName = TestNameHelper.GetTestFarmTestName(testCase);
                    Console.WriteLine($"[TestFarmLogger] Registering discovered test: {testName}");
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

            if (testResult.Outcome == TestOutcome.Failed)
            {
                _hasFailures = true;
            }

            Console.WriteLine($"[TestFarmLogger] FullyQualifiedName: {testCase.FullyQualifiedName}");
            Console.WriteLine($"[TestFarmLogger] DisplayName: {testCase.DisplayName}");

            var testName = TestNameHelper.GetTestFarmTestName(testCase);
            Console.WriteLine($"[TestFarmLogger] TestFarm name: {testName}");
            Console.WriteLine($"[TestFarmLogger] Outcome: {testResult.Outcome}");

            var testDirName = $"TEST.{testName}";
            var testDir = Path.Combine(_workDir!, testDirName);
            Console.WriteLine($"[TestFarmLogger] Test directory: {testDir}");

            // Get test result ID (should have been registered during discovery, register now as fallback)
            int? testResultId = null;
            if (_apiClient != null && _config != null)
            {
                testResultId = _resultTracker.GetTestResultId(testName);

                if (!testResultId.HasValue)
                {
                    Console.WriteLine($"[TestFarmLogger] Test not found in tracker, registering now: {testName}");
                    testResultId = RegisterTestWithApiAsync(testName).GetAwaiter().GetResult();
                }
            }

            // Write result file
            var resultFilePath = WriteResultFile(testResult, testDir, testResult.Outcome);

            // Complete test and upload output via API
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
            var completed = await _apiClient!.CompleteChildTestAsync(testResultId, status).ConfigureAwait(false);

            if (!completed)
            {
                Console.WriteLine($"[TestFarmLogger] WARNING: Failed to complete test with API. TestResultId: {testResultId}");
            }

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
                Console.WriteLine("[TestFarmLogger] ERROR: Cannot create result file - WorkDir is not set.");
                return;
            }

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

            _apiClient?.Dispose();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[TestFarmLogger] ERROR creating result file: {ex}");
        }
    }

    private string WriteResultFile(TestResult testResult, string testDir, TestOutcome outcome)
    {
        Directory.CreateDirectory(testDir);

        var duration = testResult.Duration;

        string? archive = null;
        if (string.Equals(_testType, "playwright", StringComparison.OrdinalIgnoreCase) && outcome == TestOutcome.Failed)
        {
            archive = Path.Combine(testDir, "playwright-trace.zip");
        }

        var resultInfo = new TestResultInfo
        {
            TestName = testResult.TestCase.FullyQualifiedName,
            OverallStatus = testResult.Outcome.ToString(),
            OverallMessage = testResult.ErrorMessage,
            OverallStackTrace = testResult.ErrorStackTrace,
            Assertions = ExtractAssertions(testResult),
            Duration = duration.ToString(@"hh\:mm\:ss\.fff"),
            DurationMs = duration.TotalMilliseconds,
            Archive = archive
        };

        var json = JsonConvert.SerializeObject(resultInfo, JsonSettings);

        var resultOffPath = Path.Combine(testDir, "result.testfarm.off");
        var resultPath = Path.Combine(testDir, "result.testfarm");

        Console.WriteLine($"[TestFarmLogger] Writing to: {resultOffPath}");
        File.WriteAllText(resultOffPath, json);

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
