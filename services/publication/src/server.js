require('dotenv').config();
const app = require('./app');
const { logger } = require('@rh/shared');

const PORT = process.env.PORT || 5006;

app.listen(PORT, () => {
  logger.info(`Publication service running on port ${PORT}`);
});
