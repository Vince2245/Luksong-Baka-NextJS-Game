
# Jump Over the Baka

## 1. Synopsis / Introduction
**Jump Over the Baka** is a real-time multiplayer browser game inspired by the traditional Filipino children's game **“Luksong Baka”**. Players take turns jumping over a **Baka** (cow) obstacle that grows taller as the game progresses. The goal is to jump over the Baka without touching it, increasing the level and score with each successful round.

The game uses **Socket.IO** for real-time multiplayer synchronization between clients and a **Node.js** server.

---

## 2. Controls / Instructions

- **Arrow Left / Arrow Right:** Move your player left or right.  
- **Spacebar:** Jump over the Baka.  
- **R key:** Restart the game after a game-over or to reset levels.  

**Objective:** Both players must jump over the Baka to increase the level and score. Avoid touching the Baka.

---

## 3. Event-to-Code Mapping (EVD Mapping)

| Event                 | Description / Code Handling |
|-----------------------|----------------------------|
| `connection`          | Triggered when a new player joins. Assigns player index and updates ready status. |
| `join`                | Triggered when a player joins the game session. Updates message to start jumping. |
| `move`                | Triggered when a player moves/jumps. Updates player position, collision detection, level progression, and broadcasts state. |
| `restart`             | Triggered when a player presses "R". Resets game state and broadcasts update. |
| `disconnect`          | Triggered when a player leaves. Updates ready status and resets message. |
| `assignPlayer` (client) | Server assigns player index to client. |
| `state` (client)      | Server broadcasts updated game state to clients. |

---

## 4. Events Used

- **Server-side:** `connection`, `join`, `move`, `restart`, `disconnect`  
- **Client-side:** `assignPlayer`, `state`  

---

## 5. APIs Used

- **Socket.IO:** Real-time bidirectional communication between client and server.  
- **Node.js HTTP:** Creates a server to host the Socket.IO server.  
- **Canvas API:** Renders players, Baka, and game information on the client.  
- **React Hooks:** useState, useEffect, useRef to manage state and side effects.  
- **Lodash throttle:** Limits the frequency of sending player movement updates to the server.  

---

## 6. API Code Snippets / Usage

### Server (Node.js + Socket.IO)
```javascript
const http = require("http");
const { Server } = require("socket.io");

const httpServer = http.createServer();
const io = new Server(httpServer, { cors: { origin: "*" } });

io.on("connection", socket => {
  // Assign player, handle move, restart, disconnect
  socket.on("move", data => { /* handle player movement */ });
  socket.on("restart", () => { /* reset game */ });
});

httpServer.listen(3001, () => console.log("Server running"));
````

### Client (React + Canvas + Socket.IO)

```javascript
import io from "socket.io-client";

const socket = io("http://localhost:3001");

socket.on("assignPlayer", idx => setPlayerIndex(idx));
socket.on("state", state => { /* update canvas */ });
socket.emit("join");
socket.emit("move", { index: playerIndex, player: updatedPlayer });
socket.emit("restart");
```

### Canvas Rendering

```javascript
const ctx = canvasRef.current.getContext("2d");
ctx.clearRect(0, 0, WIDTH, HEIGHT);
ctx.fillRect(baka.x, baka.y - baka.height, BAKA_WIDTH, baka.height);
ctx.arc(player.x, player.y, PLAYER_RADIUS, 0, 2*Math.PI);
ctx.fill();
```


