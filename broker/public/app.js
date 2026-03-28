const SESSION_KEY = 'copilot-broker-session-id';

const transcript = document.getElementById('transcript');
const banner = document.getElementById('banner');
const form = document.getElementById('composer');
const input = document.getElementById('message');
const sendBtn = document.getElementById('sendBtn');
const clearBtn = document.getElementById('clearBtn');
const sessionLabel = document.getElementById('sessionLabel');

function showBanner(message) {
  banner.textContent = message;
  banner.classList.remove('banner--hidden');
}

function hideBanner() {
  banner.classList.add('banner--hidden');
  banner.textContent = '';
}

function getSessionId() {
  return sessionStorage.getItem(SESSION_KEY);
}

function setSessionId(id) {
  if (id) {
    sessionStorage.setItem(SESSION_KEY, id);
  } else {
    sessionStorage.removeItem(SESSION_KEY);
  }
  updateSessionLabel();
}

function updateSessionLabel() {
  const id = getSessionId();
  sessionLabel.textContent = id ? `Session: ${id}` : 'Session: new (starts after first send)';
}

function clearTranscriptPlaceholder() {
  if (transcript.classList.contains('transcript--empty')) {
    transcript.textContent = '';
    transcript.classList.remove('transcript--empty');
  }
}

function appendMessage(role, text, meta) {
  clearTranscriptPlaceholder();
  const wrap = document.createElement('div');
  wrap.className = `msg msg--${role}`;
  const label = document.createElement('div');
  label.className = 'msg__meta';
  label.textContent = meta || (role === 'user' ? 'You' : 'Bot');
  const body = document.createElement('div');
  body.className = 'msg__text';
  body.textContent = text;
  wrap.appendChild(label);
  wrap.appendChild(body);
  transcript.appendChild(wrap);
  transcript.scrollTop = transcript.scrollHeight;
}

function appendNote(text) {
  clearTranscriptPlaceholder();
  const n = document.createElement('div');
  n.className = 'msg msg--note';
  n.textContent = text;
  transcript.appendChild(n);
  transcript.scrollTop = transcript.scrollHeight;
}

function ensureEmptyState() {
  if (!transcript.children.length) {
    transcript.classList.add('transcript--empty');
    transcript.textContent = 'No messages yet. Send one to start.';
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  hideBanner();

  const text = input.value.trim();
  if (!text) return;

  input.value = '';
  appendMessage('user', text, 'You');
  sendBtn.disabled = true;

  const payload = { text };
  const sid = getSessionId();
  if (sid) {
    payload.sessionId = sid;
  }

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const err = data.error || res.statusText || 'Request failed';
      showBanner(err);
      return;
    }

    if (data.sessionId) {
      setSessionId(data.sessionId);
    }

    const replies = Array.isArray(data.replies) ? data.replies : [];

    if (data.timedOut && replies.length === 0) {
      appendNote('No bot reply before timeout. Try again or increase POLL_TIMEOUT_MS on the server.');
    }

    for (const r of replies) {
      const label = r.timestamp ? formatTime(r.timestamp) : 'Bot';
      appendMessage('bot', r.text || '(empty message)', label);
    }

    if (!data.timedOut && replies.length === 0) {
      appendNote('No text reply from the bot for this turn.');
    }
  } catch (err) {
    showBanner(err.message || 'Network error');
  } finally {
    sendBtn.disabled = false;
    input.focus();
  }
});

clearBtn.addEventListener('click', () => {
  transcript.textContent = '';
  transcript.classList.remove('transcript--empty');
  setSessionId(null);
  hideBanner();
  ensureEmptyState();
});

function formatTime(iso) {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return 'Bot';
    return d.toLocaleString();
  } catch {
    return 'Bot';
  }
}

transcript.textContent = '';
transcript.classList.add('transcript--empty');
transcript.textContent = 'No messages yet. Send one to start.';
updateSessionLabel();
input.focus();
