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
  10003: { kind: "unknown-channel", name: "UnknownChannel", meaning: "the target channel doesn't exist or the bot can't see it", fix: "verify the channelId; ensure the bot is in the guild and has VIEW_CHANNEL" },
  10004: { kind: "unknown-guild", name: "UnknownGuild", meaning: "the guild id is invalid or the bot is not a member", fix: "invite the bot to the guild, or check the guildId" },
  10007: { kind: "unknown-member", name: "UnknownMember", meaning: "the user is not a member of this guild", fix: "verify the userId, or fetch the member first" },
  10008: { kind: "unknown-message", name: "UnknownMessage", meaning: "message id invalid, deleted, or in a different channel", fix: "double-check messageId AND channelId; messages are scoped to a single channel" },
  10011: { kind: "unknown-role", name: "UnknownRole", meaning: "role id doesn't exist in this guild", fix: "list guild roles to find the correct id" },
  10013: { kind: "unknown-user", name: "UnknownUser", meaning: "user snowflake invalid", fix: "verify the userId is a Discord snowflake" },
  10062: { kind: "unknown-interaction", name: "UnknownInteraction", meaning: "interaction expired (3s ack window) or already responded to", fix: "respond within 3 seconds, or call ctx.defer() first to extend to 15 minutes" },
  20012: { kind: "only-bots-allowed", name: "OnlyBotsAllowed", meaning: "this endpoint requires a bot token; you sent a user token", fix: "use a bot token (Authorization: Bot <token>)" },
  20028: { kind: "channel-write-rate-limit", name: "ChannelWriteRateLimit", meaning: "channel slow-mode is preventing this write", fix: "respect channel.rateLimitPerUser, or wait before retrying" },
  30005: { kind: "max-guilds", name: "MaxGuildsReached", meaning: "bot is in 100 guilds (small-bot cap)", fix: "leave a guild, or apply to verify the bot for unlimited guilds" },
  30007: { kind: "max-pins", name: "MaxPinsReached", meaning: "channel already has 50 pinned messages", fix: "unpin a message before pinning a new one" },
  30008: { kind: "max-recipients", name: "MaxRecipientsReached", meaning: "DM/group has hit the recipient cap", fix: "remove a recipient first" },
  30010: { kind: "max-reactions", name: "MaxReactionsReached", meaning: "message already has 20 distinct reaction emojis", fix: "remove an emoji before adding another" },
  30013: { kind: "max-channels", name: "MaxChannelsReached", meaning: "guild has hit the 500-channel cap", fix: "delete a channel first" },
  40001: { kind: "unauthorized", name: "Unauthorized", meaning: "token missing or invalid", fix: "set DISCORD_TOKEN to a valid bot token from the Developer Portal" },
  40005: { kind: "request-too-large", name: "RequestEntityTooLarge", meaning: "request body / file exceeds size cap", fix: "compress files; non-Nitro upload cap is 25MB; use upload_attachment if Nitro" },
  40060: { kind: "interaction-already-acknowledged", name: "InteractionAlreadyAcknowledged", meaning: "this interaction has already been replied/deferred", fix: "use ctx.followup() or ctx.editReply() instead of ctx.reply() after first response" },
  50001: { kind: "missing-access", name: "MissingAccess", meaning: "bot lacks access to this resource (channel, guild, etc.)", fix: "grant the bot VIEW_CHANNEL on the target channel; verify it's in the guild" },
  50005: { kind: "cannot-edit-other", name: "CannotEditOtherUserMessage", meaning: "bots can only edit their own messages", fix: "only edit messages where author.id === bot.user.id" },
  50006: { kind: "cannot-send-empty", name: "CannotSendEmptyMessage", meaning: "message has no content/embeds/components/files/poll", fix: "include at least one of: content, embeds, components, files, poll, sticker_ids" },
  50007: { kind: "cannot-dm", name: "CannotSendMessagesToThisUser", meaning: "user has DMs closed or has not shared a guild with the bot", fix: "fall back to mentioning the user in a guild channel" },
  50013: { kind: "missing-permissions", name: "MissingPermissions", meaning: "bot lacks the required permission for this action", fix: "grant the missing permission (often MANAGE_MESSAGES, MANAGE_CHANNELS, KICK_MEMBERS, BAN_MEMBERS, MANAGE_ROLES) on the target channel/guild" },
  50016: { kind: "message-too-old-bulk", name: "MessageTooOldForBulkDelete", meaning: "bulk-delete only works on messages younger than 14 days", fix: "delete each old message individually with channel.deleteMessage(id)" },
  50025: { kind: "invalid-oauth-state", name: "InvalidOAuthState", meaning: "OAuth2 access-token is missing required scope", fix: "re-authorize the user with the correct scopes" },
  50035: { kind: "invalid-form-body", name: "InvalidFormBody", meaning: "the JSON payload failed validation; check `errors` for field-by-field detail", fix: "inspect err.body.errors for the offending fields and fix them" },
  50064: { kind: "cannot-execute-on-thread-parent", name: "CannotExecuteOnThreadParent", meaning: "this action belongs on the thread, not its parent channel", fix: "call the method on the thread channel instead" },
  60003: { kind: "two-factor-required", name: "TwoFactorRequired", meaning: "guild requires 2FA on the bot account for this moderation action", fix: "enable 2FA on the bot owner account, OR disable Server-Wide 2FA Requirement in guild settings" },
  90001: { kind: "reaction-blocked", name: "ReactionBlocked", meaning: "user has blocked the bot, so reaction to their message is denied", fix: "no fix — surface to caller as a soft failure" },
  // 2026 additions
  110000: { kind: "search-index-not-ready", name: "SearchIndexNotReady", meaning: "guild's message search index is still building (added 2026-Q1)", fix: "retry with exponential backoff (typical: 30–120s); the index builds once and persists" },
  160014: { kind: "forward-content-access-required", name: "ForwardRequiresContentAccess", meaning: "bot must be able to READ the source message to forward it (added 2026-Q1)", fix: "enable the MESSAGE_CONTENT privileged intent in the Developer Portal AND ensure the bot can VIEW_CHANNEL on the source channel" },
};

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
