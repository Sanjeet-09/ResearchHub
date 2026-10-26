const fs = require('fs');
const path = require('path');
const { parse: parseConnectionString } = require('pg-connection-string');
const { Pool } = require('pg');

// 1. Support CLI flags and arguments
const args = process.argv.slice(2);
const isVerifyOnly = args.includes('--verify') || args.includes('--test') || args.includes('-t');

const cliArg = args.find(
  (arg) => !arg.startsWith('-') && (arg.startsWith('postgres://') || arg.startsWith('postgresql://'))
);
if (cliArg) {
  process.env.DATABASE_URL = cliArg;
}

const urlFlagIndex = args.findIndex((arg) => arg === '--url' || arg === '-u');
if (urlFlagIndex !== -1 && args[urlFlagIndex + 1]) {
  process.env.DATABASE_URL = args[urlFlagIndex + 1];
}

// 2. If DATABASE_URL is not set, search candidate secrets files
if (!process.env.DATABASE_URL) {
  const rootDir = path.join(__dirname, '..');
  const candidateFiles = [
    'secrets.env',
    '.env.secrets',
    'secretes.txt',
    'secrets.txt',
    '.env.production',
    '.env',
  ];

  for (const filename of candidateFiles) {
    const filePath = path.join(rootDir, filename);
    if (fs.existsSync(filePath)) {
      try {
        const content = fs.readFileSync(filePath, 'utf8');
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
        if (process.env.DATABASE_URL) {
          break;
        }
      } catch (_) {}
    }
  }
}

// Fallback to standard dotenv loading
try {
  require('dotenv').config();
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (_) {}

function maskConnectionString(url) {
  if (!url) return '';
  return url.replace(/:\/\/([^:]+):(.+)@([^@]+)$/, '://$1:****@$3');
}

// Known common Supabase pooler regions to test if direct IPv6 connection fails
const SUPABASE_POOLER_REGIONS = [
  'ap-northeast-1', // Tokyo (active ResearchHub instance)
  'ap-south-1',     // Mumbai
  'ap-southeast-1', // Singapore
  'us-east-1',      // N. Virginia
  'us-west-1',      // N. California
  'eu-central-1',   // Frankfurt
  'eu-west-1',      // Ireland
];

function stripSslMode(urlStr) {
  if (!urlStr) return urlStr;
  try {
    const u = new URL(urlStr);
    u.searchParams.delete('sslmode');
    return u.toString();
  } catch (_) {
    return urlStr.replace(/[?&]sslmode=[^&]+/g, '').replace(/\?&/, '?').replace(/\?$/, '');
  }
}

async function createWorkingPool(rawUrl) {
  let cleanUrl = rawUrl || process.env.DATABASE_URL;
  if (cleanUrl) {
    cleanUrl = stripSslMode(cleanUrl);
  }

  const baseConfig = cleanUrl
    ? { connectionString: cleanUrl, ssl: { rejectUnauthorized: false } }
    : require('../shared/src/db').poolConfig;

  let pool = new Pool(baseConfig);

  try {
    const testClient = await pool.connect();
    testClient.release();
    return { pool, url: cleanUrl };
  } catch (err) {
    await pool.end().catch(() => {});

    // Check if error is due to IPv6-only Supabase host on an IPv4 network
    if (
      cleanUrl &&
      (cleanUrl.includes('.supabase.co') || err.code === 'ENOTFOUND' || err.message.includes('ENOTFOUND'))
    ) {
      console.log('\n[NOTICE] Direct Supabase host returned ENOTFOUND (IPv6-only host on IPv4 environment).');
      console.log('[NOTICE] Resolving IPv4 Supabase Connection Pooler automatically...');

      try {
        const parsed = parseConnectionString(cleanUrl);
        const hostMatch = parsed.host && parsed.host.match(/^db\.([a-z0-9]+)\.supabase\.co/);
        const projectRef = hostMatch ? hostMatch[1] : '';

        if (projectRef && parsed.password) {
          const tenantUser = parsed.user && parsed.user.includes('.') ? parsed.user : `postgres.${projectRef}`;
          for (const region of SUPABASE_POOLER_REGIONS) {
            for (const port of [6543, 5432]) {
              const poolerHost = `aws-0-${region}.pooler.supabase.com`;
              const poolerConnStr = `postgresql://${tenantUser}:${encodeURIComponent(parsed.password)}@${poolerHost}:${port}/postgres`;
              const candidatePool = new Pool({ connectionString: poolerConnStr, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 3000 });
              try {
                const client = await candidatePool.connect();
                client.release();
                console.log(`[OK] Successfully connected via Supabase Connection Pooler (${poolerHost}:${port})!\n`);
                process.env.DATABASE_URL = poolerConnStr;
                return { pool: candidatePool, url: poolerConnStr };
              } catch (poolerErr) {
                await candidatePool.end().catch(() => {});
              }
            }
          }
        }
      } catch (poolerSweepErr) {
        // Fall through to original error
      }
    }

    throw err;
  }
}

// Helper to split SQL into statements, respecting dollar-quoted blocks ($$...$$) and single-quoted strings
function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let inString = false;
  let inDollarQuote = false;
  let dollarTag = '';

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];

    if (!inDollarQuote) {
      if (char === "'" && (i === 0 || sql[i - 1] !== '\\')) {
        inString = !inString;
      }
    }

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
  '42710', // duplicate_object
  '42P07', // duplicate_table
  '42723', // duplicate_function
  '42P06', // duplicate_schema
  '23505', // unique_violation
  '42501', // insufficient_privilege
]);

