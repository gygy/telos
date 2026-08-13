/**
 * Tokenize composer / user-message text for special-content chips
 * (skills, plugins, slash commands, @paths, links, shell injections).
 *
 * After send, pi expands `/skill:name` into a `<skill …>` block. Display
 * surfaces collapse that back to a compact reference instead of the body.
 */

export type ComposerHighlightKind =
  | "text"
  | "url"
  | "mention"
  | "package"
  | "slash"
  | "skill"
  | "prompt"
  | "extension"
  | "shell";

export interface ComposerHighlightSpan {
  kind: ComposerHighlightKind;
  /** Raw source text (must stay in the composer overlay for caret alignment). */
  text: string;
  /** Compact chip label when different from `text`. */
  label?: string;
}

/**
 * Codex-style chips (icon + name, not raw `/skill:` text):
 *   /  → skill, prompt, extension
 *   @  → package (plugin), file, folder
 * Files/folders still attach via <attached-paths>; they are not re-inlined.
 */
export type ComposerRefKind = "skill" | "prompt" | "extension" | "package" | "file" | "folder";

export interface ComposerRefToken {
  kind: ComposerRefKind;
  /** Sent to the agent (`/skill:name` or `@source`). */
  raw: string;
  label: string;
  /** Absolute path when the chip is a file/folder attachment. */
  path?: string;
}

export interface ComposerHighlightOptions {
  /** Installed package sources — `@source` becomes a plugin chip. */
  packageSources?: readonly string[];
  /** Prompt-template command names (without leading `/`). */
  promptNames?: readonly string[];
  /** Extension command names (without leading `/`). */
  extensionNames?: readonly string[];
}

/** Parsed skill block from a persisted / host-echoed user message. */
export interface ParsedSkillBlock {
  name: string;
  location: string;
  content: string;
  userMessage?: string;
}

const URL_TRAIL_PUNCT = new Set(".,;:!?)]}>'\"");

