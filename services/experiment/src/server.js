require('dotenv').config();
const app = require('./app');
const { logger } = require('@rh/shared');

const PORT = process.env.PORT || 5003;

app.listen(PORT, () => {
  logger.info(`Experiment service running on port ${PORT}`);
});
