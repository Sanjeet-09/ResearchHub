const app = require('./app');
const { logger } = require('@rh/shared');

const PORT = process.env.PORT || 5002;

app.listen(PORT, () => {
  logger.info(`Project service running on port ${PORT}`);
});
