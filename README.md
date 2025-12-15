# Realtime Chat — Architecture, Code Walkthrough, and Usage

This repository contains a minimal yet production-style realtime chat application built with Node.js, Express, and Socket.IO. It supports multiple rooms, per-room message history, unique usernames, and a simple, responsive UI with a light/dark theme toggle.

The goal of this README is to explain the code thoroughly, show how the pieces fit together, and provide clear instructions to run, extend, and troubleshoot the app.

---

**Contents**

- Overview
- Quick Start
- Project Structure
- Server Deep Dive (`server.js`)
- Client Deep Dive (`public/*`)
- Data Flow: Events and State
- Extensibility Ideas
- Security Considerations
- Troubleshooting

---

## Overview

- Tech stack: Express (static hosting) + Socket.IO (realtime websockets) + vanilla JS/CSS UI.
- Features:
  - Multiple rooms with on-demand creation.
  - Unique usernames enforced globally across all rooms.
  - Per-room user list and message history (last 100 messages).
  - Login overlay for selecting a room and entering a name.
  - Clean, modern styles with dark/light theme toggle.

## Quick Start

Prerequisites: Node.js 18+ recommended.

Install dependencies and run the server:

```bash
npm install
npm start
# Server listens on http://localhost:3000
```

Open your browser to http://localhost:3000 and join the chat.

## Project Structure

- `server.js`: Node.js server using Express to serve static files and Socket.IO for realtime messaging.
- `public/index.html`: The chat UI layout and login overlay.
- `public/client.js`: Socket.IO client, room switching, message rendering, login flow, and theme toggle.
- `public/styles.css`: Modern styling, layout, and theme variables.
- `package.json`: Metadata and start script.

---

## Server Deep Dive (server.js)

The server creates an HTTP server and attaches a Socket.IO instance to it. It serves files from `public/` and manages rooms, usernames, and message history.

Key imports and setup:

- `express`, `http`, `path`: Host static client assets.
- `{ Server } = require('socket.io')`: Socket.IO server.
- `app.use(express.static(path.join(__dirname, 'public')))` serves the client.

### In-memory State

```js
const rooms = {}; // { roomName: { users: Map<socketId, username>, messages: [] } }
const DEFAULT_ROOM = "General";
const globalUsers = new Map(); // Map<username, socketId>
```

- `rooms[roomName].users`: Tracks which sockets (clients) are in a room and their username.
- `rooms[roomName].messages`: Stores the last 100 messages for that room.
- `globalUsers`: Ensures usernames are unique across the entire app (not just inside a room).

Helper functions:

- `initRoom(roomName)`: Creates room storage if missing.
- `getRoomList()`: Returns all room names.

### Connection Lifecycle

When a client connects (`io.on('connection', (socket) => { ... })`):

- The server immediately emits `rooms-list` so the client can display available rooms.
- The server maintains `currentRoom` and `currentUserName` for that socket.

### Joining Rooms (`join-room`)

Client emits: `socket.emit('join-room', roomName, userName, cb)`

Server workflow:

1. Validate inputs; default to `General` if no room provided.
2. Check global uniqueness: if `globalUsers` has the username tied to a different socket, reject with `{ ok: false, reason: 'name-taken' }`.
3. Ensure room exists with `initRoom(roomName)`.
4. If the user is switching rooms, leave the previous one, update maps, and possibly free old global username.
5. Add the user to the new room, save `currentRoom` and `currentUserName`, and `socket.join(roomName)`.
6. Emit `user joined` to everyone in the room.
7. Return a callback payload including `history` and `userList` to initialize the client.
8. Broadcast updated `rooms-list` to all clients.

### Messaging (`chat message`)

Client emits: `socket.emit('chat message', { message })`

Server workflow:

1. Ignore if the socket hasn’t joined a room.
2. Create a message object `{ name, message, ts }`.
3. Push to the room’s `messages` (cap at 100 by shifting old ones).
4. Emit `chat message` only to the room (`io.to(currentRoom).emit('chat message', msgObj)`).

