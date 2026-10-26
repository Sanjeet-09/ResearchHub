'use strict';

if (process.env.NODE_ENV !== 'production') {
  try { require('dotenv').config(); } catch (_) {}
}
const app = require('./app');
const logger = require('./logger');

const PORT = process.env.PORT || 5010;

const startServer = () => {
  const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info(
      { port: PORT, service: 'lab', driver: process.env.LAB_DRIVER || 'local' },
      `Lab Service running on port ${PORT}`
    );
  });

  const shutdown = () => {
    logger.info('Shutting down Lab Service...');
    server.close(() => {
      logger.info('Lab Service terminated gracefully');
      process.exit(0);
    });
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return server;
};

module.exports = { startServer };

if (require.main === module) {
  startServer();
}
