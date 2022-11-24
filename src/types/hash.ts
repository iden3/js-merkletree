import { Bytes } from './index';
import Hash from '../lib/hash/hash';

export interface IHash {
  value: Bytes;

  string: () => string;
  hex: () => string;
  equals: (hash: Hash) => boolean;
  bigInt(): bigint;
}
