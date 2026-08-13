/**
 * Synara inline tokens: cube/file/plugin icon + title-case name, in the sentence.
 * Composer overlay uses the same face; a leading em-space holds the icon (caret-safe).
 */
import type { ReactNode } from "react";
import { Box, File, Link2, MessageSquareText, Puzzle, Slash, Terminal } from "lucide-react";
import {
  COMPOSER_CHIP_ICON_SLOT,
  composerRefDisplayLabel,
  composerTokenLabel,
  userMessageHighlightSpans,
  type ComposerHighlightKind,
  type ComposerHighlightSpan,
} from "../lib/composer-highlight.ts";
import { t, type Locale } from "../lib/i18n.ts";

const ICON = { className: "prompt-token-chip-icon", strokeWidth: 2 } as const;
const OVERLAY_ICON = { className: "composer-hl-token-icon", strokeWidth: 2 } as const;

function tokenIcon(
  kind: Exclude<ComposerHighlightKind, "text">,
  icon: { className: string; strokeWidth: number } = ICON,
): ReactNode {
  switch (kind) {
    case "skill":
      return <Box {...icon} />;
    case "prompt":
      return <MessageSquareText {...icon} />;
    case "package":
    case "extension":
      return <Puzzle {...icon} />;
    case "mention":
      return <File {...icon} />;
    case "slash":
      return <Slash {...icon} />;
    case "url":
      return <Link2 {...icon} />;
    case "shell":
      return <Terminal {...icon} />;
    default:
      return null;
  }
}

function tokenAriaKey(kind: Exclude<ComposerHighlightKind, "text">): Parameters<typeof t>[1] {
  switch (kind) {
    case "skill":
      return "composer.token.skill";
    case "package":
    case "extension":
      return "composer.token.package";
    case "prompt":
      return "composer.token.prompt";
    case "mention":
      return "composer.token.mention";
    case "slash":
      return "composer.token.slash";
    case "url":
      return "composer.token.url";
    case "shell":
      return "composer.token.shell";
    default:
      return "composer.token.slash";
  }
}

export function PromptTokenChip(props: {
  kind: Exclude<ComposerHighlightKind, "text">;
  text: string;
  label?: string;
  title?: string;
  locale?: Locale;
  /** Composer mirror: paint raw glyphs only (no icon / short label). */
  overlay?: boolean;
}) {
  const token = {
    kind: props.kind,
    text: props.text,
    ...(props.label ? { label: props.label } : {}),
  };
  const label =
    props.kind === "mention" || props.kind === "url"
      ? composerTokenLabel(token)
      : composerRefDisplayLabel(props.label || props.text);
  const locale = props.locale ?? "zh";
  const aria = `${t(locale, tokenAriaKey(props.kind))}: ${label}`;

  // Overlay: same structure as the sent chip. Em-space in the textarea = 1em icon.
  if (props.overlay) {
    const slotted = props.text.startsWith(COMPOSER_CHIP_ICON_SLOT);
    const face = slotted ? props.text.slice(COMPOSER_CHIP_ICON_SLOT.length) : props.text;
    return (
      <span
        className={slotted ? "prompt-token-chip prompt-token-chip-overlay" : "composer-hl-token"}
        data-kind={props.kind}
        data-overlay="true"
      >
        {slotted ? tokenIcon(props.kind, OVERLAY_ICON) : null}
        {slotted ? <span className="prompt-token-chip-label">{face}</span> : face}
      </span>
    );
  }

  return (
    <span
      className="prompt-token-chip"
      data-kind={props.kind}
      data-slot="prompt-token"
      title={props.title ?? props.text}
      aria-label={aria}
    >
      {tokenIcon(props.kind)}
      <span className="prompt-token-chip-label">{label}</span>
    </span>
  );
}

export function renderHighlightSpans(
  spans: ComposerHighlightSpan[],
  options?: { overlay?: boolean; locale?: Locale },
): ReactNode {
  return spans.map((span, index) => {
    if (span.kind === "text") {
      return (
        <span key={index} className="composer-hl-text">
          {span.text}
        </span>
      );
    }
    return (
      <PromptTokenChip
        key={index}
        kind={span.kind}
        text={span.text}
        {...(span.label ? { label: span.label } : {})}
        {...(options?.overlay ? { overlay: true } : {})}
        {...(options?.locale ? { locale: options.locale } : {})}
      />
    );
  });
}

/** User-bubble body: collapse expanded `<skill>` and keep tokens in the sentence. */
export function UserMessageText(props: { text: string; locale: Locale }) {
  return (
    <div className="user-message-text" data-testid="user-message-text">
      {renderHighlightSpans(userMessageHighlightSpans(props.text), { locale: props.locale })}
    </div>
  );
}
