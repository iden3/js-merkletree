import { ITreeStorage } from '../../types/storage';
import { Hash, ZERO_HASH, circomSiblingsFromSiblings, HashAlgorithm } from '../hash/hash';

import { Node } from '../../types';
import { NODE_TYPE_EMPTY, NODE_TYPE_LEAF, NODE_TYPE_MIDDLE } from '../../constants';
import { NodeEmpty, NodeLeaf, NodeMiddle } from '../node/node';
import { bytesEqual, getPath } from '../utils';
import { NodeAux, Siblings } from '../../types/merkletree';
import { checkBigIntInField } from '../utils/crypto';
import { CircomProcessorProof, CircomVerifierProof } from './circom';
import {
  ErrEntryIndexAlreadyExists,
  ErrInvalidNodeFound,
  ErrKeyNotFound,
  ErrNotFound,
  ErrNotWritable,
  ErrReachedMaxLevel
} from '../errors';
import { Proof } from './proof';
import { Entry, checkEntryInField } from '../entry';

export class Merkletree {
  private _db: ITreeStorage;
  private _root!: Hash;
  private _writable: boolean;
  private _maxLevel: number;
  private _algo: HashAlgorithm;

  constructor(_db: ITreeStorage, _writable: boolean, _maxLevels: number) {
    this._db = _db;
    this._writable = _writable;
    this._maxLevel = _maxLevels;
    this._algo = _db.getHashAlgorithm();
  }

  async root(): Promise<Hash> {
    if (!this._root) {
      this._root = await this._db.getRoot();
    }
    return this._root;
  }

  get maxLevels(): number {
    return this._maxLevel;
  }

  async add(k: bigint, v: bigint): Promise<void> {
    if (!this._writable) {
      throw ErrNotWritable;
    }

    this._root = await this.root();
    const kHash = Hash.fromBigInt(k);
    const vHash = Hash.fromBigInt(v);

    const newNodeLeaf = new NodeLeaf(kHash, vHash, this._algo);
    const path = getPath(this.maxLevels, kHash.value);

    const newRootKey = await this.addLeaf(newNodeLeaf, this._root, 0, path);
    this._root = newRootKey;
    await this._db.setRoot(this._root);
  }

  async updateNode(n: Node): Promise<Hash> {
    if (!this._writable) {
      throw ErrNotWritable;
    }

    if (n.type === NODE_TYPE_EMPTY) {
      return await n.getKey();
    }

    const k = await n.getKey();

    await this._db.put(k.value, n);
    return k;
  }

  async addNode(n: Node): Promise<Hash> {
    if (!this._writable) {
      throw ErrNotWritable;
    }
    if (n.type === NODE_TYPE_EMPTY) {
      return await n.getKey();
    }

    const k = await n.getKey();
    // if (typeof this.#db.get(k.value) !== 'undefined') {
    //   throw ErrNodeKeyAlreadyExists;
    // }

    await this._db.put(k.value, n);
    return k;
  }

  async addEntry(e: Entry): Promise<void> {
    if (!this._writable) {
      throw ErrNotWritable;
    }

    if (!checkEntryInField(e)) {
      throw 'elements not inside the finite field over r';
    }
    this._root = await this._db.getRoot();
    const hIndex = await e.hIndex();
    const hValue = await e.hValue();

    const newNodeLeaf = new NodeLeaf(hIndex, hValue, this._algo);
    const path = getPath(this.maxLevels, hIndex.value);

    const newRootKey = await this.addLeaf(newNodeLeaf, this._root, 0, path);
    this._root = newRootKey;
    await this._db.setRoot(this._root);
  }

  async pushLeaf(
    newLeaf: Node,
    oldLeaf: Node,
    lvl: number,
    pathNewLeaf: Array<boolean>,
    pathOldLeaf: Array<boolean>
  ): Promise<Hash> {
    if (lvl > this._maxLevel - 2) {
      throw new Error(ErrReachedMaxLevel);
    }

    let newNodeMiddle: NodeMiddle;

    if (pathNewLeaf[lvl] === pathOldLeaf[lvl]) {
      const nextKey = await this.pushLeaf(newLeaf, oldLeaf, lvl + 1, pathNewLeaf, pathOldLeaf);
      if (pathNewLeaf[lvl]) {
        newNodeMiddle = new NodeMiddle(new Hash(), nextKey, this._algo);
      } else {
        newNodeMiddle = new NodeMiddle(nextKey, new Hash(), this._algo);
      }

      return await this.addNode(newNodeMiddle);
    }

    const oldLeafKey = await oldLeaf.getKey();
    const newLeafKey = await newLeaf.getKey();

    if (pathNewLeaf[lvl]) {
      newNodeMiddle = new NodeMiddle(oldLeafKey, newLeafKey, this._algo);
    } else {
      newNodeMiddle = new NodeMiddle(newLeafKey, oldLeafKey, this._algo);
    }

    await this.addNode(newLeaf);
    return await this.addNode(newNodeMiddle);
  }

