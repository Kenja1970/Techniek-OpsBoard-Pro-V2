import * as jose from 'jose';

// The JWKS is fetched per request otherwise, which adds a round trip to every
// API call. createRemoteJWKSet caches and rotates keys internally, so one
// instance per isolate is both correct and much faster.
let jwks = null;
let jwksTeam = null;

/**
 * Validate the Cf-Access-Jwt-Assertion header that Cloudflare Access adds.
 *
 * ACCESS_AUD may list several audience tags separated by commas. Every Access
 * application has its own AUD, and this hostname is covered by more than one
 * (the app shell and the API are separate applications so their paths can carry
 * different policies). Accepting a list means adding or re-creating an
 * application does not silently 401 the entire API until the config is chased
 * down — which is exactly what happens with a single hard-coded tag.
 */
export async function verifyAccessJWT(request, env) {
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) {
    throw new Error('Missing Cf-Access-Jwt-Assertion header. You must reach this through Cloudflare Access.');
  }
  if (!env.TEAM_DOMAIN || !env.ACCESS_AUD) {
    throw new Error('Server configuration error: TEAM_DOMAIN or ACCESS_AUD is not set.');
  }

  const audiences = String(env.ACCESS_AUD)
    .split(',')
    .map((a) => a.trim())
    .filter(Boolean);
  if (!audiences.length) {
    throw new Error('Server configuration error: ACCESS_AUD is empty.');
  }

  if (!jwks || jwksTeam !== env.TEAM_DOMAIN) {
    jwks = jose.createRemoteJWKSet(new URL(env.TEAM_DOMAIN + '/cdn-cgi/access/certs'));
    jwksTeam = env.TEAM_DOMAIN;
  }

  const { payload } = await jose.jwtVerify(token, jwks, {
    issuer: env.TEAM_DOMAIN,
    audience: audiences,
  });

  return payload;
}
