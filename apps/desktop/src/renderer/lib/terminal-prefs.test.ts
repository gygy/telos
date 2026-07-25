import { describe, expect, it, beforeEach } from "vite-plus/test";
import {
  DEFAULT_TERMINAL_PREFS,
  loadTerminalPrefs,
  normalizeTerminalPrefs,
  patchTerminalPrefs,
  resetTerminalPrefs,
  resolveTerminalTheme,
  terminalOptionsFromPrefs,
  TERMINAL_THEME_DARK,
  TERMINAL_THEME_LIGHT,
} from "./terminal-prefs.ts";

describe("terminal-prefs", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (k: string) => store.get(k) ?? null,
        setItem: (k: string, v: string) => {
          store.set(k, String(v));
        },
        removeItem: (k: string) => {
          store.delete(k);
        },
      },
    });
  });

  it("normalizes and clamps out-of-range values", () => {
    const n = normalizeTerminalPrefs({
      fontSize: 3,
      scrollback: 9_999_999,
      smoothScrollMs: -10,
      cursorStyle: "weird" as never,
      colorScheme: "neon" as never,
      fontFamily: "  ",
    });
    expect(n.fontSize).toBe(10);
    expect(n.scrollback).toBe(100_000);
    expect(n.smoothScrollMs).toBe(0);
    expect(n.cursorStyle).toBe("block");
    expect(n.colorScheme).toBe("match");
    expect(n.fontFamily).toBe(DEFAULT_TERMINAL_PREFS.fontFamily);
  });

  it("persists patch and reset", () => {
    expect(loadTerminalPrefs().fontSize).toBe(13);
    patchTerminalPrefs({ fontSize: 16, copyOnSelect: false });
    expect(loadTerminalPrefs().fontSize).toBe(16);
    expect(loadTerminalPrefs().copyOnSelect).toBe(false);
    resetTerminalPrefs();
    expect(loadTerminalPrefs()).toEqual(DEFAULT_TERMINAL_PREFS);
  });

  it("resolves theme from scheme and color mode", () => {
    expect(
      resolveTerminalTheme({ ...DEFAULT_TERMINAL_PREFS, colorScheme: "dark" }, "light"),
    ).toEqual(TERMINAL_THEME_DARK);
    expect(
      resolveTerminalTheme({ ...DEFAULT_TERMINAL_PREFS, colorScheme: "light" }, "dark"),
    ).toEqual(TERMINAL_THEME_LIGHT);
    expect(
      resolveTerminalTheme({ ...DEFAULT_TERMINAL_PREFS, colorScheme: "match" }, "light"),
    ).toEqual(TERMINAL_THEME_LIGHT);
    expect(
      resolveTerminalTheme({ ...DEFAULT_TERMINAL_PREFS, colorScheme: "match" }, "dark"),
    ).toEqual(TERMINAL_THEME_DARK);
  });

  it("maps prefs to ghostty options", () => {
    const opts = terminalOptionsFromPrefs(
      { ...DEFAULT_TERMINAL_PREFS, fontSize: 15, smoothScrollMs: 0, cursorStyle: "bar" },
      "dark",
    );
    expect(opts.fontSize).toBe(15);
    expect(opts.smoothScrollDuration).toBe(0);
    expect(opts.cursorStyle).toBe("bar");
    expect(opts.theme.background).toBe(TERMINAL_THEME_DARK.background);
  });
});
