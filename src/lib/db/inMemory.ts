// in Memory Database implementation

import type { Bytes, Node } from '../../types';
import type { ITreeStorage } from '../../types/storage';
import { type Hash, ZERO_HASH } from '../hash/hash';

export class InMemoryDB implements ITreeStorage {
  prefix: Bytes;
  private _kvMap: {
    [k in string]: Node;
  };
  private _currentRoot: Hash;

  constructor(_prefix: Bytes) {
    this.prefix = _prefix;
    this._kvMap = {};
    this._currentRoot = ZERO_HASH;
  }

  async get(k: Bytes): Promise<Node | undefined> {
    const kBytes = new Uint8Array([...this.prefix, ...k]);
    const val = this._kvMap[kBytes.toString()] ? this._kvMap[kBytes.toString()] : undefined;
    return val;
  }

  async put(k: Bytes, n: Node): Promise<void> {
    const kBytes = new Uint8Array([...this.prefix, ...k]);
    this._kvMap[kBytes.toString()] = n;
  }

  async getRoot(): Promise<Hash> {
    return this._currentRoot;
  }

  async setRoot(r: Hash): Promise<void> {
    this._currentRoot = r;
  }
}
