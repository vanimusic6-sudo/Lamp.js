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
  assert(core.includes("version: '0.28.2'"));
  assert(core.includes("Lampa.Component.add('capsuleamedia', component)"));
  assert(wrapper.includes('function enhance(instance,movie)'));
});

test('series automatic sources: Alloha HDRezka Filmix',()=>{
  assert(core.includes("var SERIES_FAMILIES=['alloha','hdrezka','filmix','vibix','kodik'];"));
  assert(core.includes('var SERIES_CHECK_ORDER=SERIES_FAMILIES.slice();'));
  assert(!core.includes('completeSerialCatalog()'));
});

test('movie automatic sources: Alloha Mir Kino Z HDRezka',()=>{
  assert(core.includes("var FILM_FAMILIES=['alloha','mirkinoz','hdrezka','filmix','vibix','kodik'];"));
  assert(core.includes('function filmSourceOrder(){return FILM_FAMILIES.slice();}'));
});

test('discontinued provider settings are removed',()=>{
  const registration=wrapper.slice(wrapper.indexOf('function registerSettings()'));
  for(const name of ["['kinopub','KinoPub / КПУ']",
    "['redheadsound','RHS']","['skaztv','Skaz TV']"])
    assert(!registration.includes(name),name);
  assert(registration.includes("['vibix','VIBIX'],['kodik','Kodik']"));
});

test('wrapper auto-series only ranks three providers',()=>{
  const h=fixture(),series={media_type:'tv',name:'Show',number_of_seasons:25};
  const items=['kinopub','filmix','hdrezka','skaztv','alloha','vibix','kodik',
    'redheadsound','rezka','collaps','mirkinoz'].map(row);
  const result=h.root.__capsuleSkazOnlineDebug.sourceOrder(items,series);
  assert.deepEqual(Array.from(result,x=>x.key),
    ['alloha','hdrezka','filmix','vibix','kodik']);
});

test('wrapper auto-movie only ranks three providers',()=>{
  const h=fixture(),film={media_type:'movie',title:'Film'};
  const items=['vibix','filmix','hdrezka','skaztv','alloha','mirkinoz',
    'kodik','redheadsound','kinopub','rezka'].map(row);
  const result=h.root.__capsuleSkazOnlineDebug.sourceOrder(items,film);
  assert.deepEqual(Array.from(result,x=>x.key),
    ['alloha','mirkinoz','hdrezka','filmix','vibix','kodik']);
});

test('source selection cannot be pulled to first response by economy mode',()=>{
  assert(core.includes('function filmSearchMode(){'));
  assert(core.includes("return 'normal';"));
  assert(!wrapper.includes("economy:'Экономный · быстро'"));
});
test('series queues all its automatic candidates together',()=>{
  const part=section('this.compareSeriesSources = function(',
    'this.currentSourceRows = function()');
  assert(part.includes('keys.forEach(function(key){probe(key,sources[key].url'));
  assert(part.includes('deadline=setTimeout(finish,3250)'));
  assert(part.includes('var limit=depth===0?2400:1050')||
    part.includes('var limit=depth===0?2400:1050;'));
  assert(part.includes('owner.__csoGapPlan=null'));
  assert(!part.includes('queueRoot('));
  assert(!part.includes('function enqueue('));
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
    Network,account:url=>url,skazAuthHeaders:()=>({}),
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
  assert(scan.includes('var limit=depth===0?2400:1050'));
  assert(scan.includes('if(next&&depth===0&&filmValidUrl(next.url,true))'));
  assert(scan.includes('probe(key,next.url,next.text,1)'));
  assert(core.includes('limit=isRootRequest?(self.__csoSimpleSeries?6900:10500):9900'));
  assert(scan.includes('net.timeout(limit-200)'));
  assert(!scan.includes('depth:4'));
});

test('external IDs must finish before any Lite Events check starts',()=>{
  const part=section('this.retryCatalog = function(){','this.initialize = function() {');
  assert(part.includes('owner.__csoIdsPromise=owner.externalids()'));
  assert(part.includes('graceTimer=setTimeout(launchCatalog,420)'));
  assert(part.includes('owner.createSource().then('));
  assert(core.includes('this.retryCatalog();'));
  const external=section('this.externalids = function(){','this.changeBalanser = function(name,automatic) {');
  assert(external.includes('6200'));
  assert(external.includes('6000'));
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
  assert(scan.includes("responseRemember('series_html',target,html,18000)"));
  assert(request.includes("cachedRoot=isRootRequest?responseRead('series_html',path):null"));
  assert(request.includes('self.parse(cachedRoot);'));
  assert(request.includes("responseRemember('series_html',path,html,25000)"));
  assert(request.includes('limit=isRootRequest?(self.__csoSimpleSeries?6900:10500):9900'));
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
  assert(serial.includes("detail.stage='rch-pending'"));
  assert(!serial.includes('ensureRchBridge('),
    'do not block ranking on a slow socket handshake');
  assert(film.includes('readRchChallenge(response)'));
  assert(film.includes('ensureRchBridge(challenge,function(ready)'));
  assert(film.includes('if(retried)return callback(null)'));
});

