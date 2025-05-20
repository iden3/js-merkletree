import { ELEM_BYTES_LEN } from '../../constants';
import { Bytes } from '../../types';
import { bytes2Hex, newBigIntFromBytes, swapEndianness } from '../utils';

export class ElemBytes {
  // Little Endian
  private _bytes: Bytes;

  constructor() {
    this._bytes = new Uint8Array(ELEM_BYTES_LEN);
  }

  get value(): Bytes {
    return this._bytes;
  }

  set value(b: Bytes) {
    this._bytes = b;
  }

  bigInt(): bigint {
    return newBigIntFromBytes(swapEndianness(this._bytes));
  }

  string(): string {
    const hexStr = bytes2Hex(this._bytes.slice(0, 4));
    return `${hexStr}...`;
  }
}
