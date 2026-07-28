/**
 * Desktop appearance typography prefs (localStorage — not pi settings).
 * Applied as CSS custom properties on <html>.
 */

export type AppearancePrefs = {
  /** App chrome / conversation body font size (px). */
  uiFontSize: number;
  /** Markdown / tool code block font size (px). */
  codeFontSize: number;
};

const KEY = "pix.appearance.prefs.v1";
export const APPEARANCE_PREFS_CHANGED_EVENT = "pix-appearance-prefs";

export const DEFAULT_APPEARANCE_PREFS: AppearancePrefs = {
  uiFontSize: 14,
  codeFontSize: 12,
};

export const UI_FONT_SIZE_MIN = 12;
export const UI_FONT_SIZE_MAX = 20;
export const CODE_FONT_SIZE_MIN = 10;
export const CODE_FONT_SIZE_MAX = 20;

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function normalizeAppearancePrefs(
  raw: Partial<AppearancePrefs> | null | undefined,
): AppearancePrefs {
  const base = { ...DEFAULT_APPEARANCE_PREFS, ...raw };
  return {
    uiFontSize: clamp(Number(base.uiFontSize), UI_FONT_SIZE_MIN, UI_FONT_SIZE_MAX),
    codeFontSize: clamp(Number(base.codeFontSize), CODE_FONT_SIZE_MIN, CODE_FONT_SIZE_MAX),
  };
}

export function loadAppearancePrefs(): AppearancePrefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_APPEARANCE_PREFS };
    return normalizeAppearancePrefs(JSON.parse(raw) as Partial<AppearancePrefs>);
  } catch {
    return { ...DEFAULT_APPEARANCE_PREFS };
  }
}

export function saveAppearancePrefs(prefs: AppearancePrefs): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(normalizeAppearancePrefs(prefs)));
  } catch {
    // ignore quota / private mode
  }
}

export function patchAppearancePrefs(patch: Partial<AppearancePrefs>): AppearancePrefs {
  const next = normalizeAppearancePrefs({ ...loadAppearancePrefs(), ...patch });
  saveAppearancePrefs(next);
  applyAppearancePrefs(next);
  try {
    window.dispatchEvent(new CustomEvent(APPEARANCE_PREFS_CHANGED_EVENT, { detail: next }));
  } catch {
    // ignore non-DOM
  }
  return next;
}

export function resetAppearancePrefs(): AppearancePrefs {
  const next = { ...DEFAULT_APPEARANCE_PREFS };
  saveAppearancePrefs(next);
  applyAppearancePrefs(next);
  try {
    window.dispatchEvent(new CustomEvent(APPEARANCE_PREFS_CHANGED_EVENT, { detail: next }));
  } catch {
    // ignore
  }
  return next;
}

/** Write CSS variables used by styles.css for UI / code type. */
export function applyAppearancePrefs(prefs: AppearancePrefs = loadAppearancePrefs()): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--ui-font-size", `${prefs.uiFontSize}px`);
  root.style.setProperty("--code-font-size", `${prefs.codeFontSize}px`);
}
