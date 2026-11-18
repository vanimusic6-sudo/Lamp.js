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

test('source metadata does not override the embedded Skaz core selection',()=>{
    const h=fixture(),screen=h.instance({id:42,name:'Example'});
    screen.startSource([
        {name:'Umbrella - 4K',url:'https://a.test',show:true},
        {name:'Filmix - 1080p',url:'https://b.test',show:true}
    ]);
    assert.equal(h.store.amedia_auto_last_balanser,undefined,
        'the core owns the active source; wrapper must not persist old routing');
});

test('boolean values saved as strings disable automation',()=>{
    const h=fixture({capsule_skaz_online_auto:'false'});
    const screen=h.instance({id:42,title:'Example'});
    screen.startSource([{name:'Filmix',url:'https://b.test'}]);
    assert.equal(h.store.amedia_auto_last_balanser,undefined);
});

test('manual selection switches immediately without writing a sticky automatic override',()=>{
    const h=fixture(),rows=[
        {name:'Filmix - 1080p',url:'https://b.test',show:true},
        {name:'Alloha - 720p',url:'https://a.test',show:true}
    ];
    const first=h.instance({id:42,name:'Example'});
    first.startSource(rows);
    first.changeBalanser('alloha');
    assert.equal(first.changed,'alloha');
    assert.equal(h.store.capsule_skaz_online_manual,undefined);
    const second=h.instance({id:42,name:'Example'});
    second.startSource(rows);
    assert.equal(second.changed,undefined);
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
    assert.equal(h.store.capsule_skaz_online_metrics,undefined,
        'unused telemetry must not slow down D-pad playback');
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
    assert(script.includes('function sourceOrder(rows)'));
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
    assert.deepEqual(names,['hdrezka','kinopub','veoveo']);
});
test('wrapper refuses to rank unapproved providers',()=>{
    const h=fixture(),items=[{name:'Umbrella 4K',url:'https://a.test',show:true}];
    assert.deepEqual(Array.from(h.win.__capsuleSkazOnlineDebug.sourceOrder(items)),[]);
    assert.equal(h.store.amedia_auto_active_balanser,undefined);
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
    assert(movieEngine.includes('if(opening||now-lastLaunch<750)'));
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
    assert(body.includes('if(!row||!allowedSeriesProvider(row))return;'));
    assert(body.includes('filter_sources=Object.keys(sources)'));
    assert(body.includes('return row&&row.url&&row.show!==false&&allowedSeriesProvider(row);'));
    assert(body.includes('var next=sources[name]'));
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
    assert(region.includes('balanser=pin&&sources[pin]&&sources[pin].show?pin:ready[0]'));
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
    assert(script.includes('border-color:rgba(255,255,255,.96)!important'));
    assert(script.includes('border-radius:.72em 0 0 .72em'));
    assert(script.includes('transition:opacity .14s ease-out'));
    assert(!script.includes('top:-.22em;right:-.22em'));
});

test('focus scroll is batched by animation frame and disposed on destroy',()=>{
    const core=bundle.slice(0,bundle.indexOf(marker));
    assert(core.includes('function scheduleFocusScroll(node)'));
    assert(core.includes('function cancelFocusScroll()'));
    assert(core.includes('var raf=window.requestAnimationFrame'));
    assert.equal((core.match(/scheduleFocusScroll\(e\.target\)/g)||[]).length,1);
    assert.equal((core.match(/scheduleFocusScroll\(focused\)/g)||[]).length,2);
    assert(core.includes('this.destroy = function() {\n      markEpisodeFocus(null);\n      ++drawGeneration;\n      ++requestRevision;\n      cancelFocusScroll();'));
    assert(!core.includes('Lampa.Background.immediately(Lampa.Utils.cardImgBackgroundBlur(object.movie))'));
    assert(!core.includes("network.silent(account('http://online'+dd+'3.skaz.tv/lite/withsearch')"));
});


