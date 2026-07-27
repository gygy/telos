import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SessionManager } from "@earendil-works/pi-coding-agent";
import { FakeOpenAiServer } from "../../../packages/test-utils/src/index.ts";

if (process.platform !== "darwin" && process.platform !== "win32") {
  throw new Error("The packaged smoke supports macOS and Windows");
}

const appDirectory = join(dirname(fileURLToPath(import.meta.url)), "..");
const macCandidates = [
  join(appDirectory, "release/app/mac-arm64/Pix.app/Contents/MacOS/Pix"),
  join(appDirectory, "release/app/mac-x64/Pix.app/Contents/MacOS/Pix"),
  join(appDirectory, "release/app/mac/Pix.app/Contents/MacOS/Pix"),
];
const windowsCandidates = [
  join(appDirectory, "release/app/win-unpacked/Pix.exe"),
  join(appDirectory, `release/app/win-${process.arch}-unpacked/Pix.exe`),
];
const candidates = process.platform === "win32" ? windowsCandidates : macCandidates;
const executable = candidates.find((path) => existsSync(path));
if (!executable) {
  throw new Error(
    `Packaged app not found. Run pnpm package:dir first. Tried:\n${candidates.join("\n")}`,
  );
}

// electron-updater requires Resources/app-update.yml (see scripts/after-pack.mjs).
// Missing file → "ENOENT ... app-update.yml" on Settings → Check for updates.
const updateConfigCandidates =
  process.platform === "win32"
    ? [
        join(dirname(executable), "resources", "app-update.yml"),
        join(appDirectory, "release/app/win-unpacked/resources/app-update.yml"),
      ]
    : [
        join(dirname(executable), "..", "Resources", "app-update.yml"),
        join(appDirectory, "release/app/mac-arm64/Pix.app/Contents/Resources/app-update.yml"),
        join(appDirectory, "release/app/mac-x64/Pix.app/Contents/Resources/app-update.yml"),
        join(appDirectory, "release/app/mac/Pix.app/Contents/Resources/app-update.yml"),
      ];
const updateConfigPath = updateConfigCandidates.find((path) => existsSync(path));
if (!updateConfigPath) {
  throw new Error(
    `Packaged app is missing app-update.yml (electron-updater feed config). Tried:\n${updateConfigCandidates.join("\n")}`,
  );
}
const updateConfigBody = await readFile(updateConfigPath, "utf8");
if (!updateConfigBody.includes("provider:") || !updateConfigBody.includes("github")) {
  throw new Error(`app-update.yml is incomplete:\n${updateConfigBody}`);
}
console.log(`[smoke:packaged] app-update.yml ok: ${updateConfigPath}`);
const root = await mkdtemp(join(tmpdir(), "pix-packaged-smoke-"));
const home = join(root, "home");
const agentDir = join(home, ".pi", "agent");
const workspace = join(root, "workspace");
const toolPath = join(workspace, "fixture.txt");
const reportPath = join(root, "smoke-report.jsonl");

await Promise.all([
  mkdir(agentDir, { recursive: true }),
  mkdir(join(home, ".agents"), { recursive: true }),
  ...(process.platform === "win32"
    ? [
        mkdir(join(home, "AppData", "Roaming"), { recursive: true }),
        mkdir(join(home, "AppData", "Local"), { recursive: true }),
      ]
    : []),
  mkdir(workspace, { recursive: true }),
  writeFile(reportPath, ""),
]);
await writeFile(toolPath, "Pix packaged smoke fixture\n");

const terminalSession = SessionManager.create(
  workspace,
  join(agentDir, "sessions", "terminal-smoke"),
);
terminalSession.appendSessionInfo("Packaged terminal smoke");
const terminalSessionFile = terminalSession.getSessionFile();
if (!terminalSessionFile) throw new Error("Failed to create packaged terminal smoke session");

const fakeModel = new FakeOpenAiServer({ toolPath });
await fakeModel.start();
await writeFile(
  join(agentDir, "models.json"),
  JSON.stringify({
    providers: {
      "pix-fake": {
        baseUrl: fakeModel.baseUrl,
        apiKey: "test-key-not-secret",
        api: "openai-completions",
        models: [
          {
            id: "pix-fake",
            name: "Pix Fake Model",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 8192,
            maxTokens: 1024,
            compat: { supportsUsageInStreaming: true },
          },
        ],
      },
    },
  }),
);

