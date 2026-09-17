import fs from "node:fs";

const p = "src/shared/i18n/mainProcessCopy.ts";
let s = fs.readFileSync(p, "utf8");
const before = s;
s = s.replace(
	/(\t"shellMenu\.openWithTelos": "[^"]+",\r?\n)\t"shellMenu\.openWithTelos": "[^"]+",\r?\n/g,
	"$1",
);
fs.writeFileSync(p, s);
console.log("changed", s !== before, "count", [...s.matchAll(/openWithTelos/g)].length);
