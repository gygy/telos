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
  it("always spawns fresh — never resumes a prior process", async () => {
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
    expect(second.resumed).toBe(false);
    expect(tracker.kills).toBe(1);
    expect(tracker.spawns).toHaveLength(2);
  });

  it("replaces a different live session and ignores stale data", async () => {
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
    expect(tracker.spawns[0]?.args).toEqual(["--session", "/work/a.jsonl"]);
    expect(tracker.spawns[0]?.env.PI_CODING_AGENT_DIR).toBeTruthy();

    await controller.open(planB, {
      onData: (d) => {
        received.push(`B:${d}`);
      },
      onExit: () => undefined,
    });
    expect(tracker.kills).toBe(1);
    expect(tracker.spawns).toHaveLength(2);
    expect(tracker.spawns[1]?.args).toEqual(["--session", "/work/b.jsonl"]);

    handles[0]?.emitData("from-old-session");
    handles[1]?.emitData("from-new-session");
    expect(received).toEqual(["B:from-new-session"]);

    controller.dispose();
    expect(tracker.kills).toBe(2);
    expect(controller.isAlive()).toBe(false);
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
