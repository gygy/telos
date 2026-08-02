import type {
  ThemeLibrarySnapshot,
  ThemeSkinColors,
  ThemeSkinConfig,
  ThemeSkinMaterials,
  ThemeSkinRecord,
  ThemeSkinVariant,
} from "@pix/contracts";
import mikuStageUrl from "../assets/theme-skins/miku-stage.jpg";
import venomNoirUrl from "../assets/theme-skins/venom-noir.jpg";
import zhangRuonanUrl from "../assets/theme-skins/zhang-ruonan.jpg";
import { scopeThemeCustomCss, validateThemeCustomCss } from "../../shared/theme-css.ts";
import type { ResolvedColorMode } from "./theme.ts";

export const THEME_TOKEN_CSS_VARIABLES = {
  background: "--background",
  foreground: "--foreground",
  surfacePanel: "--surface-panel",
  surfaceMuted: "--surface-muted",
  surfaceSoft: "--surface-soft",
  primary: "--primary",
  primaryForeground: "--primary-foreground",
  secondary: "--secondary",
  secondaryForeground: "--secondary-foreground",
  muted: "--muted",
  mutedForeground: "--muted-foreground",
  hoverFill: "--hover-fill",
  hoverFillForeground: "--hover-fill-foreground",
  accent: "--accent",
  accentForeground: "--accent-foreground",
  destructive: "--destructive",
  border: "--border",
  borderSubtle: "--border-subtle",
  divider: "--divider",
  input: "--input",
  ring: "--ring",
  link: "--link",
  switchOn: "--switch-on",
  sidebar: "--sidebar",
  sidebarForeground: "--sidebar-foreground",
  sidebarPrimary: "--sidebar-primary",
  sidebarPrimaryForeground: "--sidebar-primary-foreground",
  sidebarBorder: "--sidebar-border",
  sidebarRing: "--sidebar-ring",
  composerBorder: "--composer-border",
  composerProtrusion: "--composer-protrusion",
  userBubble: "--user-bubble",
  userBubbleForeground: "--user-bubble-fg",
  codeBg: "--code-bg",
  codeFg: "--code-fg",
} as const;

export type ThemeTokenName = keyof typeof THEME_TOKEN_CSS_VARIABLES;
export type ThemeTokens = Partial<Record<ThemeTokenName, string>>;
export type ThemePack = ThemeSkinConfig;
export type ThemeSelection = { id: string };
export type ThemePreview = Pick<ThemeSkinRecord, "config" | "backgroundUrl">;
/** Built-in skins that ship with a bundled wallpaper. */
export type ThemeImagePresetId = "miku-stage" | "venom-noir" | "zhang-ruonan";
export type ThemePresetId = "classic-light" | "classic-dark" | ThemeImagePresetId;

export const THEME_IMAGE_PRESET_IDS: readonly ThemeImagePresetId[] = [
  "miku-stage",
  "venom-noir",
  "zhang-ruonan",
];
export const THEME_PRESET_IDS: readonly ThemePresetId[] = [
  "classic-light",
  "classic-dark",
  ...THEME_IMAGE_PRESET_IDS,
];
export const DEFAULT_THEME_PRESET_ID: ThemePresetId = "miku-stage";
export const DEFAULT_THEME_SELECTION: ThemeSelection = { id: DEFAULT_THEME_PRESET_ID };

export const BUILTIN_THEME_BACKGROUNDS: Record<ThemeImagePresetId, string> = {
  "miku-stage": mikuStageUrl,
  "venom-noir": venomNoirUrl,
  "zhang-ruonan": zhangRuonanUrl,
};

const BUILTIN_BACKGROUND_URLS = new Set(Object.values(BUILTIN_THEME_BACKGROUNDS));
const LEGACY_THEME_PRESET_IDS = new Set([
  "neutral",
  "lagoon",
  "cinder",
  "anime-studio",
  "pink-street",
  "anime-street",
  "safe-landing",
]);

const COLOR_KEYS = [
  "background",
  "panel",
  "panelAlt",
  "accent",
  "accentAlt",
  "secondary",
  "highlight",
  "text",
  "muted",
  "line",
] as const;

/** Shared slider defaults shown in Theme Studio (and used by image skins). */
export const ART_DEFAULTS = {
  focusX: 0.5,
  focusY: 0.5,
  zoom: 1,
  dim: 0.1,
  safeArea: "center" as const,
  taskIntensity: 0.78,
};

export const MATERIAL_DEFAULTS: Required<ThemeSkinMaterials> = {
  sidebarOpacity: 0.64,
  pageOpacity: 0.35,
  panelOpacity: 0.74,
  blur: 0,
  radius: 20,
  borderAlpha: 0.3,
  shadow: "strong",
  density: "standard",
};

/** Opaque chrome matching pre-skin shell (no wallpaper translucency). */
const CLASSIC_ART = {
  focusX: 0.5,
  focusY: 0.5,
  zoom: 1,
  dim: 0,
  safeArea: "center" as const,
  taskIntensity: 0,
};

const CLASSIC_MATERIALS: Required<ThemeSkinMaterials> = {
  sidebarOpacity: 1,
  pageOpacity: 1,
  panelOpacity: 1,
  blur: 0,
  radius: 12,
  borderAlpha: 0.22,
  shadow: "none",
  density: "standard",
};

