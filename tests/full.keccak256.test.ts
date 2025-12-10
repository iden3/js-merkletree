import { UseStore, createStore, clear } from 'idb-keyval';
import { HASH_BYTES_LENGTH, MAX_NUM_IN_FIELD, NODE_TYPE_LEAF } from '../src/constants';
import { NodeLeaf, NodeMiddle } from '../src/lib/node/node';
import { InMemoryDB, LocalStorageDB, IndexedDBStorage } from '../src/lib/db';
import { bigIntToUINT8Array, bytes2Hex, bytesEqual, str2Bytes } from '../src/lib/utils';
import { Hash, ZERO_HASH, HashAlgorithm } from '../src/lib/hash/hash';
import { Merkletree, Proof, ProofJSON, verifyProof } from '../src/lib/merkletree';
import { ErrEntryIndexAlreadyExists, ErrKeyNotFound, ErrReachedMaxLevel } from '../src/lib/errors';
import { poseidon } from '@iden3/js-crypto';

import 'mock-local-storage';
import 'fake-indexeddb/auto';
import { Node } from '../src/types';

enum TreeStorageType {
  LocalStorageDB = 'localStorage',
  InMemoryDB = 'memoryStorage',
  IndexedDB = 'indexedDB'
}

const storages: TreeStorageType[] = [
  TreeStorageType.InMemoryDB,
  TreeStorageType.LocalStorageDB,
  TreeStorageType.IndexedDB
];

