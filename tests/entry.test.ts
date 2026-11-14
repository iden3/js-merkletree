import { describe, expect, it } from 'vitest';
import { DATA_LEN, DATA_LEN_BYTES, ELEM_BYTES_LEN } from '../src/constants';
import { newDataFromBytes } from '../src/lib/entry';

describe('newDataFromBytes', () => {
  it('splits the bytes into DATA_LEN elements of ELEM_BYTES_LEN bytes', () => {
    const bytes = new Uint8Array(DATA_LEN_BYTES).map((_, i) => i % 251);

    const data = newDataFromBytes(bytes);

    expect(data.value).toHaveLength(DATA_LEN);
    data.value.forEach((elem, i) => {
      expect(elem.value).toEqual(bytes.slice(i * ELEM_BYTES_LEN, (i + 1) * ELEM_BYTES_LEN));
    });
    expect(data.bytes()).toEqual(bytes);
  });

  it('throws if the bytes do not have DATA_LEN_BYTES length', () => {
    expect(() => newDataFromBytes(new Uint8Array(DATA_LEN_BYTES - 1))).toThrow();
  });
});