  async addLeaf(newLeaf: NodeLeaf, key: Hash, lvl: number, path: Array<boolean>): Promise<Hash> {
    if (lvl > this._maxLevel - 1) {
      throw new Error(ErrReachedMaxLevel);
    }

    const n = await this.getNode(key);
    if (typeof n === 'undefined') {
      throw ErrNotFound;
    }

    switch (n.type) {
      case NODE_TYPE_EMPTY:
        return this.addNode(newLeaf);
      case NODE_TYPE_LEAF: {
        const nKey = (n as NodeLeaf).entry[0];
        const newLeafKey = newLeaf.entry[0];

        if (bytesEqual(nKey.value, newLeafKey.value)) {
          throw ErrEntryIndexAlreadyExists;
        }

        const pathOldLeaf = getPath(this.maxLevels, nKey.value);
        return this.pushLeaf(newLeaf, n, lvl, path, pathOldLeaf);
      }
      case NODE_TYPE_MIDDLE: {
        n as NodeMiddle;
        let newNodeMiddle: NodeMiddle;

        if (path[lvl]) {
          const nextKey = await this.addLeaf(newLeaf, (n as NodeMiddle).childR, lvl + 1, path);
          newNodeMiddle = new NodeMiddle((n as NodeMiddle).childL, nextKey, this._algo);
        } else {
          const nextKey = await this.addLeaf(newLeaf, (n as NodeMiddle).childL, lvl + 1, path);
          newNodeMiddle = new NodeMiddle(nextKey, (n as NodeMiddle).childR, this._algo);
        }

        return this.addNode(newNodeMiddle);
      }
      default: {
        throw ErrInvalidNodeFound;
      }
    }
  }

  async get(k: bigint): Promise<{ key: bigint; value: bigint; siblings: Siblings }> {
    const kHash = Hash.fromBigInt(k);
    const path = getPath(this.maxLevels, kHash.value);

    let nextKey = await this.root();
    const siblings: Siblings = [];

    for (let i = 0; i < this.maxLevels; i++) {
      const n = await this.getNode(nextKey);
      if (typeof n === 'undefined') {
        throw ErrKeyNotFound;
      }

      switch (n.type) {
        case NODE_TYPE_EMPTY:
          return {
            key: BigInt('0'),
            value: BigInt('0'),
            siblings
          };
        case NODE_TYPE_LEAF:
          // if (bytesEqual(kHash.value, (n as NodeLeaf).entry[0].value)) {
          //   return {
          //     key: (n as NodeLeaf).entry[0].BigInt(),
          //     value: (n as NodeLeaf).entry[1].BigInt(),
          //     siblings,
          //   };
          // }
          return {
            key: (n as NodeLeaf).entry[0].bigInt(),
            value: (n as NodeLeaf).entry[1].bigInt(),
            siblings
          };
        case NODE_TYPE_MIDDLE:
          if (path[i]) {
            nextKey = (n as NodeMiddle).childR;
            siblings.push((n as NodeMiddle).childL);
          } else {
            nextKey = (n as NodeMiddle).childL;
            siblings.push((n as NodeMiddle).childR);
          }
          break;
        default:
          throw ErrInvalidNodeFound;
      }
    }

    throw new Error(ErrReachedMaxLevel);
  }

