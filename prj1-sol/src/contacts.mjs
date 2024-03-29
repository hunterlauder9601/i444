// refer to ./contacts.d.ts for details of types

import { okResult, errResult } from 'cs544-js-utils';

export default function makeContacts() { return okResult(new Contacts()); }

/** holds the contacts for different users */
class Contacts {
  #contactMap = new Map();
  //TODO: add instance fields if necessary
  /** return an instance of UserContacts */
  userContacts(userId) {
    //TODO: fix to ensure same object returned for same userId
    if(this.#contactMap.size === 0) {
      let contact0 = new UserContacts(userId);
      this.#contactMap.set(userId, contact0);
      return okResult(this.#contactMap.get(userId));
    }
    else if(this.#contactMap.has(userId)) {
      return okResult(this.#contactMap.get(userId));
    } 
    else {
      let contactn = new UserContacts(userId);
      this.#contactMap.set(userId, contactn);
      return okResult(this.#contactMap.get(userId));
    }
  }
}

class Index {
  #prefixMap;
  #emailMap;

  constructor() {
    this.#prefixMap = new Map();
    this.#emailMap = new Map();
  }

  setPrefixMap(prefix, id) {
    if(this.#prefixMap.has(prefix)) {
      let set = this.#prefixMap.get(prefix);
      set.add(id);
      this.#prefixMap.set(prefix, set);
    } else {
      let newSet = new Set();
      newSet.add(id);
      this.#prefixMap.set(prefix, newSet);
    }
  }

  setEmailMap(email, id) {
    this.#emailMap.set(email, id);
  }

  getPrefixID(prefix) {
    if(this.#prefixMap.has(prefix)) {
      return this.#prefixMap.get(prefix); //returns set of IDS
    }
  }
  getEmailID(email) {
    if(this.#emailMap.has(email)) {
      return this.#emailMap.get(email); // returns single ID
    }
  }
}

/** holds the contacts for single user specified by userId */
class UserContacts {
  //TODO: add instance fields if necessary
  #count;
  #CidMap;
  #index;

  constructor(userId) {
    this.userId = userId;
    this.#count = 0;
    this.#CidMap = new Map();
    this.#index = new Index();
  }
  

  /** Add object contact into this under a new contactId and return
   *  Result<contactId>.  The contact must have a name field which
   *  must contain at least one word containing at least two letters.  
   *  The added contact should not share any structure with the contact param.
   *  Errors Codes: 
   *    BAD_REQ: contact.name is not a string which contains at least one word 
   *             with at least 2 letters.
   *             Contact.emails is present but is not an array or contains
   *             an entry which does not match /^.+?\@.+?\..+$/.
   *             Contact contains an id property
   */
  create(contact) {
    if(prefix(contact.name).length === 0 || contact.id !== undefined) {
      return errResult('BAD_REQ', {code: 'BAD_REQ'});
    }
    const reg = new RegExp(/^.+?\@.+?\..+$/);
    let ID = this.genID();
    if(contact.hasOwnProperty("emails")) {
      if(!Array.isArray(contact.emails)) {
        return errResult('BAD_REQ', {code: 'BAD_REQ'});
      }
      for(let o of contact.emails) {
        if(!reg.test(o)) {
          return errResult('BAD_REQ', {code: 'BAD_REQ'});
        } else {
          this.#index.setEmailMap(o, ID);
        }
      }
      let pArr = prefix(contact.name);
      for(let i of pArr) {
        this.#index.setPrefixMap(i, ID);
      }
    }
    this.#CidMap.set(ID, contact);
    return okResult(ID);
  }

  /** Return XContact for contactId.
   *  The returned contact should not share any structure with that
   *  stored within this.
   *  Error Codes:
   *    BAD_REQ: contactId not provided as a string
   *    NOT_FOUND: no contact for contactId
   */
  read(contactId) {
    if(typeof contactId !== 'string') {
      return errResult('BAD_REQ', {code: 'BAD_REQ'});
    } else if(this.#CidMap.has(contactId)) {
      return okResult(this.deepCopy(this.#CidMap.get(contactId)));
    } else {
      return errResult('NOT_FOUND', {code: 'NOT_FOUND'});
    }
  }

  /** search for contact by zero or more of the following fields in params:
   *    id:     the contact ID.
   *    name:   a string, the letters of which must match the prefix of a
   *            word in the contacts name field
   *    email:  an Email address
   *  If no params are specified, then all contacts are returned
   *  
   *  The results are sliced from startIndex (default 0) to 
   *  startIndex + count (default 5).
   *  Error Codes:
   *    BAD_REQ: name is specified in params but does not consist of
   *             a single word containing at least two letters
   *             email is specified in params but does not contain a
   *             a valid Email address
   */
  search({id, nameWordPrefix, email}={}, startIndex=0, count=5) {
    let nameSet = new Set();
    let emailSet = new Set();
    let singleSet = new Set();
    let finalSet = new Set();

    if(typeof nameWordPrefix === 'undefined' && typeof email === 'undefined' && typeof id === 'undefined') {
      for(let k of this.#CidMap.keys()) {
        finalSet.add(k);
      }
    }
    if(typeof nameWordPrefix !== 'undefined') {
      if(prefix(nameWordPrefix).length === 0) {
        return errResult('BAD_REQ', {code: 'BAD_REQ'});
      }
      let IDset = this.#index.getPrefixID(nameWordPrefix);
      nameSet = setUnion(IDset, nameSet);
    }
    if(typeof email !== 'undefined') {
      const reg = new RegExp(/^.+?\@.+?\..+$/);
      if(!reg.test(email)) {
        return errResult('BAD_REQ', {code: 'BAD_REQ'});
      }
      let lcEmail = email.toLowerCase();
      let ID = this.#index.getEmailID(lcEmail);
      emailSet.add(ID);
    }
    if(typeof id !== 'undefined') {
      singleSet.add(id);
    }
    let arr = [nameSet, emailSet, singleSet];
    let check = true;
    for(let o of arr) {
      if(o.size !== 0 && check) {
        check = false;
        finalSet = setUnion(finalSet, o);
      } else if(o.size !== 0) {
        finalSet = setIntersection(finalSet, o);
      }
    }
    let idArray = Array.from(finalSet).slice(startIndex, startIndex+count);
    let contactArray = [];
    let x = 0;
    for(let i of idArray) {
      contactArray[x] = this.deepCopy(this.#CidMap.get(i));
      x++;
    }
    return okResult(contactArray);
  }

  genID() {
    let rand = Math.floor(Math.random() * 100); //0-99
    return `${this.#count++}_${rand}`;
  }

  deepCopy(contact) {
    return JSON.parse(JSON.stringify(contact));
  }

  //TODO: define auxiliary methods

}


//TODO: define auxiliary functions and classes.

  function prefix(str) {
    let arr = [];
    const reg = new RegExp(/[\W_]+/g);
    let index = 0;
    for (let i = 0; i < str.length; i++) {
      if(reg.test(str.charAt(i))) {
        let newstr = str.substring(index, i);
        let st = newstr.trim();
        arr.push(st);
        index = i+1;
      } else if(i === str.length-1) {
        let newstr = str.substring(index, i+1);
        let st = newstr.trim();
        arr.push(st);
      }
    }
    let newArr = [];
    for(let o of arr) {
        if(o.length > 0) {
            let index = 2;
            while(index < o.length+1) {
                newArr.push(o.substring(0, index).toLowerCase());
                index++;
            }
        }
    }
    return newArr;
}




// non-destructive implementations of set operations which may be useful
function setIntersection(setA, setB) {
  const result = new Set()
  for (const el of setA) {
    if (setB.has(el)) result.add(el);
  }
  return result;
}

function setUnion(setA, setB) {
  const result = new Set(setA);
  for (const el of setB) result.add(el);
  return result;
}
