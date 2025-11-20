const express = require('express');
const http = require('http');
const path = require('path');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static client files from /public
app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
  console.log('user connected', socket.id);
  // track username for each socket id
  // users: Map<socket.id, username>
  // simple in-memory store for this session only
  if (!io.users) io.users = new Map();
  // messages: array of { name, message, ts }
  if (!io.messages) io.messages = [];

  // handle join event: client proposes a username; ensure uniqueness
  socket.on('join', (name, cb) => {
    name = String(name || '').trim();
    if (!name) return cb && cb({ ok: false, reason: 'missing-name' });
    // check if name is already used by any connected socket
    const inUse = Array.from(io.users.values()).includes(name);
    if (inUse) return cb && cb({ ok: false, reason: 'name-taken' });

    io.users.set(socket.id, name);
    console.log('user joined as', name, socket.id);
    socket.broadcast.emit('user joined', { name });
    // return recent history to the joining client
    // send a shallow copy to avoid accidental mutation
    const history = io.messages.slice();
    cb && cb({ ok: true, history });
  });

  // relay incoming chat messages to all clients, using server-side name
  socket.on('chat message', (data) => {
    const message = (data && data.message) ? String(data.message) : '';
    const name = io.users.get(socket.id) || 'Anonymous';
    if (!message) return;
    const msgObj = { name, message, ts: Date.now() };
    // store message and keep last 500 messages
    io.messages.push(msgObj);
    if (io.messages.length > 500) io.messages.shift();
    io.emit('chat message', msgObj);
  });

  socket.on('disconnect', () => {
    const name = io.users && io.users.get(socket.id);
    if (name) {
      io.users.delete(socket.id);
      socket.broadcast.emit('user left', { name });
      console.log('user disconnected', socket.id, name);
    } else {
      console.log('user disconnected', socket.id);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