  async update(k: bigint, v: bigint): Promise<CircomProcessorProof> {
    if (!this._writable) {
      throw ErrNotWritable;
    }

    if (!checkBigIntInField(k)) {
      throw 'key not inside the finite field';
    }
    if (!checkBigIntInField(v)) {
      throw 'key not inside the finite field';
    }

    const kHash = Hash.fromBigInt(k);
    const vHash = Hash.fromBigInt(v);

    const path = getPath(this.maxLevels, kHash.value);

    const cp = new CircomProcessorProof();

    cp.fnc = 1;
    cp.oldRoot = await this.root();
    cp.oldKey = kHash;
    cp.newKey = kHash;
    cp.newValue = vHash;

    let nextKey = await this.root();
    const siblings: Siblings = [];

    for (let i = 0; i < this.maxLevels; i += 1) {
      const n = await this.getNode(nextKey);
      if (typeof n === 'undefined') {
        throw ErrNotFound;
      }

      switch (n.type) {
        case NODE_TYPE_EMPTY:
          throw ErrKeyNotFound;
        case NODE_TYPE_LEAF:
          if (bytesEqual(kHash.value, (n as NodeLeaf).entry[0].value)) {
            cp.oldValue = (n as NodeLeaf).entry[1];
            cp.siblings = circomSiblingsFromSiblings([...siblings], this.maxLevels);
            const newNodeLeaf = new NodeLeaf(kHash, vHash, this._algo);
            await this.updateNode(newNodeLeaf);

            const newRootKey = await this.recalculatePathUntilRoot(path, newNodeLeaf, siblings);

            this._root = newRootKey;
            await this._db.setRoot(newRootKey);
            cp.newRoot = newRootKey;
            return cp;
          }
          break;
        case NODE_TYPE_MIDDLE:
          if (path[i]) {
            nextKey = (n as NodeMiddle).childR;
            siblings.push((n as NodeMiddle).childL);
          } else {
            nextKey = (n as NodeMiddle).childL;
            siblings.push((n as NodeMiddle).childR);
          }
          break;
        default:
          throw ErrInvalidNodeFound;
      }
    }

    throw ErrKeyNotFound;
  }

  async getNode(k: Hash): Promise<Node | undefined> {
    if (bytesEqual(k.value, ZERO_HASH.value)) {
      return new NodeEmpty();
    }
    return await this._db.get(k.value);
  }

  async recalculatePathUntilRoot(
    path: Array<boolean>,
    node: Node,
    siblings: Siblings
  ): Promise<Hash> {
    for (let i = siblings.length - 1; i >= 0; i -= 1) {
      const nodeKey = await node.getKey();
      if (path[i]) {
        node = new NodeMiddle(siblings[i], nodeKey, this._algo);
      } else {
        node = new NodeMiddle(nodeKey, siblings[i], this._algo);
      }
      await this.addNode(node);
    }

    const nodeKey = await node.getKey();
    return nodeKey;
  }

  // Delete removes the specified Key from the MerkleTree and updates the path
  // from the deleted key to the Root with the new values.  This method removes
  // the key from the MerkleTree, but does not remove the old nodes from the
  // key-value database; this means that if the tree is accessed by an old Root
  // where the key was not deleted yet, the key will still exist. If is desired
  // to remove the key-values from the database that are not under the current
  // Root, an option could be to dump all the leaves (using mt.DumpLeafs) and
  // import them in a new MerkleTree in a new database (using
  // mt.ImportDumpedLeafs), but this will loose all the Root history of the
  // MerkleTree
  async delete(k: bigint): Promise<void> {
    if (!this._writable) {
      throw ErrNotWritable;
    }

    const kHash = Hash.fromBigInt(k);
    const path = getPath(this.maxLevels, kHash.value);

    let nextKey = this._root;
    const siblings: Siblings = [];

    for (let i = 0; i < this._maxLevel; i += 1) {
      const n = await this.getNode(nextKey);
      if (typeof n === 'undefined') {
        throw ErrNotFound;
      }
      switch (n.type) {
        case NODE_TYPE_EMPTY:
          throw ErrKeyNotFound;
        case NODE_TYPE_LEAF:
          if (bytesEqual(kHash.bytes, (n as NodeLeaf).entry[0].value)) {
            await this.rmAndUpload(path, kHash, siblings);
            return;
          }
          throw ErrKeyNotFound;
        case NODE_TYPE_MIDDLE:
          if (path[i]) {
            nextKey = (n as NodeMiddle).childR;
            siblings.push((n as NodeMiddle).childL);
          } else {
            nextKey = (n as NodeMiddle).childL;
            siblings.push((n as NodeMiddle).childR);
          }
          break;
        default:
          throw ErrInvalidNodeFound;
      }
    }

    throw ErrKeyNotFound;
  }

