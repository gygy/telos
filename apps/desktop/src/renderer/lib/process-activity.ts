/**
 * Compact process-step presentation (Codex-style activity rows).
 * Pure helpers — safe for unit tests without React.
 */

export type ProcessToolKind = "read" | "run" | "search" | "edit" | "write" | "list" | "generic";

export type ProcessToolView = {
  kind: ProcessToolKind;
  /** Primary path/file when present (shown as a link chip). */
  path?: string;
  /** Command / query / free-form detail. */
  detail: string;
  /** Truncated one-line preview for the row. */
  preview: string;
  /**
   * True when we only have the tool name (e.g. "bash" / "read") — no real path/command.
   * UI should mute or omit this so it is not styled like a real command/path.
   */
  weak?: boolean;
};

/** Bare tool labels that must not be painted as real command/path highlights. */
export function isWeakToolLabel(text: string, toolName: string): boolean {
  const d = text.replace(/\s+/g, " ").trim().toLowerCase();
  const t = toolName.replace(/\s+/g, " ").trim().toLowerCase();
  if (!d) return true;
  if (d === t) return true;
  // Common bare tool ids when args were not projected into the timeline.
  return (
    d === "bash" ||
    d === "shell" ||
    d === "read" ||
    d === "read_file" ||
    d === "write" ||
    d === "write_file" ||
    d === "edit" ||
    d === "grep" ||
    d === "search" ||
    d === "ls" ||
    d === "list" ||
    d === "tool"
  );
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function firstString(row: Record<string, unknown> | undefined, keys: string[]): string {
  if (!row) return "";
  for (const key of keys) {
    const v = str(row[key]);
    if (v) return v;
  }
  return "";
}

function basename(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] || path;
}

/** Row preview: short so many shell lines stay scannable. */
function truncate(text: string, max = 72): string {
  const one = text.replace(/\s+/g, " ").trim();
  if (one.length <= max) return one;
  return `${one.slice(0, max - 1)}…`;
}

function joinArgv(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) return "";
  if (!value.every((item) => typeof item === "string" || typeof item === "number")) return "";
  return value.map(String).join(" ").trim();
}

const COMMAND_KEYS = [
  "command",
  "cmd",
  "script",
  "shell",
  "code",
  "input",
  "commandLine",
  "Command",
  "CommandLine",
  "powershell",
  "expression",
  "Expression",
] as const;

/**
 * Pull a runnable command string from common tool arg shapes
 * (pi bash/shell/powershell, nested input, argv arrays, plain string).
 */
export function extractCommandFromArgs(args: unknown): string {
  if (typeof args === "string") {
    const trimmed = args.trim();
    if (!trimmed) return "";
    // Sometimes args arrive as a JSON string.
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        return extractCommandFromArgs(JSON.parse(trimmed) as unknown);
      } catch {
        return trimmed;
      }
    }
    return trimmed;
  }
  const row = asRecord(args);
  if (!row) return "";

  const direct = firstString(row, [...COMMAND_KEYS]);
  const argTail = joinArgv(row.argv) || joinArgv(row.args) || joinArgv(row.arguments);
  // powershell + argv: { command: "powershell", args: ["-Command", "Get-ChildItem"] }
  if (direct && argTail && !direct.includes(argTail.slice(0, 12))) {
    return `${direct} ${argTail}`.trim();
  }
  if (direct) return direct;
  if (argTail) return argTail;

  for (const nestKey of ["input", "parameters", "arguments", "params", "options"]) {
    const nested = row[nestKey];
    if (typeof nested === "string" && nested.trim()) {
      // input may be the full script body
      if (nested.trim().length <= 500) return nested.trim();
    }
    const nestRow = asRecord(nested);
    if (!nestRow) continue;
    const nestedCmd = firstString(nestRow, [...COMMAND_KEYS]);
    const nestedArgv =
      joinArgv(nestRow.argv) || joinArgv(nestRow.args) || joinArgv(nestRow.arguments);
    if (nestedCmd && nestedArgv && !nestedCmd.includes(nestedArgv.slice(0, 12))) {
      return `${nestedCmd} ${nestedArgv}`.trim();
    }
    if (nestedCmd) return nestedCmd;
    if (nestedArgv) return nestedArgv;
  }
  return "";
}

/** Best-effort: recover a command from tool output when args were not persisted. */
export function extractCommandFromOutput(output: string | undefined): string {
  if (!output) return "";
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  for (const line of lines.slice(0, 6)) {
    const shell = /^[$>]\s+(.+)$/.exec(line);
    if (shell?.[1]) return shell[1].trim();
    const ps = /^(?:PS\s+[^>]*>)\s*(.+)$/i.exec(line);
    if (ps?.[1]) return ps[1].trim();
    const labeled =
      /^(?:command|cmd|ran|running|执行|命令)[:：]\s*(.+)$/i.exec(line) ??
      /^(?:\$)\s*(.+)$/.exec(line);
    if (labeled?.[1]) return labeled[1].trim();
  }
  return "";
}

