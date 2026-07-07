import type { IncomeEntry } from '@infra/shared';
import { IconExternalLink, IconTrash } from '@tabler/icons-react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDateShort, formatMoney } from '@/utils/format';

interface IncomeTableProps {
  items: IncomeEntry[];
  isLoading: boolean;
  total: number;
  onDelete: (uuid: string) => void;
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'SENT') {
    return (
      <Badge className="border-transparent bg-success/15 text-[10px] text-success uppercase tracking-wide">
        {status}
      </Badge>
    );
  }
  if (status === 'DEAD') {
    return (
      <Badge variant="destructive" className="text-[10px] uppercase tracking-wide">
        {status}
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
      {status}
    </Badge>
  );
}

export function IncomeTable({ items, isLoading, total, onDelete }: IncomeTableProps) {
  const { t } = useTranslation();
  return (
    <Card className="overflow-hidden py-0">
      <div className="overflow-x-auto">
        <Table className="min-w-[760px] [&_td]:py-3">
          <TableHeader>
            <TableRow className="[&_th]:text-muted-foreground">
              <TableHead>{t('income.colDate')}</TableHead>
              <TableHead>{t('income.colSource')}</TableHead>
              <TableHead>{t('income.colAmount')}</TableHead>
              <TableHead>{t('income.colStatus')}</TableHead>
              <TableHead>{t('income.colDescription')}</TableHead>
              <TableHead>{t('income.colReceipt')}</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((e) => (
              <TableRow key={e.uuid}>
                <TableCell>{formatDateShort(e.incomeDate)}</TableCell>
                <TableCell>
                  <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                    {e.source === 'manual' ? t('income.sourceManual') : t('income.sourceMoyNalog')}
                  </Badge>
                </TableCell>
                <TableCell className="font-semibold">{formatMoney(e.amount, e.currency)}</TableCell>
                <TableCell>
                  <StatusBadge status={e.status} />
                </TableCell>
                <TableCell className="whitespace-normal text-muted-foreground">
                  {e.description ?? t('common.none')}
                </TableCell>
                <TableCell>
                  {e.receiptLink ? (
                    <a
                      href={e.receiptLink}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      <IconExternalLink className="size-3.5" />
                      {t('income.receiptOpen')}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">{t('common.none')}</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex justify-end">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t('common.delete')}
                      className="text-destructive hover:text-destructive"
                      onClick={() => onDelete(e.uuid)}
                    >
                      <IconTrash className="size-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {!isLoading && total === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="py-6 text-center text-muted-foreground">
                  {t('income.empty')}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
