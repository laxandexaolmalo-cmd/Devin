// Guild + GuildMember.
// Methods for moderation, role/channel/member management, audit logs, invites.

import { AutoMod } from "./automod.js";
import { Onboarding } from "./onboarding.js";
import { Rest } from "./rest.js";
import { GuildStickers } from "./stickers.js";
import { Invite, Role, User, Webhook } from "./structures.js";
import { Channel } from "./channel.js";
import { Message } from "./message.js";
import { GuildTemplates } from "./templates.js";
import {
  RawAuditLogEntry,
  RawChannel,
  RawGuild,
  RawIntegration,
  RawInvite,
  RawMember,
  RawMessage,
  RawRole,
  RawScheduledEvent,
  RawUser,
  RawWebhook,
} from "./types.js";

// ── GuildMember ──────────────────────────────────────────────────────────

export class GuildMember {
  readonly guildId: string;
  readonly user: User;
  readonly nick: string | null;
  readonly avatar: string | null;
  readonly roleIds: string[];
  readonly joinedAt: Date;
  readonly premiumSince: Date | null;
  readonly pending: boolean;
  readonly communicationDisabledUntil: Date | null;
  readonly raw: RawMember;
  private rest: Rest;

  constructor(raw: RawMember, guildId: string, rest: Rest) {
    this.raw = raw;
    this.rest = rest;
    this.guildId = guildId;
    if (!raw.user) throw new Error("GuildMember requires raw.user");
    this.user = new User(raw.user, rest);
    this.nick = raw.nick ?? null;
    this.avatar = raw.avatar ?? null;
    this.roleIds = raw.roles;
    this.joinedAt = new Date(raw.joined_at);
    this.premiumSince = raw.premium_since ? new Date(raw.premium_since) : null;
    this.pending = !!raw.pending;
    this.communicationDisabledUntil = raw.communication_disabled_until ? new Date(raw.communication_disabled_until) : null;
  }

  /** Display name = nick || global_name || username. */
  get name(): string {
    return this.nick ?? this.user.name;
  }

  get id(): string {
    return this.user.id;
  }

  get mention(): string {
    return `<@${this.user.id}>`;
  }

  // ── Moderation actions ───────────────────────────────────────────────

  async kick(reason?: string): Promise<void> {
    await this.rest.delete(`/guilds/${this.guildId}/members/${this.user.id}`, reason ? { "X-Audit-Log-Reason": reason } : undefined);
  }

  async ban(opts: { deleteMessageSeconds?: number; reason?: string } = {}): Promise<void> {
    await this.rest.put(
      `/guilds/${this.guildId}/bans/${this.user.id}`,
      { delete_message_seconds: opts.deleteMessageSeconds },
      opts.reason ? { "X-Audit-Log-Reason": opts.reason } : undefined,
    );
  }

  /** Timeout for `seconds` (Discord max 28 days). Pass 0 to remove. */
  async timeout(seconds: number, reason?: string): Promise<void> {
    const until = seconds > 0 ? new Date(Date.now() + seconds * 1000).toISOString() : null;
    await this.edit({ communicationDisabledUntil: until }, reason);
  }

  async edit(opts: {
    nick?: string | null;
    roles?: string[];
    mute?: boolean;
    deaf?: boolean;
    channelId?: string | null;
    communicationDisabledUntil?: string | null;
  }, reason?: string): Promise<GuildMember> {
    const raw = await this.rest.patch<RawMember>(
      `/guilds/${this.guildId}/members/${this.user.id}`,
      {
        nick: opts.nick,
        roles: opts.roles,
        mute: opts.mute,
        deaf: opts.deaf,
        channel_id: opts.channelId,
        communication_disabled_until: opts.communicationDisabledUntil,
      },
      reason ? { "X-Audit-Log-Reason": reason } : undefined,
    );
    return new GuildMember(raw, this.guildId, this.rest);
  }

  async addRole(roleId: string, reason?: string): Promise<void> {
    await this.rest.put(
      `/guilds/${this.guildId}/members/${this.user.id}/roles/${roleId}`,
      undefined,
      reason ? { "X-Audit-Log-Reason": reason } : undefined,
    );
  }

