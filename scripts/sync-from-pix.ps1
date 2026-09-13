# Sync read-only Pix upstream into Telos.
# Pix is never pushed to. Prefer local mirror G:\gitea\pix; fall back to Gitea mirror.
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
    param(
        [string]$Name,
        [string]$FetchUrl
    )
    $existing = & $git @GitConfig remote
    if ($existing -notcontains $Name) {
        Invoke-Git remote add $Name $FetchUrl
    } else {
        Invoke-Git remote set-url $Name $FetchUrl
    }
    # Never allow push to Pix mirrors
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
$ahead = & $git @GitConfig rev-list --count "HEAD..$upstream"
$behind = & $git @GitConfig rev-list --count "$upstream..HEAD"
Write-Host "Pix tip: $(& $git @GitConfig rev-parse --short $upstream)  |  commits to merge: $ahead  |  Telos-only commits: $behind"

if ($FetchOnly) {
    Write-Host "Fetch-only complete."
    exit 0
}

if ([int]$ahead -eq 0) {
    Write-Host "Already up to date with $upstream"
    exit 0
}

$msg = "chore: sync pix upstream $($(& $git @GitConfig rev-parse --short $upstream))"
if ($NoCommit) {
    Invoke-Git merge $upstream --no-commit --no-ff
    Write-Host "Merged $upstream with --no-commit. Resolve conflicts, then commit."
} else {
    Invoke-Git -c user.name=sheng -c user.email=sheng@local merge $upstream -m $msg
    Write-Host "Merged $upstream into Telos."
}

Write-Host @"

Next:
  1. Resolve any conflicts (prefer keeping Telos brand/product overlays).
  2. pnpm install && pnpm check
  3. Push Telos only:  .\scripts\git-sync.ps1 -Message "chore: sync pix"
  Never push to pix / pix-gitea (push URL is DISABLED_READ_ONLY).
"@
