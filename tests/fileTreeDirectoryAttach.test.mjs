import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadTsCommonJs } from "./helpers/loadTsCommonJs.mjs";

const menuSource = readFileSync(
  "src/renderer/src/components/session/ComposerOverlayComponents.tsx",
  "utf8",
);
const appSource = readFileSync("src/renderer/src/App.tsx", "utf8");
const appUtils = loadTsCommonJs("src/renderer/src/components/app/AppUtils.ts");
const chips = loadTsCommonJs("src/renderer/src/components/session/composer/chips.ts");

test("FileContextMenu：文件与目录都能「加入对话引用」和「默认方式打开」", () => {
  // 引用项不能再按 isFile 禁用——拖拽落点与 @ 建议列表都允许目录。
  assert.match(
    menuSource,
    /<DropdownMenuItem onSelect=\{props\.onAttach\}>\s*\{t\("menu\.attachFile"\)\}/,
  );
  // 「默认方式打开」对目录同样开放：目录的默认处理器就是文件管理器。
  assert.match(
    menuSource,
    /<DropdownMenuItem onSelect=\{props\.onOpen\}>\s*\{t\("menu\.defaultOpen"\)\}/,
  );
  assert.doesNotMatch(menuSource, /disabled=\{!isFile\}/);
});

test("文件树右键引用复用 fileNodeDragPayloadToRef，并且不在点击当帧做重活", () => {
  const host = readFileSync("src/renderer/src/components/session/FileContextMenuHost.tsx", "utf8");
  const menu = readFileSync("src/renderer/src/components/session/ComposerOverlayComponents.tsx", "utf8");
  assert.match(host, /fileNodeDragPayloadToRef\(/);
  assert.match(host, /composer-attach-refs/);
  assert.doesNotMatch(host, /@\$\{fileMenu\.node\.relativePath\}/);
  assert.match(host, /desktopApi\.files\.open\(path\)/);
  // 菜单开关不走 App setState；剪贴板走异步，避免 sendSync 冻住右键。
  assert.match(host, /fileContextMenuAtom/);
  assert.match(host, /getClipboardPathsAsync/);
  assert.match(host, /window\.requestAnimationFrame/);
  assert.match(menu, /instant/);
  assert.match(menu, /disabled=\{!props\.hasClipboardFiles\}/);
  assert.match(appSource, /setFileMenu: setFileContextMenu/);
  assert.doesNotMatch(appSource, /setHasClipboardFiles/);
});

test("目录节点引用带尾斜杠（raw）且可解析为 file chip", () => {
  const ref = appUtils.fileNodeDragPayloadToRef({
    path: "C:\\proj\\.tmp",
    relativePath: ".tmp",
    type: "directory",
  });
  assert.equal(ref, "@.tmp/");

  // 真实 App 的 validFilePaths 由 flattenFiles 生成，包含目录节点本身。
  const parsed = chips.parseRichInputChips(
    `看下 ${ref} 这个目录`,
    undefined,
    new Set([".tmp"]),
  );
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].kind, "file");
  // 展示只给目录名（文件夹图标承担「目录」语义，对齐 Proma）
  assert.equal(parsed[0].label, ".tmp");
});

test("含空格的目录引用加引号、raw 保留尾斜杠", () => {
  const ref = appUtils.fileNodeDragPayloadToRef({
    path: "C:\\proj\\my docs",
    relativePath: "my docs",
    type: "directory",
  });
  assert.equal(ref, '@"my docs/"');

  const parsed = chips.parseRichInputChips(ref, undefined, new Set(["my docs"]));
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].kind, "file");
  assert.equal(parsed[0].label, "my docs");
});
