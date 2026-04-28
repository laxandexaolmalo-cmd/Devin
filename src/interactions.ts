// Interaction contexts: ChatInput, User, Message, Button, Select, Modal,
// Autocomplete. Each one is a single object with the actions you'd want to do.

import { Rest, RestFile } from "./rest.js";
import { User } from "./structures.js";
import { GuildMember } from "./guild.js";
import { Message } from "./message.js";
import { buildModalPayload, ModalDef } from "./components.js";
import {
  InteractionResponseType,
  RawInteraction,
  RawInteractionOption,
  RawMessage,
  RawUser,
  ComponentType,
} from "./types.js";

export interface InteractionReplyOptions {
  content?: string;
  embeds?: unknown[];
  components?: unknown[];
  /** Use Components V2 layout (auto-sets IS_COMPONENTS_V2 flag). */
  componentsV2?: boolean;
  files?: RestFile[];
  ephemeral?: boolean;
  silentMentions?: boolean;
  allowedMentions?: unknown;
  /** suppress embeds */
  suppressEmbeds?: boolean;
  tts?: boolean;
  /** Attach a poll. */
  poll?: import("./channel.js").PollOptions;
  /** Raw flags override (OR'd with computed). */
  flags?: number;
}

// ── Base context ──────────────────────────────────────────────────────────

export class BaseInteraction {
  readonly id: string;
  readonly token: string;
  readonly applicationId: string;
  readonly type: number;
  readonly guildId?: string;
  readonly channelId?: string;
  readonly user: User;
  /** Member when the interaction was sent in a guild, else null. */
  readonly member: GuildMember | null;
  readonly locale: string | null;
  readonly raw: RawInteraction;

  protected rest: Rest;
  protected replied = false;
  protected deferred = false;

  constructor(raw: RawInteraction, rest: Rest) {
    this.raw = raw;
    this.rest = rest;
    this.id = raw.id;
    this.token = raw.token;
    this.applicationId = raw.application_id;
    this.type = raw.type;
    this.guildId = raw.guild_id;
    this.channelId = raw.channel_id;
    const u = raw.member?.user ?? raw.user;
    this.user = new User(u ?? ({ id: "0", username: "unknown", discriminator: "0" } as RawUser), rest);
    this.member = raw.member && raw.guild_id ? new GuildMember(raw.member, raw.guild_id, rest) : null;
    this.locale = raw.locale ?? null;
  }

  // ── Reply lifecycle ────────────────────────────────────────────────────

  async reply(input: string | InteractionReplyOptions): Promise<void> {
    const opts = typeof input === "string" ? { content: input } : input;
    if (this.replied || this.deferred) {
      await this.editReply(opts);
      return;
    }
    const data = this.buildData(opts);
    if (opts.files && opts.files.length > 0) {
      await this.rest.upload("POST", `/interactions/${this.id}/${this.token}/callback`, {
        type: InteractionResponseType.ChannelMessageWithSource,
        data,
      }, opts.files);
    } else {
      await this.rest.post(`/interactions/${this.id}/${this.token}/callback`, {
        type: InteractionResponseType.ChannelMessageWithSource,
        data,
      });
    }
    this.replied = true;
  }

  /** Tell Discord "I'm thinking" (15-min window). */
  async defer(opts: { ephemeral?: boolean } = {}): Promise<void> {
    if (this.replied || this.deferred) return;
    await this.rest.post(`/interactions/${this.id}/${this.token}/callback`, {
      type: InteractionResponseType.DeferredChannelMessageWithSource,
      data: { flags: opts.ephemeral ? 64 : 0 },
    });
    this.deferred = true;
  }

  /** Edit the original (initial) reply. */
  async editReply(input: string | InteractionReplyOptions): Promise<Message> {
    const opts = typeof input === "string" ? { content: input } : input;
    const body = this.buildData(opts);
    let raw: RawMessage;
    if (opts.files && opts.files.length > 0) {
      raw = await this.rest.upload<RawMessage>(
        "PATCH",
        `/webhooks/${this.applicationId}/${this.token}/messages/@original`,
        body,
        opts.files,
      );
    } else {
      raw = await this.rest.patch<RawMessage>(
        `/webhooks/${this.applicationId}/${this.token}/messages/@original`,
        body,
      );
    }
    return new Message(raw, this.rest);
  }

