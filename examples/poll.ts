// Polls — `/poll` opens a poll, /endpoll expires it early, /voters lists voters.

import { Bot } from "../src/index.js";

const bot = new Bot(process.env.DISCORD_TOKEN!);

bot.command("poll", {
  description: "Start a poll",
  guildId: process.env.GUILD_ID,
  options: [
    { name: "q", description: "question", type: "String", required: true },
    { name: "a", description: "first answer", type: "String", required: true },
    { name: "b", description: "second answer", type: "String", required: true },
    { name: "c", description: "third (optional)", type: "String" },
  ],
}, async (ctx) => {
  const answers = [ctx.optString("a")!, ctx.optString("b")!];
  const c = ctx.optString("c");
  if (c) answers.push(c);
  await ctx.reply({
    poll: { question: ctx.optString("q")!, answers, durationHours: 24, allowMultiselect: false },
  });
});

bot.command("endpoll", {
  description: "End a poll early",
  guildId: process.env.GUILD_ID,
  options: [{ name: "message_id", description: "poll message id", type: "String", required: true }],
}, async (ctx) => {
  const ch = await bot.fetchChannel(ctx.channelId!);
  await ch.expirePoll(ctx.optString("message_id")!);
  await ctx.reply({ content: "Poll ended.", ephemeral: true });
});

bot.on("pollVoteAdd", (info) => {
  console.log(`vote+: user=${info.userId} answer=${info.answerId} msg=${info.messageId}`);
});

await bot.start();
