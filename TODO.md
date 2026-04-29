# Supa.js — Remaining Coverage TODO

Tracked against the official Discord API docs
(<https://docs.discord.com/developers/reference>, `llms.txt` index, and
<https://github.com/discord/discord-api-docs>). Last reviewed: **2026-04**.

Legend: `[ ]` not started · `[~]` partial · `[x]` done · `[!]` explicit non-goal

---

## Moderation

- [x] **Bulk Ban Members** — `POST /guilds/{guild.id}/bulk-ban`
  - Added 2024-Q3. Body: `{ user_ids: string[], delete_message_seconds?: number }`.
  - Returns `{ banned_users: string[], failed_users: string[] }`.
  - Implemented as `guild.bulkBan({ userIds, deleteMessageSeconds?, reason? })`.

- [x] **Guild Prune** — inactive-member cleanup
  - `GET /guilds/{id}/prune?days=&include_roles=` → `{ pruned: number }`
  - `POST /guilds/{id}/prune` with `{ days, compute_prune_count, include_roles, reason }`
  - Implemented as `guild.getPruneCount({ days?, includeRoleIds? })`,
    `guild.beginPrune({ days?, computePruneCount?, includeRoleIds?, reason? })`.

- [x] **Guild Incidents / Safety Alerts** (2024-Q2)
  - `PUT /guilds/{id}/incident-actions`
    body `{ invites_disabled_until?: ISOString|null, dms_disabled_until?: ISOString|null }`
  - Implemented as `guild.setIncidentActions({ invitesDisabledUntil?, dmsDisabledUntil?, reason? })`.
    Accepts `Date | string | null`.

---

## Guild admin

- [x] **Guild Templates** — full CRUD + spawn from template
  - `GET /guilds/templates/{code}` (get template) → `bot.templates.fetch(code)`
  - `POST /guilds/templates/{code}` (create guild from template) → `bot.templates.createGuild(code, {...})`
  - `GET /guilds/{id}/templates` (list) → `guild.templates.list()`
  - `POST /guilds/{id}/templates` (create) → `guild.templates.create({ name, description? })`
  - `PUT /guilds/{id}/templates/{code}` (sync) → `guild.templates.sync(code)`
  - `PATCH /guilds/{id}/templates/{code}` (modify) → `guild.templates.edit(code, {...})`
  - `DELETE /guilds/{id}/templates/{code}` (delete) → `guild.templates.delete(code)`

- [x] **Guild Integrations**
  - `GET /guilds/{id}/integrations` → `guild.fetchIntegrations()`
  - `DELETE /guilds/{id}/integrations/{id}` → `guild.deleteIntegration(id, reason?)`
  - Gateway events: `integrationCreate` / `integrationUpdate` / `integrationDelete`.

---

## Application / OAuth

- [x] **Application Info get/edit** — `GET/PATCH /applications/@me`
  - `bot.fetchApplication()` → `RawApplication`.
  - `bot.editApplication({ description?, icon?, coverImage?, flags?, tags?, installParams?,
    integrationTypesConfig?, customInstallUrl?, interactionsEndpointUrl?,
    roleConnectionsVerificationUrl?, eventWebhooksUrl?, eventWebhooksStatus?, eventWebhooksTypes? })`.

- [x] **OAuth2 `@me` authorization info** — `GET /oauth2/@me`
  - `bot.fetchOwnAuthorization(bearerToken)` → `{ application, scopes, expires, user? }`.

- [!] **Get Current Bot Application + Activity Instance**
  - `GET /activities/{application_id}/{instance_id}` (Activities SDK handshake).
  - Skipped — not a bot concern.

---

## Slash commands

- [x] **Localizations helper**
  - Raw fields still accepted (`name_localizations`, `description_localizations`).
  - Ergonomic helper: `localize: { name?: LocaleTable, description?: LocaleTable }` on
    every `CommandDef` / `UserCommandDef` / `MessageCommandDef` and per `CommandOption`.
    Per-choice localization via `choices[i].nameLocalizations`.
  - Typed `Locale` enum + `Locales` array exported. `validateLocaleTable()` runtime check.
  - Example:
    ```ts
    bot.command("hello", {
      description: "Say hi",
      localize: {
        name: { id: "halo", "es-ES": "hola" },
        description: { id: "Sapa seseorang", "es-ES": "Saluda a alguien" },
      },
    }, async (ctx) => { await ctx.reply("hi!"); });
    ```

---

## DM

- [!] **Get Current User DMs** — `GET /users/@me/channels` (user-token only)
  - Bots can't list DMs (endpoint requires a user token); skipped.

---

## Voice

- [!] **Voice send/receive (UDP + Opus + libsodium)** — explicitly out of scope.
  Requires `~2000 LOC` + native deps. Use a separate library; Supa.js exposes
  `voiceStateUpdate` + `voiceServerUpdate` events so a voice lib can attach.

- [!] **Discord Social SDK / RPC-over-IPC** — not a bot concern; out of scope.

---

## Internal polish (non-API)

- [x] Typed object-literal helpers `AutoModTrigger.{keyword,spam,keywordPreset,mentionSpam,memberProfile}`
  and `AutoModAction.{block,alert,timeout}`.
- [x] `guild.fetchBan(userId)` — single-ban fetch (returns `null` for not-banned, instead of throwing 10026).
- [!] `channel.fetchFollowers()` — Discord does **not** expose `GET /channels/{id}/followers` to
  bots; only `POST .../followers` exists (already implemented as `channel.follow()`). Skipped.
- [x] Expanded `DiscordErrorCodes` map to 100+ entries with curated `meaning` / `fix` per code.
- [x] Added `discordErrorCodesToJSON()` exporter so AI tooling can dump the whole table
  (returns `Array<DiscordErrorMeta & { code }>`).

---

## Changelog watch (next review cadence)

Re-check monthly against:
1. <https://docs.discord.com/developers/docs/changelog>
2. <https://github.com/discord/discord-api-docs/commits/main>
3. <https://docs.discord.com/llms.txt>

Open items spotted but unverified:
- Attachment `.title` / `.description` editable post-upload (mentioned in PR #7353) —
  needs confirmation if `PATCH` on message attachments is bot-accessible.
- Message `editedTimestamp` nullable semantics for forwarded messages — current code
  passes through raw, double-check spec.
- Any new Components V2 layouts added after 2026-04 (TextDisplay variants, etc.).
