import { useMemo, useState } from "react";
import { useAtomValue } from "jotai";
import { History, ScanSearch, Terminal } from "lucide-react";
import { t } from "../../i18n";
import { currentSessionIdAtom, sessionMessageCacheBySessionIdAtomFamily } from "../../atoms/session-atoms";
import { sessionRecordByIdAtomFamily } from "../../atoms/session-selectors";
import { collectLatestTurnFileChanges } from "../../../../shared/fileChanges";
import { mergeRunFileChanges } from "../session/turn/fileChangesMerge";
import { fileChangeToDiffLines } from "../session/TimelineFormat";
import { useSessionFileChanges } from "../../hooks/useSessionFileChanges";
import { collectLatestTurnCommands } from "../../utils/reviewTurn";
import { FileDiff } from "../agents/file-diff";
import { Button } from "../ui-shadcn/button";
import type { WorkspaceDrawerPanel } from "../../hooks/useWorkspacePanels";

/**
 * 右侧抽屉「审阅」：本轮文件差异 + 命令摘要，一等公民入口。
 * 不替代时间线（过程）或 Git 面板（仓库），也不替代检查点（回退）。
 */
export function ReviewPanel(props: {
	onOpenFile: (path: string) => void;
	onOpenDrawer: (panel: WorkspaceDrawerPanel) => void;
}) {
	const sessionId = useAtomValue(currentSessionIdAtom);
	const record = useAtomValue(sessionRecordByIdAtomFamily(sessionId ?? ""));
	const cache = useAtomValue(sessionMessageCacheBySessionIdAtomFamily(sessionId ?? ""));
	const messages = cache?.messages;
	const { entries: persisted, loading } = useSessionFileChanges(sessionId ?? "");
	const [openPath, setOpenPath] = useState<string | null>(null);

	const liveFiles = useMemo(() => collectLatestTurnFileChanges(messages ?? []), [messages]);
	const files = useMemo(() => mergeRunFileChanges(persisted, liveFiles), [persisted, liveFiles]);
	const commands = useMemo(() => collectLatestTurnCommands(messages ?? []), [messages]);
	const rewindOk = record?.backend === undefined || record?.backend === "pi";
	const empty = files.length === 0 && commands.length === 0;

	return (
		<div className="flex h-full min-h-0 flex-col" data-testid="review-panel">
			<div className="flex shrink-0 items-center gap-1.5 px-3 pb-1 pt-2 text-xs font-semibold text-foreground">
				<ScanSearch size={13} strokeWidth={1.8} aria-hidden="true" />
				{t("review.title")}
				<span className="ml-auto text-[10px] font-normal text-text-tertiary">{t("review.hint")}</span>
			</div>
			<p className="shrink-0 px-3 pb-2 text-[11px] leading-5 text-text-tertiary">{t("review.narrative")}</p>
			<div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-2 pb-2">
				{!sessionId ? (
					<div className="px-1 text-xs leading-5 text-text-secondary">
						<p>{t("review.noSession")}</p>
						<p className="mt-0.5 text-text-tertiary">{t("review.noSessionHint")}</p>
					</div>
				) : loading && empty ? (
					<p className="px-1 text-xs text-text-tertiary">{t("sessionFiles.loading")}</p>
				) : empty ? (
					<div className="px-1 text-xs leading-5 text-text-secondary">
						<p>{t("review.empty")}</p>
						<p className="mt-0.5 text-text-tertiary">{t("review.emptyHint")}</p>
					</div>
				) : (
					<>
						{files.length > 0 ? (
							<section className="space-y-1">
								<h3 className="px-1 text-[11px] font-medium text-text-tertiary">{t("review.files")}</h3>
								{files.map((entry) => (
									<div key={entry.path} className="flex min-w-0 items-start gap-1">
										<FileDiff
											className="min-w-0 flex-1"
											file={entry.count > 1 ? `${entry.path} ×${entry.count}` : entry.path}
											lines={fileChangeToDiffLines(entry)}
											status="complete"
											open={openPath === entry.path}
											onOpenChange={(open) => setOpenPath(open ? entry.path : null)}
											maxHeight={200}
											language="diff"
											animateHeight={false}
										/>
										<Button
											type="button"
											variant="ghost"
											size="sm"
											className="mt-1 h-7 shrink-0 px-2 text-xs"
											onClick={() => props.onOpenFile(entry.path)}
										>
											{t("sessionFiles.openFile")}
										</Button>
									</div>
								))}
							</section>
						) : null}
						{commands.length > 0 ? (
							<section className="space-y-1">
								<h3 className="px-1 text-[11px] font-medium text-text-tertiary">{t("review.commands")}</h3>
								<ul className="space-y-1">
									{commands.map((command) => (
										<li key={command.id} className="rounded-lg border border-border bg-card px-2 py-1.5">
											<div className="flex items-start gap-1.5">
												<Terminal size={12} className="mt-0.5 shrink-0 text-text-tertiary" aria-hidden="true" />
												<p className="min-w-0 flex-1 break-all font-mono text-[11px] leading-5 text-foreground">
													{command.command}
												</p>
												{command.failed ? (
													<span className="shrink-0 text-[10px] text-destructive">{t("review.commandFailed")}</span>
												) : null}
											</div>
											{command.output ? (
												<p className="mt-0.5 line-clamp-3 pl-4 text-[11px] leading-5 text-text-tertiary">{command.output}</p>
											) : null}
										</li>
									))}
								</ul>
							</section>
						) : null}
					</>
				)}
			</div>
			{sessionId && rewindOk ? (
				<div className="shrink-0 border-t border-border/40 px-2 py-2">
					<Button
						type="button"
						variant="ghost"
						size="sm"
						className="h-7 px-2 text-xs"
						onClick={() => props.onOpenDrawer("rewind")}
					>
						<History size={13} aria-hidden="true" />
						{t("review.openCheckpoint")}
					</Button>
				</div>
			) : null}
		</div>
	);
}
