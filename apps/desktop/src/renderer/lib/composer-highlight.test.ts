import { describe, expect, it } from "vite-plus/test";
import {
  addComposerRef,
  chipRangeAtCaret,
  chipRangeEndingAt,
  compactUserMessageText,
  COMPOSER_CHIP_ICON_SLOT,
  composerChipInsertText,
  composerHighlightClass,
  detectChipTrigger,
  composerRefDisplayLabel,
  composerTokenLabel,
  findComposerChipRanges,
  highlightComposerPrompt,
  isComposerRefCommand,
  looksLikePackageSource,
  parseSkillBlock,
  pruneComposerRefs,
  removeComposerChip,
  serializeComposerRefs,
  urlChipLabel,
  userMessageHighlightSpans,
  tokenizeComposerHighlight,
} from "./composer-highlight.ts";

describe("tokenizeComposerHighlight", () => {
  it("returns empty text span for empty input", () => {
    expect(tokenizeComposerHighlight("")).toEqual([{ kind: "text", text: "" }]);
  });

  it("highlights urls, mentions, slash commands, and skills", () => {
    const spans = tokenizeComposerHighlight(
      "see https://example.com/docs and @src/app.ts then /model and /skill:review please",
    );
    expect(spans).toEqual([
      { kind: "text", text: "see " },
      { kind: "url", text: "https://example.com/docs" },
      { kind: "text", text: " and " },
      { kind: "mention", text: "@src/app.ts", label: "app.ts" },
      { kind: "text", text: " then " },
      { kind: "slash", text: "/model", label: "model" },
      { kind: "text", text: " and " },
      { kind: "skill", text: "/skill:review", label: "review" },
      { kind: "text", text: " please" },
    ]);
  });

  it("classifies packages, prompts, and extensions from catalogs", () => {
    const spans = tokenizeComposerHighlight("/review then @npm:pix-tools and /ext-ui", {
      promptNames: ["review"],
      extensionNames: ["ext-ui"],
      packageSources: ["npm:pix-tools"],
    });
    expect(spans).toEqual([
      { kind: "prompt", text: "/review", label: "review" },
      { kind: "text", text: " then " },
      { kind: "package", text: "@npm:pix-tools", label: "pix-tools" },
      { kind: "text", text: " and " },
      { kind: "extension", text: "/ext-ui", label: "ext-ui" },
    ]);
  });

  it("treats npm:/github: mentions as plugins without a catalog", () => {
    expect(tokenizeComposerHighlight("use @github:acme/tools")).toEqual([
      { kind: "text", text: "use " },
      { kind: "package", text: "@github:acme/tools", label: "tools" },
    ]);
  });

  it("strips trailing sentence punctuation from urls", () => {
    expect(tokenizeComposerHighlight("open https://x.test/a.")).toEqual([
      { kind: "text", text: "open " },
      { kind: "url", text: "https://x.test/a" },
      { kind: "text", text: "." },
    ]);
  });

  it("highlights shell injection lines", () => {
    expect(tokenizeComposerHighlight("!ls -la\nthen text")).toEqual([
      { kind: "shell", text: "!ls -la", label: "ls -la" },
      { kind: "text", text: "\nthen text" },
    ]);
    expect(tokenizeComposerHighlight("!!secret")).toEqual([
      { kind: "shell", text: "!!secret", label: "secret" },
    ]);
    // `!=` is not shell injection.
    expect(tokenizeComposerHighlight("a != b")).toEqual([{ kind: "text", text: "a != b" }]);
  });

  it("does not treat mid-word slashes as commands", () => {
    expect(tokenizeComposerHighlight("path/to/file and /reload")).toEqual([
      { kind: "text", text: "path/to/file and " },
      { kind: "slash", text: "/reload", label: "reload" },
    ]);
  });

  it("maps kinds to css classes", () => {
    expect(composerHighlightClass("text")).toBe("composer-hl-text");
    expect(composerHighlightClass("skill")).toBe("composer-hl-skill");
    expect(composerHighlightClass("url")).toBe("composer-hl-url");
    expect(composerHighlightClass("package")).toBe("composer-hl-package");
    expect(composerHighlightClass("prompt")).toBe("composer-hl-prompt");
  });
});

