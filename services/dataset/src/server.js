if (process.env.NODE_ENV !== 'production') {
  try { require('dotenv').config(); } catch (_) {}
}
const app = require('./app');
const { logger } = require('@rh/shared');

const PORT = process.env.PORT || 5004;

app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Dataset service running on port ${PORT}`);
});
