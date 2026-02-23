using NUnit.Framework;
using Moq;
using Moq.Protected;
using System.Net;
using System.Net.Http;
using TestFarmTestLogger.Services;

namespace DotnetTestAdapter.UnitTests;

[TestFixture]
public class TestFarmApiClientTests
{
    [Test]
    public async Task AddChildTestToRunAsync_Success_ReturnsResponse()
    {
        var responseJson = @"{
            ""Test"": { ""Id"": 1, ""Name"": ""MyTest"" },
            ""TestResult"": { ""Id"": 100, ""Status"": ""running"" }
        }";

        var handler = CreateMockHandler(HttpStatusCode.OK, responseJson);
        using var client = new TestFarmApiClient("https://api.test.com", handler);

        var request = new AddChildTestRequest
        {
            ParentTestResultId = 1,
            Name = "MyTest"
        };

        var response = await client.AddChildTestToRunAsync(request);

        Assert.That(response, Is.Not.Null);
        Assert.That(response!.TestResult, Is.Not.Null);
        Assert.That(response.TestResult!.Id, Is.EqualTo(100));
    }

    [Test]
    public async Task AddChildTestToRunAsync_Conflict_ReturnsExistingResponse()
    {
        var responseJson = @"{
            ""Test"": { ""Id"": 1, ""Name"": ""MyTest"" },
            ""TestResult"": { ""Id"": 50, ""Status"": ""running"" }
        }";

        var handler = CreateMockHandler(HttpStatusCode.Conflict, responseJson);
        using var client = new TestFarmApiClient("https://api.test.com", handler);

        var request = new AddChildTestRequest
        {
            ParentTestResultId = 1,
            Name = "MyTest"
        };

        var response = await client.AddChildTestToRunAsync(request);

        Assert.That(response, Is.Not.Null);
        Assert.That(response!.TestResult!.Id, Is.EqualTo(50));
    }

    [Test]
    public async Task CompleteChildTestAsync_Success_ReturnsTrue()
    {
        var handler = CreateMockHandler(HttpStatusCode.OK, "{}");
        using var client = new TestFarmApiClient("https://api.test.com", handler);

        var result = await client.CompleteChildTestAsync(100, "passed");

        Assert.That(result, Is.True);
    }

    [Test]
    public async Task CompleteChildTestAsync_Failure_ReturnsFalse()
    {
        var handler = CreateMockHandler(HttpStatusCode.InternalServerError, "error");
        using var client = new TestFarmApiClient("https://api.test.com", handler);

        var result = await client.CompleteChildTestAsync(100, "passed");

        Assert.That(result, Is.False);
    }

    private static HttpMessageHandler CreateMockHandler(HttpStatusCode statusCode, string content)
    {
        var mockHandler = new Mock<HttpMessageHandler>();
        mockHandler.Protected()
            .Setup<Task<HttpResponseMessage>>(
                "SendAsync",
                ItExpr.IsAny<HttpRequestMessage>(),
                ItExpr.IsAny<CancellationToken>())
            .ReturnsAsync(new HttpResponseMessage
            {
                StatusCode = statusCode,
                Content = new StringContent(content)
            });
        return mockHandler.Object;
    }
}
