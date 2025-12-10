import { Bytes, Node, NodeType } from '../../types';
import { Hash, ZERO_HASH, hashElems, HashAlgorithm } from '../hash/hash';

import {
  EMPTY_NODE_STRING,
  EMPTY_NODE_VALUE,
  NODE_TYPE_EMPTY,
  NODE_TYPE_LEAF,
  NODE_TYPE_MIDDLE
} from '../../constants';
import { leafKey, nodeValue } from '../utils/node';

export class NodeLeaf implements Node {
  type: NodeType;
  entry: [Hash, Hash];
  // cache used to avoid recalculating key
  private _key: Hash;
  private _algo: HashAlgorithm = HashAlgorithm.Poseidon;

  constructor(k: Hash, v: Hash, algo: HashAlgorithm) {
    this.type = NODE_TYPE_LEAF;
    this.entry = [k, v];
    this._key = ZERO_HASH;
    this._algo = algo;
  }

  async getKey(): Promise<Hash> {
    if (this._key === ZERO_HASH) {
      return await leafKey(this.entry[0], this.entry[1], this._algo);
    }
    return this._key;
  }

  get value(): Bytes {
    return nodeValue(this.type, this.entry[0], this.entry[1]);
  }

  get string(): string {
    return `Leaf I:${this.entry[0]} D:${this.entry[1]}`;
  }
}

export class NodeMiddle implements Node {
  type: NodeType;
  childL: Hash;
  childR: Hash;
  private _key: Hash;
  private _algo: HashAlgorithm;

  constructor(cL: Hash, cR: Hash, algo: HashAlgorithm) {
    this.type = NODE_TYPE_MIDDLE;
    this.childL = cL;
    this.childR = cR;
    this._key = ZERO_HASH;
    this._algo = algo;
  }

  async getKey(): Promise<Hash> {
    if (this._key === ZERO_HASH) {
      return hashElems([this.childL.bigInt(), this.childR.bigInt()], this._algo);
    }
    return this._key;
  }

  get value(): Bytes {
    return nodeValue(this.type, this.childL, this.childR);
  }

  get string(): string {
    return `Middle L:${this.childL} R:${this.childR}`;
  }
}

export class NodeEmpty implements Node {
  type: NodeType;
  private _key: Hash;

  constructor() {
    this.type = NODE_TYPE_EMPTY;
    this._key = ZERO_HASH;
  }

  async getKey(): Promise<Hash> {
    return ZERO_HASH;
  }

  get value(): Bytes {
    return EMPTY_NODE_VALUE;
  }

  get string(): string {
    return EMPTY_NODE_STRING;
  }
}
