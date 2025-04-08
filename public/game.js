// D:\Projects\MultiPlayer\public\game.js
// Game client - Pokémon-style with multiple rooms support

// DOM Elements - Screens
const lobbyScreen = document.getElementById('lobbyScreen');
const roomScreen = document.getElementById('roomScreen');
const gameScreen = document.getElementById('gameScreen');

// DOM Elements - Lobby
const publicRoomsTab = document.getElementById('publicRoomsTab');
const privateRoomTab = document.getElementById('privateRoomTab');
const createRoomTab = document.getElementById('createRoomTab');
const publicRoomsPanel = document.getElementById('publicRoomsPanel');
const privateRoomPanel = document.getElementById('privateRoomPanel');
const createRoomPanel = document.getElementById('createRoomPanel');
const publicRoomsList = document.getElementById('publicRoomsList');
const privateRoomCode = document.getElementById('privateRoomCode');
const refreshRoomsButton = document.getElementById('refreshRooms');
const joinPrivateRoomButton = document.getElementById('joinPrivateRoom');
const createNewRoomButton = document.getElementById('createNewRoom');
const publicRoomTypeRadio = document.getElementById('publicRoomType');
const privateRoomTypeRadio = document.getElementById('privateRoomType');

// DOM Elements - Room
const roomTitle = document.getElementById('roomTitle');
const roomIdDisplay = document.getElementById('roomIdDisplay');
const copyRoomCodeButton = document.getElementById('copyRoomCode');
const playerNameInput = document.getElementById('playerName');
const startGameButton = document.getElementById('startGame');
const playersListElement = document.getElementById('playersList');
const leaveRoomButton = document.getElementById('leaveRoom');

// DOM Elements - Game
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const statusElement = document.getElementById('status');
const playerInfoElement = document.getElementById('player-info');
const leaveGameButton = document.getElementById('leaveGame');
const colorOptions = document.querySelectorAll('.color-option');

// Game state
let clientId = null;
let currentRoomId = null;
let playerId = null;
let playerName = '';
let playerColor = '#4169E1'; // Default to blue
let players = {};
let gameMap = null;
const PLAYER_SIZE = 40;
const PLAYER_SPEED = 4;
const MINI_MAP_SIZE = 150; // Size of the mini-map
const CAMERA_OFFSET_X = 400; // Half of canvas width
const CAMERA_OFFSET_Y = 250; // Half of canvas height
let cameraX = 0;
let cameraY = 0;
let gameStarted = false;
let lastGameTime = 0; // For frame rate limiting
const targetFPS = 60;
const frameTime = 1000 / targetFPS;
const keys = {
    w: false,
    a: false,
    s: false,
    d: false
};

// Local storage session persistence
const SESSION_STORAGE_KEY = 'pokemon_game_session';

// Connection management
let socket = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY = 3000; // 3 seconds
let pingInterval = null;
const PING_INTERVAL = 30000; // 30 seconds

// Connect to WebSocket server
function connectToServer() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    // Close existing socket if any
    if (socket && socket.readyState !== WebSocket.CLOSED) {
        socket.close();
    }
    
    socket = new WebSocket(wsUrl);
    setupSocketHandlers();
    
    // Start ping interval to keep connection alive
    if (pingInterval) {
        clearInterval(pingInterval);
    }
    
    pingInterval = setInterval(() => {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'ping' }));
        }
    }, PING_INTERVAL);
    
    return socket;
}

// Function to attempt reconnection
function attemptReconnect() {
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        statusElement.textContent = `Connection lost. Reconnecting (Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`;
        
        // Try to reconnect after delay
        setTimeout(() => {
            connectToServer();
            
            // Try to restore session if we have saved data
            const savedSession = getSavedSession();
            if (savedSession && savedSession.clientId && savedSession.roomId) {
                // We'll attempt to reconnect with saved data when the socket opens
                console.log("Will attempt session restoration on connection");
            }
        }, RECONNECT_DELAY);
    } else {
        statusElement.textContent = 'Connection lost. Please refresh the page to reconnect.';
        showNotification('Failed to reconnect to server. Please refresh the page.');
    }
}

