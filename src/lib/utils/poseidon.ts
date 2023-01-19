import { poseidon } from '@iden3/js-crypto';

import { Hash } from '../hash/hash';
import { newHashFromBigInt } from './hash';

export const hashElems = (e: Array<bigint>): Hash => {
  const hashBigInt = poseidon.hash(e);
  return newHashFromBigInt(hashBigInt);
};

export const hashElemsKey = (k: bigint, e: Array<bigint>): Hash => {
  const hashBigInt = poseidon.hash([...e, k]);
  return newHashFromBigInt(hashBigInt);
};
