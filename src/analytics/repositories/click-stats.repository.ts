import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ClickStats, ClickStatsDocument } from '../schemas/click-stats.schema';

@Injectable()
export class ClickStatsRepository {
  constructor(
    @InjectModel(ClickStats.name)
    private readonly model: Model<ClickStatsDocument>,
  ) {}

  async incrementStats(code: string, clickTs: Date): Promise<void> {
    await this.model.updateOne(
      { code },
      {
        $inc: { totalClicks: 1 },
        $max: { lastClickAt: clickTs },
        $setOnInsert: { code },
      },
      { upsert: true },
    );
  }

  async getStats(
    code: string,
  ): Promise<{ code: string; totalClicks: number; lastClickAt: Date } | null> {
    const doc = await this.model.findOne({ code }).lean().exec();
    if (!doc) return null;
    return {
      code: doc.code,
      totalClicks: doc.totalClicks,
      lastClickAt: doc.lastClickAt,
    };
  }
}
