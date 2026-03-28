/**
 * Copilot Studio / Direct Line v3 client (mirrors Postman "Co-Pilot Studio Flow" sequence).
 */

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function watermarkFromActivityId(activityId) {
  if (!activityId || typeof activityId !== 'string') return '';
  const parts = activityId.split('|');
  return parts.length > 1 ? parts[parts.length - 1] : activityId;
}

async function readJsonResponse(res) {
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  if (!res.ok) {
    const msg =
      (body && (body.message || body.error?.message)) ||
      `HTTP ${res.status}: ${text?.slice(0, 200) || res.statusText}`;
    const err = new Error(msg);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
}

export async function fetchDirectLineToken(tokenUrl) {
  const res = await fetch(tokenUrl, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  });
  const data = await readJsonResponse(res);
  if (!data?.token) {
    throw new Error('Token response missing `token` field');
  }
  return data.token;
}

export async function startConversation(token, directLineRoot) {
  const url = `${directLineRoot.replace(/\/$/, '')}/conversations`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: '{}',
  });
  const data = await readJsonResponse(res);
  if (!data?.conversationId) {
    throw new Error('Start conversation response missing conversationId');
  }
  return {
    conversationId: data.conversationId,
    token: data.token || token,
    streamUrl: data.streamUrl,
    expiresIn: data.expires_in,
  };
}

export async function postUserActivity(token, directLineRoot, conversationId, text, fromId) {
  const url = `${directLineRoot.replace(/\/$/, '')}/conversations/${encodeURIComponent(conversationId)}/activities`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'message',
      from: { id: fromId },
      text,
    }),
  });
  const data = await readJsonResponse(res);
  const id = data?.id;
  return {
    activityId: id,
    watermark: watermarkFromActivityId(id),
  };
}

export async function getActivities(token, directLineRoot, conversationId, watermark) {
  const base = `${directLineRoot.replace(/\/$/, '')}/conversations/${encodeURIComponent(conversationId)}/activities`;
  const url =
    watermark !== undefined && watermark !== null && String(watermark) !== ''
      ? `${base}?watermark=${encodeURIComponent(String(watermark))}`
      : base;
  const res = await fetch(url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  });
  return readJsonResponse(res);
}

function isBotMessage(activity) {
  return (
    activity?.type === 'message' &&
    activity.from?.role === 'bot' &&
    (activity.text !== undefined ? String(activity.text).length >= 0 : true)
  );
}

function normalizeActivity(activity) {
  const from = activity.from || {};
  const role = from.role === 'bot' ? 'bot' : 'user';
  return {
    role,
    text: activity.text ?? '',
    timestamp: activity.timestamp || null,
    id: activity.id || null,
  };
}

export async function pollBotReplies(token, directLineRoot, conversationId, startWatermark, options) {
  const interval = options.pollIntervalMs ?? 1000;
  const timeout = options.pollTimeoutMs ?? 45000;
  const initialDelay = options.initialDelayMs ?? 0;
  if (initialDelay > 0) {
    await sleep(initialDelay);
  }

  const deadline = Date.now() + timeout;
  let watermark = startWatermark;
  const collected = [];

  while (Date.now() < deadline) {
    const data = await getActivities(token, directLineRoot, conversationId, watermark);
    const activities = data.activities || [];

    for (const a of activities) {
      if (isBotMessage(a)) {
        collected.push(normalizeActivity(a));
      }
    }

    if (data.watermark !== undefined && data.watermark !== null && String(data.watermark) !== '') {
      watermark = data.watermark;
    }

    if (collected.length > 0) {
      return { replies: collected, watermark };
    }

    await sleep(interval);
  }

  return { replies: [], watermark, timedOut: true };
}

export async function bootstrapSession(tokenUrl, directLineRoot) {
  const initialToken = await fetchDirectLineToken(tokenUrl);
  const started = await startConversation(initialToken, directLineRoot);
  const { conversationId, token } = started;
  return { conversationId, token, streamUrl: started.streamUrl };
}

export async function sendChatTurn(
  { tokenUrl, directLineRoot, fromId, pollOptions },
  session,
  text
) {
  let token = session.token;
  let conversationId = session.conversationId;

  if (!conversationId || !token) {
    const boot = await bootstrapSession(tokenUrl, directLineRoot);
    token = boot.token;
    conversationId = boot.conversationId;
  }

  const { watermark: postWatermark } = await postUserActivity(
    token,
    directLineRoot,
    conversationId,
    text,
    fromId
  );

  const pollResult = await pollBotReplies(
    token,
    directLineRoot,
    conversationId,
    postWatermark,
    pollOptions
  );

  return {
    conversationId,
    token,
    replies: pollResult.replies,
    timedOut: pollResult.timedOut === true,
    pollWatermark: pollResult.watermark,
  };
}
