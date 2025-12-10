// in Memory Database implementation

import { Bytes, Node } from '../../types';
import { ITreeStorage } from '../../types/storage';
import { Hash, ZERO_HASH, HashAlgorithm } from '../hash/hash';

export class InMemoryDB implements ITreeStorage {
  prefix: Bytes;
  _algo: HashAlgorithm;

  private _kvMap: {
    [k in string]: Node;
  };
  private _currentRoot: Hash;

  constructor(_prefix: Bytes, algo?: HashAlgorithm) {
    this.prefix = _prefix;
    this._kvMap = {};
    this._currentRoot = ZERO_HASH;
    this._algo = algo ?? HashAlgorithm.Poseidon;
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
  getHashAlgorithm(): HashAlgorithm {
    return this._algo;
  }
}