// Session persistence functions
function saveSession() {
    if (!clientId || !currentRoomId || !playerId) return;
    
    const sessionData = {
        clientId,
        currentRoomId,
        playerId,
        playerName,
        playerColor,
        lastSaved: Date.now()
    };
    
    try {
        localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessionData));
    } catch (e) {
        console.error('Failed to save session:', e);
    }
}

function getSavedSession() {
    try {
        const savedData = localStorage.getItem(SESSION_STORAGE_KEY);
        if (savedData) {
            const sessionData = JSON.parse(savedData);
            
            // Check if session is still valid (not too old)
            const MAX_SESSION_AGE = 10 * 60 * 1000; // 10 minutes
            if (Date.now() - sessionData.lastSaved < MAX_SESSION_AGE) {
                return sessionData;
            } else {
                // Clear expired session
                localStorage.removeItem(SESSION_STORAGE_KEY);
            }
        }
    } catch (e) {
        console.error('Failed to restore session:', e);
    }
    return null;
}

function clearSavedSession() {
    localStorage.removeItem(SESSION_STORAGE_KEY);
}

// Set up WebSocket event handlers
function setupSocketHandlers() {
    socket.onopen = () => {
        statusElement.textContent = 'Connected to server';
        reconnectAttempts = 0; // Reset reconnect counter on successful connection
        
        // Check if we need to attempt reconnection with saved session data
        const savedSession = getSavedSession();
        if (savedSession && savedSession.clientId && savedSession.roomId && savedSession.playerId) {
            console.log("Attempting to restore previous session");
            
            // Send reconnect request to server
            socket.send(JSON.stringify({
                type: 'reconnect',
                clientId: savedSession.clientId,
                roomId: savedSession.roomId,
                playerId: savedSession.playerId
            }));
            
            // Restore local session data
            clientId = savedSession.clientId;
            currentRoomId = savedSession.roomId;
            playerId = savedSession.playerId;
            playerName = savedSession.playerName || '';
            playerColor = savedSession.playerColor || '#4169E1';
        } else {
            // If no saved session or we're not trying to reconnect, just refresh the room list
            refreshPublicRooms();
        }
    };
    
    socket.onclose = (event) => {
        // Save session for potential reconnection
        if (gameStarted) {
            saveSession();
        }
        
        statusElement.textContent = 'Disconnected from server';
        
        if (event.code !== 1000) { // Normal closure
            attemptReconnect();
        } else {
            showNotification('Disconnected from server. Please refresh the page to reconnect.');
        }
        
        // Clear ping interval on close
        if (pingInterval) {
            clearInterval(pingInterval);
            pingInterval = null;
        }
    };
    
    socket.onerror = (error) => {
        statusElement.textContent = 'Connection error';
        console.error('WebSocket error:', error);
    };

    socket.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            
            switch (message.type) {
                case 'pong':
                    // Ping-pong to keep connection alive, no action needed
                    break;
                    
                case 'reconnected':
                    // Successful reconnection with previous session
                    currentRoomId = message.roomId;
                    playerId = message.playerId;
                    players = message.players;
                    gameMap = message.map;
                    
                    // Switch to game screen
                    lobbyScreen.classList.add('hidden');
                    roomScreen.classList.add('hidden');
                    gameScreen.classList.remove('hidden');
                    
                    // Mark as reconnected
                    gameStarted = true;
                    statusElement.textContent = 'Reconnected to game';
                    playerInfoElement.textContent = `You are Player ${playerId} (${playerName})`;
                    playerInfoElement.className = `player-${playerId}`;
                    
                    showNotification('Successfully reconnected to the game');
                    break;
                    
                case 'reconnectFailed':
                    // Failed to reconnect with previous session
                    clearSavedSession();
                    currentRoomId = null;
                    playerId = null;
                    
                    // Show lobby
                    gameScreen.classList.add('hidden');
                    roomScreen.classList.add('hidden');
                    lobbyScreen.classList.remove('hidden');
                    
                    showNotification('Could not restore previous game session');
                    refreshPublicRooms();
                    break;
                    
                case 'positionRejected':
                    // Server rejected our movement, reset to server position
                    if (gameStarted && players[playerId]) {
                        players[playerId].x = message.x;
                        players[playerId].y = message.y;
                    }
                    break;
                
                case 'welcome':
                    clientId = message.clientId;
                    
                    // Update public rooms list if available
                    if (message.publicRooms) {
                        updatePublicRoomsList(message.publicRooms);
                    }
                    
                    // Show lobby screen
                    lobbyScreen.classList.remove('hidden');
                    roomScreen.classList.add('hidden');
                    gameScreen.classList.add('hidden');
                    break;
                    
                case 'roomList':
                    updatePublicRoomsList(message.rooms);
                    break;
                    
                case 'roomCreated':
                    currentRoomId = message.roomId;
                    console.log(`Room created with ID: ${currentRoomId}`);
                    
                    // Show room info
                    roomTitle.textContent = message.isPublic ? 'Public Game Room' : 'Private Game Room';
                    roomIdDisplay.textContent = `Room Code: ${message.roomId}`;
                    
                    // Switch to room screen
                    lobbyScreen.classList.add('hidden');
                    roomScreen.classList.remove('hidden');
                    break;
                    
                case 'roomJoined':
                    currentRoomId = message.roomId;
                    playerId = message.playerId;
                    
                    // Show room info
                    roomTitle.textContent = message.isPublic ? 'Public Game Room' : 'Private Game Room';
                    roomIdDisplay.textContent = `Room Code: ${message.roomId}`;
                    
                    // Update players list
                    if (message.players) {
                        updatePlayersList(message.players);
                    }
                    
                    // Switch to room screen
                    lobbyScreen.classList.add('hidden');
                    roomScreen.classList.remove('hidden');
                    break;
                    
                case 'playerList':
                    updatePlayersList(message.players);
                    break;
                    
                case 'gameStart':
                    // Store room ID
                    currentRoomId = message.roomId;
                    
                    // Switch to game screen
                    roomScreen.classList.add('hidden');
                    gameScreen.classList.remove('hidden');
                    
                    // Set game data
                    playerId = message.playerId;
                    players = message.players;
                    gameMap = message.map;
                    gameStarted = true;
                    
                    // Update player info display
                    playerInfoElement.textContent = `You are Player ${playerId} (${playerName})`;
                    playerInfoElement.className = `player-${playerId}`;
                    
                    statusElement.textContent = 'Game connected';
                    console.log('Game started with map:', gameMap);
                    break;
                    
                case 'playerJoined':
                    if (gameStarted) {
                        // Add new player to the game
                        players[message.player.id] = message.player;
                        console.log(`Player ${message.player.id} (${message.player.name}) joined the game`);
                    }
                    break;
                    
                case 'playerMoved':
                    if (gameStarted && players[message.id]) {
                        players[message.id].x = message.x;
                        players[message.id].y = message.y;
                    }
                    break;
                    
                case 'playerLeft':
                    if (gameStarted && players[message.id]) {
                        console.log(`Player ${message.id} left the game`);
                        delete players[message.id];
                    }
                    break;
                    
                case 'roomLeft':
                    // Reset room data
                    currentRoomId = null;
                    playerId = null;
                    gameStarted = false;
                    
                    // Clear saved session
                    clearSavedSession();
                    
                    // Switch to lobby screen
                    roomScreen.classList.add('hidden');
                    gameScreen.classList.add('hidden');
                    lobbyScreen.classList.remove('hidden');
                    
                    // Refresh rooms list
                    refreshPublicRooms();
                    break;
                    
                case 'error':
                    showNotification(message.message);
                    break;
                    
                case 'notification':
                    showNotification(message.message);
                    break;
            }
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    };
}

