// server.js - Save this file in the root directory (D:\Projects\MultiPlayer\server.js)
const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const path = require('path');
const crypto = require('crypto');

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Add health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        rooms: Object.keys(rooms).length,
        clients: Object.keys(clients).length,
        uptime: process.uptime()
    });
});

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Game state
const MAX_PLAYERS_PER_ROOM = 4;
const rooms = {}; // All game rooms
const clients = {}; // All connected clients
const ROOM_CLEANUP_INTERVAL = 15 * 60 * 1000; // 15 minutes in milliseconds
const MAX_PLAYER_SPEED = 6; // Maximum allowed player movement speed per update

// Configuration setting for anti-cheat
const config = {
    antiCheatEnabled: true // Default to true
};

// Auto-generate the map
function generateMap(width = 1600, height = 1200, tileSize = 50) {
    const map = {
        width,
        height,
        tileSize,
        tiles: [],
        paths: [],
        obstacles: []
    };
    
    // Generate base tiles (grass everywhere)
    for (let y = 0; y < height; y += tileSize) {
        for (let x = 0; x < width; x += tileSize) {
            map.tiles.push({
                x,
                y,
                type: 'grass'
            });
        }
    }
    
    // Generate horizontal path
    const horizontalPathY = Math.floor(height / 2 / tileSize) * tileSize;
    map.paths.push({
        x: 0,
        y: horizontalPathY,
        width: width,
        height: tileSize
    });
    
    // Generate vertical path
    const verticalPathX = Math.floor(width / 2 / tileSize) * tileSize;
    map.paths.push({
        x: verticalPathX,
        y: 0,
        width: tileSize,
        height: height
    });
    
    // Generate random obstacles (trees, rocks)
    const numObstacles = Math.floor(width * height / (tileSize * tileSize) * 0.08); // 8% of tiles as obstacles
    
    for (let i = 0; i < numObstacles; i++) {
        // Make sure obstacles don't overlap with paths
        let validPosition = false;
        let obstacleX, obstacleY;
        
        while (!validPosition) {
            obstacleX = Math.floor(Math.random() * (width / tileSize)) * tileSize;
            obstacleY = Math.floor(Math.random() * (height / tileSize)) * tileSize;
            
            // Check if on path
            const onHorizontalPath = obstacleY === horizontalPathY;
            const onVerticalPath = obstacleX === verticalPathX;
            
            // Check if overlapping with existing obstacles
            let overlapsObstacle = false;
            for (const obstacle of map.obstacles) {
                if (obstacleX === obstacle.x && obstacleY === obstacle.y) {
                    overlapsObstacle = true;
                    break;
                }
            }
            
            if (!onHorizontalPath && !onVerticalPath && !overlapsObstacle) {
                validPosition = true;
            }
        }
        
        // Create the obstacle
        map.obstacles.push({
            x: obstacleX,
            y: obstacleY,
            type: Math.random() < 0.6 ? 'tree' : 'rock'
        });
    }
    
    return map;
}

// Find the next available player ID in a room
function getNextPlayerId(room) {
    // Find the lowest available ID
    for (let i = 1; i <= MAX_PLAYERS_PER_ROOM; i++) {
        if (!room.players[i]) {
            return i;
        }
    }
    return null; // Room is full
}

// Create a new room
function createRoom(isPublic = true, creatorId = null) {
    const roomId = isPublic 
        ? `public-${crypto.randomBytes(3).toString('hex')}` 
        : `private-${crypto.randomBytes(4).toString('hex')}`;
    
    rooms[roomId] = {
        id: roomId,
        isPublic: isPublic,
        players: {},
        playerCount: 0,
        map: generateMap(),
        createdAt: Date.now(),
        lastActivity: Date.now(),
        creatorId: creatorId
    };
    
    console.log(`Room created: ${roomId} (${isPublic ? 'Public' : 'Private'})`);
    return roomId;
}

// Get list of public rooms with available slots
function getPublicRooms() {
    const publicRooms = [];
    console.log("Getting public rooms. Total rooms:", Object.keys(rooms).length);
    
    for (const roomId in rooms) {
        const room = rooms[roomId];
        console.log(`Room ${roomId}: isPublic=${room.isPublic}, playerCount=${room.playerCount}`);
        
        if (room.isPublic && room.playerCount < MAX_PLAYERS_PER_ROOM) {
            publicRooms.push({
                id: roomId,
                playerCount: room.playerCount,
                createdAt: room.createdAt
            });
        }
    }
    console.log(`Found ${publicRooms.length} available public rooms`);
    return publicRooms;
}

