# Agent Notes

This repository is a Cursor/VS Code icon-theme extension. Small packaging mistakes can make Cursor unstable when `workbench.iconTheme` points at this extension, so follow this protocol before changing, packaging, or installing it.

## What This Fork Is For

This is a customized fork of the Roblox Studio icon theme extension used by the parent workspace. It is not just the upstream theme anymore:

- It ships Roblox Studio-style PNG icons from `fileicons/icons/`.
- It contributes the `roblox-studio-argon` and `roblox-studio-rojo-azul` icon themes.
- It adds project-specific folder icons such as `roblox` and `backend`.
- It has a runtime extension (`extension.js`) that watches Roblox `init.meta.json` files and regenerates folder-name mappings.
- It has safety scripts for validation, packaging, version bumping, installation, and post-install verification.

Do not treat this as a generic static icon pack. Changes can affect Cursor globally because the user's Cursor setting points `workbench.iconTheme` at `roblox-studio-argon`.

## Platform Limitation

Cursor/VS Code icon themes cannot select a folder icon by reading files inside the folder. The Explorer only consumes static icon-theme mappings such as:

- folder name
- file name
- file extension

For Roblox folders that represent instances, this extension bridges the gap by scanning `init.meta.json` files, reading `className`, and writing explicit folder-name mappings into:

- `fileicons/argon.json`
- `fileicons/rojo-azul.json`

This means the runtime behavior is still folder-name based. If two folders in different locations share the same name but represent different classes, that is a conflict. The sync code logs conflicts and skips unstable duplicate mappings.

## Architecture

- `package.json`
  - extension identity: `bmealey2005.roblox-studio-icon-theme-custom`
  - icon theme IDs: `roblox-studio-argon`, `roblox-studio-rojo-azul`
  - runtime entry: `extension.js`
  - command: `robloxStudioIcons.syncFolderNames`
  - scripts: `sync-folder-names`, `validate`, `package`, `safe-package-install`
- `extension.js`
  - activates when a workspace contains `roblox/src/**/init.meta.json` or `src/**/init.meta.json`
  - watches `init.meta.json` files
  - runs the shared sync code after debounce
  - notifies the user when mappings change and a reload is needed
- `lib/sync-folder-names.cjs`
  - shared implementation used by runtime and CLI
  - discovers class icons by scanning PascalCase PNG names in `fileicons/icons/`
  - scans Roblox source roots for `init.meta.json`
  - merges generated mappings with static mappings
  - writes theme JSON only when content changes
- `scripts/sync-folder-names.mjs`
  - thin CLI wrapper around `lib/sync-folder-names.cjs`
- `scripts/static-folder-names.json`
  - manually curated folder-name mappings that should always apply
  - static mappings override generated mappings
- `scripts/validate-extension.mjs`
  - validates JSON references, icons, `.vscodeignore`, and forbidden staging folders
- `scripts/safe-package-install.mjs`
  - preferred end-to-end package/install workflow

## Icon Conventions

- Icons that should ship must be PNG files in `fileicons/icons/`.
- Class-based icons must use the exact Roblox class name in PascalCase, for example:
  - `BindableEvent.png`
  - `RemoteEvent.png`
  - `RemoteFunction.png`
- Static folder icons can use any filename, but the icon key must exist in both theme JSON files.
- Staging/source folders such as `addittions/` are for temporary source assets only. They must stay ignored and must not be packaged.
- If replacing an existing icon from `addittions/`, copy it into `fileicons/icons/` and verify the shipped file, not the staging source.

## Current Custom Mapping Patterns

- `roblox` folder -> `_roblox` -> `fileicons/icons/roblox.png`
- `backend` folder -> `_database` -> `fileicons/icons/database.png`
- folders with `init.meta.json` class `BindableEvent` -> `_bindable_event`
- folders with `init.meta.json` class `RemoteEvent` -> `_remote_event`
- folders with `init.meta.json` class `RemoteFunction` -> `_remote_function`

