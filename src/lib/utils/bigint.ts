import { HASH_BYTES_LENGTH } from '../../constants';
import { Bytes } from '../../types';

export const bigint2Array = (bigNum: bigint, radix?: number): Array<number> => {
  return bigNum
    .toString(radix ? radix : 10)
    .split('')
    .map((n) => {
      return parseInt(n);
    });
};

export const bigIntToUINT8Array = (bigNum: bigint): Bytes => {
  const n256 = BigInt(256);
  const bytes = new Uint8Array(HASH_BYTES_LENGTH);
  let i = 0;
  while (bigNum > BigInt(0)) {
    bytes[HASH_BYTES_LENGTH - 1 - i] = Number(bigNum % n256);
    bigNum = bigNum / n256;
    i += 1;
  }
  return bytes;
};
