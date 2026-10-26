const { Pool } = require('pg');
const path = require('path');
const logger = require('./logger');

const fs = require('fs');

// Load environment variables if available
if (process.env.NODE_ENV !== 'production') {
  try {
    require('dotenv').config();
    require('dotenv').config({ path: path.join(__dirname, '../../.env') });
    require('dotenv').config({ path: path.join(__dirname, '../.env') });
  } catch (_) {}
}

// Fallback search candidate secrets files if DATABASE_URL is unset
if (!process.env.DATABASE_URL) {
  const candidateFiles = [
    path.join(__dirname, '../../secrets.txt'),
    path.join(__dirname, '../../secretes.txt'),
    path.join(__dirname, '../../.env'),
    path.join(__dirname, '../.env'),
  ];
  for (const cf of candidateFiles) {
    if (fs.existsSync(cf)) {
      try {
        const content = fs.readFileSync(cf, 'utf8');
        const lines = content.split(/\r?\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          if (trimmed.startsWith('postgresql://') || trimmed.startsWith('postgres://')) {
            process.env.DATABASE_URL = trimmed;
            break;
          }
          if (trimmed.startsWith('DATABASE_URL=')) {
            process.env.DATABASE_URL = trimmed.substring('DATABASE_URL='.length).trim().replace(/^["']|["']$/g, '');
            break;
          }
        }
        if (process.env.DATABASE_URL) break;
      } catch (_) {}
    }
  }
}

const isProduction = process.env.NODE_ENV === 'production';
const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
const hasIndividualConfig = Boolean(process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME);

if (!hasDatabaseUrl && !hasIndividualConfig && isProduction) {
  throw new Error('FATAL: DATABASE_URL or DB_* environment variables are required in production');
}

// Enable SSL connection for cloud databases (e.g. Supabase, AWS RDS, Cloud SQL)
const isCloudHost = Boolean(
  (process.env.DB_HOST && (process.env.DB_HOST.includes('supabase.co') || process.env.DB_HOST.includes('supabase.com'))) ||
  (process.env.DATABASE_URL && (process.env.DATABASE_URL.includes('supabase.co') || process.env.DATABASE_URL.includes('supabase.com') || process.env.DATABASE_URL.includes('sslmode=require')))
);

const ssl = process.env.DB_SSL === 'false'
  ? false
  : (isProduction || isCloudHost || process.env.DATABASE_URL || process.env.DB_SSL === 'true'
      ? { rejectUnauthorized: false }
      : false);

// Build Pool options supporting either DATABASE_URL or DB_* individual variables
const poolConfig = {
  max: parseInt(process.env.DB_MAX_POOL || '20', 10),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECT_TIMEOUT || '10000', 10),
  ssl,
};

if (process.env.DATABASE_URL) {
  let connStr = process.env.DATABASE_URL;
  try {
    const u = new URL(connStr);
    u.searchParams.delete('sslmode');
    connStr = u.toString();
  } catch (_) {
    connStr = connStr.replace(/[?&]sslmode=[^&]+/g, '').replace(/\?&/, '?').replace(/\?$/, '');
  }
  poolConfig.connectionString = connStr;
  if (process.env.DB_SSL !== 'false') {
    poolConfig.ssl = { rejectUnauthorized: false };
  }
} else {
  poolConfig.host = process.env.DB_HOST || 'localhost';
  poolConfig.port = parseInt(process.env.DB_PORT || '5432', 10);
  poolConfig.user = process.env.DB_USER || 'postgres';
  poolConfig.password = process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : 'postgrespassword';
  poolConfig.database = process.env.DB_NAME || 'researchhub';
}

const pool = new Pool(poolConfig);

pool.on('error', (err) => {
  logger.error({ err: { message: err.message, code: err.code, stack: err.stack } }, 'Unexpected database client error');
});

const query = (text, params) => pool.query(text, params);

module.exports = {
  pool,
  query,
  poolConfig,
};

