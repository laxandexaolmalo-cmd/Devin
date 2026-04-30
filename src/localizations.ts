// Slash-command localizations.
//
// Discord lets you provide per-locale `name_localizations` and
// `description_localizations` on commands and options. Raw fields work, but the
// dotted keys (`en-US`, `pt-BR`, `zh-CN`, …) are easy to typo, so we expose a
// typed `Locale` enum and a `localize` helper that fans a single locale table
// out across both `name` and `description`.
//
// Source: https://docs.discord.com/developers/interactions/application-commands#localization

/**
 * Discord-supported locale codes. Last reviewed 2026-04 against
 * https://docs.discord.com/developers/reference#locales
 */
export const Locales = [
  "id",
  "da",
  "de",
  "en-GB",
  "en-US",
  "es-ES",
  "es-419",
  "fr",
  "hr",
  "it",
  "lt",
  "hu",
  "nl",
  "no",
  "pl",
  "pt-BR",
  "ro",
  "fi",
  "sv-SE",
  "vi",
  "tr",
  "cs",
  "el",
  "bg",
  "ru",
  "uk",
  "hi",
  "th",
  "zh-CN",
  "ja",
  "zh-TW",
  "ko",
] as const;

export type Locale = (typeof Locales)[number];

/** Per-locale string table. Pass only the locales you want to override. */
export type LocaleTable = Partial<Record<Locale, string>>;

/**
 * Localizations for a command (or option). Either or both of `name` and
 * `description` may be supplied.
 */
export interface Localize {
  name?: LocaleTable;
  description?: LocaleTable;
}

/**
 * Validate a locale-keyed table at runtime — throws on unknown locale keys.
 * Returns the same object on success (so it can be assigned inline).
 */
export function validateLocaleTable<T extends LocaleTable | undefined>(table: T, fieldLabel: string): T {
  if (!table) return table;
  const allowed = new Set<string>(Locales);
  for (const k of Object.keys(table)) {
    if (!allowed.has(k)) {
      throw new Error(
        `Supa.js: localize.${fieldLabel}: unknown locale "${k}". ` +
          `Allowed: ${Locales.join(", ")}`,
      );
    }
  }
  return table;
}
