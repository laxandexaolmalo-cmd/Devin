// End-to-end smoke for Supa.js v0.3 features against real Discord.
// Tests: ComponentsV2 send/edit/delete, Polls (create+expire), AppEmojis (list),
// Soundboard (defaults), Debugger (events + REST timing).

import {
  Bot,
  button,
  container,
  mediaGallery,
  row,
  section,
  separator,
  textDisplay,
  thumbnail,
} from "../src/index.js";

const token = process.env.DISCORD_TOKEN;
if (!token) throw new Error("set DISCORD_TOKEN");
const guildId = process.env.GUILD_ID ?? "1360880151478534204";
let channelId = process.env.CHANNEL_ID;

const bot = new Bot(token, { debug: true, intents: 0 });

bot.on("ready", async (me) => {
  console.log(`[ready] ${me.name} (${me.id})`);

  // 1) Soundboard defaults — read-only sanity check.
  try {
    const defaults = await bot.soundboard.defaults();
    console.log(`[soundboard] defaults: ${defaults.length} sounds`);
  } catch (e) {
    console.log(`[soundboard] error: ${(e as Error).message}`);
  }

  // 2) AppEmojis list.
  try {
    const emojis = await bot.emojis.list();
    console.log(`[appEmojis] ${emojis.length} application emoji(s)`);
  } catch (e) {
    console.log(`[appEmojis] error: ${(e as Error).message}`);
  }

  // Auto-pick a text channel if CHANNEL_ID not set.
  if (!channelId && guildId) {
    try {
      const guild = await bot.fetchGuild(guildId);
      const channels = await guild.fetchChannels();
      const text = channels.find((c) => c.type === 0 || c.type === 5);
      if (text) {
        channelId = text.id;
        console.log(`[auto] picked channel #${text.name} (${text.id})`);
      }
    } catch (e) {
      console.log(`[auto] couldn't list channels: ${(e as Error).message}`);
    }
  }


  if (channelId) {
    // 4) Components V2 — send a rich layout.
    const ch = await bot.fetchChannel(channelId);
    console.log(`[v2] sending Components V2 to #${ch.name ?? channelId}…`);
    const msg = await ch.send({
      componentsV2: true,
      components: [
        container({
          accentColor: 0x5865f2,
          children: [
            textDisplay("# Supa.js v0.3 smoke test"),
            textDisplay("This message uses **Components V2**."),
            separator({ divider: true, spacing: "small" }),
            section({
              text: ["**Section heading**", "Body text alongside an accessory button."],
              accessory: button({ customId: "supa-smoke-v2:click", label: "Click", style: "primary" }),
            }),
            separator({ divider: false, spacing: "large" }),
            mediaGallery([
              { url: "https://cdn.discordapp.com/embed/avatars/0.png", description: "default avatar" },
            ]),
            row(button({ customId: "supa-smoke-v2:done", label: "Done", style: "success" })),
          ],
        }),
      ],
    });
    console.log(`[v2] sent id=${msg.id}`);

    // edit the message (still V2)
    await msg.edit({
      componentsV2: true,
      components: [
        container({
          accentColor: 0x57f287,
          children: [
            textDisplay("# Edited via Components V2 ✓"),
            textDisplay("If you can read this, V2 edit works."),
          ],
        }),
      ],
    });
    console.log(`[v2] edited`);

    // 5) Polls — create + expire.
    console.log(`[poll] creating…`);
    const pollMsg = await ch.send({
      poll: {
        question: "Supa.js v0.3 polls work?",
        answers: ["Yes ✅", "No ❌", "Maybe 🤔"],
        durationHours: 1,
        allowMultiselect: false,
      },
    });
    console.log(`[poll] sent id=${pollMsg.id}`);
    try {
      await ch.expirePoll(pollMsg.id);
      console.log(`[poll] expired`);
    } catch (e) {
      console.log(`[poll] expire error: ${(e as Error).message}`);
    }

    // cleanup
    await msg.delete().catch(() => {});
    await pollMsg.delete().catch(() => {});
  } else {
    console.log("[v2] skipped (set CHANNEL_ID to run)");
  }

  // 6) Debugger dump.
  bot.debug.dump();

  await bot.stop();
});

bot.on("error", (e) => console.error("[error]", e));

await bot.start();
