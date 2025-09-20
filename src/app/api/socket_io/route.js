import { Server } from "socket.io";

let io;

export const GET = (req) => {
  if (!io) {
    io = new Server({
      path: "/api/socket_io/socket.io",
      cors: { origin: "*" },
    });

    let players = [];

    io.on("connection", (socket) => {
      console.log("Client connected:", socket.id);

      // Assign player1 or player2
      const playerId = players.length === 0 ? "player1" : "player2";
      players.push({ id: socket.id, role: playerId });
      socket.emit("assignPlayer", playerId);

      if (players.length === 2) io.emit("startGame");

      // Movement broadcast
      socket.on("move", (data) => socket.broadcast.emit("move", data));
      // Ball updates
      socket.on("ballUpdate", (data) => socket.broadcast.emit("ballUpdate", data));
      // Serve event
      socket.on("serve", (data) => socket.broadcast.emit("serve", data));
      // Score update
      socket.on("score", (data) => socket.broadcast.emit("score", data));

      socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id);
        players = players.filter((p) => p.id !== socket.id);
        io.emit("playerDisconnected");
      });
    });
  }

  return new Response("ok");
};
