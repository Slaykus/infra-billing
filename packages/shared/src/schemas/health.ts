import { z } from 'zod';

export const healthSchema = z.object({
  status: z.literal('ok').describe('Overall health status'),
  db: z.literal('up').describe('Database connection status'),
});
export type Health = z.infer<typeof healthSchema>;

export const buildInfoSchema = z.object({
  version: z.string().describe('Application version'),
  buildTime: z.string().describe('Build timestamp'),
  gitCommit: z.string().describe('Git commit hash'),
  nodeVersion: z.string().describe('Node.js runtime version'),
  // Whether the Swagger docs are exposed (DOCS=true), drives the header docs link.
  docs: z.boolean().describe('Swagger docs exposed'),
});
export type BuildInfo = z.infer<typeof buildInfoSchema>;
