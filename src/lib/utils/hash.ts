import bigInt, { BigInteger } from 'big-integer';

import { HASH_BYTES_LENGTH } from '../../constants';
import { Bytes } from '../../types';
import { checkBigIntInField } from './crypto';
import { bytesToBitArray, swapEndianness } from './bytes';
import Hash from '../hash/hash';
import { bigIntToUINT8Array } from './bigint';

// returned bytes endianess will be big-endian
export const newHashFromBigInt = (bigNum: BigInteger): Hash => {
  if (!checkBigIntInField(bigNum)) {
    throw 'NewBigIntFromHashBytes: Value not inside the Finite Field';
  }

  const bytes = bigIntToUINT8Array(bigNum);

  const hash = new Hash();
  hash.value = bytes;
  return hash;
};

export const newHashFromHex = (h: string): Hash => {
  const hex = h.replace('0x', '');
  const bigNum = bigInt(hex, 16);

  if (!checkBigIntInField(bigNum)) {
    throw 'NewBigIntFromHashBytes: Value not inside the Finite Field';
  }

  return newHashFromBigInt(bigNum);
};

// return object of class Hash from a decimal string
export const newHashFromString = (decimalString: string): Hash => {
  const bigNum = bigInt(decimalString, 10);

  if (!checkBigIntInField(bigNum)) {
    throw 'NewBigIntFromHashBytes: Value not inside the Finite Field';
  }

  return newHashFromBigInt(bigNum);
};
