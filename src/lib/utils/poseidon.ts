import bigInt from 'big-integer';
import Hash from '../hash/hash';
import { newHashFromBigInt } from './hash';
import { dropLast } from 'ramda';

const circomlibjs = require('circomlibjs');

export const poseidonHash = async (inputs: bigInt.BigInteger[]): Promise<bigInt.BigInteger> => {
  const poseidon = await circomlibjs.buildPoseidon();
  return bigInt(poseidon.F.toString(poseidon(inputs.map((b) => b.toString(10))), 10));
};

export const hashElems = async (e: Array<bigInt.BigInteger>): Promise<Hash> => {
  const hashBigInt = await poseidonHash(e);
  return newHashFromBigInt(hashBigInt);
};

export const hashElemsKey = async (
  k: bigInt.BigInteger,
  e: Array<bigInt.BigInteger>
): Promise<Hash> => {
  e[2] = k;
  e = dropLast(e.length - 3, e);
  const hashBigInt = await poseidonHash(e);

  return newHashFromBigInt(hashBigInt);
};
