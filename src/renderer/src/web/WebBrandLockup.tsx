/**
 * 自包含的 Telos 品牌锁（Web 预览）：圆形白底 + 雅红 π。
 */
import { TelosLogo } from "../components/app/TelosLogo";

export function WebBrandLockup() {
	return (
		<div className="brand-lockup flex h-9 min-w-0 items-center gap-2.5" aria-label="Telos">
			<TelosLogo className="size-[18px]" title="Telos" />
			<span className="brand-wordmark translate-x-0.5 truncate text-[18px] font-[TelosDepartureMono] font-normal uppercase leading-none text-zinc-950 dark:text-white">
				Telos
			</span>
		</div>
	);
}
