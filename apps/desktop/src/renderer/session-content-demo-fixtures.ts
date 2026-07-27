/**
 * Fixture data for the view-mode session-content demo.
 *
 * Rules:
 * - Only TimelineItem shapes the product actually builds (history / live-stream / projectEvents).
 * - Tool args/output/details match pi tool payloads (edit details.diff, write args-only, etc.).
 * - Assistant rich markdown mirrors packages/test-utils fake-openai-server (same smoke/e2e fixture).
 * - No decorative “phase galleries” or system lines the product never emits.
 *
 * Path: TimelineItem[] → buildTimelineBlocks → TimelineProcessBlock / TimelineRow /
 * TimelineLiveStatus (same as main.tsx chat timeline).
 */
import { IPC_PROTOCOL_VERSION, type HostEvent } from "@pix/contracts";
import type { TimelineItem } from "./lib/timeline.ts";

const iso = (sec: number) => new Date(Date.UTC(2026, 6, 27, 10, 0, sec)).toISOString();

/** Workspace for file-link / media path resolution (demo stub + product workspacePath). */
export const DEMO_WORKSPACE = "/work/pix-demo-project";

/**
 * Same kitchen-sink reply the fake OpenAI server returns for
 * “Render the rich content fixture.” (packages/test-utils).
 * Paths rewritten to DEMO_WORKSPACE so MarkdownContent file/media links resolve.
 */
export function richAssistantMarkdown(workspace = DEMO_WORKSPACE): string {
  return [
    "## Rich content",
    "",
    "- [x] Completed task",
    "- [ ] Pending task",
    "",
    "~~Removed text~~",
    "",
    "| Type | Status |",
    "| --- | --- |",
    "| Markdown | Ready |",
    "",
    "Inline math: $E = mc^2$",
    "",
    "$$",
    "E = mc^2",
    "$$",
    "",
    "```javascript",
    "const answer = 42;",
    "```",
    "",
    "```diff",
    "-old",
    "+new",
    "```",
    "",
    "```mermaid",
    "graph TD",
    "  A --> B",
    "```",
    "",
    "See the fixture file[^1] and the external docs[^docs].",
    "",
    `[Fixture file](${workspace}/fixture.txt#L1C1)`,
    "[External docs](https://example.com/docs)",
    "",
    `![Preview image](${workspace}/photo.png)`,
    `![Demo video](${workspace}/demo.mp4)`,
    "",
    "[^1]: Primary source for the fixture path.",
    "[^docs]: https://example.com/docs",
    "",
    '<div data-unsafe-html="true">Unsafe HTML</div>',
    '<iframe src="https://example.com"></iframe>',
    "<style>body { display: none; }</style>",
    "<script>window.__pixUnsafeScript = true;</script>",
  ].join("\n");
}

/**
 * One product-shaped snapshot for the demo page.
 * `running` / `waiting` / `events` feed the same deriveLiveActivity path as main.tsx.
 */
export type DemoScenario = {
  id: string;
  title: string;
  description: string;
  items: TimelineItem[];
  /** Session busy — same flag main.tsx passes into deriveLiveActivity / process blocks. */
  running?: boolean;
  /** Waiting for user input (steering / confirm). */
  waiting?: boolean;
  /** Optional recent host events (e.g. compaction.started) for deriveLiveActivity. */
  events?: HostEvent[];
};

