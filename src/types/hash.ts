import { Hash } from '../lib/hash/hash';
import { Bytes } from './bytes';

export interface IHash {
  value: Bytes;

  string: () => string;
  hex: () => string;
  equals: (hash: Hash) => boolean;
  bigInt(): bigint;
}
