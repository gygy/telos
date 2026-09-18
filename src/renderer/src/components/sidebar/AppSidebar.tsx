import React, { useEffect, useRef, useState } from "react";
import { useSetAtom } from "jotai";
import { CirclePlus, Folder, MessageSquare, PanelLeft, Search } from "lucide-react";
import { SidebarContent, type SidebarActions } from "./SidebarContent";
import type { AppInfo, AppThemeMode, WorktreeEntry } from "../../../../shared/types";
import { useSidebarController } from "../../hooks/useSidebarController";
import type { SidebarNavTab } from "../../utils/sidebarNavTab";
import { BrandLockup } from "../app/AppParts";
import { AboutPopover } from "../app/AboutPopover";
import { AnnouncementCenter } from "./AnnouncementCenter";
import { settingsOpenAtom } from "../../atoms";
import { desktopApi } from "../../desktopApi";
import { Button } from "../ui-shadcn/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui-shadcn/tooltip";
import { t } from "../../i18n";
import { AutomationDockButton } from "../automation/AutomationDockButton";
import { MorphingSearch, type MorphingSearchItem } from "../motion/morphing-search";
import { displayProjectDirectoryName, isChatProject } from "../../rendererUtils";
import { sessionDisplayName } from "../../utils/sessionDisplayName";
import { formatAccelerator } from "../../../../shared/shortcuts";
import { useShortcutBindings } from "../../hooks/useShortcutBindings";

interface AppSidebarProps {
  actions: SidebarActions;
  currentProjectId: string | undefined;
  currentSessionId: string | undefined;
  worktreesByProject: Record<string, WorktreeEntry[]>;
  branchByProject: Record<string, string | null>;
  creatingWorktree: boolean;
  /** 正在删除的 worktree 路径集合（useWorktreeActions 维护，驱动行淡出动画）。 */
  removingWorktreePaths: ReadonlySet<string>;
  isLanWeb: boolean;
  /** 「新建会话」：打开初始引导页（居中输入框 + 项目下拉切换），由 App 提供。 */
  onOpenNewSession: () => void;
  /** 问题反馈：关于面板入口打开 FeedbackDialog，由 App 的 overlay 状态驱动。 */
  onOpenFeedback: () => void;
  /** 关于弹框（版本/官网/GitHub 链接）数据，由 App 从 AppInfo IPC 拉取后提供。 */
  appInfo: AppInfo;
  /** 底栏主题切换：当前主题模式 + 点击循环（浅色→暗色→跟随系统），由 App 提供。 */
  themeMode: AppThemeMode;
  onToggleTheme: () => void;
  /** 左侧栏折叠态与开关（main 布局：按钮在品牌文字右侧） */
  listCollapsed: boolean;
  toggleListCollapsed: () => void;
  /** settings.json 中已保存的展开项目 id，权威来源 */
  settingsExpandedProjectIds?: readonly string[];
  /** settings.json 中已保存的侧栏分段（Chats/项目），权威来源 */
  settingsNavTab?: SidebarNavTab;
  /** settings.json 中已保存的稳定 SessionRecord 置顶 id。 */
  settingsPinnedSessionIds?: readonly string[];
  /** 首次 settings.get 已完成，controller 可安全处理旧 key 迁移。 */
  settingsLoaded: boolean;
  /** 展开集合完成权威 hydration 后，允许 App 按它懒加载会话。 */
  onExpandedProjectsReady: () => void;
}

