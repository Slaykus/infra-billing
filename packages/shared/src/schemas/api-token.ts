import { z } from 'zod';
import { isoDateSchema, uuidSchema } from './common';

// The token value is included in the response: it's stored as-is and re-copyable from the list.
export const apiTokenSchema = z.object({
  uuid: uuidSchema.describe('API token UUID'),
  tokenName: z.string().describe('Token display name'),
  token: z.string().describe('Token value'),
  lastUsedAt: isoDateSchema.describe('Last used timestamp').nullable(),
  createdAt: isoDateSchema.describe('Creation timestamp'),
});
export type ApiToken = z.infer<typeof apiTokenSchema>;

export const createApiTokenSchema = z.object({
  tokenName: z.string().min(1).describe('Token display name'),
});
export type CreateApiToken = z.infer<typeof createApiTokenSchema>;
