// Run: DISCORD_TOKEN=xxx npm run example:ping
import { Bot } from "../src/index.js";

const token = process.env.DISCORD_TOKEN;
if (!token) throw new Error("set DISCORD_TOKEN env var");

const bot = new Bot(token);

bot.on("ready", (me) => {
  console.log(`logged in as ${me.name} (${me.id})`);
});

bot.on("message", async (m) => {
  if (m.content === "!ping") {
    await m.reply("pong");
  }
});

bot.on("error", (e) => console.error(e));

await bot.start();
