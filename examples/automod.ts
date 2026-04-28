// Auto-mod — create a keyword rule that blocks "spamword" in MessageSend events,
// then react to AUTO_MODERATION_ACTION_EXECUTION events.

import { Bot } from "../src/index.js";

const bot = new Bot(process.env.DISCORD_TOKEN!, { intents: 1 << 20 /* AutoModExecution */ });
const guildId = process.env.GUILD_ID!;

bot.on("ready", async () => {
  const rule = await bot.automod(guildId).create({
    name: "Block: spamword",
    triggerType: "Keyword",
    triggerMetadata: { keyword_filter: ["spamword"] },
    actions: [{ kind: "block", customMessage: "Spam not allowed." }],
    enabled: true,
  });
  console.log("rule created:", rule.id);
});

bot.on("autoModActionExecute", (info) => {
  console.log(
    `automod fired: user=${info.userId} keyword=${info.matchedKeyword ?? "?"} content=${info.content ?? ""}`,
  );
});

await bot.start();
