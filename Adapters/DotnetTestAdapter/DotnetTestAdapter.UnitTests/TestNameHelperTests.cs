using NUnit.Framework;
using Microsoft.VisualStudio.TestPlatform.ObjectModel;
using TestFarmTestLogger;

namespace DotnetTestAdapter.UnitTests;

[TestFixture]
public class TestNameHelperTests
{
    [Test]
    public void GetTestFarmTestName_SimpleTest_ReturnsAsIs()
    {
        var testCase = new TestCase("MyNamespace.MyClass.MyTest", new Uri("executor://test"), "source.dll");

        var result = TestNameHelper.GetTestFarmTestName(testCase);

        Assert.That(result, Is.EqualTo("MyNamespace.MyClass.MyTest"));
    }

    [Test]
    public void GetTestFarmTestName_WithParameters_ReplaceWithCrc32()
    {
        var testCase = new TestCase("MyNamespace.MyClass.MyTest(1,2,3)", new Uri("executor://test"), "source.dll");

        var result = TestNameHelper.GetTestFarmTestName(testCase);

        Assert.That(result, Does.StartWith("MyNamespace.MyClass.MyTest."));
        Assert.That(result, Does.Not.Contain("("));
        Assert.That(result, Does.Not.Contain(")"));
    }

    [Test]
    public void GetTestFarmTestName_WithDoubleColon_ReplacesWithDot()
    {
        var testCase = new TestCase("MyNamespace::MyClass::MyTest", new Uri("executor://test"), "source.dll");

        var result = TestNameHelper.GetTestFarmTestName(testCase);

        Assert.That(result, Is.EqualTo("MyNamespace.MyClass.MyTest"));
    }

    [Test]
    public void GetTestFarmTestName_ParameterizedTests_DifferentParams_DifferentCrc()
    {
        var testCase1 = new TestCase("MyClass.Test(1)", new Uri("executor://test"), "source.dll");
        var testCase2 = new TestCase("MyClass.Test(2)", new Uri("executor://test"), "source.dll");

        var result1 = TestNameHelper.GetTestFarmTestName(testCase1);
        var result2 = TestNameHelper.GetTestFarmTestName(testCase2);

        Assert.That(result1, Is.Not.EqualTo(result2));
    }

    [Test]
    public void GetTestFarmTestName_ParameterizedTests_SameParams_SameCrc()
    {
        var testCase1 = new TestCase("MyClass.Test(1,\"hello\")", new Uri("executor://test"), "source.dll");
        var testCase2 = new TestCase("MyClass.Test(1,\"hello\")", new Uri("executor://test"), "source.dll");

        var result1 = TestNameHelper.GetTestFarmTestName(testCase1);
        var result2 = TestNameHelper.GetTestFarmTestName(testCase2);

        Assert.That(result1, Is.EqualTo(result2));
    }
}
