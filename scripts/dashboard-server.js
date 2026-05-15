#!/usr/bin/env node
/**
 * dashboard-server.js — ICT 트레이딩 대시보드 로컬 서버
 *
 * 의존성: Node.js 내장 모듈만 사용 (no npm install 필요)
 * 실행: node scripts/dashboard-server.js
 * URL:  http://localhost:3210
 *
 * REST API:
 *   GET  /api/trades          — trades/dry-run/*.json 목록
 *   GET  /api/signals         — signals/*.json 최신 10개
 *   GET  /api/config          — scripts/config/ict-engine.json
 *   POST /api/analyze         — ict-engine.js 파이프라인 실행 (spawn)
 *   GET  /api/events          — SSE: 신규 거래 발생 시 push
 */

'use strict';

const http    = require('http');
const fs      = require('fs');
const path    = require('path');
const { spawn, execSync } = require('child_process');

const PORT    = 3210;
const ROOT    = path.resolve(__dirname, '..');
const DASH_DIR = path.join(__dirname, 'dashboard');

// ── MIME 타입 ────────────────────────────────────────────────────────────────
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
};

// ── SSE 클라이언트 목록 ──────────────────────────────────────────────────────
const sseClients = new Set();

function pushSSE(eventName, data) {
  const msg = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try { res.write(msg); } catch (_) { sseClients.delete(res); }
  }
}

// ── 파일 감시: trades/dry-run 에 새 파일 추가되면 SSE push ──────────────────
const DRY_RUN_DIR = path.join(ROOT, 'trades', 'dry-run');
fs.mkdirSync(DRY_RUN_DIR, { recursive: true });
fs.watch(DRY_RUN_DIR, (event, filename) => {
  if (event === 'rename' && filename && filename.endsWith('.json')) {
    const fp = path.join(DRY_RUN_DIR, filename);
    setTimeout(() => {
      try {
        const trade = JSON.parse(fs.readFileSync(fp, 'utf8'));
        pushSSE('trade', trade);
      } catch (_) {}
    }, 200);
  }
});

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────
function readJSON(fp) {
  try { return JSON.parse(fs.readFileSync(fp, 'utf8')); }
  catch (_) { return null; }
}

function readDirJSON(dir, limit = 50) {
  fs.mkdirSync(dir, { recursive: true });
  return fs.readdirSync(dir)
    .filter(f => f.endsWith('.json'))
    .sort().reverse().slice(0, limit)
    .map(f => ({ file: f, ...readJSON(path.join(dir, f)) }))
    .filter(Boolean);
}

function jsonResponse(res, data, status = 200) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', c => (data += c));
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); }
      catch (_) { resolve({}); }
    });
    req.on('error', reject);
  });
}

// ── 실행 중인 분석 프로세스 추적 ─────────────────────────────────────────────
let analyzeProc = null;
let analyzeLog  = [];

