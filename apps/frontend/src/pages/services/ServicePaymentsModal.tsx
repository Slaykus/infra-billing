import type { Service } from '@infra/shared';
import { IconChevronLeft, IconChevronRight } from '@tabler/icons-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { usePayments } from '@/api/payments';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDateShort, formatMoney } from '@/utils/format';

// Small pages: the modal must stay browsable even for services with hundreds of daily charges.
const PAGE_SIZE = 5;

// Read-only list of the payments tied to a single service (opened from the table receipt icon).
export function ServicePaymentsModal({
  service,
  onClose,
}: {
  service: Service | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  // Keep the last service: the parent nulls the prop immediately while the exit animation is
  // still running — without this the content visibly collapses to empty (it also keeps the query key stable).
  const lastService = useRef<Service | null>(service);
  if (service) lastService.current = service;
  const shown = service ?? lastService.current;

  const [rawPage, setRawPage] = useState(1);
  // Every open starts on page 1 — adjust in render (like PaymentsPage), not in an effect.
  const wasOpen = useRef(false);
  if (Boolean(service) !== wasOpen.current) {
    wasOpen.current = Boolean(service);
    if (service) setRawPage(1);
  }

  const payments = usePayments(
    { serviceUuid: shown?.uuid },
    { enabled: Boolean(service), page: rawPage, pageSize: PAGE_SIZE },
  );
  const items = payments.data?.items ?? [];
  const total = payments.data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  // Server-side pagination: clamp when the total shrinks under the current page.
  if (payments.data && rawPage > pageCount) setRawPage(pageCount);
  const page = Math.min(rawPage, pageCount);

  return (
    <Dialog open={!!service} onOpenChange={(o) => !o && onClose()}>
      {/* No autofocus — otherwise the focus ring lights up on the close button right away. */}
      <DialogContent className="sm:max-w-3xl" onOpenAutoFocus={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>{t('services.paymentsTitle', { name: shown?.name ?? '' })}</DialogTitle>
        </DialogHeader>
        {payments.isLoading ? (
          <p className="py-4 text-center text-muted-foreground">{t('common.loading')}</p>
        ) : items.length === 0 ? (
          <p className="py-4 text-center text-muted-foreground">{t('services.paymentsEmpty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[620px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="text-muted-foreground">
                    {t('services.paymentsColDate')}
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    {t('services.paymentsColType')}
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    {t('services.paymentsColAmount')}
                  </TableHead>
                  <TableHead className="text-muted-foreground">
                    {t('services.paymentsColDescription')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((p) => (
                  <TableRow key={p.uuid}>
                    <TableCell>{formatDateShort(p.paymentDate)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={p.type === 'charge' ? 'secondary' : 'default'}
                        className={
                          p.type === 'charge'
                            ? 'text-[10px] uppercase tracking-wide'
                            : 'border-transparent bg-success/15 text-[10px] text-success uppercase tracking-wide'
                        }
                      >
                        {p.type === 'charge'
                          ? t('services.paymentCharge')
                          : t('services.paymentTopup')}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-semibold">
                      {formatMoney(p.amount, p.currency)}
                    </TableCell>
                    <TableCell className="whitespace-normal">
                      <span className="text-sm break-words text-muted-foreground">
                        {p.description ?? t('common.none')}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        {total > PAGE_SIZE && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{t('payments.total', { count: total })}</p>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                aria-label="prev"
                disabled={page <= 1}
                onClick={() => setRawPage(Math.max(1, page - 1))}
              >
                <IconChevronLeft className="size-4" />
              </Button>
              <span className="min-w-14 text-center text-sm tabular-nums">
                {page} / {pageCount}
              </span>
              <Button
                variant="ghost"
                size="icon"
                aria-label="next"
                disabled={page >= pageCount}
                onClick={() => setRawPage(Math.min(pageCount, page + 1))}
              >
                <IconChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
