/**
 * Environment for embedded pi TUI — align with agent-host so managed tools
 * (fd/rg under ~/.pi/agent/bin) are found and not re-downloaded every launch.
 */
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";

/** pi `ENV_AGENT_DIR` — tools live at `<agentDir>/bin`. */
export const PI_CODING_AGENT_DIR_ENV = "PI_CODING_AGENT_DIR";

export function defaultPiAgentDir(env: NodeJS.ProcessEnv = process.env): string {
  const fromEnv = env[PI_CODING_AGENT_DIR_ENV]?.trim();
  if (fromEnv) return expandTilde(fromEnv, env);
  const home = env.USERPROFILE || env.HOME || homedir();
  return join(home, ".pi", "agent");
}

export function piManagedBinDir(env: NodeJS.ProcessEnv = process.env): string {
  return join(defaultPiAgentDir(env), "bin");
}

function expandTilde(path: string, env: NodeJS.ProcessEnv): string {
  if (path === "~") return env.USERPROFILE || env.HOME || homedir();
  if (path.startsWith("~/") || path.startsWith("~\\")) {
    return join(env.USERPROFILE || env.HOME || homedir(), path.slice(2));
  }
  return path;
}

/**
 * Build env for `pi --session` PTY:
 * - stable PI_CODING_AGENT_DIR (shared with host / previous TUI runs)
 * - prepend managed bin + common tool locations so getToolPath finds fd/rg
 */
export function buildPiTuiEnv(baseEnv: NodeJS.ProcessEnv = process.env): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(baseEnv)) {
    if (typeof value === "string") env[key] = value;
  }

  const agentDir = defaultPiAgentDir(baseEnv);
  env[PI_CODING_AGENT_DIR_ENV] = agentDir;

  const home = env.USERPROFILE || env.HOME || homedir();
  if (!env.USERPROFILE && process.platform === "win32") env.USERPROFILE = home;
  if (!env.HOME) env.HOME = home;

  // Windows often uses Path; normalize both.
  const existingPath = env.Path || env.PATH || "";
  // Always put managed bin first (even if not created yet) so pi installs fd/rg there
  // and subsequent launches find them without re-downloading.
  const managedBin = join(agentDir, "bin");
  const extras: string[] = [
    managedBin,
    // Common user tool installs (only if present)
    ...[
      join(home, "scoop", "shims"),
      join(home, "AppData", "Local", "Microsoft", "WinGet", "Links"),
      join(home, "AppData", "Roaming", "npm"),
      "C:\\ProgramData\\chocolatey\\bin",
    ].filter((p) => existsSync(p)),
  ];

  const merged = [...extras, ...existingPath.split(delimiter).filter(Boolean)];
  const seen = new Set<string>();
  const pathValue = merged
    .filter((p) => {
      const k = p.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .join(delimiter);

  env.PATH = pathValue;
  env.Path = pathValue;
  env.TERM = env.TERM || "xterm-256color";
  env.COLORTERM = env.COLORTERM || "truecolor";
  // The embedded renderer uses Ghostty's hardware cursor as the single
  // visible input caret. Pi's reverse-video editor caret is stripped before
  // the bytes reach the canvas.
  env.PI_HARDWARE_CURSOR = "1";

  return env;
}
