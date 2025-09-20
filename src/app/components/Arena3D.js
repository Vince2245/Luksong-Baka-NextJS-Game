"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { PerspectiveCamera, Text } from "@react-three/drei";
import { useState, useEffect, useRef } from "react";
import io from "socket.io-client";

// --- CONFIGURABLES ---
const COURT_LENGTH = 13.4;
const COURT_WIDTH = 6.1;
const NET_HEIGHT = 1.52;
const PLAYER_HEIGHT = 1.9;
const SERVE_TIME = 15; // Improved: more time to react
const WIN_SCORE = 15;
const SERVE_LINE_X = 2.5; // Must be behind this line to serve
const MAX_TOUCHES = 3; // Improved: allow up to 3 touches per side

// --- SOUND EFFECTS ---
const playSound = (src) => {
  const audio = new window.Audio(src);
  audio.volume = 0.5;
  audio.play();
};

// --- COMPONENTS ---
const Player = ({ position, color, name }) => (
  <mesh position={[position[0], PLAYER_HEIGHT / 2, position[2]]}>
    <cylinderGeometry args={[0.3, 0.3, PLAYER_HEIGHT, 16]} />
    <meshStandardMaterial color={color} />
    {name && (
      <Text
        position={[0, PLAYER_HEIGHT / 2 + 0.5, 0]}
        fontSize={0.3}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        {name}
      </Text>
    )}
  </mesh>
);

const FixedCamera = () => {
  const camera = useThree((state) => state.camera);
  camera.position.set(0, 10, 20);
  camera.lookAt(0, 0, 0);
  return null;
};

const CourtLines = () => {
  const lineThickness = 0.05;
  return (
    <>
      <mesh position={[0, 0.03, -COURT_WIDTH / 2]}>
        <boxGeometry args={[COURT_LENGTH, 0.02, lineThickness]} />
        <meshStandardMaterial color="white" />
      </mesh>
      <mesh position={[0, 0.03, COURT_WIDTH / 2]}>
        <boxGeometry args={[COURT_LENGTH, 0.02, lineThickness]} />
        <meshStandardMaterial color="white" />
      </mesh>
      <mesh position={[-COURT_LENGTH / 2, 0.03, 0]}>
        <boxGeometry args={[lineThickness, 0.02, COURT_WIDTH]} />
        <meshStandardMaterial color="white" />
      </mesh>
      <mesh position={[COURT_LENGTH / 2, 0.03, 0]}>
        <boxGeometry args={[lineThickness, 0.02, COURT_WIDTH]} />
        <meshStandardMaterial color="white" />
      </mesh>
    </>
  );
};

const Ball = ({ ballState }) => {
  const ballRef = useRef();
  const shadowRef = useRef();

  useFrame(() => {
    if (!ballRef.current) return;
    ballRef.current.position.set(ballState.x, ballState.y, ballState.z);
    shadowRef.current.position.set(ballState.x, 0.05, ballState.z);
  });

  return (
    <>
      <mesh ref={ballRef} castShadow>
        <sphereGeometry args={[0.25, 32, 32]} />
        <meshStandardMaterial color="yellow" />
      </mesh>
      <mesh ref={shadowRef} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.25, 32]} />
        <meshStandardMaterial color="black" opacity={0.5} transparent />
      </mesh>
    </>
  );
};

