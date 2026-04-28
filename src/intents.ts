// Discord Gateway Intent flags. Use Intents.Default for the common case.
// Reference: https://discord.com/developers/docs/topics/gateway#gateway-intents

export const Intents = {
  Guilds: 1 << 0,
  GuildMembers: 1 << 1,
  GuildModeration: 1 << 2,
  GuildEmojisAndStickers: 1 << 3,
  GuildIntegrations: 1 << 4,
  GuildWebhooks: 1 << 5,
  GuildInvites: 1 << 6,
  GuildVoiceStates: 1 << 7,
  GuildPresences: 1 << 8,
  GuildMessages: 1 << 9,
  GuildMessageReactions: 1 << 10,
  GuildMessageTyping: 1 << 11,
  DirectMessages: 1 << 12,
  DirectMessageReactions: 1 << 13,
  DirectMessageTyping: 1 << 14,
  MessageContent: 1 << 15,
  GuildScheduledEvents: 1 << 16,
  AutoModConfig: 1 << 20,
  AutoModExecution: 1 << 21,
} as const;

/** Sensible default: guild + DM messages with content. Privileged: MessageContent. */
export const DefaultIntents =
  Intents.Guilds |
  Intents.GuildMessages |
  Intents.MessageContent |
  Intents.DirectMessages;

export type IntentFlag = keyof typeof Intents;

export function intents(...flags: IntentFlag[]): number {
  return flags.reduce((acc, f) => acc | Intents[f], 0);
}
