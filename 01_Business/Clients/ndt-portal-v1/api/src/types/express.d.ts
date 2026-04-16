/**
 * Augments the Express Request type to include `rawBody`,
 * captured by the express.json verify callback in index.ts.
 * Used for HMAC signature verification on integration webhooks.
 */
declare namespace Express {
  interface Request {
    rawBody?: Buffer;
  }
}
