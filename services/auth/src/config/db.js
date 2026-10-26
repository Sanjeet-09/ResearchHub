const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

// Load environment variables safely in non-production
if (process.env.NODE_ENV !== 'production') {
  try {
    require('dotenv').config();
    require('dotenv').config({ path: path.join(__dirname, '../../../../.env') });
    require('dotenv').config({ path: path.join(__dirname, '../../../.env') });
  } catch (_) {}
}

// Fallback search candidate secrets files if DATABASE_URL is unset
if (!process.env.DATABASE_URL) {
  const candidateFiles = [
    path.join(__dirname, '../../../../secrets.txt'),
    path.join(__dirname, '../../../../secretes.txt'),
    path.join(__dirname, '../../../../.env'),
    path.join(__dirname, '../../../.env'),
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
const isCloudHost = Boolean(
  process.env.DATABASE_URL &&
  (process.env.DATABASE_URL.includes('supabase.co') || process.env.DATABASE_URL.includes('supabase.com') || process.env.DATABASE_URL.includes('sslmode=require'))
);

// Cloud databases (Supabase, AWS RDS, Cloud SQL) require SSL with rejectUnauthorized: false
const ssl = process.env.DB_SSL === 'false'
  ? false
  : (isProduction || isCloudHost || process.env.DB_SSL === 'true'
      ? { rejectUnauthorized: false }
      : false);

let connStr = process.env.DATABASE_URL;
if (connStr) {
  try {
    const u = new URL(connStr);
    u.searchParams.delete('sslmode');
    connStr = u.toString();
  } catch (_) {
    connStr = connStr.replace(/[?&]sslmode=[^&]+/g, '').replace(/\?&/, '?').replace(/\?$/, '');
  }
}

const pool = new Pool({
  connectionString: connStr || process.env.DATABASE_URL,
  ssl,
  max: parseInt(process.env.DB_MAX_POOL || '20', 10),
  idleTimeoutMillis: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.DB_CONNECT_TIMEOUT || '10000', 10),
});

pool.on('error', (err) => {
  console.error('Unexpected database client error in auth service pool:', {
    message: err.message,
    code: err.code,
    stack: err.stack,
  });
});

const query = (text, params) => {
  // If running in unit test environment with jest mock on @rh/shared, respect the mock
  try {
    const shared = require('@rh/shared');
    if (shared && shared.query && shared.query._isMockFunction) {
      return shared.query(text, params);
    }
  } catch (_) {}
  return pool.query(text, params);
};

module.exports = {
  pool,
  query,
};