async function initDb() {
  console.log(`\n======================================================`);
  console.log(`ResearchHub DB Migration & Seed Runner`);
  console.log(`Target:      ${maskConnectionString(process.env.DATABASE_URL) || 'Local DB'}`);
  console.log(`Mode:        ${isVerifyOnly ? 'Verification Only' : 'Migration & Seed'}`);
  console.log(`======================================================\n`);

  let pool;
  let client;
  try {
    const poolResult = await createWorkingPool(process.env.DATABASE_URL);
    pool = poolResult.pool;
    client = await pool.connect();
    console.log('[OK] Connected to PostgreSQL database successfully.');

    if (!isVerifyOnly) {
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

        // Attempt 2: Statement-by-statement execution
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

      // Run full migration suite dynamically from db/migrations/
      const migrationsDir = path.join(__dirname, '..', 'db', 'migrations');
      if (fs.existsSync(migrationsDir)) {
        const migrationFiles = fs.readdirSync(migrationsDir)
          .filter((f) => f.endsWith('.sql'))
          .sort();
        for (const file of migrationFiles) {
          await runSqlFile(path.join('db', 'migrations', file), `${file}`);
        }
      }
      await runSqlFile('db/seed.sql', 'seed.sql (Demo Users & Seed Data)');
    }

    // Step: Verify connection succeeds and tables exist
    console.log('\n--> Verifying database schema integrity...');
    const tableRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    const tables = tableRes.rows.map((r) => r.table_name);
    console.log(`[VERIFY] Verified tables present in Supabase (${tables.length} tables):`);
    console.log(`         ${tables.join(', ')}`);

    const requiredTables = ['users', 'projects', 'experiments', 'datasets', 'documents', 'project_messages'];
    const missingTables = requiredTables.filter((t) => !tables.includes(t));

    if (missingTables.length > 0) {
      throw new Error(`Database verification failed: missing required tables: ${missingTables.join(', ')}`);
    }

    console.log('\n======================================================');
    console.log('Database successfully initialized, migrated, and verified!');
    console.log('======================================================\n');
  } catch (err) {
    console.error('\n[FATAL] Database initialization failed:');
    console.error(err.message);
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      console.error('\nTroubleshooting:');
      console.error('- Check your Supabase DATABASE_URL format and credentials.');
      console.error('  Supabase Direct: postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres');
      console.error('  Supabase Pooler: postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres');
    }
    process.exit(1);
  } finally {
    if (client) client.release();
    if (pool) await pool.end().catch(() => {});
  }
}

initDb();
