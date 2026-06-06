# Roblox Studio Icons (Custom)

This is a local Cursor/VS Code icon-theme extension for this Roblox project. It started as a fork of `EnderexDev/Roblox-Studio-Icons` and adds project-specific icons, safe packaging scripts, and live folder-name syncing from Roblox `init.meta.json` files.

## Purpose

- Provide Roblox Studio-style file and folder icons in Cursor's Explorer.
- Keep two icon themes available: `roblox-studio-argon` and `roblox-studio-rojo-azul`.
- Apply custom icons for project folders such as `roblox` and `backend`.
- Apply instance icons to folder-backed Roblox instances by scanning `init.meta.json` files and generating folder-name mappings.

Cursor/VS Code icon themes cannot choose icons directly from file contents. This extension works around that limitation by reading `init.meta.json`, then writing explicit folder-name mappings into `fileicons/argon.json` and `fileicons/rojo-azul.json`.

## Important Files

- `package.json` - extension metadata, commands, activation events, and safe scripts.
- `extension.js` - runtime watcher that syncs folder mappings when `init.meta.json` files change.
- `fileicons/argon.json` - Argon icon theme definition.
- `fileicons/rojo-azul.json` - Rojo/Azul icon theme definition.
- `fileicons/icons/` - PNGs that are actually shipped in the extension.
- `scripts/static-folder-names.json` - static folder-name mappings such as `roblox` and `backend`.
- `scripts/sync-folder-names.mjs` - CLI wrapper that regenerates folder mappings before packaging.
- `lib/sync-folder-names.cjs` - shared sync implementation used by both CLI and runtime extension.
- `scripts/validate-extension.mjs` - validates references, icons, and package safety.
- `scripts/safe-package-install.mjs` - preferred package/install workflow for Cursor.
- `AGENTS.md` - required safety notes for future AI agents.

## Adding Icons

### Folder By Exact Name

1. Put the PNG in `fileicons/icons/`.
2. Add an icon definition to both theme JSON files if needed.
3. Add the folder name to `scripts/static-folder-names.json`.

Example: `backend` maps to `_database`, which points at `fileicons/icons/database.png`.

### Folder-Backed Roblox Instance

1. Put a PNG named after the Roblox class in `fileicons/icons/`, for example `RemoteEvent.png`.
2. Run the sync script:

```powershell
npm run sync-folder-names
```

Folders containing `init.meta.json` with matching `className` values will be added to `folderNames`.

## Safe Install Workflow

Use the safe script instead of manually installing VSIX files:

```powershell
npm run safe-package-install
```

This syncs mappings, validates the extension, bumps the package version, packages the VSIX, installs it into Cursor, verifies the installed icon files, and restores `workbench.iconTheme` to `roblox-studio-argon`.

After install, reload Cursor with **Developer: Reload Window**.

## Agent Safety

Before changing, packaging, or installing this extension, read [`AGENTS.md`](AGENTS.md). Bad packages can break Cursor's extension host when this icon theme is active.

## Compatibility

- Cursor
- Visual Studio Code-compatible icon themes
- Rojo, Azul, and Argon project layouts

## License

MIT
