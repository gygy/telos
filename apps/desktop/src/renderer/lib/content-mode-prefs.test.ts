import { describe, expect, it, beforeEach } from "vite-plus/test";
import {
  isContentMode,
  loadContentMode,
  saveContentMode,
  toggleContentMode,
} from "./content-mode-prefs.ts";

describe("content-mode-prefs", () => {
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

  it("validates and toggles modes", () => {
    expect(isContentMode("chat")).toBe(true);
    expect(isContentMode("terminal")).toBe(true);
    expect(isContentMode("pty")).toBe(false);
    expect(toggleContentMode("chat")).toBe("terminal");
    expect(toggleContentMode("terminal")).toBe("chat");
  });

  it("persists across load/save without clearing history-like data", () => {
    expect(loadContentMode()).toBe("chat");
    saveContentMode("terminal");
    expect(loadContentMode()).toBe("terminal");
    saveContentMode("chat");
    expect(loadContentMode()).toBe("chat");
  });
});
