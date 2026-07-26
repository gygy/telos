import type { Page } from "@playwright/test";
import { conversationSessionButtons, expect, sendPrompt, startHost, test } from "./fixtures.ts";

async function terminalStatus(page: Page) {
  return page.evaluate(() => window.pix.terminal.status());
}

async function expectTerminalSession(page: Page, sessionFile: string): Promise<void> {
  await expect(page.getByTestId("thread-terminal-surface")).toBeVisible({ timeout: 45_000 });
  await expect(page.getByTestId("pi-tui-terminal")).toHaveAttribute("data-surface-ready", "true", {
    timeout: 45_000,
  });
  await expect
    .poll(() => terminalStatus(page), { timeout: 45_000 })
    .toMatchObject({ open: true, suspended: false, sessionFile });
}

async function switchConversationByPath(page: Page, sessionFile: string): Promise<void> {
  const buttons = conversationSessionButtons(page);
  const index = await buttons.evaluateAll(
    (nodes, path) => nodes.findIndex((node) => (node as HTMLElement).dataset.sessionPath === path),
    sessionFile,
  );
  expect(index).toBeGreaterThanOrEqual(0);
  await buttons.nth(index).click();
}

test.describe("Embedded pi TUI", () => {
  test("shares session identity and restores per-session surfaces across warm PTYs", async ({
    page,
  }) => {
    await startHost(page);
    await sendPrompt(page, "terminal session A");
    const sessionA = await page.evaluate(() => window.pix.host.snapshot());
    expect(sessionA.sessionFile).toBeTruthy();

    await page.getByTestId("thread-content-mode-toggle").click();
    await expectTerminalSession(page, sessionA.sessionFile!);
    await expect(page.getByTestId("surface-transition-mask")).toHaveCount(0);
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const value = (
              document.querySelector(".pi-tui-terminal-host textarea") as HTMLTextAreaElement | null
            )?.style.left.replace("px", "");
            return Number(value);
          }),
        { timeout: 5_000 },
      )
      .toBeLessThan(20);

    const terminalInput = page.locator(".pi-tui-terminal-host textarea");
    await expect(terminalInput).toBeFocused();
    const pinnedCaret = await terminalInput.evaluate((textarea) => ({
      left: textarea.style.left,
      top: textarea.style.top,
      width: textarea.style.width,
      height: textarea.style.height,
      caretColor: textarea.style.caretColor,
    }));
    expect(pinnedCaret.width).toBe("1px");
    expect(pinnedCaret.caretColor).toBe("transparent");
    await terminalInput.evaluate((textarea) => {
      textarea.style.position = "fixed";
      textarea.style.left = "0px";
      textarea.style.top = "0px";
      textarea.style.width = "0px";
      textarea.style.height = "0px";
    });
    await expect
      .poll(() =>
        terminalInput.evaluate((textarea) => ({
          position: textarea.style.position,
          left: textarea.style.left,
          top: textarea.style.top,
          width: textarea.style.width,
          height: textarea.style.height,
          caretColor: textarea.style.caretColor,
        })),
      )
      .toEqual({ position: "absolute", ...pinnedCaret });

    await page.getByTestId("thread-content-mode-toggle").click();
    await expect(page.getByTestId("thread-terminal-surface")).toHaveCount(0);
    await expect(page.getByTestId("composer-dock")).toBeVisible();
    await expect(page.locator(".timeline-scroll")).toHaveAttribute("data-ready", "true");
    await expect(page.getByTestId("timeline")).toContainText("terminal session A");
    await expect
      .poll(() => terminalStatus(page))
      .toMatchObject({
        open: false,
        suspended: true,
        sessionFile: sessionA.sessionFile,
      });
    expect((await page.evaluate(() => window.pix.host.snapshot())).sessionFile).toBe(
      sessionA.sessionFile,
    );

    await page.getByTestId("thread-content-mode-toggle").click();
    await expectTerminalSession(page, sessionA.sessionFile!);

    // A new conversation defaults to chat without overwriting A's terminal preference.
    await startHost(page);
    await expect(page.getByTestId("composer-dock")).toBeVisible({ timeout: 30_000 });
    await sendPrompt(page, "terminal session B");
    const sessionB = await page.evaluate(() => window.pix.host.snapshot());
    expect(sessionB.sessionFile).toBeTruthy();
    expect(sessionB.sessionFile).not.toBe(sessionA.sessionFile);
    await expect(conversationSessionButtons(page)).toHaveCount(2, { timeout: 15_000 });

    await page.getByTestId("thread-content-mode-toggle").click();
    await expectTerminalSession(page, sessionB.sessionFile!);
    await expect
      .poll(() => terminalStatus(page))
      .toMatchObject({ parkedSessionFiles: [sessionA.sessionFile], sessionCount: 2 });

    // Both sessions remember terminal, and hopping promotes the matching warm PTY.
    await switchConversationByPath(page, sessionA.sessionFile!);
    await expectTerminalSession(page, sessionA.sessionFile!);
    await expect(page.getByTestId("surface-transition-mask")).toHaveCount(0);
    await expect
      .poll(() => terminalStatus(page))
      .toMatchObject({ parkedSessionFiles: [sessionB.sessionFile], sessionCount: 2 });

    await switchConversationByPath(page, sessionB.sessionFile!);
    await expectTerminalSession(page, sessionB.sessionFile!);

    // B opts into chat. A remains a warm terminal session and restores independently.
    await page.getByTestId("thread-content-mode-toggle").click();
    await expect(page.getByTestId("composer-dock")).toBeVisible();
    await switchConversationByPath(page, sessionA.sessionFile!);
    await expectTerminalSession(page, sessionA.sessionFile!);
    await switchConversationByPath(page, sessionB.sessionFile!);
    await expect(page.getByTestId("composer-dock")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("thread-terminal-surface")).toHaveCount(0);

    // A chat prompt removes only B's parked PTY, preventing dual writes to B's JSONL.
    await sendPrompt(page, "chat owns session B");
    await expect
      .poll(() => terminalStatus(page))
      .toMatchObject({
        open: false,
        suspended: true,
        sessionFile: sessionA.sessionFile,
        parkedSessionFiles: [],
        sessionCount: 1,
      });
  });
});
