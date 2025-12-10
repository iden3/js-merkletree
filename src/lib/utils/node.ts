// LeafKey computes the key of a leaf node given the hIndex and hValue of the
// entry of the leaf.
import { Hash, HashAlgorithm, hashElemsKey } from '../hash/hash';

import { NODE_VALUE_BYTE_ARR_LENGTH } from '../../constants';
import { bigIntToUINT8Array } from './bigint';
import { Bytes, NodeType } from '../../types';

export const leafKey = async (k: Hash, v: Hash, algo: HashAlgorithm): Promise<Hash> => {
  return hashElemsKey(BigInt(1), [k.bigInt(), v.bigInt()], algo);
};

export const nodeValue = (type: NodeType, a: Hash, b: Hash): Bytes => {
  const bytes = new Uint8Array(NODE_VALUE_BYTE_ARR_LENGTH);
  const kBytes = bigIntToUINT8Array(a.bigInt());
  const vBytes = bigIntToUINT8Array(b.bigInt());
  bytes[0] = type;

  for (let idx = 1; idx < 33; idx += 1) {
    bytes[idx] = kBytes[idx - 1];
  }

  for (let idx = 33; idx <= NODE_VALUE_BYTE_ARR_LENGTH; idx += 1) {
    bytes[idx] = vBytes[idx - 33];
  }

  return bytes;
};
