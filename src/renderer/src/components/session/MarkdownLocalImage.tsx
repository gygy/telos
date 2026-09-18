import { useEffect, useState, type ImgHTMLAttributes } from "react";
import type { ProjectFileAccessScope } from "../../../../shared/types";
import { desktopApi } from "../../desktopApi";
import { imageMimeTypeFromPath } from "../../utils/composerImages";
import {
	isPassthroughMarkdownImageSrc,
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
 */
export function MarkdownLocalImage(props: MarkdownLocalImageProps) {
	const { markdownFilePath, fileAccessScope, src, alt, className, ...rest } = props;
	const [blobUrl, setBlobUrl] = useState<string | null>(null);
	const [failed, setFailed] = useState(false);
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
	if (passthrough) {
		return <img {...rest} className={className} src={src} alt={alt ?? ""} />;
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
	if (!blobUrl) {
		return (
			<span
				className="inline-block min-h-8 min-w-24 rounded bg-muted/30"
				aria-busy="true"
				aria-label={alt || t("common.loading")}
			/>
		);
	}
	return <img {...rest} className={className} src={blobUrl} alt={alt ?? ""} />;
}