for (let index = 0; index < storages.length; index++) {
  describe(`full test of the SMT library: ${storages[index].toString()}`, () => {
    const store: UseStore = createStore(
      `${IndexedDBStorage.storageName}-db`,
      IndexedDBStorage.storageName
    );

    beforeEach(async () => {
      localStorage.clear();
      await clear(store);
    });

    const getTreeStorage = (prefix = '') => {
      if (storages[index] == TreeStorageType.LocalStorageDB) {
        return new LocalStorageDB(str2Bytes(prefix), HashAlgorithm.Keccak256);
      } else if (storages[index] == TreeStorageType.IndexedDB) {
        return new IndexedDBStorage(str2Bytes(prefix), HashAlgorithm.Keccak256);
      } else if (storages[index] == TreeStorageType.InMemoryDB) {
        return new InMemoryDB(str2Bytes(prefix), HashAlgorithm.Keccak256);
      }
      throw new Error('error: unknown storage type');
    };

    it('checks that the implementation of the db.Storage interface behaves as expected', async () => {
      const sto = getTreeStorage();

      const bytes = new Uint8Array(HASH_BYTES_LENGTH);
      bytes[0] = 1;
      const v = new Hash(bytes);

      const node = new NodeMiddle(v, v, HashAlgorithm.Keccak256);
      const k = await node.getKey();
      await sto.put(k.value, node);
      const val = await sto.get(k.value);

      expect(val).not.toBeUndefined();
      expect((val as NodeMiddle).childL.hex()).toEqual(v.hex());
      expect((val as NodeMiddle).childR.hex()).toEqual(v.hex());
    });

    it('test new merkle tree', async () => {
      const sto = getTreeStorage();
      const mt = new Merkletree(sto, true, 10);
      expect((await mt.root()).string()).toEqual('0');

      await mt.add(BigInt('1'), BigInt('2'));
      expect((await mt.root()).bigInt().toString(10)).toEqual(
        '20349940423862035287868699599764962454537984981628200184279725786303353984557'
      );

      await mt.add(BigInt('33'), BigInt('44'));
      expect((await mt.root()).bigInt().toString(10)).toEqual(
        '76534138237239231515859035502772486263463178175980489503663557460094727691106'
      );

      await mt.add(BigInt('1234'), BigInt('9876'));
      expect((await mt.root()).bigInt().toString(10)).toEqual(
        '544861533666138023304524147783425313319718916836013588107382050253858247287'
      );

      expect((await sto.getRoot()).bigInt().toString()).toEqual(
        (await mt.root()).bigInt().toString()
      );

      const { proof, value } = await mt.generateProof(BigInt('33'));
      expect(value.toString()).toEqual('44');

      expect(await verifyProof(await mt.root(), proof, BigInt('33'), BigInt('44'), HashAlgorithm.Keccak256)).toEqual(true);

      expect(await verifyProof(await mt.root(), proof, BigInt('33'), BigInt('45'), HashAlgorithm.Keccak256)).toEqual(false);
    });

    it('test tree with one node', async () => {
      const sto = getTreeStorage();
      const mt = new Merkletree(sto, true, 10);
      expect(bytesEqual((await mt.root()).value, ZERO_HASH.value)).toEqual(true);

      await mt.add(BigInt('100'), BigInt('200'));
      expect((await mt.root()).bigInt().toString(10)).toEqual(
        '76684871214838026877932731174111849409910921034598023076966884922227909952638'
      );
      const inputs = [BigInt('100'), BigInt('200'), BigInt('1')];
      expect((await mt.root()).bigInt().toString()).toEqual("76684871214838026877932731174111849409910921034598023076966884922227909952638");
    });

    it('test add and different order', async () => {
      const sto1 = getTreeStorage('tree1');
      const sto2 = getTreeStorage('tree2');
      const mt1 = new Merkletree(sto1, true, 140);
      const mt2 = new Merkletree(sto2, true, 140);

      for (let i = 0; i < 16; i += 1) {
        const k = BigInt(i);
        const v = BigInt('0');
        await mt1.add(k, v);
      }

      for (let i = 15; i >= 0; i -= 1) {
        const k = BigInt(i);
        const v = BigInt('0');
        await mt2.add(k, v);
      }

      expect((await mt1.root()).string()).toEqual((await mt2.root()).string());
      expect((await mt1.root()).hex()).toEqual(
        '71d5901d6ab3653ef7a8f24e4a16f4932752d9192a2c4bea8a1a7cadd93c11a9'
      );
    });

    it('test add repeated index', async () => {
      const sto = getTreeStorage();
      const mt = new Merkletree(sto, true, 140);

      const k = BigInt('3');
      const v = BigInt('12');
      await mt.add(k, v);

      try {
        await mt.add(k, v);
      } catch (err) {
        expect(err).toEqual(ErrEntryIndexAlreadyExists);
      }
    });

    it('test get', async () => {
      const sto = getTreeStorage();
      const mt = new Merkletree(sto, true, 140);

      for (let i = 0; i < 16; i += 1) {
        const k = BigInt(i);
        const v = BigInt(i * 2);

        await mt.add(k, v);
      }
      const { key: k1, value: v1 } = await mt.get(BigInt('10'));
      expect(k1.toString(10)).toEqual('10');
      expect(v1.toString(10)).toEqual('20');

      const { key: k2, value: v2 } = await mt.get(BigInt('15'));
      expect(k2.toString(10)).toEqual('15');
      expect(v2.toString(10)).toEqual('30');

      try {
        await mt.get(BigInt('16'));
      } catch (err) {
        expect(err).toEqual(ErrKeyNotFound);
      }
    });

    it('test update', async () => {
      const sto = getTreeStorage();
      const mt = new Merkletree(sto, true, 140);

      for (let i = 0; i < 16; i += 1) {
        const k = BigInt(i);
        const v = BigInt(i * 2);
        await mt.add(k, v);
      }

      expect((await mt.get(BigInt('10'))).value.toString(10)).toEqual('20');

      await mt.update(BigInt('10'), BigInt('1024'));
      expect((await mt.get(BigInt('10'))).value.toString(10)).toEqual('1024');

      try {
        await mt.update(BigInt('10'), BigInt('1024'));
      } catch (err) {
        expect(err).toEqual(ErrKeyNotFound);
      }

      const dbRoot = await sto.getRoot();
      expect(dbRoot.string()).toEqual((await mt.root()).string());
    });

    it('test update 2', async () => {
      const sto1 = getTreeStorage('tree1');
      const sto2 = getTreeStorage('tree2');
      const mt1 = new Merkletree(sto1, true, 140);
      const mt2 = new Merkletree(sto2, true, 140);

      await mt1.add(BigInt('1'), BigInt('2'));
      await mt1.add(BigInt('2'), BigInt('229'));
      await mt1.add(BigInt('9876'), BigInt('6789'));

      await mt2.add(BigInt('1'), BigInt('11'));
      await mt2.add(BigInt('2'), BigInt('22'));
      await mt2.add(BigInt('9876'), BigInt('10'));

      await mt1.update(BigInt('1'), BigInt('11'));
      await mt1.update(BigInt('2'), BigInt('22'));
      await mt2.update(BigInt('9876'), BigInt('6789'));

      expect((await mt1.root()).string()).toEqual((await mt2.root()).string());
    });

    it('test generate and verify proof 128', async () => {
      const sto = getTreeStorage();
      const mt = new Merkletree(sto, true, 140);

      for (let i = 0; i < 128; i += 1) {
        const k = BigInt(i);
        const v = BigInt('0');

        await mt.add(k, v);
      }

      const { proof, value } = await mt.generateProof(BigInt('42'));
      expect(value.toString()).toEqual('0');
      const verRes = await verifyProof(await mt.root(), proof, BigInt('42'), BigInt('0'), HashAlgorithm.Keccak256);
      expect(verRes).toEqual(true);
    });

    it('test tree limit', async () => {
      const sto = getTreeStorage();
      const mt = new Merkletree(sto, true, 5);

      for (let i = 0; i < 16; i += 1) {
        await mt.add(BigInt(i), BigInt(i));
      }

      try {
        await mt.add(BigInt('16'), BigInt('16'));
      } catch (err) {
        expect((err as Error).message).toEqual(ErrReachedMaxLevel);
      }
    });

    it('test siblings from proof', async () => {
      const sto = getTreeStorage();
      const mt = new Merkletree(sto, true, 140);

      for (let i = 0; i < 64; i += 1) {
        const k = BigInt(i);
        const v = BigInt('0');
        await mt.add(k, v);
      }

      const { proof } = await mt.generateProof(BigInt('4'));
      const siblings = proof.allSiblings();

      expect(siblings.length).toEqual(6);

      expect(siblings[0].hex()).toEqual(
        'b2cee61650a6275e75b6bef5d338a14ac490db97614b1392ebfd1abccbb5725a'
      );
      expect(siblings[1].hex()).toEqual(
        'c683ae7a8d9800bd5114ccc05ac673be7a20a5152c782305076166a8a27089ee'
      );
      expect(siblings[2].hex()).toEqual(
        '2e7090f730df0afda34acd203dfb44fa5c83a01480c4ab32f7af362e9fc66c2e'
      );
      expect(siblings[3].hex()).toEqual(
        '4f397ca4e191df962d78d7339cc83c8f2a5418e5801158bb576d02cca5ed893b'
      );
      expect(siblings[4].hex()).toEqual(
        'd0b7a51724a7be4781dd97fb8e901e45b2e14f2587f3b933f8830d2e318ed5dd'
      );
      expect(siblings[5].hex()).toEqual(
        '0e029c03a12eadd7c268a105fbcb837c71ea26a762a429151db46192ae68483f'
      );
    });

    it('test and verify proof cases', async () => {
      const sto = getTreeStorage();
      const mt = new Merkletree(sto, true, 140);

      for (let i = 0; i < 8; i += 1) {
        await mt.add(BigInt(i), BigInt('0'));
      }

      let { proof } = await mt.generateProof(BigInt('4'));
      expect(proof.existence).toEqual(true);
      expect(await verifyProof(await mt.root(), proof, BigInt('4'), BigInt('0'), HashAlgorithm.Keccak256)).toEqual(true);
      expect(bytes2Hex(proof.bytes())).toEqual(
        '00030000000000000000000000000000000000000000000000000000000000077baea77c663ade84f8375ee0caed270e1188c0b0715c48c4801d79ebc6a3bbbca47a068a9c0c91be00d31d79688c762a167036b67beae6ea06d6d522e752605ad9892c0d81c801830cd9216e6ff31da83fb8745b1365aa34fc600092aa4bfecb'
      );

      for (let i = 8; i < 32; i += 1) {
        const { proof } = await mt.generateProof(BigInt(i));
        expect(proof.existence).toBeDefined();
      }

      // non-existence proof, node aux
      proof = (await mt.generateProof(BigInt('12'))).proof;
      expect(proof.existence).toEqual(false);
      expect(proof.nodeAux).toBeDefined();
      expect(await verifyProof(await mt.root(), proof, BigInt('12'), BigInt('0'), HashAlgorithm.Keccak256)).toEqual(true);
      expect(bytes2Hex(proof.bytes())).toEqual(
        '03030000000000000000000000000000000000000000000000000000000000077baea77c663ade84f8375ee0caed270e1188c0b0715c48c4801d79ebc6a3bbbca47a068a9c0c91be00d31d79688c762a167036b67beae6ea06d6d522e752605ad9892c0d81c801830cd9216e6ff31da83fb8745b1365aa34fc600092aa4bfecb04000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' //nolint:lll
      );

      // non-existence proof, node aux
      proof = (await mt.generateProof(BigInt('10'))).proof;
      expect(proof.existence).toEqual(false);
      expect(proof.nodeAux).toBeDefined();
      expect(await verifyProof(await mt.root(), proof, BigInt('10'), BigInt('0'), HashAlgorithm.Keccak256)).toEqual(true);
      expect(bytes2Hex(proof.bytes())).toEqual(
        '03030000000000000000000000000000000000000000000000000000000000077baea77c663ade84f8375ee0caed270e1188c0b0715c48c4801d79ebc6a3bbbc73522996e2f99e663eb22db2b85ee06ec6eb91fef6e79fa27e04c7f64f96cae442247dfe8781b5b6cf155d9f12bc7235d8589002a7102dbd4068e60e4f9b74d702000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' //nolint:lll
      );
    });

    it('test and verify proof false', async () => {
      const sto = getTreeStorage();
      const mt = new Merkletree(sto, true, 140);

      for (let i = 0; i < 8; i += 1) {
        await mt.add(BigInt(i), BigInt('0'));
      }
      // Invalid existence proof (node used for verification doesn't
      // correspond to node in the proof)
      let { proof } = await mt.generateProof(BigInt('4'));
      expect(proof.existence).toEqual(true);
      expect(await verifyProof(await mt.root(), proof, BigInt('5'), BigInt('5'), HashAlgorithm.Keccak256)).toEqual(false);

      // Invalid non-existence proof (Non-existence proof, diff. node aux)
      proof = (await mt.generateProof(BigInt('4'))).proof;
      expect(proof.existence).toEqual(true);
      proof.existence = false;
      proof.nodeAux = {
        key: Hash.fromBigInt(BigInt('4')),
        value: Hash.fromBigInt(BigInt('4'))
      };

      expect(await verifyProof(await mt.root(), proof, BigInt('4'), BigInt('0'), HashAlgorithm.Keccak256)).toEqual(false);
    });

    it('test delete', async () => {
      const sto = getTreeStorage();
      const mt = new Merkletree(sto, true, 10);

      await mt.add(BigInt('1'), BigInt('2'));
      expect((await mt.root()).string()).toEqual(
        '20349940423862035287868699599764962454537984981628200184279725786303353984557'
      );

      await mt.add(BigInt('33'), BigInt('44'));
      expect((await mt.root()).string()).toEqual(
        '76534138237239231515859035502772486263463178175980489503663557460094727691106'
      );

      await mt.add(BigInt('1234'), BigInt('9876'));
      expect((await mt.root()).string()).toEqual(
        '544861533666138023304524147783425313319718916836013588107382050253858247287'
      );

      await mt.delete(BigInt('33'));
      expect((await mt.root()).string()).toEqual(
        '59172665240949163570629625279231866406762637838923705579001199098945372573940'
      );

      await mt.delete(BigInt('1234'));
      await mt.delete(BigInt('1'));

      expect((await mt.root()).string()).toEqual('0');
      expect((await mt.root()).string()).toEqual((await sto.getRoot()).string());
    });

    it('test delete 2', async () => {
      const sto1 = getTreeStorage('tree1');
      const sto2 = getTreeStorage('tree2');
      const mt1 = new Merkletree(sto1, true, 140);
      const mt2 = new Merkletree(sto2, true, 140);

      for (let i = 0; i < 8; i += 1) {
        const k = BigInt(i);
        const v = BigInt('0');
        await mt1.add(k, v);
      }

      const expectedRootStr = (await mt1.root()).string();

      const k = BigInt('8');
      const v = BigInt('0');

      await mt1.add(k, v);
      await mt1.delete(k);

      expect(expectedRootStr).toEqual((await mt1.root()).string());

      for (let i = 0; i < 8; i += 1) {
        const k = BigInt(i);
        const v = BigInt('0');
        await mt2.add(k, v);
      }

      expect((await mt1.root()).string()).toEqual((await mt2.root()).string());
    });

    it('test delete 3', async () => {
      const sto1 = getTreeStorage('tree1');
      const sto2 = getTreeStorage('tree2');
      const mt1 = new Merkletree(sto1, true, 140);
      const mt2 = new Merkletree(sto2, true, 140);

      await mt1.add(BigInt('1'), BigInt('1'));
      await mt1.add(BigInt('2'), BigInt('2'));

      expect((await mt1.root()).string()).toEqual(
        '108872779231739741211466661630182120869964350174968231253312446506137900102765'
      );

      await mt1.delete(BigInt('1'));

      expect((await mt1.root()).string()).toEqual(
        '204679323412988774155807184358931572859960307382228217179160870267303983297'
      );

      await mt2.add(BigInt('2'), BigInt('2'));
      expect((await mt1.root()).string()).toEqual((await mt2.root()).string());
    });

    it('test delete 4', async () => {
      const sto1 = getTreeStorage('tree1');
      const sto2 = getTreeStorage('tree2');
      const mt1 = new Merkletree(sto1, true, 140);
      const mt2 = new Merkletree(sto2, true, 140);

      await mt1.add(BigInt('1'), BigInt('1'));
      await mt1.add(BigInt('2'), BigInt('2'));
      await mt1.add(BigInt('3'), BigInt('3'));

      expect((await mt1.root()).string()).toEqual(
        '112589100365384563636828753186771502102479135063472969221605103709843483709964'
      );

      await mt1.delete(BigInt('1'));

      expect((await mt1.root()).string()).toEqual(
        '14186295076042981090325393415823129915089483719993442784504350225538352965231'
      );

      await mt2.add(BigInt('2'), BigInt('2'));
      await mt2.add(BigInt('3'), BigInt('3'));
      expect((await mt1.root()).string()).toEqual((await mt2.root()).string());
    });

    it('test delete 5', async () => {
      const sto1 = getTreeStorage('tree1');
      const sto2 = getTreeStorage('tree2');
      const mt1 = new Merkletree(sto1, true, 140);
      const mt2 = new Merkletree(sto2, true, 140);

      await mt1.add(BigInt('1'), BigInt('2'));
      await mt1.add(BigInt('33'), BigInt('44'));

      expect((await mt1.root()).string()).toEqual(
        '76534138237239231515859035502772486263463178175980489503663557460094727691106'
      );

      await mt1.delete(BigInt('1'));

      expect((await mt1.root()).string()).toEqual(
        '10955310555638083816119775899206389561202556659568675876759181443512300421331'
      );

      await mt2.add(BigInt('33'), BigInt('44'));
      expect((await mt1.root()).string()).toEqual((await mt2.root()).string());
    });

    it('test delete not existing keys', async () => {
      const sto = getTreeStorage();
      const mt = new Merkletree(sto, true, 10);

      await mt.add(BigInt('1'), BigInt('2'));
      await mt.add(BigInt('33'), BigInt('44'));

      await mt.delete(BigInt('33'));

      try {
        await mt.delete(BigInt('33'));
      } catch (err) {
        expect(err).toEqual(ErrKeyNotFound);
      }

      await mt.delete(BigInt('1'));
      expect((await mt.root()).string()).toEqual('0');

      try {
        await mt.delete(BigInt('33'));
      } catch (err) {
        expect(err).toEqual(ErrKeyNotFound);
      }
    });

    it('test delete leaf near middle node. Right branch', async () => {
      const sto = getTreeStorage();
      const mt = new Merkletree(sto, true, 10);

      const keys = [7n, 1n, 5n];

      const expectedSiblings: { [id: string]: bigint[] } = {
        '7': [],
        '1': [0n, 58778245672362516760657188918491108074068739632281986516447865413987646804066n],
        '5': [
          0n,
          58778245672362516760657188918491108074068739632281986516447865413987646804066n,
          37245951031790617425846662166414203447230852981947190519491676860679629218468n
        ]
      };

      for (const k of keys) {
        await mt.add(k, k);
        const existProof = await mt.generateProof(k, await mt.root());
        expect(existProof.proof.existence).toEqual(true);
        compareSiblings(expectedSiblings[k.toString()], existProof.proof);
      }

      const expectedSiblingsNonExist: { [id: string]: bigint[] } = {
        '7': [0n, 90793012380542163121115292742720211788796606421058579751728012408711775415639n],
        '1': [],
        '5': []
      };

      for (const k of keys) {
        await mt.delete(k);
        const existProof = await mt.generateProof(k, await mt.root());
        expect(existProof.proof.existence).toEqual(false);
        compareSiblings(expectedSiblingsNonExist[k.toString()], existProof.proof);
      }
    });

    it('test delete leaf near middle node. Right branch deep', async () => {
      const sto = getTreeStorage();
      const mt = new Merkletree(sto, true, 10);

      const keys = [3n, 7n, 15n];

      const expectedSiblings: { [id: string]: bigint[] } = {
        '3': [],
        '7': [
          0n,
          0n,
          45906869880764156987885874863987484108432793389080846151397980307504325728862n
        ],
        '15': [
          0n,
          0n,
          45906869880764156987885874863987484108432793389080846151397980307504325728862n,
          58778245672362516760657188918491108074068739632281986516447865413987646804066n
        ]
      };

      for (const k of keys) {
        await mt.add(k, k);
        const existProof = await mt.generateProof(k, await mt.root());
        expect(existProof.proof.existence).toEqual(true);
        compareSiblings(expectedSiblings[k.toString()], existProof.proof);
      }

      const expectedSiblingsNonExist: { [id: string]: bigint[] } = {
        '3': [
          0n,
          0n,
          66983951388551681909755987368531576513037053734179480194567340249595337759173n
        ],
        '7': [],
        '15': []
      };

      for (const k of keys) {
        await mt.delete(k);
        const existProof = await mt.generateProof(k, await mt.root());
        expect(existProof.proof.existence).toEqual(false);
        compareSiblings(expectedSiblingsNonExist[k.toString()], existProof.proof);
      }
    });

    it('test delete leaf near middle node. Left branch', async () => {
      const sto = getTreeStorage();
      const mt = new Merkletree(sto, true, 10);

      const keys = [6n, 4n, 2n];

      const expectedSiblings: { [id: string]: bigint[] } = {
        '6': [],
        '4': [0n, 47167624024095951102360683516988377651272751399124548217514357033029495756702n],
        '2': [
          0n,
          75643218886135556618007590826502336434547303617941809863348288103535263487329n,
          47167624024095951102360683516988377651272751399124548217514357033029495756702n
        ]
      };

      for (const k of keys) {
        await mt.add(k, k);
        const existProof = await mt.generateProof(k, await mt.root());
        expect(existProof.proof.existence).toEqual(true);
        compareSiblings(expectedSiblings[k.toString()], existProof.proof);
      }

      const expectedSiblingsNonExist: { [id: string]: bigint[] } = {
        '6': [0n, 75643218886135556618007590826502336434547303617941809863348288103535263487329n],
        '4': [],
        '2': []
      };

      for (const k of keys) {
        await mt.delete(k);
        const existProof = await mt.generateProof(k, await mt.root());
        expect(existProof.proof.existence).toEqual(false);
        compareSiblings(expectedSiblingsNonExist[k.toString()], existProof.proof);
      }
    });

    it('test delete leaf near middle node. Left branch deep', async () => {
      const sto = getTreeStorage();
      const mt = new Merkletree(sto, true, 10);

      const keys = [4n, 8n, 16n];

      const expectedSiblings: { [id: string]: bigint[] } = {
        '4': [],
        '8': [
          0n,
          0n,
          75643218886135556618007590826502336434547303617941809863348288103535263487329n
        ],
        '16': [
          0n,
          0n,
          75643218886135556618007590826502336434547303617941809863348288103535263487329n,
          52845948298258825660916624299504428202505418019704865991722346431233437049494n
        ]
      };

      for (const k of keys) {
        await mt.add(k, k);
        const existProof = await mt.generateProof(k, await mt.root());
        expect(existProof.proof.existence).toEqual(true);
        compareSiblings(expectedSiblings[k.toString()], existProof.proof);
      }

      const expectedSiblingsNonExist: { [id: string]: bigint[] } = {
        '4': [0n, 0n, 107404637154263281958799614031313875322282089948200739151367618334012768311826n],
        '8': [],
        '16': []
      };

      for (const k of keys) {
        await mt.delete(k);
        const existProof = await mt.generateProof(k, await mt.root());
        expect(existProof.proof.existence).toEqual(false);
        compareSiblings(expectedSiblingsNonExist[k.toString()], existProof.proof);
      }
    });

    // Checking whether the last leaf will be moved to the root position
    //
    //	   root
    //	 /     \
    //	0    MiddleNode
    //	      /   \
    //	     01   11
    //
    // Up to:
    //
    //	root(11)
    it('test up to root after delete. Right branch', async () => {
      const sto = getTreeStorage('right branch');
      const mt = new Merkletree(sto, true, 10);

      await mt.add(1n, 1n);
      await mt.add(3n, 3n);

      await mt.delete(1n);

      const leaf = await mt.getNode(await mt.root());
      expect(leaf?.type).toEqual(NODE_TYPE_LEAF);
      expect((leaf as NodeLeaf).entry[0].bigInt()).toEqual(3n);
    });

    // Checking whether the last leaf will be moved to the root position
    //
    //		   root
    //	 	 /      \
    //		MiddleNode  0
    //		 /   \
    //		100  010
    //
    // Up to:
    //
    //	root(100)
    it('test up to root after delete. Left branch', async () => {
      const sto = getTreeStorage('left branch');
      const mt = new Merkletree(sto, true, 10);

      await mt.add(2n, 2n);
      await mt.add(4n, 4n);

      await mt.delete(2n);

      const leaf = await mt.getNode(await mt.root());
      expect(leaf?.type).toEqual(NODE_TYPE_LEAF);
      expect((leaf as NodeLeaf).entry[0].bigInt()).toEqual(4n);
    });

    // Checking whether the new root will be calculated from to leafs
    //
    //	  root
    //	 /    \
    //	10  MiddleNode
    //	      /   \
    //	     01   11
    //
    // Up to:
    //
    //	 root
    //	 /  \
    //	10  11
    it('calculating of new root. Right branch', async () => {
      const sto = getTreeStorage();
      const mt = new Merkletree(sto, true, 10);

      await mt.add(1n, 1n);
      await mt.add(3n, 3n);
      await mt.add(2n, 2n);

      await mt.delete(1n);

      const root = (await mt.getNode(await mt.root())) as NodeMiddle;

      const lleaf = (await mt.getNode(root.childL)) as NodeLeaf;
      const rleaf = (await mt.getNode(root.childR)) as NodeLeaf;

      expect(lleaf.entry[0].bigInt()).toEqual(2n);
      expect(rleaf.entry[0].bigInt()).toEqual(3n);
    });

    // Checking whether the new root will be calculated from to leafs
    //
    //	         root
    //	       /     \
    //	 MiddleNode  01
    //	  /   \
    //	100   010
    //
    // Up to:
    //
    //	  root
    //	 /   \
    //	100  001
    it('calculating of new root. Left branch', async () => {
      const sto = getTreeStorage();
      const mt = new Merkletree(sto, true, 10);

      await mt.add(1n, 1n);
      await mt.add(2n, 2n);
      await mt.add(4n, 4n);

      await mt.delete(2n);

      const root = (await mt.getNode(await mt.root())) as NodeMiddle;

      const lleaf = (await mt.getNode(root.childL)) as NodeLeaf;
      const rleaf = (await mt.getNode(root.childR)) as NodeLeaf;

      expect(lleaf.entry[0].bigInt()).toEqual(4n);
      expect(rleaf.entry[0].bigInt()).toEqual(1n);
    });

    // https://github.com/iden3/go-merkletree-sql/issues/23
    it('test insert node after delete', async () => {
      const sto = getTreeStorage();
      const mt = new Merkletree(sto, true, 10);

      await mt.add(1n, 1n);
      await mt.add(5n, 5n);
      await mt.add(7n, 7n);

      const expectedSiblings = [
        0n,
        90793012380542163121115292742720211788796606421058579751728012408711775415639n
      ];

      await mt.delete(7n);
      let proof = await mt.generateProof(7n, await mt.root());
      expect(proof.proof.existence).toEqual(false);
      compareSiblings(expectedSiblings, proof.proof);

      await mt.add(7n, 7n);
      proof = await mt.generateProof(7n, await mt.root());
      expect(proof.proof.existence).toEqual(true);
      compareSiblings(expectedSiblings, proof.proof);
    });

    it('test insert deleted node then update it. Right branch', async () => {
      const sto = getTreeStorage();
      const mt = new Merkletree(sto, true, 10);

      await mt.add(1n, 1n);
      await mt.add(5n, 5n);
      await mt.add(7n, 7n);

      const expectedSiblings = [
        0n,
        90793012380542163121115292742720211788796606421058579751728012408711775415639n
      ];

      await mt.delete(7n);
      let proof = await mt.generateProof(7n, await mt.root());
      expect(proof.proof.existence).toEqual(false);
      compareSiblings(expectedSiblings, proof.proof);

      await mt.add(7n, 7n);
      proof = await mt.generateProof(7n, await mt.root());
      expect(proof.proof.existence).toEqual(true);
      compareSiblings(expectedSiblings, proof.proof);

      await mt.update(7n, 100n);
      const updatedNode = await mt.get(7n);
      expect(updatedNode.key).toEqual(7n);
      expect(updatedNode.value).toEqual(100n);
    });

    it('test insert deleted node then update it. Left branch', async () => {
      const sto = getTreeStorage();
      const mt = new Merkletree(sto, true, 10);

      await mt.add(6n, 6n);
      await mt.add(2n, 2n);
      await mt.add(4n, 4n);

      const expectedSiblings = [
        0n,
        77032867444825930314963427098772579657571055799776141430952584153445051303225n
      ];

      await mt.delete(4n);
      let proof = await mt.generateProof(4n, await mt.root());
      expect(proof.proof.existence).toEqual(false);
      compareSiblings(expectedSiblings, proof.proof);

      await mt.add(4n, 4n);
      proof = await mt.generateProof(4n, await mt.root());
      expect(proof.proof.existence).toEqual(true);
      compareSiblings(expectedSiblings, proof.proof);

      await mt.update(4n, 100n);
      const updatedNode = await mt.get(4n);
      expect(updatedNode.key).toEqual(4n);
      expect(updatedNode.value).toEqual(100n);
    });

    it('test push leaf already exists. Right branch', async () => {
      const sto = getTreeStorage();
      const mt = new Merkletree(sto, true, 10);

      await mt.add(1n, 1n);
      await mt.add(5n, 5n);
      await mt.add(7n, 7n);
      await mt.add(3n, 3n);

      const expectedSiblingsNonExist = [
        0n,
        90793012380542163121115292742720211788796606421058579751728012408711775415639n
      ];
      await mt.delete(3n);
      let proof = await mt.generateProof(3n, await mt.root());
      expect(proof.proof.existence).toEqual(false);
      compareSiblings(expectedSiblingsNonExist, proof.proof);

      const expectedSiblingsExist = [
        0n,
        90793012380542163121115292742720211788796606421058579751728012408711775415639n,
        58778245672362516760657188918491108074068739632281986516447865413987646804066n
      ];
      await mt.add(3n, 3n);
      proof = await mt.generateProof(3n, await mt.root());
      expect(proof.proof.existence).toEqual(true);
      compareSiblings(expectedSiblingsExist, proof.proof);
    });

    it('test push leaf already exists. Left branch', async () => {
      const sto = getTreeStorage();
      const mt = new Merkletree(sto, true, 10);

      await mt.add(6n, 6n);
      await mt.add(2n, 2n);
      await mt.add(4n, 4n);
      await mt.add(8n, 8n);

      const expectedSiblingsNonExist = [
        0n,
        77032867444825930314963427098772579657571055799776141430952584153445051303225n
      ];
      await mt.delete(8n);
      let proof = await mt.generateProof(8n, await mt.root());
      expect(proof.proof.existence).toEqual(false);
      compareSiblings(expectedSiblingsNonExist, proof.proof);

      const expectedSiblingsExist = [
        0n,
        77032867444825930314963427098772579657571055799776141430952584153445051303225n,
        75643218886135556618007590826502336434547303617941809863348288103535263487329n
      ];
      await mt.add(8n, 8n);
      proof = await mt.generateProof(8n, await mt.root());
      expect(proof.proof.existence).toEqual(true);
      compareSiblings(expectedSiblingsExist, proof.proof);
    });

    it('test up nodes to two levels. Right branch', async () => {
      const sto = getTreeStorage();
      const mt = new Merkletree(sto, true, 10);

      await mt.add(1n, 1n);
      await mt.add(7n, 7n);
      await mt.add(15n, 15n);
      await mt.delete(15n);

      const proof = await mt.generateProof(15n, await mt.root());
      expect(proof.proof.existence).toEqual(false);
      compareSiblings(
        [0n, 37245951031790617425846662166414203447230852981947190519491676860679629218468n],
        proof.proof
      );
    });

    it('test up nodes to two levels. Left branch', async () => {
      const sto = getTreeStorage();
      const mt = new Merkletree(sto, true, 10);

      await mt.add(2n, 2n);
      await mt.add(8n, 8n);
      await mt.add(16n, 16n);
      await mt.delete(16n);

      const proof = await mt.generateProof(16n, await mt.root());
      expect(proof.proof.existence).toEqual(false);
      compareSiblings(
        [0n, 204679323412988774155807184358931572859960307382228217179160870267303983297n],
        proof.proof
      );
    });

    it('test dump leafs and import leafs', async () => {
      const sto1 = getTreeStorage('tree1');
      const sto2 = getTreeStorage('tree2');
      const mt1 = new Merkletree(sto1, true, 140);
      const mt2 = new Merkletree(sto2, true, 140);

      for (let i = 0; i < 10; i += 1) {
        let k = MAX_NUM_IN_FIELD - BigInt(i.toString());
        const v = BigInt('0');
        await mt1.add(k, v);

        k = BigInt(i);
        await mt1.add(k, v);
      }
    });

    it('test add and get circom proof', async () => {
      const sto = getTreeStorage();
      const mt = new Merkletree(sto, true, 10);

      expect((await mt.root()).string()).toEqual('0');

      let cp = await mt.addAndGetCircomProof(BigInt('1'), BigInt('2'));

      expect(cp.oldRoot.string()).toEqual('0');
      expect(cp.newRoot.string()).toEqual(
        '20349940423862035287868699599764962454537984981628200184279725786303353984557'
      );
      expect(cp.oldKey.string()).toEqual('0');
      expect(cp.oldValue.string()).toEqual('0');
      expect(cp.newKey.string()).toEqual('1');
      expect(cp.newValue.string()).toEqual('2');
      expect(cp.isOld0).toEqual(true);
      cp.siblings.forEach((s) => {
        expect(s.string()).toEqual('0');
      });
      expect(mt.maxLevels).toEqual(cp.siblings.length);

      cp = await mt.addAndGetCircomProof(BigInt('33'), BigInt('44'));

      expect(cp.oldRoot.string()).toEqual(
        '20349940423862035287868699599764962454537984981628200184279725786303353984557'
      );
      expect(cp.newRoot.string()).toEqual(
        '76534138237239231515859035502772486263463178175980489503663557460094727691106'
      );
      expect(cp.oldKey.string()).toEqual('1');
      expect(cp.oldValue.string()).toEqual('2');
      expect(cp.newKey.string()).toEqual('33');
      expect(cp.newValue.string()).toEqual('44');
      expect(cp.isOld0).toEqual(false);
      cp.siblings.forEach((s) => {
        expect(s.string()).toEqual('0');
      });
      expect(mt.maxLevels).toEqual(cp.siblings.length);

      cp = await mt.addAndGetCircomProof(BigInt('55'), BigInt('66'));

      expect(cp.oldRoot.string()).toEqual(
        '76534138237239231515859035502772486263463178175980489503663557460094727691106'
      );
      expect(cp.newRoot.string()).toEqual(
        '100083525042858579469173067236420875189251047437244717808734980864550950841073'
      );
      expect(cp.oldKey.string()).toEqual('0');
      expect(cp.oldValue.string()).toEqual('0');
      expect(cp.newKey.string()).toEqual('55');
      expect(cp.newValue.string()).toEqual('66');
      expect(cp.isOld0).toEqual(true);
      cp.siblings.forEach((s, idx) => {
        expect(s.string()).toEqual(
          idx === 1
            ? '100147266556511215860644966030919568737539727316864555910145591818465462834425'
            : '0'
        );
      });
      expect(mt.maxLevels).toEqual(cp.siblings.length);
    });

    it('test update circom processor proof', async () => {
      const sto = getTreeStorage();
      const mt = new Merkletree(sto, true, 10);

      for (let i = 0; i < 16; i += 1) {
        const k = BigInt(i);
        const v = BigInt(i * 2);
        await mt.add(k, v);
      }

      const { value } = await mt.get(BigInt('10'));
      expect(value.toString(10)).toEqual('20');

      const cp = await mt.update(BigInt('10'), BigInt('1024'));
      expect(cp.oldRoot.string()).toEqual(
        '70677940031105004292099401697546638864981638318384841379601260831501391203788'
      );
      expect(cp.newRoot.string()).toEqual(
        '48796142087158721811528672088219959178352830095639452772749500760280476852932'
      );
      expect(cp.oldKey.string()).toEqual('10');
      expect(cp.oldValue.string()).toEqual('20');
      expect(cp.newKey.string()).toEqual('10');
      expect(cp.newValue.string()).toEqual('1024');
      expect(cp.isOld0).toEqual(false);
      expect(cp.siblings[0].string()).toEqual(
        '45247436445267862009183516361627205881717670673355502280321468321589941650846'
      );
      expect(cp.siblings[1].string()).toEqual(
        '76599317612364446295737122728756946145443571773351769593968842498322866493543'
      );
      expect(cp.siblings[2].string()).toEqual(
        '106508940255354195227377169991555575191708987078060771291990080645784153376100'
      );
      expect(cp.siblings[3].string()).toEqual(
        '99711606839544608379269298367305638623929069793968545743733961006129285845166'
      );
      cp.siblings.slice(4).forEach((s) => {
        expect(s.string()).toEqual('0');
      });
    });

    it('expect tree.walk does not produce infinite loop', async () => {
      const f = async (node: Node): Promise<void> => {
        return Promise.resolve();
      };
      const tree = new Merkletree(new InMemoryDB(str2Bytes(''), HashAlgorithm.Keccak256), true, 40);

      for (let i = 0; i < 5; i++) {
        await tree.add(BigInt(i), BigInt(i));
      }

      await tree.walk(await tree.root(), (node: Node) => f(node));
    });

    it('proof stringify (old format for node aux)', async () => {
      const tree = new Merkletree(new InMemoryDB(str2Bytes(''), HashAlgorithm.Keccak256), true, 40);

      for (let i = 0; i < 5; i++) {
        await tree.add(BigInt(i), BigInt(i));
      }

      const { proof, value } = await tree.generateProof(BigInt(9));

      const proofModel = JSON.stringify(proof);
      const p = JSON.parse(proofModel) as ProofJSON;

      p.nodeAux = p.node_aux;
      p.node_aux = undefined;

      const proofFromJSON = Proof.fromJSON(JSON.parse(proofModel));

      expect(JSON.stringify(proof.allSiblings())).toEqual(
        JSON.stringify(proofFromJSON.allSiblings())
      );
      expect(proof.existence).toEqual(proofFromJSON.existence);
      expect(proof.existence).toEqual(false);
      expect(JSON.stringify(proof.nodeAux)).toEqual(JSON.stringify(proofFromJSON.nodeAux));
    });
    it('proof stringify (new format for node aux)', async () => {
      const tree = new Merkletree(new InMemoryDB(str2Bytes(''), HashAlgorithm.Keccak256), true, 40);

      for (let i = 0; i < 5; i++) {
        await tree.add(BigInt(i), BigInt(i));
      }

      const { proof, value } = await tree.generateProof(BigInt(9));

      const proofModel = JSON.stringify(proof);

      const proofFromJSON = Proof.fromJSON(JSON.parse(proofModel));

      expect(JSON.stringify(proof.allSiblings())).toEqual(
        JSON.stringify(proofFromJSON.allSiblings())
      );
      expect(proof.existence).toEqual(proofFromJSON.existence);
      expect(proof.existence).toEqual(false);
      expect(JSON.stringify(proof.nodeAux)).toEqual(JSON.stringify(proofFromJSON.nodeAux));
    });
    it('should deserialize Old Hash properly', async () => {
      const hash = new Hash(
        bigIntToUINT8Array(
          BigInt('5158240518874928563648144881543092238925265313977134167935552944620041388700')
        )
      );

      const oldSerializedHash =
        '{"bytes":{"0":11,"1":103,"2":117,"3":238,"4":151,"5":230,"6":106,"7":85,"8":195,"9":138,"10":136,"11":160,"12":178,"13":153,"14":109,"15":13,"16":220,"17":95,"18":34,"19":180,"20":1,"21":227,"22":55,"23":246,"24":102,"25":115,"26":95,"27":214,"28":80,"29":163,"30":194,"31":156}}';
      // deserialize
      const deserializedHash = JSON.parse(oldSerializedHash);
      const bytes = Uint8Array.from(Object.values(deserializedHash.bytes));
      const hash2 = new Hash(bytes);
      const hashFromOldStr = Hash.fromString(oldSerializedHash);

      expect(JSON.stringify(hash)).toEqual(JSON.stringify(hashFromOldStr.bigInt().toString()));
      expect(JSON.stringify(hash.bytes)).toEqual(JSON.stringify(bytes));
      expect(hash.toJSON()).toEqual(hash2.bigInt().toString());
      expect(hash.bytes).toEqual(hash2.bytes);

      expect(hash.hex()).toEqual(Hash.fromHex(hash2.hex()).hex());
    });
    it('test smt verifier', async () => {
      const sto = getTreeStorage();
      const mt = new Merkletree(sto, true, 4);

      await mt.add(BigInt('1'), BigInt('11'));
      let cvp = await mt.generateSCVerifierProof(BigInt('1'), ZERO_HASH);

      expect(cvp.root.string()).toEqual(
        '82784984500014977958877763851140688264267178109068954640885039848244046400394'
      );
      expect(cvp.siblings.length).toEqual(0);
      expect(cvp.oldKey.string()).toEqual('0');
      expect(cvp.oldValue.string()).toEqual('0');
      expect(cvp.isOld0).toEqual(false);
      expect(cvp.key.string()).toEqual('1');
      expect(cvp.value.string()).toEqual('11');
      expect(cvp.fnc).toEqual(0);

      await mt.add(BigInt('2'), BigInt('22'));
      await mt.add(BigInt('3'), BigInt('33'));
      await mt.add(BigInt('4'), BigInt('44'));

      cvp = await mt.generateCircomVerifierProof(BigInt('2'), ZERO_HASH);

      expect(cvp.root.string()).toEqual(
        '72673135994199316395211355754392715689773200652773094050830171707225485579516'
      );
      expect(cvp.siblings.length).toEqual(4);
      expect(cvp.siblings[0].string()).toEqual(
        '95410369572552625669929443880336035845295666870039053310723367652976210217889'
      );
      expect(cvp.siblings[1].string()).toEqual(
        '108591810159780947021882411046895107657640634072271577060276219923125949566920'
      );
      cvp.siblings.slice(3).forEach((s) => {
        expect(s.string()).toEqual('0');
      });
      expect(cvp.oldKey.string()).toEqual('0');
      expect(cvp.oldValue.string()).toEqual('0');
      expect(cvp.isOld0).toEqual(false);
      expect(cvp.key.string()).toEqual('2');
      expect(cvp.value.string()).toEqual('22');
      expect(cvp.fnc).toEqual(0);
    });
    it('calculate depth for mtp', async () => {
      const storage = getTreeStorage('calculatedepth');
      const mt = new Merkletree(storage, true, 40);

      await mt.add(BigInt('1'), BigInt('2'));
      await mt.add(BigInt('3'), BigInt('8'));
      await mt.add(BigInt('7'), BigInt('8'));
      await mt.add(BigInt('9'), BigInt('8'));

      const { proof }: { proof: Proof } = await mt.generateProof(BigInt('11'), await mt.root());

      const given = `{ "existence": false, "siblings": [ "0", "30257231137654976416713033869467714092857353299944484231479292418632657921939", "108174256589026683124305912205446370618204099420522125478345491452742619876089", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0" ], "node_aux": { "key": "3", "value": "8" }}`;
      const p = Proof.fromJSON(JSON.parse(given));

      expect(proof.allSiblings()).toEqual(p.allSiblings());
      expect(proof.nodeAux).toEqual(p.nodeAux);
      expect(proof.existence).toEqual(p.existence);

      let isValid = await verifyProof(await mt.root(), proof, BigInt('11'), BigInt('0'), HashAlgorithm.Keccak256);
      expect(isValid).toEqual(true);
      isValid = await verifyProof(await mt.root(), p, BigInt('11'), BigInt('0'), HashAlgorithm.Keccak256);
      expect(isValid).toEqual(true);
    });
    it('calculate depth for mtp (old format)', async () => {
      const storage = getTreeStorage('calculatedepth');
      const mt = new Merkletree(storage, true, 40);

      await mt.add(BigInt('1'), BigInt('2'));
      await mt.add(BigInt('3'), BigInt('8'));
      await mt.add(BigInt('7'), BigInt('8'));
      await mt.add(BigInt('9'), BigInt('8'));

      const { proof }: { proof: Proof } = await mt.generateProof(BigInt('11'), await mt.root());

      const given = `{ "existence": false, "siblings": [ "0", "30257231137654976416713033869467714092857353299944484231479292418632657921939", "108174256589026683124305912205446370618204099420522125478345491452742619876089", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0" ], "nodeAux": { "key": "3", "value": "8" }}`;
      const p = Proof.fromJSON(JSON.parse(given));

      expect(proof.allSiblings()).toEqual(p.allSiblings());
      expect(proof.nodeAux).toEqual(p.nodeAux);
      expect(proof.existence).toEqual(p.existence);

      let isValid = await verifyProof(await mt.root(), proof, BigInt('11'), BigInt('0'), HashAlgorithm.Keccak256);
      expect(isValid).toEqual(true);
      isValid = await verifyProof(await mt.root(), p, BigInt('11'), BigInt('0'), HashAlgorithm.Keccak256);
      expect(isValid).toEqual(true);
    });
  });
}

const compareSiblings = (expectedSiblings: bigint[], p: Proof) => {
  const actualSiblings = p.allSiblings();
  expect(actualSiblings.length).toEqual(expectedSiblings.length);
  for (let i = 0; i < expectedSiblings.length; i++) {
    expect(actualSiblings[i].bigInt()).toEqual(expectedSiblings[i]);
  }
};
