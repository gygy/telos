/**
 * Compact special-content chips (skills, plugins, slash, files, …).
 * Overlay mode keeps a hidden sizer so the composer caret stays aligned.
 */
import type { ReactNode } from "react";
import { File, Link2, MessageSquareText, Puzzle, Slash, Terminal, Wand2 } from "lucide-react";
import { cn } from "../lib/utils.ts";
import {
  composerHighlightClass,
  composerTokenLabel,
  parseSkillBlock,
  shouldUseChipFace,
  tokenizeComposerHighlight,
  type ComposerHighlightKind,
  type ComposerHighlightSpan,
} from "../lib/composer-highlight.ts";
import { t, type Locale } from "../lib/i18n.ts";

const ICON = { className: "prompt-token-chip-icon", strokeWidth: 2 } as const;

function tokenIcon(kind: Exclude<ComposerHighlightKind, "text">): ReactNode {
  switch (kind) {
    case "skill":
      return <Wand2 {...ICON} />;
    case "prompt":
      return <MessageSquareText {...ICON} />;
    case "extension":
    case "package":
      return <Puzzle {...ICON} />;
    case "mention":
      return <File {...ICON} />;
    case "slash":
      return <Slash {...ICON} />;
    case "url":
      return <Link2 {...ICON} />;
    case "shell":
      return <Terminal {...ICON} />;
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
  /** Hidden sizer + compact face so overlay width matches the textarea. */
  overlay?: boolean;
}) {
  const token = {
    kind: props.kind,
    text: props.text,
    ...(props.label ? { label: props.label } : {}),
  };
  const label = composerTokenLabel(token);
  const locale = props.locale ?? "zh";
  const aria = `${t(locale, tokenAriaKey(props.kind))}: ${label}`;
  const kindClass = composerHighlightClass(props.kind);
  const useFace = props.overlay === true && shouldUseChipFace(token);

  if (props.overlay && useFace) {
    return (
      <span className={cn("composer-hl-chip", kindClass)} data-kind={props.kind}>
        <span className="composer-hl-chip-sizer">{props.text}</span>
        <span className="composer-hl-chip-face" title={props.title ?? props.text} aria-hidden>
          {tokenIcon(props.kind)}
          <span className="prompt-token-chip-label">{label}</span>
        </span>
      </span>
    );
  }

  if (props.overlay) {
    return (
      <span className={kindClass} data-kind={props.kind} title={props.title ?? props.text}>
        {props.text}
      </span>
    );
  }

  return (
    <span
      className={cn("prompt-token-chip", kindClass)}
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

/** User-bubble body: collapse expanded `<skill>` blocks and chip remaining tokens. */
export function UserMessageText(props: { text: string; locale: Locale }) {
  const skill = parseSkillBlock(props.text);
  const remainder = skill ? (skill.userMessage ?? "") : props.text;
  const spans = tokenizeComposerHighlight(remainder);

  return (
    <div className="user-message-text" data-testid="user-message-text">
      {skill ? (
        <PromptTokenChip
          kind="skill"
          text={`/skill:${skill.name}`}
          label={skill.name}
          title={skill.location}
          locale={props.locale}
        />
      ) : null}
      {skill && remainder ? " " : null}
      {renderHighlightSpans(spans, { locale: props.locale })}
    </div>
  );
}
