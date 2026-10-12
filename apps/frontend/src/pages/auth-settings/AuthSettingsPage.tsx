import { IconLoader2 } from '@tabler/icons-react';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useLayoutEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { type AuthConfig, type Passkey, telegramResultSchema } from '@infra/shared';
import {
  useAuthConfig,
  useDeletePasskey,
  usePasskeys,
  useRegisterPasskey,
  useTelegramLink,
  useTelegramUnlink,
  useUpdateAuthConfig,
} from '@/api/authSettings';
import { apiErrorMessage } from '@/api/client';
import { mapPasskeyError, passkeySupported } from '@/api/webauthn';
import { PageHeader } from '@/components/PageHeader';
import { useDisclosure } from '@/hooks/useDisclosure';
import { notifyError, notifySuccess } from '@/utils/notify';
import { AuthMethodsCard, type MethodsFormValues } from './AuthMethodsCard';
import { PasskeysCard } from './PasskeysCard';

// One toast per callback result: StrictMode runs the effect twice in development.
const TELEGRAM_TOAST_ID = 'telegram-link-result';

// Matches the server's normalisation of the panel origin, to tell a real change from formatting.
const normalizeOrigin = (v: string) => v.trim().replace(/\/+$/, '');

// Telegram counts as a way in only once it is linked and the saved client is complete.
function telegramReady(config: AuthConfig): boolean {
  return (
    config.telegramUserId !== '' &&
    config.telegramClientId !== '' &&
    config.hasTelegramClientSecret &&
    config.telegramOrigin !== ''
  );
}

function toFormValues(config: AuthConfig): MethodsFormValues {
  return {
    passwordEnabled: config.passwordEnabled,
    passkeyEnabled: config.passkeyEnabled,
    rpId: config.rpId,
    rpName: config.rpName,
    rpOrigin: config.rpOrigin,
    telegramEnabled: config.telegramEnabled,
    telegramClientId: config.telegramClientId,
    // Write-only: the stored secret never comes back, so a save also clears what was typed.
    telegramClientSecret: '',
    // Most panels are opened at their public address, so that's the likely right value.
    telegramOrigin: config.telegramOrigin || window.location.origin,
  };
}

// Mirrors the server's lockout rule for instant feedback: whatever changes, at least one
// working sign-in method has to remain.
function canStillSignIn(s: {
  passwordEnabled: boolean;
  passkeyEnabled: boolean;
  passkeyCount: number;
  telegramUsable: boolean;
}): boolean {
  return s.passwordEnabled || (s.passkeyEnabled && s.passkeyCount > 0) || s.telegramUsable;
}

