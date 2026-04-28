// Guild Onboarding — the new-member flow with prompts, default channels, and
// a chosen "mode". Lives on Guild via `guild.onboarding`.
//
//   const onb = await guild.onboarding.fetch();
//   await guild.onboarding.edit({
//     enabled: true, mode: "Default",
//     defaultChannelIds: ["123..."],
//     prompts: [{
//       title: "Pick your interests",
//       singleSelect: false, required: true, inOnboarding: true,
//       type: "MultipleChoice",
//       options: [{ title: "Coding", channelIds: ["..."], roleIds: [], emoji: "💻" }],
//     }],
//   });

import type { Rest } from "./rest.js";

export const OnboardingMode = {
  /** Default flow */
  Default: 0,
  /** Advanced — count toward constraints */
  Advanced: 1,
} as const;

export const OnboardingPromptType = {
  MultipleChoice: 0,
  Dropdown: 1,
} as const;

export interface OnboardingPromptOption {
  id?: string;
  title: string;
  description?: string;
  channelIds: string[];
  roleIds: string[];
  emoji?: string | { id?: string; name?: string; animated?: boolean };
}

export interface OnboardingPrompt {
  id?: string;
  type: keyof typeof OnboardingPromptType | number;
  title: string;
  options: OnboardingPromptOption[];
  singleSelect: boolean;
  required: boolean;
  inOnboarding: boolean;
}

export interface OnboardingState {
  guildId: string;
  prompts: OnboardingPrompt[];
  defaultChannelIds: string[];
  enabled: boolean;
  mode: number;
}

interface RawOnboarding {
  guild_id: string;
  prompts: RawPrompt[];
  default_channel_ids: string[];
  enabled: boolean;
  mode: number;
}
interface RawPrompt {
  id: string;
  type: number;
  options: RawOption[];
  title: string;
  single_select: boolean;
  required: boolean;
  in_onboarding: boolean;
}
interface RawOption {
  id: string;
  channel_ids: string[];
  role_ids: string[];
  emoji?: { id?: string; name?: string; animated?: boolean };
  title: string;
  description?: string;
}

function emoji(e: OnboardingPromptOption["emoji"]) {
  if (!e) return undefined;
  if (typeof e === "string") return { name: e };
  return e;
}

function fromRaw(r: RawOnboarding): OnboardingState {
  return {
    guildId: r.guild_id,
    enabled: r.enabled,
    mode: r.mode,
    defaultChannelIds: r.default_channel_ids,
    prompts: r.prompts.map((p) => ({
      id: p.id,
      type: p.type,
      title: p.title,
      singleSelect: p.single_select,
      required: p.required,
      inOnboarding: p.in_onboarding,
      options: p.options.map((o) => ({
        id: o.id,
        title: o.title,
        description: o.description,
        channelIds: o.channel_ids,
        roleIds: o.role_ids,
        emoji: o.emoji,
      })),
    })),
  };
}

export class Onboarding {
  constructor(private guildId: string, private rest: Rest) {}

  async fetch(): Promise<OnboardingState> {
    const r = await this.rest.get<RawOnboarding>(`/guilds/${this.guildId}/onboarding`);
    return fromRaw(r);
  }

  async edit(
    opts: {
      enabled?: boolean;
      mode?: keyof typeof OnboardingMode | number;
      defaultChannelIds?: string[];
      prompts?: OnboardingPrompt[];
      reason?: string;
    },
  ): Promise<OnboardingState> {
    const body = {
      enabled: opts.enabled,
      mode: typeof opts.mode === "string" ? OnboardingMode[opts.mode] : opts.mode,
      default_channel_ids: opts.defaultChannelIds,
      prompts: opts.prompts?.map((p) => ({
        id: p.id,
        type: typeof p.type === "string" ? OnboardingPromptType[p.type] : p.type,
        title: p.title,
        single_select: p.singleSelect,
        required: p.required,
        in_onboarding: p.inOnboarding,
        options: p.options.map((o) => ({
          id: o.id,
          title: o.title,
          description: o.description,
          channel_ids: o.channelIds,
          role_ids: o.roleIds,
          emoji: emoji(o.emoji),
        })),
      })),
    };
    const r = await this.rest.put<RawOnboarding>(
      `/guilds/${this.guildId}/onboarding`,
      body,
      opts.reason ? { "X-Audit-Log-Reason": opts.reason } : undefined,
    );
    return fromRaw(r);
  }
}
