// Components V2 — `/showcase` posts a rich card built from V2 components.
// Set DISCORD_TOKEN and (optionally) GUILD_ID for instant guild deploy.

import {
  Bot,
  button,
  container,
  mediaGallery,
  row,
  section,
  separator,
  textDisplay,
} from "../src/index.js";

const bot = new Bot(process.env.DISCORD_TOKEN!);

bot.command("showcase", {
  description: "Show off Components V2",
  guildId: process.env.GUILD_ID,
}, (ctx) =>
  ctx.reply({
    componentsV2: true,
    components: [
      container({
        accentColor: 0x5865f2,
        children: [
          textDisplay("# 🚀 Supa.js Components V2"),
          textDisplay("Rich layouts without embeds, builders, or boilerplate."),
          separator({ divider: true, spacing: "small" }),
          section({
            text: ["**Why V2?**", "Compose layouts directly from objects."],
            accessory: button({ customId: "showcase:like", label: "Like", style: "success" }),
          }),
          separator({ spacing: "large" }),
          mediaGallery([
            { url: "https://cdn.discordapp.com/embed/avatars/0.png", description: "demo image" },
            { url: "https://cdn.discordapp.com/embed/avatars/1.png", description: "demo image" },
          ]),
          row(button({ customId: "showcase:next", label: "Next", style: "primary" })),
        ],
      }),
    ],
  }),
);

bot.button("showcase:like", (ctx) => ctx.update({ content: "💖 thanks!", components: [] }));
bot.button("showcase:next", (ctx) => ctx.reply({ content: "next page!", ephemeral: true }));

await bot.start();