  async removeRole(roleId: string, reason?: string): Promise<void> {
    await this.rest.delete(
      `/guilds/${this.guildId}/members/${this.user.id}/roles/${roleId}`,
      reason ? { "X-Audit-Log-Reason": reason } : undefined,
    );
  }

  /** Move this member to another voice channel. Pass `null` to disconnect. */
  async moveVoice(channelId: string | null, reason?: string): Promise<GuildMember> {
    return this.edit({ channelId }, reason);
  }

  /** Server-mute this member. */
  async setMute(mute: boolean, reason?: string): Promise<GuildMember> {
    return this.edit({ mute }, reason);
  }

  /** Server-deafen this member. */
  async setDeafen(deaf: boolean, reason?: string): Promise<GuildMember> {
    return this.edit({ deaf }, reason);
  }

  /** Disconnect this member from voice. */
  async disconnectVoice(reason?: string): Promise<GuildMember> {
    return this.edit({ channelId: null }, reason);
  }

  async send(content: Parameters<User["send"]>[0]) {
    return this.user.send(content);
  }
}

// ── Guild ──────────────────────────────────────────────────────────────────

export class Guild {
  readonly id: string;
  readonly name: string;
  readonly icon: string | null;
  readonly description: string | null;
  readonly ownerId: string;
  readonly memberCount?: number;
  readonly features: string[];
  readonly raw: RawGuild;
  private rest: Rest;

  constructor(raw: RawGuild, rest: Rest) {
    this.raw = raw;
    this.rest = rest;
    this.id = raw.id;
    this.name = raw.name;
    this.icon = raw.icon;
    this.description = raw.description;
    this.ownerId = raw.owner_id;
    this.memberCount = raw.member_count;
    this.features = raw.features;
  }

  // ── Members ─────────────────────────────────────────────────────────

  async fetchMember(userId: string): Promise<GuildMember> {
    const raw = await this.rest.get<RawMember>(`/guilds/${this.id}/members/${userId}`);
    return new GuildMember(raw, this.id, this.rest);
  }

  async fetchMembers(opts: { limit?: number; after?: string } = {}): Promise<GuildMember[]> {
    const params = new URLSearchParams();
    params.set("limit", String(opts.limit ?? 100));
    if (opts.after) params.set("after", opts.after);
    const arr = await this.rest.get<RawMember[]>(`/guilds/${this.id}/members?${params.toString()}`);
    return arr.map((m) => new GuildMember(m, this.id, this.rest));
  }

  /** Search members by username. */
  async searchMembers(query: string, limit = 10): Promise<GuildMember[]> {
    const arr = await this.rest.get<RawMember[]>(`/guilds/${this.id}/members/search?query=${encodeURIComponent(query)}&limit=${limit}`);
    return arr.map((m) => new GuildMember(m, this.id, this.rest));
  }

  async ban(userId: string, opts: { deleteMessageSeconds?: number; reason?: string } = {}): Promise<void> {
    await this.rest.put(`/guilds/${this.id}/bans/${userId}`, { delete_message_seconds: opts.deleteMessageSeconds }, opts.reason ? { "X-Audit-Log-Reason": opts.reason } : undefined);
  }

  async unban(userId: string, reason?: string): Promise<void> {
    await this.rest.delete(`/guilds/${this.id}/bans/${userId}`, reason ? { "X-Audit-Log-Reason": reason } : undefined);
  }

  async kick(userId: string, reason?: string): Promise<void> {
    await this.rest.delete(`/guilds/${this.id}/members/${userId}`, reason ? { "X-Audit-Log-Reason": reason } : undefined);
  }

  async fetchBans(opts: { limit?: number; before?: string; after?: string } = {}): Promise<{ user: User; reason: string | null }[]> {
    const params = new URLSearchParams();
    if (opts.limit) params.set("limit", String(opts.limit));
    if (opts.before) params.set("before", opts.before);
    if (opts.after) params.set("after", opts.after);
    const q = params.toString();
    const arr = await this.rest.get<{ user: RawUser; reason: string | null }[]>(
      `/guilds/${this.id}/bans${q ? `?${q}` : ""}`,
    );
    return arr.map((b) => ({ user: new User(b.user, this.rest), reason: b.reason }));
  }

