import { Bytes } from '../../types';
import { NodeAux, Siblings } from '../../types/merkletree';
import { ELEM_BYTES_LEN, NOT_EMPTIES_LEN, PROOF_FLAG_LEN } from '../../constants';
import { siblignsFroomProof, siblings2Bytes } from '../utils';

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
    const bs: Bytes = new Uint8Array(arrBuff);

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
