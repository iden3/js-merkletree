import { Bytes } from '../../types';
import { HASH_BYTES_LENGTH } from '../../constants';
import { checkBigIntInField } from './crypto';

export const bytesEqual: (b1: Bytes, b2: Bytes) => boolean = (b1, b2) => {
  let areEqual = true;
  b1.forEach((ele, idx) => {
    if (ele !== b2[idx]) {
      areEqual = false;
    }
  });
  return areEqual;
};

// TODO: might be make this generic over typed arrays?
export const swapEndianness = (bytes: Bytes): Bytes => {
  const tempBuffer = new ArrayBuffer(bytes.length);
  const tempBytes = new Uint8Array(tempBuffer);

  bytes.forEach((_, idx) => {
    tempBytes[idx] = bytes[bytes.length - 1 - idx];
  });

  return tempBytes;
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

const hextable = '0123456789abcdef';
export const bytes2Hex = (u: Bytes): string => {
  const arr = new Array(u.length * 2);
  let j = 0;
  u.forEach((v) => {
    arr[j] = hextable[parseInt((v >> 4).toString(10))];
    arr[j + 1] = hextable[parseInt((v & 15).toString(10))];
    j += 2;
  });

  return arr.join('');
};

// NOTE: `bytes` should be big endian
// bytes recieved from Hash.value getter are safe to use since their endianness is swapped, for the same reason the private Hash.bytes { stored in little endian } should never be used
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
