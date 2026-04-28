// Application-scoped emojis (no guild required). Uploaded via data-URI image.
// Live on Bot via `bot.emojis`.

import type { Rest } from "./rest.js";

export interface AppEmoji {
  id: string;
  name: string;
  animated: boolean;
  available: boolean;
  managed: boolean;
  /** "<:name:id>" or "<a:name:id>" — pasteable in messages. */
  toString(): string;
}

interface RawEmoji {
  id: string;
  name: string;
  animated?: boolean;
  available?: boolean;
  managed?: boolean;
}

function fromRaw(r: RawEmoji): AppEmoji {
  const out: AppEmoji = {
    id: r.id,
    name: r.name,
    animated: !!r.animated,
    available: r.available !== false,
    managed: !!r.managed,
    toString: () => `<${out.animated ? "a" : ""}:${out.name}:${out.id}>`,
  };
  return out;
}

/** Convert raw bytes (PNG/GIF/JPG) into a data: URI Discord expects. */
export function bytesToDataUri(bytes: Uint8Array, mime = "image/png"): string {
  return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
}

export class AppEmojis {
  constructor(private getAppId: () => string, private rest: Rest) {}

  async list(): Promise<AppEmoji[]> {
    const r = await this.rest.get<{ items: RawEmoji[] }>(`/applications/${this.getAppId()}/emojis`);
    return r.items.map(fromRaw);
  }

  async create(opts: { name: string; image: Uint8Array | string; mime?: string }): Promise<AppEmoji> {
    const image =
      typeof opts.image === "string" ? opts.image : bytesToDataUri(opts.image, opts.mime ?? "image/png");
    const r = await this.rest.post<RawEmoji>(`/applications/${this.getAppId()}/emojis`, {
      name: opts.name,
      image,
    });
    return fromRaw(r);
  }

  async edit(id: string, patch: { name?: string }): Promise<AppEmoji> {
    const r = await this.rest.patch<RawEmoji>(`/applications/${this.getAppId()}/emojis/${id}`, patch);
    return fromRaw(r);
  }

  async delete(id: string): Promise<void> {
    await this.rest.delete(`/applications/${this.getAppId()}/emojis/${id}`);
  }
}
