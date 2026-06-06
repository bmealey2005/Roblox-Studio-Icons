const { access, readdir, readFile, writeFile } = require("node:fs/promises");
const path = require("node:path");

const DEFAULT_THEME_FILES = {
  argon: path.join("fileicons", "argon.json"),
  "rojo-azul": path.join("fileicons", "rojo-azul.json"),
};

function classNameToIconKey(className) {
  return (
    "_" +
    className
      .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
      .toLowerCase()
  );
}

function sortObject(obj) {
  return Object.fromEntries(
    Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)),
  );
}

async function pathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function listClassIconFiles(iconsDir) {
  const entries = await readdir(iconsDir, { withFileTypes: true });
  const classIcons = new Map();

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".png")) {
      continue;
    }

    const className = entry.name.slice(0, -4);
    if (!/^[A-Z]/.test(className)) {
      continue;
    }

    classIcons.set(className, {
      iconKey: classNameToIconKey(className),
      fileName: entry.name,
    });
  }

  return classIcons;
}

async function walkInitMetaFiles(dir) {
  const results = [];

  async function walk(current) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        await walk(fullPath);
      } else if (entry.isFile() && entry.name === "init.meta.json") {
        results.push(fullPath);
      }
    }
  }

  await walk(dir);
  return results;
}

async function scanInstanceFolders(robloxSrcRoots, classIcons, logger = console) {
  const folderMappings = new Map();
  const conflicts = [];
  const scannedRoots = [];

  for (const robloxSrc of robloxSrcRoots) {
    if (!(await pathExists(robloxSrc))) {
      logger.warn?.(`Skipping missing Roblox source root: ${robloxSrc}`);
      continue;
    }

    scannedRoots.push(robloxSrc);
    const metaFiles = await walkInitMetaFiles(robloxSrc);

    for (const metaPath of metaFiles) {
      let parsed;
      try {
        parsed = JSON.parse(await readFile(metaPath, "utf8"));
      } catch (error) {
        logger.warn?.(
          `Skipping unreadable meta file: ${metaPath} (${error.message})`,
        );
        continue;
      }

      const className = parsed?.className;
      if (typeof className !== "string" || className.length === 0) {
        continue;
      }

      const icon = classIcons.get(className);
      if (!icon) {
        continue;
      }

      const folderName = path.basename(path.dirname(metaPath));
      const existing = folderMappings.get(folderName);
      if (existing && existing.iconKey !== icon.iconKey) {
        conflicts.push({
          folderName,
          existingClass: existing.className,
          newClass: className,
          metaPath,
        });
        continue;
      }

      folderMappings.set(folderName, {
        iconKey: icon.iconKey,
        className,
        metaPath,
      });
    }
  }

  return { folderMappings, conflicts, scannedRoots };
}

function ensureIconDefinitions(theme, classIcons) {
  for (const { iconKey, fileName } of classIcons.values()) {
    if (!theme.iconDefinitions[iconKey]) {
      theme.iconDefinitions[iconKey] = {
        iconPath: `./icons/${fileName}`,
      };
    }
  }
}

async function writeJsonIfChanged(filePath, value) {
  const next = `${JSON.stringify(value, null, 2)}\n`;
  const previous = await readFile(filePath, "utf8");
  if (previous === next) {
    return false;
  }

  await writeFile(filePath, next, "utf8");
  return true;
}

async function syncFolderNames(options = {}) {
  const extensionRoot = options.extensionRoot ?? path.resolve(__dirname, "..");
  const logger = options.logger ?? console;
  const fileiconsDir =
    options.fileiconsDir ?? path.join(extensionRoot, "fileicons");
  const iconsDir = options.iconsDir ?? path.join(fileiconsDir, "icons");
  const staticConfigPath =
    options.staticConfigPath ??
    path.join(extensionRoot, "scripts", "static-folder-names.json");
  const themeFiles = options.themeFiles ?? DEFAULT_THEME_FILES;
  const robloxSrcRoots = (
    Array.isArray(options.robloxSrcRoots)
      ? options.robloxSrcRoots
      : [options.robloxSrc ?? path.resolve(extensionRoot, "..", "roblox", "src")]
  ).map((root) => path.resolve(root));

  const staticConfig = JSON.parse(await readFile(staticConfigPath, "utf8"));
  const classIcons = await listClassIconFiles(iconsDir);
  const { folderMappings, conflicts, scannedRoots } =
    await scanInstanceFolders(robloxSrcRoots, classIcons, logger);

  if (conflicts.length > 0) {
    logger.warn?.(
      "Folder name conflicts (skipped duplicate names with different classes):",
    );
    for (const conflict of conflicts) {
      logger.warn?.(
        `  ${conflict.folderName}: ${conflict.existingClass} vs ${conflict.newClass} (${conflict.metaPath})`,
      );
    }
  }

  const generated = Object.fromEntries(
    [...folderMappings.entries()].map(([folderName, value]) => [
      folderName,
      value.iconKey,
    ]),
  );

  logger.log?.(`Scanned: ${scannedRoots.join(", ") || "(none)"}`);
  logger.log?.(
    `Class icons available: ${
      [...classIcons.keys()].sort().join(", ") || "(none)"
    }`,
  );
  logger.log?.(`Generated folder mappings: ${Object.keys(generated).length}`);

  const changedThemeFiles = [];

  for (const [themeKey, relativeThemePath] of Object.entries(themeFiles)) {
    const themePath = path.isAbsolute(relativeThemePath)
      ? relativeThemePath
      : path.join(extensionRoot, relativeThemePath);
    const staticNames = staticConfig[themeKey] ?? {};
    const theme = JSON.parse(await readFile(themePath, "utf8"));

    ensureIconDefinitions(theme, classIcons);

    const merged = { ...generated, ...staticNames };
    for (const folderName of Object.keys(staticNames)) {
      if (generated[folderName] && generated[folderName] !== staticNames[folderName]) {
        logger.warn?.(
          `Static mapping overrides generated mapping for "${folderName}" in ${themeKey}`,
        );
      }
    }

    theme.folderNames = sortObject(merged);

    if (await writeJsonIfChanged(themePath, theme)) {
      changedThemeFiles.push(themePath);
      logger.log?.(`Updated ${path.relative(extensionRoot, themePath)}`);
    } else {
      logger.log?.(`No changes for ${path.relative(extensionRoot, themePath)}`);
    }
  }

  return {
    changed: changedThemeFiles.length > 0,
    changedThemeFiles,
    classIconNames: [...classIcons.keys()].sort(),
    conflicts,
    generatedCount: Object.keys(generated).length,
    scannedRoots,
  };
}

module.exports = {
  classNameToIconKey,
  syncFolderNames,
};
