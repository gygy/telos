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
    expect(env.PI_HARDWARE_CURSOR).toBe("1");
  });

  it("respects an existing PI_CODING_AGENT_DIR", () => {
    const env = buildPiTuiEnv({
      [PI_CODING_AGENT_DIR_ENV]: "D:/custom/agent",
      PATH: "/usr/bin",
      HOME: "/home/u",
    });
    expect(String(env[PI_CODING_AGENT_DIR_ENV] ?? "").replace(/\\/g, "/")).toBe("D:/custom/agent");
  });

  it("augments GUI-minimal PATH so node/pi bins remain reachable", () => {
    const env = buildPiTuiEnv({
      HOME: process.env.HOME || process.env.USERPROFILE || "/tmp",
      PATH: "/usr/bin:/bin",
    });
    const path = env.PATH || "";
    // Original entries preserved
    expect(path.includes("/usr/bin")).toBe(true);
    // Managed bin always first-ish
    expect(path.replace(/\\/g, "/")).toMatch(/\.pi\/agent\/bin/);
  });
});
