import { Hash, HashAlgorithm } from '../lib/hash/hash';
import { Bytes } from './bytes';

export type NodeType = 0 | 1 | 2;

export interface Node {
  type: NodeType;
  getKey: () => Promise<Hash>;
  value: Bytes;
  string: string;
}