  /**
   * Fetch a single guild ban. Returns `null` if the user is not banned.
   * Source: https://docs.discord.com/developers/resources/guild#get-guild-ban
   */
  async fetchBan(userId: string): Promise<{ user: User; reason: string | null } | null> {
    try {
      const r = await this.rest.get<{ user: RawUser; reason: string | null }>(`/guilds/${this.id}/bans/${userId}`);
      return { user: new User(r.user, this.rest), reason: r.reason };
    } catch (err) {
      // 10026 = Unknown Ban — convert to null for ergonomics.
      const code = (err as { code?: number; status?: number }).code;
      const status = (err as { status?: number }).status;
      if (code === 10026 || status === 404) return null;
      throw err;
    }
  }

  /**
   * Bulk-ban up to 200 members in one call. Added 2024-Q3.
   * Returns the snowflakes that were actually banned and those that failed.
   * Requires both `BAN_MEMBERS` and `MANAGE_GUILD`.
   * Source: https://docs.discord.com/developers/resources/guild#bulk-guild-ban
   */
  async bulkBan(opts: {
    userIds: string[];
    /** Delete each banned user's messages from the last `n` seconds (max 604800). */
    deleteMessageSeconds?: number;
    reason?: string;
  }): Promise<{ bannedUsers: string[]; failedUsers: string[] }> {
    const r = await this.rest.post<{ banned_users: string[]; failed_users: string[] }>(
      `/guilds/${this.id}/bulk-ban`,
      { user_ids: opts.userIds, delete_message_seconds: opts.deleteMessageSeconds },
      opts.reason ? { "X-Audit-Log-Reason": opts.reason } : undefined,
    );
    return { bannedUsers: r.banned_users, failedUsers: r.failed_users };
  }

  // ── Prune (inactive-member cleanup) ─────────────────────────────────────

  /**
   * Compute how many members would be pruned (NO destructive action).
   * `days` = inactivity threshold (1..30, default 7).
   * Source: https://docs.discord.com/developers/resources/guild#get-guild-prune-count
   */
  async getPruneCount(opts: { days?: number; includeRoleIds?: string[] } = {}): Promise<{ pruned: number }> {
    const params = new URLSearchParams();
    if (opts.days !== undefined) params.set("days", String(opts.days));
    if (opts.includeRoleIds?.length) params.set("include_roles", opts.includeRoleIds.join(","));
    const q = params.toString();
    return this.rest.get<{ pruned: number }>(`/guilds/${this.id}/prune${q ? `?${q}` : ""}`);
  }

  /**
   * Actually prune inactive members. Returns `{ pruned }` (count) when
   * `computePruneCount` is true (default), or `{ pruned: null }` for fire-and-
   * forget (recommended for large guilds).
   * Source: https://docs.discord.com/developers/resources/guild#begin-guild-prune
   */
  async beginPrune(opts: {
    days?: number;
    /** When true (default), Discord computes the count and returns it. Set false on large guilds. */
    computePruneCount?: boolean;
    includeRoleIds?: string[];
    reason?: string;
  } = {}): Promise<{ pruned: number | null }> {
    return this.rest.post<{ pruned: number | null }>(
      `/guilds/${this.id}/prune`,
      {
        days: opts.days,
        compute_prune_count: opts.computePruneCount,
        include_roles: opts.includeRoleIds,
      },
      opts.reason ? { "X-Audit-Log-Reason": opts.reason } : undefined,
    );
  }

  // ── Guild incidents / safety alerts (2024-Q2) ───────────────────────────

