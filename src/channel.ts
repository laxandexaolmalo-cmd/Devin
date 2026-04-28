// Channels: text, voice, category, announcement, forum, thread.
// One Channel class — variant-specific methods are still defined here but only
// usable on the right kind. Use ch.type to discriminate.

import { Rest, RestFile } from "./rest.js";
import { Invite, Webhook } from "./structures.js";
import {
  ChannelType,
  MessageFlags,
  RawChannel,
  RawInvite,
  RawMessage,
  RawUser,
  RawWebhook,
} from "./types.js";
import type { Message } from "./message.js";

export interface PollAnswer {
  text: string;
  emoji?: string | { id?: string; name?: string };
}

export interface PollOptions {
  question: string;
  answers: (string | PollAnswer)[];
  /** Hours, 1..168 (7d). Default 24. */
  durationHours?: number;
  allowMultiselect?: boolean;
}

export interface SendOptions {
  content?: string;
  embeds?: unknown[];
  components?: unknown[];
  /** Set true to use Components V2 layout (auto-sets IS_COMPONENTS_V2 flag). */
  componentsV2?: boolean;
  files?: RestFile[];
  /** Reply target message id. */
  replyTo?: string;
  /** Disable @mentions in this message. Default true. */
  silentMentions?: boolean;
  /** Suppress mobile push notification. */
  silent?: boolean;
  /** Suppress embed previews. */
  suppressEmbeds?: boolean;
  /** Mark as ephemeral when sending via webhook/interaction (no-op for plain channel). */
  ephemeral?: boolean;
  /** Sticker IDs to attach. */
  stickerIds?: string[];
  /** TTS message. */
  tts?: boolean;
  /** Allowed mentions override (use false to silence; otherwise pass your own). */
  allowedMentions?: { parse?: ("users" | "roles" | "everyone")[]; users?: string[]; roles?: string[]; replied_user?: boolean };
  /** Attach a poll. */
  poll?: PollOptions;
  /** Send as voice message. The single attachment must include duration_secs + waveform. */
  voiceMessage?: boolean;
  /** Raw flags override (OR'd with computed flags). */
  flags?: number;
  /** Forward an existing message into this channel. */
  forward?: { messageId: string; channelId: string; guildId?: string };
  /** Append applied tags (only valid for forum/media post creation). */
  appliedTags?: string[];
}

export class Channel {
  readonly id: string;
  readonly type: number;
  readonly guildId?: string;
  readonly name?: string;
  readonly topic: string | null;
  readonly nsfw: boolean;
  readonly parentId: string | null;
  readonly position?: number;
  readonly rateLimitPerUser?: number;
  readonly bitrate?: number;
  readonly userLimit?: number;
  readonly raw: RawChannel;
  protected rest: Rest;
  /** Lazy import to avoid circular issue. */
  private static MessageCtor: any;
  static __setMessageCtor(c: any) {
    Channel.MessageCtor = c;
  }

  constructor(raw: RawChannel, rest: Rest) {
    this.raw = raw;
    this.rest = rest;
    this.id = raw.id;
    this.type = raw.type;
    this.guildId = raw.guild_id;
    this.name = raw.name;
    this.topic = raw.topic ?? null;
    this.nsfw = !!raw.nsfw;
    this.parentId = raw.parent_id ?? null;
    this.position = raw.position;
    this.rateLimitPerUser = raw.rate_limit_per_user;
    this.bitrate = raw.bitrate;
    this.userLimit = raw.user_limit;
  }

  // ── Type guards ─────────────────────────────────────────────────────────

  isText(): boolean {
    return [
      ChannelType.GuildText,
      ChannelType.DM,
      ChannelType.GroupDM,
      ChannelType.GuildAnnouncement,
      ChannelType.AnnouncementThread,
      ChannelType.PublicThread,
      ChannelType.PrivateThread,
    ].includes(this.type as 0);
  }

  isVoice(): boolean {
    return this.type === ChannelType.GuildVoice || this.type === ChannelType.GuildStageVoice;
  }

  isThread(): boolean {
    return [ChannelType.AnnouncementThread, ChannelType.PublicThread, ChannelType.PrivateThread].includes(this.type as 10);
  }

  // ── Send / fetch messages ───────────────────────────────────────────────

  async send(input: string | SendOptions): Promise<Message> {
    const opts = typeof input === "string" ? { content: input } : { ...input };
    const body = buildMessageBody(opts, this.id);
    let raw: RawMessage;
    if (opts.files && opts.files.length > 0) {
      raw = await this.rest.upload<RawMessage>("POST", `/channels/${this.id}/messages`, body, opts.files);
    } else {
      raw = await this.rest.post<RawMessage>(`/channels/${this.id}/messages`, body);
    }
    return new Channel.MessageCtor(raw, this.rest);
  }

