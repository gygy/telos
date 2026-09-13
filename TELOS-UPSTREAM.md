# Telos × Pix 上游同步

## 关系

| 仓库 | 角色 | 读写 |
|------|------|------|
| `G:\gitea\pix` / Gitea `sheng/pix` | 上游镜像（Pix） | **只读** |
| `G:\gitea\telos` / Gitea `sheng/telos` | Telos 智能编程助手（Pix 源码 + 产品覆盖） | 读写 |

Telos 与 Pix **不共享 commit 祖先**（并行镜像历史），因此同步方式是：

1. `git fetch` 只读上游  
2. `git checkout <pix>/main -- .` 用上游树覆盖工作区  
3. **恢复 Telos 覆盖层文件**（品牌、文案、同步脚本等）  
4. 记录 `.pix-sync-revision` 并提交  

禁止向 `pix` / `pix-gitea` 推送（push URL = `DISABLED_READ_ONLY`）。

## 命令

```powershell
.\scripts\sync-from-pix.ps1              # 拉取并合入（保留覆盖层）
.\scripts\sync-from-pix.ps1 -FetchOnly   # 只 fetch
.\scripts\sync-from-pix.ps1 -Source gitea
.\scripts\sync-from-pix.ps1 -NoCommit    # 合入但不提交，便于人工检查
```

计划任务（每日仅 fetch）：

```powershell
schtasks /Create /TN "Telos-sync-pix-fetch" /SC DAILY /ST 09:00 `
  /TR "powershell -NoProfile -File G:\gitea\telos\scripts\sync-from-pix.ps1 -FetchOnly" `
  /RL LIMITED
```

## 覆盖层

产品差异集中在 `scripts/sync-from-pix.ps1` 的 `$TelosOverlays`。新增 Telos 定制文件时，**必须**加入该列表，否则下次同步会被 Pix 树盖掉。

核心品牌常量：`apps/desktop/src/shared/brand.ts`（`PRODUCT_NAME` / `PRODUCT_DOCUMENTS_DIR` 等）。

## Remotes

```text
origin      → sheng/telos     (push OK)
pix         → G:/gitea/pix   (fetch only)
pix-gitea   → sheng/pix      (fetch only)
```
