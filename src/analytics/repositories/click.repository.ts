import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ClickEvent, ClickEventDocument } from '../schemas/click.schema';

export interface ClickPayload {
  eventId: string;
  code: string;
  ts: string;
  ip: string | null;
  ua: string | null;
}

@Injectable()
export class ClickRepository {
  constructor(
    @InjectModel(ClickEvent.name)
    private readonly model: Model<ClickEventDocument>,
  ) {}

  async create(payload: ClickPayload): Promise<ClickEventDocument> {
    return this.model.create({
      eventId: payload.eventId,
      code: payload.code,
      ts: new Date(payload.ts),
      ip: payload.ip,
      ua: payload.ua,
    });
  }

  aggregateStats(
    code: string,
  ): Promise<Array<{ _id: string; totalClicks: number; lastClick: Date }>> {
    return this.model
      .aggregate<{ _id: string; totalClicks: number; lastClick: Date }>([
        { $match: { code } },
        {
          $group: {
            _id: '$code',
            totalClicks: { $sum: 1 },
            lastClick: { $max: '$ts' },
          },
        },
      ])
      .exec();
  }
}