/** Pre-skin light shell tokens from `styles.css` `[data-theme="light"]`. */
const CLASSIC_LIGHT_TOKENS: ThemeTokens = {
  background: "#ffffff",
  foreground: "#171717",
  surfacePanel: "#ffffff",
  surfaceMuted: "#f6f6f6",
  surfaceSoft: "#f5f5f5",
  primary: "#171717",
  primaryForeground: "#fafafa",
  secondary: "#f6f6f6",
  secondaryForeground: "#171717",
  muted: "#f1f2f4",
  mutedForeground: "#808182",
  hoverFill: "#f6f6f6",
  hoverFillForeground: "#171717",
  accent: "#f6f6f6",
  accentForeground: "#171717",
  destructive: "#dc2626",
  border: "#d7d9e0",
  borderSubtle: "color-mix(in srgb, #9aa0ab 30%, #ffffff)",
  divider: "color-mix(in srgb, #9aa0ab 24%, #ffffff)",
  input: "#d7d9e0",
  ring: "#0a84ff",
  link: "#379cfc",
  switchOn: "#379cfc",
  sidebar: "#f1f2f4",
  sidebarForeground: "#171717",
  sidebarPrimary: "#171717",
  sidebarPrimaryForeground: "#fafafa",
  sidebarBorder: "#cdd0d8",
  sidebarRing: "#0a84ff",
  composerBorder: "color-mix(in srgb, #9aa0ab 36%, #ffffff)",
  composerProtrusion: "#f5f5f5",
  userBubble: "#f5f5f5",
  userBubbleForeground: "#171717",
  codeBg: "#f1f2f4",
  codeFg: "#171717",
};

/** Pre-skin dark shell tokens from `styles.css` `:root` / `[data-theme="dark"]`. */
const CLASSIC_DARK_TOKENS: ThemeTokens = {
  background: "#191919",
  foreground: "oklch(0.985 0.004 260)",
  surfacePanel: "#2d2d2d",
  surfaceMuted: "#383838",
  surfaceSoft: "#272727",
  primary: "oklch(0.72 0.12 255)",
  primaryForeground: "oklch(0.18 0.01 260)",
  secondary: "#383838",
  secondaryForeground: "oklch(0.985 0.004 260)",
  muted: "#222222",
  mutedForeground: "#acacac",
  hoverFill: "#383838",
  hoverFillForeground: "oklch(0.985 0.004 260)",
  accent: "#383838",
  accentForeground: "oklch(0.985 0.004 260)",
  destructive: "oklch(0.72 0.17 25)",
  border: "#3c3c3c",
  borderSubtle: "color-mix(in srgb, #ffffff 11%, transparent)",
  divider: "color-mix(in srgb, #ffffff 9%, transparent)",
  input: "#3c3c3c",
  ring: "oklch(0.62 0.09 255)",
  link: "#379cfc",
  switchOn: "#379cfc",
  sidebar: "#151515",
  sidebarForeground: "oklch(0.985 0.004 260)",
  sidebarPrimary: "oklch(0.72 0.12 255)",
  sidebarPrimaryForeground: "oklch(0.18 0.01 260)",
  sidebarBorder: "#383838",
  sidebarRing: "oklch(0.62 0.09 255)",
  composerBorder: "color-mix(in srgb, #ffffff 11%, #2d2d2d)",
  composerProtrusion: "#212121",
  userBubble: "#272727",
  userBubbleForeground: "oklch(0.985 0.004 260)",
  codeBg: "#0f0f0f",
  codeFg: "#e8e8e2",
};

