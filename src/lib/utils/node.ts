// LeafKey computes the key of a leaf node given the hIndex and hValue of the
// entry of the leaf.
import Hash from '../hash/hash';
import { hashElemsKey } from './poseidon';

import { NODE_VALUE_BYTE_ARR_LENGTH } from '../../constants';
import { bigIntToUINT8Array } from './bigint';
import { Bytes, NodeType } from '../../types';

export const leafKey = async (k: Hash, v: Hash): Promise<Hash> => {
  return await hashElemsKey(BigInt(1), [k.BigInt(), v.BigInt()]);
};

export const nodeValue = (type: NodeType, a: Hash, b: Hash): Bytes => {
  const bytes = new Uint8Array(NODE_VALUE_BYTE_ARR_LENGTH);
  const kBytes = bigIntToUINT8Array(a.BigInt());
  const vBytest = bigIntToUINT8Array(b.BigInt());
  bytes[0] = type;

  for (let idx = 1; idx < 33; idx += 1) {
    bytes[idx] = kBytes[idx - 1];
  }

  for (let idx = 33; idx <= NODE_VALUE_BYTE_ARR_LENGTH; idx += 1) {
    bytes[idx] = kBytes[idx - 33];
  }

  return bytes;
};