test('0.27 expanded TV catalog preserves every Skaz balancer, including show:false',()=>{
  const context={
    object:{cso_manual_screen:true,movie:{media_type:'tv'}},
    sourceCatalog:Object.create(null),
    isEpisodeMedia:()=>true,
    balanserName:r=>r.balanser,
    filmSourceFamily:r=>r.balanser,
    seriesFamily:r=>r.balanser,
    filmValidUrl:u=>/^https?:\/\//.test(String(u||'')),
    posterThumbUrl:x=>x||'',
    seriesProviderAllowed:r=>['alloha','hdrezka','filmix'].includes(r.balanser),
    allowedSeriesProvider:r=>['alloha','mirkinoz','hdrezka'].includes(r.balanser),
    filmItemAllowed:()=>true
  };
  vm.runInNewContext(
    section('function ownerManualMode(){','var requestRevision=')+
    section('function eligibleProvider(row){','// Pure helpers also serve'),
    context,{timeout:5000});
  const catalog=[
    {balanser:'alloha',name:'Аллоха',url:'https://cdn.invalid/alloha',show:true},
    {balanser:'filmix',name:'Филмикс',url:'https://cdn.invalid/filmix',show:true},
    {balanser:'kodik',name:'Кодик',url:'https://cdn.invalid/kodik',show:false},
    {balanser:'skaztv',name:'Сказ ТВ',url:'https://cdn.invalid/skaztv',show:true},
    {balanser:'redheadsound',name:'RHS',url:'https://cdn.invalid/rhs',show:false},
    {balanser:'kinopub',name:'КПУ',url:'https://cdn.invalid/kpu',show:true},
    {balanser:'hdrezka',name:'HDRezka',url:'https://cdn.invalid/rezka',show:true}
  ];
  context.mergeCatalogRows(catalog);
  assert.deepEqual(Object.keys(context.sourceCatalog).sort(),
    catalog.map(r=>r.balanser).sort());
  assert.equal(context.sourceCatalog.kodik.show,false);
  assert.equal(context.sourceCatalog.kodik.name,'Кодик');
  assert.equal(context.sourceCatalog.redheadsound.url,'https://cdn.invalid/rhs');
  context.object.cso_manual_screen=false;
  context.sourceCatalog=Object.create(null);
  context.mergeCatalogRows(catalog);
  assert.deepEqual(Object.keys(context.sourceCatalog).sort(),
    ['alloha','filmix','hdrezka']);
});
test('0.27 expanded movie catalog also preserves the entire Skaz list',()=>{
  const sectionCode=section('function ownerManualMode(){','var requestRevision=')+
    section('function eligibleProvider(row){','// Pure helpers also serve');
  const env={
    object:{cso_manual_screen:true,movie:{media_type:'movie'}},
    sourceCatalog:Object.create(null),
    isEpisodeMedia:()=>false,
    balanserName:r=>r.balanser,
    filmSourceFamily:r=>r.balanser,
    seriesFamily:r=>r.balanser,
    filmValidUrl:u=>/^https?:\/\//.test(String(u||'')),
    posterThumbUrl:x=>x||'',
    seriesProviderAllowed:()=>false,
    allowedSeriesProvider:r=>['alloha','mirkinoz','hdrezka'].includes(r.balanser),
    filmItemAllowed:()=>true
  };
  vm.runInNewContext(sectionCode,env,{timeout:5000});
  const rows=['alloha','mirkinoz','hdrezka','filmix','vibix','kpu','skaztv','kodik','rhs'].map(row);
  env.mergeCatalogRows(rows);
  assert.deepEqual(Object.keys(env.sourceCatalog).sort(),
    rows.map(r=>r.balanser).sort());
  env.object.cso_manual_screen=false;
  env.sourceCatalog=Object.create(null);
  env.mergeCatalogRows(rows);
  assert.deepEqual(Object.keys(env.sourceCatalog).sort(),
    ['alloha','hdrezka','mirkinoz']);
});
test('0.27 direct manual search has no lifecycle preflight or forced season comparison',()=>{
  const request=section('this.createSource = function(){','this.create = function() {');
  assert(request.includes("'lite/events?life=false'"));
  assert(!request.includes("'lite/events?life=true'"));
  const source=section('this.startSource = function(json)', 'this.lifeSource = function(initial)');
  assert(source.includes('if(!owner.__csoManualView)'));
  assert(source.includes('if(owner.__csoManualView)return choose(null)'));
  const ui=section('this.filter = function(filter_items, choice)', 'this.selected = function(filter_items)');
  assert(ui.includes('ownerManualMode()||filmSourceEnabled('));
  const menu=section('this.changeBalanser = function(name,automatic) {','this.requestParams = function(url)');
  assert(menu.includes('!this.__csoManualView'));
  assert(core.includes("file.method==='play',_this5.__csoManualView"));
});

test('0.27 automatic search finishes without waiting for unrelated Skaz plugins',()=>{
  const result=stagedCatalogFixture([
    {ready:false,tasks:8,pending:['vibix','kodik','skaztv'],
      online:['alloha','hdrezka','filmix'].map(row)}
  ]);
  result.scan([]);
  assert.equal(result.count,1);
  assert.equal(result.meta.reason,'target_ready');
  assert.equal(result.meta.complete,true);
});
test('0.27 auto scan budgets are independent of full manual source catalog',()=>{
  const request=section('this.createSource = function(){','this.create = function() {');
  assert(request.includes("'lite/events?life=false'"));
  assert(core.includes('deadline=setTimeout(finish,3250)'));
  assert(core.includes('limit=Math.min(7,ranked.length)'));
  assert(core.includes('},7600);'));
  assert(core.includes('catalogLimit=owner.__csoManualView?9000:8500'));
  assert(core.includes("lite/events?life=false',movie"));
});