  /**
   * Toggle incident-mode safety actions: pause invites and/or DMs to/from
   * the guild for up to 24h.
   *
   * Pass `null` for either field to clear that action.
   * Source: https://docs.discord.com/developers/resources/guild#modify-guild-incident-actions
   */
  async setIncidentActions(opts: {
    invitesDisabledUntil?: string | Date | null;
    dmsDisabledUntil?: string | Date | null;
    reason?: string;
  }): Promise<{
    invitesDisabledUntil: string | null;
    dmsDisabledUntil: string | null;
    dmSpamDetectedAt: string | null;
    raidDetectedAt: string | null;
  }> {
    const toIso = (v: string | Date | null | undefined): string | null | undefined => {
      if (v === undefined) return undefined;
      if (v === null) return null;
      return v instanceof Date ? v.toISOString() : v;
    };
    const r = await this.rest.put<{
      invites_disabled_until: string | null;
      dms_disabled_until: string | null;
      dm_spam_detected_at: string | null;
      raid_detected_at: string | null;
    }>(
      `/guilds/${this.id}/incident-actions`,
      {
        invites_disabled_until: toIso(opts.invitesDisabledUntil),
        dms_disabled_until: toIso(opts.dmsDisabledUntil),
      },
      opts.reason ? { "X-Audit-Log-Reason": opts.reason } : undefined,
    );
    return {
      invitesDisabledUntil: r.invites_disabled_until,
      dmsDisabledUntil: r.dms_disabled_until,
      dmSpamDetectedAt: r.dm_spam_detected_at,
      raidDetectedAt: r.raid_detected_at,
    };
  }

  // ── Integrations ────────────────────────────────────────────────────────

  /**
   * List third-party integrations connected to this guild (Twitch / YouTube /
   * Discord apps). Capped at 50.
   * Source: https://docs.discord.com/developers/resources/guild#get-guild-integrations
   */
  async fetchIntegrations(): Promise<RawIntegration[]> {
    return this.rest.get<RawIntegration[]>(`/guilds/${this.id}/integrations`);
  }

  /**
   * Delete a guild integration. Removes any associated webhooks and kicks any
   * bot installed via that integration.
   * Source: https://docs.discord.com/developers/resources/guild#delete-guild-integration
   */
  async deleteIntegration(integrationId: string, reason?: string): Promise<void> {
    await this.rest.delete(
      `/guilds/${this.id}/integrations/${integrationId}`,
      reason ? { "X-Audit-Log-Reason": reason } : undefined,
    );
  }

  // ── Templates ───────────────────────────────────────────────────────────

  /** Guild Templates CRUD (snapshot a guild's structure as a reusable template). */
  get templates(): GuildTemplates {
    return new GuildTemplates(this.id, this.rest);
  }

  // ── Roles ───────────────────────────────────────────────────────────

  async fetchRoles(): Promise<Role[]> {
    const arr = await this.rest.get<RawRole[]>(`/guilds/${this.id}/roles`);
    return arr.map((r) => new Role(r, this.id, this.rest));
  }

  async createRole(opts: { name?: string; color?: number; hoist?: boolean; permissions?: string; mentionable?: boolean; icon?: string; unicode_emoji?: string } = {}, reason?: string): Promise<Role> {
    const raw = await this.rest.post<RawRole>(`/guilds/${this.id}/roles`, opts, reason ? { "X-Audit-Log-Reason": reason } : undefined);
    return new Role(raw, this.id, this.rest);
  }

  // ── Channels ────────────────────────────────────────────────────────

  async fetchChannels(): Promise<Channel[]> {
    const arr = await this.rest.get<RawChannel[]>(`/guilds/${this.id}/channels`);
    return arr.map((c) => new Channel(c, this.rest));
  }

  async createChannel(opts: {
    name: string;
    type?: number;
    topic?: string;
    bitrate?: number;
    userLimit?: number;
    rateLimitPerUser?: number;
    position?: number;
    parentId?: string;
    nsfw?: boolean;
  }, reason?: string): Promise<Channel> {
    const body = {
      name: opts.name,
      type: opts.type,
      topic: opts.topic,
      bitrate: opts.bitrate,
      user_limit: opts.userLimit,
      rate_limit_per_user: opts.rateLimitPerUser,
      position: opts.position,
      parent_id: opts.parentId,
      nsfw: opts.nsfw,
    };
    const raw = await this.rest.post<RawChannel>(`/guilds/${this.id}/channels`, body, reason ? { "X-Audit-Log-Reason": reason } : undefined);
    return new Channel(raw, this.rest);
  }