test('runtime: sources switch in place, offline Alloha remains listed, and stale replies are ignored',async()=>{
    const core=bundle.slice(0,bundle.indexOf(marker));
    const store={},components={},filters={},chosen={},requests=[],notes=[];
    const fakeElement={length:1,find(){return {
        length:0,remove(){return this;},first(){return this;}
    };},append(){return this;},text(){return this;},toggleClass(){return this;},first(){return this;}};
    function Scroll(){this.render=()=>fakeElement;this.body=()=>fakeElement;
        this.clear=()=>{};this.reset=()=>{};}
    function Filter(){this.set=(type,value)=>{filters[type]=value;};
        this.chosen=(type,value)=>{chosen[type]=value;};
        this.render=()=>fakeElement;}
    function Reguest(){
        this.silent=function(){};
        this.clear=function(){};
        this.native=function(url,success,failure){
            requests.push({url,success,failure});
        };
    }
    const Lampa={
        Storage:{get(k,d){return Object.hasOwn(store,k)?store[k]:d;},
            cache(k,n,d){return Object.hasOwn(store,k)?store[k]:d;},
            set(k,v){store[k]=v;},field(){return false;},sync(){}},
        Arrays:{getKeys:Object.keys,
            extend(target,defaults){for(const k of Object.keys(defaults))
                if(target[k]===undefined)target[k]=defaults[k];return target;}},
        Reguest,Scroll,Explorer:function(){},Filter,
        Utils:{uid(){return 'aabbcc11';},hash(){return 42;},
            putScript(){},addUrlComponent(url,part){
                return url+(url.includes('?')?'&':'?')+part;
            }},
        Platform:{is(){return false;}},
        Manifest:{app_digital:0,add(){}},
        Component:{add(k,v){components[k]=v;}},
        Lang:{translate(s){return s;},add(){}},
        Template:{add(){},get(){return fakeElement;}},Listener:{follow(){}},
        Noty:{show(s){notes.push(s);}},
        Activity:{replace(){throw new Error('Unexpected Activity.replace during source switch');}}
    };
    const win={console,location:{host:'lampa.local'}};
    function $(){return fakeElement;}
    vm.runInNewContext(core,{window:win,Lampa,$,location:win.location,console,
        setTimeout(){return 1;},clearTimeout(){},clearInterval(){},
        setInterval(){return 1;}},{timeout:5000});
    assert.equal(typeof components.capsuleamedia,'function');
    const instance=new components.capsuleamedia({movie:{id:101,name:'My TV show'}});
    const all=[
        {balanser:'umbrella',name:'Umbrella Filmix 4K',url:'https://x.invalid',show:true},
        {balanser:'alloha',name:'Alloha',url:'https://a.invalid',show:true},
        {balanser:'rezka',name:'Rezka',url:'https://r.invalid',show:true},
        {balanser:'filmix',name:'Filmix',url:'https://f.invalid',show:false},
        {balanser:'kinopub',name:'KinoPub',url:'https://k.invalid',show:true},
        {balanser:'unknown',name:'Random Rezka',url:'https://n.invalid',show:true}
    ];
    store.amedia_auto_last_balanser={101:'kinopub'};
    await instance.startSource(all);
    assert.equal(store.amedia_auto_active_balanser,'alloha');
    instance.filter({source:[],voice:[],season:[]},{});
    assert.deepEqual(Array.from(filters.sort,x=>x.source),
        ['alloha','rezka','filmix','kinopub','hdrezka','skaztv','veoveo']);
    assert.equal(filters.sort[2].ghost,true);
    assert.equal(instance.changeBalanser('umbrella'),false);
    assert.equal(store.amedia_auto_active_balanser,'alloha');
    assert.equal(instance.changeBalanser('rezka'),true);
    assert.equal(store.amedia_auto_active_balanser,'rezka');
    assert.equal(chosen.sort[0],'Rezka');
    assert.equal(requests.length,1);
    assert(requests[0].url.startsWith('https://r.invalid?'));
    const first=requests[0];
    assert.equal(instance.changeBalanser('kinopub'),true);
    assert.equal(chosen.sort[0],'KinoPub');
    assert.equal(requests.length,2);
    assert(requests[1].url.startsWith('https://k.invalid?'));
    let parserInvocations=0;
    instance.parse=function(){parserInvocations++;};
    first.success('<stale source>');
    assert.equal(parserInvocations,0,'previous URL must not repopulate new source');
    requests[1].success('<current source>');
    assert.equal(parserInvocations,1,'current source should still process its response');
    // When the server temporarily hides Alloha, the UI retains it as ghost
    // instead of silently removing it from the authorized source list.
    await instance.startSource([
        {balanser:'kinopub',name:'KinoPub',url:'https://k.invalid',show:true}
    ]);
    instance.filter({source:[],voice:[],season:[]},{});
    assert.deepEqual(Array.from(filters.sort,x=>x.source),
        ['alloha','rezka','filmix','kinopub','hdrezka','skaztv','veoveo']);
    assert.equal(filters.sort[0].ghost,true,'Alloha stays visible during fallback');
});

