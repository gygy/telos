import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const tabsBar = readFileSync("src/renderer/src/components/session/SessionTabsBar.tsx", "utf8");
const app = readFileSync("src/renderer/src/App.tsx", "utf8");
const composer = readFileSync("src/renderer/src/components/session/ComposerComponents.tsx", "utf8");
const settingsModal = readFileSync("src/renderer/src/components/app/SettingsModal.tsx", "utf8");
const hook = readFileSync("src/renderer/src/hooks/useWorkspacePanels.ts", "utf8");
const zh = readFileSync("src/renderer/src/i18n/rendererCopy.zh-CN.ts", "utf8");
const en = readFileSync("src/renderer/src/i18n/rendererCopy.en-US.ts", "utf8");

test("terminal and scratch pin to the session tab bar", () => {
	assert.match(tabsBar, /pinToBar\?: boolean/);
	assert.match(tabsBar, /pinnedToolActions/);
	assert.match(app, /id: "scratch"[\s\S]*?pinToBar: true/);
	assert.match(app, /id: "terminal"[\s\S]*?pinToBar: true/);
	assert.match(app, /id: "editors"/);
	assert.doesNotMatch(app, /id: "editors"[\s\S]{0,180}pinToBar: true/);
});

test("preview tabs explain pin behavior in the tooltip", () => {
	assert.match(tabsBar, /t\("tabs\.previewHint", \{ name: title \}\)/);
	assert.match(tabsBar, /t\("tabs\.previewHint", \{ name: tab\.title \?\? tab\.label \}\)/);
	assert.match(zh, /"tabs\.previewHint"/);
	assert.match(en, /"tabs\.previewHint"/);
});

test("new-session placeholder tab is shown when nothing is selected", () => {
	assert.match(tabsBar, /placeholderTab\?: boolean/);
	assert.match(tabsBar, /data-testid="session-tab-placeholder"/);
	assert.match(app, /placeholderTab=\{!currentSessionId\}/);
	assert.match(zh, /"tabs\.placeholderNewSession"/);
	assert.match(en, /"tabs\.placeholderNewSessionHint"/);
});

test("settings modal has in-window search", () => {
	assert.match(settingsModal, /<SettingsSearchBox onPick=\{handleSettingsSearchPick\}/);
	assert.match(zh, /"settings\.searchPlaceholder"/);
	assert.match(en, /"settings\.searchEmpty"/);
});

test("composer shows a persistent backend-lock hint", () => {
	assert.match(composer, /t\("session\.backendLockedBar"/);
	assert.match(zh, /"session\.backendLockedBar"/);
	assert.match(en, /"session\.backendLockedBar"/);
});

test("legacy sessions drawer archive is closed instead of restored", () => {
	assert.match(hook, /export type WorkspaceDrawerPanel = "files" \| "browser" \| "git" \| "review" \| "trajectory" \| "rewind"/);
	assert.match(hook, /rawPanel === "sessions" \? null/);
	assert.match(zh, /在左侧项目上右键打开历史会话/);
	assert.doesNotMatch(zh, /点击项目右侧历史按钮/);
	assert.match(en, /Right-click a project in the sidebar to open history/);
});

test("empty model list guide points at configuration models", () => {
	assert.match(zh, /设置 → 配置管理 → 模型/);
	assert.match(en, /Settings → Configuration → Models/);
	assert.doesNotMatch(zh, /请在「模型」设置页添加/);
});