// Clean up inactive rooms
function cleanupRooms() {
    const now = Date.now();
    for (const roomId in rooms) {
        const room = rooms[roomId];
        
        // If room has been inactive for the timeout period
        if (now - room.lastActivity > ROOM_CLEANUP_INTERVAL) {
            // If room is empty or inactive
            if (room.playerCount === 0) {
                console.log(`Cleaning up inactive room: ${roomId}`);
                delete rooms[roomId];
            }
        }
    }
}

// Start periodic cleanup
setInterval(cleanupRooms, ROOM_CLEANUP_INTERVAL);

// Validate player movement
function isValidMovement(oldX, oldY, newX, newY, map) {
    if (!config.antiCheatEnabled) {
        return true; // Bypass anti-cheat checks if disabled
    }

    const distance = Math.sqrt(Math.pow(newX - oldX, 2) + Math.pow(newY - oldY, 2));
    if (distance > MAX_PLAYER_SPEED) {
        return false; // Movement exceeds allowed speed
    }

    if (newX < 0 || newY < 0 ||
        newX > map.width - 40 ||
        newY > map.height - 40) {
        return false;
    }

    return true;
}

// Check if player would collide with obstacle
function wouldCollideWithObstacle(playerX, playerY, map, playerSize = 40) {
    if (!config.antiCheatEnabled) {
        return false; // Bypass collision checks if disabled
    }

    for (const obstacle of map.obstacles) {
        if (playerX < obstacle.x + map.tileSize &&
            playerX + playerSize > obstacle.x &&
            playerY < obstacle.y + map.tileSize &&
            playerY + playerSize > obstacle.y) {
            return true;
        }
    }
    return false;
}

