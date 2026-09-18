import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * 底栏动作迁移为 beUI Dock（motion/dock）：
 * 浮动卡片容器铺满底栏宽度（w-full + justify-between）；
 * 当前为设置 / 技能 / 扩展 / 主题切换；公告改为 toast「查看」打开，问题反馈迁入 AboutPopover；
 * 入口 hover 提示统一 styled Tooltip（side="right"/delay 300），原生 title 退场。
 */

const sidebar = readFileSync(
  "src/renderer/src/components/sidebar/SidebarContent.tsx",
  "utf8",
);
const appSidebar = readFileSync(
  "src/renderer/src/components/sidebar/AppSidebar.tsx",
  "utf8",
);
const about = readFileSync("src/renderer/src/components/app/AboutPopover.tsx", "utf8");
const announcement = readFileSync(
  "src/renderer/src/components/sidebar/AnnouncementCenter.tsx",
  "utf8",
);
const settingsAtoms = readFileSync(
  "src/renderer/src/atoms/app-ui-atoms.ts",
  "utf8",
);
const configModal = readFileSync("src/renderer/src/ConfigModal.tsx", "utf8");
const settingsModal = readFileSync(
  "src/renderer/src/components/app/SettingsModal.tsx",
  "utf8",
);

test("v3 sidebar bottom actions render inside a full-width beUI Dock", () => {
  assert.match(sidebar, /import \{ Dock, DockItem \} from "\.\.\/motion\/dock";/);
  assert.match(sidebar, /<Dock size=\{32\} className="w-full justify-between">/);
  // 4 项 = 设置 + 技能 + 扩展 + 主题；公告 / 反馈已迁出 dock
  assert.equal((sidebar.match(/<DockItem>/g) || []).length, 4);
});

test("dock keeps settings, skills, extensions, and theme; feedback lives in AboutPopover", () => {
  const dockBlock = sidebar.slice(sidebar.indexOf("<Dock size={32}"));
  assert.match(sidebar, /<UpdateDotHint hasPendingUpdate=\{hasPendingUpdate\}/);
  assert.match(dockBlock, /aria-label=\{hasPendingUpdate \? t\("settings.titleWithUpdate"\) : t\("settings.title"\)\}["\s\S]*?onClick=\{props\.onOpenSettings\}/);
  assert.match(dockBlock, /t\("config.nav.skills"\)/);
  assert.match(dockBlock, /t\("config.nav.extensions"\)/);
  assert.match(dockBlock, /configSection: "skills"/);
  assert.match(dockBlock, /configSection: "extensions"/);
  assert.match(dockBlock, /<Sparkles className="size-4"/);
  assert.match(dockBlock, /<Puzzle className="size-4"/);
  // dock 内四处 Tooltip：设置 / 技能 / 扩展 / 主题
  assert.equal((dockBlock.match(/<Tooltip delayDuration=\{300\}>/g) || []).length, 4);
  assert.match(dockBlock, /aria-label=\{themeToggleTitle\} onClick=\{props\.onToggleTheme\}/);
  assert.match(dockBlock, /<TooltipContent side="right" sideOffset=\{6\}>\{themeToggleTitle\}<\/TooltipContent>/);
  // 回归：反馈不得回潮到 dock；原生 title 不得回潮
  assert.doesNotMatch(dockBlock, /feedback\.title|onOpenFeedback|AnnouncementCenter/);
  assert.doesNotMatch(dockBlock, /title=\{themeToggleTitle\}/);
  assert.equal((dockBlock.match(/variant="ghost"/g) || []).length, 4);
  // 官网 + 反馈入口在关于面板
  assert.match(about, /WEBSITE_URL = "https:\/\/github\.com\/gygy\/telos"/);
  assert.match(about, /label=\{t\("about\.website"\)\}/);
  assert.match(about, /label=\{t\("about\.feedback"\)\}/);
  assert.match(about, /props\.onOpenFeedback\(\)/);
});

test("skills and extensions dock buttons deep-link into Pi config sections", () => {
  assert.match(settingsAtoms, /configSection\?: "skills" \| "extensions" \| "prompts"/);
  assert.match(configModal, /focusConfigSection/);
  assert.match(configModal, /setSection\(focusConfigSection\)/);
  assert.match(settingsModal, /focusConfigSection=\{configFocus\?\.configSection\}/);
  assert.match(sidebar, /backendPane: "pi"/);
});

test("announcement center mounts without dock trigger for toast view action", () => {
  assert.match(appSidebar, /<AnnouncementCenter \/>/);
  assert.doesNotMatch(sidebar, /AnnouncementCenter/);
  assert.doesNotMatch(announcement, /\bDialogTrigger\b/);
  assert.doesNotMatch(announcement, /\bMegaphone\b/);
  assert.match(announcement, /announcementCenterOpenAtom/);
});

test("legacy toolbar/icon-button bottom bar classes are gone", () => {
  assert.doesNotMatch(sidebar, /icon-button/);
  assert.doesNotMatch(sidebar, /toolbar-actions/);
  assert.doesNotMatch(sidebar, /sidebar-bottom-primary-actions/);
  assert.doesNotMatch(sidebar, /settings-icon|feedback-icon|homepage-icon/);
});
