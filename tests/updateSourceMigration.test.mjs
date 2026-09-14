/**
 * updateSource 一次性迁移单测（默认源 atomgit → github）。
 *
 * SettingsStore 依赖 electron（app.getPath）无法直接 import，
 * 迁移逻辑抽成纯函数 migrateUpdateSourceToGithubDefault 后用 loadTsCommonJs 加载验证。
 */
import assert from "node:assert/strict";
import test from "node:test";
import { loadTsCommonJs } from "./helpers/loadTsCommonJs.mjs";

const {
	migrateUpdateSourceToGithubDefault,
	migrateUpdateSourceToAtomgit,
} = loadTsCommonJs("src/main/settings/SettingsStore.ts");

test("仍停在 atomgit：迁回 github 并写标记", () => {
	const settings = { updateSource: "atomgit" };
	const changed = migrateUpdateSourceToGithubDefault(settings);
	assert.equal(changed, true);
	assert.equal(settings.updateSource, "github");
	assert.equal(settings.updateSourceGithubDefaultMigrated, true);
});

test("已迁移过（标记 true）：不再改动，用户显式保存的 atomgit 生效", () => {
	const settings = { updateSource: "atomgit", updateSourceGithubDefaultMigrated: true };
	const changed = migrateUpdateSourceToGithubDefault(settings);
	assert.equal(changed, false);
	assert.equal(settings.updateSource, "atomgit");
});

test("已是 github：只写标记，源不变", () => {
	const settings = { updateSource: "github" };
	const changed = migrateUpdateSourceToGithubDefault(settings);
	assert.equal(changed, true);
	assert.equal(settings.updateSource, "github");
	assert.equal(settings.updateSourceGithubDefaultMigrated, true);
});

test("从未持久化过更新源：只写标记（走新默认 github）", () => {
	const settings = {};
	const changed = migrateUpdateSourceToGithubDefault(settings);
	assert.equal(changed, true);
	assert.equal(settings.updateSource, undefined);
	assert.equal(settings.updateSourceGithubDefaultMigrated, true);
});

test("旧 migrateUpdateSourceToAtomgit 已停用：恒为 false", () => {
	const settings = { updateSource: "github" };
	assert.equal(migrateUpdateSourceToAtomgit(settings), false);
	assert.equal(settings.updateSource, "github");
});
