import { Bytes, Node } from '../../types';
import { ITreeStorage } from '../../types/storage';
import { Hash, ZERO_HASH, HashAlgorithm } from '../hash/hash';
import { bytes2Hex } from '../utils';
import { get, set, UseStore, createStore } from 'idb-keyval';
import { NODE_TYPE_EMPTY, NODE_TYPE_LEAF, NODE_TYPE_MIDDLE } from '../../constants';
import { NodeEmpty, NodeLeaf, NodeMiddle } from '../node/node';

export class IndexedDBStorage implements ITreeStorage {
  public static readonly storageName = 'merkle-tree';

  private readonly _prefixHash: string;
  private readonly _store: UseStore;

  private _currentRoot: Hash;
  private _algo: HashAlgorithm;

  constructor(private readonly _prefix: Bytes, algo?: HashAlgorithm, databaseName?: string) {
    this._currentRoot = ZERO_HASH;
    this._prefixHash = bytes2Hex(_prefix);
    this._store = createStore(
      `${databaseName ?? IndexedDBStorage.storageName}-db`,
      IndexedDBStorage.storageName
    );
    this._algo = algo ?? HashAlgorithm.Poseidon;
  }

  async get(k: Bytes): Promise<Node | undefined> {
    const kBytes = new Uint8Array([...this._prefix, ...k]);
    const key = bytes2Hex(kBytes);
    const obj = await get(key, this._store);
    if (obj === null || obj === undefined) {
      return undefined;
    }
    if (obj.type === NODE_TYPE_EMPTY) {
      return new NodeEmpty();
    }
    if (obj.type === NODE_TYPE_MIDDLE) {
      const cL = new Hash(Uint8Array.from(obj.childL.bytes));
      const cR = new Hash(Uint8Array.from(obj.childR.bytes));
      return new NodeMiddle(cL, cR, this._algo);
    }
    if (obj.type === NODE_TYPE_LEAF) {
      const k = new Hash(Uint8Array.from(obj.entry[0].bytes));
      const v = new Hash(Uint8Array.from(obj.entry[1].bytes));

      return new NodeLeaf(k, v, this._algo);
    }
    throw new Error(`error: value found for key ${key} is not of type Node`);
  }

  async put(k: Bytes, n: Node): Promise<void> {
    const kBytes = new Uint8Array([...this._prefix, ...k]);
    const key = bytes2Hex(kBytes);
    await set(key, n, this._store);
  }

  async getRoot(): Promise<Hash> {
    if (!this._currentRoot.equals(ZERO_HASH)) {
      return this._currentRoot;
    }
    const root = await get(this._prefixHash, this._store);

    if (!root) {
      this._currentRoot = ZERO_HASH;
    } else {
      this._currentRoot = new Hash(root.bytes);
    }
    return this._currentRoot;
  }

  async setRoot(r: Hash): Promise<void> {
    await set(this._prefixHash, r, this._store);
    this._currentRoot = r;
  }
  getHashAlgorithm(): HashAlgorithm {
    return this._algo;
  }
}
