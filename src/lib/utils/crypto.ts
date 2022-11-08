import { BigInteger } from 'big-integer';
import { FIELD_SIZE } from '../../constants/field';

export const checkBigIntInField = (bigNum: BigInteger) => {
  return bigNum.compare(FIELD_SIZE) === -1;
};
