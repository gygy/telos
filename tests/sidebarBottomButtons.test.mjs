import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * 底栏动作迁移为 beUI Dock（motion/dock）：
 * 浮动卡片容器铺满底栏宽度（w-full + justify-between）；
 * 当前仅保留设置 / 主题切换；公告改为 toast「查看」打开，问题反馈迁入 AboutPopover；
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

test("v3 sidebar bottom actions render inside a full-width beUI Dock", () => {
  assert.match(sidebar, /import \{ Dock, DockItem \} from "\.\.\/motion\/dock";/);
  assert.match(sidebar, /<Dock size=\{32\} className="w-full justify-between">/);
  // 2 项 = 设置 + 主题；公告 / 反馈已迁出 dock
  assert.equal((sidebar.match(/<DockItem>/g) || []).length, 2);
});

test("dock keeps settings and theme; feedback lives in AboutPopover", () => {
  const dockBlock = sidebar.slice(sidebar.indexOf("<Dock size={32}"));
  assert.match(sidebar, /<UpdateDotHint hasPendingUpdate=\{hasPendingUpdate\}/);
  assert.match(dockBlock, /aria-label=\{hasPendingUpdate \? t\("settings.titleWithUpdate"\) : t\("settings.title"\)\}["\s\S]*?onClick=\{props\.onOpenSettings\}/);
  // dock 内仅设置 + 主题两处 Tooltip
  assert.equal((dockBlock.match(/<Tooltip delayDuration=\{300\}>/g) || []).length, 2);
  assert.match(dockBlock, /aria-label=\{themeToggleTitle\} onClick=\{props\.onToggleTheme\}/);
  assert.match(dockBlock, /<TooltipContent side="right" sideOffset=\{6\}>\{themeToggleTitle\}<\/TooltipContent>/);
  // 回归：反馈不得回潮到 dock；原生 title 不得回潮
  assert.doesNotMatch(dockBlock, /feedback\.title|onOpenFeedback|AnnouncementCenter/);
  assert.doesNotMatch(dockBlock, /title=\{themeToggleTitle\}/);
  assert.equal((dockBlock.match(/variant="ghost"/g) || []).length, 2);
  // 官网 + 反馈入口在关于面板
  assert.match(about, /WEBSITE_URL = "https:\/\/github\.com\/gygy\/telos"/);
  assert.match(about, /label=\{t\("about\.website"\)\}/);
  assert.match(about, /label=\{t\("about\.feedback"\)\}/);
  assert.match(about, /props\.onOpenFeedback\(\)/);
});

test("announcement center mounts without dock trigger for toast view action", () => {
  assert.match(appSidebar, /<AnnouncementCenter \/>/);
  assert.doesNotMatch(sidebar, /AnnouncementCenter/);
  assert.doesNotMatch(announcement, /DialogTrigger|Megaphone/);
  assert.match(announcement, /announcementCenterOpenAtom/);
});

test("legacy toolbar/icon-button bottom bar classes are gone", () => {
  assert.doesNotMatch(sidebar, /icon-button/);
  assert.doesNotMatch(sidebar, /toolbar-actions/);
  assert.doesNotMatch(sidebar, /sidebar-bottom-primary-actions/);
  assert.doesNotMatch(sidebar, /settings-icon|feedback-icon|homepage-icon/);
});
