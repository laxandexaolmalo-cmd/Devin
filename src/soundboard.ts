// Soundboard — list & play sounds in a voice channel. Bot must already be
// connected to the voice channel (use VOICE_STATE_UPDATE op directly via
// `bot.gateway.send(4, {...})` to join).

import type { Rest } from "./rest.js";

export interface SoundboardSound {
  id: string;
  name: string;
  volume: number;
  emojiId: string | null;
  emojiName: string | null;
  guildId?: string;
  available: boolean;
}

interface RawSound {
  sound_id: string;
  name: string;
  volume: number;
  emoji_id: string | null;
  emoji_name: string | null;
  guild_id?: string;
  available: boolean;
}

function fromRaw(r: RawSound): SoundboardSound {
  return {
    id: r.sound_id,
    name: r.name,
    volume: r.volume,
    emojiId: r.emoji_id,
    emojiName: r.emoji_name,
    guildId: r.guild_id,
    available: r.available,
  };
}

export class Soundboard {
  constructor(private rest: Rest) {}

  async defaults(): Promise<SoundboardSound[]> {
    const arr = await this.rest.get<RawSound[]>(`/soundboard-default-sounds`);
    return arr.map(fromRaw);
  }

  async listGuild(guildId: string): Promise<SoundboardSound[]> {
    const r = await this.rest.get<{ items: RawSound[] }>(`/guilds/${guildId}/soundboard-sounds`);
    return r.items.map(fromRaw);
  }

  /** Play a soundboard sound in a voice channel the bot is already in. */
  async send(channelId: string, soundId: string, opts: { sourceGuildId?: string } = {}): Promise<void> {
    await this.rest.post(`/channels/${channelId}/send-soundboard-sound`, {
      sound_id: soundId,
      source_guild_id: opts.sourceGuildId,
    });
  }
}
