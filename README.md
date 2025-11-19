# DVA Realtime Chat — minimal Socket.IO example

This repository contains a tiny realtime chat example powered by Node.js, Express and Socket.IO.

Files added:

- `server.js` — Express server that serves static files from `/public` and runs Socket.IO.
- `public/index.html` — Minimal client HTML UI.
- `public/client.js` — Client-side Socket.IO logic (send/receive messages).
- `package.json` — Lists dependencies and start script.

Requirements

- Node.js (v14+ recommended) and npm installed on your system.

Install and run

Open a terminal in the project root (where `package.json` is) and run:

```powershell
npm install
npm start
```

Then open your browser to http://localhost:3000 and you should see the chat UI. Open multiple browser tabs to test realtime messaging.

How it works (brief)

- The server serves the static client and hosts a Socket.IO server that listens for `chat message` events.
- When a client emits a `chat message` event, the server broadcasts it to all connected clients.

Notes and next steps

- This is intentionally minimal and has no authentication or persistence.
- For development you may want to install `nodemon` and run `nodemon server.js`.

# DVA_Seminar_Realtime_Chat
