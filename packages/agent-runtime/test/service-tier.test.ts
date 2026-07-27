import { describe, expect, it } from "vite-plus/test";
import {
  applyServiceTierToPayload,
  availableServiceTiersForModel,
  installServiceTierPayloadHook,
  isServiceTier,
  modelSupportsServiceTier,
} from "../src/service-tier.ts";

describe("service-tier", () => {
  it("only enables tiers for OpenAI Responses-family APIs", () => {
    expect(modelSupportsServiceTier({ api: "openai-responses" })).toBe(true);
    expect(modelSupportsServiceTier({ api: "openai-codex-responses" })).toBe(true);
    expect(modelSupportsServiceTier({ api: "azure-openai-responses" })).toBe(true);
    expect(modelSupportsServiceTier({ api: "anthropic-messages" })).toBe(false);
    expect(modelSupportsServiceTier({ api: "openai-completions" })).toBe(false);
    expect(availableServiceTiersForModel({ api: "anthropic-messages" })).toEqual([]);
    expect(availableServiceTiersForModel({ api: "openai-responses" })).toEqual([
      "flex",
      "default",
      "priority",
    ]);
  });

  it("validates tier ids", () => {
    expect(isServiceTier("priority")).toBe(true);
    expect(isServiceTier("fast")).toBe(false);
  });

  it("injects service_tier only for non-default supported models", () => {
    const body = { model: "gpt-5", input: [] };
    expect(applyServiceTierToPayload(body, { api: "openai-responses" }, "priority")).toEqual({
      ...body,
      service_tier: "priority",
    });
    expect(applyServiceTierToPayload(body, { api: "openai-responses" }, "default")).toEqual(body);
    expect(applyServiceTierToPayload(body, { api: "anthropic-messages" }, "priority")).toEqual(
      body,
    );
  });

  it("wires the selected tier into the real provider payload hook", async () => {
    let tier: "priority" | "flex" = "priority";
    const agent = {
      onPayload: (payload: unknown, _model?: unknown) => ({
        ...(payload as object),
        extension_field: true,
      }),
    };
    installServiceTierPayloadHook(agent, () => tier);
    installServiceTierPayloadHook(agent, () => "flex");

    await expect(agent.onPayload({ model: "gpt-5" }, { api: "openai-responses" })).resolves.toEqual(
      { model: "gpt-5", extension_field: true, service_tier: "priority" },
    );

    tier = "flex";
    await expect(
      agent.onPayload({ model: "claude" }, { api: "anthropic-messages" }),
    ).resolves.toEqual({ model: "claude", extension_field: true });
  });
});
