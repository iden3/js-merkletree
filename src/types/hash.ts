import { Bytes } from './index';
import { BigInteger } from 'big-integer';
import Hash from '../lib/hash/hash';

export interface IHash {
  value: Bytes;

  String: () => string;
  Hex: () => string;
  Equals: (hash: Hash) => boolean;
  BigInt(): BigInteger;
}
