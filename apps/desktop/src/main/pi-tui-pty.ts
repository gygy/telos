/**
 * PTY lifecycle for embedded pi TUI.
 *
 * Performance:
 * - Same session: suspend/resume reuses the live process (chat ⇄ terminal).
 * - Other sessions: park up to N warm processes and promote on switch (terminal ⇄ terminal).
 *
 * Correctness:
 * - Data is bound to the live handle + generation (stale processes never feed the UI).
 * - open() for a different session parks the current one instead of always killing.
 */
import { normalizeSessionKey, type PiTuiLaunchPlan } from "./pi-tui-session.ts";
import { buildPiTuiEnv } from "./pi-tui-env.ts";

export type PtyExitEvent = { exitCode: number; signal?: number };

export type PtyHandle = {
  write(data: string): void;
  resize(cols: number, rows: number): void;
  kill(signal?: string): void;
  onData(listener: (data: string) => void): void;
  onExit(listener: (event: PtyExitEvent) => void): void;
};

export type PtySpawnOptions = {
  name: string;
  cols: number;
  rows: number;
  cwd: string;
  env: Record<string, string>;
};

export type PtySpawnFn = (file: string, args: string[], options: PtySpawnOptions) => PtyHandle;

export type PiTuiPtyOpenResult = {
  sessionKey: string;
  sessionFile: string;
  cwd: string;
  /** True when an existing process was reused (resume or promote from park). */
  resumed: boolean;
  generation: number;
};

export type PiTuiPtyCallbacks = {
  onData: (data: string) => void;
  onExit: (event: PtyExitEvent) => void;
};

type LivePty = {
  pty: PtyHandle;
  sessionKey: string;
  sessionFile: string;
  cwd: string;
  generation: number;
};

type ParkedPty = {
  pty: PtyHandle;
  sessionKey: string;
  sessionFile: string;
  cwd: string;
  parkedAt: number;
};

/** Max background pi processes kept for instant terminal session hops. */
export const MAX_PARKED_PTYS = 4;

export type PiTuiPtyStatus = {
  live?: {
    sessionFile: string;
    suspended: boolean;
  };
  parkedSessionFiles: string[];
};

/**
 * Manages one live pi TUI PTY plus a small park of warm sessions.
 */
export class PiTuiPtyController {
  #spawn: PtySpawnFn;
  #resolvePiPath: () => Promise<string>;
  #live: LivePty | null = null;
  #suspended = false;
  #dataListener: ((data: string) => void) | null = null;
  #exitListener: ((event: PtyExitEvent) => void) | null = null;
  #generation = 0;
  #parked = new Map<string, ParkedPty>();

  constructor(spawn: PtySpawnFn, resolvePiPath: () => Promise<string>) {
    this.#spawn = spawn;
    this.#resolvePiPath = resolvePiPath;
  }

  isOpen(): boolean {
    return this.#live !== null && !this.#suspended;
  }

  isAlive(): boolean {
    return this.#live !== null;
  }

  isSuspended(): boolean {
    return this.#suspended && this.#live !== null;
  }

  sessionKey(): string | null {
    return this.#live?.sessionKey ?? null;
  }

  sessionFile(): string | null {
    return this.#live?.sessionFile ?? null;
  }

  generation(): number {
    return this.#generation;
  }

