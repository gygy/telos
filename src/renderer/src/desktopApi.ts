import type { PiDesktopApi } from "../../preload";
import { t } from "./i18n";
import { createBrowserApi } from "./browserApi";
import { createPreviewApi } from "./previewApi";

export const isLanWeb =
  !window.piDesktop && window.location.protocol.startsWith("http");
export const isElectronRuntime = navigator.userAgent.includes("Electron/");

/**
 * 必须运行时探测：模块顶层一次性读 `window.piDesktop` 会在「首屏竞态 /
 * Vite HMR 半截重载」后把 false 冻死，界面一直显示「预加载 API 未注入」。
 */
export function isMissingElectronPreload(): boolean {
  return navigator.userAgent.includes("Electron/") && !window.piDesktop;
}

/** @deprecated 兼容旧引用；请改用 isMissingElectronPreload() */
export const missingElectronPreload = isMissingElectronPreload();

function createUnavailableDesktopApi(): PiDesktopApi {
  const fail = () => {
    throw new Error(t("app.preloadMissing"));
  };
  return new Proxy(
    {},
    {
      get: fail,
      set: fail,
    },
  ) as PiDesktopApi;
}

export const desktopApi: PiDesktopApi =
  window.piDesktop ??
  (isMissingElectronPreload()
    ? createUnavailableDesktopApi()
    : isLanWeb
      ? createBrowserApi()
      : createPreviewApi());
