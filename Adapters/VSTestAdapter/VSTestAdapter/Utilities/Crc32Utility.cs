using System.Text;

namespace VSTestAdapter.Utilities;

public static class Crc32Utility
{
    private static readonly uint[] Crc32Table = CreateTable();

    private static uint[] CreateTable()
    {
        var table = new uint[256];
        const uint polynomial = 0xEDB88320;

        for (uint i = 0; i < 256; i++)
        {
            var crc = i;
            for (var j = 0; j < 8; j++)
            {
                crc = (crc & 1) != 0 ? (crc >> 1) ^ polynomial : crc >> 1;
            }
            table[i] = crc;
        }

        return table;
    }

    public static string ComputeChecksum(string input)
    {
        var bytes = Encoding.UTF8.GetBytes(input);
        var crc = 0xFFFFFFFF;

        foreach (var b in bytes)
        {
            crc = (crc >> 8) ^ Crc32Table[(crc ^ b) & 0xFF];
        }

        crc ^= 0xFFFFFFFF;
        return crc.ToString("X8");
    }

    public static string ComputeParametersChecksum(IEnumerable<string> parameters)
    {
        var combined = string.Join("|", parameters);
        return ComputeChecksum(combined);
    }
}
