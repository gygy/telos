/**
 * Embedded pi TUI — ghostty-web + main-process node-pty (`pi --session`).
 *
 * Hard rules for switch correctness:
 * - Parent keeps SurfaceTransitionOverlay until onReady.
 * - Canvas stays visibility:hidden until ready (second line of defense).
 * - Every mount spawns a fresh PTY for this sessionFile (main never resumes).
 * - Stale async open after unmount is discarded; if it still owns the session, dispose it.
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

function normSession(path: string): string {
  return path.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();
}

/** Debounce after first verified output before lifting the gate. */
const READY_SETTLE_MS = 420;
/** Absolute max wait after a verified open (pi may paint slowly). */
const READY_MAX_MS = 2000;

export function PiTuiTerminal(props: {
  sessionFile: string;
  cwd: string;
  colorMode: "light" | "dark";
  className?: string | undefined;
  onReady?: (() => void) | undefined;
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
    let fitId = 0;
    let settleTimer: number | null = null;
    let maxTimer: number | null = null;
    let readyFired = false;
    /** Only accept data after open returns the *expected* session. */
    let acceptSessionKey: string | null = null;
    let sawVerifiedOutput = false;
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
          if (!cancelled) onReadyRef.current?.();
        });
      });
    }

    function scheduleReadyAfterVerifiedOutput() {
      if (readyFired || cancelled) return;
      if (settleTimer != null) window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        settleTimer = null;
        fireReady();
      }, READY_SETTLE_MS);
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

      unsubData = window.pix.terminal.onData((data) => {
        if (cancelled) return;
        // Drop every byte until open has verified this mount owns the session.
        if (acceptSessionKey !== expectedKey) return;
        next.write(data);
        if (prefsRef.current.scrollOnOutput) {
          try {
            next.scrollToBottom();
          } catch {
            // ignore
          }
        }
        if (!sawVerifiedOutput) {
          sawVerifiedOutput = true;
        }
        scheduleReadyAfterVerifiedOutput();
      });
      unsubExit = window.pix.terminal.onExit((event) => {
        onExitRef.current?.(event);
      });
      onDataDisp = next.onData((data) => {
        void window.pix.terminal.write(data).catch(() => undefined);
      });
      onResizeDisp = next.onResize(({ cols, rows }) => {
        void window.pix.terminal.resize(cols, rows).catch(() => undefined);
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

      let cols = next.cols;
      let rows = next.rows;
      try {
        nextFit.fit();
        cols = next.cols;
        rows = next.rows;
      } catch {
        // ignore
      }

      // Force a clean process for this session (main always spawns fresh).
      try {
        await window.pix.terminal.dispose();
      } catch {
        // ignore
      }
      if (cancelled) return;

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
        // Stale mount: if we still own this session, release it.
        try {
          const st = await window.pix.terminal.status();
          if (st.sessionFile && normSession(st.sessionFile) === expectedKey) {
            await window.pix.terminal.dispose();
          }
        } catch {
          // ignore
        }
        return;
      }

      const liveKey = normSession(opened.sessionFile ?? sessionFile);
      if (liveKey !== expectedKey) {
        try {
          await window.pix.terminal.dispose();
        } catch {
          // ignore
        }
        if (!cancelled) {
          onOpenErrorRef.current?.(new Error("Terminal opened for the wrong session"));
        }
        return;
      }

      // Double-check via status IPC (guards races with concurrent opens).
      try {
        const st = await window.pix.terminal.status();
        if (!st.sessionFile || normSession(st.sessionFile) !== expectedKey) {
          if (!cancelled) {
            onOpenErrorRef.current?.(new Error("Terminal session mismatch after open"));
          }
          return;
        }
      } catch {
        // status optional
      }
      if (cancelled) return;

      applyPrefsToTerminal(next, prefsRef.current);
      // Only now may PTY bytes hit the canvas.
      acceptSessionKey = expectedKey;

      fitId = window.requestAnimationFrame(() => {
        if (cancelled) return;
        try {
          nextFit.fit();
          void window.pix.terminal.resize(next.cols, next.rows).catch(() => undefined);
          next.focus();
        } catch {
          // ignore
        }
        // Max wait — if pi is quiet, still show after READY_MAX_MS (empty but correct session).
        maxTimer = window.setTimeout(() => {
          maxTimer = null;
          fireReady();
        }, READY_MAX_MS);
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
