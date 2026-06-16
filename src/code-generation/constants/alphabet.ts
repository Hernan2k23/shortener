export const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-' as const;

export const ALPHABET_LENGTH = 64;
export const CODE_LENGTH = 7;
export const CODE_BITS = CODE_LENGTH * 6;
export const CODE_MASK = (1n << BigInt(CODE_BITS)) - 1n;
