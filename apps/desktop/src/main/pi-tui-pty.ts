/**
 * PTY lifecycle for embedded pi TUI.
 *
 * Correctness rule: never stream a prior process into a new UI surface.
 * Every `open()` tears down any existing PTY and spawns a fresh `pi --session`.
 * (Tool bootstrap stays warm via PI_CODING_AGENT_DIR / PATH — not via process reuse.)
 */
import type { PiTuiLaunchPlan } from "./pi-tui-session.ts";
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
  /** Always false — open never reuses a process (avoids wrong-session paints). */
  resumed: boolean;
  /** Monotonic generation for this live PTY; renderer can ignore stale opens. */
  generation: number;
};

export type PiTuiPtyCallbacks = {
  onData: (data: string) => void;
  onExit: (event: PtyExitEvent) => void;
};

/**
 * Manages at most one live pi TUI PTY.
 */
export class PiTuiPtyController {
  #spawn: PtySpawnFn;
  #resolvePiPath: () => Promise<string>;
  #pty: PtyHandle | null = null;
  #sessionKey: string | null = null;
  #sessionFile: string | null = null;
  #suspended = false;
  #dataListener: ((data: string) => void) | null = null;
  #exitListener: ((event: PtyExitEvent) => void) | null = null;
  /** Bumped on every open/dispose so stale process I/O is ignored. */
  #generation = 0;

  constructor(spawn: PtySpawnFn, resolvePiPath: () => Promise<string>) {
    this.#spawn = spawn;
    this.#resolvePiPath = resolvePiPath;
  }

  isOpen(): boolean {
    return this.#pty !== null && !this.#suspended;
  }

  isAlive(): boolean {
    return this.#pty !== null;
  }

  isSuspended(): boolean {
    return this.#suspended && this.#pty !== null;
  }

  sessionKey(): string | null {
    return this.#sessionKey;
  }

  sessionFile(): string | null {
    return this.#sessionFile;
  }

  generation(): number {
    return this.#generation;
  }

  async open(plan: PiTuiLaunchPlan, callbacks: PiTuiPtyCallbacks): Promise<PiTuiPtyOpenResult> {
    // Always kill any prior process first — never resume a buffer that may belong
    // to another session or an earlier mount of the same path.
    if (this.#pty) {
      this.dispose();
    }

    const generation = ++this.#generation;
    const piPath = await this.#resolvePiPath();
    if (!piPath.trim()) throw new Error("pi executable not found; install the pi CLI first");

    // Superseded while resolving pi path (rapid session switches).
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

    // Another open won the race after spawn — kill this orphan immediately.
    if (generation !== this.#generation) {
      try {
        pty.kill();
      } catch {
        // ignore
      }
      throw new Error("Terminal open superseded");
    }

    this.#pty = pty;
    this.#sessionKey = plan.sessionKey;
    this.#sessionFile = plan.sessionFile;
    this.#suspended = false;
    this.#dataListener = callbacks.onData;
    this.#exitListener = callbacks.onExit;

    pty.onData((data) => {
      // Identity + generation: dying processes must not feed a newer session UI.
      if (this.#pty !== pty || this.#generation !== generation || this.#suspended) return;
      this.#dataListener?.(data);
    });
    pty.onExit((event) => {
      if (this.#pty === pty && this.#generation === generation) {
        this.#pty = null;
        this.#sessionKey = null;
        this.#sessionFile = null;
        this.#suspended = false;
        this.#dataListener = null;
        const exitListener = this.#exitListener;
        this.#exitListener = null;
        exitListener?.(event);
      }
    });

    return {
      sessionKey: plan.sessionKey,
      sessionFile: plan.sessionFile,
      cwd: plan.cwd,
      resumed: false,
      generation,
    };
  }

  /**
   * Keep process alive but stop UI feed. Prefer dispose() when switching sessions;
   * open() always kills any prior process regardless.
   */
  suspend(): { sessionFile: string | null } {
    if (!this.#pty) return { sessionFile: null };
    this.#suspended = true;
    this.#dataListener = null;
    return { sessionFile: this.#sessionFile };
  }

  write(data: string): void {
    if (!this.#pty || this.#suspended) throw new Error("Terminal is not open");
    this.#pty.write(data);
  }

  resize(cols: number, rows: number): void {
    if (!this.#pty) return;
    this.#pty.resize(Math.max(20, cols), Math.max(5, rows));
  }

  dispose(): { sessionFile: string | null } {
    const file = this.#sessionFile;
    const pty = this.#pty;
    // Invalidate generation so any in-flight open/spawn cannot attach.
    this.#generation += 1;
    this.#pty = null;
    this.#sessionKey = null;
    this.#sessionFile = null;
    this.#suspended = false;
    this.#dataListener = null;
    this.#exitListener = null;
    if (pty) {
      try {
        pty.kill();
      } catch {
        // process may already have exited
      }
    }
    return { sessionFile: file };
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
