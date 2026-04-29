// REST client for the Discord HTTP API.
// Handles auth, JSON encoding, multipart file uploads, and per-route rate limit
// buckets so concurrent requests on different routes don't block each other.

import { EventEmitter } from "node:events";
import { API } from "./types.js";

/**
 * Structured Discord error code metadata.
 * Source: https://docs.discord.com/developers/topics/opcodes-and-status-codes#json
 *
 * Format intentionally machine-readable so an LLM consuming an exception can
 * recognize the kind, the actionable fix, and the doc anchor without parsing
 * free-form prose.
 */
export interface DiscordErrorMeta {
  /** Stable kebab-case identifier (e.g. "missing-permissions"). */
  kind: string;
  /** PascalCase symbolic name (matches Discord's docs). */
  name: string;
  /** What went wrong, in 1 short sentence. */
  meaning: string;
  /** Concrete remediation step. */
  fix: string;
  /** Doc anchor (Discord docs section). */
  docs?: string;
}

/**
 * Discord JSON error code map. Subset of high-value codes that bots actually
 * hit. Intentionally curated, not auto-generated, so each entry has an
 * actionable `fix`. (Last reviewed against the Discord changelog 2026-04.)
 */
export const DiscordErrorCodes: Record<number, DiscordErrorMeta> = {
  // 0 = generic
  10001: { kind: "unknown-account", name: "UnknownAccount", meaning: "the account id is invalid or doesn't exist", fix: "verify the user/account id" },
  10002: { kind: "unknown-application", name: "UnknownApplication", meaning: "the application id is invalid", fix: "verify your application id at https://discord.com/developers/applications" },
  10003: { kind: "unknown-channel", name: "UnknownChannel", meaning: "the target channel doesn't exist or the bot can't see it", fix: "verify the channelId; ensure the bot is in the guild and has VIEW_CHANNEL" },
  10004: { kind: "unknown-guild", name: "UnknownGuild", meaning: "the guild id is invalid or the bot is not a member", fix: "invite the bot to the guild, or check the guildId" },
  10005: { kind: "unknown-integration", name: "UnknownIntegration", meaning: "integration id invalid or already removed", fix: "list integrations with guild.fetchIntegrations() to find the correct id" },
  10006: { kind: "unknown-invite", name: "UnknownInvite", meaning: "invite code is invalid, expired, or revoked", fix: "create a fresh invite, or verify the code character casing" },
  10007: { kind: "unknown-member", name: "UnknownMember", meaning: "the user is not a member of this guild", fix: "verify the userId, or fetch the member first" },
  10008: { kind: "unknown-message", name: "UnknownMessage", meaning: "message id invalid, deleted, or in a different channel", fix: "double-check messageId AND channelId; messages are scoped to a single channel" },
  10009: { kind: "unknown-overwrite", name: "UnknownPermissionOverwrite", meaning: "permission overwrite target id (role/member) doesn't exist on this channel", fix: "create the overwrite first, or list channel.permissionOverwrites" },
  10010: { kind: "unknown-provider", name: "UnknownProvider", meaning: "OAuth2 provider not recognized", fix: "verify the provider name in your OAuth2 flow" },
  10011: { kind: "unknown-role", name: "UnknownRole", meaning: "role id doesn't exist in this guild", fix: "list guild roles to find the correct id" },
  10012: { kind: "unknown-token", name: "UnknownToken", meaning: "token (webhook/interaction) is invalid or expired", fix: "use a fresh token; webhook tokens are stable but interaction tokens expire after 15 min" },
  10013: { kind: "unknown-user", name: "UnknownUser", meaning: "user snowflake invalid", fix: "verify the userId is a Discord snowflake" },
  10014: { kind: "unknown-emoji", name: "UnknownEmoji", meaning: "emoji id is invalid or the bot can't see the guild that owns it", fix: "verify the emoji id; for custom emoji ensure the bot shares a guild with it" },
  10015: { kind: "unknown-webhook", name: "UnknownWebhook", meaning: "webhook id is invalid or already deleted", fix: "list channel.fetchWebhooks() to find the correct id" },
  10026: { kind: "unknown-ban", name: "UnknownBan", meaning: "the user is not currently banned in this guild", fix: "use guild.fetchBan() — it returns null for not-banned users instead of throwing" },
  10036: { kind: "unknown-sticker", name: "UnknownSticker", meaning: "sticker id is invalid", fix: "list standard sticker packs or guild stickers to find the correct id" },
  10059: { kind: "unknown-discoverable-guild", name: "UnknownDiscoverableServer", meaning: "guild is not in the discovery directory", fix: "verify the discoverable guild id" },
  10060: { kind: "unknown-sticker-pack", name: "UnknownStickerPack", meaning: "sticker pack id invalid", fix: "list standard sticker packs to find valid ids" },
  10062: { kind: "unknown-interaction", name: "UnknownInteraction", meaning: "interaction expired (3s ack window) or already responded to", fix: "respond within 3 seconds, or call ctx.defer() first to extend to 15 minutes" },
  10063: { kind: "unknown-app-command", name: "UnknownApplicationCommand", meaning: "command id no longer exists or wasn't deployed in this scope", fix: "redeploy commands; bot.start() auto-deploys, or call commands manually" },
  10065: { kind: "unknown-voice-state", name: "UnknownVoiceState", meaning: "the user has no voice state in this guild (not in any voice channel)", fix: "verify the user is connected to a voice channel before reading state" },
  10066: { kind: "unknown-app-command-permissions", name: "UnknownApplicationCommandPermissions", meaning: "command has no per-guild permissions configured yet", fix: "set permissions with bot.setCommandPermissions() (requires a user bearer token)" },
  10067: { kind: "unknown-stage", name: "UnknownStageInstance", meaning: "stage instance not found (stage channel may be empty)", fix: "create a stage instance with bot.stages.create() before fetching" },
  10068: { kind: "unknown-guild-member-verification", name: "UnknownGuildMemberVerificationForm", meaning: "guild has no member verification (gate) configured", fix: "configure the gate in Server Settings > Membership Screening" },
  10069: { kind: "unknown-guild-welcome-screen", name: "UnknownGuildWelcomeScreen", meaning: "guild has no welcome screen configured", fix: "configure it via guild.editWelcomeScreen({ enabled: true, ... })" },
  10070: { kind: "unknown-scheduled-event", name: "UnknownGuildScheduledEvent", meaning: "scheduled event id is invalid or already ended", fix: "list guild.fetchScheduledEvents() to find active ids" },
  10087: { kind: "unknown-tag", name: "UnknownTag", meaning: "forum tag id doesn't exist on this channel", fix: "list channel.availableTags to find valid ids" },
  10092: { kind: "unknown-sound", name: "UnknownSound", meaning: "soundboard sound id is invalid", fix: "list bot.soundboard.listGuildSounds() to find valid ids" },
  20001: { kind: "bot-not-allowed", name: "BotsCannotUseEndpoint", meaning: "this endpoint is forbidden for bot accounts", fix: "use a user account; this endpoint is bot-blocked" },
  20012: { kind: "only-bots-allowed", name: "OnlyBotsAllowed", meaning: "this endpoint requires a bot token; you sent a user token", fix: "use a bot token (Authorization: Bot <token>)" },
  20016: { kind: "slowmode", name: "SlowmodeRateLimit", meaning: "the user/bot is rate-limited by the channel's slow-mode", fix: "respect channel.rateLimitPerUser between writes" },
  20022: { kind: "ann-edit-rate-limit", name: "AnnouncementEditRateLimit", meaning: "you've hit the announcement-channel edit rate limit", fix: "back off and retry; announcement channels have stricter caps than normal channels" },
  20028: { kind: "channel-write-rate-limit", name: "ChannelWriteRateLimit", meaning: "channel slow-mode is preventing this write", fix: "respect channel.rateLimitPerUser, or wait before retrying" },
  20029: { kind: "disallowed-name", name: "DisallowedWordsInName", meaning: "guild/channel/role name contains words on Discord's disallow list", fix: "remove the offending word(s); see Discord's content guidelines" },
  20031: { kind: "disallowed-app-command-name", name: "DisallowedWordsInCommandName", meaning: "command name contains disallowed words", fix: "rename the command (avoid trademarked or reserved terms)" },
  30001: { kind: "max-guilds-account", name: "MaxGuildsForAccount", meaning: "user is in 100 guilds and can't join more", fix: "the user must leave a guild before joining another" },
  30003: { kind: "max-friends", name: "MaxFriends", meaning: "user has 1000 friends (cap)", fix: "remove friends to make room (user-account concern)" },
  30005: { kind: "max-guilds", name: "MaxGuildsReached", meaning: "bot is in 100 guilds (small-bot cap)", fix: "leave a guild, or apply to verify the bot for unlimited guilds" },
  30007: { kind: "max-pins", name: "MaxPinsReached", meaning: "channel already has 50 pinned messages", fix: "unpin a message before pinning a new one" },
  30008: { kind: "max-recipients", name: "MaxRecipientsReached", meaning: "DM/group has hit the recipient cap", fix: "remove a recipient first" },
  30010: { kind: "max-reactions", name: "MaxReactionsReached", meaning: "message already has 20 distinct reaction emojis", fix: "remove an emoji before adding another" },
  30013: { kind: "max-channels", name: "MaxChannelsReached", meaning: "guild has hit the 500-channel cap", fix: "delete a channel first" },
  30015: { kind: "max-attachments", name: "MaxAttachmentsInMessage", meaning: "message exceeds the 10-attachment cap", fix: "split into multiple messages or merge files" },
  30016: { kind: "max-invites", name: "MaxInvitesReached", meaning: "channel has too many active invites (1000)", fix: "delete some invites before creating new ones" },
  30018: { kind: "max-stickers", name: "MaxStickersReached", meaning: "guild already has the maximum number of custom stickers", fix: "delete an existing sticker before uploading a new one (cap depends on Boost level)" },
  30019: { kind: "max-prune-requests", name: "MaxPruneRequests", meaning: "you've hit the prune-request rate limit", fix: "back off and retry; pruning is heavily rate-limited" },
  30030: { kind: "max-app-commands", name: "MaxApplicationCommands", meaning: "this app/guild has hit the application command cap (100 per scope)", fix: "delete unused commands; consider using subcommands instead of separate top-level commands" },
  30031: { kind: "max-app-command-permissions", name: "MaxApplicationCommandPermissionOverwrites", meaning: "exceeded 100 permission overwrites for one command", fix: "consolidate role/user overwrites or use a permission group" },
  30032: { kind: "max-threads", name: "MaxActiveThreads", meaning: "guild already has 1000 active threads", fix: "archive or delete inactive threads first" },
  30034: { kind: "max-thread-participants", name: "MaxThreadParticipants", meaning: "thread has reached the participant cap", fix: "create a new thread; threads cap participants for performance" },
  30038: { kind: "max-events", name: "MaxScheduledEvents", meaning: "guild has hit the scheduled events cap (100)", fix: "delete or end an event first" },
  30046: { kind: "max-edits-per-message", name: "MaxEditsForOldMessage", meaning: "message is older than 1 hour and you've hit the edit cap", fix: "send a new message instead of editing an old one" },
  30058: { kind: "max-bans-per-call", name: "MaxBansPerBulkCall", meaning: "bulk-ban accepts at most 200 users per call", fix: "split your userIds list into chunks of 200 and retry" },
  40001: { kind: "unauthorized", name: "Unauthorized", meaning: "token missing or invalid", fix: "set DISCORD_TOKEN to a valid bot token from the Developer Portal" },
  40002: { kind: "verification-required", name: "AccountVerificationRequired", meaning: "you must verify your bot's email/phone before using this endpoint", fix: "verify the bot owner account in Discord settings" },
  40003: { kind: "ratelimit-too-fast", name: "OpeningDirectMessagesTooFast", meaning: "you opened DMs too quickly; throttle channel-create to ~10/s", fix: "queue DM opens; reuse the channel id if you DM the same user repeatedly" },
  40004: { kind: "send-disabled", name: "SendMessagesTemporarilyDisabled", meaning: "Discord has temporarily disabled sending in this channel", fix: "wait and retry; nothing the bot can do" },
  40005: { kind: "request-too-large", name: "RequestEntityTooLarge", meaning: "request body / file exceeds size cap", fix: "compress files; non-Nitro upload cap is 25MB; use upload_attachment if Nitro" },
  40006: { kind: "feature-disabled", name: "FeatureTemporarilyDisabled", meaning: "this server feature is temporarily disabled", fix: "wait and retry; nothing the bot can do" },
  40007: { kind: "user-banned", name: "UserBannedFromGuild", meaning: "the target user is banned from the guild — re-add fails", fix: "unban first with guild.unban(userId), then re-add or invite" },
  40032: { kind: "premium-required", name: "OwnerCannotBeMembershipScreen", meaning: "premium tier required for this guild operation", fix: "boost the guild to the required tier" },
  40033: { kind: "already-crossposted", name: "MessageAlreadyCrossposted", meaning: "this announcement message has already been crossposted", fix: "messages can only be crossposted once" },
  40041: { kind: "command-name-taken", name: "ApplicationCommandNameAlreadyExists", meaning: "another command in this scope has the same name", fix: "rename one of the commands; names are unique per app per scope" },
  40043: { kind: "interaction-failed-send", name: "InteractionFailedToSend", meaning: "Discord couldn't deliver the interaction response (network/internal)", fix: "retry the response; if persistent, defer first then editReply" },
  40058: { kind: "max-tag-channels", name: "MaxForumTagsExceeded", meaning: "forum channel has too many tags configured", fix: "delete or merge tags; forum channels cap at 20 tags" },
  40060: { kind: "interaction-already-acknowledged", name: "InteractionAlreadyAcknowledged", meaning: "this interaction has already been replied/deferred", fix: "use ctx.followup() or ctx.editReply() instead of ctx.reply() after first response" },
  50001: { kind: "missing-access", name: "MissingAccess", meaning: "bot lacks access to this resource (channel, guild, etc.)", fix: "grant the bot VIEW_CHANNEL on the target channel; verify it's in the guild" },
  50002: { kind: "invalid-account-type", name: "InvalidAccountType", meaning: "this endpoint isn't valid for this account type (bot vs user)", fix: "use the correct token type for this endpoint" },
  50003: { kind: "invalid-action-dm", name: "CannotExecuteActionOnDMChannel", meaning: "this action only works in guilds, not DMs", fix: "perform the action in a guild channel" },
  50004: { kind: "embed-disabled", name: "GuildWidgetDisabled", meaning: "guild widget is disabled", fix: "enable the widget with guild.editWidget({ enabled: true })" },
  50005: { kind: "cannot-edit-other", name: "CannotEditOtherUserMessage", meaning: "bots can only edit their own messages", fix: "only edit messages where author.id === bot.user.id" },
  50006: { kind: "cannot-send-empty", name: "CannotSendEmptyMessage", meaning: "message has no content/embeds/components/files/poll", fix: "include at least one of: content, embeds, components, files, poll, sticker_ids" },
  50007: { kind: "cannot-dm", name: "CannotSendMessagesToThisUser", meaning: "user has DMs closed or has not shared a guild with the bot", fix: "fall back to mentioning the user in a guild channel" },
  50008: { kind: "cannot-send-voice", name: "CannotSendInVoiceChannel", meaning: "this voice channel doesn't accept text messages", fix: "use the voice channel's text chat (only available on supported voice channels)" },
  50013: { kind: "missing-permissions", name: "MissingPermissions", meaning: "bot lacks the required permission for this action", fix: "grant the missing permission (often MANAGE_MESSAGES, MANAGE_CHANNELS, KICK_MEMBERS, BAN_MEMBERS, MANAGE_ROLES) on the target channel/guild" },
  50014: { kind: "invalid-token", name: "InvalidAuthenticationToken", meaning: "token format is invalid (not the same as Unauthorized)", fix: "verify token starts with the right prefix; trim whitespace; regenerate if rotated" },
  50016: { kind: "message-too-old-bulk", name: "MessageTooOldForBulkDelete", meaning: "bulk-delete only works on messages younger than 14 days", fix: "delete each old message individually with channel.deleteMessage(id)" },
  50019: { kind: "message-not-pinned-here", name: "MessageNotInThisChannel", meaning: "the pinned/forwarded message belongs to a different channel", fix: "verify channelId matches the message's channel" },
  50021: { kind: "system-message-action", name: "CannotExecuteOnSystemMessage", meaning: "this action can't run on system messages (joins, boosts, etc.)", fix: "skip messages where message.type !== 0 (Default)" },
  50024: { kind: "non-text-channel", name: "CannotExecuteOnThisChannelType", meaning: "endpoint doesn't apply to this channel type", fix: "verify channel.type is one Discord allows for this action" },
  50025: { kind: "invalid-oauth-state", name: "InvalidOAuthState", meaning: "OAuth2 access-token is missing required scope", fix: "re-authorize the user with the correct scopes" },
  50027: { kind: "invalid-webhook-token", name: "InvalidWebhookToken", meaning: "webhook token is invalid", fix: "regenerate the webhook or fetch a fresh one with channel.fetchWebhooks()" },
  50028: { kind: "invalid-role", name: "InvalidRole", meaning: "the role can't be assigned/removed (managed/integration role)", fix: "managed roles (bot/integration roles) can't be assigned manually" },
  50033: { kind: "invalid-recipients", name: "InvalidRecipientsForMessage", meaning: "recipient list contains invalid user ids or you can't DM all of them", fix: "verify ids; fall back to a guild channel mention" },
  50034: { kind: "bulk-too-old", name: "MessageBulkDeleteAgeMismatch", meaning: "bulk-delete request mixes new and old messages", fix: "filter messages younger than 14 days client-side before bulk-delete" },
  50035: { kind: "invalid-form-body", name: "InvalidFormBody", meaning: "the JSON payload failed validation; check `errors` for field-by-field detail", fix: "inspect err.body.errors for the offending fields and fix them" },
  50036: { kind: "invite-no-bot", name: "InviteAcceptedToGuildBotNotIn", meaning: "user accepted an invite to a guild the bot isn't in", fix: "invite the bot to the same guild" },
  50041: { kind: "invalid-api-version", name: "InvalidAPIVersion", meaning: "the requested API version is unsupported", fix: "Supa.js targets v10; ensure your gatewayUrl/apiUrl override (if any) uses /api/v10" },
  50045: { kind: "file-too-large", name: "FileUploadedTooLarge", meaning: "file exceeds the per-attachment size cap", fix: "compress the file or upload to external storage and link" },
  50046: { kind: "invalid-file-uploaded", name: "InvalidFileUploaded", meaning: "Discord rejected the file (corrupt/unsupported type)", fix: "verify the file's MIME type and integrity" },
  50054: { kind: "cannot-self-redeem", name: "CannotSelfRedeemGift", meaning: "you can't gift/redeem to yourself", fix: "specify a different recipient" },
  50055: { kind: "invalid-guild", name: "InvalidGuild", meaning: "guild id is invalid for this operation (e.g. DM-only feature)", fix: "verify the guildId or omit it for DM-scoped operations" },
  50064: { kind: "cannot-execute-on-thread-parent", name: "CannotExecuteOnThreadParent", meaning: "this action belongs on the thread, not its parent channel", fix: "call the method on the thread channel instead" },
  50068: { kind: "invalid-message-type", name: "InvalidMessageType", meaning: "this message type doesn't support this action (e.g. forward)", fix: "verify message.type before performing the action" },
  50080: { kind: "thread-archived", name: "CannotPerformOnArchivedThread", meaning: "you can't perform this action on an archived thread", fix: "unarchive the thread first with channel.edit({ archived: false })" },
  50081: { kind: "invalid-thread-notif", name: "InvalidThreadNotificationSettings", meaning: "thread notification value is invalid", fix: "use one of: 0 (all), 1 (mentions), 2 (none)" },
  50083: { kind: "thread-locked", name: "ThreadLocked", meaning: "thread is locked; only moderators can post", fix: "unlock the thread first, or have a mod-permission user perform the action" },
  50084: { kind: "max-active-threads", name: "MaxActiveAnnouncementThreads", meaning: "channel has too many active announcement threads", fix: "archive or delete inactive announcement threads first" },
  50085: { kind: "invalid-sticker", name: "InvalidStickerSent", meaning: "the sticker can't be sent (not in this guild's pack)", fix: "verify the sticker is in this guild or in a default pack" },
  50095: { kind: "stage-needs-topic", name: "StageNeedsTopic", meaning: "stage instance must have a topic", fix: "set a topic when creating the stage instance" },
  60003: { kind: "two-factor-required", name: "TwoFactorRequired", meaning: "guild requires 2FA on the bot account for this moderation action", fix: "enable 2FA on the bot owner account, OR disable Server-Wide 2FA Requirement in guild settings" },
  90001: { kind: "reaction-blocked", name: "ReactionBlocked", meaning: "user has blocked the bot, so reaction to their message is denied", fix: "no fix — surface to caller as a soft failure" },
  130000: { kind: "resource-overloaded", name: "ApplicationResourcesUnavailable", meaning: "Discord temporarily can't serve this resource (server-side overload)", fix: "retry with exponential backoff; this is on Discord's side" },
  150006: { kind: "stage-already-open", name: "StageAlreadyOpen", meaning: "a stage instance already exists in this channel", fix: "fetch and reuse the existing instance instead of creating a new one" },
  170001: { kind: "automod-no-keyword", name: "AutoModRuleQuotaExceeded", meaning: "automod rule quota exceeded for this guild", fix: "delete an existing rule before creating a new one (Discord caps automod rules per guild)" },
  170002: { kind: "automod-action-quota", name: "AutoModActionQuotaExceeded", meaning: "automod action limit exceeded for this rule", fix: "split actions across multiple rules" },
  // 2026 additions
  110000: { kind: "search-index-not-ready", name: "SearchIndexNotReady", meaning: "guild's message search index is still building (added 2026-Q1)", fix: "retry with exponential backoff (typical: 30–120s); the index builds once and persists" },
  160014: { kind: "forward-content-access-required", name: "ForwardRequiresContentAccess", meaning: "bot must be able to READ the source message to forward it (added 2026-Q1)", fix: "enable the MESSAGE_CONTENT privileged intent in the Developer Portal AND ensure the bot can VIEW_CHANNEL on the source channel" },
  220001: { kind: "incident-window-too-long", name: "IncidentActionWindowTooLong", meaning: "guild incident pause exceeds the 24h cap (added 2024-Q2)", fix: "pass an ISO timestamp <=24h in the future, or null to clear" },
};