  /** Delete the original reply. */
  async deleteReply(): Promise<void> {
    await this.rest.delete(`/webhooks/${this.applicationId}/${this.token}/messages/@original`);
  }

  /** Send another message after the initial reply. */
  async followup(input: string | InteractionReplyOptions): Promise<Message> {
    const opts = typeof input === "string" ? { content: input } : input;
    const body = this.buildData(opts);
    let raw: RawMessage;
    if (opts.files && opts.files.length > 0) {
      raw = await this.rest.upload<RawMessage>("POST", `/webhooks/${this.applicationId}/${this.token}`, body, opts.files);
    } else {
      raw = await this.rest.post<RawMessage>(`/webhooks/${this.applicationId}/${this.token}`, body);
    }
    return new Message(raw, this.rest);
  }

  /** Show a modal (only valid as the FIRST response to an interaction). */
  async showModal(modal: ModalDef): Promise<void> {
    if (this.replied || this.deferred) throw new Error("modal must be the first response");
    await this.rest.post(`/interactions/${this.id}/${this.token}/callback`, {
      type: InteractionResponseType.Modal,
      data: buildModalPayload(modal),
    });
    this.replied = true;
  }

  protected buildData(o: InteractionReplyOptions): Record<string, unknown> {
    let flags = o.flags ?? 0;
    if (o.ephemeral) flags |= 64;
    if (o.suppressEmbeds) flags |= 4;
    if (o.componentsV2) flags |= 1 << 15;
    const data: Record<string, unknown> = {
      content: o.componentsV2 ? undefined : o.content,
      embeds: o.componentsV2 ? undefined : o.embeds,
      components: o.components,
      tts: o.tts,
      flags: flags || undefined,
      allowed_mentions: o.allowedMentions ?? (o.silentMentions !== false ? { parse: [] } : undefined),
    };
    if (o.poll) {
      data.poll = {
        question: { text: o.poll.question },
        answers: o.poll.answers.map((a) => {
          const ans = typeof a === "string" ? { text: a } : a;
          return { poll_media: { text: ans.text, emoji: ans.emoji ? (typeof ans.emoji === "string" ? { name: ans.emoji } : ans.emoji) : undefined } };
        }),
        duration: o.poll.durationHours ?? 24,
        allow_multiselect: !!o.poll.allowMultiselect,
        layout_type: 1,
      };
    }
    return data;
  }

  /**
   * Stream a token stream into the deferred reply. Auto-defers if not deferred.
   * Edits the message every ~750ms to avoid rate limits.
   */
  async streamReply(
    stream: AsyncIterable<string>,
    opts: { intervalMs?: number; ephemeral?: boolean; prefix?: string; suffix?: string } = {},
  ): Promise<Message> {
    if (!this.deferred && !this.replied) await this.defer({ ephemeral: opts.ephemeral });
    const interval = opts.intervalMs ?? 750;
    let buf = "";
    let last = 0;
    let pending: Promise<unknown> | null = null;
    const wrap = (s: string) => `${opts.prefix ?? ""}${s || "…"}${opts.suffix ?? ""}`;
    const editOnce = async () => {
      if (pending) await pending;
      pending = this.editReply({ content: wrap(buf) });
      await pending;
      pending = null;
      last = Date.now();
    };
    for await (const chunk of stream) {
      buf += chunk;
      if (Date.now() - last > interval) await editOnce();
    }
    return await this.editReply({ content: wrap(buf) });
  }
}

// ── Slash command (chat input) ────────────────────────────────────────────

export class ChatInputCtx extends BaseInteraction {
  readonly commandName: string;
  /** Subcommand path, e.g. ["group", "sub"] or ["sub"] or [] */
  readonly subcommandPath: string[];
  private optMap: Map<string, RawInteractionOption>;
  private resolved: NonNullable<RawInteraction["data"]>["resolved"];

