// ==================================================================
// PM2 ECOSYSTEM CONFIGURATION - ANAF Upload Microservice
// ==================================================================

module.exports = {
  apps: [{
    name: 'anaf-upload',
    script: './server.js',
    instances: 2, // 2 instance pentru load balancing
    exec_mode: 'cluster',

    // Environment
    env: {
      NODE_ENV: 'production',
      PORT: 3001
    },

    // Restart policy
    autorestart: true,
    watch: false,
    max_memory_restart: '500M',

    // Logging
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,

    // Advanced features
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000,

    // Graceful shutdown
    kill_timeout: 5000,
    wait_ready: true,
    listen_timeout: 3000
  }]
};
