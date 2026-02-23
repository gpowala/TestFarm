using NUnit.Framework;
using TestFarmTestLogger.Utilities;

namespace DotnetTestAdapter.UnitTests;

[TestFixture]
public class Crc32UtilityTests
{
    [Test]
    public void ComputeChecksum_ReturnsConsistentResult()
    {
        var result1 = Crc32Utility.ComputeChecksum("test");
        var result2 = Crc32Utility.ComputeChecksum("test");

        Assert.That(result2, Is.EqualTo(result1));
    }

    [Test]
    public void ComputeChecksum_DifferentInputs_ReturnDifferentResults()
    {
        var result1 = Crc32Utility.ComputeChecksum("test1");
        var result2 = Crc32Utility.ComputeChecksum("test2");

        Assert.That(result2, Is.Not.EqualTo(result1));
    }

    [Test]
    public void ComputeChecksum_Returns8CharHex()
    {
        var result = Crc32Utility.ComputeChecksum("hello world");

        Assert.That(result, Has.Length.EqualTo(8));
        Assert.That(result, Does.Match("^[0-9A-F]{8}$"));
    }

    [Test]
    public void ComputeParametersChecksum_CombinesParameters()
    {
        var result = Crc32Utility.ComputeParametersChecksum(new[] { "param1", "param2" });

        Assert.That(result, Has.Length.EqualTo(8));
        Assert.That(result, Does.Match("^[0-9A-F]{8}$"));
    }
}
