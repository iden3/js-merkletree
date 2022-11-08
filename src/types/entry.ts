import { ELEM_BYTES_LEN } from '../constants/index';
import { Bytes } from './index';
import { Data } from '../lib/entry/data';
import Hash from '../lib/hash/hash';

export interface Entry {
  data: Data;
  hIndex(): Promise<Hash>;
  hValue(): Promise<Hash>;
}
