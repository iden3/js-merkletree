import { BigInteger } from 'big-integer';
import { splitEvery } from 'ramda';
import { HASH_BYTES_LENGTH, HASH_SIZE_LENGTH_IN_BITS } from '../../constants';
import { Bytes } from '../../types';

export const bigIntToUINT8Array = (bigNum: BigInteger): Bytes => {
  const buffer = new ArrayBuffer(HASH_BYTES_LENGTH);
  const bytes = new Uint8Array(buffer);

  const bArr = Array.from(Array(HASH_SIZE_LENGTH_IN_BITS)).map(() => {
    return 0;
  });

  const bigNumToBinaryArray = bigNum.toArray(2).value;

  let startIDX = bArr.length - bigNumToBinaryArray.length;
  for (let idx = startIDX; idx < bArr.length; idx++) {
    bArr[idx] = bigNumToBinaryArray[idx - startIDX];
  }

  const bStr = bArr.join('');
  const decimalArr = splitEvery(8, bStr).map((bStr8Bit) => {
    return parseInt(bStr8Bit, 2);
  });

  startIDX = bytes.length - decimalArr.length;

  for (let idx = startIDX; idx < bytes.length; idx++) {
    bytes[idx] = decimalArr[idx - startIDX];
  }

  return bytes;
};
