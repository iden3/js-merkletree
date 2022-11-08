import bigInt from 'big-integer';
import { clone } from 'ramda';
import { HASH_BYTES_LENGTH } from '../../constants/index';
import { bytesEqual, bytesToBitArray, swapEndianness, bytes2Hex } from '../utils/index';
import { Bytes, IHash } from '../../types';
import { bigIntToUINT8Array } from '../utils/bigint';

export default class Hash implements IHash {
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
    return clone(this.bytes);
  }

  // bytes should be in big-endian
  set value(bytes: Bytes) {
    if (bytes.length !== HASH_BYTES_LENGTH) {
      throw `Expected 32 bytes, found ${bytes.length} bytes`;
    }
    this.bytes = swapEndianness(bytes);
  }

  String(): string {
    return this.BigInt().toString(10);
  }

  Hex(): string {
    const b = swapEndianness(bigIntToUINT8Array(this.BigInt()));
    return bytes2Hex(this.bytes);
  }

  Equals(hash: Hash): boolean {
    return bytesEqual(this.value, hash.value);
  }

  BigInt(): bigInt.BigInteger {
    const bytes = swapEndianness(this.value);
    return bigInt.fromArray(bytesToBitArray(bytes), 2);
  }
}
