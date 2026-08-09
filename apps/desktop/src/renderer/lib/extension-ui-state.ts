/**
 * Fire-and-forget portable extension UI state (status / widget / title / working / notify).
 * Dialog methods are handled separately by extension-ui-prompt.ts.
 *
 * Keys are isolated by runtimeId so session replacement cannot leak chrome.
 */

export type ExtensionNotifyTone = "info" | "warning" | "error";

export type ExtensionUiWidget = {
  key: string;
  /** String lines only — component widgets are rejected at the host bridge. */
  lines: string[];
  placement?: string;
};

export type ExtensionUiPortableState = {
  runtimeId: string | undefined;
  /** key → status text */
  statuses: Record<string, string>;
  widgets: Record<string, ExtensionUiWidget>;
  title: string | undefined;
  workingMessage: string | undefined;
  workingVisible: boolean;
  /** Deduped unsupported method names for this runtime (display once). */
  unsupported: string[];
  /** Last notify for transient banner. */
  lastNotify:
    | {
        message: string;
        type: ExtensionNotifyTone;
        at: number;
      }
    | undefined;
};

export function emptyExtensionUiPortableState(runtimeId?: string): ExtensionUiPortableState {
  return {
    runtimeId,
    statuses: {},
    widgets: {},
    title: undefined,
    workingMessage: undefined,
    workingVisible: false,
    unsupported: [],
    lastNotify: undefined,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringLines(content: unknown): string[] | undefined {
  if (content === undefined || content === null) return undefined;
  if (typeof content === "string") return content.length > 0 ? [content] : [];
  if (!Array.isArray(content)) return undefined;
  return content.filter((item): item is string => typeof item === "string");
}

export type ExtensionUiFireForgetResult = {
  state: ExtensionUiPortableState;
  /** When set, apply to composer draft. */
  editorText?: string;
  /** Transient OS/status notify. */
  notify?: { message: string; type: ExtensionNotifyTone };
};

/**
 * Apply a non-dialog extensionUi.request. Returns next state (+ optional side effects).
 * Unknown methods are ignored (dialog methods are not handled here).
 */
export function applyExtensionUiFireForget(
  prev: ExtensionUiPortableState,
  event: { runtimeId: string; method: string; args: unknown },
): ExtensionUiFireForgetResult {
  // Different runtime → hard reset before applying.
  let state =
    prev.runtimeId === event.runtimeId ? prev : emptyExtensionUiPortableState(event.runtimeId);
  if (state.runtimeId !== event.runtimeId) {
    state = { ...state, runtimeId: event.runtimeId };
  }

  const args = asRecord(event.args);

  switch (event.method) {
    case "notify": {
      const message = typeof args.message === "string" ? args.message : "";
      const type: ExtensionNotifyTone =
        args.type === "warning" || args.type === "error" ? args.type : "info";
      if (!message) return { state };
      return {
        state: {
          ...state,
          lastNotify: { message, type, at: Date.now() },
        },
        notify: { message, type },
      };
    }
    case "setStatus": {
      const key = typeof args.key === "string" ? args.key : "";
      if (!key) return { state };
      const next = { ...state.statuses };
      if (args.text === undefined || args.text === null) {
        delete next[key];
      } else if (typeof args.text === "string") {
        next[key] = args.text;
      } else {
        return { state };
      }
      return { state: { ...state, statuses: next } };
    }
    case "setWidget": {
      const key = typeof args.key === "string" ? args.key : "";
      if (!key) return { state };
      const next = { ...state.widgets };
      if (args.content === undefined || args.content === null) {
        delete next[key];
        return { state: { ...state, widgets: next } };
      }
      const lines = stringLines(args.content);
      if (lines === undefined) {
        // Component widgets are reported unsupported by the host bridge; ignore here.
        return { state };
      }
      const options = asRecord(args.options);
      const placement = typeof options.placement === "string" ? options.placement : undefined;
      next[key] = {
        key,
        lines,
        ...(placement ? { placement } : {}),
      };
      return { state: { ...state, widgets: next } };
    }
    case "setTitle": {
      const title = typeof args.title === "string" ? args.title : "";
      return {
        state: {
          ...state,
          title: title.trim().length > 0 ? title : undefined,
        },
      };
    }
    case "setEditorText": {
      const text = typeof args.text === "string" ? args.text : "";
      return { state, editorText: text };
    }
    case "setWorkingMessage": {
      const message =
        args.message === undefined || args.message === null
          ? undefined
          : typeof args.message === "string"
            ? args.message
            : undefined;
      return { state: { ...state, workingMessage: message } };
    }
    case "setWorkingVisible": {
      return {
        state: {
          ...state,
          workingVisible: args.visible === true,
        },
      };
    }
    case "setWorkingIndicator":
    case "setHiddenThinkingLabel":
      // Semantic no-ops on desktop (no TUI indicator surface); accept without error.
      return { state };
    case "unsupported": {
      const method =
        typeof args.method === "string" && args.method.length > 0 ? args.method : "unknown";
      if (state.unsupported.includes(method)) return { state };
      return {
        state: {
          ...state,
          unsupported: [...state.unsupported, method],
        },
      };
    }
    default:
      return { state };
  }
}

export function isExtensionUiFireForgetMethod(method: string): boolean {
  return (
    method === "notify" ||
    method === "setStatus" ||
    method === "setWidget" ||
    method === "setTitle" ||
    method === "setEditorText" ||
    method === "setWorkingMessage" ||
    method === "setWorkingVisible" ||
    method === "setWorkingIndicator" ||
    method === "setHiddenThinkingLabel" ||
    method === "unsupported"
  );
}

export function extensionStatusList(state: ExtensionUiPortableState): Array<{
  key: string;
  text: string;
}> {
  return Object.entries(state.statuses)
    .filter(([, text]) => text.trim().length > 0)
    .map(([key, text]) => ({ key, text }));
}

export function extensionWidgetsForPlacement(
  state: ExtensionUiPortableState,
  placement: "aboveEditor" | "belowEditor",
): ExtensionUiWidget[] {
  return Object.values(state.widgets).filter((widget) => {
    const p = widget.placement ?? "aboveEditor";
    return placement === "belowEditor" ? p === "belowEditor" : p !== "belowEditor";
  });
}
