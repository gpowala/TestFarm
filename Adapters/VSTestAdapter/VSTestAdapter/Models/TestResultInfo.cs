namespace VSTestAdapter.Models;

public sealed class TestResultInfo
{
    public required string TestName { get; init; }
    public required string OverallStatus { get; init; }
    public string? OverallMessage { get; init; }
    public string? OverallStackTrace { get; init; }
    public required IEnumerable<AssertionInfo> Assertions { get; init; }
    public string? Duration { get; init; }
    public double? DurationMs { get; init; }
}

public sealed class AssertionInfo
{
    public required string Status { get; init; }
    public string? Message { get; init; }
    public string? StackTrace { get; init; }
}
