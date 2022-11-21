import { checkBigIntInField } from './crypto';
import Hash from '../hash/hash';
import { bigIntToUINT8Array } from './bigint';

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
  const bigNum = BigInt(h);

  if (!checkBigIntInField(bigNum)) {
    throw 'NewBigIntFromHashBytes: Value not inside the Finite Field';
  }

  return newHashFromBigInt(bigNum);
};

// return object of class Hash from a decimal string
export const newHashFromString = (decimalString: string): Hash => {
  const bigNum = BigInt(decimalString);

  if (!checkBigIntInField(bigNum)) {
    throw 'NewBigIntFromHashBytes: Value not inside the Finite Field';
  }

  return newHashFromBigInt(bigNum);
};
