module.exports = {
  apps: [
    {
      name: 'cold-email-bot',
      script: 'dist/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'info'
      },
      env_development: {
        NODE_ENV: 'development',
        LOG_LEVEL: 'debug',
        DEBUG_MODE: 'true'
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true,
      merge_logs: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 4000,
      kill_timeout: 5000,
      listen_timeout: 3000,
      shutdown_with_message: true,
      wait_ready: true,
      // Health monitoring
      health_check_grace_period: 3000,
      // Process monitoring
      pmx: true,
      // Auto restart on file changes (development only)
      watch: process.env.NODE_ENV === 'development' ? ['dist'] : false,
      ignore_watch: ['node_modules', 'logs', 'backups'],
      // Advanced error handling
      node_args: [
        '--max-old-space-size=1024',
        '--unhandled-rejections=strict'
      ],
      // Logging configuration
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Environment-specific configurations
      env_production: {
        NODE_ENV: 'production',
        LOG_LEVEL: 'warn',
        DEBUG_MODE: 'false'
      }
    }
  ],

  deploy: {
    production: {
      user: 'node',
      host: 'your-server.com',
      ref: 'origin/main',
      repo: 'git@github.com:your-repo/cold-email-bot.git',
      path: '/var/www/cold-email-bot',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};
