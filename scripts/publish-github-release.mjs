#!/usr/bin/env node
/**
 * 仅发布 Windows 安装包到 GitHub Releases（不推源码 / README / 其它文件）。
 *
 * 参考：
 * - G:/gitea/BookmarkSync-src/scripts/publish-github-release.mjs
 * - G:/gitea/snaplog/scripts/publish-release.ps1
 * - G:/gitea/SrvDesk（Release 只挂二进制）
 *
 * 目标仓库固定：https://github.com/gygy/telos
 *
 * 用法：
 *   node scripts/publish-github-release.mjs
 *   node scripts/publish-github-release.mjs v0.7.5
 *
 * 凭据：GITHUB_TOKEN / GH_TOKEN，或 git credential（github.com）
 */
import { execFileSync, execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OWNER = "gygy";
const REPO = "telos";
const API = `https://api.github.com/repos/${OWNER}/${REPO}`;
const UPLOADS = `https://uploads.github.com/repos/${OWNER}/${REPO}`;

const versionArg = process.argv[2]?.trim();
const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
const ver = (versionArg || pkg.version).replace(/^v/, "");
const tag = `v${ver}`;
const releaseDir = join(ROOT, "release");

const ASSETS = [
	{ name: "latest.yml", path: join(releaseDir, "latest.yml"), contentType: "text/yaml" },
	{ name: `Telos-${ver}-setup.exe`, path: join(releaseDir, `Telos-${ver}-setup.exe`), contentType: "application/octet-stream" },
	{ name: `Telos-${ver}-setup.exe.blockmap`, path: join(releaseDir, `Telos-${ver}-setup.exe.blockmap`), contentType: "application/octet-stream" },
	{ name: `Telos-${ver}-portable.exe`, path: join(releaseDir, `Telos-${ver}-portable.exe`), contentType: "application/octet-stream" },
	{ name: `Telos-${ver}-win.zip`, path: join(releaseDir, `Telos-${ver}-win.zip`), contentType: "application/octet-stream" },
];

function tokenFromGitCredential() {
	try {
		const out = execSync("git credential fill", {
			input: "protocol=https\nhost=github.com\n\n",
			encoding: "utf8",
			stdio: ["pipe", "pipe", "pipe"],
			timeout: 45000,
		});
		const match = out.match(/^password=(.+)$/m);
		return match?.[1]?.trim() || "";
	} catch {
		return "";
	}
}

function resolveToken() {
	return (
		process.env.GITHUB_TOKEN?.trim() ||
		process.env.GH_TOKEN?.trim() ||
		tokenFromGitCredential()
	);
}

async function ghRequest(path, { method = "GET", headers = {}, body } = {}) {
	const token = resolveToken();
	if (!token) {
		throw new Error("Missing GitHub token: set GITHUB_TOKEN or configure git credential for github.com");
	}
	const res = await fetch(`https://api.github.com${path}`, {
		method,
		headers: {
			Authorization: `token ${token}`,
			Accept: "application/vnd.github+json",
			"X-GitHub-Api-Version": "2022-11-28",
			"User-Agent": "telos-publish-github-release",
			...headers,
		},
		body,
	});
	const text = await res.text();
	let json = null;
	try {
		json = text ? JSON.parse(text) : null;
	} catch {
		json = { raw: text };
	}
	if (!res.ok) {
		throw new Error(json?.message || `GitHub API ${res.status}: ${text}`);
	}
	return json;
}

function latestChangelogSection() {
	const text = readFileSync(join(ROOT, "CHANGELOG.md"), "utf8");
	const start = text.search(/^## /m);
	if (start < 0) return "";
	const rest = text.slice(start);
	const next = rest.slice(1).search(/^## /m);
	return (next < 0 ? rest : rest.slice(0, next + 1)).trim();
}

function ensureAssetsExist() {
	for (const asset of ASSETS) {
		if (!existsSync(asset.path)) {
			throw new Error(`Missing asset: ${asset.path}\nRun: npm run dist:win`);
		}
	}
}

async function ensureReleaseAnchor(token) {
	// Prefer "already has a release or commits" over GitHub's size===0 (tiny repos still report size 0).
	try {
		await ghRequest(`/repos/${OWNER}/${REPO}/releases/tags/${tag}`);
		return;
	} catch {
		// no release yet
	}
	try {
		const commits = await ghRequest(`/repos/${OWNER}/${REPO}/commits?sha=main&per_page=1`);
		if (Array.isArray(commits) && commits.length > 0) return;
	} catch (error) {
		const msg = String(error.message || error);
		if (!/empty|Conflict|Git Repository is empty/i.test(msg)) {
			console.warn("commit probe:", msg);
		}
	}

	console.log("Repo has no commits; pushing empty release-anchor commit (no README/source)…");
	const tmp = join(tmpdir(), `telos-gh-anchor-${Date.now()}`);
	mkdirSync(tmp, { recursive: true });
	const basic = Buffer.from(`x-access-token:${token}`).toString("base64");
	try {
		execFileSync("git", ["init", "-q"], { cwd: tmp, stdio: "inherit" });
		execFileSync("git", ["checkout", "-q", "-b", "main"], { cwd: tmp, stdio: "inherit" });
		execFileSync(
			"git",
			["-c", "user.email=release@telos.local", "-c", "user.name=Telos Release", "commit", "--allow-empty", "-m", "chore: release anchor (binaries via GitHub Releases only)"],
			{ cwd: tmp, stdio: "inherit" },
		);
		execFileSync(
			"git",
			["-c", `http.https://github.com/.extraheader=AUTHORIZATION: basic ${basic}`, "push", `https://github.com/${OWNER}/${REPO}.git`, "HEAD:main"],
			{ cwd: tmp, stdio: "inherit" },
		);
		console.log("Pushed empty anchor to github/main");
	} finally {
		rmSync(tmp, { recursive: true, force: true });
	}
}

async function uploadAsset(releaseId, asset) {
	const token = resolveToken();
	const data = readFileSync(asset.path);
	const mb = (data.length / (1024 * 1024)).toFixed(1);
	console.log(`Uploading ${asset.name} (${mb} MB)…`);
	const res = await fetch(`${UPLOADS}/releases/${releaseId}/assets?name=${encodeURIComponent(asset.name)}`, {
		method: "POST",
		headers: {
			Authorization: `token ${token}`,
			Accept: "application/vnd.github+json",
			"Content-Type": asset.contentType,
			"Content-Length": String(data.length),
			"User-Agent": "telos-publish-github-release",
		},
		body: data,
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Upload failed ${asset.name}: ${res.status} ${text}`);
	}
	const json = await res.json();
	console.log(`  OK ${json.browser_download_url}`);
}

async function main() {
	const token = resolveToken();
	if (!token) {
		throw new Error("Missing GitHub token: set GITHUB_TOKEN or configure git credential for github.com");
	}
	ensureAssetsExist();
	await ensureReleaseAnchor(token);

	const notes = latestChangelogSection();
	const body = [
		`Telos ${tag}`,
		"",
		notes,
		"",
		"Windows packages:",
		"",
		`- \`Telos-${ver}-setup.exe\` — installer (electron-updater)`,
		`- \`Telos-${ver}-portable.exe\` — portable`,
		`- \`Telos-${ver}-win.zip\` — zip`,
	].join("\n");

	let release;
	try {
		release = await ghRequest(`/repos/${OWNER}/${REPO}/releases/tags/${tag}`);
		console.log(`Reuse release ${tag}: ${release.html_url}`);
	} catch {
		release = await ghRequest(`/repos/${OWNER}/${REPO}/releases`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				tag_name: tag,
				target_commitish: "main",
				name: `Telos ${tag}`,
				body,
				draft: false,
				prerelease: false,
			}),
		});
		console.log(`Created release ${tag}: ${release.html_url}`);
	}

	const existing = await ghRequest(`/repos/${OWNER}/${REPO}/releases/${release.id}/assets?per_page=100`);
	for (const asset of ASSETS) {
		for (const old of (existing || []).filter((a) => a.name === asset.name)) {
			await ghRequest(`/repos/${OWNER}/${REPO}/releases/assets/${old.id}`, { method: "DELETE" });
			console.log(`Deleted old asset: ${asset.name}`);
		}
	}

	for (const asset of ASSETS) {
		await uploadAsset(release.id, asset);
	}

	console.log(`\nDone: https://github.com/${OWNER}/${REPO}/releases/tag/${tag}`);
}

main().catch((error) => {
	console.error("ERROR:", error.message || error);
	process.exit(1);
});
