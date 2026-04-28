// Subcommands + subcommand groups + autocomplete.
// Run: DISCORD_TOKEN=xxx GUILD_ID=yyy node --import tsx/esm examples/subcommands-autocomplete.ts
import { Bot } from "../src/index.js";

const bot = new Bot(process.env.DISCORD_TOKEN!);
const guildId = process.env.GUILD_ID;

const FRUITS = ["apple", "banana", "blueberry", "cherry", "date", "elderberry", "fig", "grape"];

// /fruit pick name:<autocomplete>
bot.command(
  "fruit.pick",
  {
    description: "Pick a fruit",
    options: [
      { name: "name", description: "fruit name", type: "String", required: true, autocomplete: true },
    ],
    guildId,
  },
  (ctx) => ctx.reply(`You picked **${ctx.optString("name")}** 🍎`),
);

// /fruit list
bot.command("fruit.list", { description: "List all fruits", guildId }, (ctx) =>
  ctx.reply({ content: FRUITS.map((f) => `• ${f}`).join("\n"), ephemeral: true }),
);

// /admin user ban target reason
bot.command(
  "admin.user.ban",
  {
    description: "Ban a user",
    options: [
      { name: "target", description: "User to ban", type: "User", required: true },
      { name: "reason", description: "Why?", type: "String", required: false },
    ],
    guildId,
  },
  async (ctx) => {
    const target = ctx.optMember("target");
    if (!target) return ctx.reply({ content: "user not found", ephemeral: true });
    await target.ban({ reason: ctx.optString("reason") ?? "no reason given" });
    return ctx.reply(`Banned ${target.name}`);
  },
);

bot.autocomplete("fruit.pick:name", (ctx) => {
  const q = ctx.focused.value.toLowerCase();
  return ctx.respond(FRUITS.filter((f) => f.startsWith(q)).map((f) => ({ name: f, value: f })));
});

bot.on("ready", (me) => console.log("ready as", me.name));
await bot.start();
