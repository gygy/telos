import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { t } from "../../../i18n";
import { Button } from "../../ui-shadcn/button";
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
 * 设置窗口搜索：挂在「系统设置 / 配置管理」分区标签左侧，只用图标按钮，
 * 避免标题栏再出现一块「放大镜 + 长文案」看起来像第三个标签。
 * 点开后才是真正的搜索框（cmdk）；haystack 含别名，关掉 cmdk 自带 filter。
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
			modal={false}
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (!next) setQuery("");
			}}
		>
			<PopoverTrigger asChild>
				<Button
					type="button"
					variant="ghost"
					size="icon-sm"
					data-testid="settings-search"
					className={cn("size-8 shrink-0 text-muted-foreground", props.className)}
					title={t("settings.searchAction")}
					aria-label={t("settings.searchAction")}
				>
					<Search className="size-4" aria-hidden="true" />
				</Button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-80 p-0">
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
