module.exports = {
  apps: [{
    name: 'PapaBot',
    script: 'index.js',
    // Options reference: https://pm2.io/doc/en/runtime/reference/ecosystem-file/
    instances: 1,
    autorestart: true,
    watch: true,
    max_memory_restart: '1G',
    kill_timeout: 1600
  }]
};