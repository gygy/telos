import type { FileTreeNode } from "../../../shared/types";

/** 与 WorkspaceSurface 树行 `h-[28px]` 对齐；虚拟列表用固定行高估滚动。 */
export const FILE_TREE_ROW_HEIGHT_PX = 28;

/** 视口外多挂几行，减少快速滚动闪空。 */
export const FILE_TREE_VIRTUAL_OVERSCAN = 12;

export type FileTreeVisibleRow = {
	key: string;
	node: FileTreeNode;
	depth: number;
	expanded: boolean;
	/** 目录已展开但子项尚未拉到时的占位行。 */
	kind: "node" | "loading";
};

/**
 * 把展开态文件树压成可视行列表（深度优先）。
 * 虚拟列表只挂载窗口内行，不再递归挂整棵 DOM。
 */
export function flattenFileTreeVisibleRows(
	nodes: FileTreeNode[],
	expandedDirs: ReadonlySet<string>,
	depth = 0,
): FileTreeVisibleRow[] {
	const rows: FileTreeVisibleRow[] = [];
	for (const node of nodes) {
		const expanded = node.type === "directory" && expandedDirs.has(node.path);
		rows.push({ key: node.path, node, depth, expanded, kind: "node" });
		if (node.type !== "directory" || !expanded) continue;
		if (node.hasChildren !== false && !node.children) {
			rows.push({
				key: `${node.path}::__loading`,
				node,
				depth: depth + 1,
				expanded: false,
				kind: "loading",
			});
			continue;
		}
		if (node.children && node.children.length > 0) {
			rows.push(...flattenFileTreeVisibleRows(node.children, expandedDirs, depth + 1));
		}
	}
	return rows;
}

/** 按滚动位置计算应挂载的行窗口（含 overscan）。 */
export function fileTreeVirtualWindow(
	rowCount: number,
	scrollTop: number,
	viewportHeight: number,
	rowHeight = FILE_TREE_ROW_HEIGHT_PX,
	overscan = FILE_TREE_VIRTUAL_OVERSCAN,
): { start: number; end: number; offsetY: number; totalHeight: number } {
	const totalHeight = rowCount * rowHeight;
	if (rowCount === 0) {
		return { start: 0, end: 0, offsetY: 0, totalHeight };
	}
	const safeViewport = Math.max(viewportHeight, rowHeight);
	const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
	const end = Math.min(
		rowCount,
		Math.ceil((scrollTop + safeViewport) / rowHeight) + overscan,
	);
	return { start, end, offsetY: start * rowHeight, totalHeight };
}
