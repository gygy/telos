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
  return span.text;
}

/**
 * Use a compact chip face over a hidden sizer when the label is shorter
 * than the raw token. Keeps textarea caret alignment.
 */
export function shouldUseChipFace(span: ComposerHighlightSpan): boolean {
  if (span.kind === "text" || span.kind === "url" || span.kind === "shell") return false;
  const label = composerTokenLabel(span);
  return label.length > 0 && label.length + 3 < span.text.length;
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
