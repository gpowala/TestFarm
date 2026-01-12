using System.Net;
using System.Net.Http;
using Moq;
using Moq.Protected;
using Newtonsoft.Json;
using NUnit.Framework;
using VSTestAdapter.Services;

namespace VSTestAdapter.UnitTests;

[TestFixture]
public class TestFarmApiClientTests
{
    private Mock<HttpMessageHandler> _mockHandler = null!;
    private TestFarmApiClient _client = null!;
    private const string BaseUrl = "http://localhost:3000/api";

    [SetUp]
    public void SetUp()
    {
        _mockHandler = new Mock<HttpMessageHandler>();
        _client = new TestFarmApiClient(BaseUrl, _mockHandler.Object);
    }

    [TearDown]
    public void TearDown()
    {
        _client.Dispose();
    }

    #region AddChildTestToRunAsync Tests

    [Test]
    public async Task AddChildTestToRunAsync_WithSuccessResponse_ReturnsResponse()
    {
        // Arrange
        var request = new AddChildTestRequest
        {
            ParentTestResultId = 456,
            Name = "MyTest"
        };

        var response = new AddChildTestResponse
        {
            Test = new TestInfo { Id = 1, Name = "MyTest" },
            TestResult = new TestResultApiInfo { Id = 789, Status = "queued" }
        };

        SetupMockResponse(HttpStatusCode.Created, response);

        // Act
        var result = await _client.AddChildTestToRunAsync(request);

        // Assert
        Assert.That(result, Is.Not.Null);
        Assert.That(result!.TestResult!.Id, Is.EqualTo(789));
        Assert.That(result.Test!.Id, Is.EqualTo(1));
    }

    [Test]
    public async Task AddChildTestToRunAsync_WithConflictResponse_ReturnsExistingResult()
    {
        // Arrange
        var request = new AddChildTestRequest
        {
            ParentTestResultId = 456,
            Name = "MyTest"
        };

        var response = new AddChildTestResponse
        {
            Test = new TestInfo { Id = 1, Name = "MyTest" },
            TestResult = new TestResultApiInfo { Id = 999, Status = "queued" }
        };

        SetupMockResponse(HttpStatusCode.Conflict, response);

        // Act
        var result = await _client.AddChildTestToRunAsync(request);

        // Assert
        Assert.That(result, Is.Not.Null);
        Assert.That(result!.TestResult!.Id, Is.EqualTo(999));
    }

    [Test]
    public async Task AddChildTestToRunAsync_WithNotFoundResponse_ReturnsNull()
    {
        // Arrange
        var request = new AddChildTestRequest
        {
            ParentTestResultId = 999,
            Name = "MyTest"
        };

        SetupMockResponse(HttpStatusCode.NotFound, new { error = "TestRun not found" });

        // Act
        var result = await _client.AddChildTestToRunAsync(request);

        // Assert
        Assert.That(result, Is.Null);
    }

    [Test]
    public async Task AddChildTestToRunAsync_WithServerError_ReturnsNull()
    {
        // Arrange
        var request = new AddChildTestRequest
        {
            ParentTestResultId = 456,
            Name = "MyTest"
        };

        SetupMockResponse(HttpStatusCode.InternalServerError, new { error = "Internal Server Error" });

        // Act
        var result = await _client.AddChildTestToRunAsync(request);

        // Assert
        Assert.That(result, Is.Null);
    }

    [Test]
    public async Task AddChildTestToRunAsync_SendsCorrectUrl()
    {
        // Arrange
        var request = new AddChildTestRequest { ParentTestResultId = 456 };
        SetupMockResponse(HttpStatusCode.Created, new AddChildTestResponse());

        // Act
        await _client.AddChildTestToRunAsync(request);

        // Assert
        _mockHandler.Protected().Verify(
            "SendAsync",
            Times.Once(),
            ItExpr.Is<HttpRequestMessage>(req =>
                req.RequestUri!.ToString() == "http://localhost:3000/api/add-child-test-to-run"),
            ItExpr.IsAny<CancellationToken>());
    }

