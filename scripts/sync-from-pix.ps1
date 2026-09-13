# Sync read-only Pix source into Telos (file-tree checkout + overlay restore).
# Telos and Pix do not share commit ancestry (parallel mirror history), so this
# script replaces the tracked tree from pix/main, then restores Telos overlays.
# Never pushes to Pix.
param(
    [ValidateSet("local", "gitea", "auto")]
    [string]$Source = "auto",
    [switch]$FetchOnly,
    [switch]$NoCommit,
    [string]$RepoRoot = (Join-Path $PSScriptRoot "..")
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path $RepoRoot).Path
Set-Location $Root

$LocalPix = "G:/gitea/pix"
$GiteaPix = "ssh://git@192.168.80.3:8022/sheng/pix.git"
$SshKey = if ($env:GIT_SSH_KEY) { $env:GIT_SSH_KEY } else { Join-Path $env:USERPROFILE ".ssh\id_ed25519_gitea" }
if (-not $env:GIT_SSH_COMMAND) {
    $env:GIT_SSH_COMMAND = "ssh -p 8022 -i `"$SshKey`" -o IdentitiesOnly=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new"
}

# Paths Telos owns — restored after pix tree checkout. Extend when you add product deltas.
$TelosOverlays = @(
    "scripts/sync-from-pix.ps1",
    "scripts/git-sync.ps1",
    "TELOS-UPSTREAM.md",
    "README.md",
    "package.json",
    "apps/desktop/electron-builder.yml",
    "apps/desktop/package.json",
    "apps/desktop/playwright.config.ts",
    "apps/desktop/e2e/fixtures.ts",
    "apps/desktop/scripts/launch-env.mjs",
    "apps/desktop/scripts/after-pack.test.mjs",
    "apps/desktop/runtimes/README.md",
    "apps/desktop/src/shared/brand.ts",
    "apps/desktop/src/shared/theme-css.ts",
    "apps/desktop/src/agent-host/index.ts",
    "apps/desktop/src/main/index.ts",
    "apps/desktop/src/main/mac-install-update.ts",
    "apps/desktop/src/main/mac-install-update.test.ts",
    "apps/desktop/src/main/auto-update.test.ts",
    "apps/desktop/src/main/pi-tui-pty.ts",
    "apps/desktop/src/main/pi-tui-pty.test.ts",
    "apps/desktop/src/main/pi-tui-session.test.ts",
    "apps/desktop/src/main/pi-tui-env.ts",
    "apps/desktop/src/main/shell-path.ts",
    "apps/desktop/src/main/theme-library.ts",
    "apps/desktop/src/renderer/index.html",
    "apps/desktop/src/renderer/main.tsx",
    "apps/desktop/src/renderer/styles.css",
    "apps/desktop/src/renderer/session-content-demo.html",
    "apps/desktop/src/renderer/lib/i18n.ts",
    "apps/desktop/src/renderer/lib/workspace.ts",
    "apps/desktop/src/renderer/lib/workspace.test.ts",
    "apps/desktop/src/renderer/lib/theme-packs.ts",
    "apps/desktop/src/renderer/lib/theme-packs.test.ts",
    "apps/desktop/src/renderer/lib/composer-highlight.test.ts",
    "apps/desktop/src/renderer/components/PixLogo.tsx",
    "apps/desktop/src/renderer/components/BootstrapOverlay.tsx",
    "apps/desktop/src/renderer/components/Composer.tsx",
    "apps/desktop/src/renderer/components/PromptTokenChip.test.ts",
    "apps/desktop/src/renderer/components/settings/SettingsPage.tsx",
    "apps/desktop/src/renderer/assets/theme-skins/ATTRIBUTION.md",
    "apps/desktop/e2e/desktop.spec.ts",
    "apps/desktop/e2e/git.spec.ts",
    "apps/desktop/e2e/trust.spec.ts",
    "apps/landing/index.html",
    "apps/landing/package.json",
    "apps/landing/src/styles.css",
    "apps/landing/src/components/PixMark.tsx",
    "apps/landing/src/components/AlwaysRunning.tsx",
    "apps/landing/src/components/Faq.tsx",
    "apps/landing/src/components/Features.tsx",
    "apps/landing/src/components/Hero.tsx",
    "apps/landing/src/components/PurposeQuote.tsx",
    "apps/landing/src/components/SiteFooter.tsx",
    "apps/landing/src/components/SiteHeader.tsx",
    "apps/landing/src/components/Why.tsx",
    "apps/landing/src/components/Download.tsx"
)

function Get-GitExe {
    foreach ($c in @("git", "$env:ProgramFiles\Git\cmd\git.exe")) {
        if ($c -eq "git") {
            $cmd = Get-Command git -ErrorAction SilentlyContinue
            if ($cmd) { return $cmd.Source }
        } elseif (Test-Path $c) { return $c }
    }
    throw "git not found"
}

$git = Get-GitExe
$GitConfig = @("-c", "safe.directory=$Root")

function Invoke-Git {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$GitArgs)
    & $git @GitConfig @GitArgs
    if ($LASTEXITCODE -ne 0) { throw "git failed: $($GitArgs -join ' ')" }
}

function Ensure-ReadOnlyRemote {
    param([string]$Name, [string]$FetchUrl)
    $existing = & $git @GitConfig remote
    if ($existing -notcontains $Name) {
        Invoke-Git remote add $Name $FetchUrl
    } else {
        Invoke-Git remote set-url $Name $FetchUrl
    }
    Invoke-Git remote set-url --push $Name "DISABLED_READ_ONLY"
}

Ensure-ReadOnlyRemote -Name "pix" -FetchUrl $LocalPix
Ensure-ReadOnlyRemote -Name "pix-gitea" -FetchUrl $GiteaPix

$dirty = & $git @GitConfig status --porcelain
if ($dirty -and -not $FetchOnly) {
    throw "Working tree is dirty. Commit or stash Telos changes before syncing Pix."
}

$remote = $null
if ($Source -eq "local" -or ($Source -eq "auto" -and (Test-Path (Join-Path $LocalPix ".git")))) {
    $remote = "pix"
} elseif ($Source -eq "gitea" -or $Source -eq "auto") {
    $remote = "pix-gitea"
} else {
    throw "Local Pix mirror not found at $LocalPix. Use -Source gitea or clone Pix first."
}

Write-Host "Fetching read-only upstream: $remote"
Invoke-Git fetch $remote --tags
$upstream = "$remote/main"
$tip = & $git @GitConfig rev-parse --short $upstream
Write-Host "Pix tip: $tip"

if ($FetchOnly) {
    Write-Host "Fetch-only complete."
    exit 0
}

$stampFile = Join-Path $Root ".pix-sync-revision"
$prev = if (Test-Path $stampFile) { (Get-Content $stampFile -Raw).Trim() } else { "" }
$fullTip = & $git @GitConfig rev-parse $upstream
if ($prev -eq $fullTip) {
    Write-Host "Already synced to $tip"
    exit 0
}

$backup = Join-Path ([System.IO.Path]::GetTempPath()) ("telos-overlay-" + [guid]::NewGuid().ToString("n"))
New-Item -ItemType Directory -Path $backup | Out-Null
try {
    foreach ($rel in $TelosOverlays) {
        $src = Join-Path $Root $rel
        if (Test-Path $src) {
            $dest = Join-Path $backup $rel
            $destDir = Split-Path $dest -Parent
            if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
            Copy-Item -LiteralPath $src -Destination $dest -Force
        }
    }

    Write-Host "Checking out tree from $upstream ..."
    Invoke-Git checkout $upstream -- .

    foreach ($rel in $TelosOverlays) {
        $saved = Join-Path $backup $rel
        if (Test-Path $saved) {
            $dest = Join-Path $Root $rel
            $destDir = Split-Path $dest -Parent
            if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
            Copy-Item -LiteralPath $saved -Destination $dest -Force
            Invoke-Git add -- $rel
        }
    }

    Set-Content -Path $stampFile -Value $fullTip -Encoding ascii
    Invoke-Git add -- .pix-sync-revision

    $pending = & $git @GitConfig status --porcelain
    if (-not $pending) {
        Write-Host "Tree already matches overlays + pix@$tip"
        exit 0
    }

    $msg = "chore: sync pix@$tip into telos"
    if ($NoCommit) {
        Write-Host "Synced pix@$tip with overlays restored (not committed). Review then commit."
    } else {
        Invoke-Git -c user.name=sheng -c user.email=sheng@local commit -m $msg
        Write-Host "Committed: $msg"
    }
}
finally {
    Remove-Item -LiteralPath $backup -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host @"

Next:
  1. pnpm install && pnpm check
  2. Push Telos only: .\scripts\git-sync.ps1 -Message "chore: sync pix"
  Never push to pix / pix-gitea.
  Overlay list: scripts/sync-from-pix.ps1 (`$TelosOverlays)
"@
