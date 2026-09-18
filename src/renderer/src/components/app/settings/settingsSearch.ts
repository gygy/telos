import type { SettingsTabId } from "../../../atoms";
import type { TranslationKey } from "../../../i18n";
import { SETTINGS_TAB_IDS } from "./settingsTabLayout";

/**
 * 设置窗口内搜索目录：系统设置 17 个 tab + 配置管理（Pi 模型/技能等）。
 * 文案 key 在调用方用 t() 展开后再拼 haystack；本模块保持无 React / 无 i18n 运行时依赖，便于单测。
 */
export type SettingsSearchTarget = {
	id: string;
	labelKey: TranslationKey;
	/** 额外检索词（中英均可），不展示，只参与匹配。 */
	aliases?: readonly string[];
	pane: "settings" | "config";
	tab?: SettingsTabId;
	configTab?: "models" | "auth" | "settings" | "trust" | "mcp" | "raw";
	configSection?: "skills" | "extensions" | "prompts";
	backendPane?: "pi" | "dsh";
};

const SETTINGS_TAB_LABEL_KEYS: Record<SettingsTabId, TranslationKey> = {
	common: "settings.tabs.common",
	shortcuts: "settings.tabs.shortcuts",
	notification: "settings.tabs.notification",
	appearance: "settings.tabs.appearance",
	proxy: "settings.tabs.proxy",
	web: "settings.tabs.web",
	editors: "settings.tabs.editors",
	git: "settings.tabs.git",
	dev: "settings.tabs.dev",
	im: "settings.tabs.im",
	pet: "settings.tabs.pet",
	storage: "settings.tabs.storage",
	backup: "settings.tabs.backup",
	usage: "settings.tabs.usage",
	process: "settings.tabs.process",
	vision: "settings.tabs.vision",
	imagegen: "settings.tabs.imagegen",
};

const SETTINGS_TAB_ALIASES: Partial<Record<SettingsTabId, readonly string[]>> = {
	proxy: ["http", "socks", "vpn", "代理"],
	git: ["commit", "repo", "仓库"],
	web: ["lan", "局域网"],
	vision: ["ocr", "视觉"],
	imagegen: ["image", "生图"],
	im: ["feishu", "lark", "飞书"],
	pet: ["desktop pet", "宠物"],
	dev: ["pi path", "debug", "开发"],
	storage: ["cache", "log", "缓存", "日志"],
	backup: ["snapshot", "备份"],
};

const SETTINGS_TAB_TARGETS: readonly SettingsSearchTarget[] = SETTINGS_TAB_IDS.map((id) => ({
	id: `settings:${id}`,
	labelKey: SETTINGS_TAB_LABEL_KEYS[id],
	aliases: SETTINGS_TAB_ALIASES[id],
	pane: "settings",
	tab: id,
}));

const CONFIG_SEARCH_TARGETS: readonly SettingsSearchTarget[] = [
	{
		id: "config:models",
		labelKey: "config.nav.models",
		aliases: ["provider", "models.json", "api", "模型"],
		pane: "config",
		configTab: "models",
		backendPane: "pi",
	},
	{
		id: "config:auth",
		labelKey: "config.nav.auth",
		aliases: ["apiKey", "token", "认证", "密钥"],
		pane: "config",
		configTab: "auth",
		backendPane: "pi",
	},
	{
		id: "config:settings",
		labelKey: "config.nav.settings",
		pane: "config",
		configTab: "settings",
		backendPane: "pi",
	},
	{
		id: "config:trust",
		labelKey: "config.nav.trust",
		aliases: ["permission", "信任"],
		pane: "config",
		configTab: "trust",
		backendPane: "pi",
	},
	{
		id: "config:mcp",
		labelKey: "config.nav.mcp",
		aliases: ["mcp", "adapter"],
		pane: "config",
		configTab: "mcp",
		backendPane: "pi",
	},
	{
		id: "config:raw",
		labelKey: "config.nav.raw",
		aliases: ["json", "源文件"],
		pane: "config",
		configTab: "raw",
		backendPane: "pi",
	},
	{
		id: "config:skills",
		labelKey: "config.nav.skills",
		aliases: ["skill", "技能"],
		pane: "config",
		configSection: "skills",
		backendPane: "pi",
	},
	{
		id: "config:extensions",
		labelKey: "config.nav.extensions",
		aliases: ["plugin", "扩展", "拓展"],
		pane: "config",
		configSection: "extensions",
		backendPane: "pi",
	},
	{
		id: "config:prompts",
		labelKey: "config.nav.prompts",
		aliases: ["template", "提示词"],
		pane: "config",
		configSection: "prompts",
		backendPane: "pi",
	},
	{
		id: "config:dsh",
		labelKey: "config.backend.dsh",
		aliases: ["dsh", "host"],
		pane: "config",
		backendPane: "dsh",
	},
];

export const SETTINGS_SEARCH_TARGETS: readonly SettingsSearchTarget[] = [
	...SETTINGS_TAB_TARGETS,
	...CONFIG_SEARCH_TARGETS,
];

/** 把展示名与别名拼成小写检索串；空格分隔，includes 即可命中中英关键词。 */
export function buildSettingsSearchHaystack(label: string, aliases?: readonly string[]): string {
	return [label, ...(aliases ?? [])].join(" ").toLowerCase();
}

/**
 * 按查询过滤目录。空查询返回全部（打开搜索即可浏览）；大小写不敏感。
 */
export function filterSettingsSearchHits<T extends { haystack: string }>(
	query: string,
	items: readonly T[],
): T[] {
	const q = query.trim().toLowerCase();
	if (!q) return [...items];
	return items.filter((item) => item.haystack.includes(q));
}
