using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

internal static class TaskbarlessHelper
{
    private const int GwlExStyle = -20;
    private const long WsExToolWindow = 0x00000080L;
    private const long WsExAppWindow = 0x00040000L;
    private const uint SwpNoSize = 0x0001;
    private const uint SwpNoMove = 0x0002;
    private const uint SwpNoZOrder = 0x0004;
    private const uint SwpNoActivate = 0x0010;
    private const uint SwpFrameChanged = 0x0020;

    private delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    private static extern bool EnumWindows(EnumWindowsProc lpEnumFunc, IntPtr lParam);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    private static extern int GetWindowText(IntPtr hWnd, StringBuilder text, int maxCount);

    [DllImport("user32.dll", EntryPoint = "GetWindowLongPtr", SetLastError = true)]
    private static extern IntPtr GetWindowLongPtr64(IntPtr hWnd, int index);

    [DllImport("user32.dll", EntryPoint = "GetWindowLong", SetLastError = true)]
    private static extern int GetWindowLong32(IntPtr hWnd, int index);

    [DllImport("user32.dll", EntryPoint = "SetWindowLongPtr", SetLastError = true)]
    private static extern IntPtr SetWindowLongPtr64(IntPtr hWnd, int index, IntPtr newLong);

    [DllImport("user32.dll", EntryPoint = "SetWindowLong", SetLastError = true)]
    private static extern int SetWindowLong32(IntPtr hWnd, int index, int newLong);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool SetWindowPos(
        IntPtr hWnd,
        IntPtr hWndInsertAfter,
        int x,
        int y,
        int cx,
        int cy,
        uint flags);

    private static int Main(string[] args)
    {
        Options options = Options.Parse(args);
        DateTime deadline = DateTime.UtcNow.AddSeconds(Math.Max(0, options.WatchSeconds));
        bool applied = false;

        do
        {
            applied = ApplyTaskbarless(options) || applied;
            if (options.WatchSeconds <= 0 || DateTime.UtcNow >= deadline)
            {
                break;
            }

            Thread.Sleep(Math.Max(100, options.IntervalMs));
        }
        while (true);

        return applied ? 0 : 2;
    }

    private static bool ApplyTaskbarless(Options options)
    {
        IntPtr hWnd = FindWindow(options);
        if (hWnd == IntPtr.Zero)
        {
            return false;
        }

        long style = GetWindowLongPtr(hWnd, GwlExStyle);
        style &= ~WsExAppWindow;
        style |= WsExToolWindow;
        SetWindowLongPtr(hWnd, GwlExStyle, style);

        return SetWindowPos(
            hWnd,
            IntPtr.Zero,
            0,
            0,
            0,
            0,
            SwpNoMove | SwpNoSize | SwpNoZOrder | SwpNoActivate | SwpFrameChanged);
    }

    private static IntPtr FindWindow(Options options)
    {
        if (options.ProcessId > 0)
        {
            try
            {
                Process process = Process.GetProcessById(options.ProcessId);
                if (process.MainWindowHandle != IntPtr.Zero)
                {
                    return process.MainWindowHandle;
                }
            }
            catch
            {
                return IntPtr.Zero;
            }
        }

        List<IntPtr> matches = new List<IntPtr>();
        EnumWindows(delegate(IntPtr hWnd, IntPtr lParam)
        {
            uint windowProcessId;
            GetWindowThreadProcessId(hWnd, out windowProcessId);
            if ((options.ProcessId <= 0 || windowProcessId == options.ProcessId) &&
                string.Equals(GetWindowTitle(hWnd), options.Title, StringComparison.Ordinal))
            {
                matches.Add(hWnd);
            }

            return true;
        }, IntPtr.Zero);

        return matches.Count > 0 ? matches[0] : IntPtr.Zero;
    }

    private static string GetWindowTitle(IntPtr hWnd)
    {
        StringBuilder builder = new StringBuilder(512);
        GetWindowText(hWnd, builder, builder.Capacity);
        return builder.ToString();
    }

    private static long GetWindowLongPtr(IntPtr hWnd, int index)
    {
        return IntPtr.Size == 8
            ? GetWindowLongPtr64(hWnd, index).ToInt64()
            : GetWindowLong32(hWnd, index);
    }

    private static void SetWindowLongPtr(IntPtr hWnd, int index, long value)
    {
        if (IntPtr.Size == 8)
        {
            SetWindowLongPtr64(hWnd, index, new IntPtr(value));
            return;
        }

        SetWindowLong32(hWnd, index, unchecked((int)value));
    }

    private sealed class Options
    {
        public int ProcessId = 0;
        public string Title = "Minimal Todo";
        public int WatchSeconds = 0;
        public int IntervalMs = 500;

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
                else if ((arg == "--title" || arg == "-t") && value.Length > 0)
                {
                    options.Title = value;
                    i++;
                }
                else if ((arg == "--watch" || arg == "-w") && int.TryParse(value, out parsed))
                {
                    options.WatchSeconds = parsed;
                    i++;
                }
                else if ((arg == "--interval" || arg == "-i") && int.TryParse(value, out parsed))
                {
                    options.IntervalMs = parsed;
                    i++;
                }
            }

            return options;
        }
    }
}
