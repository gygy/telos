import { useAtomValue, useSetAtom } from "jotai";
import { Clock } from "lucide-react";
import { openAutomationModalAtom } from "../../atoms/automation-atoms";
import { automationActiveRunsAtom } from "../../atoms/automation-atoms";
import { t } from "../../i18n";
import { Button } from "../ui-shadcn/button";
import { cn } from "../../lib/utils";

/**
 * 定时任务入口。
 * - 默认：顶栏图标（与新建/搜索并排，不占列表高度）
 * - `variant="row"`：旧的整行文案按钮（测试/兼容保留）
 *
 * 有正在执行的任务时图标右上角带呼吸蓝点。
 */
export function AutomationDockButton(props: {
	variant?: "icon" | "row";
	className?: string;
}) {
	const openAutomationModal = useSetAtom(openAutomationModalAtom);
	const activeRuns = useAtomValue(automationActiveRunsAtom);
	const hasActive = activeRuns.length > 0;
	const label = hasActive
		? `${t("automation.title")} (${activeRuns.length})`
		: t("automation.title");
	const variant = props.variant ?? "icon";

	if (variant === "row") {
		return (
			<button
				type="button"
				className={cn(
					"group flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-body text-foreground transition-colors hover:bg-muted/60",
					props.className,
				)}
				aria-label={label}
				title={label}
				onClick={() => openAutomationModal()}
			>
				<span className="relative shrink-0">
					<Clock className="size-4 text-muted-foreground" aria-hidden="true" />
					{hasActive && (
						<span
							className="pointer-events-none absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-sky-500 animate-pulse"
							aria-hidden="true"
						/>
					)}
				</span>
				<span className="min-w-0 flex-1 truncate font-medium">{t("automation.title")}</span>
				{hasActive && (
					<span className="shrink-0 text-micro tabular-nums text-sky-500">
						{activeRuns.length}
					</span>
				)}
			</button>
		);
	}

	return (
		<Button
			type="button"
			variant="ghost"
			size="icon-sm"
			className={cn("relative size-7 shrink-0", props.className)}
			aria-label={label}
			title={label}
			onClick={() => openAutomationModal()}
		>
			<Clock className="size-3.5" aria-hidden="true" />
			{hasActive && (
				<span
					className="pointer-events-none absolute right-1 top-1 size-1.5 rounded-full bg-sky-500 animate-pulse"
					aria-hidden="true"
				/>
			)}
		</Button>
	);
}
