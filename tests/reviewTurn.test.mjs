import assert from "node:assert/strict";
import test from "node:test";
import { loadTsCommonJs } from "./helpers/loadTsCommonJs.mjs";

const { collectLatestTurnCommands } = loadTsCommonJs("src/renderer/src/utils/reviewTurn.ts");

test("collectLatestTurnCommands keeps only the latest turn's shell tools", () => {
	const items = collectLatestTurnCommands([
		{ id: "u1", role: "user", text: "first" },
		{ id: "old", role: "tool", text: "bash", meta: { toolName: "bash", args: { command: "echo old" } } },
		{ id: "u2", role: "user", text: "second" },
		{
			id: "cmd",
			role: "tool",
			text: "bash",
			meta: { toolName: "bash", args: "{\"command\":\"npm test\"}", detailText: "ok\n1 passed", status: "done" },
		},
		{ id: "read", role: "tool", text: "read src/a.ts", meta: { toolName: "read" } },
		{
			id: "fail",
			role: "tool",
			text: "shell",
			meta: { toolName: "shell", args: { cmd: "exit 1" }, isError: true, result: "exit 1" },
		},
	]);
	assert.equal(JSON.stringify(items.map((item) => item.id)), JSON.stringify(["cmd", "fail"]));
	assert.equal(items[0].command, "npm test");
	assert.equal(items[0].output, "ok 1 passed");
	assert.equal(items[0].failed, false);
	assert.equal(items[1].command, "exit 1");
	assert.equal(items[1].failed, true);
});

test("collectLatestTurnCommands returns empty when the latest turn has no commands", () => {
	assert.equal(JSON.stringify(collectLatestTurnCommands([
		{ id: "u", role: "user", text: "hi" },
		{ id: "a", role: "assistant", text: "ok" },
	])), "[]");
});
