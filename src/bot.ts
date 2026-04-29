// Bot — the entry point. Aim: one class, predictable methods, all features
// one method-call deep.
//
//   const bot = new Bot(token);
//   bot.on("message", m => m.reply("hi"));
//   bot.command("ping", { description: "ping" }, ctx => ctx.reply("pong"));
//   bot.button("upvote", ctx => ctx.update("thanks"));
//   await bot.start();

import { AppEmojis } from "./app-emojis.js";
import { AutoMod } from "./automod.js";
import { Cache } from "./cache.js";
import { Channel } from "./channel.js";
import { Debugger } from "./debug.js";
import { Entitlements, RoleConnectionMetadata, Skus } from "./entitlements.js";
import { Gateway } from "./gateway.js";
import { Guild, GuildMember } from "./guild.js";
import { DefaultIntents } from "./intents.js";
import { Soundboard } from "./soundboard.js";
import { StageInstances } from "./stage.js";
import { fetchStickerPacks } from "./stickers.js";
import type { StickerPack } from "./stickers.js";
import { Templates } from "./templates.js";
import type { GuildTemplate } from "./templates.js";
import {
  AutocompleteCtx,
  ChatInputCtx,
  ComponentCtx,
  MessageCtx,
  ModalCtx,
  UserCtx,
} from "./interactions.js";
import { Message } from "./message.js";
import { Rest } from "./rest.js";
import { Role, User } from "./structures.js";
import {
  ApplicationCommandType,
  CommandDef,
  CommandOption,
  ChannelType,
  InteractionType,
  MessageCommandDef,
  Op,
  OptionType,
  RawApplication,
  RawChannel,
  RawGuild,
  RawInteraction,
  RawMember,
  RawMessage,
  RawPresence,
  RawReady,
  RawRole,
  RawUser,
  RawVoiceState,
  UserCommandDef,
} from "./types.js";

export interface BotOptions {
  intents?: number;
  apiUrl?: string;
  gatewayUrl?: string;
  /** [shardId, totalShards] for sharding. */
  shard?: [number, number];
  /** Auto-start cache. */
  cache?: boolean;
  /** Initial presence: status + activity. */
  presence?: PresenceUpdate;
  /** Enable the debug logger (events + REST timing). */
  debug?: boolean;
}

export interface PresenceUpdate {
  status?: "online" | "idle" | "dnd" | "invisible";
  activities?: { name: string; type?: 0 | 1 | 2 | 3 | 4 | 5; url?: string; state?: string }[];
  afk?: boolean;
  since?: number | null;
}

export type CommandHandler = (ctx: ChatInputCtx) => unknown | Promise<unknown>;
export type UserCommandHandler = (ctx: UserCtx) => unknown | Promise<unknown>;
export type MessageCommandHandler = (ctx: MessageCtx) => unknown | Promise<unknown>;
export type ComponentHandler = (ctx: ComponentCtx) => unknown | Promise<unknown>;
export type ModalHandler = (ctx: ModalCtx) => unknown | Promise<unknown>;
export type AutocompleteHandler = (ctx: AutocompleteCtx) => unknown | Promise<unknown>;

interface RegisteredCommand {
  type: 1 | 2 | 3;
  name: string;
  def: CommandDef | UserCommandDef | MessageCommandDef;
  handler?: CommandHandler | UserCommandHandler | MessageCommandHandler;
  /** Slash subcommand handlers keyed by "sub" or "group.sub". */
  subHandlers?: Map<string, CommandHandler>;
  /** Per-option autocomplete handlers, keyed by "optName" or "sub.optName". */
  autocomplete?: Map<string, AutocompleteHandler>;
}

// ── Strongly typed event map ───────────────────────────────────────────────

export interface BotEvents {
  ready: (me: User) => void;
  resumed: () => void;
  close: (info: { code: number; reason: string }) => void;
  error: (err: unknown) => void;

  message: (msg: Message) => void;
  messageUpdate: (msg: Message) => void;
  messageDelete: (info: { id: string; channelId: string; guildId?: string }) => void;
  messageDeleteBulk: (info: { ids: string[]; channelId: string; guildId?: string }) => void;

  messageReactionAdd: (info: { messageId: string; channelId: string; guildId?: string; userId: string; emoji: { id: string | null; name: string | null; animated: boolean } }) => void;
  messageReactionRemove: (info: { messageId: string; channelId: string; guildId?: string; userId: string; emoji: { id: string | null; name: string | null; animated: boolean } }) => void;
  messageReactionRemoveAll: (info: { messageId: string; channelId: string; guildId?: string }) => void;

  interaction: (ctx: ChatInputCtx | UserCtx | MessageCtx | ComponentCtx | ModalCtx) => void;

