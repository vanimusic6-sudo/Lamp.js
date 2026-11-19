'use strict';
/**
 * Capsule Online 0.25.x actively maintained regressions.
 * Legacy test file contains pre-0.25 source sets and historical snapshots;
 * retained separately as migration reference, not part of this suite.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const bundle = fs.readFileSync(path.join(__dirname,'..','capsule-online.js'),'utf8');
const marker = '/* CAPSULE AUTOPICK MODULE START */';
assert(bundle.includes(marker),'Bundled Skaz core and automation must remain in one file');
const core = bundle.slice(0,bundle.indexOf(marker));
const wrapper = bundle.slice(bundle.indexOf(marker)+marker.length);
function section(start,end){
  const a=core.indexOf(start),b=core.indexOf(end,a+start.length);
  assert(a>=0 && b>a,'Source block must exist: '+start);
  return core.slice(a,b);
}
function fixture(settings){
  const store=Object.assign({},settings||{});
  const registered=Object.create(null),params=[];
  const Lampa={
    Storage:{
      get(k,d){return Object.hasOwn(store,k)?store[k]:d;},
      cache(k,n,d){return Object.hasOwn(store,k)?store[k]:d;},
      set(k,v){store[k]=v;},
      field(){return '';},
    },
    Component:{
      add(name,ctor){registered[name]=ctor;},
      get(name){return registered[name];}
    },
    SettingsApi:{addComponent(){},addParam(item){params.push(item);}},
    Noty:{show(){}},
    Player:{listener:{follow(){}}},
    PlayerVideo:{listener:{follow(){}}},
    Activity:{active(){return {component:'capsuleamedia'};}}
  };
  const root={Lampa,console,capsule_amedia_core_plugin:true};
  const sandbox={window:root,console,Date,setTimeout(){return 1;},clearTimeout(){}};
  vm.runInNewContext(wrapper,sandbox,{timeout:5000});
  return {root,Lampa,store,params,registered};
}
function row(key){
  return {balanser:key,name:key,url:'https://cdn.invalid/'+key,show:true};
}

