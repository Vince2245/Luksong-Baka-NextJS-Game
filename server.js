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
  BAKA_HEIGHT_INCREASE: 18,
  ROUND_DELAY: 3500,
};

let gameState = createInitialState();

function createInitialState() {
  return {
    players: [
      { id: null, x: 80, y: GAME_CONFIG.GROUND_Y, vy: 0, jumping: false, crossed: false, connected: false },
      { id: null, x: 160, y: GAME_CONFIG.GROUND_Y, vy: 0, jumping: false, crossed: false, connected: false },
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
  const io = new Server(server, { cors: { origin: "*", methods: ["GET","POST"] } });

  app.get("/health", (req, res) => res.send("✅ Server running!"));
  app.use((req,res) => handle(req,res));

  function resetGame() {
    if (gameState.levelIncreaseTimeout) clearTimeout(gameState.levelIncreaseTimeout);
    gameState = createInitialState();
  }

  function handlePlayerMove(index, moveData) {
    if (!gameState.players[index] || gameState.gameOver) return;
    gameState.players[index] = { ...gameState.players[index], ...moveData };

    const player = gameState.players[index];
    const bakaTop = gameState.baka.y - gameState.baka.height;
    const bakaLeft = gameState.baka.x;
    const bakaRight = gameState.baka.x + GAME_CONFIG.BAKA_WIDTH;

    if (player.x + GAME_CONFIG.PLAYER_RADIUS > bakaLeft &&
        player.x - GAME_CONFIG.PLAYER_RADIUS < bakaRight &&
        player.y + GAME_CONFIG.PLAYER_RADIUS > bakaTop &&
        player.vy > 0) {
      gameState.gameOver = true;
      gameState.message = "Game Over! Press R to restart.";
    }

    if (player.y >= GAME_CONFIG.GROUND_Y && player.x > gameState.baka.x + GAME_CONFIG.BAKA_WIDTH) {
      player.crossed = true;
    }

    const allCrossed = gameState.players.every(p => !p.connected || p.crossed);
    if (allCrossed && !gameState.levelIncreaseTimeout) startNextRound();
  }

  function startNextRound() {
    gameState.message = "Next round soon!";
    gameState.levelIncreaseTimeout = setTimeout(() => {
      gameState.score++;
      if (gameState.score >= GAME_CONFIG.LEVEL_LIMIT) {
        gameState.message = `🎉 Congratulations! Level ${GAME_CONFIG.LEVEL_LIMIT}, resetting.`;
        gameState.score = 0;
        gameState.baka.height = GAME_CONFIG.BAKA_BASE_HEIGHT;
      } else {
        gameState.message = "Jump over!";
        gameState.baka.height += GAME_CONFIG.BAKA_HEIGHT_INCREASE;
      }

      gameState.players.forEach((p,i)=>{
        p.x = i===0?80:160;
        p.y = GAME_CONFIG.GROUND_Y;
        p.vy = 0;
        p.jumping = false;
        p.crossed = false;
      });

      gameState.levelIncreaseTimeout = null;
    }, GAME_CONFIG.ROUND_DELAY);
  }

  function findEmptyPlayerSlot() {
    return gameState.players.findIndex(p => !p.connected);
  }

  io.on("connection", socket => {
    console.log(`⚡ Connected: ${socket.id}`);
    if (gameState.players.find(p=>p.id===socket.id)) return;

    const idx = findEmptyPlayerSlot();
    if (idx===-1) {
      console.log("Server full → spectator");
      socket.emit("state", gameState);
      return;
    }

    gameState.players[idx].id = socket.id;
    gameState.players[idx].connected = true;
    socket.emit("assignPlayer", idx);

    socket.on("move", data => handlePlayerMove(data.index, data.player));
    socket.on("restart", resetGame);

    socket.on("disconnect", () => {
      console.log(`❌ Disconnected: ${socket.id}`);
      const idx = gameState.players.findIndex(p=>p.id===socket.id);
      if(idx!==-1) gameState.players[idx]={...gameState.players[idx],connected:false,id:null};
    });
  });

  // Server tick: broadcast at 30fps
  setInterval(()=> io.emit("state", gameState), 1000/30);

  const PORT = process.env.PORT || 3000;
  server.listen(PORT, ()=>console.log(`🚀 Server running on port ${PORT}`));
});
