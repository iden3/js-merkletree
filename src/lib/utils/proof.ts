import { NodeAux, Siblings } from '../../types/merkletree';
import { Proof } from '../merkletree/proof';

import { bytesEqual, testBitBigEndian } from './bytes';

import { Hash, ZERO_HASH } from '../hash/hash';

import { newHashFromBigInt } from './hash';
import { leafKey } from './node';
import { getPath } from './merkletree';
import { NodeMiddle } from '../node/node';
import { ErrNodeAuxNonExistAgainstHIndex } from '../errors/proof';

export const siblignsFroomProof = (proof: Proof): Siblings => {
  let sibIdx = 0;
  const siblings: Siblings = [];

  for (let i = 0; i < proof.depth; i += 1) {
    if (testBitBigEndian(proof.notEmpties, i)) {
      siblings.push(proof.siblings[sibIdx]);
      sibIdx += 1;
    } else {
      siblings.push(ZERO_HASH);
    }
  }

  return siblings;
};

export const verifyProof = async (
  rootKey: Hash,
  proof: Proof,
  k: bigint,
  v: bigint
): Promise<boolean> => {
  try {
    const rFromProof = await rootFromProof(proof, k, v);
    return bytesEqual(rootKey.value, rFromProof.value);
  } catch (err) {
    if (err === ErrNodeAuxNonExistAgainstHIndex) {
      return false;
    }
    throw err;
  }
};

export const rootFromProof = async (proof: Proof, k: bigint, v: bigint): Promise<Hash> => {
  const kHash = newHashFromBigInt(k);
  const vHash = newHashFromBigInt(v);

  let sibIdx = proof.siblings.length - 1;
  let midKey: Hash;

  if (proof.existence) {
    midKey = await leafKey(kHash, vHash);
  } else {
    if (typeof proof.nodeAux === 'undefined') {
      midKey = ZERO_HASH;
    } else {
      const nodeAux = proof.nodeAux as unknown as NodeAux;
      if (bytesEqual(kHash.value, nodeAux.key.value)) {
        throw ErrNodeAuxNonExistAgainstHIndex;
      }
      midKey = await leafKey(nodeAux.key, nodeAux.value);
    }
  }

  const path = getPath(proof.depth, kHash.value);
  let siblingKey: Hash;

  for (let i = proof.depth - 1; i >= 0; i -= 1) {
    if (testBitBigEndian(proof.notEmpties, i)) {
      siblingKey = proof.siblings[sibIdx];
      sibIdx -= 1;
    } else {
      siblingKey = ZERO_HASH;
    }
    if (path[i]) {
      midKey = await new NodeMiddle(siblingKey, midKey).getKey();
    } else {
      midKey = await new NodeMiddle(midKey, siblingKey).getKey();
    }
  }

  return midKey;
};
