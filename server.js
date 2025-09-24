const http = require("http");
const { Server } = require("socket.io");

const httpServer = http.createServer();
const io = new Server(httpServer, { cors: { origin: "*" } });

const WIDTH = 800;
const HEIGHT = 400;
const PLAYER_RADIUS = 30;
const BAKA_WIDTH = 80;
const BAKA_HEIGHT = 60;
const GROUND_Y = HEIGHT - 60;
const LEVEL_LIMIT = 10;
const BASE_JUMP_VY = -12;
const JUMP_INCREASE_PER_LEVEL = -1;

function leftStartPositions() {
  return [
    { x: 80, y: GROUND_Y, vy: 0, jumping: false, color: "#3498db", crossed: false },
    { x: 160, y: GROUND_Y, vy: 0, jumping: false, color: "#3498db", crossed: false },
  ];
}

let players = leftStartPositions();
let baka = { x: WIDTH / 2 - BAKA_WIDTH / 2, y: GROUND_Y + 20, height: BAKA_HEIGHT };
let score = 0;
let gameOver = false;
let message = "Waiting for another player...";
let ready = [false, false];
let sockets = [null, null];
let levelIncreaseTimeout = null;

function getJumpVy() {
  return BASE_JUMP_VY + Math.min(score, LEVEL_LIMIT - 1) * JUMP_INCREASE_PER_LEVEL;
}

function broadcast() {
  io.emit("state", { players, baka, score, message, gameOver, jumpVy: getJumpVy() });
}

io.on("connection", socket => {
  let idx = ready.indexOf(false);
  if (idx === -1) idx = 0;
  ready[idx] = true;
  sockets[idx] = socket;
  socket.emit("assignPlayer", idx);
  broadcast();

  socket.on("join", () => {
    if (ready[0] && ready[1]) {
      message = "Press Space to Jump Over the Baka!";
      broadcast();
    }
  });

  socket.on("move", ({ index, player }) => {
    let prev = players[index];
    players[index] = { ...player, color: "#3498db", crossed: prev.crossed };

    const p = players[index];

    const bakaLeft = baka.x;
    const bakaRight = baka.x + BAKA_WIDTH;
    if (
      p.y + PLAYER_RADIUS >= baka.y - baka.height &&
      ((p.x + PLAYER_RADIUS > bakaLeft && p.x - PLAYER_RADIUS < bakaRight))
    ) {
      if (player.x < bakaLeft) {
        p.x = bakaLeft - PLAYER_RADIUS;
      }
      if (player.x > bakaRight) {
        p.x = bakaRight + PLAYER_RADIUS;
      }
    }

    if (p.y >= GROUND_Y && p.x > baka.x + BAKA_WIDTH) {
      p.crossed = true;
    }

    let failed = false;
    if (
      p.x + PLAYER_RADIUS > baka.x &&
      p.x - PLAYER_RADIUS < baka.x + BAKA_WIDTH &&
      p.y + PLAYER_RADIUS > baka.y - baka.height &&
      p.y - PLAYER_RADIUS < baka.y &&
      p.vy > 0
    ) {
      failed = true;
    }

    if (failed && !gameOver) {
      gameOver = true;
      message = "Game Over! You touched the baka. Press R to Restart.";
      broadcast();
      return;
    }

    if (players[0].crossed && players[1].crossed && !gameOver && !levelIncreaseTimeout) {
      message = "Great! Cow gets taller. Next round in 3 seconds!";
      broadcast();

      levelIncreaseTimeout = setTimeout(() => {
        // Ensure score only increases by 1
        score = Math.min(score + 1, LEVEL_LIMIT - 1);
        
        if (score >= LEVEL_LIMIT - 1) {
          score = 0;
          baka.height = BAKA_HEIGHT;
          message = `Congratulations! You reached level ${LEVEL_LIMIT}. Game resets to level 1.`;
        } else {
          baka.height += 18;
          message = "Jump over!";
        }
        
        players = leftStartPositions();
        levelIncreaseTimeout = null;
        broadcast();
      }, 3500);
      return;
    }

    broadcast();
  });

  socket.on("restart", () => {
    if (levelIncreaseTimeout) {
      clearTimeout(levelIncreaseTimeout);
      levelIncreaseTimeout = null;
    }
    score = 0;
    baka = { x: WIDTH / 2 - BAKA_WIDTH / 2, y: GROUND_Y + 20, height: BAKA_HEIGHT };
    players = leftStartPositions();
    gameOver = false;
    message = "Press Space to Jump Over!";
    broadcast();
  });

  socket.on("disconnect", () => {
    if (sockets[0] === socket) {
      ready[0] = false;
      sockets[0] = null;
    }
    if (sockets[1] === socket) {
      ready[1] = false;
      sockets[1] = null;
    }
    message = "Waiting for another player...";
    broadcast();
  });
});

httpServer.listen(3001, "0.0.0.0", () => {
  console.log("Socket.IO server running on port 3001");
});