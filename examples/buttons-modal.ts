// Buttons + select + modal end-to-end.
// Run: DISCORD_TOKEN=xxx GUILD_ID=yyy node --import tsx/esm examples/buttons-modal.ts
import {
  Bot,
  row,
  button,
  linkButton,
  stringSelect,
  textInput,
} from "../src/index.js";

const token = process.env.DISCORD_TOKEN;
const guildId = process.env.GUILD_ID;
if (!token) throw new Error("set DISCORD_TOKEN");

const bot = new Bot(token);

bot.command("panel", { description: "Show a panel of buttons", guildId }, async (ctx) => {
  await ctx.reply({
    content: "Pick one:",
    components: [
      row(
        button({ customId: "panel:like", label: "Like", style: "success", emoji: "👍" }),
        button({ customId: "panel:dislike", label: "Dislike", style: "danger", emoji: "👎" }),
        linkButton({ url: "https://discord.com", label: "Discord" }),
      ),
      row(
        stringSelect({
          customId: "panel:lang",
          placeholder: "Pick a language",
          options: [
            { label: "TypeScript", value: "ts", emoji: "💙" },
            { label: "Python", value: "py", emoji: "🐍" },
            { label: "Go", value: "go", emoji: "🦫" },
          ],
        }),
      ),
    ],
  });
});

bot.button("panel:like", (ctx) => ctx.update({ content: "👍 you liked it!", components: [] }));
bot.button("panel:dislike", (ctx) => ctx.update({ content: "👎 noted.", components: [] }));
bot.select("panel:lang", (ctx) => ctx.update({ content: `Picked: ${ctx.values[0]}`, components: [] }));

// Modal example
bot.command("feedback", { description: "Send feedback", guildId }, async (ctx) => {
  await ctx.showModal({
    customId: "feedback:form",
    title: "Send feedback",
    inputs: [
      textInput({ customId: "title", label: "Title", style: "short", required: true, maxLength: 80 }),
      textInput({ customId: "body", label: "Body", style: "paragraph", required: true, maxLength: 2000 }),
    ],
  });
});

bot.modal("feedback:form", async (ctx) => {
  const title = ctx.field("title")!;
  const body = ctx.field("body")!;
  await ctx.reply({ content: `Got it!\n**${title}**\n${body}`, ephemeral: true });
});

bot.on("ready", (me) => console.log("ready as", me.name));
bot.on("error", (e) => console.error(e));
await bot.start();
