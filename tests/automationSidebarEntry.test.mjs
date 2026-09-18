import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

// 用户反馈：三行「新建 / 搜索 / 定时任务」占列表高度；应收进顶栏图标。
const appSidebar = readFileSync("src/renderer/src/components/sidebar/AppSidebar.tsx", "utf8");
const sidebarContent = readFileSync("src/renderer/src/components/sidebar/SidebarContent.tsx", "utf8");

test("new/search/automation live in the brand toolbar as icon actions", () => {
	assert.match(appSidebar, /aria-label=\{t\("app\.newSession"\)\}/);
	assert.match(appSidebar, /aria-label=\{t\("app\.searchSessions"\)\}/);
	assert.match(appSidebar, /<AutomationDockButton/);
	assert.match(appSidebar, /CirclePlus/);
	assert.match(appSidebar, /list-toolbar[\s\S]*Search[\s\S]*AutomationDockButton[\s\S]*PanelLeft/);
});

test("sidebar body no longer hosts the tall new/search/automation block", () => {
	assert.doesNotMatch(sidebarContent, /AutomationDockButton/);
	assert.doesNotMatch(sidebarContent, /aria-label=\{t\("app\.newSession"\)\}/);
	assert.doesNotMatch(sidebarContent, /MorphingSearch/);
});

test("dock no longer hosts the automation entry", () => {
	const dockIndex = sidebarContent.indexOf("<Dock size={32}");
	assert.ok(dockIndex > -1, "dock section missing");
	assert.doesNotMatch(sidebarContent.slice(dockIndex), /AutomationDockButton/);
});

test("automation management is a modal, not a workbench-covering surface", () => {
	const app = readFileSync("src/renderer/src/App.tsx", "utf8");

	// 定时任务以模态弹框呈现：App 挂 AutomationModal，不再有覆盖会话区的 utility surface
	assert.match(app, /<AutomationModal/);
	assert.doesNotMatch(app, /<AutomationWorkspace/);
	assert.doesNotMatch(app, /utility=\{\{\s*active:/);
	assert.doesNotMatch(app, /workspaceSurface/);
});

test("automation dock button defaults to compact icon in the toolbar", () => {
	const button = readFileSync(
		"src/renderer/src/components/automation/AutomationDockButton.tsx",
		"utf8",
	);
	assert.match(button, /variant \?\? "icon"/);
	assert.match(button, /size="icon-sm"/);
});
