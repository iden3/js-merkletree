import { Data } from '../entry/data';
import Hash from '../hash/hash';
import { ZERO_HASH } from '../../constants/index';
import { clone } from 'ramda';
import { elemBytesToBigInts, hashElems } from '../../lib/utils';

export class Entry {
  #data: Data;
  #hIndex: Hash;
  #hValue: Hash;

  constructor(_data?: Data) {
    this.#data = _data ? _data : new Data();
    this.#hIndex = ZERO_HASH;
    this.#hValue = ZERO_HASH;
  }

  get data() {
    return this.#data;
  }

  get index() {
    return this.#data.value.slice(0, 4);
  }

  get value() {
    return this.#data.value.slice(4, 8);
  }

  async hIndex() {
    if (this.#hIndex === ZERO_HASH) {
      return await hashElems(elemBytesToBigInts(this.index));
    }
    return this.#hIndex;
  }

  async hValue() {
    if (this.#hValue === ZERO_HASH) {
      return await hashElems(elemBytesToBigInts(this.value));
    }
    return this.#hValue;
  }

  hiHv() {
    return (async () => {
      const hi = await this.hIndex();
      const hv = await this.hValue();
      return { hi, hv };
    })();
  }

  bytes() {
    return this.#data.value;
  }

  equal(e2: Entry) {
    return this.#data.equal(e2.data);
  }

  clone() {
    return new Entry(clone(this.#data));
  }
}