export const THEME_PRESETS: Record<ThemePresetId, ThemePack> = {
  "classic-light": {
    schemaVersion: 1,
    id: "classic-light",
    name: "默认亮色",
    appearance: "light",
    art: { ...CLASSIC_ART },
    materials: { ...CLASSIC_MATERIALS },
    light: {
      background: "#ffffff",
      colors: {
        background: "#ffffff",
        panel: "#ffffff",
        panelAlt: "#f6f6f6",
        accent: "#171717",
        accentAlt: "#454545",
        secondary: "#f6f6f6",
        highlight: "#0a84ff",
        text: "#171717",
        muted: "#808182",
        line: "#d7d9e0",
      },
      tokens: CLASSIC_LIGHT_TOKENS,
    },
  },
  "classic-dark": {
    schemaVersion: 1,
    id: "classic-dark",
    name: "默认暗色",
    appearance: "dark",
    art: { ...CLASSIC_ART },
    materials: { ...CLASSIC_MATERIALS },
    dark: {
      background: "#191919",
      colors: {
        background: "#191919",
        panel: "#2d2d2d",
        panelAlt: "#383838",
        accent: "#4c8dff",
        accentAlt: "#7aabff",
        secondary: "#383838",
        highlight: "#379cfc",
        text: "#f5f5f5",
        muted: "#acacac",
        line: "#3c3c3c",
      },
      tokens: CLASSIC_DARK_TOKENS,
    },
  },
  "miku-stage": {
    schemaVersion: 1,
    id: "miku-stage",
    name: "初音未来 · 青葱舞台",
    appearance: "auto",
    art: { ...ART_DEFAULTS },
    materials: { ...MATERIAL_DEFAULTS },
    light: {
      background: "linear-gradient(135deg, #d9fcf5 0%, #cbeafd 100%)",
      colors: {
        background: "#d9f4f1",
        panel: "#f3fffc",
        panelAlt: "#c8e7e5",
        accent: "#169ba8",
        accentAlt: "#48c6ca",
        secondary: "#277ed0",
        highlight: "#df5d91",
        text: "#15323a",
        muted: "#5b7479",
        line: "rgba(22, 155, 168, 0.25)",
      },
    },
    dark: {
      background: "linear-gradient(135deg, #071f28 0%, #10254d 100%)",
      colors: {
        background: "#09212a",
        panel: "#12343b",
        panelAlt: "#1d4a51",
        accent: "#62dfd8",
        accentAlt: "#a4f4ed",
        secondary: "#77b9ff",
        highlight: "#ffa3c4",
        text: "#eefffd",
        muted: "#aed0d1",
        line: "rgba(98, 223, 216, 0.28)",
      },
    },
  },
  "venom-noir": {
    schemaVersion: 1,
    id: "venom-noir",
    name: "毒液 · 共生暗影",
    appearance: "auto",
    art: { ...ART_DEFAULTS },
    materials: { ...MATERIAL_DEFAULTS },
    light: {
      background: "linear-gradient(135deg, #e7ebf2 0%, #d4dfef 100%)",
      colors: {
        background: "#e4e9f0",
        panel: "#f6f8fc",
        panelAlt: "#cbd4e2",
        accent: "#265be3",
        accentAlt: "#6293ff",
        secondary: "#1d7e78",
        highlight: "#6e4be8",
        text: "#16202d",
        muted: "#5e6c7e",
        line: "rgba(38, 91, 227, 0.26)",
      },
    },
    dark: {
      background: "linear-gradient(135deg, #05070c 0%, #101426 100%)",
      colors: {
        background: "#080b11",
        panel: "#121824",
        panelAlt: "#202939",
        accent: "#719cff",
        accentAlt: "#b3c8ff",
        secondary: "#69d0c8",
        highlight: "#ad8aff",
        text: "#f2f5fc",
        muted: "#b9c1d0",
        line: "rgba(113, 156, 255, 0.3)",
      },
    },
  },
  "zhang-ruonan": {
    schemaVersion: 1,
    id: "zhang-ruonan",
    name: "章若楠 · 青春映画",
    appearance: "auto",
    art: { ...ART_DEFAULTS },
    materials: { ...MATERIAL_DEFAULTS },
    light: {
      background: "linear-gradient(135deg, #fff1eb 0%, #e0f0eb 100%)",
      colors: {
        background: "#faece7",
        panel: "#fffaf6",
        panelAlt: "#eadbd8",
        accent: "#cb5770",
        accentAlt: "#ee91a5",
        secondary: "#237d7b",
        highlight: "#cf7d3e",
        text: "#372729",
        muted: "#80696b",
        line: "rgba(203, 87, 112, 0.22)",
      },
    },
    dark: {
      background: "linear-gradient(135deg, #1d151b 0%, #132c30 100%)",
      colors: {
        background: "#20171d",
        panel: "#2d2029",
        panelAlt: "#3d3038",
        accent: "#ff9cae",
        accentAlt: "#ffc3ce",
        secondary: "#8bd1c9",
        highlight: "#ffb36e",
        text: "#fff7f8",
        muted: "#d2bdc3",
        line: "rgba(255, 156, 174, 0.28)",
      },
    },
  },
};

/** A vivid, readable starting point for themes created in Studio. */
export function createThemeSkinDraft(name: string): ThemePack {
  return {
    schemaVersion: 1,
    name: name.trim() || "Aurora",
    appearance: "auto",
    art: { ...ART_DEFAULTS },
    materials: { ...MATERIAL_DEFAULTS },
    light: {
      background: "linear-gradient(135deg, #f4f8ff 0%, #e7effa 100%)",
      colors: {
        background: "#eef3fb",
        panel: "#ffffff",
        panelAlt: "#e2eaf5",
        accent: "#379cfc",
        accentAlt: "#6db6ff",
        secondary: "#379cfc",
        highlight: "#d06b42",
        text: "#172235",
        muted: "#66768c",
        line: "rgba(55, 156, 252, 0.22)",
      },
    },
    dark: {
      background: "linear-gradient(135deg, #1f1f1f 0%, #252525 100%)",
      colors: {
        background: "#202020",
        panel: "#2a2a2a",
        panelAlt: "#353535",
        accent: "#379cfc",
        accentAlt: "#7bbcff",
        secondary: "#379cfc",
        highlight: "#d98b57",
        text: "#f5f5f5",
        muted: "#b2b2b2",
        line: "rgba(255, 255, 255, 0.16)",
      },
    },
  };
}

const CSS_VARIABLE_TO_THEME_TOKEN: Record<string, ThemeTokenName> = Object.fromEntries(
  Object.entries(THEME_TOKEN_CSS_VARIABLES).map(([name, cssVariable]) => [cssVariable, name]),
) as Record<string, ThemeTokenName>;

