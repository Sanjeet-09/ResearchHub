const fs = require('fs');
const path = require('path');
const { pool } = require('../shared/src/db');

async function initDb() {
  console.log('Connecting to PostgreSQL database...');
  let client;
  try {
    client = await pool.connect();
    console.log('[OK] Connected to database');

    const runSqlFile = async (relPath, label) => {
      console.log(`Applying ${label}...`);
      const fullPath = path.join(__dirname, '..', relPath);
      const sql = fs.readFileSync(fullPath, 'utf8');
      await client.query(sql);
      console.log(`[OK] ${label} applied successfully`);
    };

    await runSqlFile('db/migrations/001_init.sql', '001_init.sql (Core Schema)');
    await runSqlFile('db/migrations/002_lab.sql', '002_lab.sql (Lab Schema)');
    await runSqlFile('db/seed.sql', 'seed.sql (Demo Users & Seed Data)');

    console.log('\n======================================================');
    console.log('Database successfully initialized and seeded.');
    console.log('======================================================\n');
  } catch (err) {
    console.error('\n[ERROR] Database initialization failed:', err.message);
    if (err.code === 'ECONNREFUSED') {
      console.error('Ensure your Docker PostgreSQL container is running on localhost:5432.');
    }
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end().catch(() => {});
  }
}

initDb();