test('0.27 movie signer chooses verified candidate by 14.5s and once only',()=>{
  const film=section('function resolveCandidates(){','function scanProviders(providers)');
  assert(film.includes('limit=Math.min(7,ranked.length)'));
  assert(film.includes('decided=false'));
  assert(film.includes('if(!alive()||decided)return;'));
  assert(film.includes('decided=true;'));
  assert(film.includes('job.report.resolveDeadline=true;'));
  assert(film.includes('},5600);'));
  assert(film.includes("},false,3900)"));
});

test('0.27 source settings affect only auto; no longer ban manual Skaz provider',()=>{
  const settings=wrapper.slice(wrapper.indexOf('function registerSettings()'));
  assert(settings.includes('Расширенный режим показывает все источники Skaz независимо от этого параметра.'));
  assert(settings.includes("['vibix','VIBIX'],['kodik','Kodik']"));
  const playback=section('function filmPlaybackAllowed(provider,file,voice,stream,finalCheck,manual)',
    'function filmFolderAllowed(provider,row,voice)');
  assert(playback.includes('(!manual&&!filmSourceEnabled(provider))'));
  const instance=section('this.changeBalanser = function(name,automatic) {','this.requestParams = function(url)');
  assert(instance.includes('!this.__csoManualView'));
});

test('0.27 HDRezka pending alias rezka must not be mistaken for unrelated provider',()=>{
  const state=stagedCatalogFixture([
    {ready:false,tasks:5,pending:['rezka','skaztv'],
      online:[row('alloha')]},
    {ready:true,tasks:5,pending:[],
      online:['alloha','hdrezka','filmix'].map(row)}
  ]);
  state.scan([]);
  assert.equal(state.count,2);
  assert.equal(state.meta.reason,'ready');
  assert.deepEqual(Array.from(state.result,x=>x.balanser),
    ['alloha','hdrezka','filmix']);
});


test('0.28 series selection samples one voice, never crawls episodes, and prefers Season 1',()=>{
  const roots={
    'alloha':{items:[{text:'Сезон 12',url:'https://alloha/s12',method:'link'}],buttons:[]},
    'hdrezka':{items:[],buttons:[{text:'Дубляж',url:'https://hdrezka/dub',method:'link'}]},
    'filmix':{items:[],buttons:[{text:'Дубляж',url:'https://filmix/dub',method:'link'}]},
    'vibix':{items:[{text:'Сезон 24',url:'https://vibix/s24',method:'link'}],buttons:[]},
    'kodik':{items:[{text:'Сезон 18',url:'https://kodik/s18',method:'link'}],buttons:[]}
  };
  const pages=Object.create(null),keys=Object.keys(roots);
  keys.forEach(k=>pages['https://'+k+'?card=1']=roots[k]);
  pages['https://hdrezka/dub']={
    items:Array.from({length:15},(_,i)=>({
      text:'Сезон '+(i+1),url:'https://hdrezka/s'+(i+1),method:'link'
    })),buttons:[]
  };
  pages['https://filmix/dub']={items:[
    {text:'Сезон 30',url:'https://filmix/s30',method:'link'}
  ],buttons:[]};
  const requests=[],timeouts=new Map(),ctx={
    sources:Object.fromEntries(keys.map(k=>[k,{
      url:'https://'+k,name:k,show:true,seasonCount:k==='filmix'?30:1
    }])),
    SERIES_CHECK_ORDER:keys.slice(),
    seriesSourceEnabled:()=>true,
    filmValidUrl:u=>/^https?:\/\//.test(String(u||'')),
    filmSkazUrl:u=>u,
    object:{movie:{media_type:'tv'},lampac_custom_select:false},
    automaticSelectionEnabled:()=>true,
    filmVoiceBlocked:()=>false,
    filmVoiceIdentityKnown:l=>l==='Дубляж',
    filmLanguagePriority:()=>2,
    filmVoiceRank:l=>l==='Дубляж'?90:0,
    readRchChallenge:()=>null,
    responseRead:()=>null,responseRemember:()=>{},
    account:u=>u,skazAuthHeaders:()=>({}),window:{},document:{},
    $:function(){},Date,Lampa:{Storage:{get:()=>''}},
    setTimeout(fn,ms){const key=Symbol();timeouts.set(key,{fn,ms});return key;},
    clearTimeout(id){timeouts.delete(id);}
  };
  ctx.Network=function(){
    this.timeout=()=>{};this.clear=()=>{};
    this.native=(url,resolve)=>{
      requests.push(url);
      resolve(pages[url]?JSON.stringify(pages[url]):'');
    };
  };
  vm.runInNewContext(section('this.compareSeriesSources = function(ready,callback)',
    'this.currentSourceRows = function()'),ctx,{timeout:5000});
  const instance={
    __csoManualView:false,requestParams:u=>u+'?card=1',
    parseProviderRows:html=>JSON.parse(html||'{"items":[],"buttons":[]}')
  };
  let answer=null,callbacks=0;
  ctx.compareSeriesSources.call(instance,keys,r=>{answer=r;callbacks++;});
  assert.equal(callbacks,1,'synchronous network callbacks must not finish before all roots');
  assert.equal(requests.length,7,'5 roots and 2 best voice menus only');
  assert(requests.every(u=>!u.includes('/s12')&&!u.includes('/s30')),
    'never visit episode/season links during preflight');
  const ranked=Object.keys(answer).sort((a,b)=>answer[b]-answer[a]);
  assert.equal(ranked[0],'hdrezka',
    '15 observed seasons beginning with 1 outweigh a lonely Season 30');
  assert.equal(instance.__csoBestSeriesVoice.hdrezka.text,'Дубляж');
  assert.equal(ctx.window.__capsuleSeriesLastScan.strategy,
    'lightweight-root-and-one-voice');
});

