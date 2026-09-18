import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
	"src/renderer/src/components/app/settings/settingsSearch.ts",
	"utf8",
);
const box = readFileSync(
	"src/renderer/src/components/app/settings/SettingsSearchBox.tsx",
	"utf8",
);
const modal = readFileSync("src/renderer/src/components/app/SettingsModal.tsx", "utf8");

test("settings search catalog covers system tabs and config destinations", () => {
	assert.match(source, /id: `settings:\$\{id\}`/);
	assert.match(source, /SETTINGS_TAB_IDS\.map/);
	assert.match(source, /common: "settings\.tabs\.common"/);
	assert.match(source, /git: "settings\.tabs\.git"/);
	for (const id of [
		"config:models",
		"config:skills",
		"config:extensions",
		"config:prompts",
		"config:dsh",
	]) {
		assert.match(source, new RegExp(`id: "${id}"`));
	}
	assert.match(source, /configTab: "models"/);
	assert.match(source, /configSection: "skills"/);
	assert.match(source, /backendPane: "dsh"/);
});

test("settings search matches haystack including aliases; empty query keeps all", () => {
	assert.match(source, /export function buildSettingsSearchHaystack/);
	assert.match(source, /\[label, \.\.\.\(aliases \?\? \[\]\)\]\.join\(" "\)\.toLowerCase\(\)/);
	assert.match(source, /export function filterSettingsSearchHits/);
	assert.match(source, /if \(!q\) return \[\.\.\.items\]/);
	assert.match(source, /item\.haystack\.includes\(q\)/);
	assert.match(source, /aliases: \["provider", "models\.json", "api", "模型"\]/);
});

test("settings window wires the search box into the header", () => {
	assert.match(box, /data-testid="settings-search"/);
	assert.match(box, /shouldFilter=\{false\}/);
	assert.match(modal, /<SettingsSearchBox onPick=\{handleSettingsSearchPick\}/);
	assert.match(modal, /setPane\("config"\)/);
	assert.match(modal, /configSection: hit\.configSection/);
});
