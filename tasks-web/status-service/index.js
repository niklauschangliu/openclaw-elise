// OpenClaw Tasks Web - Status Service
// - Connects to local OpenClaw Gateway WS
// - Maintains an in-memory state snapshot
// - Exposes HTTP GET /state and SSE GET /events (event-driven)
// - Simple Bearer token auth

const express = require('express');
const cors = require('cors');
const WebSocket = require('ws');

const { redactSnapshot, redactEventFrame } = require('./redact');

const PORT = Number(process.env.PORT || 8787);
const DASHBOARD_TOKEN = (process.env.DASHBOARD_TOKEN || '').trim();
const GATEWAY_URL = (process.env.GATEWAY_URL || 'ws://127.0.0.1:18789').trim();
const GATEWAY_TOKEN = (process.env.OPENCLAW_GATEWAY_TOKEN || process.env.GATEWAY_TOKEN || '').trim();

function requireAuth(req, res, next) {
  if (!DASHBOARD_TOKEN) return res.status(500).json({ error: 'DASHBOARD_TOKEN not set' });

  // Prefer Authorization header, but allow ?token= for EventSource (no custom headers).
  const qToken = typeof req.query?.token === 'string' ? req.query.token : '';
  const auth = req.headers['authorization'] || '';
  const m = /^Bearer\s+(.+)$/i.exec(auth);
  const token = (m && m[1]) ? m[1] : qToken;

  if (!token || token !== DASHBOARD_TOKEN) {
    console.log('[status-service] auth failed', { hasHeader: Boolean(auth), hasQuery: Boolean(qToken), tokenLen: token ? token.length : 0 });
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

/**
 * In-memory state
 * We store:
 *  - snapshot: last known full snapshot (from hello-ok)
 *  - lastEvent: last received event (for debugging)
 *  - connected: gateway ws status
 *  - seq/stateVersion: last seen
 */
const state = {
  connected: false,
  connectedAt: null,
  lastEventAt: null,
  seq: null,
  stateVersion: null,
  snapshot: null,
  lastEvent: null,
  errors: [],
};

function normalizeRemoteIp(ip) {
  if (!ip) return '';
  if (ip.startsWith('::ffff:')) return ip.slice('::ffff:'.length);
  return ip;
}

function isTailnetIp(ip) {
  // Tailscale uses 100.64.0.0/10
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(ip);
  if (!m) return false;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a !== 100) return false;
  return b >= 64 && b <= 127;
}

function isLocalOrTailnet(req) {
  const ip = normalizeRemoteIp(req.socket && req.socket.remoteAddress);
  return ip === '127.0.0.1' || ip === '::1' || ip === 'localhost' || isTailnetIp(ip);
}

// SSE clients
const sseClients = new Set();
function sseSend(event, data, opts = {}) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      if (opts && opts.redactedOnly && client.allowFull) continue;
      if (opts && opts.fullOnly && !client.allowFull) continue;
      client.res.write(payload);
    } catch {}
  }
}

function pushError(e, context) {
  const entry = {
    ts: new Date().toISOString(),
    context,
    message: e && e.message ? e.message : String(e),
  };
  state.errors.unshift(entry);
  state.errors = state.errors.slice(0, 50);
  sseSend('error', entry);
}

// --- Gateway WS client ---
let ws = null;
let reconnectTimer = null;
let reqId = 1;

function sendReq(method, params) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  const id = String(reqId++);
  ws.send(JSON.stringify({ type: 'req', id, method, params }));
  return id;
}

