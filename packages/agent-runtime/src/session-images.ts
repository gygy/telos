import type { SessionImage } from "@pix/contracts";

const ALLOWED_IMAGE_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/gif",
  "image/webp",
  "image/bmp",
  "image/svg+xml",
  "image/avif",
]);

/** Drop oversized payloads so history IPC cannot balloon on screenshot dumps. */
const MAX_IMAGE_DATA_URL_CHARS = 8_000_000;
const MAX_IMAGES_PER_MESSAGE = 8;

const IMAGE_MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  avif: "image/avif",
  bmp: "image/bmp",
  gif: "image/gif",
  heic: "image/heic",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  png: "image/png",
  svg: "image/svg+xml",
  tif: "image/tiff",
  tiff: "image/tiff",
  webp: "image/webp",
};

const TOOL_IMAGE_PATH_KEYS = [
  "saved_path",
  "savedPath",
  "output_path",
  "outputPath",
  "file_path",
  "filePath",
  "path",
  "file",
  "filename",
  "target",
] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeMimeType(value: string): string {
  const mime = value.split(";", 1)[0]?.trim().toLowerCase() ?? "";
  return mime === "image/jpg" ? "image/jpeg" : mime;
}

function toDataUrl(mimeType: string, data: string): string | undefined {
  const trimmed = data.trim();
  if (!trimmed) return undefined;
  if (/^data:image\//i.test(trimmed)) {
    return trimmed.length <= MAX_IMAGE_DATA_URL_CHARS ? trimmed : undefined;
  }
  // pi stores raw base64; reject data-URL-looking junk without a mime.
  if (!/^[A-Za-z0-9+/=\s]+$/.test(trimmed)) return undefined;
  const compact = trimmed.replace(/\s+/g, "");
  if (!compact) return undefined;
  const dataUrl = `data:${mimeType};base64,${compact}`;
  return dataUrl.length <= MAX_IMAGE_DATA_URL_CHARS ? dataUrl : undefined;
}

function imageFromPart(part: unknown): SessionImage | undefined {
  if (!isRecord(part) || part.type !== "image") return undefined;
  const mimeType = typeof part.mimeType === "string" ? normalizeMimeType(part.mimeType) : "";
  if (!ALLOWED_IMAGE_MIME.has(mimeType)) return undefined;
  const data = typeof part.data === "string" ? part.data : "";
  const dataUrl = toDataUrl(mimeType, data);
  if (!dataUrl) return undefined;
  return { mimeType, dataUrl };
}

/**
 * Collect serializable image parts from pi message/tool content.
 * Accepts a content array or a tool result `{ content: [...] }`.
 */
export function extractSessionImages(content: unknown): SessionImage[] {
  const parts = Array.isArray(content)
    ? content
    : isRecord(content) && Array.isArray(content.content)
      ? content.content
      : [];
  const images: SessionImage[] = [];
  for (const part of parts) {
    const image = imageFromPart(part);
    if (!image) continue;
    images.push(image);
    if (images.length >= MAX_IMAGES_PER_MESSAGE) break;
  }
  return images;
}

function imageMimeTypeFromPath(filePath: string): string | undefined {
  const clean = filePath.trim().split(/[?#]/, 1)[0] ?? "";
  const match = /\.([^.\\/]+)$/.exec(clean);
  return match?.[1] ? IMAGE_MIME_BY_EXTENSION[match[1].toLowerCase()] : undefined;
}

function firstImagePath(value: unknown, depth = 0): { path: string; mimeType: string } | undefined {
  if (!isRecord(value) || depth > 2) return undefined;
  for (const key of TOOL_IMAGE_PATH_KEYS) {
    const candidate = value[key];
    if (typeof candidate !== "string" || /^(?:data:|https?:)/i.test(candidate.trim())) continue;
    const mimeType = imageMimeTypeFromPath(candidate);
    if (mimeType) return { path: candidate.trim(), mimeType };
  }
  for (const key of ["result", "output", "artifact", "details"]) {
    const nested = firstImagePath(value[key], depth + 1);
    if (nested) return nested;
  }
  return undefined;
}

function isInspectOnlyTool(toolName: string): boolean {
  return /(?:^|[_-])(read|read_file|view|cat)(?:[_-]|$)/i.test(toolName);
}

function toolProducesImageArtifact(toolName: string): boolean {
  return /(?:^|[_-])(write|create|generate|image|screenshot|capture|render)(?:[_-]|$)/i.test(
    toolName,
  );
}

/**
 * Project one tool's media explicitly at the runtime boundary.
 * Inspect-only tools (`read`) are skipped — only produced artifacts belong on the reply.
 */
export function extractToolSessionImages(input: {
  toolName: string;
  args?: unknown;
  content?: unknown;
  result?: unknown;
  isError?: boolean;
}): SessionImage[] {
  if (input.isError) return [];
  if (isInspectOnlyTool(input.toolName)) return [];
  const inline = extractSessionImages(input.content ?? input.result);
  if (inline.length > 0) return inline;
  if (!toolProducesImageArtifact(input.toolName)) return [];

  const artifact = firstImagePath(input.result) ?? firstImagePath(input.args);
  return artifact ? [{ path: artifact.path, mimeType: artifact.mimeType }] : [];
}
