import { type AuthConfig, TELEGRAM_CALLBACK_PATH } from '@infra/shared';
import { IconBrandTelegram, IconFingerprint, IconLoader2, IconPassword } from '@tabler/icons-react';
import { Controller, type UseFormReturn, useFormState, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { CopyButton } from '@/components/CopyButton';
import { CardHeadRow } from '@/components/ink/CardHeadRow';
import { InkGlyph } from '@/components/ink/InkGlyph';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordInput } from '@/components/PasswordInput';
import { Separator } from '@/components/ui/separator';
import { MethodRow } from './MethodRow';

export interface MethodsFormValues {
  passwordEnabled: boolean;
  passkeyEnabled: boolean;
  rpId: string;
  rpName: string;
  rpOrigin: string;
  telegramEnabled: boolean;
  telegramClientId: string;
  /** Write-only: empty keeps the stored secret. */
  telegramClientSecret: string;
  telegramOrigin: string;
}

interface AuthMethodsCardProps {
  form: UseFormReturn<MethodsFormValues>;
  config: AuthConfig;
  pkOpen: boolean;
  onTogglePk: () => void;
  tgOpen: boolean;
  onToggleTg: () => void;
  onUseCurrentHost: () => void;
  onUseCurrentOrigin: () => void;
  onSave: () => void;
  saving: boolean;
  onLink: () => void;
  linking: boolean;
  onUnlink: () => void;
  unlinking: boolean;
}

