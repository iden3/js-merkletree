import { ICircomProcessorProof, ICircomVerifierProof, Siblings } from '../../types/merkletree';
import { Hash, ZERO_HASH } from '../hash/hash';

export class CircomVerifierProof implements ICircomVerifierProof {
  root: Hash;
  siblings: Siblings;
  oldKey: Hash;
  oldValue: Hash;
  isOld0: boolean;
  key: Hash;
  value: Hash;
  // 0: inclusion, 1: non inclusion
  fnc: number;

  constructor(
    _root: Hash = ZERO_HASH,
    _siblings: Siblings = [],
    _oldKey: Hash = ZERO_HASH,
    _oldValue: Hash = ZERO_HASH,
    _isOld0 = false,
    _key: Hash = ZERO_HASH,
    _value: Hash = ZERO_HASH,
    _fnc = 0
  ) {
    this.root = _root;
    this.siblings = _siblings;
    this.oldKey = _oldKey;
    this.oldValue = _oldValue;
    this.isOld0 = _isOld0;
    this.key = _key;
    this.value = _value;
    this.fnc = _fnc;
  }
}

export class CircomProcessorProof implements ICircomProcessorProof {
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

  constructor(
    _oldRoot: Hash = ZERO_HASH,
    _newRoot: Hash = ZERO_HASH,
    _siblings: Siblings = [],
    _oldKey: Hash = ZERO_HASH,
    _oldValue: Hash = ZERO_HASH,
    _newKey: Hash = ZERO_HASH,
    _newValue: Hash = ZERO_HASH,
    _isOld0 = false,
    _fnc = 0
  ) {
    this.oldRoot = _oldRoot;
    this.newRoot = _newRoot;
    this.siblings = _siblings;
    this.oldKey = _oldKey;
    this.oldValue = _oldValue;
    this.newKey = _newKey;
    this.newValue = _newValue;
    this.isOld0 = _isOld0;
    this.fnc = _fnc;
  }
}
