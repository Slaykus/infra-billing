import { Module } from '@nestjs/common';
import { CurrencyModule } from '../currency/currency.module';
import { IncomeController } from './income.controller';
import { IncomeService } from './income.service';
import { IncomeSyncService } from './income-sync.service';
import { MoyNalogClient } from './moy-nalog.client';

@Module({
  imports: [CurrencyModule],
  controllers: [IncomeController],
  providers: [IncomeService, IncomeSyncService, MoyNalogClient],
  exports: [IncomeService, IncomeSyncService],
})
export class IncomeModule {}
