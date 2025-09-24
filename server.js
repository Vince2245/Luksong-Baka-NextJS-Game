const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

// --- 1. Game Configuration ---
const GAME_CONFIG = {
  WIDTH: 800,
  HEIGHT: 400,
  PLAYER_RADIUS: 30,
  BAKA_WIDTH: 80,
  BAKA_BASE_HEIGHT: 60,
  GROUND_Y: 400 - 60,
  LEVEL_LIMIT: 10,
  BASE_JUMP_VY: -12,
  JUMP_INCREASE_PER_LEVEL: -1,
  BAKA_HEIGHT_INCREASE: 18,
  ROUND_DELAY: 3500,
};

// --- 2. Centralized Game State ---
let gameState = createInitialState();

function createInitialState() {
  return {
    players: [
      { id: null, x: 80, y: GAME_CONFIG.GROUND_Y, vy: 0, jumping: false, crossed: false, connected: false },
      { id: null, x: 160, y: GAME_CONFIG.GROUND_Y, vy: 0, jumping: false, crossed: false, connected: false },
    ],
    baka: {
      x: GAME_CONFIG.WIDTH / 2 - GAME_CONFIG.BAKA_WIDTH / 2,
      y: GAME_CONFIG.GROUND_Y + 20,
      height: GAME_CONFIG.BAKA_BASE_HEIGHT,
    },
    score: 0,
    gameOver: false,
    message: "Waiting for players to connect...",
    levelIncreaseTimeout: null,
  };
}

// --- 3. Express + HTTP Server Setup ---
const app = express();
const httpServer = http.createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: ["https://vince2245.github.io"], // allow GitHub Pages
    methods: ["GET", "POST"],
    credentials: false,
  },
  transports: ["websocket"],
});

// Health check / test route
app.get("/", (req, res) => {
  res.send("Luksong Baka Socket.IO server is running 🚀");
});

// --- 4. Game Logic Functions (same as your version) ---
function resetGame() {
  if (gameState.levelIncreaseTimeout) {
    clearTimeout(gameState.levelIncreaseTimeout);
  }
  gameState = createInitialState();

  io.allSockets().then((sockets) => {
    sockets.forEach((socketId) => {
      const playerIndex = findEmptyPlayerSlot();
      if (playerIndex !== -1) {
        gameState.players[playerIndex].id = socketId;
        gameState.players[playerIndex].connected = true;
      }
    });
    updateGameMessage();
    broadcastState();
  });
}

function handlePlayerMove(playerIndex, moveData) {
  if (gameState.gameOver) return;

  gameState.players[playerIndex] = { ...gameState.players[playerIndex], ...moveData };
  const player = gameState.players[playerIndex];

  const hasCollided = checkCollision(player);
  if (hasCollided) {
    gameState.gameOver = true;
    gameState.message = "Game Over! You touched the baka. Press R to Restart.";
    broadcastState();
    return;
  }

  if (player.y >= GAME_CONFIG.GROUND_Y && player.x > gameState.baka.x + GAME_CONFIG.BAKA_WIDTH) {
    player.crossed = true;
  }

  const allCrossed = gameState.players.every((p) => !p.connected || p.crossed);
  if (allCrossed && !gameState.levelIncreaseTimeout) {
    startNextRound();
  }

  broadcastState();
}

function checkCollision(player) {
  const bakaTop = gameState.baka.y - gameState.baka.height;
  const bakaLeft = gameState.baka.x;
  const bakaRight = gameState.baka.x + GAME_CONFIG.BAKA_WIDTH;

  return (
    player.x + GAME_CONFIG.PLAYER_RADIUS > bakaLeft &&
    player.x - GAME_CONFIG.PLAYER_RADIUS < bakaRight &&
    player.y + GAME_CONFIG.PLAYER_RADIUS > bakaTop &&
    player.y - GAME_CONFIG.PLAYER_RADIUS < gameState.baka.y &&
    player.vy > 0
  );
}

function startNextRound() {
  gameState.message = "Great! Cow gets taller. Next round in 3 seconds!";
  broadcastState();

  gameState.levelIncreaseTimeout = setTimeout(() => {
    gameState.score++;
    if (gameState.score >= GAME_CONFIG.LEVEL_LIMIT) {
      gameState.message = `Congratulations! You reached level ${GAME_CONFIG.LEVEL_LIMIT}. Resetting.`;
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
    broadcastState();
  }, GAME_CONFIG.ROUND_DELAY);
}

function findEmptyPlayerSlot() {
  return gameState.players.findIndex((p) => !p.connected);
}

function updateGameMessage() {
  const connectedPlayers = gameState.players.filter((p) => p.connected).length;
  if (connectedPlayers < 2) {
    gameState.message = "Waiting for another player...";
  } else {
    gameState.message = "Press Space to Jump Over the Baka!";
  }
}

// --- 5. Networking ---
function broadcastState() {
  io.emit("state", gameState);
}

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

  const playerIndex = findEmptyPlayerSlot();
  if (playerIndex === -1) {
    console.log("Server is full. New user is a spectator.");
    socket.emit("state", gameState);
    return;
  }

  gameState.players[playerIndex].id = socket.id;
  gameState.players[playerIndex].connected = true;
  socket.emit("assignPlayer", playerIndex);

  updateGameMessage();
  broadcastState();

  socket.on("move", ({ index, player }) => handlePlayerMove(index, player));

  socket.on("restart", () => {
    console.log("Restarting game...");
    resetGame();
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id}`);
    const playerIndex = gameState.players.findIndex((p) => p.id === socket.id);
    if (playerIndex !== -1) {
      gameState.players[playerIndex].connected = false;
      gameState.players[playerIndex].id = null;
    }
    updateGameMessage();
    broadcastState();
  });
});

// --- 6. Start Server ---
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

