#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionRoot = path.resolve(__dirname, "..");
const packageJsonPath = path.join(extensionRoot, "package.json");
const cursorExtensionsDir = path.join(os.homedir(), ".cursor", "extensions");
const cursorSettingsPath = path.join(
  process.env.APPDATA ?? path.join(os.homedir(), "AppData", "Roaming"),
  "Cursor",
  "User",
  "settings.json",
);

const forbiddenVsixPrefixes = ["extension/addittions/", "extension/additions/", "extension/temp/", "extension/scratch/", "extension/source-icons/"];

function run(command, args, options = {}) {
  console.log(`> ${command} ${args.join(" ")}`);
  execFileSync(command, args, {
    cwd: extensionRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });
}

function capture(command, args) {
  return execFileSync(command, args, {
    cwd: extensionRoot,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
}

function tryRun(command, args) {
  try {
    run(command, args);
  } catch (error) {
    console.warn(`Command failed but was non-critical: ${command} ${args.join(" ")}`);
    console.warn(error.message);
  }
}

function readPackageJson() {
  return JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
}

function listVsixEntries(vsixPath) {
  const script = [
    "Add-Type -AssemblyName System.IO.Compression.FileSystem",
    `$zip=[System.IO.Compression.ZipFile]::OpenRead(${JSON.stringify(vsixPath)})`,
    "try { $zip.Entries | ForEach-Object { \"$($_.FullName)|$($_.Length)\" } } finally { $zip.Dispose() }",
  ].join("; ");

  return capture("powershell", ["-NoProfile", "-Command", script])
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => {
      const [fullName, length] = line.split("|");
      return { fullName, length: Number.parseInt(length, 10) };
    });
}

function assertVsixContents(vsixPath, pkg) {
  const entries = listVsixEntries(vsixPath);
  const entryNames = entries.map((entry) => entry.fullName);
  const iconEntries = entryNames.filter((name) => name.startsWith("extension/fileicons/icons/"));

  if (iconEntries.length === 0) {
    throw new Error("VSIX contains no packaged icon files.");
  }

  for (const prefix of forbiddenVsixPrefixes) {
    const leaked = entryNames.filter((name) => name.startsWith(prefix));
    if (leaked.length > 0) {
      throw new Error(`VSIX contains forbidden package entries: ${leaked.join(", ")}`);
    }
  }

  const expectedPackageName = `roblox-studio-icon-theme-custom-${pkg.version}.vsix`;
  if (path.basename(vsixPath) !== expectedPackageName) {
    throw new Error(`Expected VSIX name ${expectedPackageName}, got ${path.basename(vsixPath)}`);
  }

  console.log(`VSIX verified: ${entryNames.length} entries, ${iconEntries.length} icons.`);
}

function extensionInstallPath(pkg) {
  return path.join(cursorExtensionsDir, `${pkg.publisher}.${pkg.name}-${pkg.version}`);
}

function assertInstalledExtension(pkg) {
  const installPath = extensionInstallPath(pkg);
  const iconsPath = path.join(installPath, "fileicons", "icons");

  if (!fs.existsSync(installPath)) {
    throw new Error(`Installed extension folder missing: ${installPath}`);
  }
  if (!fs.existsSync(iconsPath)) {
    throw new Error(`Installed icons folder missing: ${iconsPath}`);
  }

  const icons = fs.readdirSync(iconsPath).filter((name) => name.endsWith(".png"));
  if (icons.length === 0) {
    throw new Error("Installed extension has no PNG icons.");
  }

  for (const forbidden of ["addittions", "additions", "temp", "scratch", "source-icons"]) {
    const candidate = path.join(installPath, forbidden);
    if (fs.existsSync(candidate)) {
      throw new Error(`Installed extension contains forbidden folder: ${candidate}`);
    }
  }

  console.log(`Install verified: ${installPath}`);
  console.log(`Installed PNG icons: ${icons.length}`);
}

function restoreIconTheme() {
  if (!fs.existsSync(cursorSettingsPath)) {
    console.warn(`Cursor settings not found, skipped icon theme restore: ${cursorSettingsPath}`);
    return;
  }

  const settings = JSON.parse(fs.readFileSync(cursorSettingsPath, "utf8"));
  settings["workbench.iconTheme"] = "roblox-studio-argon";
  fs.writeFileSync(cursorSettingsPath, `${JSON.stringify(settings, null, 4)}\n`);
  console.log("Restored workbench.iconTheme to roblox-studio-argon.");
}

function main() {
  run("node", ["scripts/sync-folder-names.mjs"]);
  run("node", ["scripts/validate-extension.mjs"]);
  run("node", ["scripts/bump-version.mjs"]);

  const pkg = readPackageJson();
  run("npx", ["--yes", "@vscode/vsce", "package", "--allow-missing-repository"]);

  const vsixPath = path.join(extensionRoot, `${pkg.name}-${pkg.version}.vsix`);
  assertVsixContents(vsixPath, pkg);

  tryRun("cursor", ["--uninstall-extension", `${pkg.publisher}.${pkg.name}`]);
  run("cursor", ["--install-extension", vsixPath]);

  assertInstalledExtension(pkg);
  restoreIconTheme();
}

try {
  main();
} catch (error) {
  console.error(error?.stack ?? String(error));
  process.exit(1);
}
