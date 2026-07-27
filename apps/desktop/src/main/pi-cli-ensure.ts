/**
 * Detect the global `pi` CLI and install the latest package when missing.
 * Product mode only — skipped for isolated/smoke/e2e fixtures.
 *
 * Packaged Electron has a minimal GUI PATH; always resolve against augmented
 * user bin dirs so we do not re-run `npm install -g` every launch.
 */
import { execFile, spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import {
  applyProcessPathAugmentation,
  augmentEnvPath,
  candidateCommandPaths,
} from "./shell-path.ts";

const execFileAsync = promisify(execFile);

export const PI_NPM_PACKAGE = "@earendil-works/pi-coding-agent";

export type PiCliProgressPhase =
  | "checking"
  | "installing"
  | "progress"
  | "complete"
  | "error"
  | "skipped";

export type PiCliProgressEvent = {
  phase: PiCliProgressPhase;
  message: string;
  path?: string;
  version?: string;
  installedNow?: boolean;
};

export type PiCliEnsureResult = {
  installed: boolean;
  alreadyPresent: boolean;
  installedNow: boolean;
  skipped: boolean;
  path?: string;
  version?: string;
  error?: string;
};

export type PiCliEnsureOptions = {
  onProgress?: (event: PiCliProgressEvent) => void;
  /** Override env (tests). Defaults to process.env (augmented). */
  env?: NodeJS.ProcessEnv;
  /** Force install even when already present (not used by product). */
  force?: boolean;
};

let ensureInFlight: Promise<PiCliEnsureResult> | undefined;

/** Product launch only — never auto-install during isolated / e2e / smoke fixtures. */
export function shouldAutoInstallPiCli(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env.PIX_SKIP_PI_INSTALL === "1" || env.PIX_SKIP_PI_INSTALL === "true") return false;
  if (env.PIX_ISOLATED === "1" || env.PIX_ISOLATED === "true") return false;
  // Fixture workspace / pinned agent dir → test harness owns the environment.
  if (env.PIX_WORKSPACE?.trim()) return false;
  if (env.PI_CODING_AGENT_DIR?.trim() && env.PIX_ENABLE_TEST_COMMANDS === "1") return false;
  return true;
}

function emit(onProgress: PiCliEnsureOptions["onProgress"], event: PiCliProgressEvent): void {
  // Always log so `pnpm dev` terminal shows install work even when UI chrome is hidden.
  console.log(`[pix:pi] ${event.phase}: ${event.message}`);
  try {
    onProgress?.(event);
  } catch {
    // UI listeners must not break install.
  }
}

function isVitePlusShim(path: string): boolean {
  const norm = path.replace(/\\/g, "/").toLowerCase();
  // ~/.vite-plus/bin/{node,npm,npx,vp} are thin shims; prefer real runtimes when installing.
  return (
    norm.includes("/.vite-plus/bin/") ||
    norm.endsWith("/.vite-plus/bin/npm") ||
    norm.endsWith("/.vite-plus/bin/npm.cmd") ||
    norm.endsWith("/vp") ||
    norm.endsWith("/vp.exe")
  );
}

async function resolveOnPath(command: string, env: NodeJS.ProcessEnv): Promise<string | undefined> {
  // Fast path: known user bins (works with GUI PATH).
  const known = candidateCommandPaths(command, env);
  if (command === "npm" || command === "npm.cmd") {
    const preferred = known.find((p) => !isVitePlusShim(p));
    if (preferred) return preferred;
  } else if (known[0]) {
    return known[0];
  }

  try {
    if (process.platform === "win32") {
      const { stdout } = await execFileAsync("where.exe", [command], {
        env,
        windowsHide: true,
        timeout: 8_000,
        maxBuffer: 1024 * 1024,
      });
      const candidates = stdout
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0 && existsSync(line));
      if (command === "npm" || command === "npm.cmd") {
        const preferred = candidates.find(
          (line) => /\.(cmd|exe|bat)$/i.test(line) && !isVitePlusShim(line),
        );
        if (preferred) return preferred;
        const shim = candidates.find((line) => /\.(cmd|exe|bat)$/i.test(line));
        return shim ?? candidates[0];
      }
      const preferred = candidates.find((line) => /\.(cmd|exe|bat)$/i.test(line));
      return preferred ?? candidates[0];
    }
    const { stdout } = await execFileAsync("which", ["-a", command], {
      env,
      timeout: 8_000,
      maxBuffer: 1024 * 1024,
    });
    const candidates = stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && existsSync(line));
    if (command === "npm") {
      return candidates.find((p) => !isVitePlusShim(p)) ?? candidates[0];
    }
    return candidates[0];
  } catch {
    return known[0];
  }
}

