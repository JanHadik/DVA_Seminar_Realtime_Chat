const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static client files from /public
app.use(express.static(path.join(__dirname, 'public')));

// Multi-room data structure
// rooms: { roomName: { users: Map<socketId, username>, messages: [] } }
const rooms = {};
const DEFAULT_ROOM = 'General';
// globalUsers: Map<username, socketId> ensures uniqueness across all rooms
const globalUsers = new Map();

// Initialize default room
function initRoom(roomName) {
  if (!rooms[roomName]) {
    rooms[roomName] = { users: new Map(), messages: [] };
  }
}

// Get list of all rooms
function getRoomList() {
  return Object.keys(rooms);
}

// Initialize default room on startup
initRoom(DEFAULT_ROOM);
console.log('Available rooms on startup:', getRoomList());

io.on('connection', (socket) => {
  console.log('=== USER CONNECTED ===', socket.id);
  let currentRoom = null;
  let currentUserName = null;

  // Send list of available rooms to new client
  socket.emit('rooms-list', getRoomList());
  console.log('Sent rooms-list to client:', getRoomList());

  // Handle room join
  socket.on('join-room', (roomName, userName, cb) => {
    console.log('join-room event received:', { roomName, userName, socketId: socket.id });
    roomName = String(roomName || '').trim() || DEFAULT_ROOM;
    userName = String(userName || '').trim();

    if (!userName) {
      console.log('Missing username');
      return cb && cb({ ok: false, reason: 'missing-name' });
    }

    // Global uniqueness check (name used by any connected socket)
    const existingOwner = globalUsers.get(userName);
    if (existingOwner && existingOwner !== socket.id) {
      console.log('Name already taken globally:', userName);
      return cb && cb({ ok: false, reason: 'name-taken' });
    }

    // Check if name is already taken in this room (redundant but keeps room integrity)
    initRoom(roomName);
    const inUse = Array.from(rooms[roomName].users.values()).includes(userName);
    if (inUse) {
      console.log('Name already taken in room:', roomName);
      return cb && cb({ ok: false, reason: 'name-taken' });
    }

    // If user was in a different room, remove them from the old room
    if (currentRoom && currentUserName) {
      socket.leave(currentRoom);
      rooms[currentRoom].users.delete(socket.id);
      io.to(currentRoom).emit('user left', { name: currentUserName });
      console.log(
        'user left room',
        currentRoom,
        currentUserName,
        socket.id
      );

      // If user changes name, free the previous name globally
      if (currentUserName !== userName) {
        globalUsers.delete(currentUserName);
      }
    }

    // Join new room
    currentRoom = roomName;
    currentUserName = userName;
    globalUsers.set(userName, socket.id);
    rooms[roomName].users.set(socket.id, userName);
    socket.join(roomName);

    console.log('user joined room', roomName, userName, socket.id, 'Total users in room:', rooms[roomName].users.size);

    // Notify others in the room
    io.to(roomName).emit('user joined', { name: userName });

    // Send room history and user list to joining client
    const history = rooms[roomName].messages.slice();
    const userList = Array.from(rooms[roomName].users.values());

    console.log('Sending join response:', { ok: true, roomName, userName, historyCount: history.length, userCount: userList.length });

    cb &&
      cb({
        ok: true,
        history,
        userList,
        roomName,
        userName,
      });

    // Broadcast updated room list and user count to all clients
    io.emit('rooms-list', getRoomList());
  });

  // Relay chat messages to room members only
  socket.on('chat message', (data) => {
    if (!currentRoom || !currentUserName) {
      return;
    }

    const message = (data && data.message) ? String(data.message) : '';
    if (!message) return;

    const msgObj = { name: currentUserName, message, ts: Date.now() };

    // Store message in room and keep last 100 messages per room
    rooms[currentRoom].messages.push(msgObj);
    if (rooms[currentRoom].messages.length > 100) {
      rooms[currentRoom].messages.shift();
    }

    // Emit only to users in this room
    io.to(currentRoom).emit('chat message', msgObj);
  });

  // Get current list of users in room
  socket.on('get-users', (cb) => {
    if (currentRoom) {
      const userList = Array.from(rooms[currentRoom].users.values());
      cb && cb(userList);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    if (currentRoom && currentUserName) {
      rooms[currentRoom].users.delete(socket.id);
      globalUsers.delete(currentUserName);
      io.to(currentRoom).emit('user left', { name: currentUserName });
      console.log('user disconnected', socket.id, currentUserName, currentRoom);

      // Clean up empty rooms (except default)
      if (
        currentRoom !== DEFAULT_ROOM &&
        rooms[currentRoom].users.size === 0
      ) {
        delete rooms[currentRoom];
        io.emit('rooms-list', getRoomList());
      }
    } else {
      console.log('user disconnected', socket.id);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
