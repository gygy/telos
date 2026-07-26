/** Short label for a workspace path (directory name + optional parent). */
export function workspaceLabel(path: string | undefined): { name: string; detail?: string } {
  if (!path) return { name: "" };
  const normalized = path.replace(/\\/g, "/").replace(/\/+$/, "");
  const parts = normalized.split("/").filter(Boolean);
  const name = parts.at(-1) ?? path;
  const parent = parts.at(-2);
  return parent ? { name, detail: parent } : { name };
}

export function firstLine(text: string, max = 72): string {
  const line =
    text
      .split(/\r?\n/)
      .find((part) => part.trim())
      ?.trim() ?? text.trim();
  if (line.length <= max) return line;
  return `${line.slice(0, max - 1)}…`;
}

/** Temp / e2e fixture dirs should not pollute the product "recent projects" list. */
export function isEphemeralWorkspacePath(path: string): boolean {
  const normalized = path.replace(/\\/g, "/").toLowerCase();
  return (
    normalized.includes("/tmp/") ||
    normalized.includes("/var/folders/") ||
    normalized.includes("/pix-e2e-") ||
    normalized.includes("/pix-fake-") ||
    normalized.includes("/pix-test-") ||
    normalized.includes("/pix-p0") ||
    normalized.includes("/fork-probe") ||
    normalized.includes("/recent-ws-") ||
    normalized.includes("/other-workspace") ||
    /\/t\/pix-/.test(normalized)
  );
}

/**
 * Auto scratch folders from ensureDefault: Documents/Pix/YYYY-MM-DD[ -N].
 * Used as a host cwd when no project is open — not a real user project for the rail.
 * Does not match Documents/Pix/worktrees/...
 */
export function isAutoDefaultWorkspacePath(path: string): boolean {
  const normalized = path.replace(/\\/g, "/").replace(/\/+$/, "");
  return /\/Pix\/\d{4}-\d{2}-\d{2}(-\d+)?$/i.test(normalized);
}

/**
 * Pure-conversation home: Documents/Pix/conversations[/…].
 * Global「新建会话」uses this cwd — never shown as a project in the rail.
 */
export function isConversationWorkspacePath(path: string): boolean {
  const normalized = path.replace(/\\/g, "/").replace(/\/+$/, "");
  return /\/Pix\/conversations(?:\/|$)/i.test(normalized);
}

/** Paths that must never appear as projects in the sidebar recent/current rail. */
export function isNonProjectWorkspacePath(path: string): boolean {
  return (
    isEphemeralWorkspacePath(path) ||
    isAutoDefaultWorkspacePath(path) ||
    isConversationWorkspacePath(path)
  );
}

/** Normalize workspace/session cwd keys for map lookups (slash + trim trailing). */
export function normalizeWorkspaceKey(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "");
}

/**
 * Thread ids that already live under a **project** bucket in `threadsByCwd`.
 * Used so the 对话 section never briefly inherits project sessions when the
 * project drops out of recent/current for a frame during switches.
 */
export function projectThreadIdsFromCwdMap(
  threadsByCwd: Record<string, ReadonlyArray<{ id: string }>>,
): Set<string> {
  const ids = new Set<string>();
  for (const [rawKey, list] of Object.entries(threadsByCwd)) {
    if (!rawKey?.trim() || isNonProjectWorkspacePath(rawKey)) continue;
    for (const thread of list) {
      if (thread?.id) ids.add(thread.id);
    }
  }
  return ids;
}

/**
 * Whether a thread belongs in the sidebar **对话** section.
 *
 * Product rule: project-bound sessions never appear under 对话 — even when the
 * project is temporarily missing from 置顶/项目 (e.g. selection cleared before
 * recent is refreshed). Classification uses cwd type + optional project-bucket ids,
 * not the live projectKeys set (which can lag one frame).
 */
