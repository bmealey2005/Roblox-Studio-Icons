#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const extensionRoot = path.resolve(__dirname, "..");
const packageJsonPath = path.join(extensionRoot, "package.json");

function bumpPatch(version) {
  const parts = version.split(".").map((part) => Number.parseInt(part, 10));
  if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
    throw new Error(`Expected semver patch version, got: ${version}`);
  }

  parts[2] += 1;
  return parts.join(".");
}

const pkg = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
const previousVersion = pkg.version;
pkg.version = bumpPatch(previousVersion);
fs.writeFileSync(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);

console.log(`${previousVersion} -> ${pkg.version}`);
