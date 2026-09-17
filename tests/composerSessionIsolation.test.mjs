import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const composerController = readFileSync(
  "src/renderer/src/hooks/useSessionComposerController.ts",
  "utf8",
);
const composerAtoms = readFileSync(
  "src/renderer/src/atoms/composer-atoms.ts",
  "utf8",
);
const sessionAtoms = readFileSync(
  "src/renderer/src/atoms/session-atoms.ts",
  "utf8",
);
const timeline = readFileSync(
  "src/renderer/src/components/session/SessionMessageTimeline.tsx",
  "utf8",
);
const turnRow = readFileSync(
  "src/renderer/src/components/session/turn/TurnRow.tsx",
  "utf8",
);
const finalAnswer = readFileSync(
  "src/renderer/src/components/session/turn/FinalAnswer.tsx",
  "utf8",
);
const appUiAtoms = readFileSync(
  "src/renderer/src/atoms/app-ui-atoms.ts",
  "utf8",
);
const settingsStore = readFileSync(
  "src/main/settings/SettingsStore.ts",
  "utf8",
);

test("composer must not subscribe to the global sessionMessagesCacheAtom", () => {
  // 工具期 50ms message flush 会重建全局 cache；composer 若 useAtomValue 整表，
  // 对话中间每次工具更新都会重渲输入框——首轮后体感变钝的主因之一。
  assert.doesNotMatch(
    composerController,
    /useAtomValue\(\s*sessionMessagesCacheAtom\s*\)/,
  );
  assert.match(
    composerController,
    /sessionHasImageGenHistoryAtomFamily/,
  );
});

test("composer draft/send/attachments use per-session selectAtom families", () => {
  assert.match(composerAtoms, /sessionDraftBySessionIdAtomFamily/);
  assert.match(composerAtoms, /sessionSendStateBySessionIdAtomFamily/);
  assert.match(composerAtoms, /sessionAttachmentsBySessionIdAtomFamily/);
  assert.match(
    composerController,
    /useAtomValue\(\s*sessionDraftBySessionIdAtomFamily\(sessionId\)\s*\)/,
  );
  assert.match(
    composerController,
    /useAtomValue\(\s*sessionSendStateBySessionIdAtomFamily\(sessionId\)\s*\)/,
  );
  // 删除会话时必须 remove family，否则长期泄漏。
  assert.match(
    composerAtoms,
    /sessionDraftBySessionIdAtomFamily\.remove\(sessionId\)/,
  );
});

test("imageGen history flag is a boolean selectAtom (stable across message flushes)", () => {
  assert.match(sessionAtoms, /sessionHasImageGenHistoryAtomFamily/);
  assert.match(
    sessionAtoms,
    /sessionHasImageGenHistoryAtomFamily\.remove\(sessionId\)/,
  );
});

test("non-latest final answers stay on light Markdown", () => {
  assert.match(turnRow, /light=\{props\.isLatestRun === false\}/);
  assert.match(finalAnswer, /light\?: boolean/);
});

test("liveThinkingId is only passed to the last agent-run", () => {
  assert.match(
    timeline,
    /liveThinkingId=\{item\.id === latestAgentRunId \? liveThinkingId : undefined\}/,
  );
});

test("expandInterimDuringStream defaults off for mid-conversation snappiness", () => {
  assert.match(appUiAtoms, /expandInterimDuringStream: false/);
  assert.match(settingsStore, /expandInterimDuringStream: false/);
});
