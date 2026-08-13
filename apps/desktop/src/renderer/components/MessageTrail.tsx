/**
 * Left-gutter message rail with Dock-style magnification + hover preview.
 * Interaction copied from Synara MessageTrail.
 */
import {
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent as ReactFocusEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { t, type Locale } from "../lib/i18n.ts";
import {
  clampNumber,
  clampTooltipTop,
  computeFocusedIndex,
  computeGaussianWeights,
  computeRestStyles,
  computeSigma,
  computeTickStyles,
  computeTrailGeometry,
  type MessageTrailItem,
  type TickStyle,
  type TrailGeometry,
} from "../lib/message-trail.ts";
import { cn } from "../lib/utils.ts";

const MIN_PANE_WIDTH_PX = 864;
const RAIL_WIDTH_PX = 56;
const RAIL_MAX_HEIGHT_RATIO = 0.8;
const TICK_LEFT_PAD_PX = 14;
const TICK_HEIGHT_PX = 2;
const TICK_BASE_W = 6;
const TICK_MAX_W = 30;
const TICK_SPACING_PX = 10;
const TICK_REST_OPACITY = 0.2;
const TICK_VISIBLE_OPACITY = 0.52;
const TICK_ANCHOR_OPACITY = 0.9;
const TICK_FOCUS_OPACITY = 1;
const TOOLTIP_ESTIMATED_H_PX = 56;
const TOOLTIP_OFFSET_X_PX = 8;

export function MessageTrail(props: {
  items: readonly MessageTrailItem[];
  locale: Locale;
  onSelect: (messageId: string) => void;
}) {
  const { items, locale, onSelect } = props;
  const rootRef = useRef<HTMLElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const tooltipRef = useRef<HTMLDivElement | null>(null);
  const tooltipMessageRef = useRef<HTMLDivElement | null>(null);
  const tooltipResponseRef = useRef<HTMLDivElement | null>(null);
  const tickRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const tooltipId = useId();

  const [hasGutter, setHasGutter] = useState(false);
  const [rovingIndex, setRovingIndex] = useState(0);

  const anchorIndex = items.length > 0 ? items.length - 1 : -1;
  const visible = hasGutter && items.length > 1;
  const geometry = computeTrailGeometry({ count: items.length, spacingPx: TICK_SPACING_PX });

  const rafIdRef = useRef<number | null>(null);
  const latestPointerClientYRef = useRef<number | null>(null);
  const focusOverrideIndexRef = useRef<number | null>(null);
  const geometryRef = useRef<TrailGeometry | null>(geometry);
  const tooltipIndexRef = useRef(-1);
  const reducedMotionRef = useRef(false);
  const itemsRef = useRef(items);
  const anchorIndexRef = useRef(anchorIndex);
  const onSelectRef = useRef(onSelect);
  const visibleRef = useRef(visible);

  useEffect(() => {
    geometryRef.current = geometry;
    itemsRef.current = items;
    anchorIndexRef.current = anchorIndex;
    onSelectRef.current = onSelect;
    visibleRef.current = visible;
    if (tickRefs.current.length > items.length) tickRefs.current.length = items.length;
  }, [geometry, items, anchorIndex, onSelect, visible]);

  const writeStyles = (styles: readonly TickStyle[]) => {
    const refs = tickRefs.current;
    for (let i = 0; i < styles.length; i += 1) {
      const el = refs[i];
      if (!el) continue;
      el.style.width = `${styles[i]!.width}px`;
      el.style.opacity = `${styles[i]!.opacity}`;
    }
  };

  const hideTooltip = () => {
    tooltipIndexRef.current = -1;
    const tip = tooltipRef.current;
    if (tip) tip.style.visibility = "hidden";
  };

  const showTooltip = (index: number, geo: TrailGeometry) => {
    const tip = tooltipRef.current;
    const item = itemsRef.current[index];
    if (!tip || !item) return;
    if (tooltipIndexRef.current !== index) {
      tooltipIndexRef.current = index;
      const messageEl = tooltipMessageRef.current;
      const responseEl = tooltipResponseRef.current;
      if (messageEl) messageEl.textContent = item.preview;
      if (responseEl) {
        responseEl.textContent = item.responsePreview;
        responseEl.style.display = item.responsePreview ? "" : "none";
      }
    }
    const viewport = viewportRef.current;
    const viewportHeight = viewport?.clientHeight ?? 0;
    const tooltipHeight = tip.offsetHeight || TOOLTIP_ESTIMATED_H_PX;
    const centerY = geo.centerYs[index] ?? viewportHeight / 2;
    const visibleY = centerY - (viewport?.scrollTop ?? 0);
    const offsetTop = viewport?.offsetTop ?? 0;
    tip.style.top = `${offsetTop + clampTooltipTop(visibleY, tooltipHeight, viewportHeight)}px`;
    tip.style.visibility = "visible";
  };

  const applyRest = () => {
    const styles = computeRestStyles(
      itemsRef.current.length,
      anchorIndexRef.current,
      TICK_BASE_W,
      TICK_REST_OPACITY,
      TICK_ANCHOR_OPACITY,
    );
    const last = styles[styles.length - 1];
    if (last) last.opacity = Math.max(last.opacity, TICK_VISIBLE_OPACITY);
    writeStyles(styles);
    hideTooltip();
  };

  const layoutTicks = () => {
    const geo = geometryRef.current;
    if (!geo) return;
    const refs = tickRefs.current;
    for (let i = 0; i < refs.length; i += 1) {
      const el = refs[i];
      if (!el) continue;
      const centerY = geo.centerYs[i] ?? 0;
      el.style.top = `${centerY - TICK_HEIGHT_PX / 2}px`;
    }
    if (latestPointerClientYRef.current === null && focusOverrideIndexRef.current === null) {
      applyRest();
    }
  };

  const renderFrame = () => {
    rafIdRef.current = null;
    const geo = geometryRef.current;
    if (!geo || !visibleRef.current) return;
    const count = itemsRef.current.length;
    if (count === 0) return;
    let activeY: number | null = null;
    const rawPointerY = latestPointerClientYRef.current;
    if (rawPointerY !== null) {
      activeY = rawPointerY + (viewportRef.current?.scrollTop ?? 0);
    } else if (focusOverrideIndexRef.current !== null) {
      activeY = geo.centerYs[focusOverrideIndexRef.current] ?? null;
    }
    if (activeY === null) {
      applyRest();
      return;
    }
    const focusedIndex = computeFocusedIndex(activeY, geo);
    let styles: TickStyle[];
    if (geo.spacing === 0 || reducedMotionRef.current) {
      styles = computeRestStyles(
        count,
        anchorIndexRef.current,
        TICK_BASE_W,
        TICK_REST_OPACITY,
        TICK_ANCHOR_OPACITY,
      );
      const focusedStyle = styles[focusedIndex];
      if (focusedStyle) focusedStyle.width = TICK_MAX_W;
    } else {
      const sigma = computeSigma(geo.spacing);
      const weights = computeGaussianWeights(geo.centerYs, activeY, sigma);
      styles = computeTickStyles(
        weights,
        anchorIndexRef.current,
        TICK_BASE_W,
        TICK_MAX_W,
        TICK_REST_OPACITY,
        TICK_ANCHOR_OPACITY,
      );
    }
    const focusedStyle = styles[focusedIndex];
    if (focusedStyle) focusedStyle.opacity = TICK_FOCUS_OPACITY;
    writeStyles(styles);
    showTooltip(focusedIndex, geo);
  };

  const scheduleFrame = () => {
    if (rafIdRef.current === null) rafIdRef.current = requestAnimationFrame(renderFrame);
  };

  const cancelFrame = () => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  };

  useEffect(() => {
    const root = rootRef.current;
    const pane = root?.parentElement;
    if (!pane || typeof ResizeObserver === "undefined") return;
    let pendingRaf: number | null = null;
    const measure = () => {
      pendingRaf = null;
      setHasGutter(pane.clientWidth >= MIN_PANE_WIDTH_PX);
    };
    const schedule = () => {
      if (pendingRaf === null) pendingRaf = requestAnimationFrame(measure);
    };
    schedule();
    const observer = new ResizeObserver(schedule);
    observer.observe(pane);
    return () => {
      if (pendingRaf !== null) cancelAnimationFrame(pendingRaf);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    layoutTicks();
  }, [geometry, items.length]);

  useEffect(() => {
    if (latestPointerClientYRef.current === null && focusOverrideIndexRef.current === null) {
      applyRest();
    }
  }, [anchorIndex]);

  useEffect(() => {
    reducedMotionRef.current =
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
        : false;
  }, []);

  useEffect(() => {
    if (!visible) {
      cancelFrame();
      latestPointerClientYRef.current = null;
      focusOverrideIndexRef.current = null;
      hideTooltip();
    }
  }, [visible]);

  useEffect(() => cancelFrame, []);

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch" || !visibleRef.current) return;
    const viewport = viewportRef.current;
    if (!viewport) return;
    latestPointerClientYRef.current = event.clientY - viewport.getBoundingClientRect().top;
    scheduleFrame();
  };

  const handlePointerEnter = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    handlePointerMove(event);
  };

  const handlePointerLeave = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "touch") return;
    latestPointerClientYRef.current = null;
    if (focusOverrideIndexRef.current === null) applyRest();
  };

  const handleScroll = () => {
    if (latestPointerClientYRef.current !== null) scheduleFrame();
  };

  const handleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const geo = geometryRef.current;
    const viewport = viewportRef.current;
    if (!geo || !viewport || !visibleRef.current) return;
    const y = event.clientY - viewport.getBoundingClientRect().top + viewport.scrollTop;
    const index = computeFocusedIndex(y, geo);
    const item = itemsRef.current[index];
    if (item) onSelectRef.current(item.id);
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (!visibleRef.current || items.length === 0) return;
    let next = rovingIndex;
    if (event.key === "ArrowDown" || event.key === "j")
      next = Math.min(items.length - 1, rovingIndex + 1);
    else if (event.key === "ArrowUp" || event.key === "k") next = Math.max(0, rovingIndex - 1);
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = items.length - 1;
    else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const item = items[rovingIndex];
      if (item) onSelect(item.id);
      return;
    } else return;
    event.preventDefault();
    setRovingIndex(next);
    focusOverrideIndexRef.current = next;
    tickRefs.current[next]?.focus();
    if (geometry) showTooltip(next, geometry);
    scheduleFrame();
  };

  const handleTickFocus = (index: number) => {
    focusOverrideIndexRef.current = index;
    setRovingIndex(index);
    if (geometry) showTooltip(index, geometry);
    scheduleFrame();
  };

  const handleRailBlur = (event: ReactFocusEvent<HTMLElement>) => {
    const root = rootRef.current;
    if (root && event.relatedTarget instanceof Node && root.contains(event.relatedTarget)) return;
    focusOverrideIndexRef.current = null;
    if (latestPointerClientYRef.current === null) applyRest();
  };

  const tabStop = clampNumber(rovingIndex, 0, Math.max(0, items.length - 1));

  return (
    <nav
      ref={rootRef}
      aria-label={t(locale, "timeline.trail")}
      aria-hidden={!visible}
      data-testid="message-trail"
      onKeyDown={handleKeyDown}
      onBlur={handleRailBlur}
      className={cn(
        "pointer-events-none absolute inset-y-0 left-0 z-20 hidden flex-col justify-center sm:flex",
        visible ? "opacity-100" : "opacity-0",
      )}
      style={{ width: RAIL_WIDTH_PX }}
    >
      <div
        ref={viewportRef}
        onPointerEnter={handlePointerEnter}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onScroll={handleScroll}
        onClick={handleClick}
        className={cn(
          "relative w-full overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          visible ? "pointer-events-auto" : "pointer-events-none",
        )}
        style={{ maxHeight: `${RAIL_MAX_HEIGHT_RATIO * 100}%` }}
      >
        <div className="relative w-full" style={{ height: geometry?.contentHeight }}>
          {items.map((item, index) => (
            <button
              key={item.id}
              ref={(el) => {
                tickRefs.current[index] = el;
              }}
              type="button"
              tabIndex={visible && index === tabStop ? 0 : -1}
              aria-label={`${t(locale, "timeline.trail.message", { n: String(item.ordinal) })}: ${item.preview.slice(0, 60)}`}
              aria-describedby={tooltipId}
              aria-current={index === anchorIndex ? "location" : undefined}
              onFocus={() => handleTickFocus(index)}
              className="absolute rounded-full outline-none transition-[width,opacity] duration-[90ms] ease-out focus-visible:ring-2 focus-visible:ring-[var(--border)] motion-reduce:transition-none"
              style={{
                left: TICK_LEFT_PAD_PX,
                height: TICK_HEIGHT_PX,
                width: TICK_BASE_W,
                opacity: index === anchorIndex ? TICK_ANCHOR_OPACITY : TICK_REST_OPACITY,
                backgroundColor: "var(--foreground)",
                willChange: "width, opacity",
              }}
            />
          ))}
        </div>
      </div>
      <div
        ref={tooltipRef}
        role="tooltip"
        id={tooltipId}
        className="pointer-events-none invisible absolute z-30 w-64 -translate-y-1/2 rounded-xl border border-border bg-popover/95 p-2 text-popover-foreground shadow-[var(--shadow-soft)]"
        style={{ left: RAIL_WIDTH_PX + TOOLTIP_OFFSET_X_PX, top: 0, visibility: "hidden" }}
      >
        <div
          ref={tooltipMessageRef}
          className="line-clamp-2 text-xs leading-snug font-medium text-foreground"
        />
        <div
          ref={tooltipResponseRef}
          className="mt-1 line-clamp-3 text-xs leading-snug text-muted-foreground"
        />
      </div>
    </nav>
  );
}
