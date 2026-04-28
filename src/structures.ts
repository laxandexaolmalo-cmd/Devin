// Small structures: User, Role, Reaction, Invite, Webhook, Sticker, Emoji.
// Each has methods for the actions you'd want to perform on it.

import { Rest } from "./rest.js";
import {
  CDN,
  RawEmoji,
  RawInvite,
  RawReaction,
  RawRole,
  RawSticker,
  RawUser,
  RawWebhook,
} from "./types.js";

// ── User ───────────────────────────────────────────────────────────────────

export class User {
  readonly id: string;
  readonly username: string;
  readonly discriminator: string;
  /** global_name fallback to username — what you usually want to display. */
  readonly name: string;
  readonly bot: boolean;
  readonly system: boolean;
  readonly avatar: string | null;
  readonly banner: string | null;
  readonly accentColor: number | null;
  readonly raw: RawUser;
  protected rest: Rest;

  constructor(raw: RawUser, rest: Rest) {
    this.raw = raw;
    this.rest = rest;
    this.id = raw.id;
    this.username = raw.username;
    this.discriminator = raw.discriminator;
    this.name = raw.global_name ?? raw.username;
    this.bot = !!raw.bot;
    this.system = !!raw.system;
    this.avatar = raw.avatar ?? null;
    this.banner = raw.banner ?? null;
    this.accentColor = raw.accent_color ?? null;
  }

  /** "@username" mention. */
  get mention(): string {
    return `<@${this.id}>`;
  }

  /** Avatar URL, or default avatar if unset. `size` must be a power of two 16..4096. */
  avatarUrl(size: 16 | 32 | 64 | 128 | 256 | 512 | 1024 | 2048 | 4096 = 256, format: "webp" | "png" | "jpg" | "gif" = "webp"): string {
    if (!this.avatar) {
      const idx = (BigInt(this.id) >> 22n) % 6n;
      return `${CDN}/embed/avatars/${idx}.png`;
    }
    const ext = this.avatar.startsWith("a_") && format === "webp" ? "gif" : format;
    return `${CDN}/avatars/${this.id}/${this.avatar}.${ext}?size=${size}`;
  }

  bannerUrl(size: 16 | 32 | 64 | 128 | 256 | 512 | 1024 | 2048 | 4096 = 512, format: "webp" | "png" | "jpg" | "gif" = "webp"): string | null {
    if (!this.banner) return null;
    const ext = this.banner.startsWith("a_") && format === "webp" ? "gif" : format;
    return `${CDN}/banners/${this.id}/${this.banner}.${ext}?size=${size}`;
  }

  /** Open / get the DM channel id for this user. */
  async dmChannelId(): Promise<string> {
    const ch = await this.rest.post<{ id: string }>(`/users/@me/channels`, {
      recipient_id: this.id,
    });
    return ch.id;
  }

  /** Send a DM. Returns the sent message id. */
  async send(content: string | { content?: string; embeds?: unknown[]; components?: unknown[] }): Promise<{ id: string; channel_id: string }> {
    const channelId = await this.dmChannelId();
    const body =
      typeof content === "string" ? { content, allowed_mentions: { parse: [] } } : { ...content, allowed_mentions: { parse: [] } };
    return this.rest.post(`/channels/${channelId}/messages`, body);
  }
}

// ── Role ───────────────────────────────────────────────────────────────────

export class Role {
  readonly id: string;
  readonly guildId: string;
  readonly name: string;
  readonly color: number;
  readonly hoist: boolean;
  readonly position: number;
  readonly permissions: string;
  readonly managed: boolean;
  readonly mentionable: boolean;
  readonly raw: RawRole;
  private rest: Rest;

  constructor(raw: RawRole, guildId: string, rest: Rest) {
    this.raw = raw;
    this.rest = rest;
    this.guildId = guildId;
    this.id = raw.id;
    this.name = raw.name;
    this.color = raw.color;
    this.hoist = raw.hoist;
    this.position = raw.position;
    this.permissions = raw.permissions;
    this.managed = raw.managed;
    this.mentionable = raw.mentionable;
  }

  get mention(): string {
    return `<@&${this.id}>`;
  }

  async edit(opts: {
    name?: string;
    color?: number;
    hoist?: boolean;
    permissions?: string;
    mentionable?: boolean;
    icon?: string | null;
    unicode_emoji?: string | null;
  }): Promise<Role> {
    const raw = await this.rest.patch<RawRole>(
      `/guilds/${this.guildId}/roles/${this.id}`,
      opts,
    );
    return new Role(raw, this.guildId, this.rest);
  }

  async delete(reason?: string): Promise<void> {
    await this.rest.delete(`/guilds/${this.guildId}/roles/${this.id}`, reason ? { "X-Audit-Log-Reason": reason } : undefined);
  }
}

// ── Reaction ───────────────────────────────────────────────────────────────

export class Reaction {
  readonly count: number;
  readonly me: boolean;
  readonly emoji: { id: string | null; name: string | null; animated: boolean };

  constructor(raw: RawReaction) {
    this.count = raw.count;
    this.me = raw.me;
    this.emoji = {
      id: raw.emoji.id ?? null,
      name: raw.emoji.name ?? null,
      animated: !!raw.emoji.animated,
    };
  }

