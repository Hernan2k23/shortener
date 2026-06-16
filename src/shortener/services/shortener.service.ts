import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UrlRepository } from '../repositories/url.repository';
import { CodeGeneratorService } from '../../code-generation/services/code-generator.service';
import { RedisService } from '../../redis/services/redis.service';
import { AnalyticsService } from '../../analytics/services/analytics.service';
import type { CreateUrlDto } from '../dto/create-url.dto';
import type { RequestMeta } from '../../common/decorators/current-request-meta.decorator';

import { NEGATIVE_SENTINEL } from '../../redis/services/redis.service';

const MONGO_DUPLICATE_KEY_CODE = 11000;
const MAX_RETRIES = 2;

@Injectable()
export class ShortenerService {
  private readonly logger = new Logger(ShortenerService.name);
  private readonly baseUrl: string;

  constructor(
    private readonly urls: UrlRepository,
    private readonly codeGen: CodeGeneratorService,
    private readonly cache: RedisService,
    private readonly analytics: AnalyticsService,
    configService: ConfigService,
  ) {
    const explicit = configService.get<string>('SHORT_BASE_URL');
    const port = configService.get<number>('PORT') ?? 3000;
    this.baseUrl = explicit ?? `http://localhost:${port}`;
  }

  async create(dto: CreateUrlDto): Promise<{ code: string; shortUrl: string }> {
    return dto.alias
      ? this.createWithAlias(dto)
      : this.createWithGeneratedCode(dto);
  }

  private async createWithAlias(
    dto: CreateUrlDto,
  ): Promise<{ code: string; shortUrl: string }> {
    const doc = await this.urls.create({
      code: dto.alias!,
      originalUrl: dto.originalUrl,
      customAlias: dto.alias!,
    });
    return { code: doc.code, shortUrl: `${this.baseUrl}/${doc.code}` };
  }

  private async createWithGeneratedCode(
    dto: CreateUrlDto,
  ): Promise<{ code: string; shortUrl: string }> {
    let lastError: unknown;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const code = this.codeGen.take();
      try {
        const doc = await this.urls.create({
          code,
          originalUrl: dto.originalUrl,
          customAlias: null,
        });
        return { code: doc.code, shortUrl: `${this.baseUrl}/${doc.code}` };
      } catch (e) {
        this.codeGen.release(code);

        if (this.isDuplicateKeyError(e) && attempt < MAX_RETRIES) {
          this.logger.warn(
            `duplicate code '${code}' on attempt ${attempt + 1}; retrying with a fresh code`,
          );
          lastError = e;
          continue;
        }

        throw e;
      }
    }

    throw lastError;
  }

  private isDuplicateKeyError(e: unknown): boolean {
    return (
      e instanceof Error &&
      'code' in e &&
      (e as Error & { code: number }).code === MONGO_DUPLICATE_KEY_CODE
    );
  }

  async resolveAndTrack(code: string, ctx: RequestMeta): Promise<string> {
    const cached = await this.cache.getCode(code);
    if (cached === NEGATIVE_SENTINEL) {
      throw new NotFoundException({
        message: `code '${code}' not found`,
        code: 'URL_NOT_FOUND',
      });
    }
    if (cached) {
      this.safeRecordClick(code, ctx);
      return cached;
    }

    const doc = await this.urls.findByCode(code);
    if (!doc) {
      this.cache.setNegative(code).catch((err: unknown) => {
        const message = err instanceof Error ? err.message : String(err);
        this.logger.warn(`setNegative failed for ${code}: ${message}`);
      });
      throw new NotFoundException({
        message: `code '${code}' not found`,
        code: 'URL_NOT_FOUND',
      });
    }

    this.cache.setCode(code, doc.originalUrl).catch((err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`setCode failed for ${code}: ${message}`);
    });
    this.safeRecordClick(code, ctx);
    return doc.originalUrl;
  }

  private safeRecordClick(code: string, ctx: RequestMeta): void {
    try {
      this.analytics.recordClick({
        eventId: crypto.randomUUID(),
        code,
        ts: new Date().toISOString(),
        ip: ctx.ip,
        ua: ctx.ua,
      });
    } catch (e) {
      this.logger.error(
        `recordClick threw (should be caught inside analytics): ${(e as Error).message}`,
      );
    }
  }
}
