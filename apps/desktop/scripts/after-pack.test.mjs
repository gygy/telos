/**
 * Smoke for after-pack.mjs app-update.yml generation.
 * Run: node apps/desktop/scripts/after-pack.test.mjs
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  assertBundledRuntimeResources,
  serializeAppUpdateYml,
  writeAppUpdateYml,
} from "./after-pack.mjs";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

{
  const yml = serializeAppUpdateYml(
    {
      provider: "github",
      owner: "num-scope",
      repo: "pix",
      releaseType: "release",
    },
    "@pixdesktop-updater",
  );
  assert(yml.includes("provider: github"), "provider line");
  assert(yml.includes("owner: num-scope"), "owner line");
  assert(yml.includes("repo: pix"), "repo line");
  assert(yml.includes("releaseType: release"), "releaseType line");
  assert(yml.includes('updaterCacheDirName: "@pixdesktop-updater"'), "quoted cache dir");
}

{
  const root = mkdtempSync(join(tmpdir(), "pix-after-pack-"));
  try {
    const appOutDir = join(root, "mac-arm64");
    const resources = join(appOutDir, "Pix.app", "Contents", "Resources");
    mkdirSync(resources, { recursive: true });
    writeFileSync(join(resources, "app.asar"), "placeholder");

    const written = writeAppUpdateYml({
      electronPlatformName: "darwin",
      appOutDir,
      packager: {
        config: {
          publish: {
            provider: "github",
            owner: "num-scope",
            repo: "pix",
            releaseType: "release",
          },
        },
        appInfo: {
          productFilename: "Pix",
          name: "@pix/desktop",
          updaterCacheDirName: "@pixdesktop-updater",
        },
      },
    });
    assert(written === true, "writeAppUpdateYml returns true");
    const dest = join(resources, "app-update.yml");
    const body = readFileSync(dest, "utf8");
    assert(body.includes("provider: github"), "written provider");
    assert(body.includes("owner: num-scope"), "written owner");
    assert(body.includes('updaterCacheDirName: "@pixdesktop-updater"'), "written cache dir");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

{
  // Windows layout: resources/ under appOutDir
  const root = mkdtempSync(join(tmpdir(), "pix-after-pack-win-"));
  try {
    const appOutDir = join(root, "win-unpacked");
    const resources = join(appOutDir, "resources");
    mkdirSync(resources, { recursive: true });
    const written = writeAppUpdateYml({
      electronPlatformName: "win32",
      appOutDir,
      packager: {
        config: {
          publish: {
            provider: "github",
            owner: "num-scope",
            repo: "pix",
          },
        },
        appInfo: {
          productFilename: "Pix",
          updaterCacheDirName: "@pixdesktop-updater",
        },
      },
    });
    assert(written === true, "win write");
    const body = readFileSync(join(resources, "app-update.yml"), "utf8");
    assert(body.includes("provider: github"), "win provider");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

{
  const root = mkdtempSync(join(tmpdir(), "pix-after-pack-runtimes-"));
  try {
    const resources = join(root, "resources");
    mkdirSync(join(resources, "runtimes", "archives"), { recursive: true });
    let threw = false;
    try {
      assertBundledRuntimeResources(resources);
    } catch {
      threw = true;
    }
    assert(threw, "missing archives must fail the pack");

    writeFileSync(join(resources, "runtimes", "manifest.json"), "{}");
    writeFileSync(join(resources, "runtimes", "archives", "node.tar.gz"), "n");
    writeFileSync(join(resources, "runtimes", "archives", "python.tar.gz"), "p");
    assertBundledRuntimeResources(resources);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

console.log("after-pack.test.mjs: ok");
// Keep import side-effect free for electron-builder default export.
void pathToFileURL;