function isBoundaryBefore(input: string, index: number): boolean {
  if (index <= 0) return true;
  return /[\s([{"'`]/u.test(input.charAt(index - 1));
}

function isLineStart(input: string, index: number): boolean {
  if (index <= 0) return true;
  return input.charAt(index - 1) === "\n";
}

function canStartSpecial(input: string, index: number): boolean {
  const ch = input.charAt(index);
  if (!ch) return false;
  if (ch === "!" && isLineStart(input, index)) {
    return input.startsWith("!!", index) || input.charAt(index + 1) !== "=";
  }
  if (ch === "h" && (input.startsWith("http://", index) || input.startsWith("https://", index))) {
    return true;
  }
  if (ch === "@" && isBoundaryBefore(input, index)) return true;
  if (ch === "/" && isBoundaryBefore(input, index)) {
    const next = input.charAt(index + 1);
    return Boolean(next && /[A-Za-z0-9]/u.test(next));
  }
  return false;
}

function pushSpan(spans: ComposerHighlightSpan[], span: ComposerHighlightSpan): void {
  if (!span.text) return;
  const last = spans[spans.length - 1];
  if (last && last.kind === span.kind && last.kind === "text") {
    last.text += span.text;
    return;
  }
  if (last && last.kind === span.kind && last.label === span.label) {
    last.text += span.text;
    return;
  }
  spans.push(span);
}

function takeUrl(input: string, start: number): { end: number; url: string; trail: string } {
  let end = start;
  while (end < input.length && !/\s/u.test(input.charAt(end))) end += 1;
  let url = input.slice(start, end);
  let trail = "";
  while (url.length > 0 && URL_TRAIL_PUNCT.has(url.charAt(url.length - 1))) {
    // Keep a trailing ")" only when the URL still has an unmatched "(".
    if (url.endsWith(")")) {
      const opens = (url.match(/\(/g) ?? []).length;
      const closes = (url.match(/\)/g) ?? []).length;
      if (opens >= closes) break;
    }
    trail = `${url.slice(-1)}${trail}`;
    url = url.slice(0, -1);
  }
  return { end, url, trail };
}

function basenameLabel(value: string): string {
  const trimmed = value.replace(/[\\/]+$/, "");
  const parts = trimmed.split(/[\\/]/).filter(Boolean);
  return parts.at(-1) || value;
}

function packageLabel(value: string): string {
  const stripped = value.replace(
    /^(npm:|npx:|jsr:|pkg:|git\+|github:|gitlab:|bitbucket:|local:|file:)/i,
    "",
  );
  if (stripped.startsWith("@") && stripped.includes("/")) return stripped;
  return basenameLabel(stripped) || value;
}

/** npm:/git:/github: (and similar) package sources, not workspace paths. */
export function looksLikePackageSource(value: string): boolean {
  return /^(npm:|npx:|jsr:|pkg:|git\+|github:|gitlab:|bitbucket:|local:|file:)/i.test(value);
}

function slashKind(
  name: string,
  options: ComposerHighlightOptions | undefined,
): Extract<ComposerHighlightKind, "slash" | "prompt" | "extension"> {
  if (options?.promptNames?.includes(name)) return "prompt";
  if (options?.extensionNames?.includes(name)) return "extension";
  return "slash";
}

function mentionKind(
  body: string,
  options: ComposerHighlightOptions | undefined,
): Extract<ComposerHighlightKind, "mention" | "package"> {
  if (options?.packageSources?.includes(body) || looksLikePackageSource(body)) return "package";
  return "mention";
}

export function composerTokenLabel(
  span: Pick<ComposerHighlightSpan, "kind" | "text" | "label">,
): string {
  if (span.label) return span.label;
  if (span.kind === "skill" && span.text.startsWith("/skill:")) {
    return span.text.slice("/skill:".length) || span.text;
  }
  if (span.kind === "slash" || span.kind === "prompt" || span.kind === "extension") {
    return span.text.replace(/^\//, "") || span.text;
  }
  if (span.kind === "package") {
    return packageLabel(span.text.replace(/^@/, "")) || span.text;
  }
  if (span.kind === "mention") {
    return basenameLabel(span.text.replace(/^@/, "")) || span.text;
  }
  if (span.kind === "shell") {
    return span.text.replace(/^!!?/, "").trim() || span.text;
  }
  if (span.kind === "url") return urlChipLabel(span.text);
  return span.text;
}

function titleCaseRef(value: string): string {
  return value
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/** 1em spacer in the textarea so the overlay can paint a chip icon without caret drift. */
export const COMPOSER_CHIP_ICON_SLOT = "\u2003";

/** Inserted chip: icon slot, space, display name, trailing space (Synara icon/label gap). */
export function composerChipInsertText(label: string): string {
  return `${COMPOSER_CHIP_ICON_SLOT} ${label} `;
}

/** Human chip title: `skill:open-kimi-ppt` → `Open Kimi Ppt`. */
export function composerRefDisplayLabel(raw: string): string {
  let name = raw
    .replace(/^[@/]/, "")
    .replace(/^skill:/i, "")
    .trim();
  if (!name) return raw;
  if (/[/:]/.test(name)) {
    name = name.split(/[/:]/).filter(Boolean).at(-1) || name;
  }
  return titleCaseRef(name) || raw;
}

export function isComposerRefCommand(command: { source?: string; name: string }): boolean {
  return (
    command.source === "skill" ||
    command.source === "prompt" ||
    command.source === "extension" ||
    command.name.startsWith("skill:")
  );
}

export function addComposerRef(
  current: ComposerRefToken[],
  next: ComposerRefToken,
): ComposerRefToken[] {
  if (current.some((item) => item.raw === next.raw)) return current;
  return [...current, next];
}

export function composerRefHighlightKind(
  kind: ComposerRefKind,
): Exclude<ComposerHighlightKind, "text"> {
  if (kind === "file" || kind === "folder") return "mention";
  return kind;
}

export interface ComposerChipRange {
  start: number;
  end: number;
  token: ComposerRefToken;
}

/** Visible chip spans in the composer (icon slot + display name). */
export function findComposerChipRanges(
  input: string,
  refs: readonly ComposerRefToken[],
): ComposerChipRange[] {
  if (!refs.length || !input) return [];
  const marks: ComposerChipRange[] = [];
  const used = Array.from({ length: input.length }, () => false);
  const sorted = [...refs].sort((a, b) => b.label.length - a.label.length);

  for (const token of sorted) {
    let from = 0;
    while (from <= input.length) {
      const start = findBoundedLabel(input, token.label, from);
      if (start < 0) break;
      const end = start + token.label.length;
      let free = true;
      for (let i = start; i < end; i++) {
        if (used[i]) {
          free = false;
          break;
        }
      }
      if (free) {
        let spanStart = start;
        if (
          start > 1 &&
          input.charAt(start - 1) === " " &&
          input.charAt(start - 2) === COMPOSER_CHIP_ICON_SLOT &&
          !used[start - 1] &&
          !used[start - 2]
        ) {
          spanStart = start - 2;
          used[start - 1] = true;
          used[start - 2] = true;
        } else if (
          start > 0 &&
          input.charAt(start - 1) === COMPOSER_CHIP_ICON_SLOT &&
          !used[start - 1]
        ) {
          spanStart = start - 1;
          used[spanStart] = true;
        }
        marks.push({ start: spanStart, end, token });
        for (let i = start; i < end; i++) used[i] = true;
        break;
      }
      from = start + 1;
    }
  }

  marks.sort((a, b) => a.start - b.start);
  return marks;
}

export function chipRangeAtCaret(
  ranges: readonly ComposerChipRange[],
  caret: number,
): ComposerChipRange | null {
  for (const range of ranges) {
    if (caret > range.start && caret < range.end) return range;
  }
  return null;
}

export function chipRangeEndingAt(
  ranges: readonly ComposerChipRange[],
  caret: number,
): ComposerChipRange | null {
  return ranges.find((range) => range.end === caret) ?? null;
}

export function chipRangeStartingAt(
  ranges: readonly ComposerChipRange[],
  caret: number,
): ComposerChipRange | null {
  return ranges.find((range) => range.start === caret) ?? null;
}

/**
 * Synara: the chip's underlying token is still `/skill:name` / `@source`.
 * Caret sitting on the chip (after deleting the trailing space) is an active trigger.
 */
export function detectChipTrigger(
  text: string,
  caret: number,
  refs: readonly ComposerRefToken[],
): { kind: "slash" | "mention"; query: string; rangeStart: number; rangeEnd: number } | null {
  const ranges = findComposerChipRanges(text, refs);
  const chip = chipRangeEndingAt(ranges, caret) ?? chipRangeAtCaret(ranges, caret);
  if (!chip) return null;
  const raw = chip.token.raw;
  if (chip.token.kind === "package" || chip.token.kind === "file" || chip.token.kind === "folder") {
    return {
      kind: "mention",
      query: raw.replace(/^@/, ""),
      rangeStart: chip.start,
      rangeEnd: chip.end,
    };
  }
  return {
    kind: "slash",
    query: raw.replace(/^\//, ""),
    rangeStart: chip.start,
    rangeEnd: chip.end,
  };
}

export function removeComposerChip(
  prompt: string,
  range: ComposerChipRange,
): { text: string; cursor: number } {
  return {
    text: `${prompt.slice(0, range.start)}${prompt.slice(range.end)}`,
    cursor: range.start,
  };
}

/** Label must sit on a whitespace/edge boundary so partial edits drop the ref. */
export function findBoundedLabel(input: string, label: string, from = 0): number {
  if (!label) return -1;
  let start = input.indexOf(label, from);
  while (start !== -1) {
    const end = start + label.length;
    const left = start === 0 || /\s/u.test(input.charAt(start - 1));
    const right = end === input.length || /\s/u.test(input.charAt(end));
    if (left && right) return start;
    start = input.indexOf(label, start + 1);
  }
  return -1;
}

export function pruneComposerRefs(tokens: ComposerRefToken[], prompt: string): ComposerRefToken[] {
  const next = tokens.filter((token) => findBoundedLabel(prompt, token.label) >= 0);
  return next.length === tokens.length ? tokens : next;
}

/**
 * Skills/prompts lead so pi can expand them; plugins trail.
 * Display names are stripped from the sentence and replaced by raw commands,
 * space-separated like the visible composer line.
 */
export function serializeComposerRefs(tokens: ComposerRefToken[], prompt: string): string {
  let body = prompt;
  for (const token of tokens) {
    const start = findBoundedLabel(body, token.label);
    if (start >= 0) {
      body = `${body.slice(0, start)} ${body.slice(start + token.label.length)}`;
    }
  }
  body = body.replace(/\s+/gu, " ").trim();
  const leading = tokens.filter(
    (item) => item.kind === "skill" || item.kind === "prompt" || item.kind === "extension",
  );
  const trailing = tokens.filter((item) => item.kind === "package");
  return [
    leading.map((item) => item.raw).join(" "),
    body,
    trailing.map((item) => item.raw).join(" "),
  ]
    .filter(Boolean)
    .join(" ");
}

/** Sent bubble: collapse expanded `<skill>` then tokenize in document order. */
export function userMessageHighlightSpans(
  text: string,
  options?: ComposerHighlightOptions,
): ComposerHighlightSpan[] {
  return tokenizeComposerHighlight(compactUserMessageText(text), options);
}

/** Short host + path for URL chips in user messages (composer overlay paints the raw URL). */
export function urlChipLabel(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname === "/" ? "" : parsed.pathname;
    const hostPath = `${parsed.hostname}${path}`;
    return hostPath.length > 36 ? `${hostPath.slice(0, 35)}…` : hostPath;
  } catch {
    return url.length > 36 ? `${url.slice(0, 35)}…` : url;
  }
}

/**
 * Parse a pi-expanded skill block from message text.
 * Matches AgentSession._expandSkillCommand / parseSkillBlock.
 */
export function parseSkillBlock(text: string): ParsedSkillBlock | null {
  const match = text.match(
    /^<skill name="([^"]+)" location="([^"]+)">\r?\n([\s\S]*?)\r?\n<\/skill>(?:\r?\n\r?\n([\s\S]+))?$/,
  );
  if (!match) return null;
  const userMessage = match[4]?.trim();
  return {
    name: match[1] ?? "",
    location: match[2] ?? "",
    content: match[3] ?? "",
    ...(userMessage ? { userMessage } : {}),
  };
}

/** Restore the user-facing `/skill:name …` form (copy, edit, titles, queue). */
export function compactUserMessageText(text: string): string {
  const skill = parseSkillBlock(text);
  if (!skill) return text;
  return skill.userMessage ? `/skill:${skill.name} ${skill.userMessage}` : `/skill:${skill.name}`;
}

/**
 * Split prompt into highlight spans. Adjacent same-kind spans are merged.
 * Empty input yields a single empty text span (stable for render).
 */
export function tokenizeComposerHighlight(
  input: string,
  options?: ComposerHighlightOptions,
): ComposerHighlightSpan[] {
  if (!input) return [{ kind: "text", text: "" }];

  const spans: ComposerHighlightSpan[] = [];
  let i = 0;
  const n = input.length;

  while (i < n) {
    // Shell injection: leading `!` / `!!` on a line (matches composer shell parse).
    if (isLineStart(input, i) && input.charAt(i) === "!") {
      if (input.startsWith("!!", i) || input.charAt(i + 1) !== "=") {
        let end = i;
        while (end < n && input.charAt(end) !== "\n") end += 1;
        const text = input.slice(i, end);
        pushSpan(spans, {
          kind: "shell",
          text,
          label: composerTokenLabel({ kind: "shell", text }),
        });
        i = end;
        continue;
      }
    }

    // http(s) URL
    if (input.startsWith("http://", i) || input.startsWith("https://", i)) {
      const { end, url, trail } = takeUrl(input, i);
      if (url) pushSpan(spans, { kind: "url", text: url });
      if (trail) pushSpan(spans, { kind: "text", text: trail });
      i = end;
      continue;
    }

    // @path / @package mention
    if (input.charAt(i) === "@" && isBoundaryBefore(input, i)) {
      let end = i + 1;
      while (end < n && !/\s/u.test(input.charAt(end))) end += 1;
      if (end > i + 1) {
        const text = input.slice(i, end);
        const body = text.slice(1);
        const kind = mentionKind(body, options);
        pushSpan(spans, { kind, text, label: composerTokenLabel({ kind, text }) });
        i = end;
        continue;
      }
    }

    // /slash, /skill:name, prompt, extension
    if (input.charAt(i) === "/" && isBoundaryBefore(input, i)) {
      if (input.startsWith("/skill:", i)) {
        let end = i + "/skill:".length;
        while (end < n && !/\s/u.test(input.charAt(end))) end += 1;
        const text = input.slice(i, end);
        pushSpan(spans, {
          kind: "skill",
          text,
          label: composerTokenLabel({ kind: "skill", text }),
        });
        i = end;
        continue;
      }
      const next = input.charAt(i + 1);
      if (next && /[A-Za-z0-9]/u.test(next)) {
        let end = i + 1;
        while (end < n && /[A-Za-z0-9:_./-]/u.test(input.charAt(end))) end += 1;
        const text = input.slice(i, end);
        const name = text.slice(1);
        const kind = slashKind(name, options);
        pushSpan(spans, { kind, text, label: composerTokenLabel({ kind, text }) });
        i = end;
        continue;
      }
    }

    // Plain text until the next special token.
    let end = i + 1;
    while (end < n && !canStartSpecial(input, end)) end += 1;
    pushSpan(spans, { kind: "text", text: input.slice(i, end) });
    i = end;
  }

  return spans.length > 0 ? spans : [{ kind: "text", text: "" }];
}

/** CSS class for a highlight span (used by the mirror layer). */
export function composerHighlightClass(kind: ComposerHighlightKind): string {
  if (kind === "text") return "composer-hl-text";
  return `composer-hl-${kind}`;
}

/**
 * Overlay tokenizer: paint picked ref display names (they have no `/` `@` prefix)
 * then fall through to the regular special-token scan.
 */
export function highlightComposerPrompt(
  input: string,
  options?: ComposerHighlightOptions,
  refs?: readonly ComposerRefToken[],
): ComposerHighlightSpan[] {
  if (!refs?.length) return tokenizeComposerHighlight(input, options);

  const marks = findComposerChipRanges(input, refs);
  const spans: ComposerHighlightSpan[] = [];
  let cursor = 0;
  for (const mark of marks) {
    if (mark.start > cursor) {
      for (const span of tokenizeComposerHighlight(input.slice(cursor, mark.start), options)) {
        pushSpan(spans, span);
      }
    }
    pushSpan(spans, {
      kind: composerRefHighlightKind(mark.token.kind),
      text: input.slice(mark.start, mark.end),
      label: mark.token.label,
    });
    cursor = mark.end;
  }
  if (cursor < input.length) {
    for (const span of tokenizeComposerHighlight(input.slice(cursor), options)) {
      pushSpan(spans, span);
    }
  }
  return spans.length > 0 ? spans : [{ kind: "text", text: "" }];
}
