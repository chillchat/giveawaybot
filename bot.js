const { Client, RichEmbed } = require("discord.js");
const { writeFileSync } = require("fs");
const humanize = require("humanize-duration");
const ms = require("ms");
const uuid = require("uuid/v4");
const Giveaway = require("./Giveaway");
const config = require("./config.json");
let giveaways = require("./giveaways.json");

function writeToJson() {
  writeFileSync("./giveaways.json", JSON.stringify(giveaways, null, 2));
  delete require.cache[require.resolve("./giveaways.json")];
  giveaways = require("./giveaways.json");
}

function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function chooseWinner({ users, id, item }, msg) {
  users = shuffle(users);
  const iterations = Math.floor(Math.random() * 2) + 2;
  const timers = [];
  let user;
  for (let i = 0; i < iterations; i++) {
    for (let j = 0; j < users.length; j++) {
      const timer = setTimeout(async () => {
        const u = users[j];
        user = GiveawayBot.users.get(u);
        users = shuffle(users);
        if (user) {
          if (i + 1 >= iterations) {
            timers.map(timer => clearTimeout(timer));
            const embed = new RichEmbed({
              title: "Giveaway Ended",
              fields: [
                {
                  name: "Winner",
                  value: user.toString()
                },
                {
                  name: "Item",
                  value: item
                }
              ]
            }).setFooter(id);
            await msg.edit(embed).catch(console.log);
            await msg.channel.send(`${user.toString()} has won ${item}`);
          } else {
            const embed = new RichEmbed({
              title: "Giveaway Ended",
              fields: [
                {
                  name: `Choosing Winner (Rolls: ${i + 1}/${iterations})`,
                  value: user.toString()
                }
              ]
            }).setFooter(id);
            await msg.edit(embed).catch(console.log);
          }
        }
      }, i * 500);
      timers.push(timer);
    }
  }
}

const commands = {
  help: (msg, args) => {
    const embed = new RichEmbed({
      title: "Help",
      description: Object.keys(commands).join("\n")
    });
    msg.channel.send(embed);
  },
  start: async (msg, args) => {
    const [duration, provider, ...item] = args;
    const giveaway = new Giveaway({
      item: item.join(" "),
      duration: ms(duration),
      endTime: Date.now() + ms(duration),
      id: uuid(),
      provider,
      channelID: msg.channel.id
    });
    const date = new Date(Date.now() + giveaway.duration);
    const embed = new RichEmbed({
      title: `Giveaway for ${giveaway.item}`,
      fields: [
        {
          name: "Provider",
          value: GiveawayBot.users.get(giveaway.provider).toString()
        },
        {
          name: "Duration",
          value: `${humanize(giveaway.duration)} (${date.toUTCString()})`
        }
      ]
    })
      .setFooter(giveaway.id)
      .setTimestamp(giveaway.endTime)
      .setColor("RED");
    const message = await msg.channel.send(embed);
    await message.react(msg.guild.emojis.get(config.emojiID));
    giveaway.msgID = message.id;
    giveaways.push(giveaway);
    writeToJson();
    setTimeout(() => {
      const choose = new RichEmbed({
        title: "Giveaway Ended",
        fields: [
          {
            name: "Winner",
            value: "Choosing Winner..."
          }
        ]
      }).setFooter(giveaway.id);
      message.edit(choose);
      chooseWinner(
        giveaways.find(g => g.id === giveaway.id),
        message
      );
    }, giveaway.duration);
  },
  end: async (msg, args) => {
    const id = args[0];
    const giveaway = giveaways.find(g => g.id === id);
    const channel = GiveawayBot.guilds
      .get("635632859998060554")
      .channels.get(giveaway.channelID);
    const message = await channel.fetchMessage(giveaway.msgID);
    if (giveaway.status !== "ended") {
      const embed = new RichEmbed({
        title: "Giveaway Ended",
        fields: [
          {
            name: "Winner",
            value: "Choosing Winner..."
          }
        ]
      });
      message.edit(embed);
      chooseWinner(giveaway, message);
      giveaway.status = "ended";
      writeToJson();
    }
  },
  reroll: async (msg, args) => {
    const id = args[0];
    const giveaway = giveaways.find(g => g.id === id);
    const channel = GiveawayBot.guilds
      .get("635632859998060554")
      .channels.get(giveaway.channelID);
    const message = await channel.fetchMessage(giveaway.msgID);
    const embed = new RichEmbed({
      title: "Giveaway Ended",
      fields: [
        {
          name: "Winner",
          value: "Choosing Winner..."
        }
      ]
    });
    message.edit(embed);
    chooseWinner(giveaway, message);
  }
};

const GiveawayBot = new Client({
  disableEveryone: true
});

GiveawayBot.on("ready", () => {
  console.log("Ready for Giveaways!");
});

GiveawayBot.on("messageReactionAdd", (reaction, user) => {
  let giveaway = giveaways.find(g => g.msgID === reaction.message.id);
  console.log(giveaway);
  if (user.id === GiveawayBot.user.id) return;
  if (reaction.emoji.id !== config.emojiID) return;
  if (giveaway.users.includes(user)) return;
  if (giveaway.status !== "ended") {
    giveaway.users.push(user.id);
  }
  writeToJson();
});

GiveawayBot.on("messageReactionRemove", (reaction, user) => {
  let giveaway = giveaways.find(g => g.msgID === reaction.message.id);
  if (user.id === GiveawayBot.user.id) return;
  if (reaction.emoji.id !== config.emojiID) return;
  if (giveaway.status !== "ended") {
    giveaway.users = giveaway.users.filter(u => u !== user.id);
  }
  writeToJson();
});

GiveawayBot.on("message", msg => {
  if (msg.author.bot) return;
  if (!msg.member.roles.has(config.modRole)) return;
  if (!msg.content.startsWith(config.prefix)) return;
  const [_, name, ...args] = msg.content.split(" ");
  if (!commands.hasOwnProperty(name)) return;
  commands[name](msg, args, GiveawayBot);
});

GiveawayBot.login(config.token);
