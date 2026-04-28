// Message — the heart of any chat bot. All actions you'd take on a message
// live here as methods.

import { Rest, RestFile } from "./rest.js";
import { User } from "./structures.js";
import { Channel, SendOptions } from "./channel.js";
import {
  RawAttachment,
  RawComponent,
  RawEmbed,
  RawMessage,
  RawReaction,
} from "./types.js";

export interface ReplyOptions extends SendOptions {
  /** When false (default), the reply does NOT @mention the original author. */
  pingReplyTarget?: boolean;
}

export class Message {
  readonly id: string;
  readonly channelId: string;
  readonly guildId?: string;
  readonly content: string;
  readonly author: User;
  readonly attachments: RawAttachment[];
  readonly embeds: RawEmbed[];
  readonly components: RawComponent[];
  readonly reactions: RawReaction[];
  readonly mentions: User[];
  readonly mentionRoleIds: string[];
  readonly mentionEveryone: boolean;
  readonly pinned: boolean;
  readonly tts: boolean;
  readonly type: number;
  readonly flags: number;
  readonly webhookId: string | null;
  readonly editedTimestamp: Date | null;
  readonly timestamp: Date;
  readonly raw: RawMessage;

  private rest: Rest;

  constructor(raw: RawMessage, rest: Rest) {
    this.raw = raw;
    this.rest = rest;
    this.id = raw.id;
    this.channelId = raw.channel_id;
    this.guildId = raw.guild_id;
    this.content = raw.content;
    this.author = new User(raw.author, rest);
    this.attachments = raw.attachments ?? [];
    this.embeds = raw.embeds ?? [];
    this.components = raw.components ?? [];
    this.reactions = raw.reactions ?? [];
    this.mentions = (raw.mentions ?? []).map((u) => new User(u, rest));
    this.mentionRoleIds = raw.mention_roles ?? [];
    this.mentionEveryone = !!raw.mention_everyone;
    this.pinned = !!raw.pinned;
    this.tts = !!raw.tts;
    this.type = raw.type;
    this.flags = raw.flags ?? 0;
    this.webhookId = raw.webhook_id ?? null;
    this.editedTimestamp = raw.edited_timestamp ? new Date(raw.edited_timestamp) : null;
    this.timestamp = new Date(raw.timestamp);
  }

  /** "Jump to message" URL. */
  get url(): string {
    return `https://discord.com/channels/${this.guildId ?? "@me"}/${this.channelId}/${this.id}`;
  }

  // ── Replies ──────────────────────────────────────────────────────────

  async reply(input: string | ReplyOptions): Promise<Message> {
    const opts = typeof input === "string" ? { content: input } : { ...input };
    const allowed = opts.allowedMentions ?? (opts.silentMentions !== false ? { parse: [], replied_user: !!opts.pingReplyTarget } : { replied_user: !!opts.pingReplyTarget });
    return this.channelLike().send({ ...opts, replyTo: this.id, allowedMentions: allowed });
  }

  /** Send a new message in the same channel (no reference). */
  async send(input: string | SendOptions): Promise<Message> {
    return this.channelLike().send(input);
  }

  // ── Edit / delete / pin ──────────────────────────────────────────────

  async edit(input: string | { content?: string; embeds?: unknown[]; components?: unknown[]; componentsV2?: boolean; flags?: number; files?: RestFile[] }): Promise<Message> {
    const opts = typeof input === "string" ? { content: input } : input;
    let flags = opts.flags ?? 0;
    if (opts.componentsV2) flags |= 1 << 15;
    const body: Record<string, unknown> = {
      content: opts.componentsV2 ? undefined : opts.content,
      embeds: opts.componentsV2 ? undefined : opts.embeds,
      components: opts.components,
      flags: flags || undefined,
    };
    let raw: RawMessage;
    if ("files" in opts && opts.files && opts.files.length > 0) {
      raw = await this.rest.upload<RawMessage>("PATCH", `/channels/${this.channelId}/messages/${this.id}`, body, opts.files);
    } else {
      raw = await this.rest.patch<RawMessage>(`/channels/${this.channelId}/messages/${this.id}`, body);
    }
    return new Message(raw, this.rest);
  }

  async delete(reason?: string): Promise<void> {
    await this.rest.delete(`/channels/${this.channelId}/messages/${this.id}`, reason ? { "X-Audit-Log-Reason": reason } : undefined);
  }