  // ── Invites & webhooks ──────────────────────────────────────────────

  async fetchInvites(): Promise<Invite[]> {
    const arr = await this.rest.get<RawInvite[]>(`/guilds/${this.id}/invites`);
    return arr.map((i) => new Invite(i, this.rest));
  }

  async fetchWebhooks(): Promise<Webhook[]> {
    const arr = await this.rest.get<RawWebhook[]>(`/guilds/${this.id}/webhooks`);
    return arr.map((w) => new Webhook(w, this.rest));
  }

  // ── Audit log ───────────────────────────────────────────────────────

  async fetchAuditLog(opts: { userId?: string; actionType?: number; before?: string; limit?: number } = {}): Promise<{ entries: RawAuditLogEntry[]; users: User[] }> {
    const params = new URLSearchParams();
    if (opts.userId) params.set("user_id", opts.userId);
    if (opts.actionType) params.set("action_type", String(opts.actionType));
    if (opts.before) params.set("before", opts.before);
    if (opts.limit) params.set("limit", String(opts.limit));
    const q = params.toString();
    const data = await this.rest.get<{ audit_log_entries: RawAuditLogEntry[]; users: RawUser[] }>(
      `/guilds/${this.id}/audit-logs${q ? `?${q}` : ""}`,
    );
    return {
      entries: data.audit_log_entries,
      users: data.users.map((u) => new User(u, this.rest)),
    };
  }

  // ── Scheduled events ────────────────────────────────────────────────

  async fetchScheduledEvents(): Promise<RawScheduledEvent[]> {
    return this.rest.get<RawScheduledEvent[]>(`/guilds/${this.id}/scheduled-events`);
  }

  async createScheduledEvent(opts: {
    name: string;
    description?: string;
    scheduledStartTime: string;
    scheduledEndTime?: string;
    privacyLevel?: number;
    entityType: number;
    channelId?: string;
    entityMetadata?: { location?: string };
  }): Promise<RawScheduledEvent> {
    return this.rest.post<RawScheduledEvent>(`/guilds/${this.id}/scheduled-events`, {
      name: opts.name,
      description: opts.description,
      scheduled_start_time: opts.scheduledStartTime,
      scheduled_end_time: opts.scheduledEndTime,
      privacy_level: opts.privacyLevel ?? 2,
      entity_type: opts.entityType,
      channel_id: opts.channelId,
      entity_metadata: opts.entityMetadata,
    });
  }

  // ── Misc ─────────────────────────────────────────────────────────────

  /** Auto-mod helper: list/create/edit/delete rules for this guild. */
  get automod(): AutoMod {
    return new AutoMod(this.id, this.rest);
  }

  /** Onboarding flow (prompts, default channels, mode). */
  get onboarding(): Onboarding {
    return new Onboarding(this.id, this.rest);
  }

  /** Guild stickers CRUD. */
  get stickers(): GuildStickers {
    return new GuildStickers(this.id, this.rest);
  }

  // ── Welcome screen ──────────────────────────────────────────────────────

  async fetchWelcomeScreen(): Promise<{ description: string | null; channels: { channelId: string; description: string; emojiId?: string | null; emojiName?: string | null }[] }> {
    const r = await this.rest.get<{ description: string | null; welcome_channels: { channel_id: string; description: string; emoji_id?: string | null; emoji_name?: string | null }[] }>(
      `/guilds/${this.id}/welcome-screen`,
    );
    return {
      description: r.description,
      channels: r.welcome_channels.map((c) => ({
        channelId: c.channel_id,
        description: c.description,
        emojiId: c.emoji_id,
        emojiName: c.emoji_name,
      })),
    };
  }

