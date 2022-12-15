import { poseidon } from '@iden3/js-crypto';

import { Hash } from '../hash/hash';
import { newHashFromBigInt } from './hash';
import { dropLast } from 'ramda';

export const poseidonHash = async (inputs: bigint[]): Promise<bigint> => {
  return poseidon.hash(inputs);
};

export const hashElems = async (e: Array<bigint>): Promise<Hash> => {
  const hashBigInt = await poseidonHash(e);
  return newHashFromBigInt(hashBigInt);
};

export const hashElemsKey = async (k: bigint, e: Array<bigint>): Promise<Hash> => {
  e[2] = k;
  e = dropLast(e.length - 3, e);
  const hashBigInt = await poseidonHash(e);

  return newHashFromBigInt(hashBigInt);
};
