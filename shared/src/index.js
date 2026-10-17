const db = require('./db');
const errors = require('./errors');
const logger = require('./logger');
const auth = require('./auth');
const storage = require('./storage');
const events = require('./events');

module.exports = {
  ...db,
  ...errors,
  logger,
  ...auth,
  ...storage,
  ...events,
};
