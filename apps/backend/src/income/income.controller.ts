import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { API, API_SUB, CONTROLLERS_INFO, ID_PARAM } from '@infra/shared';
import { ForecastQueryDto } from '../analytics/dto/analytics.dto';
import {
  CreateIncomeDto,
  IncomeEntryDto,
  IncomeQueryDto,
  IncomeSummaryDto,
  IncomeSyncResultDto,
  PaginatedIncomeDto,
} from './dto/income.dto';
import { IncomeService } from './income.service';
import { IncomeSyncService } from './income-sync.service';

@ApiBearerAuth()
@ApiTags(CONTROLLERS_INFO.INCOME.TAG)
@Controller(API.INCOME)
export class IncomeController {
  constructor(
    private readonly income: IncomeService,
    private readonly incomeSync: IncomeSyncService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List income entries' })
  @ApiOkResponse({ type: PaginatedIncomeDto })
  list(@Query() query: IncomeQueryDto) {
    return this.income.list(query);
  }

  @Get(API_SUB.INCOME_SUMMARY)
  @ApiOperation({ summary: 'Revenue summary' })
  @ApiOkResponse({ type: IncomeSummaryDto })
  summary() {
    return this.income.summary();
  }

  @Get(API_SUB.INCOME_FORECAST)
  @ApiOperation({ summary: 'Revenue forecast' })
  forecast(@Query() query: ForecastQueryDto) {
    return this.income.forecast(query.months, query.monthsBack);
  }

  @Post()
  @HttpCode(201)
  @ApiOperation({ summary: 'Add a manual income entry' })
  @ApiCreatedResponse({ type: IncomeEntryDto })
  create(@Body() dto: CreateIncomeDto) {
    return this.income.create(dto);
  }

  @Post(API_SUB.INCOME_SYNC)
  @ApiOperation({ summary: 'Sync income from the receipts service' })
  @ApiOkResponse({ type: IncomeSyncResultDto })
  syncNow() {
    return this.incomeSync.sync();
  }

  @Delete(API_SUB.BY_ID)
  @HttpCode(204)
  @ApiOperation({ summary: 'Delete an income entry' })
  @ApiNoContentResponse()
  remove(@Param(ID_PARAM, ParseUUIDPipe) uuid: string) {
    return this.income.remove(uuid);
  }
}
