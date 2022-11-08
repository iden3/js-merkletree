import { Siblings } from '../../types/merkletree';
import { ZERO_HASH } from '../../constants';

export const circomSiblingsFromSiblings = (siblings: Siblings, levels: number) => {
  for (let i = siblings.length; i < levels + 1; i += 1) {
    siblings.push(ZERO_HASH);
  }
  return siblings;
};
