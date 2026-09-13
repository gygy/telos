import { TelosLogo } from "./TelosLogo";

/**
 * Telos brand mark (circular white plate + Yandex-red π).
 * Default 32 (error page); start/empty states may enlarge.
 */
export function LogoMark({ size = 32 }: { size?: number } = {}) {
	return (
		<div
			className="logo-mark relative grid place-items-center overflow-hidden rounded-full"
			style={{ width: size, height: size }}
			aria-label="Telos"
		>
			<TelosLogo className="size-full" title="Telos" />
		</div>
	);
}
