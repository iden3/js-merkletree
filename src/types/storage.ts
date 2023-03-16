import { Node } from './node';
import { Bytes } from './bytes';
import { Hash } from '../lib/hash/hash';

export interface ITreeStorage {
  get: (k: Bytes) => Promise<Node | undefined>;
  put: (k: Bytes, n: Node) => Promise<void>;
  getRoot: () => Promise<Hash>;
  setRoot: (r: Hash) => Promise<void>;
}

export type KV = {
  k: Bytes;
  v: Node;
};

export type KVMap = Map<Bytes, KV>;
