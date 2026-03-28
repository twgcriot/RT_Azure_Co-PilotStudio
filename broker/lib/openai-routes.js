import { randomBytes } from 'crypto';

/**
 * OpenAI-compatible HTTP surface (Chat Completions + Models).
 * Multi-turn: pass a stable string in the standard `user` field; it maps to the broker session.
 */

function openaiError(res, status, message, type = 'invalid_request_error', code = null) {
  return res.status(status).json({
    error: {
      message,
      type,
      param: null,
      code,
    },
  });
}

function messageContentToString(content) {
  if (content == null) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    const parts = [];
    for (const part of content) {
      if (typeof part === 'string') parts.push(part);
      else if (part && typeof part === 'object') {
        if (part.type === 'text' && typeof part.text === 'string') parts.push(part.text);
      }
    }
    return parts.join('');
  }
  return '';
}

function lastUserMessageText(messages) {
  if (!Array.isArray(messages)) return '';
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m && m.role === 'user') {
      return messageContentToString(m.content).trim();
    }
  }
  return '';
}

function estTokensFromString(s) {
  return Math.max(0, Math.ceil(String(s).length / 4));
}

function buildChatCompletion(model, assistantContent, userPromptText) {
  const id = `chatcmpl-${randomBytes(12).toString('hex')}`;
  const created = Math.floor(Date.now() / 1000);
  const pt = Math.max(1, estTokensFromString(userPromptText || ''));
  const ct = estTokensFromString(assistantContent || '');
  return {
    id,
    object: 'chat.completion',
    created,
    model,
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: assistantContent ?? '',
        },
        finish_reason: 'stop',
        logprobs: null,
      },
    ],
    usage: {
      prompt_tokens: pt,
      completion_tokens: ct,
      total_tokens: pt + ct,
    },
  };
}

/**
 * @param {import('express').Express} app
 * @param {object} deps
 */
export function setupOpenAiRoutes(app, deps) {
  const {
    tokenUrl,
    clientConfig,
    sendChatTurn,
    getSession,
    setSession,
    createSessionId,
  } = deps;

  const defaultModel = process.env.OPENAI_COMPAT_MODEL_ID || 'copilot-studio';

  app.get('/v1/models', (_req, res) => {
    res.json({
      object: 'list',
      data: [
        {
          id: defaultModel,
          object: 'model',
          created: 1700000000,
          owned_by: 'copilot-studio-broker',
        },
      ],
    });
  });

  app.get('/v1/models/:modelId', (req, res) => {
    if (req.params.modelId !== defaultModel) {
      return openaiError(
        res,
        404,
        `The model \`${req.params.modelId}\` does not exist`,
        'invalid_request_error',
        'model_not_found'
      );
    }
    res.json({
      id: defaultModel,
      object: 'model',
      created: 1700000000,
      owned_by: 'copilot-studio-broker',
    });
  });

  app.post('/v1/chat/completions', async (req, res) => {
    if (!tokenUrl) {
      return openaiError(
        res,
        503,
        'Broker is not configured (COPILOT_DIRECTLINE_TOKEN_URL)',
        'server_error',
        null
      );
    }

    const body = req.body || {};

    if (body.stream === true) {
      return openaiError(
        res,
        400,
        'Streaming is not supported; omit stream or set stream to false.',
        'invalid_request_error',
        null
      );
    }

    const model =
      typeof body.model === 'string' && body.model.trim() ? body.model.trim() : defaultModel;
    const messages = body.messages;
    if (!Array.isArray(messages) || messages.length === 0) {
      return openaiError(res, 400, 'messages is required and must be a non-empty array', 'invalid_request_error', null);
    }

    const text = lastUserMessageText(messages);
    if (!text) {
      return openaiError(
        res,
        400,
        'No user message with usable content found in messages',
        'invalid_request_error',
        null
      );
    }

    let sessionId =
      typeof body.user === 'string' && body.user.trim() ? body.user.trim() : '';
    let existing = sessionId ? getSession(sessionId) : null;

    if (!sessionId) {
      sessionId = createSessionId();
      existing = { conversationId: '', token: '' };
    } else if (!existing) {
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

      const assistantContent = result.replies.map((r) => r.text || '').join('\n\n');
      const payload = buildChatCompletion(model, assistantContent, text);
      res.setHeader('X-Broker-Session-Id', sessionId);
      res.json(payload);
    } catch (err) {
      const code = typeof err.status === 'number' ? err.status : NaN;
      const status = code >= 400 && code < 600 ? code : 502;
      const message = err.message || 'Request to Direct Line failed';
      return openaiError(res, status, message, 'server_error', null);
    }
  });
}
