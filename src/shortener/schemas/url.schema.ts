import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UrlDocument = HydratedDocument<Url>;

@Schema({
  collection: 'urls',
  timestamps: { createdAt: true, updatedAt: false },
})
export class Url {
  @Prop({ required: true, unique: true, index: true })
  code!: string;

  @Prop({ required: true })
  originalUrl!: string;

  @Prop({ type: String, default: null })
  customAlias!: string | null;
}

export const UrlSchema = SchemaFactory.createForClass(Url);