/**
 * Snapshot all known error codes as a JSON array (kind/code/name/meaning/fix).
 * Useful for surfacing the table in dashboards or generating docs.
 */
export function discordErrorCodesToJSON(): Array<DiscordErrorMeta & { code: number }> {
  return Object.entries(DiscordErrorCodes).map(([k, v]) => ({ code: Number(k), ...v }));
}

export class RestError extends Error {
  status: number;
  code?: number;
  body: unknown;
  /** Structured metadata from the Discord error code map (when known). */
  meta?: DiscordErrorMeta;
  /** HTTP method, e.g. "POST". */
  method?: string;
  /** Request path, e.g. "/channels/123/messages". */
  path?: string;

  constructor(status: number, body: unknown, ctx?: { method?: string; path?: string }) {
    const code = (body as { code?: number } | null)?.code;
    const apiMsg = (body as { message?: string } | null)?.message ?? "request failed";
    const meta = code !== undefined ? DiscordErrorCodes[code] : undefined;
    const route = ctx ? ` ${ctx.method ?? ""} ${ctx.path ?? ""}`.trimEnd() : "";

    let msg: string;
    if (meta) {
      msg = `RestError [${code}] ${meta.name}: ${meta.meaning} (${apiMsg})${route}\n  fix: ${meta.fix}`;
    } else if (code !== undefined) {
      msg = `RestError [${code}] (status=${status}): ${apiMsg}${route}`;
    } else {
      msg = `RestError [http=${status}]: ${apiMsg}${route}`;
    }
    // Surface validation errors verbatim — they're the most useful for the caller.
    const errors = (body as { errors?: unknown } | null)?.errors;
    if (errors) {
      try {
        msg += `\n  errors: ${JSON.stringify(errors)}`;
      } catch {
        /* ignore */
      }
    }
    super(msg);
    this.name = "RestError";
    this.status = status;
    this.code = code;
    this.body = body;
    this.meta = meta;
    this.method = ctx?.method;
    this.path = ctx?.path;
  }
}

