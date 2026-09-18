import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { t } from "../../../i18n";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "../../ui-shadcn/command";
import { Popover, PopoverContent, PopoverTrigger } from "../../ui-shadcn/popover";
import { cn } from "../../../lib/utils";
import {
	buildSettingsSearchHaystack,
	filterSettingsSearchHits,
	SETTINGS_SEARCH_TARGETS,
	type SettingsSearchTarget,
} from "./settingsSearch";

/**
 * 设置窗口标题栏搜索：匹配系统设置 tab 与配置管理（模型/技能/扩展等），选中后由外壳切分区。
 * 用 cmdk 列表但关掉自带 filter，走 haystack（含别名）以免只搜到当前语言的标题。
 */
export function SettingsSearchBox(props: {
	onPick: (target: SettingsSearchTarget) => void;
	className?: string;
}) {
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");

	const catalog = useMemo(
		() =>
			SETTINGS_SEARCH_TARGETS.map((target) => ({
				...target,
				label: t(target.labelKey),
				haystack: buildSettingsSearchHaystack(t(target.labelKey), target.aliases),
			})),
		[],
	);
	const hits = filterSettingsSearchHits(query, catalog);
	const settingsHits = hits.filter((item) => item.pane === "settings");
	const configHits = hits.filter((item) => item.pane === "config");

	const pick = (target: SettingsSearchTarget) => {
		props.onPick(target);
		setOpen(false);
		setQuery("");
	};

	return (
		<Popover
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (!next) setQuery("");
			}}
		>
			<PopoverTrigger asChild>
				<button
					type="button"
					data-testid="settings-search"
					className={cn(
						"flex h-8 min-w-36 max-w-64 flex-1 items-center gap-2 rounded-md border border-input bg-transparent px-2.5 text-left text-sm text-muted-foreground shadow-xs hover:bg-muted/40",
						props.className,
					)}
					aria-label={t("settings.searchPlaceholder")}
				>
					<Search className="size-3.5 shrink-0 opacity-60" aria-hidden="true" />
					<span className="truncate">{t("settings.searchPlaceholder")}</span>
				</button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-80 p-0" onOpenAutoFocus={(event) => event.preventDefault()}>
				<Command shouldFilter={false} className="rounded-md border-0">
					<CommandInput
						autoFocus
						value={query}
						onValueChange={setQuery}
						placeholder={t("settings.searchPlaceholder")}
					/>
					<CommandList>
						<CommandEmpty>{t("settings.searchEmpty")}</CommandEmpty>
						{settingsHits.length > 0 ? (
							<CommandGroup heading={t("settings.panes.system")}>
								{settingsHits.map((item) => (
									<CommandItem
										key={item.id}
										value={item.id}
										onSelect={() => pick(item)}
									>
										{item.label}
									</CommandItem>
								))}
							</CommandGroup>
						) : null}
						{configHits.length > 0 ? (
							<CommandGroup heading={t("settings.panes.config")}>
								{configHits.map((item) => (
									<CommandItem
										key={item.id}
										value={item.id}
										onSelect={() => pick(item)}
									>
										{item.label}
									</CommandItem>
								))}
							</CommandGroup>
						) : null}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
