import type { ReactNode } from "react";
import { cn } from "../lib/utils.ts";

type AppWindowFrameProps = {
  title?: string;
  children: ReactNode;
  className?: string;
  /** Outer shell only; content fills the body. */
  bodyClassName?: string;
};

/**
 * Neutral desktop app chrome — Win-style caption cluster on the right.
 * Avoids macOS traffic lights; matches how Pix presents on Windows.
 */
export function AppWindowFrame({
  title = "Pix",
  children,
  className,
  bodyClassName,
}: AppWindowFrameProps) {
  return (
    <div
      className={cn(
        "group/window overflow-hidden rounded-xl border border-white/[0.12] bg-[oklch(0.18_0.006_285)] ring-1 ring-inset ring-white/[0.05]",
        "shadow-[inset_0_1px_0_0_rgba(255,255,255,0.10),0_28px_56px_-18px_rgba(0,0,0,0.58)]",
        "transition-[box-shadow,transform] duration-500 ease-out",
        "hover:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.12),0_36px_72px_-16px_rgba(0,0,0,0.62)]",
        className,
      )}
    >
      <div className="flex h-10 select-none items-center border-b border-white/[0.07] bg-[oklch(0.16_0.005_285)]">
        <div className="flex min-w-0 flex-1 items-center gap-2.5 px-3">
          <span
            aria-hidden="true"
            className="size-3.5 shrink-0 rounded-[3px] bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
          />
          <span className="truncate text-[12px] font-medium tracking-wide text-muted-foreground">
            {title}
          </span>
        </div>
        <div className="flex h-full shrink-0 items-stretch" aria-hidden="true">
          <CaptionIcon kind="min" />
          <CaptionIcon kind="max" />
          <CaptionIcon kind="close" />
        </div>
      </div>
      <div className={cn("relative", bodyClassName)}>{children}</div>
    </div>
  );
}

function CaptionIcon({ kind }: { kind: "min" | "max" | "close" }) {
  return (
    <span
      className={cn(
        "grid w-11 place-items-center text-muted-foreground/70 transition-colors",
        kind === "close"
          ? "hover:bg-[#c42b1c] hover:text-white"
          : "hover:bg-white/[0.06] hover:text-foreground/90",
      )}
    >
      {kind === "min" && (
        <svg viewBox="0 0 12 12" className="size-2.5" fill="none" aria-hidden="true">
          <path d="M2 6h8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      )}
      {kind === "max" && (
        <svg viewBox="0 0 12 12" className="size-2.5" fill="none" aria-hidden="true">
          <rect
            x="2.25"
            y="2.25"
            width="7.5"
            height="7.5"
            rx="0.6"
            stroke="currentColor"
            strokeWidth="1.15"
          />
        </svg>
      )}
      {kind === "close" && (
        <svg viewBox="0 0 12 12" className="size-2.5" fill="none" aria-hidden="true">
          <path
            d="M3 3l6 6M9 3l-6 6"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinecap="round"
          />
        </svg>
      )}
    </span>
  );
}
