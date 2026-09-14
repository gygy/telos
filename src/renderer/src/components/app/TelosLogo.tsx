/**
 * Telos brand mark — matches build/icon.svg (Yandex g136 white squircle + red π).
 */
import { cn } from "../../lib/utils";

/**
 * Source art is 1024×1024.
 * - rounded square rx 268 + soft #E7 rim
 * - crossbar (140,220) 744×148 rx74
 * - left stem (210,290) 156×530 rx78
 * - right stem (550,290) 156×430 rx78
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
			<rect x="0" y="0" width="1024" height="1024" rx="268" fill="#FFFFFF" />
			<rect
				x="6"
				y="6"
				width="1012"
				height="1012"
				rx="262"
				fill="none"
				stroke="#E7E7E7"
				strokeWidth={10}
			/>
			<g fill="#FC3F1D">
				<rect x="140" y="220" width="744" height="148" rx="74" />
				<rect x="210" y="290" width="156" height="530" rx="78" />
				<rect x="550" y="290" width="156" height="430" rx="78" />
			</g>
		</svg>
	);
}
