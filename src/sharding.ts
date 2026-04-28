// Manual sharding. Each Bot can be told it's shard `[id, total]`.
// For automatic spawning use `ShardManager` which forks N Bots in this process.

import type { Bot, BotOptions } from "./bot.js";

export interface ShardOptions {
  /** Total shards to spawn. Use "auto" to ask Discord. */
  total?: number | "auto";
  /** Token for fetch /gateway/bot if using "auto". */
  token: string;
  /** Optional override factory — return a Bot per shard. */
  factory: (shardId: number, totalShards: number, opts: BotOptions) => Bot;
  /** Bot options applied to every shard. */
  botOptions?: BotOptions;
}

export class ShardManager {
  shards = new Map<number, Bot>();
  private opts: ShardOptions;

  constructor(opts: ShardOptions) {
    this.opts = opts;
  }

  async spawn(): Promise<void> {
    let total = typeof this.opts.total === "number" ? this.opts.total : 1;
    if (this.opts.total === "auto") {
      const res = await fetch("https://discord.com/api/v10/gateway/bot", {
        headers: { Authorization: `Bot ${this.opts.token}` },
      });
      const data = (await res.json()) as { shards: number };
      total = data.shards;
    }
    for (let i = 0; i < total; i++) {
      const bot = this.opts.factory(i, total, {
        ...(this.opts.botOptions ?? {}),
        shard: [i, total],
      });
      this.shards.set(i, bot);
      await bot.start();
    }
  }

  stop(): void {
    for (const b of this.shards.values()) b.stop();
    this.shards.clear();
  }
}