### User List (`get-users`)

Client can request the user list in the current room. Server responds via the callback with the `Array<string>` of usernames.

### Disconnect Handling

On `disconnect`:

- Remove user from `rooms[currentRoom].users` and `globalUsers`.
- Emit `user left` to the room.
- If a non-default room becomes empty, delete it and broadcast `rooms-list`.

### Ports

`PORT = process.env.PORT || 3000`. Override by setting the environment variable.

---

## Client Deep Dive (public/\*)

### Markup: `index.html`

- Two main areas: sidebar (rooms) and main chat container.
- Login overlay with `select#loginRoom` and `input#loginName` for room and username.
- Loads Socket.IO client via CDN and `public/client.js`.

### Styles: `styles.css`

- CSS variables for theme tokens (light/dark via `:root[data-theme]`).
- Responsive grid layout, styled room buttons, message list, and inputs.
- Minimal, modern aesthetic with subtle shadows and borders.

### Client Logic: `client.js`

Initialization:

- `const socket = io();` connects to the server.
- Sets up handlers for connection, disconnection, and all app events.

Room list syncing:

- Listens for `rooms-list` from the server to populate both the login dropdown and the sidebar room buttons.
- Clicking a room button triggers `switchRoom(newRoom)` which re-joins via `join-room` and re-renders history.

Login flow:

- Submitting the login form emits `join-room(room, name, cb)`.
- On success: hides overlay, sets `currentName/currentRoom`, renders history, and updates sidebar.
- On failure: shows a friendly error (e.g., name taken).

Messaging:

- Submitting the chat form emits `chat message` with the input.
- Server replies by broadcasting `chat message` to the room; the client appends it.
- System messages for `user joined` and `user left` provide room activity context.

Theme toggle:

- Button `#themeToggle` toggles `root.dataset.theme` and persists to `localStorage`.
- Auto-initializes theme based on stored preference or OS dark-mode.

---

## Data Flow: Events and State

Client → Server:

- `join-room(roomName, userName, cb)`: Ask to join or switch rooms. Callback receives `{ ok, history, userList, roomName, userName }`.
- `chat message({ message })`: Send a message to the current room.
- `get-users(cb)`: Request current room user list.

Server → Client:

- `rooms-list(roomNames[])`: Current set of rooms for dropdown and sidebar.
- `user joined({ name })`: Announce arrival in the room.
- `user left({ name })`: Announce departure.
- `chat message({ name, message, ts })`: Broadcasted message to room members.

State on server:

- `rooms`: Per-room users and bounded message history.
- `globalUsers`: Map for global username uniqueness.

State on client:

- `currentName`, `currentRoom`, `roomList`, DOM refs for messages and rooms.

---

## Extensibility Ideas

- Typing indicators: Emit `typing` events throttled from client, broadcast within room.
- Presence list UI: Render `userList` in sidebar and refresh on joins/leaves.
- Persistence: Swap in a database (e.g., Redis or Postgres) to persist rooms and messages.
- Moderation: Add admin roles, kick/ban, or message filters.
- File sharing: Accept uploads and broadcast file metadata/links.
- Auth integration: Use OAuth or a simple session-backed auth instead of anonymous names.

---

## Security Considerations

- Input validation: The server trims strings and rejects empty names. Consider limiting length and disallowing unsafe characters.
- Rate limiting: To prevent spam, add per-socket send limits (e.g., messages per second) or a simple cooldown.
- XSS prevention: Messages are rendered via `textContent` on the client, which avoids HTML injection. Keep it that way.
- Room naming: Sanitize room names; optionally restrict to alphanumeric + dashes.
- Transport security: In production, serve over HTTPS and configure Socket.IO accordingly.

---

## Development Notes

- The app uses simple in-memory structures; restarting the server clears rooms and history.
- For production, add persistence, authentication, and stricter input validation.

---

## License

MIT
