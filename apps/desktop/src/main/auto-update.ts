/**
 * Desktop auto-update via electron-updater + GitHub Releases.
 * Checks once after launch when packaged; manual check from Settings.
 */
import type { AppUpdateStatus, AppUpdateState } from "@pix/contracts";
import { app } from "electron";
import { createRequire } from "node:module";

export type AutoUpdateBroadcast = (status: AppUpdateStatus) => void;

export type AutoUpdateController = {
  getStatus(): AppUpdateStatus;
  checkForUpdates(): Promise<AppUpdateStatus>;
  downloadUpdate(): Promise<AppUpdateStatus>;
  quitAndInstall(): void;
  dispose(): void;
};

type UpdaterLike = {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  allowPrerelease: boolean;
  logger: typeof console | null;
  checkForUpdates(): Promise<{ updateInfo: { version: string } } | null>;
  downloadUpdate(): Promise<unknown>;
  quitAndInstall(isSilent?: boolean, isForceRunAfter?: boolean): void;
  on(event: string, listener: (...args: unknown[]) => void): void;
  removeAllListeners(event?: string): void;
};

type StatusFields = {
  state: AppUpdateState;
  availableVersion?: string;
  percent?: number;
  error?: string;
  checkedAt?: string;
};

const nodeRequire = createRequire(import.meta.url);

function snapshotStatus(
  fields: StatusFields,
  currentVersion: string,
  canCheck: boolean,
): AppUpdateStatus {
  return buildAppUpdateStatus({
    state: fields.state,
    currentVersion,
    canCheck,
    ...(fields.availableVersion !== undefined ? { availableVersion: fields.availableVersion } : {}),
    ...(fields.percent !== undefined ? { percent: fields.percent } : {}),
    ...(fields.error !== undefined ? { error: fields.error } : {}),
    ...(fields.checkedAt !== undefined ? { checkedAt: fields.checkedAt } : {}),
  });
}

/**
 * Wire electron-updater. No-ops (except status) when not packaged.
 * `autoUpdater` is loaded lazily so unit tests and unpackaged runs avoid side effects.
 */
