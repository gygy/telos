import { execSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const tmp = os.tmpdir();
const files = [
	{
		rel: "src/renderer/src/i18n/rendererCopy.zh-CN.ts",
		bak: path.join(tmp, "telos-zh-bak.ts"),
	},
	{
		rel: "src/renderer/src/i18n/rendererCopy.en-US.ts",
		bak: path.join(tmp, "telos-en-bak.ts"),
	},
];

function extractKeys(src) {
	const keys = new Set();
	const re = /^  "([^"]+)":/gm;
	let m;
	while ((m = re.exec(src))) keys.add(m[1]);
	return keys;
}

for (const f of files) {
	const head = execSync(`git show HEAD:${f.rel}`, { encoding: "utf8" });
	fs.writeFileSync(f.bak, head);
	execSync(`git checkout pideck/main -- ${f.rel}`, { stdio: "inherit" });
	let s = fs.readFileSync(f.rel, "utf8");
	s = s.replaceAll("PiDeck", "Telos");
	s = s.replaceAll("pideck-doctor", "telos-doctor");
	s = s.replaceAll("ayuayue/Telos", "gygy/telos");
	fs.writeFileSync(f.rel, s);
	const curKeys = extractKeys(s);
	const bakKeys = extractKeys(head);
	const only = [...bakKeys].filter((k) => !curKeys.has(k));
	console.log(f.rel, "brand rewritten; telos-only keys left unrestored:", only.length, only.slice(0, 15));
}
