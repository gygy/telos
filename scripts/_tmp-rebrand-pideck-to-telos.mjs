/**
 * One-shot: replace product branding PiDeck → Telos in text files.
 * Skips upstream sync docs/scripts and restores intentional exceptions.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const ROOTS = ["src", "scripts", "announcements-md", "tests", "docs", "docs-site"];
const EXTRA_FILES = ["README.md", "README.en.md", "package.json", "AGENTS.md", "CHANGELOG.md", "CHANGELOG.zh-CN.md"];

const SKIP_FILES = new Set([
	path.join(root, "scripts", "sync-from-pideck.ps1"),
	path.join(root, "scripts", "_tmp-rebrand-pideck-to-telos.mjs"),
	path.join(root, "TELOS-UPSTREAM.md"),
]);

const SKIP_DIR_NAMES = new Set([".upstream", "node_modules", "dist", "out", ".git"]);

const TEXT_EXT = new Set([
	".ts",
	".tsx",
	".js",
	".mjs",
	".cjs",
	".css",
	".md",
	".json",
	".html",
	".yml",
	".yaml",
	".txt",
	".ps1",
	".sh",
]);

/** After PiDeck→Telos, restore these exact upstream/repo attributions. */
const RESTORE = [
	// Function name must stay for wire/compat (user instruction)
	["stripTelosTodoWidgetMetadata", "stripPiDeckTodoWidgetMetadata"],
	// Upstream GitHub / AtomGit repo paths
	["github.com/ayuayue/Telos", "github.com/ayuayue/PiDeck"],
	["atomgit.com/ayuayue/Telos", "atomgit.com/ayuayue/PiDeck"],
	["ayuayue.github.io/Telos", "ayuayue.github.io/PiDeck"],
	// Upstream package / org refs that should keep historical name in sync docs only —
	// README may say "based on PiDeck"; restore common patterns if bulk flipped them
	["based on Telos", "based on PiDeck"],
	["upstream Telos", "upstream PiDeck"],
	["上游 Telos", "上游 PiDeck"],
	["只读 `ayuayue/Telos`", "只读 `ayuayue/PiDeck`"],
	["`ayuayue/Telos`", "`ayuayue/PiDeck`"],
	["GitHub `ayuayue/Telos`", "GitHub `ayuayue/PiDeck`"],
];

function shouldSkipDir(name) {
	return SKIP_DIR_NAMES.has(name);
}

function walk(dir, out = []) {
	if (!fs.existsSync(dir)) return out;
	for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
		if (ent.name.startsWith(".") && ent.name !== ".vitepress") {
			if (shouldSkipDir(ent.name)) continue;
		}
		if (shouldSkipDir(ent.name)) continue;
		const full = path.join(dir, ent.name);
		if (ent.isDirectory()) walk(full, out);
		else if (TEXT_EXT.has(path.extname(ent.name).toLowerCase()) || ent.name === "README") {
			out.push(full);
		}
	}
	return out;
}

const files = [];
for (const rel of ROOTS) {
	walk(path.join(root, rel), files);
}
for (const rel of EXTRA_FILES) {
	const full = path.join(root, rel);
	if (fs.existsSync(full)) files.push(full);
}

let changed = 0;
const touched = [];

for (const file of files) {
	if (SKIP_FILES.has(file)) continue;
	// Never touch binary-ish or huge fixtures unnecessarily — still text replace if PiDeck present
	let text;
	try {
		text = fs.readFileSync(file, "utf8");
	} catch {
		continue;
	}
	if (!text.includes("PiDeck") && !text.includes("openWithPiDeck")) continue;

	let next = text.split("PiDeck").join("Telos");
	// openWithPiDeck → openWithTelos happens via PiDeck→Telos inside the key

	for (const [from, to] of RESTORE) {
		if (next.includes(from)) next = next.split(from).join(to);
	}

	// README product title: keep one upstream attribution sentence intact after restore rules
	if (path.basename(file) === "README.md" || path.basename(file) === "README.en.md") {
		// Ensure product name is Telos in titles that became wrong
		// (restores already handled based-on / ayuayue repo links)
	}

	if (next !== text) {
		fs.writeFileSync(file, next, "utf8");
		changed++;
		touched.push(path.relative(root, file));
	}
}

console.log(`Updated ${changed} files`);
for (const f of touched.sort()) console.log(`  ${f}`);
