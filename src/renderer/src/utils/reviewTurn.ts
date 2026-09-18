/**
 * 审阅面板用的「本轮命令」摘要。
 *
 * 只取最后一个 user 消息之后的 bash/shell 工具，避免历史命令把审阅页堆满。
 * 完整输出仍在时间线；这里只留命令和截断结果，方便扫一眼本轮做了什么。
 */

export type ReviewCommandItem = {
	id: string;
	command: string;
	output: string;
	failed: boolean;
};

export type ReviewTurnMessage = {
	id: string;
	role: string;
	text: string;
	meta?: Record<string, unknown>;
};

const COMMAND_TOOLS = new Set(["bash", "shell", "run", "exec", "terminal"]);

function asString(value: unknown): string | undefined {
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function toolName(message: ReviewTurnMessage): string {
	const fromMeta = asString(message.meta?.toolName);
	if (fromMeta) return fromMeta.toLowerCase();
	const text = message.text.replace(/^[\u25b6\u2713\u2717]\s*/u, "").trim();
	return (text.split(/\s+/)[0] ?? "").toLowerCase();
}

function isCommandTool(name: string): boolean {
	return COMMAND_TOOLS.has(name) || name.includes("bash") || name.includes("shell");
}

function commandFromArgs(args: unknown): string | undefined {
	if (typeof args === "string") {
		try {
			return commandFromArgs(JSON.parse(args) as unknown);
		} catch {
			return undefined;
		}
	}
	if (!args || typeof args !== "object" || Array.isArray(args)) return undefined;
	const record = args as Record<string, unknown>;
	return asString(record.command) ?? asString(record.cmd);
}

function flatten(text: string, max: number): string {
	const flat = text.replace(/\s+/g, " ").trim();
	return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/** 本轮命令，最多 `limit` 条；没有 user 消息时回退扫全部（与文件汇总口径一致）。 */
export function collectLatestTurnCommands(
	messages: readonly ReviewTurnMessage[],
	limit = 12,
): ReviewCommandItem[] {
	let lastUser = -1;
	for (let i = 0; i < messages.length; i += 1) {
		if (messages[i]?.role === "user") lastUser = i;
	}
	const slice = lastUser < 0 ? messages : messages.slice(lastUser + 1);
	const items: ReviewCommandItem[] = [];
	for (const message of slice) {
		if (message.role !== "tool" || !isCommandTool(toolName(message))) continue;
		const command = commandFromArgs(message.meta?.args) ?? flatten(message.text, 160);
		if (!command) continue;
		const status = asString(message.meta?.status);
		const output = asString(message.meta?.detailText) ?? asString(message.meta?.result) ?? "";
		items.push({
			id: message.id,
			command,
			output: output ? flatten(output, 240) : "",
			failed: message.meta?.isError === true || status === "error" || status === "aborted" || status === "stopped",
		});
		if (items.length >= limit) break;
	}
	return items;
}
