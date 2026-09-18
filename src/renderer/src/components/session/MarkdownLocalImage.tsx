import { useEffect, useRef, useState, type ImgHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import type { ProjectFileAccessScope } from "../../../../shared/types";
import { desktopApi } from "../../desktopApi";
import { imageMimeTypeFromPath } from "../../utils/composerImages";
import {
	isPassthroughMarkdownImageSrc,
	nextMarkdownImageZoom,
	resolveMarkdownImageFilePath,
} from "../../utils/markdownLocalImage";
import { t } from "../../i18n";

/** 单张预览图上限：大图 PRD 里常见 5–15MB 的导出 PNG，再大仍提示失败。 */
const MARKDOWN_IMAGE_MAX_BYTES = 40 * 1024 * 1024;

type MarkdownLocalImageProps = ImgHTMLAttributes<HTMLImageElement> & {
	/** 当前预览的 Markdown 绝对路径；相对图片按其所在目录解析。 */
	markdownFilePath: string;
	fileAccessScope?: ProjectFileAccessScope;
};

/**
 * Markdown 预览用 img：相对/本地路径经主进程读成 blob:；http(s)/data/blob 原样展示。
 * 与 FileDiffViewer 打开单张图片同一条安全链路（readBase64 + 可选项目边界）。
 * 正文里按阅读栏收一屏；点开后铺满窗口宽度，滚轮可放到原图像素。
 */
export function MarkdownLocalImage(props: MarkdownLocalImageProps) {
	const { markdownFilePath, fileAccessScope, src, alt, className, ...rest } = props;
	const [blobUrl, setBlobUrl] = useState<string | null>(null);
	const [failed, setFailed] = useState(false);
	const [zoomed, setZoomed] = useState(false);
	const passthrough = Boolean(src && isPassthroughMarkdownImageSrc(src));

	useEffect(() => {
		if (!src || passthrough) {
			setBlobUrl(null);
			setFailed(false);
			return;
		}
		let cancelled = false;
		let objectUrl: string | null = null;
		setBlobUrl(null);
		setFailed(false);

		void (async () => {
			const absolute = resolveMarkdownImageFilePath(src, markdownFilePath);
			if (!absolute) {
				if (!cancelled) setFailed(true);
				return;
			}
			try {
				const base64 = await desktopApi.files.readBase64(
					absolute,
					MARKDOWN_IMAGE_MAX_BYTES,
					fileAccessScope,
				);
				if (cancelled) return;
				if (!base64) {
					setFailed(true);
					return;
				}
				const mime = imageMimeTypeFromPath(absolute);
				const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
				objectUrl = URL.createObjectURL(new Blob([bytes], { type: mime }));
				if (cancelled) {
					URL.revokeObjectURL(objectUrl);
					return;
				}
				setBlobUrl(objectUrl);
			} catch {
				if (!cancelled) setFailed(true);
			}
		})();

		return () => {
			cancelled = true;
			if (objectUrl) URL.revokeObjectURL(objectUrl);
		};
	}, [src, passthrough, markdownFilePath, fileAccessScope?.projectId]);

	if (!src) return null;
	const displaySrc = passthrough ? src : blobUrl;
	if (passthrough || displaySrc) {
		return (
			<>
				<img
					{...rest}
					className={className}
					src={displaySrc ?? undefined}
					alt={alt ?? ""}
					title={t("editor.markdownImageZoom")}
					role="button"
					tabIndex={0}
					onClick={() => setZoomed(true)}
					onKeyDown={(event) => {
						if (event.key !== "Enter" && event.key !== " ") return;
						event.preventDefault();
						setZoomed(true);
					}}
				/>
				{zoomed && displaySrc ? (
					<MarkdownImageLightbox src={displaySrc} alt={alt ?? ""} onClose={() => setZoomed(false)} />
				) : null}
			</>
		);
	}
	if (failed) {
		return (
			<span
				className="inline-flex max-w-full items-center rounded border border-border/60 bg-muted/40 px-2 py-1 text-caption text-text-tertiary"
				role="img"
				aria-label={alt || src}
				title={src}
			>
				{t("editor.markdownImageMissing", { name: alt?.trim() || src })}
			</span>
		);
	}
	return (
		<span
			className="inline-block min-h-8 min-w-24 rounded bg-muted/30"
			aria-busy="true"
			aria-label={alt || t("common.loading")}
		/>
	);
}

/**
 * 点开后的大图。默认铺满窗口宽度（不放大超过原图），高出视口就纵向滚动；
 * 滚轮可放到 1:1，时序图上的小字才能读。
 */
function MarkdownImageLightbox(props: { src: string; alt: string; onClose: () => void }) {
	const overlayRef = useRef<HTMLDivElement>(null);
	const zoomRef = useRef(1);
	const maxZoomRef = useRef(1);
	const [zoom, setZoom] = useState(1);
	const [naturalWidth, setNaturalWidth] = useState(0);

	useEffect(() => {
		const onKey = (event: KeyboardEvent) => {
			if (event.key === "Escape") props.onClose();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [props.onClose]);

	useEffect(() => {
		const overlay = overlayRef.current;
		if (!overlay) return;
		const onWheel = (event: Event) => {
			if (!(event instanceof WheelEvent)) return;
			const next = nextMarkdownImageZoom(zoomRef.current, event.deltaY, maxZoomRef.current);
			if (next == null) return;
			event.preventDefault();
			zoomRef.current = next;
			setZoom(next);
		};
		overlay.addEventListener("wheel", onWheel, { passive: false });
		return () => overlay.removeEventListener("wheel", onWheel);
	}, []);

	const fitWidth = Math.min(naturalWidth || Number.POSITIVE_INFINITY, Math.round(window.innerWidth * 0.96));
	const maxZoom = naturalWidth > 0 && fitWidth > 0 ? Math.max(1, naturalWidth / fitWidth) : 1;
	maxZoomRef.current = maxZoom;
	const displayWidth = naturalWidth > 0 ? Math.round(fitWidth * zoom) : undefined;

	return createPortal(
		<div
			ref={overlayRef}
			className="fixed inset-0 z-[1000] overflow-auto bg-black/80"
			role="dialog"
			aria-modal="true"
			aria-label={props.alt || t("app.imagePreviewAlt")}
			onClick={props.onClose}
		>
			<button
				type="button"
				className="image-preview-close fixed"
				aria-label={t("app.imagePreviewClose")}
				title={t("editor.markdownImageZoomHint")}
				onClick={props.onClose}
			>
				<X size={20} strokeWidth={2.4} />
			</button>
			<div className="flex min-h-full w-max min-w-full items-center justify-center p-10">
				<img
					src={props.src}
					alt={props.alt}
					className="h-auto max-w-none rounded-md"
					style={displayWidth ? { width: displayWidth } : { maxWidth: "96vw" }}
					onClick={(event) => event.stopPropagation()}
					onLoad={(event) => {
						const width = event.currentTarget.naturalWidth;
						if (width > 0) setNaturalWidth(width);
					}}
				/>
			</div>
		</div>,
		document.body,
	);
}
