import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

import { sendChatTurn } from './lib/directline.js';
import { setupOpenAiRoutes } from './lib/openai-routes.js';
import { createSessionId, getSession, setSession } from './lib/sessions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = Number(process.env.PORT) || 8080;

const tokenUrl = process.env.COPILOT_DIRECTLINE_TOKEN_URL;
const directLineRoot =
  process.env.DIRECT_LINE_ROOT || 'https://directline.botframework.com/v3/directline';
const userFromId = process.env.USER_FROM_ID || 'user1';
const pollIntervalMs = Number(process.env.POLL_INTERVAL_MS) || 1000;
const pollTimeoutMs = Number(process.env.POLL_TIMEOUT_MS) || 45000;
const initialDelayMs = Number(process.env.INITIAL_DELAY_MS) || 0;

const clientConfig = {
  tokenUrl,
  directLineRoot,
  fromId: userFromId,
  pollOptions: {
    pollIntervalMs,
    pollTimeoutMs,
    initialDelayMs,
  },
};

app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    configured: Boolean(tokenUrl),
  });
});

app.post('/api/chat', async (req, res) => {
  if (!tokenUrl) {
    return res.status(503).json({
      error: 'Server misconfiguration: set COPILOT_DIRECTLINE_TOKEN_URL in .env',
    });
  }

  const rawText = req.body?.text;
  const text = typeof rawText === 'string' ? rawText.trim() : '';
  if (!text) {
    return res.status(400).json({ error: 'Missing or empty `text` in JSON body' });
  }

  let sessionId = typeof req.body?.sessionId === 'string' ? req.body.sessionId.trim() : '';
  let existing = sessionId ? getSession(sessionId) : null;

  if (sessionId && !existing) {
    return res.status(404).json({ error: 'Unknown sessionId; omit it to start a new session' });
  }

  if (!sessionId) {
    sessionId = createSessionId();
    existing = { conversationId: '', token: '' };
  }

  try {
    const result = await sendChatTurn(
      clientConfig,
      { conversationId: existing.conversationId, token: existing.token },
      text
    );

    setSession(sessionId, {
      conversationId: result.conversationId,
      token: result.token,
    });

    return res.json({
      sessionId,
      userText: text,
      replies: result.replies,
      timedOut: result.timedOut === true,
    });
  } catch (err) {
    const code = typeof err.status === 'number' ? err.status : NaN;
    const status = code >= 400 && code < 600 ? code : 502;
    const message = err.message || 'Request to Direct Line failed';
    return res.status(status).json({ error: message });
  }
});

setupOpenAiRoutes(app, {
  tokenUrl,
  clientConfig,
  sendChatTurn,
  getSession,
  setSession,
  createSessionId,
});

app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Copilot Studio broker listening on http://localhost:${PORT}`);
  if (!tokenUrl) {
    console.warn('Warning: COPILOT_DIRECTLINE_TOKEN_URL is not set. Copy .env.example to .env.');
  }
});
