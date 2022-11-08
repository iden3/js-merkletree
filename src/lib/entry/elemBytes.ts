import { ELEM_BYTES_LEN } from '../../constants';
import { Bytes } from '../../types';
import { bytes2Hex, newBigIntFromBytes, swapEndianness } from '../utils';

export class ElemBytes {
  // Little Endian
  #bytes: Bytes;

  constructor() {
    this.#bytes = new Uint8Array(ELEM_BYTES_LEN);
  }

  get value() {
    return this.#bytes;
  }

  set value(b: Bytes) {
    this.#bytes = b;
  }

  bigInt() {
    return newBigIntFromBytes(swapEndianness(this.#bytes));
  }

  string() {
    const hexStr = bytes2Hex(this.#bytes.slice(0, 4));
    return `${hexStr}...`;
  }
}
