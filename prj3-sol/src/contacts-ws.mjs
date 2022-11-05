import Path from 'path';

import cors from 'cors';
import express from 'express';
import STATUS from 'http-status';  //HTTP status codes
import assert from 'assert';
import bodyParser from 'body-parser';
import { okResult, errResult } from 'cs544-js-utils';

import { DEFAULT_COUNT } from './defs.mjs';

export default function serve(model, base='') {
  const app = express();
  cdThisDir();
  app.locals.model = model;
  app.locals.base = base;
  app.use(express.static('statics'));
  setupRoutes(app);
  return okResult(app);
}


/** set up mapping between URL routes and handlers */
function setupRoutes(app) {
  const base = app.locals.base;
  app.use(cors({ exposedHeaders: [ 'Location' ]}));
  app.use(bodyParser.json());
  //create contact
  app.post(`${base}/:USER_ID`, createContact(app));
  //read contact
  app.get(`${base}/:USER_ID/:CONTACT_ID`, readContact(app));
  //delete contact
  app.delete(`${base}/:USER_ID/:CONTACT_ID`, deleteContact(app));
  //update contact
  app.patch(`${base}/:USER_ID/:CONTACT_ID`, updateContact(app));
  //search contacts
  app.get(`${base}/:USER_ID`, searchContacts(app));

  if (false) { //make true to see incoming requests
    app.use((req, res, next) => {
      console.log(req.method, requestUrl(req));
      next();
    });
  }

  //TODO: add routes here

  //must be last
  app.use(do404(app));
  app.use(doErrors(app));
}

/****************************** Route Handlers *************************/

//TODO: add route handlers
// GET /contacts/USER_ID/CONTACT_ID
// Return contact with id CONTACT_ID for user having user-id USER_ID. If successful, the response will be a JSON body of the form:

//     { links: [ selfLink ],
//       result: { name, ... }
//     }
// If there is no contact having id CONTACT_ID for user USER_ID, then the response should be a 404 error.
function readContact(app) {
  return (async function(req, res) {
    try {
      const result = await app.locals.model.read({userId: req.params.USER_ID, id: req.params.CONTACT_ID});
      if (result.errors) throw result;
      res.json(addSelfLinks(req, result.val));
    }
    catch(err) {
      const mapped = mapResultErrors(err);
      res.status(mapped.status).json(mapped);
    }
  });
}


// GET /contacts/USER_ID
// A search for all transactions satisfying a query-string. The query parameters prefix and email are recognized. If no query string is specified, then all contacts for user USER_ID are returned.

// Paging of the results is controlled by the index and count query parameters.

// If there are no results, then the returned object should have its result property set to the empty list [].

// Specifically, a success response will have type:

//     { links: [ SelfLink, NextLink?, PrevLink? ],
//       result: [ { links: [ SelfLink ],
//                   result: { name, ... },
//     },
//         ],
//     }
// The NextLink should be present only if there are further results for the specified query parameters and PrevLink should be present only if there are previous results for the specified query parameters.

function searchContacts(app) {
  return (async function(req, res) {
    try {
      const q = { ...req.query };
      if (q.index === undefined) q.index = 0;
      if (q.count === undefined) q.count = DEFAULT_COUNT;
      //by getting one extra result, we ensure that we generate the
      //next link only if there are more than count remaining results
      q.count++;
      const query = {userId: req.params.USER_ID};
      const tags = {id: q.id, prefix: q.prefix, email: q.email, index: q.index, count: q.count};
      for(const prop in tags) {
        if(tags[prop] !== undefined) {
          query[prop] = tags[prop];
        }
      }
      const result = await app.locals.model.search(query);
      if (result.errors) throw result;
      res.json(addPagingLinks(req, result.val, 'id'));
    }
    catch(err) {
      const mapped = mapResultErrors(err);
      res.status(mapped.status).json(mapped);
    }
  });
}


// POST /contacts/USER_ID
// The JSON body of the request must be a contact of the form:

//     { name, ... }
// The request will create a new contact for user USER_ID. If successful, the response will be empty with status 201 CREATED. The Location header must be set to the URL for the newly created contact.


function createContact(app) {
  return (async function(req, res) {
    try {
      const contact = req.body;
      contact.userId = req.params.USER_ID;
      const result = await app.locals.model.create(contact);
      if (result.errors) throw result;
      contact.id = result.val;
      const selfLink = addSelfLinks(req, contact, 'id');
      res.set('Location', selfLink.links[0].href);
      res.status(STATUS.CREATED).end();
    }
    catch(err) {
      const mapped = mapResultErrors(err);
      res.status(mapped.status).json(mapped);
    }
  });
}


// PATCH /contacts/USER_ID/CONTACT_ID
// The JSON body of the request must contain contact fields to be updated.

// The request will update contact CONTACT_ID for user USER_ID with the fields specifed in the JSON body. If successful, the response will contain the updated contact.

// If there is no contact having id CONTACT_ID for user USER_ID, then the response should be a 404 error.
function updateContact(app) {
  return (async function(req, res) {
    try {
      const contact = await app.locals.model.read({userId: req.params.USER_ID, id: req.params.CONTACT_ID});
      if (contact.errors) throw contact;
      const {name, emails, addr, phones, notes, info} = req.body;
      const updates = {name, emails, addr, phones, notes, info};
      const newContact = {...contact.val};
      for(const prop in updates) {
        if(updates[prop] !== undefined) {
          newContact[prop] = updates[prop];
        }
      }
      const result = await app.locals.model.update(newContact);
      if (result.errors) throw result;
      res.json(addSelfLinks(req, result.val));
    }
    catch(err) {
      const mapped = mapResultErrors(err);
      res.status(mapped.status).json(mapped);
    }
  });
}



// DELETE /contacts/USER_ID/CONTACT_ID
// The request will delete contact CONTACT_ID for user USER_ID. If successful, the response will return with a NO_CONTENT HTTP status.

// If there is no contact having id CONTACT_ID for user USER_ID, then the response should be a 404 error.
function deleteContact(app) {
  return (async function(req, res) {
    try {
      const result = await app.locals.model.delete({userId: req.params.USER_ID, id: req.params.CONTACT_ID});
      if (result.errors) throw result;
      res.status(STATUS.NO_CONTENT).end();
    }
    catch(err) {
      const mapped = mapResultErrors(err);
      res.status(mapped.status).json(mapped);
    }
  });
}


/** Default handler for when there is no route for a particular method
 *  and path.
 */
function do404(app) {
  return async function(req, res) {
    const message = `${req.method} not supported for ${req.originalUrl}`;
    const result = {
      status: STATUS.NOT_FOUND,
      errors: [	{ code: 'NOT_FOUND', message, }, ],
    };
    res.status(STATUS.NOT_FOUND).json(result);
  };
}


/** Ensures a server error results in nice JSON sent back to client
 *  with details logged on console.
 */ 
function doErrors(app) {
  return async function(err, req, res, next) {
    const result = {
      status: STATUS.INTERNAL_SERVER_ERROR,
      errors: [ { code: 'SERVER_ERROR', message: err.message } ],
    };
    res.status(STATUS.INTERNAL_SERVER_ERROR).json(result);
    console.error(result.errors);
  };
}

/************************* HATEOAS Utilities ***************************/

/** Return original URL for req (excluding query params) */
function requestUrl(req) {
  const url = req.originalUrl.replace(/\/?(\?.*)?$/, '');
  return `${req.protocol}://${req.get('host')}${url}`;
}

/** Return req URL with query params appended */
function queryUrl(req, query={}) {
  const url = new URL(requestUrl(req));
  Object.entries(query).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.href;
}

/** Return object containing { result: obj, links: [{ rel: 'self',
 *  name: 'self', href }] } where href is req-url + suffix /obj[id] if
 *  id.
 */
function addSelfLinks(req, obj, id=undefined) {
  const baseUrl = requestUrl(req);
  const href = (id) ? `${baseUrl}/${obj[id]}` : baseUrl;
  const links = [ { rel: 'self', name: 'self', href } ];
  return {result: obj,  links: links };
}

