import assert from "node:assert/strict";
import test from "node:test";
import { loadTsCommonJs } from "./helpers/loadTsCommonJs.mjs";

const { planStartupSessionWarmup, runStartupSessionWarmup, STARTUP_SESSION_WARMUP_LIMIT } =
	loadTsCommonJs("src/main/sessions/startupSessionWarmup.ts");

const projects = [
	{ id: "old", lastOpenedAt: 1 },
	{ id: "recent", lastOpenedAt: 9 },
	{ id: "mid", lastOpenedAt: 5 },
	{ id: "gone", missing: true },
];

const sessions = [
	{ id: "old-new", projectId: "old", updatedAt: 10 },
	{ id: "old-old", projectId: "old", updatedAt: 1 },
	{ id: "recent-latest", projectId: "recent", updatedAt: 50 },
	{ id: "recent-child", projectId: "recent", updatedAt: 80, parentSessionPath: "/parent" },
	{ id: "mid-latest", projectId: "mid", updatedAt: 30 },
	{ id: "gone-latest", projectId: "gone", updatedAt: 100 },
	{ id: "anon", projectId: "recent", updatedAt: 90, noSession: true },
];

test("startup warmup takes the latest session of the two most recently active projects", () => {
	assert.equal(STARTUP_SESSION_WARMUP_LIMIT, 2);
	assert.equal(
		JSON.stringify(planStartupSessionWarmup(projects, sessions)),
		JSON.stringify(["recent-latest", "mid-latest"]),
	);
});

test("already warm sessions yield the slot to the next project", () => {
	assert.equal(
		JSON.stringify(planStartupSessionWarmup(projects, sessions, {
			alreadyWarm: new Set(["recent-latest"]),
		})),
		JSON.stringify(["mid-latest", "old-new"]),
	);
});

test("runStartupSessionWarmup activates serially and keeps going after a failure", async () => {
	const calls = [];
	const warmed = await runStartupSessionWarmup({
		projects,
		sessions,
		isWarm: () => false,
		activate: async (sessionId) => {
			calls.push(sessionId);
			if (sessionId === "recent-latest") return { ok: false, error: { message: "boom" } };
			return { ok: true, value: {} };
		},
	});
	assert.equal(JSON.stringify(calls), JSON.stringify(["recent-latest", "mid-latest"]));
	assert.equal(JSON.stringify(warmed), JSON.stringify(["mid-latest"]));
});
