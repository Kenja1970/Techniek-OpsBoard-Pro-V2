// Unauthenticated endpoints.
//
// Everything here runs with no Access JWT, so it is written defensively: it
// touches exactly one table, grants nothing, and fails closed when the bot
// check is not configured. Creating a request does not create an account.

const SITEVERIFY = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  });
}

/**
 * The widget alone protects nothing — a token can be forged, so it must be
 * verified server-side. Tokens are single-use and expire after five minutes.
 */
async function verifyTurnstile(env, token, ip) {
  if (!env.TURNSTILE_SECRET) return { ok: false, reason: "not-configured" };
  if (!token) return { ok: false, reason: "missing-token" };

  const form = new FormData();
  form.append("secret", env.TURNSTILE_SECRET);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);

  try {
    const res = await fetch(SITEVERIFY, { method: "POST", body: form });
    const outcome = await res.json();
    return outcome.success
      ? { ok: true }
      : { ok: false, reason: (outcome["error-codes"] || []).join(",") || "rejected" };
  } catch (err) {
    return { ok: false, reason: "verify-failed" };
  }
}

function validEmail(s) {
  return typeof s === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim()) && s.length <= 254;
}

function clean(s, max) {
  return String(s == null ? "" : s).replace(/[\u0000-\u001F\u007F]/g, "").trim().slice(0, max);
}

export async function handleAccessRequest(request, env, ctx, getDbClient, closeDbClient) {
  const ip = request.headers.get("CF-Connecting-IP") || "";

  // Best-effort throttle. The Workers rate-limit binding counts per Cloudflare
  // location rather than globally, so this raises the cost of spam; it is not a
  // hard quota and is not the only defense.
  if (env.REQUEST_LIMITER) {
    const { success } = await env.REQUEST_LIMITER.limit({ key: ip || "anonymous" });
    if (!success) return json({ error: "Too many requests. Try again shortly." }, 429);
  }

  const body = await request.json().catch(() => ({}));

  const check = await verifyTurnstile(env, body.turnstileToken, ip);
  if (!check.ok) {
    // Fail closed. An unconfigured bot check must not silently become an open
    // write endpoint on a public path.
    const status = check.reason === "not-configured" ? 503 : 400;
    return json({
      error: check.reason === "not-configured"
        ? "The request form is not available right now."
        : "Could not verify that you are human. Please refresh and try again.",
    }, status);
  }

  const email = clean(body.email, 254).toLowerCase();
  if (!validEmail(email)) return json({ error: "Enter a valid email address." }, 400);

  const client = await getDbClient(env);
  try {
    await client.query(
      `INSERT INTO access_requests (id, email, name, company, reason, country, user_agent)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       ON CONFLICT (lower(email)) WHERE status = 'new' DO NOTHING`,
      [
        "req_" + crypto.randomUUID().replace(/-/g, "").slice(0, 16),
        email,
        clean(body.name, 120),
        clean(body.company, 160),
        clean(body.reason, 1000),
        (request.cf && request.cf.country) || null,
        clean(request.headers.get("User-Agent"), 300),
      ]
    );
  } catch (err) {
    console.error("access request failed:", err && err.message);
    // Do not surface database detail to an anonymous caller.
    return json({ error: "Could not record the request. Please try again later." }, 500);
  } finally {
    await closeDbClient(client);
  }

  // Always the same answer, whether or not this email already asked or already
  // has an account — the form must not become an account-enumeration oracle.
  return json({ ok: true, message: "Thanks — your request has been received. You'll hear from an administrator by email." });
}