export function AppSidebar(props: AppSidebarProps) {
  const setSettingsOpen = useSetAtom(settingsOpenAtom);  // 快速连续点击展开/折叠会触发多次 IPC；按顺序写入可避免旧请求最后完成后覆盖新集合。
  const expandedProjectsSaveQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const navTabSaveQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const pinnedSessionIdsSaveQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  const controller = useSidebarController({
    getRpcLogging: props.actions.rpc.getLogging,
    settingsExpandedProjectIds: props.settingsExpandedProjectIds,
    settingsNavTab: props.settingsNavTab,
    settingsPinnedSessionIds: props.settingsPinnedSessionIds,
    settingsLoaded: props.settingsLoaded,
    onExpandedProjectsReady: props.onExpandedProjectsReady,
    persistExpandedProjectIds: (projectIds) => {
      expandedProjectsSaveQueueRef.current = expandedProjectsSaveQueueRef.current
        .catch(() => undefined)
        .then(() => desktopApi.settings.update({ sidebarExpandedProjectIds: projectIds }))
        .catch(() => undefined);
    },
    persistNavTab: (tab) => {
      // 与展开集合同款串行队列：快速切换标签时避免旧请求最后完成覆盖新值
      navTabSaveQueueRef.current = navTabSaveQueueRef.current
        .catch(() => undefined)
        .then(() => desktopApi.settings.update({ sidebarNavTab: tab }))
        .catch(() => undefined);
    },
    persistPinnedSessionIds: (sessionIds) => {
      // 快速连续置顶/取消置顶必须按触发顺序落盘，避免较慢的旧请求覆盖新集合。
      pinnedSessionIdsSaveQueueRef.current = pinnedSessionIdsSaveQueueRef.current
        .catch(() => undefined)
        .then(() => desktopApi.settings.update({ pinnedSessionIds: sessionIds }))
        .catch(() => undefined);
    },
  });

  // 搜索命令面板：状态挂在顶栏宿主，避免占列表高度的三行按钮。
  const [searchOpen, setSearchOpen] = useState(false);
  const { bindings: shortcutBindings, platform } = useShortcutBindings();
  const newSessionKbd = shortcutBindings
    ? formatAccelerator(shortcutBindings.openNewSession, platform)
    : "Ctrl+N";
  const searchKbd = shortcutBindings
    ? formatAccelerator(shortcutBindings.openSearch, platform)
    : "Ctrl+F";

  useEffect(() => {
    return desktopApi.app.onShortcutTriggered((id) => {
      if (id !== "openNewSession" && id !== "openSearch") return;
      const target = document.activeElement;
      if (target instanceof HTMLElement &&
        (target.isContentEditable ||
          target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement ||
          target instanceof HTMLSelectElement)) {
        return;
      }
      if (id === "openNewSession") {
        props.onOpenNewSession();
      } else {
        setSearchOpen(true);
      }
    });
  }, [props.onOpenNewSession]);

  const searchItems: MorphingSearchItem[] = [];
  for (const project of controller.catalog.projects) {
    searchItems.push({
      id: `project:${project.id}`,
      title: displayProjectDirectoryName(project),
      description: project.path,
      icon: isChatProject(project) ? MessageSquare : Folder,
      onSelect: () => {
        props.actions.projects.select(project.id);
        controller.setProjectExpanded(project.id, true);
      },
    });
    for (const session of controller.catalog.sessionsByProject[project.id] ?? []) {
      searchItems.push({
        id: `session:${session.id}`,
        title: sessionDisplayName(session.title, session.forked) ?? session.title,
        description: session.preview,
        icon: MessageSquare,
        onSelect: () => { void props.actions.sessions.open(project.id, session.id); },
      });
    }
  }

  return (
    <>
    {/* 公告弹窗宿主：无侧栏按钮，toast「查看」写 atom 打开；须挂在侧栏树内以便通知开关链路同进程。 */}
    <AnnouncementCenter />
    {/* MorphingSearch 命令面板：锚点固定到视口水平居中，与顶栏搜索图标解耦。 */}
    <div className="pointer-events-none fixed left-1/2 top-[16vh] z-50 w-[min(640px,calc(100vw-2rem))] -translate-x-1/2">
      <MorphingSearch
        items={searchItems}
        placeholder={t("app.searchSessions")}
        shortcut=""
        iconOnly
        maxWidth={640}
        maxHeight={360}
        open={searchOpen}
        onOpenChange={setSearchOpen}
        emptyMessage={t("app.searchNoResults")}
        className="pointer-events-none h-12 w-full opacity-0"
        onQueryChange={(query) => controller.setSearch(query)}
      />
    </div>
    <SidebarContent
      controller={controller}
      actions={props.actions}
      currentProjectId={props.currentProjectId}
      currentSessionId={props.currentSessionId}
      worktreesByProject={props.worktreesByProject}
      branchByProject={props.branchByProject}
      creatingWorktree={props.creatingWorktree}
      removingWorktreePaths={props.removingWorktreePaths}
      isLanWeb={props.isLanWeb}
      onOpenNewSession={props.onOpenNewSession}
      chrome={<>
        <div className="list-toolbar flex h-10 shrink-0 items-center gap-0.5 border-b border-border/40 pr-1.5 pl-[max(0.625rem,var(--traffic-lights-width,0px))]">
          <AboutPopover appInfo={props.appInfo} onOpenFeedback={props.onOpenFeedback}>
            <div
              className="app-badge flex min-w-0 flex-1 cursor-pointer items-center justify-center pl-5"
              role="button"
              tabIndex={0}
              aria-label={t("about.title")}
              title={t("about.clickHint")}
              onKeyDown={(e) => {
                // 键盘可达性：Enter/空格等价点击，触发 MorphPopoverTrigger 注入的 onClick
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  e.currentTarget.click();
                }
              }}
            >
              <BrandLockup />
            </div>
          </AboutPopover>
          {/* 新建 / 搜索 / 定时任务收进顶栏图标行：省掉三行整宽按钮，列表立刻多出约 100px。 */}
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-7 shrink-0"
                aria-label={t("app.newSession")}
                onClick={() => props.onOpenNewSession()}
              >
                <CirclePlus className="size-3.5" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {t("app.newSession")}
              <kbd className="ml-2 text-micro text-muted-foreground">{newSessionKbd}</kbd>
            </TooltipContent>
          </Tooltip>
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-7 shrink-0"
                aria-label={t("app.searchSessions")}
                onClick={() => setSearchOpen(true)}
              >
                <Search className="size-3.5" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {t("app.searchSessions")}
              <kbd className="ml-2 text-micro text-muted-foreground">{searchKbd}</kbd>
            </TooltipContent>
          </Tooltip>
          <AutomationDockButton />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="icon-button list-toggle-native size-7"
            aria-label={props.listCollapsed ? t("app.expandList") : t("app.collapseList")}
            title={props.listCollapsed ? t("app.expandList") : t("app.collapseList")}
            onClick={props.toggleListCollapsed}
          >
            <PanelLeft size={14} strokeWidth={2} aria-hidden="true" />
          </Button>
        </div>
      </>}
      onOpenSettings={() => setSettingsOpen(true)}
      themeMode={props.themeMode}
      onToggleTheme={props.onToggleTheme}
    />
    </>
  );
}
