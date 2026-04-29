// Auto-mod rules — CRUD wrapper. Live on a Guild via `guild.automod.*`.

import type { Rest } from "./rest.js";
import { AutoModActionType, AutoModEventType, AutoModKeywordPreset, AutoModTriggerType } from "./types.js";

export interface AutoModRule {
  id: string;
  guildId: string;
  name: string;
  creatorId: string;
  eventType: number;
  triggerType: number;
  triggerMetadata: AutoModTriggerMetadata;
  actions: AutoModActionDef[];
  enabled: boolean;
  exemptRoles: string[];
  exemptChannels: string[];
}

export interface AutoModTriggerMetadata {
  keyword_filter?: string[];
  regex_patterns?: string[];
  presets?: number[];
  allow_list?: string[];
  mention_total_limit?: number;
  mention_raid_protection_enabled?: boolean;
}

export interface AutoModActionDef {
  type: number;
  metadata?: {
    channel_id?: string;
    duration_seconds?: number;
    custom_message?: string;
  };
}

export interface CreateRuleOptions {
  name: string;
  /** "MessageSend" (default) or "MemberUpdate" */
  eventType?: keyof typeof AutoModEventType;
  /** "Keyword" | "Spam" | "KeywordPreset" | "MentionSpam" | "MemberProfile" */
  triggerType: keyof typeof AutoModTriggerType;
  triggerMetadata?: AutoModTriggerMetadata;
  /** Block / Alert / Timeout actions. */
  actions: ActionInput[];
  enabled?: boolean;
  exemptRoles?: string[];
  exemptChannels?: string[];
  reason?: string;
}

export type ActionInput =
  | { kind: "block"; customMessage?: string }
  | { kind: "alert"; channelId: string }
  | { kind: "timeout"; durationSeconds: number };

function actionsToRaw(actions: ActionInput[]): AutoModActionDef[] {
  return actions.map((a) => {
    if (a.kind === "block")
      return { type: AutoModActionType.BlockMessage, metadata: { custom_message: a.customMessage } };
    if (a.kind === "alert")
      return { type: AutoModActionType.SendAlertMessage, metadata: { channel_id: a.channelId } };
    return { type: AutoModActionType.Timeout, metadata: { duration_seconds: a.durationSeconds } };
  });
}

interface RawRule {
  id: string;
  guild_id: string;
  name: string;
  creator_id: string;
  event_type: number;
  trigger_type: number;
  trigger_metadata: AutoModTriggerMetadata;
  actions: AutoModActionDef[];
  enabled: boolean;
  exempt_roles: string[];
  exempt_channels: string[];
}

function fromRaw(r: RawRule): AutoModRule {
  return {
    id: r.id,
    guildId: r.guild_id,
    name: r.name,
    creatorId: r.creator_id,
    eventType: r.event_type,
    triggerType: r.trigger_type,
    triggerMetadata: r.trigger_metadata,
    actions: r.actions,
    enabled: r.enabled,
    exemptRoles: r.exempt_roles,
    exemptChannels: r.exempt_channels,
  };
}

// ── Typed object-literal helpers ──────────────────────────────────────────
//
// AutoMod rules need a `triggerType` AND a matching `triggerMetadata`. The two
// are tightly coupled, but `CreateRuleOptions` keeps them split for backwards
// compat. These helpers let you build a fully-typed `{ triggerType, triggerMetadata }`
// pair in one shot:
//
//   await guild.automod.create({
//     name: "no slurs",
//     ...AutoModTrigger.keyword({ keywords: ["badword"], regex: ["b[a4]dword"] }),
//     actions: [AutoModAction.block({ customMessage: "no" })],
//   });

type TriggerPair = {
  triggerType: keyof typeof AutoModTriggerType;
  triggerMetadata: AutoModTriggerMetadata;
};

