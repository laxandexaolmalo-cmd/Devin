// Demo of the 2026-04 admin/moderation API additions:
//   - guild.bulkBan / fetchBan / getPruneCount / beginPrune / setIncidentActions
//   - guild.fetchIntegrations / deleteIntegration  (+ INTEGRATION_* events)
//   - guild.templates.* + bot.templates.* (Guild Templates CRUD)
//   - bot.fetchApplication / editApplication
//   - AutoModTrigger / AutoModAction object-literal helpers
//   - Slash command localizations via `localize: { name, description }`
//
// Run: DISCORD_TOKEN=xxx GUILD_ID=yyy node --import tsx/esm examples/admin-2026.ts

import {
  Bot,
  Permissions,
  AutoModTrigger,
  AutoModAction,
  discordErrorCodesToJSON,
} from "../src/index.js";

const bot = new Bot(process.env.DISCORD_TOKEN!);
const guildId = process.env.GUILD_ID;
if (!guildId) throw new Error("set GUILD_ID");

// ── Slash command with localizations + per-choice locale labels ──────────
bot.command(
  "hello",
  {
    description: "Say hi",
    localize: {
      name: { id: "halo", "es-ES": "hola", "fr": "salut" },
      description: { id: "Sapa seseorang", "es-ES": "Saluda a alguien" },
    },
    options: [
      {
        name: "lang",
        description: "Pick a language",
        type: "String",
        required: false,
        localize: {
          name: { id: "bahasa" },
          description: { id: "Pilih bahasa" },
        },
        choices: [
          { name: "English", value: "en", nameLocalizations: { id: "Inggris" } },
          { name: "Indonesian", value: "id", nameLocalizations: { id: "Indonesia" } },
        ],
      },
    ],
    guildId,
  },
  async (ctx) => {
    const lang = ctx.optString("lang") ?? "en";
    await ctx.reply(lang === "id" ? "Halo!" : "Hello!");
  },
);

// ── Bulk ban (up to 200 in one call) ──────────────────────────────────────
bot.command(
  "purge-raid",
  {
    description: "Bulk-ban a list of raid accounts",
    options: [
      { name: "ids", description: "comma-separated user ids", type: "String", required: true },
    ],
    defaultPermissions: Permissions.build("BanMembers", "ManageGuild"),
    guildId,
  },
  async (ctx) => {
    const guild = await bot.fetchGuild(ctx.guildId!);
    const ids = ctx.optString("ids")!.split(/[,\s]+/).filter(Boolean);
    const r = await guild.bulkBan({
      userIds: ids,
      deleteMessageSeconds: 60 * 60,
      reason: "raid cleanup",
    });
    await ctx.reply({
      content: `banned: ${r.bannedUsers.length}, failed: ${r.failedUsers.length}`,
      ephemeral: true,
    });
  },
);

// ── fetchBan returns null instead of throwing 10026 ───────────────────────
bot.command(
  "is-banned",
  {
    description: "Check if a user is banned",
    options: [{ name: "user", description: "Who", type: "User", required: true }],
    defaultPermissions: Permissions.build("BanMembers"),
    guildId,
  },
  async (ctx) => {
    const guild = await bot.fetchGuild(ctx.guildId!);
    const ban = await guild.fetchBan(ctx.optString("user")!);
    await ctx.reply({
      content: ban ? `banned (reason: ${ban.reason ?? "—"})` : "not banned",
      ephemeral: true,
    });
  },
);

// ── Prune dry-run + execute ───────────────────────────────────────────────
bot.command(
  "prune-preview",
  {
    description: "Preview how many inactive members would be pruned",
    options: [
      { name: "days", description: "1..30", type: "Integer", required: true, min_value: 1, max_value: 30 },
    ],
    defaultPermissions: Permissions.build("KickMembers"),
    guildId,
  },
  async (ctx) => {
    const guild = await bot.fetchGuild(ctx.guildId!);
    const r = await guild.getPruneCount({ days: ctx.optInt("days")! });
    await ctx.reply({ content: `would prune ${r.pruned} members`, ephemeral: true });
  },
);

