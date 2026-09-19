import { Client } from 'pg';
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { parse } from 'url';

// A tiny CLI to apply our migrations directly to the Supabase connection string.
// We have to do this locally because Hyperdrive does not have a "wrangler migrate" equivalent
// like D1 does. Hyperdrive is just a connection pooler over real Postgres.

async function run() {
  const connStr = process.env.DATABASE_URL;
  if (!connStr) {
    console.error('ERROR: DATABASE_URL environment variable is required.');
    console.error('Usage: DATABASE_URL="postgres://..." node scripts/migrate.mjs');
    process.exit(1);
  }

  // Supabase session pooler on port 5432 usually requires SSL.
  // Using ssl: { rejectUnauthorized: false } is standard for this connection path.
  const client = new Client({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to database...');
    await client.connect();

    // Create a table to track which migrations we've run
    await client.query(`
      CREATE TABLE IF NOT EXISTS migration_history (
        id SERIAL PRIMARY KEY,
        filename TEXT UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    const migrationsDir = join(process.cwd(), 'migrations');
    const files = readdirSync(migrationsDir)
      .filter(f => f.endsWith('.sql'))
      .sort(); // Run 0000_ first, etc.

    for (const file of files) {
      const { rows } = await client.query('SELECT 1 FROM migration_history WHERE filename = $1', [file]);
      if (rows.length > 0) {
        console.log(`Skipping ${file} (already applied)`);
        continue;
      }

      console.log(`Applying ${file}...`);
      const sql = readFileSync(join(migrationsDir, file), 'utf8');
      
      // Run the migration inside a transaction
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO migration_history (filename) VALUES ($1)', [file]);
        await client.query('COMMIT');
        console.log(`Successfully applied ${file}`);
      } catch (e) {
        await client.query('ROLLBACK');
        console.error(`Error applying ${file}:`);
        throw e;
      }
    }

    console.log('All migrations completed successfully.');
  } catch (err) {
    console.error(err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
