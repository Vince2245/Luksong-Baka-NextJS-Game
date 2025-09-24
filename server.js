const http = require("http");
const { Server } = require("socket.io");

// --- 1. Game Configuration ---
// All constants are grouped into a single configuration object for easier management.
const GAME_CONFIG = {
    WIDTH: 800,
    HEIGHT: 400,
    PLAYER_RADIUS: 30,
    BAKA_WIDTH: 80,
    BAKA_BASE_HEIGHT: 60,
    GROUND_Y: 400 - 60, // HEIGHT - 60
    LEVEL_LIMIT: 10,
    BASE_JUMP_VY: -12,
    JUMP_INCREASE_PER_LEVEL: -1,
    BAKA_HEIGHT_INCREASE: 18,
    ROUND_DELAY: 3500, // ms
};

// --- 2. Centralized Game State ---
// All game variables are stored in a single 'gameState' object. This makes it easier
// to manage, reset, and broadcast the state of the game.
let gameState = createInitialState();

function createInitialState() {
    return {
        players: [
            { id: null, x: 80, y: GAME_CONFIG.GROUND_Y, vy: 0, jumping: false, crossed: false, connected: false },
            { id: null, x: 160, y: GAME_CONFIG.GROUND_Y, vy: 0, jumping: false, crossed: false, connected: false },
        ],
        baka: {
            x: GAME_CONFIG.WIDTH / 2 - GAME_CONFIG.BAKA_WIDTH / 2,
            y: GAME_CONFIG.GROUND_Y + 20,
            height: GAME_CONFIG.BAKA_BASE_HEIGHT,
        },
        score: 0,
        gameOver: false,
        message: "Waiting for players to connect...",
        levelIncreaseTimeout: null,
    };
}

// --- 3. Server Setup ---
const httpServer = http.createServer();
const io = new Server(httpServer, {
    cors: {
        // Using "*" is fine for development, but for production, it's better to be specific:
         origin: "https://vince2245.github.io"
        methods: ["GET", "POST"],
    },
});

// --- 4. Game Logic Functions ---
// Game logic is separated into pure functions that operate on the gameState.

/**
 * Resets the game to its initial state.
 */
function resetGame() {
    if (gameState.levelIncreaseTimeout) {
        clearTimeout(gameState.levelIncreaseTimeout);
    }
    gameState = createInitialState();
    // Keep connected player IDs
    io.allSockets().then(sockets => {
        sockets.forEach(socketId => {
            const playerIndex = findEmptyPlayerSlot();
            if (playerIndex !== -1) {
                gameState.players[playerIndex].id = socketId;
                gameState.players[playerIndex].connected = true;
            }
        });
        updateGameMessage();
        broadcastState();
    });
}

/**
 * Updates the game state based on a player's movement.
 * @param {number} playerIndex - The index of the player (0 or 1).
 * @param {object} moveData - The new position and velocity data from the client.
 */
function handlePlayerMove(playerIndex, moveData) {
    if (gameState.gameOver) return;

    // Update player data
    gameState.players[playerIndex] = { ...gameState.players[playerIndex], ...moveData };
    const player = gameState.players[playerIndex];

    // Check for collision with the baka (cow)
    const hasCollided = checkCollision(player);
    if (hasCollided) {
        gameState.gameOver = true;
        gameState.message = "Game Over! You touched the baka. Press R to Restart.";
        broadcastState();
        return;
    }

    // Check if player has successfully crossed
    if (player.y >= GAME_CONFIG.GROUND_Y && player.x > gameState.baka.x + GAME_CONFIG.BAKA_WIDTH) {
        player.crossed = true;
    }

    // Check if both players have crossed to advance the level
    const allCrossed = gameState.players.every(p => !p.connected || p.crossed);
    if (allCrossed && !gameState.levelIncreaseTimeout) {
        startNextRound();
    }

    broadcastState();
}

/**
 * Checks if a player has collided with the baka.
 * @param {object} player - The player object to check.
 * @returns {boolean} - True if a collision occurred.
 */
function checkCollision(player) {
    const bakaTop = gameState.baka.y - gameState.baka.height;
    const bakaLeft = gameState.baka.x;
    const bakaRight = gameState.baka.x + GAME_CONFIG.BAKA_WIDTH;

    return (
        player.x + GAME_CONFIG.PLAYER_RADIUS > bakaLeft &&
        player.x - GAME_CONFIG.PLAYER_RADIUS < bakaRight &&
        player.y + GAME_CONFIG.PLAYER_RADIUS > bakaTop &&
        player.y - GAME_CONFIG.PLAYER_RADIUS < gameState.baka.y &&
        player.vy > 0
    );
}

/**
 * Initiates the transition to the next round.
 */
function startNextRound() {
    gameState.message = "Great! Cow gets taller. Next round in 3 seconds!";
    broadcastState();

    gameState.levelIncreaseTimeout = setTimeout(() => {
        gameState.score++;
        if (gameState.score >= GAME_CONFIG.LEVEL_LIMIT) {
            gameState.message = `Congratulations! You reached level ${GAME_CONFIG.LEVEL_LIMIT}. Resetting.`;
            gameState.score = 0;
            gameState.baka.height = GAME_CONFIG.BAKA_BASE_HEIGHT;
        } else {
            gameState.message = "Jump over!";
            gameState.baka.height += GAME_CONFIG.BAKA_HEIGHT_INCREASE;
        }

        // Reset player positions for the new round
        gameState.players.forEach(p => {
            p.x = p.id === gameState.players[0].id ? 80 : 160;
            p.y = GAME_CONFIG.GROUND_Y;
            p.vy = 0;
            p.jumping = false;
            p.crossed = false;
        });
        
        gameState.levelIncreaseTimeout = null;
        broadcastState();
    }, GAME_CONFIG.ROUND_DELAY);
}

/**
 * Finds an available slot for a new player.
 * @returns {number} The index of the available slot, or -1 if none.
 */
function findEmptyPlayerSlot() {
    return gameState.players.findIndex(p => !p.connected);
}

/**
 * Updates the main game message based on player connection status.
 */
function updateGameMessage() {
    const connectedPlayers = gameState.players.filter(p => p.connected).length;
    if (connectedPlayers < 2) {
        gameState.message = "Waiting for another player...";
    } else {
        gameState.message = "Press Space to Jump Over the Baka!";
    }
}

// --- 5. Broadcasting and Networking ---
/**
 * Emits the current game state to all connected clients.
 */
function broadcastState() {
    io.emit("state", gameState);
}

io.on("connection", (socket) => {
    console.log(`User connected: ${socket.id}`);

    const playerIndex = findEmptyPlayerSlot();
    if (playerIndex === -1) {
        // Spectator logic could be added here
        console.log("Server is full. New user is a spectator.");
        socket.emit("state", gameState); // Send current state to spectator
        return;
    }

    // Assign player
    gameState.players[playerIndex].id = socket.id;
    gameState.players[playerIndex].connected = true;
    socket.emit("assignPlayer", playerIndex);

    updateGameMessage();
    broadcastState();

    socket.on("move", ({ index, player }) => {
        handlePlayerMove(index, player);
    });

    socket.on("restart", () => {
        console.log("Restarting game...");
        resetGame();
    });

    socket.on("disconnect", () => {
        console.log(`User disconnected: ${socket.id}`);
        const playerIndex = gameState.players.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) {
            gameState.players[playerIndex].connected = false;
            gameState.players[playerIndex].id = null;
        }
        updateGameMessage();
        broadcastState();
    });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`Socket.IO server running on port ${PORT}`);
});
