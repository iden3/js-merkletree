import { UseStore, createStore, clear } from 'idb-keyval';
import { HASH_BYTES_LENGTH, MAX_NUM_IN_FIELD, NODE_TYPE_LEAF } from '../src/constants';
import { NodeLeaf, NodeMiddle } from '../src/lib/node/node';
import { InMemoryDB, LocalStorageDB, IndexedDBStorage } from '../src/lib/db';
import { bigIntToUINT8Array, bytes2Hex, bytesEqual, str2Bytes } from '../src/lib/utils';
import { Hash, ZERO_HASH } from '../src/lib/hash/hash';
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
        return new LocalStorageDB(str2Bytes(prefix));
      } else if (storages[index] == TreeStorageType.IndexedDB) {
        return new IndexedDBStorage(str2Bytes(prefix));
      } else if (storages[index] == TreeStorageType.InMemoryDB) {
        return new InMemoryDB(str2Bytes(prefix));
      }
      throw new Error('error: unknown storage type');
    };

    it('checks that the implementation of the db.Storage interface behaves as expected', async () => {
      const sto = getTreeStorage();

      const bytes = new Uint8Array(HASH_BYTES_LENGTH);
      bytes[0] = 1;
      const v = new Hash(bytes);

      const node = new NodeMiddle(v, v);
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
        '13578938674299138072471463694055224830892726234048532520316387704878000008795'
      );

      await mt.add(BigInt('33'), BigInt('44'));
      expect((await mt.root()).bigInt().toString(10)).toEqual(
        '5412393676474193513566895793055462193090331607895808993925969873307089394741'
      );

      await mt.add(BigInt('1234'), BigInt('9876'));
      expect((await mt.root()).bigInt().toString(10)).toEqual(
        '14204494359367183802864593755198662203838502594566452929175967972147978322084'
      );

      expect((await sto.getRoot()).bigInt().toString()).toEqual(
        (await mt.root()).bigInt().toString()
      );

      const { proof, value } = await mt.generateProof(BigInt('33'));
      expect(value.toString()).toEqual('44');

      expect(await verifyProof(await mt.root(), proof, BigInt('33'), BigInt('44'))).toEqual(true);

      expect(await verifyProof(await mt.root(), proof, BigInt('33'), BigInt('45'))).toEqual(false);
    });

    it('test tree with one node', async () => {
      const sto = getTreeStorage();
      const mt = new Merkletree(sto, true, 10);
      expect(bytesEqual((await mt.root()).value, ZERO_HASH.value)).toEqual(true);

      await mt.add(BigInt('100'), BigInt('200'));
      expect((await mt.root()).bigInt().toString(10)).toEqual(
        '798876344175601936808542466911896801961231313012372360729165540443724338832'
      );
      const inputs = [BigInt('100'), BigInt('200'), BigInt('1')];
      const res = poseidon.hash(inputs);
      expect((await mt.root()).bigInt().toString()).toEqual(res.toString());
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
        '3b89100bec24da9275c87bc188740389e1d5accfc7d88ba5688d7fa96a00d82f'
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
      const verRes = await verifyProof(await mt.root(), proof, BigInt('42'), BigInt('0'));
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
        'd6e368bda90c5ee3e910222c1fc1c0d9e23f2d350dbc47f4a92de30f1be3c60b'
      );
      expect(siblings[1].hex()).toEqual(
        '9dbd03b1bcd580e0f3e6668d80d55288f04464126feb1624ec8ee30be8df9c16'
      );
      expect(siblings[2].hex()).toEqual(
        'de866af9545dcd1c5bb7811e7f27814918e037eb9fead40919e8f19525896e27'
      );
      expect(siblings[3].hex()).toEqual(
        '5f4182212a84741d1174ba7c42e369f2e3ad8ade7d04eea2d0f98e3ed8b7a317'
      );
      expect(siblings[4].hex()).toEqual(
        '77639098d513f7aef9730fdb1d1200401af5fe9da91b61772f4dd142ac89a122'
      );
      expect(siblings[5].hex()).toEqual(
        '943ee501f4ba2137c79b54af745dfc5f105f539fcc449cd2a356eb5c030e3c07'
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
      expect(await verifyProof(await mt.root(), proof, BigInt('4'), BigInt('0'))).toEqual(true);
      expect(bytes2Hex(proof.bytes())).toEqual(
        '0003000000000000000000000000000000000000000000000000000000000007529cbedbda2bdd25fd6455551e55245fa6dc11a9d0c27dc0cd38fca44c17e40344ad686a18ba78b502c0b6f285c5c8393bde2f7a3e2abe586515e4d84533e3037b062539bde2d80749746986cf8f0001fd2cdbf9a89fcbf981a769daef49df06'
      );

      for (let i = 8; i < 32; i += 1) {
        const { proof } = await mt.generateProof(BigInt(i));
        expect(proof.existence).toBeDefined();
      }

      // non-existence proof, node aux
      proof = (await mt.generateProof(BigInt('12'))).proof;
      expect(proof.existence).toEqual(false);
      expect(proof.nodeAux).toBeDefined();
      expect(await verifyProof(await mt.root(), proof, BigInt('12'), BigInt('0'))).toEqual(true);
      expect(bytes2Hex(proof.bytes())).toEqual(
        '0303000000000000000000000000000000000000000000000000000000000007529cbedbda2bdd25fd6455551e55245fa6dc11a9d0c27dc0cd38fca44c17e40344ad686a18ba78b502c0b6f285c5c8393bde2f7a3e2abe586515e4d84533e3037b062539bde2d80749746986cf8f0001fd2cdbf9a89fcbf981a769daef49df0604000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' //nolint:lll
      );

      // non-existence proof, node aux
      proof = (await mt.generateProof(BigInt('10'))).proof;
      expect(proof.existence).toEqual(false);
      expect(proof.nodeAux).toBeDefined();
      expect(await verifyProof(await mt.root(), proof, BigInt('10'), BigInt('0'))).toEqual(true);
      expect(bytes2Hex(proof.bytes())).toEqual(
        '0303000000000000000000000000000000000000000000000000000000000007529cbedbda2bdd25fd6455551e55245fa6dc11a9d0c27dc0cd38fca44c17e4030acfcdd2617df9eb5aef744c5f2e03eb8c92c61f679007dc1f2707fd908ea41a9433745b469c101edca814c498e7f388100d497b24f1d2ac935bced3572f591d02000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' //nolint:lll
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
      expect(await verifyProof(await mt.root(), proof, BigInt('5'), BigInt('5'))).toEqual(false);

      // Invalid non-existence proof (Non-existence proof, diff. node aux)
      proof = (await mt.generateProof(BigInt('4'))).proof;
      expect(proof.existence).toEqual(true);
      proof.existence = false;
      proof.nodeAux = {
        key: Hash.fromBigInt(BigInt('4')),
        value: Hash.fromBigInt(BigInt('4'))
      };

      expect(await verifyProof(await mt.root(), proof, BigInt('4'), BigInt('0'))).toEqual(false);
    });

    it('test delete', async () => {
      const sto = getTreeStorage();
      const mt = new Merkletree(sto, true, 10);

      await mt.add(BigInt('1'), BigInt('2'));
      expect((await mt.root()).string()).toEqual(
        '13578938674299138072471463694055224830892726234048532520316387704878000008795'
      );

      await mt.add(BigInt('33'), BigInt('44'));
      expect((await mt.root()).string()).toEqual(
        '5412393676474193513566895793055462193090331607895808993925969873307089394741'
      );

      await mt.add(BigInt('1234'), BigInt('9876'));
      expect((await mt.root()).string()).toEqual(
        '14204494359367183802864593755198662203838502594566452929175967972147978322084'
      );

      await mt.delete(BigInt('33'));
      expect((await mt.root()).string()).toEqual(
        '15550352095346187559699212771793131433118240951738528922418613687814377955591'
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
        '19060075022714027595905950662613111880864833370144986660188929919683258088314'
      );

      await mt1.delete(BigInt('1'));

      expect((await mt1.root()).string()).toEqual(
        '849831128489032619062850458217693666094013083866167024127442191257793527951'
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
        '14109632483797541575275728657193822866549917334388996328141438956557066918117'
      );

      await mt1.delete(BigInt('1'));

      expect((await mt1.root()).string()).toEqual(
        '159935162486187606489815340465698714590556679404589449576549073038844694972'
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
        '5412393676474193513566895793055462193090331607895808993925969873307089394741'
      );

      await mt1.delete(BigInt('1'));

      expect((await mt1.root()).string()).toEqual(
        '18869260084287237667925661423624848342947598951870765316380602291081195309822'
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
        '1': [0n, 3968539605503372859924195689353752825000692947459401078008697788408142999740n],
        '5': [
          0n,
          3968539605503372859924195689353752825000692947459401078008697788408142999740n,
          1243904711429961858774220647610724273798918457991486031567244100767259239747n
        ]
      };

      for (const k of keys) {
        await mt.add(k, k);
        const existProof = await mt.generateProof(k, await mt.root());
        expect(existProof.proof.existence).toEqual(true);
        compareSiblings(expectedSiblings[k.toString()], existProof.proof);
      }

      const expectedSiblingsNonExist: { [id: string]: bigint[] } = {
        '7': [0n, 4274876798241152869364032215387952876266736406919374878317677138322903129320n],
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
          14218827602097913497782608311388761513660285528499590827800641410537362569671n
        ],
        '15': [
          0n,
          0n,
          14218827602097913497782608311388761513660285528499590827800641410537362569671n,
          3968539605503372859924195689353752825000692947459401078008697788408142999740n
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
          10179745751648650481317481301133564568831136415508833815669215270622331305772n
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
        '4': [0n, 8281804442553804052634892902276241371362897230229887706643673501401618941157n],
        '2': [
          0n,
          9054077202653694725190129562729426419405710792276939073869944863201489138082n,
          8281804442553804052634892902276241371362897230229887706643673501401618941157n
        ]
      };

      for (const k of keys) {
        await mt.add(k, k);
        const existProof = await mt.generateProof(k, await mt.root());
        expect(existProof.proof.existence).toEqual(true);
        compareSiblings(expectedSiblings[k.toString()], existProof.proof);
      }

      const expectedSiblingsNonExist: { [id: string]: bigint[] } = {
        '6': [0n, 9054077202653694725190129562729426419405710792276939073869944863201489138082n],
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
          9054077202653694725190129562729426419405710792276939073869944863201489138082n
        ],
        '16': [
          0n,
          0n,
          9054077202653694725190129562729426419405710792276939073869944863201489138082n,
          16390924951002018924619640791777477120654009069056735603697729984158734051481n
        ]
      };

      for (const k of keys) {
        await mt.add(k, k);
        const existProof = await mt.generateProof(k, await mt.root());
        expect(existProof.proof.existence).toEqual(true);
        compareSiblings(expectedSiblings[k.toString()], existProof.proof);
      }

      const expectedSiblingsNonExist: { [id: string]: bigint[] } = {
        '4': [0n, 0n, 999617652929602377745081623447845927693004638040169919261337791961364573823n],
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
        4274876798241152869364032215387952876266736406919374878317677138322903129320n
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
        4274876798241152869364032215387952876266736406919374878317677138322903129320n
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
        8485562453225409715331824380162827639878522662998299574537757078697535221073n
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
        4274876798241152869364032215387952876266736406919374878317677138322903129320n
      ];
      await mt.delete(3n);
      let proof = await mt.generateProof(3n, await mt.root());
      expect(proof.proof.existence).toEqual(false);
      compareSiblings(expectedSiblingsNonExist, proof.proof);

      const expectedSiblingsExist = [
        0n,
        4274876798241152869364032215387952876266736406919374878317677138322903129320n,
        3968539605503372859924195689353752825000692947459401078008697788408142999740n
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
        8485562453225409715331824380162827639878522662998299574537757078697535221073n
      ];
      await mt.delete(8n);
      let proof = await mt.generateProof(8n, await mt.root());
      expect(proof.proof.existence).toEqual(false);
      compareSiblings(expectedSiblingsNonExist, proof.proof);

      const expectedSiblingsExist = [
        0n,
        8485562453225409715331824380162827639878522662998299574537757078697535221073n,
        9054077202653694725190129562729426419405710792276939073869944863201489138082n
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
        [0n, 1243904711429961858774220647610724273798918457991486031567244100767259239747n],
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
        [0n, 849831128489032619062850458217693666094013083866167024127442191257793527951n],
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
        '13578938674299138072471463694055224830892726234048532520316387704878000008795'
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
        '13578938674299138072471463694055224830892726234048532520316387704878000008795'
      );
      expect(cp.newRoot.string()).toEqual(
        '5412393676474193513566895793055462193090331607895808993925969873307089394741'
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
        '5412393676474193513566895793055462193090331607895808993925969873307089394741'
      );
      expect(cp.newRoot.string()).toEqual(
        '5094364082618099436543535513148866130251600642297988457797401489780171282025'
      );
      expect(cp.oldKey.string()).toEqual('0');
      expect(cp.oldValue.string()).toEqual('0');
      expect(cp.newKey.string()).toEqual('55');
      expect(cp.newValue.string()).toEqual('66');
      expect(cp.isOld0).toEqual(true);
      cp.siblings.forEach((s, idx) => {
        expect(s.string()).toEqual(
          idx === 1
            ? '21312042436525850949775663177240566532157857119003189090405819719191539342280'
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
        '3901088098157312895771168508102875327412498476307103941861116446804059788045'
      );
      expect(cp.newRoot.string()).toEqual(
        '18587862578201383535363956627488622136678432340275446723812600963773389007517'
      );
      expect(cp.oldKey.string()).toEqual('10');
      expect(cp.oldValue.string()).toEqual('20');
      expect(cp.newKey.string()).toEqual('10');
      expect(cp.newValue.string()).toEqual('1024');
      expect(cp.isOld0).toEqual(false);
      expect(cp.siblings[0].string()).toEqual(
        '3493055760199345983787399479799897884337329583575225430469748865784580035592'
      );
      expect(cp.siblings[1].string()).toEqual(
        '20201609720365205433999360001442791710365537253733030676534981802168302054263'
      );
      expect(cp.siblings[2].string()).toEqual(
        '18790542149740435554763618183910097219145811410462734411095932062387939731734'
      );
      expect(cp.siblings[3].string()).toEqual(
        '15930030482599007570177067416534114035267479078907080052418814162004846408322'
      );
      cp.siblings.slice(4).forEach((s) => {
        expect(s.string()).toEqual('0');
      });
    });

    it('expect tree.walk does not produce infinite loop', async () => {
      const f = async (node: Node): Promise<void> => {
        return Promise.resolve();
      };
      const tree = new Merkletree(new InMemoryDB(str2Bytes('')), true, 40);

      for (let i = 0; i < 5; i++) {
        await tree.add(BigInt(i), BigInt(i));
      }

      await tree.walk(await tree.root(), (node: Node) => f(node));
    });

    it('proof stringify (old format for node aux)', async () => {
      const tree = new Merkletree(new InMemoryDB(str2Bytes('')), true, 40);

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
      const tree = new Merkletree(new InMemoryDB(str2Bytes('')), true, 40);

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
        '6525056641794203554583616941316772618766382307684970171204065038799368146416'
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
        '13558168455220559042747853958949063046226645447188878859760119761585093422436'
      );
      expect(cvp.siblings.length).toEqual(4);
      expect(cvp.siblings[0].string()).toEqual(
        '11620130507635441932056895853942898236773847390796721536119314875877874016518'
      );
      expect(cvp.siblings[1].string()).toEqual(
        '5158240518874928563648144881543092238925265313977134167935552944620041388700'
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

      const given = `{ "existence": false, "siblings": [ "0", "12166698708103333637493481507263348370172773813051235807348785759284762677336", "7750564177398573185975752951631372712868228752107043582052272719841058100111", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0" ], "node_aux": { "key": "3", "value": "8" }}`;
      const p = Proof.fromJSON(JSON.parse(given));

      expect(proof.allSiblings()).toEqual(p.allSiblings());
      expect(proof.nodeAux).toEqual(p.nodeAux);
      expect(proof.existence).toEqual(p.existence);

      let isValid = await verifyProof(await mt.root(), proof, BigInt('11'), BigInt('0'));
      expect(isValid).toEqual(true);
      isValid = await verifyProof(await mt.root(), p, BigInt('11'), BigInt('0'));
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

      const given = `{ "existence": false, "siblings": [ "0", "12166698708103333637493481507263348370172773813051235807348785759284762677336", "7750564177398573185975752951631372712868228752107043582052272719841058100111", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0", "0" ], "nodeAux": { "key": "3", "value": "8" }}`;
      const p = Proof.fromJSON(JSON.parse(given));

      expect(proof.allSiblings()).toEqual(p.allSiblings());
      expect(proof.nodeAux).toEqual(p.nodeAux);
      expect(proof.existence).toEqual(p.existence);

      let isValid = await verifyProof(await mt.root(), proof, BigInt('11'), BigInt('0'));
      expect(isValid).toEqual(true);
      isValid = await verifyProof(await mt.root(), p, BigInt('11'), BigInt('0'));
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