/** Closed turn: process → final assistant (rich fixture) — history-like, not running. */
export function scenarioCompletedTurn(): DemoScenario {
  const appPath = `${DEMO_WORKSPACE}/src/app.ts`;
  const notesPath = `${DEMO_WORKSPACE}/notes.md`;
  const notesBody = "# notes\n\nDemo write body.\n";

  return {
    id: "completed",
    title: "已完成一轮",
    description:
      "与产品一致：user → process（thinking / tools / 中间叙述）→ 最终 assistant。running=false，process 默认折叠为「已处理」。",
    items: [
      {
        id: "u1",
        kind: "user",
        text: "Render the rich content fixture.\n\nPlease inspect the workspace and summarize.",
        attachments: [`${DEMO_WORKSPACE}/fixture.txt`, `${DEMO_WORKSPACE}/photo.png`],
        timestamp: iso(0),
        entryId: "e-u1",
      },
      {
        id: "th1",
        kind: "thinking",
        text: "List files, read the fixture, then answer with the rich content body.",
        timestamp: iso(1),
      },
      {
        id: "tool-ls",
        kind: "tool",
        toolCallId: "c-ls",
        toolName: "bash",
        status: "completed",
        args: { command: "ls -la src" },
        output: "total 12\ndrwxr-xr-x  app.ts\ndrwxr-xr-x  lib/\n-rw-r--r--  README.md",
        timestamp: iso(2),
        endedAt: iso(3),
      },
      {
        id: "tool-read",
        kind: "tool",
        toolCallId: "c-read",
        toolName: "read",
        status: "completed",
        args: { path: appPath },
        output: "export function main() {\n  return 42;\n}\n",
        timestamp: iso(3),
        endedAt: iso(4),
      },
      {
        id: "tool-edit",
        kind: "tool",
        toolCallId: "c-edit",
        toolName: "edit",
        status: "completed",
        args: {
          path: appPath,
          edits: [
            {
              oldText: "export function main() {\n  return 42;\n}\n",
              newText: "export function main() {\n  return 43;\n}\n",
            },
          ],
        },
        // pi edit tool details.diff (generateDiffString) — whole-file 1-based lines
        details: {
          diff: [" 1 export function main() {", "-2   return 42;", "+2   return 43;", " 3 }"].join(
            "\n",
          ),
          firstChangedLine: 2,
        },
        output: `Successfully replaced 1 block(s) in ${appPath}.`,
        timestamp: iso(5),
        endedAt: iso(6),
      },
      {
        id: "tool-write",
        kind: "tool",
        toolCallId: "c-write",
        toolName: "write",
        status: "completed",
        args: { path: notesPath, content: notesBody },
        // write tool has no details.diff — UI builds display diff from args
        output: `Successfully wrote ${notesBody.length} bytes to ${notesPath}`,
        timestamp: iso(6),
        endedAt: iso(7),
      },
      {
        id: "tool-fail",
        kind: "tool",
        toolCallId: "c-fail",
        toolName: "bash",
        status: "error",
        args: { command: "cat /missing/file" },
        output: "cat: /missing/file: No such file or directory",
        timestamp: iso(7),
        endedAt: iso(8),
      },
      {
        id: "asst-mid",
        kind: "assistant",
        text: "Tools finished; composing the summary.",
        timestamp: iso(8),
        entryId: "e-mid",
      },
      {
        id: "th2",
        kind: "thinking",
        text: "Emit the rich content fixture as the final reply.",
        timestamp: iso(9),
      },
      {
        id: "asst-final",
        kind: "assistant",
        text: richAssistantMarkdown(),
        timestamp: iso(12),
        entryId: "e-final",
      },
    ],
  };
}

/** Open process: running tool — process header shows executing (no trailing live status). */
export function scenarioLiveExecuting(): DemoScenario {
  return {
    id: "live-executing",
    title: "进行中 · 执行工具",
    description:
      "running=true，末条 tool status=running → deriveLiveActivity phase=executing，由 open process 头部展示。",
    running: true,
    items: [
      {
        id: "u-exec",
        kind: "user",
        text: "Run the tests and fix failures.",
        timestamp: iso(20),
        entryId: "e-u-exec",
      },
      {
        id: "th-exec",
        kind: "thinking",
        text: "Run the unit suite first.",
        timestamp: iso(21),
      },
      {
        id: "tool-run",
        kind: "tool",
        toolCallId: "c-run",
        toolName: "bash",
        status: "running",
        args: { command: "pnpm test" },
        timestamp: iso(22),
      },
    ],
  };
}

/**
 * Open process after tools; trailing assistant stream → responding on process header
 * (processBlockCoversLiveActivity suppresses trailing TimelineLiveStatus).
 */
