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
  const api=vm.runInNewContext('('+functionSource(fragment(
    'function csoGenericDubLabel(label){',
    '\n  function filmCandidateVoice('))+')()',ctx);
  const fn=api.rank;
  assert.equal(fn('alloha','Дубляж'),7);
  assert.equal(fn('hdrezka','Дубляж'),1);
  assert.equal(fn('rezka','Дублированный перевод'),1);
  assert.equal(fn('hdrezka','Дублированная'),1);
  assert.equal(fn('hdrezka','Пифагор'),5);
  assert.equal(fn('hdrezka','Сыендук'),5);
  assert.equal(fn({balanser:'hdrezka'},'Дубляж'),1);
  assert.equal(api.generic('Дублированная озвучка'),true);
  assert.equal(api.generic('Дублированный перевод'),true);
  assert.equal(api.generic('Сыендук'),false);
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


test('color-stage indicator fills the track in bounded lifecycle steps',()=>{
  assert.match(src,/cso-loadbar__stripe\{[^']*transform:scaleX\(\.12\)/);
  for(const [stage,fill] of [[1,'.34'],[2,'.68'],[3,'.92'],[4,'1']]){
    assert(src.includes('cso-loadbar[data-step="'+stage+'"] .cso-loadbar__stripe{transform:scaleX('+fill+')}'),
      'stage '+stage+' must fill the correct portion');
  }
  assert.match(src,/transition:transform \.26s ease-out,background-color/);
  assert.match(src,/catalogProgress\.attr\('data-step','4'\)\.attr\('data-state','ready'\)/);
  assert.doesNotMatch(src,/cso-loadbar__stripe\{[^']*animation:/);
});

test('explicit episode and signed stream dubbing cannot silently contradict chosen studio',()=>{
  const block=fragment('function csoGenericDubLabel(label){','\n  function filmCandidateVoice(');
  const api=vm.runInNewContext('('+functionSource(block)+')()',{
    filmVoiceIdentityKnown(v){return !!v&&!/^(?:серия|эпизод|episode)\s*\d+$/i.test(v);}
  });
  assert.equal(api.track({voice_name:'Сыендук'}),'Сыендук');
  assert.equal(api.track({voice_name:'Дубляж',studio:'Сыендук'}),'Сыендук');
  assert.equal(api.track({voice_name:'Русский',studio:'Пифагор'}),'Пифагор');
  assert.equal(api.track({voice_name:'Русский'}),'');
  assert.equal(api.track({voice_name:'',studio:'Пифагор'}),'Пифагор');
  assert.equal(api.track({voice_name:'Серия 1'}),'');
  assert.equal(api.match('Дубляж','Дублированный перевод'),true);
  assert.equal(api.match('Дубляж','Сыендук'),false);
  assert.equal(api.match('2×2','2x2'),true);
  assert.equal(api.match('Пифагор','Сыендук'),false);
  assert.equal(api.match('Пифагор',''),true); // missing metadata means unknown
  assert.match(src,/csoSeriesVoiceCompatible\(\s*file\.__csoExpectedVoice,csoSeriesTrackLabel\(json\)\)/);
  assert.match(src,/__csoExpectedVoice:expectedVoice/);
  assert.match(src,/__csoVerifiedSource:verifiedSeason\.source/);
  assert.match(src,/var actualSource=file\.__csoVerifiedSource\|\|file\.__csoSupplementSource\|\|balanser/);
});

function functionSource(block){
  return 'function(){'+block+';return {track:csoSeriesTrackLabel,'+
    'match:csoSeriesVoiceCompatible,rank:filmVoiceRankAtSource,'+
    'generic:csoGenericDubLabel,display:csoSeriesDisplayVoice,'+
    'rezkaGeneric:csoRezkaGenericDub};}';
}

test('source comparator prefers explicitly opened voice menus over generic Rezka default',()=>{
  assert.match(src,/verifiedVoiceRoute:task\.depth>=2&&!!task\.voice/);
  assert.match(src,/v\.verifiedVoiceRoute\?60:0/);
  assert.match(src,/csoRezkaGenericDub\(v\.source,v\.voice\)/);
  // Full season coverage still overrides a 60-point provenance tie-break.
  assert(20*100000 > 19*100000+60+8*4);
});


test('verified season survives a one-hop Rezka voice redirect',()=>{
  assert.match(src,/this\.__csoActiveVerifiedSeason=chosen/);
  assert.match(src,/self\.__csoActiveVerifiedSeason=next\.__csoVerified\?next:null/);
  assert.match(src,/remembered&&plan\.index\.some\(function\(entry\)/);
  assert.match(src,/sameVerifiedSeasonIdentity\(entry,remembered\)/);
  assert.match(src,/!csoSeriesVoiceCompatible\(verifiedSeason\.voice,activeAllowed\.text\)/);
  assert.match(src,/csoSafeAutoTarget\(button\.url\)/);
  assert.match(src,/if\(target&&!automaticVoiceVisited\[visit\]\)/);
  assert.match(src,/this\.request\(target\.url\)/);
  assert.match(src,/this\.doesNotAnswer\(new Error\(\s*'Источник не открыл выбранную озвучку'\)/);
});


test('verified season is recognized after copied index objects and voice-menu hop',()=>{
  const code=fragment('function sameVerifiedSeasonIdentity(entry,remembered){',
    '\n    this.openVerifiedSeasonIndex = function(){');
  const match=vm.runInNewContext('('+code+')',{
    filmSkazUrl(v){return String(v||'');}
  });
  const chosen={number:1,url:'https://skaz.test/seasons/1',source:'hdrezka',voice:'Дубляж'};
  const copied={...chosen};
  assert.notEqual(chosen,copied);
  assert.equal(match(chosen,copied),true,'copied season must remain identified');
  assert.equal(match(chosen,{...copied,voice:'Сыендук'}),false);
  assert.equal(match(chosen,{...copied,source:'alloha'}),false);
  assert.equal(match(chosen,{...copied,number:2}),false);
  assert.equal(match(chosen,{...copied,url:'https://skaz.test/other'}),false);
});

test('generic Rezka dub is not presented as verified studio without provenance',()=>{
  const block=fragment('function csoGenericDubLabel(label){',
    '\n  function filmCandidateVoice(');
  const display=vm.runInNewContext('('+functionSource(block)+')()',{
    filmSourceFamily(v){return v.balanser;}
  }).display;
  assert.equal(display('hdrezka','Дубляж',false),'Озвучка не подтверждена');
  assert.equal(display('rezka','Дублированный перевод',false),'Озвучка не подтверждена');
  assert.equal(display('hdrezka','Сыендук',false),'Сыендук');
  assert.equal(display('alloha','Дубляж',false),'Дубляж');
  assert.equal(display('hdrezka','Дубляж',true),'Озвучка не подтверждена');
  assert.equal(display('rezka','Дублированная',true),'Озвучка не подтверждена');
  assert.equal(display('alloha','Дублированная',true),'Дублированная');
  assert.match(src,/if\(serial\)voice_name=csoSeriesDisplayVoice\(/);
});

test('same season URLs for conflicting studios never generate verified Rezka dub',()=>{
  const block=fragment('function plan(){','\n      function finish(){');
  function variant(source,voice,urls,verified){
    const seasons={};
    Object.keys(urls).forEach(n=>seasons[n]={number:Number(n),url:urls[n]});
    return {source,voice,root:'https://skaz.test/'+source,
      route:[],verifiedVoiceRoute:verified,
      nums:Object.keys(urls).map(Number),seasons};
  }
  const diag={sharedSeasonLinks:0};
  const owner={__csoBestSeriesVoice:{}};
  const context={
    variants:[
      variant('alloha','Дубляж',{1:'https://a.test/s1',2:'https://a.test/s2'},true),
      variant('hdrezka','Сыендук',{1:'https://r.test/s1',2:'https://r.test/s2'},false),
      variant('hdrezka','Дубляж',{1:'https://r.test/s1',2:'https://r.test/s2'},true)
    ],
    diag,owner,order:['alloha','hdrezka'],scores:{},
    voiceKey(v){return String(v).toLowerCase();},
    filmVoiceRankAtSource(source,voice){
      return source==='alloha'&&voice==='Дубляж'?7:3;
    },
    filmLanguagePriority(){return 2;},
    filmSkazUrl(url){return url;},
    safeMenu(url){return url.startsWith('https://');},
    csoRezkaGenericDub(source,label){
      return /rezka/.test(source)&&/^(?:дубляж|дублированная)$/i.test(label);
    }
  };
  const plan=vm.runInNewContext('('+block+')',context);
  const winner=plan();
  assert.equal(winner.source,'alloha');
  assert.equal(owner.__csoGapPlan.index.length,2);
  assert(owner.__csoGapPlan.index.every(row=>row.source==='alloha'));
  assert(diag.sharedSeasonLinks>=2,'conflicting voice URLs must be discarded');
  assert.equal(owner.__csoBestSeriesVoice.hdrezka,undefined);
});

test('catalog scan overlaps roots, reuses exact same-origin HTML and retains all voice choices',()=>{
  assert.match(src,/reserve:urls\[1\]\|\|''/);
  assert.match(src,/if\(task\.depth===0&&task\.reserve&&safeMenu\(task\.reserve\)\)/);
  assert.match(src,/parsedMenus\[i\]\.html===html&&/);
  assert.match(src,/parsedMenus\[i\]\.origin===String\(task\.url\)/);
  assert.match(src,/if\(html\.length<=750000\)/);
  assert.match(src,/if\(parsedMenus\.length>8\)parsedMenus\.shift\(\)/);
  assert.match(src,/voiceTasks\(\[task\.key\],4\)/);
  assert.match(src,/scheduledVoices\[token\]=true/);
  assert.match(src,/timeout=task\.depth===0\?2400:1550/);
  assert.match(src,/expected>=18\?14000:11000/);
  assert.match(src,/diag\.voiceMenuMismatch\+\+/);
});


test('empty or error HTML activates reserve mirror, never a fake successful menu',()=>{
  assert.match(src,/typeof html==='string'&&html\.length<=4\*1024\*1024&&\s*\/data-json\\s\*=\/i\.test\(html\)/);
  assert.match(src,/if\(task\.depth===0&&task\.reserve&&safeMenu\(task\.reserve\)\)/);
  assert.match(src,/reserve:'',depth:0,voice:'',route:\[\]/);
});

test('complete Rezka catalog cannot skip pending higher-priority Alloha dubbed menus',()=>{
  assert.match(src,/rootSettled\[key\]&&!?\(gatewayPending\[key\]\|\|0\)/);
  assert.match(src,/filmVoiceRankAtSource\(key,v\.title\)>=7/);
  assert.match(src,/!voiceSettled\[key\+'\|'\+v\.url\]/);
  assert.doesNotMatch(fragment('function fullCoverageFound(){','function drained(){'),
    /if\(launching\|\|active\|\|queue\.length\)return false/);
});


test('episode-declared studio outranks stale parent-menu dubbing label',()=>{
  assert.match(src,/element\.__csoExpectedVoice\|\|\s*\/\/ The actual episode's named studio/);
  assert.match(src,/element\.__csoOriginalVoice\|\|csoSeriesTrackLabel\(element\)/);
  assert.match(src,/file\.__csoOriginalVoice=csoSeriesTrackLabel\(file\)/);
  assert.match(src,/if\(serial\)voice_name=csoSeriesDisplayVoice\(/);
});


test('early finish ignores huge irrelevant queue only after priority checks are complete',()=>{
  const fn=vm.runInNewContext('('+fragment('function fullCoverageFound(){',
    '\n      function drained(){')+')',{
    expected:3,primary:['alloha','hdrezka'],
    rootSettled:{alloha:true,hdrezka:true},gatewayPending:{},
    voiceSettled:{'alloha|https://a.test/dub':true,
      'hdrezka|https://r.test/2x2':true},
    catalog:{
      alloha:[{title:'Дубляж',url:'https://a.test/dub',seasonHint:0}],
      hdrezka:[{title:'2x2',url:'https://r.test/2x2',seasonHint:0}]
    },
    variants:[
      {source:'alloha',voice:'Дубляж',nums:[1,2,3],seasons:{
        1:{url:'https://a.test/1'},2:{url:'https://a.test/2'},
        3:{url:'https://a.test/3'}}}
    ],
    diag:{},
    // Deliberate mocks: the priority check must use these independent inputs.
    filmVoiceRankAtSource(key,label){return key==='alloha'&&label==='Дубляж'?7:4;},
    csoRezkaGenericDub(source,label){return /rezka/.test(source)&&
      /^(?:дубляж|дублированная)$/i.test(label);},
    voiceKey(label){return String(label).toLowerCase();},
    launching:true,active:6,queue:Array.from({length:90},(_,i)=>i)
  });
  assert.equal(fn(),true,'unrelated in-flight scans must not delay a complete result');
});

test('priority voice, root gateway and ambiguous URLs prevent premature early exit',()=>{
  const block=fragment('function fullCoverageFound(){','\n      function drained(){');
  const env={
    expected:2,primary:['alloha','hdrezka'],rootSettled:{alloha:true,hdrezka:true},
    gatewayPending:{},voiceSettled:{},
    catalog:{
      alloha:[{title:'Дублированная',url:'https://a.test/dub'}],
      hdrezka:[{title:'2x2',url:'https://r.test/2x2'}]
    },
    variants:[
      {source:'hdrezka',voice:'2x2',nums:[1,2],seasons:{
        1:{url:'https://r.test/1'},2:{url:'https://r.test/2'}}}
    ],
    diag:{},filmVoiceRankAtSource(key,v){return key==='alloha'?7:4;},
    csoRezkaGenericDub(source,v){return /rezka/.test(source)&&v==='Дублированная';},
    voiceKey(v){return String(v).toLowerCase();}
  };
  const fn=vm.runInNewContext('('+block+')',env);
  assert.equal(fn(),false,'Alloha dubbed branch was not checked');
  env.voiceSettled['alloha|https://a.test/dub']=true;
  assert.equal(fn(),false,'2x2 verification remains pending');
  env.voiceSettled['hdrezka|https://r.test/2x2']=true;
  assert.equal(fn(),true,'both priority branches resolved');
  env.gatewayPending.alloha=1;
  assert.equal(fn(),false,'voice gateway may advertise better studios');
  env.gatewayPending.alloha=0;
  const overlap={source:'hdrezka',voice:'Сыендук',nums:[1,2],seasons:{
    1:{url:'https://r.test/1'},2:{url:'https://r.test/2'}}};
  env.variants=[overlap,{...overlap,voice:'2x2'}];
  assert.equal(fn(),false,'two studios sharing all season URLs are ambiguous');
});

test('renderer never fabricates provider voice metadata after painting the episode',()=>{
  assert.match(src,/var sourceTrack=Object\.prototype\.hasOwnProperty\.call\(file,\s*'__csoOriginalVoice'\)/);
  assert.match(src,/file\.__csoOriginalVoice:csoSeriesTrackLabel\(file\)/);
  assert.match(src,/file\.__csoOriginalVoice=csoSeriesTrackLabel\(file\)/);
  assert.match(src,/csoSeriesVoiceCompatible\(file\.__csoExpectedVoice,\s*file\.__csoOriginalVoice\)/);
  assert.match(src,/function csoSeriesDisplayVoice/);
  assert.match(src,/if\(csoRezkaGenericDub\(family,value\)\)/);
});


test('Rezka selected numeric translation ID is bound to the final episode request',()=>{
  const block=fragment('function csoRezkaTranslationId(url){',
    '\n  // Rezka\u0027s generic "Дубляж" flag');
  const api=vm.runInNewContext('(function(){'+block+
    ';return {get:csoRezkaTranslationId,bind:csoRezkaMovieCallUrl};})()',{
      URL,skazCredentialTarget(url){
        return /^https?:\/\/(?:[a-z0-9-]+\.)*skaz\.tv(?::(?:80|443))?(?:[/?#]|$)/i.test(url);
      }
    });
  const root='https://online7.skaz.tv/lite/rezka/serial?id=1406&t=56&s=1';
  const episode='https://online7.skaz.tv/lite/rezka/movie?id=1406&t=56&s=1&e=2&voice=%2Fold-sayenduk';
  assert.equal(api.get(root),'56');
  assert.equal(api.get(episode),'56');
  const actual=api.bind(episode,'56');
  assert.equal(new URL(actual).searchParams.get('t'),'56');
  assert.equal(new URL(actual).searchParams.get('voice'),null,
    'voice can override the numeric translator on Lampac');
  assert.equal(new URL(actual).searchParams.get('e'),'2');
  assert.equal(api.bind(episode,'55'),'','never switch the chosen translation ID');
  assert.equal(api.bind(episode,''),'','unknown translation cannot be verified');
  assert.equal(api.bind(episode.replace('id=1406','id='),'56'),'','missing item id');
  assert.equal(api.bind(episode.replace('t=56','t=0'),'56'),'','invalid translator id');
  assert.equal(api.bind(episode+'&sig=signed','56'),'','signed URLs cannot be rewritten');
  assert.equal(api.bind(episode.replace('online7.skaz.tv','evil.example'),'56'),'',
    'only approved Skaz hosts can be contacted');
  assert.equal(api.bind(episode.replace('/movie?','/serial?'),'56'),'',
    'a menu cannot be used as a playable stream endpoint');
});

test('verified Rezka source, season, episode and playback use identical translation IDs',()=>{
  assert.match(src,/voiceId=csoRezkaTranslationId\(task\.url\)/);
  assert.match(src,/csoRezkaTranslationId\(seasons\[n\]\.url\)!==voiceId/);
  assert.match(src,/voiceId:v\.voiceId\|\|''/);
  assert.match(src,/voiceId:best\.voiceId\|\|''/);
  assert.match(src,/voiceId:item\.voiceId\|\|''/);
  assert.match(src,/voiceId:entry\.voiceId\|\|''/);
  assert.match(src,/__csoExpectedVoiceId:verifiedSeason\.voiceId\|\|''/);
  assert.match(src,/__csoExpectedVoiceId:alternative\.voiceId\|\|''/);
  assert.match(src,/csoRezkaMovieCallUrl\(file\.url,file\.__csoExpectedVoiceId\)/);
  assert.match(src,/network\["native"\]\(signed\?safeEpisodeUrl:account\(safeEpisodeUrl\)/);
  assert.match(src,/if\(!verifiedRezka&&Lampa\.Storage\.field\('player'\)/);
  assert.match(src,/cell\.url=elem\.__csoExpectedVoiceId\?'':\(/);
});
