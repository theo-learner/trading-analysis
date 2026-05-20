module.exports = {
  apps: [
    {
      name: 'trading-dashboard',
      script: 'scripts/dashboard-server.js',
      cwd: '/home/theo/dev/trading-analysis',
      watch: false,
      restart_delay: 3000,
      max_restarts: 10,
      env: {
        PORT: 3210,
        NODE_ENV: 'production',
      },
    },
  ],
};