    #endregion

    #region CompleteChildTestAsync Tests

    [Test]
    public async Task CompleteChildTestAsync_WithSuccessResponse_ReturnsTrue()
    {
        // Arrange
        SetupMockResponse(HttpStatusCode.OK, new { Id = 123, Status = "passed" });

        // Act
        var result = await _client.CompleteChildTestAsync(123, "passed");

        // Assert
        Assert.That(result, Is.True);
    }

    [Test]
    public async Task CompleteChildTestAsync_WithNotFoundResponse_ReturnsFalse()
    {
        // Arrange
        SetupMockResponse(HttpStatusCode.NotFound, new { message = "Test result not found" });

        // Act
        var result = await _client.CompleteChildTestAsync(999, "passed");

        // Assert
        Assert.That(result, Is.False);
    }

    [Test]
    public async Task CompleteChildTestAsync_WithServerError_ReturnsFalse()
    {
        // Arrange
        SetupMockResponse(HttpStatusCode.InternalServerError, new { error = "Internal Server Error" });

        // Act
        var result = await _client.CompleteChildTestAsync(123, "failed");

        // Assert
        Assert.That(result, Is.False);
    }

    [Test]
    public async Task CompleteChildTestAsync_SendsCorrectUrl()
    {
        // Arrange
        SetupMockResponse(HttpStatusCode.OK, new { });

        // Act
        await _client.CompleteChildTestAsync(123, "passed");

        // Assert
        _mockHandler.Protected().Verify(
            "SendAsync",
            Times.Once(),
            ItExpr.Is<HttpRequestMessage>(req =>
                req.RequestUri!.ToString() == "http://localhost:3000/api/complete-child-test"),
            ItExpr.IsAny<CancellationToken>());
    }

    [Test]
    public async Task CompleteChildTestAsync_SendsCorrectPayload()
    {
        // Arrange
        string? capturedBody = null;
        _mockHandler.Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .Callback<HttpRequestMessage, CancellationToken>(async (req, _) =>
            {
                capturedBody = await req.Content!.ReadAsStringAsync();
            })
            .ReturnsAsync(new HttpResponseMessage(HttpStatusCode.OK)
            {
                Content = new StringContent("{}")
            });

        // Act
        await _client.CompleteChildTestAsync(123, "failed");

        // Assert
        Assert.That(capturedBody, Is.Not.Null);
        var payload = JsonConvert.DeserializeObject<CompleteChildTestRequest>(capturedBody!);
        Assert.That(payload!.TestResultId, Is.EqualTo(123));
        Assert.That(payload.Status, Is.EqualTo("failed"));
    }

    #endregion

    #region UploadOutputAsync Tests

    [Test]
    public async Task UploadOutputAsync_WithSuccessResponse_ReturnsTrue()
    {
        // Arrange
        var testDir = Path.Combine(Path.GetTempPath(), $"TestFarmApiClientTests_{Guid.NewGuid():N}");
        Directory.CreateDirectory(testDir);
        var filePath = Path.Combine(testDir, "result.testfarm");
        File.WriteAllText(filePath, "{\"test\": \"data\"}");

        try
        {
            SetupMockResponse(HttpStatusCode.Created, new { message = "Test output uploaded successfully" });

            // Act
            var result = await _client.UploadOutputAsync(123, filePath);

            // Assert
            Assert.That(result, Is.True);
        }
        finally
        {
            Directory.Delete(testDir, recursive: true);
        }
    }

    [Test]
    public async Task UploadOutputAsync_WithNonExistentFile_ReturnsTrue()
    {
        // Arrange - file doesn't exist but API call should still succeed
        SetupMockResponse(HttpStatusCode.Created, new { message = "Test output uploaded successfully" });

        // Act
        var result = await _client.UploadOutputAsync(123, @"C:\nonexistent\file.testfarm");

        // Assert
        Assert.That(result, Is.True);
    }