// ── 라우터 ───────────────────────────────────────────────────────────────────
async function handleRequest(req, res) {
  const url  = new URL(req.url, `http://localhost:${PORT}`);
  const pathname = url.pathname;

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' });
    return res.end();
  }

  // ── SSE ──────────────────────────────────────────────────────────────────
  if (pathname === '/api/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });
    res.write(': connected\n\n');
    sseClients.add(res);
    req.on('close', () => sseClients.delete(res));
    return;
  }

  // ── GET /api/trades ───────────────────────────────────────────────────────
  if (req.method === 'GET' && pathname === '/api/trades') {
    const trades = readDirJSON(DRY_RUN_DIR);
    return jsonResponse(res, trades);
  }

  // ── GET /api/signals ─────────────────────────────────────────────────────
  if (req.method === 'GET' && pathname === '/api/signals') {
    const sigDir = path.join(ROOT, 'signals');
    const signals = readDirJSON(sigDir, 10);
    return jsonResponse(res, signals);
  }

  // ── GET /api/config ───────────────────────────────────────────────────────
  if (req.method === 'GET' && pathname === '/api/config') {
    const cfg = readJSON(path.join(ROOT, 'scripts', 'config', 'ict-engine.json'));
    return jsonResponse(res, cfg || {});
  }

  // ── GET /api/analyze-log ─────────────────────────────────────────────────
  if (req.method === 'GET' && pathname === '/api/analyze-log') {
    return jsonResponse(res, {
      running: analyzeProc !== null,
      log: analyzeLog.slice(-100),
    });
  }

  // ── POST /api/analyze ─────────────────────────────────────────────────────
  if (req.method === 'POST' && pathname === '/api/analyze') {
    if (analyzeProc) {
      return jsonResponse(res, { ok: false, message: '분석이 이미 실행 중입니다.' }, 409);
    }

    const body = await readBody(req);
    const pair  = body.pair  || 'BTCUSDT';
    const tf    = body.tf    || '1H';
    const scriptPath = path.join(__dirname, 'ict-engine.js');

    analyzeLog = [];
    analyzeProc = spawn('node', [scriptPath, '--pair', pair, '--tf', tf], {
      cwd: ROOT,
      env: { ...process.env, LOG_LEVEL: 'DEBUG' },
    });

    analyzeProc.stdout.on('data', d => {
      const lines = d.toString().split('\n').filter(Boolean);
      analyzeLog.push(...lines);
      pushSSE('log', { lines });
    });
    analyzeProc.stderr.on('data', d => {
      const lines = d.toString().split('\n').filter(Boolean);
      analyzeLog.push(...lines);
      pushSSE('log', { lines });
    });
    analyzeProc.on('close', code => {
      pushSSE('analyze-done', { code, pair, tf });
      analyzeProc = null;
    });

    return jsonResponse(res, { ok: true, message: `분석 시작: ${pair} ${tf}` });
  }

  // ── POST /api/trades ─────────────────────────────────────────────────────
  if (req.method === 'POST' && pathname === '/api/trades') {
    const body = await readBody(req);
    const signal = body.signal;
    if (!signal || !signal.pair) {
      return jsonResponse(res, { ok: false, message: '시그널 데이터 누락' }, 400);
    }
    const trade = {
      ...signal,
      status: 'dry-run',
      savedAt: new Date().toISOString(),
      pnl: null,
    };
    const isoSafe = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${signal.pair}_${isoSafe}.json`;
    const fp = path.join(DRY_RUN_DIR, filename);
    fs.writeFileSync(fp, JSON.stringify(trade, null, 2));
    return jsonResponse(res, { ok: true, filename });
  }

  // ── GET /api/latest-signal ────────────────────────────────────────────────
  if (req.method === 'GET' && pathname === '/api/latest-signal') {
    const sigDir = path.join(ROOT, 'signals');
    const pair   = url.searchParams.get('pair') || 'BTCUSDT';
    try {
      fs.mkdirSync(sigDir, { recursive: true });
      const files = fs.readdirSync(sigDir)
        .filter(f => f.includes(pair) && f.endsWith('.json'))
        .sort().reverse();
      if (!files.length) return jsonResponse(res, null);
      const signal = readJSON(path.join(sigDir, files[0]));
      return jsonResponse(res, signal);
    } catch (_) {
      return jsonResponse(res, null);
    }
  }

  // ── 정적 파일 서빙 ────────────────────────────────────────────────────────
  let filePath;
  if (pathname === '/' || pathname === '') {
    filePath = path.join(DASH_DIR, 'index.html');
  } else {
    filePath = path.join(DASH_DIR, pathname);
  }

  // path traversal 방어
  if (!filePath.startsWith(DASH_DIR)) {
    res.writeHead(403); return res.end('Forbidden');
  }

  try {
    const data = fs.readFileSync(filePath);
    const ext  = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    return res.end(data);
  } catch (_) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    return res.end('Not found');
  }
}

// ── 서버 시작 ─────────────────────────────────────────────────────────────────
const server = http.createServer((req, res) => {
  handleRequest(req, res).catch(err => {
    console.error('Request error:', err);
    try { res.writeHead(500); res.end('Internal Server Error'); } catch (_) {}
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n🚀 ICT 트레이딩 대시보드 시작됨`);
  console.log(`   URL: http://localhost:${PORT}`);
  console.log(`   종료: Ctrl+C\n`);
  // macOS에서 자동으로 브라우저 열기
  try { execSync(`open http://localhost:${PORT}`); } catch (_) {}
});

server.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error(`포트 ${PORT}가 이미 사용 중입니다. 기존 프로세스를 종료하거나 PORT 환경변수를 변경하세요.`);
  } else {
    console.error('서버 오류:', err);
  }
  process.exit(1);
});
