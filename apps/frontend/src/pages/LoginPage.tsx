import {
  Alert,
  Button,
  Card,
  Center,
  Divider,
  Loader,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
} from '@mantine/core';
import { useForm } from '@mantine/form';
import { zodResolver } from 'mantine-form-zod-resolver';
import { IconArrowsShuffle, IconCoin, IconFingerprint } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { type LoginInput, loginSchema } from '@infra/shared';
import { useLogin, usePasskeyLogin, useSetup, useSetupStatus } from '@/api/auth';
import { apiErrorMessage } from '@/api/client';
import { mapPasskeyError, passkeySupported } from '@/api/webauthn';
import { notifyError, notifySuccess } from '@/utils/notify';
import { generatePassword } from '@/utils/password';

export function LoginPage() {
  const status = useSetupStatus();

  return (
    <Center h="100vh" px="md">
      <Card withBorder radius="md" padding="xl" w="100%" maw={360}>
        <Stack align="center" gap="xs" mb="md">
          <ThemeIcon variant="light" color="brand" radius="md" size="lg">
            <IconCoin size={22} />
          </ThemeIcon>
          <Text fw={700} size="lg">
            Infra Billing
          </Text>
        </Stack>

        {status.isLoading ? (
          <Center py="lg">
            <Loader />
          </Center>
        ) : status.data?.needsSetup ? (
          <SetupForm />
        ) : (
          <SignInForm
            passwordEnabled={status.data?.passwordEnabled ?? true}
            passkeyEnabled={status.data?.passkeyEnabled ?? false}
          />
        )}
      </Card>
    </Center>
  );
}

function SetupForm() {
  const { t } = useTranslation();
  const setup = useSetup();
  const form = useForm({
    initialValues: { username: '', password: '', confirm: '' },
    validate: {
      username: (v) => (v.trim().length >= 1 ? null : t('validation.enterName')),
      password: (v) => (v.length >= 8 ? null : t('login.setup.passwordShort')),
      confirm: (v, values) => (v === values.password ? null : t('login.setup.mismatch')),
    },
  });

  // clipboard.writeText needs a secure context (https/localhost). If it fails, tell the owner
  // to copy manually instead of claiming a copy that didn't happen.
  const generate = async () => {
    const password = generatePassword();
    form.setValues({ password, confirm: password });
    try {
      await navigator.clipboard.writeText(password);
      notifySuccess(t('login.setup.passwordGenerated'));
    } catch {
      notifySuccess(t('login.setup.passwordGeneratedNoCopy'));
    }
  };

  return (
    <Stack gap="xs">
      <div>
        <Text fw={600}>{t('login.setup.title')}</Text>
        <Text c="dimmed" size="sm">
          {t('login.setup.subtitle')}
        </Text>
      </div>
      <form
        onSubmit={form.onSubmit((v) =>
          setup.mutate({ username: v.username, password: v.password }),
        )}
      >
        <Stack>
          <TextInput label={t('login.username')} required {...form.getInputProps('username')} />
          <PasswordInput label={t('login.password')} required {...form.getInputProps('password')} />
          <PasswordInput
            label={t('login.setup.confirm')}
            required
            {...form.getInputProps('confirm')}
          />
          <Button
            type="button"
            variant="light"
            fullWidth
            leftSection={<IconArrowsShuffle size={16} />}
            onClick={generate}
          >
            {t('login.setup.generate')}
          </Button>
          {setup.isError && (
            <Text c="red" size="sm">
              {apiErrorMessage(setup.error, t('login.failed'))}
            </Text>
          )}
          <Button type="submit" loading={setup.isPending} fullWidth mt="xs">
            {t('login.setup.submit')}
          </Button>
        </Stack>
      </form>
    </Stack>
  );
}

function SignInForm({
  passwordEnabled,
  passkeyEnabled,
}: {
  passwordEnabled: boolean;
  passkeyEnabled: boolean;
}) {
  const { t } = useTranslation();
  const login = useLogin();
  const passkeyLogin = usePasskeyLogin();
  const form = useForm<LoginInput>({
    initialValues: { username: '', password: '' },
    validate: zodResolver(loginSchema),
  });

  const canPasskey = passkeyEnabled && passkeySupported();

  const doPasskey = async () => {
    try {
      await passkeyLogin.mutateAsync();
    } catch (e) {
      const m = mapPasskeyError(e);
      if (!m.cancelled) notifyError(apiErrorMessage(e, m.message));
    }
  };

  if (!passwordEnabled && !passkeyEnabled) {
    return <Alert color="yellow">{t('login.noMethods')}</Alert>;
  }

  return (
    <Stack>
      {passwordEnabled && (
        <form onSubmit={form.onSubmit((values) => login.mutate(values))}>
          <Stack>
            <TextInput label={t('login.username')} required {...form.getInputProps('username')} />
            <PasswordInput
              label={t('login.password')}
              required
              {...form.getInputProps('password')}
            />
            {login.isError && (
              <Text c="red" size="sm">
                {apiErrorMessage(login.error, t('login.failed'))}
              </Text>
            )}
            <Button type="submit" loading={login.isPending} fullWidth>
              {t('login.signIn')}
            </Button>
          </Stack>
        </form>
      )}

      {passwordEnabled && canPasskey && <Divider label={t('login.or')} labelPosition="center" />}

      {passkeyEnabled &&
        (canPasskey ? (
          <Button
            variant="default"
            leftSection={<IconFingerprint size={16} />}
            loading={passkeyLogin.isPending}
            onClick={doPasskey}
            fullWidth
          >
            {t('login.passkey')}
          </Button>
        ) : (
          <Text c="dimmed" size="xs" ta="center">
            {t('auth.passkeys.unsupported')}
          </Text>
        ))}
    </Stack>
  );
}
