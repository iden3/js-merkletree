// in Memory Database implementation

import { Bytes, Node } from '../../types';
import { ITreeStorage } from '../../types/storage';
import { Hash, ZERO_HASH } from '../hash/hash';
import { NODE_TYPE_EMPTY, NODE_TYPE_LEAF, NODE_TYPE_MIDDLE } from '../../constants';
import { NodeEmpty, NodeLeaf, NodeMiddle } from '../node/node';
import { bytes2Hex } from '../utils';

export class LocalStorageDB implements ITreeStorage {
  #currentRoot: Hash;

  constructor(private readonly _prefix: Bytes) {
    const rootStr = localStorage.getItem(bytes2Hex(_prefix));
    if (rootStr) {
      const bytes: number[] = JSON.parse(rootStr);

      this.#currentRoot = new Hash(Uint8Array.from(bytes));
    } else {
      this.#currentRoot = ZERO_HASH;
    }
  }

  async get(k: Bytes): Promise<Node | undefined> {
    const kBytes = new Uint8Array([...this._prefix, ...k]);
    const key = bytes2Hex(kBytes);
    const val = localStorage.getItem(key);

    if (val === null) {
      return undefined;
    }

    const obj = JSON.parse(val);
    switch (obj.type) {
      case NODE_TYPE_EMPTY:
        return new NodeEmpty();
      case NODE_TYPE_MIDDLE:
        // eslint-disable-next-line no-case-declarations
        const { childL, childR } = obj;

        // eslint-disable-next-line no-case-declarations
        const cL = new Hash();
        cL.bytes = Uint8Array.from(
          Object.keys(childL.bytes).map((k) => {
            return childL.bytes[k];
          })
        );

        // eslint-disable-next-line no-case-declarations
        const cR = new Hash();
        cR.bytes = Uint8Array.from(
          Object.keys(childR.bytes).map((k) => {
            return childR.bytes[k];
          })
        );

        return new NodeMiddle(cL, cR);
      case NODE_TYPE_LEAF:
        // eslint-disable-next-line no-case-declarations
        const { entry } = obj;

        // eslint-disable-next-line no-case-declarations
        const k = new Hash();
        k.bytes = Uint8Array.from(
          Object.keys(entry[0].bytes).map((k) => {
            return entry[0].bytes[k];
          })
        );

        // eslint-disable-next-line no-case-declarations
        const v = new Hash();
        v.bytes = Uint8Array.from(
          Object.keys(entry[1].bytes).map((k) => {
            return entry[1].bytes[k];
          })
        );

        return new NodeLeaf(k, v);
    }

    throw `error: value found for key ${bytes2Hex(kBytes)} is not of type Node`;
  }

  async put(k: Bytes, n: Node): Promise<void> {
    const kBytes = new Uint8Array([...this._prefix, ...k]);
    const key = bytes2Hex(kBytes);
    const val = JSON.stringify(n);
    localStorage.setItem(key, val);
  }

  getRoot(): Hash {
    return this.#currentRoot;
  }

  async setRoot(r: Hash): Promise<void> {
    this.#currentRoot = r;
    localStorage.setItem(bytes2Hex(this._prefix), JSON.stringify(Array.from(r.bytes)));
  }
}
