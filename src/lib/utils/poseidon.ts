import { poseidon } from '@iden3/js-crypto';

import { Hash } from '../hash/hash';
import { newHashFromBigInt } from './hash';

export const poseidonHash = async (inputs: bigint[]): Promise<bigint> => {
  return poseidon.hash(inputs);
};

export const hashElems = async (e: Array<bigint>): Promise<Hash> => {
  const hashBigInt = await poseidonHash(e);
  return newHashFromBigInt(hashBigInt);
};

export const hashElemsKey = async (k: bigint, e: Array<bigint>): Promise<Hash> => {
  const hashBigInt = await poseidonHash([...e, k]);

  return newHashFromBigInt(hashBigInt);
};
