import { describe, expect, it } from "vite-plus/test";
import { buildPiTuiEnv, defaultPiAgentDir, PI_CODING_AGENT_DIR_ENV } from "./pi-tui-env.ts";

describe("pi-tui-env", () => {
  it("pins PI_CODING_AGENT_DIR so managed fd/rg share one bin dir", () => {
    const env = buildPiTuiEnv({
      USERPROFILE: "C:\\Users\\test",
      HOME: "C:\\Users\\test",
      PATH: "C:\\Windows\\System32",
    });
    const agentDir = env[PI_CODING_AGENT_DIR_ENV];
    expect(agentDir).toBeDefined();
    expect(agentDir).toBe(defaultPiAgentDir({ USERPROFILE: "C:\\Users\\test" }));
    expect(String(agentDir).replace(/\\/g, "/")).toMatch(/\.pi\/agent$/);
    const path = env.Path || env.PATH || "";
    expect(path.toLowerCase().replace(/\\/g, "/")).toContain(".pi/agent/bin");
  });

  it("respects an existing PI_CODING_AGENT_DIR", () => {
    const env = buildPiTuiEnv({
      [PI_CODING_AGENT_DIR_ENV]: "D:/custom/agent",
      PATH: "/usr/bin",
      HOME: "/home/u",
    });
    expect(String(env[PI_CODING_AGENT_DIR_ENV] ?? "").replace(/\\/g, "/")).toBe("D:/custom/agent");
  });
});
