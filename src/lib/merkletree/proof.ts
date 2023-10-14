import { NodeAux, Siblings } from '../../types/merkletree';
import { ELEM_BYTES_LEN, NOT_EMPTIES_LEN, PROOF_FLAG_LEN } from '../../constants';
import { bytesEqual, getPath, siblings2Bytes, testBitBigEndian } from '../utils';
import { Hash, ZERO_HASH, newHashFromBigInt } from '../hash/hash';
import { NodeMiddle } from '../node/node';
import { leafKey } from '../utils/node';
import { ErrNodeAuxNonExistAgainstHIndex } from '../errors/proof';
import { Bytes } from '../../types';

export class Proof {
  existence: boolean;
  depth: number;
  // notempties is a bitmap of non-empty siblings found in siblings
  notEmpties: Bytes;
  siblings: Siblings;
  nodeAux: NodeAux | undefined;

  constructor() {
    this.existence = false;
    this.depth = 0;
    this.siblings = [];

    const arrBuff = new ArrayBuffer(NOT_EMPTIES_LEN);
    this.notEmpties = new Uint8Array(arrBuff);
  }

  bytes(): Bytes {
    let bsLen = PROOF_FLAG_LEN + this.notEmpties.length + ELEM_BYTES_LEN * this.siblings.length;

    if (typeof this.nodeAux !== 'undefined') {
      bsLen += 2 * ELEM_BYTES_LEN;
    }

    const arrBuff = new ArrayBuffer(bsLen);
    const bs = new Uint8Array(arrBuff);

    if (!this.existence) {
      bs[0] |= 1;
    }
    bs[1] = this.depth;
    bs.set(this.notEmpties, PROOF_FLAG_LEN);
    const siblingBytes = siblings2Bytes(this.siblings);
    bs.set(siblingBytes, this.notEmpties.length + PROOF_FLAG_LEN);

    if (typeof this.nodeAux !== 'undefined') {
      bs[0] |= 2;
      bs.set(this.nodeAux.key.value, bs.length - 2 * ELEM_BYTES_LEN);
      bs.set(this.nodeAux.value.value, bs.length - 1 * ELEM_BYTES_LEN);
    }
    return bs;
  }

  allSiblings(): Siblings {
    return siblignsFroomProof(this);
  }
}

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