test('episode list is appended to DOM in one batch and late season results are discarded',()=>{
    const core=bundle.slice(0,bundle.indexOf(marker));
    const draw=core.slice(core.indexOf('this.draw = function(items)'),core.indexOf('this.contextMenu = function'));
    assert(draw.includes('var stagedRows=document.createDocumentFragment()'));
    assert(draw.includes('if(generation!==drawGeneration)return'));
    assert.equal((draw.match(/stageRow\(html\)/g)||[]).length,2);
    assert.equal((draw.match(/scroll\.append\(stagedRows\)/g)||[]).length,1);
    assert(core.includes('this.reset = function() {\n      markEpisodeFocus(null);\n      ++requestRevision;\n      ++drawGeneration;'));
    assert(core.includes('this.destroy = function() {\n      markEpisodeFocus(null);\n      ++drawGeneration;\n      ++requestRevision;'));
});


test('manual selected source is updated in-place and automatic favorites are not forced',()=>{
    const core=bundle.slice(0,bundle.indexOf(marker));
    const start=core.indexOf('this.changeBalanser = function(');
    const end=core.indexOf('this.requestParams = function',start);
    const body=core.slice(start,end);
    assert(body.includes('balanser=name;'));
    assert(body.includes('source=next.url;'));
    assert(body.includes('this.search();'));
    assert(!body.includes('Lampa.Activity.replace'));
    assert(!script.includes('root.__capsuleSerialRouting='));
    assert(!script.includes('put(\'manual\''));
});

test('film auto player selects Android bridge and falls back to inner only in a browser',async()=>{
    async function selection(android){
        const store={capsule_skaz_online_filmPlayer:'auto'};
        const window={
            Lampa:{
                Storage:{
                    get(k,d){return Object.hasOwn(store,k)?store[k]:d;},
                    set(k,v){store[k]=v;}
                },
                Platform:{is(k){return android && k==='android';}},
                Noty:{show(){}}
            },
            AndroidJS:android ? {openPlayer(){}}:undefined
        };
        vm.runInNewContext(movieEngine,{window,console},{timeout:5000});
        await window.__capsuleAmediaFilmPlay({id:123,title:'Movie'});
        return store.capsule_amedia_film_player;
    }
    assert.equal(await selection(true),'android');
    assert.equal(await selection(false),'inner');
});


test('source selection does not inject a permanent spinner or rebuild the activity',()=>{
    const core=bundle.slice(0,bundle.indexOf(marker));
    const source=core.slice(core.indexOf('this.createSource = function()'),core.indexOf('this.search = function()'));
    assert(!source.includes("append('<span class=\"lampac-balanser-loader\""));
    const selected=core.slice(core.indexOf('this.changeBalanser = function('),core.indexOf('this.requestParams = function'));
    assert(selected.includes('this.search();'));
    assert(selected.includes('this.reset();'));
    assert(!selected.includes('Activity.replace('));
    assert(core.includes("find('.lampac-balanser-loader').remove()"));
});

test('season appears as independent native selector directly before ordinary filters',()=>{
    const core=bundle.slice(0,bundle.indexOf(marker));
    assert(core.includes('capsule-season-button hide'));
    assert(core.includes("find('.filter--filter').first().before(seasonButton)"));
    assert(core.includes('this.showSeasonPicker = function()'));
    assert(core.includes('this.updateSeasonButton = function()'));
    const filter=core.slice(core.indexOf('this.filter = function(filter_items, choice)'),
        core.indexOf('this.selected = function(filter_items)'));
    assert(!filter.includes("add('season'"));
    assert(filter.includes("add('voice'"));
    assert(core.includes("voice_url:''"));
});

test('episode focus persists through native focus flicker and redraw',()=>{
    const core=bundle.slice(0,bundle.indexOf(marker));
    assert(core.includes("function markEpisodeFocus(node)"));
    assert(core.includes("classList.add('cso-row-focused')"));
    assert(core.includes("lastFocusedEpisode.replace(/[^0-9:]/g,'')"));
    assert(script.includes('.online-prestige.cso-row-focused{background:'));
});