function connectGateway() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }

  ws = new WebSocket(GATEWAY_URL);

  ws.on('open', () => {
    // Wait for connect.challenge, then send connect.
  });

  ws.on('message', (buf) => {
    let msg;
    try { msg = JSON.parse(buf.toString('utf8')); } catch { return; }

    if (msg.type === 'event' && msg.event === 'connect.challenge') {
      // Local loopback: we do not sign the nonce (signature required only for non-local).
      // Use an operator role with read scope.
      sendReq('connect', {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: 'gateway-client',
          version: '0.1.0',
          platform: 'windows',
          mode: 'backend'
        },
        role: 'operator',
        scopes: ['operator.read'],
        caps: [],
        commands: [],
        permissions: {},
        auth: GATEWAY_TOKEN ? { token: GATEWAY_TOKEN } : undefined,
        locale: 'en-US',
        userAgent: 'tasks-web-status-service/0.1.0'
      });
      return;
    }

    if (msg.type === 'res' && msg.ok && msg.payload && msg.payload.type === 'hello-ok') {
      state.connected = true;
      state.connectedAt = new Date().toISOString();
      state.snapshot = msg.payload.snapshot || null;
      state.stateVersion = msg.payload.snapshot?.stateVersion ?? msg.payload.stateVersion ?? null;
      state.seq = null;

      // By default, broadcast redacted snapshot to all clients. Full snapshot is only available
      // to local/tailnet clients that explicitly request ?full=1.
      sseSend('snapshot', { snapshot: redactSnapshot(state.snapshot), stateVersion: state.stateVersion }, { redactedOnly: true });
      sseSend('snapshot', { snapshot: state.snapshot, stateVersion: state.stateVersion }, { fullOnly: true });

      sseSend('gateway', { connected: true });
      return;
    }

    if (msg.type === 'res' && msg.ok === false) {
      // connect or later errors
      pushError(msg.error || msg, 'gateway.res');
      return;
    }

    if (msg.type === 'event') {
      state.lastEventAt = new Date().toISOString();
      state.lastEvent = msg;
      if (typeof msg.seq !== 'undefined') state.seq = msg.seq;
      if (typeof msg.stateVersion !== 'undefined') state.stateVersion = msg.stateVersion;

      // Forward events to dashboard clients.
      sseSend('event', redactEventFrame(msg), { redactedOnly: true });
      sseSend('event', msg, { fullOnly: true });
      return;
    }
  });

  ws.on('close', () => {
    state.connected = false;
    sseSend('gateway', { connected: false });
    scheduleReconnect();
  });

  ws.on('error', (e) => {
    pushError(e, 'gateway.ws');
  });
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connectGateway();
  }, 1500);
}

connectGateway();

// --- HTTP server ---
const app = express();
app.use(cors({ origin: true }));

app.get('/health', (req, res) => {
  res.json({ ok: true, connected: state.connected });
});

app.get('/state', requireAuth, (req, res) => {
  const allowFull = isLocalOrTailnet(req) && req.query.full === '1';
  const snap = allowFull ? state.snapshot : redactSnapshot(state.snapshot);

  res.json({
    connected: state.connected,
    connectedAt: state.connectedAt,
    lastEventAt: state.lastEventAt,
    seq: state.seq,
    stateVersion: state.stateVersion,
    snapshot: snap,
    errors: state.errors,
    redacted: !allowFull,
  });
});

app.get('/events', requireAuth, (req, res) => {
  const allowFull = isLocalOrTailnet(req) && req.query.full === '1';

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
  });

  // Initial ping + snapshot
  res.write(`event: hello\ndata: ${JSON.stringify({ ts: new Date().toISOString(), redacted: !allowFull })}\n\n`);

  if (state.snapshot) {
    const snap = allowFull ? state.snapshot : redactSnapshot(state.snapshot);
    res.write(`event: snapshot\ndata: ${JSON.stringify({ snapshot: snap, stateVersion: state.stateVersion })}\n\n`);
  }

  const client = { res, allowFull };
  sseClients.add(client);

  req.on('close', () => {
    sseClients.delete(client);
  });
});

app.listen(PORT, () => {
  console.log(`[status-service] listening on http://127.0.0.1:${PORT}`);
  console.log(`[status-service] gateway ws: ${GATEWAY_URL}`);
  console.log(`[status-service] dashboard token: ${DASHBOARD_TOKEN ? ('set(len=' + DASHBOARD_TOKEN.length + ')') : 'MISSING'}`);
  console.log(`[status-service] sse clients: /events (auth required)`);
});
