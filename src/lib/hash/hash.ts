import { HASH_BYTES_LENGTH } from '../../constants/index';
import { bytesEqual, swapEndianness, bytes2Hex, bytes2BinaryString } from '../utils/index';
import { Bytes, IHash } from '../../types';

export class Hash implements IHash {
  // little endian
  bytes: Bytes;

  constructor() {
    // const buffer = new ArrayBuffer(HASH_BYTES_LENGTH);
    this.bytes = new Uint8Array([
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
    ]);
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
