import { doFetchJson } from './util.mjs';

/** Has the following attributes:
 *  
 *  'ws-url':        The basic search URL (required).
 *  'query-param':   The name of the parameter appended to ws-url to specify
 *                   the search term (required).
 *  'result-widget': The name of the element used for displaying
 *                   each individual search result (required).
 *  'label':         The label for the search widget (optional).
 */
class SearchWidget extends HTMLElement {
  constructor() {
    super();
    const shadow = this.shadow = this.attachShadow({mode: "closed"});
    let template = document.querySelector('#search-widget');
    shadow.appendChild(template.content.cloneNode(true));
  }

  connectedCallback() {
    this.wsUrl = this.getAttribute('ws-url');
    if(this.wsUrl === null || this.wsUrl === "") {
      console.log("error: missing ws-url attribute");
    }
    this.queryParam = this.getAttribute('query-param');
    if(this.queryParam === null || this.queryParam === "") {
      console.log("error: missing queryParam attribute");
    }
    this.resultWidget = this.getAttribute('result-widget');
    if(this.resultWidget === null || this.resultWidget === "") {
      console.log("error: missing resultWidget attribute");
    }
    this.label = this.getAttribute('label');
    if(this.resultWidget !== null && this.resultWidget !== "") {
      const labelElem = this.shadow.querySelector('slot[name="label"]');
      labelElem.textContent = this.label;
    }

    this.shadow.querySelector('input#search').addEventListener('input', (ev) => {
      console.log(ev.target.value);
    })

  }

  //TODO: add private methods  
}

customElements.define('search-widget', SearchWidget);