  guildCreate: (guild: Guild) => void;
  guildUpdate: (guild: Guild) => void;
  guildDelete: (info: { id: string; unavailable?: boolean }) => void;

  guildMemberAdd: (member: GuildMember) => void;
  guildMemberUpdate: (member: GuildMember) => void;
  guildMemberRemove: (info: { user: User; guildId: string }) => void;

  channelCreate: (channel: Channel) => void;
  channelUpdate: (channel: Channel) => void;
  channelDelete: (channel: Channel) => void;
  channelPinsUpdate: (info: { channelId: string; guildId?: string; lastPinTimestamp?: string }) => void;

  threadCreate: (thread: Channel) => void;
  threadUpdate: (thread: Channel) => void;
  threadDelete: (info: { id: string; channelId: string; guildId: string; type: number }) => void;

  roleCreate: (role: Role) => void;
  roleUpdate: (role: Role) => void;
  roleDelete: (info: { roleId: string; guildId: string }) => void;

  typingStart: (info: { channelId: string; guildId?: string; userId: string; timestamp: number }) => void;

  presenceUpdate: (presence: RawPresence) => void;
  voiceStateUpdate: (state: RawVoiceState) => void;

  inviteCreate: (info: { code: string; channelId: string; guildId?: string }) => void;
  inviteDelete: (info: { code: string; channelId: string; guildId?: string }) => void;

  // Auto-mod
  autoModRuleCreate: (rule: unknown) => void;
  autoModRuleUpdate: (rule: unknown) => void;
  autoModRuleDelete: (rule: unknown) => void;
  autoModActionExecute: (info: {
    guildId: string;
    action: { type: number; metadata?: Record<string, unknown> };
    ruleId: string;
    ruleTriggerType: number;
    userId: string;
    channelId?: string;
    messageId?: string;
    content?: string;
    matchedKeyword?: string;
    matchedContent?: string;
  }) => void;

  // Polls
  pollVoteAdd: (info: { messageId: string; channelId: string; guildId?: string; userId: string; answerId: number }) => void;
  pollVoteRemove: (info: { messageId: string; channelId: string; guildId?: string; userId: string; answerId: number }) => void;

  // Entitlements / monetization
  entitlementCreate: (entitlement: unknown) => void;
  entitlementUpdate: (entitlement: unknown) => void;
  entitlementDelete: (entitlement: unknown) => void;

  // Stage instances
  stageInstanceCreate: (stage: unknown) => void;
  stageInstanceUpdate: (stage: unknown) => void;
  stageInstanceDelete: (stage: unknown) => void;

  // Audit log entries (created live)
  guildAuditLogEntryCreate: (entry: unknown) => void;

  // Guild integrations (Twitch/YouTube/app subscriptions)
  integrationCreate: (info: { guildId: string; integration: unknown }) => void;
  integrationUpdate: (info: { guildId: string; integration: unknown }) => void;
  integrationDelete: (info: { id: string; guildId: string; applicationId?: string }) => void;

  /** Raw catch-all for events Supa.js doesn't wrap. */
  raw: (event: string, data: unknown) => void;
}

type Listener<E extends keyof BotEvents> = BotEvents[E];

export class Bot {
  readonly rest: Rest;
  readonly gateway: Gateway;
  readonly cache = new Cache();
  readonly debug: Debugger;
  readonly emojis: AppEmojis;
  readonly soundboard: Soundboard;
  readonly stages: StageInstances;
  readonly entitlements: Entitlements;
  readonly skus: Skus;
  readonly roleConnections: RoleConnectionMetadata;
  readonly templates: Templates;

  me?: User;
  applicationId?: string;
  shard?: [number, number];

  private intents: number;
  private listeners = new Map<keyof BotEvents, Set<Function>>();
  private commands = new Map<string, RegisteredCommand>();
  private buttonHandlers = new Map<string | RegExp, ComponentHandler>();
  private selectHandlers = new Map<string | RegExp, ComponentHandler>();
  private modalHandlers = new Map<string | RegExp, ModalHandler>();
  private presence?: PresenceUpdate;

