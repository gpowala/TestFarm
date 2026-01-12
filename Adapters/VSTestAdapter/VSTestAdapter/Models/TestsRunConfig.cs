using Newtonsoft.Json;

namespace VSTestAdapter.Models;

/// <summary>
/// Configuration for connecting to the TestFarm API.
/// Loaded from the JSON file specified in the TestsRunConfig parameter.
/// </summary>
public sealed class TestsRunConfig
{
    /// <summary>
    /// Base URL for the TestFarm API (e.g., "https://testfarm.example.com/api").
    /// </summary>
    [JsonProperty("TestFarmApiBaseUrl")]
    public required string TestFarmApiBaseUrl { get; init; }

    /// <summary>
    /// The ID of the parent test result to which child tests will be added.
    /// </summary>
    [JsonProperty("ParentTestResultId")]
    public required int ParentTestResultId { get; init; }

    /// <summary>
    /// Loads the configuration from a JSON file.
    /// </summary>
    public static TestsRunConfig LoadFromFile(string filePath)
    {
        var json = File.ReadAllText(filePath);
        var config = JsonConvert.DeserializeObject<TestsRunConfig>(json);
        
        if (config == null)
        {
            throw new InvalidOperationException($"Failed to deserialize TestsRunConfig from: {filePath}");
        }

        return config;
    }
}
