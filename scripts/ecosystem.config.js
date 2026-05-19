'use strict';

module.exports = {
  apps: [
    {
      name: 'ict-watcher',
      script: 'scripts/watcher.js',
      autorestart: true,
      time: true,
      env: { TELEGRAM_NOTIFY: '1' },
    },
  ],
};
