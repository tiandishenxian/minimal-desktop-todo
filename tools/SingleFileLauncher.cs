using System;
using System.Diagnostics;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Security.Cryptography;

internal static class SingleFileLauncher
{
    private const string PayloadResourceName = "LitePayload.zip";
    private const string AppFolderName = "MinimalDesktopTodoLite";
    private const string InnerExeName = "MinimalDesktopTodo-win_x64.exe";

    private static int Main(string[] args)
    {
        try
        {
            byte[] payload = ReadPayload();
            string installDir = EnsureExtracted(payload);
            string innerExe = Path.Combine(installDir, InnerExeName);

            if (!File.Exists(innerExe))
            {
                return 2;
            }

            ProcessStartInfo startInfo = new ProcessStartInfo(innerExe)
            {
                WorkingDirectory = installDir,
                UseShellExecute = false,
            };
            startInfo.EnvironmentVariables["MINIMAL_DESKTOP_TODO_LAUNCHER"] =
                Assembly.GetExecutingAssembly().Location;

            if (args.Length > 0)
            {
                startInfo.Arguments = JoinArguments(args);
            }

            Process.Start(startInfo);
            return 0;
        }
        catch
        {
            return 1;
        }
    }

    private static byte[] ReadPayload()
    {
        Assembly assembly = Assembly.GetExecutingAssembly();
        string resourceName = null;
        foreach (string name in assembly.GetManifestResourceNames())
        {
            if (name.EndsWith(PayloadResourceName, StringComparison.Ordinal))
            {
                resourceName = name;
                break;
            }
        }

        if (resourceName == null)
        {
            throw new InvalidOperationException("Missing embedded payload.");
        }

        using (Stream stream = assembly.GetManifestResourceStream(resourceName))
        using (MemoryStream memory = new MemoryStream())
        {
            if (stream == null)
            {
                throw new InvalidOperationException("Unable to open embedded payload.");
            }

            stream.CopyTo(memory);
            return memory.ToArray();
        }
    }

    private static string EnsureExtracted(byte[] payload)
    {
        string hash = ComputeHash(payload);
        string root = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            AppFolderName);
        string installDir = Path.Combine(root, "payload-" + hash);
        string marker = Path.Combine(installDir, ".extract-complete");
        string innerExe = Path.Combine(installDir, InnerExeName);

        if (File.Exists(marker) && File.Exists(innerExe))
        {
            return installDir;
        }

        Directory.CreateDirectory(installDir);
        string payloadZip = Path.Combine(installDir, "payload.zip");
        File.WriteAllBytes(payloadZip, payload);

        ZipFile.ExtractToDirectory(payloadZip, installDir);
        File.WriteAllText(marker, DateTimeOffset.UtcNow.ToUnixTimeMilliseconds().ToString());
        return installDir;
    }

    private static string ComputeHash(byte[] payload)
    {
        using (SHA256 sha = SHA256.Create())
        {
            byte[] hash = sha.ComputeHash(payload);
            return BitConverter.ToString(hash, 0, 8).Replace("-", string.Empty).ToLowerInvariant();
        }
    }

    private static string JoinArguments(string[] args)
    {
        string[] quoted = new string[args.Length];
        for (int i = 0; i < args.Length; i++)
        {
            quoted[i] = QuoteArgument(args[i]);
        }

        return string.Join(" ", quoted);
    }

    private static string QuoteArgument(string value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return "\"\"";
        }

        return "\"" + value.Replace("\\", "\\\\").Replace("\"", "\\\"") + "\"";
    }
}
