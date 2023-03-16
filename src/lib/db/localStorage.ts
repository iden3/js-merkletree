/* eslint-disable no-case-declarations */

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
        const cL = new Hash(Uint8Array.from(obj.childL));
        const cR = new Hash(Uint8Array.from(obj.childR));

        return new NodeMiddle(cL, cR);
      case NODE_TYPE_LEAF:
        const k = new Hash(Uint8Array.from(obj.entry[0]));
        const v = new Hash(Uint8Array.from(obj.entry[1]));

        return new NodeLeaf(k, v);
    }

    throw `error: value found for key ${bytes2Hex(kBytes)} is not of type Node`;
  }

  async put(k: Bytes, n: Node): Promise<void> {
    const kBytes = new Uint8Array([...this._prefix, ...k]);
    const key = bytes2Hex(kBytes);
    const toSerialize: Record<string, unknown> = {
      type: n.type
    };
    if (n instanceof NodeMiddle) {
      toSerialize.childL = Array.from(n.childL.bytes);
      toSerialize.childR = Array.from(n.childR.bytes);
    } else if (n instanceof NodeLeaf) {
      toSerialize.entry = [Array.from(n.entry[0].bytes), Array.from(n.entry[1].bytes)];
    }
    const val = JSON.stringify(toSerialize);
    localStorage.setItem(key, val);
  }

  async getRoot(): Promise<Hash> {
    return this.#currentRoot;
  }

  async setRoot(r: Hash): Promise<void> {
    this.#currentRoot = r;
    localStorage.setItem(bytes2Hex(this._prefix), JSON.stringify(Array.from(r.bytes)));
  }
}