export interface RestOptions {
  token: string;
  /** Override base URL (testing). */
  baseUrl?: string;
  /** Max 429 retries before throwing. */
  maxRetries?: number;
}

/** Multipart-friendly file payload. */
export interface RestFile {
  /** Filename including extension. */
  name: string;
  /** Buffer or string body. */
  data: Uint8Array | string;
  /** Optional content-type override. */
  type?: string;
  /** Optional description (alt text). */
  description?: string;
}

interface Bucket {
  queue: (() => void)[];
  busy: boolean;
  reset: number; // epoch ms when bucket resets
  remaining: number;
}

export class Rest extends EventEmitter {
  private token: string;
  private baseUrl: string;
  private maxRetries: number;
  private buckets = new Map<string, Bucket>();
  /** Global rate-limit reset (epoch ms); 0 = none. */
  private globalReset = 0;

  constructor(opts: RestOptions) {
    super();
    this.token = opts.token;
    this.baseUrl = opts.baseUrl ?? API;
    this.maxRetries = opts.maxRetries ?? 3;
  }

  // ── Public API ─────────────────────────────────────────────────────────

  get<T = unknown>(path: string, headers?: Record<string, string>) {
    return this.request<T>("GET", path, undefined, undefined, headers);
  }
  post<T = unknown>(path: string, body?: unknown, headers?: Record<string, string>) {
    return this.request<T>("POST", path, body, undefined, headers);
  }
  put<T = unknown>(path: string, body?: unknown, headers?: Record<string, string>) {
    return this.request<T>("PUT", path, body, undefined, headers);
  }
  patch<T = unknown>(path: string, body?: unknown, headers?: Record<string, string>) {
    return this.request<T>("PATCH", path, body, undefined, headers);
  }
  delete<T = unknown>(path: string, headers?: Record<string, string>) {
    return this.request<T>("DELETE", path, undefined, undefined, headers);
  }

