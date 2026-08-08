# Vortex and Nexus Mods guide

Knox Atlas works alongside Vortex as a standalone Windows tool. It is not an in-game Project
Zomboid mod and should not be deployed into the game installation or `mods` directory.

## Nexus download setting

Publish the Windows installer and portable ZIP as **Manual Download** files on Nexus Mods. Do not
label either archive as a Vortex-installable Project Zomboid mod. A normal Vortex mod installation
extracts and deploys files into the managed game's mod path, which is the wrong destination for Knox
Atlas.

No Vortex `info.json`, installer script, or game-extension package belongs in the Knox Atlas release
archives. Those files describe a Vortex extension, not a standalone companion application.

## Add Knox Atlas to the Vortex dashboard

Users who want to launch Knox Atlas from Vortex can register it as a tool:

1. Install Knox Atlas normally or extract the portable ZIP.
2. In Vortex, open **Dashboard** and choose **Add Tool**.
3. Set **Target** to the Knox Atlas executable.
4. Confirm **Start In** is the folder containing that executable.
5. Name the tool **Knox Atlas** and save it.

Typical targets are:

```text
Installer: %LOCALAPPDATA%\Knox Atlas\knox-atlas.exe
Portable:  <your extracted folder>\Knox-Atlas.exe
```

Vortex documents this same manual workflow for regular Windows GUI tools in its
[official user FAQ](https://github.com/Nexus-Mods/Vortex/wiki/MODDINGWIKI-Users-FAQ#how-do-i-add-a-tool-to-vortex).

Knox Atlas does not require Vortex to discover Project Zomboid. It reads Steam's configured library
folders itself, and its lower-left **Local game source** card can select another valid
`ProjectZomboid` installation.

## Why the release stays outside Vortex deployment

Vortex separates archive installation from deployment and links managed mod files into the game
directory. Its game-extension documentation likewise describes installer output as files placed in
the game's mod location. Knox Atlas deliberately reads the game but never installs into or modifies
it, so dashboard-tool registration preserves the application's read-only boundary.

References:

- [Vortex user FAQ: adding a tool](https://github.com/Nexus-Mods/Vortex/wiki/MODDINGWIKI-Users-FAQ#how-do-i-add-a-tool-to-vortex)
- [Vortex game-extension and installer behavior](https://github.com/Nexus-Mods/Vortex/wiki/MODDINGWIKI-Developers-General-Creating-a-game-extension)
- [Vortex source repository](https://github.com/Nexus-Mods/Vortex)

## Future integration boundary

Automatic tool discovery would require cooperation with the maintained Project Zomboid Vortex game
extension or a separate reviewed Vortex extension. That is optional convenience work, not a runtime
dependency, and should only be pursued if user demand justifies maintaining another integration.
