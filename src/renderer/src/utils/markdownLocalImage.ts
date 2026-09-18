/**
 * Markdown 预览本地图片路径解析（相对 MD 文件目录，对齐 VS Code / Cursor）。
 *
 * Electron 页面在 dev 下是 http:// 源，不能用 file:// 直链子资源（webSecurity
 * 会报 Not allowed to load local resource）。解析出绝对路径后由调用方走
 * files.readBase64 → blob: 显示。
 */
import {
	isAbsoluteFilePath,
	resolveFileLinkPath,
} from "./filePathLinks";

/** 远程 / 已内联 / 应用内协议：不走本地文件读取。 */
export function isPassthroughMarkdownImageSrc(src: string): boolean {
	const value = src.trim();
	if (!value || value.startsWith("#")) return true;
	return (
		/^(https?:|data:|blob:|pideck-[a-z0-9-]+:)/i.test(value) ||
		value.startsWith("//")
	);
}

/** 取 Markdown 文件所在目录（浏览器侧，不依赖 node:path）。 */
export function dirnameOfFilePath(filePath: string): string {
	const trimmed = filePath.replace(/[\\/]+$/, "");
	const slash = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
	if (slash < 0) return ".";
	const parent = trimmed.slice(0, slash);
	// Windows 盘符根：C:\foo → C:\ ；不要退化成 C:
	if (/^[A-Za-z]:$/i.test(parent)) {
		return trimmed.slice(0, slash + 1);
	}
	if (slash === 0) return "/";
	return parent || ".";
}

function decodeUriComponentSafe(value: string): string {
	try {
		return decodeURIComponent(value);
	} catch {
		return value;
	}
}

/**
 * 把 md 里的图片 src 解析成可交给 files.readBase64 的绝对路径。
 * 远程/内联返回 null（调用方应原样渲染）；无法解析也返回 null。
 */
export function resolveMarkdownImageFilePath(
	src: string,
	markdownFilePath: string,
): string | null {
	let raw = src.trim();
	if (!raw || isPassthroughMarkdownImageSrc(raw)) return null;
	raw = decodeUriComponentSafe(raw);

	if (/^file:/i.test(raw)) {
		let path = raw.replace(/^file:\/\//i, "");
		// file:///C:/x → C:/x ；file:///home/x 保留前导 /
		if (/^\/[A-Za-z]:/.test(path)) path = path.slice(1);
		path = decodeUriComponentSafe(path);
		if (!path) return null;
		return resolveFileLinkPath(path);
	}

	if (!markdownFilePath.trim()) return null;
	const baseDir = dirnameOfFilePath(markdownFilePath);
	if (isAbsoluteFilePath(raw)) return resolveFileLinkPath(raw);
	return resolveFileLinkPath(raw, baseDir);
}

/**
 * 预览大图滚轮缩放。1 = 铺满窗口宽度；上限是原图像素（再放大只会发糊）。
 * 向下滚且已经是 1 时不改，让外层继续滚动。
 */
export function nextMarkdownImageZoom(current: number, deltaY: number, maxZoom: number): number | null {
	const cap = Number.isFinite(maxZoom) && maxZoom > 1 ? maxZoom : 1;
	const safe = Number.isFinite(current) ? current : 1;
	if (deltaY > 0 && safe <= 1) return null;
	const factor = deltaY < 0 ? 1.12 : 1 / 1.12;
	const next = Math.min(cap, Math.max(1, safe * factor));
	return next === safe ? null : next;
}