test('0.28 film probing only follows two promising folders; never scans all links',()=>{
  const pages={
    'https://alloha/?card=1':{
      videos:[],voices:[
        {url:'https://alloha/voice-a',text:'Дубляж',method:'link'},
        {url:'https://alloha/voice-b',text:'Любительская',method:'link'},
        {url:'https://alloha/voice-c',text:'Озвучка 3',method:'link'}
      ],links:Array.from({length:22},(_,i)=>({
        url:'https://alloha/extra'+i,text:'Раздел '+i,method:'link'
      }))
    },
    'https://alloha/voice-a':{
      videos:[],voices:[],links:[{
        url:'https://alloha/4k',text:'4K',method:'link'
      }]
    },
    'https://alloha/voice-b':{
      videos:[{url:'https://alloha/file',method:'call'}],voices:[],links:[]
    },
    'https://alloha/4k':{
      videos:[{url:'https://alloha/4k-file',method:'call'}],voices:[],links:[]
    }
  };
  const calls=[],job={report:{providerStages:{},candidateCount:0}};
  const ctx={
    job,movie:{title:'Film',id:123},alive:()=>true,Date,
    filmSourceFamily:r=>r.balanser,
    filmValidUrl:u=>/^https?:\/\//.test(String(u||'')),
    filmSkazUrl:u=>u,filmRequestParams:u=>u+'?card=1',
    filmParseHtml:html=>pages[html]||{videos:[],voices:[],links:[]},
    filmFolderAllowed:()=>true,
    filmVoiceCategory:l=>l==='4K'?'':l==='Дубляж'?'dub':'other',
    filmVoiceRank:l=>l==='Дубляж'?90:0,
    filmQualityHeight:l=>l==='4K'?2160:0,
    sourceLanguage:()=> 'ru',
    addCandidate(){job.report.candidateCount++;},
    request(url,mode,fn,retry,limit){
      calls.push({url,limit});
      fn(url);
    },
    timer(){return 123;},clearTimeout(){}
  };
  vm.runInNewContext(section('function probeSource(provider,complete)',
    'function playVerified(choice)'),ctx,{timeout:5000});
  let completed=0;
  ctx.probeSource({balanser:'alloha',url:'https://alloha/'},()=>completed++);
  assert.equal(completed,1);
  assert(calls.length<=3,'at most three requests per provider');
  assert(calls.some(c=>c.url==='https://alloha/voice-a'));
  assert(calls.every(c=>!c.url.includes('/extra')),
    'large generic folder lists must not trigger a crawl');
  assert(calls.every(c=>c.limit<=2600));
});

test('0.28 startup never waits for asynchronous Skaz wide-search lifecycle',()=>{
  const movie=section('function filmAutoLaunch(movie)','window.__capsuleFilmAutoLaunch=filmAutoLaunch');
  const start=section('this.createSource = function(){','this.create = function() {');
  assert(movie.includes("'lite/events?life=false',movie"));
  assert(!movie.includes("'lite/events?life=true',movie"));
  assert(start.includes("'lite/events?life=false'"));
  assert(!start.includes("'lite/events?life=true'"));
  assert(core.includes('deadline=setTimeout(finish,3250)'));
  assert(core.includes('},7600);'));
  assert(!core.includes('maxRequests=18,maxDepth=4'));
});

test('0.28 manual picker remains independent from auto provider lists and filters',()=>{
  const coreCatalog=section('function ownerManualMode(){','var requestRevision=');
  assert(coreCatalog.includes('if(!row||!eligibleProvider(row))return;'));
  assert(coreCatalog.includes('manual?balanserName(row)'));
  const manual=section('this.startSource = function(json)','this.lifeSource = function(initial)');
  assert(manual.includes('if(owner.__csoManualView)return choose(null)'));
  const policies=section('function filmPlaybackAllowed(provider,file,voice,stream,finalCheck,manual)',
    'function filmFolderAllowed(provider,row,voice)');
  assert(policies.includes('(!manual&&!filmSourceEnabled(provider))'));
  assert(wrapper.includes("['vibix','VIBIX'],['kodik','Kodik']"));
});

test('RCH remote commands cannot evaluate JavaScript or call local/private URLs',()=>{
  const rch=core.slice(core.indexOf('window.rch_nws[hostkey].Registry ='),
    core.indexOf('function rchInvoke('));
  assert(rch.includes("url === 'eval' || url === 'evalrun'"));
  assert(!rch.includes('eval(data)') && !rch.includes('result(eval('), 'RCH must not use eval');
  assert(core.includes('function rchAllowedAddress(value)'));
  assert(core.includes('!rchAllowedAddress(url)'));
  assert(!core.includes('putScript(["http://online"'),
    'Never load executable RCH client script over HTTP');
  assert(core.includes("encodeURIComponent(rchId)"));
});

