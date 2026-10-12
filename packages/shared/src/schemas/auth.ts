import { z } from 'zod';

export const loginSchema = z.object({
  username: z.string().min(1).describe('Owner username'),
  password: z.string().min(1).describe('Owner password'),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const meSchema = z.object({
  username: z.string().describe('Logged-in username'),
});
export type Me = z.infer<typeof meSchema>;

// First-run / login-page bootstrap (public). Drives the setup-vs-login screen and which
// methods to render.
export const setupStatusSchema = z.object({
  needsSetup: z.boolean().describe('First-run setup required'),
  passwordEnabled: z.boolean().describe('Password login enabled'),
  passkeyEnabled: z.boolean().describe('Passkey login enabled'),
  telegramEnabled: z.boolean().describe('Telegram login enabled and linked'),
});
export type SetupStatus = z.infer<typeof setupStatusSchema>;

// First-run account creation (public, only when needsSetup).
export const setupSchema = z.object({
  username: z.string().min(1).max(64).describe('New owner username'),
  password: z.string().min(8).max(128).describe('New owner password'),
});
export type SetupInput = z.infer<typeof setupSchema>;

// Authenticated auth configuration (GET /auth/config). Never includes hash or secret.
export const authConfigSchema = z.object({
  username: z.string().describe('Owner username'),
  passwordEnabled: z.boolean().describe('Password login enabled'),
  passkeyEnabled: z.boolean().describe('Passkey login enabled'),
  rpId: z.string().describe('Relying Party ID'),
  rpName: z.string().describe('Relying Party name'),
  rpOrigin: z.string().describe('Relying Party origin'),
  telegramEnabled: z.boolean().describe('Telegram login enabled'),
  telegramClientId: z.string().describe('Telegram OIDC client ID (bot ID)'),
  hasTelegramClientSecret: z.boolean().describe('Telegram OIDC client secret is stored'),
  telegramOrigin: z.string().describe('Public panel origin used for the Telegram redirect URI'),
  telegramUserId: z.string().describe('Linked owner Telegram user ID (empty when not linked)'),
  telegramDisplayName: z.string().describe('Linked Telegram account label (@username or name)'),
});
export type AuthConfig = z.infer<typeof authConfigSchema>;

// The panel's public origin (scheme://host[:port], no path). Telegram redirects back to
// <origin>/api/auth/telegram/callback, which must match BotFather byte for byte, so the value is
// stored explicitly instead of being guessed from request headers. A trailing slash is dropped.
const panelOriginSchema = z
  .string()
  .max(2048)
  .transform((v) => v.trim().replace(/\/+$/, ''))
  .refine((v) => v === '' || isHttpOrigin(v), {
    message: 'Expected an origin like https://panel.example.com',
  });

function isHttpOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') && url.origin === value;
  } catch {
    return false;
  }
}

// Username is set once at setup and is immutable afterwards. It's intentionally not updatable here.
export const updateAuthConfigSchema = z.object({
  passwordEnabled: z.boolean().describe('Enable password login').optional(),
  passkeyEnabled: z.boolean().describe('Enable passkey login').optional(),
  // Owner-set Relying Party config. Bounded to keep the singleton row sane; format isn't enforced
  // (a bad value only breaks the owner's own passkey ceremonies, fixable in the same screen).
  rpId: z.string().max(253).describe('Relying Party ID').optional(),
  rpName: z.string().max(128).describe('Relying Party name').optional(),
  rpOrigin: z.string().max(2048).describe('Relying Party origin').optional(),
  // Changing the client ID, secret or origin drops the Telegram link: the owner re-links, which
  // proves the new values work before Telegram can be relied on again.
  telegramEnabled: z
    .boolean()
    .describe('Enable Telegram login (requires a linked account)')
    .optional(),
  telegramClientId: z
    .string()
    .trim()
    .regex(/^\d{0,20}$/, 'Client ID is the numeric bot ID')
    .describe('Telegram OIDC client ID (bot ID)')
    .optional(),
  // Write-only: empty or omitted keeps the stored secret.
  telegramClientSecret: z
    .string()
    .trim()
    .max(256)
    .describe('Telegram OIDC client secret')
    .optional(),
  telegramOrigin: panelOriginSchema.describe('Public panel origin').optional(),
});
export type UpdateAuthConfig = z.infer<typeof updateAuthConfigSchema>;

// Start of a Telegram OIDC round-trip: the browser navigates to this authorization URL.
export const telegramStartResponseSchema = z.object({
  url: z.string().describe('Telegram authorization URL to navigate to'),
});
export type TelegramStartResponse = z.infer<typeof telegramStartResponseSchema>;

// Outcome of the Telegram callback, passed back to the SPA as `?telegram=<result>`.
export const telegramResultSchema = z.enum([
  'linked',
  'denied',
  'state',
  'config',
  'exchange',
  'token',
  'mismatch',
  'disabled',
]);
export type TelegramResult = z.infer<typeof telegramResultSchema>;

// A registered passkey, as listed in the settings tab (no public key / secrets).
export const passkeySchema = z.object({
  uuid: z.string().describe('Passkey UUID'),
  name: z.string().describe('Passkey name').nullable(),
  deviceType: z.string().describe('Authenticator device type').nullable(),
  backedUp: z.boolean().describe('Credential backed up'),
  createdAt: z.string().describe('Registration timestamp'),
  lastUsedAt: z.string().describe('Last used timestamp').nullable(),
});
export type Passkey = z.infer<typeof passkeySchema>;
