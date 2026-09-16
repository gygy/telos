import { execSync } from "node:child_process";
import fs from "node:fs";

const base = "4ab3beea370e83cb79d52aa314537c277b4c4f55";
const tip = "pideck/main";
const out = execSync(`git diff --name-status ${base}..${tip}`, { encoding: "utf8" });
const addMod = [];
const del = [];
for (const line of out.split(/\r?\n/)) {
	if (!line.trim()) continue;
	const m = line.match(/^([AMDCR])\d*\t(.+?)(?:\t(.+))?$/);
	if (!m) {
		console.error("unparsed", line);
		continue;
	}
	const st = m[1];
	if (st === "D") del.push(m[2].replace(/^"|"$/g, ""));
	else {
		const path = (st === "R" || st === "C" ? m[3] : m[2]).replace(/^"|"$/g, "");
		addMod.push(path);
	}
}
fs.writeFileSync(".upstream/sync-addmod-all.txt", `${addMod.join("\n")}\n`);
fs.writeFileSync(".upstream/sync-del-all.txt", `${del.join("\n")}\n`);
console.log(JSON.stringify({ addMod: addMod.length, del: del.length, sampleDel: del.slice(0, 15) }));
