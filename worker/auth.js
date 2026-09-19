import * as jose from 'jose';

/**
 * Validates the Cf-Access-Jwt-Assertion header sent by Cloudflare Access.
 * @param {Request} request 
 * @param {Object} env 
 * @returns {Promise<Object>} The decoded JWT payload
 */
export async function verifyAccessJWT(request, env) {
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) {
    throw new Error('Missing Cf-Access-Jwt-Assertion header. You must access this through Cloudflare Access.');
  }

  // Ensure TEAM_DOMAIN and ACCESS_AUD are set in wrangler.jsonc / environment
  if (!env.TEAM_DOMAIN || !env.ACCESS_AUD) {
    throw new Error('Server configuration error: missing TEAM_DOMAIN or ACCESS_AUD');
  }

  // Fetch the JWKS from your specific Zero Trust team domain
  const JWKS = jose.createRemoteJWKSet(new URL(`${env.TEAM_DOMAIN}/cdn-cgi/access/certs`));
  
  // Verify the JWT signature, issuer, and audience
  const { payload } = await jose.jwtVerify(token, JWKS, {
    issuer: env.TEAM_DOMAIN,
    audience: env.ACCESS_AUD
  });

  return payload;
}
