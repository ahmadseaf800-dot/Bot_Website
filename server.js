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
let connectionTimer = null;

const botInfo = {
  status: "offline",
  host: "",
  port: 25565,
  username: "",
  mode: "sword",
  target: "",
  error: ""
};

function clearConnectionTimer() {
  if (connectionTimer) {
    clearTimeout(connectionTimer);
    connectionTimer = null;
  }
}

function stopBot() {
  clearConnectionTimer();

  if (bot) {
    try {
      bot.removeAllListeners();
      bot.quit("Bot replaced/stopped");
    } catch (err) {
      console.log("Stop error:", err.message);
    }
  }

  bot = null;
  botInfo.status = "offline";
}

app.get("/", (req, res) => {
  res.json({
    name: "AIZEN BOT",
    project: "MACE PvP BOT",
    status: botInfo.status
  });
});

app.get("/status", (req, res) => {
  res.json({
    status: botInfo.status,
    username: botInfo.username,
    server: botInfo.host,
    port: botInfo.port,
    mode: botInfo.mode,
    target: botInfo.target,
    error: botInfo.error
  });
});

app.post("/start", (req, res) => {
  const host = String(req.body.host || "").trim();
  const username = String(req.body.username || "").trim();
  const port = Number(req.body.port) || 25565;
  const mode = String(req.body.mode || "sword");
  const target = String(req.body.target || "").trim();

  if (!host || !username) {
    return res.json({
      success: false,
      message: "Server IP and Bot Username are required."
    });
  }

  // إذا يوجد بوت حالي، أوقفه أولاً
  if (bot) {
    console.log("Stopping old bot before starting new bot...");
    stopBot();
  }

  botInfo.host = host;
  botInfo.port = port;
  botInfo.username = username;
  botInfo.mode = mode;
  botInfo.target = target;
  botInfo.status = "connecting";
  botInfo.error = "";

  console.log(
    `CONNECTING: ${username} -> ${host}:${port}`
  );

  try {
    const newBot = mineflayer.createBot({
      host: host,
      port: port,
      username: username,
      auth: "offline",
      version: false,
      connectTimeout: 30000
    });

    bot = newBot;

    connectionTimer = setTimeout(() => {
      if (bot === newBot && botInfo.status === "connecting") {
        console.log("CONNECTION TIMEOUT: Bot did not spawn within 30 seconds.");

        botInfo.status = "timeout";
        botInfo.error = "Connection timeout after 30 seconds.";

        try {
          newBot.end();
        } catch (_) {}

        bot = null;
      }
    }, 30000);

    newBot.on("login", () => {
      console.log("LOGIN: Minecraft login received.");
    });

    newBot.once("spawn", () => {
      clearConnectionTimer();

      if (bot !== newBot) return;

      botInfo.status = "online";

      console.log(
        `ONLINE: ${username} joined ${host}:${port}`
      );

      console.log(
        `MODE: ${mode} | TARGET: ${target || "none"}`
      );
    });

    newBot.on("message", (message) => {
      console.log(
        "SERVER:",
        message.toString()
      );
    });

    newBot.on("kicked", (reason) => {
      clearConnectionTimer();

      console.log(
        "KICKED:",
        reason
      );

      if (bot === newBot) {
        botInfo.status = "kicked";
        botInfo.error = String(reason);
      }
    });

    newBot.on("error", (error) => {
      clearConnectionTimer();

      console.log(
        "MINECRAFT ERROR:",
        error.message
      );

      if (bot === newBot) {
        botInfo.status = "error";
        botInfo.error = error.message;
      }
    });

    newBot.on("end", (reason) => {
      clearConnectionTimer();

      console.log(
        "DISCONNECTED:",
        reason || "unknown"
      );

      if (bot === newBot) {
        botInfo.status = "offline";
        botInfo.error = String(reason || "");
        bot = null;
      }
    });

    return res.json({
      success: true,
      status: "connecting",
      username: username,
      server: host,
      port: port,
      mode: mode,
      target: target
    });

  } catch (error) {
    clearConnectionTimer();

    console.log(
      "START ERROR:",
      error.message
    );

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
  stopBot();

  return res.json({
    success: true,
    status: "offline"
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(
    `AIZEN BOT API running on port ${PORT}`
  );
});
