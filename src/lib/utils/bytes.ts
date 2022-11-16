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

// bytes -> big endian
export const bytesToBitArray = (bytes: Bytes): Array<BigInt> => {
  if (bytes.length !== HASH_BYTES_LENGTH) {
    throw `Expected 32 bytes, found ${bytes.length} bytes`;
  }

  const bitArr: Array<BigInt> = [];

  bytes.forEach((byte) => {
    const bitString = byteTo8BitString(byte);
    bitString.split('').forEach((bit) => {
      bitArr.push(BigInt(bit));
    });
  });

  return bitArr;
};

export const bytes2BinaryString = (bytes: Bytes): string => {
  return '0b' + bytesToBitArray(bytes).join('');
};

const byteTo8BitString = (num: number) => {
  const bit8Arr = ['0', '0', '0', '0', '0', '0', '0', '0'];
  const byteBitStr = num.toString(2);
  const byteBitStrArr = byteBitStr.split('');

  const startIDX = bit8Arr.length - byteBitStr.length;

  for (let idx = startIDX; idx < bit8Arr.length; idx += 1) {
    bit8Arr[idx] = byteBitStrArr[idx - startIDX];
  }

  return bit8Arr.join('');
};

export const testBit = (bitMap: Bytes, n: number): boolean => {
  return (bitMap[parseInt((n / 8).toString())] & (1 << n % 8)) !== 0;
};

export const testBitBigEndian = (bitMap: Bytes, n: number): boolean => {
  return (bitMap[parseInt((bitMap.length - n / 8 - 1).toString())] & (1 << n % 8)) !== 0;
};

// SetBitBigEndian sets the bit n in the bitmap to 1, in Big Endian.
export const setBitBigEndian = (bitMap: Bytes, n: number): void => {
  bitMap[parseInt((bitMap.length - n / 8 - 1).toString(10))] |= 1 << n % 8;
};

export const bytes2Hex = (u: Bytes): string => {
  const hextable = '0123456789abcdef';
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

export const str2Bytes = (str: string): Bytes => {
  return new Uint8Array(str2ArrBuf(str));
};

const str2ArrBuf = (str: string): ArrayBuffer => {
  const buf = new ArrayBuffer(str.length * 2); // 2 bytes for each char
  const bufView = new Uint16Array(buf);
  for (let i = 0, strLen = str.length; i < strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
};
