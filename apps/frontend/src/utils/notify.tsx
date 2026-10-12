import { toast } from 'sonner';
import i18n from '@/i18n';

// `id` makes a repeated call update the same toast instead of stacking a copy.
interface NotifyOptions {
  id?: string;
}

export function notifyError(message: string, opts?: NotifyOptions): void {
  toast.error(i18n.t('notify.errorTitle'), {
    description: message,
    duration: 6000,
    id: opts?.id,
  });
}

export function notifySuccess(message: string, opts?: NotifyOptions): void {
  toast.success(message, { id: opts?.id });
}
