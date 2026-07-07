import { IconLoader2 } from '@tabler/icons-react';
import type { FormEventHandler } from 'react';
import { Controller, type UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { DateField } from '@/components/DateField';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { trimMoney } from '@/utils/format';
import type { IForm } from './incomeForm';

const CURRENCIES = ['RUB', 'USD', 'EUR'];

interface IncomeFormModalProps {
  opened: boolean;
  form: UseFormReturn<IForm>;
  isPending: boolean;
  onSubmit: FormEventHandler<HTMLFormElement>;
  onClose: () => void;
}

export function IncomeFormModal({
  opened,
  form,
  isPending,
  onSubmit,
  onClose,
}: IncomeFormModalProps) {
  const { t } = useTranslation();
  const {
    control,
    register,
    setValue,
    formState: { errors },
  } = form;
  return (
    <Dialog open={opened} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('income.modalTitle')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="income-amount">
                {t('income.fieldAmount')} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="income-amount"
                aria-invalid={!!errors.amount}
                {...register('amount', {
                  validate: (v) => (/^\d+(\.\d+)?$/.test(v) ? true : t('validation.amountFormat')),
                  onBlur: (e) => setValue('amount', trimMoney(e.target.value)),
                })}
              />
              {errors.amount && <p className="text-xs text-destructive">{errors.amount.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="income-currency">{t('income.fieldCurrency')}</Label>
              <Controller
                control={control}
                name="currency"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="income-currency" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="income-date">
              {t('income.fieldDate')} <span className="text-destructive">*</span>
            </Label>
            <Controller
              control={control}
              name="incomeDate"
              rules={{ validate: (v) => (v ? true : t('validation.enterDate')) }}
              render={({ field }) => (
                <DateField
                  id="income-date"
                  placeholder={t('income.datePlaceholder')}
                  value={field.value}
                  onChange={field.onChange}
                  clearable={false}
                />
              )}
            />
            {errors.incomeDate && (
              <p className="text-xs text-destructive">{errors.incomeDate.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="income-description">{t('income.fieldDescription')}</Label>
            <Textarea id="income-description" rows={2} {...register('description')} />
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
