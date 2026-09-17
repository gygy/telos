/**
 * One-shot: rewrite product-name "PiDeck" → "Telos" under src/.
 * Preserves upstream repo URLs, on-disk `.pideck` paths, pi-deck-* extension ids,
 * and migrateLegacyPideck* identifiers.
 */
import fs from "node:fs";
import path from "node:path";

const root = "src";
const exts = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".html", ".css"]);

function shouldPreserveLine(line) {
	if (/ayuayue\/PiDeck/.test(line)) return true;
	if (/github\.com\/[^/\s]+\/PiDeck/.test(line)) return true;
	if (/atomgit\.com\/[^/\s]+\/PiDeck/.test(line)) return true;
	if (/raw\.githubusercontent\.com\/[^/\s]+\/PiDeck/.test(line)) return true;
	if (/\.pideck\b/.test(line)) return true;
	if (/migrateLegacyPideck/.test(line)) return true;
	if (/pideckDshHome/.test(line)) return true;
	if (/\/pideck-plugin\b/.test(line)) return true;
	if (/pi-deck-/.test(line)) return true;
	if (/f-PiDeck/.test(line)) return true;
	if (/F:[\\/]+PiDeck/.test(line)) return true;
	return false;
}

function transformLine(line) {
	if (shouldPreserveLine(line)) return line;
	let out = line;
	out = out.replaceAll("stripPiDeckTodoWidgetMetadata", "stripTelosTodoWidgetMetadata");
	out = out.replaceAll("PiDeckWordmarkCanvasProps", "TelosWordmarkCanvasProps");
	out = out.replaceAll("PiDeckWordmarkCanvas", "TelosWordmarkCanvas");
	out = out.replaceAll("shellMenu.openWithPiDeck", "shellMenu.openWithTelos");
	out = out.replaceAll("[PiDeck preload]", "[Telos preload]");
	out = out.replaceAll("[PiDeck]", "[Telos]");
	out = out.replaceAll("PiDeck-content-updater", "Telos-content-updater");
	out = out.replaceAll("PiDeck-extensions-updater", "Telos-extensions-updater");
	out = out.replaceAll("PiDeck-owned", "Telos-owned");
	out = out.replaceAll("PiDeck's", "Telos's");
	out = out.replaceAll("PiDeck’s", "Telos’s");
	out = out.replaceAll("PiDeck", "Telos");
	out = out.replaceAll("Pideck", "Telos");
	return out;
}

function walk(dir, files = []) {
	for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
		const p = path.join(dir, ent.name);
		if (ent.isDirectory()) {
			if (ent.name === "node_modules" || ent.name === "dist" || ent.name === "out") continue;
			walk(p, files);
		} else if (exts.has(path.extname(ent.name))) {
			files.push(p);
		}
	}
	return files;
}

const files = walk(root);
let changedFiles = 0;
let changedLines = 0;
for (const file of files) {
	const raw = fs.readFileSync(file, "utf8");
	if (!/PiDeck|Pideck|stripPiDeck|PiDeckWordmark|openWithPiDeck|\[PiDeck/.test(raw)) continue;
	const nl = raw.includes("\r\n") ? "\r\n" : "\n";
	const next = raw
		.split(/\r?\n/)
		.map((line) => {
			const t = transformLine(line);
			if (t !== line) changedLines += 1;
			return t;
		})
		.join(nl);
	if (next !== raw) {
		fs.writeFileSync(file, next, "utf8");
		changedFiles += 1;
		console.log("updated", file);
	}
}

for (const file of ["tests/agentTodoList.test.mjs"]) {
	if (!fs.existsSync(file)) continue;
	const raw = fs.readFileSync(file, "utf8");
	const next = raw.replaceAll("stripPiDeckTodoWidgetMetadata", "stripTelosTodoWidgetMetadata");
	if (next !== raw) {
		fs.writeFileSync(file, next, "utf8");
		changedFiles += 1;
		console.log("updated", file);
	}
}

console.log(JSON.stringify({ changedFiles, changedLines }, null, 2));