async function readPiVersion(piPath: string, env: NodeJS.ProcessEnv): Promise<string | undefined> {
  try {
    const { stdout, stderr } = await execFileAsync(piPath, ["--version"], {
      env,
      windowsHide: true,
      timeout: 12_000,
      maxBuffer: 1024 * 1024,
    });
    const text = `${stdout}\n${stderr}`.trim();
    const match = /(\d+\.\d+\.\d+(?:[-+][\w.-]+)?)/.exec(text);
    return match?.[1] ?? (text.split(/\r?\n/)[0]?.trim() || undefined);
  } catch {
    return undefined;
  }
}

/** npm global prefix (directory that contains the `pi` shim on Windows, or parent of bin/ on Unix). */
async function npmGlobalPrefix(
  npmPath: string,
  env: NodeJS.ProcessEnv,
): Promise<string | undefined> {
  try {
    const { stdout } = await execFileAsync(npmPath, ["prefix", "-g"], {
      env,
      windowsHide: true,
      // Run outside any project so packageManager/devEngines cannot fail the probe.
      cwd: process.platform === "win32" ? env.TEMP || env.TMP || homedir() : "/tmp",
      timeout: 12_000,
      maxBuffer: 1024 * 1024,
    });
    const prefix = stdout.trim().split(/\r?\n/)[0]?.trim();
    return prefix || undefined;
  } catch {
    return undefined;
  }
}

function candidatePiPaths(prefix: string): string[] {
  if (process.platform === "win32") {
    return [join(prefix, "pi.cmd"), join(prefix, "pi.exe"), join(prefix, "pi")];
  }
  return [join(prefix, "bin", "pi"), join(prefix, "pi")];
}

function detected(path: string, version: string | undefined): { path: string; version?: string } {
  return version ? { path, version } : { path };
}

/** Ensure the directory of a found binary is on process PATH for later host/TUI spawns. */
function ensureDirOnProcessPath(binPath: string): void {
  const dir = dirname(binPath);
  if (!dir) return;
  const current = process.env.PATH || process.env.Path || "";
  const parts = current.split(process.platform === "win32" ? ";" : ":");
  const hit = parts.some((p) =>
    process.platform === "win32" ? p.toLowerCase() === dir.toLowerCase() : p === dir,
  );
  if (hit) return;
  const sep = process.platform === "win32" ? ";" : ":";
  const next = `${dir}${sep}${current}`;
  process.env.PATH = next;
  if (process.platform === "win32") process.env.Path = next;
}

/** Exported for tests — locate pi without installing. */
export async function detectPiCli(
  env: NodeJS.ProcessEnv = process.env,
): Promise<{ path?: string; version?: string }> {
  const resolvedEnv = augmentEnvPath(env);

  const fromPath = await resolveOnPath("pi", resolvedEnv);
  if (fromPath) {
    return detected(fromPath, await readPiVersion(fromPath, resolvedEnv));
  }

  // Global npm prefix (PATH may not include it inside Electron).
  const npmPath =
    (await resolveOnPath("npm", resolvedEnv)) ?? (await resolveOnPath("npm.cmd", resolvedEnv));
  if (npmPath) {
    const prefix = await npmGlobalPrefix(npmPath, resolvedEnv);
    if (prefix) {
      for (const candidate of candidatePiPaths(prefix)) {
        if (!existsSync(candidate)) continue;
        return detected(candidate, await readPiVersion(candidate, resolvedEnv));
      }
    }
  }

  // Common user global locations (GUI launch often misses these on PATH).
  const home = resolvedEnv.HOME || resolvedEnv.USERPROFILE || homedir();
  const extras =
    process.platform === "win32"
      ? [
          join(home, "AppData", "Roaming", "npm", "pi.cmd"),
          join(home, "AppData", "Roaming", "npm", "pi"),
          join(home, "AppData", "Local", "npm", "pi.cmd"),
        ]
      : [
          ...candidateCommandPaths("pi", resolvedEnv),
          join(home, ".vite-plus", "bin", "pi"),
          join(home, ".npm-global", "bin", "pi"),
          join(home, ".local", "bin", "pi"),
          join(home, ".local", "share", "fnm", "aliases", "default", "bin", "pi"),
          join(home, ".volta", "bin", "pi"),
          join(home, ".nvm", "current", "bin", "pi"),
          "/opt/homebrew/bin/pi",
          "/usr/local/bin/pi",
        ];
  const seen = new Set<string>();
  for (const candidate of extras) {
    if (!candidate || seen.has(candidate) || !existsSync(candidate)) continue;
    seen.add(candidate);
    return detected(candidate, await readPiVersion(candidate, resolvedEnv));
  }

  return {};
}

