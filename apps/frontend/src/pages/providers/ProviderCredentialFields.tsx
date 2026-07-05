import { IconExternalLink } from '@tabler/icons-react';
import type { ReactNode } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { NetcupAuthorizeButton } from '@/components/NetcupAuthorizeButton';
import { PasswordInput } from '@/components/PasswordInput';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { FormValues } from './providerForm';

interface ProviderCredentialFieldsProps {
  form: UseFormReturn<FormValues>;
  editing: boolean;
}

/** Field wrapper: label plus an optional description and credential deep link above the input. */
function Field({
  id,
  label,
  description,
  link,
  children,
}: {
  id: string;
  label: string;
  description?: string;
  link?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {(description || link) && (
        <p className="text-xs text-muted-foreground">
          {description}
          {description && link && ' — '}
          {link && (
            <a
              href={link}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 text-brand underline-offset-4 hover:underline"
            >
              {link.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, '')}
              <IconExternalLink className="size-3" />
            </a>
          )}
        </p>
      )}
      {children}
    </div>
  );
}

// The per-connector credential inputs, switched on the selected kind. Secret inputs use the
// "keep empty to keep unchanged" placeholder when editing.
export function ProviderCredentialFields({ form, editing }: ProviderCredentialFieldsProps) {
  const { t } = useTranslation();
  const kind = form.watch('kind');
  const keepEmpty = editing ? t('providers.keepEmpty') : '';
  const keepEmptyOrOptional = editing ? t('providers.keepEmpty') : t('common.optional');

  if (kind === 'selectel') {
    return (
      <>
        <Field
          id="cred-account-id"
          label={t('providers.field.accountId')}
          description={t('providers.field.accountIdDesc')}
        >
          <Input id="cred-account-id" placeholder="123456" {...form.register('accountId')} />
        </Field>
        <Field
          id="cred-username"
          label={t('providers.field.serviceUsername')}
          description={t('providers.field.serviceUsernameDesc')}
        >
          <Input id="cred-username" {...form.register('username')} />
        </Field>
        <Field id="cred-password" label={t('providers.field.password')}>
          <PasswordInput
            id="cred-password"
            placeholder={keepEmpty}
            {...form.register('password')}
          />
        </Field>
        <Field
          id="cred-project"
          label={t('providers.field.project')}
          description={t('providers.field.projectDesc')}
        >
          <Input id="cred-project" placeholder="my-project" {...form.register('projectName')} />
        </Field>
      </>
    );
  }

  if (kind === 'cloudflare') {
    return (
      <>
        <Field
          id="cred-account-id"
          label={t('providers.field.accountId')}
          description={t('providers.field.cloudflareAccountIdDesc')}
        >
          <Input id="cred-account-id" {...form.register('accountId')} />
        </Field>
        <Field
          id="cred-token"
          label={t('providers.field.apiToken')}
          description={t('providers.field.apiTokenDescCloudflare')}
        >
          <PasswordInput id="cred-token" placeholder={keepEmpty} {...form.register('token')} />
        </Field>
      </>
    );
  }

  if (kind === 'hostbill' || kind === 'billmgr') {
    return (
      <>
        <Field id="cred-base-url" label={t('providers.field.apiBaseUrl')}>
          <Input
            id="cred-base-url"
            placeholder={
              kind === 'billmgr' ? 'https://my.akenai.host/billmgr' : 'https://secure.veesp.com/api'
            }
            {...form.register('baseUrl')}
          />
        </Field>
        <Field id="cred-username" label={t('providers.field.loginEmail')}>
          <Input id="cred-username" {...form.register('username')} />
        </Field>
        <Field id="cred-password" label={t('providers.field.password')}>
          <PasswordInput
            id="cred-password"
            placeholder={keepEmpty}
            {...form.register('password')}
          />
        </Field>
        {kind === 'billmgr' && (
          <Field
            id="cred-totp"
            label={t('providers.field.totpSecret')}
            description={t('providers.field.totpSecretDesc')}
          >
            <PasswordInput
              id="cred-totp"
              placeholder={keepEmptyOrOptional}
              {...form.register('totpSecret')}
            />
          </Field>
        )}
      </>
    );
  }

  if (kind === '4vps') {
    return (
      <>
        <Field
          id="cred-token"
          label={t('providers.field.apiToken')}
          description={t('providers.field.apiTokenDesc4vps')}
          link="https://4vps.su/dashboard/api"
        >
          <Input id="cred-token" placeholder={keepEmpty} {...form.register('token')} />
        </Field>
        <Field
          id="cred-panel-id"
          label={t('providers.field.panelId')}
          description={t('providers.field.panelIdDesc')}
        >
          <Input id="cred-panel-id" placeholder="1" {...form.register('panelId')} />
        </Field>
      </>
    );
  }

  if (kind === 'netcup') {
    return (
      <>
        <NetcupAuthorizeButton
          onToken={(tok) => form.setValue('token', tok, { shouldDirty: true })}
        />
        <Field
          id="cred-token"
          label={t('providers.field.refreshToken')}
          description={t('providers.field.refreshTokenDescNetcup')}
        >
          <Input id="cred-token" placeholder={keepEmpty} {...form.register('token')} />
        </Field>
      </>
    );
  }

  if (kind === 'netlen') {
    return (
      <Field
        id="cred-token"
        label={t('providers.field.apiToken')}
        description={t('providers.field.apiTokenDescNetlen')}
        link="https://www.netlen.com.tr/panel/api"
      >
        <Input id="cred-token" placeholder={keepEmpty} {...form.register('token')} />
      </Field>
    );
  }

  if (kind === 'vultr') {
    return (
      <Field
        id="cred-token"
        label={t('providers.field.apiToken')}
        description={t('providers.field.apiTokenDescVultr')}
        link="https://console.vultr.com/user/apiaccess/"
      >
        <Input id="cred-token" placeholder={keepEmpty} {...form.register('token')} />
      </Field>
    );
  }

  if (kind === 'linode') {
    return (
      <Field
        id="cred-token"
        label={t('providers.field.apiToken')}
        description={t('providers.field.apiTokenDescLinode')}
        link="https://cloud.linode.com/profile/tokens"
      >
        <Input id="cred-token" placeholder={keepEmpty} {...form.register('token')} />
      </Field>
    );
  }

  if (kind === 'aeza') {
    return (
      <Field
        id="cred-token"
        label={t('providers.field.apiToken')}
        description={t('providers.field.apiTokenDescAeza')}
        link="https://my.aeza.net/settings/apikeys"
      >
        <Input id="cred-token" placeholder={keepEmpty} {...form.register('token')} />
      </Field>
    );
  }

  if (kind === 'stormwall') {
    return (
      <Field
        id="cred-token"
        label={t('providers.field.apiToken')}
        description={t('providers.field.apiTokenDescStormwall')}
        link="https://users.stormwall.pro/tokens"
      >
        <Input id="cred-token" placeholder={keepEmpty} {...form.register('token')} />
      </Field>
    );
  }

  if (kind === 'beget') {
    return (
      <>
        <Field
          id="cred-username"
          label={t('providers.field.begetLogin')}
          description={t('providers.field.begetLoginDesc')}
        >
          <Input id="cred-username" {...form.register('username')} />
        </Field>
        <Field id="cred-password" label={t('providers.field.password')}>
          <PasswordInput
            id="cred-password"
            placeholder={keepEmpty}
            {...form.register('password')}
          />
        </Field>
        <Field
          id="cred-totp"
          label={t('providers.field.totpSecret')}
          description={t('providers.field.totpSecretDesc')}
        >
          <PasswordInput
            id="cred-totp"
            placeholder={keepEmptyOrOptional}
            {...form.register('totpSecret')}
          />
        </Field>
        <Field
          id="cred-api-password"
          label={t('providers.field.begetApiPassword')}
          description={t('providers.field.begetApiPasswordDesc')}
          link="https://cp.beget.com/settings/security/api"
        >
          <PasswordInput
            id="cred-api-password"
            placeholder={keepEmptyOrOptional}
            {...form.register('apiPassword')}
          />
        </Field>
      </>
    );
  }

  if (kind === 'porkbun') {
    return (
      <>
        <Field
          id="cred-token"
          label={t('providers.field.porkbunApiKey')}
          description={t('providers.field.porkbunApiKeyDesc')}
          link="https://porkbun.com/account/api"
        >
          <Input id="cred-token" placeholder={keepEmpty} {...form.register('token')} />
        </Field>
        <Field id="cred-secret-key" label={t('providers.field.porkbunSecretKey')}>
          <PasswordInput
            id="cred-secret-key"
            placeholder={keepEmpty}
            {...form.register('secretKey')}
          />
        </Field>
      </>
    );
  }

  if (kind === 'manual') return null;

  return (
    <Field
      id="cred-token"
      label={t('providers.field.apiToken')}
      link={kind === 'timeweb' ? 'https://timeweb.cloud/my/api-keys' : undefined}
    >
      <Input id="cred-token" placeholder={keepEmpty} {...form.register('token')} />
    </Field>
  );
}
