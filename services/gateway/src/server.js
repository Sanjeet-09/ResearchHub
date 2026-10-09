const app = require('./app');
const { logger } = require('@rh/shared');

const PORT = process.env.PORT || 5000;

const startServer = () => {
  const server = app.listen(PORT, () => {
    logger.info({ port: PORT, service: 'gateway' }, `API Gateway running on port ${PORT}`);
  });

  const shutdown = () => {
    logger.info('Shutting down API Gateway...');
    server.close(() => {
      logger.info('API Gateway terminated gracefully');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return server;
};

module.exports = { startServer };
