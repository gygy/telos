/**
 * Telos brand mark — matches build/icon.svg (Yandex g101 white circle + red π).
 */
import { cn } from "../../lib/utils";

/**
 * Source art is 1024×1024.
 * - circle r 512 @ (512,512) + soft #F0 rim
 * - crossbar (150,230) 724×148 rx74
 * - left stem (220,300) 156×520 rx78
 * - right stem (560,300) 156×420 rx78
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
			<circle cx="512" cy="512" r="512" fill="#FFFFFF" />
			<circle cx="512" cy="512" r="506" fill="none" stroke="#F0F0F0" strokeWidth={12} />
			<g fill="#FC3F1D">
				<rect x="150" y="230" width="724" height="148" rx="74" />
				<rect x="220" y="300" width="156" height="520" rx="78" />
				<rect x="560" y="300" width="156" height="420" rx="78" />
			</g>
		</svg>
	);
}
