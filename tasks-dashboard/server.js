import express from 'express';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';

const execFileAsync = promisify(execFile);

const app = express();

const PORT = Number(process.env.PORT || 3099);
const HOST = process.env.HOST || '127.0.0.1';

async function runOpenClawJson(args) {
  // Use cmd.exe to avoid PowerShell execution policy issues.
  const cmdArgs = ['/c', 'openclaw', ...args, '--json'];
  const { stdout } = await execFileAsync('cmd.exe', cmdArgs, {
    windowsHide: true,
    timeout: 15000,
    maxBuffer: 5 * 1024 * 1024,
  });
  return JSON.parse(stdout);
}

async function tryRun(fn) {
  try {
    return { ok: true, data: await fn() };
  } catch (err) {
    return {
      ok: false,
      error: {
        message: String(err?.message || err),
        // stderr is often embedded in message; keep small.
      },
    };
  }
}

app.use(express.static(new URL('./static', import.meta.url).pathname));

app.get('/api/state', async (_req, res) => {
  const [status, channels, cronStatus, cronJobs] = await Promise.all([
    tryRun(() => runOpenClawJson(['status', '--all'])),
    tryRun(() => runOpenClawJson(['channels', 'status'])),
    tryRun(() => runOpenClawJson(['cron', 'status'])),
    tryRun(() => runOpenClawJson(['cron', 'list', '--all'])),
  ]);

  res.json({
    generatedAt: new Date().toISOString(),
    host: os.hostname(),
    platform: `${process.platform} ${os.release()}`,
    status,
    channels,
    cronStatus,
    cronJobs,
  });
});

app.listen(PORT, HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`OpenClaw Tasks Dashboard running at http://${HOST}:${PORT}`);
  console.log('Tip: set HOST=0.0.0.0 to allow LAN access (be careful).');
});
