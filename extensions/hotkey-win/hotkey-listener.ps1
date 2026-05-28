param(
  [Parameter(Mandatory = $true)]
  [string]$SignalPath,

  [string]$Key = 'T',

  [string[]]$Modifiers = @('Control', 'Alt')
)

$source = @"
using System;
using System.Runtime.InteropServices;

public class HotkeyNative {
  public const int MOD_ALT = 0x0001;
  public const int MOD_CONTROL = 0x0002;
  public const int MOD_SHIFT = 0x0004;
  public const int WM_HOTKEY = 0x0312;

  [StructLayout(LayoutKind.Sequential)]
  public struct MSG {
    public IntPtr hwnd;
    public uint message;
    public UIntPtr wParam;
    public IntPtr lParam;
    public uint time;
    public int pt_x;
    public int pt_y;
  }

  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool RegisterHotKey(IntPtr hWnd, int id, int fsModifiers, int vk);

  [DllImport("user32.dll", SetLastError = true)]
  public static extern bool UnregisterHotKey(IntPtr hWnd, int id);

  [DllImport("user32.dll")]
  public static extern sbyte GetMessage(out MSG lpMsg, IntPtr hWnd, uint wMsgFilterMin, uint wMsgFilterMax);
}
"@

Add-Type -TypeDefinition $source -ErrorAction Stop

$hotkeyId = Get-Random -Minimum 1000 -Maximum 30000
$keyCode = [int][char]$Key.ToUpperInvariant()[0]
$modifierMask = 0
foreach ($modifier in $Modifiers) {
  if ($modifier -eq 'Alt') {
    $modifierMask = $modifierMask -bor [HotkeyNative]::MOD_ALT
  }
  if ($modifier -eq 'Control' -or $modifier -eq 'Ctrl') {
    $modifierMask = $modifierMask -bor [HotkeyNative]::MOD_CONTROL
  }
  if ($modifier -eq 'Shift') {
    $modifierMask = $modifierMask -bor [HotkeyNative]::MOD_SHIFT
  }
}

$registered = [HotkeyNative]::RegisterHotKey([IntPtr]::Zero, $hotkeyId, $modifierMask, $keyCode)

if (-not $registered) {
  $errorCode = [Runtime.InteropServices.Marshal]::GetLastWin32Error()
  [Console]::Error.WriteLine("RegisterHotKey failed for $($Modifiers -join '+')+$Key. Win32Error=$errorCode")
  exit 1
}

try {
  $message = New-Object HotkeyNative+MSG
  while ([HotkeyNative]::GetMessage([ref]$message, [IntPtr]::Zero, 0, 0) -ne 0) {
    if ($message.message -eq [HotkeyNative]::WM_HOTKEY -and $message.wParam.ToUInt32() -eq $hotkeyId) {
      $parent = Split-Path -Parent $SignalPath
      if ($parent -and -not (Test-Path -LiteralPath $parent)) {
        New-Item -ItemType Directory -Force -Path $parent | Out-Null
      }
      [System.IO.File]::WriteAllText($SignalPath, [DateTimeOffset]::Now.ToUnixTimeMilliseconds().ToString(), [System.Text.Encoding]::UTF8)
    }
  }
}
finally {
  [HotkeyNative]::UnregisterHotKey([IntPtr]::Zero, $hotkeyId) | Out-Null
}
