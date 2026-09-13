# Sync read-only PiDeck (pideck-github) into Telos.
# Modes:
#   -Status              list commits after baseline
#   -FetchOnly           fetch remotes only
#   -Paths a,b           selective checkout of paths from upstream
#   (default)            full tree checkout + restore Telos overlays
#   -UpdateBaseline      advance .upstream/pideck-baseline.json to tip
#                        (alone = bump only; with default/-Paths = after sync)
# Never pushes to PiDeck.
param(
    [ValidateSet("local", "gitea", "github", "auto")]
    [string]$Source = "auto",
    [switch]$FetchOnly,
    [switch]$Status,
    [switch]$UpdateBaseline,
    [switch]$NoCommit,
    [string[]]$Paths = @(),
    [string]$RepoRoot = (Join-Path $PSScriptRoot "..")
)

$ErrorActionPreference = "Stop"
$Root = (Resolve-Path $RepoRoot).Path
Set-Location $Root

$LocalPideck = "G:/gitea/pideck-github"
$GiteaPideck = "ssh://git@192.168.80.3:8022/sheng/pideck-github.git"
$GithubPideck = "https://github.com/ayuayue/PiDeck.git"
$BaselinePath = Join-Path $Root ".upstream\pideck-baseline.json"
$SshKey = if ($env:GIT_SSH_KEY) { $env:GIT_SSH_KEY } else { Join-Path $env:USERPROFILE ".ssh\id_ed25519_gitea" }
if (-not $env:GIT_SSH_COMMAND) {
    $env:GIT_SSH_COMMAND = "ssh -p 8022 -i `"$SshKey`" -o IdentitiesOnly=yes -o ConnectTimeout=15 -o StrictHostKeyChecking=accept-new"
}

$TelosOverlays = @(
    "scripts/sync-from-pideck.ps1",
    "scripts/git-sync.ps1",
    "TELOS-UPSTREAM.md",
    ".upstream/pideck-baseline.json",
    "README.md",
    "package.json",
    "src/renderer/src/App.tsx",
    "src/renderer/src/components/app/TelosLogo.tsx",
    "src/renderer/src/components/app/LogoMark.tsx",
    "src/renderer/src/components/app/AppParts.tsx",
    "src/renderer/src/components/app/AboutPopover.tsx",
    "src/renderer/src/components/app/brandMark.ts",
    "src/renderer/src/web/WebBrandLockup.tsx",
    "src/renderer/src/i18n/rendererCopy.zh-CN.ts",
    "src/renderer/src/i18n/rendererCopy.en-US.ts",
    "src/renderer/index.html",
    "src/renderer/src/styles/foundation.css",
    "build/icon.svg",
    "scripts/make-icon.js"
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

function Read-Baseline {
    if (-not (Test-Path $BaselinePath)) { throw "Missing baseline: $BaselinePath" }
    return Get-Content $BaselinePath -Raw -Encoding UTF8 | ConvertFrom-Json
}

function Write-BaselineFromTip {
    param([string]$RemoteName, [string]$TipRef)
    $commit = (& $git @GitConfig rev-parse $TipRef).Trim()
    $short = (& $git @GitConfig rev-parse --short $TipRef).Trim()
    $subject = (& $git @GitConfig log -1 --format="%s" $TipRef).Trim()
    $author = (& $git @GitConfig log -1 --format="%an <%ae>" $TipRef).Trim()
    $authored = (& $git @GitConfig log -1 --format="%aI" $TipRef).Trim()
    $committed = (& $git @GitConfig log -1 --format="%cI" $TipRef).Trim()
    $now = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    $doc = Read-Baseline
    $doc.baseline.commit = $commit
    $doc.baseline.short = $short
    $doc.baseline.subject = $subject
    $doc.baseline.author = $author
    $doc.baseline.authoredAt = $authored
    $doc.baseline.committedAt = $committed
    $doc.baseline.recordedAt = $now
    $doc.baseline.note = "Baseline advanced after Telos sync from $RemoteName."
    $json = $doc | ConvertTo-Json -Depth 8
    $dir = Split-Path $BaselinePath -Parent
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    [System.IO.File]::WriteAllText($BaselinePath, $json + "`n", [System.Text.UTF8Encoding]::new($false))
    Write-Host "Baseline updated -> $short ($commit)"
}

Ensure-ReadOnlyRemote -Name "pideck" -FetchUrl $LocalPideck
Ensure-ReadOnlyRemote -Name "pideck-gitea" -FetchUrl $GiteaPideck
Ensure-ReadOnlyRemote -Name "pideck-github" -FetchUrl $GithubPideck

if ($Source -eq "local" -or ($Source -eq "auto" -and (Test-Path (Join-Path $LocalPideck ".git")))) {
    $remote = "pideck"
} elseif ($Source -eq "github") {
    $remote = "pideck-github"
} else {
    $remote = "pideck-gitea"
}

