'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const bundle = fs.readFileSync(path.join(__dirname,'..','capsule-online.js'),'utf8');
const marker='/* CAPSULE AUTOPICK MODULE START */';
assert(bundle.includes(marker),'Must have embedded source and in-file automation');
const movieMarker='/* CAPSULE AMEDIA MOVIE ENGINE START */';
assert(bundle.includes(movieMarker),'Standalone film engine is embedded');
const script=bundle.slice(bundle.indexOf(marker)+marker.length,bundle.indexOf(movieMarker));
const movieEngine=bundle.slice(bundle.indexOf(movieMarker));
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
        Activity:{active(){return {component:'capsuleamedia',activity:currentActivity};}},
        Noty:{show(){}}
    };
    const win = {Lampa,capsule_amedia_core_plugin:true,console};
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
    Lampa.Component.add('capsuleamedia',SkazScreen);
    function instance(movie) {
        const screen = new registrations.capsuleamedia({movie});
        currentActivity=screen.activity;
        return screen;
    }
    return {win,Lampa,store,instance};
}

test('serial provider selection follows Skaz availability order, not video resolution',()=>{
    const h=fixture(),rank=h.win.__capsuleSkazOnlineDebug.sourceOrder([
        {name:'Umbrella - 4K',url:'https://a.test',show:true},
        {name:'Filmix - 1080p',url:'https://b.test',show:true},
        {name:'Rezka - 1080p',url:'https://c.test',show:true},
        {name:'Alloha - 4K',url:'https://d.test',show:false}
    ]);
    assert.deepEqual(Array.from(rank,x=>x.key),['filmix','rezka']);
});

test('source selection uses Lampa per-film memory without copying Skaz requests',()=>{
    const h=fixture(),screen=h.instance({id:42,title:'Example'});
    screen.startSource([
        {name:'Umbrella - 4K',url:'https://a.test',show:true},
        {name:'Filmix - 1080p',url:'https://b.test',show:true}
    ]);
    assert.equal(h.store.amedia_auto_last_balanser[42],'filmix');
});

test('boolean values saved as strings disable automation',()=>{
    const h=fixture({capsule_skaz_online_auto:'false'});
    const screen=h.instance({id:42,title:'Example'});
    screen.startSource([{name:'Filmix',url:'https://b.test'}]);
    assert.equal(h.store.amedia_auto_last_balanser,undefined);
});

test('explicit manual balancer choice survives future auto selection',()=>{
    const h=fixture();
    const rows=[
        {name:'Filmix - 1080p',url:'https://b.test',show:true},
        {name:'Alloha - 720p',url:'https://a.test',show:true}
    ];
    const first=h.instance({id:42,title:'Example'});
    first.startSource(rows);
    first.changeBalanser('alloha');
    assert.equal(h.store.capsule_skaz_online_manual['42'],'alloha');
    const second=h.instance({id:42,title:'Example'});
    second.startSource(rows);
    assert.equal(h.store.amedia_auto_last_balanser[42],'alloha');
});

