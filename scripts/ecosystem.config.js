'use strict';

module.exports = {
  apps: [
    {
      name: 'ict-watcher',
      script: 'scripts/watcher.js',
      cron_restart: '*/1 * * * *',
      autorestart: false,
      time: true,
      env: { TELEGRAM_NOTIFY: '1' },
    },
  ],
};
