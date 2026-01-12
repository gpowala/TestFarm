using NUnit.Framework;
using VSTestAdapter.Services;

namespace VSTestAdapter.UnitTests;

[TestFixture]
public class TestResultTrackerTests
{
    private TestResultTracker _tracker = null!;

    [SetUp]
    public void SetUp()
    {
        _tracker = new TestResultTracker();
    }

    [Test]
    public void RegisterTestResultId_WithValidData_StoresMapping()
    {
        // Arrange
        var testName = "MyNamespace.MyClass.MyTest";
        var testResultId = 123;

        // Act
        _tracker.RegisterTestResultId(testName, testResultId);

        // Assert
        Assert.That(_tracker.GetTestResultId(testName), Is.EqualTo(123));
    }

    [Test]
    public void GetTestResultId_WithUnregisteredTest_ReturnsNull()
    {
        // Arrange
        var testName = "MyNamespace.MyClass.UnknownTest";

        // Act
        var result = _tracker.GetTestResultId(testName);

        // Assert
        Assert.That(result, Is.Null);
    }

    [Test]
    public void IsRegistered_WithRegisteredTest_ReturnsTrue()
    {
        // Arrange
        var testName = "MyNamespace.MyClass.MyTest";
        _tracker.RegisterTestResultId(testName, 456);

        // Act
        var result = _tracker.IsRegistered(testName);

        // Assert
        Assert.That(result, Is.True);
    }

    [Test]
    public void IsRegistered_WithUnregisteredTest_ReturnsFalse()
    {
        // Arrange
        var testName = "MyNamespace.MyClass.UnknownTest";

        // Act
        var result = _tracker.IsRegistered(testName);

        // Assert
        Assert.That(result, Is.False);
    }

    [Test]
    public void Count_WithNoRegistrations_ReturnsZero()
    {
        // Act
        var result = _tracker.Count;

        // Assert
        Assert.That(result, Is.EqualTo(0));
    }

    [Test]
    public void Count_WithMultipleRegistrations_ReturnsCorrectCount()
    {
        // Arrange
        _tracker.RegisterTestResultId("Test1", 1);
        _tracker.RegisterTestResultId("Test2", 2);
        _tracker.RegisterTestResultId("Test3", 3);

        // Act
        var result = _tracker.Count;

        // Assert
        Assert.That(result, Is.EqualTo(3));
    }

    [Test]
    public void GetAllRegisteredTests_WithNoRegistrations_ReturnsEmpty()
    {
        // Act
        var result = _tracker.GetAllRegisteredTests();

        // Assert
        Assert.That(result, Is.Empty);
    }

    [Test]
    public void GetAllRegisteredTests_WithRegistrations_ReturnsAllTestNames()
    {
        // Arrange
        _tracker.RegisterTestResultId("Test1", 1);
        _tracker.RegisterTestResultId("Test2", 2);

        // Act
        var result = _tracker.GetAllRegisteredTests().ToList();

        // Assert
        Assert.That(result, Has.Count.EqualTo(2));
        Assert.That(result, Does.Contain("Test1"));
        Assert.That(result, Does.Contain("Test2"));
    }

    [Test]
    public void RegisterTestResultId_WithDuplicateTest_UpdatesValue()
    {
        // Arrange
        var testName = "MyNamespace.MyClass.MyTest";
        _tracker.RegisterTestResultId(testName, 100);

        // Act
        _tracker.RegisterTestResultId(testName, 200);

        // Assert
        Assert.That(_tracker.GetTestResultId(testName), Is.EqualTo(200));
        Assert.That(_tracker.Count, Is.EqualTo(1));
    }

    [Test]
    public void RegisterTestResultId_ThreadSafety_HandlesParallelRegistrations()
    {
        // Arrange
        var tasks = new List<Task>();
        var testCount = 1000;

        // Act
        for (var i = 0; i < testCount; i++)
        {
            var index = i;
            tasks.Add(Task.Run(() => _tracker.RegisterTestResultId($"Test{index}", index)));
        }
        Task.WaitAll(tasks.ToArray());

        // Assert
        Assert.That(_tracker.Count, Is.EqualTo(testCount));
        for (var i = 0; i < testCount; i++)
        {
            Assert.That(_tracker.GetTestResultId($"Test{i}"), Is.EqualTo(i));
        }
    }

    [Test]
    public void GetTestResultId_ThreadSafety_HandlesParallelReads()
    {
        // Arrange
        for (var i = 0; i < 100; i++)
        {
            _tracker.RegisterTestResultId($"Test{i}", i);
        }

        var tasks = new List<Task<int?>>();

        // Act
        for (var i = 0; i < 100; i++)
        {
            var index = i;
            tasks.Add(Task.Run(() => _tracker.GetTestResultId($"Test{index}")));
        }
        Task.WaitAll(tasks.ToArray());

        // Assert
        for (var i = 0; i < 100; i++)
        {
            Assert.That(tasks[i].Result, Is.EqualTo(i));
        }
    }
}
