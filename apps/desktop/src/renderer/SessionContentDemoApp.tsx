/**
 * View-mode session content demo — same components and wiring as product chat.
 *
 * TimelineItem[] → buildTimelineBlocks → TimelineProcessBlock / TimelineRow /
 * deriveLiveActivity → TimelineLiveStatus (mirrors main.tsx).
 *
 * No decorative phase galleries; no force-open of completed process blocks.
 */
import { useEffect, useMemo } from "react";
import {
  TimelineLiveStatus,
  TimelineProcessBlock,
  TimelineRow,
} from "./components/TimelineRow.tsx";
import { applyDocumentTheme } from "./lib/theme.ts";
import {
  buildTimelineBlocks,
  deriveLiveActivity,
  processBlockCoversLiveActivity,
} from "./lib/timeline.ts";
import { cn } from "./lib/utils.ts";
import {
  allDemoScenarios,
  DEMO_WORKSPACE,
  type DemoScenario,
} from "./session-content-demo-fixtures.ts";
import "./styles.css";

applyDocumentTheme("dark");

function useDemoDocumentScroll() {
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const root = document.getElementById("root");
    html.style.setProperty("height", "auto", "important");
    html.style.setProperty("overflow", "auto", "important");
    body.style.setProperty("height", "auto", "important");
    body.style.setProperty("min-height", "100%", "important");
    body.style.setProperty("overflow", "auto", "important");
    body.style.setProperty("overflow-y", "auto", "important");
    body.style.setProperty("overflow-x", "hidden", "important");
    if (root) {
      root.style.setProperty("height", "auto", "important");
      root.style.setProperty("min-height", "100%", "important");
      root.style.setProperty("overflow", "visible", "important");
    }
  }, []);
}

function ScenarioTimeline(props: { scenario: DemoScenario; locale: "zh" | "en" }) {
  const { scenario, locale } = props;
  const running = Boolean(scenario.running);
  const waiting = Boolean(scenario.waiting);
  const events = scenario.events ?? [];

  const blocks = useMemo(() => buildTimelineBlocks(scenario.items), [scenario.items]);

  // Same derivation as main.tsx — do not hand-pick live phases for effect.
  const liveActivity = useMemo(
    () =>
      deriveLiveActivity({
        items: scenario.items,
        events,
        running,
        waiting,
      }),
    [scenario.items, events, running, waiting],
  );
  const showLiveStatus =
    liveActivity != null && !processBlockCoversLiveActivity(blocks, liveActivity);

  return (
    <div
      className={cn(
        "thread-content-column thread-content-column-stack gap-0",
        "thread-messages-active rounded-lg border border-border/60 bg-background px-3 pt-6 pb-8",
      )}
      data-testid={`timeline-${scenario.id}`}
      data-content-mode="chat"
      data-demo="session-content"
      data-demo-scenario={scenario.id}
    >
      {blocks.map((block) => {
        const messageId = block.type === "process" ? block.id : block.item.id;
        return (
          <div key={messageId} className="w-full" data-message-id={messageId}>
            {block.type === "process" ? (
              <TimelineProcessBlock
                locale={locale}
                items={block.items}
                open={Boolean(block.open)}
                running={running}
                waiting={waiting}
                {...(block.open && liveActivity?.phase ? { livePhase: liveActivity.phase } : {})}
                {...(block.startedAt ? { startedAt: block.startedAt } : {})}
                {...(block.endedAt ? { endedAt: block.endedAt } : {})}
                {...(block.durationLabel ? { durationLabel: block.durationLabel } : {})}
                workspacePath={DEMO_WORKSPACE}
              />
            ) : (
              <TimelineRow
                item={block.item}
                locale={locale}
                workspacePath={DEMO_WORKSPACE}
                editingLocked={running || waiting}
              />
            )}
          </div>
        );
      })}
      {showLiveStatus && liveActivity ? (
        <div className="w-full" data-message-id={`${scenario.id}:live-status`}>
          <TimelineLiveStatus locale={locale} activity={liveActivity} />
        </div>
      ) : null}
    </div>
  );
}

export function SessionContentDemoApp() {
  useDemoDocumentScroll();
  const locale = "zh" as const;
  const scenarios = useMemo(() => allDemoScenarios(), []);

  return (
    <div
      className="min-h-full bg-background text-foreground"
      style={{ overflow: "visible" }}
      data-testid="session-content-demo"
      data-theme="dark"
    >
      <div className="mx-auto max-w-3xl space-y-10 px-4 py-6 pb-16">
        <header className="space-y-2">
          <h1 className="text-lg font-semibold tracking-tight">视图模式 · 会话内容渲染</h1>
          <p className="text-[13px] leading-relaxed text-muted-foreground">
            仅使用产品 chat 时间线真实路径与数据形态：TimelineItem → buildTimelineBlocks →
            TimelineProcessBlock / TimelineRow / deriveLiveActivity → TimelineLiveStatus。快照与
            smoke/e2e 的 fake 模型 rich content、pi 工具 payload 对齐；不编造额外 UI 状态。
          </p>
          <p className="rounded-md border border-border/50 bg-muted/30 px-3 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
            启动：
            <code className="text-foreground">pnpm demo:session-content</code>
            （仓库根）或{" "}
            <code className="text-foreground">pnpm --filter @pix/desktop demo:session-content</code>
            <br />
            地址：
            <code className="text-foreground">http://127.0.0.1:4177/session-content-demo.html</code>
            · 改代码后需重新执行命令重建 · 勿用 file:// 打开
          </p>
        </header>

        {scenarios.map((scenario) => (
          <section key={scenario.id} className="space-y-3" data-scenario={scenario.id}>
            <div className="space-y-1 px-0.5">
              <h2 className="text-sm font-medium text-foreground">{scenario.title}</h2>
              <p className="text-[12px] leading-relaxed text-muted-foreground">
                {scenario.description}
              </p>
            </div>
            <ScenarioTimeline scenario={scenario} locale={locale} />
          </section>
        ))}
      </div>
    </div>
  );
}
