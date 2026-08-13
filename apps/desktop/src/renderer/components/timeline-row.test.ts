import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { TimelineRow } from "./TimelineRow.tsx";
import type { TimelineItem } from "../lib/timeline.ts";

function renderUser(item: Extract<TimelineItem, { kind: "user" }>): string {
  return renderToStaticMarkup(createElement(TimelineRow, { item, locale: "zh" }));
}

describe("TimelineRow user message", () => {
  it("composes the right-aligned message primitives in attachment, bubble, footer order", () => {
    const html = renderUser({
      id: "user-1",
      kind: "user",
      text: "请检查附件",
      attachments: ["/workspace/reference.pdf"],
      timestamp: "2026-07-28T12:00:00.000Z",
    });

    expect(html).toContain('data-slot="message"');
    expect(html).toContain('data-align="end"');
    expect(html).toContain('data-variant="secondary"');

    const attachment = html.indexOf('data-slot="attachment-group"');
    const bubble = html.indexOf('data-slot="bubble"');
    const footer = html.indexOf('data-slot="message-footer"');
    expect(attachment).toBeGreaterThan(-1);
    expect(attachment).toBeLessThan(bubble);
    expect(bubble).toBeLessThan(footer);
  });

  it("renders expanded skill blocks as a compact chip plus the user remainder", () => {
    const html = renderUser({
      id: "user-skill",
      kind: "user",
      text: [
        '<skill name="review" location="/tmp/skills/review/SKILL.md">',
        "References are relative to /tmp/skills/review.",
        "",
        "# Review",
        "Read the entire SKILL.md body.",
        "</skill>",
        "",
        "please inspect @src/app.ts",
      ].join("\n"),
    });

    expect(html).toContain('data-slot="prompt-token"');
    expect(html).toContain('data-kind="skill"');
    expect(html).toContain("review");
    expect(html).toContain("please inspect");
    expect(html).toContain("app.ts");
    expect(html).not.toContain("Read the entire SKILL.md body.");
    expect(html).not.toContain("&lt;skill");
  });

  it("keeps image attachment names accessible without rendering a visible title", () => {
    const html = renderUser({
      id: "user-image",
      kind: "user",
      text: "",
      attachments: ["/workspace/design.png"],
    });

    expect(html).toContain('aria-label="design.png"');
    expect(html).toContain('data-kind="image"');
    expect(html).not.toContain('data-slot="attachment-title"');
  });
});
