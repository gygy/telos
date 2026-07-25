import { describe, expect, it } from "vite-plus/test";
import {
  classifyToolName,
  extractCommandFromArgs,
  extractCommandFromOutput,
  groupConsecutiveTools,
  processToolView,
} from "./process-activity.ts";

describe("process activity", () => {
  it("classifies common tool names", () => {
    expect(classifyToolName("read")).toBe("read");
    expect(classifyToolName("bash")).toBe("run");
    expect(classifyToolName("grep")).toBe("search");
    expect(classifyToolName("edit")).toBe("edit");
    expect(classifyToolName("write")).toBe("write");
    expect(classifyToolName("ls")).toBe("list");
  });

  it("extracts path / command / query for row previews", () => {
    expect(processToolView("read", { path: "src/index.ts" })).toMatchObject({
      kind: "read",
      path: "src/index.ts",
      preview: "index.ts",
    });
    expect(processToolView("bash", { command: "rg -n foo" })).toMatchObject({
      kind: "run",
      detail: "rg -n foo",
      preview: "rg -n foo",
    });
    expect(processToolView("grep", { path: "a.ts", query: "render" })).toMatchObject({
      kind: "search",
      path: "a.ts",
      detail: "render",
    });
  });

  it("extracts commands from nested / argv arg shapes", () => {
    expect(extractCommandFromArgs("pnpm test")).toBe("pnpm test");
    expect(extractCommandFromArgs({ cmd: "ls -la" })).toBe("ls -la");
    expect(extractCommandFromArgs({ input: { command: "git status" } })).toBe("git status");
    expect(extractCommandFromArgs({ argv: ["npm", "run", "build"] })).toBe("npm run build");
    expect(processToolView("bash", { input: { command: "echo hi" } }).preview).toBe("echo hi");
  });

  it("recovers command from output when args are missing (history)", () => {
    expect(extractCommandFromOutput("$ git status\non branch main")).toBe("git status");
    expect(extractCommandFromOutput("Command: pnpm check\nok")).toBe("pnpm check");
    expect(processToolView("bash", undefined, { output: "$ rg -n process\n1:match" }).preview).toBe(
      "rg -n process",
    );
    expect(processToolView("bash", undefined, { command: "ls" }).preview).toBe("ls");
  });

  it("groups consecutive tools of the same kind", () => {
    const groups = groupConsecutiveTools([
      { kind: "tool" as const, toolName: "read" },
      { kind: "tool" as const, toolName: "read" },
      { kind: "tool" as const, toolName: "bash" },
      { kind: "tool" as const, toolName: "edit" },
      { kind: "tool" as const, toolName: "edit" },
      { kind: "tool" as const, toolName: "edit" },
    ]);
    expect(groups.map((g) => g.type)).toEqual(["group", "single", "group"]);
    expect(groups[0]).toMatchObject({ type: "group", kind: "read" });
    expect(groups[1]).toMatchObject({ type: "single" });
    expect(groups[2]).toMatchObject({ type: "group", kind: "edit" });
  });
});
