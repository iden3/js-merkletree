import { Hash } from '../lib/hash/hash';

export type Path = Array<boolean>;
export type Siblings = Array<Hash>;

export type NodeAux = {
  key: Hash;
  value: Hash;
};

// CircomProcessorProof defines the ProcessorProof compatible with circom. Is
// the data of the proof between the transition from one state to another.
export interface ICircomProcessorProof {
  oldRoot: Hash;
  newRoot: Hash;
  siblings: Siblings;
  oldKey: Hash;
  oldValue: Hash;
  newKey: Hash;
  newValue: Hash;
  isOld0: boolean;
  // 0: NOP, 1: Update, 2: Insert, 3: Delete
  fnc: number;
}

// CircomVerifierProof defines the VerifierProof compatible with circom. Is the
// data of the proof that a certain leaf exists in the MerkleTree.
export type ICircomVerifierProof = {
  root: Hash;
  siblings: Siblings;
  oldKey: Hash;
  oldValue: Hash;
  isOld0: boolean;
  key: Hash;
  value: Hash;
  // 0: inclusion, 1: non inclusion
  fnc: number;
};
