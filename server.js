import { createServer } from "http";
import { Server } from "socket.io";

const httpServer = createServer();
const io = new Server(httpServer, {
  cors: { origin: "*" }, // allow all origins for development
});

// Track players
let players = [];
let turn = "player1"; // who serves next
let score = { player1: 0, player2: 0 };

io.on("connection", (socket) => {
  console.log("New client connected:", socket.id);

  // Assign player
  let playerId;
  if (players.length === 0) playerId = "player1";
  else if (players.length === 1) playerId = "player2";
  else {
    socket.emit("full", "Game already has 2 players");
    return;
  }
  players.push({ id: socket.id, role: playerId });
  socket.emit("assignPlayer", playerId);
  console.log(players);

  // Start game if 2 players
  if (players.length === 2) {
    io.emit("startGame");
    io.emit("turnUpdate", turn);
    io.emit("scoreUpdate", score);
  }

  // Player movement
  socket.on("move", (data) => {
    socket.broadcast.emit("move", data);
  });

  // Serve the ball
  socket.on("serve", (data) => {
    // Only allow if it's this player's turn
    const player = players.find((p) => p.id === socket.id);
    if (player && player.role === turn) {
      io.emit("serve", data);
    }
  });

  // Ball physics updates
  socket.on("ballUpdate", (data) => {
    socket.broadcast.emit("ballUpdate", data);
  });

  // Score updates
  socket.on("score", (who) => {
    if (who === "player") score.player1++;
    else if (who === "opponent") score.player2++;

    // Switch serve turn after point
    turn = turn === "player1" ? "player2" : "player1";

    io.emit("scoreUpdate", score);
    io.emit("turnUpdate", turn);
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    console.log("Client disconnected", socket.id);
    players = players.filter((p) => p.id !== socket.id);
    // Reset game if a player leaves
    if (players.length < 2) {
      score = { player1: 0, player2: 0 };
      turn = "player1";
      io.emit("resetGame");
    }
  });
});

// Listen on all interfaces for LAN access
httpServer.listen(3001, "0.0.0.0", () => {
  console.log("Socket.IO server running on port 3001");
});
