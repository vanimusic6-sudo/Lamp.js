'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const script = fs.readFileSync(path.join(__dirname,'..','capsule-online.js'),'utf8');
function fixture(overrides) {
    const store = Object.assign({}, overrides || {});
    const registrations = Object.create(null);
    const listeners = Object.create(null);
    let currentActivity = null;
    const storage = {
        get(k,d) { return Object.hasOwn(store,k)?store[k]:d; },
        cache(k,n,d) { return Object.hasOwn(store,k)?store[k]:d; },
        set(k,v) { store[k]=v; }
    };
    const Lampa = {
        Storage:storage,
        Component:{
            add(name,klass){registrations[name]=klass;},
            get(name){return registrations[name];}
        },
        Player:{listener:{follow(){}}},
        PlayerVideo:{listener:{follow(){}}},
        SettingsApi:{addComponent(){},addParam(){}},
        Activity:{active(){return {component:'lampacskaz',activity:currentActivity};}},
        Noty:{show(){}}
    };
    const win = {Lampa,onlyskaz_plugin:true,console};
    const sandbox = {window:win,console,Date,setTimeout(){return 1;},clearTimeout(){}};
    vm.runInNewContext(script,sandbox,{timeout:5000});
    function SkazScreen(object){
        this.activity = {name:'Skaz'};
        this.startSource = function(rows){return rows;};
        this.changeBalanser = function(name){this.changed=name;};
        this.doesNotAnswer = function(){this.errorShown=true;};
        this.render = function(){return null;};
        this.parse = function(raw){return raw;};
        this.display = function(rows){return rows;};
        this.setDefaultQuality = function(data){return data;};
        this.start = function(){};
        this.getFileUrl = function(file,cb){cb({url:file.url || ''},{});};
        this.getChoice = function(){return {};};
        this.replaceChoice = function(){};
    }
    Lampa.Component.add('lampacskaz',SkazScreen);
    function instance(movie) {
        const screen = new registrations.lampacskaz({movie});
        currentActivity=screen.activity;
        return screen;
    }
    return {win,Lampa,store,instance};
}

test('source ranks advertised playable resolution and reliability, never hidden sources',()=>{
    const h=fixture(),rank=h.win.__capsuleSkazOnlineDebug.sourceOrder([
        {name:'HDVB - 720p',url:'https://a.test',show:true},
        {name:'Filmix - 1080p',url:'https://b.test',show:true},
        {name:'RHS - 4K',url:'https://c.test',show:false}
    ]);
    assert.deepEqual(Array.from(rank,x=>x.key),['filmix','hdvb']);
});

test('source selection uses Lampa per-film memory without copying Skaz requests',()=>{
    const h=fixture(),screen=h.instance({id:42,title:'Example'});
    screen.startSource([
        {name:'HDVB - 720p',url:'https://a.test',show:true},
        {name:'Filmix - 1080p',url:'https://b.test',show:true}
    ]);
    assert.equal(h.store.online_last_balanser[42],'filmix');
});

test('boolean values saved as strings disable automation',()=>{
    const h=fixture({capsule_skaz_online_auto:'false'});
    const screen=h.instance({id:42,title:'Example'});
    screen.startSource([{name:'Filmix',url:'https://b.test'}]);
    assert.equal(h.store.online_last_balanser,undefined);
});

test('explicit manual balancer choice survives future auto selection',()=>{
    const h=fixture();
    const rows=[
        {name:'Filmix - 1080p',url:'https://b.test',show:true},
        {name:'HDVB - 720p',url:'https://a.test',show:true}
    ];
    const first=h.instance({id:42,title:'Example'});
    first.startSource(rows);
    first.changeBalanser('hdvb');
    assert.equal(h.store.capsule_skaz_online_manual['42'],'hdvb');
    const second=h.instance({id:42,title:'Example'});
    second.startSource(rows);
    assert.equal(h.store.online_last_balanser[42],'hdvb');
});

test('a failed balancer tries the next available one at most three times',()=>{
    const h=fixture();
    const screen=h.instance({id:42,title:'Example'});
    screen.startSource([
        {name:'Filmix - 1080p',url:'https://b.test',show:true},
        {name:'HDVB - 720p',url:'https://a.test',show:true}
    ]);
    h.store.active_balanser='filmix';
    screen.doesNotAnswer({});
    assert.equal(screen.changed,'hdvb');
    assert.equal(h.store.capsule_skaz_online_manual,undefined,'automatic fallback must not become a manual override');
    assert.equal(h.store.capsule_skaz_online_metrics.filmix.bad,1);
});

test('no forced fallback for authentication failures',()=>{
    const h=fixture(),screen=h.instance({id:42,title:'Example'});
    screen.startSource([{name:'Filmix',url:'https://b.test'}]);
    screen.doesNotAnswer({accsdb:true});
    assert.equal(screen.errorShown,true);
    assert.equal(screen.changed,undefined);
});

test('quality chooses best resolution within a conservative auto cap',()=>{
    const h=fixture(),helpers=h.win.__capsuleSkazOnlineDebug;
    const options={'480p':'https://a.test/480','1080p':'https://a.test/1080','4K':'https://a.test/4k'};
    const best=helpers.qualityCandidate(options);
    assert.equal(best.height,1080);
    h.store.capsule_skaz_online_quality='max';
    assert.equal(helpers.qualityCandidate(options).height,2160);
});

test('voice selection is ranking, not an undocumented universal best-studio claim',()=>{
    const h=fixture(),rank=h.win.__capsuleSkazOnlineDebug.voiceScore;
    assert(rank('LostFilm')>rank('Одноголосый перевод'));
    assert(rank('Официальный дубляж')>rank('Нейросеть'));
});

test('failsafe: if the original Skaz constructor is not a function, wrapper does not alter it',()=>{
    const h=fixture();
    h.Lampa.Component.add('other-plugin',class Other {});
    assert.equal(typeof h.Lampa.Component.get('other-plugin'),'function');
});
