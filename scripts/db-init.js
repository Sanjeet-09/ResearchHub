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
      if (!fs.existsSync(fullPath)) {
        console.log(`[SKIP] ${label} file not found`);
        return;
      }
      const sql = fs.readFileSync(fullPath, 'utf8');
      try {
        await client.query(sql);
        console.log(`[OK] ${label} applied successfully`);
      } catch (err) {
        if (err.code === '42710' || err.code === '42P07') {
          // duplicate_object (e.g. enum/type already exists) or duplicate_table
          console.log(`[NOTICE] ${label} already applied (${err.message})`);
        } else {
          throw err;
        }
      }
    };

    await runSqlFile('db/migrations/001_init.sql', '001_init.sql (Core Schema)');
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
    await pool.end().catch(() => { });
  }
}

initDb();
