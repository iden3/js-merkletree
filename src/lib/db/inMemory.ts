// in Memory Database implementation

import { Bytes, Node } from '../../types';
import { Storage } from '../../types/storage';
import { Hash } from '../hash/hash';

import { ZERO_HASH } from '../../constants';
import { clone } from 'ramda';

export class inMemmoryDB implements Storage {
  prefix: Bytes;
  #kvMap: {
    [k in string]: Node;
  };
  #currentRoot: Hash;

  constructor(_prefix: Bytes) {
    this.prefix = _prefix;
    this.#kvMap = {};
    this.#currentRoot = ZERO_HASH;
  }

  async get(k: Bytes): Promise<Node | undefined> {
    const kBytes = new Uint8Array([...this.prefix, ...k]);
    const val = this.#kvMap[kBytes.toString()] ? this.#kvMap[kBytes.toString()] : undefined;
    return val;
  }

  async put(k: Bytes, n: Node): Promise<void> {
    const kBytes = new Uint8Array([...this.prefix, ...k]);
    this.#kvMap[kBytes.toString()] = n;
  }

  getRoot(): Hash {
    return clone(this.#currentRoot);
  }

  setRoot(r: Hash): void {
    this.#currentRoot = clone(r);
  }
}
