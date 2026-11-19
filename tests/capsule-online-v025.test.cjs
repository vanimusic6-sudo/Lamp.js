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
  assert(core.includes("version: '0.25.1'"));
  assert(core.includes("Lampa.Component.add('capsuleamedia', component)"));
  assert(wrapper.includes('function enhance(instance,movie)'));
});
test('series providers are exactly Alloha, HDRezka, VIBIX and Filmix',()=>{
  assert(core.includes("var SERIES_FAMILIES=['alloha','hdrezka','vibix','filmix'];"));
  assert(core.includes('var SERIES_CHECK_ORDER=SERIES_FAMILIES.slice();'));
  assert(core.includes("['vibix','VIBIX'],['filmix','Filmix']"));
});
test('movie providers are exactly Alloha, HDRezka, Mir Kino Z and Filmix',()=>{
  assert(core.includes("var FILM_FAMILIES=['alloha','hdrezka','mirkinoz','filmix'];"));
  assert(core.includes('function filmSourceOrder(){return FILM_FAMILIES.slice();}'));
});
test('discontinued provider settings are removed',()=>{
  const registration=wrapper.slice(wrapper.indexOf('function registerSettings()'));
  for(const name of ["['kodik','Kodik']","['kinopub','KinoPub / КПУ']",
    "['redheadsound','RHS']","['skaztv','Skaz TV']"])
    assert(!registration.includes(name),name);
});
test('independent wrapper filters out obsolete sources for series without core globals',()=>{
  const h=fixture(),series={media_type:'tv',name:'Show',number_of_seasons:25};
  const items=['kinopub','filmix','hdrezka','skaztv','alloha','vibix','kodik',
    'redheadsound','rezka','collaps','mirkinoz'].map(row);
  const result=h.root.__capsuleSkazOnlineDebug.sourceOrder(items,series);
  assert.deepEqual(Array.from(result,x=>x.key),['alloha','hdrezka','vibix','filmix']);
});
test('independent wrapper filters obsolete film sources and uses configured order',()=>{
  const h=fixture(),film={media_type:'movie',title:'Film'};
  const items=['vibix','filmix','hdrezka','skaztv','alloha','mirkinoz',
    'kodik','redheadsound','kinopub','rezka'].map(row);
  const result=h.root.__capsuleSkazOnlineDebug.sourceOrder(items,film);
  assert.deepEqual(Array.from(result,x=>x.key),['alloha','hdrezka','mirkinoz','filmix']);
});
test('source selection cannot be pulled to first response by economy mode',()=>{
  assert(core.includes('function filmSearchMode(){'));
  assert(core.includes("return 'normal';"));
  assert(!wrapper.includes("economy:'Экономный · быстро'"));
});
test('series source scans queue all candidates together and never early-exit after three',()=>{
  const part=section('this.compareSeriesSources = function(', 'this.currentSourceRows = function()');
  assert(part.includes('keys.forEach(function(key){queueRoot(states[key]);});'));
  assert(part.includes('scanDeadline=Date.now()+13500'));
  assert(part.includes('states[key].responses>0'));
  assert(!part.includes('firstWaveExcellent'));
  assert(!part.includes('secondWave'));
});
test('movie scans all four independent providers before ranking',()=>{
  const part=section('function scanProviders(providers)', 'function withCatalog(data)');
  assert(part.includes('waveEnd=ordered.length'));
  assert(part.includes('while(running<4&&position<waveEnd)'));
  assert(part.includes('if(running||completed<waveEnd)return'));
  assert(!part.includes('excellent()'));
  assert(part.includes('resolveCandidates();'));
});
test('incomplete catalogs are not cached as long as complete catalogs',()=>{
  assert(core.includes('complete?75000:8000'));
  assert(core.includes('mode===\'catalog\'?75000:45000'));
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
  const scripts=responses.slice();
  const pending=new Map();let seq=0,now=0,count=0,returned=null;
  const families=['alloha','hdrezka','vibix','filmix'];
  function setTimer(fn,ms){
    const id=++seq;
    pending.set(id,{fn,when:now+(ms||0)});
    return id;
  }
  function clearTimer(id){pending.delete(id);}
  function flush(){
    for(let i=0;pending.size&&i<50;i++){
      const entry=[...pending.entries()].sort((a,b)=>a[1].when-b[1].when)[0];
      pending.delete(entry[0]);now=entry[1].when;entry[1].fn();
    }
    assert(pending.size===0,'no live callbacks after catalogue completes');
  }
  function Network(){
    this.clear=()=>{};
    this.timeout=()=>{};
    this.silent=(url,onSuccess)=>{
      count++;
      const item=scripts.shift();
      if(item==='TIMEOUT')return;
      onSuccess(item||{online:[]});
    };
  }
  const context={
    SERIES_FAMILIES:families,
    FILM_FAMILIES:['alloha','hdrezka','mirkinoz','filmix'],
    filmSourceEnabled:()=>true,
    filmSourceFamily:item=>item.balanser,
    filmValidUrl: url=>/^https?:\/\//i.test(String(url||'')),
    Network,account:url=>url,
    Lampa:{Storage:{get:()=>''}},
    window:{},setTimeout:setTimer,clearTimeout:clearTimer,
    Date:{now:()=>now}
  };
  const source=section('function providerCoverage(rows,serial)',
    'function filmSourcePriority(row)');
  vm.runInNewContext(source,context,{timeout:5000});
  return {context,flush,get count(){return count;},get result(){return returned;},
    scan(initial,serial=true){
      context.discoverProviderUpdates(initial,'memkey',id=>
        'https://skaz.test/lifeevents?memkey='+id,serial,rows=>{
          returned=rows;
        });
      flush();
    }};
}
test('0.25.1 stage-completes all four sources before deciding, across multiple polls',()=>{
  const rows=[row('hdrezka'),row('vibix'),row('filmix')];
  const state=stagedCatalogFixture(rows.map(r=>({online:[r]})));
  state.scan([row('alloha')]);
  assert.equal(state.count,3,'three incremental responses are collected before finish');
  assert.deepEqual(Array.from(state.result,x=>x.balanser),
    ['alloha','hdrezka','vibix','filmix']);
  assert.deepEqual(Array.from(state.context.window.__capsuleCatalogLastScan.missing),[]);
  assert.equal(state.context.window.__capsuleCatalogLastScan.complete,true);
});
test('0.25.1 skips polling when all four sources already in initial catalog',()=>{
  const state=stagedCatalogFixture([]);
  state.scan(['alloha','hdrezka','vibix','filmix'].map(row));
  assert.equal(state.count,0);
  assert.equal(state.result.length,4);
});
test('0.25.1 insufficient updates never create fake unavailable source rows',()=>{
  const state=stagedCatalogFixture(Array.from({length:5},()=>({online:[]})));
  state.scan([row('alloha')]);
  assert.equal(state.count,5);
  assert.deepEqual(Array.from(state.result,x=>x.balanser),['alloha']);
  assert.equal(state.context.window.__capsuleCatalogLastScan.complete,false);
  assert.deepEqual(Array.from(state.context.window.__capsuleCatalogLastScan.missing),
    ['hdrezka','vibix','filmix']);
  assert(!core.includes('completeSerialCatalog()'),
    'do not invent blank URLs for missing source families');
});
test('0.25.1 catalog cache cannot freeze partial lifecycle data',()=>{
  assert(core.includes('discoverProviderUpdates(initial,owner.memkey'));
  assert(core.includes('discoverProviderUpdates(initial,data.memkey'));
  assert(core.includes("var isLifecycle=/\\/lifeevents\\?/i.test(url)"));
  assert(core.includes('if(json&&providerCoverage(json.online,'));
  assert(!core.includes("responseRead('series_life',url)"));
  assert(!core.includes("responseRemember('series_life',url"));
  assert(!core.includes('complete?75000:8000'));
});
test('0.25.1 HDRezka keeps identity when Skaz balancer name is rezka',()=>{
  const named=section('function balanserName(row) ','function automaticSelectionEnabled');
  const family=section('function filmSourceFamily(row)','function filmSearchMode()');
  const context={isMirKinoZ:()=>false};
  vm.runInNewContext(named+family,context,{timeout:5000});
  assert.equal(context.filmSourceFamily({balanser:'rezka',name:'HD Rezka'}),'hdrezka');
  assert.equal(context.filmSourceFamily({balanser:'rezka',name:'Rezka'}),'rezka');
  assert.equal(context.filmSourceFamily({balanser:'vibixtv',name:'VIBIX'}),'vibix');
});
