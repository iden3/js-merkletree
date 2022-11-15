import { FIELD_SIZE } from '../../constants/field';

export const checkBigIntInField = (bigNum: bigint): boolean => {
  return bigNum < FIELD_SIZE;
};
