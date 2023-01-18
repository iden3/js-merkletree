import { checkBigIntInField } from './crypto';
import { Hash, ZERO_HASH } from '../hash/hash';

import { bigIntToUINT8Array } from './bigint';
import { Hex } from '@iden3/js-crypto';
import { swapEndianness } from './bytes';

// returned bytes endianess will be big-endian
export const newHashFromBigInt = (bigNum: bigint): Hash => {
  if (!checkBigIntInField(bigNum)) {
    throw 'NewBigIntFromHashBytes: Value not inside the Finite Field';
  }

  const bytes = bigIntToUINT8Array(bigNum);

  const hash = new Hash();
  hash.value = bytes;
  return hash;
};

export const newHashFromHex = (h: string): Hash => {
  if (!h) {
    return ZERO_HASH;
  }

  // TODO: add in field check

  const hash = new Hash();
  hash.value = swapEndianness(Hex.decodeString(h));
  return hash;
};

// return object of class Hash from a decimal string
export const newHashFromString = (decimalString: string): Hash => {
  const bigNum = BigInt(decimalString);

  if (!checkBigIntInField(bigNum)) {
    throw 'NewBigIntFromHashBytes: Value not inside the Finite Field';
  }

  return newHashFromBigInt(bigNum);
};
