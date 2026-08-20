# Windows launch and distribution

## Local development launcher

Double-click `Launch Knox Atlas.cmd` at the repository root. It checks for Node/npm and Rust, installs frontend packages when needed, and runs the Tauri dev session in the foreground.

Keep the launcher window open while testing. Closing it or pressing Ctrl+C stops Vite and the native app together, which avoids disconnected preview windows.

The normal command remains:

```powershell
npm run desktop:dev
```

## Local installer build

```powershell
npm ci
npm run desktop:build
```

The configured Windows bundle is an NSIS `-setup.exe` installer under:

```text
src-tauri/target/release/bundle/nsis/
```

NSIS is the recommended format for early testers: one familiar executable, current-user installation by default, and normal Windows shortcuts/uninstall behavior.

## GitHub Actions

Two workflows live in `.github/workflows/`:

- `ci.yml` automatically runs frontend compilation, Rust formatting, and Rust tests on every pushed branch and pull request.
- `release-windows.yml` is a manual release workflow. It repeats those checks, builds the NSIS installer, creates/updates a draft GitHub release named from `tauri.conf.json`, and packages a best-effort portable ZIP. It validates and uploads both downloads explicitly as workflow artifacts and as draft-release assets.

To publish a release:

1. Keep the version synchronized in `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, and `src-tauri/tauri.conf.json`.
2. Merge/push the intended code to GitHub.
3. Open **Actions → Publish Windows release → Run workflow**.
4. Download and smoke-test both artifacts from the draft release.
5. Edit the generated notes and publish the draft when ready.

Repeated runs at the same app version update the same draft tag. Bump the version before starting a distinct testing round.

The installer staging step requires exactly one generated NSIS `.exe`; the workflow fails clearly if packaging produces none or more than one. Both release uploads use `--clobber`, so rerunning a corrected workflow repairs the existing draft instead of creating duplicate assets.

When the draft is published, GitHub automatically adds source-code ZIP and TAR archives for the release tag. The repository license and release notes identify the source as available under PolyForm Strict 1.0.0, so a separate source-packaging step is unnecessary. Tauri includes the license in the installer bundle, and the portable ZIP includes `LICENSE.txt`.

## Installer versus portable

| Format | Recommendation | Notes |
| --- | --- | --- |
| NSIS `-setup.exe` | Preferred | Normal install/uninstall experience; can bootstrap WebView2 when required. |
| Portable ZIP | Optional | Contains the plain app executable and notes; expects WebView2 to be installed and keeps user data in the Windows profile. |

Both builds are currently unsigned. Windows SmartScreen may warn testers because the publisher has no signing reputation. This is acceptable for a few informed testers; obtain a Windows code-signing certificate before broad public distribution.

## WebView2

Tauri uses Microsoft WebView2 on Windows. The NSIS installer uses Tauri's default
`downloadBootstrapper` behavior, which checks for the runtime and downloads the bootstrapper when it
is missing. The plain portable executable cannot perform that installer step and assumes a
compatible Evergreen Runtime is already available.

Use Microsoft's [official WebView2 Runtime page](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)
for the Evergreen Bootstrapper or Standalone Installer.

On 64-bit Windows, Microsoft documents the following machine and per-user registry checks. Either
`pv` value is sufficient when it reports a version greater than `0.0.0.0`.

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

See Microsoft's [runtime detection documentation](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution#detect-if-a-webview2-runtime-is-already-installed).

## Portable user data

Both artifacts are built from the same Tauri identifier, `com.pzcompanion.map`. WebView2 therefore
keeps their local storage under the same per-user profile:

```text
%LOCALAPPDATA%\com.pzcompanion.map\
```

The current version stores custom markers, saved measurement paths, one preferred camera view, and
an optional preferred game-install path there. Replacing or moving the portable application folder
does not normally remove those records. Different Windows accounts or computers do not share them,
and clearing the WebView profile removes them.

There is no supported export/import command yet. The documented best-effort backup is to close Knox
Atlas and copy the complete `com.pzcompanion.map` folder. Do not copy individual live LevelDB files.
See [Portable Windows guide](portable.md).

## Nexus Mods and Vortex

Knox Atlas is a standalone companion tool. Publish the installer and portable ZIP as manual Nexus
downloads; neither archive should be deployed through Vortex as a Project Zomboid mod.

Portable users can still launch Knox Atlas from Vortex:

1. Extract the ZIP normally.
2. Open **Vortex → Dashboard → Add Tool**.
3. Set **Target** to the extracted `Knox-Atlas.exe`.
4. Confirm **Start In** is the executable folder, name it **Knox Atlas**, and save.

No Vortex extension manifest is packaged. Automatic tool discovery would require a separately
maintained Vortex extension or coordination with the Project Zomboid game extension. See
[Vortex and Nexus Mods guide](vortex.md).

## Repository prerequisite

GitHub Actions only runs after this local repository has a GitHub remote and its branches are pushed. Check with:

```powershell
git remote -v
```

The project repository is hosted at
[TheMysticTurtle/Knox-Atlas](https://github.com/TheMysticTurtle/Knox-Atlas).

## Official references

- [Tauri Windows installer documentation](https://v2.tauri.app/distribute/windows-installer/)
- [Official Tauri GitHub Action](https://github.com/tauri-apps/tauri-action)
- [Microsoft WebView2 Runtime download](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)
- [Microsoft WebView2 runtime detection](https://learn.microsoft.com/en-us/microsoft-edge/webview2/concepts/distribution#detect-if-a-webview2-runtime-is-already-installed)
- [Vortex user FAQ: adding a tool](https://github.com/Nexus-Mods/Vortex/wiki/MODDINGWIKI-Users-FAQ#how-do-i-add-a-tool-to-vortex)
