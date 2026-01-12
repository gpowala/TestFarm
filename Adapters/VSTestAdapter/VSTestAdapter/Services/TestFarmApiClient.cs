using System.Net.Http;
using Newtonsoft.Json;
using Newtonsoft.Json.Serialization;

namespace VSTestAdapter.Services;

/// <summary>
/// Response from the add-child-test-to-run API endpoint.
/// </summary>
public sealed class AddChildTestResponse
{
    [JsonProperty("Test")]
    public TestInfo? Test { get; set; }

    [JsonProperty("TestResult")]
    public TestResultApiInfo? TestResult { get; set; }
}

public sealed class TestInfo
{
    [JsonProperty("Id")]
    public int Id { get; set; }

    [JsonProperty("Name")]
    public string? Name { get; set; }
}

public sealed class TestResultApiInfo
{
    [JsonProperty("Id")]
    public int Id { get; set; }

    [JsonProperty("Status")]
    public string? Status { get; set; }
}

/// <summary>
/// Request body for adding a child test to a test run.
/// </summary>
public sealed class AddChildTestRequest
{
    [JsonProperty("ParentTestResultId")]
    public int ParentTestResultId { get; set; }

    [JsonProperty("Name")]
    public string? Name { get; set; }
}

/// <summary>
/// Request body for completing a child test.
/// </summary>
public sealed class CompleteChildTestRequest
{
    [JsonProperty("TestResultId")]
    public int TestResultId { get; set; }

    [JsonProperty("Status")]
    public string? Status { get; set; }
}

/// <summary>
/// Client for communicating with the TestFarm API.
/// </summary>
public sealed class TestFarmApiClient : IDisposable
{
    private readonly HttpClient _httpClient;
    private readonly string _baseUrl;
    private static readonly JsonSerializerSettings JsonSettings = new()
    {
        ContractResolver = new CamelCasePropertyNamesContractResolver()
    };

    public TestFarmApiClient(string baseUrl)
        : this(baseUrl, new HttpClientHandler())
    {
    }

    /// <summary>
    /// Constructor for testing with custom HttpMessageHandler.
    /// </summary>
    internal TestFarmApiClient(string baseUrl, HttpMessageHandler handler)
    {
        _baseUrl = baseUrl.TrimEnd('/');
        _httpClient = new HttpClient(handler)
        {
            Timeout = TimeSpan.FromSeconds(30)
        };
    }

    /// <summary>
    /// Registers a child test with the TestFarm API.
    /// Returns the TestResultId that should be used for completion and output upload.
    /// </summary>
    public async Task<AddChildTestResponse?> AddChildTestToRunAsync(AddChildTestRequest request)
    {
        var url = $"{_baseUrl}/add-child-test-to-run";
        var json = JsonConvert.SerializeObject(request);
        var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");

        Console.WriteLine($"[TestFarmApiClient] POST {url}");
        Console.WriteLine($"[TestFarmApiClient] Request: {json}");

        var response = await _httpClient.PostAsync(url, content).ConfigureAwait(false);
        var responseBody = await response.Content.ReadAsStringAsync().ConfigureAwait(false);

        Console.WriteLine($"[TestFarmApiClient] Response status: {response.StatusCode}");
        Console.WriteLine($"[TestFarmApiClient] Response body: {responseBody}");

        if (response.StatusCode == System.Net.HttpStatusCode.Conflict)
        {
            // Test already exists, parse the response to get the existing TestResult
            Console.WriteLine("[TestFarmApiClient] Test already registered (409 Conflict), using existing TestResult");
            return JsonConvert.DeserializeObject<AddChildTestResponse>(responseBody);
        }

        if (!response.IsSuccessStatusCode)
        {
            Console.WriteLine($"[TestFarmApiClient] ERROR: Failed to add child test. Status: {response.StatusCode}");
            return null;
        }

        return JsonConvert.DeserializeObject<AddChildTestResponse>(responseBody);
    }

    /// <summary>
    /// Completes a child test with the given status.
    /// </summary>
    public async Task<bool> CompleteChildTestAsync(int testResultId, string status)
    {
        var url = $"{_baseUrl}/complete-child-test";
        var request = new CompleteChildTestRequest
        {
            TestResultId = testResultId,
            Status = status
        };
        var json = JsonConvert.SerializeObject(request);
        var content = new StringContent(json, System.Text.Encoding.UTF8, "application/json");

        Console.WriteLine($"[TestFarmApiClient] POST {url}");
        Console.WriteLine($"[TestFarmApiClient] Request: {json}");

        var response = await _httpClient.PostAsync(url, content).ConfigureAwait(false);
        var responseBody = await response.Content.ReadAsStringAsync().ConfigureAwait(false);

        Console.WriteLine($"[TestFarmApiClient] Response status: {response.StatusCode}");
        Console.WriteLine($"[TestFarmApiClient] Response body: {responseBody}");

        if (!response.IsSuccessStatusCode)
        {
            Console.WriteLine($"[TestFarmApiClient] ERROR: Failed to complete child test. Status: {response.StatusCode}");
            return false;
        }

        return true;
    }

    /// <summary>
    /// Uploads the test output file to the TestFarm API.
    /// </summary>
    public async Task<bool> UploadOutputAsync(int testResultId, string filePath)
    {
        var url = $"{_baseUrl}/upload-output";

        Console.WriteLine($"[TestFarmApiClient] POST {url} (multipart/form-data)");
        Console.WriteLine($"[TestFarmApiClient] TestResultId: {testResultId}, File: {filePath}");

        using var formContent = new MultipartFormDataContent();
        formContent.Add(new StringContent(testResultId.ToString()), "TestResultId");

        if (File.Exists(filePath))
        {
            // Use synchronous File.ReadAllBytes for compatibility with .NET Framework 4.6.2 and .NET Standard 2.0
            var fileBytes = File.ReadAllBytes(filePath);
            var fileContent = new ByteArrayContent(fileBytes);
            fileContent.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("application/octet-stream");
            formContent.Add(fileContent, "output", System.IO.Path.GetFileName(filePath));
        }
        else
        {
            Console.WriteLine($"[TestFarmApiClient] WARNING: Output file not found: {filePath}");
        }

        var response = await _httpClient.PostAsync(url, formContent).ConfigureAwait(false);
        var responseBody = await response.Content.ReadAsStringAsync().ConfigureAwait(false);

        Console.WriteLine($"[TestFarmApiClient] Response status: {response.StatusCode}");
        Console.WriteLine($"[TestFarmApiClient] Response body: {responseBody}");

        if (!response.IsSuccessStatusCode)
        {
            Console.WriteLine($"[TestFarmApiClient] ERROR: Failed to upload output. Status: {response.StatusCode}");
            return false;
        }

        return true;
    }

    public void Dispose()
    {
        _httpClient.Dispose();
    }
}
