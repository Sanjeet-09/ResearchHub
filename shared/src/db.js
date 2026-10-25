const { Pool } = require('pg');
const path = require('path');
const logger = require('./logger');

// Load environment variables if available
try {
  require('dotenv').config();
  require('dotenv').config({ path: path.join(__dirname, '../../.env') });
  require('dotenv').config({ path: path.join(__dirname, '../.env') });
} catch (_) {}

const isProduction = process.env.NODE_ENV === 'production';
const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
const hasIndividualConfig = Boolean(process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME);

if (!hasDatabaseUrl && !hasIndividualConfig && isProduction) {
  throw new Error('FATAL: DATABASE_URL or DB_* environment variables are required in production');
}

// Enable SSL connection for cloud databases (e.g. Supabase, AWS RDS, Cloud SQL)
// If DATABASE_URL is set, enable { rejectUnauthorized: false } for cloud compatibility
const isCloudHost = Boolean(
  process.env.DB_HOST &&
  (process.env.DB_HOST.includes('supabase.co') || process.env.DB_HOST.includes('supabase.com'))
);

const ssl = process.env.DB_SSL === 'false'
  ? false
  : (process.env.DATABASE_URL
      ? { rejectUnauthorized: false }
      : (process.env.DB_SSL === 'true' || isCloudHost ? { rejectUnauthorized: false } : false));

// Build Pool options supporting either DATABASE_URL or DB_* individual variables
const poolConfig = {
  max: parseInt(process.env.DB_MAX_POOL || '20', 10),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECT_TIMEOUT || '10000', 10),
  ssl,
};

if (process.env.DATABASE_URL) {
  poolConfig.connectionString = process.env.DATABASE_URL;
} else {
  poolConfig.host = process.env.DB_HOST || 'localhost';
  poolConfig.port = parseInt(process.env.DB_PORT || '5432', 10);
  poolConfig.user = process.env.DB_USER || 'postgres';
  poolConfig.password = process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : 'postgrespassword';
  poolConfig.database = process.env.DB_NAME || 'researchhub';
}

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected database client error');
});

const query = (text, params) => pool.query(text, params);

module.exports = {
  pool,
  query,
  poolConfig,
};

