import assert from 'assert';

import { namePrefixes } from './utils.mjs';
import { okResult, errResult } from 'cs544-js-utils';
import { MongoClient } from 'mongodb';

/** return a contacts dao for mongo URL dbUrl.  If there is previous contacts
 *  data at dbUrl, the returned dao should encompass that data.
 *  Error Codes:
 *    DB: a database error was encountered.
 */
export default async function makeContactsDao(dbUrl) {
  return ContactsDao.make(dbUrl);
}

const DEFAULT_COUNT = 5;
const NEXT_ID_KEY = 'count';
const RAND_LEN = 2;

/** holds the contacts for multiple users. All request methods
 *  should assume that their single parameter has been validated
 *  with all non-db validations.
 *  For all requests except create(), unknown request properties are ignored.
 *  For create(), the unknown request properties are stored.
 */
class ContactsDao {
  constructor(params) {
    Object.assign(this, params);
  }

    // Returns a unique, difficult to guess id.
  async #nextId() {
    const query = { _id: NEXT_ID_KEY };
    const update = { $inc: { [NEXT_ID_KEY]: 1 } };
    const options = { upsert: true, returnDocument: 'after' };
    const ret =
      await this.id_gen.findOneAndUpdate(query, update, options);
    const seq = ret.value[NEXT_ID_KEY];
    return String(seq)
      + Math.random().toFixed(RAND_LEN).replace(/^0\./, '_');
  }

  /** Factory method to create a new instance of this 
   *  Error Codes: 
   *    DB: a database error was encountered.
   */
  static async make(dbUrl) {
    const params = {};
    try {
      params._client = await (new MongoClient(dbUrl)).connect();
      const db = params._client.db();
      const collections = await (db.listCollections().toArray());
      const exists = !!collections.find(c => c.name === "USER-CONTACT");
      const options = {collation: {locale: 'en', strength: 2, }};
      let col;
      if(!exists) {
        col = await db.createCollection("USER-CONTACT", options);
      } else {
        col = db.collection("USER-CONTACT");
      }
      const ID_exists = !!collections.find(c => c.name === "ID_GEN_COLL");
      let col2;
      if(!ID_exists) {
        col2 = await db.createCollection("ID_GEN_COLL", options);
      } else {
        col2 = db.collection("ID_GEN_COLL");
      }
      await col.createIndex({id: 1});
      params.collection = col;
      params.id_gen = col2;
      return okResult(new ContactsDao(params));
    }
    catch (error) {
      console.error(error);
      return errResult(error.message, { code: 'DB' });
    }
  }


  /** close off this DAO; implementing object is invalid after 
   *  call to close() 
   *
   *  Error Codes: 
   *    DB: a database error was encountered.
   */
  async close() { 
    //TODO any setup code
    try {
      await this._client.close();
    }
    catch (e) {
      console.error(e);
      return errResult(e.message, { code: 'DB' });
    }
  }


  /** clear out all contacts for all users; returns number of contacts
   *  cleared out. 
   *  Error Codes:
   *    DB: a database error occurred
   */
  async clearAll() {
    //TODO any setup code
    try {
      const num = await this.collection.countDocuments();
      await this.collection.deleteMany({});
      await this.id_gen.deleteMany({});
      return okResult(num);
    }
    catch (error) {
      console.error(error);
      return errResult(error.message, { code: 'DB' });
    }
  }
  
  /** Clear out all contacts for user userId; return # of contacts cleared.
   *  Error Codes:
   *    DB: a database error occurred
   */
  async clear({userId}) {
    //TODO any setup code
    try {
      const num = await this.collection.countDocuments({userId: userId});
      await this.collection.deleteMany({userId: userId});
      return okResult(num);
    }
    catch (error) {
      console.error(error);
      return errResult(error.message, { code: 'DB' });
    }
  }

  /** Add object contact into this as a contact for user userId and
   *  return Result<contactId> where contactId is the ID for the newly
   *  added contact.  The contact will have a name field which must
   *  contain at least one word containing at least one letter.
   *
   *  Unknown properties in contact are also stored in the database.
   *
   *  Errors Codes: 
   *    BAD_REQ: contact contains an _id property
   *    DB: a database error occurred   
   */
  async create(contact) {
    try {
      const collection = this.collection;
      if(contact.hasOwnProperty('_id')) {
        return errResult("contact contains an _id property", {code: 'BAD_REQ'});
      }
      const prefixes = namePrefixes(contact.name);
      if(prefixes.length === 0) {
        return errResult("contact name does not have a prefix-able name", {code: 'BAD_REQ'});
      }
      const {emails} = contact;
      const pair_Id = await this.#nextId();
      const dbObj = { id: pair_Id, prefixes: prefixes, ...contact };
      if(emails !== undefined && emails.length !== 0) {
        for(let i of emails) {
          i = i.toLowerCase();
        }
        dbObj.emails = emails;
      }
      await collection.insertOne(dbObj);
      return okResult(pair_Id);
    }
    catch (error) {
      console.error(error);
      return errResult(error.message, { code: 'DB' });
    }
  }
  

  /** Return XContact for contactId for user userId.
   *  Error Codes:
   *    DB: a database error occurred   
   *    NOT_FOUND: no contact for contactId id
   */
  async read({userId, id}) {
    //TODO any setup code
    try {
      const collection = this.collection;
      const result = await collection.findOne({id: id, userId: userId});
      if(result !== null) {
        delete result._id;
        delete result.prefixes;
        return okResult(result);
      } else {
        return errResult("no contact for contactId id given the userId", { code: 'NOT_FOUND' });
      }
    }
    catch (error) {
      console.error(error);
      return errResult(error.message, { code: 'DB' });
    }
  }

  /** perform a case-insensitive search for contact for user specified
   *  by userId using zero or more of the following fields in params:
   *    id:     the contact ID.
   *    prefix: a string, the letters of which must match 
   *            the prefix of a word in the contacts name field
   *    email:  an Email address
   *  If no params are specified, then all contacts for userId are returned.
   *  The returned XContact's are sorted by name (case-insensitive).
   *  The ordering of two contacts having the same name is unspecified.
   *  
   *  The results are sliced from startIndex (default 0) to 
   *  startIndex + count (default 5).
   *  Error Codes:
   *    DB: a database error occurred   
   */
  async search({userId, id, prefix, email, index=0, count=DEFAULT_COUNT}={}) {
    try {
      const collection = this.collection;
      if(id === undefined && prefix === undefined && email === undefined) {
        const cursor = await collection.find({userId: userId}).project({_id: 0, prefixes: 0});
        const results = await cursor.sort({name: 1}).toArray();
        return okResult(results.slice(index, index+count));
        
      } else if(id !== undefined && prefix !== undefined && email === undefined) {
        const cursor = await collection.find({userId: userId, id: id, prefixes: {$in: [prefix.toLowerCase()]}}).project({_id: 0, prefixes: 0});
        const results = await cursor.sort({name: 1}).toArray();
        return okResult(results.slice(index, index+count));
        
      } else if(id === undefined && prefix !== undefined && email !== undefined) {
        const cursor = await collection.find({userId: userId, emails: {$in: [email.toLowerCase()]}, prefixes: {$in: [prefix.toLowerCase()]}}).project({_id: 0, prefixes: 0});
        const results = await cursor.sort({name: 1}).toArray();
        return okResult(results.slice(index, index+count));
        
      } else if(id !== undefined && prefix !== undefined && email !== undefined) {
        const cursor = await collection.find({userId: userId, id: id, emails: {$in: [email.toLowerCase()]}, prefixes: {$in: [prefix.toLowerCase()]}}).project({_id: 0, prefixes: 0});
        const results = await cursor.sort({name: 1}).toArray();
        return okResult(results.slice(index, index+count));
        
      } else if(id !== undefined && prefix === undefined && email === undefined) {
        const cursor = await collection.find({userId: userId, id: id}).project({_id: 0, prefixes: 0});
        const results = await cursor.sort({name: 1}).toArray();
        return okResult(results.slice(index, index+count));
        
      } else if(id === undefined && prefix !== undefined && email === undefined) {
        const cursor = await collection.find({userId: userId, prefixes: {$in: [prefix.toLowerCase()]}}).project({_id: 0, prefixes: 0});
        const results = await cursor.sort({name: 1}).toArray();
        return okResult(results.slice(index, index+count));
        
      } else if(id === undefined && prefix === undefined && email !== undefined) {
        const cursor = await collection.find({userId: userId, emails: {$in: [email.toLowerCase()]}}).project({_id: 0, prefixes: 0});
        const results = await cursor.sort({name: 1}).toArray();
        return okResult(results.slice(index, index+count));
      }
    }
    catch (error) {
      console.error(error);
      return errResult(error.message, { code: 'DB' });
    }
  }
  
 
  
}

//TODO: add auxiliary functions and definitions as needed
