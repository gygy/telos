import { IPC_PROTOCOL_VERSION, type HostEvent } from "@pix/contracts";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import { loadContentModeForSession, saveContentModeForSession } from "../lib/content-mode-prefs.ts";
import { isBusyRunState } from "../lib/session-markers.ts";
import {
  classifyRuntimeEventDelivery,
  sessionKeyFromSnapshot,
  sessionRunKey,
  useShellStore,
} from "./shell-store.ts";

function runtimeEvent(
  runtimeId: string,
  sequence: number,
): Extract<HostEvent, { type: "runtime.event" }> {
  return {
    protocolVersion: IPC_PROTOCOL_VERSION,
    type: "runtime.event",
    runtimeId,
    sequence,
    event: { type: "message.delta", delta: "text" },
  };
}

describe("runtime event delivery", () => {
  it("accepts an unrecorded event covered by an overtaking snapshot", () => {
    expect(
      classifyRuntimeEventDelivery(
        { runtimeId: "runtime-1", lastSequence: 12, events: [] },
        runtimeEvent("runtime-1", 4),
      ),
    ).toBe("accept");
  });

  it("rejects duplicates, stale runtimes, and real forward gaps", () => {
    const recorded = runtimeEvent("runtime-1", 4);
    const state = { runtimeId: "runtime-1", lastSequence: 4, events: [recorded] };

    expect(classifyRuntimeEventDelivery(state, recorded)).toBe("duplicate");
    expect(classifyRuntimeEventDelivery(state, runtimeEvent("runtime-2", 5))).toBe("stale-runtime");
    expect(classifyRuntimeEventDelivery(state, runtimeEvent("runtime-1", 6))).toBe("gap");
    expect(classifyRuntimeEventDelivery(state, runtimeEvent("runtime-1", 5))).toBe("accept");
  });
});

describe("contentMode presentation", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, String(v));
        },
        removeItem: (k: string) => {
          store.delete(k);
        },
      },
    });
  });

  it("toggles chat/terminal without clearing history", () => {
    const history = [
      { role: "user" as const, text: "hello" },
      { role: "assistant" as const, text: "world" },
    ];
    useShellStore.setState({
      contentMode: "chat",
      history,
      liveStream: useShellStore.getState().liveStream,
      snapshot: {
        ...useShellStore.getState().snapshot,
        sessionFile: "/tmp/session-a.jsonl",
      } as never,
    });
    useShellStore.getState().toggleContentMode();
    expect(useShellStore.getState().contentMode).toBe("terminal");
    expect(useShellStore.getState().history).toEqual(history);
    useShellStore.getState().setContentMode("chat");
    expect(useShellStore.getState().contentMode).toBe("chat");
    expect(useShellStore.getState().history).toEqual(history);
  });

  it("closes the env panel when entering terminal mode", () => {
    useShellStore.setState({
      contentMode: "chat",
      envPanelOpen: true,
      snapshot: { sessionFile: "/tmp/session-env.jsonl" } as never,
    });
    useShellStore.getState().setContentMode("terminal");
    expect(useShellStore.getState().contentMode).toBe("terminal");
    expect(useShellStore.getState().envPanelOpen).toBe(false);

    useShellStore.setState({ contentMode: "chat", envPanelOpen: true });
    useShellStore.getState().toggleContentMode();
    expect(useShellStore.getState().contentMode).toBe("terminal");
    expect(useShellStore.getState().envPanelOpen).toBe(false);
  });

  it("persist:false does not overwrite the session's stored mode", () => {
    useShellStore.setState({
      contentMode: "terminal",
      snapshot: { sessionFile: "/tmp/keep-terminal.jsonl" } as never,
    });
    saveContentModeForSession("/tmp/keep-terminal.jsonl", "terminal");
    useShellStore.getState().setContentMode("terminal");
    // Teardown flip during switch
    useShellStore.getState().setContentMode("chat", { persist: false });
    expect(useShellStore.getState().contentMode).toBe("chat");
    // Map still says terminal for that session
    expect(loadContentModeForSession("/tmp/keep-terminal.jsonl")).toBe("terminal");
  });
});

