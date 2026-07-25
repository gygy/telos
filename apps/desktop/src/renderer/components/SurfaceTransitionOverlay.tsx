/**
 * Opaque content-area gate while chat ⇄ terminal (or session) settles.
 * Same visual language as cold-start BootstrapOverlay: logo + brand + status.
 */
import { PixLogo } from "./PixLogo.tsx";
import { cn } from "../lib/utils.ts";

export function SurfaceTransitionOverlay(props: {
  status: string;
  /** "terminal" uses a dark fill so a light shell does not flash under TUI. */
  variant?: "chat" | "terminal";
  className?: string;
}) {
  return (
    <div
      className={cn(
        "surface-transition-mask",
        props.variant === "terminal" && "surface-transition-mask-terminal",
        props.className,
      )}
      data-testid="surface-transition-mask"
      data-for={props.variant ?? "chat"}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="surface-transition-inner">
        <div className="surface-transition-logo-wrap" aria-hidden>
          <PixLogo className="surface-transition-logo" title="Pix" />
        </div>
        <div className="surface-transition-brand">Pix</div>
        <div className="surface-transition-status" data-testid="surface-transition-status">
          {props.status}
        </div>
      </div>
    </div>
  );
}
