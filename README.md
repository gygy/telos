# Telos

Telos 是基于上游 [PiDeck](https://github.com/ayuayue/PiDeck) 定制的**智能编程助手**桌面工作台（对接 [pi](https://pi.dev) / DSH 等编码 Agent）。

- **本仓库（产品）**：[https://github.com/gygy/telos](https://github.com/gygy/telos)
- **上游只读镜像**：`G:\gitea\pideck-github`（GitHub `ayuayue/PiDeck`）。Telos 定时拉取上游，并可用基线 commit 做增量对比与选择性同步。

## 上游基线（导入时锁定）

| 字段 | 值 |
|------|-----|
| Commit | `0950e2c1a3e55cb2ab3771d40dc8ae9d97b7ba72` |
| Short | `0950e2c1` |
| Subject | `chore: update star history [skip ci]` |
| Time | `2026-09-16T03:43:13Z` |

完整记录：[`.upstream/pideck-baseline.json`](./.upstream/pideck-baseline.json)  
同步说明：[TELOS-UPSTREAM.md](./TELOS-UPSTREAM.md)

```powershell
.\scripts\sync-from-pideck.ps1 -Status          # 看基线之后有哪些新提交
.\scripts\sync-from-pideck.ps1                  # 全量同步（保留 Telos 覆盖层）
.\scripts\sync-from-pideck.ps1 -Paths src/...   # 只同步指定路径
.\scripts\sync-from-pideck.ps1 -UpdateBaseline  # 推进基线到当前上游 tip
```

## 开发（与上游 PiDeck 相同）

```bash
npm install
npm run dev
npm run build
npm run dist:win
```

## Remotes

| Remote | 用途 |
|--------|------|
| `origin` | Telos（可推送到 Gitea / GitHub gygy/telos） |
| `pideck` | 本地只读 `G:/gitea/pideck-github` |
| `pideck-gitea` | Gitea 只读镜像 |
| `pideck-github` | GitHub 只读 `ayuayue/PiDeck` |

推送 Telos：`.\scripts\git-sync.ps1`  
**禁止**向任何 `pideck*` remote 推送。
