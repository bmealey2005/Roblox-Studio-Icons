# Agent Notes

This repository is a Cursor/VS Code icon-theme extension. Small packaging mistakes can make Cursor unstable when `workbench.iconTheme` points at this extension, so follow this protocol before changing, packaging, or installing it.

## Safety Rules

- Do not edit installed extension files under `.cursor/extensions` directly.
- Do not place scratch assets in the extension root unless they are excluded by `.vscodeignore`.
- Replacement icons that should ship must live in `fileicons/icons/` and must be referenced by `fileicons/argon.json` and/or `fileicons/rojo-azul.json`.
- Staging folders such as `addittions/`, `additions/`, `temp/`, `scratch/`, and `source-icons/` must never be included in a VSIX.
- Always bump the package version before installing a changed VSIX. Reinstalling different contents with the same version makes it hard to tell what Cursor loaded.
- After uninstalling/reinstalling this extension, verify `workbench.iconTheme` is still set to `roblox-studio-argon` in Cursor user settings.

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

## Why These Rules Exist

This extension previously made Cursor unstable after packaging or installing bad extension contents. Known failure modes:

- installing a VSIX that omitted `fileicons/icons/*.png`
- bundling scratch/staging folders into the VSIX
- reinstalling changed files under the same extension version
- relying on Cursor reloads before verifying the installed extension folder

The validation and safe-install scripts are intended to catch those cases before Cursor loads the extension.
