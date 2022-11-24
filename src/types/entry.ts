import { Data } from '../lib/entry/data';
import { Hash } from '../lib/hash/hash';

export interface Entry {
  data: Data;
  hIndex(): Promise<Hash>;
  hValue(): Promise<Hash>;
}