const BallPhysics = ({
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
  opponentTouches,
  setOpponentTouches,
}) => {
  const lastEmit = useRef(Date.now());
  const lastTouchBy = useRef(null);

  useFrame(() => {
    if (!isPlaying || !socket) return;

    let { x, y, z, vx, vy, vz } = ballState;

    // Improved: Slower gravity and ball movement for more reaction time
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
        // Improved: Use lastTouchBy for fair point assignment
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

    // Improved: Touch logic for up to 3 touches per side
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
          if (t + 1 >= MAX_TOUCHES) {
            // Too many touches, point to opponent
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

    // Improved: Throttle ballUpdate emits to every 80ms
    const now = Date.now();
    if (now - lastEmit.current > 80) {
      socket.emit("ballUpdate", { x, y, z, vx, vy, vz });
      lastEmit.current = now;
    }
  });

  return null;
};

export default function ArenaMultiplayer() {
  const [playerId, setPlayerId] = useState(null);
  const [playerPos, setPlayerPos] = useState([-COURT_LENGTH / 4 - 1, 0, 0]);
  const [opponentPos, setOpponentPos] = useState([COURT_LENGTH / 4 + 1, 0, 0]);
  const [ballState, setBallState] = useState({
    x: -COURT_LENGTH / 4 - 1,
    y: 0.5,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
  });
  const [score, setScore] = useState({ player: 0, opponent: 0 });
  const [isPlaying, setIsPlaying] = useState(false);
  const [turn, setTurn] = useState("player1");
  const [waiting, setWaiting] = useState(true);
  const [serveCountdown, setServeCountdown] = useState(SERVE_TIME);
  const [playerName, setPlayerName] = useState("");
  const [opponentName, setOpponentName] = useState("Opponent");
  const [showStart, setShowStart] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [connectionLost, setConnectionLost] = useState(false);
  const [isServing, setIsServing] = useState(true);
  const [ballOnGround, setBallOnGround] = useState(false);
  const [scoredThisRally, setScoredThisRally] = useState(false);
  const [server, setServer] = useState("player1");
  const [playerTouches, setPlayerTouches] = useState(0);
  const [opponentTouches, setOpponentTouches] = useState(0);

  const socketRef = useRef(null);

  function isInServeArea(x, playerId) {
    if (playerId === "player1") return x <= -SERVE_LINE_X;
    else return x >= SERVE_LINE_X;
  }

  // Improved: Reset touches on serve or after point
  useEffect(() => {
    if (isServing || scoredThisRally) {
      setPlayerTouches(0);
      setOpponentTouches(0);
    }
  }, [isServing, scoredThisRally]);

  useEffect(() => {
    const name = prompt("Enter your nickname:", "");
    setPlayerName(name ? name : "Player");
  }, []);

  useEffect(() => {
    socketRef.current = io("http://192.168.1.9:3001");

    socketRef.current.on("connect", () => {
      setConnectionLost(false);
      socketRef.current.emit("joinGame", { name: playerName });
    });

    socketRef.current.on("disconnect", () => {
      setConnectionLost(true);
    });

    socketRef.current.on("initPositions", ({ playerPos, opponentPos, ballState, turn }) => {
      setPlayerPos([playerPos[0] + (playerPos[0] < 0 ? -1 : 1), 0, playerPos[2]]);
      setOpponentPos([opponentPos[0] + (opponentPos[0] < 0 ? -1 : 1), 0, opponentPos[2]]);
      setBallState(ballState);
      setTurn(turn);
    });

    socketRef.current.on("forceReset", ({ playerPos, opponentPos, ballState, score, turn }) => {
      setPlayerPos([playerPos[0] + (playerPos[0] < 0 ? -1 : 1), 0, playerPos[2]]);
      setOpponentPos([opponentPos[0] + (opponentPos[0] < 0 ? -1 : 1), 0, opponentPos[2]]);
      setBallState(ballState);
      setScore(score);
      setTurn(turn);
      setIsPlaying(false);
      setGameOver(false);
      setShowStart(false);
      setIsServing(true);
      setScoredThisRally(false);
    });

    socketRef.current.on("assignPlayer", (id) => {
      setPlayerId(id);
    });
    socketRef.current.on("opponentName", (name) => setOpponentName(name || "Opponent"));
    socketRef.current.on("startGame", () => {
      setIsPlaying(true);
      setWaiting(false);
      setServeCountdown(SERVE_TIME);
      setShowStart(false);
      setGameOver(false);
      setIsServing(true);
      setScoredThisRally(false);
      setPlayerPos([-COURT_LENGTH / 4 - 1, 0, 0]);
      setOpponentPos([COURT_LENGTH / 4 + 1, 0, 0]);
      playSound("/serve.mp3");
    });
    socketRef.current.on("move", (data) => setOpponentPos([data.x, 0, data.z]));
    socketRef.current.on("serve", (data) => {
      setBallState(data);
      setIsServing(false);
      setServeCountdown(null);
      setScoredThisRally(false);
      playSound("/serve.mp3");
    });
    socketRef.current.on("ballUpdate", (data) => setBallState(data));
    socketRef.current.on("scoreUpdate", ({ player1, player2 }) => {
      setScore({ player: player1, opponent: player2 });
      setServer((prev) => (prev === "player1" ? "player2" : "player1"));
      if (player1 >= WIN_SCORE || player2 >= WIN_SCORE) {
        setGameOver(true);
        setIsPlaying(false);
        setShowStart(false);
        playSound("/score.mp3");
      }
    });
    socketRef.current.on("turnUpdate", (t) => setTurn(t));
    socketRef.current.on("resetGame", () => {
      setIsPlaying(false);
      setScore({ player: 0, opponent: 0 });
      setBallState({
        x: -COURT_LENGTH / 4 - 1,
        y: 0.5,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
      });
      setShowStart(false);
      setGameOver(false);
      setIsServing(true);
      setScoredThisRally(false);
      setPlayerPos([-COURT_LENGTH / 4 - 1, 0, 0]);
      setOpponentPos([COURT_LENGTH / 4 + 1, 0, 0]);
    });

    socketRef.current.on("startGameReady", () => {
      setShowStart(true);
    });

    socketRef.current.on("rematchReady", () => {
      setGameOver(false);
      setWaiting(false);
      setIsPlaying(false);
      setShowStart(true);
      setScore({ player: 0, opponent: 0 });
      setIsServing(true);
      setScoredThisRally(false);
      setPlayerPos([-COURT_LENGTH / 4 - 1, 0, 0]);
      setOpponentPos([COURT_LENGTH / 4 + 1, 0, 0]);
    });

    return () => {
      socketRef.current.disconnect();
    };
    // eslint-disable-next-line
  }, [playerName, playerId]);

  useEffect(() => {
    if (playerId && !waiting) {
      socketRef.current.emit("readyForStart");
    }
  }, [playerId, waiting]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isPlaying || !socketRef.current) return;

      setPlayerPos((pos) => {
        let x = pos[0];
        let z = pos[2];

        const isPlayer1 = playerId === "player1";
        const minX = isPlayer1 ? -COURT_LENGTH / 2 + 0.5 : 0.1;
        const maxX = isPlayer1 ? -0.1 : COURT_LENGTH / 2 - 0.5;

        switch (e.key) {
          case "ArrowUp":
            z = Math.max(z - 0.3, -COURT_WIDTH / 2 + 0.5);
            break;
          case "ArrowDown":
            z = Math.min(z + 0.3, COURT_WIDTH / 2 - 0.5);
            break;
          case "ArrowLeft":
            x = Math.max(x - 0.3, minX);
            break;
          case "ArrowRight":
            x = Math.min(x + 0.3, maxX);
            break;
          case " ":
            if (
              isServing &&
              playerId === server &&
              serveCountdown !== null &&
              serveCountdown <= SERVE_TIME &&
              isInServeArea(x, playerId)
            ) {
              handleServe();
            }
            break;
          case "k":
            if (!isServing) handleKick(x, z);
            break;
        }

        socketRef.current.emit("move", { x, z });
        return [x, 0, z];
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line
  }, [isPlaying, server, playerId, serveCountdown, ballState, isServing]);

  useEffect(() => {
    if (!isServing || serveCountdown === null) return;
    const interval = setInterval(() => {
      setServeCountdown((prev) => {
        if (prev <= 1) return SERVE_TIME;
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [serveCountdown, isServing]);

  const handleServe = () => {
    if (!isServing || playerId !== server || !isInServeArea(playerPos[0], playerId)) return;
    const isPlayer1 = playerId === "player1";
    const serveData = {
      x: playerPos[0],
      y: PLAYER_HEIGHT + 0.4,
      z: playerPos[2],
      vx: 0.14 * (isPlayer1 ? 1 : -1),
      vy: 0.13,
      vz: 0,
    };
    setBallState(serveData);
    socketRef.current.emit("serve", serveData);
    setServeCountdown(null);
    setIsServing(false);
    setScoredThisRally(false);
    playSound("/serve.mp3");
  };

  // Improved: Use touches to prevent exploits and allow "saving"
  const handleKick = (x, z) => {
    const dx = ballState.x - x;
    const dz = ballState.z - z;
    if (
      Math.abs(dx) < 0.7 &&
      Math.abs(dz) < 0.7 &&
      ballState.y > 0.26 &&
      ballState.y < 2.2
    ) {
      if (playerTouches < MAX_TOUCHES) {
        setBallState((b) => ({
          ...b,
          vx: turn === playerId ? 0.18 : -0.18,
          vy: 0.16,
        }));
        playSound("/kick.mp3");
        setPlayerTouches((t) => t + 1);
      }
    }
  };

  const movePlayer = (dx, dz) => {
    setPlayerPos((pos) => {
      const isPlayer1 = playerId === "player1";
      const minX = isPlayer1 ? -COURT_LENGTH / 2 + 0.5 : 0.1;
      const maxX = isPlayer1 ? -0.1 : COURT_LENGTH / 2 - 0.5;
      let x = Math.max(Math.min(pos[0] + dx, maxX), minX);
      let z = Math.max(Math.min(pos[2] + dz, COURT_WIDTH / 2 - 0.5), -COURT_WIDTH / 2 + 0.5);
      socketRef.current.emit("move", { x, z });
      return [x, 0, z];
    });
  };

  return (
    <>
      <Canvas
        shadows
        style={{ height: "100vh", width: "100vw", background: "#111111" }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[20, 40, 20]}
          intensity={1.2}
          castShadow
        />
        <PerspectiveCamera makeDefault fov={25} />
        <FixedCamera />

        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[COURT_LENGTH, COURT_WIDTH]} />
          <meshStandardMaterial color="rgba(199,46,46,1)" />
        </mesh>

        <CourtLines />
        <mesh position={[0, NET_HEIGHT / 2, 0]}>
          <boxGeometry args={[0.2, NET_HEIGHT, COURT_WIDTH]} />
          <meshStandardMaterial color="white" />
        </mesh>

        <Player position={playerPos} color="gray" name={playerName} />
        <Player position={opponentPos} color="white" name={opponentName} />

        {isPlaying && (
          <BallPhysics
            ballState={ballState}
            setBallState={setBallState}
            isPlaying={isPlaying}
            turn={turn}
            playerId={playerId}
            playerPos={playerPos}
            socket={socketRef.current}
            setServeCountdown={setServeCountdown}
            setIsServing={setIsServing}
            setBallOnGround={setBallOnGround}
            scoredThisRally={scoredThisRally}
            setScoredThisRally={setScoredThisRally}
            server={server}
            playerTouches={playerTouches}
            setPlayerTouches={setPlayerTouches}
            opponentTouches={opponentTouches}
            setOpponentTouches={setOpponentTouches}
          />
        )}
        {isPlaying && <Ball ballState={ballState} />}
      </Canvas>

      {/* Scores */}
      <div
        style={{
          position: "absolute",
          top: 20,
          left: 20,
          color: "white",
          fontSize: 24,
        }}
      >
        {playerName}: {score.player}
      </div>
      <div
        style={{
          position: "absolute",
          top: 20,
          right: 20,
          color: "white",
          fontSize: 24,
        }}
      >
        {opponentName}: {score.opponent}
      </div>

      {/* Serve indicator with visual highlight */}
      {isServing && serveCountdown !== null && !gameOver && (
        <div
          style={{
            position: "absolute",
            top: 60,
            left: "50%",
            transform: "translateX(-50%)",
            color: playerId === server ? "#f7c325" : "#fff",
            fontSize: 24,
            fontWeight: "bold",
            border: playerId === server ? "3px solid #f7c325" : "3px solid #fff",
            borderRadius: 12,
            padding: "8px 24px",
            background: "#222",
            boxShadow: "0 0 16px #000",
            zIndex: 15,
          }}
        >
          {playerId === server ? "Your serve!" : `${opponentName}'s serve`} - {serveCountdown}s
        </div>
      )}

      {/* Serve button (for mouse/touch) */}
      {isServing && playerId === server && isInServeArea(playerPos[0], playerId) && !gameOver && (
        <button
          style={{
            position: "absolute",
            bottom: 100,
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: 24,
            padding: "12px 32px",
            background: "#f7c325",
            border: "none",
            borderRadius: 12,
            cursor: "pointer",
            color: "#222",
            fontWeight: "bold",
            zIndex: 10,
          }}
          onClick={handleServe}
        >
          Serve (Space)
        </button>
      )}

      {/* Kick button (for mouse/touch) */}
      {!isServing && isPlaying && (
        <button
          style={{
            position: "absolute",
            bottom: 40,
            left: "50%",
            transform: "translateX(-50%)",
            fontSize: 24,
            padding: "12px 32px",
            background: "#f7c325",
            border: "none",
            borderRadius: 12,
            cursor: "pointer",
            color: "#222",
            fontWeight: "bold",
            zIndex: 10,
          }}
          onClick={() => handleKick(playerPos[0], playerPos[2])}
        >
          Kick (K)
        </button>
      )}

      {/* Start button */}
      {showStart && !gameOver && (
        <button
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-50%)",
            fontSize: 32,
            padding: "16px 48px",
            background: "#f7c325",
            border: "none",
            borderRadius: 12,
            cursor: "pointer",
            color: "#222",
            fontWeight: "bold",
            zIndex: 10,
          }}
          onClick={() => {
            socketRef.current.emit("startGame");
            setShowStart(false);
          }}
        >
          Start Game
        </button>
      )}

      {/* Waiting */}
      {waiting && !gameOver && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-50%)",
            color: "white",
            fontSize: 24,
          }}
        >
          Waiting for opponent...
        </div>
      )}

      {/* Game Over & Rematch */}
      {gameOver && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-50%)",
            color: "#f7c325",
            fontSize: 36,
            fontWeight: "bold",
            background: "#222",
            padding: 32,
            borderRadius: 16,
            zIndex: 20,
            textAlign: "center"
          }}
        >
          Game Over!<br />
          {score.player > score.opponent
            ? `${playerName} wins!`
            : score.player < score.opponent
            ? `${opponentName} wins!`
            : "Draw!"}
          <br />
          <button
            style={{
              marginTop: 24,
              fontSize: 24,
              padding: "12px 32px",
              background: "#f7c325",
              border: "none",
              borderRadius: 12,
              cursor: "pointer",
              color: "#222",
              fontWeight: "bold",
              zIndex: 21,
              position: "relative"
            }}
            onClick={() => {
              socketRef.current.emit("rematch");
              setGameOver(false);
              setWaiting(true);
            }}
          >
            Rematch
          </button>
        </div>
      )}

      {/* Connection lost */}
      {connectionLost && (
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-50%)",
            color: "red",
            fontSize: 24,
            background: "#222",
            padding: 24,
            borderRadius: 12,
            zIndex: 30,
          }}
        >
          Connection lost. Trying to reconnect...
        </div>
      )}

      {/* Mobile controls */}
      <div
        style={{
          position: "absolute",
          bottom: 160,
          left: "50%",
          transform: "translateX(-50%)",
          display: "flex",
          gap: 16,
          zIndex: 10,
        }}
      >
        <button onClick={() => movePlayer(-0.3, 0)}>⬅️</button>
        <button onClick={() => movePlayer(0, -0.3)}>⬆️</button>
        <button onClick={() => movePlayer(0, 0.3)}>⬇️</button>
        <button onClick={() => movePlayer(0.3, 0)}>➡️</button>
      </div>
    </>
  );
}