  /** Multipart upload. `files` will be sent as files and `body` as JSON payload. */
  async upload<T = unknown>(
    method: "POST" | "PATCH",
    path: string,
    body: unknown,
    files: RestFile[],
    headers?: Record<string, string>,
  ): Promise<T> {
    return this.request<T>(method, path, body, files, headers);
  }

  /**
   * Multipart upload with FORM FIELDS instead of `payload_json` (used by the
   * Discord sticker-upload endpoint).
   */
  async uploadFields<T = unknown>(
    method: "POST" | "PATCH",
    path: string,
    fields: Record<string, string>,
    files: RestFile[],
    headers?: Record<string, string>,
  ): Promise<T> {
    const bucketKey = this.bucketKeyFor(method, path);
    return this.runInBucket(bucketKey, async () => {
      const url = this.baseUrl + path;
      const reqHeaders: Record<string, string> = {
        Authorization: `Bot ${this.token}`,
        "User-Agent": "Supa.js (https://github.com/, 0.1.0)",
        ...(headers ?? {}),
      };
      const { body: fd, boundary } = buildMultipartFields(fields, files);
      reqHeaders["Content-Type"] = `multipart/form-data; boundary=${boundary}`;
      const init: RequestInit = { method, headers: reqHeaders, body: fd as unknown as BodyInit };
      for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
        const start = Date.now();
        const res = await fetch(url, init);
        const elapsed = Date.now() - start;
        if (res.status === 429) {
          const retryAfter = Number(res.headers.get("retry-after") ?? "1") * 1000;
          this.emit("request", { method, path, status: 429, ms: elapsed, bucket: bucketKey, ts: Date.now() });
          await sleep(retryAfter);
          continue;
        }
        const text = await res.text();
        const parsed: unknown = text ? safeParse(text) : null;
        this.emit("request", { method, path, status: res.status, ms: elapsed, bucket: bucketKey, ts: Date.now(), errorBody: !res.ok ? parsed : undefined });
        if (!res.ok) throw new RestError(res.status, parsed, { method, path });
        return parsed as T;
      }
      throw new RestError(429, { message: "rate-limited after retries", code: 429 }, { method, path });
    });
  }

  // ── Core ───────────────────────────────────────────────────────────────

  async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    files?: RestFile[],
    extraHeaders?: Record<string, string>,
  ): Promise<T> {
    const bucketKey = this.bucketKeyFor(method, path);
    return this.runInBucket(bucketKey, () =>
      this.execute<T>(method, path, body, files, extraHeaders),
    );
  }

  private async execute<T>(
    method: string,
    path: string,
    body: unknown,
    files: RestFile[] | undefined,
    extraHeaders: Record<string, string> | undefined,
  ): Promise<T> {
    const url = this.baseUrl + path;
    const headers: Record<string, string> = {
      Authorization: `Bot ${this.token}`,
      "User-Agent": "Supa.js (https://github.com/, 0.1.0)",
      ...(extraHeaders ?? {}),
    };

    let init: RequestInit;
    if (files && files.length > 0) {
      const { body: fd, boundary } = buildMultipart(body, files);
      headers["Content-Type"] = `multipart/form-data; boundary=${boundary}`;
      // BodyInit accepts a BufferSource; cast to satisfy lib.dom typing.
      init = { method, headers, body: fd as unknown as BodyInit };
    } else if (body !== undefined) {
      headers["Content-Type"] = "application/json";
      init = { method, headers, body: JSON.stringify(body) };
    } else {
      init = { method, headers };
    }

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      // honor global rate limit
      const globalWait = this.globalReset - Date.now();
      if (globalWait > 0) await sleep(globalWait);

      const start = Date.now();
      const res = await fetch(url, init);
      const elapsed = Date.now() - start;

      // rate-limit headers
      const reset = Number(res.headers.get("x-ratelimit-reset-after") ?? "0");
      const remaining = Number(res.headers.get("x-ratelimit-remaining") ?? "1");
      const isGlobal = res.headers.get("x-ratelimit-global");
      const bucketKey = this.bucketKeyFor(method, path);
      const bucket = this.buckets.get(bucketKey);
      if (bucket) {
        bucket.remaining = remaining;
        if (reset > 0) bucket.reset = Date.now() + reset * 1000;
      }

      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("retry-after") ?? "1") * 1000;
        if (isGlobal) this.globalReset = Date.now() + retryAfter;
        this.emit("request", {
          method, path, status: 429, ms: elapsed, bucket: bucketKey,
          ratelimit: { remaining, resetAfter: reset }, ts: Date.now(),
        });
        await sleep(retryAfter);
        continue;
      }

      // Read body once (may be empty)
      const text = await res.text();
      const parsed: unknown = text ? safeParse(text) : null;
      this.emit("request", {
        method, path, status: res.status, ms: elapsed, bucket: bucketKey,
        ratelimit: { remaining, resetAfter: reset },
        errorBody: !res.ok ? parsed : undefined,
        ts: Date.now(),
      });
      if (!res.ok) throw new RestError(res.status, parsed, { method, path });
      return parsed as T;
    }
    throw new RestError(429, { message: "rate-limited after retries", code: 429 }, { method, path });
  }

  // ── Bucket scheduling ──────────────────────────────────────────────────

  private bucketKeyFor(method: string, path: string): string {
    // Group by method + route, treating major params (channels, guilds, webhooks)
    // as part of the bucket; everything else is normalized to ":id".
    const segments = path.split("?")[0]!.split("/").filter(Boolean);
    const norm: string[] = [];
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i]!;
      const prev = segments[i - 1];
      if (/^\d{17,20}$/.test(s)) {
        if (prev === "channels" || prev === "guilds" || prev === "webhooks") {
          norm.push(s); // major param — keep
        } else {
          norm.push(":id");
        }
      } else if (/^[a-zA-Z0-9_-]{32,}$/.test(s) && prev === "webhooks") {
        norm.push(":token");
      } else {
        norm.push(s);
      }
    }
    return `${method} /${norm.join("/")}`;
  }

  private async runInBucket<T>(key: string, fn: () => Promise<T>): Promise<T> {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = { queue: [], busy: false, reset: 0, remaining: 1 };
      this.buckets.set(key, bucket);
    }
    return new Promise<T>((resolve, reject) => {
      const run = async () => {
        bucket!.busy = true;
        try {
          // Wait until we have capacity
          if (bucket!.remaining <= 0) {
            const wait = bucket!.reset - Date.now();
            if (wait > 0) await sleep(wait);
          }
          const result = await fn();
          resolve(result);
        } catch (e) {
          reject(e);
        } finally {
          bucket!.busy = false;
          const next = bucket!.queue.shift();
          if (next) next();
        }
      };
      if (bucket!.busy) bucket!.queue.push(run);
      else void run();
    });
  }
}

