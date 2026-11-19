'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

function setup(preferences = {}) {
  const registered = {};
  const settings = [];
  const events = {};
  const node = (tag) => ({
    tagName: tag, className: '', textContent: '', children: [],
    classList: { add() {}, contains() { return false; } },
    appendChild(element) { this.children.push(element); },
    addEventListener() {}, getAttribute() { return null; },
    getBoundingClientRect() { return { top: 0, bottom: 50 }; }
  });
  const $ = value => ({
    0: typeof value === 'object' ? value : node('div'),
    length: 1, on() { return this; }, prepend() { return this; },
    first() { return this; },
    find() { return { length: 0, first() { return this; } }; }
  });
  const root = {
    setTimeout() { return 1; }, clearTimeout() {}, $,
    document: {
      getElementById() { return null; }, createElement: node,
      createDocumentFragment() { return node('fragment'); }, head: node('head')
    },
    Lampa: {
      Storage: {
        get(key, fallback) {
          return Object.prototype.hasOwnProperty.call(preferences, key)
            ? preferences[key] : fallback;
        },
        field() { return 'inner'; }
      },
      Component: { add(name, fn) { registered[name] = fn; } },
      Scroll: function Scroll() {
        return { render() { return $(node('scroll')); }, append() {}, clear() {}, destroy() {} };
      },
      Activity: { push() {} },
      SettingsApi: {
        addComponent(value) { settings.push(value); },
        addParam(value) { settings.push(value); }
      },
      Listener: { follow(event, callback) { events[event] = callback; } }
    }
  };
  root.window = root;
  const code = fs.readFileSync(path.join(__dirname, '..', 'capsule-online-next.js'), 'utf8');
  vm.runInNewContext(code, root, { timeout: 1000, filename: 'capsule-online-next.js' });
  return { root, debug: root.__capsuleOnlineNextDebug, registered, settings, events };
}

test('boot registers a standalone component and settings once', () => {
  const { registered, settings, events } = setup();
  assert.equal(typeof registered.capsule_online_next, 'function');
  assert.ok(settings.length > 10);
  const before = settings.length;
  events.app({ type: 'ready' });
  assert.equal(settings.length, before);
});

test('TV media classification wins over noisy season metadata', () => {
  const { debug } = setup();
  assert.equal(debug.isSeries({ media_type: 'tv' }), true);
  assert.equal(debug.isSeries({ media_type: 'movie', number_of_seasons: 5 }), false);
});

test('VIBIX is never collapsed into Filmix, even if balancer alias says filmix', () => {
  const { debug } = setup();
  assert.equal(debug.family({ balanser: 'filmix', name: 'Vibix' }), 'vibix');
  assert.equal(debug.family({ balanser: 'fxapi', name: 'Filmix' }), 'filmix');
});

test('HDRezka and Mir Kino Z aliases are recognized', () => {
  const { debug } = setup();
  assert.equal(debug.family({ balanser: 'rezka', name: 'HDRezka' }), 'hdrezka');
  assert.equal(debug.family({ balanser: 'mirkinoz', name: 'Мир кино Z' }), 'mirkinoz');
});

test('catalog deduplicates aliases but keeps separate providers', () => {
  const { debug } = setup({ capsule_next_source_kodik: false });
  const rows = [
    { balanser: 'alloha', url: 'https://example.org/1', show: true },
    { balanser: 'filmix', name: 'Vibix', url: 'https://example.org/2', show: true },
    { balanser: 'vibix', url: 'https://example.org/3', show: true },
    { balanser: 'filmix', name: 'Filmix', url: 'https://example.org/4', show: true },
    { balanser: 'kodik', url: 'https://example.org/5', show: true }
  ];
  const automatic = debug.sortCatalog(rows, true, false);
  assert.equal(automatic[0].key, 'alloha');
  assert.equal(automatic.filter(x => x.key === 'vibix').length, 1);
  assert.equal(automatic.filter(x => x.key === 'filmix').length, 1);
  assert.equal(automatic.find(x => x.key === 'vibix').aliases.length, 2);
  assert.ok(!automatic.some(x => x.key === 'kodik'));
  assert.ok(debug.sortCatalog(rows, true, true).some(x => x.key === 'kodik'));
});

test('rejects unsafe catalog URLs rather than treating them as source links', () => {
  const { debug } = setup();
  assert.equal(debug.sortCatalog([{ balanser: 'alloha', url: 'javascript:alert(1)' }], true, false).length, 0);
  assert.equal(debug.sortCatalog([{ balanser: 'alloha', url: '//evil.tld' }], true, false).length, 0);
});

test('known resolution strings are deterministic', () => {
  const { debug } = setup();
  assert.equal(debug.resolution('2160p 4K'), 2160);
  assert.equal(debug.resolution('Full HD'), 1080);
  assert.equal(debug.resolution('HD'), 720);
});

test('voice score ranks preferred translations and rejects ad-labelled options', () => {
  const { debug } = setup();
  assert.ok(debug.voiceRank('РХС') > debug.voiceRank('Дублированный'));
  assert.ok(debug.voiceRank('1XBET') < 0);
});

test('kids mode rejects coarse adult-labelled options', () => {
  const { debug } = setup({ capsule_next_kids: true });
  assert.ok(debug.voiceRank('Кубик в Кубе') < 0);
  assert.ok(debug.voiceRank('Rezka 18+') < 0);
  assert.ok(debug.voiceRank('Дублированный') > 0);
});

test('legacy source preferences are respected', () => {
  const { debug } = setup({ capsule_skaz_online_source_alloha: false });
  assert.equal(debug.sortCatalog([{ balanser: 'alloha', url: 'https://example.org/1' }], true, false).length, 0);
});

test('series source with verified seasons outranks one with fewer', () => {
  const { debug } = setup();
  assert.ok(
    debug.scoreSource({ key: 'vibix', seasonCount: 10 }, true, ['alloha', 'vibix']) >
    debug.scoreSource({ key: 'alloha', seasonCount: 1 }, true, ['alloha', 'vibix'])
  );
});

test('season folders parse in any listing order', () => {
  const { debug } = setup();
  assert.equal(debug.seasonNumber({ text: 'Сезон 13' }), 13);
  assert.equal(debug.seasonNumber({ text: 'Season 2' }), 2);
});

test('menu parser fails closed if DOMParser is unavailable', () => {
  const { debug } = setup();
  assert.equal(debug.parseMenu('<script>alert(1)</script>').playable.length, 0);
});

test('menu parser only reads JSON data attributes, not embedded scripts', () => {
  const { root, debug } = setup();
  let evaluated = false;
  root.DOMParser = function () {
    this.parseFromString = () => ({
      querySelectorAll() {
        return [{
          textContent: 'Серия 1',
          getAttribute(name) {
            if (name === 'data-json') return JSON.stringify({
              method: 'call', url: '/bnsi/movies/123',
              voice_name: 'Дублированный'
            });
            if (name === 's' || name === 'e') return '1';
            return null;
          },
          classList: { contains(className) { return className === 'videos__item'; } }
        }];
      }
    });
  };
  const actual = debug.parseMenu('<script>evaluated=true</script>');
  assert.equal(actual.playable.length, 1);
  assert.equal(actual.playable[0].episode, 1);
  assert.ok(actual.playable[0].url.startsWith('http://online3.skaz.tv/'));
  assert.equal(evaluated, false);
});
