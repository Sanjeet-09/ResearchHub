const { Pool } = require('pg');
const logger = require('./logger');

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:postgrespassword@localhost:5432/researchhub';

const pool = new Pool({
  connectionString,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected database client error');
});

const query = (text, params) => pool.query(text, params);

module.exports = {
  pool,
  query,
};
