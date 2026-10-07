const path = require('node:path');

// Copy the project to /www/bayside-city/app; keep data outside that directory.
module.exports = {
  apps: [{
    name: 'bayside-city',
    cwd: path.resolve(__dirname, '../..'),
    script: 'server.mjs',
    exec_mode: 'fork',
    instances: 1,
    autorestart: true,
    restart_delay: 1500,
    min_uptime: '10s',
    max_restarts: 10,
    kill_timeout: 15000,
    time: true,
    env: {
      NODE_ENV: 'production',
      HOST: '127.0.0.1',
      PORT: '4173',
      PUBLIC_ORIGIN: 'https://city.yunyousl.com.cn',
      COOP_DB: '/www/bayside-data/cities.sqlite',
      COOP_BACKUP_DIR: '/www/bayside-backups',
    },
  }],
};
