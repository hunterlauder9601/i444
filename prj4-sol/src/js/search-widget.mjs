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
    this.resultElem = template.content.querySelector('li.result');
    const prevButtons = shadow.querySelectorAll('slot[name="prev"]');
    const nextButtons = shadow.querySelectorAll('slot[name="next"]');
    prevButtons.forEach(b => b.addEventListener("click", this.#prev.bind(this), false));
    nextButtons.forEach(b => b.addEventListener("click", this.#next.bind(this), false));
  }

  connectedCallback() {
    this.wsUrl = this.getAttribute('ws-url');
    if(this.wsUrl === null || this.wsUrl === "") {
      console.log("error: missing ws-url attribute");
    }
    this.queryParam = this.getAttribute('query-param');
    if(this.queryParam === null || this.queryParam === "") {
      console.log("error: missing query-param attribute");
    }
    this.resultWidget = this.getAttribute('result-widget');
    if(this.resultWidget === null || this.resultWidget === "") {
      console.log("error: missing result-widget attribute");
    }
    this.label = this.getAttribute('label');
    if(this.resultWidget !== null && this.resultWidget !== "") {
      const labelElem = this.shadow.querySelector('slot[name="label"]');
      labelElem.textContent = this.label;
    }
    const initUrl = new URL(this.wsUrl);
    initUrl.searchParams.set(this.queryParam, "");
    this.currentUrl = initUrl.href;
    this.#populate(this.currentUrl);

    this.shadow.querySelector('input#search').addEventListener('input', (ev) => {
      const searchUrl = new URL(this.wsUrl);
      searchUrl.searchParams.set(this.queryParam, ev.target.value);
      this.currentUrl = searchUrl.href;
      this.#populate(this.currentUrl);
    })

  }

  #pageButtons() {
    const prevButtons = this.shadow.querySelectorAll('slot[name="prev"]');
    const nextButtons = this.shadow.querySelectorAll('slot[name="next"]');
    //const scrollers = this.shadow.querySelectorAll('div.scroll');
    if(this.prevUrl !== undefined && this.nextUrl !== undefined) {
      prevButtons.forEach(elem => elem.style.visibility = 'visible');
      nextButtons.forEach(elem => elem.style.visibility = 'visible');
    } else if(this.prevUrl === undefined && this.nextUrl !== undefined){
      prevButtons.forEach(elem => elem.style.visibility = 'hidden');
      nextButtons.forEach(elem => elem.style.visibility = 'visible');
    } else if(this.prevUrl !== undefined && this.nextUrl === undefined){
      prevButtons.forEach(elem => elem.style.visibility = 'visible');
      nextButtons.forEach(elem => elem.style.visibility = 'hidden');
    } else {
      prevButtons.forEach(elem => elem.style.visibility = 'hidden');
      nextButtons.forEach(elem => elem.style.visibility = 'hidden');
    }
  }

  #populate(url){
      doFetchJson('get', url).then(e => {
        if(e.val) {
          //console.log(e.val);
          const results = this.shadow.querySelector('#results');
          results.innerText = '';
          const errors = this.shadow.querySelector('#errors');
          errors.innerText = '';
          this.prevUrl = e.val.links.find(link => link.name === "prev");
          //console.log(this.prevUrl)
          this.nextUrl = e.val.links.find(link => link.name === "next");
          //console.log(this.nextUrl)
          this.#pageButtons();
          e.val.result.forEach(contact => {
            const clonedElem = this.resultElem.cloneNode(true);
            const newWidget = document.createElement(this.resultWidget);
            newWidget.setResult(contact.result);
            clonedElem.prepend(newWidget);
            const deleteButton = clonedElem.querySelector('div.delete a');
            //console.log(contact)
            const selfUrl = contact.links.find(link => link.name === "self").href;
            this.#addDelete(selfUrl, deleteButton);
            //console.log(deleteButton)
            results.appendChild(clonedElem);
          })
        } else {
          const errorElem = this.shadow.querySelector('#errors');
          // console.log(e)
          errorElem.append(e.errors[0].message);
        }
      })
  }
  #addDelete(selfUrl, elem) {
    elem.addEventListener("click", (event) => {
      event.preventDefault();
      doFetchJson('delete', selfUrl).then((e) => {
        if(e.errors) {
          const errorElem = this.shadow.querySelector('#errors');
          errorElem.append(e.errors[0].message);
        } else {
          this.#populate(this.currentUrl);
        }
      })
    }, false);
  }
  #prev(event) {
    //console.log(this.prevUrl)
    if(this.prevUrl !== undefined) {
      this.#populate(this.prevUrl.href);
    }
    event.preventDefault();
  }

  #next(event) {
    //console.log(this.nextUrl)
    if(this.nextUrl !== undefined) {
      this.#populate(this.nextUrl.href);
    }
    event.preventDefault();
  }

  //TODO: add private methods  
}

customElements.define('search-widget', SearchWidget);
