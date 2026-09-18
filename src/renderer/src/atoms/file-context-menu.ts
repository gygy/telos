import { atom } from "jotai";
import type { FileTreeNode } from "../../../shared/types";

/**
 * 文件树右键菜单。放 atom 而不是 App state：打开/关闭只重渲菜单宿主，
 * 不把 4000 行的 App（会话时间线、文件树）整页刷一遍。
 */
export type FileContextMenuState = {
	x: number;
	y: number;
	node: FileTreeNode;
};

export const fileContextMenuAtom = atom<FileContextMenuState | null>(null);
