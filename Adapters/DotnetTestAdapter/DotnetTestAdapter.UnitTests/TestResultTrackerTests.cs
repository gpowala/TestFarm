using NUnit.Framework;
using TestFarmTestLogger.Services;

namespace DotnetTestAdapter.UnitTests;

[TestFixture]
public class TestResultTrackerTests
{
    [Test]
    public void RegisterAndGet_ReturnsCorrectId()
    {
        var tracker = new TestResultTracker();
        tracker.RegisterTestResultId("MyTest", 42);

        Assert.That(tracker.GetTestResultId("MyTest"), Is.EqualTo(42));
    }

    [Test]
    public void GetTestResultId_NotRegistered_ReturnsNull()
    {
        var tracker = new TestResultTracker();

        Assert.That(tracker.GetTestResultId("NonExistent"), Is.Null);
    }

    [Test]
    public void IsRegistered_WhenRegistered_ReturnsTrue()
    {
        var tracker = new TestResultTracker();
        tracker.RegisterTestResultId("MyTest", 1);

        Assert.That(tracker.IsRegistered("MyTest"), Is.True);
    }

    [Test]
    public void IsRegistered_WhenNotRegistered_ReturnsFalse()
    {
        var tracker = new TestResultTracker();

        Assert.That(tracker.IsRegistered("MyTest"), Is.False);
    }

    [Test]
    public void Count_ReturnsCorrectCount()
    {
        var tracker = new TestResultTracker();
        tracker.RegisterTestResultId("Test1", 1);
        tracker.RegisterTestResultId("Test2", 2);

        Assert.That(tracker.Count, Is.EqualTo(2));
    }

    [Test]
    public void GetAllRegisteredTests_ReturnsAllNames()
    {
        var tracker = new TestResultTracker();
        tracker.RegisterTestResultId("Test1", 1);
        tracker.RegisterTestResultId("Test2", 2);

        var all = tracker.GetAllRegisteredTests().ToList();
        Assert.That(all, Does.Contain("Test1"));
        Assert.That(all, Does.Contain("Test2"));
    }
}
