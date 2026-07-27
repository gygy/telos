import { describe, expect, it, vi } from "vite-plus/test";
import { buildAppUpdateStatus, createAutoUpdateController } from "./auto-update.ts";

describe("buildAppUpdateStatus", () => {
  it("includes optional fields only when provided", () => {
    expect(
      buildAppUpdateStatus({
        state: "idle",
        currentVersion: "0.4.0",
        canCheck: true,
      }),
    ).toEqual({
      state: "idle",
      currentVersion: "0.4.0",
      canCheck: true,
    });

    expect(
      buildAppUpdateStatus({
        state: "available",
        currentVersion: "0.4.0",
        canCheck: true,
        availableVersion: "0.5.0",
        percent: 10,
        error: "x",
        checkedAt: "2026-01-01T00:00:00.000Z",
      }),
    ).toEqual({
      state: "available",
      currentVersion: "0.4.0",
      canCheck: true,
      availableVersion: "0.5.0",
      percent: 10,
      error: "x",
      checkedAt: "2026-01-01T00:00:00.000Z",
    });
  });
});

describe("createAutoUpdateController", () => {
  it("skips network checks when not packaged", async () => {
    const broadcast = vi.fn();
    const loadUpdater = vi.fn(() => {
      throw new Error("should not load updater");
    });
    const controller = createAutoUpdateController({
      broadcast,
      isPackaged: false,
      getVersion: () => "0.4.0",
      loadUpdater,
      startupDelayMs: 60_000,
    });

    expect(controller.getStatus()).toMatchObject({
      state: "idle",
      currentVersion: "0.4.0",
      canCheck: false,
    });

    const checked = await controller.checkForUpdates();
    expect(checked.state).toBe("not-available");
    expect(checked.canCheck).toBe(false);
    expect(loadUpdater).not.toHaveBeenCalled();
    expect(broadcast).toHaveBeenCalled();
    controller.dispose();
  });

  it("checks once via injected updater when packaged", async () => {
    const broadcast = vi.fn();
    const checkForUpdates = vi.fn(async () => ({
      updateInfo: { version: "0.5.0" },
    }));
    const downloadUpdate = vi.fn(async () => undefined);
    const quitAndInstall = vi.fn();
    const listeners = new Map<string, Array<(...args: unknown[]) => void>>();

    const updater = {
      autoDownload: true,
      autoInstallOnAppQuit: false,
      allowPrerelease: true,
      logger: null as typeof console | null,
      checkForUpdates,
      downloadUpdate,
      quitAndInstall,
      on(event: string, listener: (...args: unknown[]) => void) {
        const list = listeners.get(event) ?? [];
        list.push(listener);
        listeners.set(event, list);
      },
      removeAllListeners() {
        listeners.clear();
      },
    };

    const controller = createAutoUpdateController({
      broadcast,
      isPackaged: true,
      getVersion: () => "0.4.0",
      loadUpdater: () => updater,
      startupDelayMs: 60_000,
    });

    const available = await controller.checkForUpdates();
    expect(updater.autoDownload).toBe(false);
    expect(updater.autoInstallOnAppQuit).toBe(true);
    expect(checkForUpdates).toHaveBeenCalledTimes(1);
    expect(available.state).toBe("available");
    expect(available.availableVersion).toBe("0.5.0");

    // Simulate download events then await downloadUpdate
    const progressHandlers = listeners.get("download-progress") ?? [];
    const downloadedHandlers = listeners.get("update-downloaded") ?? [];
    const downloadPromise = controller.downloadUpdate();
    for (const handler of progressHandlers) handler({ percent: 42 });
    for (const handler of downloadedHandlers) handler({ version: "0.5.0" });
    const downloaded = await downloadPromise;
    expect(downloadUpdate).toHaveBeenCalledTimes(1);
    expect(downloaded.state).toBe("downloaded");

    controller.quitAndInstall();
    expect(quitAndInstall).toHaveBeenCalledWith(false, true);
    controller.dispose();
  });

  it("surfaces updater errors", async () => {
    const controller = createAutoUpdateController({
      broadcast: () => undefined,
      isPackaged: true,
      getVersion: () => "0.4.0",
      loadUpdater: () => ({
        autoDownload: false,
        autoInstallOnAppQuit: true,
        allowPrerelease: false,
        logger: null,
        checkForUpdates: async () => {
          throw new Error("network down");
        },
        downloadUpdate: async () => undefined,
        quitAndInstall: () => undefined,
        on() {
          // no-op
        },
        removeAllListeners() {
          // no-op
        },
      }),
      startupDelayMs: 60_000,
    });

    const status = await controller.checkForUpdates();
    expect(status.state).toBe("error");
    expect(status.error).toContain("network down");
    controller.dispose();
  });
});
