const fs = require('fs');
const path = require('path');

// 1. Support .env configuration
try {
  require('dotenv').config();
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (_) {}

// 2. Support passing connection string as CLI parameter:
// node scripts/db-init.js "postgresql://postgres:password@db.xyz.supabase.co:5432/postgres"
const cliArg = process.argv.slice(2).find(
  (arg) => !arg.startsWith('-') && (arg.startsWith('postgres://') || arg.startsWith('postgresql://'))
);
if (cliArg) {
  process.env.DATABASE_URL = cliArg;
}

// Support --url or -u flag
const urlFlagIndex = process.argv.findIndex((arg) => arg === '--url' || arg === '-u');
if (urlFlagIndex !== -1 && process.argv[urlFlagIndex + 1]) {
  process.env.DATABASE_URL = process.argv[urlFlagIndex + 1];
}

const { pool, poolConfig } = require('../shared/src/db');

// Helper to split SQL into statements, respecting dollar-quoted blocks ($$...$$) and single-quoted strings
function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let inString = false;
  let inDollarQuote = false;
  let dollarTag = '';

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];

    // Single-quote string literal handling
    if (!inDollarQuote) {
      if (char === "'" && (i === 0 || sql[i - 1] !== '\\')) {
        inString = !inString;
      }
    }

    // Dollar-quoting ($$...$$ or $tag$...$tag$) handling for PL/pgSQL
    if (!inString) {
      if (char === '$') {
        const remaining = sql.slice(i);
        const match = remaining.match(/^(\$[a-zA-Z0-9_]*\$)/);
        if (match) {
          const tag = match[1];
          if (!inDollarQuote) {
            inDollarQuote = true;
            dollarTag = tag;
            current += tag;
            i += tag.length - 1;
            continue;
          } else if (inDollarQuote && tag === dollarTag) {
            inDollarQuote = false;
            dollarTag = '';
            current += tag;
            i += tag.length - 1;
            continue;
          }
        }
      }
    }

    if (char === ';' && !inString && !inDollarQuote) {
      const trimmed = current.trim();
      if (trimmed.length > 0) {
        statements.push(trimmed);
      }
      current = '';
    } else {
      current += char;
    }
  }

  const trimmed = current.trim();
  if (trimmed.length > 0) {
    statements.push(trimmed);
  }

  return statements;
}

// Benign error codes in PostgreSQL when objects already exist
const BENIGN_ERROR_CODES = new Set([
  '42710', // duplicate_object (type, constraint, or trigger already exists)
  '42P07', // duplicate_table (relation or index already exists)
  '42723', // duplicate_function
  '42P06', // duplicate_schema
  '23505', // unique_violation (seed record already exists)
  '42501', // insufficient_privilege (e.g. extension already installed in managed cloud DB)
]);

async function initDb() {
  const targetInfo = process.env.DATABASE_URL
    ? process.env.DATABASE_URL.replace(/:([^:@]+)@/, ':****@')
    : `${poolConfig.host}:${poolConfig.port}/${poolConfig.database}`;

  console.log(`\n======================================================`);
  console.log(`ResearchHub DB Migration & Seed Runner`);
  console.log(`Connecting to: ${targetInfo}`);
  console.log(`SSL Enabled:   ${Boolean(poolConfig.ssl)}`);
  console.log(`======================================================\n`);

  let client;
  try {
    client = await pool.connect();
    console.log('[OK] Connected to PostgreSQL database successfully.');

    const runSqlFile = async (relPath, label) => {
      console.log(`\n--> Applying ${label}...`);
      const fullPath = path.join(__dirname, '..', relPath);
      if (!fs.existsSync(fullPath)) {
        console.log(`[SKIP] ${label} file not found at ${fullPath}`);
        return;
      }
      const sql = fs.readFileSync(fullPath, 'utf8');

      // Attempt 1: Execute file as a single batch
      try {
        await client.query(sql);
        console.log(`[OK] ${label} applied cleanly in single batch.`);
        return;
      } catch (batchErr) {
        if (BENIGN_ERROR_CODES.has(batchErr.code)) {
          console.log(`[NOTICE] Batch finished with notice: ${batchErr.message}`);
          return;
        }

        console.log(`[INFO] Batch encountered '${batchErr.message}'. Running statement-by-statement for idempotency...`);
      }

      // Attempt 2: Fallback to statement-by-statement execution
      const statements = splitSqlStatements(sql);
      let executedCount = 0;
      let skippedCount = 0;

      for (const statement of statements) {
        try {
          await client.query(statement);
          executedCount++;
        } catch (stmtErr) {
          if (BENIGN_ERROR_CODES.has(stmtErr.code)) {
            skippedCount++;
          } else {
            console.error(`[ERROR] Statement failed: ${stmtErr.message}`);
            console.error(`Statement snippet: ${statement.slice(0, 120)}...`);
            throw stmtErr;
          }
        }
      }

      console.log(`[OK] ${label} completed (${executedCount} applied, ${skippedCount} skipped as already existing).`);
    };

    // Run full migration suite
    await runSqlFile('db/migrations/001_init.sql', '001_init.sql (Core Schema)');
    await runSqlFile('db/migrations/002_project_messages.sql', '002_project_messages.sql (Project Discussion & Messaging)');
    await runSqlFile('db/seed.sql', 'seed.sql (Demo Users & Seed Data)');

    console.log('\n======================================================');
    console.log('Database successfully initialized, migrated, and seeded!');
    console.log('======================================================\n');
  } catch (err) {
    console.error('\n[FATAL] Database initialization failed:');
    console.error(err.message);
    if (err.code === 'ECONNREFUSED') {
      console.error('\nTroubleshooting:');
      console.error('- If using local Docker: Ensure docker-compose is up (docker-compose up -d postgres).');
      console.error('- If using Supabase: Check your DATABASE_URL format and credentials.');
      console.error('  Supabase Direct: postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres');
      console.error('  Supabase Pooler: postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres');
    }
    process.exit(1);
  } finally {
    if (client) client.release();
    await pool.end().catch(() => {});
  }
}

initDb();
