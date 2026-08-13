import type { SlashCommandSummary } from "@pix/contracts";

export type ComposerTriggerKind = "slash" | "mention";

export interface ComposerTrigger {
  kind: ComposerTriggerKind;
  query: string;
  rangeStart: number;
  rangeEnd: number;
}

function clampCursor(text: string, cursor: number): number {
  if (!Number.isFinite(cursor)) return text.length;
  return Math.max(0, Math.min(text.length, Math.floor(cursor)));
}

function isTriggerBoundary(text: string, index: number): boolean {
  if (index <= 0) return true;
  return /[\s([{"'`]/u.test(text.charAt(index - 1));
}

/**
 * Active `/` or `@` token at the caret — mid-line after chips/text, same as Synara.
 * Query is the unfinished token (`/rev`, `@src`); a space after it closes the trigger.
 */
export function detectComposerTrigger(
  text: string,
  cursorInput = text.length,
): ComposerTrigger | null {
  const cursor = clampCursor(text, cursorInput);
  const lineStart = text.lastIndexOf("\n", Math.max(0, cursor - 1)) + 1;

  let slashStart = -1;
  for (let index = lineStart; index < cursor; index += 1) {
    if (text.charAt(index) === "/" && isTriggerBoundary(text, index)) {
      slashStart = index;
    }
  }
  if (slashStart !== -1) {
    const region = text.slice(slashStart, cursor);
    const match = /^\/([^\s]*)$/.exec(region);
    const query = match?.[1];
    if (query !== undefined && !query.includes("/")) {
      return { kind: "slash", query, rangeStart: slashStart, rangeEnd: cursor };
    }
  }

  let tokenStart = cursor;
  while (tokenStart > lineStart && !/\s/u.test(text.charAt(tokenStart - 1))) {
    tokenStart -= 1;
  }
  const token = text.slice(tokenStart, cursor);
  if (token.startsWith("@")) {
    const lastAt = token.lastIndexOf("@");
    const mentionStart = tokenStart + lastAt;
    const mentionToken = token.slice(lastAt);
    if (/^@[^\s@]*$/.test(mentionToken)) {
      return {
        kind: "mention",
        query: mentionToken.slice(1),
        rangeStart: mentionStart,
        rangeEnd: cursor,
      };
    }
  }

  return null;
}

export function replaceTextRange(
  text: string,
  rangeStart: number,
  rangeEnd: number,
  replacement: string,
): { text: string; cursor: number } {
  const safeStart = Math.max(0, Math.min(text.length, rangeStart));
  const safeEnd = Math.max(safeStart, Math.min(text.length, rangeEnd));
  const next = `${text.slice(0, safeStart)}${replacement}${text.slice(safeEnd)}`;
  return { text: next, cursor: safeStart + replacement.length };
}

export function slashCommandQuery(value: string, cursor = value.length): string | undefined {
  const trigger = detectComposerTrigger(value, cursor);
  return trigger?.kind === "slash" ? trigger.query : undefined;
}

export function addResourceQuery(value: string, cursor = value.length): string | undefined {
  const trigger = detectComposerTrigger(value, cursor);
  return trigger?.kind === "mention" ? trigger.query : undefined;
}

/** `/` menu: 命令 (builtins/prompts/extensions) + 技能 (skills). */
export type SlashGroupId = "command" | "skill";

const SLASH_GROUP_ORDER: SlashGroupId[] = ["command", "skill"];

export function slashGroupId(command: SlashCommandSummary): SlashGroupId {
  if (command.source === "skill" || command.name.startsWith("skill:")) return "skill";
  return "command";
}

export function groupSlashCommands(commands: SlashCommandSummary[]): Array<{
  id: SlashGroupId;
  items: Array<{ command: SlashCommandSummary; flatIndex: number }>;
}> {
  const buckets: Record<SlashGroupId, SlashCommandSummary[]> = {
    command: [],
    skill: [],
  };
  for (const command of commands) {
    buckets[slashGroupId(command)].push(command);
  }
  let flatIndex = 0;
  const groups: Array<{
    id: SlashGroupId;
    items: Array<{ command: SlashCommandSummary; flatIndex: number }>;
  }> = [];
  for (const id of SLASH_GROUP_ORDER) {
    const list = buckets[id];
    if (list.length === 0) continue;
    groups.push({
      id,
      items: list.map((command) => {
        const row = { command, flatIndex };
        flatIndex += 1;
        return row;
      }),
    });
  }
  return groups;
}

/** Display order used by keyboard highlight and Enter/Tab commit — must stay in sync. */
export function slashMenuItemsFromGroups(
  groups: ReturnType<typeof groupSlashCommands>,
): SlashCommandSummary[] {
  return groups.flatMap((group) => group.items.map((item) => item.command));
}

export function filterSlashCommands(
  commands: SlashCommandSummary[],
  query: string,
  /** Soft cap only — keep high so skills are not truncated by a flat global slice. */
  limit = 200,
): SlashCommandSummary[] {
  const needle = query.trim().toLocaleLowerCase();
  return commands
    .filter((command) => {
      if (!needle) return true;
      return (
        command.name.toLocaleLowerCase().includes(needle) ||
        command.description.toLocaleLowerCase().includes(needle)
      );
    })
    .sort((a, b) => {
      const aPrefix = a.name.toLocaleLowerCase().startsWith(needle) ? 0 : 1;
      const bPrefix = b.name.toLocaleLowerCase().startsWith(needle) ? 0 : 1;
      return aPrefix - bPrefix || a.name.localeCompare(b.name);
    })
    .slice(0, limit);
}

/**
 * `@` is for attaching workspace paths / files only — never pi slash / skill / prompt / extension.
 * Kept for API stability; always returns an empty list so callers only show the file-picker row.
 */
export function filterResourceCommands(
  _commands: SlashCommandSummary[],
  _query: string,
  _limit = 12,
): SlashCommandSummary[] {
  return [];
}

export function attachmentLabel(path: string): string {
  const normalized = path.replace(/\\/g, "/").replace(/\/+$/, "");
  return normalized.split("/").pop() || path;
}

/**
 * Token immediately before the caret that looks like a path segment (for Tab completion).
 * Supports `@query` and bare relative paths like `src/co`.
 */
export function pathTokenBeforeCursor(
  value: string,
  cursor: number,
): { start: number; end: number; query: string; atMention: boolean } | undefined {
  const safeCursor = Math.max(0, Math.min(cursor, value.length));
  const before = value.slice(0, safeCursor);
  const match = /(?:^|[\s([{"'`])(@?)([^\s"'`()[\]{}]*)$/.exec(before);
  if (!match) return undefined;
  const at = match[1] === "@";
  const query = match[2] ?? "";
  if (!at && !query) return undefined;
  // Bare tokens need a path-ish shape (slash, dot segment, or alnum start).
  if (!at && !/[./\\]/.test(query) && !/^[A-Za-z0-9_-]+$/.test(query)) return undefined;
  const raw = `${match[1] ?? ""}${query}`;
  const start = safeCursor - raw.length;
  return { start, end: safeCursor, query, atMention: at };
}

/** Replace the path token before the cursor with a completed relative path. */
export function applyPathTokenCompletion(
  value: string,
  cursor: number,
  completion: string,
): { value: string; cursor: number } | undefined {
  const token = pathTokenBeforeCursor(value, cursor);
  if (!token) return undefined;
  const insert = token.atMention ? `@${completion}` : completion;
  const next = `${value.slice(0, token.start)}${insert}${value.slice(token.end)}`;
  const nextCursor = token.start + insert.length;
  return { value: next, cursor: nextCursor };
}

export type AttachmentKind =
  | "archive"
  | "code"
  | "document"
  | "file"
  | "folder"
  | "image"
  | "pdf"
  | "presentation"
  | "spreadsheet"
  | "text";

export interface AttachmentPresentation {
  kind: AttachmentKind;
  typeLabel: string;
}

const ATTACHMENT_TYPES: Record<string, AttachmentPresentation> = {
  xls: { kind: "spreadsheet", typeLabel: "Excel" },
  xlsx: { kind: "spreadsheet", typeLabel: "Excel" },
  xlsm: { kind: "spreadsheet", typeLabel: "Excel" },
  csv: { kind: "spreadsheet", typeLabel: "CSV" },
  ods: { kind: "spreadsheet", typeLabel: "Spreadsheet" },
  png: { kind: "image", typeLabel: "PNG" },
  jpg: { kind: "image", typeLabel: "JPEG" },
  jpeg: { kind: "image", typeLabel: "JPEG" },
  gif: { kind: "image", typeLabel: "GIF" },
  webp: { kind: "image", typeLabel: "WebP" },
  svg: { kind: "image", typeLabel: "SVG" },
  bmp: { kind: "image", typeLabel: "Bitmap" },
  tif: { kind: "image", typeLabel: "TIFF" },
  tiff: { kind: "image", typeLabel: "TIFF" },
  heic: { kind: "image", typeLabel: "HEIC" },
  avif: { kind: "image", typeLabel: "AVIF" },
  pdf: { kind: "pdf", typeLabel: "PDF" },
  ppt: { kind: "presentation", typeLabel: "PowerPoint" },
  pptx: { kind: "presentation", typeLabel: "PowerPoint" },
  odp: { kind: "presentation", typeLabel: "Presentation" },
  key: { kind: "presentation", typeLabel: "Keynote" },
  doc: { kind: "document", typeLabel: "Word" },
  docx: { kind: "document", typeLabel: "Word" },
  odt: { kind: "document", typeLabel: "Document" },
  rtf: { kind: "document", typeLabel: "RTF" },
  zip: { kind: "archive", typeLabel: "ZIP" },
  rar: { kind: "archive", typeLabel: "RAR" },
  "7z": { kind: "archive", typeLabel: "7-Zip" },
  tar: { kind: "archive", typeLabel: "TAR" },
  gz: { kind: "archive", typeLabel: "Gzip" },
  tgz: { kind: "archive", typeLabel: "Gzip" },
  bz2: { kind: "archive", typeLabel: "Bzip2" },
  xz: { kind: "archive", typeLabel: "XZ" },
  txt: { kind: "text", typeLabel: "Text" },
  log: { kind: "text", typeLabel: "Log" },
  md: { kind: "text", typeLabel: "Markdown" },
  mdx: { kind: "text", typeLabel: "MDX" },
  markdown: { kind: "text", typeLabel: "Markdown" },
  java: { kind: "code", typeLabel: "Java" },
  js: { kind: "code", typeLabel: "JavaScript" },
  mjs: { kind: "code", typeLabel: "JavaScript" },
  cjs: { kind: "code", typeLabel: "JavaScript" },
  jsx: { kind: "code", typeLabel: "JavaScript" },
  ts: { kind: "code", typeLabel: "TypeScript" },
  tsx: { kind: "code", typeLabel: "TypeScript" },
  py: { kind: "code", typeLabel: "Python" },
  pyw: { kind: "code", typeLabel: "Python" },
  json: { kind: "code", typeLabel: "JSON" },
  html: { kind: "code", typeLabel: "HTML" },
  css: { kind: "code", typeLabel: "CSS" },
  xml: { kind: "code", typeLabel: "XML" },
  yaml: { kind: "code", typeLabel: "YAML" },
  yml: { kind: "code", typeLabel: "YAML" },
};

/** Public source of truth used by the renderer demo to cover every recognized file format. */
export const SUPPORTED_ATTACHMENT_EXTENSIONS = Object.freeze(Object.keys(ATTACHMENT_TYPES));

export function attachmentPresentation(path: string): AttachmentPresentation {
  const name = attachmentLabel(path);
  const extension = /\.([^.]+)$/.exec(name)?.[1]?.toLocaleLowerCase();
  if (!extension) return { kind: "folder", typeLabel: "Folder" };
  return (
    ATTACHMENT_TYPES[extension] ?? {
      kind: "file",
      typeLabel: extension.toLocaleUpperCase(),
    }
  );
}

/** Images that can be sent as multimodal prompt content. */
export function isPromptImagePath(path: string): boolean {
  return /\.(?:png|jpe?g|gif|webp)$/i.test(attachmentLabel(path));
}

/** Images we can attempt to show as AttachmentMedia variant="image" thumbnails. */
export function isPreviewableImagePath(path: string): boolean {
  return attachmentPresentation(path).kind === "image";
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function promptWithAttachedPaths(message: string, paths: string[]): string {
  if (paths.length === 0) return message;
  const rows = paths.map((path) => `  <path>${escapeXml(path)}</path>`).join("\n");
  return `${message}\n\n<attached-paths>\n${rows}\n</attached-paths>`;
}
