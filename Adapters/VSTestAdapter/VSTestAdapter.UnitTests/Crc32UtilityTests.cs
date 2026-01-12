using NUnit.Framework;
using VSTestAdapter.Utilities;

namespace VSTestAdapter.UnitTests;

[TestFixture]
public class Crc32UtilityTests
{
    [Test]
    public void ComputeChecksum_EmptyString_ReturnsExpectedValue()
    {
        // Arrange
        var input = string.Empty;

        // Act
        var result = Crc32Utility.ComputeChecksum(input);

        // Assert
        Assert.That(result, Is.EqualTo("00000000"));
    }

    [Test]
    public void ComputeChecksum_SimpleString_ReturnsConsistentValue()
    {
        // Arrange
        var input = "test";

        // Act
        var result1 = Crc32Utility.ComputeChecksum(input);
        var result2 = Crc32Utility.ComputeChecksum(input);

        // Assert
        Assert.That(result1, Is.EqualTo(result2));
        Assert.That(result1, Has.Length.EqualTo(8));
    }

    [Test]
    public void ComputeChecksum_DifferentInputs_ReturnsDifferentValues()
    {
        // Arrange
        var input1 = "test1";
        var input2 = "test2";

        // Act
        var result1 = Crc32Utility.ComputeChecksum(input1);
        var result2 = Crc32Utility.ComputeChecksum(input2);

        // Assert
        Assert.That(result1, Is.Not.EqualTo(result2));
    }

    [Test]
    public void ComputeChecksum_ReturnsUppercaseHex()
    {
        // Arrange
        var input = "hello";

        // Act
        var result = Crc32Utility.ComputeChecksum(input);

        // Assert
        Assert.That(result, Does.Match("^[0-9A-F]{8}$"));
    }

    [Test]
    public void ComputeParametersChecksum_SingleParameter_ReturnsChecksum()
    {
        // Arrange
        var parameters = new[] { "param1" };

        // Act
        var result = Crc32Utility.ComputeParametersChecksum(parameters);

        // Assert
        Assert.That(result, Has.Length.EqualTo(8));
        Assert.That(result, Is.EqualTo(Crc32Utility.ComputeChecksum("param1")));
    }

    [Test]
    public void ComputeParametersChecksum_MultipleParameters_CombinesWithPipe()
    {
        // Arrange
        var parameters = new[] { "param1", "param2", "param3" };

        // Act
        var result = Crc32Utility.ComputeParametersChecksum(parameters);

        // Assert
        Assert.That(result, Has.Length.EqualTo(8));
        Assert.That(result, Is.EqualTo(Crc32Utility.ComputeChecksum("param1|param2|param3")));
    }

    [Test]
    public void ComputeParametersChecksum_EmptyArray_ReturnsEmptyStringChecksum()
    {
        // Arrange
        var parameters = Array.Empty<string>();

        // Act
        var result = Crc32Utility.ComputeParametersChecksum(parameters);

        // Assert
        Assert.That(result, Is.EqualTo(Crc32Utility.ComputeChecksum(string.Empty)));
    }
}