  constructor(raw: RawInteraction, rest: Rest) {
    super(raw, rest);
    this.commandName = raw.data?.name ?? "";
    this.resolved = raw.data?.resolved;

    // Walk into subcommand groups/subcommands for option lookup
    const path: string[] = [];
    let cursor: RawInteractionOption[] = raw.data?.options ?? [];
    while (cursor.length === 1 && (cursor[0]!.type === 1 || cursor[0]!.type === 2)) {
      path.push(cursor[0]!.name);
      cursor = cursor[0]!.options ?? [];
    }
    this.subcommandPath = path;
    this.optMap = new Map(cursor.map((o) => [o.name, o]));
  }

  /** Full command path, e.g. "settings.notifications.toggle". */
  get fullPath(): string {
    return [this.commandName, ...this.subcommandPath].join(".");
  }

  opt<T = string | number | boolean>(name: string): T | undefined {
    return this.optMap.get(name)?.value as T | undefined;
  }

  optString(name: string): string | undefined {
    const v = this.opt(name);
    return typeof v === "string" ? v : undefined;
  }
  optInt(name: string): number | undefined {
    const v = this.opt(name);
    return typeof v === "number" ? v : undefined;
  }
  optBool(name: string): boolean | undefined {
    const v = this.opt(name);
    return typeof v === "boolean" ? v : undefined;
  }

  /** Resolve a User option. */
  optUser(name: string): User | undefined {
    const v = this.optMap.get(name)?.value;
    if (typeof v !== "string") return undefined;
    const u = this.resolved?.users?.[v];
    return u ? new User(u, this.rest) : undefined;
  }

  /** Resolve a Member option (returns Member if available, otherwise null). */
  optMember(name: string): GuildMember | null {
    const v = this.optMap.get(name)?.value;
    if (typeof v !== "string" || !this.guildId) return null;
    const m = this.resolved?.members?.[v];
    const u = this.resolved?.users?.[v];
    if (!m || !u) return null;
    return new GuildMember({ ...m, user: u }, this.guildId, this.rest);
  }

  /** Resolve a Role option (id only — fetch separately if you need full object). */
  optRoleId(name: string): string | undefined {
    const v = this.optMap.get(name)?.value;
    return typeof v === "string" ? v : undefined;
  }

  /** Resolve a Channel option id. */
  optChannelId(name: string): string | undefined {
    const v = this.optMap.get(name)?.value;
    return typeof v === "string" ? v : undefined;
  }

  /** Resolve an Attachment option. */
  optAttachment(name: string): { id: string; url: string; filename: string; size: number } | undefined {
    const v = this.optMap.get(name)?.value;
    if (typeof v !== "string") return undefined;
    return this.resolved?.attachments?.[v];
  }
}

// ── User context menu ────────────────────────────────────────────────────

export class UserCtx extends BaseInteraction {
  readonly commandName: string;
  readonly target: User;
  readonly targetMember: GuildMember | null;

  constructor(raw: RawInteraction, rest: Rest) {
    super(raw, rest);
    this.commandName = raw.data?.name ?? "";
    const targetId = raw.data?.target_id ?? "";
    const u = raw.data?.resolved?.users?.[targetId];
    this.target = u ? new User(u, rest) : new User({ id: targetId, username: "unknown", discriminator: "0" }, rest);
    const m = raw.data?.resolved?.members?.[targetId];
    this.targetMember = m && raw.guild_id && u ? new GuildMember({ ...m, user: u }, raw.guild_id, rest) : null;
  }
}

// ── Message context menu ─────────────────────────────────────────────────

export class MessageCtx extends BaseInteraction {
  readonly commandName: string;
  readonly target: Message;

  constructor(raw: RawInteraction, rest: Rest) {
    super(raw, rest);
    this.commandName = raw.data?.name ?? "";
    const targetId = raw.data?.target_id ?? "";
    const m = raw.data?.resolved?.messages?.[targetId];
    if (!m) throw new Error("message context menu without resolved message");
    this.target = new Message(m, rest);
  }
}

// ── Component (button / select) ──────────────────────────────────────────

