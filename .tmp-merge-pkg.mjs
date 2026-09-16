import fs from "node:fs";

const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));

pkg.scripts.build =
  "npm run sync:dsh-version && npm run build:packages && npm run generate:pi-ai-catalog && npm run generate:extensions-manifest && npm run generate:prompts-manifest && npm run generate:skills-manifest && npm run runtime:pack && npm run runtime:check && npm run check:xueprompts && tsc --noEmit --skipLibCheck --incremental && electron-vite build";
pkg.scripts["build:fast"] =
  "npm run generate:pi-ai-catalog && npm run generate:extensions-manifest && npm run generate:prompts-manifest && npm run generate:skills-manifest && electron-vite build";
pkg.scripts["runner-node:pack"] = "node scripts/pack-dsh-runner-node.mjs";
pkg.scripts["generate:prompts-manifest"] =
  "node scripts/generate-content-manifests.mjs --domain prompts";
pkg.scripts["check:prompts-manifest"] =
  "node scripts/generate-content-manifests.mjs --domain prompts --check";
pkg.scripts["generate:skills-manifest"] =
  "node scripts/generate-content-manifests.mjs --domain skills";
pkg.scripts["check:skills-manifest"] =
  "node scripts/generate-content-manifests.mjs --domain skills --check";
pkg.scripts["dist:linux:arm64"] =
  "npm run build && electron-builder --linux AppImage deb tar.gz --arm64";

const orderHint = [
  "dev",
  "build",
  "build:packages",
  "build:fast",
  "build:main",
  "runtime:pack",
  "runner-node:pack",
  "sync:dsh-version",
  "runtime:pack:lite",
  "runtime:check",
  "runtime:check:boot",
  "generate:pi-ai-catalog",
  "check:pi-ai-catalog",
  "generate:extensions-manifest",
  "check:extensions-manifest",
  "generate:prompts-manifest",
  "check:prompts-manifest",
  "generate:skills-manifest",
  "check:skills-manifest",
  "build:announcements",
  "check:announcements",
  "check:xueprompts",
  "check:dsh-wire",
  "pack:dev",
  "pack",
  "dist",
  "dist:win",
  "dist:win:dev",
  "dist:fast",
  "dist:mac",
  "dist:linux",
  "dist:linux:arm64",
  "preview",
  "test",
  "test:serial",
  "docs:dev",
  "docs:build",
  "docs:preview",
  "postinstall",
  "typecheck",
  "make-icon",
  "compile-exe",
  "test:e2e",
  "e2e",
  "verify",
  "probe:dsh",
];
const ordered = {};
for (const k of orderHint) {
  if (pkg.scripts[k]) ordered[k] = pkg.scripts[k];
}
for (const k of Object.keys(pkg.scripts)) {
  if (!(k in ordered)) ordered[k] = pkg.scripts[k];
}
pkg.scripts = ordered;

pkg.dependencies.koffi = "^3.2.1";
const depOrder = [
  "@electron-toolkit/utils",
  "@larksuiteoapi/node-sdk",
  "electron-updater",
  "ignore",
  "koffi",
  "minimatch",
  "node-pty",
  "sql.js",
  "tar",
  "undici",
];
const deps = {};
for (const k of depOrder) {
  if (pkg.dependencies[k]) deps[k] = pkg.dependencies[k];
}
for (const k of Object.keys(pkg.dependencies)) {
  if (!(k in deps)) deps[k] = pkg.dependencies[k];
}
pkg.dependencies = deps;

if (!pkg.build.files.includes("!node_modules/@larksuiteoapi/node-sdk/es/**")) {
  pkg.build.files.push("!node_modules/@larksuiteoapi/node-sdk/es/**");
}

const hasPrompts = pkg.build.extraResources.some((x) => x.from === "resources/prompts");
if (!hasPrompts) {
  const skillsIdx = pkg.build.extraResources.findIndex((x) => x.from === "resources/skills");
  const entry = { from: "resources/prompts", to: "prompts", filter: ["**/*"] };
  if (skillsIdx >= 0) pkg.build.extraResources.splice(skillsIdx + 1, 0, entry);
  else pkg.build.extraResources.push(entry);
}

if (pkg.name !== "telos" || pkg.build.appId !== "app.telos.desktop" || pkg.build.productName !== "Telos") {
  throw new Error("identity corrupted");
}
if (pkg.build.publish.owner !== "gygy" || pkg.build.publish.repo !== "telos") {
  throw new Error("publish corrupted");
}
if (pkg.build.nsis.shortcutName !== "Telos") throw new Error("shortcutName corrupted");
if (!pkg.homepage.includes("gygy/telos")) throw new Error("homepage corrupted");

fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2) + "\n");
console.log("package.json updated OK");
