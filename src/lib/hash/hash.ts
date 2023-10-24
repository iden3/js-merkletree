import { HASH_BYTES_LENGTH } from '../../constants';
import {
  bytesEqual,
  swapEndianness,
  bytes2Hex,
  bytes2BinaryString,
  checkBigIntInField,
  bigIntToUINT8Array
} from '../utils';
import { Bytes, IHash, Siblings } from '../../types';
import { Hex, poseidon } from '@iden3/js-crypto';

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

  static fromString(s: string): Hash {
    try {
      return Hash.fromBigInt(BigInt(s));
    } catch (e) {
      const deserializedHash = JSON.parse(s);
      const bytes = Uint8Array.from(Object.values(deserializedHash.bytes));
      return new Hash(bytes);
    }
  }
  static fromBigInt(i: bigint): Hash {
    if (!checkBigIntInField(i)) {
      throw new Error('NewBigIntFromHashBytes: Value not inside the Finite Field');
    }

    const bytes = bigIntToUINT8Array(i);

    return new Hash(swapEndianness(bytes));
  }

  static fromHex(h: string | undefined): Hash {
    if (!h) {
      return ZERO_HASH;
    }
    return new Hash(Hex.decodeString(h));
  }

  toJSON() {
    return this.string();
  }
}

export const ZERO_HASH = new Hash();

/**
 * @deprecated The method should not be used and will be removed in the next major version,
 * please use Hash.fromBigInt instead
 */
export const newHashFromBigInt = (bigNum: bigint): Hash => {
  return Hash.fromBigInt(bigNum);
};

/**
 * @deprecated The method should not be used and will be removed in the next major version,
 * please use Hash.fromBigInt instead
 */
export const newHashFromHex = (h: string): Hash => {
  return Hash.fromHex(h);
};

/**
 * @deprecated The method should not be used and will be removed in the next major version,
 * please use Hash.fromBigString instead
 */
export const newHashFromString = (decimalString: string): Hash => {
  return Hash.fromString(decimalString);
};

export const hashElems = (e: Array<bigint>): Hash => {
  const hashBigInt = poseidon.hash(e);
  return Hash.fromBigInt(hashBigInt);
};

export const hashElemsKey = (k: bigint, e: Array<bigint>): Hash => {
  const hashBigInt = poseidon.hash([...e, k]);
  return Hash.fromBigInt(hashBigInt);
};

export const circomSiblingsFromSiblings = (siblings: Siblings, levels: number): Siblings => {
  for (let i = siblings.length; i < levels; i += 1) {
    siblings.push(ZERO_HASH);
  }
  return siblings;
};
