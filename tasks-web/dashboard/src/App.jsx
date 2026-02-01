import { useEffect, useMemo, useState } from 'react'
import './App.css'

// IMPORTANT: Do NOT bake secrets into the static site.
// For GitHub Pages we keep API_BASE + TOKEN as runtime settings stored in localStorage.

const LS_API_BASE = 'openclaw_dashboard_api_base'
const LS_TOKEN = 'openclaw_dashboard_token'

function fmtAgeMs(ms) {
  if (ms == null) return ''
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h > 0) return `${h}h ${m % 60}m`
  if (m > 0) return `${m}m ${s % 60}s`
  return `${s}s`
}

function Card({ title, children }) {
  return (
    <section style={{ border: '1px solid #ddd', borderRadius: 10, padding: 12, background: '#fff' }}>
      <div style={{ fontWeight: 700, marginBottom: 8 }}>{title}</div>
      {children}
    </section>
  )
}

function KV({ k, v }) {
  return (
    <div style={{ display: 'flex', gap: 10, lineHeight: 1.6 }}>
      <div style={{ width: 140, opacity: 0.7 }}>{k}</div>
      <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', overflowWrap: 'anywhere' }}>{v}</div>
    </div>
  )
}

function Settings({ apiBase, token, setApiBase, setToken, onSave }) {
  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 10, padding: 12, background: '#fff', marginBottom: 12 }}>
      <div style={{ fontWeight: 800, marginBottom: 6 }}>Connect</div>
      <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 10 }}>
        Configure at runtime (safe for GitHub Pages). Values are stored in your browser localStorage.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: 10, alignItems: 'center' }}>
        <div style={{ opacity: 0.7 }}>API base</div>
        <input value={apiBase} onChange={(e) => setApiBase(e.target.value)} placeholder="http://100.x.y.z:8787" style={{ padding: 8, borderRadius: 8, border: '1px solid #ccc' }} />
        <div style={{ opacity: 0.7 }}>Token</div>
        <input value={token} onChange={(e) => setToken(e.target.value)} placeholder="dashboard token" style={{ padding: 8, borderRadius: 8, border: '1px solid #ccc' }} />
      </div>
      <div style={{ marginTop: 10 }}>
        <button onClick={onSave} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #333', background: '#111', color: '#fff' }}>Save</button>
      </div>
    </div>
  )
}

