# Portable Windows guide

The portable ZIP is a no-installer way to run Knox Atlas. It contains the application executable,
release notes, and license. It does not create shortcuts or a Windows uninstall entry.

## Run the portable build

1. Download `Knox-Atlas-<version>-Windows-x64-portable.zip` from the
   [official GitHub Releases page](https://github.com/TheMysticTurtle/Knox-Atlas/releases) or the
   Knox Atlas page on Nexus Mods.
2. Right-click the ZIP and choose **Extract All**. Do not run the executable from the ZIP preview.
3. Move the extracted folder to a writable location where it can remain.
4. Run `Knox-Atlas.exe` and keep `README.txt` and `LICENSE.txt` with it.

The portable executable reads Project Zomboid in place. It does not need to be copied into the
game folder or the Project Zomboid `mods` directory.

## Game installation selection

Knox Atlas checks the standard Steam installation and every library listed in Steam's
`libraryfolders.vdf`. The usual Windows location is:

```text
C:\Program Files (x86)\Steam\steamapps\common\ProjectZomboid
```

If the game is elsewhere, click **Local game source** in the lower-left corner and choose the
`ProjectZomboid` folder itself. A valid folder contains `projectzomboid.jar` and `media\maps`.

## Where markers and paths are stored

Portable describes how the program is delivered; it does not mean that user settings are written
beside the EXE. Knox Atlas stores markers, saved paths, the preferred map view, and the selected game
folder in its WebView profile under the current Windows account:

```text
%LOCALAPPDATA%\com.pzcompanion.map\
```

This has a few useful consequences:

- closing, moving, or replacing the extracted portable folder does not normally remove saved map
  items;
- the installer and portable build share the same saved map items on the same Windows account;
- another Windows account or another computer starts with separate app storage;
- clearing the Knox Atlas/WebView profile can remove markers, paths, and preferences.

Knox Atlas does not yet have built-in export/import. For a best-effort manual backup, close every
Knox Atlas window, open `%LOCALAPPDATA%` in File Explorer, and copy the complete
`com.pzcompanion.map` folder somewhere safe. Restore it only while Knox Atlas is closed. Keeping the
whole folder together is safer than copying individual LevelDB files from inside it.

## Microsoft WebView2 requirement

The portable executable expects the Microsoft Edge WebView2 Evergreen Runtime to be installed. The
normal Knox Atlas installer checks for WebView2 through Tauri's installer flow, while the portable
ZIP cannot bootstrap it for you.

Download WebView2 only from Microsoft's
[official WebView2 Runtime page](https://developer.microsoft.com/en-us/microsoft-edge/webview2/).
The Evergreen Bootstrapper is the smallest online installer; Microsoft also provides an Evergreen
Standalone Installer for offline use.

On 64-bit Windows, either the machine-wide or current-user `pv` value below should report a version
greater than `0.0.0.0`. A missing-key message for one command is fine if the other command reports a
version.

Command Prompt:

```bat
reg query "HKLM\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" /v pv
reg query "HKCU\Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}" /v pv
```

PowerShell:

```powershell
$webView2Id = '{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
Get-ItemProperty -Path "HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\$webView2Id", "HKCU:\Software\Microsoft\EdgeUpdate\Clients\$webView2Id" -Name pv -ErrorAction SilentlyContinue | Select-Object PSPath, pv
```

These locations and the `pv` test come from Microsoft's
[WebView2 distribution documentation](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution#detect-if-a-webview2-runtime-is-already-installed).

## Update or remove the portable copy

To update, close Knox Atlas, extract the new ZIP, and replace the old extracted application folder.
The per-user map items remain separate as described above. To remove only the program, close it and
delete the extracted folder. Delete `%LOCALAPPDATA%\com.pzcompanion.map` separately only if you also
intend to remove its saved map items and preferences.

Vortex users should follow the [Vortex guide](vortex.md) and register the extracted EXE as a tool;
the portable ZIP should not be deployed as a Project Zomboid mod.
