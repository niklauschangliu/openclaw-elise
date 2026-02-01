import { useEffect, useMemo, useState } from 'react'
import {
  ActionIcon,
  AppShell,
  Badge,
  Button,
  Card,
  Container,
  Divider,
  Group,
  Modal,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  Tooltip,
} from '@mantine/core'
import { IconPlugConnected, IconPlugConnectedX, IconSettings, IconShieldLock } from '@tabler/icons-react'

// Notion-ish dark: clean, quiet, high readability.
// Security: avoid accidental public exposure. Sensitive fields are hidden by default.

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

function sanitizeBase(v) {
  return (v || '').trim().replace(/\/$/, '')
}

export default function App() {
  const [apiBase, setApiBase] = useState(localStorage.getItem(LS_API_BASE) || '')
  const [token, setToken] = useState(localStorage.getItem(LS_TOKEN) || '')

  const [state, setState] = useState(null)
  const [events, setEvents] = useState([])
  const [error, setError] = useState(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const ready = useMemo(() => Boolean(apiBase) && Boolean(token), [apiBase, token])

  function saveSettings() {
    localStorage.setItem(LS_API_BASE, sanitizeBase(apiBase))
    localStorage.setItem(LS_TOKEN, token.trim())
    setError(null)
    setSettingsOpen(false)
    window.location.reload()
  }

  useEffect(() => {
    if (!ready) return

    const base = sanitizeBase(apiBase)
    const t = token.trim()

    fetch(`${base}/state?token=${encodeURIComponent(t)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`GET /state failed: ${r.status}`)
        return r.json()
      })
      .then(setState)
      .catch((e) => setError(String(e.message || e)))

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

  const channels = health?.channels || {}
  const channelOrder = health?.channelOrder || Object.keys(channels)
  const sessions = health?.sessions?.recent || []
  const agents = health?.agents || []

  const connected = Boolean(state?.connected)
  const redacted = state?.redacted !== false

  const statusDot = connected ? (
    <Badge leftSection={<IconPlugConnected size={14} />} color="teal" variant="light">Connected</Badge>
  ) : (
    <Badge leftSection={<IconPlugConnectedX size={14} />} color="red" variant="light">Disconnected</Badge>
  )

  return (
    <AppShell header={{ height: 56 }} padding="md">
      <AppShell.Header>
        <Container size="lg" h="100%">
          <Group justify="space-between" h="100%">
            <Group gap="sm">
              <Title order={3}>OpenClaw</Title>
              <Text c="dimmed" size="sm">Dashboard</Text>
              {statusDot}
              {redacted && (
                <Tooltip label="Sensitive fields are redacted by default." withArrow>
                  <Badge leftSection={<IconShieldLock size={14} />} color="gray" variant="light">Redacted</Badge>
                </Tooltip>
              )}
            </Group>

            <Group gap="sm">
              <Text c="dimmed" size="xs">API: {sanitizeBase(apiBase) || '(unset)'}</Text>
              <ActionIcon variant="subtle" onClick={() => setSettingsOpen(true)} aria-label="settings">
                <IconSettings size={18} />
              </ActionIcon>
            </Group>
          </Group>
        </Container>
      </AppShell.Header>

      <AppShell.Main>
        <Container size="lg">
          <Modal opened={settingsOpen || !ready} onClose={() => setSettingsOpen(false)} title="Connect" centered>
            <Stack gap="sm">
              <Text c="dimmed" size="sm">
                Stored in your browser only. The site is public, so do not paste anything you don't want to leak.
              </Text>
              <TextInput
                label="API base"
                placeholder="http://100.122.77.97:8787"
                value={apiBase}
                onChange={(e) => setApiBase(e.target.value)}
              />
              <TextInput
                label="Token"
                placeholder="dashboard token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
              <Group justify="flex-end">
                <Button onClick={saveSettings}>Save</Button>
              </Group>
            </Stack>
          </Modal>

          {error && (
            <Card withBorder mt="md" bg="dark.8">
              <Text c="red">{error}</Text>
            </Card>
          )}

          <Group mt="md" grow align="stretch">
            <Card withBorder>
              <Text c="dimmed" size="xs">Gateway</Text>
              <Title order={4}>{connected ? 'Up' : 'Down'}</Title>
              <Text c="dimmed" size="sm">lastEvent: {state?.lastEventAt || '—'}</Text>
            </Card>
            <Card withBorder>
              <Text c="dimmed" size="xs">Channels</Text>
              <Title order={4}>{channelOrder.length}</Title>
              <Text c="dimmed" size="sm">configured: {Object.keys(channels).length}</Text>
            </Card>
            <Card withBorder>
              <Text c="dimmed" size="xs">Sessions</Text>
              <Title order={4}>{health?.sessions?.count ?? sessions.length ?? 0}</Title>
              <Text c="dimmed" size="sm">recent: {sessions.length}</Text>
            </Card>
            <Card withBorder>
              <Text c="dimmed" size="xs">Agents</Text>
              <Title order={4}>{agents.length}</Title>
              <Text c="dimmed" size="sm">heartbeat: {health?.heartbeatSeconds ? `${health.heartbeatSeconds}s` : '—'}</Text>
            </Card>
          </Group>

          <Group mt="md" align="stretch" grow>
            <Card withBorder style={{ flex: 2 }}>
              <Group justify="space-between" mb="xs">
                <Title order={5}>Channels</Title>
                <Text c="dimmed" size="xs">Real-time (SSE)</Text>
              </Group>
              <Divider mb="sm" />
              <Table striped highlightOnHover withTableBorder withColumnBorders>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Channel</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Details</Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {channelOrder.map((k) => {
                    const ch = channels[k]
                    if (!ch) return null
                    const status = [
                      ch.linked ? ['linked', 'teal'] : ['not linked', 'gray'],
                      ch.running ? ['running', 'teal'] : ['stopped', 'yellow'],
                      ch.connected ? ['connected', 'teal'] : ['disconnected', 'red'],
                    ]
                    return (
                      <Table.Tr key={k}>
                        <Table.Td>
                          <Text fw={600}>{k}</Text>
                        </Table.Td>
                        <Table.Td>
                          <Group gap={6}>
                            {status.map(([label, color]) => (
                              <Badge key={label} color={color} variant="light">{label}</Badge>
                            ))}
                          </Group>
                        </Table.Td>
                        <Table.Td>
                          <Text size="sm" c="dimmed">
                            {ch.authAgeMs != null ? `authAge ${fmtAgeMs(ch.authAgeMs)}` : ''}
                            {ch.lastError ? ` · error` : ''}
                          </Text>
                        </Table.Td>
                      </Table.Tr>
                    )
                  })}
                </Table.Tbody>
              </Table>
            </Card>

            <Card withBorder style={{ flex: 1 }}>
              <Title order={5} mb="xs">Sessions (recent)</Title>
              <Divider mb="sm" />
              <Stack gap={8}>
                {sessions.length === 0 ? (
                  <Text c="dimmed" size="sm">No sessions yet…</Text>
                ) : (
                  sessions.map((s, i) => (
                    <Card key={i} withBorder radius="md" p="sm">
                      <Text fw={600} size="sm" style={{ overflowWrap: 'anywhere' }}>{s.key || String(s)}</Text>
                      <Text c="dimmed" size="xs">age: {fmtAgeMs(s.age)}</Text>
                    </Card>
                  ))
                )}
              </Stack>
            </Card>
          </Group>

          <Card withBorder mt="md">
            <Group justify="space-between" mb="xs">
              <Title order={5}>Live events</Title>
              <Text c="dimmed" size="xs">Latest {events.length}/200</Text>
            </Group>
            <Divider mb="sm" />
            <Stack gap={6}>
              {events.length === 0 ? (
                <Text c="dimmed" size="sm">Waiting for events…</Text>
              ) : (
                events.slice(0, 30).map((e, i) => (
                  <Card key={i} withBorder radius="md" p="sm" bg="dark.8">
                    <Text size="xs" c="dimmed">{e.event || e.type || 'event'}</Text>
                    <Text size="xs" style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace' }}>
                      {JSON.stringify(e).slice(0, 500)}{JSON.stringify(e).length > 500 ? '…' : ''}
                    </Text>
                  </Card>
                ))
              )}
            </Stack>

            <Text c="dimmed" size="xs" mt="sm">
              Security: the backend redacts sensitive snapshot fields by default. Full details require local/tailnet + ?full=1.
            </Text>
          </Card>
        </Container>
      </AppShell.Main>
    </AppShell>
  )
}
