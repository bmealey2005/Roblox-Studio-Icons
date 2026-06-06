#!/usr/bin/env node
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const { syncFolderNames } = require("../lib/sync-folder-names.cjs");

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionRoot = path.resolve(__dirname, "..");
const robloxSrc = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve(extensionRoot, "..", "roblox", "src");

syncFolderNames({
  extensionRoot,
  robloxSrc,
}).catch((error) => {
  console.error(error);
  process.exit(1);
});