  async editWelcomeScreen(opts: {
    enabled?: boolean;
    description?: string | null;
    channels?: { channelId: string; description: string; emojiId?: string | null; emojiName?: string | null }[];
    reason?: string;
  }): Promise<void> {
    await this.rest.patch(
      `/guilds/${this.id}/welcome-screen`,
      {
        enabled: opts.enabled,
        description: opts.description,
        welcome_channels: opts.channels?.map((c) => ({
          channel_id: c.channelId,
          description: c.description,
          emoji_id: c.emojiId,
          emoji_name: c.emojiName,
        })),
      },
      opts.reason ? { "X-Audit-Log-Reason": opts.reason } : undefined,
    );
  }

  // ── Widget ──────────────────────────────────────────────────────────────

  async fetchWidgetSettings(): Promise<{ enabled: boolean; channelId: string | null }> {
    const r = await this.rest.get<{ enabled: boolean; channel_id: string | null }>(`/guilds/${this.id}/widget`);
    return { enabled: r.enabled, channelId: r.channel_id };
  }

  async editWidget(opts: { enabled?: boolean; channelId?: string | null; reason?: string }): Promise<void> {
    await this.rest.patch(
      `/guilds/${this.id}/widget`,
      { enabled: opts.enabled, channel_id: opts.channelId },
      opts.reason ? { "X-Audit-Log-Reason": opts.reason } : undefined,
    );
  }

  /** Public widget JSON (no auth required server-side; we send auth anyway, harmless). */
  async fetchWidget(): Promise<unknown> {
    return this.rest.get(`/guilds/${this.id}/widget.json`);
  }

  // ── Active threads ──────────────────────────────────────────────────────

  async fetchActiveThreads(): Promise<{ threads: Channel[]; members: unknown[] }> {
    const r = await this.rest.get<{ threads: RawChannel[]; members: unknown[] }>(
      `/guilds/${this.id}/threads/active`,
    );
    return {
      threads: r.threads.map((c) => new Channel(c, this.rest)),
      members: r.members,
    };
  }

  // ── Search guild messages (added 2026-Q1) ───────────────────────────────

  /**
   * Search messages in this guild. Added to the public bot API in 2026-Q1.
   * Requires `READ_MESSAGE_HISTORY` and the `MESSAGE_CONTENT` privileged intent.
   * Throws `RestError [110000]` if the guild's index is still building — retry
   * with backoff.
   *
   * Source: https://docs.discord.com/developers/resources/message#search-guild-messages
   */
  async searchMessages(opts: {
    /** Free-text content query. */
    content?: string;
    /** Restrict to a single channel (or thread) id. */
    channelId?: string;
    /** Restrict to messages by these author ids. */
    authorIds?: string[];
    /** Restrict to messages mentioning these user ids. */
    mentions?: string[];
    /** Only messages with attachments. */
    hasAttachments?: boolean;
    /** Only messages with embeds. */
    hasEmbeds?: boolean;
    /** Search before/after a snowflake (paging). */
    beforeId?: string;
    afterId?: string;
    /** Max results (default 25, max 25). */
    limit?: number;
    /** Page offset for pagination (Discord uses offset-based for search). */
    offset?: number;
    /** Sort by message timestamp or relevance. Default `timestamp`. */
    sortBy?: "timestamp" | "relevance";
    /** Default `desc`. */
    sortOrder?: "asc" | "desc";
  } = {}): Promise<{
    messages: Message[];
    threads: Channel[];
    members: unknown[];
    totalResults: number;
    /** True while Discord still building the long-term index for this guild. */
    doingDeepHistoricalIndex: boolean;
    analyticsId: string;
  }> {
    const params = new URLSearchParams();
    if (opts.content) params.set("content", opts.content);
    if (opts.channelId) params.set("channel_id", opts.channelId);
    for (const id of opts.authorIds ?? []) params.append("author_id", id);
    for (const id of opts.mentions ?? []) params.append("mentions", id);
    if (opts.hasAttachments !== undefined) params.set("has", "attachment");
    if (opts.hasEmbeds !== undefined) params.set("has", "embed");
    if (opts.beforeId) params.set("max_id", opts.beforeId);
    if (opts.afterId) params.set("min_id", opts.afterId);
    if (opts.limit !== undefined) params.set("limit", String(opts.limit));
    if (opts.offset !== undefined) params.set("offset", String(opts.offset));
    if (opts.sortBy) params.set("sort_by", opts.sortBy);
    if (opts.sortOrder) params.set("sort_order", opts.sortOrder);
    const q = params.toString();
    const r = await this.rest.get<{
      messages?: (RawMessage | RawMessage[])[];
      threads?: RawChannel[];
      members?: unknown[];
      total_results?: number;
      doing_deep_historical_index?: boolean;
      analytics_id?: string;
    }>(`/guilds/${this.id}/messages/search${q ? `?${q}` : ""}`);
    // Discord returns messages as a list of bundles (each bundle is a hit + context messages around it).
    // Flatten to the primary hit (first item) per bundle for ergonomics. Some
    // responses return a flat array — handle both.
    const flat: Message[] = [];
    for (const entry of r.messages ?? []) {
      const hit = Array.isArray(entry) ? entry[0] : entry;
      if (hit) flat.push(new Message(hit, this.rest));
    }
    return {
      messages: flat,
      threads: (r.threads ?? []).map((c) => new Channel(c, this.rest)),
      members: r.members ?? [],
      totalResults: r.total_results ?? flat.length,
      doingDeepHistoricalIndex: !!r.doing_deep_historical_index,
      analyticsId: r.analytics_id ?? "",
    };
  }

