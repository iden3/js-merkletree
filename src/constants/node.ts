// middle node.ts with children
import { NodeType } from '../types';

export const NODE_TYPE_MIDDLE: NodeType = 0;
// Leaf node.ts with a key and a value
export const NODE_TYPE_LEAF: NodeType = 1;
// empty node.ts
export const NODE_TYPE_EMPTY: NodeType = 2;

export const NODE_VALUE_BYTE_ARR_LENGTH = 65;

export const EMPTY_NODE_VALUE = new Uint8Array(NODE_VALUE_BYTE_ARR_LENGTH);

export const EMPTY_NODE_STRING = 'empty';
