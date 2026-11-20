'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'..','capsule-online.js'),'utf8');

function fragment(from,to){
  const a=src.indexOf(from);
  assert.notEqual(a,-1,'missing anchor: '+from);
  const b=src.indexOf(to,a+from.length);
  assert.notEqual(b,-1,'missing end: '+to);
  return src.slice(a,b);
}

test('loader replaces the native oscillating scanner and uses colored stages',()=>{
  assert.match(src,/markup\.find\('\.broadcast__scan'\)\.replaceWith\(bar\)/);
  assert.match(src,/markup\.find\('\.online-empty-template\.selector'\)\.removeClass\('selector'\)/);
  assert.match(src,/mountCatalogLoading\(0,'Подготавливаем поиск'\)/);
  assert.match(src,/mountCatalogLoading\(3,'Готовим список серий'\)/);
  assert.match(src,/reportCatalogStep\(2,'Проверяем сезоны и озвучки'\)/);
  assert.match(src,/reportCatalogStep\(4,''\)/);
  for(const color of ['#e35a59','#efbe57','#56c995'])
    assert(src.includes(color),color+' absent');
  assert.doesNotMatch(src,/cso-catalog-progress--visible/);
  assert.match(src,/prefers-reduced-motion:reduce.*cso-loadbar__stripe/);
});

test('progress is not a fake percentage, is color-only, and does not mutate after destruction',()=>{
  const seen={};
  const widget={
    length:1,
    attr(key,value){seen[key]=value;return this;},
    find(selector){return {text(value){seen[selector]=value;}};}
  };
  const context={catalogProgress:widget,catalogProgressStep:-1,
    catalogProgressLabel:'',catalogProgressClosed:false};
  const fn=vm.runInNewContext('('+fragment('function reportCatalogStep(step,label){',
    '\n    function mountCatalogLoading(')+')',context);
  fn(1,'Получаем каталог источников');
  assert.equal(seen['data-state'],'wait');
  fn(2,'Проверяем сезоны и озвучки');
  assert.equal(seen['data-state'],'check');
  fn(3,'Готовим список серий');
  assert.equal(seen['data-state'],'ready');
  assert.equal(seen['.cso-loadbar__stage'],'Почти готово');
  fn(4,'');
  assert.equal(context.catalogProgress,null);
  context.catalogProgressClosed=true;
  fn(0,'Do not show');
  assert.equal(context.catalogProgressStep,4);
});

test('UP/DOWN traverse episode, continue card, and season symmetrically',()=>{
  const season={kind:'season',key:'season'};
  const watched={kind:'watched',key:'watched'};
  const ep1={kind:'episode',key:'1:1',previousElementSibling:watched};
  const ep2={kind:'episode',key:'1:2',previousElementSibling:ep1};
  const ep3={kind:'episode',key:'1:3',previousElementSibling:ep2};
  watched.nextElementSibling=ep1;
  ep1.nextElementSibling=ep2;ep2.nextElementSibling=ep3;
  const nodes=[watched,ep1,ep2,ep3],moved=[];
  let current=ep3,now=1000;
  const jq=(node)=>({
    hasClass(name){return (name==='online-prestige-watched'&&node.kind==='watched');},
    is(selector){return node.kind==='episode'&&selector.includes('online-prestige--full');},
    attr(name){return name==='data-cso-episode'?node.key:'';}
  });
  const scrollView=[{contains(node){return nodes.includes(node);}}];
  const filesView=[{querySelector(){return current;}}];
  const context={
    Date:{now:()=>now},$ :jq,
    last:ep3,lastUpKeyAt:0,lastFocusedEpisode:'1:3',lastFocusZone:'episode',
    object:{movie:{number_of_seasons:3}},isEpisodeMedia:()=>true,
    seasonButton:Object.assign([season],{hasClass:()=>false}),
    scroll:{
      body(){return {find(query){
        const match=query.includes('watched')?watched:ep1;
        return {first(){return [match];}};
      }};},
      render(){return scrollView;}
    },
    files:{render(){return filesView;}},
    scheduleFocusScroll(){},
    Lampa:{Controller:{collectionFocus(node){current=node;moved.push(node.kind);}}},
  };
  const funcs=fragment('      function visibleSeason(){',
    "      Lampa.Controller.add('content', {");
  const move=vm.runInNewContext('(function(){'+funcs+';return moveSeriesVertical;})()',context);
  function up(time){now=time;assert.equal(move('up'),true);context.lastUpKeyAt=now;}
  function down(time){now=time;assert.equal(move('down'),true);}
  up(1000);assert.equal(current,ep2);
  up(1120);assert.equal(current,ep1);
  up(1240);assert.equal(current,watched);
  up(1360);assert.equal(current,watched,'held UP must not jump to season');
  up(1800);assert.equal(current,season);
  down(1900);assert.equal(current,watched);
  down(2000);assert.equal(current,ep1);
  assert.deepEqual(moved,['episode','episode','watched','season','watched','episode']);
});

test('Alloha wins against generic Rezka dub; named Rezka studios remain available',()=>{
  const ctx={
    filmVoiceRank(label){return /дубляж/i.test(label)?7:5;},
    filmSourceFamily(source){return source.balanser;}
  };
  const fn=vm.runInNewContext('('+fragment('function filmVoiceRankAtSource(source,label){',
    '\n  function filmCandidateVoice(')+')',ctx);
  assert.equal(fn('alloha','Дубляж'),7);
  assert.equal(fn('hdrezka','Дубляж'),3);
  assert.equal(fn('rezka','Дублированный перевод'),3);
  assert.equal(fn('hdrezka','Пифагор'),5);
  assert.equal(fn('hdrezka','Сыендук'),5);
  assert.equal(fn({balanser:'hdrezka'},'Дубляж'),3);
  // A single extra season still dominates any 4-point voice preference.
  const score=(seasons,voice)=>seasons*100000+12000+voice*4;
  assert(score(20,3)>score(19,7));
  assert.match(src,/v\.nums\.length\*100000/);
  assert.match(src,/filmVoiceRankAtSource\(item\.provider,voice\)/);
});

test('menu cache keys isolate accounts and comparator/renderer use the same key',()=>{
  let account='one@example.test';
  const ctx={Lampa:{
    Storage:{get(key){return key==='account_email'?account:'same-session';}},
    Utils:{hash(v){let h=0;for(const ch of v)h=(h*31+ch.charCodeAt(0))>>>0;return h;}}
  }};
  const getKey=vm.runInNewContext('('+fragment(
    'function scopedSeriesMenuKey(url){','\n    var filter_sources')+')',ctx);
  const first=getKey('https://example.test/menu');
  assert.equal(first,getKey('https://example.test/menu'));
  account='two@example.test';
  assert.notEqual(first,getKey('https://example.test/menu'));
  assert.match(src,/function menuCacheKey\(url\)\{return scopedSeriesMenuKey\(url\);\}/);
  assert.match(src,/cachedRoot=responseRead\('series_html',cacheKey\)/);
  assert.match(src,/responseRemember\('series_html',cacheKey,html,25000\)/);
  assert.match(src,/analysisMs:0,serverWaitTotalMs:0/);
});

test('continue-watching tile only appears with a real episode and retains focus',()=>{
  assert.match(src,/Number\(lastWatched\.season\)>0&&Number\(lastWatched\.episode\)>0/);
  assert.match(src,/watchedNode\.on\('hover:focus'/);
  assert.match(src,/savedZone==='watched'/);
  assert.match(src,/savedZone==='season'/);
});
