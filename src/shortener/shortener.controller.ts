import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { ShortenerService } from './services/shortener.service';
import { CreateUrlDto } from './dto/create-url.dto';
import { LoopRedirectGuard } from '../common/guards/loop-redirect.guard';
import {
  CurrentRequestMeta,
  type RequestMeta,
} from '../common/decorators/current-request-meta.decorator';

@Controller()
export class ShortenerController {
  constructor(private readonly shortener: ShortenerService) {}

  @Post('api/urls')
  @UseGuards(LoopRedirectGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  create(@Body() dto: CreateUrlDto) {
    return this.shortener.create(dto);
  }

  @Get(':code')
  async resolve(
    @Param('code') code: string,
    @CurrentRequestMeta() meta: RequestMeta,
    @Res() res: Response,
  ): Promise<void> {
    const target = await this.shortener.resolveAndTrack(code, meta);
    res.redirect(302, target);
  }
}
