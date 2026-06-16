import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { HealthService } from './services/health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get('live')
  live() {
    return this.health.live();
  }

  @Get('ready')
  async ready() {
    const r = await this.health.ready();
    if (r.status !== 'ok') {
      throw new HttpException(r, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return r;
  }
}
