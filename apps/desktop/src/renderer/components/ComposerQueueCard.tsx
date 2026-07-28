/**
 * Queued steer / follow-up strip above the composer input.
 *
 * Per-row: 立即发送 / 编辑 / 取消
 * Card-level: 清空全部 (host clearQueue)
 *
 * Shared by product Composer and the session-content demo.
 */
import type { QueuedMessages } from "@pix/contracts";
import { ListTodo } from "lucide-react";
import { t, type Locale } from "../lib/i18n.ts";
import { cn } from "../lib/utils.ts";

export type QueueItemKind = "steering" | "followUp";

export type ComposerQueueItem = {
  message: string;
  kind: QueueItemKind;
  /** Index within steering[] or followUp[]. */
  index: number;
};

function queuedMessagePreview(message: string): string {
  return message.split("\n\n<attached-paths>", 1)[0]?.trim() || message.trim();
}

export function flattenQueuedMessages(queued: QueuedMessages): ComposerQueueItem[] {
  return [
    ...queued.steering.map((message, index) => ({
      message,
      kind: "steering" as const,
      index,
    })),
    ...queued.followUp.map((message, index) => ({
      message,
      kind: "followUp" as const,
      index,
    })),
  ];
}

export function removeQueuedItem(
  queued: QueuedMessages,
  kind: QueueItemKind,
  index: number,
): QueuedMessages {
  if (kind === "steering") {
    return {
      steering: queued.steering.filter((_, i) => i !== index),
      followUp: queued.followUp,
    };
  }
  return {
    steering: queued.steering,
    followUp: queued.followUp.filter((_, i) => i !== index),
  };
}

/** Replace one queue row's text (edit). */
export function replaceQueuedItem(
  queued: QueuedMessages,
  kind: QueueItemKind,
  index: number,
  message: string,
): QueuedMessages {
  if (kind === "steering") {
    return {
      steering: queued.steering.map((m, i) => (i === index ? message : m)),
      followUp: queued.followUp,
    };
  }
  return {
    steering: queued.steering,
    followUp: queued.followUp.map((m, i) => (i === index ? message : m)),
  };
}

export function ComposerQueueCard(props: {
  locale: Locale;
  queuedMessages: QueuedMessages;
  /** When true, show the interrupted/paused banner + Continue. */
  paused?: boolean;
  onClearQueue: () => void;
  onRemoveItem?: (kind: QueueItemKind, index: number) => void;
  /** 立即发送 this queued message. */
  onSendNow?: (kind: QueueItemKind, index: number, message: string) => void;
  /** 编辑：load message into the composer and drop it from the queue. */
  onEditItem?: (kind: QueueItemKind, index: number, message: string) => void;
  onContinue?: () => void;
  className?: string;
}) {
  const tr = (key: Parameters<typeof t>[1], vars?: Record<string, string>) =>
    t(props.locale, key, vars);

  const queuedItems = flattenQueuedMessages(props.queuedMessages);
  if (queuedItems.length === 0) return null;

  const paused = Boolean(props.paused);

  function removeItem(item: ComposerQueueItem) {
    if (props.onRemoveItem) props.onRemoveItem(item.kind, item.index);
    else props.onClearQueue();
  }

  return (
    <div
      className={cn("composer-queue-card", props.className)}
      data-testid="composer-queue-card"
      data-paused={paused ? "true" : "false"}
    >
      {paused ? (
        <div className="composer-queue-banner" data-testid="composer-queue-paused">
          <span className="composer-queue-banner-text">{tr("composer.queue.paused")}</span>
        </div>
      ) : null}

      <div className="composer-queue-toolbar">
        <span className="composer-queue-toolbar-label">
          {tr("composer.queue.count", { count: String(queuedItems.length) })}
        </span>
        <div className="composer-queue-toolbar-actions">
          {paused ? (
            <button
              type="button"
              className="composer-queue-action"
              data-testid="composer-queue-continue"
              onClick={props.onContinue}
            >
              {tr("composer.queue.continue")}
            </button>
          ) : null}
          <button
            type="button"
            className="composer-queue-action"
            data-testid="composer-queue-clear"
            title={tr("composer.queue.clear")}
            aria-label={tr("composer.queue.clear")}
            onClick={props.onClearQueue}
          >
            {tr("composer.queue.clearAll")}
          </button>
        </div>
      </div>

      <ul className="composer-queue-list" role="list">
        {queuedItems.map((item) => (
          <li
            key={`${item.kind}:${item.index}:${item.message}`}
            className="composer-queue-row"
            data-testid="composer-queue-item"
            data-kind={item.kind}
          >
            <ListTodo
              className="size-3.5 shrink-0 text-[var(--text-subtle)]"
              strokeWidth={1.75}
              aria-hidden
            />
            <span className="composer-queue-item-text" title={item.message}>
              {queuedMessagePreview(item.message)}
            </span>
            <div className="composer-queue-actions">
              <button
                type="button"
                className="composer-queue-action"
                data-testid="composer-queue-send-now"
                title={tr("composer.queue.sendNow")}
                onClick={() => props.onSendNow?.(item.kind, item.index, item.message)}
              >
                {tr("composer.queue.sendNow")}
              </button>
              <button
                type="button"
                className="composer-queue-action"
                data-testid="composer-queue-edit"
                title={tr("composer.queue.edit")}
                onClick={() => props.onEditItem?.(item.kind, item.index, item.message)}
              >
                {tr("composer.queue.edit")}
              </button>
              <button
                type="button"
                className="composer-queue-action"
                data-testid="composer-queue-cancel"
                title={tr("composer.queue.cancelTitle")}
                onClick={() => removeItem(item)}
              >
                {tr("composer.queue.cancel")}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
