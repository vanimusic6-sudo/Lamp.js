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
        Utils:{uid(){return 'unit1234';},hash(){return 'unit';},putScript(){}},
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
    assert.deepEqual(names,['hdrezka','kinopub','veoveo']);
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
    assert(body.includes('return row&&filmValidUrl(row.url,true)&&row.show!==false'));
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
    const good=['Rezka','HDRezka','Alloha','Filmix','Skaz TV','KinoPub','Veo Veo'];
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
        ['alloha','rezka','filmix','kinopub','hdrezka','skaztv','veoveo']);
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
        ['alloha','rezka','filmix','kinopub','hdrezka','skaztv','veoveo']);
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
  new Function('$','object','document','isEpisodeMedia',src).call(holder,$,
    {movie:{name:'Series'}},{},()=>true);
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
  const make=vm.runInNewContext('(function(object,allowedSeriesProvider,filmItemAllowed,isEpisodeMedia){'+src+'return eligibleProvider})');
  const movie=make({movie:{}},row=>row.balanser==='alloha',()=>true,()=>false);
  const show=make({movie:{type:'tv'}},row=>row.balanser==='rezka',()=>true,()=>true);
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
  const inner=core.indexOf('function allowedSeriesProvider(row)',outerEnd);
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
test('film source ranking prefers trusted provider over inflated quality labels',()=>{
  const h=isolatedFilmHelpers({title:'Film'});
  assert(h.filmSourceScore({balanser:'rezka',name:'Rezka 720p'})>
         h.filmSourceScore({balanser:'mystery',name:'Mystery 8K'}));
  assert(h.filmSourceScore({balanser:'alloha'})>
         h.filmSourceScore({balanser:'filmix'}));
  const sandbox=fixture(),film={id:777,title:'Film',media_type:'movie'};
  sandbox.win.__capsuleFilmHelpers={
    isSeries:()=>false,allow:()=>true,
    sourceScore:r=>h.filmSourceScore(r)
  };
  const list=sandbox.win.__capsuleSkazOnlineDebug.sourceOrder([
    {balanser:'mystery',name:'Mystery 8K',url:'https://example.invalid/a',show:true},
    {balanser:'alloha',name:'Alloha',url:'https://example.invalid/b',show:true},
    {balanser:'rezka',name:'Rezka',url:'https://example.invalid/c',show:true},
    {balanser:'filmix',name:'Filmix',url:'https://example.invalid/d',show:false}
  ],film);
  assert.deepEqual(Array.from(list,r=>r.key),['rezka','alloha']);
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
