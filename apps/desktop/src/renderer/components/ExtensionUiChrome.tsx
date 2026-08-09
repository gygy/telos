/**
 * Desktop chrome for portable extension fire-and-forget UI:
 * status chips, string widgets, working message, unsupported diagnostics.
 */
import { cn } from "@/lib/utils";
import type { ExtensionUiPortableState } from "../lib/extension-ui-state.ts";
import { extensionStatusList, extensionWidgetsForPlacement } from "../lib/extension-ui-state.ts";
import { t, type Locale } from "../lib/i18n.ts";

export function ExtensionUiChrome(props: {
  locale: Locale;
  state: ExtensionUiPortableState;
  /** aboveEditor | header | belowEditor */
  region: "header" | "aboveEditor" | "belowEditor";
  className?: string;
}) {
  const statuses = extensionStatusList(props.state);
  const working =
    props.state.workingVisible && props.state.workingMessage
      ? props.state.workingMessage
      : props.state.workingMessage && props.region === "header"
        ? props.state.workingMessage
        : undefined;
  const widgets =
    props.region === "header"
      ? []
      : extensionWidgetsForPlacement(
          props.state,
          props.region === "belowEditor" ? "belowEditor" : "aboveEditor",
        );
  const unsupported =
    props.region === "header" && props.state.unsupported.length > 0 ? props.state.unsupported : [];
  const notify =
    props.region === "header" && props.state.lastNotify ? props.state.lastNotify : undefined;

  if (
    props.region === "header" &&
    statuses.length === 0 &&
    !working &&
    unsupported.length === 0 &&
    !notify &&
    !props.state.title
  ) {
    return null;
  }
  if (props.region !== "header" && widgets.length === 0) return null;

  if (props.region === "header") {
    return (
      <div
        className={cn(
          "pointer-events-none flex min-w-0 flex-wrap items-center gap-1.5 px-3 pb-1",
          props.className,
        )}
        data-testid="extension-ui-chrome-header"
      >
        {props.state.title ? (
          <span
            className="pointer-events-auto max-w-[40%] truncate rounded-md bg-muted/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
            data-testid="extension-ui-title"
            title={props.state.title}
          >
            {props.state.title}
          </span>
        ) : null}
        {statuses.map((item) => (
          <span
            key={item.key}
            className="pointer-events-auto max-w-[min(280px,40vw)] truncate rounded-full border border-border/70 bg-background/80 px-2 py-0.5 text-[11px] text-foreground/90"
            data-testid={`extension-ui-status-${item.key}`}
            title={item.text}
          >
            {item.text}
          </span>
        ))}
        {working ? (
          <span
            className="pointer-events-auto max-w-[min(240px,36vw)] truncate rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary"
            data-testid="extension-ui-working"
            title={working}
          >
            {working}
          </span>
        ) : null}
        {notify ? (
          <span
            className={cn(
              "pointer-events-auto max-w-[min(280px,40vw)] truncate rounded-full px-2 py-0.5 text-[11px]",
              notify.type === "error"
                ? "bg-destructive/15 text-destructive"
                : notify.type === "warning"
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                  : "bg-muted text-muted-foreground",
            )}
            data-testid="extension-ui-notify"
            title={notify.message}
          >
            {notify.message}
          </span>
        ) : null}
        {unsupported.map((method) => (
          <span
            key={method}
            className="pointer-events-auto max-w-[min(320px,50vw)] truncate rounded-full border border-dashed border-border px-2 py-0.5 text-[11px] text-muted-foreground"
            data-testid={`extension-ui-unsupported-${method}`}
            title={t(props.locale, "extensionUi.unsupportedHint", { method })}
          >
            {t(props.locale, "extensionUi.unsupported", { method })}
          </span>
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "pointer-events-none flex w-full flex-col gap-1.5 px-1",
        props.region === "aboveEditor" ? "pb-1.5" : "pt-1.5",
        props.className,
      )}
      data-testid={`extension-ui-chrome-${props.region}`}
    >
      {widgets.map((widget) => (
        <div
          key={widget.key}
          className="pointer-events-auto rounded-md border border-border/80 bg-muted/40 px-2.5 py-1.5 text-[12px] leading-snug text-foreground/90"
          data-testid={`extension-ui-widget-${widget.key}`}
        >
          {widget.lines.map((line, i) => (
            <p
              key={`${widget.key}-${i}`}
              className="m-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere]"
            >
              {line}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}
