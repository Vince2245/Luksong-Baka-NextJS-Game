"use client";
import React, { useRef, useEffect, useState } from "react";
import io from "socket.io-client";
import { throttle } from "lodash";

const WIDTH = 800;
const HEIGHT = 400;
const PLAYER_RADIUS = 30;
const BAKA_WIDTH = 80;
const BAKA_HEIGHT = 60;
const GROUND_Y = HEIGHT - 60;
const GRAVITY = 0.6;
const PLAYER_SPEED = 7;
const JUMP_VY = -12;

// --- Connect to server with polling fallback ---
const socket = io("https://luksong-baka-nextjs-game.onrender.com", {
  path: "/socket.io",
  transports: ["websocket", "polling"], // fallback
  secure: true,
  withCredentials: false,
  timeout: 20000, // 20s handshake timeout
});

export default function Arena3D() {
  const canvasRef = useRef();
  const playerIndexRef = useRef(null);
  const keysRef = useRef({});
  const playersRef = useRef([
    { x: 80, y: GROUND_Y, vy: 0, jumping: false, crossed: false },
    { x: 160, y: GROUND_Y, vy: 0, jumping: false, crossed: false },
  ]);
  const bakaRef = useRef({ x: WIDTH / 2 - BAKA_WIDTH / 2, y: GROUND_Y + 20, height: BAKA_HEIGHT });

  const [score, setScore] = useState(0);
  const [message, setMessage] = useState("Waiting for another player...");
  const [gameOver, setGameOver] = useState(false);

  // --- Throttled network emit (30fps) ---
  const throttledEmit = useRef(
    throttle((data) => {
      socket.emit("move", data);
    }, 33)
  );

  // --- Socket.IO events ---
  useEffect(() => {
    socket.on("assignPlayer", (idx) => {
      playerIndexRef.current = idx;
      setMessage("Press Space to Jump Over the Baka!");
    });

    socket.on("state", (state) => {
      // Update refs directly (no React state)
      playersRef.current = state.players.map((p) => ({ ...p }));
      bakaRef.current = { ...state.baka };
      setScore(state.score);
      setMessage(state.message);
      setGameOver(state.gameOver);
    });

    socket.on("connect_error", (err) => {
      console.error("Socket connect error:", err.message);
      setMessage("Connection failed. Check server or network.");
    });

    return () => socket.disconnect();
  }, []);

  // --- Keyboard handling ---
  useEffect(() => {
    const down = (e) => (keysRef.current[e.key] = true);
    const up = (e) => (keysRef.current[e.key] = false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);

    const restartHandler = (e) => {
      if (e.key === "r" || e.key === "R") socket.emit("restart");
    };
    window.addEventListener("keydown", restartHandler);

    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("keydown", restartHandler);
    };
  }, []);

  // --- Main game loop ---
  useEffect(() => {
    let anim;
    function moveLoop() {
      const idx = playerIndexRef.current;
      if (idx === null) {
        anim = requestAnimationFrame(moveLoop);
        return;
      }

      const players = playersRef.current;
      const baka = bakaRef.current;
      const keys = keysRef.current;
      const p = players[idx];

      // Horizontal movement
      if (keys["ArrowLeft"]) p.x -= PLAYER_SPEED;
      if (keys["ArrowRight"]) p.x += PLAYER_SPEED;
      p.x = Math.max(PLAYER_RADIUS, Math.min(WIDTH - PLAYER_RADIUS, p.x));

      // Jump
      if ((keys[" "] || keys["Spacebar"]) && !p.jumping && p.y >= GROUND_Y) {
        p.vy = JUMP_VY;
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

      // Emit position throttled
      throttledEmit.current({ index: idx, player: p });

      // Draw canvas
      drawCanvas(players, baka);

      anim = requestAnimationFrame(moveLoop);
    }

    function drawCanvas(players, baka) {
      const ctx = canvasRef.current.getContext("2d");
      ctx.clearRect(0, 0, WIDTH, HEIGHT);

      // Background
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
      players.forEach((pl, i) => {
        if (!pl) return;
        ctx.beginPath();
        ctx.arc(pl.x, pl.y, PLAYER_RADIUS, 0, 2 * Math.PI);
        ctx.fillStyle = "#3498db";
        ctx.fill();
        ctx.strokeStyle = "#222";
        ctx.lineWidth = 3;
        ctx.stroke();

        ctx.font = "16px sans-serif";
        ctx.fillStyle = "#fff";
        ctx.fillText(i === playerIndexRef.current ? "You" : "Teammate", pl.x - 32, pl.y - 40);

        if (pl.crossed) {
          ctx.font = "bold 18px sans-serif";
          ctx.fillStyle = "#0f0";
          ctx.fillText("✓", pl.x - 8, pl.y - 50);
        }
      });

      // Score & messages
      ctx.font = "24px sans-serif";
      ctx.fillStyle = "#fff";
      ctx.fillText(`Level: ${score + 1}`, WIDTH / 2 - 40, 40);

      if (message) {
        ctx.font = "28px sans-serif";
        ctx.fillStyle = "#f7c325";
        ctx.fillText(message, WIDTH / 2 - 220, 80);
      }
    }

    anim = requestAnimationFrame(moveLoop);
    return () => cancelAnimationFrame(anim);
  }, [score, message]);

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