test('serial source URLs use a monotonic request revision and ignore late replies',()=>{
    const core=bundle.slice(0,bundle.indexOf(marker));
    assert(core.includes('var self=this, revision=++requestRevision, selected=balanser;'));
    assert(core.includes('if(revision===requestRevision&&selected===balanser)self.parse(data)'));
    assert(core.includes('if(revision===requestRevision&&selected===balanser)'));
    assert(core.includes('++requestRevision;'));
});


test('explicit manual provider choice blocks auto fallback on its failure',()=>{
  const h=fixture(),screen=h.instance({id:77,name:'Show'});
  screen.startSource([
    {balanser:'rezka',name:'Rezka',url:'https://r.invalid',show:true},
    {balanser:'alloha',name:'Alloha',url:'https://a.invalid',show:true}
  ]);
  screen.changeBalanser('alloha');
  assert.equal(screen.__csoSession.manualSelection,true);
  screen.doesNotAnswer({status:500});
  assert.equal(screen.changed,'alloha');
  assert.equal(screen.errorShown,true);
});

test('provider duplicate statuses and string false are never chosen',()=>{
  const h=fixture(),rank=h.win.__capsuleSkazOnlineDebug.sourceOrder([
    {balanser:'alloha',name:'Alloha',url:'https://a.invalid',show:true},
    {balanser:'filmix',name:'Filmix',url:'https://f.invalid',show:true},
    {balanser:'alloha',name:'Alloha',url:'https://a.invalid',show:false},
    {balanser:'rezka',name:'Rezka',url:'https://r.invalid',show:'false'},
    {balanser:'kinopub',name:'KinoPub',url:'https://k.invalid',show:true}
  ]);
  assert.deepEqual(Array.from(rank,x=>x.key),['filmix','kinopub']);
});

test('the seven source choices remain visible with no invented URLs',()=>{
  const core=bundle.slice(0,bundle.indexOf(marker));
  assert(core.includes("['rezka','Rezka'],['hdrezka','HDRezka'],['alloha','Alloha']"));
  assert(core.includes('completeSerialCatalog();'));
  assert(core.includes('ghost: !sources[e].show||!sources[e].url'));
  assert(core.includes('var ready=arrival.filter(function(key)'));
});

test('the obsolete Skaz pseudo-focus rule is replaced by a poster-safe foreground overlay',()=>{
  const core=bundle.slice(0,bundle.indexOf(marker));
  assert(!core.includes(".online-prestige.focus::after{content:''"));
  assert(script.includes('pointer-events:none!important;border:2px solid transparent!important'));
  assert(script.includes('z-index:12!important'));
});

test('broken stream and quality payloads are handled without TypeError',()=>{
  const core=bundle.slice(0,bundle.indexOf(marker));
  assert(core.includes("if(!map||typeof map!=='object'||Array.isArray(map))return;"));
  assert(core.includes("if(typeof url!=='string')return;"));
  assert(core.includes("if(!json||typeof json!=='object')"));
  assert(core.includes("if(!file||!file.url)"));
  assert(core.includes('if (stream && stream.url)'));
  assert(core.includes("file:stream&&stream.url||''"));
});

test('a malformed episode is isolated instead of hiding the whole list',()=>{
  const core=bundle.slice(0,bundle.indexOf(marker));
  const body=core.slice(core.indexOf('this.parseJsonDate = function'),
                        core.indexOf('this.getFileUrl = function'));
  assert(body.includes('catch(malformed){/* isolated item, not entire series */}'));
  assert(body.includes('$.parseHTML(str,document,false)'));
  assert(body.includes('return elems;'));
});

test('optional TMDB data is bounded and the old list is retained until swap',()=>{
  const core=bundle.slice(0,bundle.indexOf(marker));
  assert(core.includes('var metadataCache=Object.create(null)'));
  assert(core.includes('},850);'));
  assert(core.includes('var delivered=false, timer=0;'));
  const draw=core.slice(core.indexOf('this.draw = function(items)'),
                        core.indexOf('this.contextMenu = function'));
  assert(draw.includes('scroll.clear();\n        if(!object.balanser)'));
  assert(draw.includes('scroll.append(stagedRows);'));
});