// Tab navigation
publicRoomsTab.addEventListener('click', () => showTab('publicRooms'));
privateRoomTab.addEventListener('click', () => showTab('privateRoom'));
createRoomTab.addEventListener('click', () => showTab('createRoom'));

function showTab(tabName) {
    // Hide all tabs
    publicRoomsTab.classList.remove('active');
    privateRoomTab.classList.remove('active');
    createRoomTab.classList.remove('active');
    publicRoomsPanel.classList.remove('active');
    privateRoomPanel.classList.remove('active');
    createRoomPanel.classList.remove('active');
    
    // Show selected tab
    if (tabName === 'publicRooms') {
        publicRoomsTab.classList.add('active');
        publicRoomsPanel.classList.add('active');
        refreshPublicRooms();
    } else if (tabName === 'privateRoom') {
        privateRoomTab.classList.add('active');
        privateRoomPanel.classList.add('active');
    } else if (tabName === 'createRoom') {
        createRoomTab.classList.add('active');
        createRoomPanel.classList.add('active');
    }
}

// Refresh public rooms list
refreshRoomsButton.addEventListener('click', refreshPublicRooms);

function refreshPublicRooms() {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: 'getRooms'
        }));
    } else {
        showNotification('Not connected to server. Please wait or refresh the page.');
    }
}

