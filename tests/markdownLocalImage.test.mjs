import assert from "node:assert/strict";
import test from "node:test";
import { loadTsCommonJs } from "./helpers/loadTsCommonJs.mjs";

const {
	dirnameOfFilePath,
	isPassthroughMarkdownImageSrc,
	resolveMarkdownImageFilePath,
} = loadTsCommonJs("src/renderer/src/utils/markdownLocalImage.ts");

test("dirnameOfFilePath keeps Windows drive root and POSIX root", () => {
	assert.equal(
		dirnameOfFilePath("G:\\gitea\\PRD\\LDCS\\doc.md"),
		"G:\\gitea\\PRD\\LDCS",
	);
	assert.equal(dirnameOfFilePath("C:\\doc.md"), "C:\\");
	assert.equal(dirnameOfFilePath("/home/u/doc.md"), "/home/u");
	assert.equal(dirnameOfFilePath("/doc.md"), "/");
});

test("isPassthroughMarkdownImageSrc allows remote and app schemes", () => {
	assert.equal(isPassthroughMarkdownImageSrc("https://x/a.png"), true);
	assert.equal(isPassthroughMarkdownImageSrc("data:image/png;base64,aa"), true);
	assert.equal(isPassthroughMarkdownImageSrc("blob:http://localhost/1"), true);
	assert.equal(isPassthroughMarkdownImageSrc("pideck-img://blob/a.png"), true);
	assert.equal(isPassthroughMarkdownImageSrc("./diagrams/a.png"), false);
	assert.equal(isPassthroughMarkdownImageSrc("../a.png"), false);
});

test("resolveMarkdownImageFilePath resolves relative to the markdown file", () => {
	const md = "G:\\gitea\\LDCScode\\PRD\\LDCS\\LDCS doc.md";
	assert.equal(
		resolveMarkdownImageFilePath(
			"./diagrams/forming-new-scheme/a.png",
			md,
		),
		"G:\\gitea\\LDCScode\\PRD\\LDCS\\diagrams\\forming-new-scheme\\a.png",
	);
	assert.equal(
		resolveMarkdownImageFilePath(
			"diagrams/forming-new-scheme/a.png",
			md,
		),
		"G:\\gitea\\LDCScode\\PRD\\LDCS\\diagrams\\forming-new-scheme\\a.png",
	);
	assert.equal(
		resolveMarkdownImageFilePath(
			"../shared/logo.png",
			md,
		),
		"G:\\gitea\\LDCScode\\PRD\\shared\\logo.png",
	);
});

test("resolveMarkdownImageFilePath accepts file:// and absolute paths", () => {
	assert.equal(
		resolveMarkdownImageFilePath(
			"file:///G:/gitea/LDCScode/PRD/LDCS/diagrams/a.png",
			"G:\\unused\\doc.md",
		),
		"G:\\gitea\\LDCScode\\PRD\\LDCS\\diagrams\\a.png",
	);
	assert.equal(
		resolveMarkdownImageFilePath(
			"G:\\gitea\\LDCScode\\PRD\\LDCS\\diagrams\\a.png",
			"G:\\unused\\doc.md",
		),
		"G:\\gitea\\LDCScode\\PRD\\LDCS\\diagrams\\a.png",
	);
	assert.equal(
		resolveMarkdownImageFilePath("https://example.com/a.png", "G:\\doc.md"),
		null,
	);
});
