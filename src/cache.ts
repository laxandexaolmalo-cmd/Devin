// Opt-in in-memory cache. Off by default — Supa.js favors fresh data.
// Enable with: `bot.cache.enable()` and use bot.cache.users.get(id) etc.

import type { Channel } from "./channel.js";
import type { Guild, GuildMember } from "./guild.js";
import type { Message } from "./message.js";
import type { Role, User } from "./structures.js";

interface LRUOpts {
  max: number;
}

export class LRUMap<K, V> {
  private map = new Map<K, V>();
  private max: number;
  constructor(opts: LRUOpts = { max: 1000 }) {
    this.max = opts.max;
  }
  get(k: K): V | undefined {
    const v = this.map.get(k);
    if (v !== undefined) {
      this.map.delete(k);
      this.map.set(k, v);
    }
    return v;
  }
  set(k: K, v: V): this {
    if (this.map.has(k)) this.map.delete(k);
    this.map.set(k, v);
    while (this.map.size > this.max) {
      const oldest = this.map.keys().next().value as K;
      this.map.delete(oldest);
    }
    return this;
  }
  has(k: K): boolean {
    return this.map.has(k);
  }
  delete(k: K): boolean {
    return this.map.delete(k);
  }
  get size(): number {
    return this.map.size;
  }
  clear(): void {
    this.map.clear();
  }
  values(): IterableIterator<V> {
    return this.map.values();
  }
  keys(): IterableIterator<K> {
    return this.map.keys();
  }
}

export class Cache {
  enabled = false;
  users = new LRUMap<string, User>({ max: 5000 });
  members = new LRUMap<string, GuildMember>({ max: 5000 }); // key: `${guildId}:${userId}`
  guilds = new LRUMap<string, Guild>({ max: 500 });
  channels = new LRUMap<string, Channel>({ max: 5000 });
  roles = new LRUMap<string, Role>({ max: 5000 });
  messages = new LRUMap<string, Message>({ max: 1000 });

  enable(opts?: { users?: number; messages?: number; channels?: number; guilds?: number; members?: number; roles?: number }): void {
    this.enabled = true;
    if (opts?.users) this.users = new LRUMap({ max: opts.users });
    if (opts?.messages) this.messages = new LRUMap({ max: opts.messages });
    if (opts?.channels) this.channels = new LRUMap({ max: opts.channels });
    if (opts?.guilds) this.guilds = new LRUMap({ max: opts.guilds });
    if (opts?.members) this.members = new LRUMap({ max: opts.members });
    if (opts?.roles) this.roles = new LRUMap({ max: opts.roles });
  }

  /** memberKey helper. */
  static mk(guildId: string, userId: string): string {
    return `${guildId}:${userId}`;
  }
}