test('plugin reload and optional external ID lookup are bounded',()=>{
  const core=bundle.slice(0,bundle.indexOf(marker));
  assert(movieEngine.includes("if(root.__capsuleAmediaFilmPlay)return;"));
  assert(script.includes('if (root.__capsuleSkazOnline) return;'));
  const segment=core.slice(core.indexOf('this.externalids = function()'),
                           core.indexOf('this.updateBalanser = function'));
  assert(segment.includes('network.timeout(1800)'));
  assert(segment.includes("['imdb_id','kinopoisk_id','tmdb_id'].forEach"));
  assert(!segment.includes('for (var name in json)'));
});


test('behavior: parseJsonDate skips malformed records but preserves two playable entries',()=>{
  const core=bundle.slice(0,bundle.indexOf(marker));
  const src=core.slice(core.indexOf('this.parseJsonDate = function'),
                       core.indexOf('this.getFileUrl = function'));
  const rows=[
    {'data-json':'{"method":"play","url":"https://video.invalid/a"}',
     s:'1',e:'1',text:'First'},
    {'data-json':'{ broken json',s:'1',e:'2',text:'Broken'},
    {'data-json':'{"method":"play","url":"https://video.invalid/b"}',
     s:'1',e:'3',text:'Third'}
  ];
  function $(value){
    if(typeof value==='string')return {
      append(nodes){this.nodes=nodes;return this;},
      find(){return {each(fn){for(const row of rows)fn.call(row);}}}
    };
    return {
      attr(k){return value[k];},
      text(){return value.text;},
      hasClass(){return false;}
    };
  }
  $.parseHTML=()=>rows;
  const holder={};
  new Function('$','object','document',src).call(holder,$,
    {movie:{name:'Series'}},{});
  const parsed=holder.parseJsonDate('<div></div>','.videos__item');
  assert.deepEqual(Array.from(parsed,x=>x.episode),[1,3]);
  assert.equal(parsed[0].url,'https://video.invalid/a');
});

test('behavior: malformed quality maps never throw and reserve URL is preserved',()=>{
  const core=bundle.slice(0,bundle.indexOf(marker));
  const src=core.slice(core.indexOf('this.setDefaultQuality = function'),
                       core.indexOf('this.display = function'));
  const holder={orUrlReserve(data){
    if(typeof data.url==='string'&&data.url.includes(' or ')){
      const urls=data.url.split(' or ');data.url=urls[0];data.url_reserve=urls[1];
    }
  }};
  new Function('Lampa',src).call(holder,{
    Storage:{field(){return 1080;}}
  });
  assert.doesNotThrow(()=>holder.setDefaultQuality({quality:null}));
  assert.doesNotThrow(()=>holder.setDefaultQuality({quality:{'1080p':null}}));
  const data={quality:{'480p':'https://v.invalid/480',
    '1080p':'https://v.invalid/1080 or https://v.invalid/reserve'}};
  holder.setDefaultQuality(data);
  assert.equal(data.url,'https://v.invalid/1080');
  assert.equal(data.url_reserve,'https://v.invalid/reserve');
});

test('behavior: TMDB timeout fires once and late metadata is cached for next viewing',()=>{
  const core=bundle.slice(0,bundle.indexOf(marker));
  const src=core.slice(core.indexOf('var metadataCache=Object.create(null);'),
                       core.indexOf('this.watched = function(set)'));
  const tasks=[];let success;
  const Lampa={Api:{sources:{tmdb:{get(path,opts,ok){success=ok;}}}}};
  const holder={};
  new Function('object','Lampa','setTimeout','clearTimeout',src).call(holder,
    {movie:{id:55,name:'Series',source:'tmdb'}},Lampa,
    (fn,ms)=>{tasks.push({fn,ms});return tasks.length;},()=>{});
  const results=[];
  holder.getEpisodes(1,rows=>results.push(rows));
  assert.equal(tasks[0].ms,850);
  tasks[0].fn();
  assert.equal(results.length,1);
  assert.equal(results[0].length,0);
  success({episodes:[{episode_number:1,name:'Pilot'}]});
  assert.equal(results.length,1,'late metadata may cache but must not redraw stale view');
  holder.getEpisodes(1,rows=>results.push(rows));
  assert.equal(results.length,2);
  assert.equal(results[1][0].name,'Pilot');
});


