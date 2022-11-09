import { FIELD_SIZE } from '../../constants/field';

export const checkBigIntInField = (bigNum: bigint) => {
  return bigNum < FIELD_SIZE;
};
