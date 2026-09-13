# 仅发布 Windows 安装包到 GitHub Releases（不推源码 / README / 其它文件）。
# 参考：G:\gitea\BookmarkSync-src\scripts\publish-github-release.mjs、
#       G:\gitea\snaplog\scripts\publish-release.ps1、
#       G:\gitea\SrvDesk 的「Release 只挂二进制」做法。
#
# 目标仓库固定：https://github.com/gygy/telos
#
# 前置：
#   1. 已打好包：npm run dist:win → release/Telos-*-setup.exe 等
#   2. GitHub 凭据：git credential（github.com）或环境变量 GITHUB_TOKEN
#
# 用法：
#   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/publish-github-release.ps1
#   powershell ... -File scripts/publish-github-release.ps1 -Tag v0.7.5
param(
    [string]$Tag,
    [string]$RepoRoot = (Join-Path $PSScriptRoot "..")
)

$ErrorActionPreference = "Stop"
$root = (Resolve-Path $RepoRoot).Path
$owner = "gygy"
$repo = "telos"
$api = "https://api.github.com/repos/$owner/$repo"
$uploads = "https://uploads.github.com/repos/$owner/$repo"

$pkg = Get-Content (Join-Path $root "package.json") -Raw | ConvertFrom-Json
$ver = [string]$pkg.version
if (-not $Tag) { $Tag = "v$ver" }
$verNoV = $Tag.TrimStart("v")

$releaseDir = Join-Path $root "release"
$assets = @(
    @{ path = Join-Path $releaseDir "latest.yml"; name = "latest.yml"; contentType = "text/yaml" },
    @{ path = Join-Path $releaseDir "Telos-$verNoV-setup.exe"; name = "Telos-$verNoV-setup.exe"; contentType = "application/octet-stream" },
    @{ path = Join-Path $releaseDir "Telos-$verNoV-setup.exe.blockmap"; name = "Telos-$verNoV-setup.exe.blockmap"; contentType = "application/octet-stream" },
    @{ path = Join-Path $releaseDir "Telos-$verNoV-portable.exe"; name = "Telos-$verNoV-portable.exe"; contentType = "application/octet-stream" },
    @{ path = Join-Path $releaseDir "Telos-$verNoV-win.zip"; name = "Telos-$verNoV-win.zip"; contentType = "application/octet-stream" }
)

foreach ($a in $assets) {
    if (-not (Test-Path -LiteralPath $a.path)) {
        throw "缺少附件：$($a.path)`n请先运行 npm run dist:win"
    }
}

function Get-GitHubToken {
    if ($env:GITHUB_TOKEN) { return $env:GITHUB_TOKEN.Trim() }
    if ($env:GH_TOKEN) { return $env:GH_TOKEN.Trim() }
    $fill = "protocol=https`nhost=github.com`n`n" | git credential fill 2>$null
    foreach ($line in $fill) {
        if ($line -match "^password=(.+)$") { return $Matches[1].Trim() }
    }
    throw "缺少 GitHub Token：设置 GITHUB_TOKEN，或配置 git credential（github.com）"
}

function Invoke-GitHubApi {
    param(
        [string]$Method = "GET",
        [Parameter(Mandatory = $true)][string]$Uri,
        [string]$Body,
        [string]$ContentType = "application/json"
    )
    $headers = @{
        Authorization = "token $script:token"
        Accept        = "application/vnd.github+json"
        "User-Agent"  = "telos-publish-github-release"
        "X-GitHub-Api-Version" = "2022-11-28"
    }
    if ($PSBoundParameters.ContainsKey("Body") -and $null -ne $Body) {
        return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $headers -ContentType $ContentType -Body $Body
    }
    return Invoke-RestMethod -Method $Method -Uri $Uri -Headers $headers
}

$script:token = Get-GitHubToken
Write-Host "GitHub 目标：https://github.com/$owner/$repo  tag=$Tag"

# 空仓库无法打 tag：若尚无 commit，推一个无文件空提交作 Release 锚点（不带 README/源码）。
$repoInfo = Invoke-GitHubApi -Uri $api
if ([int]$repoInfo.size -eq 0) {
    Write-Host "仓库为空，创建无文件锚点提交…"
    $tmp = Join-Path $env:TEMP ("telos-gh-anchor-" + [guid]::NewGuid().ToString("n"))
    New-Item -ItemType Directory -Force -Path $tmp | Out-Null
    $basic = [Convert]::ToBase64String([Text.Encoding]::ASCII.GetBytes("x-access-token:$($script:token)"))
    try {
        Push-Location $tmp
        git init -q
        git checkout -q -b main
        git -c user.email="release@telos.local" -c user.name="Telos Release" `
            commit --allow-empty -m "chore: release anchor (binaries via GitHub Releases only)" | Out-Null
        git -c "http.https://github.com/.extraheader=AUTHORIZATION: basic $basic" `
            push "https://github.com/$owner/$repo.git" "HEAD:main"
        if ($LASTEXITCODE -ne 0) { throw "推送锚点提交失败" }
        Write-Host "已推送空锚点到 github/main"
    } finally {
        Pop-Location
        Remove-Item -LiteralPath $tmp -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# 查找或创建 Release
$rel = $null
try {
    $rel = Invoke-GitHubApi -Uri "$api/releases/tags/$Tag"
    Write-Host "复用已有 Release：$Tag (id=$($rel.id))"
} catch {
    $rel = $null
}

if (-not $rel) {
    $bodyObj = @{
        tag_name         = $Tag
        target_commitish = "main"
        name             = "Telos $Tag"
        body             = @"
Telos $Tag

Windows 安装包：

- ``Telos-$verNoV-setup.exe`` — 安装版（electron-updater 主包）
- ``Telos-$verNoV-portable.exe`` — 便携版
- ``Telos-$verNoV-win.zip`` — 解压即用
"@
        draft            = $false
        prerelease       = $false
    }
    $rel = Invoke-GitHubApi -Method POST -Uri "$api/releases" -Body ($bodyObj | ConvertTo-Json)
    Write-Host "已创建 Release：$Tag → $($rel.html_url)"
}

$relId = $rel.id

# 删除同名旧附件（便于重复发布覆盖）
$existing = @()
try { $existing = @(Invoke-GitHubApi -Uri "$api/releases/$relId/assets?per_page=100") } catch { $existing = @() }
foreach ($a in $assets) {
    foreach ($d in ($existing | Where-Object { $_.name -eq $a.name })) {
        Invoke-GitHubApi -Method DELETE -Uri "$api/releases/assets/$($d.id)" | Out-Null
        Write-Host "删除旧附件：$($a.name)"
    }
}

# 上传（curl multipart 对大文件更稳）
foreach ($a in $assets) {
    $enc = [uri]::EscapeDataString($a.name)
    Write-Host "上传 $($a.name) ($([math]::Round((Get-Item -LiteralPath $a.path).Length / 1MB, 1)) MB)…"
    & curl.exe -sS -f -X POST "$uploads/releases/$relId/assets?name=$enc" `
        -H "Authorization: token $($script:token)" `
        -H "Accept: application/vnd.github+json" `
        -H "Content-Type: $($a.contentType)" `
        --data-binary "@$($a.path)" | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "上传失败：$($a.name)" }
    Write-Host "  ✓ $($a.name)"
}

Write-Host "`n发布完成：https://github.com/$owner/$repo/releases/tag/$Tag"
