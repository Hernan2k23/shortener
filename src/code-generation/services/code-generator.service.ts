import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { CodeRangeAllocatorService } from './code-range-allocator.service';
import { CodePool } from './code-pool.service';
import { CodeShuffler } from './code-shuffler.service';
import { CODE_ENCODER, FALLBACK_ENCODER } from '../constants/code-encoder.constants';
import type { CodeEncoder } from '../interfaces/code-encoder.interface';

@Injectable()
export class CodeGeneratorService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CodeGeneratorService.name);
  private refillInFlight: Promise<void> | null = null;
  private refillSuccessCount = 0;
  private refillFailureCount = 0;
  private fallbackCount = 0;

  constructor(
    private readonly allocator: CodeRangeAllocatorService,
    private readonly pool: CodePool,
    private readonly shuffler: CodeShuffler,
    @Inject(CODE_ENCODER) private readonly encoder: CodeEncoder,
    @Inject(FALLBACK_ENCODER) private readonly fallbackEncoder: CodeEncoder,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.refill();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.refillInFlight) {
      await this.refillInFlight.catch(() => undefined);
    }
  }

  take(): string {
    if (this.pool.isBelowRefillThreshold()) {
      void this.refill();
    }
    const code = this.pool.take();
    if (code !== undefined) return code;

    this.logger.warn('code pool empty; falling back to ad-hoc nanoid');
    this.fallbackCount++;
    return this.fallbackEncoder.encodeOffset(0);
  }

  release(code: string): void {
    this.pool.release(code);
  }

  getMetrics(): {
    poolDepth: number;
    poolSize: number;
    fallbackCount: number;
    refillSuccessCount: number;
    refillFailureCount: number;
  } {
    return {
      poolDepth: this.pool.size(),
      poolSize: this.pool.poolSize,
      fallbackCount: this.fallbackCount,
      refillSuccessCount: this.refillSuccessCount,
      refillFailureCount: this.refillFailureCount,
    };
  }

  private async refill(): Promise<void> {
    if (this.refillInFlight) return this.refillInFlight;
    this.refillInFlight = (async () => {
      try {
        const { start, size } = await this.allocator.claimRange(this.pool.poolSize);
        const fresh = new Array<string>(size);
        for (let i = 0; i < size; i++) {
          fresh[i] = this.encoder.encodeOffset(start + i);
        }
        this.pool.pushMany(this.shuffler.shuffle(fresh));
        this.refillSuccessCount++;
        this.logger.log(
          `code pool refilled: size=${size}, depth=${this.pool.size()}, allocatorOffset=${start + size}`,
        );
      } catch (e) {
        this.refillFailureCount++;
        this.logger.error(
          `code pool refill failed: ${(e as Error).message}`,
          (e as Error).stack,
        );
      } finally {
        this.refillInFlight = null;
      }
    })();
    return this.refillInFlight;
  }
}
