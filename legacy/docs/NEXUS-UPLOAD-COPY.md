# Nexus Mods upload copy

Ready-to-paste text for the Nexus Mods short-description field and the description attached to each downloadable file. The complete formatted page description lives in [NEXUS-DESCRIPTION.bbcode](NEXUS-DESCRIPTION.bbcode).

Keep these links near the top of the Nexus page:

- GitHub source and documentation: https://github.com/TheMysticTurtle/Knox-Atlas
- Official GitHub releases: https://github.com/TheMysticTurtle/Knox-Atlas/releases

## Short description

```text
A read-only Project Zomboid interactive map with game-derived places, filters, coordinates, custom markers, and saved distance paths.
```

## Windows installer file

Suggested display name:

```text
Knox Atlas 0.1.1 — Windows Installer
```

Suggested file description:

```text
Download and run the setup EXE, follow the Windows prompts, then launch Knox Atlas from its normal shortcut. This installs the app and adds a standard Windows uninstall entry. You do not need the portable ZIP as well.

Knox Atlas is currently unsigned, so Windows SmartScreen may show an Unknown publisher warning. Please download only from this Nexus page or the official GitHub Releases page, and run it only if you are comfortable doing so.
```

## Portable Windows file

Suggested display name:

```text
Knox Atlas 0.1.1 — Portable Windows ZIP
```

Suggested file description:

```text
Portable no-installer package. Download the ZIP, choose Extract All, move the extracted folder somewhere writable, and run Knox-Atlas.exe from that folder. Do not run it from inside the ZIP preview, and keep the included files together.

The portable build does not create shortcuts or an uninstall entry and requires Microsoft WebView2 to already be installed. To remove it, close Knox Atlas and delete the extracted folder. You do not need the installer as well.

Knox Atlas saves markers, paths, the preferred view, and the selected game folder automatically in the current Windows account's app storage, not beside the portable EXE. Moving or replacing the extracted folder does not normally remove those items. See the portable guide for WebView2 check commands, the official Microsoft download, and backup details: https://github.com/TheMysticTurtle/Knox-Atlas/blob/main/docs/portable.md

Vortex users: choose Manual Download and extract the ZIP normally. In Vortex, open Dashboard, choose Add Tool, and set Target to the extracted Knox-Atlas.exe. Confirm Start In points to the same folder, name the tool Knox Atlas, and save it. Do not deploy the ZIP into Project Zomboid's game or Mods folder.
```

## Nexus/Vortex file settings

- Publish both downloads as normal **Manual Download** files.
- Do not advertise either package as a Vortex-deployable Project Zomboid mod.
- The portable EXE may be registered through **Vortex → Dashboard → Add Tool** after extraction.
- Link the full compatibility guide: https://github.com/TheMysticTurtle/Knox-Atlas/blob/main/docs/vortex.md

## Official links

- Source, documentation, and issue tracker: https://github.com/TheMysticTurtle/Knox-Atlas
- Official GitHub releases: https://github.com/TheMysticTurtle/Knox-Atlas/releases
- License: https://github.com/TheMysticTurtle/Knox-Atlas/blob/main/LICENSE
