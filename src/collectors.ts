// Collectors — tiny async helpers over the gateway event stream.
// Wait for messages, reactions, or component interactions matching a filter.

import type { Bot } from "./bot.js";
import type { Message } from "./message.js";
import type { ComponentCtx, ModalCtx } from "./interactions.js";

export interface CollectOptions<T> {
  /** Filter — return true to accept the item. */
  filter?: (t: T) => boolean;
  /** Stop after N items. Default 1. */
  max?: number;
  /** Timeout in ms. Default 60_000. */
  timeout?: number;
}

function makeCollector<T>(
  bot: Bot,
  event: "message" | "messageReactionAdd" | "interaction",
  filter: (t: T) => boolean,
  opts: CollectOptions<T>,
): Promise<T[]> {
  return new Promise((resolve) => {
    const collected: T[] = [];
    const max = opts.max ?? 1;
    const timeout = opts.timeout ?? 60_000;
    let done = false;

    const handler = (t: T) => {
      if (done || !filter(t)) return;
      collected.push(t);
      if (collected.length >= max) finish();
    };
    const finish = () => {
      if (done) return;
      done = true;
      bot.off(event as never, handler as never);
      clearTimeout(timer);
      resolve(collected);
    };
    const timer = setTimeout(finish, timeout);
    bot.on(event as never, handler as never);
  });
}

export const collect = {
  message(bot: Bot, opts: CollectOptions<Message> = {}): Promise<Message[]> {
    return makeCollector<Message>(bot, "message", opts.filter ?? (() => true), opts);
  },
  reaction(bot: Bot, opts: CollectOptions<{ messageId: string; userId: string; emoji: string }> = {}): Promise<{ messageId: string; userId: string; emoji: string }[]> {
    return makeCollector(bot, "messageReactionAdd", opts.filter ?? (() => true), opts);
  },
  component(bot: Bot, opts: CollectOptions<ComponentCtx> = {}): Promise<ComponentCtx[]> {
    return makeCollector<ComponentCtx>(bot, "interaction", opts.filter ?? ((c) => (c as unknown as ComponentCtx).customId !== undefined && (c as unknown as ComponentCtx).componentType !== undefined), opts);
  },
  modal(bot: Bot, opts: CollectOptions<ModalCtx> = {}): Promise<ModalCtx[]> {
    return makeCollector<ModalCtx>(bot, "interaction", opts.filter ?? (() => true), opts);
  },
};

/** Awaitable single-item helpers. */
export const await_ = {
  async message(bot: Bot, opts: Omit<CollectOptions<Message>, "max"> = {}): Promise<Message | null> {
    const arr = await collect.message(bot, { ...opts, max: 1 });
    return arr[0] ?? null;
  },
  async component(bot: Bot, opts: Omit<CollectOptions<ComponentCtx>, "max"> = {}): Promise<ComponentCtx | null> {
    const arr = await collect.component(bot, { ...opts, max: 1 });
    return arr[0] ?? null;
  },
};