export default function App() {
  const [apiBase, setApiBase] = useState(localStorage.getItem(LS_API_BASE) || '')
  const [token, setToken] = useState(localStorage.getItem(LS_TOKEN) || '')

  const [state, setState] = useState(null)
  const [events, setEvents] = useState([])
  const [error, setError] = useState(null)

  const ready = useMemo(() => Boolean(apiBase) && Boolean(token), [apiBase, token])

  function saveSettings() {
    localStorage.setItem(LS_API_BASE, apiBase.trim())
    localStorage.setItem(LS_TOKEN, token.trim())
    setError(null)
    // Force a reload to reset EventSource cleanly.
    window.location.reload()
  }

  useEffect(() => {
    if (!ready) return

    const base = apiBase.replace(/\/$/, '')
    const t = token

    // Initial snapshot (one-time; not polling)
    fetch(`${base}/state?token=${encodeURIComponent(t)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`GET /state failed: ${r.status}`)
        return r.json()
      })
      .then(setState)
      .catch((e) => setError(String(e.message || e)))

    // SSE stream (event-driven)
    const url = new URL(`${base}/events`)
    url.searchParams.set('token', t)

    const es = new EventSource(url.toString())

    es.addEventListener('snapshot', (ev) => {
      try {
        const payload = JSON.parse(ev.data)
        setState((s) => ({ ...(s || {}), snapshot: payload.snapshot, stateVersion: payload.stateVersion }))
      } catch {}
    })

    es.addEventListener('event', (ev) => {
      try {
        const payload = JSON.parse(ev.data)
        setEvents((arr) => [payload, ...arr].slice(0, 200))
      } catch {}
    })

    es.addEventListener('error', () => {
      setError('SSE disconnected (network/auth).')
    })

    return () => es.close()
  }, [ready, apiBase, token])

  const snapshot = state?.snapshot
  const health = snapshot?.health
  const presence = snapshot?.presence || []

  // Channels (from snapshot.health)
  const channels = health?.channels || {}
  const channelOrder = health?.channelOrder || Object.keys(channels)

  // Sessions (from snapshot.health)
  const sessions = health?.sessions?.recent || []

  // Agents (from snapshot.health)
  const agents = health?.agents || []

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: 16, fontFamily: 'ui-sans-serif, system-ui', background: '#f6f7fb', minHeight: '100vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>OpenClaw Web Dashboard</div>
          <div style={{ opacity: 0.75 }}>Event-driven via SSE. No browser polling.</div>
        </div>
        <div style={{ fontSize: 12, opacity: 0.7, textAlign: 'right' }}>
          <div>API: {apiBase || '(unset)'}</div>
          <div>stateVersion: {state?.stateVersion ? JSON.stringify(state.stateVersion) : '(n/a)'}</div>
        </div>
      </div>

      <Settings apiBase={apiBase} token={token} setApiBase={setApiBase} setToken={setToken} onSave={saveSettings} />

      {error && (
        <div style={{ background: '#2a0f14', border: '1px solid #6b1a2b', color: '#fff', padding: 12, borderRadius: 10, marginBottom: 12 }}>
          <b>Error:</b> {error}
        </div>
      )}

      {!ready && (
        <div style={{ opacity: 0.7, marginBottom: 12 }}>
          Add API base + token above, then click Save.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 12 }}>
        <div style={{ gridColumn: 'span 6' }}>
          <Card title="Service">
            <KV k="connected" v={String(state?.connected ?? '(loading)')} />
            <KV k="connectedAt" v={state?.connectedAt || ''} />
            <KV k="lastEventAt" v={state?.lastEventAt || ''} />
            <KV k="seq" v={state?.seq ?? ''} />
          </Card>
        </div>

        <div style={{ gridColumn: 'span 6' }}>
          <Card title="Gateway snapshot">
            <KV k="uptimeMs" v={snapshot?.uptimeMs ?? ''} />
            <KV k="configPath" v={snapshot?.configPath || ''} />
            <KV k="stateDir" v={snapshot?.stateDir || ''} />
            <KV k="heartbeat" v={health?.heartbeatSeconds ? `${health.heartbeatSeconds}s` : ''} />
          </Card>
        </div>

        <div style={{ gridColumn: 'span 6' }}>
          <Card title="Channels">
            {channelOrder.length === 0 ? (
              <div style={{ opacity: 0.7 }}>No channel data yet…</div>
            ) : (
              channelOrder.map((key) => {
                const ch = channels[key]
                if (!ch) return null
                const linked = ch.linked ? 'linked' : 'not-linked'
                const running = ch.running ? 'running' : 'stopped'
                const connected = ch.connected ? 'connected' : 'disconnected'
                const self = ch?.self?.e164 || ''
                return (
                  <div key={key} style={{ padding: '8px 0', borderBottom: '1px solid #eee' }}>
                    <div style={{ fontWeight: 700 }}>{key}{self ? ` (${self})` : ''}</div>
                    <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: 12, opacity: 0.85 }}>
                      {linked} · {running} · {connected} {ch.authAgeMs != null ? `· authAge ${fmtAgeMs(ch.authAgeMs)}` : ''}
                      {ch.lastError ? `\nerror: ${ch.lastError}` : ''}
                    </div>
                  </div>
                )
              })
            )}
          </Card>
        </div>

        <div style={{ gridColumn: 'span 6' }}>
          <Card title="Agents">
            {agents.length === 0 ? (
              <div style={{ opacity: 0.7 }}>No agent data yet…</div>
            ) : (
              agents.map((a) => (
                <div key={a.agentId} style={{ padding: '8px 0', borderBottom: '1px solid #eee' }}>
                  <div style={{ fontWeight: 700 }}>{a.agentId}{a.isDefault ? ' (default)' : ''}</div>
                  <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: 12, opacity: 0.85 }}>
                    sessions: {a?.sessions?.count ?? '?'} · heartbeat: {a?.heartbeat?.enabled ? 'on' : 'off'} {a?.heartbeat?.every || ''}
                  </div>
                </div>
              ))
            )}
          </Card>
        </div>

        <div style={{ gridColumn: 'span 8' }}>
          <Card title="Sessions (recent)">
            {sessions.length === 0 ? (
              <div style={{ opacity: 0.7 }}>No sessions yet…</div>
            ) : (
              <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: 12 }}>
                {sessions.map((s, i) => (
                  <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid #eee' }}>
                    <div style={{ fontWeight: 700 }}>{s.key || String(s)}</div>
                    {s.updatedAt ? (
                      <div style={{ opacity: 0.75 }}>updatedAt: {s.updatedAt} · age: {fmtAgeMs(s.age)}</div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div style={{ gridColumn: 'span 4' }}>
          <Card title="Presence">
            <div style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: 12 }}>
              {presence.length === 0 ? (
                <div style={{ opacity: 0.7 }}>No presence yet…</div>
              ) : (
                presence.map((p, i) => (
                  <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid #eee' }}>
                    <div style={{ fontWeight: 700 }}>{p.host || '(host?)'}</div>
                    <div style={{ opacity: 0.75 }}>{p.mode || ''} {p.ip ? `· ${p.ip}` : ''}</div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div style={{ gridColumn: 'span 12' }}>
          <Card title="Live events (latest 200)">
            {events.length === 0 ? (
              <div style={{ opacity: 0.7 }}>Waiting for events…</div>
            ) : (
              <div style={{ maxHeight: 360, overflow: 'auto', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: 12 }}>
                {events.map((e, i) => (
                  <pre key={i} style={{ margin: 0, padding: '8px 0', borderBottom: '1px solid #eee' }}>{JSON.stringify(e, null, 2)}</pre>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div style={{ gridColumn: 'span 12', fontSize: 12, opacity: 0.7, paddingTop: 4 }}>
          Tip: For GitHub Pages, keep this site private-by-network: use Tailscale on the viewing device and set API base to your desktop tailnet IP (e.g. http://100.122.77.97:8787).
        </div>
      </div>
    </div>
  )
}
