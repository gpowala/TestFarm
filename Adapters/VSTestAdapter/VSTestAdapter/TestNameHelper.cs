using Microsoft.VisualStudio.TestPlatform.ObjectModel;
using VSTestAdapter.Utilities;

namespace VSTestAdapter;

public static class TestNameHelper
{
    public static string GetTestFarmTestName(TestCase testCase)
    {
        var fullyQualifiedName = testCase.FullyQualifiedName.Replace("::", ".");
        
        // Check if there are parameters in the fully qualified name
        var paramStart = fullyQualifiedName.IndexOf('(');
        
        if (paramStart >= 0)
        {
            var paramEnd = fullyQualifiedName.LastIndexOf(')');
            
            if (paramEnd > paramStart)
            {
                // Extract parameters and compute CRC32
                var paramString = fullyQualifiedName.Substring(paramStart + 1, paramEnd - paramStart - 1);
                var crc32 = Crc32Utility.ComputeChecksum(paramString);
                
                // Return name without params, with CRC32 appended
                var nameWithoutParams = fullyQualifiedName.Substring(0, paramStart);
                return $"{nameWithoutParams}.{crc32}";
            }
        }
        
        // No parameters, return as-is
        return fullyQualifiedName;
    }
}
