// Raw Discord payload types & gateway constants.
// Subset of the Discord API — only what Supa.js exposes.
// Keep these as flat as possible; convert to nice JS shapes inside structures.

export const API = "https://discord.com/api/v10";
export const CDN = "https://cdn.discordapp.com";
export const GATEWAY_URL = "wss://gateway.discord.gg/?v=10&encoding=json";

// ── Gateway ────────────────────────────────────────────────────────────────

export const Op = {
  Dispatch: 0,
  Heartbeat: 1,
  Identify: 2,
  PresenceUpdate: 3,
  VoiceStateUpdate: 4,
  Resume: 6,
  Reconnect: 7,
  RequestGuildMembers: 8,
  InvalidSession: 9,
  Hello: 10,
  HeartbeatAck: 11,
} as const;

export interface GatewayPayload<D = unknown> {
  op: number;
  d: D;
  s: number | null;
  t: string | null;
}

// ── Channels ───────────────────────────────────────────────────────────────

export const ChannelType = {
  GuildText: 0,
  DM: 1,
  GuildVoice: 2,
  GroupDM: 3,
  GuildCategory: 4,
  GuildAnnouncement: 5,
  AnnouncementThread: 10,
  PublicThread: 11,
  PrivateThread: 12,
  GuildStageVoice: 13,
  GuildDirectory: 14,
  GuildForum: 15,
  GuildMedia: 16,
} as const;

export type ChannelTypeKey = keyof typeof ChannelType;
export type ChannelTypeValue = (typeof ChannelType)[ChannelTypeKey];

// ── Interactions ───────────────────────────────────────────────────────────

export const InteractionType = {
  Ping: 1,
  ApplicationCommand: 2,
  MessageComponent: 3,
  ApplicationCommandAutocomplete: 4,
  ModalSubmit: 5,
} as const;

export const ApplicationCommandType = {
  ChatInput: 1,
  User: 2,
  Message: 3,
} as const;

export const OptionType = {
  SubCommand: 1,
  SubCommandGroup: 2,
  String: 3,
  Integer: 4,
  Boolean: 5,
  User: 6,
  Channel: 7,
  Role: 8,
  Mentionable: 9,
  Number: 10,
  Attachment: 11,
} as const;

export const InteractionResponseType = {
  Pong: 1,
  ChannelMessageWithSource: 4,
  DeferredChannelMessageWithSource: 5,
  DeferredUpdateMessage: 6,
  UpdateMessage: 7,
  ApplicationCommandAutocompleteResult: 8,
  Modal: 9,
} as const;

export const ComponentType = {
  ActionRow: 1,
  Button: 2,
  StringSelect: 3,
  TextInput: 4,
  UserSelect: 5,
  RoleSelect: 6,
  MentionableSelect: 7,
  ChannelSelect: 8,
  // Components V2 (2025)
  Section: 9,
  TextDisplay: 10,
  Thumbnail: 11,
  MediaGallery: 12,
  File: 13,
  Separator: 14,
  Container: 17,
} as const;

export const SeparatorSpacing = {
  Small: 1,
  Large: 2,
} as const;

export const ButtonStyle = {
  Primary: 1,
  Secondary: 2,
  Success: 3,
  Danger: 4,
  Link: 5,
  /** Premium SKU button — opens checkout for `skuId`. */
  Premium: 6,
} as const;

export const ReactionType = {
  Normal: 0,
  Burst: 1, // "super reactions"
} as const;

/**
 * Attachment flags. Documented April 2026 (PR #7353 in `discord/discord-api-docs`).
 * Source: https://docs.discord.com/developers/resources/message#attachment-object-attachment-flags
 */
export const AttachmentFlags = {
  /** This attachment has been edited using the remix feature on mobile. */
  IsRemix: 1 << 2,
  /** Marked as a spoiler (shown blurred). Not sent to the API; surfaced via filename `SPOILER_` prefix. */
  IsSpoiler: 1 << 3,
  /** Attachment was uploaded by the user with the "remix" feature. */
  ContainsExplicitMedia: 1 << 4,
  /** Attachment is an animated image used as voice-message waveform. */
  IsAnimated: 1 << 5,
} as const;

export const MessageReferenceType = {
  Default: 0,
  /** Forwarded message — message_snapshots are populated. */
  Forward: 1,
} as const;

export const MessageType = {
  Default: 0,
  RecipientAdd: 1,
  RecipientRemove: 2,
  Call: 3,
  ChannelNameChange: 4,
  ChannelIconChange: 5,
  ChannelPinnedMessage: 6,
  UserJoin: 7,
  GuildBoost: 8,
  GuildBoostTier1: 9,
  GuildBoostTier2: 10,
  GuildBoostTier3: 11,
  ChannelFollowAdd: 12,
  GuildDiscoveryDisqualified: 14,
  GuildDiscoveryRequalified: 15,
  GuildDiscoveryGracePeriodInitialWarning: 16,
  GuildDiscoveryGracePeriodFinalWarning: 17,
  ThreadCreated: 18,
  Reply: 19,
  ChatInputCommand: 20,
  ThreadStarterMessage: 21,
  GuildInviteReminder: 22,
  ContextMenuCommand: 23,
  AutoModerationAction: 24,
  RoleSubscriptionPurchase: 25,
  InteractionPremiumUpsell: 26,
  StageStart: 27,
  StageEnd: 28,
  StageSpeaker: 29,
  StageRaiseHand: 30,
  StageTopic: 31,
  GuildApplicationPremiumSubscription: 32,
  GuildIncidentAlertModeEnabled: 36,
  GuildIncidentAlertModeDisabled: 37,
  GuildIncidentReportRaid: 38,
  GuildIncidentReportFalseAlarm: 39,
  PurchaseNotification: 44,
  PollResult: 46,
} as const;

