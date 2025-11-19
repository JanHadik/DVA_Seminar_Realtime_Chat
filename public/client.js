(() => {
  const socket = io();

  const form = document.getElementById('form');
  const input = document.getElementById('m');
  const nameInput = document.getElementById('name');
  const messages = document.getElementById('messages');

  function appendMessage(data) {
    const item = document.createElement('li');
    const who = data.name ? `${data.name}: ` : '';
    item.textContent = who + data.message;
    messages.appendChild(item);
    messages.scrollTop = messages.scrollHeight;
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const msg = input.value.trim();
    const name = nameInput.value.trim() || 'Anonymous';
    if (!msg) return;
    const payload = { name, message: msg };
    socket.emit('chat message', payload);
    input.value = '';
  });

  socket.on('chat message', (data) => {
    appendMessage(data);
  });

})();
