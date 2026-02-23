using System.Diagnostics;
using System.Text.Json;

namespace DotnetTestAdapter;

public static class Program
{
    public static int Main(string[] args)
    {
        Console.WriteLine("[DotnetTestAdapter] Starting...");

        var config = ParseArguments(args);
        if (config == null)
        {
            PrintUsage();
            return 1;
        }

        Console.WriteLine($"[DotnetTestAdapter] Config file: {config.ConfigPath}");
        Console.WriteLine($"[DotnetTestAdapter] Project path: {config.ProjectPath}");
        Console.WriteLine($"[DotnetTestAdapter] Type: {config.Type}");
        Console.WriteLine($"[DotnetTestAdapter] Work dir: {config.WorkDir}");
        Console.WriteLine($"[DotnetTestAdapter] Logger dir: {config.LoggerDir}");
        Console.WriteLine($"[DotnetTestAdapter] Extra args: {config.ExtraDotnetTestArgs}");

        // Validate config file
        if (!ValidateConfig(config.ConfigPath))
        {
            return 1;
        }

        // Resolve work directory
        var workDir = config.WorkDir;
        Directory.CreateDirectory(workDir);

        // Locate the TestFarmLogger directory
        var loggerDir = ResolveLoggerDirectory(config.LoggerDir);
        if (loggerDir == null)
        {
            Console.WriteLine("[DotnetTestAdapter] ERROR: Could not locate TestFarmLogger directory.");
            return 1;
        }

        Console.WriteLine($"[DotnetTestAdapter] Logger directory: {loggerDir}");

        // Run dotnet test with TestFarmLogger
        var configFullPath = Path.GetFullPath(config.ConfigPath);
        var exitCode = RunDotnetTest(config.ProjectPath, loggerDir, configFullPath, workDir, config.Type, config.ExtraDotnetTestArgs);
        Console.WriteLine($"[DotnetTestAdapter] dotnet test exit code: {exitCode}");

        // Verify overall result file was created by the logger
        var resultFile = Path.Combine(workDir, "result.testfarm");
        if (File.Exists(resultFile))
        {
            Console.WriteLine($"[DotnetTestAdapter] Overall result file: {resultFile}");
        }
        else
        {
            Console.WriteLine("[DotnetTestAdapter] WARNING: Overall result file was not created by the logger.");
        }

        Console.WriteLine("[DotnetTestAdapter] Done.");
        return exitCode;
    }