export function belongsInConversationsSection(
  thread: { id: string; cwd?: string },
  options?: { projectThreadIds?: ReadonlySet<string> },
): boolean {
  if (options?.projectThreadIds?.has(thread.id)) return false;
  const cwd = (thread.cwd || "").trim();
  if (!cwd) return true;
  // Real project path → session under that project only.
  if (!isNonProjectWorkspacePath(cwd)) return false;
  return true;
}

/**
 * Product recent list: drop ephemerals, optionally drop current cwd, dedupe, cap.
 * Pure helper — unit-tested without Electron.
 *
 * Prefer **not** excluding the open project when the result is the only place
 * that keeps it on the rail after selection clears (see `mergeRecentWithOpenProject`).
 */
export function filterRecentWorkspaces(
  paths: readonly string[],
  options?: { current?: string; max?: number },
): string[] {
  const max = options?.max ?? 5;
  const current = options?.current?.replace(/\\/g, "/").replace(/\/+$/, "");
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of paths) {
    if (typeof raw !== "string" || !raw.trim()) continue;
    if (isNonProjectWorkspacePath(raw)) continue;
    const path = raw.replace(/\\/g, "/").replace(/\/+$/, "");
    if (current && path === current) continue;
    if (seen.has(path)) continue;
    seen.add(path);
    out.push(raw);
    if (out.length >= max) break;
  }
  return out;
}

/** Put path first in a recent list, dedupe (normalized keys), cap length. */
export function prependRecentPath(paths: string[], path: string, max = 12): string[] {
  const normalized = path.trim();
  if (!normalized) return paths;
  if (isNonProjectWorkspacePath(normalized)) {
    // Scratch / fixture dirs must not grow the recent projects list.
    const dropKey = normalizeWorkspaceKey(normalized);
    return paths.filter((item) => normalizeWorkspaceKey(item) !== dropKey).slice(0, max);
  }
  const key = normalizeWorkspaceKey(normalized);
  return [normalized, ...paths.filter((item) => normalizeWorkspaceKey(item) !== key)].slice(0, max);
}

/**
 * Keep the open project on the recent rail so clearing selection (switch to
 * pure conversation) never unmounts its card for a frame.
 * `partitionProjects` dedupes when the same path is also `workspacePath`.
 */
export function mergeRecentWithOpenProject(
  recent: readonly string[],
  openProject: string | undefined,
  max = 12,
): string[] {
  if (!openProject?.trim() || isNonProjectWorkspacePath(openProject)) {
    return recent.slice(0, max);
  }
  return prependRecentPath([...recent], openProject, max);
}

/**
 * Merge main-process recent with the open selection for the sidebar rail.
 *
 * - Prefer `listed` order from prefs (source of truth after remove/open).
 * - Keep `selected` even if briefly missing from listed (switch race).
 * - Do **not** resurrect paths that only exist in `previous` — that undoes
 *   explicit「移除」and leaves projects stuck on the rail.
 * - `exclude` drops paths that were just removed (normalized keys).
 */
export function unionRecentWorkspaces(
  listed: readonly string[],
  previous: readonly string[],
  options?: { selected?: string; max?: number; exclude?: readonly string[] },
): string[] {
  const max = options?.max ?? 12;
  const selected = options?.selected?.trim();
  const excluded = new Set(
    (options?.exclude ?? []).map((p) => normalizeWorkspaceKey(p)).filter(Boolean),
  );
  const seen = new Set<string>();
  const out: string[] = [];
  const push = (raw: string | undefined) => {
    if (!raw?.trim() || isNonProjectWorkspacePath(raw)) return;
    const key = normalizeWorkspaceKey(raw);
    if (!key || seen.has(key) || excluded.has(key)) return;
    seen.add(key);
    out.push(raw);
  };
  // Selected first so the open project stays stable on the rail.
  if (selected) push(selected);
  for (const p of listed) {
    push(p);
    if (out.length >= max) break;
  }
  // Only re-use previous for the *selected* project when listed lagged (already
  // handled above). Do not walk the full previous list — that re-adds removals.
  void previous;
  return out;
}
