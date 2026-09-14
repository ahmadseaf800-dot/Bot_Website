const express = require("express");
const mineflayer = require("mineflayer");
const net = require("net");

const app = express();
const PORT = process.env.PORT || 10000;

app.use(express.json());

// CORS
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
  error: "",
  network: ""
};

// =========================
// تنظيف المؤقت
// =========================

function clearConnectionTimer() {
  if (connectionTimer) {
    clearTimeout(connectionTimer);
    connectionTimer = null;
  }
}

// =========================
// اختبار TCP
// =========================

function testServerConnection(host, port, timeout = 10000) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let finished = false;

    function finish(result) {
      if (finished) return;
      finished = true;

      try {
        socket.destroy();
      } catch (_) {}

      resolve(result);
    }

    socket.setTimeout(timeout);

    socket.once("connect", () => {
      console.log(`TCP CONNECTED: ${host}:${port}`);

      finish({
        reachable: true,
        message: "SERVER REACHABLE"
      });
    });

    socket.once("timeout", () => {
      console.log(`TCP TIMEOUT: ${host}:${port}`);

      finish({
        reachable: false,
        message: "SERVER NOT REACHABLE - TIMEOUT"
      });
    });

    socket.once("error", (error) => {
      console.log(
        `TCP ERROR: ${host}:${port} -> ${error.message}`
      );

      finish({
        reachable: false,
        message: `SERVER ERROR: ${error.message}`
      });
    });

    try {
      socket.connect(port, host);
    } catch (error) {
      finish({
        reachable: false,
        message: `SERVER ERROR: ${error.message}`
      });
    }
  });
}

// =========================
// إيقاف البوت
// =========================

function stopBot() {
  clearConnectionTimer();

  if (bot) {
    const oldBot = bot;
    bot = null;

    try {
      oldBot.clearControlStates();
    } catch (_) {}

    try {
      oldBot.end("Bot stopped");
    } catch (error) {
      console.log(
        "Stop error:",
        error.message
      );
    }
  }

  botInfo.status = "offline";
}

// =========================
// الصفحة الرئيسية
// =========================

app.get("/", (req, res) => {
  res.json({
    name: "AIZEN BOT",
    project: "MACE PvP BOT",
    status: botInfo.status,
    network: botInfo.network
  });
});

// =========================
// STATUS
// =========================

app.get("/status", (req, res) => {
  res.json({
    status: botInfo.status,
    username: botInfo.username,
    server: botInfo.host,
    port: botInfo.port,
    mode: botInfo.mode,
    target: botInfo.target,
    error: botInfo.error,
    network: botInfo.network
  });
});

// =========================
// TEST SERVER
// =========================

app.post("/test", async (req, res) => {
  const host = String(req.body.host || "").trim();
  const port = Number(req.body.port) || 25565;

  if (!host) {
    return res.json({
      success: false,
      reachable: false,
      message: "Server IP is required."
    });
  }

  console.log(
    `TESTING SERVER: ${host}:${port}`
  );

  const result = await testServerConnection(
    host,
    port
  );

  botInfo.network = result.message;

  return res.json({
    success: true,
    host,
    port,
    reachable: result.reachable,
    message: result.message
  });
});

// =========================
// START BOT
// =========================

