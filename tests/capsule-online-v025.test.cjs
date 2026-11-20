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
  assert(core.includes("version: '0.30.2'"));
  assert(core.includes("Lampa.Component.add('capsuleamedia', component)"));
  assert(wrapper.includes('function enhance(instance,movie)'));
});

test('series automatic sources: Alloha HDRezka Filmix',()=>{
  assert(core.includes("var SERIES_FAMILIES=['alloha','hdrezka','filmix','kodik','collaps'];"));
  assert(core.includes('var SERIES_CHECK_ORDER=SERIES_FAMILIES.slice();'));
  assert(!core.includes('completeSerialCatalog()'));
});

test('movie automatic sources: Alloha Mir Kino Z HDRezka',()=>{
  assert(core.includes("var FILM_FAMILIES=['alloha','mirkinoz','hdrezka','filmix','kodik','collaps'];"));
  assert(core.includes('function filmSourceOrder(){return FILM_FAMILIES.slice();}'));
});

test('discontinued provider settings are removed',()=>{
  const registration=wrapper.slice(wrapper.indexOf('function registerSettings()'));
  for(const name of ["['kinopub','KinoPub / КПУ']",
    "['redheadsound','RHS']","['skaztv','Skaz TV']"])
    assert(!registration.includes(name),name);
  assert(registration.includes("['kodik','Kodik'],['collaps','Collaps']"));
});

test('wrapper auto-series only ranks three providers',()=>{
  const h=fixture(),series={media_type:'tv',name:'Show',number_of_seasons:25};
  const items=['kinopub','filmix','hdrezka','skaztv','alloha','vibix','kodik',
    'redheadsound','rezka','collaps','mirkinoz'].map(row);
  const result=h.root.__capsuleSkazOnlineDebug.sourceOrder(items,series);
  assert.deepEqual(Array.from(result,x=>x.key),
    ['alloha','hdrezka','filmix','kodik','collaps']);
});

test('wrapper auto-movie only ranks three providers',()=>{
  const h=fixture(),film={media_type:'movie',title:'Film'};
  const items=['vibix','filmix','hdrezka','skaztv','alloha','mirkinoz',
    'kodik','collaps','redheadsound','kinopub','rezka'].map(row);
  const result=h.root.__capsuleSkazOnlineDebug.sourceOrder(items,film);
  assert.deepEqual(Array.from(result,x=>x.key),
    ['alloha','mirkinoz','hdrezka','filmix','kodik','collaps']);
});

test('source selection cannot be pulled to first response by economy mode',()=>{
  assert(core.includes('function filmSearchMode(){'));
  assert(core.includes("return 'normal';"));
  assert(!wrapper.includes("economy:'Экономный · быстро'"));
});
test('series queues all its automatic candidates together',()=>{
  const part=section('this.compareSeriesSources = function(',
    'this.currentSourceRows = function()');
  assert(part.includes('enqueue({key:key,url:sources[key].url,depth:0'));
  assert(part.includes('deadline=setTimeout(finish,MAX_WAIT)'));
  assert(part.includes('MAX_WAIT=12800'));
  assert(part.includes('MAX_ACTIVE=9'));
  assert(part.includes('MAX_ACTIVE_LARGE=20'));
  assert(part.includes('diag.incomplete='));
  assert(part.includes('diag.providers[key].voice=sourcePlan.voice'));
  assert(part.includes('limit=task.depth===0?3500:2600'));
  assert(part.includes('owner.__csoGapPlan=null'));
  assert(part.includes('function enqueue('));
  assert(part.includes('MAX_REQUESTS=160'));
  assert(part.includes('MAX_PER_SOURCE=130'));
  assert(part.includes('probed<MAX_REQUESTS'));
  assert(part.includes("seriesMenuSameHost(row.url,task.url)"));
  assert(!part.includes('count>=Math.max(10,'));
  assert(part.includes('function pump('));
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
  assert(block.includes("kind==='series_html'||kind==='series_voice'||kind==='film_text'"));
  assert(block.includes("!/data-json\\s*=/i.test(payload)"));
});
test('source root timeout and recheck account for slow wake-up',()=>{
  const scan=section('this.compareSeriesSources = function(',
    'this.currentSourceRows = function()');
  assert(scan.includes('limit=task.depth===0?3500:2600'));
  assert(scan.includes('collect(task,html)'));
  assert(scan.includes('enqueue({key:task.key,url:row.url,depth:task.depth+1'));
  assert(scan.includes('seriesStudioKey(label)'));
  assert(core.includes('limit=second?4600:isRootRequest?'));
  assert(scan.includes('net.timeout(limit-200)'));
  assert(scan.includes('if(task.depth>=3)return'));
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
  assert(scan.includes('responseRemember(kind,target,html,18000)'));
  assert(request.includes("cachedRoot=isRootRequest?responseRead('series_html',path):null"));
  assert(request.includes('self.parse(cachedRoot);'));
  assert(request.includes("responseRemember('series_html',path,html,25000)"));
  assert(request.includes('limit=second?4600:isRootRequest?'));
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
    rows.filter(r=>r.balanser!=='vibix').map(r=>r.balanser).sort());
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
  assert(core.includes('deadline=setTimeout(finish,MAX_WAIT)'));
  assert(core.includes('limit=Math.min(7,ranked.length)'));
  assert(core.includes('},5300);'));
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
  assert(film.includes('},4600);'));
  assert(film.includes("},false,3900)"));
});

