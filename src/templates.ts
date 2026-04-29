// Guild Templates — snapshot a guild's channels/roles/settings as a reusable
// template, then spawn new guilds from it.
//
// Two surfaces:
//   - Top-level (`bot.templates`): fetch a public template by code, or create
//     a brand-new guild from a template. No guildId required.
//   - Per-guild (`guild.templates`): list/create/sync/edit/delete templates
//     attached to a specific guild.
//
// Source: https://docs.discord.com/developers/resources/guild-template

import type { Rest } from "./rest.js";
import type { RawGuild, RawTemplate } from "./types.js";

export interface GuildTemplate {
  code: string;
  name: string;
  description: string | null;
  usageCount: number;
  creatorId: string;
  createdAt: Date;
  updatedAt: Date;
  sourceGuildId: string;
  /** Raw serialized guild snapshot — channels, roles, system settings. */
  serializedSourceGuild: Record<string, unknown>;
  /** True when the source guild has changed since the template was last synced. */
  isDirty: boolean | null;
  raw: RawTemplate;
}

function fromRaw(r: RawTemplate): GuildTemplate {
  return {
    code: r.code,
    name: r.name,
    description: r.description,
    usageCount: r.usage_count,
    creatorId: r.creator_id,
    createdAt: new Date(r.created_at),
    updatedAt: new Date(r.updated_at),
    sourceGuildId: r.source_guild_id,
    serializedSourceGuild: r.serialized_source_guild,
    isDirty: r.is_dirty,
    raw: r,
  };
}

/**
 * Top-level template helper. Lives on `bot.templates`.
 *   await bot.templates.fetch("HnbtnUzMTRgs");
 *   await bot.templates.createGuild("HnbtnUzMTRgs", { name: "My Server" });
 */
export class Templates {
  constructor(private rest: Rest) {}

  /** Fetch a public template by its share code (e.g. `discord.new/<code>`). */
  async fetch(code: string): Promise<GuildTemplate> {
    const r = await this.rest.get<RawTemplate>(`/guilds/templates/${code}`);
    return fromRaw(r);
  }

  /**
   * Create a brand-new guild from a template code. Bots can only do this when
   * they are in fewer than 10 guilds.
   * Source: https://docs.discord.com/developers/resources/guild-template#create-guild-from-guild-template
   */
  async createGuild(code: string, opts: { name: string; icon?: string }): Promise<RawGuild> {
    return this.rest.post<RawGuild>(`/guilds/templates/${code}`, {
      name: opts.name,
      icon: opts.icon,
    });
  }
}

/**
 * Per-guild template helper. Lives on `guild.templates`.
 *   await guild.templates.list();
 *   const t = await guild.templates.create({ name: "Welcome kit" });
 *   await guild.templates.sync(t.code);
 *   await guild.templates.edit(t.code, { name: "Welcome kit v2" });
 *   await guild.templates.delete(t.code);
 */
export class GuildTemplates {
  constructor(private guildId: string, private rest: Rest) {}

  /** List all templates attached to this guild. */
  async list(): Promise<GuildTemplate[]> {
    const arr = await this.rest.get<RawTemplate[]>(`/guilds/${this.guildId}/templates`);
    return arr.map(fromRaw);
  }

  /** Snapshot the current guild as a new template. */
  async create(opts: { name: string; description?: string | null }): Promise<GuildTemplate> {
    const r = await this.rest.post<RawTemplate>(`/guilds/${this.guildId}/templates`, {
      name: opts.name,
      description: opts.description,
    });
    return fromRaw(r);
  }

  /** Refresh an existing template to match the current guild state. */
  async sync(code: string): Promise<GuildTemplate> {
    const r = await this.rest.put<RawTemplate>(`/guilds/${this.guildId}/templates/${code}`);
    return fromRaw(r);
  }

  /** Edit a template's name or description. */
  async edit(code: string, opts: { name?: string; description?: string | null }): Promise<GuildTemplate> {
    const r = await this.rest.patch<RawTemplate>(`/guilds/${this.guildId}/templates/${code}`, {
      name: opts.name,
      description: opts.description,
    });
    return fromRaw(r);
  }

  /** Delete a template. */
  async delete(code: string): Promise<GuildTemplate> {
    const r = await this.rest.delete<RawTemplate>(`/guilds/${this.guildId}/templates/${code}`);
    return fromRaw(r);
  }
}
