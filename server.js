const express = require("express");
const mineflayer = require("mineflayer");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }

  next();
});

let bot = null;

let botInfo = {
  status: "offline",
  host: "",
  port: 25565,
  username: "",
  error: ""
};

app.get("/", (req, res) => {
  res.json({
    name: "MACE PvP BOT",
    status: botInfo.status
  });
});

app.get("/status", (req, res) => {
  res.json({
    status: botInfo.status,
    username: botInfo.username,
    server: botInfo.host,
    port: botInfo.port,
    error: botInfo.error
  });
});

app.post("/start", (req, res) => {
  const { host, port, username } = req.body;

  if (bot) {
    return res.json({
      success: false,
      message: "Bot is already running."
    });
  }

  if (!host || !username) {
    return res.json({
      success: false,
      message: "Server IP and bot username are required."
    });
  }

  botInfo.host = host;
  botInfo.port = Number(port) || 25565;
  botInfo.username = username;
  botInfo.status = "connecting";
  botInfo.error = "";

  console.log(
    `Connecting ${username} to ${host}:${botInfo.port}`
  );

  try {
    bot = mineflayer.createBot({
      host: host,
      port: Number(port) || 25565,
      username: username,
      version: false,
      auth: "offline",
      connectTimeout: 30000
    });

    bot.on("login", () => {
      console.log("Minecraft login packet received.");
    });

    bot.once("spawn", () => {
      botInfo.status = "online";

      console.log(
        `BOT ONLINE: ${botInfo.username} joined ${botInfo.host}:${botInfo.port}`
      );
    });

    bot.on("message", (message) => {
      console.log("SERVER:", message.toString());
    });

    bot.on("end", (reason) => {
      console.log("Bot disconnected:", reason || "unknown");

      botInfo.status = "offline";
      botInfo.error = String(reason || "");

      bot = null;
    });

    bot.on("error", (error) => {
      console.log("MINECRAFT ERROR:", error);

      botInfo.status = "error";
      botInfo.error = error.message || String(error);
    });

    bot.on("kicked", (reason) => {
      console.log("BOT KICKED:", reason);

      botInfo.status = "kicked";
      botInfo.error = String(reason);
    });

    return res.json({
      success: true,
      status: "connecting"
    });

  } catch (error) {
    console.log("START ERROR:", error);

    bot = null;
    botInfo.status = "error";
    botInfo.error = error.message;

    return res.json({
      success: false,
      status: "error",
      message: error.message
    });
  }
});

app.post("/stop", (req, res) => {
  if (!bot) {
    botInfo.status = "offline";

    return res.json({
      success: true,
      status: "offline"
    });
  }

  try {
    bot.quit("Stopped from website");
  } catch (error) {
    console.log("Stop error:", error.message);
  }

  bot = null;
  botInfo.status = "offline";

  return res.json({
    success: true,
    status: "offline"
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `MACE PvP BOT API running on port ${PORT}`
  );
});
