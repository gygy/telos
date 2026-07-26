/**
 * Embedded pi TUI — ghostty-web + main-process node-pty (`pi --session`).
 *
 * - Parent may keep SurfaceTransitionOverlay until onReady (mode changes only).
 * - Canvas stays visibility:hidden until ready.
 * - open() resumes/promotes warm PTYs when possible (do not dispose before open).
 * - Hidden IME textarea is pinned to the VT cursor so composition tracks the prompt.
 */
import { useEffect, useRef, useState } from "react";
import {
  loadTerminalPrefs,
  resolveTerminalTheme,
  terminalOptionsFromPrefs,
  TERMINAL_PREFS_CHANGED_EVENT,
  type TerminalPrefs,
} from "../lib/terminal-prefs.ts";
import { cn } from "../lib/utils.ts";

type GhosttyModule = typeof import("ghostty-web");
type GhosttyTerminal = InstanceType<GhosttyModule["Terminal"]>;
type GhosttyFitAddon = InstanceType<GhosttyModule["FitAddon"]>;

type GhosttyMetrics = { width: number; height: number };

function normSession(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

/**
 * ghostty-web parks its IME helper at (0,0). Without tracking, Chinese/Japanese
 * composition and the system caret sit at the top of the surface instead of the
 * pi prompt. Pin the textarea over the active VT cell (xterm-style).
 */
function syncTerminalInputCaret(term: GhosttyTerminal): void {
  const textarea = term.textarea;
  const host = term.element;
  if (!textarea || !host) return;
  try {
    const renderer = (term as unknown as { renderer?: { getMetrics?: () => GhosttyMetrics } })
      .renderer;
    const metrics = renderer?.getMetrics?.();
    if (!metrics || metrics.width <= 0 || metrics.height <= 0) return;

    const cursorX = term.buffer.active.cursorX;
    const cursorY = term.buffer.active.cursorY;
    const style = window.getComputedStyle(host);
    const padL = Number.parseFloat(style.paddingLeft) || 0;
    const padT = Number.parseFloat(style.paddingTop) || 0;
    const left = Math.round(padL + cursorX * metrics.width);
    const top = Math.round(padT + cursorY * metrics.height);
    const w = Math.max(2, Math.round(metrics.width));
    const h = Math.max(2, Math.round(metrics.height));
    // Skip no-op writes — onRender fires every frame.
    if (
      textarea.dataset.caretX === String(left) &&
      textarea.dataset.caretY === String(top) &&
      textarea.dataset.caretW === String(w) &&
      textarea.dataset.caretH === String(h)
    ) {
      return;
    }
    textarea.dataset.caretX = String(left);
    textarea.dataset.caretY = String(top);
    textarea.dataset.caretW = String(w);
    textarea.dataset.caretH = String(h);

    textarea.style.position = "absolute";
    textarea.style.left = `${left}px`;
    textarea.style.top = `${top}px`;
    textarea.style.width = `${w}px`;
    textarea.style.height = `${h}px`;
    textarea.style.margin = "0";
    textarea.style.padding = "0";
    textarea.style.border = "none";
    textarea.style.outline = "none";
    textarea.style.resize = "none";
    textarea.style.overflow = "hidden";
    textarea.style.whiteSpace = "nowrap";
    textarea.style.opacity = "0";
    // clipPath:inset(50%) zeros the caret box and parks IME at the host origin.
    textarea.style.clipPath = "none";
    textarea.style.zIndex = "1";
    // Clicks must hit the canvas for selection; keyboard stays on the focused caret.
    textarea.style.pointerEvents = "none";
  } catch {
    // ignore — caret tracking is best-effort
  }
}

function focusTerminalInput(term: GhosttyTerminal): void {
  syncTerminalInputCaret(term);
  try {
    const textarea = term.textarea;
    if (textarea) {
      textarea.focus({ preventScroll: true });
      return;
    }
  } catch {
    // fall through
  }
  try {
    term.focus();
  } catch {
    // ignore
  }
}

/** Quiet window after the last output frame; TUI startup often paints in bursts. */
const READY_SETTLE_MS = 360;
/** A resumed process still needs to redraw after its resize before it is revealed. */
const READY_SETTLE_RESUMED_MS = 280;
/** Fallback for a quiet/empty session; output-driven readiness remains preferred. */
const READY_MAX_MS = 2_400;
const READY_MAX_RESUMED_MS = 1_500;

export function PiTuiTerminal(props: {
  sessionFile: string;
  cwd: string;
  colorMode: "light" | "dark";
  className?: string | undefined;
  /** Fired only after this mount has bound the expected session and painted. */
  onReady?: ((info: { sessionFile: string }) => void) | undefined;
  onOpenError?: ((error: unknown) => void) | undefined;
  onProcessExit?: ((event: { exitCode: number; signal?: number }) => void) | undefined;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const onExitRef = useRef(props.onProcessExit);
  const onReadyRef = useRef(props.onReady);
  const onOpenErrorRef = useRef(props.onOpenError);
  const colorModeRef = useRef(props.colorMode);
  const prefsRef = useRef<TerminalPrefs>(loadTerminalPrefs());
  const [surfaceReady, setSurfaceReady] = useState(false);
  const surfaceReadyRef = useRef(false);
  onExitRef.current = props.onProcessExit;
  onReadyRef.current = props.onReady;
  onOpenErrorRef.current = props.onOpenError;
  colorModeRef.current = props.colorMode;

  useEffect(() => {
    const host = hostRef.current;
    const shell = shellRef.current;
    const sessionFile = props.sessionFile.trim();
    const cwd = props.cwd.trim();
    const expectedKey = normSession(sessionFile);
    if (!host || !sessionFile || !cwd) return;

    let cancelled = false;
    let term: GhosttyTerminal | null = null;
    let fit: GhosttyFitAddon | null = null;
    let unsubData: (() => void) | undefined;
    let unsubExit: (() => void) | undefined;
    let onDataDisp: { dispose(): void } | undefined;
    let onResizeDisp: { dispose(): void } | undefined;
    let onSelDisp: { dispose(): void } | undefined;
    let onCursorDisp: { dispose(): void } | undefined;
    let onRenderDisp: { dispose(): void } | undefined;
    let onHostFocus: (() => void) | undefined;
    let fitId = 0;
    let settleTimer: number | null = null;
    let maxTimer: number | null = null;
    let readyFired = false;
    /** Only accept data after open returns the *expected* session. */
    let acceptSessionKey: string | null = null;
    /** PTY output can arrive before the open IPC promise resolves; retain it in order. */
    const pendingData: string[] = [];
    setSurfaceReady(false);
    surfaceReadyRef.current = false;

    function paintHostBackground(prefs: TerminalPrefs) {
      const theme = resolveTerminalTheme(prefs, colorModeRef.current);
      if (shell) shell.style.background = theme.background;
      if (host) host.style.background = theme.background;
    }

    function applyPrefsToTerminal(target: GhosttyTerminal, prefs: TerminalPrefs) {
      const opts = terminalOptionsFromPrefs(prefs, colorModeRef.current);
      paintHostBackground(prefs);
      const options = target.options as Record<string, unknown>;
      options.fontFamily = opts.fontFamily;
      options.fontSize = opts.fontSize;
      options.cursorBlink = opts.cursorBlink;
      options.cursorStyle = opts.cursorStyle;
      options.smoothScrollDuration = opts.smoothScrollDuration;
      options.convertEol = opts.convertEol;
      options.theme = { ...opts.theme };
      options.scrollback = opts.scrollback;
      try {
        const renderer = (target as unknown as { renderer?: { setTheme?: (t: unknown) => void } })
          .renderer;
        renderer?.setTheme?.(opts.theme);
      } catch {
        // ignore
      }
      try {
        fit?.fit();
        void window.pix.terminal.resize(target.cols, target.rows).catch(() => undefined);
      } catch {
        // ignore
      }
      syncTerminalInputCaret(target);
    }

    function fireReady() {
      if (readyFired || cancelled) return;
      if (acceptSessionKey !== expectedKey) return;
      readyFired = true;
      surfaceReadyRef.current = true;
      if (settleTimer != null) {
        window.clearTimeout(settleTimer);
        settleTimer = null;
      }
      if (maxTimer != null) {
        window.clearTimeout(maxTimer);
        maxTimer = null;
      }
      setSurfaceReady(true);
      // Double rAF: composite themed canvas before parent lifts the logo mask.
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          if (cancelled) return;
          if (term) focusTerminalInput(term);
          onReadyRef.current?.({ sessionFile });
        });
      });
    }

    let settleMs = READY_SETTLE_MS;
    let maxMs = READY_MAX_MS;

    function scheduleReadyAfterVerifiedOutput() {
      if (readyFired || cancelled) return;
      if (settleTimer != null) window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        settleTimer = null;
        fireReady();
      }, settleMs);
    }

    void (async () => {
      let ghostty: GhosttyModule;
      try {
        ghostty = await import("ghostty-web");
        await ghostty.init();
      } catch (err) {
        if (!cancelled) {
          console.error("[pi-tui] ghostty-web WASM init failed", err);
          onOpenErrorRef.current?.(err);
        }
        return;
      }
      if (cancelled || !hostRef.current) return;

      prefsRef.current = loadTerminalPrefs();
      const boot = terminalOptionsFromPrefs(prefsRef.current, colorModeRef.current);
      paintHostBackground(prefsRef.current);

      const next = new ghostty.Terminal({
        cursorBlink: boot.cursorBlink,
        cursorStyle: boot.cursorStyle,
        fontFamily: boot.fontFamily,
        fontSize: boot.fontSize,
        scrollback: boot.scrollback,
        smoothScrollDuration: boot.smoothScrollDuration,
        convertEol: boot.convertEol,
        theme: { ...boot.theme },
      });
      const nextFit = new ghostty.FitAddon();
      next.loadAddon(nextFit);
      next.open(host);
      try {
        next.reset();
      } catch {
        // ignore
      }

      term = next;
      fit = nextFit;

      function writeTerminalOutput(data: string) {
        next.write(data, () => {
          if (cancelled) return;
          // The callback is scheduled after Ghostty's next render frame, so the
          // settle window starts only after this output is actually paintable.
          scheduleReadyAfterVerifiedOutput();
          syncTerminalInputCaret(next);
        });
        if (prefsRef.current.scrollOnOutput) {
          try {
            next.scrollToBottom();
          } catch {
            // ignore
          }
        }
      }

      unsubData = window.pix.terminal.onData((event) => {
        if (cancelled) return;
        // Ignore queued bytes belonging to a PTY that was disposed during a hop.
        if (event.sessionFile && normSession(event.sessionFile) !== expectedKey) return;
        // Keep target bytes that race the open acknowledgement; dropping them
        // can reveal a blank or partially drawn session after the mask lifts.
        if (acceptSessionKey !== expectedKey) {
          pendingData.push(event.data);
          return;
        }
        writeTerminalOutput(event.data);
      });
      unsubExit = window.pix.terminal.onExit((event) => {
        if (event.sessionFile && normSession(event.sessionFile) !== expectedKey) return;
        onExitRef.current?.(event);
      });
      onDataDisp = next.onData((data) => {
        void window.pix.terminal.write(data).catch(() => undefined);
        // Local keystrokes move the TUI caret before the next PTY frame arrives.
        syncTerminalInputCaret(next);
      });
      onResizeDisp = next.onResize(({ cols, rows }) => {
        void window.pix.terminal.resize(cols, rows).catch(() => undefined);
        syncTerminalInputCaret(next);
      });
      onSelDisp = next.onSelectionChange(() => {
        if (!prefsRef.current.copyOnSelect) return;
        try {
          const text = next.getSelection();
          if (text) void navigator.clipboard.writeText(text).catch(() => undefined);
        } catch {
          // ignore
        }
      });
      onCursorDisp = next.onCursorMove(() => {
        if (!cancelled) syncTerminalInputCaret(next);
      });
      onRenderDisp = next.onRender(() => {
        if (!cancelled) syncTerminalInputCaret(next);
      });
      // Initial pin before the first paint (prompt may already be at bottom).
      syncTerminalInputCaret(next);
      // ghostty focuses the contenteditable host; keep the IME caret on the VT cell.
      onHostFocus = () => {
        if (cancelled) return;
        if (document.activeElement === next.textarea) return;
        focusTerminalInput(next);
      };
      host.addEventListener("focusin", onHostFocus);

      let cols = next.cols;
      let rows = next.rows;
      try {
        nextFit.fit();
        cols = next.cols;
        rows = next.rows;
      } catch {
        // ignore
      }

      // Do NOT dispose first — open() resumes same session or promotes a parked one.
      let opened: { sessionFile?: string; resumed?: boolean };
      try {
        opened = await window.pix.terminal.open({
          sessionFile,
          cwd,
          cols,
          rows,
        });
      } catch (err) {
        if (!cancelled) onOpenErrorRef.current?.(err);
        return;
      }
      if (cancelled) {
        // Stale mount: only kill if we still own this session (don't wipe a newer hop).
        try {
          const st = await window.pix.terminal.status();
          if (st.sessionFile && normSession(st.sessionFile) === expectedKey) {
            await window.pix.terminal.suspend();
          }
        } catch {
          // ignore
        }
        return;
      }

      const liveKey = normSession(opened.sessionFile ?? sessionFile);
      if (liveKey !== expectedKey) {
        if (!cancelled) {
          onOpenErrorRef.current?.(new Error("Terminal opened for the wrong session"));
        }
        return;
      }

      if (opened.resumed) {
        settleMs = READY_SETTLE_RESUMED_MS;
        maxMs = READY_MAX_RESUMED_MS;
      }

      applyPrefsToTerminal(next, prefsRef.current);
      // Only now may PTY bytes hit the canvas.
      acceptSessionKey = expectedKey;
      for (const data of pendingData.splice(0)) writeTerminalOutput(data);

      fitId = window.requestAnimationFrame(() => {
        if (cancelled) return;
        try {
          nextFit.fit();
          void window.pix.terminal.resize(next.cols, next.rows).catch(() => undefined);
          focusTerminalInput(next);
        } catch {
          // ignore
        }
        maxTimer = window.setTimeout(() => {
          maxTimer = null;
          fireReady();
        }, maxMs);
      });
      nextFit.observeResize();
    })();

    const onPrefs = (event: Event) => {
      const detail = (event as CustomEvent<TerminalPrefs>).detail;
      const prefs = detail ?? loadTerminalPrefs();
      prefsRef.current = prefs;
      if (term) applyPrefsToTerminal(term, prefs);
    };
    window.addEventListener(TERMINAL_PREFS_CHANGED_EVENT, onPrefs);

    return () => {
      cancelled = true;
      acceptSessionKey = null;
      surfaceReadyRef.current = false;
      window.removeEventListener(TERMINAL_PREFS_CHANGED_EVENT, onPrefs);
      window.cancelAnimationFrame(fitId);
      if (settleTimer != null) window.clearTimeout(settleTimer);
      if (maxTimer != null) window.clearTimeout(maxTimer);
      unsubData?.();
      unsubExit?.();
      onDataDisp?.dispose();
      onResizeDisp?.dispose();
      onSelDisp?.dispose();
      onCursorDisp?.dispose();
      onRenderDisp?.dispose();
      if (onHostFocus) host.removeEventListener("focusin", onHostFocus);
      try {
        fit?.dispose();
      } catch {
        // ignore
      }
      try {
        term?.dispose();
      } catch {
        // ignore
      }
      term = null;
      fit = null;
      // Do not dispose main PTY here — parent switchThread/leave owns lifecycle.
      // Stale open path above disposes if it still owns the expected session.
    };
  }, [props.sessionFile, props.cwd]);

  useEffect(() => {
    colorModeRef.current = props.colorMode;
    if (!surfaceReadyRef.current) return;
    window.dispatchEvent(
      new CustomEvent(TERMINAL_PREFS_CHANGED_EVENT, { detail: loadTerminalPrefs() }),
    );
  }, [props.colorMode]);

  const initialBg = resolveTerminalTheme(loadTerminalPrefs(), props.colorMode).background;

  return (
    <div
      ref={shellRef}
      className={cn("pi-tui-terminal flex min-h-0 min-w-0 flex-1 flex-col", props.className)}
      data-testid="pi-tui-terminal"
      data-session={props.sessionFile}
      data-surface-ready={surfaceReady ? "true" : "false"}
      style={{ background: initialBg }}
    >
      <div
        ref={hostRef}
        className="pi-tui-terminal-host min-h-0 min-w-0 flex-1"
        style={{ background: initialBg }}
      />
    </div>
  );
}
