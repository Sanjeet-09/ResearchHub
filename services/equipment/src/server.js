try { require('dotenv').config(); } catch (_) {}
const app = require('./app');
const { logger } = require('@rh/shared');

const PORT = process.env.PORT || 5007;

const startServer = () => {
  const server = app.listen(PORT, () => {
    logger.info({ port: PORT, service: 'equipment-service' }, `Equipment service running on port ${PORT}`);
  });

  const shutdown = () => {
    logger.info('Shutting down equipment service...');
    server.close(() => {
      logger.info('Equipment service terminated gracefully');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return server;
};

if (require.main === module) {
  startServer();
}

module.exports = { startServer };