const THEME_SELECTION_STORAGE_KEY = "pix.theme.selection.v2";
const MAX_CSS_VALUE_LENGTH = 1_000;
const MAX_THEME_NAME_LENGTH = 80;
const MAX_THEME_DESCRIPTION_LENGTH = 280;
const CSS_VALUE_CHARACTER_PATTERN = /^[#(),.%/\s+a-z0-9-]+$/i;
const CSS_FUNCTION_NAMES = new Set([
  "linear-gradient",
  "radial-gradient",
  "conic-gradient",
  "repeating-linear-gradient",
  "repeating-radial-gradient",
  "repeating-conic-gradient",
  "rgb",
  "rgba",
  "hsl",
  "hsla",
  "hwb",
  "lab",
  "lch",
  "oklab",
  "oklch",
  "color",
  "color-mix",
  "var",
  "calc",
  "min",
  "max",
  "clamp",
]);
const GRADIENT_PATTERN = /^(?:repeating-)?(?:linear|radial|conic)-gradient\(/i;
const COLOR_FUNCTION_PATTERN = /^(?:color|hsl|hwb|lab|lch|oklab|oklch|rgb)a?\(/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function cleanText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  return text && text.length <= maxLength ? text : undefined;
}

function hasSafeCssFunctions(value: string): boolean {
  let depth = 0;
  for (const character of value) {
    if (character === "(") depth += 1;
    if (character === ")") {
      depth -= 1;
      if (depth < 0) return false;
    }
  }
  if (depth !== 0) return false;

  for (const match of value.matchAll(/([a-z][a-z0-9-]*)\(/gi)) {
    if (!CSS_FUNCTION_NAMES.has(match[1]!.toLowerCase())) return false;
  }
  return true;
}

function isSafeCssValue(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const text = value.trim();
  if (!text || text.length > MAX_CSS_VALUE_LENGTH) return false;
  if (/[;{}<>\n\r]/.test(text)) return false;
  if (/\b(?:url|expression)\s*\(/i.test(text)) return false;
  return CSS_VALUE_CHARACTER_PATTERN.test(text) && hasSafeCssFunctions(text);
}

function themeTokenName(value: string): ThemeTokenName | undefined {
  if (value in THEME_TOKEN_CSS_VARIABLES) return value as ThemeTokenName;
  return CSS_VARIABLE_TO_THEME_TOKEN[value];
}

function parseTokens(raw: unknown): ThemeTokens | undefined {
  if (raw === undefined) return undefined;
  if (!isRecord(raw)) throw new Error("Theme tokens must be an object");
  const tokens: ThemeTokens = {};
  for (const [name, value] of Object.entries(raw)) {
    const token = themeTokenName(name);
    if (!token) throw new Error(`Unsupported theme token: ${name}`);
    if (!isSafeCssValue(value)) throw new Error(`Invalid value for theme token: ${name}`);
    tokens[token] = value.trim();
  }
  return Object.keys(tokens).length ? tokens : undefined;
}

function parseColors(raw: unknown): ThemeSkinColors | undefined {
  if (raw === undefined) return undefined;
  if (!isRecord(raw)) throw new Error("Theme colors must be an object");
  const colors: ThemeSkinColors = {};
  for (const [name, value] of Object.entries(raw)) {
    if (!(COLOR_KEYS as readonly string[]).includes(name)) {
      throw new Error(`Unsupported theme color: ${name}`);
    }
    if (!isSafeCssValue(value)) throw new Error(`Invalid value for theme color: ${name}`);
    colors[name as keyof ThemeSkinColors] = value.trim();
  }
  return Object.keys(colors).length ? colors : undefined;
}

function parseBackground(raw: unknown): string | undefined {
  if (raw === undefined) return undefined;
  if (!isSafeCssValue(raw)) throw new Error("Theme background must be a color or gradient");
  const background = raw.trim();
  if (
    GRADIENT_PATTERN.test(background) ||
    COLOR_FUNCTION_PATTERN.test(background) ||
    background.startsWith("var(") ||
    !background.includes("(")
  ) {
    return background;
  }
  throw new Error("Theme background must be a color or gradient");
}

function parseVariant(raw: unknown, label: string): ThemeSkinVariant | undefined {
  if (raw === undefined) return undefined;
  if (!isRecord(raw)) throw new Error(`${label} theme variant must be an object`);
  const background = parseBackground(raw.background);
  const colors = parseColors(raw.colors);
  const tokens = parseTokens(raw.tokens);
  if (!background && !colors && !tokens) return undefined;
  const variant: ThemeSkinVariant = {};
  if (background) variant.background = background;
  if (colors) variant.colors = colors;
  if (tokens) variant.tokens = tokens;
  return variant;
}

function parseUnit(value: unknown, min: number, max: number, label: string): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`Invalid ${label}`);
  }
  return value;
}

function parseArt(raw: unknown): ThemeSkinConfig["art"] {
  if (raw === undefined) return undefined;
  if (!isRecord(raw)) throw new Error("Theme art must be an object");
  const art: NonNullable<ThemeSkinConfig["art"]> = {};
  const focusX = parseUnit(raw.focusX, 0, 1, "art focusX");
  const focusY = parseUnit(raw.focusY, 0, 1, "art focusY");
  const zoom = parseUnit(raw.zoom, 0.75, 2, "art zoom");
  const dim = parseUnit(raw.dim, 0, 0.88, "art dim");
  const taskIntensity = parseUnit(raw.taskIntensity, 0, 1, "art taskIntensity");
  if (focusX !== undefined) art.focusX = focusX;
  if (focusY !== undefined) art.focusY = focusY;
  if (zoom !== undefined) art.zoom = zoom;
  if (dim !== undefined) art.dim = dim;
  if (taskIntensity !== undefined) art.taskIntensity = taskIntensity;
  if (raw.safeArea !== undefined) {
    if (raw.safeArea !== "left" && raw.safeArea !== "center" && raw.safeArea !== "right") {
      throw new Error("Invalid art safeArea");
    }
    art.safeArea = raw.safeArea;
  }
  return Object.keys(art).length ? art : undefined;
}

function parseMaterials(raw: unknown): ThemeSkinConfig["materials"] {
  if (raw === undefined) return undefined;
  if (!isRecord(raw)) throw new Error("Theme materials must be an object");
  const materials: NonNullable<ThemeSkinConfig["materials"]> = {};
  const sidebarOpacity = parseUnit(raw.sidebarOpacity, 0.2, 1, "material sidebarOpacity");
  const pageOpacity = parseUnit(raw.pageOpacity, 0.2, 1, "material pageOpacity");
  const panelOpacity = parseUnit(raw.panelOpacity, 0.2, 1, "material panelOpacity");
  const blur = parseUnit(raw.blur, 0, 40, "material blur");
  const radius = parseUnit(raw.radius, 0, 32, "material radius");
  const borderAlpha = parseUnit(raw.borderAlpha, 0, 0.8, "material borderAlpha");
  if (sidebarOpacity !== undefined) materials.sidebarOpacity = sidebarOpacity;
  if (pageOpacity !== undefined) materials.pageOpacity = pageOpacity;
  if (panelOpacity !== undefined) materials.panelOpacity = panelOpacity;
  if (blur !== undefined) materials.blur = blur;
  if (radius !== undefined) materials.radius = radius;
  if (borderAlpha !== undefined) materials.borderAlpha = borderAlpha;
  if (raw.shadow !== undefined) {
    if (raw.shadow !== "none" && raw.shadow !== "soft" && raw.shadow !== "strong") {
      throw new Error("Invalid material shadow");
    }
    materials.shadow = raw.shadow;
  }
  if (raw.density !== undefined) {
    if (raw.density !== "compact" && raw.density !== "standard" && raw.density !== "comfortable") {
      throw new Error("Invalid material density");
    }
    materials.density = raw.density;
  }
  return Object.keys(materials).length ? materials : undefined;
}

function parseImageName(raw: unknown): string | undefined {
  const image = cleanText(raw, 160);
  if (!image) return undefined;
  if (image.includes("/") || image.includes("\\") || !/\.(?:png|jpe?g|webp)$/i.test(image)) {
    throw new Error("Theme image must be a local PNG, JPEG, or WebP file name");
  }
  return image;
}

/** Parse a portable Pix skin or a compatible Dream Skin theme.json document. */
export function parseThemePack(raw: unknown): ThemePack {
  if (!isRecord(raw)) throw new Error("Theme pack must be an object");
  if (hasOwn(raw, "version") && raw.version !== 1)
    throw new Error("Unsupported theme pack version");
  if (hasOwn(raw, "schemaVersion") && raw.schemaVersion !== 1) {
    throw new Error("Unsupported theme schema version");
  }
  if (hasOwn(raw, "meta") && !isRecord(raw.meta))
    throw new Error("Theme metadata must be an object");

  const meta = isRecord(raw.meta) ? raw.meta : raw;
  const config: ThemePack = {
    schemaVersion: 1,
    name: cleanText(meta.name, MAX_THEME_NAME_LENGTH) ?? "Imported skin",
  };
  const description = cleanText(meta.description, MAX_THEME_DESCRIPTION_LENGTH);
  const id = cleanText(raw.id, 80);
  const appearance = raw.appearance;
  const shared = parseVariant(
    hasOwn(raw, "background") || hasOwn(raw, "tokens")
      ? { background: raw.background, tokens: raw.tokens }
      : undefined,
    "shared",
  );
  const light = parseVariant(raw.light, "light") ?? shared;
  const dark = parseVariant(raw.dark, "dark") ?? shared;
  const colors = parseColors(raw.colors);
  const art = parseArt(raw.art);
  const materials = parseMaterials(raw.materials);
  const image = parseImageName(raw.image);
  const customCss = validateThemeCustomCss(raw.customCss);
  if (description) config.description = description;
  if (id) config.id = id;
  if (appearance === "auto" || appearance === "light" || appearance === "dark") {
    config.appearance = appearance;
  } else if (appearance !== undefined) {
    throw new Error("Invalid theme appearance");
  }
  if (image) config.image = image;
  if (colors) config.colors = colors;
  if (light) config.light = light;
  if (dark) config.dark = dark;
  if (art) config.art = art;
  if (materials) config.materials = materials;
  if (customCss) config.customCss = customCss;
  return config;
}

export function parseThemePackJson(input: string): ThemePack {
  let raw: unknown;
  try {
    raw = JSON.parse(input) as unknown;
  } catch {
    throw new Error("Theme package must be valid JSON");
  }
  return parseThemePack(raw);
}

export function serializeThemePack(pack: ThemePack): string {
  return `${JSON.stringify(pack, null, 2)}\n`;
}

export const EMPTY_THEME_LIBRARY: ThemeLibrarySnapshot = {
  activeId: DEFAULT_THEME_SELECTION.id,
  skins: [],
};

export function isThemePresetId(value: unknown): value is ThemePresetId {
  return typeof value === "string" && (THEME_PRESET_IDS as readonly string[]).includes(value);
}

export function isThemeImagePresetId(value: unknown): value is ThemeImagePresetId {
  return typeof value === "string" && (THEME_IMAGE_PRESET_IDS as readonly string[]).includes(value);
}

function builtinBackgroundUrl(id: string): string | undefined {
  return isThemeImagePresetId(id) ? BUILTIN_THEME_BACKGROUNDS[id] : undefined;
}

function isSelectionId(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9-]{1,96}$/i.test(value);
}

