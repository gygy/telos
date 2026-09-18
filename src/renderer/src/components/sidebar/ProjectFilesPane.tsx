import type { FileTreeNode } from "../../../../shared/types";
import { t } from "../../i18n";
import { cn } from "../../lib/utils";
import { FilesPanel } from "../session/WorkspaceSurface";
import { projectPaneModeAtom } from "../../atoms/app-ui-atoms";
import { useAtomValue, useSetAtom } from "jotai";

/** 当前项目下的「会话 | 文件」。只换这一块列表，不把文件嵌进会话行。 */
export function ProjectPaneModeSwitch() {
	const mode = useAtomValue(projectPaneModeAtom);
	const setMode = useSetAtom(projectPaneModeAtom);
	return (
		<div
			role="tablist"
			aria-label={t("sidebar.projectPane")}
			className="mb-1 flex h-7 w-full items-center rounded-md bg-muted/70 p-0.5"
		>
			<PaneTab
				selected={mode === "sessions"}
				label={t("app.sidebarSessions")}
				onSelect={() => setMode("sessions")}
			/>
			<PaneTab
				selected={mode === "files"}
				label={t("app.files")}
				onSelect={() => setMode("files")}
			/>
		</div>
	);
}

function PaneTab(props: { selected: boolean; label: string; onSelect: () => void }) {
	return (
		<button
			type="button"
			role="tab"
			aria-selected={props.selected}
			className={cn(
				"h-6 min-w-0 flex-1 rounded-[5px] text-caption",
				props.selected
					? "bg-background font-medium text-foreground shadow-sm"
					: "text-muted-foreground hover:text-foreground",
			)}
			onClick={props.onSelect}
		>
			{props.label}
		</button>
	);
}

export type ProjectFilesPaneProps = {
	files: FileTreeNode[];
	expandedDirs: Set<string>;
	projectRoot?: string;
	onToggleDirectory: (path: string) => void;
	onCollapseAll: () => void;
	onFileContextMenu: (node: FileTreeNode, x: number, y: number) => void;
	onRefresh: () => void;
	onOpenFolder?: () => void;
	onOpenFile?: (path: string) => void;
	onViewFile?: (path: string, openMode?: "preview" | "permanent") => void;
	onDropFiles?: (targetDir: string, files: FileList) => void;
	onPasteFiles?: (targetDir: string) => void;
	onMoveFiles?: (sourcePaths: string[], targetDir: string) => void;
};

/** 复用文件抽屉的树，放进左侧当前项目。高度封在侧栏里，自己滚动。 */
export function ProjectFilesPane(props: ProjectFilesPaneProps) {
	return (
		<div className="flex h-[min(32rem,calc(100dvh-16rem))] min-h-52 min-w-0 flex-col">
			<FilesPanel
				files={props.files}
				expandedDirs={props.expandedDirs}
				onToggleDirectory={props.onToggleDirectory}
				onCollapseAll={props.onCollapseAll}
				onFileContextMenu={props.onFileContextMenu}
				onRefreshFiles={props.onRefresh}
				onOpenFolder={props.onOpenFolder}
				onOpenFile={props.onOpenFile}
				onViewFile={props.onViewFile}
				projectRoot={props.projectRoot}
				onDropFiles={props.onDropFiles}
				onPasteFiles={props.onPasteFiles}
				onMoveFiles={props.onMoveFiles}
			/>
		</div>
	);
}