  async rmAndUpload(path: Array<boolean>, kHash: Hash, siblings: Siblings): Promise<void> {
    if (siblings.length === 0) {
      this._root = ZERO_HASH;
      await this._db.setRoot(this._root);
      return;
    }

    const toUpload = siblings[siblings.length - 1];
    if (siblings.length < 2) {
      this._root = siblings[0];
      await this._db.setRoot(this._root);
    }

    const nearestSibling = await this._db.get(toUpload.bytes);
    if (nearestSibling?.type === NODE_TYPE_MIDDLE) {
      let newNode: Node;
      if (path[siblings.length - 1]) {
        newNode = new NodeMiddle(toUpload, ZERO_HASH, this._algo);
      } else {
        newNode = new NodeMiddle(ZERO_HASH, toUpload, this._algo);
      }
      await this.addNode(newNode);
      const newRootKey = await this.recalculatePathUntilRoot(
        path,
        newNode,
        siblings.slice(0, siblings.length - 1)
      );
      this._root = newRootKey;
      await this._db.setRoot(this._root);
      return;
    }

    for (let i = siblings.length - 2; i >= 0; i -= 1) {
      if (!bytesEqual(siblings[i].value, ZERO_HASH.value)) {
        let newNode: Node;
        if (path[i]) {
          newNode = new NodeMiddle(siblings[i], toUpload, this._algo);
        } else {
          newNode = new NodeMiddle(toUpload, siblings[i], this._algo);
        }
        await this.addNode(newNode);

        const newRootKey = await this.recalculatePathUntilRoot(path, newNode, siblings.slice(0, i));

        this._root = newRootKey;
        await this._db.setRoot(this._root);
        break;
      }

      if (i === 0) {
        this._root = toUpload;
        await this._db.setRoot(this._root);
        break;
      }
    }
  }

  async recWalk(key: Hash, f: (n: Node) => Promise<void>): Promise<void> {
    const n = await this.getNode(key);
    if (typeof n === 'undefined') {
      throw ErrNotFound;
    }

    switch (n.type) {
      case NODE_TYPE_EMPTY:
        await f(n);
        break;
      case NODE_TYPE_LEAF:
        await f(n);
        break;
      case NODE_TYPE_MIDDLE:
        await f(n);
        await this.recWalk((n as NodeMiddle).childL, f);
        await this.recWalk((n as NodeMiddle).childR, f);
        break;
      default:
        throw ErrInvalidNodeFound;
    }
  }

  async walk(rootKey: Hash, f: (n: Node) => Promise<void>): Promise<void> {
    if (bytesEqual(rootKey.value, ZERO_HASH.value)) {
      rootKey = await this.root();
    }
    await this.recWalk(rootKey, f);
  }

  async generateCircomVerifierProof(k: bigint, rootKey: Hash): Promise<CircomVerifierProof> {
    const cp = await this.generateSCVerifierProof(k, rootKey);
    cp.siblings = circomSiblingsFromSiblings(cp.siblings, this.maxLevels);
    return cp;
  }

  async generateSCVerifierProof(k: bigint, rootKey: Hash): Promise<CircomVerifierProof> {
    if (bytesEqual(rootKey.value, ZERO_HASH.value)) {
      rootKey = await this.root();
    }

    const { proof, value } = await this.generateProof(k, rootKey);
    const cp = new CircomVerifierProof();
    cp.root = rootKey;
    cp.siblings = proof.allSiblings();
    if (typeof proof.nodeAux !== 'undefined') {
      cp.oldKey = proof.nodeAux.key;
      cp.oldValue = proof.nodeAux.value;
    } else {
      cp.oldKey = ZERO_HASH;
      cp.oldValue = ZERO_HASH;
    }
    cp.key = Hash.fromBigInt(k);
    cp.value = Hash.fromBigInt(value);

    if (proof.existence) {
      cp.fnc = 0;
    } else {
      cp.fnc = 1;
    }

    return cp;
  }