const environment = {
  ...process.env,
  HOME: home,
  USERPROFILE: home,
  ...(process.platform === "win32"
    ? {
        APPDATA: join(home, "AppData", "Roaming"),
        LOCALAPPDATA: join(home, "AppData", "Local"),
      }
    : {}),
  XDG_CONFIG_HOME: join(home, ".config"),
  PI_CODING_AGENT_DIR: agentDir,
  PIX_WORKSPACE: workspace,
  PIX_MODEL_PROVIDER: "pix-fake",
  PIX_MODEL_ID: "pix-fake",
  PIX_TOOLS: "read",
  ...(process.platform === "darwin"
    ? {
        PIX_AUTO_START: "1",
        PIX_AUTO_PROMPT: "Use the read tool for the fixture file.",
        PIX_AUTO_ABORT: "1",
        PIX_AUTO_CRASH_PROBE: "1",
      }
    : {
        PIX_AUTO_TERMINAL_PROBE: "1",
        PIX_TERMINAL_PROBE_SESSION_FILE: terminalSessionFile,
      }),
  PIX_NO_AUTO_RESUME: "1",
  PIX_ENABLE_TEST_COMMANDS: "1",
  PIX_PERSIST_SESSION: "1",
  PIX_SMOKE_REPORT_PATH: reportPath,
  PIX_AUTO_CLOSE_MS: "1000",
};
delete environment.ELECTRON_RUN_AS_NODE;

function findReport(lines, type) {
  for (const line of lines) {
    if (!line.includes(`"type":"${type}"`)) continue;
    try {
      const report = JSON.parse(line);
      if (report?.type === type) return report;
    } catch {
      // Ignore unrelated application output that happens to contain the marker.
    }
  }
  return undefined;
}

let succeeded = false;
try {
  const launchArgs = process.platform === "win32" ? ["--enable-logging=stderr", "--v=1"] : [];
  const child = spawn(executable, launchArgs, { cwd: appDirectory, env: environment });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (data) => (stdout += String(data)));
  child.stderr.on("data", (data) => (stderr += String(data)));
  const exitCode = await new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (signal) reject(new Error(`Packaged Electron exited from signal ${signal}`));
      else resolve(code ?? 1);
    });
  });

  const persistedOutput = await readFile(reportPath, "utf8");
  if (exitCode !== 0) {
    throw new Error(
      `Packaged Electron exited with ${exitCode}:\n${persistedOutput}\n${stdout}\n${stderr}`,
    );
  }

  const reportLines = `${persistedOutput}\n${stdout}`.split(/\r?\n/).filter(Boolean);
  let runtimeReport;
  let recoveryReport;
  if (process.platform === "darwin") {
    runtimeReport = findReport(reportLines, "pix.smoke.runtime");
    if (!runtimeReport) {
      throw new Error(
        `Packaged runtime smoke report was not emitted:\n${persistedOutput}\n${stdout}\n${stderr}`,
      );
    }
    for (const event of [
      "agent.started",
      "message.delta",
      "tool.started",
      "tool.completed",
      "agent.settled",
      "message.failed",
    ]) {
      if (!runtimeReport.eventCounts?.[event])
        throw new Error(`Packaged runtime smoke did not emit ${event}`);
    }

    recoveryReport = findReport(reportLines, "pix.smoke.recovery");
    if (!recoveryReport) {
      throw new Error(
        `Packaged recovery smoke report was not emitted:\n${persistedOutput}\n${stdout}\n${stderr}`,
      );
    }
    for (const key of [
      "runtimeIdsUnique",
      "sessionIdsStable",
      "sessionFileStable",
      "messagePendingRejected",
      "toolPendingRejected",
      "gapRecovered",
      "windowAlive",
    ]) {
      if (recoveryReport[key] !== true) throw new Error(`Packaged recovery smoke failed ${key}`);
    }
    if (
      recoveryReport.eventCounts?.["host.crashed"] !== 3 ||
      recoveryReport.eventCounts?.["host.restarted"] !== 3 ||
      recoveryReport.eventCounts?.["runtime.gap"] !== 1
    ) {
      throw new Error("Packaged recovery smoke did not complete three crash/restart cycles");
    }
    const sessionLines = (await readFile(recoveryReport.sessionFile, "utf8")).trim().split("\n");
    if (sessionLines.length < 2)
      throw new Error("Packaged recovery smoke session did not flush JSONL entries");
    for (const line of sessionLines) JSON.parse(line);
  }

  const terminalReport = findReport(reportLines, "pix.smoke.terminal");
  if (process.platform === "win32") {
    if (!terminalReport) throw new Error("Packaged Windows terminal smoke report was not emitted");
    for (const key of [
      "conpty",
      "sessionFileMatches",
      "resized",
      "wroteInput",
      "open",
      "disposed",
    ]) {
      if (terminalReport[key] !== true) {
        throw new Error(`Packaged Windows terminal smoke failed ${key}`);
      }
    }
    if (terminalReport.platform !== "win32" || terminalReport.outputBytes <= 0) {
      throw new Error("Packaged Windows terminal smoke did not receive ConPTY output");
    }
    if (terminalReport.sessionFile !== terminalSessionFile) {
      throw new Error("Packaged Windows terminal smoke did not reuse the requested session file");
    }
  }

  if (runtimeReport) console.log(JSON.stringify(runtimeReport));
  if (recoveryReport) console.log(JSON.stringify(recoveryReport));
  if (terminalReport) console.log(JSON.stringify(terminalReport));
  succeeded = true;
} finally {
  await fakeModel.stop();
  if (succeeded) await rm(root, { recursive: true, force: true });
  else console.error(`Packaged smoke diagnostics preserved at ${root}`);
}
