import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

export interface RequestMeta {
  ip: string | null;
  ua: string | null;
}

export const CurrentRequestMeta = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): RequestMeta => {
    const req = ctx.switchToHttp().getRequest<Request>();
    return {
      ip: req.ip ?? null,
      ua: req.get('user-agent') ?? null,
    };
  },
);
