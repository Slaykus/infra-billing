import { SetMetadata } from '@nestjs/common';

export const IS_SESSION_ONLY_KEY = 'isSessionOnly';

/** Marks a route/controller as admin-session-only — forbidden for API-token (Bearer) auth. */
export const SessionOnly = () => SetMetadata(IS_SESSION_ONLY_KEY, true);
