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
let pvpLoop = null;

let botInfo = {
  status: "offline",
  host: "",
  port: 25565,
  username: "",
  mode: "sword",
  target: "",
  error: ""
};

function stopCurrentBot() {
  if (pvpLoop) {
    clearInterval(pvpLoop);
    pvpLoop = null;
  }

  if (bot) {
    try {
      bot.quit("Replacing bot");
    } catch (error) {
      console.log("Quit error:", error.message);
    }
  }

  bot = null;
  botInfo.status = "offline";
}

function startPvP() {
  if (!bot) return;

  if (pvpLoop) {
    clearInterval(pvpLoop);
  }

  pvpLoop = setInterval(async () => {
    if (!bot) return;
    if (botInfo.status !== "online") return;
    if (!botInfo.target) return;

    const target = bot.players[botInfo.target];

    if (!target || !target.entity) {
      return;
    }

    const entity = target.entity;

    try {
      await bot.lookAt(entity.position.offset(0, 1, 0), true);

      const distance = bot.entity.position.distanceTo(entity.position);

      if (distance <= 4) {
        bot.attack(entity);
      } else if (distance <= 12) {
        const direction = entity.position
          .minus(bot.entity.position)
          .normalize();

        const movement = bot.entity.position
          .plus(direction.scaled(0.5));

        bot.lookAt(entity.position.offset(0, 1, 0), true);

        bot.setControlState("forward", true);

        setTimeout(() => {
          if (bot) {
            bot.setControlState("forward", false);
          }
        }, 250);
      }
    } catch (error) {
      console.log("PvP error:", error.message);
    }
  }, 350);
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
  const {
    host,
    port,
    username,
    mode,
    target
  } = req.body;

  if (!host || !username) {
    return res.json({
      success: false,
      message: "Server IP and bot username are required."
    });
  }

  // إذا كان هناك بوت، نخرجه ونستبدله بالجديد
  if (bot) {
    console.log("Replacing current bot...");
    stopCurrentBot();
  }

  botInfo.host = host;
  botInfo.port = Number(port) || 25565;
  botInfo.username = username;
  botInfo.mode = mode || "sword";
  botInfo.target = target || "";
  botInfo.status = "connecting";
  botInfo.error = "";

  console.log(
    `Connecting ${username} to ${host}:${botInfo.port}`
  );

  try {
    bot = mineflayer.createBot({
      host: host,
      port: botInfo.port,
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
        `BOT ONLINE: ${botInfo.username}`
      );

      console.log(
        `PvP Mode: ${botInfo.mode}`
      );

      console.log(
        `Target: ${botInfo.target || "none"}`
      );

      startPvP();
    });

    bot.on("message", (message) => {
      console.log(
        "SERVER:",
        message.toString()
      );
    });

    bot.on("end", (reason) => {
      console.log(
        "Bot disconnected:",
        reason || "unknown"
      );

      if (pvpLoop) {
        clearInterval(pvpLoop);
        pvpLoop = null;
      }

      botInfo.status = "offline";
      botInfo.error = String(reason || "");

      bot = null;
    });

    bot.on("error", (error) => {
      console.log(
        "MINECRAFT ERROR:",
        error
      );

      botInfo.status = "error";
      botInfo.error =
        error.message || String(error);
    });

    bot.on("kicked", (reason) => {
      console.log(
        "BOT KICKED:",
        reason
      );

      botInfo.status = "kicked";
      botInfo.error = String(reason);
    });

    return res.json({
      success: true,
      status: "connecting",
      username: username,
      mode: botInfo.mode,
      target: botInfo.target
    });

  } catch (error) {
    console.log(
      "START ERROR:",
      error
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
  stopCurrentBot();

  botInfo.status = "offline";

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
