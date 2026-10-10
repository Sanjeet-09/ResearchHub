require('dotenv').config();
const app = require('./app');
const { logger } = require('@rh/shared');

const PORT = process.env.PORT || 5004;

app.listen(PORT, () => {
  logger.info(`Dataset service running on port ${PORT}`);
});
