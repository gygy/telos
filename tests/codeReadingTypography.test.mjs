import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const foundation = readFileSync("src/renderer/src/styles/foundation.css", "utf8");
const editor = readFileSync("src/renderer/src/utils/codemirrorSetup.ts", "utf8");
const terminal = readFileSync("src/renderer/src/components/terminal/TerminalDock.tsx", "utf8");
const chatCode = readFileSync("src/renderer/src/styles/streamdownChrome.css", "utf8");
const timeline = readFileSync("src/renderer/src/styles/timeline.css", "utf8");
const diff = readFileSync("src/renderer/src/components/app/CodeDiffView.tsx", "utf8");

test("code reading sizes stay off the UI font-size track", () => {
	assert.match(foundation, /--font-size-editor:\s*15px;/);
	assert.match(foundation, /--line-height-editor:\s*1\.55;/);
	assert.match(foundation, /--font-size-terminal:\s*14px;/);
	assert.match(foundation, /--font-size-chat-code:\s*14px;/);
	// 界面档位只改控件字号，不把编辑器/终端一起放大
	const uiTrack = foundation.slice(
		foundation.indexOf(':root[data-ui-font-size="compact"]'),
		foundation.indexOf(':root[data-chat-font-size="compact"]'),
	);
	assert.doesNotMatch(uiTrack, /--font-size-editor/);
	assert.doesNotMatch(uiTrack, /--font-size-terminal/);
	assert.doesNotMatch(uiTrack, /--font-size-chat-code/);
});

test("editor and diff use the 15px code font, terminal stays 14px", () => {
	assert.match(editor, /fontSize:\s*"var\(--font-size-editor\)"/);
	assert.match(editor, /lineHeight:\s*"var\(--line-height-editor\)"/);
	assert.match(editor, /fontWeight:\s*"400"/);
	assert.match(editor, /fontFamily:\s*"var\(--font-family-mono\)"/);
	assert.doesNotMatch(editor, /fontSize:\s*"13px"/);

	assert.match(terminal, /getPropertyValue\("--font-size-terminal"\)/);
	assert.doesNotMatch(terminal, /getPropertyValue\("--font-size-control"\)/);

	assert.match(diff, /--diffs-font-size:\s*var\(--font-size-editor\)/);
	assert.match(diff, /--diffs-font-family:\s*var\(--font-family-mono\)/);
	assert.match(diff, /--diffs-line-height:\s*calc\(var\(--font-size-editor\) \* var\(--line-height-editor\)\)/);
});

test("chat code blocks are 14px mono while body stays on the chat size token", () => {
	const codeBlock = chatCode.slice(
		chatCode.indexOf('[data-streamdown="code-block-body"]'),
		chatCode.indexOf('[data-streamdown="code-block-body"] > pre'),
	);
	assert.match(codeBlock, /font-size:\s*var\(--font-size-chat-code\)/);
	assert.match(codeBlock, /font-family:\s*var\(--font-family-mono\)/);
	assert.doesNotMatch(codeBlock, /0\.8125rem/);
	assert.match(timeline, /\.markdown-body code \{[\s\S]*font-size:\s*var\(--font-size-chat-code\)/);
	assert.match(foundation, /--font-size-chat:\s*15px;/);
});
