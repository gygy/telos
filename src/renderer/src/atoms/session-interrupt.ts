import { atom } from "jotai";

/**
 * 用户点停止且 abort 成功后的会话标记。
 *
 * 停止不写时间线（避免系统卡片打断 agent-run），所以「已中断、队列还在、
 * 文件可从检查点回退」只能靠这份会话级标记撑住，直到下一轮真正跑起来再清掉。
 */
export const sessionInterruptedAtAtom = atom<Record<string, number>>({});