    [Test]
    public async Task UploadOutputAsync_WithNotFoundResponse_ReturnsFalse()
    {
        // Arrange
        var testDir = Path.Combine(Path.GetTempPath(), $"TestFarmApiClientTests_{Guid.NewGuid():N}");
        Directory.CreateDirectory(testDir);
        var filePath = Path.Combine(testDir, "result.testfarm");
        File.WriteAllText(filePath, "{\"test\": \"data\"}");

        try
        {
            SetupMockResponse(HttpStatusCode.NotFound, new { message = "Test result not found" });

            // Act
            var result = await _client.UploadOutputAsync(999, filePath);

            // Assert
            Assert.That(result, Is.False);
        }
        finally
        {
            Directory.Delete(testDir, recursive: true);
        }
    }

    [Test]
    public async Task UploadOutputAsync_SendsCorrectUrl()
    {
        // Arrange
        SetupMockResponse(HttpStatusCode.Created, new { });

        // Act
        await _client.UploadOutputAsync(123, @"C:\nonexistent\file.testfarm");

        // Assert
        _mockHandler.Protected().Verify(
            "SendAsync",
            Times.Once(),
            ItExpr.Is<HttpRequestMessage>(req =>
                req.RequestUri!.ToString() == "http://localhost:3000/api/upload-output"),
            ItExpr.IsAny<CancellationToken>());
    }

    [Test]
    public async Task UploadOutputAsync_SendsMultipartFormData()
    {
        // Arrange
        var testDir = Path.Combine(Path.GetTempPath(), $"TestFarmApiClientTests_{Guid.NewGuid():N}");
        Directory.CreateDirectory(testDir);
        var filePath = Path.Combine(testDir, "result.testfarm");
        File.WriteAllText(filePath, "{\"test\": \"data\"}");

        try
        {
            string? capturedContentType = null;
            _mockHandler.Protected()
                .Setup<Task<HttpResponseMessage>>(
                    "SendAsync",
                    ItExpr.IsAny<HttpRequestMessage>(),
                    ItExpr.IsAny<CancellationToken>())
                .Callback<HttpRequestMessage, CancellationToken>((req, _) =>
                {
                    capturedContentType = req.Content?.Headers.ContentType?.MediaType;
                })
                .ReturnsAsync(new HttpResponseMessage(HttpStatusCode.Created)
                {
                    Content = new StringContent("{}")
                });

            // Act
            await _client.UploadOutputAsync(123, filePath);

            // Assert
            Assert.That(capturedContentType, Is.EqualTo("multipart/form-data"));
        }
        finally
        {
            Directory.Delete(testDir, recursive: true);
        }
    }

    #endregion

    #region Constructor Tests

    [Test]
    public void Constructor_WithTrailingSlash_TrimsSlash()
    {
        // Arrange & Act
        using var client = new TestFarmApiClient("http://localhost:3000/api/", _mockHandler.Object);
        SetupMockResponse(HttpStatusCode.OK, new { });

        // Act
        client.CompleteChildTestAsync(123, "passed").Wait();

        // Assert
        _mockHandler.Protected().Verify(
            "SendAsync",
            Times.Once(),
            ItExpr.Is<HttpRequestMessage>(req =>
                req.RequestUri!.ToString() == "http://localhost:3000/api/complete-child-test"),
            ItExpr.IsAny<CancellationToken>());
    }

    #endregion

    private void SetupMockResponse(HttpStatusCode statusCode, object responseBody)
    {
        var json = JsonConvert.SerializeObject(responseBody);
        _mockHandler.Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(new HttpResponseMessage(statusCode)
            {
                Content = new StringContent(json, System.Text.Encoding.UTF8, "application/json")
            });
    }
}