  /** URL-encoded form for REST endpoints. */
  toEncoded(): string {
    if (this.emoji.id) return encodeURIComponent(`${this.emoji.name}:${this.emoji.id}`);
    return encodeURIComponent(this.emoji.name ?? "");
  }
}

// ── Invite ─────────────────────────────────────────────────────────────────

export class Invite {
  readonly code: string;
  readonly url: string;
  readonly channelId: string | null;
  readonly guildId: string | null;
  readonly inviter: User | null;
  readonly uses?: number;
  readonly maxUses?: number;
  readonly maxAge?: number;
  readonly expiresAt: Date | null;
  readonly raw: RawInvite;
  private rest: Rest;

  constructor(raw: RawInvite, rest: Rest) {
    this.raw = raw;
    this.rest = rest;
    this.code = raw.code;
    this.url = `https://discord.gg/${raw.code}`;
    this.channelId = raw.channel?.id ?? null;
    this.guildId = raw.guild?.id ?? null;
    this.inviter = raw.inviter ? new User(raw.inviter, rest) : null;
    this.uses = raw.uses;
    this.maxUses = raw.max_uses;
    this.maxAge = raw.max_age;
    this.expiresAt = raw.expires_at ? new Date(raw.expires_at) : null;
  }

  async delete(reason?: string): Promise<void> {
    await this.rest.delete(`/invites/${this.code}`, reason ? { "X-Audit-Log-Reason": reason } : undefined);
  }
}

// ── Webhook ────────────────────────────────────────────────────────────────

export class Webhook {
  readonly id: string;
  readonly token: string | null;
  readonly channelId: string | null;
  readonly guildId: string | null;
  readonly name: string | null;
  readonly avatar: string | null;
  readonly applicationId: string | null;
  readonly url: string | null;
  readonly raw: RawWebhook;
  private rest: Rest;

  constructor(raw: RawWebhook, rest: Rest) {
    this.raw = raw;
    this.rest = rest;
    this.id = raw.id;
    this.token = raw.token ?? null;
    this.channelId = raw.channel_id;
    this.guildId = raw.guild_id ?? null;
    this.name = raw.name;
    this.avatar = raw.avatar;
    this.applicationId = raw.application_id;
    this.url = raw.url ?? (this.token ? `https://discord.com/api/webhooks/${this.id}/${this.token}` : null);
  }

  async send(input: string | {
    content?: string;
    username?: string;
    avatar_url?: string;
    embeds?: unknown[];
    components?: unknown[];
    tts?: boolean;
    flags?: number;
  }): Promise<{ id: string }> {
    if (!this.token) throw new Error("webhook missing token");
    const body = typeof input === "string" ? { content: input } : input;
    return this.rest.post(`/webhooks/${this.id}/${this.token}?wait=true`, {
      ...body,
      allowed_mentions: { parse: [] },
    });
  }

  async edit(opts: { name?: string; avatar?: string | null; channel_id?: string }): Promise<Webhook> {
    const raw = await this.rest.patch<RawWebhook>(`/webhooks/${this.id}`, opts);
    return new Webhook(raw, this.rest);
  }

  async delete(reason?: string): Promise<void> {
    await this.rest.delete(`/webhooks/${this.id}`, reason ? { "X-Audit-Log-Reason": reason } : undefined);
  }
}

// ── Sticker ────────────────────────────────────────────────────────────────

export class Sticker {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly formatType: number;
  readonly tags?: string;
  readonly guildId?: string;
  readonly available?: boolean;
  readonly raw: RawSticker;
  private rest?: Rest;

  constructor(raw: RawSticker, rest?: Rest) {
    this.raw = raw;
    this.rest = rest;
    this.id = raw.id;
    this.name = raw.name;
    this.description = raw.description ?? null;
    this.formatType = raw.format_type;
    const r = raw as RawSticker & { tags?: string; guild_id?: string; available?: boolean };
    this.tags = r.tags;
    this.guildId = r.guild_id;
    this.available = r.available;
  }
}

// ── Emoji helpers ──────────────────────────────────────────────────────────

export interface ParsedEmoji {
  id: string | null;
  name: string;
  animated: boolean;
}

export function parseEmoji(input: string | RawEmoji | ParsedEmoji): ParsedEmoji {
  if (typeof input === "object" && "id" in input) {
    return {
      id: input.id ?? null,
      name: input.name ?? "",
      animated: !!(input as RawEmoji).animated || !!(input as ParsedEmoji).animated,
    };
  }
  // unicode emoji or "name:id" or "<:name:id>"
  const m = /^<?(a)?:?(\w+):(\d+)>?$/.exec(input as string);
  if (m) return { id: m[3]!, name: m[2]!, animated: m[1] === "a" };
  return { id: null, name: input as string, animated: false };
}

export function encodeEmoji(input: string | RawEmoji | ParsedEmoji): string {
  const e = parseEmoji(input);
  if (e.id) return encodeURIComponent(`${e.name}:${e.id}`);
  return encodeURIComponent(e.name);
}
