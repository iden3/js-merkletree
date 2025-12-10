import { NodeAux, Siblings } from '../../types/merkletree';
import { ELEM_BYTES_LEN, NOT_EMPTIES_LEN, PROOF_FLAG_LEN } from '../../constants';
import { bytesEqual, getPath, setBitBigEndian, siblings2Bytes, testBitBigEndian } from '../utils';
import { Hash, HashAlgorithm, ZERO_HASH } from '../hash/hash';
import { NodeMiddle } from '../node/node';
import { leafKey } from '../utils/node';
import { ErrNodeAuxNonExistAgainstHIndex } from '../errors/proof';
import { Bytes } from '../../types';

export interface ProofJSON {
  existence: boolean;
  siblings: string[];
  node_aux?: NodeAuxJSON; // this is a right representation of auxiliary node field according to the specification, nodeAux will be deprecated.
  /**
   * @deprecated old version is deprecated, do not use it.
   */
  nodeAux?: NodeAuxJSON; // old version of representation of auxiliary node.
}

export interface NodeAuxJSON {
  key: string;
  value: string;
}

export class Proof {
  existence: boolean;
  private depth: number;
  // notEmpties is a bitmap of non-empty siblings found in siblings
  private notEmpties: Bytes;
  private siblings: Siblings;
  nodeAux: NodeAux | undefined;

  constructor(obj?: { siblings: Siblings; nodeAux: NodeAux | undefined; existence: boolean }) {
    this.existence = obj?.existence ?? false;
    this.depth = 0;
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
      siblings: this.allSiblings().map((s) => s.toJSON()),
      node_aux: this.nodeAux
        ? {
          key: this.nodeAux.key.toJSON(),
          value: this.nodeAux.value.toJSON()
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
        this.depth = i + 1;
      }
    }
    return { notEmpties, siblings: reducedSiblings };
  }

  public static fromJSON(obj: ProofJSON): Proof {
    let nodeAux: NodeAux | undefined = undefined;
    const nodeAuxJson: NodeAuxJSON | undefined = obj.node_aux ?? obj.nodeAux; // we keep backward compatibility and support both representations
    if (nodeAuxJson) {
      nodeAux = {
        key: Hash.fromString(nodeAuxJson.key),
        value: Hash.fromString(nodeAuxJson.value)
      };
    }
    const existence = obj.existence ?? false;

    const siblings: Siblings = obj.siblings.map((s) => Hash.fromString(s));

    return new Proof({ existence, nodeAux, siblings });
  }

  allSiblings(): Siblings {
    return Proof.buildAllSiblings(this.depth, this.notEmpties, this.siblings);
  }

  public static buildAllSiblings(
    depth: number,
    notEmpties: Uint8Array,
    siblings: Hash[]
  ): Siblings {
    let sibIdx = 0;
    const allSiblings: Siblings = [];

    for (let i = 0; i < depth; i += 1) {
      if (testBitBigEndian(notEmpties, i)) {
        allSiblings.push(siblings[sibIdx]);
        sibIdx += 1;
      } else {
        allSiblings.push(ZERO_HASH);
      }
    }
    return allSiblings;
  }
}

/**
 * @deprecated The method should not be used and will be removed in the next major version,
 * please use proof.allSiblings instead
 */
// eslint-disable-next-line @cspell/spellchecker
export const siblignsFroomProof = (proof: Proof): Siblings => {
  return proof.allSiblings();
};

export const verifyProof = async (
  rootKey: Hash,
  proof: Proof,
  k: bigint,
  v: bigint,
  algo: HashAlgorithm = HashAlgorithm.Poseidon
): Promise<boolean> => {
  try {
    const rFromProof = await rootFromProof(proof, k, v, algo);
    return bytesEqual(rootKey.value, rFromProof.value);
  } catch (err) {
    if (err === ErrNodeAuxNonExistAgainstHIndex) {
      return false;
    }
    throw err;
  }
};

export const rootFromProof = async (proof: Proof, k: bigint, v: bigint, algo: HashAlgorithm): Promise<Hash> => {
  const kHash = Hash.fromBigInt(k);
  const vHash = Hash.fromBigInt(v);
  let midKey: Hash;

  if (proof.existence) {
    midKey = await leafKey(kHash, vHash, algo);
  } else {
    if (typeof proof.nodeAux === 'undefined') {
      midKey = ZERO_HASH;
    } else {
      const nodeAux = proof.nodeAux as unknown as NodeAux;
      if (bytesEqual(kHash.value, nodeAux.key.value)) {
        throw ErrNodeAuxNonExistAgainstHIndex;
      }
      midKey = await leafKey(nodeAux.key, nodeAux.value, algo);
    }
  }

  const siblings = proof.allSiblings();

  const path = getPath(siblings.length, kHash.value);

  for (let i = siblings.length - 1; i >= 0; i -= 1) {
    if (path[i]) {
      midKey = await new NodeMiddle(siblings[i], midKey, algo).getKey();
    } else {
      midKey = await new NodeMiddle(midKey, siblings[i], algo).getKey();
    }
  }

  return midKey;
};
