import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import type { LoginInput, Me, SetupInput, SetupStatus } from '@infra/shared';
import { API_PATH } from '@infra/shared';
import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';
import { api } from './client';
import { assertWebAuthnSupported, startAuthentication } from './webauthn';

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => (await api.get<Me>(API_PATH.AUTH.ME)).data,
    retry: false,
    staleTime: 60_000,
  });
}

/** Public bootstrap status: tells the login page whether to show setup vs login + which methods. */
export function useSetupStatus() {
  return useQuery({
    queryKey: ['setupStatus'],
    queryFn: async () => (await api.get<SetupStatus>(API_PATH.AUTH.SETUP)).data,
    retry: false,
  });
}

/** First-run: create the owner account (only valid while needsSetup). */
export function useSetup() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async (input: SetupInput) => (await api.post<Me>(API_PATH.AUTH.SETUP, input)).data,
    onSuccess: (me) => {
      qc.setQueryData(['me'], me);
      navigate('/');
    },
  });
}

export function useLogin() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async (input: LoginInput) => (await api.post<Me>(API_PATH.AUTH.LOGIN, input)).data,
    onSuccess: (me) => {
      qc.setQueryData(['me'], me);
      navigate('/');
    },
  });
}

/** Passwordless login: fetch options → run the authenticator ceremony → verify → set session. */
export function usePasskeyLogin() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async () => {
      assertWebAuthnSupported();
      const optionsJSON = (
        await api.post<PublicKeyCredentialRequestOptionsJSON>(API_PATH.AUTH.PASSKEY_LOGIN_OPTIONS)
      ).data;
      const response = await startAuthentication({ optionsJSON });
      return (await api.post<Me>(API_PATH.AUTH.PASSKEY_LOGIN_VERIFY, { response })).data;
    },
    onSuccess: (me) => {
      qc.setQueryData(['me'], me);
      navigate('/');
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: async () => {
      await api.post(API_PATH.AUTH.LOGOUT);
    },
    onSuccess: () => {
      qc.clear();
      navigate('/login');
    },
  });
}
