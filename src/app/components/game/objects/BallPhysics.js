import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { COURT_LENGTH, COURT_WIDTH, NET_HEIGHT, SERVE_TIME } from "../config";
import { playSound } from "../utils/sound";

export default function BallPhysics({
  ballState,
  setBallState,
  isPlaying,
  turn,
  playerId,
  playerPos,
  socket,
  setServeCountdown,
  setIsServing,
  setBallOnGround,
  scoredThisRally,
  setScoredThisRally,
  server,
  playerTouches,
  setPlayerTouches,
}) {
  const lastEmit = useRef(Date.now());
  const lastTouchBy = useRef(null);

  useFrame(() => {
    if (!isPlaying || !socket) return;

    let { x, y, z, vx, vy, vz } = ballState;

    vy -= 0.006;
    x += vx * 0.7;
    y += vy * 0.7;
    z += vz * 0.7;

    // Out-of-bounds (end lines)
    if (x < -COURT_LENGTH / 2 || x > COURT_LENGTH / 2) {
      if (!scoredThisRally) {
        const winner =
          (x < -COURT_LENGTH / 2 && server === "player2") ||
          (x > COURT_LENGTH / 2 && server === "player1")
            ? "player"
            : "opponent";
        socket.emit("score", winner);
        setIsServing(true);
        setServeCountdown(SERVE_TIME);
        setBallState({
          x: winner === "player" ? -COURT_LENGTH / 4 - 1 : COURT_LENGTH / 4 + 1,
          y: 0.5,
          z: 0,
          vx: 0,
          vy: 0,
          vz: 0,
        });
        setScoredThisRally(true);
        playSound("/score.mp3");
        return;
      }
    }

    // Floor bounce (end rally)
    if (y < 0.25) {
      y = 0.25;
      vy = 0;
      vx = 0;
      vz = 0;
      setBallOnGround(true);

      if (!scoredThisRally) {
        const winner = lastTouchBy.current === playerId ? "opponent" : "player";
        socket.emit("score", winner);
        setIsServing(true);
        setServeCountdown(SERVE_TIME);
        setBallState({
          x: winner === "player" ? -COURT_LENGTH / 4 - 1 : COURT_LENGTH / 4 + 1,
          y: 0.5,
          z: 0,
          vx: 0,
          vy: 0,
          vz: 0,
        });
        setScoredThisRally(true);
        playSound("/score.mp3");
        return;
      }
    } else {
      setBallOnGround(false);
    }

    // Ceiling
    if (y > 3) {
      y = 3;
      vy = -Math.abs(vy) * 0.8;
    }

    // Side walls
    if (z < -COURT_WIDTH / 2) {
      z = -COURT_WIDTH / 2;
      vz = -vz * 0.8;
    }
    if (z > COURT_WIDTH / 2) {
      z = COURT_WIDTH / 2;
      vz = -vz * 0.8;
    }

    // Net collision
    if (Math.abs(x) < 0.1 && y < NET_HEIGHT && y > 0) {
      vx *= -0.7;
      x = x > 0 ? 0.11 : -0.11;
    }

    // Touch logic for up to 3 touches per side
    const dx = x - playerPos[0];
    const dz = z - playerPos[2];
    if (
      Math.abs(dx) < 0.7 &&
      Math.abs(dz) < 0.7 &&
      y > 0.26 &&
      y < 2.2 &&
      vy < 0.05
    ) {
      if (lastTouchBy.current !== playerId) {
        setPlayerTouches((t) => {
          if (t + 1 >= 3) {
            if (!scoredThisRally) {
              socket.emit("score", "opponent");
              setIsServing(true);
              setServeCountdown(SERVE_TIME);
              setBallState({
                x: COURT_LENGTH / 4 + 1,
                y: 0.5,
                z: 0,
                vx: 0,
                vy: 0,
                vz: 0,
              });
              setScoredThisRally(true);
              playSound("/score.mp3");
            }
            return t;
          }
          vy = 0.16;
          vx = turn === playerId ? 0.18 : -0.18;
          lastTouchBy.current = playerId;
          playSound("/kick.mp3");
          return t + 1;
        });
      }
    }

    setBallState({ x, y, z, vx, vy, vz });

    const now = Date.now();
    if (now - lastEmit.current > 80) {
      socket.emit("ballUpdate", { x, y, z, vx, vy, vz });
      lastEmit.current = now;
    }
  });

  return null;
}