describe("chip labels", () => {
  it("prefers a compact name over the raw token", () => {
    expect(composerTokenLabel({ kind: "skill", text: "/skill:review", label: "review" })).toBe(
      "review",
    );
    expect(composerTokenLabel({ kind: "mention", text: "@src/lib/a.ts" })).toBe("a.ts");
  });

  it("shortens url chips for message display without changing the raw token", () => {
    expect(urlChipLabel("https://example.com/docs")).toBe("example.com/docs");
    expect(composerTokenLabel({ kind: "url", text: "https://example.com/docs" })).toBe(
      "example.com/docs",
    );
  });

  it("detects package-like sources", () => {
    expect(looksLikePackageSource("npm:@acme/pkg")).toBe(true);
    expect(looksLikePackageSource("github:acme/tools")).toBe(true);
    expect(looksLikePackageSource("src/app.ts")).toBe(false);
  });
});

describe("composer ref chips", () => {
  it("inserts a space between the icon slot and the chip label", () => {
    expect(composerChipInsertText("Open Kimi Ppt")).toBe(
      `${COMPOSER_CHIP_ICON_SLOT} Open Kimi Ppt `,
    );
  });

  it("title-cases skill and package names for the chip face", () => {
    expect(composerRefDisplayLabel("skill:open-kimi-ppt")).toBe("Open Kimi Ppt");
    expect(composerRefDisplayLabel("/skill:review")).toBe("Review");
    expect(composerRefDisplayLabel("@npm:pix-tools")).toBe("Pix Tools");
  });

  it("treats skills, prompts, and extensions as chip refs — not builtins", () => {
    expect(isComposerRefCommand({ source: "skill", name: "skill:review" })).toBe(true);
    expect(isComposerRefCommand({ source: "prompt", name: "review" })).toBe(true);
    expect(isComposerRefCommand({ source: "builtin", name: "model" })).toBe(false);
  });

  it("serializes skills ahead of the user sentence so pi can expand them", () => {
    expect(
      serializeComposerRefs(
        [
          { kind: "skill", raw: "/skill:review", label: "Review" },
          { kind: "package", raw: "@npm:pix-tools", label: "Pix Tools" },
        ],
        "Review 对比几个插件 Pix Tools",
      ),
    ).toBe("/skill:review 对比几个插件 @npm:pix-tools");
  });

  it("keeps sent refs in the sentence instead of peeling them out", () => {
    const spans = userMessageHighlightSpans("对比几个插件 @npm:pix-tools");
    expect(spans.map((item) => item.kind)).toEqual(["text", "package"]);
    expect(spans.map((item) => item.text).join("")).toBe("对比几个插件 @npm:pix-tools");
  });

  it("paints picked display names in the composer overlay", () => {
    const spans = highlightComposerPrompt("对比几个插件 Open Kimi Ppt", undefined, [
      { kind: "skill", raw: "/skill:open-kimi-ppt", label: "Open Kimi Ppt" },
    ]);
    expect(spans).toEqual([
      { kind: "text", text: "对比几个插件 " },
      { kind: "skill", text: "Open Kimi Ppt", label: "Open Kimi Ppt" },
    ]);
  });

  it("treats icon slot + label as one chip range for caret skipping", () => {
    const inserted = composerChipInsertText("Open Kimi Ppt");
    const token = { kind: "skill" as const, raw: "/skill:open-kimi-ppt", label: "Open Kimi Ppt" };
    const ranges = findComposerChipRanges(inserted, [token]);
    expect(ranges).toEqual([
      { start: 0, end: COMPOSER_CHIP_ICON_SLOT.length + 1 + token.label.length, token },
    ]);
    expect(chipRangeAtCaret(ranges, 2)?.token.label).toBe("Open Kimi Ppt");
    expect(chipRangeEndingAt(ranges, ranges[0]!.end)?.token.label).toBe("Open Kimi Ppt");
    expect(removeComposerChip(inserted, ranges[0]!)).toEqual({ text: " ", cursor: 0 });
  });

  it("reopens / and @ menus from a chip when the trailing space is gone", () => {
    const skill = { kind: "skill" as const, raw: "/skill:open-kimi-ppt", label: "Open Kimi Ppt" };
    const skillText = composerChipInsertText(skill.label).trimEnd();
    expect(detectChipTrigger(skillText, skillText.length, [skill])).toEqual({
      kind: "slash",
      query: "skill:open-kimi-ppt",
      rangeStart: 0,
      rangeEnd: skillText.length,
    });
    const plugin = { kind: "package" as const, raw: "@npm:pix-tools", label: "Pix Tools" };
    const pluginText = composerChipInsertText(plugin.label).trimEnd();
    expect(detectChipTrigger(pluginText, pluginText.length, [plugin])).toEqual({
      kind: "mention",
      query: "npm:pix-tools",
      rangeStart: 0,
      rangeEnd: pluginText.length,
    });
    expect(detectChipTrigger(`${skillText} `, `${skillText} `.length, [skill])).toBeNull();
  });

  it("keeps the icon slot on a picked chip so the overlay can paint the glyph", () => {
    const inserted = `对比几个插件 ${composerChipInsertText("Open Kimi Ppt")}`.trimEnd();
    const spans = highlightComposerPrompt(inserted, undefined, [
      { kind: "skill", raw: "/skill:open-kimi-ppt", label: "Open Kimi Ppt" },
    ]);
    expect(spans).toEqual([
      { kind: "text", text: "对比几个插件 " },
      {
        kind: "skill",
        text: `${COMPOSER_CHIP_ICON_SLOT} Open Kimi Ppt`,
        label: "Open Kimi Ppt",
      },
    ]);
  });

  it("drops a ref when its label is edited out of the prompt", () => {
    const tokens = [{ kind: "skill" as const, raw: "/skill:review", label: "Review" }];
    expect(pruneComposerRefs(tokens, "Review 对比")).toBe(tokens);
    expect(pruneComposerRefs(tokens, "对比")).toEqual([]);
  });

  it("does not duplicate the same ref", () => {
    const first = addComposerRef([], { kind: "skill", raw: "/skill:review", label: "Review" });
    expect(addComposerRef(first, { kind: "skill", raw: "/skill:review", label: "Review" })).toEqual(
      first,
    );
  });
});

describe("parseSkillBlock", () => {
  const expanded = [
    '<skill name="review" location="/tmp/skills/review/SKILL.md">',
    "References are relative to /tmp/skills/review.",
    "",
    "# Review",
    "Read the diff carefully.",
    "</skill>",
    "",
    "please inspect src/app.ts",
  ].join("\n");

  it("splits the expanded skill body from the user remainder", () => {
    expect(parseSkillBlock(expanded)).toEqual({
      name: "review",
      location: "/tmp/skills/review/SKILL.md",
      content:
        "References are relative to /tmp/skills/review.\n\n# Review\nRead the diff carefully.",
      userMessage: "please inspect src/app.ts",
    });
  });

  it("compacts expanded skills back to /skill:name plus the user text", () => {
    expect(compactUserMessageText(expanded)).toBe("/skill:review please inspect src/app.ts");
    expect(compactUserMessageText("/skill:review please")).toBe("/skill:review please");
    expect(
      compactUserMessageText('<skill name="demo" location="/x/SKILL.md">\nbody\n</skill>'),
    ).toBe("/skill:demo");
  });

  it("returns null for ordinary user text", () => {
    expect(parseSkillBlock("hello")).toBeNull();
  });
});
