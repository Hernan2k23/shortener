import { Injectable } from '@nestjs/common';
import { ALPHABET, CODE_MASK, CODE_LENGTH } from '../constants/alphabet';
import type { CodeEncoder } from '../interfaces/code-encoder.interface';

@Injectable()
export class BaseAlphabetEncoder implements CodeEncoder {
  encodeOffset(offset: number): string {
    let n = BigInt(offset) & CODE_MASK;
    const out = new Array<string>(CODE_LENGTH);

    for (let i = CODE_LENGTH - 1; i >= 0; i--) {
      out[i] = ALPHABET[Number(n & 63n)];
      n >>= 6n;
    }

    return out.join('');
  }
}
