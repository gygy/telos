import fs from "node:fs";

const diff = fs.readFileSync(".tmp-index.diff", "utf8");
const lines = diff.split(/\r?\n/);

// Summarize hunks: file headers + @@ lines with first changed-line preview
let hunk = 0;
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.startsWith("@@")) {
    hunk++;
    const preview = [];
    for (let j = i + 1; j < Math.min(i + 8, lines.length); j++) {
      if (lines[j].startsWith("@@") || lines[j].startsWith("diff ")) break;
      if (lines[j].startsWith("+") || lines[j].startsWith("-")) preview.push(lines[j].slice(0, 120));
    }
    console.log(`\n#${hunk} ${line}`);
    for (const p of preview) console.log("  ", p);
  }
}
console.log(`\nTotal hunks: ${hunk}`);