function spawnNpmInstall(npmPath: string, env: NodeJS.ProcessEnv): ChildProcess {
  const args = ["install", "-g", "--ignore-scripts", `${PI_NPM_PACKAGE}@latest`];
  // Install from a neutral cwd so monorepo packageManager/devEngines cannot block npm.
  const cwd = process.platform === "win32" ? env.TEMP || env.TMP || homedir() : "/tmp";
  // On Windows, always shell + prefer .cmd path so PATHEXT resolves correctly.
  if (process.platform === "win32") {
    const cmd =
      /\.(cmd|bat|exe)$/i.test(npmPath) || npmPath.toLowerCase().endsWith("npm.cmd")
        ? npmPath
        : "npm.cmd";
    return spawn(cmd, args, {
      env,
      cwd,
      windowsHide: true,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
    });
  }
  return spawn(npmPath, args, {
    env,
    cwd,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function pipeInstallOutput(
  child: ChildProcess,
  onProgress: PiCliEnsureOptions["onProgress"],
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let tail = "";
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      if (error) reject(error);
      else resolve();
    };

    const onChunk = (chunk: Buffer | string) => {
      const text = String(chunk);
      tail = (tail + text).slice(-4000);
      const lines = text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
      for (const line of lines) {
        // npm is chatty; surface useful lines only.
        if (
          /^(npm\s+(error|ERR!)|error|ERR!)/i.test(line) ||
          /added \d+|removed \d+|changed \d+|up to date|@earendil-works\/pi-coding-agent|package|install/i.test(
            line,
          )
        ) {
          emit(onProgress, {
            phase: "progress",
            message: line.slice(0, 240),
          });
        }
      }
    };

    child.stdout?.on("data", onChunk);
    child.stderr?.on("data", onChunk);
    child.once("error", (error) => finish(error));
    child.once("close", (code) => {
      if (code === 0) finish();
      else {
        const detail = tail.trim().split(/\r?\n/).filter(Boolean).slice(-6).join(" | ");
        finish(
          new Error(
            detail
              ? `npm install failed (exit ${code}): ${detail}`
              : `npm install failed with exit code ${code ?? -1}`,
          ),
        );
      }
    });
  });
}

/**
 * Ensure the global `pi` CLI is available. Installs `@earendil-works/pi-coding-agent@latest`
 * via npm when missing. Concurrent callers share one in-flight promise.
 */
export function ensurePiCli(options: PiCliEnsureOptions = {}): Promise<PiCliEnsureResult> {
  if (ensureInFlight) return ensureInFlight;
  ensureInFlight = ensurePiCliOnce(options).finally(() => {
    ensureInFlight = undefined;
  });
  return ensureInFlight;
}

