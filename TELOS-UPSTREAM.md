# Telos × PiDeck（pideck-github）上游同步

## 关系

| 仓库 | 角色 | 读写 |
|------|------|------|
| GitHub `ayuayue/PiDeck` / `G:\gitea\pideck-github` | 上游镜像 | **只读** |
| `G:\gitea\telos` / Gitea `sheng/telos` | Telos 智能编程助手（PiDeck 源码 + 产品覆盖） | 读写 |

基线 commit（首次导入时锁定）见 [`.upstream/pideck-baseline.json`](./.upstream/pideck-baseline.json)。

**当前基线：** `4ab3beea370e83cb79d52aa314537c277b4c4f55`（`4ab3beea`）  
`chore: update star history [skip ci]` @ 2026-09-13T03:36:27Z

## Remotes（本机）

```text
origin           → ssh://…/sheng/telos.git              (push OK)
pideck           → G:/gitea/pideck-github               (fetch only)
pideck-gitea     → ssh://…/sheng/pideck-github.git      (fetch only)
pideck-github    → https://github.com/ayuayue/PiDeck.git (fetch only)
```

`pideck*` 的 push URL 固定为 `DISABLED_READ_ONLY`。

## 日常命令

```powershell
# 查看基线之后上游有哪些新 commit（不改文件）
.\scripts\sync-from-pideck.ps1 -Status

# 仅 fetch
.\scripts\sync-from-pideck.ps1 -FetchOnly

# 全量同步上游树，并恢复 Telos 覆盖层
.\scripts\sync-from-pideck.ps1

# 选择性同步：只拉指定路径（相对仓库根）
.\scripts\sync-from-pideck.ps1 -Paths src/main/ipc/sessionIpc.ts,src/shared/updateSources.ts

# 同步成功后把基线推进到当前上游 tip
.\scripts\sync-from-pideck.ps1 -UpdateBaseline
```

计划任务（每日只看增量）：

```powershell
schtasks /Create /TN "Telos-pideck-status" /SC DAILY /ST 09:00 `
  /TR "powershell -NoProfile -File G:\gitea\telos\scripts\sync-from-pideck.ps1 -Status" `
  /RL LIMITED
```

## 你改 Telos 之后，PiDeck 又有新功能时

1. 先更新本地镜像：`cd G:\gitea\pideck-github; git fetch github; git checkout github/main`（或 pull）。  
2. `.\scripts\sync-from-pideck.ps1 -Status` 看基线之后的 commit 列表。  
3. 需要全部吸收 → `-Paths` 不传，跑全量同步，解决覆盖层冲突。  
4. 只要某几个功能 → `-Paths` 只同步相关目录/文件，再人工核对。  
5. 确认无误后 `-UpdateBaseline`，避免下次重复提示同一批 commit。

## 覆盖层

产品差异路径维护在 `scripts/sync-from-pideck.ps1` 的 `$TelosOverlays`。新增 Telos 定制文件时必须加入，否则下次全量同步会被上游盖掉。

## 禁止

- 向 `pideck` / `pideck-gitea` / `pideck-github` / GitHub `ayuayue/PiDeck` 推送  
- 在脏工作区全量同步（脚本会拒绝）  
- 未更新基线就反复全量覆盖导致难以回溯「从哪次开始合入」
