// const siblingBytes = bs.slice(this.notEmpties.length + PROOF_FLAG_LEN);
import { HASH_BYTES_LENGTH } from '../../constants';
import { Bytes } from '../../types';
import { Path, Siblings } from '../../types/merkletree';
import { testBit } from './bytes';

export const getPath = (numLevels: number, k: Bytes): Path => {
  const path = new Array<boolean>(numLevels);

  for (let idx = 0; idx < numLevels; idx += 1) {
    path[idx] = testBit(k, idx);
  }
  return path;
};

export const siblings2Bytes = (siblings: Siblings): Bytes => {
  const siblingBytesBuff = new ArrayBuffer(HASH_BYTES_LENGTH * siblings.length);
  const siblingBytes = new Uint8Array(siblingBytesBuff);
  siblings.forEach((v, i) => {
    siblingBytes.set(v.value, i * HASH_BYTES_LENGTH);
  });

  return siblingBytes;
};