export function createAutoUpdateController(options: {
  broadcast: AutoUpdateBroadcast;
  /** Startup delay before the one automatic check (ms). */
  startupDelayMs?: number;
  /** Injected for tests. */
  loadUpdater?: () => UpdaterLike | null;
  /** Injected for tests. */
  isPackaged?: boolean;
  /** Injected for tests. */
  getVersion?: () => string;
}): AutoUpdateController {
  const isPackaged = options.isPackaged ?? app.isPackaged;
  const getVersion = options.getVersion ?? (() => app.getVersion());
  const startupDelayMs = options.startupDelayMs ?? 8_000;

  let status: AppUpdateStatus = snapshotStatus({ state: "idle" }, getVersion(), isPackaged);
  let disposed = false;
  let startupTimer: ReturnType<typeof setTimeout> | undefined;
  let updater: UpdaterLike | null = null;
  let listenersAttached = false;

  function setStatus(fields: StatusFields): AppUpdateStatus {
    status = snapshotStatus(fields, getVersion(), isPackaged);
    if (!disposed) options.broadcast(status);
    return status;
  }

  function load(): UpdaterLike | null {
    if (!isPackaged) return null;
    if (updater) return updater;
    if (options.loadUpdater) {
      updater = options.loadUpdater();
      return updater;
    }
    try {
      // electron-updater is CJS; createRequire works from ESM main.
      const mod = nodeRequire("electron-updater") as {
        autoUpdater?: UpdaterLike;
        default?: { autoUpdater?: UpdaterLike };
      };
      updater = mod.autoUpdater ?? mod.default?.autoUpdater ?? null;
      return updater;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus({ state: "error", error: message });
      return null;
    }
  }

  function attachListeners(instance: UpdaterLike): void {
    if (listenersAttached) return;
    listenersAttached = true;
    instance.autoDownload = false;
    instance.autoInstallOnAppQuit = true;
    instance.allowPrerelease = false;
    instance.logger = console;

    instance.on("checking-for-update", () => {
      setStatus({ state: "checking" });
    });
    instance.on("update-available", (info: unknown) => {
      const version =
        info && typeof info === "object" && "version" in info
          ? String((info as { version: unknown }).version)
          : undefined;
      setStatus({
        state: "available",
        ...(version ? { availableVersion: version } : {}),
        checkedAt: new Date().toISOString(),
      });
    });
    instance.on("update-not-available", () => {
      setStatus({
        state: "not-available",
        checkedAt: new Date().toISOString(),
      });
    });
    instance.on("download-progress", (progress: unknown) => {
      const raw =
        progress && typeof progress === "object" && "percent" in progress
          ? Number((progress as { percent: unknown }).percent)
          : Number.NaN;
      setStatus({
        state: "downloading",
        ...(status.availableVersion ? { availableVersion: status.availableVersion } : {}),
        ...(Number.isFinite(raw) ? { percent: raw } : {}),
      });
    });
    instance.on("update-downloaded", (info: unknown) => {
      const version =
        info && typeof info === "object" && "version" in info
          ? String((info as { version: unknown }).version)
          : status.availableVersion;
      setStatus({
        state: "downloaded",
        ...(version ? { availableVersion: version } : {}),
        percent: 100,
      });
    });
    instance.on("error", (error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      setStatus({
        state: "error",
        error: message,
        ...(status.availableVersion ? { availableVersion: status.availableVersion } : {}),
      });
    });
  }

  async function checkForUpdates(): Promise<AppUpdateStatus> {
    if (!isPackaged) {
      return setStatus({
        state: "not-available",
        checkedAt: new Date().toISOString(),
      });
    }
    const instance = load();
    if (!instance) {
      return setStatus({
        state: "error",
        error: status.error ?? "Auto-updater is unavailable",
      });
    }
    attachListeners(instance);
    try {
      setStatus({ state: "checking" });
      const result = await instance.checkForUpdates();
      // Event handlers usually update state; keep a fallback if none fired.
      if (status.state === "checking" && result?.updateInfo?.version) {
        return setStatus({
          state: "available",
          availableVersion: result.updateInfo.version,
          checkedAt: new Date().toISOString(),
        });
      }
      if (status.state === "checking") {
        return setStatus({
          state: "not-available",
          checkedAt: new Date().toISOString(),
        });
      }
      return status;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return setStatus({ state: "error", error: message });
    }
  }

  async function downloadUpdate(): Promise<AppUpdateStatus> {
    if (!isPackaged) {
      return setStatus({
        state: "error",
        error: "Updates are only available in packaged builds",
      });
    }
    const instance = load();
    if (!instance) {
      return setStatus({
        state: "error",
        error: status.error ?? "Auto-updater is unavailable",
      });
    }
    attachListeners(instance);
    if (
      status.state !== "available" &&
      status.state !== "error" &&
      status.state !== "downloading"
    ) {
      // Allow retry from error; otherwise require an available update.
      if (status.state !== "downloaded") {
        await checkForUpdates();
      }
    }
    if (status.state === "downloaded") return status;
    try {
      setStatus({
        state: "downloading",
        percent: status.percent ?? 0,
        ...(status.availableVersion ? { availableVersion: status.availableVersion } : {}),
      });
      await instance.downloadUpdate();
      if (status.state === "downloading") {
        return setStatus({
          state: "downloaded",
          percent: 100,
          ...(status.availableVersion ? { availableVersion: status.availableVersion } : {}),
        });
      }
      return status;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return setStatus({
        state: "error",
        error: message,
        ...(status.availableVersion ? { availableVersion: status.availableVersion } : {}),
      });
    }
  }

  function quitAndInstall(): void {
    if (!isPackaged) return;
    const instance = load();
    if (!instance) return;
    // isSilent=false, isForceRunAfter=true
    instance.quitAndInstall(false, true);
  }

  if (isPackaged) {
    startupTimer = setTimeout(() => {
      void checkForUpdates().catch((error) => {
        console.warn("[pix] startup update check failed:", error);
      });
    }, startupDelayMs);
  }

  return {
    getStatus: () =>
      snapshotStatus(
        {
          state: status.state,
          ...(status.availableVersion !== undefined
            ? { availableVersion: status.availableVersion }
            : {}),
          ...(status.percent !== undefined ? { percent: status.percent } : {}),
          ...(status.error !== undefined ? { error: status.error } : {}),
          ...(status.checkedAt !== undefined ? { checkedAt: status.checkedAt } : {}),
        },
        getVersion(),
        isPackaged,
      ),
    checkForUpdates,
    downloadUpdate,
    quitAndInstall,
    dispose: () => {
      disposed = true;
      if (startupTimer) clearTimeout(startupTimer);
      startupTimer = undefined;
      try {
        updater?.removeAllListeners();
      } catch {
        // ignore
      }
    },
  };
}

/** Test helper: build a status snapshot without Electron app. */
export function buildAppUpdateStatus(input: {
  state: AppUpdateState;
  currentVersion: string;
  canCheck: boolean;
  availableVersion?: string;
  percent?: number;
  error?: string;
  checkedAt?: string;
}): AppUpdateStatus {
  return {
    state: input.state,
    currentVersion: input.currentVersion,
    canCheck: input.canCheck,
    ...(input.availableVersion !== undefined ? { availableVersion: input.availableVersion } : {}),
    ...(input.percent !== undefined ? { percent: input.percent } : {}),
    ...(input.error !== undefined ? { error: input.error } : {}),
    ...(input.checkedAt !== undefined ? { checkedAt: input.checkedAt } : {}),
  };
}
