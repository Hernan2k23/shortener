import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Url, UrlDocument } from '../schemas/url.schema';

@Injectable()
export class UrlRepository {
  constructor(
    @InjectModel(Url.name) private readonly model: Model<UrlDocument>,
  ) {}

  async create(input: {
    code: string;
    originalUrl: string;
    customAlias?: string | null;
  }): Promise<UrlDocument> {
    return this.model.create({
      code: input.code,
      originalUrl: input.originalUrl,
      customAlias: input.customAlias ?? null,
    });
  }

  async findByCode(code: string): Promise<UrlDocument | null> {
    return this.model.findOne({ code }).lean<UrlDocument>().exec();
  }
}
