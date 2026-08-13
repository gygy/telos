/** Compact relative time: `2h`, `刚刚`, etc. */

import type { MessageKey } from "./i18n.ts";

export function formatRelativeTime(
  iso: string | undefined,
  now = Date.now(),
): { key: RelativeTimeKey; n?: string } | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return null;
  const ms = now - then;
  if (ms < 0) return null;
  const min = Math.floor(ms / 60_000);
  if (min < 1) return { key: "justNow" };
  if (min < 60) return { key: "minutes", n: String(min) };
  const hr = Math.floor(min / 60);
  if (hr < 24) return { key: "hours", n: String(hr) };
  const day = Math.floor(hr / 24);
  if (day < 7) return { key: "days", n: String(day) };
  const week = Math.floor(day / 7);
  if (week < 5) return { key: "weeks", n: String(week) };
  const month = Math.floor(day / 30);
  if (month < 12) return { key: "months", n: String(month) };
  return { key: "years", n: String(Math.max(1, Math.floor(day / 365))) };
}

export type RelativeTimeKey =
  | "justNow"
  | "minutes"
  | "hours"
  | "days"
  | "weeks"
  | "months"
  | "years";

export const RELATIVE_TIME_I18N: Record<RelativeTimeKey, MessageKey> = {
  justNow: "projectsPage.justNow",
  minutes: "projectsPage.minutes",
  hours: "projectsPage.hours",
  days: "projectsPage.days",
  weeks: "projectsPage.weeks",
  months: "projectsPage.months",
  years: "projectsPage.years",
};
