"use client";
import React, { useRef, useEffect, useState } from "react";
import io from "socket.io-client";
import { throttle } from "lodash";

const WIDTH = 800, HEIGHT = 400;
const PLAYER_RADIUS = 30;
const BAKA_WIDTH = 80;
const BAKA_HEIGHT = 60;
const GROUND_Y = HEIGHT - 60;
const GRAVITY = 0.6;
const PLAYER_SPEED = 7;
const JUMP_VY = -12;

export default function Arena3D() {
  const canvasRef = useRef();
  const socketRef = useRef();
  const playerIndexRef = useRef(null);
  const playersRef = useRef([]);
  const bakaRef = useRef({ x: WIDTH / 2 - BAKA_WIDTH / 2, y: GROUND_Y + 20, height: BAKA_HEIGHT });
  const keysRef = useRef({});
  const [score, setScore] = useState(0);
  const [message, setMessage] = useState("Waiting for another player...");
  const [gameOver, setGameOver] = useState(false);

  useEffect(() => {
    socketRef.current = io("https://luksong-baka-nextjs-game.onrender.com", {
      path: "/socket.io",
      transports: ["websocket", "polling"],
    });

    socketRef.current.on("assignPlayer", (idx) => playerIndexRef.current = idx);
    socketRef.current.on("state", (state) => {
      playersRef.current = state.players.map((p) => ({ ...p }));
      bakaRef.current = { ...state.baka };
      setScore(state.score);
      setMessage(state.message);
      setGameOver(state.gameOver);
    });

    return () => socketRef.current.disconnect();
  }, []);

  useEffect(() => {
    const down = (e) => keysRef.current[e.key] = true;
    const up = (e) => keysRef.current[e.key] = false;
    const restart = (e) => { if (e.key.toLowerCase() === 'r') socketRef.current.emit("restart"); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("keydown", restart);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("keydown", restart);
    };
  }, []);

  const throttledInput = useRef(throttle(() => {
    if (playerIndexRef.current !== null) {
      const pInput = { left: keysRef.current["ArrowLeft"], right: keysRef.current["ArrowRight"], jump: keysRef.current[" "] || keysRef.current["Spacebar"] };
      socketRef.current.emit("input", pInput);
    }
  }, 33));

  useEffect(() => {
    let anim;
    function gameLoop() {
      const idx = playerIndexRef.current;
      if (idx !== null) {
        const players = playersRef.current;
        const baka = bakaRef.current;
        const keys = keysRef.current;
        const p = players[idx];

        // Predict own movement locally
        if (keys["ArrowLeft"]) p.x -= PLAYER_SPEED;
        if (keys["ArrowRight"]) p.x += PLAYER_SPEED;
        p.x = Math.max(PLAYER_RADIUS, Math.min(WIDTH - PLAYER_RADIUS, p.x));
        if ((keys[" "] || keys["Spacebar"]) && !p.jumping && p.y >= GROUND_Y) { p.vy = JUMP_VY; p.jumping = true; }
        p.vy += GRAVITY;
        p.y += p.vy;
        if (p.y >= GROUND_Y) { p.y = GROUND_Y; p.vy = 0; p.jumping = false; }

        throttledInput.current();
      }

      // Draw canvas
      const ctx = canvasRef.current.getContext("2d");
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      ctx.fillStyle = "#7cfc00"; ctx.fillRect(0, GROUND_Y + PLAYER_RADIUS, WIDTH, HEIGHT - GROUND_Y);
      ctx.fillStyle = "#964B00"; ctx.fillRect(bakaRef.current.x, bakaRef.current.y - bakaRef.current.height, BAKA_WIDTH, bakaRef.current.height);
      ctx.beginPath(); ctx.arc(bakaRef.current.x + BAKA_WIDTH / 2, bakaRef.current.y - bakaRef.current.height + 20, 18, 0, 2 * Math.PI); ctx.fillStyle = "#ffe0b2"; ctx.fill(); ctx.strokeStyle = "#222"; ctx.stroke();
      
      playersRef.current.forEach((p, i) => {
        if (!p) return;
        ctx.beginPath();
        ctx.arc(p.x, p.y, PLAYER_RADIUS, 0, 2*Math.PI);
        ctx.fillStyle = "#3498db"; ctx.fill(); ctx.strokeStyle="#222"; ctx.lineWidth=3; ctx.stroke();
      });

      anim = requestAnimationFrame(gameLoop);
    }
    anim = requestAnimationFrame(gameLoop);
    return () => cancelAnimationFrame(anim);
  }, []);

  return <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} style={{ background:"#222", borderRadius:12 }} />;
}
