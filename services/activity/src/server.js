if (process.env.NODE_ENV !== 'production') {
  try { require('dotenv').config(); } catch (_) {}
}
const app = require('./app');
const { logger } = require('@rh/shared');

const PORT = process.env.PORT || 5008;

const startServer = () => {
  const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info({ port: PORT, service: 'activity' }, `Activity Service running on port ${PORT}`);
  });

  const shutdown = () => {
    logger.info('Shutting down Activity Service...');
    server.close(() => {
      logger.info('Activity Service terminated gracefully');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return server;
};

module.exports = { startServer };
