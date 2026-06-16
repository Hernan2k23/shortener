import { Module } from '@nestjs/common';
import { FallbackController } from './controllers/fallback.controller';

@Module({
  controllers: [FallbackController],
})
export class FallbackModule {}
