using Microsoft.VisualStudio.TestPlatform.ObjectModel;
using NUnit.Framework;

namespace VSTestAdapter.UnitTests;

[TestFixture]
public class TestNameHelperTests
{
    [Test]
    public void GetTestFarmTestName_SimpleTestName_ReturnsAsIs()
    {
        // Arrange
        var testCase = new TestCase(
            "MyNamespace.MyClass.MyTest",
            new Uri("executor://test"),
            "test.dll");

        // Act
        var result = TestNameHelper.GetTestFarmTestName(testCase);

        // Assert
        Assert.That(result, Is.EqualTo("MyNamespace.MyClass.MyTest"));
    }

    [Test]
    public void GetTestFarmTestName_WithParameters_AppendsChecksumWithoutParams()
    {
        // Arrange
        var testCase = new TestCase(
            "MyNamespace.MyClass.MyTest(1, 2, 3)",
            new Uri("executor://test"),
            "test.dll");

        // Act
        var result = TestNameHelper.GetTestFarmTestName(testCase);

        // Assert
        Assert.That(result, Does.StartWith("MyNamespace.MyClass.MyTest."));
        Assert.That(result, Does.Not.Contain("("));
        Assert.That(result, Does.Not.Contain(")"));
        // Should end with 8-character CRC32 hash
        var parts = result.Split('.');
        Assert.That(parts[^1], Does.Match("^[0-9A-F]{8}$"));
    }

    [Test]
    public void GetTestFarmTestName_WithStringParameters_AppendsChecksum()
    {
        // Arrange
        var testCase = new TestCase(
            "MyNamespace.MyClass.MyTest(\"hello\", \"world\")",
            new Uri("executor://test"),
            "test.dll");

        // Act
        var result = TestNameHelper.GetTestFarmTestName(testCase);

        // Assert
        Assert.That(result, Does.StartWith("MyNamespace.MyClass.MyTest."));
        Assert.That(result, Does.Not.Contain("("));
    }

    [Test]
    public void GetTestFarmTestName_SameParameters_ReturnsSameChecksum()
    {
        // Arrange
        var testCase1 = new TestCase(
            "MyNamespace.MyClass.MyTest(1, 2)",
            new Uri("executor://test"),
            "test.dll");
        var testCase2 = new TestCase(
            "MyNamespace.MyClass.MyTest(1, 2)",
            new Uri("executor://test"),
            "test.dll");

        // Act
        var result1 = TestNameHelper.GetTestFarmTestName(testCase1);
        var result2 = TestNameHelper.GetTestFarmTestName(testCase2);

        // Assert
        Assert.That(result1, Is.EqualTo(result2));
    }

    [Test]
    public void GetTestFarmTestName_DifferentParameters_ReturnsDifferentChecksum()
    {
        // Arrange
        var testCase1 = new TestCase(
            "MyNamespace.MyClass.MyTest(1, 2)",
            new Uri("executor://test"),
            "test.dll");
        var testCase2 = new TestCase(
            "MyNamespace.MyClass.MyTest(3, 4)",
            new Uri("executor://test"),
            "test.dll");

        // Act
        var result1 = TestNameHelper.GetTestFarmTestName(testCase1);
        var result2 = TestNameHelper.GetTestFarmTestName(testCase2);

        // Assert
        Assert.That(result1, Is.Not.EqualTo(result2));
    }

    [Test]
    public void GetTestFarmTestName_WithCppStyleSeparator_ConvertsToDot()
    {
        // Arrange
        var testCase = new TestCase(
            "MyNamespace::MyClass::MyTest",
            new Uri("executor://test"),
            "test.dll");

        // Act
        var result = TestNameHelper.GetTestFarmTestName(testCase);

        // Assert
        Assert.That(result, Is.EqualTo("MyNamespace.MyClass.MyTest"));
        Assert.That(result, Does.Not.Contain("::"));
    }

    [Test]
    public void GetTestFarmTestName_WithCppStyleSeparatorAndParams_ConvertsAndAppendsChecksum()
    {
        // Arrange
        var testCase = new TestCase(
            "MyNamespace::MyClass::MyTest(arg1)",
            new Uri("executor://test"),
            "test.dll");

        // Act
        var result = TestNameHelper.GetTestFarmTestName(testCase);

        // Assert
        Assert.That(result, Does.StartWith("MyNamespace.MyClass.MyTest."));
        Assert.That(result, Does.Not.Contain("::"));
        Assert.That(result, Does.Not.Contain("("));
    }

    [Test]
    public void GetTestFarmTestName_EmptyParameters_AppendsEmptyChecksum()
    {
        // Arrange
        var testCase = new TestCase(
            "MyNamespace.MyClass.MyTest()",
            new Uri("executor://test"),
            "test.dll");

        // Act
        var result = TestNameHelper.GetTestFarmTestName(testCase);

        // Assert
        Assert.That(result, Does.StartWith("MyNamespace.MyClass.MyTest."));
        // Empty string CRC32
        Assert.That(result, Does.EndWith(".00000000"));
    }
}