async function ensurePiCliOnce(options: PiCliEnsureOptions): Promise<PiCliEnsureResult> {
  // Packaged Dock launches need user bins before any which/npm work.
  applyProcessPathAugmentation();
  const env = augmentEnvPath(options.env ?? process.env);
  // Keep process.env in sync so agent-host / PTY inherit the same PATH.
  if (env.PATH) process.env.PATH = env.PATH;
  if (process.platform === "win32" && env.Path) process.env.Path = env.Path;

  const onProgress = options.onProgress;

  if (!shouldAutoInstallPiCli(env) && !options.force) {
    const found = await detectPiCli(env);
    if (found.path) ensureDirOnProcessPath(found.path);
    const skipped: PiCliEnsureResult = {
      installed: Boolean(found.path),
      alreadyPresent: Boolean(found.path),
      installedNow: false,
      skipped: true,
      ...(found.path ? { path: found.path } : {}),
      ...(found.version ? { version: found.version } : {}),
    };
    emit(onProgress, {
      phase: "skipped",
      message: found.path
        ? `Skipped auto-install (fixture mode); pi found${found.version ? ` ${found.version}` : ""}`
        : "Skipped pi auto-install (fixture / test mode)",
      ...(found.path ? { path: found.path } : {}),
      ...(found.version ? { version: found.version } : {}),
    });
    return skipped;
  }

  emit(onProgress, { phase: "checking", message: "Checking for pi CLI…" });
  const existing = await detectPiCli(env);
  if (existing.path && !options.force) {
    ensureDirOnProcessPath(existing.path);
    const result: PiCliEnsureResult = {
      installed: true,
      alreadyPresent: true,
      installedNow: false,
      skipped: false,
      path: existing.path,
      ...(existing.version ? { version: existing.version } : {}),
    };
    emit(onProgress, {
      phase: "complete",
      message: existing.version ? `pi ${existing.version} is installed` : "pi is installed",
      path: existing.path,
      ...(existing.version ? { version: existing.version } : {}),
      installedNow: false,
    });
    return result;
  }

  const npmPath = (await resolveOnPath("npm", env)) ?? (await resolveOnPath("npm.cmd", env));
  if (!npmPath) {
    const error =
      "npm was not found on PATH. Install Node.js/npm, then restart Pix to install pi automatically.";
    emit(onProgress, { phase: "error", message: error });
    return {
      installed: false,
      alreadyPresent: false,
      installedNow: false,
      skipped: false,
      error,
    };
  }

  emit(onProgress, {
    phase: "installing",
    message: `Installing latest ${PI_NPM_PACKAGE}…`,
  });

  try {
    const child = spawnNpmInstall(npmPath, env);
    await pipeInstallOutput(child, onProgress);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    emit(onProgress, { phase: "error", message });
    return {
      installed: false,
      alreadyPresent: false,
      installedNow: false,
      skipped: false,
      error: message,
    };
  }

  // Prefer the npm global bin directory for subsequent resolution inside this process.
  const prefix = await npmGlobalPrefix(npmPath, env);
  const nextEnv: NodeJS.ProcessEnv = { ...env };
  if (prefix) {
    const binDir = process.platform === "win32" ? prefix : join(prefix, "bin");
    // Electron on Windows often uses `Path`; keep both in sync.
    const current = nextEnv.PATH || nextEnv.Path || "";
    if (!current.toLowerCase().includes(binDir.toLowerCase())) {
      nextEnv.PATH = `${binDir}${process.platform === "win32" ? ";" : ":"}${current}`;
      nextEnv.Path = nextEnv.PATH;
    }
    // Best-effort: mutate process.env so later host spawns inherit the global bin.
    if (!process.env.PATH?.toLowerCase().includes(binDir.toLowerCase())) {
      process.env.PATH = nextEnv.PATH;
      if (process.platform === "win32") process.env.Path = nextEnv.PATH;
    }
  }

  const installed = await detectPiCli(nextEnv);
  if (!installed.path) {
    const error = `Installed ${PI_NPM_PACKAGE} but could not locate the pi executable. Restart the terminal/app or add npm's global bin to PATH.`;
    emit(onProgress, { phase: "error", message: error });
    return {
      installed: false,
      alreadyPresent: false,
      installedNow: false,
      skipped: false,
      error,
    };
  }

  ensureDirOnProcessPath(installed.path);

  const result: PiCliEnsureResult = {
    installed: true,
    alreadyPresent: false,
    installedNow: true,
    skipped: false,
    path: installed.path,
    ...(installed.version ? { version: installed.version } : {}),
  };
  emit(onProgress, {
    phase: "complete",
    message: installed.version ? `Installed pi ${installed.version}` : "Installed pi successfully",
    path: installed.path,
    ...(installed.version ? { version: installed.version } : {}),
    installedNow: true,
  });
  return result;
}
