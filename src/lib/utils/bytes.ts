import { HASH_BYTES_LENGTH } from '../../constants';
import { Bytes } from '../../types/bytes';
import { checkBigIntInField } from './crypto';

export const bytesEqual: (b1: Bytes, b2: Bytes) => boolean = (b1, b2) => {
  return b1.every((ele, idx) => ele === b2[idx]);
};

// TODO: might be make this generic over typed arrays?
export const swapEndianness = (bytes: Bytes): Bytes => {
  return bytes.slice().reverse();
};

export const bytes2BinaryString = (bytes: Bytes): string => {
  return '0b' + bytes.reduce((acc, i) => acc + i.toString(2).padStart(8, '0'), '');
};

export const testBit = (bitMap: Bytes, n: number): boolean => {
  return (bitMap[parseInt((n / 8).toString())] & (1 << n % 8)) !== 0;
};

export const testBitBigEndian = (bitMap: Bytes, n: number): boolean => {
  return (bitMap[bitMap.length - parseInt(`${n / 8}`) - 1] & (1 << n % 8)) !== 0;
};

// SetBitBigEndian sets the bit n in the bitmap to 1, in Big Endian.
export const setBitBigEndian = (bitMap: Bytes, n: number): void => {
  bitMap[bitMap.length - parseInt(`${n / 8}`) - 1] |= 1 << n % 8;
};

const hexTable = '0123456789abcdef';
export const bytes2Hex = (u: Bytes): string => {
  const arr = new Array(u.length * 2);
  let j = 0;
  u.forEach((v) => {
    arr[j] = hexTable[parseInt((v >> 4).toString(10))];
    arr[j + 1] = hexTable[parseInt((v & 15).toString(10))];
    j += 2;
  });

  return arr.join('');
};

// NOTE: `bytes` should be big endian
// bytes received from Hash.value getter are safe to use since their endianness is swapped, for the same reason the private Hash.bytes { stored in little endian } should never be used
export const newBigIntFromBytes = (bytes: Bytes): bigint => {
  if (bytes.length !== HASH_BYTES_LENGTH) {
    throw `Expected 32 bytes, found ${bytes.length} bytes`;
  }

  const bigNum = BigInt(bytes2BinaryString(bytes));
  if (!checkBigIntInField(bigNum)) {
    throw 'NewBigIntFromHashBytes: Value not inside the Finite Field';
  }

  return bigNum;
};

export const str2Bytes = (str: string): Bytes =>
  new Uint8Array(str.length * 2).map((_, i) => str.charCodeAt(i));