test('catalog resolves empty server responses without dereference errors',()=>{
    const core=bundle.slice(0,bundle.indexOf(marker));
    const block=core.slice(core.indexOf('this.createSource = function()'),
                           core.indexOf('this.search = function()'));
    assert(block.includes("if(!json||typeof json!=='object')"));
    assert(block.includes("Пустой ответ каталога источников"));
});

test('remote RCH scripts and signed response payloads are not logged by default',()=>{
    const core=bundle.slice(0,bundle.indexOf(marker));
    assert(!core.includes("console.log('RCH'"));
    assert(core.includes("client.on(\"RchClient\""));
});

test('compact source toolbar keeps source, season and studio selectors in one responsive region',()=>{
  const css=bundle.slice(bundle.indexOf('function installCSS()'),
                         bundle.indexOf('function registerSettings()',bundle.indexOf('function installCSS()')));
  assert(css.includes(".torrent-filter .filter--sort{order:1"));
  assert(css.includes(".torrent-filter .capsule-season-button{order:2"));
  assert(css.includes(".torrent-filter .filter--filter{order:3"));
  assert(css.includes("max-width:660px"));
  assert(css.includes(".cso-status{display:none"));
  assert(css.includes(".cso-status[data-state=recover]{display:block"));
});
test('poster loading cannot paint over the focus ring, and hidden source controls do not stack',()=>{
  const css=bundle.slice(bundle.indexOf('function installCSS()'),
                         bundle.indexOf('function registerSettings()',bundle.indexOf('function installCSS()')));
  assert(css.includes("position:absolute!important;inset:0!important"));
  assert(css.includes("pointer-events:none!important"));
  assert(css.includes("border-radius:inherit!important"));
  assert(css.includes("z-index:12!important"));
  assert(!css.includes("box-shadow:inset 0 0 0 2px"));
});
test('movie typed as series by Amedia redirects to modern Skaz browser',()=>{
  assert(bundle.includes('window.__capsuleOpenSkazChoices=function(movie,interpretAsSeries)'));
  assert(movieEngine.includes('root.__capsuleOpenSkazChoices(movie,true)'));
  assert(movieEngine.includes('root.__capsuleOpenSkazChoices(movie,false)'));
  assert(bundle.includes('card.__capsuleMixedMedia=true'));
  assert(bundle.includes('if(object.movie.__capsuleMixedMedia){call([]);return;}'));
});
test('second film launch offers Skaz instead of repeating a broken Amedia URL',()=>{
  assert(movieEngine.includes('var filmAttempts=Object.create(null)'));
  assert(movieEngine.includes('if(prior&&now-prior.at<3*60*1000)'));
  assert(movieEngine.includes('root.__capsuleAmediaFilmMarkFailure=function(movie)'));
  assert(movieEngine.includes('root.__capsuleAmediaFilmMarkSuccess=function(movie)'));
  assert(movieEngine.includes('root.__capsuleAmediaFilmMarkSuccess(job.ctx.movie)'));
  assert(movieEngine.includes('if(opening||now-lastLaunch<750)'));
});
test('malformed response and stale filter selection do not throw before recovery',()=>{
  const core=bundle.slice(0,bundle.indexOf(marker));
  assert(core.includes("if(!selectedItem||!selectedItem.url)return;"));
  assert(core.includes("if(!json||typeof json!=='object')json={};"));
});

test('film fallback shows actual Skaz balancers, but mixed series still uses the curated list',()=>{
  const core=bundle.slice(0,bundle.indexOf(marker));
  const eligible=core.slice(core.indexOf('function eligibleProvider(row)'),
                            core.indexOf('var serialProviderSlots='));
  assert(eligible.includes("if(!object.capsuleFallback||object.movie.__capsuleMixedMedia)"));
  assert(eligible.includes('return allowedSeriesProvider(row)'));
  assert(eligible.includes("typeof row.url==='string'"));
  assert(core.includes("if(!object.capsuleFallback||object.movie.__capsuleMixedMedia)"));
  assert(core.includes('completeSerialCatalog();'));
  assert(core.includes("Нет доступных источников Skaz"));
});
test('film and TV card classification is shared by search, metadata and rows',()=>{
  const core=bundle.slice(0,bundle.indexOf(marker));
  assert(core.includes('function isEpisodeMedia(movie)'));
  assert.equal((core.match(/query.push\('serial=' \+ \(isEpisodeMedia\(object.movie\) \? 1 : 0\)\);/g)||[]).length,2);
  assert(core.includes('var serial = isEpisodeMedia(object.movie)'));
  assert(core.includes('if(!isEpisodeMedia(object.movie) || !isFinite(id)'));
});
test('clarification search state tolerates older JSON-string values',()=>{
  const core=bundle.slice(0,bundle.indexOf(marker));
  assert(core.includes('function readClarificationStore()'));
  assert(core.includes('try{stored=JSON.parse(stored);}catch(e){stored={};}'));
  assert(!core.includes("Lampa.Storage.get('clarification_search','{}')"));
});

