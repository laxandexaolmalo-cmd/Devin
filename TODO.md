# Supa.js — Remaining Coverage TODO

Tracked against the official Discord API docs
(<https://docs.discord.com/developers/reference>, `llms.txt` index, and
<https://github.com/discord/discord-api-docs>). Last reviewed: **2026-04**.

Legend: `[ ]` not started · `[~]` partial · `[x]` done · `[!]` explicit non-goal

---

## Moderation

- [ ] **Bulk Ban Members** — `POST /guilds/{guild.id}/bulk-ban`
  - Added 2024-Q3. Body: `{ user_ids: string[], delete_message_seconds?: number }`.
  - Returns `{ banned_users: string[], failed_users: string[] }`.
  - Proposed API: `guild.bulkBan({ userIds, deleteMessageSeconds?, reason? })`.

- [ ] **Guild Prune** — inactive-member cleanup
  - `GET /guilds/{id}/prune?days=&include_roles=` → `{ pruned: number }`
  - `POST /guilds/{id}/prune` with `{ days, compute_prune_count, include_roles, reason }`
  - Proposed API: `guild.getPruneCount({ days, includeRoleIds? })`,
    `guild.beginPrune({ days, computePruneCount?, includeRoleIds?, reason? })`.

- [ ] **Guild Incidents / Safety Alerts** (2024-Q2)
  - `PUT /guilds/{id}/incident-actions`
    body `{ invites_disabled_until?: ISOString|null, dms_disabled_until?: ISOString|null }`
  - Proposed API: `guild.setIncidentActions({ invitesDisabledUntil?, dmsDisabledUntil? })`.
  - Also surface `raw.incidents_data` on Guild.

---

## Guild admin

- [ ] **Guild Templates** — full CRUD + spawn from template
  - `GET /guilds/templates/{code}` (get template)
  - `POST /guilds/templates/{code}` (create guild from template)
  - `GET /guilds/{id}/templates` (list)
  - `POST /guilds/{id}/templates` (create)
  - `PUT /guilds/{id}/templates/{code}` (sync)
  - `PATCH /guilds/{id}/templates/{code}` (modify)
  - `DELETE /guilds/{id}/templates/{code}` (delete)
  - Proposed API: `bot.templates.fetch(code)`, `bot.templates.createGuild(code, {...})`,
    `guild.templates.list()/create()/sync(code)/edit(code, {...})/delete(code)`.

- [ ] **Guild Integrations**
  - `GET /guilds/{id}/integrations` (list)
  - `DELETE /guilds/{id}/integrations/{id}` (delete)
  - Proposed API: `guild.fetchIntegrations()`, `guild.deleteIntegration(id, reason?)`.
  - Also surface INTEGRATION_CREATE/UPDATE/DELETE gateway events.

---

## Application / OAuth

- [ ] **Application Info get/edit** — `GET/PATCH /applications/@me`
  - Currently only reachable via `bot.rest.get/patch("/applications/@me", ...)`.
  - Proposed API:
    `bot.fetchApplication()` → `{ id, name, description, icon, flags, tags,
    installParams, integrationTypesConfig, customInstallUrl, roleConnectionsVerificationUrl, ... }`.
    `bot.editApplication({ description?, icon?, coverImage?, flags?, tags?, installParams?, customInstallUrl?, interactionsEndpointUrl?, roleConnectionsVerificationUrl? })`.

- [ ] **OAuth2 `@me` authorization info** — `GET /oauth2/@me`
  - Useful for bots that act on behalf of users via bearer token.
  - Proposed API: `bot.fetchOwnAuthorization(bearerToken)`.

- [ ] **Get Current Bot Application + Activity Instance**
  - `GET /activities/{application_id}/{instance_id}` (Activities SDK handshake).
  - Probably skip — not a bot concern.

---

## Slash commands

- [~] **Localizations helper**
  - Raw fields already accepted (`name_localizations`, `description_localizations`,
    option `name_localizations`/`description_localizations`).
  - Missing: ergonomic helper to declare locale tables once, validate keys against
    Discord's locale list, and fan them out across options.
  - Proposed API:
    ```ts
    bot.command("hello", {
      description: "Say hi",
      localize: {
        name: { id: "halo" },
        description: { id: "Sapa seseorang" },
      },
    }, ...)
    ```

---

## DM

- [ ] **Get Current User DMs** — `GET /users/@me/channels` (bot-side, niche)
  - Bots usually don't need this; include only if user-type token support is wanted.

---

## Voice

- [!] **Voice send/receive (UDP + Opus + libsodium)** — explicitly out of scope.
  Requires `~2000 LOC` + native deps. Use a separate library; Supa.js exposes
  `voiceStateUpdate` + `voiceServerUpdate` events so a voice lib can attach.

- [!] **Discord Social SDK / RPC-over-IPC** — not a bot concern; out of scope.

---

## Internal polish (non-API)

- [ ] Re-export `AutoModTrigger`/`AutoModAction` helpers object-literal style (currently
  object-literal works but no typed convenience shapes).
- [ ] Add `guild.fetchBan(userId)` single-ban fetch (only list available today).
- [ ] Add `channel.fetchFollowers()` — `GET /channels/{id}/followers` (if Discord
  exposes for bots; verify in docs).
- [ ] Expand `DiscordErrorCodes` map to 60+ entries (currently 30). Candidates:
  - `30001` MaxGuilds
  - `30003` MaxFriends
  - `30005` MaxRoles
  - `30007` MaxWebhooks
  - `30008` MaxEmojis
  - `30010` MaxReactions
  - `30013` MaxGuildChannels
  - `30015` MaxAttachmentsInMessage
  - `30016` MaxInvitesInGuild
  - `30018` MaxAnimatedEmojis
  - `30019` MaxServerMembers
  - `30030` MaxServerCategories
  - `30035` MaxBansPerUser
  - `30038` MaxBanFetchesPerMinute
  - `30042` MaxPremiumEmojis
  - `30046` MaxMessagesPinned
  - `40001` Unauthorized
  - `40002` AccountVerificationRequired
  - `40003` OpeningDmsTooFast
  - `40007` UserBannedFromGuild
  - `40033` MessageAlreadyCrossposted
  - `40041` ApplicationCommandNameExists
  - `40058` InteractionFailedToSend
  - `50019` MessageCannotBeEditedDueToAnnouncementRateLimits
  - `50027` InvalidWebhookToken
  - `50033` InvalidRecipients
  - `50054` CannotSelfRedeemGift
  - `50068` InvalidMessageType
  - `50080` CannotCreateForumPostWithoutInitialMessage
  - `50081` InvalidStickerSent
  - `160002` InvalidActivityAction
  - `170001` MaxAppEmojis
  - `180000` CannotSendVoiceMessageInThisChannel
  - `180002` VoiceMessageMustHaveSingleAudioAttachment

- [ ] Add a machine-readable `DiscordErrorCodes.toJSON()` / index export so AI tooling
  can dump the whole table.

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
