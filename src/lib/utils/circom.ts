import { Siblings } from '../../types/merkletree';
import { ZERO_HASH } from '../hash/hash';

export const circomSiblingsFromSiblings = (siblings: Siblings, levels: number): Siblings => {
  for (let i = siblings.length; i < levels; i += 1) {
    siblings.push(ZERO_HASH);
  }
  return siblings;
};
