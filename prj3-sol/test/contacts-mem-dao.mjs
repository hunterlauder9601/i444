import { makeContactsDao } from 'contacts-dao';

import { MongoMemoryServer } from 'mongodb-memory-server';

import { assert } from 'chai';

export default class {

  static async setup() {
    const mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();
    assert(mongod.instanceInfo, `mongo memory server startup failed`);
    const daoResult = await makeContactsDao(uri);
    if (daoResult.errors) throw daoResult;
    const dao = daoResult.val;
    dao._mongod = mongod;
    return dao;
  }

  static async tearDown(dao) {
    await dao.close();
    await dao._mongod.stop();
    assert.equal(dao._mongod.instanceInfo, undefined,
		 `mongo memory server stop failed`);
  }

}
