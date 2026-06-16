import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './services/health.service';
import { CommonCodeGenerationModule } from '../code-generation/code-generation.module';

@Module({
  imports: [
    CommonCodeGenerationModule,
  ],
  controllers: [HealthController],
  providers: [HealthService],
})
export class HealthModule {}
