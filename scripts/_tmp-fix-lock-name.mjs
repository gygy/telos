import fs from "node:fs";
const p = new URL("../package-lock.json", import.meta.url);
let t = fs.readFileSync(p, "utf8");
const n = t.replaceAll('"name": "pi-desktop"', '"name": "telos"');
if (n !== t) {
	fs.writeFileSync(p, n);
	console.log("package-lock name → telos");
} else {
	console.log("package-lock already telos or pattern missing");
}
