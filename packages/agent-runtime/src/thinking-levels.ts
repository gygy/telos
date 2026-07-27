/** Model-specific pi thinking levels, matching pi-ai getSupportedThinkingLevels. */

export const THINKING_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"] as const;

export type ThinkingLevel = (typeof THINKING_LEVELS)[number];

export type ThinkingLevelModel = {
  reasoning?: boolean;
  thinkingLevelMap?: Partial<Record<ThinkingLevel, string | null>>;
};

export function isThinkingLevel(value: string): value is ThinkingLevel {
  return (THINKING_LEVELS as readonly string[]).includes(value);
}

/** Extended levels are opt-in; null explicitly removes any level from the model UI. */
export function availableThinkingLevelsForModel(
  model: ThinkingLevelModel | undefined,
): ThinkingLevel[] {
  if (!model?.reasoning) return ["off"];
  return THINKING_LEVELS.filter((level) => {
    const mapped = model.thinkingLevelMap?.[level];
    if (mapped === null) return false;
    if (level === "xhigh" || level === "max") return mapped !== undefined;
    return true;
  });
}

/** Use pi's nearest-level rule when a stored global default is unsupported by a model. */
export function clampThinkingLevelForModel(
  model: ThinkingLevelModel | undefined,
  level: ThinkingLevel,
): ThinkingLevel {
  const available = availableThinkingLevelsForModel(model);
  if (available.includes(level)) return level;
  const requestedIndex = THINKING_LEVELS.indexOf(level);
  for (let index = requestedIndex; index < THINKING_LEVELS.length; index += 1) {
    const candidate = THINKING_LEVELS[index];
    if (candidate && available.includes(candidate)) return candidate;
  }
  for (let index = requestedIndex - 1; index >= 0; index -= 1) {
    const candidate = THINKING_LEVELS[index];
    if (candidate && available.includes(candidate)) return candidate;
  }
  return available[0] ?? "off";
}