app.post("/start", async (req, res) => {
  const host = String(req.body.host || "").trim();
  const username = String(req.body.username || "").trim();
  const port = Number(req.body.port) || 25565;

  const mode = String(
    req.body.mode || "sword"
  );

  const target = String(
    req.body.target || ""
  ).trim();

  if (!host || !username) {
    return res.json({
      success: false,
      message: "Server IP and Bot Username are required."
    });
  }

  // أوقف أي بوت قديم
  if (bot) {
    console.log(
      "Stopping old bot before starting new bot..."
    );

    stopBot();
  }

  botInfo.host = host;
  botInfo.port = port;
  botInfo.username = username;
  botInfo.mode = mode;
  botInfo.target = target;
  botInfo.status = "testing";
  botInfo.error = "";
  botInfo.network = "";

  console.log(
    `TESTING: ${host}:${port}`
  );

  // =========================
  // اختبار الاتصال أولاً
  // =========================

  const networkTest =
    await testServerConnection(
      host,
      port
    );

  botInfo.network =
    networkTest.message;

  if (!networkTest.reachable) {
    botInfo.status = "offline";

    botInfo.error =
      networkTest.message;

    console.log(
      `NETWORK FAILED: ${networkTest.message}`
    );

    return res.json({
      success: false,
      status: "offline",
      network: networkTest.message,
      error: networkTest.message,
      server: host,
      port: port
    });
  }

  console.log(
    `SERVER REACHABLE: ${host}:${port}`
  );

  // =========================
  // إنشاء Mineflayer Bot
  // =========================

  botInfo.status = "connecting";

  console.log(
    `CONNECTING: ${username} -> ${host}:${port}`
  );

  let newBot;

  try {
    newBot = mineflayer.createBot({
      host: host,
      port: port,
      username: username,

      // Offline / Cracked server
      auth: "offline",

      // اكتشاف إصدار السيرفر تلقائياً
      version: false,

      connectTimeout: 30000
    });

    bot = newBot;

    // =========================
    // مهلة الاتصال
    // =========================

    connectionTimer = setTimeout(() => {
      if (
        bot === newBot &&
        botInfo.status === "connecting"
      ) {
        console.log(
          "CONNECTION TIMEOUT: Bot did not spawn within 30 seconds."
        );

        botInfo.status = "timeout";

        botInfo.error =
          "Minecraft connection timeout.";

        try {
          newBot.end(
            "Connection timeout"
          );
        } catch (_) {}

        bot = null;
      }
    }, 30000);

    // =========================
    // LOGIN
    // =========================

    newBot.on("login", () => {
      console.log(
        "LOGIN: Minecraft login received."
      );
    });

    // =========================
    // SPAWN
    // =========================

    newBot.once("spawn", () => {
      clearConnectionTimer();

      if (bot !== newBot) {
        return;
      }

      botInfo.status = "online";
      botInfo.error = "";

      console.log(
        `ONLINE: ${username} joined ${host}:${port}`
      );

      console.log(
        `MODE: ${mode} | TARGET: ${
          target || "none"
        }`
      );
    });

    // =========================
    // رسائل السيرفر
    // =========================

    newBot.on("message", (message) => {
      console.log(
        "SERVER:",
        message.toString()
      );
    });

    // =========================
    // KICK
    // =========================

    newBot.on("kicked", (reason) => {
      clearConnectionTimer();

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

    // =========================
    // ERROR
    // =========================

    newBot.on("error", (error) => {
      clearConnectionTimer();

      console.log(
        "MINECRAFT ERROR:",
        error
      );

      if (bot === newBot) {
        botInfo.status = "error";

        botInfo.error =
          error.message ||
          String(error);
      }
    });

    // =========================
    // DISCONNECT
    // =========================

    newBot.on("end", (reason) => {
      clearConnectionTimer();

      console.log(
        "DISCONNECTED:",
        reason || "unknown"
      );

      if (bot === newBot) {
        botInfo.status = "offline";

        botInfo.error =
          reason
            ? String(reason)
            : "";

        bot = null;
      }
    });

    return res.json({
      success: true,
      status: "connecting",
      network: "SERVER REACHABLE",
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

    botInfo.error =
      error.message;

    return res.json({
      success: false,
      status: "error",
      message: error.message
    });
  }
});

// =========================
// STOP
// =========================

app.post("/stop", (req, res) => {
  console.log(
    "STOP BOT REQUEST"
  );

  stopBot();

  return res.json({
    success: true,
    status: "offline"
  });
});

// =========================
// SERVER
// =========================

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `AIZEN BOT API running on port ${PORT}`
    );
  }
);
