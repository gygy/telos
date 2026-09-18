import assert from "node:assert/strict";
import test from "node:test";
import { loadTsCommonJs } from "./helpers/loadTsCommonJs.mjs";

const {
	FILE_TREE_ROW_HEIGHT_PX,
	flattenFileTreeVisibleRows,
	fileTreeVirtualWindow,
} = loadTsCommonJs("src/renderer/src/utils/fileTreeVisibleRows.ts");

function dir(name, path, children) {
	return {
		name,
		path,
		relativePath: name,
		type: "directory",
		hasChildren: children === undefined ? true : children.length > 0,
		children,
	};
}

function file(name, path) {
	return { name, path, relativePath: name, type: "file" };
}

test("flattenFileTreeVisibleRows only includes expanded branches", () => {
	const tree = [
		dir("src", "/src", [
			file("a.ts", "/src/a.ts"),
			dir("nested", "/src/nested", [file("b.ts", "/src/nested/b.ts")]),
		]),
		file("README.md", "/README.md"),
	];
	const keys = (rows) => rows.map((row) => row.key).join(",");
	assert.equal(keys(flattenFileTreeVisibleRows(tree, new Set())), "/src,/README.md");
	assert.equal(
		keys(flattenFileTreeVisibleRows(tree, new Set(["/src"]))),
		"/src,/src/a.ts,/src/nested,/README.md",
	);
	assert.equal(
		keys(flattenFileTreeVisibleRows(tree, new Set(["/src", "/src/nested"]))),
		"/src,/src/a.ts,/src/nested,/src/nested/b.ts,/README.md",
	);
});

test("flattenFileTreeVisibleRows inserts loading placeholder for unloaded expanded dirs", () => {
	const tree = [dir("src", "/src", undefined)];
	const rows = flattenFileTreeVisibleRows(tree, new Set(["/src"]));
	assert.equal(rows.length, 2);
	assert.equal(rows[1].kind, "loading");
	assert.equal(rows[1].depth, 1);
});

test("fileTreeVirtualWindow windows by scroll position with overscan", () => {
	const rowHeight = FILE_TREE_ROW_HEIGHT_PX;
	const win = fileTreeVirtualWindow(200, rowHeight * 50, rowHeight * 10, rowHeight, 2);
	assert.equal(win.totalHeight, 200 * rowHeight);
	assert.equal(win.start, 48);
	assert.equal(win.end, 62);
	assert.equal(win.offsetY, 48 * rowHeight);
});