  /** Create a forum/media post (initial-message + new thread in one call). */
  async createForumPost(opts: {
    name: string;
    autoArchiveDuration?: 60 | 1440 | 4320 | 10080;
    rateLimitPerUser?: number;
    appliedTags?: string[];
    /** Initial message — same shape as send(). */
    message: string | SendOptions;
  }): Promise<Channel> {
    const m = typeof opts.message === "string" ? { content: opts.message } : opts.message;
    const body: Record<string, unknown> = {
      name: opts.name,
      auto_archive_duration: opts.autoArchiveDuration,
      rate_limit_per_user: opts.rateLimitPerUser,
      applied_tags: opts.appliedTags,
      message: buildMessageBody(m, this.id),
    };
    let raw: RawChannel;
    if (m.files && m.files.length > 0) {
      raw = await this.rest.upload<RawChannel>("POST", `/channels/${this.id}/threads`, body, m.files);
    } else {
      raw = await this.rest.post<RawChannel>(`/channels/${this.id}/threads`, body);
    }
    return new Channel(raw, this.rest);
  }

  /** End a poll early (channel must contain the poll). */
  async expirePoll(messageId: string): Promise<Message> {
    const raw = await this.rest.post<RawMessage>(`/channels/${this.id}/polls/${messageId}/expire`);
    return new Channel.MessageCtor(raw, this.rest);
  }

  /** Get the users who voted for a specific answer. */
  async fetchPollVoters(messageId: string, answerId: number, opts: { limit?: number; after?: string } = {}): Promise<RawUser[]> {
    const params = new URLSearchParams();
    if (opts.limit) params.set("limit", String(opts.limit));
    if (opts.after) params.set("after", opts.after);
    const q = params.toString();
    const r = await this.rest.get<{ users: RawUser[] }>(
      `/channels/${this.id}/polls/${messageId}/answers/${answerId}${q ? `?${q}` : ""}`,
    );
    return r.users;
  }

  /** Fetch up to `limit` messages (newest first). */
  async fetchMessages(opts: { limit?: number; before?: string; after?: string; around?: string } = {}): Promise<Message[]> {
    const params = new URLSearchParams();
    if (opts.limit) params.set("limit", String(opts.limit));
    if (opts.before) params.set("before", opts.before);
    if (opts.after) params.set("after", opts.after);
    if (opts.around) params.set("around", opts.around);
    const q = params.toString();
    const arr = await this.rest.get<RawMessage[]>(`/channels/${this.id}/messages${q ? `?${q}` : ""}`);
    return arr.map((m) => new Channel.MessageCtor(m, this.rest));
  }

  async fetchMessage(id: string): Promise<Message> {
    const raw = await this.rest.get<RawMessage>(`/channels/${this.id}/messages/${id}`);
    return new Channel.MessageCtor(raw, this.rest);
  }

  /** Bulk-delete messages (2..100, < 14 days old). */
  async bulkDelete(ids: string[], reason?: string): Promise<void> {
    if (ids.length === 1) {
      await this.rest.delete(`/channels/${this.id}/messages/${ids[0]}`, reason ? { "X-Audit-Log-Reason": reason } : undefined);
      return;
    }
    await this.rest.post(`/channels/${this.id}/messages/bulk-delete`, { messages: ids }, reason ? { "X-Audit-Log-Reason": reason } : undefined);
  }

  /** Trigger the typing indicator (auto-clears in ~10s). */
  async typing(): Promise<void> {
    await this.rest.post(`/channels/${this.id}/typing`);
  }

  // ── Edit / delete ───────────────────────────────────────────────────────

  async edit(opts: {
    name?: string;
    topic?: string | null;
    nsfw?: boolean;
    rate_limit_per_user?: number;
    bitrate?: number;
    user_limit?: number;
    parent_id?: string | null;
    position?: number;
  }, reason?: string): Promise<Channel> {
    const raw = await this.rest.patch<RawChannel>(`/channels/${this.id}`, opts, reason ? { "X-Audit-Log-Reason": reason } : undefined);
    return new Channel(raw, this.rest);
  }

  async delete(reason?: string): Promise<void> {
    await this.rest.delete(`/channels/${this.id}`, reason ? { "X-Audit-Log-Reason": reason } : undefined);
  }

  // ── Threads ─────────────────────────────────────────────────────────────

