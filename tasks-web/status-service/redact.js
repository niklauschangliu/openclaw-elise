function stripIp(ip) {
  if (!ip) return ip;
  // hide last octet for IPv4
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(ip);
  if (m) return `${m[1]}.${m[2]}.${m[3]}.x`;
  return ip;
}

function redactPresenceEntry(p) {
  if (!p || typeof p !== 'object') return p;
  const out = { ...p };
  if (out.ip) out.ip = stripIp(out.ip);
  // remove potentially identifying device ids
  delete out.deviceId;
  // keep host but not full text
  if (out.text && typeof out.text === 'string') {
    out.text = out.text.slice(0, 120);
  }
  return out;
}

function redactHealth(h) {
  if (!h || typeof h !== 'object') return h;
  const out = { ...h };
  // sessions path can leak local path
  if (out.sessions && typeof out.sessions === 'object') {
    out.sessions = { ...out.sessions };
    delete out.sessions.path;
  }
  // agents sessions paths
  if (Array.isArray(out.agents)) {
    out.agents = out.agents.map((a) => {
      if (!a || typeof a !== 'object') return a;
      const aa = { ...a };
      if (aa.sessions && typeof aa.sessions === 'object') {
        aa.sessions = { ...aa.sessions };
        delete aa.sessions.path;
      }
      return aa;
    });
  }
  return out;
}

function redactSnapshot(s) {
  if (!s || typeof s !== 'object') return s;
  const out = { ...s };
  // local file paths
  delete out.configPath;
  delete out.stateDir;

  if (Array.isArray(out.presence)) {
    out.presence = out.presence.map(redactPresenceEntry);
  }

  out.health = redactHealth(out.health);

  return out;
}

function redactEventFrame(msg) {
  if (!msg || typeof msg !== 'object') return msg;
  // For now, forward event metadata but avoid dumping potentially sensitive payload.
  const out = { ...msg };
  // Keep payload for presence/health deltas? safest: strip payload.
  if (out.event && typeof out.event === 'string') {
    const ev = out.event;
    // Keep lightweight payload for tick/shutdown.
    const allowPayload = ev === 'tick' || ev === 'shutdown';
    if (!allowPayload) out.payload = undefined;
  } else {
    out.payload = undefined;
  }
  return out;
}

module.exports = {
  redactSnapshot,
  redactEventFrame,
};
