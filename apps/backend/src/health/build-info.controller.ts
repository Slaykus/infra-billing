import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { API, CONTROLLERS_INFO } from '@infra/shared';
import { BuildInfo } from '@infra/shared';
import { AppConfigService } from '@config/app-config.service';
import { Public } from '../auth/public.decorator';
import { BuildInfoDto } from './dto/build-info.dto';

@ApiTags(CONTROLLERS_INFO.BUILD_INFO.TAG)
@Controller(API.BUILD_INFO)
export class BuildInfoController {
  constructor(private readonly config: AppConfigService) {}

  /** Build metadata for the in-panel "Build Info" popup. No secrets, public. */
  @ApiOperation({ summary: 'Get build info' })
  @ApiOkResponse({ type: BuildInfoDto })
  @Public()
  @Get()
  buildInfo(): BuildInfo {
    return this.config.buildInfo;
  }
}
