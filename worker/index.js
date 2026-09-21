import { verifyAccessJWT } from './auth.js';
import { getDbClient, closeDbClient } from './db.js';
import { resolveUser, resolveWorkspaceId, isActive } from './users.js';
import { readWorkspace, writeWorkspace } from './workspace.js';
import { isAdmin, listUsers, setStatus, setRole, recentAudit,
         listAccessRequests, decideAccessRequest,
         createUser, deleteUser, listWorkspaces } from './admin.js';
import { ingestDocument, listDocuments, searchGuidelines, deleteDocument } from './guidelines.js';
import { advise } from './assistant.js';
import { handleAccessRequest } from './public.js';

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}

// Local dev runs without Cloudflare Access in front of it, so there is no
// Access JWT to validate. This bypass is bound to loopback hostnames only;
// a deployed Worker is never reached on localhost.
function isLoopback(url) {
  return url.hostname === 'localhost' || url.hostname === '127.0.0.1';
}

async function identify(request, env, url) {
  // The development identity bypass requires BOTH a loopback hostname AND an
  // explicit opt-in that only exists in .dev.vars. Hostname alone was too thin
  // a guarantee to hang "anyone can be any user" on: request.url reflects the
  // Host header, and a single routing mistake would have turned a convenience
  // into full impersonation of every account. A deployed Worker has no
  // DEV_IDENTITY_BYPASS, so the branch is dead in production.
  if (env.DEV_IDENTITY_BYPASS === '1' && isLoopback(url)) {
    const asUser = request.headers.get('X-Dev-Email') || url.searchParams.get('dev_email');
    return { email: asUser || env.DEV_EMAIL || 'localdev@techniek.local', sub: 'local-dev' };
  }
  return await verifyAccessJWT(request, env);
}

