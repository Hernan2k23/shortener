import { Injectable } from '@nestjs/common';
import { customAlphabet } from 'nanoid';
import { ALPHABET, CODE_LENGTH } from '../constants/alphabet';
import type { CodeEncoder } from '../interfaces/code-encoder.interface';

@Injectable()
export class NanoidFallbackEncoder implements CodeEncoder {
  private readonly generate = customAlphabet(ALPHABET, CODE_LENGTH);

  encodeOffset(): string {
    return this.generate();
  }
}