export const AutoModTrigger = {
  /** Block content matching custom keywords / regex / allow-list. */
  keyword(opts: { keywords?: string[]; regex?: string[]; allowList?: string[] }): TriggerPair {
    return {
      triggerType: "Keyword",
      triggerMetadata: {
        keyword_filter: opts.keywords,
        regex_patterns: opts.regex,
        allow_list: opts.allowList,
      },
    };
  },
  /** Block generic spam (Discord's classifier; no metadata). */
  spam(): TriggerPair {
    return { triggerType: "Spam", triggerMetadata: {} };
  },
  /** Block one or more of Discord's curated preset categories. */
  keywordPreset(opts: {
    presets: (keyof typeof AutoModKeywordPreset)[];
    allowList?: string[];
  }): TriggerPair {
    return {
      triggerType: "KeywordPreset",
      triggerMetadata: {
        presets: opts.presets.map((p) => AutoModKeywordPreset[p]),
        allow_list: opts.allowList,
      },
    };
  },
  /**
   * Block messages with too many mentions (anti-raid).
   * `total` = max @user/@role mentions per message; `raidProtection` enables Discord's mention-spam classifier.
   */
  mentionSpam(opts: { total: number; raidProtection?: boolean }): TriggerPair {
    return {
      triggerType: "MentionSpam",
      triggerMetadata: {
        mention_total_limit: opts.total,
        mention_raid_protection_enabled: opts.raidProtection,
      },
    };
  },
  /** Block disallowed content in member display name / nickname (event_type=MemberUpdate is forced). */
  memberProfile(opts: { keywords?: string[]; regex?: string[]; allowList?: string[] }): TriggerPair {
    return {
      triggerType: "MemberProfile",
      triggerMetadata: {
        keyword_filter: opts.keywords,
        regex_patterns: opts.regex,
        allow_list: opts.allowList,
      },
    };
  },
} as const;

export const AutoModAction = {
  /** Block the offending message (and optionally show a custom error to the sender). */
  block(opts: { customMessage?: string } = {}): ActionInput {
    return { kind: "block", customMessage: opts.customMessage };
  },
  /** Forward the offending message to a moderation channel. */
  alert(channelId: string): ActionInput {
    return { kind: "alert", channelId };
  },
  /** Time-out the user for `seconds` (max 2_419_200 = 28 days). */
  timeout(seconds: number): ActionInput {
    return { kind: "timeout", durationSeconds: seconds };
  },
} as const;

export class AutoMod {
  constructor(private guildId: string, private rest: Rest) {}

  async list(): Promise<AutoModRule[]> {
    const arr = await this.rest.get<RawRule[]>(`/guilds/${this.guildId}/auto-moderation/rules`);
    return arr.map(fromRaw);
  }

  async fetch(ruleId: string): Promise<AutoModRule> {
    const r = await this.rest.get<RawRule>(`/guilds/${this.guildId}/auto-moderation/rules/${ruleId}`);
    return fromRaw(r);
  }

  async create(opts: CreateRuleOptions): Promise<AutoModRule> {
    const body = {
      name: opts.name,
      event_type: AutoModEventType[opts.eventType ?? "MessageSend"],
      trigger_type: AutoModTriggerType[opts.triggerType],
      trigger_metadata: opts.triggerMetadata,
      actions: actionsToRaw(opts.actions),
      enabled: opts.enabled,
      exempt_roles: opts.exemptRoles,
      exempt_channels: opts.exemptChannels,
    };
    const r = await this.rest.post<RawRule>(
      `/guilds/${this.guildId}/auto-moderation/rules`,
      body,
      opts.reason ? { "X-Audit-Log-Reason": opts.reason } : undefined,
    );
    return fromRaw(r);
  }

  async edit(ruleId: string, patch: Partial<CreateRuleOptions> & { reason?: string }): Promise<AutoModRule> {
    const body: Record<string, unknown> = {
      name: patch.name,
      event_type: patch.eventType ? AutoModEventType[patch.eventType] : undefined,
      trigger_metadata: patch.triggerMetadata,
      actions: patch.actions ? actionsToRaw(patch.actions) : undefined,
      enabled: patch.enabled,
      exempt_roles: patch.exemptRoles,
      exempt_channels: patch.exemptChannels,
    };
    const r = await this.rest.patch<RawRule>(
      `/guilds/${this.guildId}/auto-moderation/rules/${ruleId}`,
      body,
      patch.reason ? { "X-Audit-Log-Reason": patch.reason } : undefined,
    );
    return fromRaw(r);
  }

  async delete(ruleId: string, reason?: string): Promise<void> {
    await this.rest.delete(
      `/guilds/${this.guildId}/auto-moderation/rules/${ruleId}`,
      reason ? { "X-Audit-Log-Reason": reason } : undefined,
    );
  }
}
