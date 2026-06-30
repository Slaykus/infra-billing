import { z } from 'zod';

// netcup SCP OAuth2 device flow, run in-panel so the owner never needs an external script.
// `start` kicks off device authorization; the frontend then polls until the user approves
// in their browser, at which point the refresh token is returned to fill the provider form.

/** Response of POST /providers/netcup/device/start. */
export const netcupDeviceStartSchema = z.object({
  /** Opaque OAuth device code; echoed back to `poll`. */
  deviceCode: z.string().describe('OAuth device code'),
  /** Short code the user confirms in the browser. */
  userCode: z.string().describe('User confirmation code'),
  verificationUri: z.string().describe('Verification URL'),
  /** Verification URL with the code pre-filled (open this in a browser). */
  verificationUriComplete: z.string().describe('Verification URL with code'),
  /** Seconds the frontend should wait between polls. */
  interval: z.number().int().positive().describe('Poll interval seconds'),
  /** Seconds until the device code expires. */
  expiresIn: z.number().int().positive().describe('Device code lifetime seconds'),
});
export type NetcupDeviceStart = z.infer<typeof netcupDeviceStartSchema>;

/** Request body of POST /providers/netcup/device/poll. */
export const netcupDevicePollSchema = z.object({
  deviceCode: z.string().min(1).describe('OAuth device code'),
});
export type NetcupDevicePoll = z.infer<typeof netcupDevicePollSchema>;

export const netcupDevicePollStatusSchema = z.enum([
  'pending', // user has not approved yet, keep polling
  'authorized', // approved → refreshToken present
  'expired', // device code expired → restart
  'denied', // user declined
  'error', // anything else
]);
export type NetcupDevicePollStatus = z.infer<typeof netcupDevicePollStatusSchema>;

/** Response of POST /providers/netcup/device/poll. */
export const netcupDevicePollResultSchema = z.object({
  status: netcupDevicePollStatusSchema.describe('Device flow status'),
  /** Present only when status === 'authorized'. */
  refreshToken: z.string().describe('OAuth refresh token').optional(),
  /** Human-readable detail for error/denied/expired. */
  message: z.string().describe('Error or status detail').optional(),
});
export type NetcupDevicePollResult = z.infer<typeof netcupDevicePollResultSchema>;
