/**
 * Desktop-only content presentation mode (chat timeline vs terminal stream).
 * Not part of pi session storage — localStorage only.
 */

export type ContentMode = "chat" | "terminal";

const KEY = "pix.contentMode";

export function isContentMode(value: unknown): value is ContentMode {
  return value === "chat" || value === "terminal";
}

export function loadContentMode(): ContentMode {
  try {
    const raw = localStorage.getItem(KEY);
    if (isContentMode(raw)) return raw;
  } catch {
    // ignore
  }
  return "chat";
}

export function saveContentMode(mode: ContentMode): void {
  try {
    localStorage.setItem(KEY, mode);
  } catch {
    // ignore quota / private mode
  }
}

export function toggleContentMode(mode: ContentMode): ContentMode {
  return mode === "chat" ? "terminal" : "chat";
}
