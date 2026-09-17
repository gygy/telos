import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

/**
 * Telos 品牌面契约：应用内品牌标统一走 TelosLogo（白底 + Yandex 红 π），
 * 不再使用上游 Pi 官方窗口字形，也不回潮跳蛛线稿。
 */

const mark = readFileSync("src/renderer/src/components/app/LogoMark.tsx", "utf8");
const telosLogo = readFileSync("src/renderer/src/components/app/TelosLogo.tsx", "utf8");
const lockup = readFileSync("src/renderer/src/components/app/AppParts.tsx", "utf8");
const about = readFileSync("src/renderer/src/components/app/AboutPopover.tsx", "utf8");
const sessionBadge = readFileSync(
  "src/renderer/src/components/session/SessionSourceBadge.tsx",
  "utf8",
);
const app = readFileSync("src/renderer/src/App.tsx", "utf8");
const boot = readFileSync("src/renderer/index.html", "utf8");
const webBrand = readFileSync("src/renderer/src/web/WebBrandLockup.tsx", "utf8");
const webTimeline = readFileSync("src/renderer/src/web/WebTimeline.tsx", "utf8");

/** 上游 Pi 官方窗口字形路径（Telos 产品面不得回潮）。 */
const UPSTREAM_PI_WINDOW = /M165\.29 165\.29H517\.36V400/;
/** 旧跳蛛线稿片段（历史上曾用，已废弃）。 */
const SPIDER_MARK = /M7\.5 15\.5C3\.5 14|<ellipse cx="60" cy="50"/;

test("in-app brand surfaces use TelosLogo, not upstream Pi window glyph", () => {
  assert.match(telosLogo, /fill="#FC3F1D"/);
  assert.match(telosLogo, /export function TelosLogo/);

  assert.match(mark, /export function LogoMark/);
  assert.match(mark, /<TelosLogo className="size-full" title="Telos" \/>/);
  assert.doesNotMatch(mark, /brandMarkSrc/);
  assert.doesNotMatch(mark, UPSTREAM_PI_WINDOW);

  // 侧栏字标：TelosLogo + TextShimmer「Telos」，不再挂 PiLogoCanvas / PiDeck 字样
  assert.match(lockup, /showLogo && <TelosLogo className="size-\[18px\]" title="Telos" \/>/);
  assert.match(lockup, />\s*Telos\s*<\/TextShimmer>/);
  assert.doesNotMatch(lockup, /<PiLogoCanvas/);
  assert.doesNotMatch(lockup, />\s*PiDeck\s*</);

  assert.match(about, /<TelosLogo className="size-10" title="Telos" \/>/);
  assert.doesNotMatch(about, /<PiLogoCanvas/);

  // 聊天窗口 / 后端选择器的 PiLogo 也必须是 Telos 圆标（同步上游时曾被盖回）
  assert.match(sessionBadge, /export function PiLogo/);
  assert.match(sessionBadge, /return <TelosLogo className=\{props\.className/);
  assert.doesNotMatch(
    sessionBadge.slice(sessionBadge.indexOf("export function PiLogo")),
    UPSTREAM_PI_WINDOW,
  );

  assert.match(app, /<TelosLogo className="size-12" title="Telos" \/>/);
  assert.match(boot, /fill="#FC3F1D"/);
  assert.doesNotMatch(boot, UPSTREAM_PI_WINDOW);

  assert.match(webBrand, /<TelosLogo className="size-\[18px\]" title="Telos" \/>/);
  assert.match(webBrand, />\s*Telos\s*</);
  assert.match(webTimeline, /<LogoMark size=\{66\} \/>/);

  for (const source of [mark, telosLogo, lockup, about, sessionBadge, app, boot, webBrand, webTimeline]) {
    assert.doesNotMatch(source, SPIDER_MARK);
  }
});

test("tray / main-process copy uses Telos, not PiDeck product name", () => {
  // 上游同步曾把托盘「重启/退出」盖回 PiDeck；悬停/右键菜单会露出旧品牌。
  const mainCopy = readFileSync("src/shared/i18n/mainProcessCopy.ts", "utf8");
  assert.match(mainCopy, /"tray\.restart": "重启 Telos"/);
  assert.match(mainCopy, /"tray\.quit": "退出 Telos"/);
  assert.match(mainCopy, /"tray\.restart": "Restart Telos"/);
  assert.match(mainCopy, /"tray\.quit": "Quit Telos"/);
  assert.doesNotMatch(mainCopy, /"tray\.(restart|quit)": "[^"]*PiDeck/);

  const index = readFileSync("src/main/index.ts", "utf8");
  assert.match(index, /tray\.setToolTip\("Telos"\)/);
});