// Join private room
joinPrivateRoomButton.addEventListener('click', joinPrivateRoom);

function joinPrivateRoom() {
    const roomCode = privateRoomCode.value.trim();
    
    if (!roomCode) {
        showNotification('Please enter a room code');
        return;
    }
    
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: 'joinRoom',
            roomId: roomCode
        }));
    } else {
        showNotification('Not connected to server. Please wait or refresh the page.');
    }
}

// Create new room
createNewRoomButton.addEventListener('click', createNewRoom);

function createNewRoom() {
    const isPublic = publicRoomTypeRadio.checked;
    
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: 'createRoom',
            isPublic: isPublic
        }));
    } else {
        showNotification('Not connected to server. Please wait or refresh the page.');
    }
}

// Copy room code
copyRoomCodeButton.addEventListener('click', copyRoomCode);

function copyRoomCode() {
    const roomId = roomIdDisplay.textContent.replace('Room Code: ', '');
    
    if (roomId) {
        navigator.clipboard.writeText(roomId)
            .then(() => {
                showNotification('Room code copied to clipboard');
            })
            .catch(err => {
                console.error('Could not copy text: ', err);
                showNotification('Failed to copy room code');
            });
    }
}

// Show notification
function showNotification(message, duration = 2000) {
    // Remove any existing notification
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }
    
    // Create new notification
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    // Show notification
    setTimeout(() => {
        notification.classList.add('show');
    }, 10);
    
    // Hide and remove notification after duration
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, duration);
}

// Leave room
leaveRoomButton.addEventListener('click', leaveRoom);

function leaveRoom() {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: 'leaveRoom'
        }));
    } else {
        // If disconnected, just go back to lobby
        roomScreen.classList.add('hidden');
        lobbyScreen.classList.remove('hidden');
        showNotification('Not connected to server. Returning to lobby.');
    }
}

// Leave game (back to room)
leaveGameButton.addEventListener('click', leaveGame);

function leaveGame() {
    // Return to room screen
    gameScreen.classList.add('hidden');
    roomScreen.classList.remove('hidden');
    gameStarted = false;
}

// Color selector event listeners
colorOptions.forEach(option => {
    option.addEventListener('click', () => {
        // Remove selected class from all options
        colorOptions.forEach(opt => opt.classList.remove('selected'));
        
        // Add selected class to clicked option
        option.classList.add('selected');
        
        // Store selected color
        playerColor = option.getAttribute('data-color');
    });
});

// Default select the first color
colorOptions[0].classList.add('selected');

// Start game button event listener
startGameButton.addEventListener('click', joinGame);

