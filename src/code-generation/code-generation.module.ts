import { Module } from '@nestjs/common';
import { CodeGeneratorService } from './services/code-generator.service';
import { CodeRangeAllocatorService } from './services/code-range-allocator.service';
import { BaseAlphabetEncoder } from './services/base-alphabet-encoder.service';
import { NanoidFallbackEncoder } from './services/nanoid-fallback-encoder.service';
import { CodePool } from './services/code-pool.service';
import { CodeShuffler } from './services/code-shuffler.service';
import { CODE_ENCODER, FALLBACK_ENCODER } from './constants/code-encoder.constants';

@Module({
  providers: [
    CodeRangeAllocatorService,
    CodeGeneratorService,
    CodePool,
    CodeShuffler,
    BaseAlphabetEncoder,
    NanoidFallbackEncoder,
    { provide: CODE_ENCODER, useExisting: BaseAlphabetEncoder },
    { provide: FALLBACK_ENCODER, useExisting: NanoidFallbackEncoder },
  ],
  exports: [CodeGeneratorService, CODE_ENCODER, FALLBACK_ENCODER],
})
export class CommonCodeGenerationModule {}
