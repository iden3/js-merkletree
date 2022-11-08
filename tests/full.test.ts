import { expect } from 'chai';
import { HASH_BYTES_LENGTH, ZERO_HASH } from '../src/constants';
import { NodeMiddle } from '../src/lib/node/node';
import inMemmoryDB from '../src/lib/db/inMemory';
import {
  bytes2Hex,
  bytesEqual,
  newHashFromBigInt,
  poseidonHash,
  siblignsFroomProof,
  str2Bytes,
  verifyProof
} from '../src/lib/utils';
import Hash from '../src/lib/hash/hash';
import Merkletree from '../src/lib/merkletree/merkletree';
import bigInt from 'big-integer';
import {
  ErrEntryIndexAlreadyExists,
  ErrInvalidNodeFound,
  ErrKeyNotFound,
  ErrNotFound,
  ErrReachedMaxLevel
} from '../src/lib/errors';
import { MAX_NUM_IN_FIELD } from '../src/constants/field';

describe('full test of the SMT library', () => {
  const TIMEOUT_MIN = 60000;

  const getInMemoryDB = () => {
    return new inMemmoryDB(str2Bytes(''));
  };

  it('checks that the implementation of the db.Storage interface behaves as expected', async () => {
    const sto = getInMemoryDB();
    const v = new Hash();

    const buff = new ArrayBuffer(HASH_BYTES_LENGTH);
    const bytes = new Uint8Array(buff);
    (bytes[0] = 1), (bytes[0] = 2), (bytes[0] = 3), (bytes[0] = 1);
    v.value = bytes;

    const node = new NodeMiddle(v, v);
    const k = await node.getKey();
    await sto.put(k.value, node);
    const val = await sto.get(k.value);

    expect(val).not.undefined;
    expect((val as NodeMiddle).childL.Hex()).eq(v.Hex());
    expect((val as NodeMiddle).childR.Hex()).eq(v.Hex());
  });

  it('test new merkle tree', async () => {
    const sto = new inMemmoryDB(str2Bytes(''));
    const mt = new Merkletree(sto, true, 10);
    expect(mt.root.String()).equal('0');

    await mt.add(bigInt(1), bigInt(2));
    expect(mt.root.BigInt().toString(10)).equal(
      '13578938674299138072471463694055224830892726234048532520316387704878000008795'
    );

    await mt.add(bigInt(33), bigInt(44));
    expect(mt.root.BigInt().toString(10)).equal(
      '5412393676474193513566895793055462193090331607895808993925969873307089394741'
    );

    await mt.add(bigInt(1234), bigInt(9876));
    expect(mt.root.BigInt().toString(10)).equal(
      '14204494359367183802864593755198662203838502594566452929175967972147978322084'
    );

    expect(sto.getRoot().BigInt().toString()).equal(mt.root.BigInt().toString());

    const { proof, value } = await mt.generateProof(bigInt(33), ZERO_HASH);
    expect(value.toString()).equal('44');

    expect(await verifyProof(mt.root, proof, bigInt(33), bigInt(44))).to.be.true;

    expect(await verifyProof(mt.root, proof, bigInt(33), bigInt(45))).to.be.false;
  }).timeout(TIMEOUT_MIN);

  it('test tree with one node', async () => {
    const sto = getInMemoryDB();
    const mt = new Merkletree(sto, true, 10);
    expect(bytesEqual(mt.root.value, ZERO_HASH.value)).to.be.true;

    await mt.add(bigInt(100), bigInt(200));
    expect(mt.root.BigInt().toString(10)).equal(
      '798876344175601936808542466911896801961231313012372360729165540443724338832'
    );
    const inputs = [bigInt(100), bigInt(200), bigInt(1)];
    const res = await poseidonHash(inputs);
    expect(mt.root.BigInt().toString()).equal(res.toString());
  });

  it('test add and different order', async () => {
    const sto1 = getInMemoryDB();
    const sto2 = getInMemoryDB();
    const mt1 = new Merkletree(sto1, true, 140);
    const mt2 = new Merkletree(sto2, true, 140);

    for (let i = 0; i < 16; i += 1) {
      const k = bigInt(i);
      const v = bigInt(0);
      await mt1.add(k, v);
    }

    for (let i = 0; i < 16; i += 1) {
      const k = bigInt(i);
      const v = bigInt(0);
      await mt2.add(k, v);
    }

    expect(mt1.root.String()).to.equal(mt2.root.String());
    expect(mt1.root.Hex()).to.equal(
      '3b89100bec24da9275c87bc188740389e1d5accfc7d88ba5688d7fa96a00d82f'
    );
  }).timeout(TIMEOUT_MIN);

  it('test add repeated index', async () => {
    const sto = getInMemoryDB();
    const mt = new Merkletree(sto, true, 140);

    const k = bigInt(3);
    const v = bigInt(12);
    await mt.add(k, v);

    try {
      await mt.add(k, v);
    } catch (err) {
      expect(err).to.be.equal(ErrEntryIndexAlreadyExists);
    }
  });

  it('test get', async () => {
    const sto = getInMemoryDB();
    const mt = new Merkletree(sto, true, 140);

    for (let i = 0; i < 16; i += 1) {
      const k = bigInt(i);
      const v = bigInt(i * 2);

      await mt.add(k, v);
    }
    const { key: k1, value: v1 } = await mt.get(bigInt(10));
    expect(k1.toString(10)).to.be.equal('10');
    expect(v1.toString(10)).to.be.equal('20');

    const { key: k2, value: v2 } = await mt.get(bigInt(15));
    expect(k2.toString(10)).to.be.equal('15');
    expect(v2.toString(10)).to.be.equal('30');

    try {
      await mt.get(bigInt(16));
    } catch (err) {
      expect(err).to.be.equal(ErrKeyNotFound);
    }
  }).timeout(TIMEOUT_MIN * 5);

  it('test update', async () => {
    const sto = getInMemoryDB();
    const mt = new Merkletree(sto, true, 140);

    for (let i = 0; i < 16; i += 1) {
      const k = bigInt(i);
      const v = bigInt(i * 2);
      await mt.add(k, v);
    }

    expect((await mt.get(bigInt(10))).value.toString(10)).to.be.equal('20');

    await mt.update(bigInt(10), bigInt(1024));
    expect((await mt.get(bigInt(10))).value.toString(10)).to.be.equal('1024');

    try {
      await mt.update(bigInt(10), bigInt(1024));
    } catch (err) {
      expect(err).to.be.equal(ErrKeyNotFound);
    }

    const dbRoot = sto.getRoot();
    expect(dbRoot.String()).equal(mt.root.String());
  }).timeout(TIMEOUT_MIN);

  it('test update 2', async () => {
    const sto1 = getInMemoryDB();
    const sto2 = getInMemoryDB();
    const mt1 = new Merkletree(sto1, true, 140);
    const mt2 = new Merkletree(sto2, true, 140);

    await mt1.add(bigInt(1), bigInt(2));
    await mt1.add(bigInt(2), bigInt(229));
    await mt1.add(bigInt(9876), bigInt(6789));

    await mt2.add(bigInt(1), bigInt(11));
    await mt2.add(bigInt(2), bigInt(22));
    await mt2.add(bigInt(9876), bigInt(10));

    await mt1.update(bigInt(1), bigInt(11));
    await mt1.update(bigInt(2), bigInt(22));
    await mt2.update(bigInt(9876), bigInt(6789));

    expect(mt1.root.String()).to.be.equal(mt2.root.String());
  }).timeout(TIMEOUT_MIN);

  it('test generate and verify proof 128', async () => {
    const sto = getInMemoryDB();
    const mt = new Merkletree(sto, true, 140);

    for (let i = 0; i < 128; i += 1) {
      const k = bigInt(i);
      const v = bigInt(0);

      await mt.add(k, v);
    }

    const { proof, value } = await mt.generateProof(bigInt(42), ZERO_HASH);
    expect(value.toString()).to.be.equal('0');
    const verRes = await verifyProof(mt.root, proof, bigInt(42), bigInt(0));
    expect(verRes).to.be.true;
  }).timeout(TIMEOUT_MIN * 10);

  it('test tree limit', async () => {
    const sto = getInMemoryDB();
    const mt = new Merkletree(sto, true, 5);

    for (let i = 0; i < 16; i += 1) {
      await mt.add(bigInt(i), bigInt(i));
    }

    try {
      await mt.add(bigInt(16), bigInt(16));
    } catch (err) {
      expect(err).to.be.equal(ErrReachedMaxLevel);
    }
  }).timeout(TIMEOUT_MIN);

  it('test sibligns from proof', async () => {
    const sto = getInMemoryDB();
    const mt = new Merkletree(sto, true, 140);

    for (let i = 0; i < 64; i += 1) {
      const k = bigInt(i);
      const v = bigInt(0);
      await mt.add(k, v);
    }

    const { proof } = await mt.generateProof(bigInt(4), ZERO_HASH);
    const siblings = siblignsFroomProof(proof);

    expect(siblings.length).to.be.equal(6);

    expect(siblings[0].Hex()).to.be.equal(
      'd6e368bda90c5ee3e910222c1fc1c0d9e23f2d350dbc47f4a92de30f1be3c60b'
    );
    expect(siblings[1].Hex()).to.be.equal(
      '9dbd03b1bcd580e0f3e6668d80d55288f04464126feb1624ec8ee30be8df9c16'
    );
    expect(siblings[2].Hex()).to.be.equal(
      'de866af9545dcd1c5bb7811e7f27814918e037eb9fead40919e8f19525896e27'
    );
    expect(siblings[3].Hex()).to.be.equal(
      '5f4182212a84741d1174ba7c42e369f2e3ad8ade7d04eea2d0f98e3ed8b7a317'
    );
    expect(siblings[4].Hex()).to.be.equal(
      '77639098d513f7aef9730fdb1d1200401af5fe9da91b61772f4dd142ac89a122'
    );
    expect(siblings[5].Hex()).to.be.equal(
      '943ee501f4ba2137c79b54af745dfc5f105f539fcc449cd2a356eb5c030e3c07'
    );
  }).timeout(TIMEOUT_MIN * 5);

  it('test and verify proof cases', async () => {
    const sto = getInMemoryDB();
    const mt = new Merkletree(sto, true, 140);

    for (let i = 0; i < 8; i += 1) {
      await mt.add(bigInt(i), bigInt(0));
    }

    let { proof } = await mt.generateProof(bigInt(4), ZERO_HASH);
    expect(proof.existence).to.be.true;
    expect(await verifyProof(mt.root, proof, bigInt(4), bigInt(0))).to.be.true;
    expect(
      bytes2Hex(proof.bytes()),
      '0003000000000000000000000000000000000000000000000000000000000007529cbedbda2bdd25fd6455551e55245fa6dc11a9d0c27dc0cd38fca44c17e40344ad686a18ba78b502c0b6f285c5c8393bde2f7a3e2abe586515e4d84533e3037b062539bde2d80749746986cf8f0001fd2cdbf9a89fcbf981a769daef49df06'
    );

    for (let i = 8; i < 32; i += 1) {
      const { proof } = await mt.generateProof(bigInt(i), ZERO_HASH);
    }

    // non-existence proof, empty aux
    proof = (await mt.generateProof(bigInt(12), ZERO_HASH)).proof;
    expect(proof.existence).to.be.false;
    expect(await verifyProof(mt.root, proof, bigInt(12), bigInt(0))).to.be.true;
    expect(
      bytes2Hex(proof.bytes()),
      '0303000000000000000000000000000000000000000000000000000000000007529cbedbda2bdd25fd6455551e55245fa6dc11a9d0c27dc0cd38fca44c17e40344ad686a18ba78b502c0b6f285c5c8393bde2f7a3e2abe586515e4d84533e3037b062539bde2d80749746986cf8f0001fd2cdbf9a89fcbf981a769daef49df0604000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' //nolint:lll
    );

    // non-existence proof, node aux
    proof = (await mt.generateProof(bigInt(10), ZERO_HASH)).proof;
    expect(proof.existence).to.be.false;
    expect(proof.nodeAux).to.be.not.undefined;
    expect(await verifyProof(mt.root, proof, bigInt(10), bigInt(0))).to.be.true;
    expect(
      bytes2Hex(proof.bytes()),
      '0303000000000000000000000000000000000000000000000000000000000007529cbedbda2bdd25fd6455551e55245fa6dc11a9d0c27dc0cd38fca44c17e40344ad686a18ba78b502c0b6f285c5c8393bde2f7a3e2abe586515e4d84533e3037b062539bde2d80749746986cf8f0001fd2cdbf9a89fcbf981a769daef49df0604000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000' //nolint:lll
    );
  }).timeout(TIMEOUT_MIN * 5);

  it('test and verify proof false', async () => {
    const sto = getInMemoryDB();
    const mt = new Merkletree(sto, true, 140);

    for (let i = 0; i < 8; i += 1) {
      await mt.add(bigInt(i), bigInt(0));
    }
    // Invalid existence proof (node used for verification doesn't
    // correspond to node in the proof)
    let { proof } = await mt.generateProof(bigInt(4), ZERO_HASH);
    expect(proof.existence).to.be.true;
    expect(await verifyProof(mt.root, proof, bigInt(5), bigInt(5))).to.be.false;

    // Invalid non-existence proof (Non-existence proof, diff. node aux)
    proof = (await mt.generateProof(bigInt(4), ZERO_HASH)).proof;
    expect(proof.existence).to.be.true;
    proof.existence = false;
    proof.nodeAux = {
      key: newHashFromBigInt(bigInt(4)),
      value: newHashFromBigInt(bigInt(4))
    };

    expect(await verifyProof(mt.root, proof, bigInt(4), bigInt(0))).to.be.false;
  }).timeout(TIMEOUT_MIN * 5);

  it('test delete', async () => {
    const sto = getInMemoryDB();
    const mt = new Merkletree(sto, true, 10);
    expect(mt.root.String()).to.be.equal('0');

    await mt.add(bigInt(1), bigInt(2));
    expect(mt.root.String()).to.be.equal(
      '13578938674299138072471463694055224830892726234048532520316387704878000008795'
    );

    await mt.add(bigInt(33), bigInt(44));
    expect(mt.root.String()).to.be.equal(
      '5412393676474193513566895793055462193090331607895808993925969873307089394741'
    );

    await mt.add(bigInt(1234), bigInt(9876));
    expect(mt.root.String()).to.be.equal(
      '14204494359367183802864593755198662203838502594566452929175967972147978322084'
    );

    await mt.delete(bigInt(33));
    expect(mt.root.String()).to.be.equal(
      '15550352095346187559699212771793131433118240951738528922418613687814377955591'
    );

    await mt.delete(bigInt(1234));
    await mt.delete(bigInt(1));

    expect(mt.root.String()).to.be.equal('0');
    expect(mt.root.String()).to.be.equal(sto.getRoot().String());
  }).timeout(TIMEOUT_MIN * 5);

  it('test delete 2', async () => {
    const sto1 = getInMemoryDB();
    const sto2 = getInMemoryDB();
    const mt1 = new Merkletree(sto1, true, 140);
    const mt2 = new Merkletree(sto2, true, 140);

    for (let i = 0; i < 8; i += 1) {
      const k = bigInt(i);
      const v = bigInt(0);
      await mt1.add(k, v);
    }

    const expectedRootStr = mt1.root.String();

    const k = bigInt(8);
    const v = bigInt(0);

    await mt1.add(k, v);
    await mt1.delete(k);

    expect(expectedRootStr).to.be.equal(mt1.root.String());

    for (let i = 0; i < 8; i += 1) {
      const k = bigInt(i);
      const v = bigInt(0);
      await mt2.add(k, v);
    }

    expect(mt1.root.String()).to.be.equal(mt2.root.String());
  }).timeout(TIMEOUT_MIN * 5);

  it('test delete 3', async () => {
    const sto1 = getInMemoryDB();
    const sto2 = getInMemoryDB();
    const mt1 = new Merkletree(sto1, true, 140);
    const mt2 = new Merkletree(sto2, true, 140);

    await mt1.add(bigInt(1), bigInt(1));
    await mt1.add(bigInt(2), bigInt(2));

    expect(mt1.root.String()).to.be.equal(
      '19060075022714027595905950662613111880864833370144986660188929919683258088314'
    );

    await mt1.delete(bigInt(1));

    expect(mt1.root.String()).to.be.equal(
      '849831128489032619062850458217693666094013083866167024127442191257793527951'
    );

    await mt2.add(bigInt(2), bigInt(2));
    expect(mt1.root.String()).to.be.equal(mt2.root.String());
  }).timeout(TIMEOUT_MIN * 5);

  it('test delete 4', async () => {
    const sto1 = getInMemoryDB();
    const sto2 = getInMemoryDB();
    const mt1 = new Merkletree(sto1, true, 140);
    const mt2 = new Merkletree(sto2, true, 140);

    await mt1.add(bigInt(1), bigInt(1));
    await mt1.add(bigInt(2), bigInt(2));
    await mt1.add(bigInt(3), bigInt(3));

    expect(mt1.root.String()).to.be.equal(
      '14109632483797541575275728657193822866549917334388996328141438956557066918117'
    );

    await mt1.delete(bigInt(1));

    expect(mt1.root.String()).to.be.equal(
      '159935162486187606489815340465698714590556679404589449576549073038844694972'
    );

    await mt2.add(bigInt(2), bigInt(2));
    await mt2.add(bigInt(3), bigInt(3));
    expect(mt1.root.String()).to.be.equal(mt2.root.String());
  }).timeout(TIMEOUT_MIN * 5);

  it('test delete 5', async () => {
    const sto1 = getInMemoryDB();
    const sto2 = getInMemoryDB();
    const mt1 = new Merkletree(sto1, true, 140);
    const mt2 = new Merkletree(sto2, true, 140);

    await mt1.add(bigInt(1), bigInt(2));
    await mt1.add(bigInt(33), bigInt(44));

    expect(mt1.root.String()).to.be.equal(
      '5412393676474193513566895793055462193090331607895808993925969873307089394741'
    );

    await mt1.delete(bigInt(1));

    expect(mt1.root.String()).to.be.equal(
      '18869260084287237667925661423624848342947598951870765316380602291081195309822'
    );

    await mt2.add(bigInt(33), bigInt(44));
    expect(mt1.root.String()).to.be.equal(mt2.root.String());
  }).timeout(TIMEOUT_MIN * 5);

  it('test delete not existing keys', async () => {
    const sto = getInMemoryDB();
    const mt = new Merkletree(sto, true, 10);

    await mt.add(bigInt(1), bigInt(2));
    await mt.add(bigInt(33), bigInt(44));

    await mt.delete(bigInt(33));

    try {
      await mt.delete(bigInt(33));
    } catch (err) {
      expect(err).to.be.equal(ErrKeyNotFound);
    }

    await mt.delete(bigInt(1));
    expect(mt.root.String()).to.be.equal('0');

    try {
      await mt.delete(bigInt(33));
    } catch (err) {
      expect(err).to.be.equal(ErrKeyNotFound);
    }
  }).timeout(TIMEOUT_MIN * 5);

  it('test dump leafs and import leafs', async () => {
    const sto1 = getInMemoryDB();
    const sto2 = getInMemoryDB();
    const mt1 = new Merkletree(sto1, true, 140);
    const mt2 = new Merkletree(sto2, true, 140);

    for (let i = 0; i < 10; i += 1) {
      let k = MAX_NUM_IN_FIELD.subtract(i);
      const v = bigInt(0);
      await mt1.add(k, v);

      k = bigInt(i);
      await mt1.add(k, v);
    }
  }).timeout(TIMEOUT_MIN * 5);

  it('test add and get circom proof', async () => {
    const sto = getInMemoryDB();
    const mt = new Merkletree(sto, true, 10);

    expect(mt.root.String()).to.be.equal('0');

    let cp = await mt.addAndGetCircomProof(bigInt(1), bigInt(2));

    expect(cp.oldRoot.String()).to.be.equal('0');
    expect(cp.newRoot.String()).to.be.equal(
      '13578938674299138072471463694055224830892726234048532520316387704878000008795'
    );
    expect(cp.oldKey.String()).to.be.equal('0');
    expect(cp.oldValue.String()).to.be.equal('0');
    expect(cp.newKey.String()).to.be.equal('1');
    expect(cp.newValue.String()).to.be.equal('2');
    expect(cp.isOld0).to.be.true;
    cp.siblings.forEach((s) => {
      expect(s.String()).to.be.equal('0');
    });
    expect(mt.maxLevels + 1).equal(cp.siblings.length);

    cp = await mt.addAndGetCircomProof(bigInt(33), bigInt(44));

    expect(cp.oldRoot.String()).to.be.equal(
      '13578938674299138072471463694055224830892726234048532520316387704878000008795'
    );
    expect(cp.newRoot.String()).to.be.equal(
      '5412393676474193513566895793055462193090331607895808993925969873307089394741'
    );
    expect(cp.oldKey.String()).to.be.equal('1');
    expect(cp.oldValue.String()).to.be.equal('2');
    expect(cp.newKey.String()).to.be.equal('33');
    expect(cp.newValue.String()).to.be.equal('44');
    expect(cp.isOld0).to.be.false;
    cp.siblings.forEach((s) => {
      expect(s.String()).to.be.equal('0');
    });
    expect(mt.maxLevels + 1).equal(cp.siblings.length);

    cp = await mt.addAndGetCircomProof(bigInt(55), bigInt(66));

    expect(cp.oldRoot.String()).to.be.equal(
      '5412393676474193513566895793055462193090331607895808993925969873307089394741'
    );
    expect(cp.newRoot.String()).to.be.equal(
      '5094364082618099436543535513148866130251600642297988457797401489780171282025'
    );
    expect(cp.oldKey.String()).to.be.equal('0');
    expect(cp.oldValue.String()).to.be.equal('0');
    expect(cp.newKey.String()).to.be.equal('55');
    expect(cp.newValue.String()).to.be.equal('66');
    expect(cp.isOld0).to.be.true;
    cp.siblings.forEach((s, idx) => {
      expect(s.String()).to.be.equal(
        idx === 1
          ? '21312042436525850949775663177240566532157857119003189090405819719191539342280'
          : '0'
      );
    });
    expect(mt.maxLevels + 1).equal(cp.siblings.length);
  }).timeout(TIMEOUT_MIN * 5);

  it('test update circom processor proof', async () => {
    const sto = getInMemoryDB();
    const mt = new Merkletree(sto, true, 10);

    for (let i = 0; i < 16; i += 1) {
      const k = bigInt(i);
      const v = bigInt(i * 2);
      await mt.add(k, v);
    }

    const { value } = await mt.get(bigInt(10));
    expect(value.toString(10)).to.be.equal('20');

    const cp = await mt.update(bigInt(10), bigInt(1024));
    expect(cp.oldRoot.String()).to.equal(
      '3901088098157312895771168508102875327412498476307103941861116446804059788045'
    );
    expect(cp.newRoot.String()).to.equal(
      '18587862578201383535363956627488622136678432340275446723812600963773389007517'
    );
    expect(cp.oldKey.String()).to.equal('10');
    expect(cp.oldValue.String()).to.equal('20');
    expect(cp.newKey.String()).to.equal('10');
    expect(cp.newValue.String()).to.equal('1024');
    expect(cp.isOld0).to.be.false;
    expect(cp.siblings[0].String()).to.equal(
      '3493055760199345983787399479799897884337329583575225430469748865784580035592'
    );
    expect(cp.siblings[1].String()).to.equal(
      '20201609720365205433999360001442791710365537253733030676534981802168302054263'
    );
    expect(cp.siblings[2].String()).to.equal(
      '18790542149740435554763618183910097219145811410462734411095932062387939731734'
    );
    expect(cp.siblings[3].String()).to.equal(
      '15930030482599007570177067416534114035267479078907080052418814162004846408322'
    );
    cp.siblings.slice(4).forEach((s) => {
      expect(s.String()).to.be.equal('0');
    });
  }).timeout(TIMEOUT_MIN * 5);

  it('test smt verifier', async () => {
    const sto = getInMemoryDB();
    const mt = new Merkletree(sto, true, 4);

    await mt.add(bigInt(1), bigInt(11));
    let cvp = await mt.generateSCVerifierProof(bigInt(1), ZERO_HASH);

    expect(cvp.root.String()).to.be.equal(
      '6525056641794203554583616941316772618766382307684970171204065038799368146416'
    );
    expect(cvp.siblings.length).to.be.equal(0);
    expect(cvp.oldKey.String()).to.be.equal('0');
    expect(cvp.oldValue.String()).to.be.equal('0');
    expect(cvp.isOld0).to.be.false;
    expect(cvp.key.String()).to.be.equal('1');
    expect(cvp.value.String()).to.be.equal('11');
    expect(cvp.fnc).to.be.equal(0);

    await mt.add(bigInt(2), bigInt(22));
    await mt.add(bigInt(3), bigInt(33));
    await mt.add(bigInt(4), bigInt(44));

    cvp = await mt.generateCircomVerifierProof(bigInt(2), ZERO_HASH);

    expect(cvp.root.String()).to.be.equal(
      '13558168455220559042747853958949063046226645447188878859760119761585093422436'
    );
    expect(cvp.siblings.length).to.be.equal(5);
    expect(cvp.siblings[0].String()).to.be.equal(
      '11620130507635441932056895853942898236773847390796721536119314875877874016518'
    );
    expect(cvp.siblings[1].String()).to.be.equal(
      '5158240518874928563648144881543092238925265313977134167935552944620041388700'
    );
    cvp.siblings.slice(3).forEach((s) => {
      expect(s.String()).to.equal('0');
    });
    expect(cvp.oldKey.String()).to.be.equal('0');
    expect(cvp.oldValue.String()).to.be.equal('0');
    expect(cvp.isOld0).to.be.false;
    expect(cvp.key.String()).to.be.equal('2');
    expect(cvp.value.String()).to.be.equal('22');
    expect(cvp.fnc).to.be.equal(0);
  }).timeout(TIMEOUT_MIN * 5);
});