test('bundle has a valid 0.25 plugin version and bundled source',()=>{
  assert(core.includes("version: '0.27.0'"));
  assert(core.includes("Lampa.Component.add('capsuleamedia', component)"));
  assert(wrapper.includes('function enhance(instance,movie)'));
});
test('series automatic sources: Alloha HDRezka Filmix',()=>{
  assert(core.includes("var SERIES_FAMILIES=['alloha','hdrezka','filmix'];"));
  assert(core.includes('var SERIES_CHECK_ORDER=SERIES_FAMILIES.slice();'));
  assert(!core.includes('completeSerialCatalog()'),
    'nonadvertised providers must not be fabricated as unavailable');
});
test('movie automatic sources: Alloha Mir Kino Z HDRezka',()=>{
  assert(core.includes("var FILM_FAMILIES=['alloha','mirkinoz','hdrezka'];"));
  assert(core.includes('function filmSourceOrder(){return FILM_FAMILIES.slice();}'));
});
test('discontinued provider settings are removed',()=>{
  const registration=wrapper.slice(wrapper.indexOf('function registerSettings()'));
  for(const name of ["['kodik','Kodik']","['kinopub','KinoPub / КПУ']",
    "['redheadsound','RHS']","['skaztv','Skaz TV']"])
    assert(!registration.includes(name),name);
});
test('wrapper auto-series only ranks three providers',()=>{
  const h=fixture(),series={media_type:'tv',name:'Show',number_of_seasons:25};
  const items=['kinopub','filmix','hdrezka','skaztv','alloha','vibix','kodik',
    'redheadsound','rezka','collaps','mirkinoz'].map(row);
  const result=h.root.__capsuleSkazOnlineDebug.sourceOrder(items,series);
  assert.deepEqual(Array.from(result,x=>x.key),['alloha','hdrezka','filmix']);
});
test('wrapper auto-movie only ranks three providers',()=>{
  const h=fixture(),film={media_type:'movie',title:'Film'};
  const items=['vibix','filmix','hdrezka','skaztv','alloha','mirkinoz',
    'kodik','redheadsound','kinopub','rezka'].map(row);
  const result=h.root.__capsuleSkazOnlineDebug.sourceOrder(items,film);
  assert.deepEqual(Array.from(result,x=>x.key),['alloha','mirkinoz','hdrezka']);
});
test('source selection cannot be pulled to first response by economy mode',()=>{
  assert(core.includes('function filmSearchMode(){'));
  assert(core.includes("return 'normal';"));
  assert(!wrapper.includes("economy:'Экономный · быстро'"));
});
test('series queues all its automatic candidates together',()=>{
  const part=section('this.compareSeriesSources = function(', 'this.currentSourceRows = function()');
  assert(part.includes('keys.forEach(function(key){queueRoot(states[key]);});'));
  assert(part.includes('scanDeadline=Date.now()+11500'));
  assert(part.includes('states[key].responses>0'));
  assert(!part.includes('firstWaveExcellent'));
  assert(!part.includes('secondWave'));
});
test('movie scans all three independent providers before ranking',()=>{
  const part=section('function scanProviders(providers)', 'function withCatalog(data)');
  assert(part.includes('waveEnd=ordered.length'));
  assert(part.includes('while(running<4&&position<waveEnd)'));
  assert(part.includes('if(running||completed<waveEnd)return'));
  assert(!part.includes('excellent()'));
  assert(part.includes('resolveCandidates();'));
});
test('incomplete catalogs are never cached as complete catalogs',()=>{
  assert(!core.includes("responseRemember('series_catalog'"),
    'do not cache a life/memkey shell as an available catalogue');
  assert(!core.includes('complete?75000:8000'));
  assert(core.includes("mode==='catalog'?60000:45000"));
});
test('temporary response cache is bounded and excludes signed URLs',()=>{
  const block=section('var responseMemory=','function readClarificationStore');
  assert(block.includes('responseMemoryOrder.length>28'));
  assert(block.includes('Date.now()+ttl'));
  assert(block.includes('sig|signature|token|hash|hmac|expires|exp|auth'));
  assert(!block.includes('Lampa.Storage.set('));
});
test('compact screen builds own toolbar instead of hiding expanded selectors',()=>{
  assert(core.includes('files.appendHead(compactHead);'));
  assert(core.includes('files.appendHead(filter.render());'));
  assert(core.includes('cso-simple-head'));
  assert(!core.includes("filter--sort,.filter--filter,.filter--search').hide()"));
});
test('season selector stays in selector collection and receives restored focus',()=>{
  assert(core.includes("seasonButton.toggleClass('hide',!seasons.length)"));
  assert(core.includes("last=seasonButton&&seasonButton[0]||false;"));
  assert(!core.includes(".toggleClass('selector',!!seasons.length)"));
});
test('season menu sorted ascending by season number, not by source arrival',()=>{
  assert(core.includes('function sourceSeasonNumber(row)'));
  assert(core.includes('sourceSeasonNumber(a)-sourceSeasonNumber(b)'));
});
test('manual expanded film and serial views disable automatic quality/source ranking',()=>{
  assert(core.includes('cso_manual_screen:true'));
  assert(core.includes('owner.__csoManualView||'));
  assert(wrapper.includes('manualSelection:!!instance.__csoManualView'));
  assert(wrapper.includes("!instance.__csoManualView"));
});
test('source-side TV evidence can overrule film tag without trusting one catalog flag',()=>{
  assert(core.includes('function detectSourceSeries(movie,callback)'));
  assert(core.includes('if(votes>=2)return finish(true)'));
  assert(core.includes('episodes>=2||seasons>=2||seasons>=1&&labels'));
  assert(core.includes('if(movie.__csoForceSeries===true)return true;'));
});
test('Skaz artwork and actual loaded thumbnail are forwarded to native playback',()=>{
  assert(core.includes('choices.push(sourceCatalog[key]&&sourceCatalog[key].artwork)'));
  assert(core.includes('data.still_path=posterThumbUrl(artworkSrc)'));
  assert(core.includes('element.thumbnail=img.src'));
  assert(core.includes('thumbnail:thumbnail,'));
  assert(core.includes('thumbnail:filmArtwork,'));
});
test('absolute artwork paths are not misinterpreted as TMDB relative URLs',()=>{
  assert(core.includes("poster_path:/^https?:\\/\\//i.test(poster)?'':poster"));
});
test('settings text input retains Lampa value descriptor fix',()=>{
  const h=fixture();
  const input=h.params.find(x=>x.param&&x.param.name==='capsule_skaz_online_kinopoisk_key');
  assert(input,'API key input must be registered');
  assert.equal(input.param.type,'input');
  assert.equal(input.param.values,'');
});
test('quality selection still handles 4K, explicit 1080 and source studio ranking',()=>{
  const h=fixture(),debug=h.root.__capsuleSkazOnlineDebug;
  assert.equal(debug.qualityCandidate({
    '4K':'https://cdn.invalid/4k','1080p':'https://cdn.invalid/hd'
  }).height,2160);
  h.store.capsule_skaz_online_quality='1080';
  assert.equal(debug.qualityCandidate({
    '4K':'https://cdn.invalid/4k','1080p':'https://cdn.invalid/hd'
  }).height,1080);
  assert(debug.voiceScore('Официальный дубляж')>debug.voiceScore('Нейросеть'));
});

