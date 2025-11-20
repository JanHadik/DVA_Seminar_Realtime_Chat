(() => {
  const socket = io();
  const form = document.getElementById('form');
  const input = document.getElementById('m');
  const messages = document.getElementById('messages');

  // login elements
  const loginOverlay = document.getElementById('loginOverlay');
  const loginForm = document.getElementById('loginForm');
  const loginName = document.getElementById('loginName');
  const loginError = document.getElementById('loginError');

  let currentName = null;

  function appendMessage(data) {
    const item = document.createElement('li');
    const who = data.name ? `${data.name}: ` : '';
    item.textContent = who + data.message;
    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
  }

  // send chat messages (server uses the logged-in username)
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!currentName) return alert('Please join with a name first');
    const msg = input.value.trim();
    if (!msg) return;
    const payload = { message: msg };
    socket.emit('chat message', payload);
    input.value = '';
  });

  // login flow
  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = loginName.value.trim();
    if (!name) {
      showLoginError('Please enter a name');
      return;
    }
    // ask server to join with this name; server will callback with result
    socket.emit('join', name, (resp) => {
      if (resp && resp.ok) {
        currentName = name;
        loginOverlay.style.display = 'none';
        loginError.style.display = 'none';
        // if server provided history, render it first
        if (resp.history && Array.isArray(resp.history)) {
          resp.history.forEach((m) => appendMessage(m));
        }
        appendMessage({ name: 'System', message: `${name} joined` });
      } else {
        const reason = (resp && resp.reason) || 'unknown';
        if (reason === 'name-taken') showLoginError('Name is already taken in this session');
        else showLoginError('Could not join — try a different name');
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

})();