function joinGame() {
    playerName = playerNameInput.value.trim();
    
    // Validate player name
    if (!playerName) {
        showNotification('Please enter a name');
        return;
    }
    
    // Check if we have a valid room ID
    if (!currentRoomId) {
        showNotification('Room connection error. Please try again.');
        return;
    }
    
    // Send join game message to server
    if (socket && socket.readyState === WebSocket.OPEN) {
        console.log('Joining game in room:', currentRoomId); // Add logging
        socket.send(JSON.stringify({
            type: 'joinGame',
            name: playerName,
            color: playerColor,
            roomId: currentRoomId // Make sure to include roomId 
        }));
    } else {
        showNotification('Not connected to server. Please wait or refresh the page.');
    }
}

// Function to send the anti-cheat command
function setAntiCheat(enabled) {
    if (socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: 'beta.anticheat',
            value: enabled ? 'true' : 'false'
        }));
    } else {
        showNotification('Not connected to server. Please wait or refresh the page.');
    }
}

// Example usage
setAntiCheat(true); // Enable anti-cheat
setAntiCheat(false); // Disable anti-cheat

// Initialize connection
connectToServer();

// Keyboard input handlers
window.addEventListener('keydown', (e) => {
    if (!gameStarted) return;
    
    switch (e.key.toLowerCase()) {
        case 'w': keys.w = true; break;
        case 'a': keys.a = true; break;
        case 's': keys.s = true; break;
        case 'd': keys.d = true; break;
    }
});

window.addEventListener('keyup', (e) => {
    if (!gameStarted) return;
    
    switch (e.key.toLowerCase()) {
        case 'w': keys.w = false; break;
        case 'a': keys.a = false; break;
        case 's': keys.s = false; break;
        case 'd': keys.d = false; break;
    }
});

// Game loop with frame rate limiting
function gameLoop(timestamp) {
    // Calculate time since last frame
    const elapsed = timestamp - lastGameTime;
    
    // Only update if enough time has passed for target frame rate
    if (elapsed > frameTime) {
        lastGameTime = timestamp - (elapsed % frameTime); // Adjust for any remainder
        
        if (gameStarted) {
            updateGame();
            renderGame();
        }
    }
    
    requestAnimationFrame(gameLoop);
}

// Update game state - Pokémon style movement with larger map
function updateGame() {
    if (!playerId || !players[playerId]) return;
    
    const player = players[playerId];
    let moved = false;
    
    // Store original position to check for collisions
    const originalX = player.x;
    const originalY = player.y;
    
    // Only allow one direction at a time for grid-like movement
    // Priority: Up, Left, Down, Right (typical for top-down RPGs)
    if (keys.w && player.y > 0) {
        player.y -= PLAYER_SPEED;
        moved = true;
    } else if (keys.a && player.x > 0) {
        player.x -= PLAYER_SPEED;
        moved = true;
    } else if (keys.s && player.y < gameMap.height - PLAYER_SIZE) {
        player.y += PLAYER_SPEED;
        moved = true;
    } else if (keys.d && player.x < gameMap.width - PLAYER_SIZE) {
        player.x += PLAYER_SPEED;
        moved = true;
    }
    
    // Simple collision checking with map boundaries
    if (player.x < 0) player.x = 0;
    if (player.y < 0) player.y = 0;
    if (player.x > gameMap.width - PLAYER_SIZE) player.x = gameMap.width - PLAYER_SIZE;
    if (player.y > gameMap.height - PLAYER_SIZE) player.y = gameMap.height - PLAYER_SIZE;
    
    // Collision with obstacles
    if (gameMap && gameMap.obstacles) {
        for (const obstacle of gameMap.obstacles) {
            if (isColliding(player, obstacle)) {
                // Revert position on collision
                player.x = originalX;
                player.y = originalY;
                moved = false;
                break;
            }
        }
    }
    
    // Collision with other players
    // Only apply client-side for smoothness, server will validate
    for (const id in players) {
        if (id != playerId) {
            const otherPlayer = players[id];
            if (isCollidingWithPlayer(player, otherPlayer)) {
                // Revert position on collision
                player.x = originalX;
                player.y = originalY;
                moved = false;
                break;
            }
        }
    }
    
    // Send position update to server if player moved
    if (moved && socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
            type: 'updatePosition',
            x: player.x,
            y: player.y
        }));
        
        // Save session data occasionally to enable reconnection
        if (Math.random() < 0.05) { // ~5% chance each movement
            saveSession();
        }
    }
}

