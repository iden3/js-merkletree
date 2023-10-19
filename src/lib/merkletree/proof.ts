import { NodeAux, Siblings } from '../../types/merkletree';
import { ELEM_BYTES_LEN, NOT_EMPTIES_LEN, PROOF_FLAG_LEN } from '../../constants';
import { bytesEqual, getPath, setBitBigEndian, siblings2Bytes, testBitBigEndian } from '../utils';
import { Hash, ZERO_HASH } from '../hash/hash';
import { NodeMiddle } from '../node/node';
import { leafKey } from '../utils/node';
import { ErrNodeAuxNonExistAgainstHIndex } from '../errors/proof';
import { Bytes } from '../../types';

export interface ProofJSON {
  existence: boolean;
  siblings: string[];
  nodeAux: NodeAuxJSON | undefined;
}

export interface NodeAuxJSON {
  key: string;
  value: string;
}

export class Proof {
  existence: boolean;
  private depth: number;
  // notempties is a bitmap of non-empty siblings found in siblings
  private notEmpties: Bytes;
  private siblings: Siblings;
  nodeAux: NodeAux | undefined;

  constructor(obj?: { siblings: Siblings; nodeAux: NodeAux | undefined; existence: boolean }) {
    this.existence = obj?.existence ?? false;
    this.depth = obj?.siblings.length ?? 0;
    this.nodeAux = obj?.nodeAux;

    const { siblings, notEmpties } = this.reduceSiblings(obj?.siblings);
    this.siblings = siblings;
    this.notEmpties = notEmpties;
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

  toJSON() {
    return {
      existence: this.existence,
      siblings: this.allSiblings(),
      nodeAux: this.nodeAux
        ? {
          key: this.nodeAux.key,
          value: this.nodeAux.value,
        }
        : undefined
    };
  }

  private reduceSiblings(siblings?: Siblings): { notEmpties: Uint8Array; siblings: Siblings } {
    const reducedSiblings: Siblings = [];
    const notEmpties = new Uint8Array(NOT_EMPTIES_LEN);

    if (!siblings) {
      return { siblings: reducedSiblings, notEmpties };
    }
    for (let i = 0; i < siblings.length; i++) {
      const sibling = siblings[i];
      if (JSON.stringify(siblings[i]) !== JSON.stringify(ZERO_HASH)) {
        setBitBigEndian(notEmpties, i);
        reducedSiblings.push(sibling);
      }
    }
    return { notEmpties, siblings: reducedSiblings };
  }

  public static fromJSON(obj: ProofJSON): Proof {
    let nodeAux: NodeAux | undefined = undefined;
    if (obj.nodeAux) {
      nodeAux = {
        key: Hash.fromString(obj.nodeAux.key),
        value: Hash.fromString(obj.nodeAux.value)
      };
    }
    const existence = obj.existence ?? false;

    const siblings: Siblings = obj.siblings.map((s) => Hash.fromString(s));

    return new Proof({ existence, nodeAux, siblings });
  }

  allSiblings(): Siblings {
    let sibIdx = 0;
    const siblings: Siblings = [];

    for (let i = 0; i < this.depth; i += 1) {
      if (testBitBigEndian(this.notEmpties, i)) {
        siblings.push(this.siblings[sibIdx]);
        sibIdx += 1;
      } else {
        siblings.push(ZERO_HASH);
      }
    }

    return siblings;
  }
}

/**
 * @deprecated The method should not be used and will be removed in the next major version,
 * please use proof.allSiblings instead
 */
export const siblignsFroomProof = (proof: Proof): Siblings => {
  return proof.allSiblings();
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
  const kHash = Hash.fromBigInt(k);
  const vHash = Hash.fromBigInt(v);
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

  const siblings = proof.allSiblings();

  const path = getPath(siblings.length, kHash.value);

  for (let i = siblings.length - 1; i >= 0; i -= 1) {
    if (path[i]) {
      midKey = await new NodeMiddle(siblings[i], midKey).getKey();
    } else {
      midKey = await new NodeMiddle(midKey, siblings[i]).getKey();
    }
  }

  return midKey;
};
