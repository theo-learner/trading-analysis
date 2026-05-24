module.exports = {
  apps: [{
    name: 'trades-sync',
    script: 'scripts/sync-trades-to-db.js',
    instances: 1,
    exec_mode: 'single',
    env: {
      DATABASE_URL: 'postgresql://postgres:[YOUR-PASSWORD]@db.jtjdmeippuocclilkpgz.supabase.co:5432/postgres'
    },
    cron_restart: '*/30 * * * *',
    autorestart: false,
    max_memory_restart: '100M'
  }]
};
