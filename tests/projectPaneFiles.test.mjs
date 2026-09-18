import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const app = readFileSync("src/renderer/src/App.tsx", "utf8");
const tree = readFileSync("src/renderer/src/components/sidebar/ProjectTree.tsx", "utf8");
const pane = readFileSync("src/renderer/src/components/sidebar/ProjectFilesPane.tsx", "utf8");
const panels = readFileSync("src/renderer/src/hooks/useWorkspacePanels.ts", "utf8");

test("current project swaps sessions and files in the left pane", () => {
	assert.match(tree, /ProjectPaneModeSwitch/);
	assert.match(tree, /paneMode === "files"/);
	assert.match(pane, /role="tablist"/);
	assert.match(pane, /app\.sidebarSessions/);
	assert.match(pane, /app\.files/);
	assert.match(app, /<ProjectFilesPane/);
});

test("folder rail switches the left pane instead of opening a files drawer", () => {
	const action = app.match(/handleToolDrawerAction = useCallback[\s\S]*?\}, \[workspace, gitDrawerDiff/)?.[0] ?? "";
	assert.match(action, /panel === "files"/);
	assert.match(action, /projectPaneModeAtom/);
	assert.doesNotMatch(action, /openDrawer\(panel\)[\s\S]*files/);
	assert.match(action, /if \(panel === "files"\)/);
	assert.match(panels, /saved\?\.panel === "files" \? null/);
});
