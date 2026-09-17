/**
 * 冷启动路径契约：窗口先于 catalog/automation await 与 first-run 备份。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const main = readFileSync("src/main/index.ts", "utf8");
const catalog = readFileSync("src/main/sessions/SessionCatalog.ts", "utf8");
const timing = readFileSync("src/main/startupTiming.ts", "utf8");
const settings = readFileSync("src/main/settings/SettingsStore.ts", "utf8");

test("startup overlaps catalog/automation load with createWindow", () => {
	assert.match(main, /const sessionCatalogReady = sessionCatalog\.load\(\)/);
	assert.match(main, /const automationStoreReady = automationStore\.load\(\)/);
	assert.match(main, /await createWindow\(\)/);
	assert.match(main, /await Promise\.all\(\[sessionCatalogReady, automationStoreReady\]\)/);
	// 调度器必须在 load 汇合后才 start，避免空表扫一轮。
	const createIdx = main.indexOf("await createWindow()");
	const readyIdx = main.indexOf("await Promise.all([sessionCatalogReady, automationStoreReady])");
	const schedIdx = main.indexOf("automationScheduler.start()");
	assert.ok(createIdx > 0 && readyIdx > createIdx, "createWindow before catalog await");
	assert.ok(schedIdx > readyIdx, "scheduler starts after catalog ready");
});

test("UpdateService starts after createWindow (electron-updater deferred)", () => {
	const createIdx = main.indexOf("await createWindow()");
	const startIdx = main.indexOf("updateService?.start()");
	assert.ok(createIdx > 0 && startIdx > createIdx, "updateService.start after createWindow");
	assert.match(main, /function deferredAutoUpdater/);
	assert.match(main, /autoUpdater: \{\s*setAutoDownload:/);
});

test("SessionCatalog soft-empty reads before load completes", () => {
	assert.match(catalog, /\/\/ 窗口可先于 catalog 落盘完成显示/);
	assert.match(catalog, /if \(!this\.loaded\) return \[\];/);
	assert.match(catalog, /if \(!this\.loaded\) return undefined;/);
});

test("startup timing helper and settings sync cache exist", () => {
	assert.match(timing, /export function createStartupTimer/);
	assert.match(main, /createStartupTimer/);
	assert.match(main, /startupTimer\?\.mark\("main-window-shown"\)/);
	assert.match(settings, /desktopSettingsSyncCache/);
});

test("UpdateService lazy-subscribes autoUpdater on start not constructor", () => {
	const updateServiceSrc = readFileSync("src/main/update/UpdateService.ts", "utf8");
	assert.match(updateServiceSrc, /if \(this\.deliveryMode === "automatic" && !this\.unsubscribeUpdater\)/);
	assert.match(updateServiceSrc, /this\.subscribeAutoUpdater\(\);/);
	// constructor 不得再立即 subscribe（那会在 createWindow 前触发 createRealAutoUpdater）
	const ctor = updateServiceSrc.match(/constructor\(deps: UpdateServiceDeps\) \{[\s\S]*?\n\t\}/);
	assert.ok(ctor, "constructor block");
	assert.doesNotMatch(ctor[0], /subscribeAutoUpdater/);
});