export function AuthSettingsPage() {
  const { t } = useTranslation();
  const { data: config } = useAuthConfig();
  const { data: passkeys } = usePasskeys();
  const updateConfig = useUpdateAuthConfig();
  const registerPasskey = useRegisterPasskey();
  const deletePasskey = useDeletePasskey();
  const telegramLink = useTelegramLink();
  const telegramUnlink = useTelegramUnlink();
  const qc = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const canPasskey = passkeySupported();
  const passkeyCount = passkeys?.length ?? 0;
  const [pkOpen, pkDisc] = useDisclosure(false);
  const [tgOpen, tgDisc] = useDisclosure(false);

  const methodsForm = useForm<MethodsFormValues>({
    defaultValues: {
      passwordEnabled: true,
      passkeyEnabled: false,
      rpId: '',
      rpName: '',
      rpOrigin: '',
      telegramEnabled: false,
      telegramClientId: '',
      telegramClientSecret: '',
      telegramOrigin: '',
    },
    mode: 'onSubmit',
  });

  // useLayoutEffect (not useEffect) so the seeded values are committed before the browser paints.
  // react-hook-form's reset is referentially stable, so the effect still re-seeds only when the
  // config loads or refetches.
  const { reset } = methodsForm;
  useLayoutEffect(() => {
    if (config) reset(toFormValues(config));
  }, [config, reset]);

  // Back from Telegram after linking: /settings/auth?telegram=linked|<error code>.
  const telegramResult = searchParams.get('telegram');
  const openTg = tgDisc.open;
  useEffect(() => {
    if (telegramResult === null) return;
    const parsed = telegramResultSchema.safeParse(telegramResult);
    if (parsed.success) {
      if (parsed.data === 'linked') {
        notifySuccess(t('auth.telegram.linkedToast'), { id: TELEGRAM_TOAST_ID });
      } else {
        const message =
          parsed.data === 'denied'
            ? t('auth.telegram.linkDenied')
            : t(`login.telegramErrors.${parsed.data}`);
        notifyError(message, { id: TELEGRAM_TOAST_ID });
      }
      qc.invalidateQueries({ queryKey: ['authConfig'] });
      qc.invalidateQueries({ queryKey: ['setupStatus'] });
      openTg();
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete('telegram');
        return next;
      },
      { replace: true },
    );
  }, [telegramResult, openTg, qc, setSearchParams, t]);

  const useCurrentHost = () => {
    const v = methodsForm.getValues();
    methodsForm.setValue('rpId', window.location.hostname);
    methodsForm.setValue('rpName', v.rpName || 'Infra Billing');
    methodsForm.setValue('rpOrigin', window.location.origin);
  };

  // shouldDirty: the link button waits for a save, so the change must count as unsaved.
  const useCurrentOrigin = () => {
    methodsForm.setValue('telegramOrigin', window.location.origin, { shouldDirty: true });
  };

  const saveMethods = async () => {
    if (!config) return;
    const v = methodsForm.getValues();
    // The address is only a prefilled suggestion until Telegram is actually being set up; saving
    // passwords or passkeys must not pin whatever host the page happens to be open on.
    const saveOrigin =
      config.telegramOrigin !== '' ||
      config.hasTelegramClientSecret ||
      v.telegramClientId.trim() !== '' ||
      v.telegramClientSecret.trim() !== '' ||
      methodsForm.getFieldState('telegramOrigin').isDirty;
    // New client values or a new address drop the link on the server, same as here.
    const credsChanged =
      v.telegramClientId.trim() !== config.telegramClientId ||
      (saveOrigin && normalizeOrigin(v.telegramOrigin) !== config.telegramOrigin) ||
      v.telegramClientSecret.trim() !== '';
    const ok = canStillSignIn({
      passwordEnabled: v.passwordEnabled,
      passkeyEnabled: v.passkeyEnabled,
      passkeyCount,
      telegramUsable: v.telegramEnabled && !credsChanged && telegramReady(config),
    });
    if (!ok) {
      notifyError(
        config.passwordEnabled && !v.passwordEnabled
          ? t('auth.methods.needPasskeyFirst')
          : t('auth.methods.lastMethodError'),
      );
      return;
    }
    try {
      const saved = await updateConfig.mutateAsync({
        passwordEnabled: v.passwordEnabled,
        passkeyEnabled: v.passkeyEnabled,
        rpId: v.rpId,
        rpName: v.rpName,
        rpOrigin: v.rpOrigin,
        telegramEnabled: v.telegramEnabled,
        telegramClientId: v.telegramClientId,
        telegramClientSecret: v.telegramClientSecret || undefined,
        telegramOrigin: saveOrigin ? v.telegramOrigin : undefined,
      });
      // Reset from the response, not via the config effect: when nothing visible changed (e.g. only
      // the write-only secret), the cached config keeps its identity and the effect wouldn't run,
      // leaving the typed secret in place and the form dirty.
      reset(toFormValues(saved));
      notifySuccess(t('auth.methods.saved'));
    } catch (e) {
      notifyError(apiErrorMessage(e));
    }
  };

  // No name prompt: trigger the ceremony straight away. We auto-name the key ("Passkey", "Passkey 2", …).
  const addPasskey = async () => {
    try {
      await registerPasskey.mutateAsync(undefined);
      notifySuccess(t('auth.passkeys.added'));
    } catch (e) {
      const m = mapPasskeyError(e);
      if (!m.cancelled) notifyError(apiErrorMessage(e, m.message));
    }
  };

  const removePasskey = async (pk: Passkey) => {
    if (!config) return;
    const ok = canStillSignIn({
      passwordEnabled: config.passwordEnabled,
      passkeyEnabled: config.passkeyEnabled,
      passkeyCount: passkeyCount - 1,
      telegramUsable: config.telegramEnabled && telegramReady(config),
    });
    if (!ok) {
      notifyError(t('auth.passkeys.lastMethodError'));
      return;
    }
    const label = pk.name ?? t('auth.passkeys.unnamed');
    if (!window.confirm(t('auth.passkeys.confirmDelete', { name: label }))) return;
    try {
      await deletePasskey.mutateAsync(pk.uuid);
      notifySuccess(t('common.deleted'));
    } catch (e) {
      notifyError(apiErrorMessage(e));
    }
  };

  const linkTelegram = () =>
    telegramLink.mutate(undefined, { onError: (e) => notifyError(apiErrorMessage(e)) });

  const unlinkTelegram = async () => {
    if (!config) return;
    const ok = canStillSignIn({
      passwordEnabled: config.passwordEnabled,
      passkeyEnabled: config.passkeyEnabled,
      passkeyCount,
      telegramUsable: false,
    });
    if (!ok) {
      notifyError(t('auth.methods.lastMethodError'));
      return;
    }
    if (!window.confirm(t('auth.telegram.confirmUnlink'))) return;
    try {
      await telegramUnlink.mutateAsync();
      notifySuccess(t('auth.telegram.unlinked'));
    } catch (e) {
      notifyError(apiErrorMessage(e));
    }
  };

  // Wait for the real config before rendering toggles. Avoids a flash of the default
  // (password on / passkey off) state for a passkey-only owner.
  if (!config) {
    return (
      <div className="flex h-60 items-center justify-center">
        <IconLoader2 className="size-5 animate-spin text-ink-3" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t('auth.title')} />

      {/* items-start: expanding one card (passkey settings) must not stretch the other. */}
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <AuthMethodsCard
          form={methodsForm}
          config={config}
          pkOpen={pkOpen}
          onTogglePk={pkDisc.toggle}
          tgOpen={tgOpen}
          onToggleTg={tgDisc.toggle}
          onUseCurrentHost={useCurrentHost}
          onUseCurrentOrigin={useCurrentOrigin}
          onSave={saveMethods}
          saving={updateConfig.isPending}
          onLink={linkTelegram}
          linking={telegramLink.isPending}
          onUnlink={unlinkTelegram}
          unlinking={telegramUnlink.isPending}
        />

        <PasskeysCard
          passkeys={passkeys}
          canPasskey={canPasskey}
          adding={registerPasskey.isPending}
          removing={deletePasskey.isPending}
          onAdd={addPasskey}
          onRemove={removePasskey}
        />
      </div>
    </div>
  );
}
