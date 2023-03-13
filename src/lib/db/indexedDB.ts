import { Bytes, Node } from '../../types';
import { ITreeStorage } from '../../types/storage';
import { Hash, ZERO_HASH } from '../hash/hash';
import { bytes2Hex } from '../utils';
import { get, set, UseStore, createStore } from 'idb-keyval';

export class IndexedDBStorage implements ITreeStorage {
  public static readonly storageName = 'merkle-tree';

  private readonly _store: UseStore;

  #currentRoot: Hash;

  constructor(private readonly _prefix: Bytes) {
    this._store = createStore(`${IndexedDBStorage.storageName}-db`, IndexedDBStorage.storageName);
    this.#currentRoot = ZERO_HASH;
    get(bytes2Hex(_prefix), this._store).then((root) => {
      this.#currentRoot = root || ZERO_HASH;
    });
  }

  async get(k: Bytes): Promise<Node | undefined> {
    const kBytes = new Uint8Array([...this._prefix, ...k]);
    const key = bytes2Hex(kBytes);
    return await get(key, this._store);
  }

  async put(k: Bytes, n: Node): Promise<void> {
    const kBytes = new Uint8Array([...this._prefix, ...k]);
    const key = bytes2Hex(kBytes);
    await set(key, n, this._store);
  }

  getRoot(): Hash {
    return this.#currentRoot;
  }

  async setRoot(r: Hash): Promise<void> {
    this.#currentRoot = r;
    await set(bytes2Hex(this._prefix), r, this._store);
  }
}
