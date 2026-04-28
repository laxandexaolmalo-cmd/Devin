// Moderation: kick, ban, timeout, role assign — methods straight on the member.
// Run: DISCORD_TOKEN=xxx GUILD_ID=yyy node --import tsx/esm examples/moderation.ts
import { Bot, Permissions } from "../src/index.js";

const bot = new Bot(process.env.DISCORD_TOKEN!);
const guildId = process.env.GUILD_ID;

bot.command(
  "mute",
  {
    description: "Time-out a member",
    options: [
      { name: "user", description: "Who", type: "User", required: true },
      { name: "minutes", description: "How long (1..40320)", type: "Integer", required: true, min_value: 1, max_value: 40320 },
      { name: "reason", description: "Why", type: "String" },
    ],
    defaultPermissions: Permissions.build("ModerateMembers"),
    guildId,
  },
  async (ctx) => {
    const m = ctx.optMember("user");
    if (!m) return ctx.reply({ content: "User not in guild", ephemeral: true });
    await m.timeout(ctx.optInt("minutes")! * 60, ctx.optString("reason"));
    return ctx.reply(`⏲️ Timed out ${m.name} for ${ctx.optInt("minutes")}m`);
  },
);

bot.command(
  "kick",
  {
    description: "Kick a member",
    options: [
      { name: "user", description: "Who", type: "User", required: true },
      { name: "reason", description: "Why", type: "String" },
    ],
    defaultPermissions: Permissions.build("KickMembers"),
    guildId,
  },
  async (ctx) => {
    const m = ctx.optMember("user");
    if (!m) return ctx.reply({ content: "User not in guild", ephemeral: true });
    await m.kick(ctx.optString("reason"));
    return ctx.reply(`👢 Kicked ${m.name}`);
  },
);

// Right-click on a user → Apps → "Get Avatar"
bot.userCommand("Get Avatar", { guildId }, (ctx) =>
  ctx.reply({ content: ctx.target.avatarUrl(512), ephemeral: true }),
);

bot.on("guildMemberAdd", async (m) => {
  const channelId = process.env.WELCOME_CHANNEL_ID;
  if (!channelId) return;
  const ch = await bot.fetchChannel(channelId);
  await ch.send(`Welcome ${m.mention}! 🎉`);
});

bot.on("ready", (me) => console.log("ready as", me.name));
await bot.start();
