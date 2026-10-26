import assert from 'node:assert/strict';
let installed, startup, rules = [], disabled = 0;
globalThis.chrome = {
  runtime: {
    onInstalled: {addListener: callback => installed = callback},
    onStartup: {addListener: callback => startup = callback}
  },
  action: {disable: async () => disabled++},
  declarativeContent: {
    PageStateMatcher: class {constructor(options) {Object.assign(this, options);}},
    ShowAction: class {},
    onPageChanged: {
      removeRules: (ids, done) => {rules = []; done();},
      addRules: (added, done) => {rules.push(...added); done();}
    }
  }
};
await import('../background.js');
await installed();
assert.equal(disabled, 1);
assert.equal(rules.length, 1);
const matches = value => {
  const url = new URL(value);
  return rules[0].conditions.some(({pageUrl}) =>
    pageUrl.schemes.includes(url.protocol.slice(0, -1)) && pageUrl.hostEquals === url.hostname);
};
for (const url of ['https://youtube.com/', 'https://www.youtube.com/watch?v=abc', 'https://m.youtube.com/shorts/abc']) assert(matches(url));
for (const url of ['https://example.com/', 'https://notyoutube.com/', 'https://youtube.com.example.com/', 'https://studio.youtube.com/', 'http://youtube.com/', 'chrome://extensions/']) assert(!matches(url));
await installed();
assert.equal(rules.length, 1, 'Reload must replace rather than accumulate rules');
await startup();
assert.equal(disabled, 3);
console.log('PASS: supported hosts, excluded hosts/schemes, installation, reload and startup default.');
