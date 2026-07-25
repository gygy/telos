import { describe, expect, it, vi } from "vite-plus/test";
import { planPiTuiLaunch } from "./pi-tui-session.ts";
import { PiTuiPtyController, type PtyHandle, type PtySpawnFn } from "./pi-tui-pty.ts";

type SpawnRecord = {
  file: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
};

function fakeSpawn(
  tracker: {
    spawns: SpawnRecord[];
    writes: string[];
    kills: number;
  },
  hooks?: {
    onSpawn?: (handle: PtyHandle & { emitData: (data: string) => void }) => void;
  },
): PtySpawnFn {
  return (file, args, options) => {
    tracker.spawns.push({ file, args, cwd: options.cwd, env: options.env });
    let dataListener: ((data: string) => void) | undefined;
    const handle: PtyHandle & { emitData: (data: string) => void } = {
      write: (data) => {
        tracker.writes.push(data);
      },
      resize: () => undefined,
      kill: () => {
        tracker.kills += 1;
      },
      onData: (listener) => {
        dataListener = listener;
      },
      onExit: () => undefined,
      emitData: (data) => {
        dataListener?.(data);
      },
    };
    hooks?.onSpawn?.(handle);
    return handle;
  };
}

describe("PiTuiPtyController", () => {
  it("resumes the same session without a second spawn", async () => {
    const tracker = { spawns: [] as SpawnRecord[], writes: [] as string[], kills: 0 };
    const controller = new PiTuiPtyController(fakeSpawn(tracker), async () => "pi");
    const plan = planPiTuiLaunch({ sessionFile: "/s.jsonl", cwd: "/cwd" });

    await controller.open(plan, { onData: () => undefined, onExit: () => undefined });
    expect(tracker.spawns).toHaveLength(1);
    controller.suspend();
    const second = await controller.open(plan, {
      onData: () => undefined,
      onExit: () => undefined,
    });
    expect(second.resumed).toBe(true);
    expect(tracker.kills).toBe(0);
    expect(tracker.spawns).toHaveLength(1);
  });

  it("parks the previous session and promotes it on hop back", async () => {
    const tracker = { spawns: [] as SpawnRecord[], writes: [] as string[], kills: 0 };
    const handles: Array<PtyHandle & { emitData: (data: string) => void }> = [];
    const controller = new PiTuiPtyController(
      fakeSpawn(tracker, {
        onSpawn: (h) => {
          handles.push(h);
        },
      }),
      async () => "/usr/bin/pi",
    );
    const planA = planPiTuiLaunch({
      sessionFile: "/work/a.jsonl",
      cwd: "/work",
      cols: 80,
      rows: 24,
    });
    const planB = planPiTuiLaunch({
      sessionFile: "/work/b.jsonl",
      cwd: "/work",
      cols: 80,
      rows: 24,
    });
    const received: string[] = [];

    await controller.open(planA, {
      onData: (d) => {
        received.push(`A:${d}`);
      },
      onExit: () => undefined,
    });
    expect(tracker.spawns).toHaveLength(1);

    await controller.open(planB, {
      onData: (d) => {
        received.push(`B:${d}`);
      },
      onExit: () => undefined,
    });
    // A parked (not killed), B spawned
    expect(tracker.spawns).toHaveLength(2);
    expect(tracker.kills).toBe(0);

    handles[0]?.emitData("from-parked-A");
    handles[1]?.emitData("from-live-B");
    expect(received).toEqual(["B:from-live-B"]);

    // Hop back to A — promote park, no third spawn
    await controller.open(planA, {
      onData: (d) => {
        received.push(`A2:${d}`);
      },
      onExit: () => undefined,
    });
    expect(tracker.spawns).toHaveLength(2);
    handles[0]?.emitData("from-promoted-A");
    expect(received).toContain("A2:from-promoted-A");
  });

  it("write requires an active (non-suspended) PTY", async () => {
    const tracker = { spawns: [] as SpawnRecord[], writes: [] as string[], kills: 0 };
    const controller = new PiTuiPtyController(fakeSpawn(tracker), async () => "pi");
    expect(() => controller.write("x")).toThrow(/not open/i);
    const plan = planPiTuiLaunch({ sessionFile: "/s.jsonl", cwd: "/cwd" });
    await controller.open(plan, { onData: () => undefined, onExit: () => undefined });
    controller.write("hello");
    expect(tracker.writes).toEqual(["hello"]);
    controller.suspend();
    expect(() => controller.write("x")).toThrow(/not open/i);
  });

  it("fails open when pi path cannot be resolved", async () => {
    const resolve = vi.fn(async () => "");
    const controller = new PiTuiPtyController(
      fakeSpawn({ spawns: [], writes: [], kills: 0 }),
      resolve,
    );
    const plan = planPiTuiLaunch({ sessionFile: "/s.jsonl", cwd: "/cwd" });
    await expect(
      controller.open(plan, { onData: () => undefined, onExit: () => undefined }),
    ).rejects.toThrow(/pi executable/i);
  });
});
