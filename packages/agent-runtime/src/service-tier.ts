/**
 * OpenAI Responses / Codex / Azure Responses `service_tier` — the only
 * first-class "speed/priority" control in pi-ai. Not a universal model field.
 *
 * - flex: lower cost, may be slower
 * - default: provider default
 * - priority: lower latency, higher cost
 *
 * Anthropic and most other providers have no equivalent in current pi-ai SimpleStream.
 */

export type ServiceTier = "flex" | "default" | "priority";

export const SERVICE_TIERS: readonly ServiceTier[] = ["flex", "default", "priority"];

const SERVICE_TIER_APIS = new Set([
  "openai-responses",
  "openai-codex-responses",
  "azure-openai-responses",
]);

export function isServiceTier(value: string): value is ServiceTier {
  return (SERVICE_TIERS as readonly string[]).includes(value);
}

/** True when this model API can accept OpenAI-style service_tier on the request body. */
export function modelSupportsServiceTier(model: { api?: string } | undefined): boolean {
  const api = model?.api?.trim();
  return Boolean(api && SERVICE_TIER_APIS.has(api));
}

export function availableServiceTiersForModel(model: { api?: string } | undefined): ServiceTier[] {
  return modelSupportsServiceTier(model) ? [...SERVICE_TIERS] : [];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

type ServiceTierPayloadAgent = {
  onPayload?: (payload: unknown, model: unknown) => unknown;
};

const hookedAgents = new WeakSet<object>();

/** Install the request-body hook once while preserving any SDK/extension payload hook. */
export function installServiceTierPayloadHook(agent: unknown, getTier: () => ServiceTier): void {
  if (!agent || typeof agent !== "object") return;
  if (hookedAgents.has(agent)) return;
  hookedAgents.add(agent);
  const target = agent as ServiceTierPayloadAgent;
  const previous = target.onPayload;
  target.onPayload = async (payload, model) => {
    const transformed = previous ? await previous(payload, model) : payload;
    return applyServiceTierToPayload(
      transformed === undefined ? payload : transformed,
      model as { api?: string } | undefined,
      getTier(),
    );
  };
}

/**
 * Inject service_tier into an OpenAI Responses-style request payload.
 * Used from agent.onPayload so streamSimple paths still apply it.
 */
export function applyServiceTierToPayload(
  payload: unknown,
  model: { api?: string } | undefined,
  tier: ServiceTier | undefined,
): unknown {
  if (!tier || tier === "default") return payload;
  if (!modelSupportsServiceTier(model)) return payload;
  if (!isRecord(payload)) return payload;
  return { ...payload, service_tier: tier };
}
