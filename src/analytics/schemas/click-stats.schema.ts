import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ClickStatsDocument = HydratedDocument<ClickStats>;

@Schema({ collection: 'click_stats', timestamps: false })
export class ClickStats {
  @Prop({ required: true, unique: true })
  code!: string;

  @Prop({ required: true, default: 0 })
  totalClicks!: number;

  @Prop({ required: true })
  lastClickAt!: Date;
}

export const ClickStatsSchema = SchemaFactory.createForClass(ClickStats);
