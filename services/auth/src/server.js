const app = require('./app');
const { logger } = require('@rh/shared');

const PORT = process.env.PORT || 5001;

const startServer = () => {
  const server = app.listen(PORT, () => {
    logger.info({ port: PORT, service: 'auth-service' }, `Auth service running on port ${PORT}`);
  });

  const shutdown = () => {
    logger.info('Shutting down auth service...');
    server.close(() => {
      logger.info('Auth service terminated gracefully');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return server;
};

module.exports = { startServer };