export const TextInputStyle = {
  Short: 1,
  Paragraph: 2,
} as const;

// Message flags (subset)
export const MessageFlags = {
  Crossposted: 1 << 0,
  IsCrosspost: 1 << 1,
  SuppressEmbeds: 1 << 2,
  SourceMessageDeleted: 1 << 3,
  Urgent: 1 << 4,
  HasThread: 1 << 5,
  Ephemeral: 1 << 6,
  Loading: 1 << 7,
  SuppressNotifications: 1 << 12,
  IsVoiceMessage: 1 << 13,
  IsComponentsV2: 1 << 15,
} as const;

// Auto-mod
export const AutoModEventType = {
  MessageSend: 1,
  MemberUpdate: 2,
} as const;

export const AutoModTriggerType = {
  Keyword: 1,
  Spam: 3,
  KeywordPreset: 4,
  MentionSpam: 5,
  MemberProfile: 6,
} as const;

export const AutoModActionType = {
  BlockMessage: 1,
  SendAlertMessage: 2,
  Timeout: 3,
  BlockMemberInteraction: 4,
} as const;

export const AutoModKeywordPreset = {
  Profanity: 1,
  SexualContent: 2,
  Slurs: 3,
} as const;

// ── Raw payload subset ─────────────────────────────────────────────────────

export interface RawUser {
  id: string;
  username: string;
  discriminator: string;
  global_name?: string | null;
  avatar?: string | null;
  bot?: boolean;
  system?: boolean;
  banner?: string | null;
  accent_color?: number | null;
  public_flags?: number;
}

export interface RawMember {
  user?: RawUser;
  nick?: string | null;
  avatar?: string | null;
  roles: string[];
  joined_at: string;
  premium_since?: string | null;
  pending?: boolean;
  communication_disabled_until?: string | null;
  permissions?: string;
}

export interface RawRole {
  id: string;
  name: string;
  color: number;
  hoist: boolean;
  position: number;
  permissions: string;
  managed: boolean;
  mentionable: boolean;
  icon?: string | null;
  unicode_emoji?: string | null;
}

export interface RawGuild {
  id: string;
  name: string;
  icon: string | null;
  description: string | null;
  owner_id: string;
  region?: string | null;
  afk_channel_id?: string | null;
  verification_level: number;
  default_message_notifications: number;
  explicit_content_filter: number;
  mfa_level: number;
  premium_tier: number;
  preferred_locale: string;
  features: string[];
  member_count?: number;
  max_members?: number;
}

export interface RawChannel {
  id: string;
  type: number;
  guild_id?: string;
  name?: string;
  topic?: string | null;
  nsfw?: boolean;
  parent_id?: string | null;
  position?: number;
  rate_limit_per_user?: number;
  bitrate?: number;
  user_limit?: number;
  recipients?: RawUser[];
  permission_overwrites?: RawOverwrite[];
  thread_metadata?: {
    archived: boolean;
    auto_archive_duration: number;
    archive_timestamp: string;
    locked?: boolean;
    invitable?: boolean;
  };
  available_tags?: { id: string; name: string; emoji_id?: string | null; emoji_name?: string | null }[];
  applied_tags?: string[];
  default_auto_archive_duration?: number;
}

export interface RawOverwrite {
  id: string;
  type: 0 | 1; // 0 role, 1 member
  allow: string;
  deny: string;
}

export interface RawAttachment {
  id: string;
  filename: string;
  size: number;
  url: string;
  proxy_url: string;
  content_type?: string;
  height?: number | null;
  width?: number | null;
  description?: string;
  ephemeral?: boolean;
}

export interface RawEmoji {
  id: string | null;
  name: string | null;
  animated?: boolean;
  managed?: boolean;
  available?: boolean;
  user?: RawUser;
}

export interface RawSticker {
  id: string;
  name: string;
  description?: string | null;
  format_type: number;
}

export interface RawReaction {
  count: number;
  me: boolean;
  emoji: RawEmoji;
}

export interface RawEmbed {
  title?: string;
  description?: string;
  url?: string;
  timestamp?: string;
  color?: number;
  footer?: { text: string; icon_url?: string };
  image?: { url: string };
  thumbnail?: { url: string };
  author?: { name: string; url?: string; icon_url?: string };
  fields?: { name: string; value: string; inline?: boolean }[];
}

