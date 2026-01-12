using System.Collections.Concurrent;

namespace VSTestAdapter.Services;

/// <summary>
/// Thread-safe tracker for mapping test names to their TestResult IDs from the TestFarm API.
/// This allows us to remember the TestResultId from registration to use during completion and output upload.
/// </summary>
public sealed class TestResultTracker
{
    private readonly ConcurrentDictionary<string, int> _testResultIds = new();

    /// <summary>
    /// Registers a mapping from a test name to its TestResult ID.
    /// </summary>
    public void RegisterTestResultId(string testName, int testResultId)
    {
        _testResultIds[testName] = testResultId;
        Console.WriteLine($"[TestResultTracker] Registered: {testName} -> TestResultId: {testResultId}");
    }

    /// <summary>
    /// Gets the TestResult ID for a given test name.
    /// Returns null if the test was not registered.
    /// </summary>
    public int? GetTestResultId(string testName)
    {
        if (_testResultIds.TryGetValue(testName, out var testResultId))
        {
            return testResultId;
        }

        Console.WriteLine($"[TestResultTracker] WARNING: TestResultId not found for: {testName}");
        return null;
    }

    /// <summary>
    /// Checks if a test has been registered.
    /// </summary>
    public bool IsRegistered(string testName)
    {
        return _testResultIds.ContainsKey(testName);
    }

    /// <summary>
    /// Gets all registered test names.
    /// </summary>
    public IEnumerable<string> GetAllRegisteredTests()
    {
        return _testResultIds.Keys;
    }

    /// <summary>
    /// Gets the count of registered tests.
    /// </summary>
    public int Count => _testResultIds.Count;
}
