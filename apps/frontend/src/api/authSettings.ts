import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuthConfig, Passkey, TelegramStartResponse, UpdateAuthConfig } from '@infra/shared';
import { API_PATH } from '@infra/shared';
import type { PublicKeyCredentialCreationOptionsJSON } from '@simplewebauthn/browser';
import { api } from './client';
import { assertWebAuthnSupported, startRegistration } from './webauthn';

export function useAuthConfig() {
  return useQuery({
    queryKey: ['authConfig'],
    queryFn: async () => (await api.get<AuthConfig>(API_PATH.AUTH.CONFIG)).data,
  });
}

export function useUpdateAuthConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dto: UpdateAuthConfig) =>
      (await api.patch<AuthConfig>(API_PATH.AUTH.CONFIG, dto)).data,
    onSuccess: (cfg) => {
      qc.setQueryData(['authConfig'], cfg);
      qc.invalidateQueries({ queryKey: ['me'] }); // username may have changed
      qc.invalidateQueries({ queryKey: ['setupStatus'] }); // enabled methods may have changed
    },
  });
}

export function usePasskeys() {
  return useQuery({
    queryKey: ['passkeys'],
    queryFn: async () => (await api.get<Passkey[]>(API_PATH.AUTH.PASSKEYS)).data,
  });
}

/** Register a new passkey: fetch options → run the authenticator ceremony → verify → store. */
export function useRegisterPasskey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (name?: string) => {
      assertWebAuthnSupported();
      const optionsJSON = (
        await api.post<PublicKeyCredentialCreationOptionsJSON>(
          API_PATH.AUTH.PASSKEY_REGISTER_OPTIONS,
        )
      ).data;
      const response = await startRegistration({ optionsJSON });
      await api.post(API_PATH.AUTH.PASSKEY_REGISTER_VERIFY, { response, name });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['passkeys'] });
      qc.invalidateQueries({ queryKey: ['authConfig'] });
    },
  });
}

export function useDeletePasskey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (uuid: string) => {
      await api.delete(API_PATH.AUTH.PASSKEY_BY_ID(uuid));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['passkeys'] }),
  });
}

/** Link the owner's Telegram account: same OIDC round-trip as sign-in, back to the settings page. */
export function useTelegramLink() {
  return useMutation({
    mutationFn: async () =>
      (await api.post<TelegramStartResponse>(API_PATH.AUTH.TELEGRAM_LINK)).data,
    onSuccess: ({ url }) => window.location.assign(url),
  });
}

export function useTelegramUnlink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.delete(API_PATH.AUTH.TELEGRAM_LINK);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['authConfig'] });
      qc.invalidateQueries({ queryKey: ['setupStatus'] });
    },
  });
}