Use `scripts/static-folder-names.json` for exact folder names such as `roblox` or `backend`. Use PascalCase class PNGs in `fileicons/icons/` for `init.meta.json`-driven mappings.

## Safety Rules

- Do not edit installed extension files under `.cursor/extensions` directly.
- Do not place scratch assets in the extension root unless they are excluded by `.vscodeignore`.
- Replacement icons that should ship must live in `fileicons/icons/` and must be referenced by `fileicons/argon.json` and/or `fileicons/rojo-azul.json`.
- Staging folders such as `addittions/`, `additions/`, `temp/`, `scratch/`, and `source-icons/` must never be included in a VSIX.
- Always bump the package version before installing a changed VSIX. Reinstalling different contents with the same version makes it hard to tell what Cursor loaded.
- After uninstalling/reinstalling this extension, verify `workbench.iconTheme` is still set to `roblox-studio-argon` in Cursor user settings.
- Keep `explorer.compactFolders` disabled in Cursor user settings if the user relies on visually separating container folders from single-child instance folders.

## Preferred Workflow

Use the safe script instead of manually packaging and installing:

```powershell
npm run safe-package-install
```

This script:

- syncs folder-name mappings from Roblox `init.meta.json` files
- validates icon theme JSON references
- bumps the patch version in `package.json`
- builds the VSIX
- verifies the VSIX does not contain forbidden staging folders
- installs the VSIX into Cursor
- verifies the installed extension contains packaged PNG icons
- restores `workbench.iconTheme` to `roblox-studio-argon`

If you only need to validate source files without packaging:

```powershell
npm run validate
```

If you only need to build an installable package:

```powershell
npm run package
```

`npm run package` also syncs mappings, validates source files, and bumps the patch version before packaging.

## Manual Workflow If Needed

Only use this when the safe script is not appropriate:

1. Stage any new PNGs that should ship.
2. Run `npm run sync-folder-names`.
3. Run `npm run validate`.
4. Bump `package.json` version.
5. Run `npx @vscode/vsce package --allow-missing-repository`.
6. Inspect the VSIX output and confirm `fileicons/icons/ (N files)` is present.
7. Install with `cursor --install-extension <vsix> --force`.
8. Remove stale installed versions under `.cursor/extensions`.
9. Run the post-install checks below.

## Post-Install Checks

Before telling the user to reload Cursor, verify the install on disk:

```powershell
$p = "$env:USERPROFILE\.cursor\extensions\bmealey2005.roblox-studio-icon-theme-custom-<version>"
Test-Path $p
(Get-ChildItem "$p\fileicons\icons" -Filter *.png).Count
Test-Path "$p\addittions"
Test-Path "$p\additions"
```

Expected:

- the installed extension folder exists
- the icon count is non-zero and matches the packaged icon count
- forbidden staging folders are absent
- the current package version is the only installed `bmealey2005.roblox-studio-icon-theme-custom-*` folder
- key custom icons such as `BindableEvent.png`, `RemoteEvent.png`, `RemoteFunction.png`, `roblox.png`, and `database.png` exist when expected

## Why These Rules Exist

This extension previously made Cursor unstable after packaging or installing bad extension contents. Known failure modes:

- installing a VSIX that omitted `fileicons/icons/*.png`
- bundling scratch/staging folders into the VSIX
- reinstalling changed files under the same extension version
- relying on Cursor reloads before verifying the installed extension folder

The validation and safe-install scripts are intended to catch those cases before Cursor loads the extension.

## What Not To Do

- Do not declare success just because `cursor --install-extension` printed a success message.
- Do not reload Cursor before verifying the installed extension folder.
- Do not add a `files` allowlist to `package.json` while `.vscodeignore` exists; VSCE rejects using both strategies together.
- Do not remove `.vscodeignore` unless you replace it with an equivalent package safety mechanism.
- Do not map container folders such as `BindableEvents` to instance icons unless the user explicitly asks for that. Explorer compact folders can make a parent/child row look like the parent has the child icon.
- Do not assume `init.meta.json` content can be matched directly by the icon theme. The sync step must generate folder-name mappings.