  async createThread(opts: {
    name: string;
    autoArchiveDuration?: 60 | 1440 | 4320 | 10080;
    type?: number;
    invitable?: boolean;
    rateLimitPerUser?: number;
    /** Thread tied to a specific message id. */
    fromMessage?: string;
  }): Promise<Channel> {
    const body = {
      name: opts.name,
      auto_archive_duration: opts.autoArchiveDuration,
      type: opts.type,
      invitable: opts.invitable,
      rate_limit_per_user: opts.rateLimitPerUser,
    };
    const path = opts.fromMessage
      ? `/channels/${this.id}/messages/${opts.fromMessage}/threads`
      : `/channels/${this.id}/threads`;
    const raw = await this.rest.post<RawChannel>(path, body);
    return new Channel(raw, this.rest);
  }

  async fetchActiveThreads(): Promise<Channel[]> {
    if (!this.guildId) throw new Error("activeThreads requires a guild channel");
    const data = await this.rest.get<{ threads: RawChannel[] }>(`/guilds/${this.guildId}/threads/active`);
    return data.threads.map((c) => new Channel(c, this.rest));
  }

  /** Archive (or unarchive) a thread. */
  async setArchived(archived = true): Promise<void> {
    await this.rest.patch(`/channels/${this.id}`, { archived });
  }

  async setLocked(locked = true): Promise<void> {
    await this.rest.patch(`/channels/${this.id}`, { locked });
  }

  async addThreadMember(userId: string): Promise<void> {
    await this.rest.put(`/channels/${this.id}/thread-members/${userId}`);
  }

  async removeThreadMember(userId: string): Promise<void> {
    await this.rest.delete(`/channels/${this.id}/thread-members/${userId}`);
  }

  async joinThread(): Promise<void> {
    await this.rest.put(`/channels/${this.id}/thread-members/@me`);
  }

  async leaveThread(): Promise<void> {
    await this.rest.delete(`/channels/${this.id}/thread-members/@me`);
  }

  // ── Invites & webhooks ──────────────────────────────────────────────────

  async createInvite(opts: { maxAge?: number; maxUses?: number; temporary?: boolean; unique?: boolean } = {}): Promise<Invite> {
    const raw = await this.rest.post<RawInvite>(`/channels/${this.id}/invites`, {
      max_age: opts.maxAge,
      max_uses: opts.maxUses,
      temporary: opts.temporary,
      unique: opts.unique,
    });
    return new Invite(raw, this.rest);
  }

  async fetchInvites(): Promise<Invite[]> {
    const arr = await this.rest.get<RawInvite[]>(`/channels/${this.id}/invites`);
    return arr.map((i) => new Invite(i, this.rest));
  }

  async createWebhook(opts: { name: string; avatar?: string | null }): Promise<Webhook> {
    const raw = await this.rest.post<RawWebhook>(`/channels/${this.id}/webhooks`, opts);
    return new Webhook(raw, this.rest);
  }

  async fetchWebhooks(): Promise<Webhook[]> {
    const arr = await this.rest.get<RawWebhook[]>(`/channels/${this.id}/webhooks`);
    return arr.map((w) => new Webhook(w, this.rest));
  }

  // ── Announcement channel follow ─────────────────────────────────────────

  /**
   * Cross-post (follow) THIS announcement channel into another guild's channel.
   * Returns the resulting webhook info Discord uses to mirror posts.
   */
  async follow(targetChannelId: string, reason?: string): Promise<{ channelId: string; webhookId: string }> {
    const raw = await this.rest.post<{ channel_id: string; webhook_id: string }>(
      `/channels/${this.id}/followers`,
      { webhook_channel_id: targetChannelId },
      reason ? { "X-Audit-Log-Reason": reason } : undefined,
    );
    return { channelId: raw.channel_id, webhookId: raw.webhook_id };
  }

  /** Crosspost an announcement message published in THIS channel. */
  async crosspost(messageId: string): Promise<Message> {
    const raw = await this.rest.post<RawMessage>(
      `/channels/${this.id}/messages/${messageId}/crosspost`,
    );
    return new Channel.MessageCtor(raw, this.rest);
  }

  // ── Voice channel ───────────────────────────────────────────────────────

  /** Set the voice-channel status text (the line above the channel name). */
  async setVoiceStatus(status: string | null): Promise<void> {
    await this.rest.put(`/channels/${this.id}/voice-status`, { status });
  }

  /** Send an emoji "voice effect" into a voice channel the bot is connected to. */
  async sendVoiceEffect(opts: { emojiId?: string; emojiName?: string; animated?: boolean }): Promise<void> {
    await this.rest.post(`/channels/${this.id}/voice-effect-send`, {
      emoji_id: opts.emojiId,
      emoji_name: opts.emojiName,
      animated: opts.animated,
    });
  }