// Check if two objects are colliding
function isColliding(player, obstacle) {
    return player.x < obstacle.x + gameMap.tileSize &&
           player.x + PLAYER_SIZE > obstacle.x &&
           player.y < obstacle.y + gameMap.tileSize &&
           player.y + PLAYER_SIZE > obstacle.y;
}

// Check if player collides with another player
function isCollidingWithPlayer(player, otherPlayer) {
    // Don't collide with self
    if (player.id === otherPlayer.id) return false;
    
    // Simple rectangle collision detection
    return player.x < otherPlayer.x + PLAYER_SIZE &&
           player.x + PLAYER_SIZE > otherPlayer.x &&
           player.y < otherPlayer.y + PLAYER_SIZE &&
           player.y + PLAYER_SIZE > otherPlayer.y;
}

// Render game - Pokémon style with camera follow and mini-map
function renderGame() {
    if (!gameMap) return;
    
    // Update camera position to follow player
    if (playerId && players[playerId]) {
        const player = players[playerId];
        cameraX = player.x - CAMERA_OFFSET_X;
        cameraY = player.y - CAMERA_OFFSET_Y;
        
        // Clamp camera to map bounds
        cameraX = Math.max(0, Math.min(cameraX, gameMap.width - canvas.width));
        cameraY = Math.max(0, Math.min(cameraY, gameMap.height - canvas.height));
    }
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Save the current transformation matrix
    ctx.save();
    
    // Translate to apply camera offset
    ctx.translate(-cameraX, -cameraY);
    
    // Draw the map (grid-based, Pokémon style)
    drawMap();
    
    // Draw ALL players regardless of whether they're in the visible area
    for (const id in players) {
        const player = players[id];
        
        // Draw player hitbox (colored rectangle)
        ctx.fillStyle = player.color;
        ctx.fillRect(player.x, player.y, PLAYER_SIZE, PLAYER_SIZE);
        
        // Draw player name above player
        ctx.fillStyle = 'black';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(player.name, player.x + PLAYER_SIZE / 2, player.y - 5);
        
        // Draw player ID in the center
        ctx.fillStyle = 'white';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(player.id, player.x + PLAYER_SIZE / 2, player.y + PLAYER_SIZE / 2);
    }
    
    // Restore the transformation matrix
    ctx.restore();
    
    // Draw mini-map
    drawMiniMap();
}

