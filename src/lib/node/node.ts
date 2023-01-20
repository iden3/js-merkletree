import { Bytes, Node, NodeType } from '../../types';
import { Hash, ZERO_HASH } from '../hash/hash';

import {
  EMPTY_NODE_STRING,
  EMPTY_NODE_VALUE,
  NODE_TYPE_EMPTY,
  NODE_TYPE_LEAF,
  NODE_TYPE_MIDDLE
} from '../../constants';
import { leafKey, nodeValue } from '../utils/node';
import { hashElems } from '../utils';

export class NodeLeaf implements Node {
  type: NodeType;
  entry: [Hash, Hash];
  // cache used to avoid recalculating key
  #key: Hash;

  constructor(k: Hash, v: Hash) {
    this.type = NODE_TYPE_LEAF;
    this.entry = [k, v];
    this.#key = ZERO_HASH;
  }

  async getKey(): Promise<Hash> {
    if (this.#key === ZERO_HASH) {
      return await leafKey(this.entry[0], this.entry[1]);
    }
    return this.#key;
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
  #key: Hash;

  constructor(cL: Hash, cR: Hash) {
    this.type = NODE_TYPE_MIDDLE;
    this.childL = cL;
    this.childR = cR;
    this.#key = ZERO_HASH;
  }

  async getKey(): Promise<Hash> {
    if (this.#key === ZERO_HASH) {
      return hashElems([this.childL.bigInt(), this.childR.bigInt()]);
    }
    return this.#key;
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
  #key: Hash;

  constructor() {
    this.type = NODE_TYPE_EMPTY;
    this.#key = ZERO_HASH;
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
