import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import {
  createHash,
  createPublicKey,
  type JsonWebKey,
  type KeyObject,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import axios, { type AxiosInstance } from 'axios';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { TELEGRAM_CALLBACK_PATH, type TelegramResult } from '@infra/shared';
import { CryptoService } from '../crypto/crypto.service';
import { AuthConfigService } from './auth-config.service';

// Telegram's OpenID Connect provider. Endpoints are constants on purpose: the token header's
// jku/x5u/jwk are never trusted, keys only ever come from this JWKS URL.
const ISSUER = 'https://oauth.telegram.org';
const AUTHORIZE_URL = `${ISSUER}/auth`;
const TOKEN_URL = `${ISSUER}/token`;
const JWKS_URL = `${ISSUER}/.well-known/jwks.json`;
// `profile` is what carries the numeric `id` claim. Telegram refuses it for EdDSA/ES256K keys,
// and jsonwebtoken can't verify those anyway, so only RS256 and ES256 are accepted.
const SCOPE = 'openid profile';
const ALGORITHMS = ['RS256', 'ES256'] as const;
type Algorithm = (typeof ALGORITHMS)[number];

export const TELEGRAM_FLOW_TTL_MS = 10 * 60 * 1000;
const HTTP_TIMEOUT_MS = 10_000;
const JWKS_TTL_MS = 60 * 60 * 1000;

export type TelegramFlowMode = 'login' | 'link';

// Everything the callback needs, kept in an encrypted cookie so there is no server-side store a
// stranger could flood (which would lock out an owner whose only sign-in method is Telegram).
const flowSchema = z.object({
  state: z.string().min(1),
  mode: z.enum(['login', 'link']),
  clientId: z.string().min(1),
  verifier: z.string().min(1),
  nonce: z.string().min(1),
  redirectUri: z.string().min(1),
  exp: z.number(),
});
type Flow = z.infer<typeof flowSchema>;

const tokenResponseSchema = z.object({ id_token: z.string().min(1) });

const jwksSchema = z.object({
  keys: z.array(
    z
      .object({
        kid: z.string().optional(),
        alg: z.string().optional(),
        use: z.string().optional(),
        kty: z.string(),
      })
      .passthrough(),
  ),
});
type Jwk = z.infer<typeof jwksSchema>['keys'][number];

// `id` is the stable numeric Telegram user ID (`sub` is opaque and differs per bot). It may arrive
// as a string or a number; it is required, there is deliberately no fallback to `sub`.
const claimsSchema = z.object({
  id: z
    .union([
      z.string().regex(/^\d+$/),
      z
        .number()
        .int()
        .positive()
        .refine((n) => Number.isSafeInteger(n)),
    ])
    .transform(String),
  preferred_username: z.string().optional(),
  name: z.string().optional(),
  nonce: z.string().optional(),
});

/**
 * A failed step of the round-trip. `detail` is safe to log: HTTP status, an OAuth error code or a
 * verifier message, never the authorization code, verifier or client secret.
 */
export class TelegramFlowError extends Error {
  constructor(
    readonly code: TelegramResult,
    readonly detail: string,
  ) {
    super(`${code}: ${detail}`);
  }
}

export interface TelegramIdentity {
  telegramId: string;
  displayName: string | null;
}

export interface TelegramCallbackOutcome {
  /** Fixed, panel-relative path to send the browser to. */
  redirectTo: string;
  /** Set on a successful login: the session cookie is issued for this user. */
  username?: string;
}

@Injectable()
export class TelegramOidcService {
  private readonly logger = new Logger(TelegramOidcService.name);
  private readonly http: AxiosInstance = axios.create({ timeout: HTTP_TIMEOUT_MS });
  private jwks: { keys: Jwk[]; fetchedAt: number } | null = null;
  // Imported keys by `alg:kid`; dropped whenever the JWKS is refetched.
  private readonly keyCache = new Map<string, KeyObject>();

  constructor(
    private readonly crypto: CryptoService,
    private readonly authConfig: AuthConfigService,
  ) {}

  /**
   * Begin a round-trip: returns the authorization URL and the encrypted flow cookie value. Login
   * needs a usable (enabled + linked) method; linking only needs the client settings saved.
   */
  async start(
    mode: TelegramFlowMode,
    requestOrigin: string | undefined,
  ): Promise<{ url: string; flowCookie: string }> {
    const row = await this.authConfig.requireRow();
    if (mode === 'login' && !this.authConfig.telegramUsable(row)) {
      throw new BadRequestException('Telegram sign-in is not enabled');
    }
    const client = this.authConfig.getTelegramClient(row);
    if (!client) {
      throw new BadRequestException(
        'Save the Telegram client ID, client secret and panel address first',
      );
    }
    // The flow cookie is set on the host the request came from; the callback lands on the saved
    // origin. If they differ the cookie never comes back, so fail early with a clear hint.
    if (requestOrigin && requestOrigin !== client.origin) {
      throw new BadRequestException(`Open the panel at ${client.origin} to use Telegram sign-in`);
    }

    const flow: Flow = {
      state: randomToken(),
      mode,
      clientId: client.clientId,
      verifier: randomToken(),
      nonce: randomToken(),
      redirectUri: client.origin + TELEGRAM_CALLBACK_PATH,
      exp: Date.now() + TELEGRAM_FLOW_TTL_MS,
    };
    const params = new URLSearchParams({
      client_id: client.clientId,
      redirect_uri: flow.redirectUri,
      response_type: 'code',
      scope: SCOPE,
      state: flow.state,
      nonce: flow.nonce,
      code_challenge: createHash('sha256').update(flow.verifier).digest('base64url'),
      code_challenge_method: 'S256',
    });
    return {
      url: `${AUTHORIZE_URL}?${params.toString()}`,
      flowCookie: Buffer.from(this.crypto.encrypt(JSON.stringify(flow))).toString('base64url'),
    };
  }

  /** The flow from the cookie if it decrypts, hasn't expired and its state matches the query. */
  readFlow(cookie: string | undefined, state: string | undefined): Flow | null {
    const flow = this.decodeFlow(cookie);
    if (!flow || !state || flow.exp < Date.now()) return null;
    const expected = Buffer.from(flow.state);
    const actual = Buffer.from(state);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    return flow;
  }

  /** Trade the authorization code for an id_token. */
  async exchangeCode(input: {
    code: string;
    redirectUri: string;
    verifier: string;
    clientId: string;
    clientSecret: string;
  }): Promise<string> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: input.code,
      redirect_uri: input.redirectUri,
      client_id: input.clientId,
      code_verifier: input.verifier,
    });
    let data: unknown;
    try {
      const res = await this.http.post<unknown>(TOKEN_URL, body, {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        auth: { username: input.clientId, password: input.clientSecret },
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      });
      data = res.data;
    } catch (e) {
      // Only the status and the OAuth error code: the AxiosError itself carries the Basic header,
      // the code and the verifier.
      throw new TelegramFlowError('exchange', describeHttpFailure(e));
    }
    // Telegram reports token errors with HTTP 200 and an `error` field.
    const oauthError = oauthErrorCode(data);
    if (oauthError) throw new TelegramFlowError('exchange', `HTTP 200 ${oauthError}`);
    const parsed = tokenResponseSchema.safeParse(data);
    if (!parsed.success) throw new TelegramFlowError('exchange', 'response has no id_token');
    return parsed.data.id_token;
  }

  /** Verify the id_token signature and claims, returning the Telegram user it identifies. */
  async verifyIdToken(
    idToken: string,
    expected: { clientId: string; nonce: string },
  ): Promise<TelegramIdentity> {
    const decoded = jwt.decode(idToken, { complete: true });
    if (!decoded || typeof decoded === 'string') throw tokenError('malformed id_token');
    const { alg, kid } = decoded.header;
    if (!isAllowedAlgorithm(alg)) throw tokenError(`unsupported alg ${String(alg).slice(0, 16)}`);
    if (typeof kid !== 'string' || !kid) throw tokenError('id_token has no kid');

    const key = await this.signingKey(kid, alg);
    let payload: string | jwt.JwtPayload;
    try {
      payload = jwt.verify(idToken, key, {
        algorithms: [alg],
        issuer: ISSUER,
        audience: expected.clientId,
        clockTolerance: 30,
        maxAge: '10m',
      });
    } catch (e) {
      throw tokenError(e instanceof Error ? e.message : 'verification failed');
    }
    if (typeof payload === 'string') throw tokenError('id_token payload is not an object');

    const claims = claimsSchema.safeParse(payload);
    if (!claims.success) throw tokenError('id_token has no valid id claim');
    // Whether Telegram echoes the nonce in the code flow isn't documented; PKCE and state already
    // bind the code to this browser, so only a present-but-wrong nonce is rejected.
    if (claims.data.nonce !== undefined && claims.data.nonce !== expected.nonce) {
      throw tokenError('nonce mismatch');
    }
    const { id, preferred_username: username, name } = claims.data;
    return { telegramId: id, displayName: username ? `@${username}` : name || null };
  }

  /**
   * Finish the round-trip started by `start()`. Always resolves to a fixed redirect path plus a
   * closed-enum result; Telegram's own error text is never echoed back.
   */
  async handleCallback(input: {
    code: string | undefined;
    state: string | undefined;
    error: string | undefined;
    flowCookie: string | undefined;
  }): Promise<TelegramCallbackOutcome> {
    const flow = this.readFlow(input.flowCookie, input.state);
    if (!flow) {
      // Still route a link attempt back to settings when the cookie itself is authentic.
      const mode = this.decodeFlow(input.flowCookie)?.mode;
      return this.fail(mode, 'state', input.flowCookie ? 'expired or state mismatch' : 'no cookie');
    }
    if (input.error || !input.code) {
      return this.fail(flow.mode, 'denied', input.error ? 'authorization declined' : 'no code');
    }

    try {
      const row = await this.authConfig.getRow();
      const client = row ? this.authConfig.getTelegramClient(row) : null;
      if (!client) return this.fail(flow.mode, 'config', 'client settings missing');
      // Settings saved mid-flow (they also drop the link): a link must prove the values that are
      // stored now, not the ones the round-trip started with.
      if (
        flow.clientId !== client.clientId ||
        flow.redirectUri !== client.origin + TELEGRAM_CALLBACK_PATH
      ) {
        return this.fail(flow.mode, 'config', 'client settings changed during the round-trip');
      }

      const idToken = await this.exchangeCode({
        code: input.code,
        redirectUri: flow.redirectUri,
        verifier: flow.verifier,
        clientId: client.clientId,
        clientSecret: client.clientSecret,
      });
      const identity = await this.verifyIdToken(idToken, {
        clientId: client.clientId,
        nonce: flow.nonce,
      });

      if (flow.mode === 'link') {
        await this.authConfig.linkTelegram(identity.telegramId, identity.displayName);
        return { redirectTo: '/settings/auth?telegram=linked' };
      }
      // Re-read: the round-trip took a while and the owner may have changed settings meanwhile.
      const current = await this.authConfig.getRow();
      if (!current || !this.authConfig.telegramUsable(current)) {
        return this.fail(flow.mode, 'disabled', 'method not usable');
      }
      if (identity.telegramId !== current.telegramUserId) {
        return this.fail(flow.mode, 'mismatch', 'not the linked account');
      }
      return { redirectTo: '/', username: current.username };
    } catch (e) {
      if (e instanceof TelegramFlowError) return this.fail(flow.mode, e.code, e.detail);
      // Anything else (DB, decryption) is ours, not Telegram's; report it as a failed exchange.
      return this.fail(flow.mode, 'exchange', e instanceof Error ? e.message : 'unexpected error');
    }
  }

  private decodeFlow(cookie: string | undefined): Flow | null {
    if (!cookie) return null;
    try {
      const json = this.crypto.decrypt(Buffer.from(cookie, 'base64url'));
      const parsed = flowSchema.safeParse(JSON.parse(json));
      return parsed.success ? parsed.data : null;
    } catch {
      return null;
    }
  }

  private fail(
    mode: TelegramFlowMode | undefined,
    code: TelegramResult,
    detail: string,
  ): TelegramCallbackOutcome {
    this.logger.warn(`Telegram ${mode ?? 'sign-in'} failed: ${code} (${detail})`);
    const base = mode === 'link' ? '/settings/auth' : '/login';
    return { redirectTo: `${base}?telegram=${code}` };
  }

  /** Public key for `kid`, refetching the JWKS once when the key isn't known yet. */
  private async signingKey(kid: string, alg: Algorithm): Promise<KeyObject> {
    let refreshed = false;
    if (!this.jwks || Date.now() - this.jwks.fetchedAt > JWKS_TTL_MS) {
      await this.refreshJwks();
      refreshed = true;
    }
    let key = this.findKey(kid, alg);
    if (!key && !refreshed) {
      await this.refreshJwks();
      key = this.findKey(kid, alg);
    }
    if (!key) throw tokenError('no usable signing key for kid');
    return key;
  }

  private findKey(kid: string, alg: Algorithm): KeyObject | null {
    const cacheKey = `${alg}:${kid}`;
    const cached = this.keyCache.get(cacheKey);
    if (cached) return cached;
    for (const jwk of this.jwks?.keys ?? []) {
      if (jwk.kid !== kid) continue;
      if (jwk.alg !== undefined && jwk.alg !== alg) continue;
      if (jwk.use !== undefined && jwk.use !== 'sig') continue;
      try {
        const key = createPublicKey({ key: jwk as JsonWebKey, format: 'jwk' });
        this.keyCache.set(cacheKey, key);
        return key;
      } catch {
        // Telegram also publishes key types node may not import; one bad key must not break others.
      }
    }
    return null;
  }

  private async refreshJwks(): Promise<void> {
    let data: unknown;
    try {
      const res = await this.http.get<unknown>(JWKS_URL, {
        signal: AbortSignal.timeout(HTTP_TIMEOUT_MS),
      });
      data = res.data;
    } catch (e) {
      throw tokenError(`JWKS fetch failed: ${describeHttpFailure(e)}`);
    }
    const parsed = jwksSchema.safeParse(data);
    if (!parsed.success) throw tokenError('JWKS response is malformed');
    this.jwks = { keys: parsed.data.keys, fetchedAt: Date.now() };
    this.keyCache.clear();
  }
}

function randomToken(): string {
  return randomBytes(32).toString('base64url');
}

function tokenError(detail: string): TelegramFlowError {
  return new TelegramFlowError('token', detail);
}

function isAllowedAlgorithm(alg: unknown): alg is Algorithm {
  return (ALGORITHMS as readonly unknown[]).includes(alg);
}

/** An OAuth `error` code from a response body, if it looks like one (logged, so kept tame). */
function oauthErrorCode(data: unknown): string | null {
  if (!data || typeof data !== 'object' || !('error' in data)) return null;
  const error = (data as { error: unknown }).error;
  if (typeof error === 'string' && /^[\w.-]{1,64}$/.test(error)) return error;
  return 'error';
}

function describeHttpFailure(e: unknown): string {
  if (!axios.isAxiosError(e)) return 'request failed';
  if (!e.response) return `network error ${e.code ?? ''}`.trim();
  const oauthError = oauthErrorCode(e.response.data);
  return `HTTP ${e.response.status}${oauthError ? ` ${oauthError}` : ''}`;
}
