/**
 * Sidebar session hover card — title + relative time, then meta rows.
 * Anchored to the sidebar's right edge at the row's vertical position (Synara),
 * so it never sits flush against the row's pin/archive cluster.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Folder, GitFork, Clock } from "lucide-react";
import { t, type Locale, type MessageKey } from "../lib/i18n.ts";
import { formatRelativeTime, RELATIVE_TIME_I18N } from "../lib/relative-time.ts";

const EDGE_GAP_PX = 8;

export function ThreadHoverCard(props: {
  locale: Locale;
  title: string;
  modifiedAt?: string;
  projectName?: string | null;
  cwd?: string | null;
  status?: string | null;
  forkFrom?: string | null;
  children: ReactNode;
}) {
  const tr = (key: MessageKey, vars?: Record<string, string>) => t(props.locale, key, vars);
  const rel = formatRelativeTime(props.modifiedAt);
  const timeLabel = rel
    ? rel.n
      ? tr(RELATIVE_TIME_I18N[rel.key], { n: rel.n })
      : tr(RELATIVE_TIME_I18N[rel.key])
    : null;
  const hasMeta = Boolean(props.status || props.projectName || props.cwd || props.forkFrom);

  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  function updatePos() {
    const row = rootRef.current;
    if (!row) return;
    const rowRect = row.getBoundingClientRect();
    const sidebar = row.closest<HTMLElement>("[data-slot='sidebar-container']");
    const rightEdge = sidebar?.getBoundingClientRect().right ?? rowRect.right;
    setPos({ top: rowRect.top, left: rightEdge + EDGE_GAP_PX });
  }

  useEffect(() => {
    if (!open) return;
    updatePos();
    const row = rootRef.current;
    const scroller = row?.closest("[data-slot='sidebar-container']");
    const onMove = () => updatePos();
    scroller?.addEventListener("scroll", onMove, true);
    window.addEventListener("resize", onMove);
    return () => {
      scroller?.removeEventListener("scroll", onMove, true);
      window.removeEventListener("resize", onMove);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className="min-w-0"
      onPointerEnter={() => {
        updatePos();
        setOpen(true);
      }}
      onPointerLeave={() => setOpen(false)}
    >
      {props.children}
      {open && pos
        ? createPortal(
            <div
              className="thread-hover-card pointer-events-none fixed z-[100] w-64 max-w-64 rounded-[var(--radius-field)] border border-border bg-popover px-1 py-1 text-popover-foreground shadow-[var(--shadow-soft)]"
              style={{ top: pos.top, left: pos.left }}
              role="tooltip"
            >
              <div className="thread-hover-card-row">
                <span className="min-w-0 flex-1 whitespace-normal font-medium leading-tight text-foreground">
                  {props.title}
                </span>
                {timeLabel ? (
                  <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground/55">
                    {timeLabel}
                  </span>
                ) : null}
              </div>
              {hasMeta ? (
                <div className="flex flex-col">
                  {props.status ? (
                    <HoverMetaRow icon={<Clock className="size-3.5" strokeWidth={1.75} />}>
                      {props.status}
                    </HoverMetaRow>
                  ) : null}
                  {props.projectName ? (
                    <HoverMetaRow icon={<Folder className="size-3.5" strokeWidth={1.75} />}>
                      {props.projectName}
                    </HoverMetaRow>
                  ) : null}
                  {props.cwd && props.cwd !== props.projectName ? (
                    <HoverMetaRow icon={<Folder className="size-3.5" strokeWidth={1.75} />}>
                      {props.cwd}
                    </HoverMetaRow>
                  ) : null}
                  {props.forkFrom ? (
                    <HoverMetaRow icon={<GitFork className="size-3.5" strokeWidth={1.75} />}>
                      {props.forkFrom}
                    </HoverMetaRow>
                  ) : null}
                </div>
              ) : null}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function HoverMetaRow(props: { icon: ReactNode; children: string }) {
  return (
    <span className="thread-hover-card-row text-foreground/80">
      <span className="inline-flex size-3.5 shrink-0 items-center justify-center text-muted-foreground/75">
        {props.icon}
      </span>
      <span className="min-w-0 truncate">{props.children}</span>
    </span>
  );
}
