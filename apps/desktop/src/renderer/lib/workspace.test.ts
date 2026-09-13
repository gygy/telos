import { describe, expect, it } from "vite-plus/test";
import {
  belongsInConversationsSection,
  filterRecentWorkspaces,
  firstLine,
  isAutoDefaultWorkspacePath,
  isConversationWorkspacePath,
  isEphemeralWorkspacePath,
  isNonProjectWorkspacePath,
  mergeRecentWithOpenProject,
  prependRecentPath,
  projectThreadIdsFromCwdMap,
  threadsForWorkspaceBucket,
  unionRecentWorkspaces,
  workspaceLabel,
} from "./workspace.ts";

describe("workspace helpers", () => {
  it("labels paths for the sidebar chip", () => {
    expect(workspaceLabel("/Users/me/code/Telos")).toEqual({ name: "Telos", detail: "code" });
    expect(workspaceLabel(undefined).name).toBe("");
  });

  it("compacts expanded skill blocks when taking the first line", () => {
    expect(
      firstLine(
        '<skill name="review" location="/tmp/SKILL.md">\n# long body\n</skill>\n\nplease inspect',
      ),
    ).toBe("/skill:review please inspect");
  });

  it("prepends and dedupes recent workspace paths", () => {
    expect(prependRecentPath(["/a", "/b"], "/c")).toEqual(["/c", "/a", "/b"]);
    expect(prependRecentPath(["/a", "/b"], "/b")).toEqual(["/b", "/a"]);
    expect(prependRecentPath(["/1", "/2", "/3"], "/4", 3)).toEqual(["/4", "/1", "/2"]);
    // Normalized key dedupe (trailing slash).
    expect(prependRecentPath(["/a/b", "/c"], "/a/b/")).toEqual(["/a/b/", "/c"]);
  });

  it("merges listed recent with selection without resurrecting removed paths", () => {
    // Prefs list is source of truth — do not pull /Users/me/a back from previous.
    expect(
      unionRecentWorkspaces(["/Users/me/b", "/Users/me/c"], ["/Users/me/a", "/Users/me/c"], {
        selected: "/Users/me/b",
        max: 12,
      }),
    ).toEqual(["/Users/me/b", "/Users/me/c"]);
    // Selected wins even when missing from listed briefly.
    expect(
      unionRecentWorkspaces(["/Users/me/c"], ["/Users/me/c"], {
        selected: "/Users/me/b",
        max: 12,
      }),
    ).toEqual(["/Users/me/b", "/Users/me/c"]);
    // Explicit exclude (just-removed) stays out even if still in listed/previous.
    expect(
      unionRecentWorkspaces(["/Users/me/a", "/Users/me/b"], ["/Users/me/a"], {
        selected: "/Users/me/b",
        exclude: ["/Users/me/a"],
        max: 12,
      }),
    ).toEqual(["/Users/me/b"]);
  });

  it("filters e2e/tmp workspaces and current cwd from recent list", () => {
    expect(isEphemeralWorkspacePath("/var/folders/xx/T/Telos-e2e-abc/workspace")).toBe(true);
    expect(isEphemeralWorkspacePath("/Users/me/code/Telos")).toBe(false);
    const paths = [
      "/Users/me/code/Telos",
      "/var/folders/xx/T/Telos-e2e-abc/workspace",
      "/Users/me/code/other",
      "/Users/me/code/Telos",
      "/tmp/Telos-fake-xyz/workspace",
    ];
    expect(filterRecentWorkspaces(paths, { current: "/Users/me/code/Telos", max: 5 })).toEqual([
      "/Users/me/code/other",
    ]);
    expect(prependRecentPath(["/Users/me/a"], "/tmp/Telos-e2e-x/workspace")).toEqual(["/Users/me/a"]);
  });

  it("treats Documents/Telos date folders and conversation home as non-projects", () => {
    expect(isAutoDefaultWorkspacePath("/Users/me/Documents/Telos/2026-07-21")).toBe(true);
    expect(isAutoDefaultWorkspacePath("/Users/me/Documents/Telos/2026-07-21-2")).toBe(true);
    expect(isAutoDefaultWorkspacePath("/Users/me/Documents/Telos/worktrees/repo")).toBe(false);
    expect(isAutoDefaultWorkspacePath("/Users/me/code/Telos")).toBe(false);
    expect(isConversationWorkspacePath("/Users/me/Documents/Telos/conversations")).toBe(true);
    expect(isConversationWorkspacePath("/Users/me/Documents/Telos/conversations/x")).toBe(true);
    expect(isNonProjectWorkspacePath("/Users/me/Documents/Telos/conversations")).toBe(true);
    expect(isNonProjectWorkspacePath("/Users/me/code/Telos")).toBe(false);
    expect(
      filterRecentWorkspaces(
        [
          "/Users/me/code/Telos",
          "/Users/me/Documents/Telos/2026-07-21",
          "/Users/me/Documents/Telos/conversations",
          "/Users/me/code/other",
        ],
        { max: 5 },
      ),
    ).toEqual(["/Users/me/code/Telos", "/Users/me/code/other"]);
    expect(prependRecentPath(["/Users/me/a"], "/Users/me/Documents/Telos/2026-07-21")).toEqual([
      "/Users/me/a",
    ]);
    expect(prependRecentPath(["/Users/me/a"], "/Users/me/Documents/Telos/conversations")).toEqual([
      "/Users/me/a",
    ]);
  });

  it("keeps the open project on recent so selection clear cannot empty projectKeys", () => {
    expect(mergeRecentWithOpenProject(["/Users/me/code/other"], "/Users/me/code/Telos", 12)).toEqual([
      "/Users/me/code/Telos",
      "/Users/me/code/other",
    ]);
    expect(mergeRecentWithOpenProject(["/Users/me/code/Telos"], "/Users/me/code/Telos", 12)).toEqual([
      "/Users/me/code/Telos",
    ]);
    expect(
      mergeRecentWithOpenProject(
        ["/Users/me/code/Telos"],
        "/Users/me/Documents/Telos/conversations",
        12,
      ),
    ).toEqual(["/Users/me/code/Telos"]);
  });

  it("never classifies project-bound sessions into the 对话 section", () => {
    const byCwd = {
      "/Users/me/code/Telos": [
        { id: "proj-1", cwd: "/Users/me/code/Telos" },
        { id: "proj-2", cwd: "/Users/me/code/Telos" },
        // Leaked conversation row under a project key must not join projectThreadIds.
        { id: "conv-leaked", cwd: "/Users/me/Documents/Telos/conversations" },
      ],
      "/Users/me/Documents/Telos/conversations": [
        { id: "conv-1", cwd: "/Users/me/Documents/Telos/conversations" },
      ],
    };
    const projectIds = projectThreadIdsFromCwdMap(byCwd);
    expect(projectIds.has("proj-1")).toBe(true);
    expect(projectIds.has("conv-1")).toBe(false);
    expect(projectIds.has("conv-leaked")).toBe(false);

    // Even if projectKeys is empty (selection/recent race), cwd type decides.
    expect(
      belongsInConversationsSection(
        { id: "proj-1", cwd: "/Users/me/code/Telos" },
        { projectThreadIds: new Set() },
      ),
    ).toBe(false);
    expect(
      belongsInConversationsSection(
        { id: "conv-1", cwd: "/Users/me/Documents/Telos/conversations" },
        { projectThreadIds: projectIds },
      ),
    ).toBe(true);
    // Conversation cwd wins even if the id was also written into a project map.
    expect(
      belongsInConversationsSection(
        { id: "conv-leaked", cwd: "/Users/me/Documents/Telos/conversations" },
        { projectThreadIds: new Set(["conv-leaked", "proj-1"]) },
      ),
    ).toBe(true);
    // Bucket membership wins when cwd is briefly missing.
    expect(
      belongsInConversationsSection({ id: "proj-2", cwd: "" }, { projectThreadIds: projectIds }),
    ).toBe(false);
  });

  it("filters host list rows into the correct workspace bucket", () => {
    const rows = [
      { id: "a", cwd: "/Users/me/code/Telos" },
      { id: "b", cwd: "/Users/me/code/other" },
      { id: "c", cwd: "/Users/me/Documents/Telos/conversations" },
      { id: "live", cwd: "" },
    ];
    expect(threadsForWorkspaceBucket(rows, "/Users/me/code/Telos").map((r) => r.id)).toEqual([
      "a",
      "live",
    ]);
    expect(
      threadsForWorkspaceBucket(rows, "/Users/me/Documents/Telos/conversations").map((r) => r.id),
    ).toEqual(["c", "live"]);
  });
});
