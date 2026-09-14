const express = require("express");
const mineflayer = require("mineflayer");

const app = express();

app.use(express.json());

const PORT = process.env.PORT || 10000;

let bot = null;
let botStatus = "offline";

let config = {
  host: process.env.MC_HOST || "",
  port: Number(process.env.MC_PORT || 25565),
  username: process.env.BOT_USERNAME || "MaceBot"
};

function startBot() {
  if (bot) {
    return;
  }

  if (!config.host) {
    console.log("MC_HOST is not configured.");
    return;
  }

  console.log("Starting Minecraft bot...");

  botStatus = "connecting";

  bot = mineflayer.createBot({
    host: config.host,
    port: config.port,
    username: config.username,
    version: false
  });

  bot.once("spawn", () => {
    botStatus = "online";
    console.log("Bot joined Minecraft!");
  });

  bot.on("end", () => {
    botStatus = "offline";
    bot = null;
    console.log("Bot disconnected.");
  });

  bot.on("error", (err) => {
    console.log("Minecraft error:", err.message);
  });

  bot.on("kicked", (reason) => {
    console.log("Bot kicked:", reason);
  });
}

app.get("/", (req, res) => {
  res.json({
    name: "MACE PvP BOT",
    status: botStatus
  });
});

app.get("/status", (req, res) => {
  res.json({
    status: botStatus,
    username: config.username,
    server: config.host || "Not configured",
    port: config.port
  });
});

app.post("/start", (req, res) => {
  startBot();

  res.json({
    success: true,
    status: botStatus
  });
});

app.post("/stop", (req, res) => {
  if (bot) {
    bot.quit("Stopped from dashboard");
    bot = null;
  }

  botStatus = "offline";

  res.json({
    success: true,
    status: botStatus
  });
});

app.listen(PORT, () => {
  console.log(`API running on port ${PORT}`);
});