describe("per-session running", () => {
  it("normalizes session keys", () => {
    expect(sessionRunKey("/tmp/Foo/")).toBe("/tmp/foo");
    expect(sessionKeyFromSnapshot({ sessionFile: "/tmp/A.jsonl", sessionId: "id-1" })).toBe(
      "/tmp/a.jsonl",
    );
  });

  it("tracks background sessions without forcing foreground running", () => {
    useShellStore.setState({
      running: false,
      sessionMarkers: {},
      runningSessions: {},
      runningRuntimeIds: {},
      snapshot: {
        runtimeId: "rt-fg",
        sequence: 1,
        cwd: "/tmp",
        agentDir: "/tmp/agent",
        sessionId: "fg",
        sessionFile: "/tmp/fg.jsonl",
        slashCommands: [],
        queuedMessages: { steering: [], followUp: [] },
        activeTools: [],
        projectTrusted: true,
        resources: { extensions: 0, skills: 0, prompts: 0, themes: 0, contextFiles: 0 },
        configuredPackages: { global: 0, project: 0 },
        diagnostics: [],
      },
    });
    useShellStore.getState().setSessionRunning("/tmp/bg.jsonl", true, "rt-bg");
    expect(useShellStore.getState().runningSessions["/tmp/bg.jsonl"]).toBe(true);
    expect(useShellStore.getState().sessionMarkers["/tmp/bg.jsonl"]?.state).toBe("running");
    // Foreground is still idle.
    expect(useShellStore.getState().running).toBe(false);

    useShellStore.getState().setSessionRunning("/tmp/fg.jsonl", true, "rt-fg");
    expect(useShellStore.getState().running).toBe(true);

    expect(useShellStore.getState().sessionKeyForRuntime("rt-bg")).toBe("/tmp/bg.jsonl");
    useShellStore.getState().settleSessionByRuntime("rt-bg", "completed");
    expect(useShellStore.getState().sessionMarkers["/tmp/bg.jsonl"]?.state).toBe("completed");
    expect(useShellStore.getState().runningSessions["/tmp/bg.jsonl"]).toBeUndefined();
    expect(useShellStore.getState().running).toBe(true);
    // Durable map cleared after settle.
    expect(useShellStore.getState().sessionKeyForRuntime("rt-bg")).toBeUndefined();

    useShellStore.getState().setSessionRunning("/tmp/fg.jsonl", false, "rt-fg");
    expect(useShellStore.getState().running).toBe(false);
  });

  it("keeps failed marker when prompt finally clears busy", () => {
    useShellStore.setState({
      running: true,
      sessionMarkers: {},
      runningSessions: {},
      runningRuntimeIds: {},
      snapshot: {
        runtimeId: "rt-1",
        sequence: 1,
        cwd: "/tmp",
        agentDir: "/tmp/agent",
        sessionId: "s1",
        sessionFile: "/tmp/s1.jsonl",
        slashCommands: [],
        queuedMessages: { steering: [], followUp: [] },
        activeTools: [],
        projectTrusted: true,
        resources: { extensions: 0, skills: 0, prompts: 0, themes: 0, contextFiles: 0 },
        configuredPackages: { global: 0, project: 0 },
        diagnostics: [],
      },
    });
    useShellStore.getState().setSessionRunning("/tmp/s1.jsonl", true, "rt-1");
    useShellStore.getState().settleSessionByRuntime("rt-1", "failed", "boom");
    expect(useShellStore.getState().sessionMarkers["/tmp/s1.jsonl"]?.state).toBe("failed");
    useShellStore.getState().setSessionRunning("/tmp/s1.jsonl", false, "rt-1");
    expect(useShellStore.getState().sessionMarkers["/tmp/s1.jsonl"]?.state).toBe("failed");
    expect(isBusyRunState(useShellStore.getState().sessionMarkers["/tmp/s1.jsonl"]?.state)).toBe(
      false,
    );
  });
});
