const express = require("express");
const http = require("http");
const next = require("next");
const { Server } = require("socket.io");

const GAME_CONFIG = {
  WIDTH: 800,
  HEIGHT: 400,
  PLAYER_RADIUS: 30,
  BAKA_WIDTH: 80,
  BAKA_BASE_HEIGHT: 60,
  GROUND_Y: 340,
  LEVEL_LIMIT: 10,
  BASE_JUMP_VY: -12,
  JUMP_INCREASE_PER_LEVEL: -1,
  BAKA_HEIGHT_INCREASE: 18,
  ROUND_DELAY: 3500,
  GRAVITY: 0.6,
  PLAYER_SPEED: 7,
  TICK_RATE: 60, // physics updates per second
};

let gameState = createInitialState();

function createInitialState() {
  return {
    players: [
      { id: null, x: 80, y: GAME_CONFIG.GROUND_Y, vy: 0, jumping: false, crossed: false, input: {} },
      { id: null, x: 160, y: GAME_CONFIG.GROUND_Y, vy: 0, jumping: false, crossed: false, input: {} },
    ],
    baka: { x: GAME_CONFIG.WIDTH / 2 - GAME_CONFIG.BAKA_WIDTH / 2, y: GAME_CONFIG.GROUND_Y + 20, height: GAME_CONFIG.BAKA_BASE_HEIGHT },
    score: 0,
    gameOver: false,
    message: "Waiting for players to connect...",
    levelIncreaseTimeout: null,
  };
}

const dev = process.env.NODE_ENV !== "production";
const nextApp = next({ dev });
const handle = nextApp.getRequestHandler();

nextApp.prepare().then(() => {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: "*", methods: ["GET", "POST"] },
  });

  app.get("/health", (req, res) => res.send("✅ Luksong Baka server is running!"));
  app.use((req, res) => handle(req, res));

  // --- Server Tick Loop ---
  setInterval(() => {
    if (gameState.gameOver) return;

    gameState.players.forEach((p) => {
      if (!p.id) return;

      // Apply input
      if (p.input.left) p.x -= GAME_CONFIG.PLAYER_SPEED;
      if (p.input.right) p.x += GAME_CONFIG.PLAYER_SPEED;
      p.x = Math.max(GAME_CONFIG.PLAYER_RADIUS, Math.min(GAME_CONFIG.WIDTH - GAME_CONFIG.PLAYER_RADIUS, p.x));

      // Jump
      if (p.input.jump && !p.jumping && p.y >= GAME_CONFIG.GROUND_Y) {
        p.vy = GAME_CONFIG.BASE_JUMP_VY;
        p.jumping = true;
      }

      // Gravity
      p.vy += GAME_CONFIG.GRAVITY;
      p.y += p.vy;
      if (p.y >= GAME_CONFIG.GROUND_Y) {
        p.y = GAME_CONFIG.GROUND_Y;
        p.vy = 0;
        p.jumping = false;
      }

      // Collision
      const bakaTop = gameState.baka.y - gameState.baka.height;
      const bakaLeft = gameState.baka.x;
      const bakaRight = gameState.baka.x + GAME_CONFIG.BAKA_WIDTH;
      if (
        p.x + GAME_CONFIG.PLAYER_RADIUS > bakaLeft &&
        p.x - GAME_CONFIG.PLAYER_RADIUS < bakaRight &&
        p.y + GAME_CONFIG.PLAYER_RADIUS > bakaTop &&
        p.y - GAME_CONFIG.PLAYER_RADIUS < gameState.baka.y &&
        p.vy > 0
      ) {
        gameState.gameOver = true;
        gameState.message = "Game Over! You touched the baka. Press R to Restart.";
      }

      if (p.y >= GAME_CONFIG.GROUND_Y && p.x > gameState.baka.x + GAME_CONFIG.BAKA_WIDTH) {
        p.crossed = true;
      }
    });

    // Check level completion
    const allCrossed = gameState.players.every((p) => !p.id || p.crossed);
    if (allCrossed && !gameState.levelIncreaseTimeout) {
      gameState.levelIncreaseTimeout = setTimeout(() => {
        gameState.score++;
        if (gameState.score >= GAME_CONFIG.LEVEL_LIMIT) {
          gameState.message = `🎉 Congratulations! You reached level ${GAME_CONFIG.LEVEL_LIMIT}. Resetting.`;
          gameState.score = 0;
          gameState.baka.height = GAME_CONFIG.BAKA_BASE_HEIGHT;
        } else {
          gameState.message = "Jump over!";
          gameState.baka.height += GAME_CONFIG.BAKA_HEIGHT_INCREASE;
        }
        gameState.players.forEach((p, idx) => {
          p.x = idx === 0 ? 80 : 160;
          p.y = GAME_CONFIG.GROUND_Y;
          p.vy = 0;
          p.jumping = false;
          p.crossed = false;
        });
        gameState.levelIncreaseTimeout = null;
      }, GAME_CONFIG.ROUND_DELAY);
    }

    // Broadcast authoritative state
    io.emit("state", gameState);
  }, 1000 / GAME_CONFIG.TICK_RATE);

  // --- Socket.IO Connections ---
  io.on("connection", (socket) => {
    console.log(`⚡ User connected: ${socket.id}`);

    // Assign player slot
    const idx = gameState.players.findIndex((p) => !p.id);
    if (idx === -1) {
      console.log("Server full → spectator mode");
      socket.emit("state", gameState);
      return;
    }

    gameState.players[idx].id = socket.id;
    gameState.players[idx].connected = true;
    gameState.players[idx].input = {};

    socket.emit("assignPlayer", idx);

    socket.on("input", (input) => {
      if (gameState.players[idx]) gameState.players[idx].input = input;
    });

    socket.on("restart", () => {
      gameState = createInitialState();
    });

    socket.on("disconnect", () => {
      console.log(`❌ User disconnected: ${socket.id}`);
      if (gameState.players[idx]) gameState.players[idx] = { ...gameState.players[idx], id: null, connected: false, input: {} };
    });
  });

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
});