export interface RawComponent {
  type: number;
  custom_id?: string;
  style?: number;
  label?: string;
  emoji?: RawEmoji;
  url?: string;
  disabled?: boolean;
  components?: RawComponent[];
  options?: { label: string; value: string; description?: string; default?: boolean; emoji?: RawEmoji }[];
  placeholder?: string;
  min_values?: number;
  max_values?: number;
  channel_types?: number[];
  default_values?: { id: string; type: "user" | "role" | "channel" }[];
  required?: boolean;
  value?: string;
  min_length?: number;
  max_length?: number;
}

export interface RawMessage {
  id: string;
  channel_id: string;
  guild_id?: string;
  author: RawUser;
  member?: RawMember;
  content: string;
  timestamp: string;
  edited_timestamp: string | null;
  tts: boolean;
  mention_everyone: boolean;
  mentions: RawUser[];
  mention_roles: string[];
  mention_channels?: { id: string; guild_id: string; type: number; name: string }[];
  attachments: RawAttachment[];
  embeds: RawEmbed[];
  reactions?: RawReaction[];
  pinned: boolean;
  webhook_id?: string;
  type: number;
  flags?: number;
  components?: RawComponent[];
  sticker_items?: RawSticker[];
  referenced_message?: RawMessage | null;
  thread?: RawChannel;
}

export interface RawInteraction {
  id: string;
  application_id: string;
  type: number;
  token: string;
  version: number;
  guild_id?: string;
  channel_id?: string;
  member?: RawMember;
  user?: RawUser;
  message?: RawMessage;
  data?: {
    id?: string;
    name?: string;
    type?: number;
    options?: RawInteractionOption[];
    custom_id?: string;
    component_type?: number;
    values?: string[];
    target_id?: string;
    components?: RawComponent[];
    resolved?: {
      users?: Record<string, RawUser>;
      members?: Record<string, RawMember>;
      roles?: Record<string, RawRole>;
      channels?: Record<string, RawChannel>;
      messages?: Record<string, RawMessage>;
      attachments?: Record<string, RawAttachment>;
    };
  };
  locale?: string;
  guild_locale?: string;
  app_permissions?: string;
}

export interface RawInteractionOption {
  name: string;
  type: number;
  value?: string | number | boolean;
  options?: RawInteractionOption[];
  focused?: boolean;
}

export interface RawReady {
  v: number;
  user: RawUser;
  session_id: string;
  resume_gateway_url: string;
  application: { id: string; flags: number };
  guilds: { id: string; unavailable: boolean }[];
  shard?: [number, number];
}

export interface RawWebhook {
  id: string;
  type: number;
  guild_id?: string;
  channel_id: string | null;
  user?: RawUser;
  name: string | null;
  avatar: string | null;
  token?: string;
  application_id: string | null;
  url?: string;
}

export interface RawInvite {
  code: string;
  guild?: { id: string; name: string };
  channel: { id: string; name: string; type: number } | null;
  inviter?: RawUser;
  uses?: number;
  max_uses?: number;
  max_age?: number;
  temporary?: boolean;
  created_at?: string;
  expires_at?: string | null;
}

export interface RawScheduledEvent {
  id: string;
  guild_id: string;
  channel_id: string | null;
  name: string;
  description?: string | null;
  scheduled_start_time: string;
  scheduled_end_time: string | null;
  privacy_level: number;
  status: number;
  entity_type: number;
  creator?: RawUser;
}

export interface RawAuditLogEntry {
  id: string;
  user_id: string | null;
  action_type: number;
  target_id: string | null;
  reason?: string;
  changes?: { key: string; old_value?: unknown; new_value?: unknown }[];
}

export interface RawVoiceState {
  guild_id?: string;
  channel_id: string | null;
  user_id: string;
  member?: RawMember;
  session_id: string;
  deaf: boolean;
  mute: boolean;
  self_deaf: boolean;
  self_mute: boolean;
  self_video: boolean;
  self_stream?: boolean;
  suppress: boolean;
}

export interface RawPresence {
  user: { id: string };
  guild_id: string;
  status: "idle" | "dnd" | "online" | "offline";
  activities: { name: string; type: number; url?: string | null; state?: string }[];
  client_status: { desktop?: string; mobile?: string; web?: string };
}

// ── Public command schema ──────────────────────────────────────────────────

export interface CommandOption {
  name: string;
  description: string;
  type: keyof typeof OptionType | number;
  required?: boolean;
  choices?: { name: string; value: string | number }[];
  options?: CommandOption[]; // for SubCommand / SubCommandGroup
  channel_types?: number[];
  min_value?: number;
  max_value?: number;
  min_length?: number;
  max_length?: number;
  autocomplete?: boolean;
}

export interface CommandDef {
  description: string;
  options?: CommandOption[];
  /** Restrict to a single guild during dev; deploys instantly instead of ~1h. */
  guildId?: string;
  /** Default member permissions bitfield (string). */
  defaultPermissions?: string;
  /** Allow command in DMs (only meaningful for global commands). */
  dmPermission?: boolean;
  /** NSFW flag. */
  nsfw?: boolean;
}

export interface UserCommandDef {
  guildId?: string;
  defaultPermissions?: string;
  nsfw?: boolean;
}

export interface MessageCommandDef extends UserCommandDef {}
