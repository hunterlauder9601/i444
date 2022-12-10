import React, {useState, useEffect, useRef} from 'react';

import { doFetchJson } from './utils.mjs';

export default function Search(props) {
  const {wsUrl,  queryParam, resultTag, label='Search'} = props;
  const [currentUrl, setCurrentUrl] = useState(queryUrl(wsUrl, queryParam, ''));
  const [errors, setErrors] = useState([]);
  const [results, setResults] = useState([]);
  const [nextUrl, setNextUrl] = useState('');
  const [prevUrl, setPrevUrl] = useState('');
  const [delUrl, setDelUrl] = useState('');
  const deleted = useRef(false);
  function onSearchChange(ev) {
    const url = queryUrl(wsUrl, queryParam, ev.target.value);
    setCurrentUrl(url);
  }
  function doNext() {
    setCurrentUrl(nextUrl);
  }
  function doPrev() {
    setCurrentUrl(prevUrl);
  }

  useEffect(() => {
    if(delUrl !== '' && !deleted.current) {
      doFetchJson('delete', delUrl).then(res => {
        deleted.current = true;
        if(res.errors) {
          setErrors(prev => [...prev, res.errors[0].message]);
        } else {
          doFetchJson('get', currentUrl).then(e => {
            if(e.val) {
              setPrevUrl(getLink(e.val.links, 'prev'));
              setNextUrl(getLink(e.val.links, 'next'));
              setResults(e.val.result);
            } else {
              setErrors(prev => [...prev, e.errors[0].message]);
            }
          });
        }
      });
    } else {
      doFetchJson('get', currentUrl).then(e => {
        if(e.val) {
          setPrevUrl(getLink(e.val.links, 'prev'));
          setNextUrl(getLink(e.val.links, 'next'));
          setResults(e.val.result);
        } else {
          setErrors(prev => [...prev, e.errors[0].message]);
        }
      });
    }
  }, [currentUrl, delUrl]);

  return (
  <div>
    <link href="search-widget.css" rel="stylesheet"/>
    <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet"/>

    <Errors errors={errors}/>
    
    <div className="search">
      <Input label={label} onSearchChange={onSearchChange}/>
      
      <Scroll prevUrl={prevUrl} nextUrl={nextUrl} doPrev={doPrev} doNext={doNext}/>

      <Results resultTag={resultTag} results={results} currentUrl={currentUrl} setDelUrl={setDelUrl} deleted={deleted}/>

      <Scroll prevUrl={prevUrl} nextUrl={nextUrl} doPrev={doPrev} doNext={doNext}/>

    </div>
  </div>
  );
}

// TODO: define sub-components here + other misc functions
function Delete({result, setDelUrl, deleted}) {
  function handleDelete() {
    deleted.current = false;
    setDelUrl(getLink(result.links, 'self'));
  }
  return (
    <div className="delete">
      <a href="#" onClick={handleDelete}><span className="material-icons md-48">delete</span></a>
    </div>
  );
}
function Errors({errors}) {
  let count = 0;
  const errArray = errors.map(error => <div key={'err' + count++}>{error}</div>);
  return (
    <ul id="errors" className="errors">
      {errArray}
    </ul>
  );
}
function Results({resultTag, results, currentUrl, setDelUrl, deleted}) {
  const resArray = results.map(result => <Result key={result.result.id} result={result} url={currentUrl} resultTag={resultTag} setDelUrl={setDelUrl} deleted={deleted}/>)
  return (
    <ul id="results">
        {resArray}
    </ul>
  );
}
function Result({result, url, resultTag, setDelUrl, deleted}) {
  const domElem = useRef();
  useEffect(() => {
    const newElem = document.createElement(resultTag);
    newElem.setResult(result.result);
    domElem.current.prepend(newElem);
  }, []);
  return (
    <li className="result" ref={domElem}>
      <Delete result={result} setDelUrl={setDelUrl} deleted={deleted}/>
    </li>
  );
}
function Input({label, onSearchChange}) {
  return (
    <>
      <label htmlFor="search">{label}</label>
      <input id="search" onChange={onSearchChange}/>
    </>
  );
}
function Scroll({prevUrl, nextUrl, doPrev, doNext}) {
  if(prevUrl !== '' && nextUrl !== '') {
    return (
    <div className="scroll">
      <a onClick={doPrev} href="#" rel="prev" className="prev">
        &lt;&lt;
      </a>
      <a onClick={doNext} href="#" rel="next" className="next">
        &gt;&gt;
      </a>
    </div>
    );
  } else if(prevUrl === '' && nextUrl !== '') {
    return (
    <div className="scroll">
      <a onClick={doNext} href="#" rel="next" className="next">
        &gt;&gt;
      </a>
    </div>
    );
  } else if(prevUrl !== '' && nextUrl === '') {
    return (
    <div className="scroll">
      <a onClick={doPrev} href="#" rel="prev" className="prev">
        &lt;&lt;
      </a>
    </div>
    );
  } else {
    return <div className="scroll"></div>
  }
}

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
