import { useEffect } from "react";
import { useAtomValue, useSetAtom } from "jotai";
import { History, ScanSearch } from "lucide-react";
import { t } from "../../i18n";
import { sessionInterruptedAtAtom } from "../../atoms/session-interrupt";
import { sessionRecordByIdAtomFamily, sessionRuntimeBySessionIdAtomFamily } from "../../atoms/session-selectors";
import { isSessionRuntimeBusy } from "../../hooks/useSessionTimelineController";
import { Button } from "../ui-shadcn/button";
import { useSessionPaneServices } from "./SessionPaneServices";

/**
 * 长任务叙事条：排队、停止、检查点已经各自存在，这里只把「停了也能接着干」说清楚。
 * 空闲且没有排队、也没有刚中断时不渲染，避免短问答把输入栏顶高。
 */
export function LongTaskNarrative(props: { sessionId: string }) {
	const services = useSessionPaneServices();
	const runtime = useAtomValue(sessionRuntimeBySessionIdAtomFamily(props.sessionId));
	const record = useAtomValue(sessionRecordByIdAtomFamily(props.sessionId));
	const interruptedAt = useAtomValue(sessionInterruptedAtAtom)[props.sessionId];
	const setInterrupted = useSetAtom(sessionInterruptedAtAtom);
	const busy = isSessionRuntimeBusy(runtime?.status, runtime?.state);
	const queued = services.queuedPromptsBySession[props.sessionId]?.length ?? 0;
	const rewindOk = record?.backend === undefined || record.backend === "pi";

	// 下一轮真正跑起来后，中断提示让位给「正在执行」，避免停完又发仍显示已中断。
	useEffect(() => {
		if (!busy || interruptedAt === undefined) return;
		setInterrupted((current) => {
			if (current[props.sessionId] === undefined) return current;
			const next = { ...current };
			delete next[props.sessionId];
			return next;
		});
	}, [busy, interruptedAt, props.sessionId, setInterrupted]);

	const mode = interruptedAt !== undefined && !busy
		? "interrupted"
		: busy
			? "running"
			: queued > 0
				? "queued"
				: null;
	if (!mode) return null;

	const copy = mode === "interrupted"
		? t("longTask.interrupted")
		: mode === "queued"
			? t("longTask.queued", { n: queued })
			: queued > 0
				? t("longTask.runningQueued", { n: queued })
				: t("longTask.running");

	return (
		<section
			className="flex w-full items-center gap-2 rounded-xl border border-border bg-card px-3 py-2"
			data-testid="long-task-narrative"
			data-mode={mode}
			role="status"
		>
			<p className="min-w-0 flex-1 text-xs leading-5 text-text-secondary">{copy}</p>
			<Button
				type="button"
				variant="ghost"
				size="sm"
				className="h-7 shrink-0 px-2 text-xs"
				onClick={() => services.openWorkspaceDrawer("review")}
			>
				<ScanSearch size={13} aria-hidden="true" />
				{t("longTask.review")}
			</Button>
			{rewindOk ? (
				<Button
					type="button"
					variant="ghost"
					size="sm"
					className="h-7 shrink-0 px-2 text-xs"
					onClick={() => services.openWorkspaceDrawer("rewind")}
				>
					<History size={13} aria-hidden="true" />
					{t("longTask.checkpoint")}
				</Button>
			) : null}
		</section>
	);
}
