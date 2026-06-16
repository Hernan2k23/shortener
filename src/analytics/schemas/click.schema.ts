import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ClickEventDocument = HydratedDocument<ClickEvent>;

@Schema({ collection: 'clicks', timestamps: false })
export class ClickEvent {
  @Prop({ required: true })
  eventId!: string;

  @Prop({ required: true, index: true })
  code!: string;

  @Prop({ required: true })
  ts!: Date;

  @Prop({ type: String, default: null })
  ip!: string | null;

  @Prop({ type: String, default: null })
  ua!: string | null;
}

export const ClickEventSchema = SchemaFactory.createForClass(ClickEvent);

ClickEventSchema.index({ code: 1, ts: -1 });

ClickEventSchema.index({ code: 1, eventId: 1 }, { unique: true });
