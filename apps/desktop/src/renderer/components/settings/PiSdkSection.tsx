/**
 * Settings → Pi: SDK source (builtin / global), active version, config files.
 * Descriptions use a stacked layout: status line, optional hint, mono path.
 */
import type { PiConfigFileInfo, PiSdkCandidate, PiSdkSource, PiSdkStatus } from "@pix/contracts";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { t, type Locale, type MessageKey } from "../../lib/i18n.ts";
import { cn } from "../../lib/utils.ts";
import { useShellStore } from "../../store/shell-store.ts";
import {
  SettingsPageShell,
  SettingsPillButton,
  SettingsRow,
  SettingsSectionBlock,
} from "./SettingsPrimitives.tsx";

function configTitleKey(id: string): MessageKey {
  return `piSdk.config.${id}` as MessageKey;
}

function formatBytes(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return "—";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function formatMtime(ms: number | undefined, locale: Locale): string {
  if (ms === undefined || !Number.isFinite(ms)) return "";
  try {
    return new Date(ms).toLocaleString(locale === "zh" ? "zh-CN" : "en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

function isBusyError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.startsWith("PI_SDK_BUSY:");
}

function busySummary(
  tr: (key: MessageKey, vars?: Record<string, string>) => string,
  status: PiSdkStatus | undefined,
): string | undefined {
  const activity = status?.activity;
  if (!activity?.busy) return undefined;
  const parts: string[] = [];
  if (activity.agentBusy) parts.push(tr("piSdk.busyAgent"));
  if (activity.parkedBusyCount > 0) {
    parts.push(tr("piSdk.busyParked", { count: String(activity.parkedBusyCount) }));
  }
  if (activity.terminalLive) parts.push(tr("piSdk.busyTerminal"));
  return parts.length > 0 ? parts.join(" · ") : tr("piSdk.busyHint");
}

/** Stacked description: primary status, optional hint, mono path. */
function DescStack(props: {
  primary?: string | undefined;
  hint?: string | undefined;
  path?: string | undefined;
  tone?: "default" | "warn" | "ok" | undefined;
}) {
  const primaryClass =
    props.tone === "warn"
      ? "text-amber-600 dark:text-amber-400"
      : props.tone === "ok"
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-[var(--muted-foreground)]";

  return (
    <span className="flex min-w-0 flex-col gap-0.5">
      {props.primary ? (
        <span className={cn("text-[12px] leading-snug", primaryClass)}>{props.primary}</span>
      ) : null}
      {props.hint ? (
        <span className="text-[11.5px] leading-snug text-[var(--text-subtle)]">{props.hint}</span>
      ) : null}
      {props.path ? (
        <span
          className="truncate font-mono text-[11px] leading-snug text-[var(--text-subtle)]"
          title={props.path}
        >
          {props.path}
        </span>
      ) : null}
    </span>
  );
}

function emptyControl(): ReactNode {
  return <span className="block min-w-[1px]" aria-hidden />;
}

/**
 * Status under the source title. Active/available is shown by the right control
 * ("使用中" / "切换"), not repeated in the description.
 */
function sourceStatusLine(
  tr: (key: MessageKey, vars?: Record<string, string>) => string,
  candidate: PiSdkCandidate,
  isActive: boolean,
  showBusyHint: boolean,
): { primary: string | undefined; tone: "default" | "warn" | "ok" } {
  if (!candidate.available) {
    // Button already says "Install"; only surface extra errors (e.g. missing npm).
    const detail =
      candidate.error && !/not installed|click install/i.test(candidate.error)
        ? candidate.error
        : undefined;
    return {
      primary: [tr("piSdk.unavailable"), detail].filter(Boolean).join(" · "),
      tone: "warn",
    };
  }
  const bits = [
    candidate.version ? `v${candidate.version}` : undefined,
    !isActive && showBusyHint ? tr("piSdk.busyHintShort") : undefined,
  ].filter(Boolean) as string[];
  return {
    primary: bits.length > 0 ? bits.join(" · ") : undefined,
    tone: isActive ? "ok" : "default",
  };
}

export function PiSdkSection(props: { locale: Locale }) {
  const tr = (key: MessageKey, vars?: Record<string, string>) => t(props.locale, key, vars);
  const showAppError = useShellStore((s) => s.showAppError);
  const setStatus = useShellStore((s) => s.setStatus);
  const shellRunning = useShellStore((s) => s.running);
  const runningSessionCount = useShellStore((s) => Object.keys(s.runningSessions).length);
  const [status, setSdkStatus] = useState<PiSdkStatus | undefined>();
  const [files, setFiles] = useState<PiConfigFileInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [next, list] = await Promise.all([
        window.pix.piSdk.getStatus(),
        window.pix.piSdk.listConfigFiles(),
      ]);
      setSdkStatus(next);
      setFiles(list);
    } catch (error) {
      showAppError(error instanceof Error ? error.message : tr("piSdk.switchFailed"));
    } finally {
      setLoading(false);
    }
  }, [showAppError, props.locale]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const activityBusy = Boolean(status?.activity?.busy);
  const uiBusyHint = activityBusy || shellRunning || runningSessionCount > 0;

  async function switchTo(source: PiSdkSource) {
    if (!status || status.activeSource === source || busy) return;
    const candidate = status.candidates.find((c) => c.source === source);
    if (!candidate?.available) return;

    let latest = status;
    try {
      latest = await window.pix.piSdk.getStatus();
      setSdkStatus(latest);
    } catch {
      // keep previous status
    }

    const isBusy = Boolean(latest.activity?.busy) || shellRunning || runningSessionCount > 0;
    const confirmMsg = isBusy ? tr("piSdk.switchConfirmBusy") : tr("piSdk.switchConfirm");
    if (!window.confirm(confirmMsg)) return;

    setBusy(true);
    try {
      const next = await window.pix.piSdk.setSource(source, { force: isBusy });
      setSdkStatus(next);
      setFiles(await window.pix.piSdk.listConfigFiles());
      setStatus(
        tr("piSdk.using") +
          ` · ${source === "builtin" ? tr("piSdk.builtin") : tr("piSdk.global")}` +
          (next.activeVersion ? ` ${next.activeVersion}` : ""),
      );
    } catch (error) {
      if (isBusyError(error)) {
        if (window.confirm(tr("piSdk.switchConfirmBusy"))) {
          try {
            const next = await window.pix.piSdk.setSource(source, { force: true });
            setSdkStatus(next);
            setFiles(await window.pix.piSdk.listConfigFiles());
            return;
          } catch (retryError) {
            showAppError(
              retryError instanceof Error ? retryError.message : tr("piSdk.switchFailed"),
            );
          }
        } else {
          setStatus(tr("piSdk.switchBusyRefused"));
        }
      } else {
        showAppError(error instanceof Error ? error.message : tr("piSdk.switchFailed"));
      }
      await refresh();
    } finally {
      setBusy(false);
    }
  }

  async function installGlobal() {
    setBusy(true);
    try {
      const result = await window.pix.piSdk.installGlobal();
      if (result.error) showAppError(result.error);
      await refresh();
    } catch (error) {
      showAppError(error instanceof Error ? error.message : tr("piSdk.switchFailed"));
    } finally {
      setBusy(false);
    }
  }

  const appliedMismatch = Boolean(status?.needsRestart);
  const busyLine = busySummary(tr, status);
  /** One-line notice above sources when applying or work is in progress. */
  const runtimeNotice = busyLine
    ? busyLine
    : appliedMismatch
      ? tr("piSdk.needsRestart")
      : loading
        ? tr("piSdk.loading")
        : undefined;

  return (
    <SettingsPageShell
      title={tr("section.pi")}
      testId="settings-pi-sdk"
      titleAction={
        <SettingsPillButton
          label={tr("piSdk.refresh")}
          testId="pi-sdk-refresh"
          disabled={loading || busy}
          onClick={() => void refresh()}
        />
      }
    >
      <SettingsSectionBlock label={tr("piSdk.sources")} testId="pi-sdk-sources">
        {runtimeNotice ? (
          <SettingsRow
            title={tr("piSdk.status")}
            description={<DescStack primary={runtimeNotice} tone="warn" />}
            control={emptyControl()}
            testId="pi-sdk-runtime-notice"
          />
        ) : null}
        {(status?.candidates ?? []).map((candidate) => {
          const isActive = status?.activeSource === candidate.source;
          const title = candidate.source === "builtin" ? tr("piSdk.builtin") : tr("piSdk.global");
          const { primary, tone } = sourceStatusLine(
            tr,
            candidate,
            isActive,
            !isActive && uiBusyHint,
          );
          const path = candidate.cliPath || candidate.packageRoot;
          return (
            <SettingsRow
              key={candidate.source}
              title={title}
              description={<DescStack primary={primary} path={path} tone={tone} />}
              control={
                isActive ? (
                  <span
                    className="text-xs font-medium text-emerald-600 dark:text-emerald-400"
                    data-testid={`pi-sdk-${candidate.source}-active`}
                  >
                    {tr("piSdk.using")}
                  </span>
                ) : candidate.source === "global" && !candidate.available ? (
                  <SettingsPillButton
                    label={busy ? tr("piSdk.installing") : tr("piSdk.installGlobal")}
                    testId="pi-sdk-install-global"
                    disabled={busy || loading}
                    onClick={() => void installGlobal()}
                  />
                ) : (
                  <SettingsPillButton
                    label={tr("piSdk.use")}
                    testId={`pi-sdk-use-${candidate.source}`}
                    disabled={busy || loading || !candidate.available}
                    onClick={() => void switchTo(candidate.source)}
                  />
                )
              }
              last={false}
            />
          );
        })}
        <SettingsRow
          title={tr("piSdk.agentDir")}
          description={<DescStack path={status?.agentDir} />}
          control={emptyControl()}
          last
        />
      </SettingsSectionBlock>

      <SettingsSectionBlock label={tr("piSdk.configFiles")} testId="pi-sdk-config-files">
        {files.length === 0 && loading ? (
          <SettingsRow
            title={tr("piSdk.loading")}
            description={<DescStack primary="…" />}
            control={emptyControl()}
            last
          />
        ) : (
          files.map((file, index) => {
            const meta = file.exists
              ? [formatBytes(file.sizeBytes), formatMtime(file.mtimeMs, props.locale)]
                  .filter(Boolean)
                  .join(" · ")
              : tr("piSdk.config.missing");
            return (
              <SettingsRow
                key={file.id}
                title={tr(configTitleKey(file.id))}
                description={
                  <DescStack
                    primary={meta}
                    path={file.path}
                    tone={file.exists ? "default" : "warn"}
                  />
                }
                control={
                  <div className="flex flex-wrap items-center justify-end gap-1.5">
                    <SettingsPillButton
                      label={tr("piSdk.config.reveal")}
                      testId={`pi-sdk-reveal-${file.id}`}
                      disabled={!file.exists || busy}
                      onClick={() => {
                        void window.pix.piSdk.revealConfig(file.id).catch((error) => {
                          showAppError(error instanceof Error ? error.message : String(error));
                        });
                      }}
                    />
                    {file.openable ? (
                      <SettingsPillButton
                        label={tr("piSdk.config.open")}
                        testId={`pi-sdk-open-${file.id}`}
                        disabled={!file.exists || busy}
                        onClick={() => {
                          void window.pix.piSdk.openConfig(file.id).catch((error) => {
                            showAppError(error instanceof Error ? error.message : String(error));
                          });
                        }}
                      />
                    ) : null}
                  </div>
                }
                last={index === files.length - 1}
              />
            );
          })
        )}
      </SettingsSectionBlock>
    </SettingsPageShell>
  );
}
