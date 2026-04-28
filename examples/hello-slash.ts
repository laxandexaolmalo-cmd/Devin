// Run: DISCORD_TOKEN=xxx GUILD_ID=xxx npm run example:hello
import { Bot } from "../src/index.js";

const token = process.env.DISCORD_TOKEN;
const guildId = process.env.GUILD_ID; // optional — instant deploy in dev
if (!token) throw new Error("set DISCORD_TOKEN env var");

const bot = new Bot(token);

bot.command(
  "hello",
  {
    description: "Say hi back",
    guildId,
    options: [
      { name: "name", description: "Who to greet", type: "String", required: false },
    ],
  },
  async (ctx) => {
    const name = ctx.opt<string>("name") ?? ctx.user.name;
    await ctx.reply(`Hi ${name}! 👋`);
  },
);

bot.command(
  "ping",
  { description: "Replies with pong", guildId },
  (ctx) => ctx.reply({ content: "pong", ephemeral: true }),
);

bot.on("ready", (me) => console.log("ready as", me.name));
bot.on("error", (e) => console.error(e));

await bot.start();
