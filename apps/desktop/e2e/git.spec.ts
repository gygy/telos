import { execFile } from "node:child_process";
import { access, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import { expect, startHost, test } from "./fixtures.ts";

const execFileAsync = promisify(execFile);

async function git(cwd: string, ...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    env: { ...process.env, GIT_TERMINAL_PROMPT: "0" },
    timeout: 20_000,
  });
  return stdout.trim();
}

async function exists(path: string): Promise<boolean> {
  return access(path).then(
    () => true,
    () => false,
  );
}

function normalizeMacPathAlias(path: string | undefined): string | undefined {
  return path?.replace(/^\/private/, "");
}

async function createLocalGitFixture(root: string) {
  const repo = join(root, "git-repo");
  const remote = join(root, "git-remote.git");
  await mkdir(repo, { recursive: true });
  await git(repo, "init", "-b", "main");
  await git(repo, "config", "user.name", "Telos E2E");
  await git(repo, "config", "user.email", "Telos-e2e@example.invalid");
  await writeFile(join(repo, "README.md"), "# Telos Git E2E\n");
  await git(repo, "add", "README.md");
  await git(repo, "commit", "-m", "test: initial fixture");
  await git(root, "clone", "--bare", repo, remote);
  await git(repo, "remote", "add", "origin", remote);
  await git(repo, "push", "-u", "origin", "main");
  return { repo, remote };
}