test('expiration removes stale keys from the bounded RAM cache order',()=>{
  assert(core.includes('responseMemoryOrder.splice(expiredAt,1)'));
});

test('Skaz credentials are only attached to exact official hosts',()=>{
  const start=core.indexOf('  function skazCredentialTarget(');
  const end=core.indexOf('  function account(url) {',start);
  assert(start>=0 && end>start);
  const helper=core.slice(start,end);
  const env={Lampa:{Storage:{get(){return 'MOCK_KEY';}}}};
  const safe=vm.runInNewContext(helper+
    '\n ({allowed:skazCredentialTarget,headers:skazAuthHeaders})',env,
    {timeout:2000});
  for(const u of ['http://online3.skaz.tv/lite/events',
    'https://skaz.tv/test','https://onlinecf7.skaz.tv/media']){
    assert.equal(safe.allowed(u),true,u);
    assert.equal(safe.headers(u)['X-Kit-AesGcm'],'MOCK_KEY');
  }
  for(const u of ['http://online3.skaz.tv.attacker.example/',
    'https://skaz.tv@evil.example/','https://localhost/private',
    'https://third-party.invalid/movie','file:///data/app',
    'https://skaz.tv:444/secret']){
    assert.equal(safe.allowed(u),false,u);
    assert.equal(Object.keys(safe.headers(u)).length,0,u);
  }
  assert(core.includes('if (!skazCredentialTarget(url)) return url'),
    'email and account UID must not be appended to third-party URLs');
  assert.equal(core.split('skazAuthHeaders(').length - 1,14,
    'all 13 legacy X-Kit-AesGcm call sites must use the gate');
});

test('catalog mirror candidates are bounded official hosts and deterministic',()=>{
  const fragment=section('function skazCatalogHosts(){',
    '// Short-lived, bounded RAM-only catalog/menu cache.');
  const context={Defined:{localhost:'http://online5.skaz.tv/'},
    vybor:['http://online3.skaz.tv/','http://online4.skaz.tv/',
      'http://online5.skaz.tv/','http://online7.skaz.tv/',
      'http://skaz.tv.attacker.test/']};
  vm.runInNewContext(fragment,context,{timeout:3000});
  assert.deepEqual(Array.from(context.skazCatalogHosts()),
    ['http://online5.skaz.tv/','http://online3.skaz.tv/',
      'http://online4.skaz.tv/','http://online7.skaz.tv/']);
  assert.equal(context.skazCatalogUsable(null),false);
  assert.equal(context.skazCatalogUsable({online:[]}),false);
  assert.equal(context.skazCatalogUsable({online:[{balanser:'alloha'}]}),true);
  assert.equal(context.skazCatalogUsable({life:true,memkey:'mem'}),true);
  assert.equal(context.skazCatalogUsable('{invalid'),false);
});
test('movie fallback chooses second mirror after empty catalog',()=>{
  const fragment=section('function startCatalog(){',
    'if(movie.imdb_id&&movie.kinopoisk_id)startCatalog();');
  const roots=['http://online3.skaz.tv/','http://online4.skaz.tv/'];
  const calls=[],seen=[],context={
    alive:()=>true,skazCatalogHosts:()=>roots,
    filmRequestParams:(url)=>url,
    movie:{id:123},
    job:{report:{}},
    Defined:{localhost:roots[0]},
    skazCatalogUsable:data=>!!data&&Array.isArray(data.online)&&data.online.length>0,
    request(url,mode,callback){calls.push(url);
      callback(url.includes('online3')?{online:[]}:
        {online:[{balanser:'alloha',url:'https://example.test'}]});},
    withCatalog(data){seen.push(data);},
    showError(message){throw Error(message);},
    timer(){throw Error('No timer needed after synchronous success');}
  };
  vm.runInNewContext(fragment,context,{timeout:3000});
  context.startCatalog();
  assert.equal(calls.length,2);
  assert.equal(seen.length,1);
  assert.equal(context.Defined.localhost,roots[1]);
  assert.equal(context.job.report.catalogHostsTried,2);
});
test('series catalog recovers failed backend without losing selected movie',async()=>{
  const body=section('this.createSource = function(){',
    'this.create = function() {');
  const roots=['http://online3.skaz.tv/','http://online4.skaz.tv/'];
  const requested=[],cleared=[];
  const context={
    skazCatalogHosts:()=>roots,eligibleProvider:()=>true,
    filmValidUrl:url=>String(url||'').startsWith('https://'),
    Defined:{localhost:roots[0]},
    account:url=>url,skazAuthHeaders:()=>({}),
    window:{},console,Promise,
    setTimeout(){return 1;},clearTimeout(){},
    Network:function(){
      this.timeout=()=>{};this.clear=()=>cleared.push(1);
      this.silent=(url,onSuccess,onError)=>{
        requested.push(url);
        if(url.includes('online3'))onError(new Error('Unavailable'));
        else onSuccess([{balanser:'alloha',url:'https://example.test/movie'}]);
      };
    }
  };
  vm.runInNewContext('var service={};'+body.replace('this.createSource =','service.createSource ='),context,
    {timeout:3000});
  const movie={id:22,title:'Title'};
  const service=context.service;
  service.__csoManualView=false;
  service.requestParams=url=>url+'?id='+movie.id;
  service.startSource=rows=>Promise.resolve(rows);
  const result=await service.createSource();
  assert.equal(requested.length,2);
  assert.equal(result[0].balanser,'alloha');
  assert.equal(context.Defined.localhost,roots[1]);
});
test('error screen exposes a retry instead of removing all buttons',()=>{
  const ui=section('this.noConnectToServer = function(er)',
    'this.getLastEpisode = function(items)');
  assert(ui.includes("cso-search-retry"));
  assert(ui.includes("owner.retryCatalog()"));
  assert(!ui.includes(".online-empty__buttons').remove()"));
  const lifecycle=section('this.retryCatalog = function(){','this.initialize = function() {');
  assert(lifecycle.includes('owner.__csoCatalogBusy'));
  assert(lifecycle.includes('owner.__csoIdsPromise=owner.externalids()'));
  assert(lifecycle.includes('owner.createSource()'));
});