  // ── Voice state — modify a member's voice state ────────────────────────

  /** Modify a connected member's voice state. (mute/deafen/move/suppress) */
  async setMemberVoiceState(
    userId: string,
    opts: { channelId?: string; suppress?: boolean; requestToSpeakAt?: string | null },
  ): Promise<void> {
    await this.rest.patch(`/guilds/${this.id}/voice-states/${userId}`, {
      channel_id: opts.channelId,
      suppress: opts.suppress,
      request_to_speak_timestamp: opts.requestToSpeakAt,
    });
  }

  /** Modify the bot's own voice state (raise hand to speak in stage, etc). */
  async setOwnVoiceState(opts: { channelId?: string; suppress?: boolean; requestToSpeakAt?: string | null }): Promise<void> {
    await this.rest.patch(`/guilds/${this.id}/voice-states/@me`, {
      channel_id: opts.channelId,
      suppress: opts.suppress,
      request_to_speak_timestamp: opts.requestToSpeakAt,
    });
  }

  // ── Bulk channel position edit ──────────────────────────────────────────

  async bulkEditChannelPositions(
    updates: { id: string; position?: number; lockPermissions?: boolean; parentId?: string | null }[],
    reason?: string,
  ): Promise<void> {
    await this.rest.patch(
      `/guilds/${this.id}/channels`,
      updates.map((u) => ({
        id: u.id,
        position: u.position,
        lock_permissions: u.lockPermissions,
        parent_id: u.parentId,
      })),
      reason ? { "X-Audit-Log-Reason": reason } : undefined,
    );
  }

  // ── Member verification (gate) ──────────────────────────────────────────

  async fetchMemberVerification(): Promise<unknown> {
    return this.rest.get(`/guilds/${this.id}/member-verification`);
  }

  // ── Vanity URL / Voice regions / Preview ────────────────────────────────

  async fetchVanityUrl(): Promise<{ code: string | null; uses: number }> {
    return this.rest.get<{ code: string | null; uses: number }>(`/guilds/${this.id}/vanity-url`);
  }

  async fetchVoiceRegions(): Promise<{ id: string; name: string; optimal: boolean; deprecated: boolean; custom: boolean }[]> {
    return this.rest.get(`/guilds/${this.id}/regions`);
  }

  async fetchPreview(): Promise<unknown> {
    return this.rest.get(`/guilds/${this.id}/preview`);
  }

  async leave(): Promise<void> {
    await this.rest.delete(`/users/@me/guilds/${this.id}`);
  }

  async edit(opts: { name?: string; description?: string | null; icon?: string | null }, reason?: string): Promise<Guild> {
    const raw = await this.rest.patch<RawGuild>(`/guilds/${this.id}`, opts, reason ? { "X-Audit-Log-Reason": reason } : undefined);
    return new Guild(raw, this.rest);
  }
}