  constructor(token: string, opts: BotOptions = {}) {
    if (!token) throw new Error("Supa.js: token is required");
    this.intents = opts.intents ?? DefaultIntents;
    this.shard = opts.shard;
    this.presence = opts.presence;
    this.rest = new Rest({ token, baseUrl: opts.apiUrl });
    this.gateway = new Gateway({
      token,
      intents: this.intents,
      url: opts.gatewayUrl,
      shard: opts.shard,
      presence: opts.presence,
    });
    if (opts.cache) this.cache.enable();

    this.emojis = new AppEmojis(() => this.applicationId ?? "", this.rest);
    this.soundboard = new Soundboard(this.rest);
    this.stages = new StageInstances(this.rest);
    this.entitlements = new Entitlements(() => this.applicationId ?? "", this.rest);
    this.skus = new Skus(() => this.applicationId ?? "", this.rest);
    this.roleConnections = new RoleConnectionMetadata(() => this.applicationId ?? "", this.rest);
    this.templates = new Templates(this.rest);
    this.debug = new Debugger(this, !!opts.debug);

    this.gateway.on("dispatch", (t: string, d: unknown) => this.dispatch(t, d));
    this.gateway.on("error", (e: unknown) => this.emit("error", e));
    this.gateway.on("close", (i: { code: number; reason: string }) => this.emit("close", i));
    this.gateway.on("fatal", (i: { code: number; reason: string }) => {
      this.emit("error", new Error(`gateway fatal ${i.code}: ${i.reason}`));
    });
  }

  // ── Events ─────────────────────────────────────────────────────────────

  on<E extends keyof BotEvents>(event: E, fn: Listener<E>): this {
    let set = this.listeners.get(event);
    if (!set) {
      set = new Set();
      this.listeners.set(event, set);
    }
    set.add(fn as Function);
    return this;
  }

  off<E extends keyof BotEvents>(event: E, fn: Listener<E>): this {
    this.listeners.get(event)?.delete(fn as Function);
    return this;
  }

  once<E extends keyof BotEvents>(event: E, fn: Listener<E>): this {
    const wrapper = ((...args: unknown[]) => {
      this.off(event, wrapper as never);
      (fn as (...a: unknown[]) => unknown)(...args);
    }) as Listener<E>;
    return this.on(event, wrapper);
  }

  private emit<E extends keyof BotEvents>(event: E, ...args: Parameters<Listener<E>>): void {
    const set = this.listeners.get(event);
    if (!set) return;
    for (const fn of set) {
      try {
        (fn as (...a: unknown[]) => unknown)(...args);
      } catch (err) {
        if (event !== "error") this.emit("error", err);
      }
    }
  }

  // ── Command registration ───────────────────────────────────────────────

  /** Register a chat-input (slash) command. Supports subcommands via dotted names. */
  command(name: string, def: CommandDef, handler: CommandHandler): this {
    // dotted name = subcommand or subcommand-group
    if (name.includes(".")) {
      const [top, ...rest] = name.split(".");
      let parent = this.commands.get(top!);
      if (!parent) {
        parent = {
          type: ApplicationCommandType.ChatInput,
          name: top!,
          def: { description: def.description, options: [], guildId: def.guildId, defaultPermissions: def.defaultPermissions, dmPermission: def.dmPermission, nsfw: def.nsfw },
          subHandlers: new Map(),
          autocomplete: new Map(),
        };
        this.commands.set(top!, parent);
      }
      parent.subHandlers = parent.subHandlers ?? new Map();
      parent.subHandlers.set(rest.join("."), handler);
      // A command with subcommands cannot also have a top-level handler/options.
      parent.handler = undefined;
      const parentDef = parent.def as CommandDef;
      // Strip any non-subcommand options that were leftover from a prior top-level registration.
      parentDef.options = (parentDef.options ?? []).filter((o) => {
        const t = typeof o.type === "number" ? o.type : OptionType[o.type];
        return t === OptionType.SubCommand || t === OptionType.SubCommandGroup;
      });
      addSubcommandToOptions(parentDef, rest, def);
      return this;
    }

    if (this.commands.has(name)) throw new Error(`Supa.js: command "${name}" already registered`);
    this.commands.set(name, {
      type: ApplicationCommandType.ChatInput,
      name,
      def,
      handler,
      autocomplete: new Map(),
    });
    return this;
  }

  /** Register a User context-menu command (right-click on a user → Apps). */
  userCommand(name: string, def: UserCommandDef, handler: UserCommandHandler): this {
    if (this.commands.has(name)) throw new Error(`Supa.js: command "${name}" already registered`);
    this.commands.set(name, { type: ApplicationCommandType.User, name, def, handler });
    return this;
  }

  /** Register a Message context-menu command (right-click on a message → Apps). */
  messageCommand(name: string, def: MessageCommandDef, handler: MessageCommandHandler): this {
    if (this.commands.has(name)) throw new Error(`Supa.js: command "${name}" already registered`);
    this.commands.set(name, { type: ApplicationCommandType.Message, name, def, handler });
    return this;
  }

  /**
   * Register an autocomplete handler.
   * `key` = "command:option" or "command.sub:option" or "command.group.sub:option"
   */
  autocomplete(key: string, handler: AutocompleteHandler): this {
    const [path, optName] = key.split(":");
    if (!path || !optName) throw new Error(`autocomplete key must be "command:option"`);
    const top = path.split(".")[0]!;
    const cmd = this.commands.get(top);
    if (!cmd) throw new Error(`autocomplete: command "${top}" not registered`);
    cmd.autocomplete = cmd.autocomplete ?? new Map();
    cmd.autocomplete.set(`${path}:${optName}`, handler);
    return this;
  }

