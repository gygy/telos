import { describe, expect, it, beforeEach } from "vite-plus/test";
import {
  applyAppearancePrefs,
  DEFAULT_APPEARANCE_PREFS,
  loadAppearancePrefs,
  normalizeAppearancePrefs,
  patchAppearancePrefs,
  resetAppearancePrefs,
} from "./appearance-prefs.ts";

describe("appearance-prefs", () => {
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
    const styleMap = new Map<string, string>();
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        documentElement: {
          style: {
            setProperty: (k: string, v: string) => {
              styleMap.set(k, v);
            },
            getPropertyValue: (k: string) => styleMap.get(k) ?? "",
          },
        },
      },
    });
  });

  it("normalizes and clamps out-of-range values", () => {
    const n = normalizeAppearancePrefs({
      uiFontSize: 3,
      codeFontSize: 99,
    });
    expect(n.uiFontSize).toBe(12);
    expect(n.codeFontSize).toBe(20);
  });

  it("persists patch and reset", () => {
    expect(loadAppearancePrefs()).toEqual(DEFAULT_APPEARANCE_PREFS);
    patchAppearancePrefs({ uiFontSize: 16, codeFontSize: 14 });
    expect(loadAppearancePrefs()).toEqual({ uiFontSize: 16, codeFontSize: 14 });
    resetAppearancePrefs();
    expect(loadAppearancePrefs()).toEqual(DEFAULT_APPEARANCE_PREFS);
  });

  it("applies CSS custom properties", () => {
    applyAppearancePrefs({ uiFontSize: 15, codeFontSize: 13 });
    expect(document.documentElement.style.getPropertyValue("--ui-font-size")).toBe("15px");
    expect(document.documentElement.style.getPropertyValue("--code-font-size")).toBe("13px");
  });
});
