import { Data } from '../entry/data';
import { Hash, ZERO_HASH, hashElems } from '../hash/hash';
import { checkBigIntInField } from '../utils';

import { ElemBytes } from './elemBytes';

export class Entry {
  #data: Data;
  #hIndex: Hash;
  #hValue: Hash;

  constructor(_data?: Data) {
    this.#data = _data ? _data : new Data();
    this.#hIndex = ZERO_HASH;
    this.#hValue = ZERO_HASH;
  }

  get data(): Data {
    return this.#data;
  }

  get index(): Array<ElemBytes> {
    return this.#data.value.slice(0, 4);
  }

  get value(): Array<ElemBytes> {
    return this.#data.value.slice(4, 8);
  }

  async hIndex(): Promise<Hash> {
    if (this.#hIndex === ZERO_HASH) {
      return hashElems(elemBytesToBigInts(this.index));
    }
    return this.#hIndex;
  }

  async hValue(): Promise<Hash> {
    if (this.#hValue === ZERO_HASH) {
      return hashElems(elemBytesToBigInts(this.value));
    }
    return this.#hValue;
  }

  hiHv(): Promise<{ hi: Hash; hv: Hash }> {
    return (async () => {
      const hi = await this.hIndex();
      const hv = await this.hValue();
      return { hi, hv };
    })();
  }

  bytes(): Array<ElemBytes> {
    return this.#data.value;
  }

  equal(e2: Entry): boolean {
    return this.#data.equal(e2.data);
  }

  clone(): Entry {
    return new Entry(this.#data);
  }
}

export const elemBytesToBigInts = (es: Array<ElemBytes>): Array<bigint> => {
  const bigInts = es.map((e) => {
    return e.bigInt();
  });

  return bigInts;
};

export const checkEntryInField = (e: Entry): boolean => {
  const bigInts = elemBytesToBigInts(e.data.value);
  let flag = true;

  bigInts.forEach((b) => {
    if (!checkBigIntInField(b)) {
      flag = false;
    }
  });

  return flag;
};
