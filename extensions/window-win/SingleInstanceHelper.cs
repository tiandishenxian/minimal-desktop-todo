using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Text;

internal static class SingleInstanceHelper
{
    private const int SecondaryExitCode = 10;

    private static int Main(string[] args)
    {
        Options options = Options.Parse(args);
        if (options.ProcessId <= 0 && string.IsNullOrWhiteSpace(options.ExecutablePath))
        {
            return 0;
        }

        List<Process> instances = FindMatchingInstances(options);
        if (instances.Count <= 1)
        {
            return 0;
        }

        WriteSignal(options.SignalPath);
        if (options.TerminateCurrent)
        {
            TerminateSecondaryInstance(options, instances);
        }

        return SecondaryExitCode;
    }

    private static List<Process> FindMatchingInstances(Options options)
    {
        string targetPath = ResolveTargetPath(options);
        if (string.IsNullOrWhiteSpace(targetPath))
        {
            return new List<Process>();
        }

        List<Process> matches = new List<Process>();
        foreach (Process process in Process.GetProcesses())
        {
            try
            {
                string processPath = NormalizePath(process.MainModule.FileName);
                if (!string.Equals(processPath, targetPath, StringComparison.OrdinalIgnoreCase))
                {
                    process.Dispose();
                    continue;
                }

                matches.Add(process);
            }
            catch
            {
                process.Dispose();
            }
        }

        matches.Sort((left, right) => left.StartTime.CompareTo(right.StartTime));
        return matches;
    }

    private static string ResolveTargetPath(Options options)
    {
        if (!string.IsNullOrWhiteSpace(options.ExecutablePath))
        {
            return NormalizePath(options.ExecutablePath);
        }

        try
        {
            using (Process current = Process.GetProcessById(options.ProcessId))
            {
                return NormalizePath(current.MainModule.FileName);
            }
        }
        catch
        {
            return string.Empty;
        }
    }

    private static string NormalizePath(string path)
    {
        try
        {
            return Path.GetFullPath(path ?? string.Empty).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        }
        catch
        {
            return path ?? string.Empty;
        }
    }

    private static void WriteSignal(string signalPath)
    {
        if (string.IsNullOrWhiteSpace(signalPath))
        {
            return;
        }

        string directory = Path.GetDirectoryName(signalPath);
        if (!string.IsNullOrEmpty(directory))
        {
            Directory.CreateDirectory(directory);
        }

        string signal = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString();
        File.WriteAllText(signalPath, signal, Encoding.UTF8);
    }

    private static void TerminateSecondaryInstance(Options options, List<Process> instances)
    {
        try
        {
            Process target = null;
            if (options.ProcessId > 0)
            {
                target = instances.Find(process => process.Id == options.ProcessId);
            }

            if (target == null || target.Id == instances[0].Id)
            {
                target = instances[instances.Count - 1];
            }

            if (target.Id != instances[0].Id)
            {
                target.Kill();
            }
        }
        catch
        {
            // If termination fails, the caller can still handle the secondary exit code.
        }
    }

    private sealed class Options
    {
        public int ProcessId;
        public string ExecutablePath = string.Empty;
        public string SignalPath = string.Empty;
        public bool TerminateCurrent;

        public static Options Parse(string[] args)
        {
            Options options = new Options();
            for (int i = 0; i < args.Length; i++)
            {
                string arg = args[i];
                string value = i + 1 < args.Length ? args[i + 1] : string.Empty;
                int parsed;

                if ((arg == "--pid" || arg == "-p") && int.TryParse(value, out parsed))
                {
                    options.ProcessId = parsed;
                    i++;
                }
                else if ((arg == "--path" || arg == "-e") && value.Length > 0)
                {
                    options.ExecutablePath = value;
                    i++;
                }
                else if ((arg == "--signal" || arg == "-s") && value.Length > 0)
                {
                    options.SignalPath = value;
                    i++;
                }
                else if (arg == "--terminate-current")
                {
                    options.TerminateCurrent = true;
                }
            }

            return options;
        }
    }
}