// ── Incident actions: pause invites for 30min ─────────────────────────────
bot.command(
  "lockdown",
  {
    description: "Pause invites for 30 minutes (raid response)",
    defaultPermissions: Permissions.build("ManageGuild"),
    guildId,
  },
  async (ctx) => {
    const guild = await bot.fetchGuild(ctx.guildId!);
    const until = new Date(Date.now() + 30 * 60_000);
    const r = await guild.setIncidentActions({ invitesDisabledUntil: until, reason: "lockdown" });
    await ctx.reply({
      content: `invites paused until ${r.invitesDisabledUntil}`,
      ephemeral: true,
    });
  },
);

// ── Guild integrations ────────────────────────────────────────────────────
bot.command(
  "integrations",
  {
    description: "List third-party integrations",
    defaultPermissions: Permissions.build("ManageGuild"),
    guildId,
  },
  async (ctx) => {
    const guild = await bot.fetchGuild(ctx.guildId!);
    const list = await guild.fetchIntegrations();
    const lines = list.map((i) => `• ${i.type} — ${i.name} (${i.account.name})`);
    await ctx.reply({ content: lines.join("\n") || "(none)", ephemeral: true });
  },
);

bot.on("integrationCreate", (e) => console.log("integration added in", e.guildId));
bot.on("integrationDelete", (e) => console.log("integration removed", e.id, "in", e.guildId));

// ── Guild templates ───────────────────────────────────────────────────────
bot.command(
  "snapshot",
  {
    description: "Save a template of this guild's structure",
    options: [{ name: "name", description: "template name", type: "String", required: true }],
    defaultPermissions: Permissions.build("ManageGuild"),
    guildId,
  },
  async (ctx) => {
    const guild = await bot.fetchGuild(ctx.guildId!);
    const t = await guild.templates.create({ name: ctx.optString("name")! });
    await ctx.reply({
      content: `template created — code: \`${t.code}\` (share: discord.new/${t.code})`,
      ephemeral: true,
    });
  },
);

// ── AutoMod typed helpers ─────────────────────────────────────────────────
bot.command(
  "auto-mod-setup",
  {
    description: "Create a basic auto-mod rule",
    defaultPermissions: Permissions.build("ManageGuild"),
    guildId,
  },
  async (ctx) => {
    const guild = await bot.fetchGuild(ctx.guildId!);
    const rule = await guild.automod.create({
      name: "block bad words",
      ...AutoModTrigger.keyword({ keywords: ["badword1", "badword2"] }),
      actions: [
        AutoModAction.block({ customMessage: "Watch your language." }),
        AutoModAction.timeout(5 * 60),
      ],
      enabled: true,
    });
    await ctx.reply({ content: `rule created: ${rule.id}`, ephemeral: true });
  },
);

// ── Application info dump ─────────────────────────────────────────────────
bot.command(
  "app-info",
  {
    description: "Show this app's metadata",
    guildId,
  },
  async (ctx) => {
    const app = await bot.fetchApplication();
    await ctx.reply({
      content: `**${app.name}** — ${app.description || "(no description)"}\nguilds: ${app.approximate_guild_count ?? "?"}`,
      ephemeral: true,
    });
  },
);

// ── Demo: dump the full error code table (useful for AI / dashboards) ─────
bot.command(
  "errors-table",
  { description: "Dump the Discord error-code table size", guildId },
  async (ctx) => {
    const all = discordErrorCodesToJSON();
    await ctx.reply({ content: `Supa.js ships ${all.length} curated error codes.`, ephemeral: true });
  },
);

bot.on("ready", (me) => console.log("admin-2026 demo ready as", me.name));
bot.on("error", (e) => console.error(e));

await bot.start();
