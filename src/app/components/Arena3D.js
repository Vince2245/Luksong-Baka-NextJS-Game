"use client";
import React, { useRef, useEffect, useState } from "react";
import { io } from "socket.io-client";
import { throttle } from "lodash";

const WIDTH = 800;
const HEIGHT = 400;
const PLAYER_RADIUS = 30;
const BAKA_WIDTH = 80;
const BAKA_HEIGHT = 60;
const GROUND_Y = HEIGHT - 60;
const GRAVITY = 0.6;
const PLAYER_SPEED = 7;

export default function Arena3D() {
  const canvasRef = useRef();
  const socketRef = useRef();

  const [players, setPlayers] = useState([
    { x: 80, y: GROUND_Y, vy: 0, jumping: false, color: "#3498db", crossed: false },
    { x: 160, y: GROUND_Y, vy: 0, jumping: false, color: "#3498db", crossed: false },
  ]);
  const [baka, setBaka] = useState({ x: WIDTH / 2 - BAKA_WIDTH / 2, y: GROUND_Y + 20, height: BAKA_HEIGHT });
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState("Waiting for another player...");
  const [gameOver, setGameOver] = useState(false);
  const [playerIndex, setPlayerIndex] = useState(null);
  const [keys, setKeys] = useState({});
  const [jumpVy, setJumpVy] = useState(-12);

  const lastMovementRef = useRef({ lastSent: null, lastEmit: 0 });
  const throttledBroadcast = useRef();

  // --- Socket.IO Connection ---
  useEffect(() => {
    const socket = io("https://luksong-baka-nextjs-game.onrender.com", {
      path: "/socket.io",
      transports: ["websocket", "polling"], // fallback to polling if websocket fails
      secure: true,
      withCredentials: false,
    });

    socketRef.current = socket;

    // Debugging logs
    socket.on("connect", () => console.log("✅ Connected to server:", socket.id));
    socket.on("disconnect", (reason) => console.log("⚠️ Disconnected:", reason));
    socket.on("connect_error", (err) => {
      console.error("❌ Connect error:", err);
      setMessage("Connection failed. Check server CORS or path.");
    });
    socket.on("connect_timeout", () => console.warn("⏱ Connect timeout"));
    socket.io.on("reconnect_attempt", (attempt) => console.log(`🔄 Reconnect attempt #${attempt}`));

    // Game events
    socket.on("assignPlayer", (idx) => {
      setPlayerIndex(idx);
      setMessage("Press Space to Jump Over the Baka!");
    });

    socket.on("state", (state) => {
      setPlayers(state.players.map((p) => ({ ...p, color: "#3498db" })));
      setBaka(state.baka);
      setScore(state.score);
      setMessage(state.message);
      setGameOver(state.gameOver);
      setJumpVy(state.jumpVy ?? -12);
    });

    return () => {
      socket.disconnect();
      console.log("🛑 Socket disconnected manually");
    };
  }, []);

  // --- Keyboard input ---
  useEffect(() => {
    if (playerIndex === null) return;
    const down = (e) => setKeys((k) => ({ ...k, [e.key]: true }));
    const up = (e) => setKeys((k) => ({ ...k, [e.key]: false }));
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [playerIndex]);

  // --- Movement loop ---
  useEffect(() => {
    if (playerIndex === null || !players[playerIndex]) return;
    let anim;

    function moveLoop() {
      if (!socketRef.current) return;

      let p = { ...players[playerIndex] };

      // Move left/right
      if (keys["ArrowLeft"]) p.x -= PLAYER_SPEED;
      if (keys["ArrowRight"]) p.x += PLAYER_SPEED;
      p.x = Math.max(PLAYER_RADIUS, Math.min(WIDTH - PLAYER_RADIUS, p.x));

      // Jump
      if ((keys[" "] || keys["Spacebar"]) && !p.jumping && p.y >= GROUND_Y) {
        p.vy = jumpVy;
        p.jumping = true;
      }

      // Gravity
      p.vy += GRAVITY;
      p.y += p.vy;

      if (p.y >= GROUND_Y) {
        p.y = GROUND_Y;
        p.vy = 0;
        p.jumping = false;
      }

      // Throttle updates to 30fps
      const now = performance.now();
      if (now - lastMovementRef.current.lastEmit > 33) {
        socketRef.current.emit("move", { index: playerIndex, player: p });
        lastMovementRef.current = { lastSent: p, lastEmit: now };
      }

      anim = requestAnimationFrame(moveLoop);
    }

    anim = requestAnimationFrame(moveLoop);
    return () => cancelAnimationFrame(anim);
  }, [playerIndex, players, keys, jumpVy]);

  // --- Restart key ---
  useEffect(() => {
    if (playerIndex === null) return;
    const handle = (e) => {
      if (e.key === "r" || e.key === "R") {
        socketRef.current.emit("restart");
        console.log("🔄 Restart requested");
      }
    };
    window.addEventListener("keydown", handle);
    return () => window.removeEventListener("keydown", handle);
  }, [playerIndex]);

  // --- Canvas rendering ---
  useEffect(() => {
    const ctx = canvasRef.current.getContext("2d");
    ctx.clearRect(0, 0, WIDTH, HEIGHT);

    // Ground
    ctx.fillStyle = "#7cfc00";
    ctx.fillRect(0, GROUND_Y + PLAYER_RADIUS, WIDTH, HEIGHT - GROUND_Y);

    // Baka
    ctx.fillStyle = "#964B00";
    ctx.fillRect(baka.x, baka.y - baka.height, BAKA_WIDTH, baka.height);
    ctx.beginPath();
    ctx.arc(baka.x + BAKA_WIDTH / 2, baka.y - baka.height + 20, 18, 0, 2 * Math.PI);
    ctx.fillStyle = "#ffe0b2";
    ctx.fill();
    ctx.strokeStyle = "#222";
    ctx.stroke();

    // Players
    players.forEach((p, i) => {
      if (!p) return;
      ctx.beginPath();
      ctx.arc(p.x, p.y, PLAYER_RADIUS, 0, 2 * Math.PI);
      ctx.fillStyle = "#3498db";
      ctx.fill();
      ctx.strokeStyle = "#222";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.font = "16px sans-serif";
      ctx.fillStyle = "#fff";
      ctx.fillText(i === playerIndex ? "You" : "Teammate", p.x - 32, p.y - 40);
      if (p.crossed) {
        ctx.font = "bold 18px sans-serif";
        ctx.fillStyle = "#0f0";
        ctx.fillText("✓", p.x - 8, p.y - 50);
      }
    });

    // UI
    ctx.font = "24px sans-serif";
    ctx.fillStyle = "#fff";
    ctx.fillText(`Level: ${score + 1}`, WIDTH / 2 - 40, 40);

    if (message) {
      ctx.font = "28px sans-serif";
      ctx.fillStyle = "#f7c325";
      ctx.fillText(message, WIDTH / 2 - 220, 80);
    }
  }, [players, baka, score, message, playerIndex]);

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        background: "#222",
      }}
    >
      <canvas
        ref={canvasRef}
        width={WIDTH}
        height={HEIGHT}
        style={{ background: "#222", borderRadius: 12, marginTop: 20 }}
      />
      <div style={{ marginTop: 10, color: "#fff" }}>
        <b>Arrows</b>: Move &nbsp; <b>Space</b>: Jump &nbsp; <b>R</b>: Restart
      </div>
    </div>
  );
}
