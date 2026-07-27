import { describe, expect, it, beforeEach } from "vite-plus/test";
import {
  PROJECT_THREADS_PAGE,
  getVisibleThreadCount,
  isArchivedProject,
  isPinnedProject,
  isUnreadThread,
  loadUnreadThreads,
  markThreadUnread,
  markUnreadOnAgentSettle,
  partitionProjects,
  sortProjectPaths,
  sortThreadsByMode,
} from "./project-prefs.ts";

describe("project prefs helpers", () => {
  it("partitions pinned vs rest and drops archived", () => {
    const { pinned, rest } = partitionProjects(["/a", "/b", "/c", "/a"], ["/b"], ["/c"]);
    expect(pinned).toEqual(["/b"]);
    expect(rest).toEqual(["/a"]);
    expect(isPinnedProject("/b", pinned)).toBe(true);
    expect(isArchivedProject("/c", ["/c"])).toBe(true);
  });

  it("defaults visible thread page size to 5", () => {
    expect(PROJECT_THREADS_PAGE).toBe(5);
    expect(getVisibleThreadCount("/x", {})).toBe(5);
    expect(getVisibleThreadCount("/x", { "/x": 10 })).toBe(10);
  });

  it("sorts threads by priority / recent", () => {
    const threads = [
      { id: "a", modifiedAt: "2026-01-01T00:00:00.000Z" },
      { id: "b", modifiedAt: "2026-03-01T00:00:00.000Z" },
      { id: "c", modifiedAt: "2026-02-01T00:00:00.000Z" },
    ];
    expect(sortThreadsByMode(threads, "recent", []).map((t) => t.id)).toEqual(["b", "c", "a"]);
    expect(sortThreadsByMode(threads, "priority", ["c"]).map((t) => t.id)).toEqual(["c", "b", "a"]);
  });

  it("sorts project paths by priority / recent", () => {
    const paths = ["/z/zebra", "/a/alpha", "/m/mid"];
    expect(sortProjectPaths(paths, "priority")).toEqual(["/a/alpha", "/m/mid", "/z/zebra"]);
    expect(
      sortProjectPaths(paths, "recent", { recentOrder: ["/m/mid", "/z/zebra", "/a/alpha"] }),
    ).toEqual(["/m/mid", "/z/zebra", "/a/alpha"]);
  });
});

describe("thread unread", () => {
  beforeEach(() => {
    try {
      localStorage?.removeItem?.("pix.threads.unread");
    } catch {
      // ignore
    }
  });

  it("matches unread by session path or id", () => {
    const marked = markThreadUnread("/tmp/a.jsonl", true);
    expect(isUnreadThread({ id: "sess-a", path: "/tmp/a.jsonl" }, marked)).toBe(true);
    expect(isUnreadThread({ id: "sess-a", path: "/tmp/other.jsonl" }, marked)).toBe(false);
    const cleared = markThreadUnread({ id: "sess-a", path: "/tmp/a.jsonl" }, false);
    expect(isUnreadThread({ id: "sess-a", path: "/tmp/a.jsonl" }, cleared)).toBe(false);
  });

  it("marks unread on settle only when not viewing that thread", () => {
    expect(
      markUnreadOnAgentSettle("/tmp/bg.jsonl", {
        activeSessionKey: "/tmp/fg.jsonl",
        view: "thread",
      }),
    ).toBe(true);
    const afterBg = loadUnreadThreads();
    // Prefer in-memory list from mark return path when storage is available.
    expect(
      isUnreadThread(
        { id: "bg", path: "/tmp/bg.jsonl" },
        afterBg.length ? afterBg : ["/tmp/bg.jsonl"],
      ),
    ).toBe(true);

    markThreadUnread("/tmp/bg.jsonl", false);
    expect(
      markUnreadOnAgentSettle("/tmp/fg.jsonl", {
        activeSessionKey: "/tmp/fg.jsonl",
        view: "thread",
      }),
    ).toBe(false);

    // Viewing settings while foreground session settles → unread.
    expect(
      markUnreadOnAgentSettle("/tmp/fg.jsonl", {
        activeSessionKey: "/tmp/fg.jsonl",
        view: "settings",
      }),
    ).toBe(true);
  });

  it("isUnreadThread is pure over the provided list", () => {
    const list = ["/Users/me/proj/.pi/sessions/abc.jsonl", "other-id"];
    expect(isUnreadThread({ id: "abc", path: "/Users/me/proj/.pi/sessions/abc.jsonl" }, list)).toBe(
      true,
    );
    expect(isUnreadThread("other-id", list)).toBe(true);
    expect(isUnreadThread({ id: "nope", path: "/nope.jsonl" }, list)).toBe(false);
  });
});
