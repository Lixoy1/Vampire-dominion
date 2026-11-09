import assert from 'node:assert/strict';

let navButtons = [];
const root = {
  _html: '',
  get innerHTML() { return this._html; },
  set innerHTML(value) {
    this._html = value;
    navButtons = [...value.matchAll(/data-tab="([^"]+)"/g)].map((match) => ({
      dataset: { tab: match[1] },
      handlers: {},
      addEventListener(event, handler) { this.handlers[event] = handler; },
    }));
  },
};
let readyHandler = null;
let isLightTheme = false;
const themeButton = {
  handlers: {},
  addEventListener(event, handler) { this.handlers[event] = handler; },
};
const localStore = new Map();

globalThis.localStorage = {
  getItem: key => localStore.has(key) ? localStore.get(key) : null,
  setItem: (key, value) => localStore.set(key, String(value)),
  removeItem: key => localStore.delete(key),
};

globalThis.document = {
  documentElement: {
    lang: 'ru',
    classList: {
      toggle(name, enabled) {
        if (name === 'light-theme') isLightTheme = Boolean(enabled);
      },
    },
  },
  addEventListener(event, handler) {
    if (event === 'DOMContentLoaded') readyHandler = handler;
  },
  getElementById(id) {
    if (id === 'app') return root;
    if (id === 'btn-theme') return themeButton;
    return null;
  },
  querySelectorAll(selector) {
    if (selector !== '[data-tab]') return [];
    return navButtons;
  },
};

await import('../scripts/app.js');
assert.equal(typeof readyHandler, 'function', 'app registers DOMContentLoaded');
readyHandler();

const expectedTabs = ['dominance', 'conclave', 'levels', 'talents', 'auras', 'bonds', 'skins', 'summon', 'bag'];
for (const expected of expectedTabs) {
  const tabs = document.querySelectorAll('[data-tab]');
  const tab = tabs.find(item => item.dataset.tab === expected);
  assert.ok(tab, `tab ${expected} is rendered`);
  assert.equal(typeof tab.handlers.click, 'function', `tab ${expected} has a click handler`);
  tab.handlers.click();
  assert.ok(root.innerHTML.includes('assets/brand-hero.png'), `hero image remains on ${expected}`);
  assert.ok(root.innerHTML.includes('Создано с любовью при поддержке'), `credit caption remains on ${expected}`);
  assert.ok(root.innerHTML.includes('Vampire Dominion'), `application shell renders on ${expected}`);
}

assert.ok(root.innerHTML.includes('Инвентарь Сумки'), 'bag tab content rendered');
assert.ok(root.innerHTML.includes('id="btn-theme"'), 'theme toggle is rendered');
assert.equal(isLightTheme, false, 'dark theme is applied on startup');
assert.equal(typeof themeButton.handlers.click, 'function', 'theme toggle has a click handler');
themeButton.handlers.click();
assert.equal(isLightTheme, true, 'light theme activates on click');
assert.equal(JSON.parse(localStore.get('vampire_dominion_v3_state')).theme, 'light', 'theme choice is saved');
themeButton.handlers.click();
assert.equal(isLightTheme, false, 'dark theme can be restored');
console.log(`PASS app render smoke: ${expectedTabs.length} tabs + theme toggle`);
