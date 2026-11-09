import assert from 'node:assert/strict';

let navButtons = [];
let mockElements = new Map();
let bodyLocked = false;
const root = {
  _html: '',
  get innerHTML() { return this._html; },
  set innerHTML(value) {
    this._html = value;
    mockElements = new Map();
    for (const match of value.matchAll(/id="([^"]+)"/g)) {
      mockElements.set(match[1], { id: match[1], handlers: {}, value: '', hidden: match[1] === 'settings-overlay', addEventListener(event, handler) { this.handlers[event] = handler; } });
    }
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
  body: { classList: {
    add(name) { if (name === 'settings-open') bodyLocked = true; },
    remove(name) { if (name === 'settings-open') bodyLocked = false; },
  } },
  getElementById(id) {
    if (id === 'app') return root;
    return mockElements.get(id) || null;
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
assert.ok(root.innerHTML.includes('class="lord-header"'), 'Lord Protector profile header is rendered');
assert.ok(root.innerHTML.includes('id="settings-overlay"'), 'settings modal is rendered');
assert.ok(root.innerHTML.includes('id="setting-avatar-warden"'), 'avatar selector is rendered');
assert.ok(root.innerHTML.includes('EU S-629'), 'server badge is rendered');
assert.ok(root.innerHTML.includes('id="btn-reset-account"'), 'account reset is available in settings');
assert.ok(root.innerHTML.includes('id="btn-reset-plan-top"'), 'plan reset is available in settings');
assert.equal(isLightTheme, false, 'dark theme is applied on startup');
const openSettingsButton = mockElements.get('btn-open-settings');
assert.equal(typeof openSettingsButton.handlers.click, 'function', 'avatar opens settings');
openSettingsButton.handlers.click();
assert.equal(mockElements.get('settings-overlay').hidden, false, 'settings modal opens');
assert.equal(bodyLocked, true, 'background scrolling locks while settings are open');
mockElements.get('btn-close-settings').handlers.click();
assert.equal(mockElements.get('settings-overlay').hidden, true, 'settings modal closes');
assert.equal(bodyLocked, false, 'background scrolling unlocks after close');
console.log(`PASS app render smoke: ${expectedTabs.length} tabs + theme toggle`);
