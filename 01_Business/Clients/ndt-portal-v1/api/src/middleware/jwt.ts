import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import jwksRsa from 'jwks-rsa';

/**
 * Public routes that bypass JWT validation
 * Service-to-service integrations and health checks
 */
const PUBLIC_PATHS = [
  '/health',
  '/integrations/n8n/quote',        // n8n webhook (has own X-N8N-Token check)
  '/integrations/email/quote',      // Email ingestion webhook
  '/integrations/email/classify',   // Classification utility — read-only, caller provides all data
  '/inbox/process',                 // n8n → API email processing (has own X-N8N-Secret check)
  '/api/inbox/process',             // n8n internal calls include /api prefix
];

/**
 * Check if the request has a valid internal service secret (gateway → API).
 * If so, attach a synthetic super-user so requirePermission passes.
 */
function checkInternalSecret(req: Request): boolean {
  const secret = process.env.INTERNAL_SECRET;
  if (!secret) return false;
  const provided = req.headers['x-internal-secret'];
  if (provided === secret) {
    // Synthetic service user with all permissions
    (req as any).user = {
      sub: 'service:gateway',
      email: 'gateway@internal',
      name: 'Gateway Service',
      role: 'service',
      roles: ['service'],
      permissions: ['UT_QUOTE_CREATE', 'RT_VIEW', 'ADMIN_VIEW'],
      is_super_admin: true,
      tenant_id: 'ndtesting',
    };
    return true;
  }
  return false;
}

/**
 * JWKS client for validating JWT signatures issued by Authentik
 */
let jwksClient: jwksRsa.JwksClient;

function getJwksClient() {
  if (!jwksClient && process.env.AUTHENTIK_ISSUER) {
    jwksClient = jwksRsa({
      jwksUri: `${process.env.AUTHENTIK_ISSUER}jwks/`,
      cache: true,
      cacheMaxEntries: 5,
      cacheMaxAge: 600_000,  // 10 min
    });
  }
  return jwksClient;
}

/**
 * Auth user object — JWT claims + DB-resolved permissions
 */
export interface AuthUser {
  sub: string;              // Authentik user UUID
  email: string;
  name: string;
  role: string;             // Primary role name (backward compat)
  roles: string[];          // All assigned role names (populated by loadPermissions)
  tenant_id: string;        // Tenant slug
  permissions: string[];    // Effective permission codes (populated by loadPermissions)
  is_super_admin: boolean;  // True if user has super_admin role
  iat: number;
  exp: number;
}

/**
 * Express augmentation: attach user to req object
 */
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

/**
 * Verify JWT signature using Authentik's JWKS endpoint
 */
function getSigningKey(header: jwt.JwtHeader, callback: jwt.SigningKeyCallback) {
  const client = getJwksClient();
  if (!client) {
    return callback(new Error('JWKS client not initialized. Set AUTHENTIK_ISSUER env var.'));
  }

  client.getSigningKey(header.kid, (err, key) => {
    if (err) return callback(err);
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

/**
 * Express middleware: validate JWT, attach user to req, or reject with 401
 */
export function jwtMiddleware(req: Request, res: Response, next: NextFunction) {
  // Allow public paths
  if (PUBLIC_PATHS.some((path) => req.path.startsWith(path))) {
    return next();
  }

  // Allow internal service-to-service calls (gateway → API)
  if (checkInternalSecret(req)) {
    return next();
  }

  // Extract Bearer token — from Authorization header or ?token= query param (for EventSource SSE)
  let token = '';
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7);
  } else if (req.query.token && typeof req.query.token === 'string') {
    token = req.query.token;
  } else {
    return res.status(401).json({ error: 'Missing authorization token', code: 'UNAUTHORIZED' });
  }


  // Verify and decode JWT
  jwt.verify(
    token,
    getSigningKey,
    { algorithms: ['RS256'] },
    (err, decoded) => {
      if (err) {
        return res.status(401).json({
          error: 'Invalid or expired token',
          code: 'UNAUTHORIZED',
          details: err.message,
        });
      }

      // Attach user to request
      req.user = decoded as AuthUser;
      next();
    }
  );
}

/**
 * Helper: get current user or throw error
 */
export function requireUser(req: Request): AuthUser {
  if (!req.user) {
    throw new Error('User not authenticated');
  }
  return req.user;
}