  status(): PiTuiPtyStatus {
    return {
      ...(this.#live
        ? {
            live: {
              sessionFile: this.#live.sessionFile,
              suspended: this.#suspended,
            },
          }
        : {}),
      parkedSessionFiles: [...this.#parked.values()].map((entry) => entry.sessionFile),
    };
  }

  async open(plan: PiTuiLaunchPlan, callbacks: PiTuiPtyCallbacks): Promise<PiTuiPtyOpenResult> {
    // Same live session → resume (chat ⇄ terminal on one session).
    if (this.#live && this.#live.sessionKey === plan.sessionKey) {
      this.#suspended = false;
      this.#dataListener = callbacks.onData;
      this.#exitListener = callbacks.onExit;
      this.#live.pty.resize(plan.cols, plan.rows);
      return {
        sessionKey: plan.sessionKey,
        sessionFile: plan.sessionFile,
        cwd: plan.cwd,
        resumed: true,
        generation: this.#live.generation,
      };
    }

    // Different live session → park it warm for a later hop back.
    if (this.#live) {
      this.#parkLive();
    }

    // Promote a parked process for this session (terminal ⇄ terminal hop).
    const parked = this.#parked.get(plan.sessionKey);
    if (parked) {
      this.#parked.delete(plan.sessionKey);
      const generation = ++this.#generation;
      this.#live = {
        pty: parked.pty,
        sessionKey: parked.sessionKey,
        sessionFile: parked.sessionFile,
        cwd: parked.cwd,
        generation,
      };
      this.#suspended = false;
      this.#dataListener = callbacks.onData;
      this.#exitListener = callbacks.onExit;
      // Already wired at spawn — only reattach listeners + resize.
      parked.pty.resize(plan.cols, plan.rows);
      return {
        sessionKey: plan.sessionKey,
        sessionFile: plan.sessionFile,
        cwd: plan.cwd,
        resumed: true,
        generation,
      };
    }

    // Cold spawn.
    const generation = ++this.#generation;
    const piPath = await this.#resolvePiPath();
    if (!piPath.trim()) throw new Error("pi executable not found; install the pi CLI first");
    if (generation !== this.#generation) {
      throw new Error("Terminal open superseded");
    }

    const env = buildPiTuiEnv(process.env);
    const pty = this.#spawn(piPath, plan.args, {
      name: "xterm-256color",
      cols: plan.cols,
      rows: plan.rows,
      cwd: plan.cwd,
      env,
    });

    if (generation !== this.#generation) {
      try {
        pty.kill();
      } catch {
        // ignore
      }
      throw new Error("Terminal open superseded");
    }

    this.#live = {
      pty,
      sessionKey: plan.sessionKey,
      sessionFile: plan.sessionFile,
      cwd: plan.cwd,
      generation,
    };
    this.#suspended = false;
    this.#dataListener = callbacks.onData;
    this.#exitListener = callbacks.onExit;
    this.#wireHandle(pty);

    return {
      sessionKey: plan.sessionKey,
      sessionFile: plan.sessionFile,
      cwd: plan.cwd,
      resumed: false,
      generation,
    };
  }

  /** Wire once per process at spawn; park/promote reuses the same handlers. */
  #wireHandle(pty: PtyHandle): void {
    pty.onData((data) => {
      if (!this.#live || this.#live.pty !== pty || this.#suspended) return;
      this.#dataListener?.(data);
    });
    pty.onExit((event) => {
      if (this.#live?.pty === pty) {
        this.#live = null;
        this.#suspended = false;
        this.#dataListener = null;
        const exitListener = this.#exitListener;
        this.#exitListener = null;
        exitListener?.(event);
        return;
      }
      // Parked process died — drop from park.
      for (const [key, entry] of this.#parked) {
        if (entry.pty === pty) {
          this.#parked.delete(key);
          break;
        }
      }
    });
  }

  #parkLive(): void {
    const live = this.#live;
    if (!live) return;
    this.#dataListener = null;
    this.#exitListener = null;
    this.#suspended = false;
    this.#live = null;
    // Drop existing park entry for same key, then insert.
    const existing = this.#parked.get(live.sessionKey);
    if (existing) {
      try {
        existing.pty.kill();
      } catch {
        // ignore
      }
    }
    this.#parked.set(live.sessionKey, {
      pty: live.pty,
      sessionKey: live.sessionKey,
      sessionFile: live.sessionFile,
      cwd: live.cwd,
      parkedAt: Date.now(),
    });
    this.#trimPark();
  }

  #trimPark(): void {
    while (this.#parked.size > MAX_PARKED_PTYS) {
      let oldestKey: string | null = null;
      let oldestAt = Number.POSITIVE_INFINITY;
      for (const [key, entry] of this.#parked) {
        if (entry.parkedAt < oldestAt) {
          oldestAt = entry.parkedAt;
          oldestKey = key;
        }
      }
      if (!oldestKey) break;
      const entry = this.#parked.get(oldestKey);
      this.#parked.delete(oldestKey);
      try {
        entry?.pty.kill();
      } catch {
        // ignore
      }
    }
  }

  /** Detach UI feed but keep process live for instant re-enter (same session). */
  suspend(): { sessionFile: string | null } {
    if (!this.#live) return { sessionFile: null };
    this.#suspended = true;
    this.#dataListener = null;
    return { sessionFile: this.#live.sessionFile };
  }

  write(data: string): void {
    if (!this.#live || this.#suspended) throw new Error("Terminal is not open");
    this.#live.pty.write(data);
  }

  resize(cols: number, rows: number): void {
    if (!this.#live) return;
    this.#live.pty.resize(Math.max(20, cols), Math.max(5, rows));
  }

  /** Kill live process only (parked sessions stay warm). */
  dispose(): { sessionFile: string | null } {
    const file = this.#live?.sessionFile ?? null;
    const live = this.#live;
    this.#generation += 1;
    this.#live = null;
    this.#suspended = false;
    this.#dataListener = null;
    this.#exitListener = null;
    if (live) {
      try {
        live.pty.kill();
      } catch {
        // ignore
      }
    }
    return { sessionFile: file };
  }

  /** Kill the PTY bound to one session, whether it is live, suspended, or parked. */
  disposeSession(sessionFile: string): boolean {
    const key = normalizeSessionKey(sessionFile);
    if (!key) return false;
    if (this.#live?.sessionKey === key) {
      this.dispose();
      return true;
    }
    const parked = this.#parked.get(key);
    if (!parked) return false;
    this.#parked.delete(key);
    try {
      parked.pty.kill();
    } catch {
      // ignore
    }
    return true;
  }

  /** Kill live + all parked processes (app quit / hard reset). */
  disposeAll(): void {
    this.dispose();
    for (const entry of this.#parked.values()) {
      try {
        entry.pty.kill();
      } catch {
        // ignore
      }
    }
    this.#parked.clear();
  }
}

/** Real node-pty spawn used by the Electron main process. */
export async function createNodePtySpawn(): Promise<PtySpawnFn> {
  const pty = await import("node-pty");
  return (file, args, options) => {
    const proc = pty.spawn(file, args, {
      name: options.name,
      cols: options.cols,
      rows: options.rows,
      cwd: options.cwd,
      env: options.env,
      ...(process.platform === "win32" ? { useConpty: true } : {}),
    });
    return {
      write: (data) => {
        proc.write(data);
      },
      resize: (cols, rows) => {
        proc.resize(cols, rows);
      },
      kill: (signal) => {
        proc.kill(signal);
      },
      onData: (listener) => {
        proc.onData((data) => {
          listener(typeof data === "string" ? data : Buffer.from(data).toString("utf8"));
        });
      },
      onExit: (listener) => {
        proc.onExit((e) => {
          listener({
            exitCode: e.exitCode,
            ...(typeof e.signal === "number" ? { signal: e.signal } : {}),
          });
        });
      },
    };
  };
}