// WebSocket connection handler
wss.on('connection', (ws) => {
  // Generate unique client ID
  const clientId = crypto.randomBytes(4).toString('hex');
  
  // Initialize client data
  ws.clientData = {
      id: clientId,
      roomId: null,
      playerId: null,
      name: null,
      color: null,
      connected: true,
      lastPosition: { x: 0, y: 0 }, // Store last valid position
      lastMoveTime: 0 // For rate limiting
  };
  
  // Store client in clients object
  clients[clientId] = ws;
  
  console.log(`Client ${clientId} connected.`);
  
  // Send welcome message with client ID and available public rooms
  const publicRooms = getPublicRooms();
  ws.send(JSON.stringify({
      type: 'welcome',
      clientId: clientId,
      publicRooms: publicRooms
  }));
  console.log(`Welcome message sent to client ${clientId} with ${publicRooms.length} public rooms`);
  
  // Handle messages from client
  ws.on('message', (message) => {
      try {
          const data = JSON.parse(message);
          let roomId, room; // Declare variables at function scope to avoid redeclaration
          
          switch (data.type) {
              case 'createRoom':
                  // Create new room
                  const isPublic = data.isPublic || false;
                  roomId = createRoom(isPublic, clientId);
                  
                  // CRITICAL FIX: Update the client's room ID AND player ID
                  ws.clientData.roomId = roomId;
                  ws.clientData.playerId = 1; // First player gets ID 1
                  
                  console.log(`Client ${clientId} created and joined room ${roomId} as Player 1`);
                  
                  ws.send(JSON.stringify({
                      type: 'roomCreated',
                      roomId: roomId,
                      playerId: 1, // Send player ID in response
                      isPublic: isPublic
                  }));
                  
                  // Update public room list for all clients in lobby
                  broadcastPublicRooms();
                  break;
                  
              case 'joinRoom':
                  const targetRoomId = data.roomId;
                  
                  // Check if room exists
                  if (!rooms[targetRoomId]) {
                      ws.send(JSON.stringify({
                          type: 'error',
                          message: 'Room does not exist'
                      }));
                      return;
                  }
                  
                  room = rooms[targetRoomId];
                  
                  // Check if room is full
                  if (room.playerCount >= MAX_PLAYERS_PER_ROOM) {
                      ws.send(JSON.stringify({
                          type: 'error',
                          message: 'Room is full'
                      }));
                      return;
                  }
                  
                  // Assign player ID - use the first available ID
                  const playerId = getNextPlayerId(room);
                  
                  if (playerId === null) {
                      ws.send(JSON.stringify({
                          type: 'error',
                          message: 'Room is full'
                      }));
                      return;
                  }
                  
                  // Update client data
                  ws.clientData.roomId = targetRoomId;
                  ws.clientData.playerId = playerId;
                  
                  console.log(`Client ${clientId} joined room ${targetRoomId} as Player ${playerId}`);
                  
                  // Update room's last activity
                  room.lastActivity = Date.now();
                  
                  ws.send(JSON.stringify({
                      type: 'roomJoined',
                      roomId: targetRoomId,
                      playerId: playerId,
                      isPublic: room.isPublic,
                      players: Object.values(room.players).map(player => ({
                          id: player.id,
                          name: player.name,
                          color: player.color
                      }))
                  }));
                  
                  // Update public room list for all clients in lobby
                  if (room.isPublic) {
                      broadcastPublicRooms();
                  }
                  break;
                  
              case 'getRooms':
                  // Send current list of public rooms
                  const publicRoomsList = getPublicRooms();
                  console.log(`Sending room list with ${publicRoomsList.length} rooms to client ${ws.clientData.id}`);
                  
                  ws.send(JSON.stringify({
                      type: 'roomList',
                      rooms: publicRoomsList
                  }));
                  break;
                  
              case 'joinGame':
                  roomId = ws.clientData.roomId;
                  
                  // Debug logging
                  console.log("Join game request from:", ws.clientData.id);
                  console.log("Client's roomId:", roomId);
                  console.log("Client's playerId:", ws.clientData.playerId);
                  
                  if (!roomId || !rooms[roomId]) {
                      console.error(`Not in a valid room. Client ID: ${ws.clientData.id}`);
                      ws.send(JSON.stringify({
                          type: 'error',
                          message: 'Not in a valid room. Please try creating or joining a room again.'
                      }));
                      return;
                  }
                  
                  const gameRoom = rooms[roomId];
                  
                  // IMPORTANT FIX: Make sure client has a player ID assigned
                  if (!ws.clientData.playerId) {
                      ws.clientData.playerId = getNextPlayerId(gameRoom);
                      console.log(`Assigned Player ID ${ws.clientData.playerId} to client ${ws.clientData.id}`);
                  }
                  
                  // Make sure name is safe and not too long
                  const playerName = (data.name || "Player").trim().substring(0, 20);
                  
                  // Create player in game state with random starting position
                  // Ensure the starting position is valid (not colliding with obstacles)
                  let playerX, playerY;
                  let validStartingPosition = false;
                  const playerSize = 40;
                  
                  while (!validStartingPosition) {
                      playerX = (Math.floor(Math.random() * (gameRoom.map.width / gameRoom.map.tileSize - 2)) + 1) * gameRoom.map.tileSize;
                      playerY = (Math.floor(Math.random() * (gameRoom.map.height / gameRoom.map.tileSize - 2)) + 1) * gameRoom.map.tileSize;
                      
                      // Check for collisions with obstacles
                      if (!wouldCollideWithObstacle(playerX, playerY, gameRoom.map, playerSize)) {
                          validStartingPosition = true;
                      }
                  }
                  
                  const playerData = {
                      id: ws.clientData.playerId,
                      name: playerName,
                      color: data.color || '#4169E1', // Default blue if no color provided
                      x: playerX,
                      y: playerY,
                      clientId: ws.clientData.id
                  };
                  
                  console.log(`Player data for ${ws.clientData.id}:`, playerData);
                  
                  // Store player name and color
                  ws.clientData.name = playerName;
                  ws.clientData.color = data.color || '#4169E1';
                  ws.clientData.lastPosition = { x: playerX, y: playerY };
                  
                  // Add to players list
                  gameRoom.players[ws.clientData.playerId] = playerData;
                  gameRoom.playerCount++;
                  
                  // Update room's last activity
                  gameRoom.lastActivity = Date.now();
                  
                  console.log(`Player ${ws.clientData.playerId} (${playerName}) joined room ${roomId}`);
                  
                  // Broadcast to all clients in the same room that a new player joined
                  broadcastToRoom(roomId, {
                      type: 'playerJoined',
                      player: playerData
                  }, ws);
                  
                  // Send game start information to this client
                  ws.send(JSON.stringify({
                      type: 'gameStart',
                      roomId: roomId,
                      playerId: ws.clientData.playerId,
                      players: gameRoom.players,
                      map: gameRoom.map
                  }));
                  
                  // Also send updated player list to all clients in this room's menu
                  broadcastPlayerListToRoom(roomId);
                  
                  // Update public room list for all clients in lobby
                  if (gameRoom.isPublic) {
                      broadcastPublicRooms();
                  }
                  break;
                  
              case 'updatePosition':
                  roomId = ws.clientData.roomId;
                  
                  if (!roomId || !rooms[roomId] || !ws.clientData.playerId) {
                      return;
                  }
                  
                  room = rooms[roomId];
                  
                  if (!room.players[ws.clientData.playerId]) {
                      return;
                  }
                  
                  // Rate limit position updates
                  const now = Date.now();
                  if (now - ws.clientData.lastMoveTime < 16) { // ~60 updates per second max
                      return; // Ignore too frequent updates
                  }
                  ws.clientData.lastMoveTime = now;
                  
                  // Get current player position
                  const oldX = room.players[ws.clientData.playerId].x;
                  const oldY = room.players[ws.clientData.playerId].y;
                  const newX = data.x;
                  const newY = data.y;
                  
                  // Validate movement
                  if (!isValidMovement(oldX, oldY, newX, newY, room.map)) {
                      // If invalid, notify client to revert to last valid position
                      ws.send(JSON.stringify({
                          type: 'positionRejected',
                          x: oldX,
                          y: oldY
                      }));
                      return;
                  }
                  
                  // Check collision with obstacles
                  if (wouldCollideWithObstacle(newX, newY, room.map)) {
                      // If collision, reject the movement
                      ws.send(JSON.stringify({
                          type: 'positionRejected',
                          x: oldX,
                          y: oldY
                      }));
                      return;
                  }
                  
                  // Update player position
                  room.players[ws.clientData.playerId].x = newX;
                  room.players[ws.clientData.playerId].y = newY;
                  ws.clientData.lastPosition = { x: newX, y: newY };
                  
                  // Update room's last activity
                  room.lastActivity = Date.now();
                  
                  // Broadcast updated position to all other clients in the same room
                  broadcastToRoom(roomId, {
                      type: 'playerMoved',
                      id: ws.clientData.playerId,
                      x: newX,
                      y: newY
                  }, ws);
                  break;
                  
              case 'getPlayers':
                  roomId = ws.clientData.roomId;
                  
                  if (!roomId || !rooms[roomId]) {
                      return;
                  }
                  
                  // Send current player list for this room
                  ws.send(JSON.stringify({
                      type: 'playerList',
                      players: Object.values(rooms[roomId].players).map(player => ({
                          id: player.id,
                          name: player.name,
                          color: player.color
                      }))
                  }));
                  break;
                  
              case 'leaveRoom':
                  handlePlayerLeaveRoom(ws);
                  break;
                  
              case 'ping':
                  // Simple ping-pong for connection keep-alive
                  ws.send(JSON.stringify({ type: 'pong' }));
                  break;

              case 'beta.anticheat':
                  if (data.value === 'true') {
                      config.antiCheatEnabled = true;
                      ws.send(JSON.stringify({
                          type: 'notification',
                          message: 'Anti-cheat enabled'
                      }));
                  } else if (data.value === 'false') {
                      config.antiCheatEnabled = false;
                      ws.send(JSON.stringify({
                          type: 'notification',
                          message: 'Anti-cheat disabled'
                      }));
                  } else {
                      ws.send(JSON.stringify({
                          type: 'error',
                          message: 'Invalid value for anti-cheat command'
                      }));
                  }
                  break;
                  
              case 'reconnect':
                  // Handle client reconnection with previous client ID
                  if (data.clientId && data.roomId && rooms[data.roomId]) {
                      const room = rooms[data.roomId];
                      
                      // Check if player ID exists in this room
                      if (data.playerId && room.players[data.playerId]) {
                          const player = room.players[data.playerId];
                          
                          // Verify this was indeed the same client
                          if (player.clientId === data.clientId) {
                              // Reassociate client with this player
                              ws.clientData.roomId = data.roomId;
                              ws.clientData.playerId = data.playerId;
                              ws.clientData.name = player.name;
                              ws.clientData.color = player.color;
                              ws.clientData.lastPosition = { x: player.x, y: player.y };
                              
                              // Update client ID in player data
                              player.clientId = clientId;
                              
                              console.log(`Player ${data.playerId} reconnected to room ${data.roomId}`);
                              
                              // Send game state to reconnected client
                              ws.send(JSON.stringify({
                                  type: 'reconnected',
                                  roomId: data.roomId,
                                  playerId: data.playerId,
                                  players: room.players,
                                  map: room.map
                              }));
                              
                              // Notify other players of reconnection
                              broadcastToRoom(data.roomId, {
                                  type: 'playerReconnected',
                                  id: data.playerId
                              }, ws);
                              
                              return;
                          }
                      }
                  }
                  
                  // If reconnection failed, treat as new connection
                  ws.send(JSON.stringify({
                      type: 'reconnectFailed',
                      message: 'Could not reconnect to previous session'
                  }));
                  break;
          }
      } catch (error) {
          console.error('Error processing message:', error);
          
          // Send error to client
          try {
              ws.send(JSON.stringify({
                  type: 'error',
                  message: 'Server error processing your request'
              }));
          } catch (sendError) {
              console.error('Error sending error message:', sendError);
          }
      }
  });
  
  // Handle disconnection
  ws.on('close', () => {
      handlePlayerLeaveRoom(ws);
      
      // Remove from clients
      delete clients[ws.clientData.id];
      
      ws.clientData.connected = false;
      console.log(`Client ${ws.clientData.id} disconnected`);
  });
  
  // Handle player leaving a room
  function handlePlayerLeaveRoom(ws) {
      const departingRoomId = ws.clientData.roomId;
      
      if (departingRoomId && rooms[departingRoomId] && 
          ws.clientData.playerId && rooms[departingRoomId].players[ws.clientData.playerId]) {
          
          const room = rooms[departingRoomId];
          
          console.log(`Player ${ws.clientData.playerId} (${ws.clientData.name || 'unnamed'}) left room ${departingRoomId}`);
          
          // Remove player from the room
          delete room.players[ws.clientData.playerId];
          room.playerCount--;
          
          // Update room's last activity
          room.lastActivity = Date.now();
          
          // Notify other clients in the same room that this player left
          broadcastToRoom(departingRoomId, {
              type: 'playerLeft',
              id: ws.clientData.playerId
          });
          
          // Clean up room if empty
          if (room.playerCount === 0) {
              // Do not delete immediately to allow reconnections
              // The cleanup interval will remove it if it stays empty
              console.log(`Room ${departingRoomId} is now empty`);
          }
          
          // Update player list for remaining players in the room
          broadcastPlayerListToRoom(departingRoomId);
          
          // Update public room list for all clients in lobby
          if (room.isPublic) {
              broadcastPublicRooms();
          }
          
          // Reset client's room data
          ws.clientData.roomId = null;
          ws.clientData.playerId = null;
          
          // Send room left confirmation
          ws.send(JSON.stringify({
              type: 'roomLeft'
          }));
      }
  }
});

