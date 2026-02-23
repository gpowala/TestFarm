using Microsoft.VisualStudio.TestPlatform.ObjectModel;
using TestFarmTestLogger.Utilities;

namespace TestFarmTestLogger;

public static class TestNameHelper
{
    public static string GetTestFarmTestName(TestCase testCase)
    {
        var fullyQualifiedName = testCase.FullyQualifiedName.Replace("::", ".");

        var paramStart = fullyQualifiedName.IndexOf('(');

        if (paramStart >= 0)
        {
            var paramEnd = fullyQualifiedName.LastIndexOf(')');

            if (paramEnd > paramStart)
            {
                var paramString = fullyQualifiedName.Substring(paramStart + 1, paramEnd - paramStart - 1);
                var crc32 = Crc32Utility.ComputeChecksum(paramString);
                var nameWithoutParams = fullyQualifiedName.Substring(0, paramStart);
                return $"{nameWithoutParams}.{crc32}";
            }
        }

        return fullyQualifiedName;
    }
}
