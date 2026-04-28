// Guild stickers — list/create/edit/delete. Plus standard sticker packs.

import type { Rest, RestFile } from "./rest.js";
import { Sticker } from "./structures.js";
import type { RawSticker } from "./types.js";

export interface StickerPack {
  id: string;
  name: string;
  description?: string | null;
  skuId: string;
  coverStickerId?: string;
  bannerAssetId?: string;
  stickers: Sticker[];
}

interface RawPack {
  id: string;
  name: string;
  description?: string | null;
  sku_id: string;
  cover_sticker_id?: string;
  banner_asset_id?: string;
  stickers: RawSticker[];
}

export class GuildStickers {
  constructor(private guildId: string, private rest: Rest) {}

  async list(): Promise<Sticker[]> {
    const arr = await this.rest.get<RawSticker[]>(`/guilds/${this.guildId}/stickers`);
    return arr.map((r) => new Sticker(r, this.rest));
  }

  async fetch(stickerId: string): Promise<Sticker> {
    const r = await this.rest.get<RawSticker>(`/guilds/${this.guildId}/stickers/${stickerId}`);
    return new Sticker(r, this.rest);
  }

  async create(opts: {
    name: string;
    description: string;
    /** Comma-separated tags (Discord requires at least one). */
    tags: string;
    /** Image file (.png, .apng, .gif, or .json for Lottie). */
    file: RestFile;
    reason?: string;
  }): Promise<Sticker> {
    // Stickers use multipart with non-JSON form fields, not the standard payload_json.
    const fields: Record<string, string> = {
      name: opts.name,
      description: opts.description,
      tags: opts.tags,
    };
    const r = await this.rest.uploadFields<RawSticker>(
      "POST",
      `/guilds/${this.guildId}/stickers`,
      fields,
      [opts.file],
      opts.reason ? { "X-Audit-Log-Reason": opts.reason } : undefined,
    );
    return new Sticker(r, this.rest);
  }

  async edit(
    stickerId: string,
    patch: { name?: string; description?: string; tags?: string; reason?: string },
  ): Promise<Sticker> {
    const r = await this.rest.patch<RawSticker>(
      `/guilds/${this.guildId}/stickers/${stickerId}`,
      { name: patch.name, description: patch.description, tags: patch.tags },
      patch.reason ? { "X-Audit-Log-Reason": patch.reason } : undefined,
    );
    return new Sticker(r, this.rest);
  }

  async delete(stickerId: string, reason?: string): Promise<void> {
    await this.rest.delete(
      `/guilds/${this.guildId}/stickers/${stickerId}`,
      reason ? { "X-Audit-Log-Reason": reason } : undefined,
    );
  }
}

export async function fetchStickerPacks(rest: Rest): Promise<StickerPack[]> {
  const r = await rest.get<{ sticker_packs: RawPack[] }>(`/sticker-packs`);
  return r.sticker_packs.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description ?? null,
    skuId: p.sku_id,
    coverStickerId: p.cover_sticker_id,
    bannerAssetId: p.banner_asset_id,
    stickers: p.stickers.map((s) => new Sticker(s, rest)),
  }));
}


