import { HASH_BYTES_LENGTH } from '../../constants';
import { bytesEqual, swapEndianness, bytes2Hex, bytes2BinaryString } from '../utils';
import { Bytes, IHash } from '../../types';

export class Hash implements IHash {
  // little endian
  bytes: Bytes;

  constructor(_bytes?: Bytes) {
    if (_bytes?.length) {
      if (_bytes.length !== HASH_BYTES_LENGTH) {
        throw new Error(`Expected ${HASH_BYTES_LENGTH} bytes, found ${_bytes.length} bytes`);
      }
      this.bytes = _bytes;
    } else {
      this.bytes = new Uint8Array(HASH_BYTES_LENGTH);
    }
  }

  // returns a new copy, in little endian
  get value(): Bytes {
    return this.bytes;
  }

  // bytes should be in big-endian
  set value(bytes: Bytes) {
    if (bytes.length !== HASH_BYTES_LENGTH) {
      throw `Expected 32 bytes, found ${bytes.length} bytes`;
    }
    this.bytes = swapEndianness(bytes);
  }

  string(): string {
    return this.bigInt().toString(10);
  }

  hex(): string {
    return bytes2Hex(this.bytes);
  }

  equals(hash: Hash): boolean {
    return bytesEqual(this.value, hash.value);
  }

  bigInt(): bigint {
    const bytes = swapEndianness(this.value);
    return BigInt(bytes2BinaryString(bytes));
  }
}

export const ZERO_HASH = new Hash();
