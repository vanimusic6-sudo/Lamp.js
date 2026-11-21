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
  assert.match(src,/voiceTasks\(\[task\.key\],2\)/);
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
  const episode='https://online7.skaz.tv/lite/rezka/movie?id=1406&t=56&s=1&e=2&voice=season%2Fold-sayenduk';
  assert.equal(api.get(root),'56');
  assert.equal(api.get(episode),'56');
  const actual=api.bind(episode,'56',1,2);
  assert.equal(new URL(actual).searchParams.get('t'),'56');
  assert.equal(new URL(actual).searchParams.get('voice'),'season/old-sayenduk',
    'Lampac ajax=false needs the provider-issued voice for this episode');
  assert.equal(new URL(actual).searchParams.get('e'),'2');
  assert.equal(api.bind(episode,'55',1,2),'','never switch the chosen translation ID');
  assert.equal(api.bind(episode,'',1,2),'','unknown translation cannot be verified');
  assert.equal(api.bind(episode,'56',2,2),'','season 1 cannot use season 2');
  assert.equal(api.bind(episode,'56',1,1),'','episode index cannot be silently changed');
  assert.equal(api.bind(episode.replace('s=1','s=2'),'56',1,2),'',
    'wrong season in signer must be rejected');
  assert.equal(api.bind(episode.replace('id=1406','id='),'56',1,2),'','missing item id');
  assert.equal(api.bind(episode.replace('t=56','t=0'),'56',1,2),'','invalid translator id');
  assert.equal(api.bind(episode+'&sig=signed','56',1,2),'','signed URLs cannot be rewritten');
  assert.equal(api.bind(episode.replace('online7.skaz.tv','evil.example'),'56',1,2),'',
    'only approved Skaz hosts can be contacted');
  assert.equal(api.bind(episode.replace('/movie?','/serial?'),'56',1,2),'',
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
  assert.match(src,/csoRezkaMovieCallUrl\(file\.url,file\.__csoExpectedVoiceId,\s*file\.__csoExpectedSeason\|\|file\.season,file\.episode\)/);
  assert.match(src,/network\["native"\]\(signed\?safeEpisodeUrl:account\(safeEpisodeUrl\)/);
  assert.match(src,/if\(!verifiedRezka&&Lampa\.Storage\.field\('player'\)/);
  assert.match(src,/cell\.url=elem\.__csoExpectedVoiceId\?'':\(/);
});



test('first season signer is validated before episode display, not just on Play',()=>{
  const block=fragment('function csoRezkaTranslationId(url){',
    '\n  // Rezka\u0027s generic "Дубляж" flag');
  const api=vm.runInNewContext('(function(){'+block+
    ';return {check:csoSeriesEpisodeRouteMatches};})()',{
      URL,skazCredentialTarget(url){
        return /^https?:\/\/(?:[a-z0-9-]+\.)*skaz\.tv(?::(?:80|443))?(?:[/?#]|$)/i.test(url);
      }
    });
  const select={number:1,source:'hdrezka',voice:'Дубляж',voiceId:'56'};
  const row={method:'call',season:1,episode:1,
    url:'https://online7.skaz.tv/lite/rezka/movie?id=77&t=56&s=1&e=1'};
  assert.equal(api.check(row,select),true);
  assert.equal(api.check({...row,url:row.url.replace('s=1','s=2')},select),false,
    'server must not substitute season 2 episodes for season 1');
  assert.equal(api.check({...row,url:row.url.replace('t=56','t=58')},select),false,
    'different studio translation t cannot be called verified');
  assert.equal(api.check({...row,season:2},select),false);
  assert.equal(api.check({...row,episode:2},select),false);
  assert.equal(api.check({...row,method:'play'},select),false,
    'unverified direct streams cannot inherit a dubbed badge');
  assert.equal(api.check({...row,season:2}, {...select,number:2}),false,
    'second season still needs its own correctly indexed stream');
  const second={...row,season:2,episode:1,url:row.url.replace('s=1','s=2')};
  assert.equal(api.check(second,{...select,number:2}),true,
    'legitimate second-season link must continue working');
});

test('bad season-1 responses attempt one known alternative and never loop',()=>{
  assert.match(src,/var alternate=plan\.seasons\[verifiedSeason\.number\]/);
  assert.match(src,/csoSafeAutoTarget\(alternateUrl\)/);
  assert.match(src,/!automaticVoiceVisited\[visit\]/);
  assert.match(src,/automaticVoiceVisited\[visit\]=true/);
  assert.match(src,/plan\.index=plan\.index\.map\(function\(entry\)/);
  assert.match(src,/this\.__csoActiveVerifiedSeason=recovered/);
  assert.match(src,/this\.request\(recovered\.url\)/);
  assert.match(src,/Источник не подтвердил озвучку и сезон серий/);
});

test('remote catalog request is concurrent with ID enrichment, and retry remains quality safe',async()=>{
  const code=fragment('this.prepareSourcesFast = function(onIds){',
    '\n    // One source of truth: swap');
  let idDone,serverDone,calls=[],onIds=0;
  const ctx={
    object:{movie:{imdb_id:'',kinopoisk_id:''}},
    Promise,
    externalids(){calls.push('ids');return new Promise(resolve=>{idDone=resolve;});},
    createSource(){calls.push('catalog');return new Promise(resolve=>{serverDone=resolve;});}
  };
  vm.runInNewContext(code,ctx);
  const p=ctx.prepareSourcesFast(()=>onIds++);
  assert.deepEqual(calls,['ids','catalog'],'both network operations start before settling');
  serverDone();
  idDone();
  await p;
  assert.equal(onIds,1);
  assert.equal(calls.filter(x=>x==='catalog').length,1);
});

test('a failed catalog is retried only when new external IDs are added',async()=>{
  const code=fragment('this.prepareSourcesFast = function(onIds){',
    '\n    // One source of truth: swap');
  let ready,calls=0;
  const ctx={
    object:{movie:{imdb_id:'',kinopoisk_id:''}},
    Promise,
    externalids(){return new Promise(resolve=>{ready=resolve;});},
    createSource(){
      calls++;
      return calls===1?Promise.reject(Error('missing catalog')):Promise.resolve();
    }
  };
  vm.runInNewContext(code,ctx);
  const p=ctx.prepareSourcesFast();
  ctx.object.movie.imdb_id='tt0102030';
  ready();
  await p;
  assert.equal(calls,2);
  const other={
    ...ctx,
    createSource(){calls++;return Promise.reject(Error('still missing'));}
  };
  const p2=other.prepareSourcesFast();
  ready();
  await assert.rejects(p2,/still missing/);
  assert.equal(calls,3,'no repeating unchanged failed source requests');
});

test('slow Skaz catalog attempts exactly one delayed hedge on another mirror',()=>{
  assert.match(src,/hedgeTimer=setTimeout\(function\(\)/);
  assert.match(src,/if\(finished\|\|lifeStarted\|\|mirrorUsed\|\|vybor\.length<2\)return/);
  assert.match(src,/mirror=vybor\[\(randomIndex\+1\)%vybor\.length\]/);
  assert.match(src,/hedgeCancel=requestCatalog\(true,2900/);
  assert.match(src,/owner\.requestParams\(mirror\+'lifeevents\?memkey='/);
  assert.match(src,/},1250\)/);
  assert.match(src,/function stopPending\(\)/);
  assert.match(src,/recovery\.hedgeUsed=true/);
  assert.match(src,/serverFirstResponseMs=Math\.max\(0,Date\.now\(\)-startAt\)/);
  assert.match(src,/__capsuleLastServerTiming/);
  assert.match(src,/self\.prepareSourcesFast\(\)/);
});



test('hedged async catalog only wins if the initial life handshake has not started',()=>{
  assert.match(src,/if\(finished\|\|lifeStarted\|\|!data\|\|data\.accsdb\)return/);
  assert.match(src,/if\(data\.life===true&&data\.memkey\)/);
  assert.match(src,/lifeStarted=true;recovery\.usedLife=true/);
  assert.match(src,/owner\.memkey=String\(data\.memkey\)/);
  assert.match(src,/discoverProviderUpdates\(rows,data\.memkey/);
  assert.match(src,/function stopPending\(\)/);
  assert.match(src,/requestCatalog\(true,3400/);
  assert.match(src,/directCancel=requestCatalog\(false,5500/);
  assert.match(src,/if\(finished\|\|fallbackStarted\)return/);
});

test('cached external IDs do not cause a redundant retry after catalog failure',async()=>{
  const code=fragment('this.prepareSourcesFast = function(onIds){',
    '\n    // One source of truth: swap');
  let calls=0;
  const ctx={
    object:{movie:{imdb_id:'',kinopoisk_id:''}},Promise,
    externalids(){
      this.immediate=true;
      ctx.object.movie.imdb_id='tt0001222';
      return Promise.resolve();
    },
    createSource(){calls++;return Promise.reject(Error('offline'));}
  };
  vm.runInNewContext(code,ctx);
  await assert.rejects(ctx.prepareSourcesFast(),/offline/);
  assert.equal(calls,1,'immediately cached identifiers must be included in first request');
});



test('Lampac rezka is a canonical HDRezka automatic provider, not an unknown source',()=>{
  const block=fragment('function automaticProviderFamily(row){',
    '\n    // Lampac Online:');
  const helpers=vm.runInNewContext('(function(){'+block+
    ';return {key:automaticProviderFamily,coverage:providerCoverage};})()',{
      filmSourceFamily(row){return row.balanser;},
      filmSourceEnabled(){return true;},
      filmValidUrl(url){return /^https?:\/\//.test(url);},
      SERIES_PRIMARY:['alloha','hdrezka'],FILM_PRIMARY:['alloha','filmix','hdrezka']
    });
  const a={balanser:'alloha',url:'https://s.test/alloha',show:true};
  const r={balanser:'rezka',url:'https://s.test/rezka',show:true};
  assert.equal(helpers.key(r),'hdrezka');
  const value=helpers.coverage([a,r],true);
  assert.equal(value.complete,true);
  assert.equal(value.missing.length,0);
  assert.equal(helpers.coverage([a],true).complete,false,
    'do not claim completeness before the second provider returns');
});

test('lifeevents finishes when Alloha and Rezka have settled, ignoring unrelated server jobs',()=>{
  const body=fragment('function discoverProviderUpdates(initial,memkey,makeUrl,serial,callback){',
    '\n    function seriesSourceEnabled(');
  const collected=[],requests=[];
  const context={
    Date,Promise,setTimeout,clearTimeout,window:{},
    Network:class {
      timeout(){}
      clear(){}
      silent(url,success){
        requests.push(url);
        success({ready:false,tasks:45,online:[
          {balanser:'alloha',url:'https://skaz.tv/lite/alloha',show:true},
          {balanser:'rezka',url:'https://skaz.tv/lite/rezka',show:false}
        ]});
      }
    },
    account(v){return v;},skazAuthHeaders(){return {};},
    filmSourceFamily(row){return row.balanser;},
    automaticProviderFamily(row){return row.balanser==='rezka'?'hdrezka':row.balanser;},
    filmValidUrl(url){return /^https?:\/\//.test(url);},
    filmSourceEnabled(){return true;},
    SERIES_PRIMARY:['alloha','hdrezka'],FILM_PRIMARY:['alloha','filmix','hdrezka'],
  };
  context.providerCoverage=vm.runInNewContext('('+fragment(
    'function providerCoverage(rows,serial){','\n    // Lampac Online:')+')',context);
  const discover=vm.runInNewContext('('+body+')',context);
  discover([],'key-a',()=> 'https://online3.skaz.tv/lifeevents?memkey=key-a',
    true,(rows,info)=>collected.push({rows,info}));
  assert.equal(requests.length,1,'only the first poll was necessary');
  assert.equal(collected.length,1);
  assert.equal(collected[0].info.reason,'target_settled');
  assert.equal(collected[0].info.ready,false);
  assert.deepEqual(Array.from(collected[0].info.found),['alloha','hdrezka']);
});

test('initial server catalog starts with life=true and does not use blocking life=false',async()=>{
  const body=fragment('this.createSource = function(){','\n    this.create = function()');
  const requested=[],schedules=[],rows=[
    {balanser:'alloha',url:'https://online3.skaz.tv/lite/alloha',show:true},
    {balanser:'rezka',url:'https://online3.skaz.tv/lite/rezka',show:true}
  ];
  const context={
    Promise,Date,window:{},object:{movie:{number_of_seasons:2}},
    Defined:{localhost:'https://online3.skaz.tv/'},vybor:[
      'https://online3.skaz.tv/','https://online4.skaz.tv/'],randomIndex:0,
    setTimeout(fn,ms){schedules.push(ms);return schedules.length;},
    clearTimeout(){},account(v){return v;},skazAuthHeaders(){return {};},
    isEpisodeMedia(){return true;},
    eligibleProvider(){return true;},
    filmValidUrl(url){return /^https?:\/\//.test(url);},
    csoSafeAutoTarget(){return true;},
    providerCoverage(){return {complete:true};},
    reportCatalogStep(){},
    Network:class {
      timeout(){}
      clear(){}
      silent(url,success){
        requested.push(url);
        success({life:true,memkey:'memo-1'});
      }
    }
  };
  const create=vm.runInNewContext('(function(){'+body+
    ';return this.createSource;})()',context);
  const owner={requestParams(url){return url;},
    lifeSource(){return Promise.resolve({rows,info:{reason:'target_settled'}});},
    startSource(input){return Promise.resolve(input);}
  };
  const selected=await create.call(owner);
  assert.equal(selected.length,2);
  assert.equal(requested.length,1);
  assert.match(requested[0],/lite\/events\?life=true/);
  assert(!requested[0].includes('life=false'),'do not block on server-wide Task.WhenAll');
  assert.equal(context.window.__capsuleCatalogRecovery.usedLife,true);
});

test('legacy Skaz without life=true falls back to synchronous catalog only when needed',async()=>{
  const body=fragment('this.createSource = function(){','\n    this.create = function()');
  const req=[],rows=[{balanser:'alloha',
    url:'https://online3.skaz.tv/lite/alloha',show:true}];
  const context={
    Promise,Date,window:{},object:{movie:{number_of_seasons:2}},
    Defined:{localhost:'https://online3.skaz.tv/'},
    vybor:['https://online3.skaz.tv/'],randomIndex:0,
    setTimeout(){return 1;},clearTimeout(){},
    account(v){return v;},skazAuthHeaders(){return {};},
    isEpisodeMedia(){return true;},eligibleProvider(){return true;},
    filmValidUrl(url){return /^https?:\/\//.test(url);},
    csoSafeAutoTarget(){return true;},
    providerCoverage(){return {complete:false};},
    reportCatalogStep(){},
    Network:class {
      timeout(){}
      clear(){}
      silent(url,cb){
        req.push(url);
        cb(url.includes('life=true')?{online:[]}:rows);
      }
    }
  };
  const create=vm.runInNewContext('(function(){'+body+
    ';return this.createSource;})()',context);
  const got=await create.call({
    requestParams(v){return v;},
    startSource(v){return Promise.resolve(v);}
  });
  assert.equal(got.length,1);
  assert.equal(req.length,2);
  assert.match(req[0],/life=true/);
  assert.match(req[1],/life=false/);
});



test('real first-season voice diagnostics compare provider metadata, not a fabricated badge',()=>{
  assert.match(src,/var mediaVoiceTrace=isEpisodeMedia\(object\.movie\)\?/);
  assert.match(src,/declaredTrack:String\(sourceTrack\|\|''\)/);
  assert.match(src,/if\(mediaVoiceTrace\)window\.__capsuleLastDubValidation=mediaVoiceTrace/);
  assert.match(src,/if\(mediaVoiceTrace\)mediaVoiceTrace\.result='declared_mismatch'/);
  assert.match(src,/var safeEpisodeUrl=String\(file\.url\|\|''\),dubCheck=mediaVoiceTrace/);
  assert.match(src,/Метаданные аудио:/);
  assert.doesNotMatch(fragment('var mediaVoiceTrace=isEpisodeMedia(object.movie)?',
    '\n      if(file.__csoExpectedVoice&&sourceTrack'),/file\.stream/);
});


test('cold Rezka season opens the exact indexed season without a redundant voice GET',()=>{
  const body=fragment('this.openVerifiedSeasonIndex = function(){',
    '    this.search = function()');
  const chosen={
    number:1,
    url:'https://server.test/lite/hdrezka/movie?id=123&t=72&s=1',
    source:'hdrezka',voice:'Дублированный',voiceId:'72',
    voiceMenuUrl:'https://server.test/lite/hdrezka/show?id=123&t=72'
  };
  const seen=[],choice={season:0},scan={};
  const ctx={
    object:{movie:{media_type:'tv'}},balanser:'hdrezka',
    window:{__capsuleSeriesLastScan:scan},filter_find:{season:[]},
    isEpisodeMedia:()=>true,automaticSelectionEnabled:()=>true,
    seriesSourceEnabled:()=>true,csoSafeAutoTarget:()=>true,
    filmVoiceBlocked:()=>false,filmValidUrl:()=>true,
    filmSkazUrl:x=>x,
    csoRezkaTranslationId:u=>new URL(u).searchParams.get('t')||''
  };
  const open=vm.runInNewContext('(function(){'+body+
    ';return this.openVerifiedSeasonIndex;})()',ctx);
  const screen={
    __csoGapPlan:{source:'hdrezka',index:[chosen]},
    getChoice:()=>choice,
    replaceChoice(update){Object.assign(choice,update);},
    updateSeasonButton(){},
    request(url,fresh){seen.push({url,fresh});}
  };
  assert.equal(open.call(screen),true);
  assert.equal(seen.length,1);
  assert.equal(seen[0].url,chosen.url,
    'index must open chosen season; /serial is not a session mutation');
  assert.equal(seen[0].fresh,undefined,
    'do not add a redundant uncached catalog round trip');
  assert.equal(ctx.filter_find.season[0].voiceId,'72');
  assert.equal(ctx.filter_find.season[0].voiceMenuUrl,chosen.voiceMenuUrl);
  assert.equal(scan.firstVoiceActivation,'direct_verified_season');
});

test('unknown or conflicting Rezka translator never gets an unsafe voice activation',()=>{
  const body=fragment('this.openVerifiedSeasonIndex = function(){',
    '    this.search = function()');
  const ctx={
    object:{movie:{media_type:'tv'}},balanser:'hdrezka',
    window:{__capsuleSeriesLastScan:{}},filter_find:{season:[]},
    isEpisodeMedia:()=>true,automaticSelectionEnabled:()=>true,
    seriesSourceEnabled:()=>true,csoSafeAutoTarget:()=>true,
    filmVoiceBlocked:()=>false,filmValidUrl:()=>true,
    filmSkazUrl:x=>x,
    csoRezkaTranslationId:u=>new URL(u).searchParams.get('t')||''
  };
  const open=vm.runInNewContext('(function(){'+body+
    ';return this.openVerifiedSeasonIndex;})()',ctx);
  const seen=[],errors=[],chosen={
    number:1,source:'hdrezka',voice:'Дублированный',voiceId:'72',
    url:'https://server.test/lite/hdrezka/movie?id=123&t=72&s=1',
    voiceMenuUrl:'https://server.test/lite/hdrezka/show?id=123&t=99'
  };
  assert.equal(open.call({
    __csoGapPlan:{source:'hdrezka',index:[chosen]},
    getChoice:()=>({season:0}),replaceChoice(){},updateSeasonButton(){},
    doesNotAnswer(error){errors.push(error.message);},
    request(url,fresh){seen.push({url,fresh});}
  }),true);
  assert.equal(seen.length,0,'mismatched translator must fail closed');
  assert.match(errors[0],/не совпадает с ID/);
});

test('preflight scans only priority translations before first paint, without pruning catalog',()=>{
  const scan=fragment('this.compareSeriesSources = function(ready,callback)',
    'this.currentSourceRows = function()');
  assert.match(scan,/priority\.forEach\(function\(v\)/);
  assert.match(scan,/\.slice\(0,2\)/);
  assert.match(scan,/if\(critical\)return false/);
  assert.match(scan,/drained\(\)/);
  assert.match(scan,/catalog\[key\]\.length/);
  assert.doesNotMatch(scan,/var mustInspect=/,
    'do not delay first paint for every untrusted season-count hint');
  const request=fragment('this.request = function(url){',
    'this.parseProviderRows = function(str');
  assert.match(request,/if\(cachedRoot\)/);
  const parse=fragment('this.parse = function(str) {',
    'this.similars = function(json)');
  assert.match(parse,/var exactSeason=items\.some/);
  assert.match(parse,/csoRezkaTranslationId\(row\.url\)===String\(verifiedSeason\.voiceId\|\|''\)/);
  assert.match(parse,/this\.request\(verifiedSeason\.url\)/);
});


test('Rezka selected translation retains its per-episode voice URL for Lampac ajax=false',()=>{
  const helper=fragment('function csoRezkaTranslationId(url)',
    'function csoSeriesEpisodeRouteMatches(row,selected)');
  const ctx={
    skazCredentialTarget:url=>/^https:\/\/online3\.skaz\.tv\//.test(url),
    URL
  };
  vm.runInNewContext(helper,ctx,{timeout:3000});
  const path='https://online3.skaz.tv/lite/rezka/movie?'+
    'id=123&t=72&s=1&e=2&voice=series%2Fvoice72%2Fepisode2&play=true';
  const result=ctx.csoRezkaMovieCallUrl(path,'72',1,2);
  assert.equal(new URL(result).searchParams.get('voice'),'series/voice72/episode2');
  assert.equal(new URL(result).searchParams.get('t'),'72');
  assert.equal(new URL(result).searchParams.get('play'),null);
  assert.equal(ctx.csoRezkaMovieCallUrl(path,'99',1,2),'',
    'cannot silently use a different translator ID');
  assert.equal(ctx.csoRezkaMovieCallUrl(path,'72',1,3),'',
    'cannot substitute an unrelated episode');
  for(const voice of ['https://attacker.test/clip','../private',
      '//attacker.test/file','a\\b','/absolute/path']){
    const unsafe=new URL(path);
    unsafe.searchParams.set('voice',voice);
    assert.equal(ctx.csoRezkaMovieCallUrl(unsafe.toString(),'72',1,2),'',
      'unsafe voice path must be rejected: '+voice);
  }
});

test('missing Lampa season count can complete using source coverage evidence',()=>{
  const block=fragment('this.compareSeriesSources = function(ready,callback)',
    'this.currentSourceRows = function()');
  const hosts=['alloha','hdrezka'];
  const sources=Object.fromEntries(hosts.map(key=>[key,{
    url:'https://online3.skaz.tv/lite/'+key,show:true,
    seasonCount:1
  }]));
  const pages={};
  const dub='https://online3.skaz.tv/lite/alloha/serial?t=3',
        rezka='https://online3.skaz.tv/lite/rezka/serial?id=12&t=72';
  pages[sources.alloha.url+'?card=1']={
    buttons:[{text:'Студия',url:dub,method:'link'}],items:[]
  };
  pages[sources.hdrezka.url+'?card=1']={
    buttons:[{text:'2x2',url:rezka,method:'link'}],items:[]
  };
  pages[dub]={items:[{method:'link',text:'Сезон 1',
    url:dub+'&s=1'}],buttons:[]};
  pages[rezka]={items:[{method:'link',text:'Сезон 1',
    url:rezka+'&s=1'}],buttons:[]};
  const requested=[];
  const context={
    sources,object:{movie:{media_type:'tv'}},
    window:{},Date,URL,clearTimeout(){},setTimeout(){return 1;},
    skazCredentialTarget:u=>/^https:\/\/online3\.skaz\.tv\//.test(u),
    seriesSourceEnabled:()=>true,filmValidUrl:()=>true,
    automaticSelectionEnabled:()=>true,filmSkazUrl:u=>u,
    filmVoiceBlocked:()=>false,filmVoiceIdentityKnown:()=>true,
    filmLanguagePriority:()=>2,filmVoiceRankAtSource:()=>3,
    csoSeriesVoiceCompatible:(a,b)=>a===b,
    csoRezkaGenericDub:()=>false,
    csoRezkaTranslationId:u=>(u.match(/[?&]t=(\d+)/)||[])[1]||'',
    account:u=>u,skazAuthHeaders:()=>({}),responseRemember(){},
    responseRead:()=>null,scopedSeriesMenuKey:u=>u,
    Network:class{
      timeout(){}
      clear(){}
      native(url,ok){
        requested.push(url);
        ok(pages[url]?'data-json='+JSON.stringify(pages[url]):'');
      }
    }
  };
  const compare=vm.runInNewContext('(function(){'+block+
    ';return this.compareSeriesSources;})()',context);
  const screen={
    __csoManualView:false,requestParams:u=>u+'?card=1',
    parseProviderRows:body=>JSON.parse(
      body&&body.startsWith('data-json=')?body.slice(10):
      '{"items":[],"buttons":[]}')
  };
  let calls=0,choice;
  compare.call(screen,hosts,scores=>{calls++;choice=scores;});
  assert.equal(calls,1);
  assert.equal(requested.length,4,
    'two roots and two best voices should suffice for a single-season match');
  assert.equal(context.window.__capsuleSeriesLastScan.coverageTarget,1);
  assert.equal(context.window.__capsuleSeriesLastScan.inferredSeasonCount,true);
  assert.equal(context.window.__capsuleSeriesLastScan.coverageCompleteEarly,true);
  assert.equal(Object.keys(screen.__csoSeriesVoiceCatalog).length,2);
  assert(choice.hdrezka>0);
});
