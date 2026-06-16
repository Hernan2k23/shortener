import {
  CanActivate,
  ExecutionContext,
  Injectable,
  BadRequestException,
} from '@nestjs/common';
import type { Request } from 'express';
import { CreateUrlDto } from '../../shortener/dto/create-url.dto';

@Injectable()
export class LoopRedirectGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context
      .switchToHttp()
      .getRequest<Request & { body?: Partial<CreateUrlDto> }>();
    const host = req.hostname;
    const body = req.body as { originalUrl?: unknown } | undefined;
    const originalUrl: unknown = body?.originalUrl;
    if (typeof originalUrl !== 'string') return true;
    try {
      const u = new URL(originalUrl);
      if (u.hostname === host) {
        throw new BadRequestException(
          'originalUrl cannot point at this shortener',
        );
      }
    } catch (e) {
      if (e instanceof BadRequestException) throw e;
    }
    return true;
  }
}
