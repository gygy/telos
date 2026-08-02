import { beforeEach, describe, expect, it } from "vite-plus/test";
import type { ThemeSkinRecord } from "@pix/contracts";
import {
  activeThemePack,
  applyThemeSelection,
  ART_DEFAULTS,
  BUILTIN_THEME_BACKGROUNDS,
  createThemeSkinDraft,
  DEFAULT_THEME_SELECTION,
  loadThemeSelection,
  MATERIAL_DEFAULTS,
  parseThemePackJson,
  resolveSkinColorMode,
  resolveThemeVariant,
  saveThemeSelection,
  THEME_IMAGE_PRESET_IDS,
  THEME_PRESETS,
} from "./theme-packs.ts";

describe("theme-packs", () => {
  let storage: Map<string, string>;
  let styles: Map<string, string>;
  let dataset: Record<string, string>;
  let customStyle: { id: string; textContent: string; remove: () => void } | undefined;

  beforeEach(() => {
    storage = new Map<string, string>();
    styles = new Map<string, string>();
    dataset = {};
    customStyle = undefined;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => storage.set(key, String(value)),
      },
    });
    Object.defineProperty(globalThis, "document", {
      configurable: true,
      value: {
        getElementById: (id: string) => (customStyle?.id === id ? customStyle : undefined),
        createElement: () => {
          const node = {
            id: "",
            textContent: "",
            remove: () => {
              customStyle = undefined;
            },
          };
          return node;
        },
        head: {
          append: (node: typeof customStyle) => {
            customStyle = node;
          },
        },
        documentElement: {
          dataset,
          style: {
            setProperty: (key: string, value: string) => styles.set(key, value),
            removeProperty: (key: string) => styles.delete(key),
          },
        },
      },
    });
  });

  it("maps a Dream Skin-style theme document into a native Pix skin", () => {
    const pack = parseThemePackJson(
      JSON.stringify({
        schemaVersion: 1,
        name: "Moon room",
        appearance: "dark",
        image: "background.webp",
        colors: { panel: "#101820", accent: "#54d4ca", text: "#e8ffff" },
        art: { focusX: 0.72, safeArea: "left", taskIntensity: 0.7 },
        materials: { blur: 20, panelOpacity: 0.8 },
        customCss: ".composer-card { border-radius: 24px; }",
      }),
    );

    expect(pack.name).toBe("Moon room");
    expect(pack.image).toBe("background.webp");
    expect(pack.colors?.accent).toBe("#54d4ca");
    expect(pack.art?.safeArea).toBe("left");
    expect(pack.customCss).toContain(".composer-card");
    expect(resolveThemeVariant(pack, "light")).toEqual({});
  });

  it("keeps Pix's original light/dark token packs compatible", () => {
    const pack = parseThemePackJson(
      '{"meta":{"name":"Dual"},"light":{"tokens":{"primary":"#0f766e"}},"dark":{"tokens":{"primary":"#f1ae80"}}}',
    );

    expect(resolveThemeVariant(pack, "light").tokens?.primary).toBe("#0f766e");
    expect(resolveThemeVariant(pack, "dark").tokens?.primary).toBe("#f1ae80");
  });

  it("starts new themes with neutral, readable glass defaults", () => {
    const draft = createThemeSkinDraft("Aurora");

    expect(draft.description).toBeUndefined();
    expect(draft.light?.background).toBe("linear-gradient(135deg, #f4f8ff 0%, #e7effa 100%)");
    expect(draft.dark?.background).toBe("linear-gradient(135deg, #1f1f1f 0%, #252525 100%)");
    expect(draft.light?.colors?.accent).toBe("#379cfc");
    expect(draft.dark?.colors?.accent).toBe("#379cfc");
    expect(draft.light?.colors?.secondary).toBe("#379cfc");
    expect(draft.materials).toMatchObject({
      sidebarOpacity: 0.64,
      pageOpacity: 0.35,
      blur: 0,
      panelOpacity: 0.74,
      radius: 20,
      borderAlpha: 0.3,
      shadow: "strong",
    });
    expect(draft.art).toMatchObject({
      focusX: 0.5,
      focusY: 0.5,
      zoom: 1,
      dim: 0.1,
      safeArea: "center",
      taskIntensity: 0.78,
    });
  });

  it("ships classic defaults and image presets with adaptive palettes", () => {
    expect(THEME_PRESETS["classic-light"].appearance).toBe("light");
    expect(THEME_PRESETS["classic-dark"].appearance).toBe("dark");
    expect(THEME_PRESETS["classic-light"].light?.tokens?.background).toBe("#ffffff");
    expect(THEME_PRESETS["classic-dark"].dark?.tokens?.background).toBe("#191919");
    expect(THEME_PRESETS["classic-light"].materials?.pageOpacity).toBe(1);
    expect(THEME_PRESETS["classic-dark"].materials?.blur).toBe(0);

    for (const id of THEME_IMAGE_PRESET_IDS) {
      expect(THEME_PRESETS[id].appearance).toBe("auto");
      expect(THEME_PRESETS[id].light?.colors?.text).toBeTruthy();
      expect(THEME_PRESETS[id].dark?.colors?.text).toBeTruthy();
      expect(BUILTIN_THEME_BACKGROUNDS[id]).toMatch(/\.jpg$/);
      expect(THEME_PRESETS[id].art).toMatchObject(ART_DEFAULTS);
      expect(THEME_PRESETS[id].materials).toMatchObject(MATERIAL_DEFAULTS);
    }
  });

  it("rejects remote images, unsafe CSS, and unsupported token names", () => {
    expect(() => parseThemePackJson('{"image":"https://example.com/skin.png"}')).toThrow("image");
    expect(() => parseThemePackJson('{"background":"url(https://example.com/skin.png)"}')).toThrow(
      "background",
    );
    expect(() => parseThemePackJson('{"tokens":{"--not-a-pix-token":"#fff"}}')).toThrow(
      "Unsupported theme token",
    );
    expect(() =>
      parseThemePackJson(
        '{"customCss":".composer-card { background-image: url(https://example.com/a.png); }"}',
      ),
    ).toThrow("external resources");
  });

  it("persists only the active skin id and migrates an old preset selection", () => {
    expect(saveThemeSelection({ id: "skin-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" })).toEqual({
      id: "skin-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    });
    expect(loadThemeSelection()).toEqual({ id: "skin-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" });

    storage.set("pix.theme.selection.v2", JSON.stringify({ presetId: "lagoon" }));
    expect(loadThemeSelection()).toEqual(DEFAULT_THEME_SELECTION);
  });

  it("applies saved and built-in wallpaper skins as native materials", () => {
    const skin: ThemeSkinRecord = {
      id: "skin-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      backgroundUrl: "pix-theme://skin-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/background?v=1",
      config: {
        schemaVersion: 1,
        name: "Glass room",
        appearance: "dark",
        colors: { background: "#102030", panel: "#203040", accent: "#4fd1c5", text: "#f0ffff" },
        art: { focusX: 0.7, zoom: 1.1, taskIntensity: 0.76 },
        materials: { blur: 24, panelOpacity: 0.8, density: "compact" },
        customCss: ".composer-card { border-radius: 25px; }",
      },
    };

    applyThemeSelection({ id: skin.id }, "dark", [skin]);
    expect(dataset.themeSkin).toBe(skin.id);
    expect(dataset.themeSkinActive).toBe("true");
    expect(styles.get("--skin-wallpaper-image")).toContain("pix-theme://");
    expect(styles.get("--skin-blur")).toBe("24px");
    expect(styles.get("--primary")).toBe("#4fd1c5");
    expect(dataset.themeSkinDensity).toBe("compact");
    expect(dataset.theme).toBe("dark");
    expect(customStyle?.textContent).toContain(
      'html[data-theme-skin-active="true"] .composer-card',
    );

    applyThemeSelection(DEFAULT_THEME_SELECTION, "light");
    expect(dataset.themeSkin).toBe("miku-stage");
    expect(dataset.themeSkinActive).toBe("true");
    expect(styles.get("--skin-wallpaper-image")).toContain("miku-stage.jpg");
    expect(styles.get("--primary")).toBe("#169ba8");
    expect(dataset.themeSkinDensity).toBe("standard");
    expect(customStyle).toBeUndefined();
  });

  it("applies legacy CSS-variable token aliases without exposing arbitrary variables", () => {
    applyThemeSelection({ id: "skin-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" }, "light", [
      {
        id: "skin-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
        config: {
          schemaVersion: 1,
          name: "Alias",
          light: { tokens: { "--primary": "#158b83" } },
        },
      },
    ]);

    expect(styles.get("--primary")).toBe("#158b83");
    expect(styles.get("undefined")).toBeUndefined();
  });

  it("resolves built-ins and a saved library record without leaking unknown ids", () => {
    expect(activeThemePack({ id: "classic-light" })).toEqual({
      config: THEME_PRESETS["classic-light"],
    });
    expect(activeThemePack({ id: "classic-dark" })).toEqual({
      config: THEME_PRESETS["classic-dark"],
    });
    for (const id of THEME_IMAGE_PRESET_IDS) {
      expect(activeThemePack({ id })).toEqual({
        config: THEME_PRESETS[id],
        backgroundUrl: BUILTIN_THEME_BACKGROUNDS[id],
      });
    }
    expect(activeThemePack({ id: "unknown" })).toEqual({
      config: THEME_PRESETS["miku-stage"],
      backgroundUrl: BUILTIN_THEME_BACKGROUNDS["miku-stage"],
    });
  });

  it("forces classic light/dark appearance regardless of shell color mode", () => {
    expect(resolveSkinColorMode(THEME_PRESETS["classic-light"], "dark")).toBe("light");
    expect(resolveSkinColorMode(THEME_PRESETS["classic-dark"], "light")).toBe("dark");
  });

  it("applies classic tokens without a wallpaper image", () => {
    applyThemeSelection({ id: "classic-light" }, "dark");
    expect(dataset.themeSkin).toBe("classic-light");
    expect(dataset.theme).toBe("light");
    expect(styles.get("--skin-wallpaper-image")).toBe("none");
    expect(styles.get("--background")).toBe("#ffffff");
    expect(styles.get("--primary")).toBe("#171717");
    expect(styles.get("--skin-page-opacity")).toBe("1");

    applyThemeSelection({ id: "classic-dark" }, "light");
    expect(dataset.themeSkin).toBe("classic-dark");
    expect(dataset.theme).toBe("dark");
    expect(styles.get("--skin-wallpaper-image")).toBe("none");
    expect(styles.get("--background")).toBe("#191919");
    expect(styles.get("--link")).toBe("#379cfc");
    expect(styles.get("--skin-blur")).toBe("0px");
  });

  it("keeps the selected bundled wallpaper for an editable built-in copy", () => {
    const copied: ThemeSkinRecord = {
      id: "skin-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      backgroundBuiltinId: "venom-noir",
      config: { schemaVersion: 1, name: "毒液 · 我的暗影" },
    };

    expect(activeThemePack({ id: copied.id }, [copied])).toEqual({
      config: copied.config,
      backgroundUrl: BUILTIN_THEME_BACKGROUNDS["venom-noir"],
    });
  });

  it("prefers an in-place built-in override over the factory preset", () => {
    const override: ThemeSkinRecord = {
      id: "zhang-ruonan",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
      backgroundBuiltinId: "zhang-ruonan",
      config: {
        schemaVersion: 1,
        id: "zhang-ruonan",
        name: "章若楠 · 我的映画",
        light: { colors: { accent: "#112233" } },
      },
    };

    expect(activeThemePack({ id: "zhang-ruonan" }, [override])).toEqual({
      config: override.config,
      backgroundUrl: BUILTIN_THEME_BACKGROUNDS["zhang-ruonan"],
    });
  });

  it("keeps the active wallpaper when a live color preview omits backgroundUrl", () => {
    const preview = activeThemePack({ id: "zhang-ruonan" }, [], {
      config: {
        ...THEME_PRESETS["zhang-ruonan"],
        light: {
          ...THEME_PRESETS["zhang-ruonan"].light,
          colors: {
            ...THEME_PRESETS["zhang-ruonan"].light?.colors,
            accent: "#ff0000",
          },
        },
      },
    });

    expect(preview.backgroundUrl).toBe(BUILTIN_THEME_BACKGROUNDS["zhang-ruonan"]);
    expect(preview.config.light?.colors?.accent).toBe("#ff0000");
  });

  it("allows an explicit empty backgroundUrl to clear the wallpaper in studio", () => {
    const preview = activeThemePack({ id: "zhang-ruonan" }, [], {
      config: THEME_PRESETS["zhang-ruonan"],
      backgroundUrl: "",
    });

    expect(preview.backgroundUrl).toBeUndefined();
  });
});
