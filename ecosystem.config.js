const fs = require('fs');
const path = require('path');

function loadEnvFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8').split('\n').reduce((acc, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return acc;
      const eq = trimmed.indexOf('=');
      if (eq < 1) return acc;
      const key = trimmed.slice(0, eq).trim();
      const val = trimmed.slice(eq + 1).trim();
      if (val) acc[key] = val;
      return acc;
    }, {});
  } catch { return {}; }
}

const tradeEnv = loadEnvFile(path.join(__dirname, 'sessions', 'trade.env'));

module.exports = {
  apps: [
    {
      name: 'trading-dashboard',
      script: 'scripts/dashboard-server.js',
      cwd: '/home/theo/dev/trading-analysis',
      watch: false,
      autorestart: true,
      restart_delay: 2000,
      max_restarts: 10,
      env: {
        PORT: 3210,
        NODE_ENV: 'production',
      },
    },
    {
      name: 'ict-watcher',
      script: 'scripts/watcher.js',
      cwd: '/home/theo/dev/trading-analysis',
      watch: false,
      restart_delay: 5000,
      max_restarts: 20,
      env: {
        TELEGRAM_NOTIFY: '1',
        TRADING_LIVE: '1',
        NODE_ENV: 'production',
      },
    },
    {
      name: 'trades-sync',
      script: 'scripts/sync-trades-to-db.js',
      cwd: '/home/theo/dev/trading-analysis',
      watch: false,
      autorestart: false,
      cron_restart: '*/30 * * * *',
      env: {
        DATABASE_URL: tradeEnv.DATABASE_URL,
      },
    },
  ],
};
