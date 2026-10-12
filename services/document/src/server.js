require('dotenv').config();
const app = require('./app');
const { logger } = require('@rh/shared');

const PORT = process.env.PORT || 5005;

app.listen(PORT, () => {
  logger.info(`Document service running on port ${PORT}`);
});
