export const ErrNodeKeyAlreadyExists = 'key already exists';
// ErrKeyNotFound is used when a key is not found in the MerkleTree.
export const ErrKeyNotFound = 'Key not found in the MerkleTree';
// ErrNodeBytesBadSize is used when the data of a node has an incorrect
// size and can't be parsed.
export const ErrNodeBytesBadSize = 'node data has incorrect size in the DB';
// ErrReachedMaxLevel is used when a traversal of the MT reaches the
// maximum level.
export const ErrReachedMaxLevel = 'reached maximum level of the merkle tree';
// ErrInvalidNodeFound is used when an invalid node is found and can't
// be parsed.
export const ErrInvalidNodeFound = 'found an invalid node in the DB';
// ErrInvalidProofBytes is used when a serialized proof is invalid.
export const ErrInvalidProofBytes = 'the serialized proof is invalid';
// ErrInvalidDBValue is used when a value in the key value DB is
// invalid (for example, it doen't contain a byte header and a []byte
// body of at least len=1.
export const ErrInvalidDBValue = 'the value in the DB is invalid';
// ErrEntryIndexAlreadyExists is used when the entry index already
// exists in the tree.
export const ErrEntryIndexAlreadyExists = 'the entry index already exists in the tree';
// ErrNotWritable is used when the MerkleTree is not writable and a
// write function is called
export const ErrNotWritable = 'Merkle Tree not writable';