async function handleApi(request, env, ctx, url) {
  let identity;
  try {
    identity = await identify(request, env, url);
  } catch (err) {
    return json({ error: 'Unauthorized', detail: err.message }, 401);
  }

  let client;
  try {
    client = await getDbClient(env);
  } catch (err) {
    return json({
      error: 'Database unavailable',
      detail: 'Could not reach the database: ' + String(err && err.message || err),
    }, 503);
  }

  try {
    const user = await resolveUser(client, identity);

    if (url.pathname === '/api/me' && request.method === 'GET') {
      const workspaceId = isActive(user) ? await resolveWorkspaceId(client, user) : null;
      return json({
        authenticated: true,
        email: user.email,
        displayName: user.display_name,
        status: user.status,
        role: user.global_role,
        workspaceId,
      });
    }

    // Everything past this point needs an approved account.
    if (!isActive(user)) {
      return json({
        error: 'Account pending approval',
        status: user.status,
        detail: user.status === 'suspended'
          ? 'This account has been suspended. Contact an administrator.'
          : 'Your account is awaiting administrator approval.',
      }, 403);
    }

    if (url.pathname.startsWith('/api/admin/')) {
      if (!isAdmin(user)) {
        return json({ error: 'Forbidden', detail: 'Administrator access is required.' }, 403);
      }

      if (url.pathname === '/api/admin/users' && request.method === 'GET') {
        return json({ users: await listUsers(client) });
      }

      if (url.pathname === '/api/admin/users' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const result = await createUser(client, user, body);
        if (result.error) return json({ error: result.error }, result.code || 400);
        return json({ ok: true, user: result.user });
      }

      if (url.pathname === '/api/admin/users' && request.method === 'DELETE') {
        const body = await request.json().catch(() => ({}));
        const result = await deleteUser(client, user, body.id);
        if (result.error) return json({ error: result.error }, result.code || 400);
        return json({ ok: true, deleted: result.deleted, email: result.email });
      }

      if (url.pathname === '/api/admin/workspaces' && request.method === 'GET') {
        return json({ workspaces: await listWorkspaces(client) });
      }

      // Administrator access to another account's project data. Every read and
      // every write is written to the audit log naming the administrator and
      // the owner — support access that leaves no trace is indistinguishable
      // from a compromise.
      if (url.pathname === '/api/admin/workspace') {
        const wsId = url.searchParams.get('id');
        if (!wsId) return json({ error: 'A workspace `id` is required.' }, 400);

        if (request.method === 'GET') {
          const ws = await readWorkspace(client, wsId);
          if (!ws) return json({ error: 'Workspace not found.' }, 404);
          await client.query(
            `INSERT INTO audit_logs (workspace_id, actor_id, action, entity, entity_id, detail)
             VALUES ($1,$2,'admin.workspace_opened','workspace',$1,$3)`,
            [wsId, user.id, JSON.stringify({ rev: ws.rev })]
          );
          return json({ id: wsId, rev: ws.rev, state: ws.state });
        }

        if (request.method === 'PUT') {
          const body = await request.json().catch(() => ({}));
          if (!body || typeof body.state !== 'object' || body.state === null) {
            return json({ error: 'Request body must include a workspace state object.' }, 400);
          }
          const result = await writeWorkspace(client, wsId, user.id, body.state, body.rev);
          if (result.conflict) {
            return json({ error: 'Conflict', rev: result.current.rev, state: result.current.state }, 409);
          }
          if (result.notFound) return json({ error: 'Workspace not found' }, 404);
          await client.query(
            `INSERT INTO audit_logs (workspace_id, actor_id, action, entity, entity_id, detail)
             VALUES ($1,$2,'admin.workspace_edited','workspace',$1,$3)`,
            [wsId, user.id, JSON.stringify({ rev: result.rev })]
          );
          return json({ ok: true, id: wsId, rev: result.rev });
        }
      }

      if (url.pathname === '/api/admin/audit' && request.method === 'GET') {
        return json({ entries: await recentAudit(client, url.searchParams.get('limit')) });
      }

      if (url.pathname === '/api/admin/requests' && request.method === 'GET') {
        return json({ requests: await listAccessRequests(client) });
      }

      if (url.pathname === '/api/admin/requests/decide' && request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        const result = await decideAccessRequest(client, user, body.id, body.decision, body.notes);
        if (result.error) return json({ error: result.error }, result.code || 400);
        return json({ ok: true, request: result.request, account: result.account || null });
      }

      // /api/admin/users/<id>/status | /api/admin/users/<id>/role
      const parts = url.pathname.split('/').filter(Boolean); // api, admin, users, <id>, <action>
      if (parts.length === 5 && parts[2] === 'users' && request.method === 'POST') {
        const targetId = decodeURIComponent(parts[3]);
        const body = await request.json().catch(() => ({}));
        let result;
        if (parts[4] === 'status') result = await setStatus(client, user, targetId, body.status);
        else if (parts[4] === 'role') result = await setRole(client, user, targetId, body.role);
        else return json({ error: 'Unknown admin action' }, 404);

        if (result.error) return json({ error: result.error }, result.code || 400);
        return json({ ok: true, user: result.user });
      }

      return json({ error: 'API route not found' }, 404);
    }

    // ---- Corporate PM standards (Stage B) --------------------------------
    // Reading is open to any approved user; publishing a controlled procedure
    // is an administrator act.
    if (url.pathname === '/api/guidelines') {
      const orgId = 'org_techniek';

      if (request.method === 'GET') {
        return json({ documents: await listDocuments(client, user.id, orgId) });
      }

      if (request.method === 'DELETE') {
        const body = await request.json().catch(() => ({}));
        if (!body.id) return json({ error: 'A document `id` is required.' }, 400);
        const removed = await deleteDocument(client, user.id, body.id);
        if (!removed) return json({ error: 'No procedure of yours has that id.' }, 404);
        return json({ ok: true, id: body.id });
      }

      if (request.method === 'POST') {
        const body = await request.json().catch(() => ({}));
        // Your own corpus is yours to manage. Publishing to the whole
        // organization is a different act and stays administrator-only.
        if (body.visibility === 'org' && !isAdmin(user)) {
          return json({
            error: 'Forbidden',
            detail: 'Only an administrator can publish a procedure to the whole organization.',
          }, 403);
        }
        if (!body.markdown && !(Array.isArray(body.chunks) && body.chunks.length)) {
          return json({ error: 'Provide either `markdown` or a non-empty `chunks` array.' }, 400);
        }
        try {
          const result = await ingestDocument(client, env, {
            orgId,
            ownerId: user.id,
            visibility: body.visibility,
            uploadedBy: user.id,
            id: body.id,
            title: body.title,
            source: body.source,
            revision: body.revision,
            effectiveDate: body.effectiveDate,
            dimension: body.dimension,
            triggers: body.triggers,
            tags: body.tags,
            origin: body.origin,
            markdown: body.markdown,
            chunks: body.chunks,
            append: body.append === true,
          });
          return json({ ok: true, document: result });
        } catch (err) {
          return json({ error: 'Ingest failed', detail: String(err && err.message || err) }, 400);
        }
      }
    }

    // Prose synthesis over an evidence pack the client already assembled and
    // grounded. The key stays here; the browser never sees it.
    if (url.pathname === '/api/assistant/advise' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      if (!body || !body.pack || typeof body.pack !== 'object') {
        return json({ error: 'An evidence `pack` is required.' }, 400);
      }
      try {
        return json(await advise(env, body.pack));
      } catch (err) {
        return json({ ok: false, configured: true, error: String(err && err.message || err) }, 502);
      }
    }

    if (url.pathname === '/api/assistant/health' && request.method === 'GET') {
      return json({ configured: !!(env.LLM_API_KEY && env.LLM_MODEL), model: env.LLM_MODEL || null });
    }

    if (url.pathname === '/api/guidelines/search' && request.method === 'POST') {
      const body = await request.json().catch(() => ({}));
      const result = await searchGuidelines(client, env, {
        userId: user.id,
        orgId: 'org_techniek',
        query: body.query,
        dimension: body.dimension,
        limit: body.limit,
      });
      return json(result);
    }

    if (url.pathname === '/api/workspace') {
      const workspaceId = await resolveWorkspaceId(client, user);

      if (request.method === 'GET') {
        const ws = await readWorkspace(client, workspaceId);
        // state is null until the client seeds it with its first save.
        return json({ id: workspaceId, rev: ws ? ws.rev : 0, state: ws ? ws.state : null });
      }

      if (request.method === 'PUT') {
        const body = await request.json();
        if (!body || typeof body.state !== 'object' || body.state === null) {
          return json({ error: 'Request body must include a workspace state object.' }, 400);
        }
        const result = await writeWorkspace(client, workspaceId, user.id, body.state, body.rev);
        if (result.conflict) {
          return json({
            error: 'Conflict',
            detail: 'This workspace changed since you last loaded it.',
            rev: result.current.rev,
            state: result.current.state,
          }, 409);
        }
        if (result.notFound) return json({ error: 'Workspace not found' }, 404);
        return json({ ok: true, id: workspaceId, rev: result.rev });
      }
    }

    return json({ error: 'API route not found' }, 404);
  } catch (err) {
    console.error('API error:', err && err.stack ? err.stack : err);
    return json({ error: 'Internal Server Error', detail: String(err && err.message || err) }, 500);
  } finally {
    // Release the pooler slot before responding rather than deferring it —
    // under session-mode pooling a deferred close starves the next request.
    await closeDbClient(client);
  }
}

