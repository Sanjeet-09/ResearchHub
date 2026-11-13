if (process.env.NODE_ENV !== 'production') {
  try { require('dotenv').config(); } catch (_) {}
}
const app = require('./app');
const { logger } = require('@rh/shared');

const PORT = process.env.PORT || 5000;

const startServer = () => {
  const server = app.listen(PORT, '0.0.0.0', () => {
    logger.info({ port: PORT, service: 'gateway' }, `API Gateway running on port ${PORT}`);
  });

  // Attach WebSocket upgrade handler for JupyterLab interactive kernels
  server.on('upgrade', (req, socket, head) => {
    if (req.url && req.url.includes('/proxy')) {
      if (app.jupyterProxy?._httpProxy) {
        app.jupyterProxy._httpProxy.ws(req, socket, head);
      } else if (typeof app.jupyterProxy?.upgrade === 'function') {
        app.jupyterProxy.upgrade(req, socket, head);
      }
    }
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
