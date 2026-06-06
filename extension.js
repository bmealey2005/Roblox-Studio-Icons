const fs = require("node:fs");
const path = require("node:path");
const vscode = require("vscode");
const { syncFolderNames } = require("./lib/sync-folder-names.cjs");

const SYNC_COMMAND = "robloxStudioIcons.syncFolderNames";
const DEBOUNCE_MS = 1500;
const ACTIVATION_DELAY_MS = 3000;

let syncRunning = false;
let syncQueued = false;

function findRobloxSourceRoots() {
  const roots = [];

  for (const workspaceFolder of vscode.workspace.workspaceFolders ?? []) {
    const workspacePath = workspaceFolder.uri.fsPath;
    const candidates = [
      path.join(workspacePath, "roblox", "src"),
      path.join(workspacePath, "src"),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        roots.push(candidate);
      }
    }
  }

  return [...new Set(roots)];
}

function createLogger(outputChannel) {
  return {
    log(message) {
      outputChannel.appendLine(message);
    },
    warn(message) {
      outputChannel.appendLine(`Warning: ${message}`);
    },
    error(message) {
      outputChannel.appendLine(`Error: ${message}`);
    },
  };
}

async function runSync(context, outputChannel, reason) {
  if (syncRunning) {
    syncQueued = true;
    outputChannel.appendLine(`Queued folder icon sync (${reason}).`);
    return;
  }

  syncRunning = true;
  const robloxSrcRoots = findRobloxSourceRoots();
  try {
    if (robloxSrcRoots.length === 0) {
      outputChannel.appendLine(
        `Skipping ${reason}: no roblox/src or src folder found in workspace.`,
      );
      return;
    }

    outputChannel.appendLine(`Running folder icon sync (${reason})...`);
    const result = await syncFolderNames({
      extensionRoot: context.extensionPath,
      robloxSrcRoots,
      logger: createLogger(outputChannel),
    });

    if (result.conflicts.length > 0) {
      outputChannel.show(true);
    }

    if (result.changed) {
      vscode.window.showInformationMessage(
        "Roblox Studio Icons mappings updated. Reload the window when convenient to apply icon changes.",
      );
    }
  } finally {
    syncRunning = false;
    if (syncQueued) {
      syncQueued = false;
      setTimeout(() => {
        runSync(context, outputChannel, "queued change").catch((error) => {
          outputChannel.appendLine(error?.stack ?? String(error));
          outputChannel.show(true);
        });
      }, DEBOUNCE_MS);
    }
  }
}

function activate(context) {
  const outputChannel = vscode.window.createOutputChannel(
    "Roblox Studio Icons",
  );
  context.subscriptions.push(outputChannel);

  const disposables = [];
  let debounceTimer;
  const scheduleSync = (reason, delay = DEBOUNCE_MS) => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
    }

    debounceTimer = setTimeout(() => {
      debounceTimer = undefined;
      runSync(context, outputChannel, reason).catch((error) => {
        outputChannel.appendLine(error?.stack ?? String(error));
        outputChannel.show(true);
      });
    }, delay);
  };

  context.subscriptions.push(
    vscode.commands.registerCommand(SYNC_COMMAND, () =>
      runSync(context, outputChannel, "manual command").catch((error) => {
        outputChannel.appendLine(error?.stack ?? String(error));
        outputChannel.show(true);
      }),
    ),
  );

  scheduleSync("activation", ACTIVATION_DELAY_MS);

  for (const robloxSrcRoot of findRobloxSourceRoots()) {
    const pattern = new vscode.RelativePattern(robloxSrcRoot, "**/init.meta.json");
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    disposables.push(
      watcher,
      watcher.onDidCreate(() => scheduleSync("init.meta.json created")),
      watcher.onDidChange(() => scheduleSync("init.meta.json changed")),
      watcher.onDidDelete(() => scheduleSync("init.meta.json deleted")),
    );
  }

  context.subscriptions.push(...disposables);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
