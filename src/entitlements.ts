// Application monetization — SKUs, entitlements, and test entitlements.
// Lives on Bot via `bot.entitlements` and `bot.skus`.

import type { Rest } from "./rest.js";

export const SkuType = {
  Durable: 2,
  Consumable: 3,
  Subscription: 5,
  SubscriptionGroup: 6,
} as const;

export const EntitlementType = {
  ApplicationSubscription: 8,
  Purchase: 1,
  PremiumSubscription: 2,
  DeveloperGift: 3,
  TestModePurchase: 4,
  FreePurchase: 5,
  UserGift: 6,
  PremiumPurchase: 7,
} as const;

export const EntitlementOwnerType = {
  Guild: 1,
  User: 2,
} as const;

export interface Sku {
  id: string;
  applicationId: string;
  type: number;
  slug: string;
  name: string;
  flags: number;
}
interface RawSku {
  id: string;
  application_id: string;
  type: number;
  slug: string;
  name: string;
  flags: number;
}

export interface Entitlement {
  id: string;
  skuId: string;
  applicationId: string;
  userId?: string;
  guildId?: string;
  type: number;
  deleted: boolean;
  startsAt?: string | null;
  endsAt?: string | null;
  consumed?: boolean;
}
interface RawEnt {
  id: string;
  sku_id: string;
  application_id: string;
  user_id?: string;
  guild_id?: string;
  type: number;
  deleted: boolean;
  starts_at?: string | null;
  ends_at?: string | null;
  consumed?: boolean;
}

function entFromRaw(r: RawEnt): Entitlement {
  return {
    id: r.id,
    skuId: r.sku_id,
    applicationId: r.application_id,
    userId: r.user_id,
    guildId: r.guild_id,
    type: r.type,
    deleted: r.deleted,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    consumed: r.consumed,
  };
}

export class Skus {
  constructor(private getAppId: () => string, private rest: Rest) {}
  async list(): Promise<Sku[]> {
    const arr = await this.rest.get<RawSku[]>(`/applications/${this.getAppId()}/skus`);
    return arr.map((s) => ({
      id: s.id,
      applicationId: s.application_id,
      type: s.type,
      slug: s.slug,
      name: s.name,
      flags: s.flags,
    }));
  }
}

export class Entitlements {
  constructor(private getAppId: () => string, private rest: Rest) {}

  async list(opts: {
    userId?: string;
    skuIds?: string[];
    before?: string;
    after?: string;
    limit?: number;
    guildId?: string;
    excludeEnded?: boolean;
    excludeDeleted?: boolean;
  } = {}): Promise<Entitlement[]> {
    const params = new URLSearchParams();
    if (opts.userId) params.set("user_id", opts.userId);
    if (opts.skuIds?.length) params.set("sku_ids", opts.skuIds.join(","));
    if (opts.before) params.set("before", opts.before);
    if (opts.after) params.set("after", opts.after);
    if (opts.limit) params.set("limit", String(opts.limit));
    if (opts.guildId) params.set("guild_id", opts.guildId);
    if (opts.excludeEnded) params.set("exclude_ended", "true");
    if (opts.excludeDeleted) params.set("exclude_deleted", "true");
    const q = params.toString();
    const arr = await this.rest.get<RawEnt[]>(
      `/applications/${this.getAppId()}/entitlements${q ? `?${q}` : ""}`,
    );
    return arr.map(entFromRaw);
  }

  async fetch(entitlementId: string): Promise<Entitlement> {
    const r = await this.rest.get<RawEnt>(
      `/applications/${this.getAppId()}/entitlements/${entitlementId}`,
    );
    return entFromRaw(r);
  }

  /** Create a TEST entitlement (does not charge users). */
  async createTest(opts: {
    skuId: string;
    ownerId: string;
    ownerType: keyof typeof EntitlementOwnerType | number;
  }): Promise<Entitlement> {
    const r = await this.rest.post<RawEnt>(`/applications/${this.getAppId()}/entitlements`, {
      sku_id: opts.skuId,
      owner_id: opts.ownerId,
      owner_type: typeof opts.ownerType === "string" ? EntitlementOwnerType[opts.ownerType] : opts.ownerType,
    });
    return entFromRaw(r);
  }

  /** Delete a TEST entitlement. */
  async deleteTest(entitlementId: string): Promise<void> {
    await this.rest.delete(`/applications/${this.getAppId()}/entitlements/${entitlementId}`);
  }

  /** Mark a one-time-purchase entitlement as consumed. */
  async consume(entitlementId: string): Promise<void> {
    await this.rest.post(
      `/applications/${this.getAppId()}/entitlements/${entitlementId}/consume`,
    );
  }
}

export interface RoleConnectionMetadataField {
  type: number; // 1..8
  key: string;
  name: string;
  nameLocalizations?: Record<string, string>;
  description: string;
  descriptionLocalizations?: Record<string, string>;
}

export const RoleConnectionMetadataType = {
  IntegerLessThanOrEqual: 1,
  IntegerGreaterThanOrEqual: 2,
  IntegerEqual: 3,
  IntegerNotEqual: 4,
  DateTimeLessThanOrEqual: 5,
  DateTimeGreaterThanOrEqual: 6,
  BooleanEqual: 7,
  BooleanNotEqual: 8,
} as const;

export class RoleConnectionMetadata {
  constructor(private getAppId: () => string, private rest: Rest) {}

  async list(): Promise<RoleConnectionMetadataField[]> {
    const arr = await this.rest.get<{ type: number; key: string; name: string; name_localizations?: Record<string, string>; description: string; description_localizations?: Record<string, string> }[]>(
      `/applications/${this.getAppId()}/role-connections/metadata`,
    );
    return arr.map((r) => ({
      type: r.type,
      key: r.key,
      name: r.name,
      nameLocalizations: r.name_localizations,
      description: r.description,
      descriptionLocalizations: r.description_localizations,
    }));
  }

  async set(fields: RoleConnectionMetadataField[]): Promise<RoleConnectionMetadataField[]> {
    const body = fields.map((f) => ({
      type: f.type,
      key: f.key,
      name: f.name,
      name_localizations: f.nameLocalizations,
      description: f.description,
      description_localizations: f.descriptionLocalizations,
    }));
    const arr = await this.rest.put<typeof body>(
      `/applications/${this.getAppId()}/role-connections/metadata`,
      body,
    );
    return arr.map((r) => ({
      type: r.type,
      key: r.key,
      name: r.name,
      nameLocalizations: r.name_localizations,
      description: r.description,
      descriptionLocalizations: r.description_localizations,
    }));
  }
}
