import { execSync } from "node:child_process";
import fs from "node:fs";

const up = fs.readFileSync(".tmp-index-up.ts", "utf8");
const head = fs.readFileSync(".tmp-index-head.ts", "utf8");

const markers = [
  "appShortcuts",
  "promptStoreUpdater",
  "skillStoreUpdater",
  "CursorSessionImporter",
  "v8HeapLimits",
  "ImageBlobStore",
  "ImageGenImageProtocol",
  "dshRuntimeReleaseTarget",
  "dshRuntimeManifest",
  "configureSkillOverlay",
  "installPideckDoctor",
  "registerAppShortcuts",
  "createPromptStoreUpdater",
  "createSkillStoreUpdater",
  "applyV8HeapLimits",
  "contentStore",
  "shortcut",
  "cursor",
  "runnerNode",
  "dshRunnerNode",
];

for (const m of markers) {
  const re = new RegExp(`^.*${m}.*$`, "gmi");
  const lines = up.match(re) || [];
  if (lines.length === 0) continue;
  console.log(`\n===== ${m} (${lines.length}) =====`);
  for (const l of lines.slice(0, 40)) console.log(l);
  if (lines.length > 40) console.log(`... +${lines.length - 40} more`);
}

// Also dump unified diff filtered to non-branding? too big.
// Write a file with line numbers of differing regions via LCS-ish: just use git diff
const diff = execSync("git diff --no-color --unified=3 HEAD pideck/main -- src/main/index.ts", {
  encoding: "utf8",
  maxBuffer: 30 * 1024 * 1024,
});
fs.writeFileSync(".tmp-index.diff", diff);
console.log("\ndiff bytes", diff.length);
