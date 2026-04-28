// Rich embeds + file attachments.
// Run: DISCORD_TOKEN=xxx GUILD_ID=yyy node --import tsx/esm examples/embeds-files.ts
import { readFileSync } from "node:fs";
import { Bot } from "../src/index.js";

const bot = new Bot(process.env.DISCORD_TOKEN!);

bot.command("card", { description: "Show a card embed", guildId: process.env.GUILD_ID }, async (ctx) => {
  await ctx.reply({
    embeds: [
      {
        title: "Status: All systems operational",
        description: "Last check: just now.",
        color: 0x57f287,
        fields: [
          { name: "API", value: "✅ 42ms", inline: true },
          { name: "Gateway", value: "✅ 18ms", inline: true },
          { name: "DB", value: "✅ 3ms", inline: true },
        ],
        footer: { text: "Supa.js" },
        timestamp: new Date().toISOString(),
      },
    ],
  });
});

bot.command("upload", { description: "Send a file" }, async (ctx) => {
  await ctx.defer();
  const data = Buffer.from("Hello from Supa.js!\n", "utf8");
  await ctx.editReply({
    content: "Here's a file:",
    files: [{ name: "hello.txt", data, type: "text/plain", description: "greeting" }],
  });
});

bot.on("ready", (me) => console.log("ready as", me.name));
await bot.start();