// Routes with no asset file of their own, mapped to the page that serves them.
//
// These mirror the Cloudflare Access applications: '/', '/try' and
// '/request-access' are Bypass (public); '/app' and '/api/*' sit behind the
// Allow policy. The mapping is repeated here on purpose — Access decides who
// reaches the Worker, this decides what the Worker will do for someone who
// arrives unauthenticated, and a misconfigured Access application must not be
// the only thing standing between the internet and the API.
const PAGE_ROUTES = {
  '/': '/landing.html',
  '/try': '/index.html',
  '/request-access': '/request-access.html',
  '/app': '/index.html',
};

/**
 * Return a page's bytes, never a redirect.
 *
 * If the asset server is configured to rewrite .html URLs it answers with a
 * 3xx, and handing that back to the browser sends it straight to a route this
 * Worker owns — an infinite redirect. Resolve it here instead, and strip the
 * asset server's own caching/redirect semantics from the response.
 */
async function servePage(env, url, assetPath, request) {
  let res = await env.ASSETS.fetch(new Request(new URL(assetPath, url.origin), request));
  if (res.status >= 300 && res.status < 400) {
    const location = res.headers.get('Location');
    if (location) res = await env.ASSETS.fetch(new Request(new URL(location, url.origin), request));
  }
  return new Response(res.body, {
    status: res.status,
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // The only unauthenticated write in the system.
    if (url.pathname === '/api/public/request-access' && request.method === 'POST') {
      return handleAccessRequest(request, env, ctx, getDbClient, closeDbClient);
    }
    // Nothing else under /api/public/ exists; refuse rather than fall through
    // to the authenticated handler.
    if (url.pathname.startsWith('/api/public/')) {
      return json({ error: 'Not found' }, 404);
    }

    if (url.pathname.startsWith('/api/')) return handleApi(request, env, ctx, url);

    // index.html references its assets relatively so the app still runs from
    // file://. That means "/app/" would resolve app.js to "/app/app.js" and
    // load nothing, so trailing slashes are normalized away rather than served.
    if (url.pathname.length > 1 && url.pathname.endsWith('/')) {
      const trimmed = url.pathname.replace(/\/+$/, '');
      if (PAGE_ROUTES[trimmed]) {
        return Response.redirect(new URL(trimmed + url.search, url.origin).toString(), 308);
      }
    }

    const page = PAGE_ROUTES[url.pathname];
    if (page) return servePage(env, url, page, request);

    return env.ASSETS.fetch(request);
  },
};
