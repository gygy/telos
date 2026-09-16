import fs from "node:fs";
import { execSync } from "node:child_process";

function gitShow(refPath) {
  return execSync(`git show ${refPath}`, { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
}

function imports(s) {
  const out = [];
  const re = /^import .+ from ["']([^"']+)["']/gm;
  let m;
  while ((m = re.exec(s))) out.push(m[1]);
  return out;
}

const head = gitShow("HEAD:src/main/index.ts");
const up = gitShow("pideck/main:src/main/index.ts");
const cur = fs.readFileSync("src/main/index.ts", "utf8");
fs.writeFileSync(".tmp-index-head.ts", head);
fs.writeFileSync(".tmp-index-up.ts", up);

const hi = new Set(imports(head));
const ui = new Set(imports(up));
const ci = new Set(imports(cur));

console.log("ONLY UPSTREAM IMPORTS:");
for (const x of [...ui].filter((x) => !hi.has(x)).sort()) console.log(" ", x);
console.log("ONLY TELOS IMPORTS:");
for (const x of [...hi].filter((x) => !ui.has(x)).sort()) console.log(" ", x);
console.log("CUR ADDED VS HEAD:");
for (const x of [...ci].filter((x) => !hi.has(x)).sort()) console.log(" ", x);

for (const m of [
  "setName",
  "setAppUserModelId",
  "telos-doctor",
  "installTelosDoctor",
  "installPideckDoctor",
  "gygy/telos",
  "ayuayue/PiDeck",
  "app.telos",
  "Telos",
  "PiDeck",
  "SkillStoreUpdater",
  "PromptStoreUpdater",
  "builtinContentUpdater",
  "registerShortcut",
  "Automation",
  "dshRunnerNode",
  "CursorSession",
  "applyV8Heap",
]) {
  const rh = new RegExp(m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
  console.log(
    m,
    "H",
    (head.match(rh) || []).length,
    "U",
    (up.match(rh) || []).length,
    "C",
    (cur.match(rh) || []).length,
  );
}