Write-Host "Fetching read-only upstream: $remote"
# Avoid failing when leftover tags from a previous upstream clash.
Invoke-Git fetch $remote "refs/heads/main:refs/remotes/$remote/main"
$upstream = "$remote/main"
$tip = (& $git @GitConfig rev-parse --short $upstream).Trim()
$tipFull = (& $git @GitConfig rev-parse $upstream).Trim()
Write-Host "Upstream tip: $tip"

$baseline = Read-Baseline
$baseCommit = [string]$baseline.baseline.commit
Write-Host "Baseline: $($baseline.baseline.short) 鈥?$($baseline.baseline.subject)"

if ($FetchOnly) {
    Write-Host "Fetch-only complete."
    exit 0
}

if ($Status) {
    Write-Host ""
    Write-Host "Commits on $upstream after baseline:"
    Write-Host "------------------------------------------------------------"
    & $git @GitConfig log --oneline --no-decorate "$baseCommit..$upstream"
    if ($LASTEXITCODE -ne 0) { throw "Cannot list range $baseCommit..$upstream" }
    $count = (& $git @GitConfig rev-list --count "$baseCommit..$upstream").Trim()
    Write-Host "------------------------------------------------------------"
    Write-Host "Total: $count commit(s)."
    exit 0
}

# -UpdateBaseline alone (no -Paths and no full sync intent via TELOS_FULL_SYNC)
$bumpOnly = $UpdateBaseline -and $Paths.Count -eq 0 -and ($env:TELOS_FULL_SYNC -ne "1")
# Default invocation (no UpdateBaseline, no Paths) => full sync
$doFull = (-not $UpdateBaseline -and $Paths.Count -eq 0) -or ($env:TELOS_FULL_SYNC -eq "1")
$doPaths = $Paths.Count -gt 0
# Allow: full/path sync AND then bump when -UpdateBaseline combined with TELOS_FULL_SYNC=1 or -Paths
if ($UpdateBaseline -and $Paths.Count -gt 0) { $doPaths = $true; $bumpOnly = $false }
if ($UpdateBaseline -and $env:TELOS_FULL_SYNC -eq "1") { $doFull = $true; $bumpOnly = $false }

if ($bumpOnly) {
    Write-BaselineFromTip -RemoteName $remote -TipRef $upstream
    Invoke-Git add -- ".upstream/pideck-baseline.json"
    if (-not $NoCommit) {
        $st = & $git @GitConfig status --porcelain -- ".upstream/pideck-baseline.json"
        if ($st) {
            Invoke-Git -c user.name=sheng -c user.email=sheng@local commit -m "chore: advance pideck baseline to $tip"
        }
    }
    exit 0
}

$dirty = & $git @GitConfig status --porcelain
if ($dirty) {
    throw "Working tree is dirty. Commit or stash before syncing PiDeck."
}

if ($doPaths) {
    Write-Host "Selective checkout from $upstream :"
    foreach ($p in $Paths) { Write-Host "  - $p" }
    Invoke-Git checkout $upstream -- @Paths
    if ($UpdateBaseline) {
        Write-BaselineFromTip -RemoteName $remote -TipRef $upstream
        Invoke-Git add -- ".upstream/pideck-baseline.json"
    }
    Write-Host "Selective sync done. Review, commit, then optionally -UpdateBaseline if not already set."
    exit 0
}

# Full sync
$backup = Join-Path ([System.IO.Path]::GetTempPath()) ("telos-overlay-" + [guid]::NewGuid().ToString("n"))
New-Item -ItemType Directory -Path $backup | Out-Null
try {
    foreach ($rel in $TelosOverlays) {
        $srcPath = Join-Path $Root $rel
        if (Test-Path $srcPath) {
            $dest = Join-Path $backup $rel
            $destDir = Split-Path $dest -Parent
            if (-not (Test-Path $destDir)) { New-Item -ItemType Directory -Path $destDir -Force | Out-Null }
            Copy-Item -LiteralPath $srcPath -Destination $dest -Force
        }
    }

    Write-Host "Checking out full tree from $upstream ..."
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

    if ($UpdateBaseline) {
        Write-BaselineFromTip -RemoteName $remote -TipRef $upstream
        Invoke-Git add -- ".upstream/pideck-baseline.json"
    }

    $pending = & $git @GitConfig status --porcelain
    if (-not $pending) {
        Write-Host "Already matches overlays + pideck@$tip"
        exit 0
    }

    $msg = "chore: sync pideck@$tip into telos"
    if ($NoCommit) {
        Write-Host "Synced pideck@$tip (not committed)."
    } else {
        Invoke-Git -c user.name=sheng -c user.email=sheng@local commit -m $msg
        Write-Host "Committed: $msg"
    }
}
finally {
    Remove-Item -LiteralPath $backup -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "Push Telos only via .\scripts\git-sync.ps1 鈥?never push pideck remotes."
