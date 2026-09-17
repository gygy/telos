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

function resolveDesktopApi(): PiDesktopApi {
  if (window.piDesktop) return window.piDesktop;
  if (isMissingElectronPreload()) return createUnavailableDesktopApi();
  if (isLanWeb) return createBrowserApi();
  return createPreviewApi();
}

/**
 * 惰性代理：每次访问都回读 `window.piDesktop`，避免模块初始化瞬间未注入时
 * 把 unavailable proxy 冻成桌面 API。
 */
export const desktopApi: PiDesktopApi = new Proxy({} as PiDesktopApi, {
  get(_target, prop) {
    const api = resolveDesktopApi();
    const value = Reflect.get(api as object, prop, api);
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(api)
      : value;
  },
  set(_target, prop, value) {
    return Reflect.set(resolveDesktopApi() as object, prop, value);
  },
  has(_target, prop) {
    return Reflect.has(resolveDesktopApi() as object, prop);
  },
});
