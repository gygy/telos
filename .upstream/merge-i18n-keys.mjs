/**
 * Merge missing i18n keys from pideck/main into Telos rendererCopy files.
 * Preserves existing Telos values; only inserts keys that local lacks.
 * Also rewrites inserted values' product name PiDeck → Telos.
 */
import { execSync } from "node:child_process";
import fs from "node:fs";

function parseEntries(src) {
	const entries = [];
	const re = /^  ("(?:\\.|[^"\\])+"):\s*((?:.|\n)*?)(?=,\n  "|\n\};\n?$)/gm;
	let m;
	while ((m = re.exec(src))) {
		entries.push({ key: JSON.parse(m[1]), rawKey: m[1], valueSrc: m[2].trim() });
	}
	return entries;
}

function telosify(valueSrc) {
	return valueSrc
		.replaceAll("PiDeck", "Telos")
		.replaceAll("pideck-doctor", "telos-doctor")
		.replaceAll("/skill:pideck-doctor", "/skill:telos-doctor");
}

function mergeFile(localPath, upstreamRef) {
	const local = fs.readFileSync(localPath, "utf8");
	const upstream = execSync(`git show ${upstreamRef}`, { encoding: "utf8" });
	const localEntries = parseEntries(local);
	const upEntries = parseEntries(upstream);
	const localKeys = new Set(localEntries.map((e) => e.key));
	const missing = upEntries.filter((e) => !localKeys.has(e.key));
	if (missing.length === 0) {
		console.log(`${localPath}: no missing keys`);
		return;
	}
	const insertBlock = missing
		.map((e) => `  ${e.rawKey}: ${telosify(e.valueSrc)},`)
		.join("\n");
	// Insert before closing `};`
	const next = local.replace(/\n\};\s*$/, `\n${insertBlock}\n};\n`);
	fs.writeFileSync(localPath, next);
	console.log(`${localPath}: inserted ${missing.length} keys`);
}

mergeFile(
	"src/renderer/src/i18n/rendererCopy.zh-CN.ts",
	"pideck/main:src/renderer/src/i18n/rendererCopy.zh-CN.ts",
);
mergeFile(
	"src/renderer/src/i18n/rendererCopy.en-US.ts",
	"pideck/main:src/renderer/src/i18n/rendererCopy.en-US.ts",
);
