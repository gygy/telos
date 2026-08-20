import { describe, expect, it } from "vite-plus/test";
import { extractSessionImages, extractToolSessionImages } from "../src/session-images.ts";

const PNG_B64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("extractSessionImages", () => {
  it("collects image parts from a content array", () => {
    expect(
      extractSessionImages([
        { type: "text", text: "see this" },
        { type: "image", data: PNG_B64, mimeType: "image/png" },
      ]),
    ).toEqual([
      {
        mimeType: "image/png",
        dataUrl: `data:image/png;base64,${PNG_B64}`,
      },
    ]);
  });

  it("accepts a tool result wrapper and existing data URLs", () => {
    const dataUrl = `data:image/jpeg;base64,${PNG_B64}`;
    expect(
      extractSessionImages({
        content: [{ type: "image", data: dataUrl, mimeType: "image/jpeg" }],
      }),
    ).toEqual([{ mimeType: "image/jpeg", dataUrl }]);
  });

  it("drops non-image payloads and oversize blocks", () => {
    expect(
      extractSessionImages([
        { type: "image", data: PNG_B64, mimeType: "application/octet-stream" },
        { type: "image", data: "not-base64!!!", mimeType: "image/png" },
        { type: "text", text: "ok" },
      ]),
    ).toEqual([]);
  });

  it("projects local image artifacts from image-producing tool metadata", () => {
    expect(
      extractToolSessionImages({
        toolName: "write",
        args: { path: "output/animation.gif" },
        result: { details: { savedPath: "output/animation.gif" } },
      }),
    ).toEqual([{ path: "output/animation.gif", mimeType: "image/gif" }]);
    expect(
      extractToolSessionImages({
        toolName: "edit",
        args: { path: "output/animation.gif" },
      }),
    ).toEqual([]);
    expect(
      extractToolSessionImages({
        toolName: "write",
        args: { path: "output/animation.gif" },
        isError: true,
      }),
    ).toEqual([]);
    expect(
      extractToolSessionImages({
        toolName: "read",
        args: { path: "shot.png" },
        content: [{ type: "image", data: PNG_B64, mimeType: "image/png" }],
      }),
    ).toEqual([]);
  });

  it("prefers structured image bytes over a duplicate artifact path", () => {
    expect(
      extractToolSessionImages({
        toolName: "screenshot",
        args: { path: "shot.png" },
        content: [{ type: "image", data: PNG_B64, mimeType: "image/png" }],
      }),
    ).toEqual([{ mimeType: "image/png", dataUrl: `data:image/png;base64,${PNG_B64}` }]);
  });
});
