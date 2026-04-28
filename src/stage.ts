// Stage Instances — start, edit, end a stage event in a Stage Voice channel.

import type { Rest } from "./rest.js";

export const StagePrivacyLevel = {
  /** Stage is visible to everyone — DEPRECATED by Discord but still in API. */
  Public: 1,
  /** Default — visible only to guild members. */
  GuildOnly: 2,
} as const;

export interface StageInstance {
  id: string;
  guildId: string;
  channelId: string;
  topic: string;
  privacyLevel: number;
  /** Discoverable in directory (deprecated server-side but still returned). */
  discoverableDisabled?: boolean;
  guildScheduledEventId: string | null;
}

interface RawStage {
  id: string;
  guild_id: string;
  channel_id: string;
  topic: string;
  privacy_level: number;
  discoverable_disabled?: boolean;
  guild_scheduled_event_id: string | null;
}

function fromRaw(r: RawStage): StageInstance {
  return {
    id: r.id,
    guildId: r.guild_id,
    channelId: r.channel_id,
    topic: r.topic,
    privacyLevel: r.privacy_level,
    discoverableDisabled: r.discoverable_disabled,
    guildScheduledEventId: r.guild_scheduled_event_id,
  };
}

export class StageInstances {
  constructor(private rest: Rest) {}

  /** Start a stage in a Stage Voice channel. The bot must already be connected. */
  async start(opts: {
    channelId: string;
    topic: string;
    privacyLevel?: keyof typeof StagePrivacyLevel | number;
    sendStartNotification?: boolean;
    guildScheduledEventId?: string;
    reason?: string;
  }): Promise<StageInstance> {
    const body = {
      channel_id: opts.channelId,
      topic: opts.topic,
      privacy_level:
        typeof opts.privacyLevel === "string"
          ? StagePrivacyLevel[opts.privacyLevel]
          : opts.privacyLevel ?? StagePrivacyLevel.GuildOnly,
      send_start_notification: opts.sendStartNotification,
      guild_scheduled_event_id: opts.guildScheduledEventId,
    };
    const r = await this.rest.post<RawStage>(
      `/stage-instances`,
      body,
      opts.reason ? { "X-Audit-Log-Reason": opts.reason } : undefined,
    );
    return fromRaw(r);
  }

  async fetch(channelId: string): Promise<StageInstance> {
    const r = await this.rest.get<RawStage>(`/stage-instances/${channelId}`);
    return fromRaw(r);
  }

  async edit(channelId: string, opts: { topic?: string; privacyLevel?: number; reason?: string }): Promise<StageInstance> {
    const r = await this.rest.patch<RawStage>(
      `/stage-instances/${channelId}`,
      { topic: opts.topic, privacy_level: opts.privacyLevel },
      opts.reason ? { "X-Audit-Log-Reason": opts.reason } : undefined,
    );
    return fromRaw(r);
  }

  /** End a stage. */
  async end(channelId: string, reason?: string): Promise<void> {
    await this.rest.delete(
      `/stage-instances/${channelId}`,
      reason ? { "X-Audit-Log-Reason": reason } : undefined,
    );
  }
}