  // ── Forum tags ──────────────────────────────────────────────────────────

  /**
   * Replace the available tags on a forum/media channel. Pass `null` for `id`
   * to create a new tag, or include an existing tag's `id` to keep/edit it.
   */
  async setForumTags(
    tags: { id?: string; name: string; moderated?: boolean; emojiId?: string | null; emojiName?: string | null }[],
    reason?: string,
  ): Promise<Channel> {
    const raw = await this.rest.patch<RawChannel>(
      `/channels/${this.id}`,
      {
        available_tags: tags.map((t) => ({
          id: t.id,
          name: t.name,
          moderated: t.moderated,
          emoji_id: t.emojiId,
          emoji_name: t.emojiName,
        })),
      },
      reason ? { "X-Audit-Log-Reason": reason } : undefined,
    );
    return new Channel(raw, this.rest);
  }

  // ── Permissions ─────────────────────────────────────────────────────────

  async setPermission(targetId: string, opts: { allow?: string; deny?: string; type: "role" | "member" }, reason?: string): Promise<void> {
    await this.rest.put(`/channels/${this.id}/permissions/${targetId}`, {
      allow: opts.allow,
      deny: opts.deny,
      type: opts.type === "role" ? 0 : 1,
    }, reason ? { "X-Audit-Log-Reason": reason } : undefined);
  }

  async deletePermission(targetId: string, reason?: string): Promise<void> {
    await this.rest.delete(`/channels/${this.id}/permissions/${targetId}`, reason ? { "X-Audit-Log-Reason": reason } : undefined);
  }

  // ── Pins ────────────────────────────────────────────────────────────────

  async fetchPinned(): Promise<Message[]> {
    const arr = await this.rest.get<RawMessage[]>(`/channels/${this.id}/pins`);
    return arr.map((m) => new Channel.MessageCtor(m, this.rest));
  }

  /** Mention string `<#id>`. */
  get mention(): string {
    return `<#${this.id}>`;
  }
}

// ── Shared message-body builder ───────────────────────────────────────────
// Used by Channel.send, forum posts, Webhook.send, etc.

function emojiObj(e: string | { id?: string; name?: string }): { id?: string; name?: string } | undefined {
  if (!e) return undefined;
  if (typeof e === "string") {
    const m = /^<?(a)?:?(\w+):(\d+)>?$/.exec(e);
    if (m) return { id: m[3], name: m[2] };
    return { name: e };
  }
  return e;
}

export function buildMessageBody(opts: SendOptions, channelId?: string): Record<string, unknown> {
  let flags = opts.flags ?? 0;
  if (opts.silent) flags |= MessageFlags.SuppressNotifications;
  if (opts.suppressEmbeds) flags |= MessageFlags.SuppressEmbeds;
  if (opts.componentsV2) flags |= MessageFlags.IsComponentsV2;
  if (opts.voiceMessage) flags |= MessageFlags.IsVoiceMessage;
  if (opts.ephemeral) flags |= MessageFlags.Ephemeral;

  const body: Record<string, unknown> = {
    content: opts.componentsV2 ? undefined : opts.content,
    embeds: opts.componentsV2 ? undefined : opts.embeds,
    components: opts.components,
    tts: opts.tts,
    sticker_ids: opts.componentsV2 ? undefined : opts.stickerIds,
    allowed_mentions:
      opts.allowedMentions ?? (opts.silentMentions !== false ? { parse: [] } : undefined),
    flags: flags || undefined,
  };
  if (opts.replyTo && channelId) {
    body.message_reference = { type: 0, message_id: opts.replyTo, channel_id: channelId };
  }
  if (opts.forward) {
    body.message_reference = {
      type: 1, // Forward
      message_id: opts.forward.messageId,
      channel_id: opts.forward.channelId,
      guild_id: opts.forward.guildId,
    };
    // Discord ignores content/components/embeds for forwards.
    body.content = undefined;
    body.embeds = undefined;
    body.components = undefined;
  }
  if (opts.poll) {
    body.poll = {
      question: { text: opts.poll.question },
      answers: opts.poll.answers.map((a) => {
        const ans = typeof a === "string" ? { text: a } : a;
        return {
          poll_media: {
            text: ans.text,
            emoji: ans.emoji ? emojiObj(ans.emoji) : undefined,
          },
        };
      }),
      duration: opts.poll.durationHours ?? 24,
      allow_multiselect: !!opts.poll.allowMultiselect,
      layout_type: 1,
    };
  }
  return body;
}