  async generateProof(k: bigint, rootKey?: Hash): Promise<{ proof: Proof; value: bigint }> {
    let siblingKey: Hash;

    const kHash = Hash.fromBigInt(k);
    const path = getPath(this.maxLevels, kHash.value);
    if (!rootKey) {
      rootKey = await this.root();
    }
    let nextKey = rootKey;

    let depth = 0;
    let existence = false;
    const siblings: Siblings = [];
    let nodeAux: NodeAux | undefined;

    for (depth = 0; depth < this.maxLevels; depth += 1) {
      const n = await this.getNode(nextKey);
      if (typeof n === 'undefined') {
        throw ErrNotFound;
      }
      switch (n.type) {
        case NODE_TYPE_EMPTY:
          return {
            proof: new Proof({
              existence,
              nodeAux,
              siblings
            }),
            value: BigInt('0')
          };
        case NODE_TYPE_LEAF:
          if (bytesEqual(kHash.value, (n as NodeLeaf).entry[0].value)) {
            existence = true;

            return {
              proof: new Proof({
                existence,
                nodeAux,
                siblings
              }),
              value: (n as NodeLeaf).entry[1].bigInt()
            };
          }
          nodeAux = {
            key: (n as NodeLeaf).entry[0],
            value: (n as NodeLeaf).entry[1]
          };
          return {
            proof: new Proof({
              existence,
              nodeAux,
              siblings
            }),
            value: (n as NodeLeaf).entry[1].bigInt()
          };
        case NODE_TYPE_MIDDLE:
          if (path[depth]) {
            nextKey = (n as NodeMiddle).childR;
            siblingKey = (n as NodeMiddle).childL;
          } else {
            nextKey = (n as NodeMiddle).childL;
            siblingKey = (n as NodeMiddle).childR;
          }
          break;
        default:
          throw ErrInvalidNodeFound;
      }
      siblings.push(siblingKey);
    }
    throw ErrKeyNotFound;
  }

  async addAndGetCircomProof(k: bigint, v: bigint): Promise<CircomProcessorProof> {
    const cp = new CircomProcessorProof();
    cp.fnc = 2;
    cp.oldRoot = await this.root();
    let key = BigInt('0');
    let value = BigInt('0');
    let siblings: Siblings = [];
    try {
      const res = await this.get(k);
      key = res.key;
      value = res.value;
      siblings = res.siblings;
    } catch (err) {
      if (err !== ErrKeyNotFound) {
        throw err;
      }
    }

    if (typeof key === 'undefined' || typeof value === 'undefined') {
      throw 'key/value undefined';
    }

    cp.oldKey = Hash.fromBigInt(key);
    cp.oldValue = Hash.fromBigInt(value);

    if (bytesEqual(cp.oldKey.value, ZERO_HASH.value)) {
      cp.isOld0 = true;
    }

    cp.siblings = circomSiblingsFromSiblings(siblings, this.maxLevels);
    await this.add(k, v);

    cp.newKey = Hash.fromBigInt(k);
    cp.newValue = Hash.fromBigInt(v);
    cp.newRoot = await this.root();

    return cp;
  }

  // NOTE: for now it only prints to console, will be updated in future
  async graphViz(rootKey: Hash): Promise<void> {
    let cnt = 0;

    await this.walk(rootKey, async (n: Node) => {
      const k = await n.getKey();
      let lr: [string, string];
      let emptyNodes: string;

      switch (n.type) {
        case NODE_TYPE_EMPTY:
          break;
        case NODE_TYPE_LEAF:
          // eslint-disable-next-line no-console
          console.log(`"${k.string()}" [style=filled]`);
          break;
        case NODE_TYPE_MIDDLE:
          lr = [(n as NodeMiddle).childL.string(), (n as NodeMiddle).childR.string()];
          emptyNodes = '';

          lr.forEach((s, i) => {
            if (s === '0') {
              lr[i] = `empty${cnt}`;
              emptyNodes += `"${lr[i]}" [style=dashed,label=0];\n`;
              cnt += 1;
            }
          });
          // eslint-disable-next-line no-console
          console.log(`"${k.string()}" -> {"${lr[1]}"}`);
          // eslint-disable-next-line no-console
          console.log(emptyNodes);
          break;
        default:
          break;
      }
    });

    // eslint-disable-next-line no-console
    console.log(`}\n`);
  }

  async printGraphViz(rootKey: Hash): Promise<void> {
    if (bytesEqual(rootKey.value, ZERO_HASH.value)) {
      rootKey = await this.root();
    }
    // eslint-disable-next-line no-console
    console.log(
      `--------\nGraphViz of the MerkleTree with RootKey ${rootKey.bigInt().toString(10)}\n`
    );
    await this.graphViz(ZERO_HASH);
    // eslint-disable-next-line no-console
    console.log(
      `End of GraphViz of the MerkleTree with RootKey ${rootKey.bigInt().toString(10)}\n--------\n`
    );
  }
}