// ── Multipart helper ─────────────────────────────────────────────────────

function buildMultipart(payload: unknown, files: RestFile[]): { body: Uint8Array; boundary: string } {
  const boundary = `----supajs${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];

  // Augment payload.attachments with file metadata
  const augmented: Record<string, unknown> = (payload as Record<string, unknown>) ? { ...(payload as object) } : {};
  augmented.attachments = files.map((f, i) => ({ id: i, filename: f.name, description: f.description }));

  parts.push(enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="payload_json"\r\nContent-Type: application/json\r\n\r\n`));
  parts.push(enc.encode(JSON.stringify(augmented)));
  parts.push(enc.encode("\r\n"));

  files.forEach((f, i) => {
    parts.push(enc.encode(`--${boundary}\r\n`));
    parts.push(enc.encode(`Content-Disposition: form-data; name="files[${i}]"; filename="${escapeQuoted(f.name)}"\r\n`));
    parts.push(enc.encode(`Content-Type: ${f.type ?? "application/octet-stream"}\r\n\r\n`));
    parts.push(typeof f.data === "string" ? enc.encode(f.data) : f.data);
    parts.push(enc.encode("\r\n"));
  });

  parts.push(enc.encode(`--${boundary}--\r\n`));

  // concat
  let total = 0;
  for (const p of parts) total += p.byteLength;
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.byteLength;
  }
  return { body: out, boundary };
}

function buildMultipartFields(fields: Record<string, string>, files: RestFile[]): { body: Uint8Array; boundary: string } {
  const boundary = `----supajs${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];

  for (const [k, v] of Object.entries(fields)) {
    parts.push(enc.encode(`--${boundary}\r\nContent-Disposition: form-data; name="${escapeQuoted(k)}"\r\n\r\n${v}\r\n`));
  }
  files.forEach((f) => {
    parts.push(enc.encode(`--${boundary}\r\n`));
    parts.push(enc.encode(`Content-Disposition: form-data; name="file"; filename="${escapeQuoted(f.name)}"\r\n`));
    parts.push(enc.encode(`Content-Type: ${f.type ?? "application/octet-stream"}\r\n\r\n`));
    parts.push(typeof f.data === "string" ? enc.encode(f.data) : f.data);
    parts.push(enc.encode("\r\n"));
  });
  parts.push(enc.encode(`--${boundary}--\r\n`));

  let total = 0;
  for (const p of parts) total += p.byteLength;
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.byteLength;
  }
  return { body: out, boundary };
}

function escapeQuoted(s: string): string {
  return s.replace(/[\r\n"]/g, "_");
}

export { buildMultipart };

function safeParse(t: string): unknown {
  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
