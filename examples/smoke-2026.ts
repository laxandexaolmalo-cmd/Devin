// Smoke test for 2026 changelog items: Search Guild Messages + structured RestError.

import { Bot, RestError, DiscordErrorCodes } from "../src/index.js";

const token = process.env.DISCORD_TOKEN;
if (!token) throw new Error("set DISCORD_TOKEN");
const guildId = process.env.GUILD_ID ?? "1360880151478534204";

const bot = new Bot(token, { debug: false, intents: 0 });

bot.on("ready", async (me) => {
  console.log(`[ready] ${me.name} (${me.id})`);
  const guild = await bot.fetchGuild(guildId);

  // Search Guild Messages (2026)
  try {
    const r = await guild.searchMessages({ content: "supa", limit: 5 });
    console.log(`[search] hits=${r.messages.length} total=${r.totalResults} indexBuilding=${r.doingDeepHistoricalIndex}`);
    for (const m of r.messages) console.log(`  - "${m.content.slice(0, 80)}" by ${m.author?.username}`);
  } catch (e) {
    if (e instanceof RestError) {
      console.log(`[search] RestError caught:`);
      console.log(`  code=${e.code} kind=${e.meta?.kind ?? "(unmapped)"} status=${e.status}`);
      console.log(`  meaning: ${e.meta?.meaning ?? "(none)"}`);
      console.log(`  fix:     ${e.meta?.fix ?? "(none)"}`);
      console.log(`  full message:\n${e.message.split("\n").map((l) => "    " + l).join("\n")}`);
    } else throw e;
  }

  // Trigger an intentional permission error to demo error mapping
  try {
    await bot.rest.delete(`/channels/0/messages/0`);
  } catch (e) {
    if (e instanceof RestError) {
      console.log(`[demo-error] code=${e.code} kind=${e.meta?.kind ?? "(unmapped)"}`);
      console.log(`  ${e.message.replace(/\n/g, "\n  ")}`);
    }
  }

  console.log(`[error-map] ${Object.keys(DiscordErrorCodes).length} error codes mapped`);
  await bot.stop();
});

await bot.start();
