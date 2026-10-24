import type { Provider } from '@infra/shared';
import { IconLoader2 } from '@tabler/icons-react';
import type { FormEventHandler } from 'react';
import { Controller, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Combobox } from '@/components/Combobox';
import { DateField } from '@/components/DateField';
import { ProviderCombobox } from '@/components/ProviderCombobox';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { trimMoney } from '@/utils/format';
import { AccountSelect, accountsOf, impliedAccount } from '../services/AccountSelect';
import type { PForm } from './paymentForm';

interface Option {
  value: string;
  label: string;
}

interface PaymentFormModalProps {
  opened: boolean;
  form: UseFormReturn<PForm>;
  isPending: boolean;
  providers: Provider[] | undefined;
  serviceOptions: Option[];
  currencyOptions: Option[];
  onSubmit: FormEventHandler<HTMLFormElement>;
  onClose: () => void;
}

export function PaymentFormModal({
  opened,
  form,
  isPending,
  providers,
  serviceOptions,
  currencyOptions,
  onSubmit,
  onClose,
}: PaymentFormModalProps) {
  const { t } = useTranslation();
  const {
    control,
    register,
    setValue,
    watch,
    formState: { errors },
  } = form;
  const accounts = accountsOf(providers, watch('providerUuid'));
  return (
    <Dialog open={opened} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('payments.modalTitle')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="payment-provider">{t('payments.fieldProvider')}</Label>
            <Controller
              control={control}
              name="providerUuid"
              rules={{ validate: (v) => (v ? true : t('validation.selectProvider')) }}
              render={({ field }) => (
                <ProviderCombobox
                  id="payment-provider"
                  providers={providers}
                  value={field.value}
                  onChange={(v) => {
                    field.onChange(v);
                    setValue('accountUuid', impliedAccount(accountsOf(providers, v)));
                    // A service picked under the previous provider no longer fits.
                    setValue('serviceUuid', '');
                  }}
                  placeholder={t('validation.selectProvider')}
                  invalid={!!errors.providerUuid}
                />
              )}
            />
            {errors.providerUuid && (
              <p className="text-xs text-destructive">{errors.providerUuid.message}</p>
            )}
          </div>

          {accounts.length > 1 && (
            <Controller
              control={control}
              name="accountUuid"
              rules={{ validate: (v) => (v ? true : t('validation.selectAccount')) }}
              render={({ field }) => (
                <AccountSelect
                  id="payment-account"
                  label={t('payments.fieldAccount')}
                  accounts={accounts}
                  value={field.value}
                  onChange={(v) => {
                    field.onChange(v);
                    setValue('serviceUuid', '');
                  }}
                  error={errors.accountUuid?.message}
                  className="space-y-1.5"
                />
              )}
            />
          )}

          <div className="space-y-1.5">
            <Label htmlFor="payment-service">
              {t('payments.fieldService', { optional: t('common.optional') })}
            </Label>
            <Controller
              control={control}
              name="serviceUuid"
              render={({ field }) => (
                <Combobox
                  id="payment-service"
                  value={field.value}
                  onChange={field.onChange}
                  options={[{ value: '', label: t('common.none') }, ...serviceOptions]}
                />
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="payment-amount">
                {t('payments.fieldAmount')} <span className="text-ink-3">*</span>
              </Label>
              <Input
                id="payment-amount"
                aria-invalid={!!errors.amount}
                {...register('amount', {
                  // Accept any number of decimal places; extras are trimmed to 2 (on blur + submit).
                  validate: (v) => (/^\d+(\.\d+)?$/.test(v) ? true : t('validation.amountFormat')),
                  onBlur: (e) => setValue('amount', trimMoney(e.target.value)),
                })}
              />
              {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="payment-currency">{t('payments.fieldCurrency')}</Label>
              <Controller
                control={control}
                name="currency"
                render={({ field }) => (
                  <Combobox
                    id="payment-currency"
                    value={field.value}
                    onChange={field.onChange}
                    options={currencyOptions}
                  />
                )}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="payment-date">
              {t('payments.fieldDate')} <span className="text-ink-3">*</span>
            </Label>
            <Controller
              control={control}
              name="paymentDate"
              rules={{ validate: (v) => (v ? true : t('validation.enterDate')) }}
              render={({ field }) => (
                <DateField
                  id="payment-date"
                  placeholder={t('payments.datePlaceholder')}
                  value={field.value}
                  onChange={field.onChange}
                  clearable={false}
                />
              )}
            />
            {errors.paymentDate && (
              <p className="text-xs text-destructive">{errors.paymentDate.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="payment-description">{t('payments.fieldDescription')}</Label>
            <Textarea id="payment-description" rows={2} {...register('description')} />
          </div>

          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending && <IconLoader2 className="size-4 animate-spin" />}
            {t('common.save')}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
