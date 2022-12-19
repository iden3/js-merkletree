import { HASH_BYTES_LENGTH, HASH_SIZE_LENGTH_IN_BITS } from '../../constants';
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
  const buffer = new ArrayBuffer(HASH_BYTES_LENGTH);
  const bytes = new Uint8Array(buffer);

  const bArr = Array.from(Array(HASH_SIZE_LENGTH_IN_BITS)).map(() => {
    return 0;
  });

  const bigNumToBinaryArray = bigint2Array(bigNum, 2);

  let startIDX = bArr.length - bigNumToBinaryArray.length;
  for (let idx = startIDX; idx < bArr.length; idx++) {
    bArr[idx] = bigNumToBinaryArray[idx - startIDX];
  }
  const decimalArr = [];
  const chunk = bArr.length / 8;
  const bStr = bArr.join('');
  for (let i = 0; i < chunk; i++) {
    const element = parseInt(bStr.slice(i * 8, i * 8 + 8), 2);
    decimalArr.push(element);
  }

  startIDX = bytes.length - decimalArr.length;

  for (let idx = startIDX; idx < bytes.length; idx++) {
    bytes[idx] = decimalArr[idx - startIDX];
  }

  return bytes;
};