test('film provider catalog ignores media labels until playable files are verified',()=>{
  const fragment=section('function eligibleProvider(row){','// Pure helpers also serve');
  const ctx={
    ownerManualMode:()=>false,
    object:{movie:{media_type:'movie'}},
    isEpisodeMedia:()=>false,
    filmItemAllowed:()=>false,
    allowedSeriesProvider:()=>true,
    seriesProviderAllowed:()=>true,
    balanserName:()=> 'alloha'
  };
  vm.runInNewContext(fragment,ctx,{timeout:2000});
  assert.equal(ctx.eligibleProvider({
    balanser:'alloha',url:'https://skaz.tv/provider',media_type:'tv'
  }),true,'catalog source metadata must not suppress a film provider');
  assert.equal(ctx.eligibleProvider({balanser:'alloha',url:'file:///etc/passwd'}),
    false,'invalid provider schemes stay blocked');
});

test('provider labels and metadata are escaped before entering UI templates',()=>{
  const code=section('function csoEscapeHtml(value){',
    '// Provider markup must never execute scripts');
  const ctx={};
  vm.runInNewContext(code,ctx,{timeout:2000});
  assert.equal(ctx.csoEscapeHtml('<img src=x onerror="bad()" >&'),
    '&lt;img src=x onerror=&quot;bad()&quot; &gt;&amp;');
  assert.equal(ctx.csoEscapeHtml(null),'');
  assert(core.includes("title:csoEscapeHtml(elem.title)"));
  assert(core.includes("title:csoEscapeHtml(element.title)"));
  assert(core.includes("title: csoEscapeHtml(episode.name)"));
  assert(core.includes("info.push(csoEscapeHtml(element.info))"));
});
test('provider HTML is isolated from the Lampa document',()=>{
  const src=section('function skazSafeMenuRoot(html){','function skazCatalogHosts(){');
  const visited=[],attrs=[{name:'onclick',value:'bad()'},{name:'data-json',value:'{}'}];
  const elem={attributes:attrs,removeAttribute(name){
    const index=attrs.findIndex(a=>a.name===name);
    if(index>=0)attrs.splice(index,1);
  }};
  const doc={createElement(){
    return {appendChild(){},querySelectorAll(selector){
      return selector==='*'?[elem]:[];
    }};
  }};
  const activeDocument={
    implementation:{createHTMLDocument(){visited.push('isolated');return doc;}}
  };
  function jq(node){return {0:node};}
  jq.parseHTML=(html,context,keepScripts)=>{
    assert.equal(context,doc);
    assert.equal(keepScripts,false);
    return [];
  };
  const env={document:activeDocument,$:jq};
  vm.runInNewContext(src,env,{timeout:2000});
  const parsed=env.skazSafeMenuRoot('<div onclick="bad()" data-json="{}"></div>');
  assert(parsed && parsed[0]);
  assert.deepEqual(visited,['isolated']);
  assert.deepEqual(attrs.map(a=>a.name),['data-json']);
  assert(!core.includes('body.html(html)'));
  assert(!core.includes('root.html(str)'));
});
test('TV error recovery controls remain keyboard focusable',()=>{
  const block=section('this.noConnectToServer = function(er)','this.getLastEpisode = function(items)');
  assert(block.includes('collectionFocus(retry[0],scroll.render())'));
  assert(block.includes("collectionFocus(html.find('.cancel')[0],scroll.render())"));
});