// Draw the Pokémon-style map with grass, paths and obstacles
function drawMap() {
    if (!gameMap) return;
    
    // Calculate the visible portion of the map
    const startX = Math.floor(cameraX / gameMap.tileSize) * gameMap.tileSize;
    const startY = Math.floor(cameraY / gameMap.tileSize) * gameMap.tileSize;
    const endX = Math.ceil((cameraX + canvas.width) / gameMap.tileSize) * gameMap.tileSize;
    const endY = Math.ceil((cameraY + canvas.height) / gameMap.tileSize) * gameMap.tileSize;
    
    // Draw grass background for the visible area
    ctx.fillStyle = '#90EE90'; // Light green for grass
    ctx.fillRect(startX, startY, endX - startX, endY - startY);
    
    // Draw paths
    ctx.fillStyle = '#E0C068'; // Light brown for paths
    for (const path of gameMap.paths) {
        // Check if path is in the visible area
        if (path.x + path.width >= startX && 
            path.x <= endX && 
            path.y + path.height >= startY && 
            path.y <= endY) {
            ctx.fillRect(path.x, path.y, path.width, path.height);
        }
    }
    
    // Draw grid lines (optional, for visual reference)
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
    ctx.lineWidth = 1;
    
    // Vertical grid lines
    for (let x = startX; x <= endX; x += gameMap.tileSize) {
        ctx.beginPath();
        ctx.moveTo(x, startY);
        ctx.lineTo(x, endY);
        ctx.stroke();
    }
    
    // Horizontal grid lines
    for (let y = startY; y <= endY; y += gameMap.tileSize) {
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
        ctx.stroke();
    }
    
    // Draw obstacles
    for (const obstacle of gameMap.obstacles) {
        // Check if obstacle is in the visible area
        if (obstacle.x + gameMap.tileSize >= startX && 
            obstacle.x <= endX && 
            obstacle.y + gameMap.tileSize >= startY && 
            obstacle.y <= endY) {
            
            if (obstacle.type === 'tree') {
                // Draw tree
                ctx.fillStyle = '#228B22'; // Forest Green
                ctx.beginPath();
                ctx.arc(
                    obstacle.x + gameMap.tileSize / 2, 
                    obstacle.y + gameMap.tileSize / 2, 
                    gameMap.tileSize / 2.5, 
                    0, 
                    Math.PI * 2
                );
                ctx.fill();
                
                // Tree trunk
                ctx.fillStyle = '#8B4513'; // Saddle Brown
                ctx.fillRect(
                    obstacle.x + gameMap.tileSize / 2 - 5,
                    obstacle.y + gameMap.tileSize / 2,
                    10,
                    gameMap.tileSize / 2
                );
            } else if (obstacle.type === 'rock') {
                // Draw rock
                ctx.fillStyle = '#808080'; // Gray
                ctx.beginPath();
                ctx.ellipse(
                    obstacle.x + gameMap.tileSize / 2,
                    obstacle.y + gameMap.tileSize / 2,
                    gameMap.tileSize / 3,
                    gameMap.tileSize / 4,
                    0,
                    0,
                    Math.PI * 2
                );
                ctx.fill();
            }
        }
    }
}

// Draw mini-map in the top-right corner
function drawMiniMap() {
    if (!gameMap) return;
    
    // Mini-map position (top-right corner)
    const miniMapX = canvas.width - MINI_MAP_SIZE - 10;
    const miniMapY = 10;
    
    // Calculate scaling factor
    const scaleX = MINI_MAP_SIZE / gameMap.width;
    const scaleY = MINI_MAP_SIZE / gameMap.height;
    
    // Draw mini-map background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillRect(miniMapX, miniMapY, MINI_MAP_SIZE, MINI_MAP_SIZE);
    
    // Draw mini-map border
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.strokeRect(miniMapX, miniMapY, MINI_MAP_SIZE, MINI_MAP_SIZE);
    
    // Draw paths on mini-map
    ctx.fillStyle = '#E0C068';
    for (const path of gameMap.paths) {
        ctx.fillRect(
            miniMapX + path.x * scaleX,
            miniMapY + path.y * scaleY,
            path.width * scaleX,
            path.height * scaleY
        );
    }
    
    // Draw obstacles on mini-map
    for (const obstacle of gameMap.obstacles) {
        ctx.fillStyle = obstacle.type === 'tree' ? '#228B22' : '#808080';
        ctx.fillRect(
            miniMapX + obstacle.x * scaleX,
            miniMapY + obstacle.y * scaleY,
            gameMap.tileSize * scaleX,
            gameMap.tileSize * scaleY
        );
    }
    
    // Draw players on mini-map
    for (const id in players) {
        const player = players[id];
        
        // Larger dot for current player
        const dotSize = (id == playerId) ? 5 : 3;
        
        ctx.fillStyle = player.color;
        ctx.beginPath();
        ctx.arc(
            miniMapX + player.x * scaleX + (PLAYER_SIZE * scaleX / 2),
            miniMapY + player.y * scaleY + (PLAYER_SIZE * scaleY / 2),
            dotSize,
            0,
            Math.PI * 2
        );
        ctx.fill();
    }
    
    // Draw camera viewport indicator
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(
        miniMapX + cameraX * scaleX,
        miniMapY + cameraY * scaleY,
        canvas.width * scaleX,
        canvas.height * scaleY
    );
}