function stagedCatalogFixture(responses){
  const scripts=responses.slice(),pending=new Map(),requested=[];
  let seq=0,now=0,count=0,returned=null,meta=null;
  function setTimer(fn,ms){
    const id=++seq;
    pending.set(id,{fn,when:now+(ms||0)});
    return id;
  }
  function clearTimer(id){pending.delete(id);}
  function flush(){
    for(let i=0;pending.size&&i<120;i++){
      const entry=[...pending.entries()].sort((a,b)=>a[1].when-b[1].when)[0];
      pending.delete(entry[0]);now=entry[1].when;entry[1].fn();
    }
    assert.equal(pending.size,0,'no lingering long-poll timer after search ends');
  }
  function Network(){
    this.clear=()=>{};
    this.timeout=()=>{};
    this.silent=(url,onSuccess)=>{
      requested.push(url);count++;
      let reply=scripts.shift();
      if(reply==='TIMEOUT')return;
      if(typeof reply==='function')reply=reply(url);
      onSuccess(reply||{online:[],ready:false,tasks:4,
        pending:['alloha','hdrezka','filmix']});
    };
  }
  const context={
    SERIES_FAMILIES:['alloha','hdrezka','filmix'],
    FILM_FAMILIES:['alloha','mirkinoz','hdrezka'],
    filmSourceEnabled:()=>true,
    filmSourceFamily:item=>item.balanser,
    filmValidUrl:url=>/^https?:\/\//i.test(String(url||'')),
    Network,account:url=>url,
    Lampa:{Storage:{get:()=>''}},
    window:{},setTimeout:setTimer,clearTimeout:clearTimer,
    Date:{now:()=>now}
  };
  vm.runInNewContext(section('function providerCoverage(rows,serial)',
    'function filmSourcePriority(row)'),context,{timeout:5000});
  return {context,flush,requested,
    get count(){return count;},get result(){return returned;},
    get meta(){return meta;},get clock(){return now;},
    scan(initial,serial=true){
      context.discoverProviderUpdates(initial,'memkey',id=>
        'https://skaz.test/lifeevents?memkey='+id,serial,(rows,status)=>{
          returned=rows;meta=status;
        });
      flush();
    }};
}
const tv=['alloha','hdrezka','filmix'];
const films=['alloha','mirkinoz','hdrezka'];
function snapshot(names,all,ready=false){
  const list=all||tv;
  return {
    online:names.map(row),ready,tasks:list.length,
    pending:ready?[]:list.filter(x=>!names.includes(x))
  };
}
test('Lampac long-poll accumulates serial statuses until ready:true',()=>{
  const state=stagedCatalogFixture([
    snapshot(['alloha']),snapshot(['alloha','hdrezka']),
    snapshot(['alloha','hdrezka']),
    snapshot(tv,tv,true)
  ]);
  state.scan([]);
  assert.equal(state.count,4);
  assert.deepEqual(Array.from(state.result,x=>x.balanser),tv);
  assert.equal(state.meta.ready,true);
  assert.equal(state.meta.reason,'ready');
  assert.deepEqual(state.requested.map(u=>new URL(u).searchParams.get('seen')),
    ['0','1','2','2']);
});
test('waits for 9th result, not arbitrary limit of five polls',()=>{
  const replies=[];
  for(let i=0;i<8;i++)
    replies.push({ready:false,tasks:4,pending:tv,online:[row('alloha')]});
  replies.push(snapshot(tv,tv,true));
  const state=stagedCatalogFixture(replies);
  state.scan([]);
  assert.equal(state.count,9);
  assert.equal(state.meta.ready,true);
  assert(state.clock>=3000,'server is allowed to remain pending');
});
test('three URLs are not proof of readiness while targeted sources are pending',()=>{
  const initial=tv.map(row);
  const state=stagedCatalogFixture([
    {ready:false,tasks:5,pending:['filmix'],online:initial},
    {ready:false,tasks:5,pending:['filmix'],online:initial},
    {ready:true,tasks:5,pending:[],online:initial}
  ]);
  state.scan([]);
  assert.equal(state.count,3);
  assert.equal(state.meta.reason,'ready');
});
test('fast auto ignores pending unrelated Skaz providers once its three are ready',()=>{
  const initial=tv.map(row);
  const state=stagedCatalogFixture([
    {ready:false,tasks:5,pending:['anilibria'],online:initial},
    {ready:false,tasks:5,pending:['anilibria'],online:initial},
    {ready:true,tasks:5,pending:[],online:initial}
  ]);
  state.scan([]);
  assert.equal(state.count,1);
  assert.equal(state.meta.reason,'target_ready');
});
test('completed backend snapshot with only Alloha does not fabricate 3 sources',()=>{
  const state=stagedCatalogFixture([snapshot(['alloha'],tv,true)]);
  state.scan([]);
  assert.equal(state.count,1);
  assert.deepEqual(Array.from(state.result,x=>x.balanser),['alloha']);
  assert.equal(state.meta.ready,true);
  assert.deepEqual(Array.from(state.meta.missing),['hdrezka','filmix']);
  assert(!core.includes('completeSerialCatalog()'));
});
test('missing memkey entries trigger fallback after two empty task snapshots',()=>{
  const state=stagedCatalogFixture([
    {ready:false,tasks:0,pending:[],online:[]},
    {ready:false,tasks:0,pending:[],online:[]}
  ]);
  state.scan([]);
  assert.equal(state.count,2);
  assert.equal(state.meta.reason,'stale_memkey');
  assert(!state.result.length);
  assert(core.includes('lite/events?life=false'));
});
test('film discovery uses the same cumulative ready protocol as series',()=>{
  const state=stagedCatalogFixture([
    snapshot(['alloha'],films),snapshot(['alloha','mirkinoz'],films),
    snapshot(['alloha','mirkinoz'],films),
    snapshot(films,films,true)
  ]);
  state.scan([],false);
  assert.equal(state.meta.ready,true);
  assert.deepEqual(Array.from(state.result,x=>x.balanser),films);
});
test('legacy Skaz snapshots without ready finish when all auto URLs exist',()=>{
  const state=stagedCatalogFixture([
    {online:[row('alloha')]},
    {online:tv.map(row)}
  ]);
  state.scan([]);
  assert.equal(state.count,2);
  assert.equal(state.meta.reason,'legacy_complete');
});
test('HTML cold-start error pages never enter memory cache',()=>{
  const block=section('function responseRemember(kind,url,payload,ttl)',
    'function readClarificationStore');
  assert(block.includes("kind==='series_html'||kind==='film_text'"));
  assert(block.includes("!/data-json\\s*=/i.test(payload)"));
});
test('source root timeout and recheck account for slow wake-up',()=>{
  const scan=section('this.compareSeriesSources = function(',
    'this.currentSourceRows = function()');
  assert(scan.includes('task.depth===0?7200:3800'));
  assert(scan.includes('!task.retry&&!bridged&&!parsed.length'));
  assert(scan.includes('retry:true'));
  assert(core.includes('limit=isRootRequest?16000:11000'));
  assert(scan.includes('req.timeout(ms-400)'));
});
test('external IDs must finish before any Lite Events check starts',()=>{
  const sectionStart=core.indexOf('    this.initialize = function() {');
  const sectionEnd=core.indexOf('    this.rch = function',sectionStart);
  const part=core.slice(sectionStart,sectionEnd);
  assert(part.includes('this.externalids().then(function(){'));
  assert(part.includes('return _this.createSource();'));
  assert(!part.includes('this.externalids();\n      this.createSource()'));
  const external=section('this.externalids = function(){','this.changeBalanser = function(name)');
  assert(external.includes('8500'));
  assert(external.includes('8100'));
});
test('life initial array is parsed directly without inventing a memkey',()=>{
  const serial=section('this.createSource = function(){','this.create = function() {');
  assert(serial.includes('var initial=Array.isArray(json)?json:'));
  assert(serial.includes('json.life===true&&!!json.memkey'));
  const film=section('function extractProviders(response)','function addCandidate(');
  assert(film.includes('var rows=Array.isArray(response)?response:'));
});
test('provider identity preserves HDRezka when balancer key is rezka',()=>{
  const named=section('function balanserName(row) ','function automaticSelectionEnabled');
  const family=section('function filmSourceFamily(row)','function filmSearchMode()');
  const context={isMirKinoZ:()=>false,window:{}};
  vm.runInNewContext(named+family,context,{timeout:5000});
  assert.equal(context.filmSourceFamily({balanser:'rezka',name:'HD Rezka'}),'hdrezka');
  assert.equal(context.filmSourceFamily({balanser:'rezka',name:'Rezka'}),'rezka');
});

