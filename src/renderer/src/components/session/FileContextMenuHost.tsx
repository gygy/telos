import { useEffect, useState } from "react";
import { useAtom } from "jotai";
import type { FileTreeNode } from "../../../../shared/types";
import { fileContextMenuAtom } from "../../atoms/file-context-menu";
import { desktopApi } from "../../desktopApi";
import { t } from "../../i18n";
import { fileNodeDragPayloadToRef } from "../app/AppUtils";
import { FileContextMenu } from "./ComposerOverlayComponents";

type ToastKind = "info" | "warning" | "error";

/**
 * 文件树右键菜单宿主。
 *
 * 点击项时先卸菜单（只写 atom），动作放到 setTimeout(0)：
 * 同一帧里跑 IPC / 确认框 / toast 会和 Radix 关菜单、App 重渲叠在一起，表现为「点了卡住」。
 */
export function FileContextMenuHost(props: {
	showToast: (message: string, duration?: number, kind?: ToastKind) => void;
	refreshFiles: () => void;
	onRename: (node: FileTreeNode) => void;
	onDelete: (node: FileTreeNode) => void;
}) {
	const [menu, setMenu] = useAtom(fileContextMenuAtom);
	const [hasClipboardFiles, setHasClipboardFiles] = useState(false);

	// 粘贴项不能在右键当帧用 sendSync 读剪贴板：Windows 上剪贴板被别的进程占着时会卡住渲染进程。
	useEffect(() => {
		if (!menu) {
			setHasClipboardFiles(false);
			return;
		}
		let cancelled = false;
		void desktopApi.files.getClipboardPathsAsync().then((paths) => {
			if (!cancelled) setHasClipboardFiles(paths.length > 0);
		}).catch(() => {
			if (!cancelled) setHasClipboardFiles(false);
		});
		return () => {
			cancelled = true;
		};
	}, [menu]);

	if (!menu) return null;

	const node = menu.node;
	const closeThen = (action: () => void) => {
		setMenu(null);
		// rAF：等菜单卸掉并完成一帧绘制，再跑 IPC，比 setTimeout(0) 更不容易和关菜单抢同一帧。
		window.requestAnimationFrame(() => {
			action();
		});
	};

	return (
		<FileContextMenu
			menu={menu}
			hasClipboardFiles={hasClipboardFiles}
			onClose={() => setMenu(null)}
			onPaste={(targetDir) => {
				closeThen(() => {
					void desktopApi.files.getClipboardPathsAsync().then((paths) => {
						if (paths.length === 0) return;
						return desktopApi.files.copy(paths, targetDir).then(() => {
							props.refreshFiles();
							props.showToast(t("app.fileCopyDone", { count: paths.length }), 2000);
						});
					}).catch((error: unknown) => {
						props.showToast(t("app.filePasteFailed", {
							error: error instanceof Error ? error.message : String(error),
						}), 4000);
					});
				});
			}}
			onOpen={() => {
				const path = node.path;
				closeThen(() => {
					void desktopApi.files.open(path).catch((error: unknown) => {
						props.showToast(t("app.openFileFailed", {
							error: error instanceof Error ? error.message : String(error),
						}), 4000);
					});
				});
			}}
			onReveal={() => {
				const path = node.path;
				closeThen(() => {
					void desktopApi.files.showInFolder(path).catch((error: unknown) => {
						props.showToast(t("app.openFileFailed", {
							error: error instanceof Error ? error.message : String(error),
						}), 4000);
					});
				});
			}}
			onAttach={() => {
				const payload = {
					path: node.path,
					relativePath: node.relativePath,
					type: node.type,
				};
				closeThen(() => {
					window.dispatchEvent(
						new CustomEvent("composer-attach-refs", {
							detail: { refs: [fileNodeDragPayloadToRef(payload)] },
						}),
					);
				});
			}}
			onCopyPath={() => {
				const path = node.path;
				closeThen(() => {
					void desktopApi.clipboard.writeText(path).then(() => {
						props.showToast(t("app.pathCopied"), 1200);
					});
				});
			}}
			onRename={() => {
				closeThen(() => props.onRename(node));
			}}
			onDelete={() => {
				closeThen(() => props.onDelete(node));
			}}
		/>
	);
}
