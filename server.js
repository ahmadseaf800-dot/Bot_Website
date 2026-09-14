const express = require("express");
const mineflayer = require("mineflayer");

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 10000;

let bot = null;

let botInfo = {
  status: "offline",
  host: "",
  port: 25565,
  username: ""
};

let reconnectTimer = null;

function startBot(host, port, username) {
  if (bot) {
    return {
      success: false,
      message: "Bot is already running."
    };
  }

  if (!host || !username) {
    return {
      success: false,
      message: "Server IP and bot username are required."
    };
  }

  botInfo.host = host;
  botInfo.port = Number(port) || 25565;
  botInfo.username = username;
  botInfo.status = "connecting";

  console.log(
    `Connecting ${username} to ${host}:${botInfo.port}`
  );

  bot = mineflayer.createBot({
    host: botInfo.host,
    port: botInfo.port,
    username: botInfo.username,
    version: false
  });

  bot.once("spawn", () => {
    botInfo.status = "online";

    console.log(
      `Bot ${botInfo.username} joined ${botInfo.host}:${botInfo.port}`
    );
  });

  bot.on("end", () => {
    console.log("Bot disconnected.");

    botInfo.status = "offline";
    bot = null;
  });

  bot.on("error", (error) => {
    console.log("Minecraft error:", error.message);

    botInfo.status = "error";
  });

  bot.on("kicked", (reason) => {
    console.log("Bot kicked:", reason);

    botInfo.status = "kicked";
  });

  return {
    success: true,
    status: botInfo.status
  };
}


function stopBot() {
  if (!bot) {
    botInfo.status = "offline";

    return {
      success: true,
      status: "offline"
    };
  }

  try {
    bot.quit("Stopped from website");
  } catch (error) {
    console.log(error.message);
  }

  bot = null;
  botInfo.status = "offline";

  return {
    success: true,
    status: "offline"
  };
}


/* Homepage */

app.get("/", (req, res) => {
  res.json({
    name: "MACE PvP BOT",
    status: botInfo.status
  });
});


/* Bot status */

app.get("/status", (req, res) => {
  res.json({
    status: botInfo.status,
    username: botInfo.username,
    server: botInfo.host,
    port: botInfo.port
  });
});


/* Start bot */

app.post("/start", (req, res) => {

  const {
    host,
    port,
    username
  } = req.body;

  const result = startBot(
    host,
    port,
    username
  );

  res.json(result);
});


/* Stop bot */

app.post("/stop", (req, res) => {

  const result = stopBot();

  res.json(result);
});


/* Server */

app.listen(PORT, () => {

  console.log(
    `MACE PvP BOT API running on port ${PORT}`
  );

});