test('selected episode screen reuses preflight-proven root without refetching',()=>{
  const scan=section('this.compareSeriesSources = function(',
    'this.currentSourceRows = function()');
  const request=section('this.request = function(url){','this.parseProviderRows = function(str){');
  assert(/if\(task\.depth===0\)\s*responseRemember\('series_html',url,html,25000\)/.test(scan),
    'only root discovery menus are cached, never signed child menus');
  assert(request.includes("cachedRoot=isRootRequest?responseRead('series_html',path):null"));
  assert(request.includes('if(cachedRoot){'));
  assert(request.includes('self.parse(cachedRoot);'));
  assert(request.includes("responseRemember('series_html',path,html,25000)"));
  assert(request.includes('limit=isRootRequest?16000:11000'));
});
test('catalog diagnostics disclose checks and server confirmations, never links',()=>{
  const c=section('function discoverProviderUpdates(initial,memkey',
    'function seriesSourceEnabled(');
  assert(c.includes('serverConfirmed:positive,serverUnconfirmed:negative'));
  assert(c.includes('pendingCount:pending.length'));
  assert(c.includes('reason:reason,ready:ready'));
  const settings=wrapper.slice(wrapper.indexOf('function registerSettings()'));
  assert(settings.includes("last_catalog_scan"));
  assert(settings.includes("Проверка каталога Skaz"));
  assert(settings.includes("Не выдал адрес: "));
});