/** Wrap results in paging links.  Specifically, return 
 *  { result, links: [self, next, prev] } where result
 *  is req-count prefix of results with each individual
 *  result wrapped in a self-link. self will always
 *  be present, next/prev are present if there
 *  are possibly more/earlier results.
 */
function addPagingLinks(req, results, selfId=undefined) {
  const links = [
    { rel: 'self', name: 'self', href: queryUrl(req, req.query) }
  ];
  const count = Number(req.query?.count ?? DEFAULT_COUNT);
  const nResults = results.length;  //may be 1 more than count
  const next = pagingUrl(req, nResults, +1);
  if (next) links.push({ rel: 'next', name: 'next', href: next });
  const prev = pagingUrl(req, nResults, -1);
  if (prev) links.push({ rel: 'prev', name: 'prev', href: prev });
  const results1 =
	results.slice(0, count).map(obj => addSelfLinks(req, obj, selfId));
  return { result: results1, links: links };
}

/** Return paging url (dir == +1: next; dif == -1: prev);
 *  returns null if no paging link necessary.
 *  (no prev if index == 0, no next if nResults <= count).
 */
//index and count have been validated  
function pagingUrl(req, nResults, dir) {
  const q = req.query;
  const index = Number(q?.index ?? 0);
  const count = Number(q?.count ?? DEFAULT_COUNT);
  const index1 = (index + dir*count) < 0 ? 0 : (index + dir*count);
  const query1 = Object.assign({}, q, { index: index1 });
  return ((dir > 0 && nResults <= count) || (dir < 0 && index1 === index))
         ? null
         : queryUrl(req, query1);
}

/*************************** Mapping Errors ****************************/

//map from domain errors to HTTP status codes.  If not mentioned in
//this map, an unknown error will have HTTP status BAD_REQUEST.
const ERROR_MAP = {
  EXISTS: STATUS.CONFLICT,
  NOT_FOUND: STATUS.NOT_FOUND,
  DB: STATUS.INTERNAL_SERVER_ERROR,
  INTERNAL: STATUS.INTERNAL_SERVER_ERROR,
}

/** Return first status corresponding to first option.code in
 *  appErrors, but SERVER_ERROR dominates other statuses.  Returns
 *  BAD_REQUEST if no code found.
 */
function getHttpStatus(appErrors) {
  let status = null;
  for (const appError of appErrors) {
    const errStatus = ERROR_MAP[appError.options?.code];
    if (!status) status = errStatus;
    if (errStatus === STATUS.INTERNAL_SERVER_ERROR) status = errStatus;
  }
  return status ?? STATUS.BAD_REQUEST;
}

/** Map domain/internal errors into suitable HTTP errors.  Return'd
 *  object will have a "status" property corresponding to HTTP status
 *  code.
 */
function mapResultErrors(err) {
  const errors = err.errors ||
    [ { message: err.message, options: { code: 'INTERNAL' } } ];
  const status = getHttpStatus(errors);
  if (status === STATUS.INTERNAL_SERVER_ERROR) {
    console.error(err);
  }
  return { status, errors, };
} 

/**************************** Misc Utilities ***************************/

/** return query[key] as a non-neg int; error if not */
function getNonNegInt(query, key, defaultVal) {
  const n = query[key];
  if (n === undefined) {
    return defaultVal;
  }
  else if (!/^\d+$/.test(n)) {
    const message = `${key} "${n}" must be a non-negative integer`;
    return {errors: [{ message, options: { code: 'BAD_VAL', widget: key}}]};
  }
  else {
    return Number(n);
  }
}

/** change dir to directory containing this file */
function cdThisDir() {
  try {
    const path = new URL(import.meta.url).pathname;
    const dir = Path.dirname(path);
    process.chdir(dir);
  }
  catch (err) {
    console.error(`cannot cd to this dir: ${err}`);
    process.exit(1);
  }
}