// Update the public rooms list
function updatePublicRoomsList(rooms) {
    // Clear the current list
    while (publicRoomsList.firstChild) {
        publicRoomsList.removeChild(publicRoomsList.firstChild);
    }
    
    if (rooms.length === 0) {
        // Show no rooms message
        const noRoomsMessage = document.createElement('li');
        noRoomsMessage.className = 'waiting-message';
        noRoomsMessage.textContent = 'No public rooms available. Create one!';
        publicRoomsList.appendChild(noRoomsMessage);
    } else {
        // Add each room to the list
        rooms.forEach(room => {
            const roomItem = document.createElement('li');
            roomItem.className = 'room-item';
            
            const roomInfo = document.createElement('div');
            roomInfo.className = 'room-info';
            
            const roomName = document.createElement('div');
            roomName.textContent = `Room ${room.id.substring(7, 13)}...`;
            
            const roomStatus = document.createElement('div');
            roomStatus.className = 'room-status';
            roomStatus.textContent = `${room.playerCount} player(s) - Created ${getTimeAgo(room.createdAt)}`;
            
            const joinButton = document.createElement('button');
            joinButton.textContent = 'Join';
            joinButton.addEventListener('click', () => {
                socket.send(JSON.stringify({
                    type: 'joinRoom',
                    roomId: room.id
                }));
            });
            
            roomInfo.appendChild(roomName);
            roomInfo.appendChild(roomStatus);
            roomItem.appendChild(roomInfo);
            roomItem.appendChild(joinButton);
            publicRoomsList.appendChild(roomItem);
        });
    }
}

// Get time ago string
function getTimeAgo(timestamp) {
    const now = Date.now();
    const seconds = Math.floor((now - timestamp) / 1000);
    
    if (seconds < 60) {
        return `${seconds} second(s) ago`;
    }
    
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
        return `${minutes} minute(s) ago`;
    }
    
    const hours = Math.floor(minutes / 60);
    return `${hours} hour(s) ago`;
}

// Update the players list in the room
function updatePlayersList(playersList) {
    // Clear the current list
    while (playersListElement.firstChild) {
        playersListElement.removeChild(playersListElement.firstChild);
    }
    
    if (playersList.length === 0) {
        // Show waiting message if no players
        const waitingMessage = document.createElement('li');
        waitingMessage.className = 'waiting-message';
        waitingMessage.textContent = 'Waiting for players to join...';
        playersListElement.appendChild(waitingMessage);
    } else {
        // Add each player to the list
        playersList.forEach(player => {
            const playerItem = document.createElement('li');
            playerItem.className = 'player-entry';
            
            const playerColorDiv = document.createElement('div');
            playerColorDiv.className = 'player-color';
            playerColorDiv.style.backgroundColor = player.color;
            
            const playerNameSpan = document.createElement('span');
            playerNameSpan.textContent = `Player ${player.id}: ${player.name}`;
            
            playerItem.appendChild(playerColorDiv);
            playerItem.appendChild(playerNameSpan);
            playersListElement.appendChild(playerItem);
        });
    }
}

// Handle window close/reload
window.addEventListener('beforeunload', () => {
    // If in game, save session for potential return
    if (gameStarted) {
        saveSession();
    }
    
    // Close socket connection gracefully if possible
    if (socket && socket.readyState === WebSocket.OPEN) {
        // Try to send a leave room message if in a room
        if (currentRoomId) {
            socket.send(JSON.stringify({
                type: 'leaveRoom'
            }));
        }
        
        // Note: The socket might not have time to send this message
        // before the page is unloaded, but we try anyway
    }
});

// Start game loop with the current timestamp
requestAnimationFrame(gameLoop);

// Initialize the first tab
showTab('publicRooms');
