import { describe, expect, it } from "vite-plus/test";
import {
  availableThinkingLevelsForModel,
  clampThinkingLevelForModel,
  isThinkingLevel,
} from "../src/thinking-levels.ts";

describe("model thinking levels", () => {
  it("exposes only off for non-reasoning models", () => {
    expect(availableThinkingLevelsForModel(undefined)).toEqual(["off"]);
    expect(availableThinkingLevelsForModel({ reasoning: false })).toEqual(["off"]);
  });

  it("honors model map holes and opt-in extended levels", () => {
    expect(
      availableThinkingLevelsForModel({
        reasoning: true,
        thinkingLevelMap: {
          minimal: null,
          xhigh: null,
          max: "max",
        },
      }),
    ).toEqual(["off", "low", "medium", "high", "max"]);
  });

  it("clamps stored defaults with pi's nearest supported-level rule", () => {
    const model = {
      reasoning: true,
      thinkingLevelMap: { minimal: null, low: null, medium: null, xhigh: null } as const,
    };
    expect(clampThinkingLevelForModel(model, "medium")).toBe("high");
    expect(isThinkingLevel("max")).toBe(true);
    expect(isThinkingLevel("ultra")).toBe(false);
  });
});
