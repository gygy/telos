/**
 * Telos brand mark — matches build/icon.svg (white circle + Yandex-red π).
 * Geometry tuned for taskbar weight comparable to Yandex Browser.
 */
import { cn } from "../../lib/utils";

/**
 * Source art is 1024×1024.
 * - circle r 508 @ (512,512)
 * - crossbar (188,262) 648×124 rx62
 * - left stem (256,324) 124×468 rx62
 * - right stem (564,324) 124×368 rx62
 */
export function TelosLogo(props: { className?: string; title?: string }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 1024 1024"
			fill="none"
			className={cn("size-5 shrink-0", props.className)}
			role="img"
			aria-label={props.title ?? "Telos"}
		>
			<title>{props.title ?? "Telos"}</title>
			<circle cx="512" cy="512" r="508" fill="#FFFFFF" />
			<g fill="#FC3F1D">
				<rect x="188" y="262" width="648" height="124" rx="62" />
				<rect x="256" y="324" width="124" height="468" rx="62" />
				<rect x="564" y="324" width="124" height="368" rx="62" />
			</g>
		</svg>
	);
}
