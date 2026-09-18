/**
 * 启动后会话预热。
 *
 * 首点慢是因为每个会话要单独拉起 pi。窗口出来后再做，不挡首屏。
 * 只预热最近活跃的一个项目的最新会话，再排队下一个项目的最新一条。
 * 不要按项目全开：一个会话一个进程，并行会拖慢启动并被闲置释放器收掉。
 */

export const STARTUP_SESSION_WARMUP_LIMIT = 2;

export type StartupWarmupProject = {
	id: string;
	missing?: boolean;
};

export type StartupWarmupSession = {
	id: string;
	projectId: string;
	updatedAt: number;
	/** 子代理会话不作为用户会点开的那条。 */
	parentSessionPath?: string;
	/** 匿名会话不落盘，重启后不存在，不预热。 */
	noSession?: boolean;
};

/**
 * 选出要预热的会话 id，按「项目最近活跃」排序，每个项目只取最新一条。
 * 已有 runtime 的跳过，名额顺延给下一个项目。
 */
export function planStartupSessionWarmup(
	projects: readonly StartupWarmupProject[],
	sessions: readonly StartupWarmupSession[],
	options?: {
		limit?: number;
		alreadyWarm?: ReadonlySet<string>;
	},
): string[] {
	const limit = Math.max(0, options?.limit ?? STARTUP_SESSION_WARMUP_LIMIT);
	const warm = options?.alreadyWarm ?? new Set<string>();
	const known = new Set(
		projects.filter((project) => !project.missing).map((project) => project.id),
	);

	const latestByProject = new Map<string, StartupWarmupSession>();
	for (const session of sessions) {
		if (!known.has(session.projectId)) continue;
		if (session.parentSessionPath || session.noSession) continue;
		if (warm.has(session.id)) continue;
		const current = latestByProject.get(session.projectId);
		if (
			!current
			|| session.updatedAt > current.updatedAt
			|| (session.updatedAt === current.updatedAt && session.id > current.id)
		) {
			latestByProject.set(session.projectId, session);
		}
	}

	return [...latestByProject.values()]
		.sort((left, right) =>
			right.updatedAt - left.updatedAt
			|| (left.id < right.id ? -1 : left.id > right.id ? 1 : 0),
		)
		.slice(0, limit)
		.map((session) => session.id);
}

export async function runStartupSessionWarmup(input: {
	projects: readonly StartupWarmupProject[];
	sessions: readonly StartupWarmupSession[];
	isWarm: (sessionId: string) => boolean;
	activate: (sessionId: string) => Promise<{
		ok: boolean;
		error?: { message?: string; code?: string; debugDetails?: string };
	}>;
	log?: (level: "info" | "warn", message: string, detail?: Record<string, unknown>) => void;
	limit?: number;
}): Promise<string[]> {
	const planned = planStartupSessionWarmup(input.projects, input.sessions, {
		limit: input.limit,
		alreadyWarm: new Set(input.sessions.map((session) => session.id).filter((id) => input.isWarm(id))),
	});
	const warmed: string[] = [];
	for (const sessionId of planned) {
		if (input.isWarm(sessionId)) continue;
		try {
			const result = await input.activate(sessionId);
			if (!result.ok) {
				input.log?.("warn", "Startup session warmup failed", {
					sessionId,
					error: result.error?.debugDetails ?? result.error?.message ?? result.error?.code,
				});
				continue;
			}
			warmed.push(sessionId);
			input.log?.("info", "Startup session warmed", { sessionId });
		} catch (error) {
			input.log?.("warn", "Startup session warmup failed", {
				sessionId,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	}
	return warmed;
}
