import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ShortenerController } from './shortener.controller';
import { ShortenerService } from './services/shortener.service';
import { UrlRepository } from './repositories/url.repository';
import { Url, UrlSchema } from './schemas/url.schema';
import { AnalyticsModule } from '../analytics/analytics.module';
import { CommonCodeGenerationModule } from '../code-generation/code-generation.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Url.name, schema: UrlSchema }]),
    AnalyticsModule,
    CommonCodeGenerationModule,
  ],
  controllers: [ShortenerController],
  providers: [ShortenerService, UrlRepository],
  exports: [ShortenerService],
})
export class ShortenerModule {}
