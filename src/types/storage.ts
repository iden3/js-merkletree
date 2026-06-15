import type { Hash } from '../lib/hash/hash';
import type { Bytes } from './bytes';
import type { Node } from './node';

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
