import express from 'express';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';
import { readFileSync, existsSync, readdirSync } from 'fs';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PROJECT_ROOT = resolve(__dirname, '..');
dotenv.config({ path: join(PROJECT_ROOT, '.env') });

const app = express();
const PORT = 3001;
const CLAUDE_BIN = join(__dirname, 'node_modules', '@anthropic-ai', 'claude-code', 'bin', 'claude.exe');
const JOBS_DATA_PATH = join(PROJECT_ROOT, 'scripts', 'jobs-data.json');
const OUTPUT_DIR = join(PROJECT_ROOT, 'output');

app.use(express.json());

// ── GET /api/jobs ─────────────────────────────────────────────────────────────
app.get('/api/jobs', (req, res) => {
  if (!existsSync(JOBS_DATA_PATH)) return res.json([]);
  try {
    res.json(JSON.parse(readFileSync(JOBS_DATA_PATH, 'utf8')));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/files/:company ───────────────────────────────────────────────────
app.get('/api/files/:company', (req, res) => {
  const companyDir = join(OUTPUT_DIR, req.params.company);
  if (!existsSync(companyDir)) return res.json([]);
  const files = readdirSync(companyDir).filter(f => f.endsWith('.docx'));
  res.json(files);
});

// ── GET /api/download/:company/:filename ──────────────────────────────────────
app.get('/api/download/:company/:filename', (req, res) => {
  const filePath = join(OUTPUT_DIR, req.params.company, req.params.filename);
  if (!existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  res.download(filePath);
});

// ── Shared SSE helper: spawns claude and streams stream-json to the response ──
function streamClaude(prompt, req, res) {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  req.socket.setTimeout(0);
  res.socket?.setTimeout(0);
  res.flushHeaders();

  const send = (d) => {
    if (!res.writableEnded) res.write(`data: ${JSON.stringify(d)}\n\n`);
  };

  const proc = spawn(
    CLAUDE_BIN,
    ['--print', '--output-format', 'stream-json', '--dangerously-skip-permissions', prompt],
    { cwd: PROJECT_ROOT, env: process.env, windowsHide: true }
  );

  req.on('close', () => { if (!proc.killed) proc.kill(); });

  let buf = '';

  proc.stdout.on('data', (chunk) => {
    buf += chunk.toString('utf8');
    const lines = buf.split('\n');
    buf = lines.pop();
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      try { send(JSON.parse(t)); } catch { send({ type: 'system', text: t }); }
    }
  });

  proc.stderr.on('data', (chunk) => {
    const text = chunk.toString('utf8').trim();
    if (text) send({ type: 'system', text });
  });

  proc.on('close', (code) => {
    if (buf.trim()) {
      try { send(JSON.parse(buf.trim())); } catch {}
    }
    send(code === 0 || code === null ? { type: 'done' } : { type: 'error', error: `Exit code ${code}` });
    if (!res.writableEnded) res.end();
  });

  proc.on('error', (e) => {
    send({ type: 'error', error: e.message });
    if (!res.writableEnded) res.end();
  });
}

// ── POST /api/search-jobs (SSE) ───────────────────────────────────────────────
app.post('/api/search-jobs', (req, res) => {
  const { keyword } = req.body;
  const prompt = keyword?.trim()
    ? `/search-job-posting ${keyword.trim()}`
    : '/search-job-posting';
  streamClaude(prompt, req, res);
});

// ── POST /api/apply (SSE) ─────────────────────────────────────────────────────
app.post('/api/apply', (req, res) => {
  streamClaude('/update-resume-and-cover-letter', req, res);
});

// ── Serve built client in production ──────────────────────────────────────────
const clientDist = join(__dirname, 'client', 'dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => res.sendFile(join(clientDist, 'index.html')));
}

app.listen(PORT, () => {
  console.log(`\n✅ Job Search Dashboard API → http://localhost:${PORT}`);
  console.log('   Dev mode: open http://localhost:5173 (Vite)\n');
});
