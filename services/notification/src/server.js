const app = require('./app');
const { logger } = require('@rh/shared');

const PORT = process.env.PORT || 5009;

const startServer = () => {
  const server = app.listen(PORT, () => {
    logger.info({ port: PORT, service: 'notification' }, `Notification Service running on port ${PORT}`);
  });

  const shutdown = () => {
    logger.info('Shutting down Notification Service...');
    server.close(() => {
      logger.info('Notification Service terminated gracefully');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return server;
};

module.exports = { startServer };
