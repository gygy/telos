import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vite-plus/test";
import { detectPiCli, shouldAutoInstallPiCli } from "./pi-cli-ensure.ts";

describe("shouldAutoInstallPiCli", () => {
  it("enables product mode (no fixture env)", () => {
    expect(
      shouldAutoInstallPiCli({
        PATH: "/usr/bin",
      }),
    ).toBe(true);
  });

  it("skips isolated / explicit opt-out / fixture workspace", () => {
    expect(shouldAutoInstallPiCli({ PIX_ISOLATED: "1" })).toBe(false);
    expect(shouldAutoInstallPiCli({ PIX_SKIP_PI_INSTALL: "1" })).toBe(false);
    expect(shouldAutoInstallPiCli({ PIX_WORKSPACE: "D:/tmp/fixture" })).toBe(false);
    expect(
      shouldAutoInstallPiCli({
        PI_CODING_AGENT_DIR: "D:/tmp/agent",
        PIX_ENABLE_TEST_COMMANDS: "1",
      }),
    ).toBe(false);
  });

  it("still installs when only PI_CODING_AGENT_DIR is set without test flags", () => {
    // User may override agent dir in product; still want CLI present.
    expect(
      shouldAutoInstallPiCli({
        PI_CODING_AGENT_DIR: "D:/custom/agent",
      }),
    ).toBe(true);
  });
});

describe("detectPiCli", () => {
  it("finds pi under ~/.vite-plus/bin even when PATH is GUI-minimal", async () => {
    const root = mkdtempSync(join(tmpdir(), "pix-detect-pi-"));
    const bin = join(root, ".vite-plus", "bin");
    mkdirSync(bin, { recursive: true });
    const piPath = join(bin, "pi");
    // Minimal executable; --version may fail — path detection must still succeed.
    writeFileSync(piPath, "#!/bin/sh\nexit 1\n", { mode: 0o755 });

    const found = await detectPiCli({
      HOME: root,
      PATH: "/usr/bin:/bin",
    });
    expect(found.path).toBe(piPath);
  });

  it("finds pi under /opt/homebrew-style path via candidate scan when present", async () => {
    // Use a fake home with .local/bin (always scannable); avoid depending on real /opt/homebrew.
    const root = mkdtempSync(join(tmpdir(), "pix-detect-local-"));
    const bin = join(root, ".local", "bin");
    mkdirSync(bin, { recursive: true });
    const piPath = join(bin, "pi");
    writeFileSync(piPath, "#!/bin/sh\necho 1.2.3\n", { mode: 0o755 });

    const found = await detectPiCli({
      HOME: root,
      // No pi on PATH — must use known dirs.
      PATH: "/usr/bin:/bin",
    });
    expect(found.path).toBe(piPath);
  });
});