test('0.27 source settings affect only auto; no longer ban manual Skaz provider',()=>{
  const settings=wrapper.slice(wrapper.indexOf('function registerSettings()'));
  assert(settings.includes('Расширенный режим показывает все источники Skaz независимо от этого параметра.'));
  assert(settings.includes("['kodik','Kodik'],['collaps','Collaps']"));
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


test('automatic source URLs cannot target private addresses or embed credentials',()=>{
  const code=section('function filmSafeAutoTarget(raw){',
    '// A series is a set of verified season routes sharing one studio.');
  const ctx={
    filmSkazUrl:url=>url[0]==='/'?'https://online3.skaz.tv'+url:url,
    filmValidUrl:url=>/^https?:\/\//.test(url)
  };
  vm.runInNewContext(code,ctx,{timeout:3000});
  assert(ctx.filmSafeAutoTarget('https://online3.skaz.tv/media'));
  assert(ctx.filmSafeAutoTarget('https://hdrezka.example/movie'));
  for(const url of [
    'file:///etc/passwd','http://127.0.0.1:8080/private',
    'http://192.168.0.3/','http://10.0.0.1/',
    'http://169.254.10.1/','http://172.16.1.1/',
    'http://100.64.0.1/','http://localhost/panel',
    'http://db.internal/resource','http://skaz.tv@127.0.0.1/private',
    'https://[::1]/video'
  ])assert.equal(ctx.filmSafeAutoTarget(url),false,url);
});

test('whole-series planning merges ONLY the same studio and preserves season-specific routes',()=>{
  const ctx={
    SERIES_CHECK_ORDER:['alloha','hdrezka','filmix'],
    filmVoiceCategory:name=>/дубляж/i.test(name)?'dub':
      /rhs|рхс/i.test(name)?'rhs':'other',
    filmVoiceBlocked:()=>false,filmLanguagePriority:()=>4,
    filmVoiceRank:l=>/rhs|рхс/i.test(l)?8:/дубляж/i.test(l)?7:1,
    filmValidUrl:url=>/^https:\/\//.test(url),
    filmSkazUrl:url=>url,
    filmSafeAutoTarget:()=>true
  };
  vm.runInNewContext(section('function filmSafeAutoTarget(raw){',
    '// A single search session owns discovery evidence'),ctx,{timeout:5000});
  const make=(source,voice,nums)=>({
    source,voice,studio:ctx.seriesStudioKey(voice),
    route:[{url:'https://tv.example/'+source+'/'+voice}],
    seasons:nums.map(number=>({
      number,url:'https://tv.example/'+source+'/'+voice+'/s'+number}))
  });
  const boyz=ctx.buildSeriesPlan([
    make('alloha','RHS',[1]),make('alloha','Дубляж',[2,3,4]),
    make('hdrezka','RHS',[2,3,4]),make('filmix','Дубляж',[1])
  ],4,2);
  assert.equal(boyz.studio,'rhs','same RHS dub over the whole series');
  assert.deepEqual(Array.from(boyz.ordered),[1,2,3,4]);
  assert.equal(boyz.seasons[1].source,'alloha');
  assert.equal(boyz.seasons[2].source,'hdrezka');
  assert.equal(boyz.seasons[3].voice,'RHS');
  assert.equal(boyz.missing.length,0);
  assert.equal(boyz.complete,true);
  const simpsons=ctx.buildSeriesPlan([
    make('filmix','Дубляж',[30]),
    make('hdrezka','Дубляж',Array.from({length:35},(_,i)=>i+1)),
    make('alloha','2x2',[30,31,32])
  ],36,1);
  assert.equal(simpsons.studio,'dub');
  assert.equal(simpsons.primary.source,'hdrezka');
  assert.equal(simpsons.ordered[0],1);
  assert.equal(simpsons.verifiedCount,35);
  assert.equal(simpsons.complete,false,'36th season must not be invented');
  assert.deepEqual(Array.from(simpsons.missing),[36]);
  const genericDubs=ctx.buildSeriesPlan([
    make('alloha','Дубляж',[1,2]),
    make('hdrezka','Дубляж',[3,4])
  ],4,1);
  assert.equal(genericDubs.verifiedCount,4,
    'all observed seasons must be available even with unverified dub identities');
  assert.equal(genericDubs.complete,true);
  assert.equal(genericDubs.mixed,true,
    'generic dubbing on two providers is not assumed to be identical');
  assert.equal(genericDubs.seasons[1].source,'alloha');
  assert.equal(genericDubs.seasons[4].source,'hdrezka');
  assert.notEqual(ctx.seriesStudioKey('Невафильм'),
    ctx.seriesStudioKey('Пифагор'),
    'different named dub studios are not one generic dubbing category');
  assert.equal(ctx.seriesStudioKey('Озвучка 2х2'),
    ctx.seriesStudioKey('2x2'),'studio label prefixes are equivalent');
  assert.equal(ctx.seriesStudioKey('Перевод 2x2'),
    ctx.seriesStudioKey('2x2'));
  const gaps=ctx.buildSeriesPlan([
    make('alloha','RHS',[1,3])
  ],2,1);
  assert.equal(gaps.complete,false,'season 3 must not count as season 2');
  assert.deepEqual(Array.from(gaps.missing),[2]);
  const newer=ctx.buildSeriesPlan([
    make('hdrezka','RHS',[1,2,3,4,5])
  ],3,1);
  assert.deepEqual(Array.from(newer.ordered),[1,2,3,4,5],
    'new seasons beyond stale card metadata are not discarded');
});


test('stale season metadata and studio identities never override actual coverage',()=>{
  const ctx={
    SERIES_CHECK_ORDER:['alloha','hdrezka','filmix'],
    filmVoiceCategory:name=>/дубляж/i.test(name)?'dub':
      /rhs|рхс/i.test(name)?'rhs':'other',
    filmVoiceBlocked:()=>false,filmLanguagePriority:()=>4,
    filmVoiceRank:l=>/rhs|рхс/i.test(l)?8:/дубляж/i.test(l)?7:1,
    filmSkazUrl:u=>u,filmSafeAutoTarget:()=>true,
    filmValidUrl:()=>true
  };
  vm.runInNewContext(section('function filmSafeAutoTarget(raw){',
    '// A single search session owns discovery evidence'),ctx,{timeout:5000});
  const make=(source,voice,count)=>({
    source,voice,studio:ctx.seriesStudioKey(voice),route:[],
    seasons:Array.from({length:count},(_,i)=>({
      number:i+1,url:'https://example.test/'+source+'/'+voice+'/'+(i+1)}))
  });
  const plan=ctx.buildSeriesPlan([
    make('alloha','RHS',30),make('hdrezka','Дубляж',35)
  ],30,1);
  assert.equal(plan.verifiedCount,35);
  assert.equal(plan.expected,35,
    'card claiming 30 seasons must not make 30/30 look more complete than 35');
  assert.equal(plan.primary.source,'hdrezka');
  assert.equal(ctx.seriesStudioKey('Дубляж Студия Свет'),
    'studio:свет','specific dubbing studio must keep its identity');
  assert.notEqual(ctx.seriesStudioKey('Дубляж Студия Свет'),
    ctx.seriesStudioKey('Дубляж Студия Звук'));
});

test('when season coverage ties, verified episode counts outrank dubbing prestige',()=>{
  const keys=['alloha'],pages={},requests=[];
  const seasons=prefix=>Array.from({length:4},(_,i)=>({
    text:'Сезон '+(i+1),url:prefix+'/s'+(i+1),method:'link'
  }));
  const episodes=(prefix,count)=>Array.from({length:count},(_,i)=>({
    text:'Серия '+(i+1),url:prefix+'/episode'+(i+1),
    episode:i+1,method:'call'
  }));
  pages['https://alloha?card=1']={items:[],buttons:[
    {text:'RHS',url:'https://alloha/rhs',method:'link'},
    {text:'Дубляж',url:'https://alloha/dub',method:'link'}]};
  pages['https://alloha/rhs']={items:seasons('https://alloha/rhs'),buttons:[]};
  pages['https://alloha/dub']={items:seasons('https://alloha/dub'),buttons:[]};
  pages['https://alloha/rhs/s1']={items:episodes('https://alloha/rhs',2),buttons:[]};
  pages['https://alloha/dub/s1']={items:episodes('https://alloha/dub',9),buttons:[]};
  const ctx={
    sources:{alloha:{url:'https://alloha',name:'Alloha'}},
    SERIES_CHECK_ORDER:keys,seriesSourceEnabled:()=>true,
    filmValidUrl:()=>true,filmSkazUrl:u=>u,
    filmSafeAutoTarget:()=>true,filmFolderAllowed:()=>true,
    filmVoiceCategory:name=>/дубляж/i.test(name)?'dub':
      /rhs/i.test(name)?'rhs':'other',
    filmVoiceBlocked:()=>false,filmPlaybackAllowed:()=>true,
    filmVoiceRank:l=>/rhs/i.test(l)?8:/дубляж/i.test(l)?7:1,
    seriesSourceEnabled:()=>true,filmLanguagePriority:()=>4,
    automaticSelectionEnabled:()=>true,
    object:{movie:{media_type:'tv',number_of_seasons:4,
      seasons:[{season_number:1,episode_count:10}]},
      lampac_continue_season:1,lampac_custom_select:false},
    account:u=>u,skazAuthHeaders:()=>({}),readRchChallenge:()=>null,
    responseRead:()=>null,responseRemember:()=>{},
    window:{},document:{},$:()=>{},Date,
    Lampa:{Storage:{get:()=>''}},
    setTimeout:()=>1,clearTimeout:()=>{}
  };
  ctx.Network=function(){
    this.timeout=()=>{};this.clear=()=>{};
    this.native=(url,resolve)=>{
      requests.push(url);
      resolve(JSON.stringify(pages[url]||{items:[],buttons:[]}));
    };
  };
  vm.runInNewContext(section('function filmSafeAutoTarget(raw){',
    'this.currentSourceRows = function()'),ctx,{timeout:5000});
  const owner={__csoManualView:false,
    requestParams:u=>u+'?card=1',
    parseProviderRows:html=>JSON.parse(html)};
  let called=0;
  ctx.compareSeriesSources.call(owner,keys,()=>called++);
  assert.equal(called,1);
  assert.equal(owner.__csoSeriesPlan.studio,'dub');
  assert.equal(owner.__csoSeriesPlan.sampledEpisodes,9);
  assert.equal(owner.__csoSeriesPlan.verifiedCount,4);
  assert(requests.includes('https://alloha/rhs/s1'));
  assert(requests.includes('https://alloha/dub/s1'));
  assert(requests.every(u=>!/\/s(?:2|3|4)$/.test(u)),
    'episode sampling must not crawl every season');
});

test('Simpsons: HDRezka scans long voice menu and selects all seasons, not famous incomplete dub',()=>{
  const keys=['alloha','hdrezka','filmix'],pages={},requested=[];
  const seasonRows=nums=>nums.map(number=>({
    text:'Сезон '+number,url:'https://hdrezka/season/'+number,
    season_number:number,method:'link'
  }));
  const limited=Array.from({length:6},(_,i)=>i+30);
  const full=Array.from({length:35},(_,i)=>i+1);
  pages['https://alloha?card=1']={items:[],buttons:[
    {text:'RHS',url:'https://alloha/rhs',method:'link'}]};
  pages['https://alloha/rhs']={items:limited.map(n=>({
    text:'Сезон '+n,url:'https://alloha/s'+n,season_number:n,method:'link'
  })),buttons:[]};
  pages['https://filmix?card=1']={items:[],buttons:[]};
  const voices=Array.from({length:48},(_,i)=>({
    text:i===0?'RHS':i===47?'Coldfilm':'Голос '+i,
    url:'https://hdrezka/voice/'+i,method:'link'
  }));
  // This untrusted off-host link is NOT an alternate voice to crawl.
  voices.push({text:'Fake voice',url:'https://evil.example/fetch',method:'link'});
  pages['https://hdrezka?card=1']={items:voices,buttons:[]};
  voices.forEach((row,i)=>{
    pages[row.url]={items:(i===47?full:limited).map(n=>({
      text:'Сезон '+n,url:row.url+'/s'+n,season_number:n,method:'link'
    })),buttons:[]};
  });
  const ctx={
    sources:{alloha:{url:'https://alloha',name:'Alloha'},
      hdrezka:{url:'https://hdrezka',name:'HDRezka'},
      filmix:{url:'https://filmix',name:'Filmix'}},
    SERIES_CHECK_ORDER:keys,
    seriesSourceEnabled:()=>true,filmValidUrl:()=>true,
    filmSkazUrl:u=>u,filmSafeAutoTarget:()=>true,
    filmFolderAllowed:()=>true,
    filmVoiceCategory:name=>/rhs/i.test(name)?'rhs':
      /дубляж/i.test(name)?'dub':
      /^(?:1080p|720p|качество)$/i.test(name)?'':'other',
    filmVoiceBlocked:()=>false,filmPlaybackAllowed:()=>true,
    filmVoiceRank:voice=>/RHS/i.test(voice)?8:1,
    filmLanguagePriority:()=>4,automaticSelectionEnabled:()=>true,
    object:{movie:{media_type:'tv',number_of_seasons:35},
      lampac_continue_season:1,lampac_custom_select:false},
    account:u=>u,skazAuthHeaders:()=>({}),readRchChallenge:()=>null,
    responseRead:()=>null,responseRemember:()=>{},
    window:{},document:{},$:()=>{},Date,
    setTimeout:()=>1,clearTimeout:()=>{}
  };
  ctx.Network=function(){
    this.timeout=()=>{};this.clear=()=>{};
    this.native=(url,onSuccess)=>{
      requested.push(url);
      onSuccess(JSON.stringify(pages[url]||{items:[],buttons:[]}));
    };
  };
  vm.runInNewContext(section('function filmSafeAutoTarget(raw){',
    'this.currentSourceRows = function()'),ctx,{timeout:6000});
  const owner={__csoManualView:false,requestParams:u=>u+'?card=1',
    parseProviderRows:html=>JSON.parse(html)};
  let called=0;
  ctx.compareSeriesSources.call(owner,keys,()=>called++);
  assert.equal(called,1);
  const plan=owner.__csoSeriesPlan;
  assert(plan,'the series plan should be built');
  assert.equal(plan.primary.source,'hdrezka');
  assert.equal(plan.studio,'studio:coldfilm');
  assert.equal(plan.verifiedCount,35);
  assert.equal(plan.seasons[1].voice,'Coldfilm');
  assert.equal(plan.missing.length,0);
  assert.equal(plan.complete,true);
  assert(requested.includes('https://hdrezka/voice/47'),
    'must inspect late unknown dub after all famous voice entries');
  assert(!requested.includes('https://evil.example/fetch'),
    'unknown voice links must stay on their own provider host');
  assert(ctx.window.__capsuleSeriesLastScan.inspectedMenus>40);
  assert(ctx.window.__capsuleSeriesLastScan.inspectedMenus<=160);
  assert.equal(ctx.seriesStudioKey('1080p'),'',
    'quality folder must not turn into a fake dubbing studio');
});

test('slow large HDRezka voice menus complete without the 8.8 second premature choice',()=>{
  let clock=0,nextId=0,callbackCount=0;
  const pending=new Map(),requested=[],pages=Object.create(null);
  const keys=['alloha','hdrezka'];
  const schedule=(fn,ms)=>{const id=++nextId;
    pending.set(id,{when:clock+ms,fn});return id;};
  const clear=id=>pending.delete(id);
  const root={
    items:Array.from({length:45},(_,i)=>({
      method:'link',text:i===44?'Coldfilm':'Озвучка '+(i+1),
      url:'https://hdrezka/voice/'+i
    })),buttons:[]
  };
  pages['https://hdrezka?card=1']=root;
  pages['https://alloha?card=1']={items:[],buttons:[]};
  const complete=Array.from({length:35},(_,i)=>i+1),
        truncated=Array.from({length:6},(_,i)=>i+30);
  root.items.forEach((voice,i)=>{
    pages[voice.url]={items:(i===44?complete:truncated).map(n=>({
      method:'link',text:'Сезон '+n,
      url:'https://hdrezka/voice/'+i+'/s'+n,
      season_number:n
    })),buttons:[]};
  });
  const ctx={
    sources:{alloha:{url:'https://alloha',name:'Alloha'},
      hdrezka:{url:'https://hdrezka',name:'HDRezka'}},
    SERIES_CHECK_ORDER:keys,
    seriesSourceEnabled:()=>true,filmValidUrl:()=>true,
    filmSkazUrl:u=>u,filmSafeAutoTarget:()=>true,
    filmFolderAllowed:()=>true,
    filmVoiceCategory:name=>/^(?:сезон|season)/i.test(name)?'':'other',
    filmVoiceBlocked:()=>false,filmPlaybackAllowed:()=>true,
    filmVoiceRank:()=>1,filmLanguagePriority:()=>4,
    automaticSelectionEnabled:()=>true,
    object:{movie:{media_type:'tv',number_of_seasons:35},
      lampac_continue_season:1,lampac_custom_select:false},
    responseRead:()=>null,responseRemember:()=>{},
    account:u=>u,skazAuthHeaders:()=>({}),readRchChallenge:()=>null,
    window:{},document:{},$:()=>{},Date:{now:()=>clock},
    setTimeout:schedule,clearTimeout:clear
  };
  ctx.Network=function(){
    let timer=null;
    this.timeout=()=>{};
    this.clear=()=>clear(timer);
    this.native=(url,onSuccess)=>{
      requested.push(url);
      const html=JSON.stringify(pages[url]||{items:[],buttons:[]});
      timer=schedule(()=>onSuccess(html),
        url.includes('/voice/')?1500:5);
    };
  };
  vm.runInNewContext(section('function filmSafeAutoTarget(raw){',
    'this.currentSourceRows = function()'),ctx,{timeout:5000});
  const owner={__csoManualView:false,
    requestParams:u=>u+'?card=1',parseProviderRows:html=>JSON.parse(html)};
  ctx.compareSeriesSources.call(owner,keys,()=>callbackCount++);
  for(let i=0;i<5000&&pending.size;i++){
    const entry=[...pending.entries()].sort((a,b)=>a[1].when-b[1].when)[0];
    pending.delete(entry[0]);clock=entry[1].when;entry[1].fn();
  }
  assert.equal(callbackCount,1,'the series choice must finish exactly once');
  assert.equal(pending.size,0,'scan timers and requests must be cancelled');
  assert(clock<10000,'45 slow dubbing menus should fit the new burst pool');
  assert(requested.includes('https://hdrezka/voice/44'));
  assert.equal(owner.__csoSeriesPlan.primary.voice,'Coldfilm');
  assert.equal(owner.__csoSeriesPlan.verifiedCount,35);
  assert.equal(ctx.window.__capsuleSeriesLastScan.incomplete,false);
  assert.equal(ctx.window.__capsuleSeriesLastScan.providers.hdrezka.inspectedVoices,
    45);
});

test('planned seasons switch provider without switching studio or inventing URLs',()=>{
  const code=section('this.openPlannedSeason = function(choice,index){',
    'this.showSeasonPicker = function(){');
  const context={
    balanser:'alloha',source:'https://alloha/root',
    sources:{alloha:{url:'https://alloha/root'},hdrezka:{url:'https://hdrezka/root'}},
    seriesSourceEnabled:()=>true,filmValidUrl:()=>true,
    filmSkazUrl:url=>url,filmSafeAutoTarget:()=>true
  };
  vm.runInNewContext('var service={};'+
    code.replace('this.openPlannedSeason =','service.openPlannedSeason ='),
    context,{timeout:3000});
  const entry={number:2,source:'hdrezka',url:'https://hdrezka/dub/s2',
    studio:'dub',voice:'Дубляж'};
  const calls=[],choice={voice_name:'Дубляж',voice_manual:false};
  const instance=context.service;
  instance.__csoSeriesPlan={studio:'dub',seasons:{
    1:{number:1,source:'alloha',url:'https://alloha/dub/s1',
      voice:'Дубляж',studio:'dub'},2:entry}};
  instance.__csoManualView=false;instance.__csoManualSource=false;
  instance.getChoice=()=>choice;
  instance.replaceChoice=p=>{calls.push('choice');Object.assign(choice,p);};
  instance.updateSeasonButton=()=>calls.push('button');
  instance.reset=()=>calls.push('reset');
  instance.request=url=>calls.push(url);
  assert.equal(instance.openPlannedSeason({
    number:2,url:entry.url,source:'hdrezka'},1),true);
  assert.equal(context.balanser,'hdrezka');
  assert.equal(context.source,'https://hdrezka/root');
  assert.equal(choice.voice_name,'Дубляж');
  assert.equal(choice.season,1);
  assert.equal(choice.voice_url,'');
  assert.equal(instance.__csoActivePlannedSeason,2);
  assert(calls.includes('https://hdrezka/dub/s2'));
  const before=calls.length;
  assert.equal(instance.openPlannedSeason({
    number:3,url:'https://hdrezka/other/s3',source:'hdrezka'},2),false);
  assert.equal(calls.length,before,'never request unverified season links');
  choice.voice_manual=true;
  assert.equal(instance.openPlannedSeason({
    number:2,url:entry.url,source:'hdrezka'},1),false);
});

test('event catalog waits while Rezka is pending and accepts its late answer',async()=>{
  const body=section('this.createCompleteSeriesCatalog = function(){',
    'this.createSource = function(){');
  let now=0,nextId=1,late=false,selected=null;
  const timers=new Map(),events=[];
  const rows=['alloha','hdrezka','filmix','kodik','collaps'].map(balanser=>({
    balanser,url:'https://tv.example/'+balanser,show:true}));
  function setTimer(fn,ms){
    const id=nextId++;timers.set(id,{time:now+ms,fn});return id;
  }
  function runUntil(target){
    let steps=0;
    while(true){
      const items=[...timers].filter(([,e])=>e.time<=target)
        .sort((a,b)=>a[1].time-b[1].time);
      if(!items.length)break;
      if(++steps>300)throw Error('unbounded poll recursion');
      const [id,event]=items[0];timers.delete(id);now=event.time;event.fn();
    }
    now=target;
  }
  const context={
    Promise,window:{},Date:{now:()=>now},console,
    setTimeout:setTimer,clearTimeout:id=>timers.delete(id),
    skazCatalogHosts:()=>['https://online3.skaz.tv/',
      'https://online4.skaz.tv/'],
    SERIES_FAMILIES:['alloha','hdrezka','filmix','kodik','collaps'],
    seriesSourceEnabled:()=>true,isEpisodeMedia:()=>true,
    filmSourceFamily:row=>row.balanser,
    filmValidUrl:url=>/^https:\/\//.test(String(url||'')),
    filmSafeAutoTarget:()=>true,
    eligibleProvider:()=>true,account:url=>url,skazAuthHeaders:()=>({}),
    Defined:{localhost:'https://online3.skaz.tv/'},
    Lampa:{Noty:{show:message=>events.push(message)}}
  };
  context.Network=function(){
    this.clear=()=>{};this.timeout=()=>{};
    this.silent=(url,done)=>{
      if(url.includes('life=true'))
        return done({life:true,memkey:url.includes('online3')?'m3':'m4'});
      if(url.includes('/lifeevents')){
        return done(late?{ready:true,tasks:5,pending:[],online:rows}:
          {ready:false,tasks:5,pending:['rezka'],online:rows.slice(0,1)});
      }
      throw Error('unexpected request: '+url);
    };
  };
  vm.runInNewContext('var service={};'+body.replace(
    'this.createCompleteSeriesCatalog =','service.createCompleteSeriesCatalog ='),
    context,{timeout:3000});
  const instance=context.service;
  instance.requestParams=u=>u+(u.includes('?')?'&':'?')+'id=12';
  instance.startSource=items=>{selected=items;return Promise.resolve(items);};
  const result=instance.createCompleteSeriesCatalog();
  runUntil(1000);
  assert.equal(selected,null,'do not choose while HDRezka is still pending');
  assert(events.length===0,'do not claim missing HDRezka before deadline');
  late=true;
  runUntil(2000);
  const chosen=await result;
  assert.equal(chosen.length,5);
  assert(chosen.some(row=>row.balanser==='hdrezka'));
  assert.equal(context.window.__capsuleCatalogLastAttempt.strategy,
    'event-provider-completion');
  assert.equal(context.window.__capsuleCatalogLastAttempt.missingFamilies.length,0);
});

test('initial life data and complementary mirror URLs survive catalog completion',async()=>{
  const body=section('this.createCompleteSeriesCatalog = function(){',
    'this.createSource = function(){');
  let now=0,id=0,chosen=null;const scheduled=new Map();
  function schedule(fn,ms){
    const key=++id;scheduled.set(key,{time:now+ms,fn});return key;
  }
  function runTo(target){
    for(let i=0;i<100;i++){
      const match=[...scheduled].filter(([,v])=>v.time<=target)
        .sort((a,b)=>a[1].time-b[1].time)[0];
      if(!match){now=target;return;}
      scheduled.delete(match[0]);now=match[1].time;match[1].fn();
    }
    throw Error('unbounded catalog timers');
  }
  const hosts=['https://online3.skaz.tv/','https://online4.skaz.tv/'];
  const ctx={
    Promise,Date:{now:()=>now},window:{},setTimeout:schedule,
    clearTimeout:key=>scheduled.delete(key),
    skazCatalogHosts:()=>hosts,
    SERIES_FAMILIES:['alloha','hdrezka'],
    seriesSourceEnabled:()=>true,filmSourceFamily:row=>row.balanser,
    filmSafeAutoTarget:url=>/^https:\/\//.test(url),
    eligibleProvider:()=>true,account:url=>url,skazAuthHeaders:()=>({}),
    Defined:{localhost:hosts[0]},Lampa:{Noty:{show:()=>{}}}
  };
  ctx.Network=function(){
    this.timeout=()=>{};this.clear=()=>{};
    this.silent=(url,cb)=>{
      if(url.includes('life=true')){
        const second=url.includes('online4');
        return cb({life:true,memkey:second?'b':'a',online:[{
          balanser:second?'hdrezka':'alloha',
          url:second?'/hdrezka/menu':'/alloha/menu',show:true
        }]});
      }
      if(url.includes('lifeevents'))return cb({
        ready:true,tasks:2,pending:[],online:[]
      });
      throw Error('unexpected request '+url);
    };
  };
  vm.runInNewContext('var service={};'+body.replace(
    'this.createCompleteSeriesCatalog =','service.createCompleteSeriesCatalog ='),
    ctx,{timeout:3000});
  ctx.service.requestParams=url=>url+'?id=42';
  ctx.service.startSource=rows=>{
    chosen=rows;return Promise.resolve(rows);
  };
  const request=ctx.service.createCompleteSeriesCatalog();
  runTo(1000);
  const answer=await request;
  assert.equal(answer.length,2,'do not discard one mirror when the other wins');
  assert(answer.some(row=>row.balanser==='alloha'&&
    row.url==='https://online3.skaz.tv/alloha/menu'));
  assert(answer.some(row=>row.balanser==='hdrezka'&&
    row.url==='https://online4.skaz.tv/hdrezka/menu'));
  assert.equal(chosen.length,2);
});

test('series checks all dubbing choices, never crawls episodes, and prefers Season 1',()=>{
  const roots={
    'alloha':{items:[{text:'Сезон 12',url:'https://alloha/s12',method:'link'}],buttons:[]},
    'hdrezka':{items:[],buttons:[{text:'2x2',url:'https://hdrezka/2x2',method:'link'},
      {text:'Дубляж',url:'https://hdrezka/dub',method:'link'}]},
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
  pages['https://hdrezka/2x2']={items:Array.from({length:15},(_,i)=>({
    text:'Сезон '+(i+1),url:'https://hdrezka/2x2/s'+(i+1),method:'link'
  })),buttons:[]};
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
    filmVoiceIdentityKnown:l=>l==='Дубляж'||l==='2x2',
    filmVoiceCategory:l=>l==='Дубляж'?'dub':'other',
    filmFolderAllowed:()=>true,
    filmLanguagePriority:()=>2,
    filmVoiceRank:l=>l==='Дубляж'?90:l==='2x2'?1:0,
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
  vm.runInNewContext(section('function filmSafeAutoTarget(raw){',
    'this.currentSourceRows = function()'),ctx,{timeout:5000});
  const instance={
    __csoManualView:false,requestParams:u=>u+'?card=1',
    parseProviderRows:html=>JSON.parse(html||'{"items":[],"buttons":[]}')
  };
  let answer=null,callbacks=0;
  ctx.compareSeriesSources.call(instance,keys,r=>{answer=r;callbacks++;});
  assert.equal(callbacks,1,'synchronous network callbacks must not finish before all roots');
  assert.equal(requests.length,8,'5 roots and all 3 advertised voice menus');
  assert(requests.includes('https://hdrezka/2x2'));
  assert(requests.includes('https://hdrezka/dub'));
  assert(requests.every(u=>!u.includes('/s12')&&!u.includes('/s30')),
    'never visit episode/season links during preflight');
  const ranked=Object.keys(answer).sort((a,b)=>answer[b]-answer[a]);
  assert.equal(ranked[0],'hdrezka',
    '15 observed seasons beginning with 1 outweigh a lonely Season 30');
  assert.equal(instance.__csoBestSeriesVoice.hdrezka.text,'Дубляж');
  assert.equal(ctx.window.__capsuleSeriesLastScan.strategy,
    'coverage-first-series-plan-v2');
  assert.equal(instance.__csoSeriesPlan.verifiedCount,18,
    'other verified season folders are now merged, not discarded to preserve one dub');
  assert.equal(instance.__csoSeriesPlan.ordered[0],1);
});

test('series scans are cancelled on screen exit without a late choice',()=>{
  const pending=[],ctx={
    sources:{alloha:{url:'https://alloha',name:'Alloha',seasonCount:2,show:true}},
    SERIES_CHECK_ORDER:['alloha'],
    seriesSourceEnabled:()=>true,filmValidUrl:()=>true,filmSkazUrl:u=>u,
    filmSafeAutoTarget:()=>true,
    automaticSelectionEnabled:()=>true,object:{movie:{media_type:'tv'}},
    account:u=>u,skazAuthHeaders:()=>({}),responseRead:()=>null,
    window:{},document:{},$:()=>{},Date,
    setTimeout:()=>123,clearTimeout:()=>{}
  };
  let cleared=0;
  ctx.Network=function(){
    this.clear=()=>{cleared++;};this.timeout=()=>{};
    this.native=(url,done)=>pending.push(()=>done(''));
  };
  vm.runInNewContext(section('function filmSafeAutoTarget(raw){',
    'this.currentSourceRows = function()'),ctx,{timeout:5000});
  const owner={__csoManualView:false,requestParams:u=>u,
    parseProviderRows:()=>({items:[],buttons:[]})};
  let called=0;
  ctx.compareSeriesSources.call(owner,['alloha'],()=>called++);
  assert.equal(typeof owner.__csoCancelSeriesScan,'function');
  owner.__csoCancelSeriesScan();
  assert.equal(owner.__csoCancelSeriesScan,null);
  assert.equal(cleared,1);
  pending.forEach(fn=>fn());
  assert.equal(called,0);
  const life=section('this.destroy = function() {','// Removed dead global search-provider');
  assert(life.includes('if(this.__csoCancelSeriesScan)this.__csoCancelSeriesScan();'));
});

test('late dubbed voice must complete before choosing a series source',()=>{
  const keys=['alloha','hdrezka'],pending=[];
  const seasons=prefix=>Array.from({length:4},(_,i)=>({
    text:'Сезон '+(i+1),url:prefix+'/season'+(i+1),method:'link'
  }));
  const pages={
    'https://alloha?card=1':{items:[],buttons:[
      {text:'2x2',url:'https://alloha/two',method:'link'},
      {text:'Дубляж',url:'https://alloha/dub',method:'link'}]},
    'https://hdrezka?card=1':{items:[{
      text:'Сезон 1',url:'https://hdrezka/season1',method:'link'}],buttons:[]},
    'https://alloha/two':{items:seasons('https://alloha/two'),buttons:[]},
    'https://alloha/dub':{items:seasons('https://alloha/dub'),buttons:[]}
  },requests=[];
  const ctx={
    sources:{alloha:{url:'https://alloha',name:'Alloha',seasonCount:4,show:true},
      hdrezka:{url:'https://hdrezka',name:'HDRezka',seasonCount:1,show:true}},
    SERIES_CHECK_ORDER:keys,seriesSourceEnabled:()=>true,
    filmValidUrl:u=>/^https?:\/\//.test(String(u||'')),filmSkazUrl:u=>u,
    filmVoiceIdentityKnown:l=>l==='Дубляж'||l==='2x2',
    filmVoiceCategory:l=>l==='Дубляж'?'dub':'other',
    filmVoiceBlocked:()=>false,filmFolderAllowed:()=>true,
    filmVoiceRank:l=>l==='Дубляж'?7:l==='2x2'?1:0,
    filmLanguagePriority:()=>4,automaticSelectionEnabled:()=>true,
    object:{movie:{media_type:'tv'},lampac_custom_select:false},
    account:u=>u,skazAuthHeaders:()=>({}),readRchChallenge:()=>null,
    responseRead:()=>null,responseRemember:()=>{},
    window:{},document:{},$:()=>{},Date,
    setTimeout:()=>1,clearTimeout:()=>{}
  };
  ctx.Network=function(){
    this.timeout=()=>{};this.clear=()=>{};
    this.native=(url,done)=>{
      requests.push(url);
      if(url==='https://alloha/dub')pending.push(()=>done(JSON.stringify(pages[url])));
      else done(JSON.stringify(pages[url]));
    };
  };
  vm.runInNewContext(section('function filmSafeAutoTarget(raw){',
    'this.currentSourceRows = function()'),ctx,{timeout:5000});
  const owner={__csoManualView:false,requestParams:u=>u+'?card=1',
    parseProviderRows:html=>JSON.parse(html)};
  let result=null,calls=0;
  ctx.compareSeriesSources.call(owner,keys,score=>{result=score;calls++;});
  assert.equal(calls,0,'do not pick 2x2 before an advertised dub returns');
  assert.equal(pending.length,1);
  pending[0]();
  assert.equal(calls,1);
  assert.equal(owner.__csoBestSeriesVoice.alloha.text,'Дубляж');
  assert.equal(Object.keys(result).sort((a,b)=>result[b]-result[a])[0],
    'alloha');
  assert(requests.every(url=>!/\/season\d+$/.test(url)),
    'do not crawl episode/season folder URLs');
});

test('film probing compares all voice folders concurrently but never generic links',()=>{
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
  assert.equal(calls.length,5,'root + 3 voices + 4K child; no generic folders');
  for(const uri of ['https://alloha/voice-a','https://alloha/voice-b',
      'https://alloha/voice-c','https://alloha/4k'])
    assert(calls.some(c=>c.url===uri),'must inspect '+uri);
  assert(calls.every(c=>!c.url.includes('/extra')),
    'large generic folder lists must not trigger a crawl');
  assert(calls.every(c=>c.limit<=2600));
  const scan=section('function probeSource(provider,complete)',
    'function playVerified(choice)');
  assert(scan.includes('MAX_REQUESTS=7,MAX_ACTIVE=3'));
  assert(scan.includes('current.depth<2'));
  assert(scan.includes('if(!voiceRow&&!namedVoice&&!looksVoice&&!qualityFolder)return;'));
});

test('film scan does not decide before a slower dub menu responds',()=>{
  const data={
    'https://alloha?card=1':{
      videos:[],voices:[
        {url:'https://alloha/amateur',text:'Любительская',method:'link'},
        {url:'https://alloha/dub',text:'Дубляж',method:'link'}],links:[]},
    'https://alloha/amateur':{videos:[
      {url:'https://cdn/low',method:'play'}],voices:[],links:[]},
    'https://alloha/dub':{videos:[
      {url:'https://cdn/best',method:'play'}],voices:[],links:[]}
  },waiting=[],received=[],job={report:{providerStages:{},candidateCount:0}};
  const ctx={
    job,movie:{id:1,title:'Film'},alive:()=>true,Date,
    filmSourceFamily:r=>r.balanser,filmValidUrl:()=>true,
    filmSkazUrl:u=>u,filmRequestParams:u=>u+'?card=1',
    filmParseHtml:url=>data[url]||{videos:[],voices:[],links:[]},
    filmFolderAllowed:()=>true,
    filmVoiceCategory:l=>l==='Дубляж'?'dub':'other',
    filmVoiceRank:l=>l==='Дубляж'?7:1,
    filmQualityHeight:()=>0,sourceLanguage:()=> 'ru',
    addCandidate(provider,file,voice){
      job.report.candidateCount++;received.push({url:file.url,voice});
    },
    request(url,mode,done){
      if(url==='https://alloha/dub')waiting.push(()=>done(url));
      else done(url);
    },
    timer:()=>123,clearTimeout:()=>{}
  };
  vm.runInNewContext(section('function probeSource(provider,complete)',
    'function playVerified(choice)'),ctx,{timeout:5000});
  let completed=0;
  ctx.probeSource({balanser:'alloha',url:'https://alloha'},()=>completed++);
  assert.equal(completed,0,'slow dub must keep the scan open');
  assert.equal(waiting.length,1);
  waiting[0]();
  assert.equal(completed,1);
  assert(received.some(v=>v.url==='https://cdn/best'&&v.voice==='Дубляж'));
  assert(received.some(v=>v.url==='https://cdn/low'&&v.voice==='Любительская'));
});

test('0.28 startup never waits for asynchronous Skaz wide-search lifecycle',()=>{
  const movie=section('function filmAutoLaunch(movie)','window.__capsuleFilmAutoLaunch=filmAutoLaunch');
  const start=section('this.createSource = function(){','this.create = function() {');
  assert(movie.includes("'lite/events?life=false',movie"));
  assert(!movie.includes("'lite/events?life=true',movie"));
  assert(start.includes("'lite/events?life=false'"));
  assert(!start.includes("'lite/events?life=true'"));
  assert(core.includes('deadline=setTimeout(finish,MAX_WAIT)'));
  assert(core.includes('},5300);'));
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
  assert(wrapper.includes("['kodik','Kodik'],['collaps','Collaps']"));
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
  assert.equal(core.split('skazAuthHeaders(').length - 1,16,
    'all Skaz auth-header call sites must use the credential gate');
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
    timer(){throw Error('No timer needed after synchronous success');},
     clearTimeout(){}
  };
  vm.runInNewContext(fragment,context,{timeout:3000});
  context.startCatalog();
  assert.equal(calls.length,2);
  assert.equal(seen.length,1);
  assert.equal(context.Defined.localhost,roots[1]);
  assert.equal(context.job.report.catalogHostsTried,2);
});
test('a fast partial film catalog cannot hide a complete second mirror',()=>{
  const body=section('function startCatalog(){',
    'if(movie.imdb_id&&movie.kinopoisk_id)startCatalog();');
  const hosts=['http://online3.skaz.tv/','http://online4.skaz.tv/'],
    families=['alloha','mirkinoz','hdrezka','filmix','vibix','kodik'],
    all=families.map(balanser=>({
      balanser,url:'https://provider.test/'+balanser,show:true})),
    calls=[],seen=[];
  const ctx={
    alive:()=>true,skazCatalogHosts:()=>hosts,
    skazCatalogUsable:data=>!!data&&data.online&&data.online.length>0,
    extractProviders:data=>data.online,
    providerCoverage:rows=>{
      const found=rows.map(row=>row.balanser);
      return {found,complete:families.every(name=>found.includes(name))};
    },
    filmRequestParams:u=>u,movie:{id:777},
    job:{report:{}},Defined:{localhost:hosts[0]},
    request(url,mode,callback){
      calls.push(url);
      callback({online:url.includes('online3')?all.slice(0,1):all});
    },
    timer:()=>123,clearTimeout:()=>{},
    withCatalog:data=>seen.push(data.online),
    showError:reason=>{throw Error(reason);}
  };
  vm.runInNewContext(body,ctx,{timeout:3000});
  ctx.startCatalog();
  assert.equal(calls.length,2,'start the second mirror immediately after a partial reply');
  assert.equal(seen.length,1,'select once only');
  assert.equal(seen[0].length,6,'retain all enabled provider families');
  assert.equal(ctx.Defined.localhost,hosts[1]);
  assert.equal(ctx.job.report.catalogMirrorIndex,1);
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
test('partial catalog lets a richer second mirror win without a long poll',async()=>{
  const body=section('this.createSource = function(){','this.create = function() {');
  const hosts=['http://online3.skaz.tv/','http://online4.skaz.tv/'],
    complete=['alloha','hdrezka','filmix','vibix','kodik'].map(k=>({
      balanser:k,url:'https://provider.test/'+k,show:true})),
    calls=[];
  const ctx={
    skazCatalogHosts:()=>hosts,isEpisodeMedia:()=>true,
    automaticSelectionEnabled:()=>false,
    object:{movie:{media_type:'tv'}},eligibleProvider:()=>true,
    filmValidUrl:u=>/^https?:\/\//.test(String(u||'')),
    filmSourceFamily:row=>row.balanser,
    providerCoverage:rows=>{
      const found=rows.map(row=>row.balanser);
      return {found,complete:complete.every(row=>found.includes(row.balanser))};
    },
    Defined:{localhost:hosts[0]},window:{},Promise,
    account:u=>u,skazAuthHeaders:()=>({}),
    setTimeout:()=>1,clearTimeout:()=>{}
  };
  ctx.Network=function(){
    this.timeout=()=>{};this.clear=()=>{};
    this.silent=(url,ok)=>{
      calls.push(url);
      ok({online:url.includes('online3')?complete.slice(0,1):complete});
    };
  };
  vm.runInNewContext('var service={};'+
    body.replace('this.createSource =','service.createSource ='),ctx,{timeout:3000});
  const service=ctx.service;
  service.__csoManualView=false;
  service.requestParams=u=>u;
  service.startSource=rows=>Promise.resolve(rows);
  const result=await service.createSource();
  assert.equal(calls.length,2);
  assert.equal(result.length,5);
  assert.equal(ctx.Defined.localhost,hosts[1]);
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
    filmSourceFamily:r=>r.balanser,
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


test('coverage-first plan combines partial dubbings without losing seasons',()=>{
  const ctx={
    SERIES_CHECK_ORDER:['alloha','hdrezka','filmix'],
    filmVoiceCategory:l=>/RHS/i.test(l)?'rhs':'dub',
    filmVoiceBlocked:()=>false,filmLanguagePriority:()=>4,
    filmVoiceRank:l=>/RHS/i.test(l)?9:7,
    filmSkazUrl:u=>u,filmValidUrl:()=>true,
    filmSafeAutoTarget:()=>true
  };
  vm.runInNewContext(section('function filmSafeAutoTarget(raw){',
    '// A single search session owns discovery evidence'),ctx,{timeout:5000});
  function add(source,voice,seasons){
    return {source,voice,studio:ctx.seriesStudioKey(voice),
      seasons:seasons.map(n=>({number:n,url:'https://tv.example/'+source+'/'+voice+'/'+n})),
      route:[]};
  }
  const result=ctx.buildSeriesPlan([
    add('alloha','RHS',[1,2]),
    add('hdrezka','Дубляж',[3,4,5,6]),
    add('filmix','RHS',[1])
  ],6,5);
  assert.equal(result.verifiedCount,6);
  assert.equal(result.complete,true);
  assert.equal(result.mixed,true);
  assert.equal(result.seasons[1].studio,'rhs');
  assert.equal(result.seasons[3].studio,'dub');
  assert.equal(result.primary.number,5);
  assert.deepEqual(Array.from(result.ordered),[1,2,3,4,5,6]);
  assert(result.alternatives[1].some(item=>item.source==='filmix'));
});

test('HTTP 503 recovery is bounded to unsigned official Skaz mirrors',()=>{
  const ctx={
    skazCatalogHosts:()=>[
      'http://online3.skaz.tv/','http://online4.skaz.tv/',
      'http://onlinecf5.skaz.tv/'
    ]
  };
  vm.runInNewContext(section('function skazHttp503(value){',
    'function skazCatalogUsable(data){'),ctx,{timeout:3000});
  assert.equal(ctx.skazHttp503({status:503}),true);
  assert.equal(ctx.skazHttp503('<h1>503 Service Unavailable</h1>'),true);
  assert.equal(ctx.skazHttp503({response:{status:503}}),true);
  assert.equal(ctx.skazHttp503({status:404}),false);
  assert.equal(ctx.skazHttp503({responseText:'503'}),true);
  assert.equal(ctx.skazMirrorForMenu('http://online3.skaz.tv/lite/provider?a=b'),
    'http://online4.skaz.tv/lite/provider?a=b');
  assert.equal(ctx.skazMirrorForMenu('http://online3.skaz.tv/lite/provider?sig=x'),'');
  assert.equal(ctx.skazMirrorForMenu('http://online3.skaz.tv/lite/provider?token=x'),'');
  assert.equal(ctx.skazMirrorForMenu('http://online3.skaz.tv.evil.test/path'),'');
  assert.equal(ctx.skazMirrorForMenu('http://online3.skaz.tv@evil.test/path'),'');
  assert.equal(ctx.skazMirrorForMenu('http://127.0.0.1/path'),'');
  assert.equal(ctx.skazMirrorForMenu('http://onlinecf5.skaz.tv/menu'),'',
    'CF host cannot silently switch to a non-CF host');
});

test('extended menu retries 503 through one mirror, preserving provider',()=>{
  const ctx={
    network:null,balanser:'alloha',
    source:'http://online3.skaz.tv/provider/alloha',
    requestRevision:0,requestPathCounts:Object.create(null),
    responseRead:()=>null,responseRemember:()=>{},account:u=>u,
    skazAuthHeaders:()=>({}),Defined:{localhost:'http://online3.skaz.tv/'}
  };
  const callbacks=[],calls=[],errors=[],opened=[];
  ctx.setTimeout=(fn,ms)=>{
    if(ms===200)callbacks.push(fn);
    return 1;
  };
  ctx.clearTimeout=()=>{};
  ctx.skazCatalogHosts=()=>[
    'http://online3.skaz.tv/','http://online4.skaz.tv/'
  ];
  vm.runInNewContext(section('function skazHttp503(value){',
    'function skazCatalogUsable(data){'),ctx,{timeout:3000});
  ctx.network={
    timeout(){},clear(){},
    native(url,done,error){
      calls.push(url);
      if(calls.length===1)error({status:503});
      else done('<div data-json="{}"></div>');
    }
  };
  vm.runInNewContext('var service={};'+
    section('this.request = function(url){',
      '// A single malformed data-json record').replace(
      'this.request =','service.request ='),ctx,{timeout:3000});
  const owner=ctx.service;
  owner.requestParams=u=>u;owner.__csoManualView=true;
  owner.tryAutomaticSourceFallback=()=>false;
  owner.doesNotAnswer=e=>errors.push(e);
  owner.parse=html=>opened.push(html);
  owner.request(ctx.source);
  assert.equal(calls.length,1);
  assert.equal(callbacks.length,1);
  callbacks[0]();
  assert.deepEqual(calls,[
    'http://online3.skaz.tv/provider/alloha',
    'http://online4.skaz.tv/provider/alloha'
  ]);
  assert.equal(errors.length,0);
  assert.equal(opened.length,1);
  assert.equal(ctx.balanser,'alloha');
  assert.equal(ctx.Defined.localhost,'http://online4.skaz.tv/');
});

test('missing episode is fetched from verified alternate studio only',()=>{
  const ctx={
    balanser:'alloha',requestRevision:3,
    filter_find:{season:[]},object:{movie:{seasons:[
      {season_number:1,episode_count:3}
    ]}},setTimeout:()=>1,clearTimeout:()=>{},
    localEpisodes:()=>[],filmSafeAutoTarget:()=>true,
    seriesSourceEnabled:()=>true,filmPlaybackAllowed:()=>true,
    seriesDeclaredStudio:()=>'',account:u=>u,
    skazAuthHeaders:()=>({})
  };
  const probes=[];
  ctx.Network=function(){
    this.timeout=()=>{};this.clear=()=>{};
    this.native=(url,done)=>{
      probes.push(url);
      done(JSON.stringify({items:[
        {method:'call',episode:2,url:'https://tv.example/ep2'}
      ],buttons:[]}));
    };
  };
  vm.runInNewContext('var service={};'+section(
    'this.displayGapFilled = function(videos){','this.display = function(videos)')
      .replace('this.displayGapFilled =','service.displayGapFilled ='),
    ctx,{timeout:3000});
  const owner=ctx.service,rendered=[];
  owner.__csoSeriesPlan={
    seasons:{1:{number:1,source:'alloha',url:'https://tv.example/a/s1',
      voice:'Дубляж',studio:'dub'}},
    alternatives:{1:[{number:1,source:'hdrezka',
      url:'https://tv.example/h/s1',voice:'RHS',studio:'rhs'}]}
  };
  owner.__csoActivePlannedSeason=1;
  owner.getChoice=()=>({voice_manual:false});
  owner.parseProviderRows=JSON.parse;
  owner.display=rows=>rendered.push(rows);
  const original=[
    {episode:1,method:'call',url:'https://tv.example/ep1'},
    {episode:3,method:'call',url:'https://tv.example/ep3'}
  ];
  owner.displayGapFilled(original);
  assert.equal(probes.length,1);
  assert.equal(rendered.length,1);
  assert.deepEqual(rendered[0].map(row=>row.episode),[1,2,3]);
  assert.equal(rendered[0][1].voice_name,'RHS');
  assert.equal(rendered[0][1].__csoEpisodeStudio,'rhs');
  assert.equal(rendered[0][1].__csoSupplementSource,'hdrezka');
  owner.__csoManualView=true;
  owner.displayGapFilled(original);
  assert.equal(probes.length,1,'manual mode must not scan automatically');
});

test('playback studio validation uses the selected episode fallback',()=>{
  const block=section('var planned=this.__csoSeriesPlan,',
    'if(!matchesPlannedStudio(file)){');
  const env={
    balanser:'alloha',
    seriesDeclaredStudio:row=>row.voice_name==='RHS'?'rhs':
      row.voice_name==='Дубляж'?'dub':''
  };
  vm.runInNewContext('function verify(file){var actualSource=file.__csoSupplementSource||balanser;'+block+
    'return matchesPlannedStudio(file);}',env,{timeout:3000});
  const scope={
    __csoManualView:false,__csoManualSource:false,
    __csoActivePlannedSeason:1,
    __csoSeriesPlan:{
      studio:'dub',primary:{studio:'dub'},
      seasons:{1:{studio:'dub'}},
      alternatives:{1:[{source:'hdrezka',studio:'rhs'}]}
    },
    getChoice:()=>({voice_manual:false})
  };
  assert.equal(env.verify.call(scope,{
    season:1,voice_name:'RHS',__csoSupplementSource:'hdrezka',
    __csoEpisodeStudio:'rhs'
  }),true);
  assert.equal(env.verify.call(scope,{
    season:1,voice_name:'Дубляж',__csoSupplementSource:'hdrezka',
    __csoEpisodeStudio:'rhs'
  }),false);
  assert.equal(env.verify.call(scope,{season:1,voice_name:'RHS'}),false);
});
