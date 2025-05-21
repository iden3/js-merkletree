import { ElemBytes } from './elemBytes';
import { DATA_LEN, DATA_LEN_BYTES, ELEM_BYTES_LEN } from '../../constants';
import { bytesEqual } from '../utils';
import { Bytes } from '../../types';

export class Data {
  private _value: Array<ElemBytes>;

  constructor() {
    this._value = new Array<ElemBytes>(DATA_LEN);
  }

  get value(): Array<ElemBytes> {
    return this._value;
  }

  set value(_v: ElemBytes[]) {
    if (_v.length !== DATA_LEN) {
      throw `expected bytes length to be ${DATA_LEN}, got ${_v.length}`;
    }
    this._value = _v;
  }

  bytes(): Bytes {
    const b = new Uint8Array(DATA_LEN * ELEM_BYTES_LEN);

    for (let idx = 0; idx < DATA_LEN; idx += 1) {
      this._value[idx].value.forEach((v, _idx) => {
        b[idx * ELEM_BYTES_LEN + _idx] = v;
      });
    }
    return b;
  }

  equal(d2: Data): boolean {
    return (
      bytesEqual(this._value[0].value, d2.value[0].value) &&
      bytesEqual(this._value[1].value, d2.value[1].value) &&
      bytesEqual(this._value[2].value, d2.value[2].value) &&
      bytesEqual(this._value[3].value, d2.value[3].value)
    );
  }
}

export const newDataFromBytes = (bytes: Bytes): Data => {
  if (bytes.length !== DATA_LEN_BYTES) {
    throw `expected bytes length to be ${DATA_LEN_BYTES}, got ${bytes.length}`;
  }
  const d = new Data();
  const arr = new Array<ElemBytes>(DATA_LEN_BYTES);

  for (let i = 0; i < DATA_LEN; i += 1) {
    const tmp = new ElemBytes();
    tmp.value = bytes.slice(i * ELEM_BYTES_LEN, (i + 1) * DATA_LEN_BYTES);
    arr[i] = tmp;
  }

  d.value = arr;
  return d;
};
