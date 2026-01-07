/**
 * Cloudflare Access JWT Verification
 *
 * Verifies the Cf-Access-Jwt-Assertion header to ensure requests
 * are authenticated through Cloudflare Access.
 */

interface JWTHeader {
  alg: string;
  kid: string;
  typ: string;
}

interface JWTPayload {
  aud: string[];
  email: string;
  exp: number;
  iat: number;
  iss: string;
  sub: string;
  type: string;
  identity_nonce?: string;
  country?: string;
}

interface JWKS {
  keys: JWK[];
}

interface JWK {
  kid: string;
  kty: string;
  alg: string;
  use: string;
  e: string;
  n: string;
}

// Cache for JWKS to avoid fetching on every request
let jwksCache: { keys: Map<string, CryptoKey>; expiry: number } | null = null;
const JWKS_CACHE_TTL = 60 * 60 * 1000; // 1 hour

export interface AuthResult {
  authenticated: boolean;
  email?: string;
  error?: string;
}

/**
 * Verifies the Cloudflare Access JWT from the request headers
 */
export async function verifyAccessJWT(
  request: Request,
  teamName: string,
  expectedAudience?: string
): Promise<AuthResult> {
  const jwt = request.headers.get('Cf-Access-Jwt-Assertion');

  if (!jwt) {
    return { authenticated: false, error: 'Missing Cf-Access-Jwt-Assertion header' };
  }

  try {
    const parts = jwt.split('.');
    if (parts.length !== 3) {
      return { authenticated: false, error: 'Invalid JWT format' };
    }

    const [headerB64, payloadB64, signatureB64] = parts;

    // Decode header and payload
    const header: JWTHeader = JSON.parse(base64UrlDecode(headerB64));
    const payload: JWTPayload = JSON.parse(base64UrlDecode(payloadB64));

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      return { authenticated: false, error: 'JWT has expired' };
    }

    // Check issued at (with 60 second leeway for clock skew)
    if (payload.iat > now + 60) {
      return { authenticated: false, error: 'JWT issued in the future' };
    }

    // Verify issuer
    const expectedIssuer = `https://${teamName}.cloudflareaccess.com`;
    if (payload.iss !== expectedIssuer) {
      return { authenticated: false, error: `Invalid issuer: ${payload.iss}` };
    }

    // Verify audience if provided
    if (expectedAudience && !payload.aud.includes(expectedAudience)) {
      return { authenticated: false, error: 'Invalid audience' };
    }

    // Get the public key and verify signature
    const publicKey = await getPublicKey(teamName, header.kid);
    if (!publicKey) {
      return { authenticated: false, error: 'Could not fetch public key' };
    }

    const signatureValid = await verifySignature(
      publicKey,
      `${headerB64}.${payloadB64}`,
      signatureB64
    );

    if (!signatureValid) {
      return { authenticated: false, error: 'Invalid signature' };
    }

    return { authenticated: true, email: payload.email };
  } catch (error) {
    console.error('JWT verification error:', error);
    return { authenticated: false, error: 'JWT verification failed' };
  }
}

/**
 * Fetches and caches the JWKS from Cloudflare Access
 */
async function getPublicKey(teamName: string, kid: string): Promise<CryptoKey | null> {
  // Check cache
  if (jwksCache && jwksCache.expiry > Date.now()) {
    const cachedKey = jwksCache.keys.get(kid);
    if (cachedKey) {
      return cachedKey;
    }
  }

  // Fetch JWKS
  const certsUrl = `https://${teamName}.cloudflareaccess.com/cdn-cgi/access/certs`;
  const response = await fetch(certsUrl);

  if (!response.ok) {
    console.error(`Failed to fetch JWKS: ${response.status}`);
    return null;
  }

  const jwks: JWKS = await response.json();

  // Import all keys and cache them
  const keys = new Map<string, CryptoKey>();

  for (const jwk of jwks.keys) {
    try {
      const key = await crypto.subtle.importKey(
        'jwk',
        {
          kty: jwk.kty,
          n: jwk.n,
          e: jwk.e,
          alg: jwk.alg,
          use: jwk.use,
        },
        {
          name: 'RSASSA-PKCS1-v1_5',
          hash: 'SHA-256',
        },
        false,
        ['verify']
      );
      keys.set(jwk.kid, key);
    } catch (error) {
      console.error(`Failed to import key ${jwk.kid}:`, error);
    }
  }

  jwksCache = {
    keys,
    expiry: Date.now() + JWKS_CACHE_TTL,
  };

  return keys.get(kid) || null;
}

/**
 * Verifies the JWT signature using the public key
 */
async function verifySignature(
  key: CryptoKey,
  data: string,
  signatureB64: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const signatureBuffer = base64UrlDecodeToBuffer(signatureB64);

  return crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    signatureBuffer,
    dataBuffer
  );
}

/**
 * Decodes a base64url string to a regular string
 */
function base64UrlDecode(str: string): string {
  // Convert base64url to base64
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');

  // Add padding if needed
  const padding = base64.length % 4;
  if (padding) {
    base64 += '='.repeat(4 - padding);
  }

  return atob(base64);
}

/**
 * Decodes a base64url string to an ArrayBuffer
 */
function base64UrlDecodeToBuffer(str: string): ArrayBuffer {
  const decoded = base64UrlDecode(str);
  const buffer = new Uint8Array(decoded.length);
  for (let i = 0; i < decoded.length; i++) {
    buffer[i] = decoded.charCodeAt(i);
  }
  return buffer.buffer;
}