export function scenarioLiveResponding(): DemoScenario {
  return {
    id: "live-responding",
    title: "进行中 · 正在回复",
    description:
      "running=true，末条 assistant 流式正文 → deriveLiveActivity phase=responding，挂在 open process 头部。",
    running: true,
    items: [
      {
        id: "u-resp",
        kind: "user",
        text: "Summarize the plan.",
        timestamp: iso(30),
        entryId: "e-u-resp",
      },
      {
        id: "th-resp",
        kind: "thinking",
        text: "Read README, then answer.",
        timestamp: iso(31),
      },
      {
        id: "tool-resp",
        kind: "tool",
        toolCallId: "c-resp-read",
        toolName: "read",
        status: "completed",
        args: { path: `${DEMO_WORKSPACE}/README.md` },
        output: "# Demo\n\nFixture read for the responding phase.\n",
        timestamp: iso(32),
        endedAt: iso(33),
      },
      {
        id: "asst-stream",
        kind: "assistant",
        text: "Here is a short plan based on the README…",
        timestamp: iso(34),
        entryId: "e-asst-stream",
      },
    ],
  };
}

/**
 * Compaction in flight: system row from compaction.started + trailing live status
 * (compacting is never folded into the process header).
 */
export function scenarioCompacting(): DemoScenario {
  return {
    id: "compacting",
    title: "进行中 · 压缩上下文",
    description:
      "system「Compaction started」+ running → deriveLiveActivity phase=compacting → TimelineLiveStatus。",
    running: true,
    events: [
      {
        protocolVersion: IPC_PROTOCOL_VERSION,
        type: "runtime.event",
        runtimeId: "demo",
        sequence: 1,
        event: { type: "compaction.started", reason: "threshold" },
      },
    ],
    items: [
      {
        id: "u-compact",
        kind: "user",
        text: "Continue after a long history.",
        timestamp: iso(40),
        entryId: "e-u-compact",
      },
      {
        id: "th-compact",
        kind: "thinking",
        text: "Context is nearly full.",
        timestamp: iso(41),
      },
      {
        id: "sys-compact-start",
        kind: "system",
        title: "Compaction",
        text: "Compaction started (threshold)",
        tone: "info",
        timestamp: iso(44),
      },
    ],
  };
}

/** Compaction finished in history (no live status). */
export function scenarioCompactionDone(): DemoScenario {
  return {
    id: "compaction-done",
    title: "历史 · 压缩完成",
    description:
      "projectEvents 投影的 Compaction started/completed system 行；running=false，无 TimelineLiveStatus。",
    items: [
      {
        id: "u-cd",
        kind: "user",
        text: "Keep going.",
        timestamp: iso(50),
        entryId: "e-u-cd",
      },
      {
        id: "sys-cs",
        kind: "system",
        title: "Compaction",
        text: "Compaction started (threshold)",
        tone: "info",
        timestamp: iso(51),
      },
      {
        id: "sys-ce",
        kind: "system",
        title: "Compaction",
        text: "Compaction completed",
        tone: "info",
        timestamp: iso(55),
      },
      {
        id: "asst-cd",
        kind: "assistant",
        text: "Context compacted. Continuing from the summary.",
        timestamp: iso(56),
        entryId: "e-asst-cd",
      },
    ],
  };
}

/** Waiting for user input — trailing TimelineLiveStatus only. */
export function scenarioWaiting(): DemoScenario {
  return {
    id: "waiting",
    title: "等待输入",
    description:
      "waiting=true → deriveLiveActivity phase=waiting；无 open process，时间线末尾 TimelineLiveStatus。",
    waiting: true,
    items: [
      {
        id: "u-wait",
        kind: "user",
        text: "Please confirm before applying the patch.",
        timestamp: iso(60),
        entryId: "e-u-wait",
      },
      {
        id: "asst-wait",
        kind: "assistant",
        text: "I can apply the change once you confirm. Reply **yes** to continue.",
        timestamp: iso(61),
        entryId: "e-asst-wait",
      },
    ],
  };
}

export function allDemoScenarios(): DemoScenario[] {
  return [
    scenarioCompletedTurn(),
    scenarioLiveExecuting(),
    scenarioLiveResponding(),
    scenarioCompacting(),
    scenarioCompactionDone(),
    scenarioWaiting(),
  ];
}
