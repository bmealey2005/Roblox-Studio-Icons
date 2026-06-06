#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionRoot = path.resolve(__dirname, "..");

const themeFiles = [
  path.join("fileicons", "argon.json"),
  path.join("fileicons", "rojo-azul.json"),
];

const requiredIgnoreEntries = [
  "*.vsix",
  ".git",
  ".gitignore",
  "addittions/",
  "additions/",
  "temp/",
  "scratch/",
  "source-icons/",
];

const forbiddenPackageDirs = ["addittions", "additions", "temp", "scratch", "source-icons"];

function fail(message) {
  throw new Error(message);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(extensionRoot, relativePath), "utf8"));
}

function assertFile(relativePath) {
  const fullPath = path.join(extensionRoot, relativePath);
  if (!fs.existsSync(fullPath) || !fs.statSync(fullPath).isFile()) {
    fail(`Missing file: ${relativePath}`);
  }
}

function validateIgnoreFile() {
  const ignorePath = path.join(extensionRoot, ".vscodeignore");
  assertFile(".vscodeignore");
  const entries = new Set(
    fs
      .readFileSync(ignorePath, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean),
  );

  for (const entry of requiredIgnoreEntries) {
    if (!entries.has(entry)) {
      fail(`.vscodeignore must include: ${entry}`);
    }
  }
}

function validatePackageJson() {
  const pkg = readJson("package.json");
  if (!pkg.name || !pkg.publisher || !pkg.version) {
    fail("package.json must include name, publisher, and version.");
  }
  if (!pkg.icon) {
    fail("package.json must include an icon field.");
  }
  assertFile(pkg.icon);
  return pkg;
}

function validateIcons() {
  const iconsDir = path.join(extensionRoot, "fileicons", "icons");
  if (!fs.existsSync(iconsDir) || !fs.statSync(iconsDir).isDirectory()) {
    fail("Missing fileicons/icons directory.");
  }

  const icons = fs.readdirSync(iconsDir).filter((name) => name.endsWith(".png"));
  if (icons.length === 0) {
    fail("fileicons/icons contains no PNG files.");
  }

  for (const icon of icons) {
    const fullPath = path.join(iconsDir, icon);
    if (fs.statSync(fullPath).size === 0) {
      fail(`Icon file is empty: fileicons/icons/${icon}`);
    }
  }

  return icons;
}

function validateThemeReferences() {
  const referencedIcons = new Set();

  for (const themeFile of themeFiles) {
    const theme = readJson(themeFile);
    if (!theme.iconDefinitions || typeof theme.iconDefinitions !== "object") {
      fail(`${themeFile} is missing iconDefinitions.`);
    }

    for (const [iconKey, definition] of Object.entries(theme.iconDefinitions)) {
      if (!definition || typeof definition.iconPath !== "string") {
        fail(`${themeFile} icon definition ${iconKey} is missing iconPath.`);
      }

      const iconPath = definition.iconPath.replaceAll("/", path.sep);
      const relativeIconPath = path.join("fileicons", iconPath);
      assertFile(relativeIconPath);
      referencedIcons.add(path.normalize(relativeIconPath));
    }

    for (const section of ["folderNames", "fileExtensions", "fileNames"]) {
      const mapping = theme[section] ?? {};
      for (const [name, iconKey] of Object.entries(mapping)) {
        if (!theme.iconDefinitions[iconKey]) {
          fail(`${themeFile} ${section}.${name} references missing icon key ${iconKey}.`);
        }
      }
    }
  }

  return referencedIcons;
}

function validateForbiddenPackageDirs() {
  for (const dir of forbiddenPackageDirs) {
    const candidate = path.join(extensionRoot, dir);
    if (fs.existsSync(candidate)) {
      const ignored = fs
        .readFileSync(path.join(extensionRoot, ".vscodeignore"), "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim());
      if (!ignored.includes(`${dir}/`)) {
        fail(`Staging directory exists but is not ignored: ${dir}/`);
      }
    }
  }
}

function main() {
  const pkg = validatePackageJson();
  const icons = validateIcons();
  const referencedIcons = validateThemeReferences();
  validateIgnoreFile();
  validateForbiddenPackageDirs();

  console.log(`Validated ${pkg.name}@${pkg.version}`);
  console.log(`PNG icons: ${icons.length}`);
  console.log(`Referenced icon files: ${referencedIcons.size}`);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
