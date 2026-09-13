/**
 * Telos brand mark — matches build/icon.svg (white circle + Yandex-red π).
 * Display style follows Pix (plate + π bars); plate is circular; glyph is #FC3F1D.
 */
import { cn } from "../../lib/utils";

/**
 * Source art is 1024×1024.
 * - circle r 472 @ (512,512)
 * - crossbar (248,292) 528×100 rx50
 * - left stem (312,342) 96×392 rx48
 * - right stem (556,342) 96×308 rx48
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
			<circle cx="512" cy="512" r="472" fill="#FFFFFF" />
			<circle cx="512" cy="512" r="472" fill="none" stroke="#F0F0F0" strokeWidth="8" />
			<g fill="#FC3F1D">
				<rect x="248" y="292" width="528" height="100" rx="50" />
				<rect x="312" y="342" width="96" height="392" rx="48" />
				<rect x="556" y="342" width="96" height="308" rx="48" />
			</g>
		</svg>
	);
}