test('behavior: shared classification does not mistake a movie with both title and name for TV',()=>{
  const core=bundle.slice(0,bundle.indexOf(marker));
  const src=core.slice(core.indexOf('function isEpisodeMedia(movie)'),
       core.indexOf('// A second attempt at a broken FILM',core.indexOf('function isEpisodeMedia(movie)')));
  const check=vm.runInNewContext('(function(){'+src+'return isEpisodeMedia})()');
  assert.equal(check({id:100,title:'Movie',name:'Movie',release_date:'2026-01-01'}),false);
  assert.equal(check({id:100,title:'Movie',__capsuleMixedMedia:true}),true);
  assert.equal(check({id:100,name:'Series',number_of_seasons:3}),true);
});
test('behavior: film fallback allows a genuine non-serial Skaz provider without relaxing TV mode',()=>{
  const core=bundle.slice(0,bundle.indexOf(marker));
  const from=core.indexOf('function eligibleProvider(row)');
  const src=core.slice(from,core.indexOf('// Always show these seven named entries',from));
  const make=vm.runInNewContext('(function(object,allowedSeriesProvider){'+src+'return eligibleProvider})');
  const movie=make({capsuleFallback:true,movie:{}},()=>false);
  const show=make({capsuleFallback:true,movie:{__capsuleMixedMedia:true}},
       row=>row.balanser==='rezka');
  assert(movie({balanser:'film-cdn',url:'https://skaz.invalid/movie',show:true}));
  assert.equal(movie({balanser:'empty',url:'',show:true}),false);
  assert.equal(show({balanser:'film-cdn',url:'https://skaz.invalid/movie'}),false);
  assert.equal(show({balanser:'rezka',url:'https://skaz.invalid/serial'}),true);
});
test('behavior: second film tap opens Skaz, successful playback clears pending fallback',async()=>{
  // Replace only the lazy Amedia installer with a stub. Test the REAL outer
  // retry router, without executing upstream obfuscated/remote code.
  const head=movieEngine.slice(0,movieEngine.indexOf('    function installMovieEngine(){'));
  const tail=movieEngine.slice(movieEngine.lastIndexOf('    root.__capsuleAmediaFilmPlay=function(movie){'));
  const stub='    function installMovieEngine(){installed=true;root.__capsuleAmediaFilmPlayBridge=function(){root.calls++;return Promise.resolve()};}';
  let current=1000,redirects=[];
  const window={calls:0,Lampa:{Storage:{get(k,d){return d;},set(){}},
       Platform:{is(){return false;}},Noty:{show(){}}}};
  window.__capsuleOpenSkazChoices=(movie,mixed)=>{redirects.push({id:movie.id,mixed});return true};
  vm.runInNewContext(head+stub+tail,{window,Date:{now(){return current;}},Promise,console});
  const card={id:197,title:'A Film'};
  await window.__capsuleAmediaFilmPlay(card);
  assert.equal(window.calls,1);
  current=2000;
  await window.__capsuleAmediaFilmPlay(card);
  assert.equal(window.calls,1);
  assert.equal(redirects.length,1);
  assert.equal(redirects[0].mixed,false);
  current=3000;
  await window.__capsuleAmediaFilmPlay(card);
  assert.equal(window.calls,2);
  window.__capsuleAmediaFilmMarkSuccess(card);
  current=4000;
  await window.__capsuleAmediaFilmPlay(card);
  assert.equal(window.calls,3);
  assert.equal(redirects.length,1);
});
