'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { test } = require('node:test');

const source = fs.readFileSync(require('node:path').join(__dirname, '..', 'amedia-android.js'), 'utf8');
const from = source.indexOf('function _amediaInit');
const to = source.indexOf('\n\nfunction _0x22107b', from);
assert(from > 0 && to > from, 'The readable Amedia client must be present in the bundle');
const clientSource = source.slice(from, to);

function createHarness() {
    const notes = [];
    const plays = [];
    const storage = {};
    const closeCallbacks = [];
    let modal = null;
    let updateCount = 0;
    let controller = '';

    function $(html) {
        return {
            length: 1,
            0: { html },
            find(query) { return { length: 1, 0: { query } }; },
            on() { return this; },
            closest() { return this; }
        };
    }
    const document = {
        getElementById() { return null; },
        createElement() { return {}; },
        head: { appendChild() {} },
        addEventListener() {}
    };
    const listener = { follow() {} };
    const Lampa = {
        Storage: {
            get(name, fallback) {
                return Object.prototype.hasOwnProperty.call(storage, name) ? storage[name] : fallback;
            },
            set(name, value) { storage[name] = value; }
        },
        Platform: { is(name) { return name === 'android'; } },
        Noty: { show(message) { notes.push(message); } },
        Loading: { start() {}, stop() {} },
        SettingsApi: { addComponent() {}, addParam() {} },
        Listener: listener,
        Select: {
            listener,
            show() { throw new Error('The native Modal should be used'); },
            hide() {}
        },
        Controller: { toggle(name) { controller = name; } },
        Player: {
            listener,
            runas() {},
            play(data) { plays.push(data); }
        },
        Modal: {
            listener: {
                follow(type, callback) {
                    if (type === 'close') closeCallbacks.push(callback);
                }
            },
            open(options) { modal = { options, root: {} }; },
            render() { return modal ? { 0: modal.root } : null; },
            update(body) { updateCount++; modal.body = body; },
            toggle() {},
            close() {
                const previous = modal;
                modal = null;
                if (previous) closeCallbacks.forEach(callback => callback({ active: previous.options }));
            }
        }
    };
    const root = {
        Lampa,
        document,
        $,
        AndroidJS: { openPlayer() {} },
        addEventListener() {},
        console: { log() {} }
    };
    const script = new vm.Script('var _amediaClient;\n' + clientSource + '\n_amediaInit(); _amediaClient;');
    const client = script.runInNewContext({ window: root, document }, { timeout: 1500 });
    return {
        client, notes, plays, storage, Lampa,
        get modal() { return modal; },
        get updates() { return updateCount; },
        get controller() { return controller; },
        makeApi(tree, type = 'serial') {
            const selected = [];
            const requests = [];
            return {
                selected, requests,
                lookup() {
                    return Promise.resolve({
                        embed: { fileList: { type }, fileActiveId: 'movie-file' },
                        guard: { valid: true }, hP: 'mock'
                    });
                },
                tree() { return tree; },
                getVoice() { return 'original'; },
                setVoice(movie, voiceId) { selected.push(voiceId); },
                play(options) { requests.push(options); return Promise.resolve(); }
            };
        }
    };
}

function selector(kind, index) {
    return {
        length: 1,
        closest() { return this; },
        attr(key) {
            return key === 'data-amedia-kind' ? kind :
                key === 'data-amedia-index' ? String(index) : undefined;
        }
    };
}

async function flush() {
    for (let i = 0; i < 10; i++) await Promise.resolve();
}

test('multi-season series opens with first season initialized and can change season', async () => {
    const h = createHarness();
    const tree = { seasons: [
        { number: 1, episodes: [{ number: 1, translations: [
            { id: 'original', name: 'Оригинал', file_id: 'original-file' },
            { id: 'dub', name: 'Профессиональный дубляж', file_id: 'dub-file' }
        ] }] },
        { number: 2, episodes: [{ number: 1, translations: [
            { id: 'studio', name: 'LostFilm', file_id: 'studio-file' }
        ] }] }
    ] };
    const api = h.makeApi(tree);
    await h.client.open({ title: 'Тестовый сериал' }, api);
    assert(h.modal, 'The custom modal must open for multiple seasons');
    assert.equal(api.requests.length, 0, 'Opening the hub must never auto-play');
    h.modal.options.onSelect(selector('season', 1));
    assert.equal(h.updates, 1, 'Changing season must update the same modal');
    h.modal.options.onSelect(selector('episode', 0));
    await flush();
    assert.equal(api.requests.length, 1);
    assert.equal(api.requests[0].season, 2);
    assert.equal(api.requests[0].episode, 1);
    assert.equal(api.requests[0].fileId, 'studio-file');
    assert.equal(h.modal, null, 'Hub must close before playback starts');
    assert.deepEqual(h.notes, []);
});

test('a single season chooses dubbed audio over the remembered original', async () => {
    const h = createHarness();
    const api = h.makeApi({ seasons: [{ number: 1, episodes: [
        { number: 3, translations: [
            { id: 'original', name: 'Оригинал', file_id: 'raw-file' },
            { id: 'dub', name: 'Профессиональный дубляж', file_id: 'dub-file' }
        ] }
    ] }] });
    await h.client.open({ title: 'Сериал' }, api);
    assert(h.modal);
    h.modal.options.onSelect(selector('episode', 0));
    await flush();
    assert.equal(api.requests.length, 1);
    assert.equal(api.requests[0].fileId, 'dub-file');
    assert.equal(api.requests[0].episode, 3);
    assert.equal(api.selected[0], 'dub');
});

test('movie has a single Watch action with no audio selection dialog', async () => {
    const h = createHarness();
    const api = h.makeApi(null, 'movie');
    await h.client.open({ title: 'Фильм' }, api);
    assert(h.modal);
    h.modal.options.onSelect(selector('film', 0));
    await flush();
    assert.equal(api.requests.length, 1);
    assert.equal(api.requests[0].fileId, 'movie-file');
    assert.equal(h.modal, null);
});

test('back closes modal and restores content focus without launching video', async () => {
    const h = createHarness();
    const api = h.makeApi({ seasons: [{ number: 1, episodes: [
        { number: 1, translations: [{ id: 'a', name: 'Test', file_id: 'file' }] }
    ] }] });
    await h.client.open({ title: 'Сериал' }, api);
    h.modal.options.onBack();
    await flush();
    assert.equal(api.requests.length, 0);
    assert.equal(h.modal, null);
    assert.equal(h.controller, 'content');
});

test('a failed lookup does not leave an orphan modal', async () => {
    const h = createHarness();
    const api = h.makeApi(null);
    api.lookup = () => Promise.reject(new Error('mock backend failure'));
    await h.client.open({ title: 'Недоступно' }, api);
    assert.equal(h.modal, null);
    assert.equal(h.notes.length, 1);
});
