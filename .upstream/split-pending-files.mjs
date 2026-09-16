import fs from "node:fs";

const files = fs
	.readFileSync(".upstream/pending-files.txt", "utf8")
	.split(/\r?\n/)
	.map((s) => s.trim().replace(/^"|"$/g, ""))
	.filter(Boolean);

const skipPrefixes = [
	"assets/star-history/",
	".github/",
	"CHANGELOG",
	"README",
	"docs-site/changelog",
	"docs/",
];

const overlays = new Set([
	"scripts/sync-from-pideck.ps1",
	"scripts/git-sync.ps1",
	"TELOS-UPSTREAM.md",
	".upstream/pideck-baseline.json",
	"README.md",
	"package.json",
	"src/renderer/src/App.tsx",
	"src/renderer/src/components/app/TelosLogo.tsx",
	"src/renderer/src/components/app/LogoMark.tsx",
	"src/renderer/src/components/app/AppParts.tsx",
	"src/renderer/src/components/app/AboutPopover.tsx",
	"src/renderer/src/components/app/brandMark.ts",
	"src/renderer/src/web/WebBrandLockup.tsx",
	"src/renderer/src/i18n/rendererCopy.zh-CN.ts",
	"src/renderer/src/i18n/rendererCopy.en-US.ts",
	"src/renderer/index.html",
	"src/renderer/src/styles/foundation.css",
	"build/icon.svg",
	"scripts/make-icon.js",
]);

const mergeCareful = new Set([
	"package.json",
	"package-lock.json",
	"src/main/index.ts",
	"src/renderer/src/App.tsx",
	"src/shared/updateSources.ts",
	"src/main/settings/SettingsStore.ts",
	"src/renderer/src/i18n/rendererCopy.zh-CN.ts",
	"src/renderer/src/i18n/rendererCopy.en-US.ts",
	"src/main/skills/SkillManager.ts",
	"AGENTS.md",
	"electron.vite.config.ts",
]);

const skip = [];
const careful = [];
const sync = [];

for (const f of files) {
	if (overlays.has(f) || mergeCareful.has(f)) {
		careful.push(f);
		continue;
	}
	if (skipPrefixes.some((p) => f.startsWith(p) || f.includes(p))) {
		skip.push(f);
		continue;
	}
	sync.push(f);
}

fs.writeFileSync(".upstream/sync-batch-safe.txt", `${sync.join("\n")}\n`);
fs.writeFileSync(".upstream/sync-batch-careful.txt", `${[...new Set(careful)].join("\n")}\n`);
fs.writeFileSync(".upstream/sync-batch-skip.txt", `${skip.join("\n")}\n`);
console.log({ total: files.length, sync: sync.length, careful: careful.length, skip: skip.length });
