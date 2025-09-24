"use client";
import React, { useRef, useEffect, useState } from "react";
import io from "socket.io-client";

const WIDTH = 800, HEIGHT = 400, PLAYER_RADIUS = 30, BAKA_WIDTH = 80, BAKA_HEIGHT = 60, GROUND_Y = 340;
const PLAYER_SPEED = 7, GRAVITY = 0.6;

export default function Arena3D() {
  const canvasRef = useRef();
  const socketRef = useRef();
  const playersRef = useRef([{ x: 80, y: GROUND_Y, vy: 0, jumping: false, crossed: false }, { x: 160, y: GROUND_Y, vy: 0, jumping: false, crossed: false }]);
  const bakaRef = useRef({ x: WIDTH/2 - BAKA_WIDTH/2, y: GROUND_Y+20, height: BAKA_HEIGHT });
  const [playerIndex, setPlayerIndex] = useState(null);
  const keysRef = useRef({});

  useEffect(() => {
    socketRef.current = io("https://luksong-baka-nextjs-game.onrender.com", {
      transports: ["websocket"], path: "/socket.io"
    });

    socketRef.current.on("assignPlayer", idx => setPlayerIndex(idx));

    socketRef.current.on("state", state => {
      playersRef.current = state.players;
      bakaRef.current = state.baka;
    });

    return () => socketRef.current.disconnect();
  }, []);

  useEffect(() => {
    const down = e => keysRef.current[e.key] = true;
    const up = e => keysRef.current[e.key] = false;
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  useEffect(() => {
    let anim;
    const loop = () => {
      const p = playersRef.current[playerIndex];
      if (p) {
        if (keysRef.current.ArrowLeft) p.x -= PLAYER_SPEED;
        if (keysRef.current.ArrowRight) p.x += PLAYER_SPEED;
        if ((keysRef.current[" "] || keysRef.current.Spacebar) && !p.jumping && p.y >= GROUND_Y) {
          p.vy = -12; p.jumping = true;
        }

        p.vy += GRAVITY;
        p.y += p.vy;
        if (p.y >= GROUND_Y) { p.y = GROUND_Y; p.vy = 0; p.jumping = false; }

        socketRef.current.emit("move", { index: playerIndex, player: p });
      }

      const ctx = canvasRef.current.getContext("2d");
      ctx.clearRect(0,0,WIDTH,HEIGHT);
      ctx.fillStyle="#7cfc00"; ctx.fillRect(0,GROUND_Y+PLAYER_RADIUS,WIDTH,HEIGHT-GROUND_Y);
      ctx.fillStyle="#964B00"; ctx.fillRect(bakaRef.current.x,bakaRef.current.y-bakaRef.current.height,BAKA_WIDTH,bakaRef.current.height);

      playersRef.current.forEach((pl,i)=>{
        if(!pl) return;
        ctx.beginPath(); ctx.arc(pl.x,pl.y,PLAYER_RADIUS,0,2*Math.PI);
        ctx.fillStyle="#3498db"; ctx.fill(); ctx.strokeStyle="#222"; ctx.lineWidth=3; ctx.stroke();
      });

      anim = requestAnimationFrame(loop);
    };
    anim = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(anim);
  }, [playerIndex]);

  return <canvas ref={canvasRef} width={WIDTH} height={HEIGHT} style={{ background:"#222", borderRadius:12 }} />;
}
