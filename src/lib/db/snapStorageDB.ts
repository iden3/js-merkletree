import { Bytes, Node } from '../../types';
import { ITreeStorage } from '../../types/storage';
import { Hash, ZERO_HASH } from '../hash/hash';
import { bytes2Hex } from '../utils';
import { NODE_TYPE_EMPTY, NODE_TYPE_LEAF, NODE_TYPE_MIDDLE } from '../../constants';
import { NodeEmpty, NodeLeaf, NodeMiddle } from '../node/node';
import { snapStorage } from './snapStorage';

export class SnapStorageDB implements ITreeStorage {
  _currentRoot: Hash;

  _prefixHash: string;

  constructor(private readonly _prefix: Bytes) {
    this._currentRoot = ZERO_HASH;
    this._prefixHash = bytes2Hex(_prefix);
  }

  async get(k: Bytes): Promise<Node | undefined> {
    const kBytes = new Uint8Array([...this._prefix, ...k]);
    const key = bytes2Hex(kBytes);
    const val = await snapStorage.getItem(key);

    if (val === null) {
      return undefined;
    }

    const obj = JSON.parse(val);
    switch (obj.type) {
      case NODE_TYPE_EMPTY:
        return new NodeEmpty();
      case NODE_TYPE_MIDDLE: {
        const cL = new Hash(Uint8Array.from(obj.childL));
        const cR = new Hash(Uint8Array.from(obj.childR));

        return new NodeMiddle(cL, cR);
      }

      case NODE_TYPE_LEAF: {
        const kv = new Hash(Uint8Array.from(obj.entry[0]));
        const v = new Hash(Uint8Array.from(obj.entry[1]));

        return new NodeLeaf(kv, v);
      }
    }

    throw `error: value found for key ${bytes2Hex(kBytes)} is not of type Node`;
  }

  async put(k: Bytes, n: Node): Promise<void> {
    const kBytes = new Uint8Array([...this._prefix, ...k]);
    const key = bytes2Hex(kBytes);
    const toSerialize: Record<string, unknown> = {
      type: n.type,
    };
    if (n instanceof NodeMiddle) {
      toSerialize.childL = Array.from(n.childL.bytes);
      toSerialize.childR = Array.from(n.childR.bytes);
    } else if (n instanceof NodeLeaf) {
      toSerialize.entry = [
        Array.from(n.entry[0].bytes),
        Array.from(n.entry[1].bytes),
      ];
    }
    const val = JSON.stringify(toSerialize);
    await snapStorage.setItem(key, val);
  }

  async getRoot(): Promise<Hash> {
    if (!this._currentRoot.equals(ZERO_HASH)) {
      return this._currentRoot;
    }
    const rootStr = await snapStorage.getItem(this._prefixHash);
    const bytes: number[] = JSON.parse(rootStr);
    if (!rootStr) {
      this._currentRoot = ZERO_HASH;
    } else {
      this._currentRoot = new Hash(Uint8Array.from(bytes));
    }
    return this._currentRoot;
  }

  async setRoot(r: Hash): Promise<void> {
    this._currentRoot = r;
    await snapStorage.setItem(
      bytes2Hex(this._prefix),
      JSON.stringify(Array.from(r.bytes)),
    );
  }
}
