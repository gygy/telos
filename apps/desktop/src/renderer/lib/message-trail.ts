/**
 * Left-gutter message trail: one tick per sent user message + hover preview.
 * Geometry/magnification math copied from Synara messageTrail.logic.
 */
import { compactUserMessageText } from "./composer-highlight.ts";
import type { TimelineItem } from "./timeline.ts";

export interface MessageTrailItem {
  id: string;
  ordinal: number;
  preview: string;
  responsePreview: string;
  attachmentCount: number;
}

const MAX_PREVIEW_LENGTH = 280;

function normalizePreview(text: string): string {
  const collapsed = text.replace(/\s+/g, " ").trim();
  return collapsed.length > MAX_PREVIEW_LENGTH
    ? `${collapsed.slice(0, MAX_PREVIEW_LENGTH).trimEnd()}…`
    : collapsed;
}

export function deriveMessageTrailItems(items: readonly TimelineItem[]): MessageTrailItem[] {
  const trail: MessageTrailItem[] = [];
  let currentTurnIndex = -1;
  for (const item of items) {
    if (item.kind === "user") {
      trail.push({
        id: item.id,
        ordinal: trail.length + 1,
        preview: normalizePreview(compactUserMessageText(item.text)),
        responsePreview: "",
        attachmentCount: item.attachments?.length ?? 0,
      });
      currentTurnIndex = trail.length - 1;
    } else if (item.kind === "assistant" && currentTurnIndex >= 0) {
      const responsePreview = normalizePreview(item.text);
      if (responsePreview) {
        trail[currentTurnIndex]!.responsePreview = responsePreview;
      }
    }
  }
  return trail;
}

export interface MessageTrailAnchor {
  id: string;
  rowIndex: number;
}

export interface ActiveTrailSnapshot {
  currentId: string | null;
  visibleIds: readonly string[];
}

export const EMPTY_ACTIVE_TRAIL_SNAPSHOT: ActiveTrailSnapshot = {
  currentId: null,
  visibleIds: [],
};

export function resolveActiveTrailMessageId(
  anchors: readonly MessageTrailAnchor[],
  topVisibleRowIndex: number,
): string | null {
  if (anchors.length === 0) return null;
  let activeId = anchors[0]!.id;
  for (const anchor of anchors) {
    if (anchor.rowIndex <= topVisibleRowIndex) activeId = anchor.id;
    else break;
  }
  return activeId;
}

export function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  if (max < min) return min;
  return value < min ? min : value > max ? max : value;
}

export interface TrailGeometry {
  startY: number;
  spacing: number;
  centerYs: number[];
  contentHeight: number;
}

export function computeTrailGeometry(input: {
  count: number;
  spacingPx?: number;
  paddingPx?: number;
}): TrailGeometry | null {
  const count = input.count;
  const spacing = count <= 1 ? 0 : (input.spacingPx ?? 10);
  const padding = input.paddingPx ?? 12;
  if (count <= 0) return null;
  const centerYs: number[] = [];
  for (let i = 0; i < count; i += 1) {
    centerYs.push(padding + i * spacing);
  }
  return {
    startY: padding,
    spacing,
    centerYs,
    contentHeight: 2 * padding + (count - 1) * spacing,
  };
}

export function computeSigma(spacing: number): number {
  return clampNumber(spacing * 1.5, Math.min(spacing * 2, 8), 22);
}

export function computeGaussianWeights(
  centerYs: readonly number[],
  pointerY: number,
  sigma: number,
): number[] {
  if (sigma <= 0) {
    return centerYs.map((centerY) => (centerY === pointerY ? 1 : 0));
  }
  const twoSigmaSquared = 2 * sigma * sigma;
  return centerYs.map((centerY) => {
    const distance = centerY - pointerY;
    return Math.exp(-(distance * distance) / twoSigmaSquared);
  });
}

export interface TickStyle {
  width: number;
  opacity: number;
}

export function computeTickStyles(
  weights: readonly number[],
  currentAnchorIndex: number | null,
  baseW: number,
  effectiveMaxW: number,
  restOpacity: number,
  anchorOpacity: number,
): TickStyle[] {
  return weights.map((weight, index) => ({
    width: baseW + (effectiveMaxW - baseW) * weight,
    opacity: index === currentAnchorIndex ? anchorOpacity : restOpacity,
  }));
}

export function computeRestStyles(
  count: number,
  currentAnchorIndex: number | null,
  baseW: number,
  restOpacity: number,
  anchorOpacity: number,
): TickStyle[] {
  const styles: TickStyle[] = [];
  for (let i = 0; i < count; i += 1) {
    styles.push({ width: baseW, opacity: i === currentAnchorIndex ? anchorOpacity : restOpacity });
  }
  return styles;
}

export function computeFocusedIndex(pointerY: number, geometry: TrailGeometry): number {
  const count = geometry.centerYs.length;
  if (count <= 1 || geometry.spacing === 0) return 0;
  if (!Number.isFinite(pointerY)) return 0;
  const endY = geometry.startY + (count - 1) * geometry.spacing;
  const clampedY = clampNumber(pointerY, geometry.startY, endY);
  const raw = Math.round((clampedY - geometry.startY) / geometry.spacing);
  return clampNumber(raw, 0, count - 1);
}

export function clampTooltipTop(
  centerY: number,
  tooltipH: number,
  railH: number,
  margin = 4,
): number {
  const half = tooltipH / 2 + margin;
  return clampNumber(centerY, half, Math.max(half, railH - half));
}