test('a failed balancer tries the next available one at most three times',()=>{
    const h=fixture();
    const screen=h.instance({id:42,title:'Example'});
    screen.startSource([
        {name:'Filmix - 1080p',url:'https://b.test',show:true},
        {name:'Alloha - 720p',url:'https://a.test',show:true}
    ]);
    h.store.amedia_auto_active_balanser='filmix';
    screen.doesNotAnswer({});
    assert.equal(screen.changed,'alloha');
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


test('bundle embeds a player source and contains no load of the separate Skaz plugin',()=>{
    assert(bundle.includes('/* CAPSULE EMBEDDED ONLINE CORE START */'));
    assert(bundle.includes("Lampa.Component.add('capsuleamedia', component)"));
    assert(bundle.includes("component: 'capsuleamedia'"));
    assert(!bundle.includes('loadUpstreamIfMissing'));
    assert(!bundle.includes("getScript('http://skaz.tv/lampac-src-filter.js')"));
    assert(!bundle.includes("getScript('http://skaz.tv/play.js')"));
});

test('our button is labeled Amedia and has fallback for newer Lampa layouts',()=>{
    assert(bundle.includes('<span>Amedia</span>'));
    assert(bundle.includes('capsule-amedia--button'));
    assert(bundle.includes("var bar = activityRoot.find('.full-start-new__buttons"));
    assert(bundle.includes("if (activityRoot.find('.capsule-amedia--button').length) return"));
});

test('only Amedia source is installed and Skaz plugin flag stays independent',()=>{
    const core=bundle.slice(0,bundle.indexOf(marker));
    assert(core.includes('window.capsule_amedia_core_plugin = true;'));
    assert(!core.includes('window.onlyskaz_plugin'));
    assert(!core.includes("Lampa.Component.add('lampacskaz'"));
    assert(!core.includes("component: 'lampacskaz'"));
    assert(core.includes("Lampa.Component.add('capsuleamedia'"));
});

test('autoselection logic remains inside the downloaded plugin and uses private selection keys',()=>{
    assert(script.includes('function sourceScore('));
    assert(script.includes('function voiceScore('));
    assert(script.includes('function qualityCandidate('));
    assert(bundle.includes('amedia_auto_last_balanser'));
    assert(bundle.includes('amedia_auto_choice_'));
});


test('embedded Amedia registers independently and inserts exactly one action even without torrent anchor',()=>{
    const core=bundle.slice(0,bundle.indexOf(marker));
    const store={},events={},components={},added=[];
    let movieClicks=0,openedMovie=null;
    const missing={length:0,first(){return this;},append(){return this;},
        prepend(){return this;},before(){return this;},after(){return this;}};
    const bar={length:1,first(){return this;},prepend(button){added.push(button);return this;}};
    const root={
        length:1,
        find(selector){
            if(selector === '.capsule-amedia--button')
                return added.length ? {length:added.length} : missing;
            if(selector.includes('.full-start-new__buttons')) return bar;
            return missing;
        }
    };
    function $(source){
        return {source,length:1,handlers:{},append(){return this;},
            on(name,handler){this.handlers[name]=handler;return this;},
            attr(){return this;},find(){return missing;}};
    }
    const Lampa={
        Storage:{get(k,d){return Object.hasOwn(store,k)?store[k]:d;},
            set(k,v){store[k]=v;},cache(k,life,d){return Object.hasOwn(store,k)?store[k]:d;},
            field(){return undefined;},sync(){}},
        Reguest:function(){this.silent=function(url,ok,fail){if(fail)fail();};},
        Utils:{uid(){return 'unit1234';},hash(){return 'unit';},putScript(){}},
        Platform:{is(){return false;}},
        Manifest:{app_digital:0,add(){}},
        Component:{add(k,v){components[k]=v;}},
        Lang:{translate(x){return x;},add(){}},
        Template:{add(){},get(){return $(null);}},
        Listener:{follow(k,fn){events[k]=fn;}},
        Activity:{active(){return {component:'full',activity:{render(){return root;}}};}}
    };
    const window={rch_nws:null,console,location:{host:'lampa.local'},
        __capsuleAmediaFilmPlay(movie){movieClicks++;openedMovie=movie;}};
    vm.runInNewContext(core,{Lampa,window,$,location:window.location,
        console,setTimeout(){return 1;}},{timeout:5000});
    assert.equal(typeof components.capsuleamedia,'function');
    assert.equal(window.capsule_amedia_core_plugin,true);
    assert.equal(typeof events.full,'function');
    const event={type:'complite',object:{activity:{render(){return root;}}},
        data:{movie:{id:11,title:'Test'}}};
    events.full(event);
    events.full(event);
    assert.equal(added.length,1);
    assert.match(added[0].source,/class="[^"]*capsule-amedia--button/);
    assert.match(added[0].source,/<span>Amedia<\/span>/);
    added[0].handlers['hover:enter']();
    added[0].handlers.click();
    assert.equal(movieClicks,1,'one movie click must not run twice');
    assert.equal(openedMovie.id,11);
});


test('never auto-selects unknown providers even if they advertise 4K',()=>{
    const h=fixture();
    const rows=[
        {name:'Umbrella - 4K',url:'https://a.test',show:true},
        {name:'SomeAggregator 4320p',url:'https://b.test',show:true},
        {name:'HD Rezka 720p',url:'https://c.test',show:true},
        {name:'KinoPub 1080p',url:'https://d.test',show:true},
        {name:'Veo Veo 2160p',url:'https://e.test',show:true}
    ];
    const names=Array.from(h.win.__capsuleSkazOnlineDebug.sourceOrder(rows),x=>x.key);
    assert.deepEqual(names,['hd','kinopub','veo']);
});
test('unknown providers alone produce no automatic launch, not random search',async()=>{
    const h=fixture(),screen=h.instance({id:123,title:'Example'});
    await assert.rejects(screen.startSource([
        {name:'Umbrella 4K',url:'https://a.test',show:true}
    ]),/Нет доступного предпочтительного/);
    assert.equal(h.store.amedia_auto_last_balanser,undefined);
});
test('movie route is isolated from the series component and disables the old movie DOM click poll',()=>{
    const core=bundle.slice(0,bundle.indexOf(marker));
    assert(core.includes('window.__capsuleAmediaFilmPlay(movie)'));
    assert(core.includes('window.__capsuleAmediaFilmPlay(movie)'));
    assert(!script.includes("items.eq(0).trigger('hover:enter')"));
});
test('film engine is lazy, single file, and suppresses duplicate requests',()=>{
    const sandbox={window:{},console};
    vm.runInNewContext(movieEngine,sandbox,{timeout:5000});
    assert.equal(typeof sandbox.window.__capsuleAmediaFilmPlay,'function');
    assert.equal(sandbox.window.__capsuleAmediaFilmPlayBridge,undefined);
    assert(movieEngine.includes('if(opening||now-lastLaunch<8000)'));
    assert(movieEngine.includes('429|401|403'));
    assert(movieEngine.includes('function resilientLookup(ctx)'));
    assert(!movieEngine.includes('function _0x22107b()'));
});
test('series life-events polling is bounded and never runs fifteen times',()=>{
    const core=bundle.slice(0,bundle.indexOf(marker));
    const start=core.indexOf('this.lifeSource = function()');
    const end=core.indexOf('this.createSource = function()',start);
    const body=core.slice(start,end);
    assert(body.includes('attempts>=2'));
    assert(body.includes('attempts>=2'));
    assert(body.includes('2800'));
    assert(!body.includes('life_wait_times > 15'));
});


test('movie player uses its own quality namespace and does not change old Amedia defaults',()=>{
    assert(movieEngine.includes("var prefix = 'capsule_amedia_film_'"));
    assert(movieEngine.includes("storage.set('capsule_amedia_film_quality',quality)"));
    assert(!movieEngine.includes("var prefix = 'amedia_v4_'"));
});
test('hybrid UI does not keep obsolete film auto-click setting',()=>{
    assert(!script.includes("['autoplay','Автозапуск фильмов'"));
    assert(script.includes('Автоматический выбор для сериалов'));
});


test('single press is debounced for Android D-pad and touch click',()=>{
    const core=bundle.slice(0,bundle.indexOf(marker));
    const button=core.slice(core.indexOf('function addButton(e)'),core.indexOf("Lampa.Listener.follow('full'"));
    assert(button.includes("if (now-lastActivated<650)return"));
    assert(button.includes("btn.on('hover:enter',activate)"));
    assert(button.includes("btn.on('click',activate)"));
});


test('all series images decode lazily with a single error fallback',()=>{
    const core=bundle.slice(0,bundle.indexOf(marker));
    assert.equal((core.match(/img\.loading = 'lazy'/g)||[]).length,2);
    assert.equal((core.match(/img\.decoding = 'async'/g)||[]).length,2);
    assert.equal((core.match(/img\.onerror = null/g)||[]).length,2);
});


test('startup performs no eager Skaz RCH network probe',()=>{
    const core=bundle.slice(0,bundle.indexOf(marker));
    assert(!core.includes("window.rch_nws[hostkey].typeInvoke('http://online'+dd+'3.skaz.tv', function() {});"));
    assert(core.includes('typeInvoke('),'RCH negotiation must remain available on demand');
});


test('the embedded source core hard-filters providers before presenting to the UI',()=>{
    const body=bundle.slice(0,bundle.indexOf(marker));
    assert(body.includes('window.__capsuleSerialAllowed=allowedSeriesProvider'));
    assert(body.includes('if(!row||!row.url||row.show===false||!allowedSeriesProvider(row))return;'));
    assert(body.includes('filter_sources=Lampa.Arrays.getKeys(sources)'));
    assert(body.includes('return row&&row.url&&row.show!==false&&allowedSeriesProvider(row);'));
    assert(body.includes('if(!sources[balanser_name])return;'));
    assert(!body.includes("get('amedia_auto_balanser', filter_sources[0])"));
});

test('Skaz availability decides the first source; no rating-based sorting or 5-second retry timer',()=>{
    const slice=script.slice(script.indexOf('function sourceOrder(rows)'),script.indexOf('function voiceScore(label)'));
    assert(slice.includes('original:index'));
    assert(!slice.includes('.sort('));
    const core=bundle.slice(0,bundle.indexOf(marker));
    const start=core.indexOf('this.startSource = function(json)');
    const end=core.indexOf('this.lifeSource = function()',start);
    const region=core.slice(start,end);
    assert(region.includes('balanser=filter_sources[0]'));
    assert(!region.includes("Lampa.Storage.get('amedia_auto_balanser'"));
    const doesNotAnswer=core.slice(core.indexOf('this.doesNotAnswer = function'),core.indexOf('this.getLastEpisode = function'));
    assert(!doesNotAnswer.includes('setInterval('));
});

test('strict serial provider helper accepts only known provider identities',()=>{
    const h=fixture();
    // wrapper helpers are independently checked to prevent fake names/metadata.
    const sourceOrder=h.win.__capsuleSkazOnlineDebug.sourceOrder;
    const good=['Rezka','HDRezka','Alloha','Filmix','Skaz TV','KinoPub','Veo Veo'];
    const rows=good.map(name=>({name,url:'https://test.invalid/'+encodeURIComponent(name),show:true}));
    rows.unshift({name:'Umbrella Filmix',url:'https://test.invalid/x',show:true});
    rows.push({name:'UHD Umbrella 8K',url:'https://test.invalid/y',show:true});
    assert.equal(sourceOrder(rows).length,good.length);
});

test('the internal Amedia film player can select Android/UA Player',()=>{
    assert(movieEngine.includes("return get('player') === 'android' ? 'android' : 'inner'"));
    assert(movieEngine.includes("var route = get('player')"));
    assert(movieEngine.includes('L.Player.runas(job.mode)'));
    assert(movieEngine.includes("data.launch_player = job.mode"));
    assert(script.includes("['filmPlayer','Плеер для фильмов'"));
    assert(movieEngine.includes("storage.set('capsule_amedia_film_player',player)"));
});

test('card focus border exactly follows card and mobile radius and avoids paint-heavy animation',()=>{
    assert(script.includes('border-radius:inherit;top:0;right:0;bottom:0;left:0'));
    assert(script.includes('border-radius:.72em 0 0 .72em'));
    assert(script.includes('transition:none'));
    assert(!script.includes('top:-.22em;right:-.22em'));
});

test('focus scroll is batched by animation frame and disposed on destroy',()=>{
    const core=bundle.slice(0,bundle.indexOf(marker));
    assert(core.includes('function scheduleFocusScroll(node)'));
    assert(core.includes('function cancelFocusScroll()'));
    assert(core.includes('var raf=window.requestAnimationFrame'));
    assert.equal((core.match(/scheduleFocusScroll\(e\.target\)/g)||[]).length,3);
    assert(core.includes('this.destroy = function() {\n      cancelFocusScroll();'));
    assert(!core.includes('Lampa.Background.immediately(Lampa.Utils.cardImgBackgroundBlur(object.movie))'));
    assert(!core.includes("network.silent(account('http://online'+dd+'3.skaz.tv/lite/withsearch')"));
});


test('runtime: only six approved serial providers reach source picker and first responding one wins',async()=>{
    const core=bundle.slice(0,bundle.indexOf(marker));
    const store={},components={},filters={};
    const Lampa={
        Storage:{
            get(k,d){return Object.hasOwn(store,k)?store[k]:d;},
            cache(k,n,d){return Object.hasOwn(store,k)?store[k]:d;},
            set(k,v){store[k]=v;},field(){return false;},sync(){}
        },
        Arrays:{
            getKeys:Object.keys,
            extend(target,defaults){for(const k of Object.keys(defaults))
                if(target[k]===undefined)target[k]=defaults[k];return target;}
        },
        Reguest:function(){this.silent=function(){};this.clear=function(){};},
        Scroll:function(){},Explorer:function(){},
        Filter:function(){
            this.set=function(type,value){filters[type]=value;};
            this.chosen=function(){};
        },
        Utils:{uid(){return 'aabbcc11';},hash(){return 42;},putScript(){}},
        Platform:{is(){return false;}},
        Manifest:{app_digital:0,add(){}},
        Component:{add(k,v){components[k]=v;}},
        Lang:{translate(s){return s;},add(){}},
        Template:{add(){},get(){return {};}},Listener:{follow(){}},
        Activity:{replace(){throw new Error('Unexpected prohibited provider change');}}
    };
    const win={console,location:{host:'lampa.local'}};
    function $(){return {append(){return this;}};}
    vm.runInNewContext(core,{window:win,Lampa,$,location:win.location,console,
        setTimeout(){return 1;},clearTimeout(){}},{timeout:5000});
    const C=components.capsuleamedia;
    assert.equal(typeof C,'function');
    const component=new C({movie:{id:101,name:'My TV show'}});
    const available=[
        {balanser:'umbrella',name:'Umbrella Filmix 4K',url:'https://x.invalid',show:true},
        {balanser:'alloha',name:'Alloha',url:'https://a.invalid',show:true},
        {balanser:'rezka',name:'Rezka',url:'https://r.invalid',show:true},
        {balanser:'filmix',name:'Filmix',url:'https://f.invalid',show:false},
        {balanser:'kinopub',name:'KinoPub',url:'https://k.invalid',show:true},
        {balanser:'unknown',name:'Random Rezka',url:'https://n.invalid',show:true}
    ];
    store.amedia_auto_last_balanser={101:'kinopub'}; // no sticky priority
    await component.startSource(available);
    assert.equal(store.amedia_auto_active_balanser,'alloha');
    component.filter({source:[],voice:[],season:[]},{});
    assert.deepEqual(Array.from(filters.sort,x=>x.source),['alloha','rezka','kinopub']);
    component.changeBalanser('umbrella');
    assert.equal(store.amedia_auto_active_balanser,'alloha');
});


test('episode list is appended to DOM in one batch and late season results are discarded',()=>{
    const core=bundle.slice(0,bundle.indexOf(marker));
    const draw=core.slice(core.indexOf('this.draw = function(items)'),core.indexOf('this.contextMenu = function'));
    assert(draw.includes('var stagedRows=document.createDocumentFragment()'));
    assert(draw.includes('if(generation!==drawGeneration)return'));
    assert.equal((draw.match(/stageRow\(html\)/g)||[]).length,2);
    assert.equal((draw.match(/scroll\.append\(stagedRows\)/g)||[]).length,1);
    assert(core.includes('this.reset = function() {\n      ++drawGeneration;'));
    assert(core.includes('this.destroy = function() {\n      ++drawGeneration;'));
});
