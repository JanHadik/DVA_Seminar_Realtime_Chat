(() => {
  console.log('Client script loaded');
  const socket = io();
  
  socket.on('connect', () => {
    console.log('Socket connected:', socket.id);
  });
  
  socket.on('disconnect', () => {
    console.log('Socket disconnected');
  });

  const form = document.getElementById('form');
  const input = document.getElementById('m');
  const messages = document.getElementById('messages');
  const roomsList = document.getElementById('roomsList');
  const roomName = document.getElementById('roomName');
  const createRoomBtn = document.getElementById('createRoomBtn');
  const createRoomInput = document.getElementById('createRoomInput');
  const sidebar = document.getElementById('sidebar');
  const openSidebarBtn = document.getElementById('openSidebarBtn');
  const closeSidebarBtn = document.getElementById('closeSidebarBtn');

  // login elements
  const loginOverlay = document.getElementById('loginOverlay');
  const loginForm = document.getElementById('loginForm');
  const loginName = document.getElementById('loginName');
  const loginRoom = document.getElementById('loginRoom');
  const loginError = document.getElementById('loginError');

  let currentName = null;
  let currentRoom = null;
  let roomList = [];

  // Mobile sidebar toggle
  function openSidebar() {
    sidebar.classList.add('open');
  }

  function closeSidebar() {
    sidebar.classList.remove('open');
  }

  openSidebarBtn.addEventListener('click', openSidebar);
  closeSidebarBtn.addEventListener('click', closeSidebar);

  // Close sidebar when clicking a room on mobile
  function addRoomClickHandler() {
    roomsList.querySelectorAll('.room-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        const selectedRoom = btn.dataset.room;
        closeSidebar();
        if (selectedRoom !== currentRoom) {
          switchRoom(selectedRoom);
        }
      });
    });
  }

  // Close sidebar on small screens when message sent
  form.addEventListener('submit', (e) => {
    if (window.innerWidth <= 768) {
      closeSidebar();
    }
  });

  function getRoomList() {
    return roomList;
  }

  function appendMessage(data) {
    const item = document.createElement('li');
    const who = data.name ? `${data.name}: ` : '';
    item.textContent = who + data.message;
    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
  }

  function clearMessages() {
    messages.innerHTML = '';
  }

  // Receive list of available rooms from server
  socket.on('rooms-list', (list) => {
    roomList = list;
    populateRoomsList(list);
  });

  function populateRoomsList(roomList) {
    // Update login room dropdown
    const selectedLogin = loginRoom.value;
    loginRoom.innerHTML = roomList
      .map((room) => `<option value="${room}">${room}</option>`)
      .join('');
    if (selectedLogin && roomList.includes(selectedLogin)) {
      loginRoom.value = selectedLogin;
    }

    // Update room pills in sidebar (if logged in)
    if (currentName) {
      roomsList.innerHTML = roomList
        .map(
          (room) =>
            `<button class="room-btn ${
              room === currentRoom ? 'active' : ''
            }" data-room="${room}">${room}</button>`
        )
        .join('');

      // Attach click handlers
      addRoomClickHandler();
    }
  }

  function switchRoom(newRoom) {
    clearMessages();
    socket.emit('join-room', newRoom, currentName, (resp) => {
      if (resp && resp.ok) {
        currentRoom = resp.roomName;
        roomName.textContent = `Room: ${currentRoom}`;

        // Render message history
        if (resp.history && Array.isArray(resp.history)) {
          resp.history.forEach((m) => appendMessage(m));
        }

        // Update room button styles
        roomsList.querySelectorAll('.room-btn').forEach((btn) => {
          btn.classList.toggle(
            'active',
            btn.dataset.room === currentRoom
          );
        });

        appendMessage({
          name: 'System',
          message: `Switched to room: ${currentRoom}`,
        });
      } else {
        appendMessage({
          name: 'System',
          message: 'Failed to switch room',
        });
      }
    });
  }

  // send chat messages
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!currentName || !currentRoom) {
      return alert('Please join a room first');
    }
    const msg = input.value.trim();
    if (!msg) return;
    const payload = { message: msg };
    socket.emit('chat message', payload);
    input.value = '';
  });

  // Create new room
  if (createRoomBtn) {
    createRoomBtn.addEventListener('click', () => {
      const newRoom = createRoomInput.value.trim();
      if (!newRoom) {
        alert('Please enter a room name');
        return;
      }
      createRoomInput.value = '';
      switchRoom(newRoom);
    });

    createRoomInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') createRoomBtn.click();
    });
  }

  // login flow
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = loginName.value.trim();
    const room = loginRoom.value.trim();
    console.log('Join attempt:', { name, room });
    if (!name) {
      showLoginError('Please enter a name');
      return;
    }
    if (!room) {
      showLoginError('Please select a room');
      return;
    }
    // ask server to join this room with this name
    socket.emit('join-room', room, name, (resp) => {
      console.log('Join response:', resp);
      if (resp && resp.ok) {
        currentName = name;
        currentRoom = resp.roomName;
        loginOverlay.style.display = 'none';
        loginError.style.display = 'none';
        roomName.textContent = `Room: ${currentRoom}`;

        // Populate rooms list in sidebar
        populateRoomsList(getRoomList());

        // if server provided history, render it first
        if (resp.history && Array.isArray(resp.history)) {
          resp.history.forEach((m) => appendMessage(m));
        }
        appendMessage({
          name: 'System',
          message: `${name} joined ${currentRoom}`,
        });
      } else {
        const reason = (resp && resp.reason) || 'unknown';
        console.log('Join failed:', reason);
        if (reason === 'name-taken')
          showLoginError('Name is already taken');
        else showLoginError('Could not join — try a different name or room');
      }
    });
  });

  function showLoginError(msg) {
    loginError.textContent = msg;
    loginError.style.display = 'block';
  }

  socket.on('chat message', (data) => {
    appendMessage(data);
  });

  socket.on('user joined', (data) => {
    appendMessage({ name: 'System', message: `${data.name} joined` });
  });

  socket.on('user left', (data) => {
    appendMessage({ name: 'System', message: `${data.name} left` });
  });

  // ===== theme toggle (light/dark) =====
  const root = document.documentElement;
  const themeBtn = document.getElementById('themeToggle');

  if (themeBtn) {
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)')
      ?.matches;

    root.dataset.theme = stored || (prefersDark ? 'dark' : 'light');

    const syncIcon = () => {
      themeBtn.textContent = root.dataset.theme === 'dark' ? '☀️' : '🌙';
    };

    themeBtn.addEventListener('click', () => {
      root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('theme', root.dataset.theme);
      syncIcon();
    });

    syncIcon();
  }
})();
