import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ClickPayload, ClickRepository } from '../repositories/click.repository';
import { ClicksQueueService } from '../../queue/services/clicks-queue.service';
import { ClickStatsRepository } from '../repositories/click-stats.repository';


@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly clicksQueue: ClicksQueueService,
    private readonly stats: ClickStatsRepository,
  ) {}

  recordClick(payload: ClickPayload): void {
    this.clicksQueue.enqueueClick(payload);
  }

  async getStats(
    code: string,
  ): Promise<{ code: string; totalClicks: number; lastClick: Date }> {
    const row = await this.stats.getStats(code);
    if (!row) {
      throw new NotFoundException({
        message: `no stats for code '${code}'`,
        code: 'STATS_NOT_FOUND',
      });
    }
    return {
      code: row.code,
      totalClicks: row.totalClicks,
      lastClick: row.lastClickAt,
    };
  }
}
