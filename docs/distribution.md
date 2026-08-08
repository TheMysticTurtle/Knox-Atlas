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

- `ci.yml` runs frontend compilation, Rust formatting, and Rust tests on pushes to `main` and pull requests.
- `release-windows.yml` is a manual release workflow. It builds the NSIS installer, creates/updates a draft GitHub release named from `tauri.conf.json`, uploads build artifacts, and adds a best-effort portable ZIP.

To publish a release:

1. Keep the version synchronized in `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`, and `src-tauri/tauri.conf.json`.
2. Merge/push the intended code to GitHub.
3. Open **Actions → Publish Windows release → Run workflow**.
4. Download and smoke-test both artifacts from the draft release.
5. Edit the generated notes and publish the draft when ready.

Repeated runs at the same app version update the same draft tag. Bump the version before starting a distinct testing round.

## Installer versus portable

| Format | Recommendation | Notes |
| --- | --- | --- |
| NSIS `-setup.exe` | Preferred | Normal install/uninstall experience; can bootstrap WebView2 when required. |
| Portable ZIP | Optional | Contains the plain app executable and notes; Tauri does not officially support portable mode. |

Both builds are currently unsigned. Windows SmartScreen may warn testers because the publisher has no signing reputation. This is acceptable for a few informed testers; obtain a Windows code-signing certificate before broad public distribution.

## WebView2

Tauri uses Microsoft WebView2 on Windows. The installer can handle machines where it is missing. The plain portable executable assumes a compatible runtime is already available.

## Repository prerequisite

GitHub Actions only runs after this local repository has a GitHub remote and its branches are pushed. Check with:

```powershell
git remote -v
```

At the time this guide was written, the local repository had no configured remote.

## Official references

- [Tauri Windows installer documentation](https://v2.tauri.app/distribute/windows-installer/)
- [Official Tauri GitHub Action](https://github.com/tauri-apps/tauri-action)
