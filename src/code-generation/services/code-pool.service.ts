import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CodePool {
  private readonly pool: string[] = [];
  private readonly out = new Set<string>();
  readonly poolSize: number;
  private readonly refillThreshold: number;

  constructor(configService: ConfigService) {
    this.poolSize = configService.get<number>('CODE_POOL_SIZE', 10_000);
    this.refillThreshold = configService.get<number>(
      'CODE_POOL_REFILL_THRESHOLD',
      0.2,
    );
  }

  size(): number {
    return this.pool.length;
  }

  isBelowRefillThreshold(): boolean {
    return this.pool.length < this.poolSize * this.refillThreshold;
  }

  take(): string | undefined {
    const code = this.pool.pop();
    if (code === undefined) return undefined;
    this.out.add(code);
    return code;
  }

  release(code: string): void {
    if (!this.out.delete(code)) return;
    this.pool.push(code);
  }

  pushMany(codes: readonly string[]): void {
    for (const code of codes) {
      this.pool.push(code);
    }
  }
}