  /** Register a button handler. customId can be string OR RegExp. */
  button(customId: string | RegExp, handler: ComponentHandler): this {
    this.buttonHandlers.set(customId, handler);
    return this;
  }

  /** Register a select-menu handler. */
  select(customId: string | RegExp, handler: ComponentHandler): this {
    this.selectHandlers.set(customId, handler);
    return this;
  }

  /** Register a modal-submit handler. */
  modal(customId: string | RegExp, handler: ModalHandler): this {
    this.modalHandlers.set(customId, handler);
    return this;
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────

  async start(): Promise<void> {
    this.gateway.connect();
    await new Promise<void>((resolve) => {
      const onReady = () => {
        this.off("ready", onReady);
        resolve();
      };
      this.on("ready", onReady);
    });
    await this.deployCommands();
  }

  stop(): void {
    this.gateway.close();
  }

  /** Update the bot's presence at runtime. */
  setPresence(p: PresenceUpdate): void {
    this.presence = p;
    this.gateway.send(Op.PresenceUpdate, {
      since: p.since ?? null,
      activities: p.activities ?? [],
      status: p.status ?? "online",
      afk: p.afk ?? false,
    });
  }

  // ── Convenience fetchers ───────────────────────────────────────────────

  async fetchUser(id: string): Promise<User> {
    const raw = await this.rest.get<RawUser>(`/users/${id}`);
    const u = new User(raw, this.rest);
    if (this.cache.enabled) this.cache.users.set(id, u);
    return u;
  }

  async fetchGuild(id: string): Promise<Guild> {
    const raw = await this.rest.get<RawGuild>(`/guilds/${id}`);
    const g = new Guild(raw, this.rest);
    if (this.cache.enabled) this.cache.guilds.set(id, g);
    return g;
  }

  async fetchChannel(id: string): Promise<Channel> {
    const raw = await this.rest.get<RawChannel>(`/channels/${id}`);
    const c = new Channel(raw, this.rest);
    if (this.cache.enabled) this.cache.channels.set(id, c);
    return c;
  }

  // ── Internals ──────────────────────────────────────────────────────────

  private dispatch(t: string, d: unknown): void {
    this.emit("raw", t, d);

    switch (t) {
      case "READY": {
        const r = d as RawReady;
        this.me = new User(r.user, this.rest);
        this.applicationId = r.application.id;
        this.emit("ready", this.me);
        return;
      }
      case "RESUMED":
        this.emit("resumed");
        return;

      // Messages
      case "MESSAGE_CREATE": {
        const raw = d as RawMessage;
        if (raw.author?.bot) return;
        const m = new Message(raw, this.rest);
        if (this.cache.enabled) this.cache.messages.set(m.id, m);
        this.emit("message", m);
        return;
      }
      case "MESSAGE_UPDATE": {
        const raw = d as RawMessage;
        if (!raw.author) return; // partial — caller can use bot.cache or raw event
        this.emit("messageUpdate", new Message(raw, this.rest));
        return;
      }
      case "MESSAGE_DELETE": {
        const r = d as { id: string; channel_id: string; guild_id?: string };
        this.emit("messageDelete", { id: r.id, channelId: r.channel_id, guildId: r.guild_id });
        return;
      }
      case "MESSAGE_DELETE_BULK": {
        const r = d as { ids: string[]; channel_id: string; guild_id?: string };
        this.emit("messageDeleteBulk", { ids: r.ids, channelId: r.channel_id, guildId: r.guild_id });
        return;
      }

      // Reactions
      case "MESSAGE_REACTION_ADD": {
        const r = d as { message_id: string; channel_id: string; guild_id?: string; user_id: string; emoji: { id: string | null; name: string | null; animated?: boolean } };
        this.emit("messageReactionAdd", { messageId: r.message_id, channelId: r.channel_id, guildId: r.guild_id, userId: r.user_id, emoji: { id: r.emoji.id, name: r.emoji.name, animated: !!r.emoji.animated } });
        return;
      }
      case "MESSAGE_REACTION_REMOVE": {
        const r = d as { message_id: string; channel_id: string; guild_id?: string; user_id: string; emoji: { id: string | null; name: string | null; animated?: boolean } };
        this.emit("messageReactionRemove", { messageId: r.message_id, channelId: r.channel_id, guildId: r.guild_id, userId: r.user_id, emoji: { id: r.emoji.id, name: r.emoji.name, animated: !!r.emoji.animated } });
        return;
      }
      case "MESSAGE_REACTION_REMOVE_ALL": {
        const r = d as { message_id: string; channel_id: string; guild_id?: string };
        this.emit("messageReactionRemoveAll", { messageId: r.message_id, channelId: r.channel_id, guildId: r.guild_id });
        return;
      }

      // Interactions
      case "INTERACTION_CREATE":
        return this.handleInteraction(d as RawInteraction);

      // Guilds
      case "GUILD_CREATE": {
        const g = new Guild(d as RawGuild, this.rest);
        if (this.cache.enabled) this.cache.guilds.set(g.id, g);
        this.emit("guildCreate", g);
        return;
      }
      case "GUILD_UPDATE": {
        const g = new Guild(d as RawGuild, this.rest);
        if (this.cache.enabled) this.cache.guilds.set(g.id, g);
        this.emit("guildUpdate", g);
        return;
      }
      case "GUILD_DELETE": {
        const r = d as { id: string; unavailable?: boolean };
        if (this.cache.enabled) this.cache.guilds.delete(r.id);
        this.emit("guildDelete", r);
        return;
      }

      // Members
      case "GUILD_MEMBER_ADD": {
        const r = d as RawMember & { guild_id: string };
        const m = new GuildMember(r, r.guild_id, this.rest);
        if (this.cache.enabled) this.cache.members.set(Cache.mk(r.guild_id, m.user.id), m);
        this.emit("guildMemberAdd", m);
        return;
      }
      case "GUILD_MEMBER_UPDATE": {
        const r = d as RawMember & { guild_id: string };
        const m = new GuildMember(r, r.guild_id, this.rest);
        if (this.cache.enabled) this.cache.members.set(Cache.mk(r.guild_id, m.user.id), m);
        this.emit("guildMemberUpdate", m);
        return;
      }
      case "GUILD_MEMBER_REMOVE": {
        const r = d as { guild_id: string; user: RawUser };
        if (this.cache.enabled) this.cache.members.delete(Cache.mk(r.guild_id, r.user.id));
        this.emit("guildMemberRemove", { user: new User(r.user, this.rest), guildId: r.guild_id });
        return;
      }

      // Channels
      case "CHANNEL_CREATE":
      case "CHANNEL_UPDATE":
      case "CHANNEL_DELETE": {
        const c = new Channel(d as RawChannel, this.rest);
        if (this.cache.enabled) {
          if (t === "CHANNEL_DELETE") this.cache.channels.delete(c.id);
          else this.cache.channels.set(c.id, c);
        }
        this.emit(
          t === "CHANNEL_CREATE" ? "channelCreate" : t === "CHANNEL_UPDATE" ? "channelUpdate" : "channelDelete",
          c,
        );
        return;
      }
      case "CHANNEL_PINS_UPDATE": {
        const r = d as { channel_id: string; guild_id?: string; last_pin_timestamp?: string };
        this.emit("channelPinsUpdate", { channelId: r.channel_id, guildId: r.guild_id, lastPinTimestamp: r.last_pin_timestamp });
        return;
      }

      // Threads
      case "THREAD_CREATE":
      case "THREAD_UPDATE": {
        const c = new Channel(d as RawChannel, this.rest);
        this.emit(t === "THREAD_CREATE" ? "threadCreate" : "threadUpdate", c);
        return;
      }
      case "THREAD_DELETE": {
        const r = d as { id: string; parent_id: string; guild_id: string; type: number };
        this.emit("threadDelete", { id: r.id, channelId: r.parent_id, guildId: r.guild_id, type: r.type });
        return;
      }

      // Roles
      case "GUILD_ROLE_CREATE":
      case "GUILD_ROLE_UPDATE": {
        const r = d as { guild_id: string; role: RawRole };
        const role = new Role(r.role, r.guild_id, this.rest);
        if (this.cache.enabled) this.cache.roles.set(role.id, role);
        this.emit(t === "GUILD_ROLE_CREATE" ? "roleCreate" : "roleUpdate", role);
        return;
      }
      case "GUILD_ROLE_DELETE": {
        const r = d as { guild_id: string; role_id: string };
        if (this.cache.enabled) this.cache.roles.delete(r.role_id);
        this.emit("roleDelete", { roleId: r.role_id, guildId: r.guild_id });
        return;
      }

      // Misc
      case "TYPING_START": {
        const r = d as { channel_id: string; guild_id?: string; user_id: string; timestamp: number };
        this.emit("typingStart", { channelId: r.channel_id, guildId: r.guild_id, userId: r.user_id, timestamp: r.timestamp });
        return;
      }
      case "PRESENCE_UPDATE":
        this.emit("presenceUpdate", d as RawPresence);
        return;
      case "VOICE_STATE_UPDATE":
        this.emit("voiceStateUpdate", d as RawVoiceState);
        return;

      case "INVITE_CREATE": {
        const r = d as { code: string; channel_id: string; guild_id?: string };
        this.emit("inviteCreate", { code: r.code, channelId: r.channel_id, guildId: r.guild_id });
        return;
      }
      case "INVITE_DELETE": {
        const r = d as { code: string; channel_id: string; guild_id?: string };
        this.emit("inviteDelete", { code: r.code, channelId: r.channel_id, guildId: r.guild_id });
        return;
      }

      // Auto-mod
      case "AUTO_MODERATION_RULE_CREATE":
        this.emit("autoModRuleCreate", d);
        return;
      case "AUTO_MODERATION_RULE_UPDATE":
        this.emit("autoModRuleUpdate", d);
        return;
      case "AUTO_MODERATION_RULE_DELETE":
        this.emit("autoModRuleDelete", d);
        return;
      case "AUTO_MODERATION_ACTION_EXECUTION": {
        const r = d as {
          guild_id: string;
          action: { type: number; metadata?: Record<string, unknown> };
          rule_id: string;
          rule_trigger_type: number;
          user_id: string;
          channel_id?: string;
          message_id?: string;
          content?: string;
          matched_keyword?: string;
          matched_content?: string;
        };
        this.emit("autoModActionExecute", {
          guildId: r.guild_id, action: r.action, ruleId: r.rule_id, ruleTriggerType: r.rule_trigger_type,
          userId: r.user_id, channelId: r.channel_id, messageId: r.message_id,
          content: r.content, matchedKeyword: r.matched_keyword, matchedContent: r.matched_content,
        });
        return;
      }

      // Polls
      case "MESSAGE_POLL_VOTE_ADD":
      case "MESSAGE_POLL_VOTE_REMOVE": {
        const r = d as { user_id: string; channel_id: string; message_id: string; guild_id?: string; answer_id: number };
        this.emit(t === "MESSAGE_POLL_VOTE_ADD" ? "pollVoteAdd" : "pollVoteRemove", {
          messageId: r.message_id, channelId: r.channel_id, guildId: r.guild_id,
          userId: r.user_id, answerId: r.answer_id,
        });
        return;
      }

      // Entitlements / monetization
      case "ENTITLEMENT_CREATE":
        this.emit("entitlementCreate", d); return;
      case "ENTITLEMENT_UPDATE":
        this.emit("entitlementUpdate", d); return;
      case "ENTITLEMENT_DELETE":
        this.emit("entitlementDelete", d); return;

      // Stage instances
      case "STAGE_INSTANCE_CREATE":
        this.emit("stageInstanceCreate", d); return;
      case "STAGE_INSTANCE_UPDATE":
        this.emit("stageInstanceUpdate", d); return;
      case "STAGE_INSTANCE_DELETE":
        this.emit("stageInstanceDelete", d); return;

      // Guild Audit Log entry created (fine-grained moderation events)
      case "GUILD_AUDIT_LOG_ENTRY_CREATE":
        this.emit("guildAuditLogEntryCreate", d); return;

      // Guild integrations
      case "INTEGRATION_CREATE": {
        const r = d as { guild_id: string } & Record<string, unknown>;
        this.emit("integrationCreate", { guildId: r.guild_id, integration: d });
        return;
      }
      case "INTEGRATION_UPDATE": {
        const r = d as { guild_id: string } & Record<string, unknown>;
        this.emit("integrationUpdate", { guildId: r.guild_id, integration: d });
        return;
      }
      case "INTEGRATION_DELETE": {
        const r = d as { id: string; guild_id: string; application_id?: string };
        this.emit("integrationDelete", { id: r.id, guildId: r.guild_id, applicationId: r.application_id });
        return;
      }
    }
  }

  /** Get an AutoMod helper bound to a guild. */
  automod(guildId: string): AutoMod {
    return new AutoMod(guildId, this.rest);
  }

  /** List standard sticker packs (no application/guild scoping needed). */
  fetchStickerPacks(): Promise<StickerPack[]> {
    return fetchStickerPacks(this.rest);
  }

  // ── Application info ────────────────────────────────────────────────────

  /**
   * Fetch this application's metadata (name/description/icon/install params/
   * webhook URLs/etc.). Useful before editing.
   * Source: https://docs.discord.com/developers/resources/application#get-current-application
   */
  fetchApplication(): Promise<RawApplication> {
    return this.rest.get<RawApplication>(`/applications/@me`);
  }

  /**
   * Edit this application's metadata. Pass only the fields you want to change.
   *
   * `icon` / `coverImage` accept a base64 data URI (use `bytesToDataUri()`).
   * Source: https://docs.discord.com/developers/resources/application#edit-current-application
   */
  editApplication(opts: {
    description?: string;
    icon?: string | null;
    coverImage?: string | null;
    flags?: number;
    tags?: string[];
    installParams?: { scopes: string[]; permissions: string };
    integrationTypesConfig?: Record<string, { oauth2_install_params?: { scopes: string[]; permissions: string } }>;
    customInstallUrl?: string | null;
    interactionsEndpointUrl?: string | null;
    roleConnectionsVerificationUrl?: string | null;
    eventWebhooksUrl?: string | null;
    eventWebhooksStatus?: number;
    eventWebhooksTypes?: string[];
  }): Promise<RawApplication> {
    return this.rest.patch<RawApplication>(`/applications/@me`, {
      description: opts.description,
      icon: opts.icon,
      cover_image: opts.coverImage,
      flags: opts.flags,
      tags: opts.tags,
      install_params: opts.installParams,
      integration_types_config: opts.integrationTypesConfig,
      custom_install_url: opts.customInstallUrl,
      interactions_endpoint_url: opts.interactionsEndpointUrl,
      role_connections_verification_url: opts.roleConnectionsVerificationUrl,
      event_webhooks_url: opts.eventWebhooksUrl,
      event_webhooks_status: opts.eventWebhooksStatus,
      event_webhooks_types: opts.eventWebhooksTypes,
    });
  }

  /**
   * Fetch the OAuth2 authorization metadata for a user-granted bearer token
   * (`/oauth2/@me`). Useful when a bot acts on behalf of a user that authorized
   * it via OAuth2 — returns `{ application, scopes, expires, user? }`.
   *
   * NOTE: Pass a USER bearer token, NOT the bot token.
   * Source: https://docs.discord.com/developers/topics/oauth2#get-current-authorization-information
   */
  fetchOwnAuthorization(bearerToken: string): Promise<{
    application: RawApplication;
    scopes: string[];
    expires: string;
    user?: RawUser;
  }> {
    return this.rest.get(`/oauth2/@me`, { Authorization: `Bearer ${bearerToken}` });
  }

  // ── Application command permissions (per-guild) ────────────────────────

  /** List per-guild permissions for ALL of this app's commands. */
  async fetchCommandPermissions(guildId: string): Promise<unknown[]> {
    return this.rest.get<unknown[]>(
      `/applications/${this.applicationId}/guilds/${guildId}/commands/permissions`,
    );
  }

  /** Get permissions for a single command in a guild. */
  async fetchOneCommandPermissions(guildId: string, commandId: string): Promise<unknown> {
    return this.rest.get(
      `/applications/${this.applicationId}/guilds/${guildId}/commands/${commandId}/permissions`,
    );
  }

  /**
   * Set per-command permissions in a guild.
   * NOTE: This endpoint requires a USER bearer token, not a bot token. Pass via `bearerToken`.
   */
  async setCommandPermissions(
    guildId: string,
    commandId: string,
    permissions: { id: string; type: 1 | 2 | 3; permission: boolean }[],
    bearerToken: string,
  ): Promise<unknown> {
    return this.rest.put(
      `/applications/${this.applicationId}/guilds/${guildId}/commands/${commandId}/permissions`,
      { permissions },
      { Authorization: `Bearer ${bearerToken}` },
    );
  }

  private handleInteraction(raw: RawInteraction): void {
    switch (raw.type) {
      case InteractionType.ApplicationCommand: {
        const cmd = this.commands.get(raw.data?.name ?? "");
        if (!cmd) return;
        if (cmd.type === ApplicationCommandType.User) {
          const ctx = new UserCtx(raw, this.rest);
          this.emit("interaction", ctx);
          void this.runHandler(() => (cmd.handler as UserCommandHandler)(ctx), ctx);
          return;
        }
        if (cmd.type === ApplicationCommandType.Message) {
          const ctx = new MessageCtx(raw, this.rest);
          this.emit("interaction", ctx);
          void this.runHandler(() => (cmd.handler as MessageCommandHandler)(ctx), ctx);
          return;
        }
        // ChatInput
        const ctx = new ChatInputCtx(raw, this.rest);
        this.emit("interaction", ctx);
        const subKey = ctx.subcommandPath.join(".");
        const sub = subKey ? cmd.subHandlers?.get(subKey) : undefined;
        const handler = sub ?? (cmd.handler as CommandHandler | undefined);
        if (handler) void this.runHandler(() => handler(ctx), ctx);
        return;
      }
      case InteractionType.MessageComponent: {
        const ctx = new ComponentCtx(raw, this.rest);
        this.emit("interaction", ctx);
        const map = ctx.isButton() ? this.buttonHandlers : this.selectHandlers;
        const handler = matchHandler(map, ctx.customId);
        if (handler) void this.runHandler(() => handler(ctx), ctx);
        return;
      }
      case InteractionType.ApplicationCommandAutocomplete: {
        const ctx = new AutocompleteCtx(raw, this.rest);
        const cmd = this.commands.get(ctx.commandName);
        if (!cmd?.autocomplete) return;
        const key = `${ctx.fullPath}:${ctx.focused.name}`;
        const handler = cmd.autocomplete.get(key);
        if (handler) void this.runHandler(() => handler(ctx), null);
        return;
      }
      case InteractionType.ModalSubmit: {
        const ctx = new ModalCtx(raw, this.rest);
        this.emit("interaction", ctx);
        const handler = matchHandler(this.modalHandlers, ctx.customId);
        if (handler) void this.runHandler(() => handler(ctx), ctx);
        return;
      }
    }
  }

  private async runHandler(fn: () => unknown | Promise<unknown>, ctx: ChatInputCtx | UserCtx | MessageCtx | ComponentCtx | ModalCtx | null): Promise<void> {
    try {
      await fn();
    } catch (err) {
      this.emit("error", err);
      if (ctx && "reply" in ctx) {
        try {
          await (ctx as ChatInputCtx).reply({ content: "Something went wrong.", ephemeral: true });
        } catch {
          // already emitted
        }
      }
    }
  }

  private async deployCommands(): Promise<void> {
    if (this.commands.size === 0 || !this.applicationId) return;
    const byScope = new Map<string | "_global", RegisteredCommand[]>();
    for (const cmd of this.commands.values()) {
      const scope = (cmd.def as CommandDef).guildId ?? "_global";
      const arr = byScope.get(scope) ?? [];
      arr.push(cmd);
      byScope.set(scope, arr);
    }
    for (const [scope, cmds] of byScope) {
      const path = scope === "_global"
        ? `/applications/${this.applicationId}/commands`
        : `/applications/${this.applicationId}/guilds/${scope}/commands`;
      const body = cmds.map(toRawCommand);
      await this.rest.put(path, body);
    }
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function matchHandler<T>(map: Map<string | RegExp, T>, customId: string): T | undefined {
  for (const [k, v] of map) {
    if (typeof k === "string") {
      if (k === customId) return v;
    } else if (k.test(customId)) {
      return v;
    }
  }
  return undefined;
}

function toRawCommand(c: RegisteredCommand): Record<string, unknown> {
  if (c.type === ApplicationCommandType.User || c.type === ApplicationCommandType.Message) {
    const def = c.def as UserCommandDef;
    return {
      type: c.type,
      name: c.name,
      name_localizations: def.localize?.name,
      default_member_permissions: def.defaultPermissions,
      nsfw: def.nsfw,
    };
  }
  const def = c.def as CommandDef;
  return {
    type: ApplicationCommandType.ChatInput,
    name: c.name,
    name_localizations: def.localize?.name,
    description: def.description,
    description_localizations: def.localize?.description,
    options: def.options?.map(toRawOption),
    default_member_permissions: def.defaultPermissions,
    dm_permission: def.dmPermission,
    nsfw: def.nsfw,
  };
}

function toRawOption(o: CommandOption): Record<string, unknown> {
  const type = typeof o.type === "number" ? o.type : OptionType[o.type];
  return {
    name: o.name,
    name_localizations: o.localize?.name,
    description: o.description,
    description_localizations: o.localize?.description,
    type,
    required: o.required,
    choices: o.choices?.map((c) => ({
      name: c.name,
      name_localizations: c.nameLocalizations,
      value: c.value,
    })),
    options: o.options?.map(toRawOption),
    channel_types: o.channel_types,
    min_value: o.min_value,
    max_value: o.max_value,
    min_length: o.min_length,
    max_length: o.max_length,
    autocomplete: o.autocomplete,
  };
}

/**
 * Add a sub/subgroup option to a parent command's options tree, creating
 * intermediate groups as needed. `def` describes the leaf subcommand.
 */
function addSubcommandToOptions(parent: CommandDef, path: string[], def: CommandDef): void {
  if (path.length === 0) return;
  parent.options = parent.options ?? [];
  if (path.length === 1) {
    parent.options.push({
      name: path[0]!,
      description: def.description,
      type: OptionType.SubCommand,
      options: def.options,
    });
    return;
  }
  // path.length === 2 → group + sub
  const [groupName, subName] = path;
  let group = parent.options.find((o) => o.name === groupName && (typeof o.type === "number" ? o.type : OptionType[o.type]) === OptionType.SubCommandGroup);
  if (!group) {
    group = {
      name: groupName!,
      description: groupName!,
      type: OptionType.SubCommandGroup,
      options: [],
    };
    parent.options.push(group);
  }
  group.options = group.options ?? [];
  group.options.push({
    name: subName!,
    description: def.description,
    type: OptionType.SubCommand,
    options: def.options,
  });
}

// Avoid unused-import errors (kept for downstream re-exports)
void ChannelType;
