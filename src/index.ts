// Supa.js — tiny, LLM-friendly Discord bot library.
//
// Common imports:
//   import { Bot, Intents, intents, row, button, stringSelect, textInput } from "supa.js";

export { Bot } from "./bot.js";
export type {
  BotOptions,
  BotEvents,
  CommandHandler,
  UserCommandHandler,
  MessageCommandHandler,
  ComponentHandler,
  ModalHandler,
  AutocompleteHandler,
  PresenceUpdate,
} from "./bot.js";

export { Intents, DefaultIntents, intents } from "./intents.js";
export type { IntentFlag } from "./intents.js";

export { Permissions, PermissionFlags } from "./permissions.js";
export type { PermissionFlag } from "./permissions.js";

export { Message } from "./message.js";
export type { ReplyOptions } from "./message.js";

export { Channel } from "./channel.js";
export type { SendOptions } from "./channel.js";

export { Guild, GuildMember } from "./guild.js";

export {
  User,
  Role,
  Reaction,
  Invite,
  Webhook,
  Sticker,
  parseEmoji,
  encodeEmoji,
} from "./structures.js";
export type { ParsedEmoji } from "./structures.js";

export {
  ChatInputCtx,
  InteractionCtx,
  UserCtx,
  MessageCtx,
  ComponentCtx,
  ModalCtx,
  AutocompleteCtx,
  BaseInteraction,
} from "./interactions.js";
export type { InteractionReplyOptions } from "./interactions.js";

export {
  row,
  button,
  linkButton,
  premiumButton,
  stringSelect,
  userSelect,
  roleSelect,
  mentionableSelect,
  channelSelect,
  textInput,
  buildModalPayload,
  // Components V2
  textDisplay,
  separator,
  section,
  thumbnail,
  mediaGallery,
  fileComponent,
  container,
} from "./components.js";
export type {
  ButtonOptions,
  StringSelectOption,
  SelectBase,
  TextInputOptions,
  ModalDef,
  Emoji,
} from "./components.js";

export { Rest, RestError, DiscordErrorCodes } from "./rest.js";
export type { DiscordErrorMeta } from "./rest.js";
export type { RestFile, RestOptions } from "./rest.js";

export { Gateway } from "./gateway.js";

export {
  ChannelType,
  ApplicationCommandType,
  OptionType,
  ComponentType,
  ButtonStyle,
  TextInputStyle,
  SeparatorSpacing,
  InteractionType,
  InteractionResponseType,
  MessageFlags,
  MessageType,
  MessageReferenceType,
  ReactionType,
  AttachmentFlags,
  AutoModEventType,
  AutoModTriggerType,
  AutoModActionType,
  AutoModKeywordPreset,
  Op,
} from "./types.js";
export type {
  CommandDef,
  CommandOption,
  UserCommandDef,
  MessageCommandDef,
  RawMessage,
  RawUser,
  RawInteraction,
  RawMember,
  RawGuild,
  RawChannel,
  RawRole,
  RawEmbed,
  RawComponent,
  RawAttachment,
  RawWebhook,
  RawInvite,
  RawScheduledEvent,
  RawAuditLogEntry,
  RawVoiceState,
  RawPresence,
  RawReady,
  RawEmoji,
  RawSticker,
  RawReaction,
  RawOverwrite,
  RawInteractionOption,
  GatewayPayload,
} from "./types.js";

export { Cache, LRUMap } from "./cache.js";
export { ShardManager } from "./sharding.js";
export { collect, await_ } from "./collectors.js";
export type { CollectOptions } from "./collectors.js";

// Auto-mod
export { AutoMod } from "./automod.js";
export type {
  AutoModRule,
  AutoModTriggerMetadata,
  AutoModActionDef,
  CreateRuleOptions as AutoModCreateOptions,
  ActionInput as AutoModActionInput,
} from "./automod.js";

// Application emojis (per-app, no guild)
export { AppEmojis, bytesToDataUri } from "./app-emojis.js";
export type { AppEmoji } from "./app-emojis.js";

// Soundboard
export { Soundboard } from "./soundboard.js";
export type { SoundboardSound } from "./soundboard.js";

// Voice messages
export { voiceMessage } from "./voice-message.js";
export type { VoiceMessageInput, VoiceMessageBundle } from "./voice-message.js";

// Polls
export type { PollOptions, PollAnswer } from "./channel.js";

// Debugger
export { Debugger } from "./debug.js";

// Onboarding
export { Onboarding, OnboardingMode, OnboardingPromptType } from "./onboarding.js";
export type { OnboardingState, OnboardingPrompt, OnboardingPromptOption } from "./onboarding.js";

// Stage instances
export { StageInstances, StagePrivacyLevel } from "./stage.js";
export type { StageInstance } from "./stage.js";

// Stickers
export { GuildStickers, fetchStickerPacks } from "./stickers.js";
export type { StickerPack } from "./stickers.js";

// Monetization
export { Entitlements, Skus, RoleConnectionMetadata, SkuType, EntitlementType, EntitlementOwnerType, RoleConnectionMetadataType } from "./entitlements.js";
export type { Entitlement, Sku, RoleConnectionMetadataField } from "./entitlements.js";
