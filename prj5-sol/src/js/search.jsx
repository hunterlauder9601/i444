import React from 'react';

import { doFetchJson } from './utils.mjs';

export default function Search(props) {
  const {wsUrl,  queryParam, resultTag, label='Search'} = props;

  return 'TODO';
}

// TODO: define sub-components here + other misc functions

/*************************** Utility Functions *************************/


/** Given a `links[]` array returned by web services, return the `href`
 *  for `rel`; '' if none.
 */
function getLink(links, rel) {
  return links?.find(lnk => lnk.rel === rel)?.href ?? '';
}

/** Given a baseUrl, return the URL equivalent to
 *  `${baseUrl}?${name}=${value}`, but with all appropriate escaping.
 */
function queryUrl(baseUrl, name, value) {
  const url = new URL(baseUrl);
  url.searchParams.set(name, value);
  return url.href;
}