test.describe("Desktop Git E2E", () => {
  test("manages isolated local branches, remotes, status, and worktrees", async ({ page, Telos }) => {
    const { repo, remote } = await createLocalGitFixture(Telos.root);
    const worktreeRoot = join(Telos.root, "managed-worktrees");

    await startHost(page);
    const initial = await page.evaluate(async (cwd) => {
      await window.Telos.workspace.openPath(cwd, { resumeRecent: false });
      const [context, branches, prefs] = await Promise.all([
        window.Telos.workspace.getGitContext(cwd),
        window.Telos.workspace.listGitBranches(cwd),
        window.Telos.workspace.setGitPrefs({
          branchPrefix: "Telos/",
          pullMode: "squash",
          forcePush: true,
          draftPr: true,
          customCommitCommand: "Use a concise test commit message",
          customPrCommand: "Use a concise test pull request description",
        }),
      ]);
      return { context, branches, prefs };
    }, repo);
    expect(initial.context).toMatchObject({
      branch: "main",
      worktree: "本地",
      isMainWorktree: true,
      mainWorktreePath: repo,
      worktreePath: repo,
    });
    expect(initial.branches).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "main", current: true })]),
    );
    expect(initial.prefs).toMatchObject({
      branchPrefix: "Telos/",
      pullMode: "squash",
      forcePush: true,
      draftPr: true,
      customCommitCommand: "Use a concise test commit message",
      customPrCommand: "Use a concise test pull request description",
    });

    const branch = await page.evaluate(async (cwd) => {
      await window.Telos.workspace.createGitBranch("release", { checkout: false, cwd });
      const afterCreate = await window.Telos.workspace.getGitContext(cwd);
      const checkedOut = await window.Telos.workspace.checkoutGitBranch("Telos/release", cwd);
      const branches = await window.Telos.workspace.listGitBranches(cwd);
      return { afterCreate, checkedOut, branches };
    }, repo);
    expect(branch.afterCreate.branch).toBe("main");
    expect(branch.checkedOut.branch).toBe("Telos/release");
    expect(branch.branches).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: "Telos/release", current: true })]),
    );

    await writeFile(join(repo, "local-change.txt"), "first local change\n");
    const afterCommit = await page.evaluate(async (cwd) => {
      const before = await window.Telos.workspace.gitStatus(cwd);
      const committed = await window.Telos.workspace.gitCommit("test: commit through Telos", cwd);
      const pushed = await window.Telos.workspace.gitPush(cwd);
      return { before, committed, pushed };
    }, repo);
    expect(afterCommit.before).toMatchObject({ clean: false, branch: "Telos/release" });
    expect(afterCommit.before.changes).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "local-change.txt", status: "??" })]),
    );
    expect(afterCommit.committed.clean).toBe(true);
    expect(afterCommit.pushed).toMatchObject({ clean: true, upstream: "origin/Telos/release" });
    await expect
      .poll(() => git(repo, "--git-dir", remote, "rev-parse", "refs/heads/Telos/release"))
      .toMatch(/^[0-9a-f]{40}$/);

    const clone = join(Telos.root, "remote-writer");
    await git(Telos.root, "clone", "--branch", "Telos/release", remote, clone);
    await git(clone, "config", "user.name", "Telos Remote E2E");
    await git(clone, "config", "user.email", "Telos-remote@example.invalid");
    await writeFile(join(clone, "remote-change.txt"), "change from local bare remote\n");
    await git(clone, "add", "remote-change.txt");
    await git(clone, "commit", "-m", "test: remote change");
    await git(clone, "push", "origin", "Telos/release");

    const pulled = await page.evaluate(async (cwd) => {
      await window.Telos.workspace.setGitPrefs({ pullMode: "merge", forcePush: false });
      return window.Telos.workspace.gitPull(cwd);
    }, repo);
    expect(pulled).toMatchObject({ clean: true, branch: "Telos/release", ahead: 1, behind: 0 });
    expect(await exists(join(repo, "remote-change.txt"))).toBe(true);

    await writeFile(join(repo, "combined-change.txt"), "commit and push from Telos\n");
    const combined = await page.evaluate(async (cwd) => {
      const generated = await window.Telos.workspace.gitGenerateCommitMessage(cwd);
      const result = await window.Telos.workspace.gitCommitAndPush(generated, cwd);
      return { generated, result };
    }, repo);
    expect(combined.generated).toContain("Telos fake model response");
    expect(combined.result).toMatchObject({ clean: true, upstream: "origin/Telos/release" });

    await Telos.app.evaluate(({ shell }) => {
      const state = globalThis as typeof globalThis & { __pixGitPrUrl?: string };
      Object.defineProperty(shell, "openExternal", {
        configurable: true,
        value: async (url: string) => {
          state.__pixGitPrUrl = url;
        },
      });
    });
    await git(repo, "remote", "set-url", "origin", "git@github.com:Telos/e2e.git");
    await page.evaluate(async (cwd) => {
      await window.Telos.workspace.openCreatePullRequest(cwd);
    }, repo);
    const pullRequestUrl = await Telos.app.evaluate(
      () => (globalThis as typeof globalThis & { __pixGitPrUrl?: string }).__pixGitPrUrl,
    );
    expect(pullRequestUrl).toBe(
      "https://github.com/Telos/e2e/compare/Telos%2Frelease?expand=1&draft=true",
    );

    const worktrees = await page.evaluate(
      async ({ cwd, root }) => {
        const prefs = await window.Telos.workspace.setWorktreePrefs({
          rootConfigured: root,
          autoDelete: false,
          autoDeleteLimit: 1,
        });
        const first = await window.Telos.workspace.createGitWorktree({
          cwd,
          name: "first-worktree",
          newBranch: "first-worktree",
        });
        const listed = await window.Telos.workspace.listGitWorktrees(cwd);
        const managed = await window.Telos.workspace.listManagedWorktrees();
        let mainRemovalError = "";
        try {
          await window.Telos.workspace.removeGitWorktree(cwd, cwd);
        } catch (error) {
          mainRemovalError = error instanceof Error ? error.message : String(error);
        }
        await window.Telos.workspace.setWorktreePrefs({ autoDelete: true, autoDeleteLimit: 1 });
        const second = await window.Telos.workspace.createGitWorktree({
          cwd,
          name: "second-worktree",
          newBranch: "second-worktree",
          branch: "Telos/release",
        });
        const afterPrune = await window.Telos.workspace.listManagedWorktrees();
        const removed = await window.Telos.workspace.removeGitWorktree(second.path, cwd);
        return { prefs, first, second, listed, managed, mainRemovalError, afterPrune, removed };
      },
      { cwd: repo, root: worktreeRoot },
    );
    expect(worktrees.prefs).toMatchObject({
      root: worktreeRoot,
      rootConfigured: worktreeRoot,
      autoDelete: false,
      autoDeleteLimit: 1,
    });
    expect(worktrees.first.context).toMatchObject({
      branch: "Telos/first-worktree",
      isMainWorktree: false,
      worktreePath: worktrees.first.path,
    });
    expect(normalizeMacPathAlias(worktrees.first.context.mainWorktreePath)).toBe(repo);
    expect(
      worktrees.listed.some(
        (worktree) =>
          normalizeMacPathAlias(worktree.path) === repo &&
          worktree.main === true &&
          worktree.branch === "Telos/release",
      ),
    ).toBe(true);
    expect(
      worktrees.listed.some(
        (worktree) =>
          normalizeMacPathAlias(worktree.path) === worktrees.first.path &&
          worktree.branch === "Telos/first-worktree",
      ),
    ).toBe(true);
    expect(
      worktrees.managed.some(
        (worktree) => normalizeMacPathAlias(worktree.path) === worktrees.first.path,
      ),
    ).toBe(true);
    expect(worktrees.mainRemovalError).toMatch(/不能删除主工作树/);
    expect(await exists(worktrees.first.path)).toBe(false);
    expect(
      worktrees.afterPrune.some(
        (worktree) => normalizeMacPathAlias(worktree.path) === worktrees.second.path,
      ),
    ).toBe(true);
    expect(
      worktrees.afterPrune.some(
        (worktree) => normalizeMacPathAlias(worktree.path) === worktrees.first.path,
      ),
    ).toBe(false);
    expect(worktrees.removed).toEqual({ removed: worktrees.second.path });
    expect(await exists(worktrees.second.path)).toBe(false);
  });
});