export function classifyToolName(toolName: string): ProcessToolKind {
  const name = toolName.trim().toLowerCase();
  if (!name) return "generic";
  if (/(^|_)(read|cat|open_file|get_file)(_|$)/.test(name) || name === "read_file") return "read";
  // bash / shell / powershell / pwsh / cmd / terminal …
  if (
    /(^|_)(bash|shell|exec|run|terminal|command|powershell|pwsh|cmd)(_|$)/.test(name) ||
    name === "powershell" ||
    name === "pwsh"
  ) {
    return "run";
  }
  // web_search / WebSearch / codebase_search / grep …
  if (
    /(^|_)(grep|search|rg|find_in|codebase_search|web_search|websearch)(_|$)/.test(name) ||
    name === "web_search" ||
    name === "websearch"
  ) {
    return "search";
  }
  if (/(^|_)(edit|str_replace|search_replace|apply_patch|patch)(_|$)/.test(name)) return "edit";
  if (/(^|_)(write|create_file|write_file)(_|$)/.test(name)) return "write";
  if (/(^|_)(ls|list|glob|find|dir)(_|$)/.test(name)) return "list";
  return "generic";
}

export type ProcessToolViewOptions = {
  /** Tool result text — used when args lack a command (history reload). */
  output?: string;
  /** Explicit command from history projection when available. */
  command?: string;
};

/** Build a compact view model for a tool call row. */
export function processToolView(
  toolName: string,
  args: unknown,
  options?: ProcessToolViewOptions,
): ProcessToolView {
  const kind = classifyToolName(toolName);
  const row = asRecord(args);
  const path = firstString(row, ["path", "file_path", "file", "filename", "target", "glob"]);
  const command =
    str(options?.command) ||
    extractCommandFromArgs(args) ||
    extractCommandFromOutput(options?.output);
  const query = firstString(row, [
    "query",
    "pattern",
    "regex",
    "search",
    "q",
    "text",
    "keywords",
    "prompt",
  ]);
  const description = firstString(row, ["description", "title", "name"]);
  // Avoid using raw "content" as description when it is huge file body for write tools.
  const content = firstString(row, ["content"]);
  const shortContent = content && content.length <= 80 ? content : "";

  if (kind === "run") {
    const detail = command || description || shortContent;
    if (!detail) {
      return { kind, detail: toolName, preview: toolName, weak: true, ...(path ? { path } : {}) };
    }
    return { kind, detail, preview: truncate(detail), ...(path ? { path } : {}) };
  }
  if (kind === "search") {
    const detail = query || description || command;
    if (!detail) {
      return { kind, detail: toolName, preview: toolName, weak: true, ...(path ? { path } : {}) };
    }
    return {
      kind,
      detail,
      preview: truncate(detail),
      ...(path ? { path } : {}),
    };
  }
  if (kind === "read" || kind === "edit" || kind === "write" || kind === "list") {
    if (path) {
      return {
        kind,
        detail: path,
        preview: basename(path),
        path,
      };
    }
    const detail = description || shortContent;
    if (!detail) {
      return { kind, detail: toolName, preview: toolName, weak: true };
    }
    return {
      kind,
      detail,
      preview: truncate(detail),
    };
  }

  const detail =
    command ||
    path ||
    query ||
    description ||
    shortContent ||
    (args !== undefined ? JSON.stringify(args) : "");
  if (!detail) {
    return { kind: "generic", detail: toolName, preview: toolName, weak: true };
  }
  return {
    kind: "generic",
    detail: String(detail),
    preview: truncate(String(detail)),
    ...(path ? { path } : {}),
    ...(isWeakToolLabel(String(detail), toolName) ? { weak: true } : {}),
  };
}

/**
 * Consecutive tools with the same kind collapse into one group (including shell/run).
 * Expand the group to see each step; per-step duration stays on each nested row.
 */
export function groupConsecutiveTools<T extends { kind: "tool"; toolName: string }>(
  items: T[],
): Array<{ type: "single"; item: T } | { type: "group"; kind: ProcessToolKind; items: T[] }> {
  const out: Array<
    { type: "single"; item: T } | { type: "group"; kind: ProcessToolKind; items: T[] }
  > = [];
  let i = 0;
  while (i < items.length) {
    const item = items[i]!;
    const kind = classifyToolName(item.toolName);
    let j = i + 1;
    while (j < items.length && classifyToolName(items[j]!.toolName) === kind) j += 1;
    const slice = items.slice(i, j);
    if (slice.length >= 2) {
      out.push({ type: "group", kind, items: slice });
    } else {
      out.push({ type: "single", item: slice[0]! });
    }
    i = j;
  }
  return out;
}