test('RCH challenges from string and object are recognized',()=>{
  const shared=section('var rchBridgeBusy=false',
    'var Network = Lampa.Reguest;');
  const ctx={
    rchRun(){},setTimeout(){return 7;},clearTimeout(){}
  };
  vm.runInNewContext(shared,ctx,{timeout:5000});
  assert.equal(ctx.readRchChallenge('nonsense'),null);
  assert.equal(ctx.readRchChallenge('{"rch":false}'),null);
  assert.equal(ctx.readRchChallenge('{"rch":true,"nws":"wss://bridge.test"}').rch,true);
  assert.equal(ctx.readRchChallenge({rch:true,nws:'wss://bridge.test'}).rch,true);
});
test('RCH bridge opens only one websocket for simultaneous sources',()=>{
  const shared=section('var rchBridgeBusy=false',
    'var Network = Lampa.Reguest;');
  const calls=[],results=[],ctx={
    rchRun(json,callback){calls.push({json,callback});},
    setTimeout(){return 1;},clearTimeout(){}
  };
  vm.runInNewContext(shared,ctx,{timeout:5000});
  const challenge={rch:true,nws:'wss://bridge.test'};
  ctx.ensureRchBridge(challenge,ok=>results.push(['first',ok]));
  ctx.ensureRchBridge(challenge,ok=>results.push(['second',ok]));
  assert.equal(calls.length,1,'parallel providers must share a single socket');
  calls[0].callback();
  assert.deepEqual(results,[['first',true],['second',true]]);
});
test('RCH reconnect is honored before re-requesting both series and film menus',()=>{
  const serial=section('this.compareSeriesSources = function(',
    'this.currentSourceRows = function()');
  const film=section('function filmAutoLaunch(movie)','window.__capsuleFilmAutoLaunch=filmAutoLaunch');
  assert(serial.includes('readRchChallenge(html)'));
  assert(serial.includes('ensureRchBridge(challenge,function(ok)'));
  assert(serial.includes('diag.rchRecovered'));
  assert(serial.includes('fetchMenu();'));
  assert(serial.includes('!task.retry&&!bridged&&!parsed.length'));
  assert(film.includes('readRchChallenge(response)'));
  assert(film.includes('ensureRchBridge(challenge,function(ready)'));
  assert(film.includes('if(retried)return callback(null)'));
});
