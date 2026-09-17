/**
 * 冷启动分段计时（主进程）。
 *
 * 仅打 info 日志，供排查「启动很慢」；不改变控制流。
 * 锚点：whenReady 起点 → settings/catalog → createWindow → show。
 */

export type StartupTimingLogger = {
	info: (scope: string, message: string, detail?: Record<string, unknown>) => void;
};

/** 创建一套相对 whenReady 的耗时标记器。 */
export function createStartupTimer(log?: StartupTimingLogger): {
	/** 记录从 whenReady 起的累计毫秒，以及距上一标记的间隔。 */
	mark: (label: string, detail?: Record<string, unknown>) => void;
	/** whenReady 起点的绝对时间（Date.now）。 */
	startedAt: number;
} {
	const startedAt = Date.now();
	let lastAt = startedAt;
	return {
		startedAt,
		mark(label, detail) {
			const now = Date.now();
			const elapsedMs = now - startedAt;
			const deltaMs = now - lastAt;
			lastAt = now;
			log?.info("startup", label, { elapsedMs, deltaMs, ...detail });
		},
	};
}
