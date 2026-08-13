import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { PromptTokenChip, renderHighlightSpans, UserMessageText } from "./PromptTokenChip.tsx";
import { COMPOSER_CHIP_ICON_SLOT, tokenizeComposerHighlight } from "../lib/composer-highlight.ts";

describe("PromptTokenChip overlay", () => {
  it("paints the raw token glyphs so caret metrics stay locked to the textarea", () => {
    const html = renderToStaticMarkup(
      createElement(PromptTokenChip, {
        kind: "skill",
        text: "/skill:review",
        label: "review",
        overlay: true,
      }),
    );
    expect(html).toContain("/skill:review");
    expect(html).toContain('data-overlay="true"');
    expect(html).toContain("composer-hl-token");
    expect(html).not.toContain("lucide");
    expect(html).not.toContain("composer-hl-chip-face");
  });

  it("paints the chip icon in the overlay when the textarea reserved the icon slot", () => {
    const html = renderToStaticMarkup(
      createElement(PromptTokenChip, {
        kind: "skill",
        text: `${COMPOSER_CHIP_ICON_SLOT} Open Kimi Ppt`,
        label: "Open Kimi Ppt",
        overlay: true,
      }),
    );
    expect(html).toContain("composer-hl-token-icon");
    expect(html).toContain("prompt-token-chip-overlay");
    expect(html).toContain("lucide");
    expect(html).toContain("Open Kimi Ppt");
    expect(html).not.toContain(COMPOSER_CHIP_ICON_SLOT);
  });

  it("keeps compact icon chips only in sent user messages", () => {
    const html = renderToStaticMarkup(
      createElement(PromptTokenChip, {
        kind: "skill",
        text: "/skill:review",
        label: "review",
        locale: "zh",
      }),
    );
    expect(html).toContain('data-slot="prompt-token"');
    expect(html).toContain('class="prompt-token-chip-label">Review<');
    expect(html).not.toContain('data-overlay="true"');
  });

  it("renders overlay spans as the original prompt text", () => {
    const spans = tokenizeComposerHighlight("/skill:review please @src/app.ts");
    const html = renderToStaticMarkup(
      createElement("div", null, renderHighlightSpans(spans, { overlay: true })),
    );
    expect(html).toContain("/skill:review");
    expect(html).toContain(" please ");
    expect(html).toContain("@src/app.ts");
  });

  it("renders sent tokens inline with the sentence, not as a chip row", () => {
    const html = renderToStaticMarkup(
      createElement(UserMessageText, {
        text: "对比几个插件 @npm:pix-tools",
        locale: "zh",
      }),
    );
    expect(html).toContain("对比几个插件");
    expect(html).toContain('class="prompt-token-chip-label">Pix Tools<');
    expect(html).not.toContain("user-message-refs");
    expect(html).not.toContain("composer-ref-chip-remove");
  });
});
