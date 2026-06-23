import { randomBytes } from 'node:crypto';

/** A fresh API token: 256-bit URL-safe random with an `ib_` prefix (infra-billing). */
export function generateToken(): string {
  return `ib_${randomBytes(32).toString('base64url')}`;
}