// Password is a plain on/off toggle; passkey expands to its WebAuthn relying-party settings,
// Telegram to its OIDC client and the link to the owner's account.
export function AuthMethodsCard({
  form,
  config,
  pkOpen,
  onTogglePk,
  tgOpen,
  onToggleTg,
  onUseCurrentHost,
  onUseCurrentOrigin,
  onSave,
  saving,
  onLink,
  linking,
  onUnlink,
  unlinking,
}: AuthMethodsCardProps) {
  const { t } = useTranslation();
  const { isDirty } = useFormState({ control: form.control });
  const origin = useWatch({ control: form.control, name: 'telegramOrigin' });

  // Same normalisation as the server, so the URL copied into BotFather is the one it will send.
  const normalizedOrigin = origin.trim().replace(/\/+$/, '');
  const redirectUrl = normalizedOrigin ? `${normalizedOrigin}${TELEGRAM_CALLBACK_PATH}` : '';
  const linked = config.telegramUserId !== '';
  const linkedLabel =
    config.telegramDisplayName || t('auth.telegram.userId', { id: config.telegramUserId });
  // Linking runs against the saved client, so unsaved edits would test the wrong values.
  const canLink =
    !isDirty &&
    config.telegramClientId !== '' &&
    config.hasTelegramClientSecret &&
    config.telegramOrigin !== '';
  // The flow cookie and the callback live on the saved origin; started elsewhere it can't finish.
  const originMismatch =
    config.telegramOrigin !== '' && window.location.origin !== config.telegramOrigin;

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardHeadRow title={t('auth.methods.title')} />

      <CardContent className="py-1">
        <Controller
          control={form.control}
          name="passwordEnabled"
          render={({ field }) => (
            <MethodRow
              icon={IconPassword}
              title={t('auth.methods.password')}
              description={t('auth.methods.passwordDescription')}
              enabled={field.value}
              onToggle={field.onChange}
            />
          )}
        />
      </CardContent>

      <Separator className="bg-hairline" />

      <CardContent className="py-1">
        <Controller
          control={form.control}
          name="passkeyEnabled"
          render={({ field }) => (
            <MethodRow
              icon={IconFingerprint}
              title={t('auth.methods.passkey')}
              description={t('auth.methods.passkeyDescription')}
              enabled={field.value}
              onToggle={field.onChange}
              opened={pkOpen}
              onToggleOpen={onTogglePk}
            >
              <div className="space-y-4">
                <Alert>
                  <InkGlyph state="warn" />
                  <AlertDescription className="text-foreground">
                    {t('auth.methods.warning')}
                  </AlertDescription>
                </Alert>
                <div className="space-y-1.5">
                  <Label htmlFor="auth-rp-id">{t('auth.methods.rpId')}</Label>
                  <p className="text-[13px] text-ink-2">{t('auth.methods.rpIdDescription')}</p>
                  <Input id="auth-rp-id" placeholder="example.com" {...form.register('rpId')} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="auth-rp-name">{t('auth.methods.rpName')}</Label>
                  <Input
                    id="auth-rp-name"
                    placeholder="Infra Billing"
                    {...form.register('rpName')}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="auth-rp-origin">{t('auth.methods.rpOrigin')}</Label>
                  <p className="text-[13px] text-ink-2">{t('auth.methods.rpOriginDescription')}</p>
                  <Input
                    id="auth-rp-origin"
                    placeholder="https://example.com"
                    {...form.register('rpOrigin')}
                  />
                </div>
                <div>
                  <Button type="button" variant="ghost" size="sm" onClick={onUseCurrentHost}>
                    {t('auth.methods.useCurrent')}
                  </Button>
                </div>
              </div>
            </MethodRow>
          )}
        />
      </CardContent>

      <Separator className="bg-hairline" />

      <CardContent className="py-1">
        <Controller
          control={form.control}
          name="telegramEnabled"
          render={({ field }) => (
            <MethodRow
              icon={IconBrandTelegram}
              title={t('auth.methods.telegram')}
              description={t('auth.methods.telegramDescription')}
              enabled={field.value}
              onToggle={field.onChange}
              switchDisabled={!linked}
              switchHint={t('auth.telegram.linkFirst')}
              opened={tgOpen}
              onToggleOpen={onToggleTg}
            >
              <div className="space-y-4">
                <ol className="list-decimal space-y-1 pl-5 text-[13px] text-ink-2">
                  <li>{t('auth.telegram.steps.open')}</li>
                  <li>{t('auth.telegram.steps.switch')}</li>
                  <li>{t('auth.telegram.steps.urls')}</li>
                  <li>{t('auth.telegram.steps.credentials')}</li>
                </ol>

                <div className="space-y-1.5">
                  <Label htmlFor="auth-tg-origin">{t('auth.telegram.origin')}</Label>
                  <p className="text-[13px] text-ink-2">{t('auth.telegram.originDescription')}</p>
                  <div className="flex items-center gap-2">
                    <Input
                      id="auth-tg-origin"
                      placeholder="https://example.com"
                      {...form.register('telegramOrigin')}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="shrink-0"
                      onClick={onUseCurrentOrigin}
                    >
                      {t('auth.telegram.useCurrent')}
                    </Button>
                  </div>
                  {originMismatch && (
                    <p className="flex items-center gap-1.5 text-[13px] text-ink-2">
                      <InkGlyph state="warn" size={10} />
                      {t('auth.telegram.originMismatch', { origin: config.telegramOrigin })}
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="auth-tg-redirect">{t('auth.telegram.redirectUrl')}</Label>
                  <p className="text-[13px] text-ink-2">
                    {t('auth.telegram.redirectUrlDescription')}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <Input
                      id="auth-tg-redirect"
                      readOnly
                      value={redirectUrl}
                      className="font-mono"
                      onFocus={(e) => e.currentTarget.select()}
                    />
                    {redirectUrl && <CopyButton text={redirectUrl} label={t('common.copy')} />}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="auth-tg-client-id">{t('auth.telegram.clientId')}</Label>
                  <p className="text-[13px] text-ink-2">{t('auth.telegram.clientIdDescription')}</p>
                  <Input
                    id="auth-tg-client-id"
                    inputMode="numeric"
                    autoComplete="off"
                    className="font-mono"
                    {...form.register('telegramClientId')}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="auth-tg-client-secret">{t('auth.telegram.clientSecret')}</Label>
                  <p className="text-[13px] text-ink-2">
                    {t('auth.telegram.clientSecretDescription')}
                  </p>
                  {/* new-password keeps the browser from autofilling the panel password here,
                      which would overwrite the secret and drop the link on save. */}
                  <PasswordInput
                    id="auth-tg-client-secret"
                    autoComplete="new-password"
                    placeholder={
                      config.hasTelegramClientSecret
                        ? t('auth.telegram.secretPlaceholderSet')
                        : t('auth.telegram.secretPlaceholderNew')
                    }
                    className="font-mono"
                    {...form.register('telegramClientSecret')}
                  />
                </div>

                <p className="text-[13px] text-ink-2">{t('auth.telegram.credsResetNote')}</p>

                <div className="flex items-center justify-between gap-3 rounded-lg bg-background px-4 py-3">
                  {linked ? (
                    <>
                      <p className="flex min-w-0 items-center gap-2 text-sm">
                        <InkGlyph state="ok" size={10} />
                        <span className="truncate">
                          {t('auth.telegram.linked', { label: linkedLabel })}
                        </span>
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={unlinking}
                        onClick={onUnlink}
                      >
                        {unlinking && <IconLoader2 className="size-4 animate-spin" />}
                        {t('auth.telegram.unlink')}
                      </Button>
                    </>
                  ) : (
                    <>
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 text-sm">
                          <InkGlyph state="pending" size={10} />
                          {t('auth.telegram.notLinked')}
                        </p>
                        {!canLink && (
                          <p className="mt-0.5 text-xs text-ink-3">
                            {t('auth.telegram.saveFirst')}
                          </p>
                        )}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!canLink || linking}
                        onClick={onLink}
                      >
                        {linking ? (
                          <IconLoader2 className="size-4 animate-spin" />
                        ) : (
                          <IconBrandTelegram className="size-4" />
                        )}
                        {t('auth.telegram.link')}
                      </Button>
                    </>
                  )}
                </div>
              </div>
            </MethodRow>
          )}
        />
      </CardContent>

      <CardContent className="flex justify-end border-t border-hairline py-4">
        <Button onClick={onSave} disabled={saving}>
          {saving && <IconLoader2 className="size-4 animate-spin" />}
          {t('common.save')}
        </Button>
      </CardContent>
    </Card>
  );
}
