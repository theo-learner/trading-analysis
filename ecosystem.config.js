module.exports = {
  apps: [
    {
      name: 'trading-dashboard',
      script: 'scripts/dashboard-server.js',
      cwd: '/home/theo/dev/trading-analysis',
      watch: false,
      autorestart: false,
      restart_delay: 2000,
      max_restarts: 0,
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
  ],
};