// Broadcast a message to all clients in a specific room except the sender
function broadcastToRoom(roomId, message, excludeClient = null) {
  if (!rooms[roomId]) return;
  
  for (const playerId in rooms[roomId].players) {
      const player = rooms[roomId].players[playerId];
      const client = clients[player.clientId];
      
      if (client && client.readyState === WebSocket.OPEN && 
          (!excludeClient || client !== excludeClient)) {
          client.send(JSON.stringify(message));
      }
  }
}

// Broadcast current player list to all clients in a room
function broadcastPlayerListToRoom(roomId) {
  if (!rooms[roomId]) return;
  
  const playerList = Object.values(rooms[roomId].players).map(player => ({
      id: player.id,
      name: player.name,
      color: player.color
  }));
  
  broadcastToRoom(roomId, {
      type: 'playerList',
      players: playerList
  });
}

// Broadcast list of public rooms to all clients in the lobby
function broadcastPublicRooms() {
  const publicRooms = getPublicRooms();
  console.log(`Broadcasting ${publicRooms.length} public rooms to lobby clients`);
  
  for (const clientId in clients) {
      const client = clients[clientId];
      
      // Only send to clients not in a room (in lobby)
      if (client.readyState === WebSocket.OPEN && !client.clientData.roomId) {
          console.log(`Sending room list to client in lobby: ${clientId}`);
          client.send(JSON.stringify({
              type: 'roomList',
              rooms: publicRooms
          }));
      }
  }
}

// Create a default test room on server start
setTimeout(() => {
  console.log("Creating default test room");
  const roomId = createRoom(true, 'server');
  
  // Add dummy player so room isn't empty
  rooms[roomId].players[999] = {
      id: 999,
      name: "Default Bot",
      color: "#808080",
      x: 400,
      y: 300,
      clientId: 'server'
  };
  rooms[roomId].playerCount = 1;
  
  console.log(`Default room created: ${roomId}`);
}, 1000);

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} in your browser to play`);
});
