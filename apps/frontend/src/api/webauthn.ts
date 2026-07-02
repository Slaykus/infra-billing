import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
  WebAuthnError,
} from '@simplewebauthn/browser';
import i18n from '@/i18n';

/** Thrown when WebAuthn can't run in this context (insecure origin / unsupported browser). */
class PasskeyUnsupported extends Error {}

/** WebAuthn needs a secure context (https or localhost) and browser support. */
export function passkeySupported(): boolean {
  return typeof window !== 'undefined' && window.isSecureContext && browserSupportsWebAuthn();
}

export function assertWebAuthnSupported(): void {
  if (!passkeySupported()) {
    throw new PasskeyUnsupported(i18n.t('auth.passkeys.unsupported'));
  }
}

/**
 * Normalize a thrown ceremony error: `cancelled` for user-abort (caller stays silent), otherwise a
 * friendly message. Pass the message to `apiErrorMessage(e, message)` so HTTP errors from the
 * verify call still surface their server text.
 */
export function mapPasskeyError(e: unknown): { cancelled: boolean; message: string } {
  if (e instanceof PasskeyUnsupported) return { cancelled: false, message: e.message };
  if (e instanceof WebAuthnError) {
    const causeName = (e.cause as { name?: string } | undefined)?.name;
    if (e.code === 'ERROR_CEREMONY_ABORTED' || causeName === 'NotAllowedError') {
      return { cancelled: true, message: '' };
    }
    if (e.code === 'ERROR_INVALID_DOMAIN' || e.code === 'ERROR_INVALID_RP_ID') {
      return { cancelled: false, message: i18n.t('auth.passkeys.rpMismatch') };
    }
    return { cancelled: false, message: e.message };
  }
  return { cancelled: false, message: i18n.t('auth.passkeys.failed') };
}

export { startAuthentication, startRegistration };