test('automatic series fallback is bounded and manual choices remain pinned',()=>{
  const fragment=section('this.tryAutomaticSourceFallback = function(){',
    'this.changeBalanser = function(name,automatic) {');
  const env={
    object:{lampac_custom_select:false},
    automaticSelectionEnabled:()=>true,
    filter_sources:['alloha','hdrezka','filmix','vibix'],
    sources:Object.fromEntries(['alloha','hdrezka','filmix','vibix'].map(
      k=>[k,{url:'https://example.test/'+k,show:true}])),
    balanser:'alloha',
    filmValidUrl:u=>String(u||'').startsWith('https://'),
    seriesSourceEnabled:()=>true,window:{}
  };
  vm.runInNewContext('var owner={};'+fragment.replace(
    'this.tryAutomaticSourceFallback =','owner.tryAutomaticSourceFallback ='),
    env,{timeout:2000});
  const owner=env.owner,selected=[];
  owner.__csoSimpleSeries=true;
  owner.__csoManualView=false;
  owner.__csoManualSource=false;
  owner.changeBalanser=(key,automatic)=>{
    assert.equal(automatic,true);
    env.balanser=key;selected.push(key);return true;
  };
  assert.equal(owner.tryAutomaticSourceFallback(),true);
  assert.equal(owner.tryAutomaticSourceFallback(),true);
  assert.equal(owner.tryAutomaticSourceFallback(),false);
  assert.deepEqual(selected,['hdrezka','filmix']);
  owner.__csoManualSource=true;
  owner.__csoAutoTriedSources=null;
  env.balanser='alloha';
  assert.equal(owner.tryAutomaticSourceFallback(),false);
  assert.equal(selected.length,2);
});

test('cold catalogue keeps searching after initial empty mirrors and succeeds on warm retry',async()=>{
  const block=section('this.createSource = function(){','this.create = function() {');
  const roots=['http://online3.skaz.tv/','http://online4.skaz.tv/',
    'http://online5.skaz.tv/'];
  let time=0,id=0,scheduled=new Map(),requests=[];
  const fakeSetTimeout=(fn,ms)=>{const n=++id;scheduled.set(n,{fn,when:time+ms});return n;};
  const fakeClearTimeout=(n)=>scheduled.delete(n);
  const env={
    skazCatalogHosts:()=>roots,
    eligibleProvider:()=>true,
    filmValidUrl:url=>String(url||'').startsWith('https://'),
    Defined:{localhost:roots[0]},
    account:url=>url,skazAuthHeaders:()=>({}),
    window:{},Promise,Date:{now:()=>time},
    setTimeout:fakeSetTimeout,clearTimeout:fakeClearTimeout,
    Network:function(){
      this.timeout=()=>{};this.clear=()=>{};
      this.silent=(url,success)=>{
        requests.push(url);
        success(requests.length===4?
          {online:[{balanser:'alloha',url:'https://cdn.example.test/menu'}]}:
          {online:[],ready:false});
      };
    }
  };
  vm.runInNewContext('var service={};'+block.replace(
    'this.createSource =','service.createSource ='),env,{timeout:4000});
  env.service.requestParams=url=>url+'?id=22';
  env.service.__csoManualView=false;
  env.service.startSource=rows=>Promise.resolve(rows);
  const promise=env.service.createSource();
  assert.equal(requests.length,3,'first wave contains up to three mirrors');
  assert(scheduled.size>0,'warm retry must still be scheduled');
  const item=[...scheduled.entries()].filter(x=>x[1].when===2100)[0];
  assert(item,'a separate delayed warm-up retry is required');
  scheduled.delete(item[0]);time=item[1].when;item[1].fn();
  const result=await promise;
  assert.equal(requests.length,4);
  assert.equal(result[0].balanser,'alloha');
  assert.equal(env.window.__capsuleCatalogLastAttempt.phase,'ready');
});
test('cold external ID response can unlock the first catalogue search',async()=>{
  const block=section('this.createSource = function(){','this.create = function() {');
  const roots=['http://online3.skaz.tv/','http://online4.skaz.tv/',
    'http://online5.skaz.tv/'];
  let time=0,id=0,resolveIds,requests=[];
  const scheduled=new Map();
  const env={
    skazCatalogHosts:()=>roots,
    eligibleProvider:()=>true,
    filmValidUrl:url=>String(url||'').startsWith('https://'),
    Defined:{localhost:roots[0]},
    account:url=>url,skazAuthHeaders:()=>({}),
    window:{},Promise,Date:{now:()=>time},
    setTimeout(fn,ms){let n=++id;scheduled.set(n,{fn,when:time+ms});return n;},
    clearTimeout(n){scheduled.delete(n);},
    Network:function(){
      this.timeout=()=>{};this.clear=()=>{};
      this.silent=(url,success)=>{
        requests.push(url);
        success(url.includes('imdb=ready')?
          {online:[{balanser:'hdrezka',url:'https://cdn.example.test'}]}:
          {online:[]});
      };
    }
  };
  vm.runInNewContext('var service={};'+block.replace(
    'this.createSource =','service.createSource ='),env,{timeout:4000});
  env.service.__csoManualView=false;
  env.service.__csoIdsPromise=new Promise(r=>{resolveIds=r;});
  let gotIds=false;
  env.service.requestParams=url=>url+(url.includes('?')?'&':'?')+
    (gotIds?'imdb=ready':'imdb=missing');
  env.service.startSource=rows=>Promise.resolve(rows);
  const result=env.service.createSource();
  assert.equal(requests.length,3);
  gotIds=true;time=4500;resolveIds(true);
  await Promise.resolve();
  const rows=await result;
  assert.equal(rows[0].balanser,'hdrezka');
  assert.equal(env.window.__capsuleCatalogLastAttempt.idsUpdated,true);
});
test('cold bootstrap does not block on the full external ID timeout',()=>{
  const block=section('this.retryCatalog = function(){','this.initialize = function() {');
  assert(block.includes('graceTimer=setTimeout(launchCatalog,420)'));
  assert(block.includes('owner.__csoIdsPromise=owner.externalids()'));
  assert(block.includes('owner.createSource().then('));
  assert(!block.includes('return owner.createSource()'));
});
test('error screen replaces stale skeleton markup and preserves the retry control',()=>{
  const fail=section('this.noConnectToServer = function(er)',
    'this.getLastEpisode = function(items)');
  const run=section('this.retryCatalog = function(){',
    'this.initialize = function() {');
  assert(fail.includes('scroll.body().empty()'));
  assert(run.includes('scroll.body().empty()'));
  assert(fail.includes('collectionFocus(retry[0],scroll.render())'));
});

