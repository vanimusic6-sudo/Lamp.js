'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const bundle = fs.readFileSync(path.join(__dirname,'..','capsule-online.js'),'utf8');
const marker='/* CAPSULE AUTOPICK MODULE START */';
assert(bundle.includes(marker),'Must have embedded source and in-file automation');
assert(!bundle.includes('/* CAPSULE AMEDIA MOVIE ENGINE START */'));
const script=bundle.slice(bundle.indexOf(marker)+marker.length);
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

test('serial recommendation prefers reliable sources but ignores advertised 4K labels',()=>{
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

test('quality chooses best available in auto and respects explicit 1080 limit',()=>{
    const h=fixture(),helpers=h.win.__capsuleSkazOnlineDebug;
    const options={'480p':'https://a.test/480','1080p':'https://a.test/1080','4K':'https://a.test/4k'};
    const best=helpers.qualityCandidate(options);
    assert.equal(best.height,2160);
    h.store.capsule_skaz_online_quality='1080';
    assert.equal(helpers.qualityCandidate(options).height,1080);
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

test('Capsule Online button works on modern Lampa layouts',()=>{
    assert(bundle.includes('<span>Capsule Online</span>'));
    assert(bundle.includes('capsule-online--button'));
    assert(bundle.includes("var bar = activityRoot.find('.full-start-new__buttons"));
    assert(bundle.includes("if (activityRoot.find('.capsule-online--button').length) return"));
});

test('one Skaz screen is installed without setting the upstream plugin flag',()=>{
    const core=bundle.slice(0,bundle.indexOf(marker));
    assert(core.includes('window.capsule_amedia_core_plugin = true;'));
    assert(!core.includes('window.onlyskaz_plugin'));
    assert(!core.includes("Lampa.Component.add('lampacskaz'"));
    assert(!core.includes("component: 'lampacskaz'"));
    assert(core.includes("Lampa.Component.add('capsuleamedia'"));
});

test('autoselection logic remains inside the downloaded plugin and uses private selection keys',()=>{
    assert(script.includes('function sourceOrder(rows,movie)'));
    assert(script.includes('function voiceScore('));
    assert(script.includes('function qualityCandidate('));
    assert(bundle.includes('amedia_auto_last_balanser'));
    assert(bundle.includes('amedia_auto_choice_'));
});


test('film button triggers one headless Skaz request with no activity navigation',()=>{
    const core=bundle.slice(0,bundle.indexOf(marker));
    const store={},events={},components={},added=[];
    let movieClicks=0,openedMovie=null;
    const missing={length:0,first(){return this;},append(){return this;},
        prepend(){return this;},before(){return this;},after(){return this;}};
    const bar={length:1,first(){return this;},prepend(button){added.push(button);return this;}};
    const root={
        length:1,
        find(selector){
            if(selector === '.capsule-online--button')
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
        Reguest:function(){this.silent=function(url,ok,fail){movieClicks++;openedMovie=url;if(fail)fail();};this.clear=function(){};this.timeout=function(){};},
        Utils:{uid(){return 'unit1234';},hash(){return 'unit';},putScript(){},
            addUrlComponent(url,part){return url+(url.includes('?')?'&':'?')+part;}},
        Platform:{is(){return false;}},
        Manifest:{app_digital:0,add(){}},
        Component:{add(k,v){components[k]=v;}},
        Lang:{translate(x){return x;},add(){}},
        Template:{add(){},get(){return $(null);}},
        Loading:{start(){},stop(){}},
        Listener:{follow(k,fn){events[k]=fn;}},
        Activity:{active(){return {component:'full',activity:{render(){return root;}}};},push(data){movieClicks++;openedMovie=data;}}
    };
    const window={rch_nws:null,console,location:{host:'lampa.local'}};
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
    assert.match(added[0].source,/class="[^"]*capsule-online--button/);
    assert.match(added[0].source,/<span>Capsule Online<\/span>/);
    added[0].handlers['hover:enter']();
    added[0].handlers.click();
    assert.equal(movieClicks,1,'one movie click must not run twice');
    assert.match(openedMovie,/lite\/events\?life=true/);
    assert.match(openedMovie,/serial=0/);
    assert.equal(added.length,1,'single button remains after retry');
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
    assert.deepEqual(names,['hdrezka','kinopub']);
});
test('wrapper refuses to rank unapproved providers',()=>{
    const h=fixture(),items=[{name:'Umbrella 4K',url:'https://a.test',show:true}];
    assert.deepEqual(Array.from(h.win.__capsuleSkazOnlineDebug.sourceOrder(items)),[]);
    assert.equal(h.store.amedia_auto_active_balanser,undefined);
});

test('films use headless Skaz without calling the old Amedia engine',()=>{
    const core=bundle.slice(0,bundle.indexOf(marker));
    assert(core.includes('window.__capsuleFilmAutoLaunch(movie)'));
    assert(core.includes('Lampa.Player.play(data);'));
    assert(!bundle.includes('window.__capsuleAmediaFilmPlay='));
    assert(!script.includes("items.eq(0).trigger('hover:enter')"));
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


test('hybrid UI does not keep obsolete film auto-click setting',()=>{
    assert(!script.includes("['autoplay','Автозапуск фильмов'"));
    assert(script.includes('Автовыбор для фильмов и сериалов'));
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
    assert.equal((core.match(/img\.loading='lazy'/g)||[]).length,2);
    assert.equal((core.match(/img\.decoding='async'/g)||[]).length,2);
    assert(core.includes('usePosterThumb(img,image)'));
    assert(script.includes('cso-poster-fallback'));
});


test('startup performs no eager Skaz RCH network probe',()=>{
    const core=bundle.slice(0,bundle.indexOf(marker));
    assert(!core.includes("window.rch_nws[hostkey].typeInvoke('http://online'+dd+'3.skaz.tv', function() {});"));
    assert(core.includes('typeInvoke('),'RCH negotiation must remain available on demand');
});


test('the embedded source core hard-filters providers before presenting to the UI',()=>{
    const body=bundle.slice(0,bundle.indexOf(marker));
    assert(body.includes('window.__capsuleSerialAllowed=allowedSeriesProvider'));
    assert(body.includes('if(!row||!eligibleProvider(row))return;'));
    assert(body.includes('filter_sources=Object.keys(sources)'));
    assert(body.includes('return !!(sources[key]&&sources[key].show&&'));
    assert(body.includes('var next=sources[name]'));
    assert(!body.includes("get('amedia_auto_balanser', filter_sources[0])"));
});

test('series keep availability order and films use ranking without polling',()=>{
    const slice=script.slice(script.indexOf('function sourceOrder(rows,movie)'),script.indexOf('function voiceScore(label)'));
    assert(slice.includes('original:index'));
    assert(slice.includes('if(film)result.sort('));
    const core=bundle.slice(0,bundle.indexOf(marker));
    const start=core.indexOf('this.startSource = function(json)');
    const end=core.indexOf('this.lifeSource = function()',start);
    const region=core.slice(start,end);
    assert(region.includes('balanser=pin&&sources[pin]&&filmValidUrl(sources[pin].url,true)?pin:ready[0]'));
    assert(!region.includes("Lampa.Storage.get('amedia_auto_balanser'"));
    const doesNotAnswer=core.slice(core.indexOf('this.doesNotAnswer = function'),core.indexOf('this.getLastEpisode = function'));
    assert(!doesNotAnswer.includes('setInterval('));
});

test('strict serial provider helper accepts only known provider identities',()=>{
    const h=fixture();
    // wrapper helpers are independently checked to prevent fake names/metadata.
    const sourceOrder=h.win.__capsuleSkazOnlineDebug.sourceOrder;
    const good=['Rezka','HDRezka','Alloha','Filmix','Skaz TV','KinoPub'];
    const rows=good.map(name=>({name,url:'https://test.invalid/'+encodeURIComponent(name),show:true}));
    rows.unshift({name:'Umbrella Filmix',url:'https://test.invalid/x',show:true});
    rows.push({name:'UHD Umbrella 8K',url:'https://test.invalid/y',show:true});
    assert.equal(sourceOrder(rows).length,good.length);
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
        ['alloha','rezka','filmix','kinopub','hdrezka','skaztv']);
    assert.equal(filters.sort[2].ghost,false,'Temporarily unavailable Filmix has a manual retry URL');
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
        ['alloha','rezka','filmix','kinopub','hdrezka','skaztv']);
    assert.equal(filters.sort[0].ghost,false,'Alloha keeps its manual URL during partial lifeevents');
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
  assert(core.includes('ghost: !filmValidUrl(sources[e].url,true)'));
  assert(core.includes('var ready=Object.keys(sources).filter(function(key)'));
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
  assert(!bundle.includes('CAPSULE AMEDIA MOVIE ENGINE START'));
  assert(bundle.includes('window.__capsuleOpenSkazChoices=function(movie)'));
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
  new Function('$','object','document','isEpisodeMedia','filmVoiceBlocked',src).call(holder,$,
    {movie:{name:'Series'}},{},()=>true,()=>false);
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
  new Function('object','Lampa','setTimeout','clearTimeout','isEpisodeMedia',src).call(holder,
    {movie:{id:55,name:'Series',source:'tmdb'}},Lampa,
    (fn,ms)=>{tasks.push({fn,ms});return tasks.length;},()=>{},()=>true);
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
test('malformed response and stale filter selection do not throw before recovery',()=>{
  const core=bundle.slice(0,bundle.indexOf(marker));
  assert(core.includes("if(!selectedItem||!selectedItem.url)return;"));
  assert(core.includes("if(!json||typeof json!=='object')json={};"));
});

test('films use actual Skaz providers and TV series keep their curated list',()=>{
  const core=bundle.slice(0,bundle.indexOf(marker));
  const eligible=core.slice(core.indexOf('function eligibleProvider(row)'),
                            core.indexOf('var serialProviderSlots='));
  assert(eligible.includes('allowedSeriesProvider(row)'));
  assert(eligible.includes('isEpisodeMedia(object.movie)||filmItemAllowed(object.movie,row)'));
  assert(eligible.includes("filmItemAllowed(object.movie,row)"));
  assert(core.includes("if(isEpisodeMedia(object.movie))"));
  assert(core.includes('completeSerialCatalog();'));
  assert(core.includes("Нет подходящих источников фильма в Skaz"));
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
       core.indexOf('function balanserName(row)',core.indexOf('function isEpisodeMedia(movie)')));
  const check=vm.runInNewContext('(function(){'+src+'return isEpisodeMedia})()');
  assert.equal(check({id:100,title:'Movie',name:'Movie',release_date:'2026-01-01'}),false);
  assert.equal(check({id:100,title:'Movie',name:'Series',media_type:'movie',number_of_seasons:2}),false);
  assert.equal(check({id:100,name:'Series',number_of_seasons:3}),true);
});
test('behavior: film source eligibility validates URLs without relaxing series allowlist',()=>{
  const core=bundle.slice(0,bundle.indexOf(marker));
  const from=core.indexOf('function eligibleProvider(row)');
  const src=core.slice(from,core.indexOf('// Pure helpers also serve',from));
  const make=vm.runInNewContext('(function(object,allowedSeriesProvider,filmItemAllowed,isEpisodeMedia,isMirKinoZ){'+src+'return eligibleProvider})');
  const movie=make({movie:{}},row=>row.balanser==='alloha',()=>true,()=>false,()=>false);
  const show=make({movie:{type:'tv'}},row=>row.balanser==='rezka',()=>true,()=>true,()=>false);
  assert.equal(movie({balanser:'film-cdn',url:'https://skaz.invalid/movie',show:true}),false);
  assert.equal(movie({balanser:'alloha',url:'https://skaz.invalid/movie',show:true}),true);
  assert.equal(movie({balanser:'alloha',url:'javascript:bad',show:true}),false);
  assert.equal(show({balanser:'film-cdn',url:'https://skaz.invalid/movie'}),false);
  assert.equal(show({balanser:'rezka',url:'https://skaz.invalid/serial'}),true);
});

function isolatedFilmHelpers(movie){
  const core=bundle.slice(0,bundle.indexOf(marker));
  const begin=core.indexOf('function isEpisodeMedia(movie)');
  const outerEnd=core.indexOf('function component(object)',begin);
  const inner=core.indexOf('function eligibleProvider(row)',outerEnd);
  const end=core.indexOf('// Pure helpers also serve',inner);
  assert(begin>0&&outerEnd>begin&&inner>outerEnd&&end>inner);
  const text=core.slice(begin,outerEnd)+core.slice(inner,end);
  const make=vm.runInNewContext(
    '(function(object,balanserName,allowedSeriesProvider){'+text+
      'return {isEpisodeMedia,filmSourceScore,filmItemAllowed,eligibleProvider};})',
    {window:{}});
  const funcs=make({movie},
    row=>String(row&&row.balanser||row&&row.name||'').toLowerCase().trim(),
    row=>['rezka','alloha','filmix'].includes(row.balanser));
  const raw=funcs.filmItemAllowed;
  funcs.filmItemAllowed=row=>raw(movie,row);
  return funcs;
}
test('Amedia film engine and button are entirely gone from the executable bundle',()=>{
  assert(!bundle.includes('CAPSULE AMEDIA MOVIE ENGINE START'));
  assert(!bundle.includes('window.__capsuleAmediaFilmPlay'));
  assert(!bundle.includes('Amedia · Capsule Online'));
  assert(!bundle.includes('<span>Amedia</span>'));
  assert(bundle.includes('<span>Capsule Online</span>'));
  assert(bundle.includes("component:'capsuleamedia'"),'Stable internal component ID is retained');
});
test('film title and provider metadata never overwrite the original Lampa movie title',()=>{
  const core=bundle.slice(0,bundle.indexOf(marker));
  assert(!core.includes('object.movie.title = json.title'));
  assert(!core.includes('object.movie.name = json.title'));
  assert(core.includes("query.push('serial=' + (isEpisodeMedia(object.movie) ? 1 : 0))"));
});
test('strict film identity accepts matching originals and rejects wrong titles or years',()=>{
  const {filmItemAllowed:allowed}=isolatedFilmHelpers({
    media_type:'movie',title:'Дюна',original_title:'Dune',
    imdb_id:'tt1160419',release_date:'2021-10-22'
  });
  assert.equal(allowed({method:'play',movie_title:'Dune',year:'2021'}),true);
  assert.equal(allowed({method:'call',movie_title:'Дюна',year:'2022'}),true);
  assert.equal(allowed({method:'play',movie_title:'Titanic',year:2021}),false);
  assert.equal(allowed({method:'play',movie_title:'Dune',year:1984}),false);
  assert.equal(allowed({method:'play',imdb_id:'tt0000000'}),false);
  assert.equal(allowed({method:'play',season:1,episode:1}),false);
  assert.equal(allowed({method:'play',serial:'true'}),false);
  assert.equal(allowed({method:'link',text:'Сезон 1'}),false);
  assert.equal(allowed({method:'play',text:'Дубляж'}),true,'Voice label is not a movie-title mismatch');
});
test('strict Skaz source eligibility never admits executable URL schemes',()=>{
  const h=isolatedFilmHelpers({title:'Some Film',media_type:'movie'});
  assert.equal(h.eligibleProvider({balanser:'rezka',url:'https://example.invalid/film'}),true);
  assert.equal(h.eligibleProvider({balanser:'rezka',url:'javascript:alert(1)'}),false);
  assert.equal(h.eligibleProvider({balanser:'rezka',url:'//untrusted.invalid/x'}),false);
  assert.equal(h.eligibleProvider({balanser:'rezka',url:'https://example.invalid/show',serial:true}),false);
  const tv=isolatedFilmHelpers({name:'TV Show',media_type:'tv'});
  assert.equal(tv.eligibleProvider({balanser:'rezka',url:'https://example.invalid/tv'}),true);
  assert.equal(tv.eligibleProvider({balanser:'unknown',url:'https://example.invalid/tv'}),false);
});

test('film source orders: Alloha first by default, Mir Kino Z first in maximum mode',()=>{
  const core=bundle.slice(0,bundle.indexOf(marker));
  const start=core.indexOf('function filmSourceFamily(row)');
  const end=core.indexOf('function sameFilmTitle(a,b)',start);
  assert(start>0&&end>start);
  const store={capsule_skaz_online_quality:'auto'};
  const lampa={Storage:{get(k,d){return Object.hasOwn(store,k)?store[k]:d;}}};
  const make=new Function('balanserName','isMirKinoZ','forbiddenVoice','Lampa','window',
    core.slice(start,end)+'return {filmSourceScore,filmSourceOrder,filmKidsMode,filmVoiceBlocked};');
  const helpers=make(row=>row.balanser||'',row=>/^mir/.test(row.balanser||''),
    ()=>false,lampa,{});
  const score=id=>helpers.filmSourceScore({balanser:id});
  const normal=['alloha','filmix','kinopub','mirkinoz','rezka','hdrezka','skaztv'];
  assert.deepEqual(Array.from(helpers.filmSourceOrder()),normal);
  for(let i=0;i<normal.length-1;i++)
    assert(score(normal[i])>score(normal[i+1]),normal[i]+' must outrank '+normal[i+1]);
  store.capsule_skaz_online_quality='max';
  const maximal=['mirkinoz','filmix','alloha','kinopub','rezka','hdrezka','skaztv'];
  assert.deepEqual(Array.from(helpers.filmSourceOrder()),maximal);
  for(let i=0;i<maximal.length-1;i++)
    assert(score(maximal[i])>score(maximal[i+1]),maximal[i]+' must outrank '+maximal[i+1]);
  store.capsule_skaz_online_quality='auto';
  const ui=fixture(),movie={id:77,title:'Film',media_type:'movie'};
  ui.win.__capsuleFilmHelpers={isSeries:()=>false,allow:()=>true,
    sourceScore:r=>helpers.filmSourceScore(r)};
  ui.win.__capsuleFilmPriorities={sources:()=>helpers.filmSourceOrder()};
  const list=ui.win.__capsuleSkazOnlineDebug.sourceOrder([
    {balanser:'rezka',name:'Rezka',url:'https://r.invalid',show:true},
    {balanser:'alloha',name:'Alloha',url:'https://a.invalid',show:true},
    {balanser:'filmix',name:'Filmix',url:'https://f.invalid',show:true},
    {balanser:'kpu',name:'КПУ',url:'https://k.invalid',show:true},
    {balanser:'mirkinoz',name:'Мир кино Z',url:'https://m.invalid',show:true},
    {balanser:'umbrella',name:'Umbrella',url:'https://u.invalid',show:true}
  ],movie);
  assert.deepEqual(Array.from(list,r=>r.key),['alloha','filmix','kpu','mirkinoz','rezka']);
});

test('film variant auto ranking prefers an established voice to CAM 4K',()=>{
  const h=fixture(),rank=h.win.__capsuleSkazOnlineDebug.filmVideoScore;
  const good={method:'play',text:'LostFilm 1080p',quality:{'1080p':'https://example.invalid/a'}};
  const poor={method:'play',text:'CAM 4K',quality:{'2160p':'https://example.invalid/b'}};
  assert(rank(good)>rank(poor));
});
test('film URL resolution failure triggers a bounded provider fallback',()=>{
  const h=fixture(),film={id:776,title:'A Film',media_type:'movie'};
  h.win.__capsuleFilmHelpers={
    isSeries:()=>false,allow:()=>true,
    sourceScore:r=>r.balanser==='rezka'?120:90
  };
  const view=h.instance(film);
  view.startSource([
    {balanser:'rezka',name:'Rezka',url:'https://example.invalid/r',show:true},
    {balanser:'filmix',name:'Filmix',url:'https://example.invalid/f',show:true}
  ]);
  h.store.amedia_auto_active_balanser='rezka';
  let called=0;
  view.getFileUrl({url:''},()=>called++);
  assert.equal(called,1);
  assert.equal(view.changed,'filmix');
  assert.equal(view.__csoSession.manualSelection,false);
});
test('manual film provider choice is never overridden by failed-link autoselection',()=>{
  const h=fixture(),film={id:775,title:'A Film',media_type:'movie'};
  h.win.__capsuleFilmHelpers={
    isSeries:()=>false,allow:()=>true,
    sourceScore:r=>r.balanser==='rezka'?120:90
  };
  const view=h.instance(film);
  view.startSource([
    {balanser:'rezka',name:'Rezka',url:'https://example.invalid/r',show:true},
    {balanser:'filmix',name:'Filmix',url:'https://example.invalid/f',show:true}
  ]);
  view.changeBalanser('filmix');
  h.store.amedia_auto_active_balanser='filmix';
  view.getFileUrl({url:''},()=>{});
  assert.equal(view.changed,'filmix');
  assert.equal(view.__csoSession.manualSelection,true);
});

test('film auto-ranking obeys the switch without affecting the series-only allowlist',()=>{
  const core=bundle.slice(0,bundle.indexOf(marker));
  assert(core.includes("Lampa.Storage.get('capsule_skaz_online_auto',true)"));
  assert(core.includes('if(!isEpisodeMedia(object.movie)&&automaticSelectionEnabled()){'));
  assert(script.includes("if(get('auto',true)&&!isSeries(movie)&&Array.isArray(videos)"));
});

test('Alloha remains selectable when lifeevents is partial or empty',async()=>{
  const core=bundle.slice(0,bundle.indexOf(marker));
  assert(core.includes('if(attempts>=2)return settle(null,all);'));
  assert(core.includes('if(attempts>=2)return settle(null,[]);'));
  assert(core.includes('var ready=Object.keys(sources).filter(function(key)'));
  assert(core.includes('if(!next||!filmValidUrl(next.url,true))'));
  assert(!core.includes('if(!next||next.show===false||!next.url)'));
});
test('all six families remain allowed but ad-supported aggregators are excluded from film auto launch',()=>{
  const core=bundle.slice(0,bundle.indexOf(marker));
  assert(core.includes('if(!row||!allowedSeriesProvider(row)||!filmItemAllowed(movie,row)'));
  assert(script.includes('if(!providerFamily(row)||'));
  const h=fixture(),allowed=h.win.__capsuleSkazOnlineDebug.sourceOrder([
    {name:'Umbrella Filmix',balanser:'umbrella',url:'https://bad.invalid',show:true},
    {name:'Alloha',balanser:'alloha',url:'https://alloha.invalid',show:true},
    {name:'Filmix',balanser:'filmix',url:'https://filmix.invalid',show:true},
    {name:'Rezka',balanser:'rezka',url:'https://rezka.invalid',show:true},
    {name:'KinoPub',balanser:'kinopub',url:'https://kinopub.invalid',show:true},
    {name:'Skaz TV',balanser:'skaztv',url:'https://skaz.invalid',show:true},
    {name:'Veo Veo',balanser:'veoveo',url:'https://veo.invalid',show:true}
  ]);
  assert.deepEqual(Array.from(allowed,x=>x.key),
    ['alloha','rezka','filmix','kinopub','skaztv']);
});
test('headless movie route plays a verified Alloha stream without opening an interface or Umbrella',()=>{
  const core=bundle.slice(0,bundle.indexOf(marker));
  const opened=[],streams=[],skazCalls=[],screens=[],store={};
  const rows=[
    {'data-json':JSON.stringify({
      method:'play',url:'https://cdn.invalid/allohafilm.m3u8',
      quality:{'1080p':'https://cdn.invalid/allohafilm-1080.m3u8'},
      text:'RHS Дубляж'
    }),text:'RHS Дубляж'}
  ];
  function fake$(value){
    if(typeof value==='string'){
      return {
        length:1,
        append(){return this;},html(){return this;},
        find(selector){
          return {each(fn){
            if(selector==='.videos__item')rows.forEach(row=>fn.call(row));
          }};
        }
      };
    }
    return {attr(k){return value[k];},text(){return value.text||'';}};
  }
  function Reguest(){
    this.timeout=function(){};
    this.clear=function(){};
    this.silent=function(url,ok){
      skazCalls.push(url);
      ok({life:false,online:[
        {balanser:'umbrella',name:'Umbrella 8K',
          url:'https://ads.invalid/film',show:true},
        {balanser:'alloha',name:'Alloha',
          url:'https://alloha.invalid/film',show:true}
      ]});
    };
    this.native=function(url,ok){
      streams.push(url);
      ok('<div class="videos__item"></div>');
    };
  }
  const Lampa={
    Storage:{
      get(k,defaultValue){return Object.hasOwn(store,k)?store[k]:defaultValue;},
      set(k,v){store[k]=v;},cache(k,life,d){return d;},
      field(){return 'inner';}
    },
    Platform:{is(){return false;}},
    Reguest,
    Utils:{
      uid(){return 'unitid123';},hash(v){return String(v);},
      putScript(){},addUrlComponent(url,piece){
        return url+(url.includes('?')?'&':'?')+piece;
      }
    },
    Manifest:{app_digital:0,add(){}},Template:{add(){},get(){return {length:1,append(){return this;}};}},
    Component:{add(){}},Lang:{translate(x){return x;},add(){}},
    Listener:{follow(){}},Loading:{start(){},stop(){}},Noty:{show(){}},
    Player:{
      play(data){opened.push(data);},
      playlist(data){screens.push(data);}
    },
    Favorite:{add(){}},
    Activity:{push(){throw Error('Movie should not open a source screen');}}
  };
  const window={rch_nws:null,console,location:{host:'lampa.local'}};
  vm.runInNewContext(core,{window,Lampa,$:fake$,location:window.location,
      console,setTimeout(){return 1;},clearTimeout(){},
      setInterval(){return 1;},clearInterval(){}},{timeout:5000});
  const result=window.__capsuleFilmAutoLaunch({
    id:100,title:'Test Film',media_type:'movie',release_date:'2026-01-01'
  });
  assert.equal(result,true);
  assert.equal(skazCalls.length,1);
  assert.equal(streams.length,1,'Only Alloha may be inspected');
  assert.match(streams[0],/alloha\.invalid\/film/);
  assert.equal(opened.length,1,'Film auto-plays without Activity.push');
  assert.equal(opened[0].url,'https://cdn.invalid/allohafilm-1080.m3u8');
  assert.equal(screens.length,1);
});

test('Dragon Money Studio and ad-promoted voices are never eligible',()=>{
  const core=bundle.slice(0,bundle.indexOf(marker));
  const start=core.indexOf('function forbiddenVoice(value)');
  const end=core.indexOf('window.__capsuleNoAdVoice=forbiddenVoice',start);
  assert(start>0&&end>start);
  const ban=vm.runInNewContext('(function(){'+core.slice(start,end)+'return forbiddenVoice})()');
  for(const label of ['Dragon Money Studio','Драгон Мани студио','DragonMoney','1xBet озвучка',
    'Спонсорская рекламная озвучка','Промокод казино','JoyCasino Dub'])
      assert.equal(ban(label),true,label);
  for(const label of ['RHS','RedHeadSound','LostFilm','Кубик в Кубе','NewStudio'])
      assert.equal(ban(label),false,label);
  assert(core.includes("if(filmVoiceBlocked(title)||filmVoiceBlocked(data.voice_name||data.translate_voice||''))"));
  assert(core.includes('filmVoiceBlocked(item.text||item.voice_name)'));
  assert(core.includes('parsed.voices.concat(parsed.links)'));
});
test('audio-language setting differentiates Russian, Ukrainian, English and unknown',()=>{
  const core=bundle.slice(0,bundle.indexOf(marker));
  const start=core.indexOf('function playbackLanguage()');
  const end=core.indexOf('function filmMinutes(value,unit)',start);
  assert(start>0&&end>start);
  const make=vm.runInNewContext('(function(Lampa){'+core.slice(start,end)+
    'return {playbackLanguage,sourceLanguage,languageAccepted}})');
  const store={},lang=make({Storage:{get(k,def){return Object.hasOwn(store,k)?store[k]:def;}}});
  assert.equal(lang.sourceLanguage({voice_name:'Українська озвучка'}),'uk');
  assert.equal(lang.sourceLanguage({voice_name:'RHS / Дубляж'}),'ru');
  assert.equal(lang.sourceLanguage({voice_name:'English original'}),'en');
  assert.equal(lang.sourceLanguage({voice_name:'Неизвестный перевод'}),'');
  assert.equal(lang.playbackLanguage(),'auto');
  assert.equal(lang.languageAccepted({voice_name:'Українська озвучка'}),false);
  assert.equal(lang.languageAccepted({voice_name:'RHS / Дубляж'}),true);
  store.capsule_skaz_online_language='ru';
  assert.equal(lang.languageAccepted({voice_name:'Неизвестный перевод'}),false);
  assert.equal(lang.languageAccepted({voice_name:'RHS / Дубляж'}),true);
  assert.equal(lang.languageAccepted({voice_name:'Українська озвучка'},'RHS'),false);
  store.capsule_skaz_online_language='uk';
  assert.equal(lang.languageAccepted({voice_name:'Українська озвучка'}),true);
  store.capsule_skaz_online_language='en';
  assert.equal(lang.languageAccepted({voice_name:'English original'}),true);
  assert(script.includes("['language','Язык воспроизведения'"));
});
test('similar titles never match sequel or unrelated prefix',()=>{
  const core=bundle.slice(0,bundle.indexOf(marker));
  const start=core.indexOf('function sameFilmTitle(a,b)');
  const end=core.indexOf('function playbackLanguage()',start);
  assert(start>0&&end>start);
  const match=vm.runInNewContext('(function(){'+core.slice(start,end)+'return sameFilmTitle})()');
  assert.equal(match('Toy Story','Toy Story 2'),false);
  assert.equal(match('История игрушек','История игрушек 3'),false);
  assert.equal(match('Dune','Dune: Part Two'),false);
  assert.equal(match('Dune 2021','Dune'),true);
  assert.equal(match('История игрушек','История игрушек'),true);
});
test('runtime checks prefer confirmed movie version and reject incompatible source durations',()=>{
  const core=bundle.slice(0,bundle.indexOf(marker));
  const start=core.indexOf('function filmMinutes(value,unit)');
  const end=core.indexOf('function filmItemAllowed(movie,row)',start);
  assert(start>0&&end>start);
  const fn=vm.runInNewContext('(function(){'+core.slice(start,end)+
    'return {filmMinutes,filmKnownMinutes,filmRuntimeMatches,chooseVerifiedRuntime}})()');
  assert.equal(fn.filmMinutes('01:35:00'),95);
  assert.equal(fn.filmKnownMinutes({duration_seconds:5700}),95);
  assert.equal(fn.filmRuntimeMatches(95,99),true);
  assert.equal(fn.filmRuntimeMatches(95,140),false);
  const pool=[
    {file:{runtime:95},stream:{url:'https://a.invalid'}},
    {file:{runtime:98},stream:{url:'https://b.invalid'}},
    {file:{runtime:142},stream:{url:'https://c.invalid'}}
  ];
  assert.equal(fn.chooseVerifiedRuntime(pool,95).length,2);
  assert.equal(fn.chooseVerifiedRuntime(pool,0).length,2);
  assert.equal(fn.chooseVerifiedRuntime([pool[0],pool[2]],0).length,0);
  assert(core.includes("tmdb.get('movie/'+id,{}"));
  assert(core.includes('длительности версий расходятся'));
});
test('Mir Kino Z replaces Veo, only film mode admits it, and ad sources remain out',()=>{
  const core=bundle.slice(0,bundle.indexOf(marker));
  const start=core.indexOf('function allowedSeriesProvider(row)');
  const end=core.indexOf('window.__capsuleSerialAllowed=allowedSeriesProvider',start);
  assert(start>0&&end>start);
  const allowed=vm.runInNewContext('(function(){'+core.slice(start,end)+
    'return allowedSeriesProvider})()');
  assert.equal(allowed({balanser:'veoveo',name:'Veo Veo'}),false);
  assert.equal(allowed({balanser:'mirkinoz',name:'Мир кино Z'}),true);
  assert.equal(allowed({balanser:'mirkino',name:'Мир кино Z'}),true);
  assert.equal(allowed({balanser:'umbrella',name:'Umbrella 4K'}),false);
  assert(core.includes('if(isEpisodeMedia(object.movie)&&isMirKinoZ(row))return false;'));
  assert(script.includes("if(!film&&providerFamily(row)==='mirkinoz')return"));
  assert(!core.includes("['veoveo','Veo Veo']"));
});
test('provider descriptions appear on long hold; missing images use the Lampa poster resolver',()=>{
  const core=bundle.slice(0,bundle.indexOf(marker));
  assert(core.includes("filter.render().find('.filter--sort').on('hover:long contextmenu'"));
  assert(core.includes("'hover:long.csoSources'"));
  assert(core.includes('csoDescription:sourceExplanation'));
  assert(core.includes("$(document).off('hover:long.csoSources')"));
  const start=core.indexOf('function posterThumbUrl(value)');
  const end=core.indexOf('var number_of_requests',start);
  assert(start>0&&end>start);
  const make=vm.runInNewContext('(function(Lampa,object){'+core.slice(start,end)+
    'return {episodePoster,posterThumbUrl}})');
  const api={
    Api:{img:path=>'https://lampa.invalid/image'+path},
    TMDB:{image:path=>'https://tmdb.invalid/'+path}
  };
  const h=make(api,{movie:{poster_path:'/movie123.jpg'}});
  assert.equal(h.episodePoster(),'https://lampa.invalid/image/movie123.jpg');
  assert.equal(h.posterThumbUrl('https://img.invalid/ready.jpg'),'https://img.invalid/ready.jpg');
  assert(script.includes('cso-poster-fallback'));
});

test('auto quality never assumes unknown bandwidth means 1080p; 4K HDR outranks 720p',()=>{
  const core=bundle.slice(0,bundle.indexOf(marker));
  const begin=core.indexOf('function filmQualityHeight(name)');
  const end=core.indexOf('function filmVoiceRank(label)',begin);
  assert(begin>0&&end>begin);
  const build=new Function('Lampa','window','filmValidUrl','filmSearchMode',core.slice(begin,end)+
    'return {filmQualityCeiling,filmQualityOptions,filmQualityChoice,filmStreamQuality,filmEffectiveQuality};');
  const store={capsule_skaz_online_quality:'auto'};
  const helpers=build({Storage:{get(k,d){return Object.hasOwn(store,k)?store[k]:d;}}},
    {},url=>/^https?:\/\//.test(url),()=> 'normal');
  assert.equal(helpers.filmQualityCeiling(),2160);
  const map={'720p':'https://cdn.invalid/720.m3u8',
    '2160p HDR':'https://cdn.invalid/4k-hdr.m3u8'};
  assert.equal(helpers.filmQualityChoice(map).height,2160);
  assert.equal(helpers.filmQualityChoice(map).hdr,true);
  const file={quality:map},stream={url:'https://cdn.invalid/720.m3u8',quality:{}};
  assert.equal(helpers.filmStreamQuality(file,stream)['2160p HDR'],map['2160p HDR']);
  assert.equal(helpers.filmEffectiveQuality(file,stream).height,2160);
  store.capsule_skaz_online_quality='720';
  assert.equal(helpers.filmQualityCeiling(),720);
  assert.equal(helpers.filmQualityChoice(map).height,720);
  store.capsule_skaz_online_quality='auto';
  const slow=build({Storage:{get(k,d){return Object.hasOwn(store,k)?store[k]:d;}}},
    {navigator:{connection:{downlink:5}}},url=>/^https?:\/\//.test(url),()=> 'economy');
  assert.equal(slow.filmQualityCeiling(),720);
});
test('end-to-end film selection probes Mir Kino Z AND Alloha RHS signed quality folder, prefers 4K over Rezka 720',()=>{
  const core=bundle.slice(0,bundle.indexOf(marker));
  const played=[],requests=[],messages=[];
  const store={capsule_skaz_online_language:'ru',capsule_skaz_online_quality:'auto'};
  const html={
    'REZKA_ROOT':{items:[{method:'play',url:'https://cdn.invalid/rezka720.m3u8',
      text:'RHS 720p',language:'ru',quality:{'720p':'https://cdn.invalid/rezka720.m3u8'}}]},
    'ALLOHA_ROOT':{buttons:[
      {method:'link',url:'https://alloha.invalid/dub?sig=VOICE',
        text:'RHS Русский',language:'ru'},
      {method:'link',url:'https://alloha.invalid/ua?sig=VOICE',
        text:'Українська озвучка',language:'uk'}
    ]},
    'ALLOHA_DUB':{links:[
      {method:'link',url:'https://alloha.invalid/quality?sig=QUALITY',text:'4K HDR'}
    ]},
    'ALLOHA_QUALITY':{items:[
      {method:'call',url:'https://alloha.invalid/file?sig=FILM',text:'2160p HDR',
        quality:{'720p':'https://cdn.invalid/alloha720.m3u8',
          '2160p HDR':'https://cdn.invalid/alloha4k.m3u8'}}
    ]},
    'MIR_ROOT':{items:[{method:'play',url:'https://cdn.invalid/mir1080.m3u8',
      text:'Русский 1080p',language:'ru',
      quality:{'1080p':'https://cdn.invalid/mir1080.m3u8'}}]}
  };
  function fake$(value){
    if(typeof value==='string'){
      const root={content:'',html(v){this.content=v;return this;},
        append(v){this.content=v;return this;},find(selector){
          const current=html[this.content]||{},list=selector==='.videos__button'?
            current.buttons||[]:selector==='.videos__item'?
              (current.items||[]).concat(current.links||[]):[];
          return {each(fn){list.forEach(row=>fn.call({
            'data-json':JSON.stringify(row),text:row.text||''
          }));}};
        }};
      return root;
    }
    return {attr(k){return value[k];},text(){return value.text||'';}};
  }
  function Reguest(){
    this.timeout=function(){};this.clear=function(){};
    this.silent=function(url,ok){
      requests.push(['catalog',url]);
      ok({life:false,online:[
        {balanser:'rezka',name:'Rezka',url:'https://rezka.invalid/search',show:true},
        {balanser:'alloha',name:'Alloha',url:'https://alloha.invalid/search',show:true},
        {balanser:'mir-kino',name:'Мир Кино Z 4K HDR',
          url:'https://mir.invalid/search',show:false},
        {balanser:'umbrella',name:'Umbrella 8K',
          url:'https://ads.invalid/search',show:true}
      ]});
    };
    this.native=function(url,ok){
      requests.push(['native',url]);
      if(url.includes('rezka.invalid/search'))return ok('REZKA_ROOT');
      if(url.includes('alloha.invalid/search'))return ok('ALLOHA_ROOT');
      if(url.includes('alloha.invalid/dub'))return ok('ALLOHA_DUB');
      if(url.includes('alloha.invalid/quality'))return ok('ALLOHA_QUALITY');
      if(url.includes('alloha.invalid/file'))return ok({
        url:'https://cdn.invalid/alloha720.m3u8',language:'ru',
        quality:{'720p':'https://cdn.invalid/alloha720.m3u8',
          '2160p HDR':'https://cdn.invalid/alloha4k.m3u8'},
        runtime:101
      });
      if(url.includes('mir.invalid/search'))return ok('MIR_ROOT');
      throw Error('Unexpected source '+url);
    };
  }
  const Lampa={
    Storage:{get(k,d){return Object.hasOwn(store,k)?store[k]:d;},
      set(k,v){store[k]=v;},cache(k,n,d){return d;},field(){return 'inner';}},
    Reguest,Platform:{is(){return false;}},Utils:{
      uid(){return 'abcdefgh';},hash(v){return String(v);},putScript(){},
      addUrlComponent(url,part){return url+(url.includes('?')?'&':'?')+part;}
    },Manifest:{app_digital:0,add(){}},Component:{add(){}},
    Lang:{translate(x){return x;},add(){}},
    Template:{add(){},get(){return {};}},Listener:{follow(){}},
    Loading:{start(){},stop(){}},Noty:{show(msg){messages.push(msg);}},
    Player:{play(data){played.push(data);},playlist(){}},
    Favorite:{add(){}},
    Activity:{push(){throw Error('Film cannot open activity screen');}}
  };
  const window={console,rch_nws:null,location:{host:'lampa.local'}};
  vm.runInNewContext(core,{window,Lampa,$:fake$,location:window.location,
      console,setTimeout(){return 1;},clearTimeout(){},clearInterval(){},
      setInterval(){return 1;}},{timeout:5000});
  window.__capsuleFilmAutoLaunch({id:80,title:'Example',media_type:'movie',runtime:101});
  const all=requests.map(r=>r[1]);
  assert(all.some(url=>url.includes('mir.invalid/search')),'Mir Kino Z must be checked');
  assert(all.some(url=>url.includes('alloha.invalid/quality')),'nested Alloha 4K folder is scanned');
  assert(!all.some(url=>url.includes('alloha.invalid/ua')),'Ukrainian dub skipped');
  assert(!all.some(url=>url.includes('ads.invalid')),'Umbrella never inspected');
  assert(!all.some(url=>url.includes('alloha.invalid/dub')&&/[?&]id=/.test(url)),
    'Signed child URLs must not be modified with movie parameters');
  assert.equal(played.length,1,'Verified film should start once');
  assert.equal(played[0].url,'https://cdn.invalid/alloha4k.m3u8',
    'Russian Alloha HDR 4K must outrank Rezka 720 and Mir 1080');
  assert.equal(window.__capsuleFilmLastScan.selected.source,'alloha');
  assert.equal(window.__capsuleFilmLastScan.selected.quality,2160);
  assert(window.__capsuleFilmLastScan.probed.includes('mirkinoz'));
  assert(window.__capsuleFilmLastScan.qualityBySource.alloha>=2160);
  assert(!JSON.stringify(window.__capsuleFilmLastScan).includes('alloha4k.m3u8'),
    'Diagnostics must not expose signed stream URLs');
});

test('resolver accepts quality-only 4K stream and keeps all options after empty signed quality',()=>{
  const core=bundle.slice(0,bundle.indexOf(marker));
  const begin=core.indexOf('function filmQualityHeight(name)');
  const end=core.indexOf('function filmVoiceRank(label)',begin);
  const body=core.slice(begin,end);
  const build=new Function('Lampa','window','filmValidUrl','filmSearchMode',body+
    'return {filmQualityHeight,filmNormalizeStream,filmQualityChoice,filmStreamQuality};');
  const funcs=build({Storage:{get(){return 'auto';}}},{},
    url=>/^https?:\/\//i.test(String(url||'')),()=> 'normal');
  assert.equal(funcs.filmQualityHeight('720p / 4K HDR'),2160);
  const file={url:'https://cdn.invalid/direct720.m3u8',
    quality:{'2160p HDR':'https://cdn.invalid/4k.m3u8'}};
  const resolved=funcs.filmNormalizeStream({
    quality:{'720p':'https://cdn.invalid/720.m3u8'},
    runtime:120,language:'ru'
  },file);
  assert(resolved,'Quality-only Skaz JSON should still be playable');
  assert.equal(resolved.url,'https://cdn.invalid/4k.m3u8',
    'Best available stream must be selected before failing link validation');
  assert.equal(funcs.filmQualityChoice(funcs.filmStreamQuality(file,resolved)).height,2160);
  assert.equal(funcs.filmNormalizeStream({url:'javascript:alert(1)'},{url:''}),null);
});
test('Mir Kino Z aliases are recognized without adding unapproved advertising providers',()=>{
  const core=bundle.slice(0,bundle.indexOf(marker));
  const start=core.indexOf('function balanserName(row)');
  const end=core.indexOf('window.__capsuleSerialKey=balanserName',start);
  const maker=vm.runInNewContext('(function(){'+core.slice(start,end)+
    'return balanserName})()');
  assert.equal(maker({balanser:'mirkino',name:'Mir Kino Z UHD'}),'mirkinoz');
  assert.equal(maker({balanser:'mir-kino',name:'Мир кино Z HDR'}),'mirkinoz');
  assert.equal(maker({balanser:'mir_kino_z',name:'Мир кино Z'}),'mirkinoz');
  assert.equal(maker({balanser:'alloha',name:'Alloha 4K'}),'alloha');
  const allowedStart=core.indexOf('function allowedSeriesProvider(row)');
  const allowedEnd=core.indexOf('window.__capsuleSerialAllowed=allowedSeriesProvider',
    allowedStart);
  const allowed=vm.runInNewContext('(function(){'+
    core.slice(allowedStart,allowedEnd)+'return allowedSeriesProvider})()');
  assert.equal(allowed({balanser:'mirkino',name:'Mir Kino Z UHD'}),true);
  assert.equal(allowed({balanser:'unknown',name:'Umbrella UHD'}),false);
  assert.equal(allowed({balanser:'veoveo',name:'Veo Veo'}),false);
});

test('relative Skaz voice endpoints use Skaz host, never current Lampa page',()=>{
  const core=bundle.slice(0,bundle.indexOf(marker));
  const start=core.indexOf('function filmValidUrl(url,allowRelative)');
  const end=core.indexOf('function filmParseHtml(html,movie)',start);
  assert(start>0&&end>start);
  const make=vm.runInNewContext('(function(Defined){'+
    core.slice(start,end)+'return {filmValidUrl,filmSkazUrl}})');
  const urls=make({localhost:'https://online3.skaz.tv/'});
  assert.equal(urls.filmSkazUrl('/lite/video/voice?token=abc'),
    'https://online3.skaz.tv/lite/video/voice?token=abc');
  assert.equal(urls.filmSkazUrl('https://alloha.invalid/voice?sig=abc'),
    'https://alloha.invalid/voice?sig=abc');
  assert.equal(urls.filmValidUrl('//example.invalid/evil',true),false);
  assert.equal(urls.filmValidUrl('/lite/film',true),true);
});
test('all Skaz aliases are inspected round-robin, not overwritten by same-family 720 mirrors',()=>{
  const core=bundle.slice(0,bundle.indexOf(marker));
  assert(core.includes("var id=balanserName(row),key=id+'|'"));
  assert(core.includes('return orderFilmProviders(result)'));
  assert(core.includes('scanProviders(orderFilmProviders(combined))'));
  assert(core.includes('total=Math.min(providers.length,24)'));
  assert(core.includes('var maxRequests=18,maxDepth=4,maxParallel=3;'));
  assert(core.includes('var target=task.root?filmRequestParams(url,movie):url;'));
  assert(core.includes('net[method](signed?url:account(url),done,fail,false,options)'));
  assert(core.includes("job.report.probed.push(named)"));
  assert(core.includes('window.__capsuleFilmLastScan=job.report'));
});


test('Shrek: Russian Alloha dubbed 4K outranks Rezka dubbed 720; strict language > quality > voice > source',()=>{
  const core=bundle.slice(0,bundle.indexOf(marker));
  const start=core.indexOf('function filmVoiceRank(label)');
  const end=core.indexOf('function filmAutoLaunch(movie)',start);
  assert(start>0&&end>start);
  const make=new Function('window','filmVoiceBlocked','sourceLanguage',
    'playbackLanguage','filmEffectiveQuality','filmSourcePriority',
    core.slice(start,end)+
    'return {filmVoiceRank,filmLanguagePriority,filmCandidateScore};');
  const h=make({},()=>false,(row,voice)=>String(row&&row.language||''),
    ()=> 'auto',
    (file,stream)=>({height:Number(stream&&stream.height||file&&file.height)||0,hdr:false}),
    row=>({alloha:6,filmix:5,kinopub:4,mirkinoz:3,rezka:2,hdrezka:1}[row.balanser]||0));
  const labels=['RHS','Дубляж','LostFilm','Rezka','TVShows','Кубик в Кубе','Rezka 18+','Неизвестная озвучка'];
  assert.deepEqual(Array.from(labels,x=>h.filmVoiceRank(x)),[8,7,6,5,4,3,2,1]);
  function c(source,voice,height,language='ru'){
    return {provider:{balanser:source},voice,
      file:{voice_name:voice,height,language},
      stream:{height,language}};
  }
  assert(h.filmCandidateScore(c('alloha','Дубляж',2160))>
    h.filmCandidateScore(c('rezka','Rezka',720)),
    'Russian Alloha 4K original dub beats Rezka 720');
  assert(h.filmCandidateScore(c('filmix','Rezka',2160))>
    h.filmCandidateScore(c('alloha','RHS',1080)),
    'Quality dominates voice and provider');
  assert(h.filmCandidateScore(c('rezka','RHS',1080))>
    h.filmCandidateScore(c('alloha','Дубляж',1080)),
    'Voice preference outranks provider on equal quality');
  assert(h.filmCandidateScore(c('rezka','Дубляж',1080,'ru'))>
    h.filmCandidateScore(c('alloha','Дубляж',2160,'en')),
    'Language dominates resolution');
  assert(!core.includes('capsule_film_preferences_v1'),
    'No stale saved answers may influence new auto search');
});

test('slow 4K source does not lose to first 720p before all six-family probes have responded',()=>{
  const core=bundle.slice(0,bundle.indexOf(marker));
  const played=[],pending=[],requested=[],store={capsule_skaz_online_language:'ru'};
  const elements={
    'REZKA':[{method:'play',url:'https://cdn.invalid/rezka720',
      voice_name:'RHS',quality:{'720p':'https://cdn.invalid/rezka720'}}],
    'ALLOHA':[{method:'play',url:'https://cdn.invalid/alloha4k',
      voice_name:'Оригинальный дубляж',quality:{'2160p HDR':'https://cdn.invalid/alloha4k'}}]
  };
  function fake$(value){
    if(typeof value==='string')return {content:'',html(v){this.content=v;return this;},
      append(v){this.content=v;return this;},
      find(selector){
        const items=selector==='.videos__item'?(elements[this.content]||[]):[];
        return {each(fn){items.forEach(item=>{
          const node={'data-json':JSON.stringify(item),text:item.voice_name||''};
          fn.call(node);
        });}};
      }};
    return {attr:k=>value[k],text:()=>value.text||''};
  }
  function Reguest(){
    this.timeout=()=>{};this.clear=()=>{};
    this.silent=(url,ok)=>{
      ok({life:false,online:[
        {balanser:'rezka',name:'Rezka',url:'https://rezka.invalid/film',show:true},
        {balanser:'alloha',name:'Alloha',url:'https://alloha.invalid/film',show:true}
      ]});
    };
    this.native=(url,ok)=>{
      requested.push(url);
      if(url.includes('rezka.invalid'))ok('REZKA');
      else if(url.includes('alloha.invalid'))pending.push(()=>ok('ALLOHA'));
    };
  }
  const Lampa={
    Reguest,Storage:{get(k,d){return Object.hasOwn(store,k)?store[k]:d;},
      set(k,v){store[k]=v;},cache(k,n,d){return d;},field(){return 'inner';}},
    Platform:{is(){return false;}},Utils:{uid(){return 'uid';},hash(v){return String(v);},
      putScript(){},addUrlComponent(url,piece){
        return url+(url.includes('?')?'&':'?')+piece;
      }},
    Manifest:{app_digital:0,add(){}},Template:{add(){},get(){return {};}},
    Component:{add(){}},Lang:{translate(x){return x;},add(){}},
    Listener:{follow(){}},Loading:{start(){},stop(){}},Noty:{show(){}},
    Player:{play(item){played.push(item);},playlist(){}},
    Favorite:{add(){}},Activity:{push(){throw Error('unexpected UI');}}
  };
  const window={rch_nws:null,console,location:{host:'lampa.local'}};
  vm.runInNewContext(core,{window,Lampa,$:fake$,location:window.location,
    console,setTimeout(){return 1;},clearTimeout(){},setInterval(){return 1;},
    clearInterval(){}},{timeout:5000});
  window.__capsuleFilmAutoLaunch({id:410,title:'Shrek',original_title:'Shrek',
    media_type:'movie',runtime:90});
  assert.equal(pending.length,1,'Alloha probe deliberately remains in flight');
  assert.equal(played.length,0,'Rezka 720p is only a candidate, not first winner');
  pending.shift()();
  assert.equal(played.length,1);
  assert.equal(played[0].url,'https://cdn.invalid/alloha4k');
  assert.equal(window.__capsuleFilmLastScan.selected.source,'alloha');
  assert.equal(window.__capsuleFilmLastScan.selected.quality,2160);
  assert(!requested.some(u=>u.includes('umbrella')));
});


test('selection v3: Dubbed 4K beats stronger Mir Kino Goblin 4K regardless of arrival order',()=>{
    const core=bundle.slice(0,bundle.indexOf(marker));
    const voice=core.slice(core.indexOf('    function voiceLanguage(name,explicit){'),
        core.indexOf('    function filmMinutes(value,unit){'));
    const rank=core.slice(core.indexOf('  // One shared lexicographic policy.'),
        core.indexOf('  function filmAutoLaunch(movie) {'));
    const context={
        window:{},console,
        playbackLanguage:()=> 'auto',
        filmVoiceBlocked:()=>false,
        filmEffectiveQuality(file,stream){
            const p=stream||file,txt=String(p.height||p.quality_label||file.height||0);
            return {height:/4k/i.test(txt)?2160:parseInt(txt,10)||0,hdr:!!p.hdr};
        },
        filmSourceFamily:row=>row&&row.balanser||'',
        filmSourcePriority:row=>({mirkinoz:7,filmix:6,alloha:5,kinopub:4,rezka:3})[row&&row.balanser]||0
    };
    vm.createContext(context);
    vm.runInContext(voice+rank,context,{timeout:5000});
    const select=context.window.__capsuleSelectionV3;
    const film=(source,voice,height,extra)=>({
        provider:{balanser:source},voice,
        file:Object.assign({text:voice,url:'https://example.invalid/f',quality_label:height},extra),
        stream:{url:'https://example.invalid/s',quality_label:height}
    });
    const dubbed=film('alloha','Дублированный','4K');
    const goblin=film('mirkinoz','Гоблин','4K');
    const original=film('alloha','Оригинал','4K');
    const rezka=film('rezka','Дубляж','1080p');
    const kino=film('kinopub','Дублированный','1080p');
    assert.equal(context.voiceLanguage('Дублированный'),'ru');
    assert.equal(context.voiceLanguage('Гоблин'),'ru');
    assert.equal(context.voiceLanguage('Оригинал'),'original');
    assert.equal(context.voiceLanguage('Украинская озвучка'),'uk');
    assert.equal(select.choose([goblin,dubbed]),dubbed);
    assert.equal(select.choose([original,rezka]),rezka);
    assert.equal(select.choose([original,goblin,kino,dubbed]),dubbed);
    const base=[original,goblin,kino,rezka,dubbed];
    for(let i=0;i<base.length;i++){
        const shifted=base.slice(i).concat(base.slice(0,i));
        assert.equal(select.choose(shifted),dubbed,
            'callback arrival order is never a ranking criterion');
    }
    const sourceOriginal=film('alloha','Дублированный','4K',
        {audio_language:'en',method:'play'});
    assert.equal(select.language(sourceOriginal.file,sourceOriginal.voice,
        sourceOriginal.file).lang,'ru',
        'media original language does not override a Russian dub card');
});
