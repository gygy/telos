import { describe, expect, it } from "vite-plus/test";
import {
  attachmentPresentation,
  SUPPORTED_ATTACHMENT_EXTENSIONS,
} from "./lib/composer-suggestions.ts";
import {
  DEMO_USER_ATTACHMENT_PATHS,
  scenarioUserAttachments,
} from "./session-content-demo-fixtures.ts";

describe("session content demo attachment coverage", () => {
  it("includes every recognized extension plus folder and generic fallbacks", () => {
    expect(DEMO_USER_ATTACHMENT_PATHS).toHaveLength(SUPPORTED_ATTACHMENT_EXTENSIONS.length + 2);

    const presentations = DEMO_USER_ATTACHMENT_PATHS.map(attachmentPresentation);
    expect(presentations.some((item) => item.kind === "folder")).toBe(true);
    expect(presentations.some((item) => item.kind === "file")).toBe(true);

    for (const extension of SUPPORTED_ATTACHMENT_EXTENSIONS) {
      expect(DEMO_USER_ATTACHMENT_PATHS).toContainEqual(
        expect.stringMatching(new RegExp(`\\.${extension}$`, "i")),
      );
    }
  });

  it("feeds the full attachment set through a real user timeline item", () => {
    const userItem = scenarioUserAttachments().items.find((item) => item.kind === "user");
    expect(userItem?.kind).toBe("user");
    if (userItem?.kind !== "user") throw new Error("User attachment fixture is missing");
    expect(userItem.attachments).toEqual(DEMO_USER_ATTACHMENT_PATHS);
  });
});