/** Convert persisted v1 selection data into the new id-only theme selection. */
export function normalizeThemeSelection(raw: unknown): ThemeSelection {
  if (!isRecord(raw)) return { ...DEFAULT_THEME_SELECTION };
  if (isSelectionId(raw.id)) {
    return LEGACY_THEME_PRESET_IDS.has(raw.id) ? { ...DEFAULT_THEME_SELECTION } : { id: raw.id };
  }
  if (isThemePresetId(raw.presetId)) return { id: raw.presetId };
  if (typeof raw.presetId === "string" && LEGACY_THEME_PRESET_IDS.has(raw.presetId)) {
    return { ...DEFAULT_THEME_SELECTION };
  }
  return { ...DEFAULT_THEME_SELECTION };
}

export function loadThemeSelection(): ThemeSelection {
  try {
    const raw = localStorage.getItem(THEME_SELECTION_STORAGE_KEY);
    return raw
      ? normalizeThemeSelection(JSON.parse(raw) as unknown)
      : { ...DEFAULT_THEME_SELECTION };
  } catch {
    return { ...DEFAULT_THEME_SELECTION };
  }
}

export function saveThemeSelection(selection: ThemeSelection): ThemeSelection {
  const next = normalizeThemeSelection(selection);
  try {
    localStorage.setItem(THEME_SELECTION_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // LocalStorage is unavailable in a few embedded test surfaces.
  }
  return next;
}

function savedSkinBackgroundUrl(saved: ThemeSkinRecord): string | undefined {
  if (saved.backgroundUrl) return saved.backgroundUrl;
  if (isThemeImagePresetId(saved.backgroundBuiltinId)) {
    return BUILTIN_THEME_BACKGROUNDS[saved.backgroundBuiltinId];
  }
  // Built-in image override without a custom file still uses the factory wallpaper.
  return builtinBackgroundUrl(saved.id);
}

function resolveSkinBackgroundUrl(
  selection: ThemeSelection,
  skins: readonly ThemeSkinRecord[] = [],
): string | undefined {
  const saved = skins.find((skin) => skin.id === selection.id);
  if (saved) return savedSkinBackgroundUrl(saved);
  return builtinBackgroundUrl(selection.id) ?? builtinBackgroundUrl(DEFAULT_THEME_PRESET_ID);
}

export function activeThemePack(
  selection: ThemeSelection,
  skins: readonly ThemeSkinRecord[] = [],
  preview?: ThemePreview,
): ThemePreview {
  if (preview) {
    // Studio always sends an own `backgroundUrl` key. Empty string means the
    // wallpaper was intentionally removed; omitted means inherit the selection.
    if (Object.prototype.hasOwnProperty.call(preview, "backgroundUrl")) {
      return preview.backgroundUrl
        ? { config: preview.config, backgroundUrl: preview.backgroundUrl }
        : { config: preview.config };
    }
    const backgroundUrl = resolveSkinBackgroundUrl(selection, skins);
    return backgroundUrl ? { config: preview.config, backgroundUrl } : { config: preview.config };
  }
  // Prefer an on-disk override (including built-ins saved under their factory id).
  const saved = skins.find((skin) => skin.id === selection.id);
  if (saved) {
    const backgroundUrl = savedSkinBackgroundUrl(saved);
    return {
      config: saved.config,
      ...(backgroundUrl ? { backgroundUrl } : {}),
    };
  }
  if (isThemePresetId(selection.id)) {
    const backgroundUrl = builtinBackgroundUrl(selection.id);
    return {
      config: THEME_PRESETS[selection.id],
      ...(backgroundUrl ? { backgroundUrl } : {}),
    };
  }
  const fallbackBackground = builtinBackgroundUrl(DEFAULT_THEME_PRESET_ID);
  return {
    config: THEME_PRESETS[DEFAULT_THEME_PRESET_ID],
    ...(fallbackBackground ? { backgroundUrl: fallbackBackground } : {}),
  };
}

export function resolveSkinColorMode(
  pack: ThemePack,
  colorMode: ResolvedColorMode,
): ResolvedColorMode {
  if (pack.appearance === "light" || pack.appearance === "dark") return pack.appearance;
  return colorMode;
}

export function resolveThemeVariant(
  pack: ThemePack,
  colorMode: ResolvedColorMode,
): ThemeSkinVariant {
  const mode = resolveSkinColorMode(pack, colorMode);
  return mode === "dark" ? (pack.dark ?? pack.light ?? {}) : (pack.light ?? pack.dark ?? {});
}

export function resolveThemeColors(pack: ThemePack, colorMode: ResolvedColorMode): ThemeSkinColors {
  return { ...pack.colors, ...resolveThemeVariant(pack, colorMode).colors };
}

export function themePreview(
  pack: ThemePack,
  colorMode: ResolvedColorMode,
): {
  background: string;
  backgroundSolid: string;
  surface: string;
  primary: string;
  panelAlt: string;
  text: string;
  muted: string;
  line: string;
  backgroundRgb: string;
  panelRgb: string;
  textRgb: string;
  accentRgb: string;
} {
  const mode = resolveSkinColorMode(pack, colorMode);
  const variant = resolveThemeVariant(pack, colorMode);
  const colors = { ...paletteForMode(mode), ...resolveThemeColors(pack, colorMode) };
  return {
    background: variant.background ?? colors.background,
    backgroundSolid: colors.background,
    surface: colors.panel,
    primary: colors.accent,
    panelAlt: colors.panelAlt,
    text: colors.text,
    muted: colors.muted,
    line: colors.line,
    backgroundRgb: rgbValue(colors.background, mode === "dark" ? "18 18 18" : "247 247 246"),
    panelRgb: rgbValue(colors.panel, mode === "dark" ? "32 32 32" : "255 255 255"),
    textRgb: rgbValue(colors.text, mode === "dark" ? "245 245 245" : "25 25 25"),
    accentRgb: rgbValue(colors.accent, mode === "dark" ? "210 210 210" : "32 32 32"),
  };
}

function paletteForMode(colorMode: ResolvedColorMode): Required<ThemeSkinColors> {
  return colorMode === "dark"
    ? {
        background: "#151515",
        panel: "#202020",
        panelAlt: "#2a2a2a",
        accent: "#d2d2d2",
        accentAlt: "#eeeeee",
        secondary: "#969696",
        highlight: "#b7b7b7",
        text: "#f5f5f5",
        muted: "#a7a7a7",
        line: "rgba(255, 255, 255, 0.16)",
      }
    : {
        background: "#f7f7f6",
        panel: "#ffffff",
        panelAlt: "#efefed",
        accent: "#202020",
        accentAlt: "#454545",
        secondary: "#696969",
        highlight: "#343434",
        text: "#191919",
        muted: "#6d6d6d",
        line: "rgba(24, 24, 24, 0.15)",
      };
}

function colorTokens(colors: ThemeSkinColors): ThemeTokens {
  const tokens: ThemeTokens = {};
  if (colors.background) tokens.background = colors.background;
  if (colors.text) {
    tokens.foreground = colors.text;
    tokens.sidebarForeground = colors.text;
    tokens.userBubbleForeground = colors.text;
  }
  if (colors.panel) {
    tokens.surfacePanel = colors.panel;
    tokens.sidebar = colors.panel;
    tokens.codeBg = colors.panel;
  }
  if (colors.panelAlt) {
    tokens.surfaceMuted = colors.panelAlt;
    tokens.surfaceSoft = colors.panelAlt;
    tokens.userBubble = colors.panelAlt;
    tokens.composerProtrusion = colors.panelAlt;
  }
  if (colors.accent) {
    tokens.primary = colors.accent;
    tokens.sidebarPrimary = colors.accent;
    tokens.ring = colors.accent;
    tokens.switchOn = colors.accent;
  }
  if (colors.text && colors.accent) {
    tokens.primaryForeground = colors.text;
    tokens.sidebarPrimaryForeground = colors.text;
  }
  if (colors.secondary) {
    tokens.secondary = colors.secondary;
    tokens.link = colors.secondary;
  }
  if (colors.muted) {
    tokens.muted = colors.muted;
    tokens.mutedForeground = colors.muted;
  }
  if (colors.line) {
    tokens.border = colors.line;
    tokens.borderSubtle = colors.line;
    tokens.divider = colors.line;
    tokens.input = colors.line;
    tokens.sidebarBorder = colors.line;
    tokens.composerBorder = colors.line;
  }
  return tokens;
}

function rgbValue(color: string, fallback: string): string {
  const hex = color.trim().match(/^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (hex) {
    const compact = hex[1]!.length <= 4;
    const value = compact
      ? hex[1]!
          .slice(0, 3)
          .split("")
          .map((part) => `${part}${part}`)
          .join("")
      : hex[1]!.slice(0, 6);
    const number = Number.parseInt(value, 16);
    return `${number >> 16} ${(number >> 8) & 255} ${number & 255}`;
  }
  const rgb = color.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (rgb)
    return `${Math.round(Number(rgb[1]))} ${Math.round(Number(rgb[2]))} ${Math.round(Number(rgb[3]))}`;
  return fallback;
}

function numberOr(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function shadowValue(shadow: ThemeSkinMaterials["shadow"]): string {
  if (shadow === "none") return "none";
  if (shadow === "strong") return "0 18px 56px rgb(var(--skin-background-rgb) / 0.38)";
  return "0 12px 34px rgb(var(--skin-background-rgb) / 0.26)";
}

function isSafeThemeAssetUrl(value: string | undefined, allowBuiltin = false): value is string {
  if (!value) return false;
  if (allowBuiltin && BUILTIN_BACKGROUND_URLS.has(value)) return true;
  // Bundled assets may arrive with cache-busting query strings after HMR/build.
  if (allowBuiltin) {
    for (const builtin of BUILTIN_BACKGROUND_URLS) {
      if (value === builtin || value.startsWith(`${builtin}?`) || value.startsWith(`${builtin}#`)) {
        return true;
      }
    }
    if (
      /theme-skins\/(?:miku-stage|venom-noir|zhang-ruonan)(?:[-.][\w]+)?\.(?:jpe?g|png|webp)(?:[?#].*)?$/i.test(
        value,
      )
    ) {
      return true;
    }
  }
  try {
    const url = new URL(value, "https://pix.local");
    if (url.protocol === "blob:") return true;
    if (
      url.protocol === "pix-theme:" &&
      (/^skin-[a-f0-9-]{36}$/i.test(url.hostname) || isThemePresetId(url.hostname))
    ) {
      return true;
    }
    // Vite dev / packaged asset URLs for the three built-in wallpapers.
    if (
      allowBuiltin &&
      (url.protocol === "http:" ||
        url.protocol === "https:" ||
        url.protocol === "file:" ||
        url.protocol === "app:" ||
        url.protocol === "atom:" ||
        value.startsWith("/"))
    ) {
      return /theme-skins\/(?:miku-stage|venom-noir|zhang-ruonan)/i.test(url.pathname);
    }
    return false;
  } catch {
    return false;
  }
}

const SKIN_CSS_VARIABLES = [
  "--theme-background",
  "--skin-wallpaper-base",
  "--skin-wallpaper-image",
  "--skin-art-position",
  "--skin-art-size",
  "--skin-wallpaper-dim",
  "--skin-background-rgb",
  "--skin-panel-rgb",
  "--skin-text-rgb",
  "--skin-accent-rgb",
  "--skin-sidebar-opacity",
  "--skin-page-opacity",
  "--skin-panel-opacity",
  "--skin-blur",
  "--skin-radius",
  "--skin-border-alpha",
  "--skin-border-inset-alpha",
  "--skin-shadow",
  "--skin-task-intensity",
] as const;

const CUSTOM_THEME_STYLE_ID = "pix-theme-custom-css";

function applyCustomThemeCss(value: string | undefined): void {
  document.getElementById(CUSTOM_THEME_STYLE_ID)?.remove();
  if (!value) return;
  try {
    const css = scopeThemeCustomCss(value);
    if (!css) return;
    const style = document.createElement("style");
    style.id = CUSTOM_THEME_STYLE_ID;
    style.textContent = css;
    document.head.append(style);
  } catch {
    // Invalid live drafts remain editable without affecting the running interface.
  }
}

/** Apply a complete native skin while leaving agent and typography preferences untouched. */
export function applyThemeSelection(
  selection: ThemeSelection,
  colorMode: ResolvedColorMode,
  skins: readonly ThemeSkinRecord[] = [],
  preview?: ThemePreview,
): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const skin = activeThemePack(selection, skins, preview);
  const pack = skin.config;
  const mode = resolveSkinColorMode(pack, colorMode);
  const variant = resolveThemeVariant(pack, colorMode);
  const colors = { ...paletteForMode(mode), ...resolveThemeColors(pack, colorMode) };
  const materials = { ...MATERIAL_DEFAULTS, ...pack.materials };
  const art = pack.art ?? {};

  root.dataset.themeSkin = selection.id;
  root.dataset.themeSkinActive = "true";
  root.dataset.themeSkinMode = mode;
  root.dataset.theme = mode;
  root.style.colorScheme = mode;
  root.dataset.themeSkinSafeArea = art.safeArea ?? "center";
  for (const cssVariable of Object.values(THEME_TOKEN_CSS_VARIABLES))
    root.style.removeProperty(cssVariable);
  for (const cssVariable of SKIN_CSS_VARIABLES) root.style.removeProperty(cssVariable);
  root.dataset.themeSkinDensity = materials.density;

  const derivedTokens = colorTokens(resolveThemeColors(pack, colorMode));
  const tokens = { ...derivedTokens, ...variant.tokens };
  if (variant.background) root.style.setProperty("--theme-background", variant.background);
  for (const [token, value] of Object.entries(tokens)) {
    const tokenName = themeTokenName(token);
    if (tokenName) root.style.setProperty(THEME_TOKEN_CSS_VARIABLES[tokenName], value);
  }
  root.style.setProperty("--skin-wallpaper-base", variant.background ?? colors.background);
  root.style.setProperty(
    "--skin-wallpaper-image",
    isSafeThemeAssetUrl(skin.backgroundUrl, true)
      ? `url(${JSON.stringify(skin.backgroundUrl)})`
      : "none",
  );
  root.style.setProperty(
    "--skin-art-position",
    `${Math.round(numberOr(art.focusX, ART_DEFAULTS.focusX) * 100)}% ${Math.round(numberOr(art.focusY, ART_DEFAULTS.focusY) * 100)}%`,
  );
  root.style.setProperty(
    "--skin-art-size",
    `${Math.round(numberOr(art.zoom, ART_DEFAULTS.zoom) * 100)}%`,
  );
  root.style.setProperty("--skin-wallpaper-dim", String(numberOr(art.dim, ART_DEFAULTS.dim)));
  root.style.setProperty(
    "--skin-background-rgb",
    rgbValue(colors.background, mode === "dark" ? "18 18 18" : "247 247 246"),
  );
  root.style.setProperty(
    "--skin-panel-rgb",
    rgbValue(colors.panel, mode === "dark" ? "32 32 32" : "255 255 255"),
  );
  root.style.setProperty(
    "--skin-text-rgb",
    rgbValue(colors.text, mode === "dark" ? "245 245 245" : "25 25 25"),
  );
  root.style.setProperty(
    "--skin-accent-rgb",
    rgbValue(colors.accent, mode === "dark" ? "210 210 210" : "32 32 32"),
  );
  root.style.setProperty(
    "--skin-sidebar-opacity",
    String(numberOr(materials.sidebarOpacity, MATERIAL_DEFAULTS.sidebarOpacity)),
  );
  root.style.setProperty(
    "--skin-page-opacity",
    String(numberOr(materials.pageOpacity, MATERIAL_DEFAULTS.pageOpacity)),
  );
  root.style.setProperty(
    "--skin-panel-opacity",
    String(numberOr(materials.panelOpacity, MATERIAL_DEFAULTS.panelOpacity)),
  );
  root.style.setProperty(
    "--skin-blur",
    `${Math.round(numberOr(materials.blur, MATERIAL_DEFAULTS.blur))}px`,
  );
  root.style.setProperty(
    "--skin-radius",
    `${Math.round(numberOr(materials.radius, MATERIAL_DEFAULTS.radius))}px`,
  );
  root.style.setProperty(
    "--skin-border-alpha",
    String(numberOr(materials.borderAlpha, MATERIAL_DEFAULTS.borderAlpha)),
  );
  root.style.setProperty(
    "--skin-border-inset-alpha",
    String(Math.min(1, numberOr(materials.borderAlpha, MATERIAL_DEFAULTS.borderAlpha) * 0.85)),
  );
  root.style.setProperty("--skin-shadow", shadowValue(materials.shadow));
  root.style.setProperty(
    "--skin-task-intensity",
    String(numberOr(art.taskIntensity, ART_DEFAULTS.taskIntensity)),
  );
  applyCustomThemeCss(pack.customCss);
}
