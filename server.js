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

function clearTimer() {
  if (connectionTimer) {
    clearTimeout(connectionTimer);
    connectionTimer = null;
  }
}

function stopBot() {
  clearTimer();

  if (bot) {
    const oldBot = bot;
    bot = null;

    try {
      oldBot.clearControlStates();
    } catch (_) {}

    try {
      oldBot.end("Stopped");
    } catch (_) {}
  }

  botInfo.status = "offline";
}

app.get("/", (req, res) => {
  res.json({
    name: "AIZEN BOT",
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

  const port =
    Number(req.body.port) || 25565;

  const mode =
    String(req.body.mode || "sword");

  const target =
    String(req.body.target || "").trim();

  if (!host) {
    return res.json({
      success: false,
      message: "Server IP is required."
    });
  }

  if (!username) {
    return res.json({
      success: false,
      message: "Bot Username is required."
    });
  }

  if (bot) {
    console.log("Stopping old bot...");
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

      // للسيرفرات Cracked / Offline
      auth: "offline",

      // اكتشاف إصدار السيرفر
      version: false,

      // مهلة الاتصال
      connectTimeout: 60000
    });

    bot = newBot;

    connectionTimer = setTimeout(() => {
      if (
        bot === newBot &&
        botInfo.status === "connecting"
      ) {
        console.log(
          "CONNECTION TIMEOUT"
        );

        botInfo.status = "timeout";
        botInfo.error =
          "Connection timeout after 60 seconds.";

        try {
          newBot.end(
            "Connection timeout"
          );
        } catch (_) {}

        bot = null;
      }
    }, 60000);

    newBot.on("login", () => {
      console.log(
        "LOGIN: Minecraft login received"
      );
    });

    newBot.once("spawn", () => {
      clearTimer();

      if (bot !== newBot) {
        return;
      }

      botInfo.status = "online";
      botInfo.error = "";

      console.log(
        `ONLINE: ${username} joined ${host}:${port}`
      );

      console.log(
        `MODE: ${mode}`
      );

      console.log(
        `TARGET: ${target || "none"}`
      );
    });

    newBot.on("message", (message) => {
      console.log(
        "SERVER:",
        message.toString()
      );
    });

    newBot.on("kicked", (reason) => {
      clearTimer();

      console.log(
        "KICKED:",
        reason
      );

      if (bot === newBot) {
        botInfo.status = "kicked";

        botInfo.error =
          typeof reason === "string"
            ? reason
            : JSON.stringify(reason);

        bot = null;
      }
    });

    newBot.on("error", (error) => {
      clearTimer();

      console.log(
        "MINECRAFT ERROR:",
        error.message
      );

      if (bot === newBot) {
        botInfo.status = "error";
        botInfo.error =
          error.message || String(error);
      }
    });

    newBot.on("end", (reason) => {
      clearTimer();

      console.log(
        "DISCONNECTED:",
        reason || "unknown"
      );

      if (bot === newBot) {
        botInfo.status = "offline";

        botInfo.error =
          reason ? String(reason) : "";

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
    clearTimer();

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
  console.log("STOP REQUEST");

  stopBot();

  res.json({
    success: true,
    status: "offline"
  });
});

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `AIZEN BOT API running on port ${PORT}`
    );
  }
);