test('first cold launch survives four empty responses and warms up without manual retry',async()=>{
  const source=section('this.createSource = function(){','this.create = function() {');
  const hosts=['http://online3.skaz.tv/','http://online4.skaz.tv/',
    'http://online5.skaz.tv/'];
  let now=0,nextId=0,attempts=0;
  const timers=new Map();
  const context={
    skazCatalogHosts:()=>hosts,
    eligibleProvider:()=>true,
    filmValidUrl:url=>String(url||'').startsWith('https://'),
    Defined:{localhost:hosts[0]},
    account:url=>url,skazAuthHeaders:()=>({}),Promise,
    Date:{now:()=>now},window:{},
    setTimeout(fn,ms){const n=++nextId;timers.set(n,{fn,at:now+ms});return n;},
    clearTimeout(id){timers.delete(id);},
    Network:function(){
      this.clear=()=>{};this.timeout=()=>{};
      this.silent=(url,success)=>{
        attempts++;
        success(attempts===5?
          {online:[{balanser:'alloha',url:'https://cdn.example.test/video'}]}:
          {online:[]});
      };
    }
  };
  vm.runInNewContext('var service={};'+source.replace('this.createSource =',
    'service.createSource ='),context,{timeout:5000});
  context.service.__csoManualView=false;
  context.service.__csoIdsPromise=Promise.resolve(false);
  context.service.requestParams=url=>url+'?id=42';
  context.service.startSource=rows=>Promise.resolve(rows);
  const promise=context.service.createSource();
  assert.equal(attempts,3);
  await Promise.resolve(); // settle the external ID promise
  function fireAt(when){
    const event=[...timers.entries()].find(([,item])=>item.at===when);
    assert(event,'no scheduled recovery at '+when);
    timers.delete(event[0]);now=event[1].at;event[1].fn();
  }
  fireAt(2100);
  assert.equal(attempts,4);
  fireAt(4900);
  const rows=await promise;
  assert.equal(rows.length,1);
  assert.equal(attempts,5);
  assert.equal(context.window.__capsuleCatalogLastAttempt.phase,'ready');
});
test('cold catalog has a strict wall-clock and request budget on total failure',async()=>{
  const source=section('this.createSource = function(){','this.create = function() {');
  const hosts=['http://online3.skaz.tv/','http://online4.skaz.tv/',
    'http://online5.skaz.tv/'];
  let now=0,nextId=0,attempts=0;
  const timers=new Map();
  const context={
    skazCatalogHosts:()=>hosts,eligibleProvider:()=>true,
    filmValidUrl:()=>true,Defined:{localhost:hosts[0]},
    account:url=>url,skazAuthHeaders:()=>({}),Promise,
    window:{},Date:{now:()=>now},
    setTimeout(fn,ms){const n=++nextId;timers.set(n,{fn,at:now+ms});return n;},
    clearTimeout(id){timers.delete(id);},
    Network:function(){
      this.clear=()=>{};this.timeout=()=>{};
      this.silent=()=>{attempts++;};
    }
  };
  vm.runInNewContext('var service={};'+source.replace('this.createSource =',
    'service.createSource ='),context,{timeout:5000});
  context.service.__csoManualView=false;
  context.service.__csoIdsPromise=Promise.resolve(false);
  context.service.requestParams=url=>url;
  context.service.startSource=rows=>Promise.resolve(rows);
  const promise=context.service.createSource();
  await Promise.resolve();
  const due=[...timers.entries()].sort((a,b)=>a[1].at-b[1].at);
  for(let step=0;step<30&&timers.size;step++){
    const item=[...timers.entries()].sort((a,b)=>a[1].at-b[1].at)[0];
    timers.delete(item[0]);now=item[1].at;item[1].fn();
    if(now>=8500)break;
  }
  await assert.rejects(promise,/не успел подготовить каталог/);
  assert(attempts<=5,'bounded cold recovery');
  assert.equal(context.window.__capsuleCatalogLastAttempt.phase,'failed');
  assert.equal(now,8500);
});

test('screen teardown cancels cold lookup and pending catalog requests',()=>{
  const d=section('this.destroy = function()','// Removed dead global search-provider');
  assert(d.includes('this.__csoCancelCatalog()'));
  assert(d.includes('this.__csoCancelExternalIds()'));
  const catalog=section('this.createSource = function(){','this.create = function() {');
  assert(catalog.includes("owner.__csoCancelCatalog=function(){fail('closed');}"));
  const ids=section('this.externalids = function(){',
    'this.tryAutomaticSourceFallback = function(){');
  assert(ids.includes('owner.__csoCancelExternalIds=function(){finish();}'));
});
