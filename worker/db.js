import { Client } from 'pg';

/**
 * Connect to Postgres through the Hyperdrive binding.
 *
 * In production Hyperdrive pools connections at the edge, so opening a client
 * per request is cheap and recommended. In local dev Hyperdrive is bypassed and
 * every request dials Supabase's session-mode pooler directly — that pooler
 * holds one server connection per client and queues the rest, so a burst of
 * requests can stall for a minute. The explicit timeouts below turn that into a
 * fast, legible error instead of a hung request.
 */
export async function getDbClient(env) {
  if (!env.DB) throw new Error('Hyperdrive binding (DB) is not configured.');

  const client = new Client({
    connectionString: env.DB.connectionString,
    connectionTimeoutMillis: 8000,
    query_timeout: 10000,
    statement_timeout: 10000,
  });

  await client.connect();
  return client;
}

/** Always hand the pooler its connection back, even when a query threw. */
export async function closeDbClient(client) {
  try { await client.end(); } catch (e) { /* already closed or reset */ }
}
