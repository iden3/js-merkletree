import { ElemBytes } from '../entry/elemBytes';
import { Entry } from '../../types/entry';
import { checkBigIntInField } from './crypto';
import { Bytes } from '../../types';
import { Data } from '../entry/data';
import { DATA_LEN, DATA_LEN_BYTES, ELEM_BYTES_LEN } from '../../constants';

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