export class ComponentCtx extends BaseInteraction {
  readonly customId: string;
  readonly componentType: number;
  /** Selected values (string select / user select / etc.). */
  readonly values: string[];
  readonly message: Message | null;

  constructor(raw: RawInteraction, rest: Rest) {
    super(raw, rest);
    this.customId = raw.data?.custom_id ?? "";
    this.componentType = raw.data?.component_type ?? 0;
    this.values = raw.data?.values ?? [];
    this.message = raw.message ? new Message(raw.message, rest) : null;
  }

  /** Replace the original message that triggered the component (instead of sending a new reply). */
  async update(input: string | InteractionReplyOptions): Promise<void> {
    const opts = typeof input === "string" ? { content: input } : input;
    if (this.replied || this.deferred) {
      await this.editReply(opts);
      return;
    }
    await this.rest.post(`/interactions/${this.id}/${this.token}/callback`, {
      type: InteractionResponseType.UpdateMessage,
      data: this.buildData(opts),
    });
    this.replied = true;
  }

  /** Defer the update (no visible "thinking…"). Use when you're updating later. */
  async deferUpdate(): Promise<void> {
    if (this.replied || this.deferred) return;
    await this.rest.post(`/interactions/${this.id}/${this.token}/callback`, {
      type: InteractionResponseType.DeferredUpdateMessage,
    });
    this.deferred = true;
  }

  isButton(): boolean {
    return this.componentType === ComponentType.Button;
  }
  isSelect(): boolean {
    return [ComponentType.StringSelect, ComponentType.UserSelect, ComponentType.RoleSelect, ComponentType.MentionableSelect, ComponentType.ChannelSelect].includes(this.componentType as 3);
  }
}

// ── Modal submit ─────────────────────────────────────────────────────────

export class ModalCtx extends BaseInteraction {
  readonly customId: string;
  readonly fields: Map<string, string>;
  readonly message: Message | null;

  constructor(raw: RawInteraction, rest: Rest) {
    super(raw, rest);
    this.customId = raw.data?.custom_id ?? "";
    this.message = raw.message ? new Message(raw.message, rest) : null;
    this.fields = new Map();
    for (const row of raw.data?.components ?? []) {
      for (const c of row.components ?? []) {
        if (c.custom_id && typeof c.value === "string") this.fields.set(c.custom_id, c.value);
      }
    }
  }

  field(customId: string): string | undefined {
    return this.fields.get(customId);
  }
}

// ── Autocomplete ─────────────────────────────────────────────────────────

export class AutocompleteCtx {
  readonly id: string;
  readonly token: string;
  readonly applicationId: string;
  readonly commandName: string;
  readonly subcommandPath: string[];
  readonly focused: { name: string; value: string };
  readonly raw: RawInteraction;
  private rest: Rest;

  constructor(raw: RawInteraction, rest: Rest) {
    this.raw = raw;
    this.rest = rest;
    this.id = raw.id;
    this.token = raw.token;
    this.applicationId = raw.application_id;
    this.commandName = raw.data?.name ?? "";

    const path: string[] = [];
    let cursor: RawInteractionOption[] = raw.data?.options ?? [];
    while (cursor.length === 1 && (cursor[0]!.type === 1 || cursor[0]!.type === 2)) {
      path.push(cursor[0]!.name);
      cursor = cursor[0]!.options ?? [];
    }
    this.subcommandPath = path;
    const f = cursor.find((o) => o.focused);
    this.focused = { name: f?.name ?? "", value: String(f?.value ?? "") };
  }

  get fullPath(): string {
    return [this.commandName, ...this.subcommandPath].join(".");
  }

  /** Reply with up to 25 suggestions. */
  async respond(choices: { name: string; value: string | number }[]): Promise<void> {
    await this.rest.post(`/interactions/${this.id}/${this.token}/callback`, {
      type: InteractionResponseType.ApplicationCommandAutocompleteResult,
      data: { choices: choices.slice(0, 25) },
    });
  }
}

// Backwards-compat alias.
export { ChatInputCtx as InteractionCtx };
