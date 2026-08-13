import { describe, expect, it } from "vite-plus/test";
import {
  clampNumber,
  computeFocusedIndex,
  computeTrailGeometry,
  deriveMessageTrailItems,
} from "./message-trail.ts";
import type { TimelineItem } from "./timeline.ts";

describe("deriveMessageTrailItems", () => {
  it("makes one tick per user message and keeps the last assistant reply", () => {
    const items: TimelineItem[] = [
      { id: "u1", kind: "user", text: "/skill:review 对比插件" },
      { id: "a1", kind: "assistant", text: "先看 A" },
      { id: "a2", kind: "assistant", text: "再看 B" },
      { id: "u2", kind: "user", text: "继续" },
    ];
    expect(deriveMessageTrailItems(items)).toEqual([
      {
        id: "u1",
        ordinal: 1,
        preview: "/skill:review 对比插件",
        responsePreview: "再看 B",
        attachmentCount: 0,
      },
      {
        id: "u2",
        ordinal: 2,
        preview: "继续",
        responsePreview: "",
        attachmentCount: 0,
      },
    ]);
  });
});

describe("trail geometry", () => {
  it("lays ticks out from the count only", () => {
    const geo = computeTrailGeometry({ count: 3, spacingPx: 10, paddingPx: 12 });
    expect(geo?.centerYs).toEqual([12, 22, 32]);
    expect(geo?.contentHeight).toBe(44);
    expect(computeFocusedIndex(22, geo!)).toBe(1);
    expect(clampNumber(9, 0, 4)).toBe(4);
  });
});
