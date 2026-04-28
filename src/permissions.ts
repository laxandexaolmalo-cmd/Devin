// Discord permission flags. Stored as a 53-bit BigInt-encoded string in API.
// Use Permissions.has(bits, "ManageMessages") instead of bit math.

export const PermissionFlags = {
  CreateInstantInvite: 1n << 0n,
  KickMembers: 1n << 1n,
  BanMembers: 1n << 2n,
  Administrator: 1n << 3n,
  ManageChannels: 1n << 4n,
  ManageGuild: 1n << 5n,
  AddReactions: 1n << 6n,
  ViewAuditLog: 1n << 7n,
  PrioritySpeaker: 1n << 8n,
  Stream: 1n << 9n,
  ViewChannel: 1n << 10n,
  SendMessages: 1n << 11n,
  SendTTSMessages: 1n << 12n,
  ManageMessages: 1n << 13n,
  EmbedLinks: 1n << 14n,
  AttachFiles: 1n << 15n,
  ReadMessageHistory: 1n << 16n,
  MentionEveryone: 1n << 17n,
  UseExternalEmojis: 1n << 18n,
  ViewGuildInsights: 1n << 19n,
  Connect: 1n << 20n,
  Speak: 1n << 21n,
  MuteMembers: 1n << 22n,
  DeafenMembers: 1n << 23n,
  MoveMembers: 1n << 24n,
  UseVAD: 1n << 25n,
  ChangeNickname: 1n << 26n,
  ManageNicknames: 1n << 27n,
  ManageRoles: 1n << 28n,
  ManageWebhooks: 1n << 29n,
  ManageGuildExpressions: 1n << 30n,
  UseApplicationCommands: 1n << 31n,
  RequestToSpeak: 1n << 32n,
  ManageEvents: 1n << 33n,
  ManageThreads: 1n << 34n,
  CreatePublicThreads: 1n << 35n,
  CreatePrivateThreads: 1n << 36n,
  UseExternalStickers: 1n << 37n,
  SendMessagesInThreads: 1n << 38n,
  UseEmbeddedActivities: 1n << 39n,
  ModerateMembers: 1n << 40n,
  ViewCreatorMonetizationAnalytics: 1n << 41n,
  UseSoundboard: 1n << 42n,
  CreateGuildExpressions: 1n << 43n,
  CreateEvents: 1n << 44n,
  UseExternalSounds: 1n << 45n,
  SendVoiceMessages: 1n << 46n,
} as const;

export type PermissionFlag = keyof typeof PermissionFlags;

export const Permissions = {
  /** Combine flags into a bitfield string. */
  build(...flags: PermissionFlag[]): string {
    let bits = 0n;
    for (const f of flags) bits |= PermissionFlags[f];
    return bits.toString();
  },

  /** Check if a permission bitfield string contains a flag (Administrator overrides). */
  has(bitfield: string | bigint | undefined | null, flag: PermissionFlag): boolean {
    if (!bitfield) return false;
    const bits = typeof bitfield === "bigint" ? bitfield : BigInt(bitfield);
    if (bits & PermissionFlags.Administrator) return true;
    return (bits & PermissionFlags[flag]) !== 0n;
  },

  /** List all flags present in a bitfield. */
  list(bitfield: string | bigint | undefined | null): PermissionFlag[] {
    if (!bitfield) return [];
    const bits = typeof bitfield === "bigint" ? bitfield : BigInt(bitfield);
    const out: PermissionFlag[] = [];
    for (const k of Object.keys(PermissionFlags) as PermissionFlag[]) {
      if (bits & PermissionFlags[k]) out.push(k);
    }
    return out;
  },

  ALL: ((): string => {
    let b = 0n;
    for (const k of Object.keys(PermissionFlags) as PermissionFlag[]) {
      b |= PermissionFlags[k];
    }
    return b.toString();
  })(),
} as const;
