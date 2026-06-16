import { Controller, Get, Param } from '@nestjs/common';
import { AnalyticsService } from './services/analytics.service';

@Controller('api/stats')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get(':code')
  async stats(@Param('code') code: string) {
    return this.analytics.getStats(code);
  }
}
