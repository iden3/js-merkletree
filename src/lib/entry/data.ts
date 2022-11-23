import { ElemBytes } from './elemBytes';
import { DATA_LEN, ELEM_BYTES_LEN } from '../../constants';
import { bytesEqual } from '../utils';
import { Bytes } from '../../types/index';

export class Data {
  #value: Array<ElemBytes>;

  constructor() {
    this.#value = new Array<ElemBytes>(DATA_LEN);
  }

  get value(): Array<ElemBytes> {
    return this.#value;
  }

  set value(_v: ElemBytes[]) {
    if (_v.length !== DATA_LEN) {
      throw `expected bytes length to be ${DATA_LEN}, got ${_v.length}`;
    }
    this.#value = _v;
  }

  bytes(): Bytes {
    const b = new Uint8Array(DATA_LEN * ELEM_BYTES_LEN);

    for (let idx = 0; idx < DATA_LEN; idx += 1) {
      this.#value[idx].value.forEach((v, _idx) => {
        b[idx * ELEM_BYTES_LEN + _idx] = v;
      });
    }
    return b;
  }

  equal(d2: Data): boolean {
    return (
      bytesEqual(this.#value[0].value, d2.value[0].value) &&
      bytesEqual(this.#value[1].value, d2.value[1].value) &&
      bytesEqual(this.#value[2].value, d2.value[2].value) &&
      bytesEqual(this.#value[3].value, d2.value[3].value)
    );
  }
}