    private static bool ValidateConfig(string configPath)
    {
        try
        {
            var json = File.ReadAllText(configPath);
            var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;

            var apiBaseUrl = root.GetProperty("TestFarmApiBaseUrl").GetString();
            var parentTestResultId = root.GetProperty("ParentTestResultId").GetInt32();

            Console.WriteLine($"[DotnetTestAdapter] API Base URL: {apiBaseUrl}");
            Console.WriteLine($"[DotnetTestAdapter] ParentTestResultId: {parentTestResultId}");
            return true;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"[DotnetTestAdapter] ERROR: Failed to load config: {ex.Message}");
            return false;
        }
    }

    private static string? ResolveLoggerDirectory(string? loggerDirArg)
    {
        // Use --logger-dir if provided
        if (!string.IsNullOrEmpty(loggerDirArg) && Directory.Exists(loggerDirArg))
        {
            return loggerDirArg;
        }

        // Fallback: look for TestFarmLogger directory relative to the executable
        var baseDir = AppContext.BaseDirectory;
        var loggerDir = Path.Combine(baseDir, "TestFarmLogger");

        if (Directory.Exists(loggerDir))
        {
            return loggerDir;
        }

        return null;
    }

    private static int RunDotnetTest(string projectPath, string loggerDir, string configPath, string workDir, string type, string? extraArgs)
    {
        var loggerParam = $"TestFarmLogger;TestsRunConfig={configPath};Type={type};WorkDir={workDir}";
        var arguments = $"test \"{projectPath}\" --test-adapter-path \"{loggerDir}\" --logger \"{loggerParam}\"";

        if (!string.IsNullOrEmpty(extraArgs))
        {
            arguments += " " + extraArgs;
        }

        Console.WriteLine($"[DotnetTestAdapter] Running: dotnet {arguments}");

        var psi = new ProcessStartInfo
        {
            FileName = "dotnet",
            Arguments = arguments,
            UseShellExecute = false,
            RedirectStandardOutput = true,
            RedirectStandardError = true
        };

        using var process = Process.Start(psi);
        if (process == null)
        {
            Console.WriteLine("[DotnetTestAdapter] ERROR: Failed to start dotnet process.");
            return -1;
        }

        // Stream output in real time
        process.OutputDataReceived += (_, e) =>
        {
            if (e.Data != null) Console.WriteLine(e.Data);
        };
        process.ErrorDataReceived += (_, e) =>
        {
            if (e.Data != null) Console.Error.WriteLine(e.Data);
        };

        process.BeginOutputReadLine();
        process.BeginErrorReadLine();
        process.WaitForExit();

        return process.ExitCode;
    }

    private static AdapterConfig? ParseArguments(string[] args)
    {
        string? configPath = null;
        string? projectPath = null;
        string? type = null;
        string? workDir = null;
        string? loggerDir = null;
        var extraArgs = new List<string>();
        var parsingExtra = false;

        for (var i = 0; i < args.Length; i++)
        {
            if (parsingExtra)
            {
                extraArgs.Add(args[i]);
                continue;
            }

            switch (args[i])
            {
                case "--config":
                    if (i + 1 < args.Length) configPath = args[++i];
                    break;
                case "--project":
                    if (i + 1 < args.Length) projectPath = args[++i];
                    break;
                case "--type":
                    if (i + 1 < args.Length) type = args[++i];
                    break;
                case "--work-dir":
                    if (i + 1 < args.Length) workDir = args[++i];
                    break;
                case "--logger-dir":
                    if (i + 1 < args.Length) loggerDir = args[++i];
                    break;
                case "--":
                    parsingExtra = true;
                    break;
                default:
                    projectPath ??= args[i];
                    break;
            }
        }

        if (string.IsNullOrEmpty(configPath))
        {
            Console.WriteLine("[DotnetTestAdapter] ERROR: --config is required.");
            return null;
        }

        if (!File.Exists(configPath))
        {
            Console.WriteLine($"[DotnetTestAdapter] ERROR: Config file not found: {configPath}");
            return null;
        }

        if (string.IsNullOrEmpty(type))
        {
            Console.WriteLine("[DotnetTestAdapter] ERROR: --type is required.");
            return null;
        }

        if (string.IsNullOrEmpty(workDir))
        {
            Console.WriteLine("[DotnetTestAdapter] ERROR: --work-dir is required.");
            return null;
        }

        projectPath ??= ".";

        return new AdapterConfig
        {
            ConfigPath = configPath,
            ProjectPath = projectPath,
            Type = type,
            WorkDir = workDir,
            LoggerDir = loggerDir,
            ExtraDotnetTestArgs = extraArgs.Count > 0 ? string.Join(" ", extraArgs) : null
        };
    }

    private static void PrintUsage()
    {
        Console.WriteLine();
        Console.WriteLine("Usage: DotnetTestAdapter --config <config.json> --type <type> --work-dir <path> [--project <path>] [--logger-dir <path>] [-- <extra dotnet test args>]");
        Console.WriteLine();
        Console.WriteLine("Arguments:");
        Console.WriteLine("  --config <path>      Path to TestsRunConfig JSON file (required)");
        Console.WriteLine("  --type <type>        Type of the test run (required)");
        Console.WriteLine("  --project <path>     Path to the test project/solution (default: current directory)");
        Console.WriteLine("  --work-dir <path>    Working directory for result files (required)");
        Console.WriteLine("  --logger-dir <path>  Path to TestFarmLogger directory (optional, auto-detected if not set)");
        Console.WriteLine("  -- <args>            Additional arguments passed to 'dotnet test'");
        Console.WriteLine();
        Console.WriteLine("This adapter uses a real-time VSTest logger (TestFarmLogger) to report each test");
        Console.WriteLine("result to the TestFarm API as it completes, instead of waiting for all tests to finish.");
        Console.WriteLine();
        Console.WriteLine("Example:");
        Console.WriteLine("  DotnetTestAdapter --config tests-run-config.json --type playwright --work-dir ./results --project ./MyTests.csproj");
        Console.WriteLine("  DotnetTestAdapter --config config.json --type dotnet --work-dir ./results --project ./MyTests.sln -- --filter \"Category=Integration\"");
    }

    private sealed class AdapterConfig
    {
        public required string ConfigPath { get; init; }
        public required string ProjectPath { get; init; }
        public required string Type { get; init; }
        public required string WorkDir { get; init; }
        public string? LoggerDir { get; init; }
        public string? ExtraDotnetTestArgs { get; init; }
    }
}
