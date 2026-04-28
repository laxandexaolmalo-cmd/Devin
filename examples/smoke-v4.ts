// Smoke test for v0.4 native-Discord features. Read-only where possible.

import { Bot } from "../src/index.js";

const token = process.env.DISCORD_TOKEN;
if (!token) throw new Error("set DISCORD_TOKEN");
const guildId = process.env.GUILD_ID ?? "1360880151478534204";

const bot = new Bot(token, { debug: true, intents: 0 });

bot.on("ready", async (me) => {
  console.log(`[ready] ${me.name} (${me.id})`);

  const guild = await bot.fetchGuild(guildId);
  console.log(`[guild] ${guild.name} (${guild.id})`);

  // Onboarding
  try {
    const onb = await guild.onboarding.fetch();
    console.log(`[onboarding] enabled=${onb.enabled} mode=${onb.mode} prompts=${onb.prompts.length}`);
  } catch (e) { console.log(`[onboarding] error: ${(e as Error).message}`); }

  // Welcome screen
  try {
    const ws = await guild.fetchWelcomeScreen();
    console.log(`[welcomeScreen] desc="${ws.description ?? ""}" channels=${ws.channels.length}`);
  } catch (e) { console.log(`[welcomeScreen] (none or no perm): ${(e as Error).message}`); }

  // Widget
  try {
    const w = await guild.fetchWidgetSettings();
    console.log(`[widget] enabled=${w.enabled}`);
  } catch (e) { console.log(`[widget] error: ${(e as Error).message}`); }

  // Active threads
  try {
    const at = await guild.fetchActiveThreads();
    console.log(`[activeThreads] ${at.threads.length} thread(s)`);
  } catch (e) { console.log(`[activeThreads] error: ${(e as Error).message}`); }

  // Voice regions
  try {
    const r = await guild.fetchVoiceRegions();
    console.log(`[voiceRegions] ${r.length} region(s) (sample: ${r[0]?.name})`);
  } catch (e) { console.log(`[voiceRegions] error: ${(e as Error).message}`); }

  // Vanity URL
  try {
    const v = await guild.fetchVanityUrl();
    console.log(`[vanityUrl] code=${v.code ?? "(none)"} uses=${v.uses}`);
  } catch (e) { console.log(`[vanityUrl] error (boost level): ${(e as Error).message}`); }

  // Stickers
  try {
    const stickers = await guild.stickers.list();
    console.log(`[stickers] ${stickers.length} guild sticker(s)`);
  } catch (e) { console.log(`[stickers] error: ${(e as Error).message}`); }

  // Sticker packs (global, no scope)
  try {
    const packs = await bot.fetchStickerPacks();
    console.log(`[stickerPacks] ${packs.length} pack(s) (sample: ${packs[0]?.name})`);
  } catch (e) { console.log(`[stickerPacks] error: ${(e as Error).message}`); }

  // SKUs (monetization)
  try {
    const skus = await bot.skus.list();
    console.log(`[skus] ${skus.length} SKU(s)`);
  } catch (e) { console.log(`[skus] error: ${(e as Error).message}`); }

  // Entitlements
  try {
    const ents = await bot.entitlements.list({ limit: 5 });
    console.log(`[entitlements] ${ents.length} entitlement(s)`);
  } catch (e) { console.log(`[entitlements] error: ${(e as Error).message}`); }

  // Role connection metadata (linked roles)
  try {
    const m = await bot.roleConnections.list();
    console.log(`[roleConnections] ${m.length} metadata field(s)`);
  } catch (e) { console.log(`[roleConnections] error: ${(e as Error).message}`); }

  // App command perms
  try {
    const perms = await bot.fetchCommandPermissions(guildId);
    console.log(`[cmdPerms] ${perms.length} per-command perm overrides`);
  } catch (e) { console.log(`[cmdPerms] error: ${(e as Error).message}`); }

  bot.debug.dump();
  await bot.stop();
});

await bot.start();