  async pin(reason?: string): Promise<void> {
    await this.rest.put(`/channels/${this.channelId}/pins/${this.id}`, undefined, reason ? { "X-Audit-Log-Reason": reason } : undefined);
  }

  async unpin(reason?: string): Promise<void> {
    await this.rest.delete(`/channels/${this.channelId}/pins/${this.id}`, reason ? { "X-Audit-Log-Reason": reason } : undefined);
  }

  // ── Reactions ────────────────────────────────────────────────────────

  async react(emoji: string): Promise<void> {
    const e = encodeEmojiForReaction(emoji);
    await this.rest.put(`/channels/${this.channelId}/messages/${this.id}/reactions/${e}/@me`);
  }

  async removeMyReaction(emoji: string): Promise<void> {
    const e = encodeEmojiForReaction(emoji);
    await this.rest.delete(`/channels/${this.channelId}/messages/${this.id}/reactions/${e}/@me`);
  }

  async removeReaction(emoji: string, userId: string): Promise<void> {
    const e = encodeEmojiForReaction(emoji);
    await this.rest.delete(`/channels/${this.channelId}/messages/${this.id}/reactions/${e}/${userId}`);
  }

  async clearReactions(emoji?: string): Promise<void> {
    if (emoji) {
      const e = encodeEmojiForReaction(emoji);
      await this.rest.delete(`/channels/${this.channelId}/messages/${this.id}/reactions/${e}`);
    } else {
      await this.rest.delete(`/channels/${this.channelId}/messages/${this.id}/reactions`);
    }
  }

  async fetchReactionUsers(emoji: string, opts: { limit?: number; after?: string; type?: "normal" | "burst" } = {}): Promise<User[]> {
    const e = encodeEmojiForReaction(emoji);
    const params = new URLSearchParams();
    if (opts.limit) params.set("limit", String(opts.limit));
    if (opts.after) params.set("after", opts.after);
    if (opts.type) params.set("type", opts.type === "burst" ? "1" : "0");
    const q = params.toString();
    const arr = await this.rest.get<{ id: string; username: string; discriminator: string; global_name?: string }[]>(
      `/channels/${this.channelId}/messages/${this.id}/reactions/${e}${q ? `?${q}` : ""}`,
    );
    return arr.map((u) => new User({ id: u.id, username: u.username, discriminator: u.discriminator, global_name: u.global_name ?? null }, this.rest));
  }

  /**
   * Add a SUPER (burst) reaction. Note: super reactions cost the user a "super
   * react" — bots cannot send super reacts; this helper is here for parity with
   * Discord's reaction-type query and is rejected by the API for bot users.
   */
  async superReact(emoji: string): Promise<void> {
    const e = encodeEmojiForReaction(emoji);
    await this.rest.put(
      `/channels/${this.channelId}/messages/${this.id}/reactions/${e}/@me?type=1`,
    );
  }

  /** Forward this message into another channel. */
  async forward(targetChannelId: string): Promise<Message> {
    const raw = await this.rest.post<RawMessage>(`/channels/${targetChannelId}/messages`, {
      message_reference: { type: 1, message_id: this.id, channel_id: this.channelId, guild_id: this.guildId },
    });
    return new Message(raw, this.rest);
  }

  // ── Threads ──────────────────────────────────────────────────────────

  async startThread(opts: { name: string; autoArchiveDuration?: 60 | 1440 | 4320 | 10080; rateLimitPerUser?: number }): Promise<Channel> {
    return this.channelLike().createThread({ ...opts, fromMessage: this.id });
  }

  // ── Helpers ──────────────────────────────────────────────────────────

  /** Crosspost a message in an announcement channel. */
  async crosspost(): Promise<Message> {
    const raw = await this.rest.post<RawMessage>(`/channels/${this.channelId}/messages/${this.id}/crosspost`);
    return new Message(raw, this.rest);
  }

  private channelLike(): Channel {
    // Synthesize a minimal channel — we only need .id for sending.
    return new Channel({ id: this.channelId, type: 0, guild_id: this.guildId }, this.rest);
  }
}

// Wire Channel <-> Message constructor to avoid circular import surprises
Channel.__setMessageCtor(Message);

function encodeEmojiForReaction(emoji: string): string {
  // accepts unicode emoji or "<:name:id>" or "name:id"
  const m = /^<?(a)?:?(\w+):(\d+)>?$/.exec(emoji);
  if (m) return encodeURIComponent(`${m[2]}:${m[3]}`);
  return encodeURIComponent(emoji);
}
