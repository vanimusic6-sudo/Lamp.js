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
  // Coverage of the same studio across providers dominates a voice rank.
  const score=(studioSeasons,localSeasons,voice)=>
    studioSeasons*1000000+localSeasons*10000+voice*4;
  assert(score(20,3,3)>score(19,19,7));
  assert.match(src,/groupCoverage\*1000000\+v\.nums\.length\*10000/);
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
  assert.match(src,/!v\.verifiedVoiceRoute/);
  assert.match(src,/csoRezkaGenericDub\(v\.source,v\.voice\)/);
  // No amount of episode coverage can turn an unverified route into a studio.
  assert.match(src,/if\(!v\.nums\.length\|\|!v\.voice\|\|!v\.verifiedVoiceRoute/);
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
  assert.match(src,/expected>=18\?16000:expected>=4\?13500:10000/);
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
      {source:'alloha',voice:'Дубляж',verifiedVoiceRoute:true,
        nums:[1,2,3],seasons:{
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
      {source:'hdrezka',voice:'2x2',verifiedVoiceRoute:true,
        nums:[1,2],seasons:{
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
  const overlap={source:'hdrezka',voice:'Сыендук',
    verifiedVoiceRoute:true,nums:[1,2],seasons:{
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
  assert.equal(seen[0].fresh,true,
    'refresh the chosen season so preflight markup cannot force a stale episode');
  assert.equal(ctx.filter_find.season[0].voiceId,'72');
  assert.equal(ctx.filter_find.season[0].voiceMenuUrl,chosen.voiceMenuUrl);
  assert.equal(scan.firstVoiceActivation,'direct_verified_season_fresh');
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
  const request=fragment('this.request = function(url,forceFresh){',
    'this.parseProviderRows = function(str');
  assert.match(request,/if\(cachedRoot&&!forceFresh\)/);
  const parse=fragment('this.parse = function(str) {',
    'this.similars = function(json)');
  assert.match(parse,/var exactSeason=items\.some/);
  assert.match(parse,/csoRezkaTranslationId\(row\.url\)===String\(verifiedSeason\.voiceId\|\|''\)/);
  assert.match(parse,/this\.request\(verifiedSeason\.url,true\)/);
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
    'id=123&t=72&s=1&e=2&voice=series%2Fvoice72%2Fepisode2';
  const result=ctx.csoRezkaMovieCallUrl(path,'72',1,2);
  assert.equal(new URL(result).searchParams.get('voice'),'series/voice72/episode2');
  assert.equal(new URL(result).searchParams.get('t'),'72');
  assert.equal(result,path,'automatic call must be byte-identical to the provider URL');
  assert.equal(new URL(result).searchParams.get('play'),null);
  assert.equal(ctx.csoRezkaMovieCallUrl(path+'&play=true','72',1,2),'',
    'play redirects are not provider call JSON and must be rejected');
  assert.equal(ctx.csoRezkaMovieCallUrl(path+'&t=999','72',1,2),'',
    'reject duplicate translator query parameters');
  assert.equal(ctx.csoRezkaMovieCallUrl(path+'&voice=other','72',1,2),'',
    'reject ambiguous duplicate direct voice paths');
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


test('auto and manual Rezka episode resolution make exactly the same provider call',()=>{
  const helper=fragment('function csoRezkaTranslationId(url){',
    'function csoSeriesEpisodeRouteMatches(row,selected)');
  const getBody=fragment('this.getFileUrl = function(file, call, waiting_rch) {',
    '    this.toPlayElement = function(file) {');
  const requested=[],storage={};
  const context={
    URL,window:{},sources:{hdrezka:{name:'HDRezka'}},
    object:{movie:{id:271,media_type:'tv'}},balanser:'hdrezka',
    isEpisodeMedia:()=>true,seriesSourceEnabled:()=>true,
    filmVoiceBlocked:()=>false,
    skazCredentialTarget:url=>/^https:\/\/online7\.skaz\.tv\//.test(url),
    csoSeriesTrackLabel:row=>row.studio||row.voice_name||'',
    csoSeriesVoiceCompatible:(expected,declared)=>!declared||
      String(expected).toLowerCase()===String(declared).toLowerCase(),
    filmPlaybackAllowed:()=>true,languageAccepted:()=>true,
    account:url=>url,skazAuthHeaders:()=>({}),
    Lampa:{
      Utils:{hash:text=>String(text).split('').reduce((a,c)=>a*31+
        c.charCodeAt(0)|0,0)},
      Storage:{field:()=> 'inner'},
      Loading:{start(){},stop(){}},Controller:{toggle(){}},
      Platform:{is:()=>false},Noty:{show(){}}
    },
    network:{clear(){},timeout(){},native(url,ok){
      requested.push(url);
      ok({url:'https://stream.example/episode.m3u8'});
    }}
  };
  const run=vm.runInNewContext('(function(){'+helper+';'+getBody+
    ';return this.getFileUrl;})()',context);
  const url='https://online7.skaz.tv/lite/rezka/movie?'+
    'id=1406&t=56&s=1&e=2&voice=episodes%2Fdub%2Fepisode+2';
  const base={method:'call',url,season:1,episode:2};
  let mode='automatic';
  const screen={
    __csoGapPlan:null,getChoice:()=>({voice_name:'Студия',
      voice_manual:mode==='manual'}),
    __csoManualView:false
  };
  let first=null;
  run.call(screen,{...base,__csoExpectedVoice:'Студия',
    __csoExpectedVoiceId:'56',__csoExpectedSeason:1,
    __csoVerifiedSource:'hdrezka'},json=>{first=json});
  assert.equal(first.url,'https://stream.example/episode.m3u8');
  mode='manual';
  let second=null;
  run.call(screen,{...base},json=>{second=json});
  assert.equal(second.url,first.url);
  assert.equal(requested.length,2);
  assert.equal(requested[0],url,
    'verified automatic playback must send original provider call, unchanged');
  assert.equal(requested[1],url,
    'manual playback must use exactly the same call');
  assert.equal(context.window.__capsuleDubRouteComparison.compared,true);
  assert.equal(context.window.__capsuleDubRouteComparison.same,true);
  assert.equal(context.window.__capsuleLastDubValidation.mode,'manual');
  assert.equal(context.window.__capsuleLastDubValidation.routeUnchanged,true);
});

test('episode URL validator never changes percent encoding, plus or parameter ordering',()=>{
  const helper=fragment('function csoRezkaTranslationId(url){',
    'function csoSeriesEpisodeRouteMatches(row,selected)');
  const ctx={URL,skazCredentialTarget:url=>
    /^https:\/\/online7\.skaz\.tv\//.test(url)};
  vm.runInNewContext(helper,ctx);
  const encoded='https://online7.skaz.tv/lite/rezka/movie?'+
    'voice=series%2Fdub%2Fepisode+1&e=1&s=1&t=56&id=1406';
  assert.equal(ctx.csoRezkaMovieCallUrl(encoded,'56',1,1),encoded);
  assert.equal(ctx.csoRezkaMovieCallUrl(encoded.replace('voice=','voice=https%3A%2F%2Fevil.test%2F'),'56',1,1),'');
});


test('auto selection enters the same studio menu as manual mode when one studio covers all seasons',()=>{
  const body=fragment('this.openVerifiedSeasonIndex = function(){',
    '    this.search = function()');
  const target={
    number:1,source:'hdrezka',voice:'Студия',voiceId:'56',
    url:'https://online7.skaz.tv/lite/rezka/serial?id=30&t=56&s=1',
    voiceMenuUrl:'https://online7.skaz.tv/lite/rezka/serial?id=30&t=56',
    isPrimary:true
  };
  const movie={media_type:'tv'},object={movie},diag={},season=[];
  const ctx={
    object,balanser:'hdrezka',window:{__capsuleSeriesLastScan:diag},
    filter_find:{season},isEpisodeMedia:()=>true,
    automaticSelectionEnabled:()=>true,seriesSourceEnabled:()=>true,
    csoSafeAutoTarget:()=>true,filmVoiceBlocked:()=>false,
    filmSkazUrl:x=>x,
    csoRezkaTranslationId:u=>new URL(u).searchParams.get('t')||''
  };
  const open=vm.runInNewContext('(function(){'+body+
    ';return this.openVerifiedSeasonIndex;})()',ctx);
  const requests=[],choice={season:0};
  const screen={
    __csoGapPlan:{source:'hdrezka',index:[target,
      {...target,number:2,url:target.url.replace('s=1','s=2')}]},
    getChoice:()=>choice,replaceChoice:data=>Object.assign(choice,data),
    updateSeasonButton(){},request:(url,fresh)=>requests.push({url,fresh})
  };
  assert.equal(open.call(screen),true);
  assert.equal(requests.length,1);
  assert.equal(requests[0].url,target.voiceMenuUrl,
    'must enter actual dub folder before seasons, like manual selection');
  assert.equal(requests[0].fresh,true);
  assert.equal(choice.voice_manual,true,
    'native route must disable fake verified-index episode labels');
  assert.equal(choice.voice_url,target.voiceMenuUrl);
  assert.equal(object.lampac_continue_season,1);
  assert.equal(screen.__csoActiveVerifiedSeason,null);
  assert.equal(screen.__csoAutoNativeVoice.voiceId,'56');
  assert.equal(diag.playbackRoute,'native_voice_menu');
});

test('mixed source season union still retains full verified index until native routing is proven',()=>{
  const body=fragment('this.openVerifiedSeasonIndex = function(){',
    '    this.search = function()');
  const target={
    number:1,source:'hdrezka',voice:'Студия',voiceId:'56',
    url:'https://online7.skaz.tv/lite/rezka/serial?id=30&t=56&s=1',
    voiceMenuUrl:'https://online7.skaz.tv/lite/rezka/serial?id=30&t=56',
    isPrimary:true
  };
  const ctx={
    object:{movie:{media_type:'tv'}},balanser:'hdrezka',
    window:{__capsuleSeriesLastScan:{}},filter_find:{season:[]},
    isEpisodeMedia:()=>true,automaticSelectionEnabled:()=>true,
    seriesSourceEnabled:()=>true,csoSafeAutoTarget:()=>true,
    filmVoiceBlocked:()=>false,filmSkazUrl:x=>x,
    csoRezkaTranslationId:u=>new URL(u).searchParams.get('t')||''
  };
  const open=vm.runInNewContext('(function(){'+body+
    ';return this.openVerifiedSeasonIndex;})()',ctx);
  const calls=[],choice={season:0};
  const screen={
    __csoGapPlan:{source:'hdrezka',index:[target,{
      number:2,source:'alloha',voice:'Альтернативная студия',
      isPrimary:false,url:'https://online7.skaz.tv/lite/alloha/s2'
    }]},
    getChoice:()=>choice,replaceChoice:d=>Object.assign(choice,d),
    updateSeasonButton(){},request:(url,fresh)=>calls.push({url,fresh})
  };
  assert.equal(open.call(screen),true);
  assert.equal(calls[0].url,target.url);
  assert.equal(choice.voice_manual,false);
  assert.equal(ctx.filter_find.season.length,2);
});

test('native automatic voice route validates episode translation without rewrites',()=>{
  const helper=fragment('function csoRezkaTranslationId(url){',
    'function csoSeriesEpisodeRouteMatches(row,selected)');
  const body=fragment('this.getFileUrl = function(file, call, waiting_rch) {',
    '    this.toPlayElement = function(file) {');
  const requests=[],ctx={
    URL,window:{},object:{movie:{id:21,media_type:'tv'}},
    sources:{hdrezka:{name:'HDRezka'}},balanser:'hdrezka',
    skazCredentialTarget:u=>/^https:\/\/online7\.skaz\.tv\//.test(u),
    isEpisodeMedia:()=>true,seriesSourceEnabled:()=>true,
    csoSeriesTrackLabel:row=>row.studio||row.voice_name||'',
    csoSeriesVoiceCompatible:(a,b)=>!b||a===b,
    filmPlaybackAllowed:()=>true,languageAccepted:()=>true,
    account:u=>u,skazAuthHeaders:()=>({}),
    Lampa:{
      Storage:{field:()=> 'inner'},
      Utils:{hash:x=>String(x)},
      Loading:{start(){},stop(){}},
      Controller:{toggle(){}},Noty:{show(){}},
      Platform:{is:()=>false}
    },
    network:{timeout(){},clear(){},native(url,ok){
      requests.push(url);ok({url:'https://stream.test/video'});
    }}
  };
  const run=vm.runInNewContext('(function(){'+helper+';'+body+
    ';return this.getFileUrl;})()',ctx);
  const screen={
    __csoGapPlan:null,
    __csoAutoNativeVoice:{source:'hdrezka',voice:'Студия',voiceId:'56',
      voiceMenuUrl:'https://online7.skaz.tv/lite/rezka/serial?id=30&t=56'},
    getChoice:()=>({voice_name:'Студия',voice_manual:true}),
    __csoManualView:false
  };
  const url='https://online7.skaz.tv/lite/rezka/movie?'+
    'id=30&t=56&s=1&e=1&voice=studio%2Fepisode';
  let result=null;
  run.call(screen,{method:'call',url,season:1,episode:1},res=>result=res);
  assert(result&&result.url);
  assert.equal(requests[0],url);
  assert.equal(ctx.window.__capsuleLastDubValidation.mode,'automatic_native');
  assert.equal(ctx.window.__capsuleLastDubValidation.routeUnchanged,true);
  let rejected=null;
  run.call(screen,{method:'call',
    url:url.replace('t=56','t=72'),season:1,episode:1},
    res=>rejected=res);
  assert.equal(rejected,false);
  assert.equal(requests.length,1);
  assert.equal(ctx.window.__capsuleLastDubValidation.result,'native_route_mismatch');
});

test('native source menu rejects a conflicting active studio before rendering episodes',()=>{
  const parse=fragment('this.parse = function(str) {',
    '    this.similars = function(json)');
  assert.match(parse,/nativeVoice=this\.__csoAutoNativeVoice/);
  assert.match(parse,/activeStudio&&!csoSeriesVoiceCompatible/);
  assert.match(parse,/Источник открыл другую озвучку вместо выбранной/);
  assert.match(src,/if\(nativeVoice&&actualSource===nativeVoice\.source&&/);
  assert.match(src,/if\(!keepNative\)self\.__csoAutoNativeVoice=null/);
  assert.match(src,/_this\.__csoAutoNativeVoice=null;/);
  const switchSource=fragment('this.changeBalanser = function(name) {',
    '        this.requestParams = function(url) {');
  assert.match(switchSource,/this\.__csoAutoNativeVoice=null;/,
    'native auto pin must never survive an explicit source switch');
});


test('root season catalogue without voice buttons probes only season 1 for hidden studio menus',()=>{
  const block=fragment('this.compareSeriesSources = function(ready,callback)',
    'this.currentSourceRows = function()');
  const root='https://online3.skaz.tv/lite/alloha',
        first=root+'/serial?season=1',
        second=root+'/serial?season=2',
        dubbed=root+'/serial?studio=verified';
  const pages={};
  pages[root+'?card=1']={
    items:[
      {method:'link',text:'Сезон 1',url:first},
      {method:'link',text:'Сезон 2',url:second}
    ],buttons:[]
  };
  pages[first]={
    items:[{method:'play',text:'Серия 1',url:root+'/play/episode1'}],
    buttons:[{method:'link',text:'Подтверждённая студия',url:dubbed}]
  };
  pages[dubbed]={
    items:[
      {method:'link',text:'Сезон 1',url:dubbed+'&s=1'},
      {method:'link',text:'Сезон 2',url:dubbed+'&s=2'}
    ],buttons:[]
  };
  const requests=[],ctx={
    sources:{alloha:{url:root,show:true,seasonCount:2}},
    object:{movie:{media_type:'tv',number_of_seasons:2}},
    window:{},Date,URL,clearTimeout(){},
    setTimeout(){return 1;},
    skazCredentialTarget:u=>/^https:\/\/online3\.skaz\.tv\//.test(u),
    seriesSourceEnabled:()=>true,filmValidUrl:()=>true,
    automaticSelectionEnabled:()=>true,filmSkazUrl:u=>u,
    filmVoiceBlocked:()=>false,filmVoiceIdentityKnown:()=>true,
    filmLanguagePriority:()=>2,filmVoiceRankAtSource:()=>5,
    csoSeriesVoiceCompatible:(a,b)=>a===b,csoRezkaGenericDub:()=>false,
    csoRezkaTranslationId:()=>'',account:u=>u,skazAuthHeaders:()=>({}),
    responseRead:()=>null,responseRemember(){},
    scopedSeriesMenuKey:u=>u,
    Network:class{
      timeout(){}clear(){}
      native(url,ok){
        requests.push(url);
        ok(pages[url]?'data-json='+JSON.stringify(pages[url]):'');
      }
    }
  };
  const run=vm.runInNewContext('(function(){'+block+
    ';return this.compareSeriesSources;})()',ctx);
  const screen={
    __csoManualView:false,requestParams:u=>u+'?card=1',
    parseProviderRows:html=>JSON.parse(html.slice(10))
  };
  let complete=0;
  run.call(screen,['alloha'],()=>{complete++});
  assert.equal(complete,1);
  assert.deepEqual(requests,[root+'?card=1',first,dubbed],
    'the season-first probe must discover and open the real studio once');
  assert.equal(ctx.window.__capsuleSeriesLastScan.seasonVoiceProbes,1);
  assert.equal(ctx.window.__capsuleSeriesLastScan.bestVoice,'Подтверждённая студия');
  assert.equal(screen.__csoGapPlan.primaryVoice,'Подтверждённая студия');
  assert.equal(screen.__csoGapPlan.index.length,2);
});

test('two-season root with no confirmed studio never creates a fake verified dubbing plan',()=>{
  const block=fragment('this.compareSeriesSources = function(ready,callback)',
    'this.currentSourceRows = function()');
  const root='https://online3.skaz.tv/lite/alloha',
        first=root+'/serial?s=1';
  const pages={};
  pages[root+'?card=1']={items:[
    {method:'link',text:'Сезон 1',url:first},
    {method:'link',text:'Сезон 2',url:root+'/serial?s=2'}
  ],buttons:[]};
  pages[first]={items:[
    {method:'play',text:'Серия 1',url:root+'/play/one'}
  ],buttons:[]};
  const requests=[],ctx={
    sources:{alloha:{url:root,show:true,seasonCount:2}},
    object:{movie:{media_type:'tv',number_of_seasons:2}},
    window:{},Date,URL,clearTimeout(){},setTimeout(){return 1;},
    skazCredentialTarget:u=>/^https:\/\/online3\.skaz\.tv\//.test(u),
    seriesSourceEnabled:()=>true,filmValidUrl:()=>true,
    automaticSelectionEnabled:()=>true,filmSkazUrl:u=>u,
    filmVoiceBlocked:()=>false,filmVoiceIdentityKnown:()=>true,
    filmLanguagePriority:()=>2,filmVoiceRankAtSource:()=>5,
    csoSeriesVoiceCompatible:(a,b)=>a===b,csoRezkaGenericDub:()=>false,
    csoRezkaTranslationId:()=>'',account:u=>u,skazAuthHeaders:()=>({}),
    responseRead:()=>null,responseRemember(){},
    scopedSeriesMenuKey:u=>u,
    Network:class{timeout(){}clear(){}native(url,ok){
      requests.push(url);
      ok(pages[url]?'data-json='+JSON.stringify(pages[url]):'');
    }}
  };
  const run=vm.runInNewContext('(function(){'+block+
    ';return this.compareSeriesSources;})()',ctx);
  const screen={__csoManualView:false,requestParams:u=>u+'?card=1',
    parseProviderRows:html=>JSON.parse(html.slice(10))};
  let finished=0;
  run.call(screen,['alloha'],()=>{finished++});
  assert.equal(finished,1,'do not wait for 7.5s deadline when no work remains');
  assert.deepEqual(requests,[root+'?card=1',first]);
  assert.equal(ctx.window.__capsuleSeriesLastScan.voicesFound,0);
  assert.equal(screen.__csoGapPlan,null,
    'no confirmed studio means no auto-labelled synthetic episode index');
  assert.equal(ctx.window.__capsuleSeriesLastScan.budgetReached,false);
});

test('unverified voice index falls back to native source menu',()=>{
  const body=fragment('this.openVerifiedSeasonIndex = function(){',
    '    this.search = function()');
  const ctx={object:{movie:{media_type:'tv'}},balanser:'alloha',
    window:{},filter_find:{season:[]},isEpisodeMedia:()=>true,
    automaticSelectionEnabled:()=>true,
    seriesSourceEnabled:()=>true,csoSafeAutoTarget:()=>true,
    filmVoiceBlocked:()=>false};
  const open=vm.runInNewContext('(function(){'+body+
    ';return this.openVerifiedSeasonIndex;})()',ctx);
  let called=false;
  const screen={__csoGapPlan:{source:'alloha',primaryVoice:'',
    index:[{number:1,url:'https://online3.skaz.tv/lite/alloha/season1'}]},
    request(){called=true}};
  assert.equal(open.call(screen),false);
  assert.equal(called,false);
  const parse=fragment('this.parse = function(str) {',
    'this.similars = function(json)');
  assert.match(parse,/!!plan\.primaryVoice/,
    'legacy unverified plans must not disable the ordinary voice picker');
});

test('series diagnosis reports each menu wait and avoids logging URLs or account data',()=>{
  const request=fragment('this.request = function(url,forceFresh){',
    'this.parseProviderRows = function(str');
  assert.match(request,/recordMenuTiming\('timeout',false\)/);
  assert.match(request,/recordMenuTiming\('response',false\)/);
  assert.match(request,/report\.menuTimings\.push\(\{/);
  assert.match(request,/stage:pathType,ms:/);
  assert.doesNotMatch(request,/menuTimings\.push\(\{[^}]*url:/);
  const scan=fragment('this.compareSeriesSources = function(ready,callback)',
    'this.currentSourceRows = function()');
  assert.match(scan,/expected>=18\?16000:expected>=4\?13500:10000/);
  assert.match(scan,/seasonVoiceProbes\+\+/);
});


test('a verified studio cannot silently borrow unlabelled seasons from another source',()=>{
  const planCode=fragment('function plan(){','\n      function finish(){');
  const first={source:'alloha',voice:'Студия',verifiedVoiceRoute:true,
    nums:[1],seasons:{1:{url:'https://online3.skaz.tv/lite/alloha/season1'}},
    root:'https://online3.skaz.tv/lite/alloha',route:[
      {url:'https://online3.skaz.tv/lite/alloha/studio'}
    ],voiceId:''};
  const unknown={source:'hdrezka',voice:'',verifiedVoiceRoute:false,
    nums:[2],seasons:{2:{url:'https://online3.skaz.tv/lite/hdrezka/season2'}},
    root:'https://online3.skaz.tv/lite/hdrezka',route:[],voiceId:''};
  const owner={__csoBestSeriesVoice:{},__csoGapPlan:null};
  const ctx={
    variants:[first,unknown],owner,diag:{},
    scores:{alloha:10,hdrezka:10},order:['alloha','hdrezka'],
    voiceKey:x=>String(x).toLowerCase(),
    csoRezkaGenericDub:()=>false,
    filmVoiceRankAtSource:()=>5,filmLanguagePriority:()=>2,
    safeMenu:u=>u.startsWith('https://online3.skaz.tv/'),
    filmSkazUrl:u=>u
  };
  const plan=vm.runInNewContext('('+planCode+')',ctx);
  plan();
  assert.equal(owner.__csoGapPlan.index.length,1,
    'missing season with no studio must not be passed off as a dub');
  assert.equal(owner.__csoGapPlan.index[0].number,1);
  assert.equal(ctx.diag.unionSeasons,1);
  unknown.voice='Другая студия';unknown.verifiedVoiceRoute=true;
  unknown.route=[{url:'https://online3.skaz.tv/lite/hdrezka/studio'}];
  plan();
  assert.equal(owner.__csoGapPlan.index.length,2,
    'real verified second studio may fill a missing season');
  assert.equal(ctx.diag.unionSeasons,2);
});


test('complete mixed-source union does not stop until one named studio spans every season',()=>{
  const code=fragment('function fullCoverageFound(){','\n      function drained(){');
  const urls={alloha:'https://a.example/dub',hdrezka:'https://h.example/alt'};
  const env={
    expected:5,primary:['alloha','hdrezka'],
    rootSettled:{alloha:true,hdrezka:true},gatewayPending:{},
    voiceSettled:{
      ['alloha|'+urls.alloha]:true,['hdrezka|'+urls.hdrezka]:true
    },
    catalog:{
      alloha:[{title:'Дубляж',url:urls.alloha}],
      hdrezka:[{title:'Другой перевод',url:urls.hdrezka}]
    },
    variants:[
      {source:'alloha',voice:'Дубляж',verifiedVoiceRoute:true,
        nums:[1,2,3],seasons:{
          1:{url:'https://a.example/dub/1'},
          2:{url:'https://a.example/dub/2'},
          3:{url:'https://a.example/dub/3'}
        }},
      {source:'hdrezka',voice:'Другой перевод',verifiedVoiceRoute:true,
        nums:[4,5],seasons:{
          4:{url:'https://h.example/alt/4'},
          5:{url:'https://h.example/alt/5'}
        }}
    ],
    diag:{},filmVoiceRankAtSource:()=>7,
    csoRezkaGenericDub:()=>false,
    voiceKey:text=>String(text).toLowerCase()
  };
  const full=vm.runInNewContext('('+code+')',env);
  assert.equal(full(),false,'a mixed translation union cannot stop a dub scan');
  assert.equal(env.diag.verifiedUnion,true);
  assert.equal(env.diag.earlyStop,'union_waiting_for_uniform_studio');
  env.variants[1].voice='Дубляж';
  assert.equal(full(),true,'same studio across sources covers all five seasons');
  assert.equal(env.diag.earlyStop,'complete_studio_across_sources');
});

test('five-season serial chooses a full dub across two providers over four-season alternate',()=>{
  const code=fragment('function plan(){','\n      function finish(){');
  function variant(source,voice,numbers){
    const slug=voice==='Дубляж'?'dub':'other';
    return {source,voice,verifiedVoiceRoute:true,voiceId:'',
      root:'https://online.skaz.tv/lite/'+source,
      route:[{url:'https://online.skaz.tv/lite/'+source+'/'+slug}],
      nums:numbers.slice(),seasons:Object.fromEntries(
        numbers.map(n=>[n,{url:'https://online.skaz.tv/lite/'+source+'/'+slug+'/s'+n}])
      )};
  }
  const owner={__csoBestSeriesVoice:{},__csoGapPlan:null};
  const context={
    variants:[
      variant('alloha','Дубляж',[1,2,3]),
      variant('hdrezka','Дубляж',[4,5]),
      variant('alloha','Другой перевод',[1,2,3,4])
    ],
    owner,diag:{},scores:{},order:['alloha','hdrezka'],
    voiceKey:value=>String(value).toLowerCase(),
    csoRezkaGenericDub:()=>false,
    filmVoiceRankAtSource:(source,voice)=>voice==='Дубляж'?7:5,
    filmLanguagePriority:()=>2,
    safeMenu:url=>url.startsWith('https://online.skaz.tv/'),
    filmSkazUrl:x=>x
  };
  const plan=vm.runInNewContext('('+code+')',context);
  const best=plan();
  assert.equal(best.voice,'Дубляж');
  assert.equal(context.diag.uniformCoverage,5);
  assert.equal(owner.__csoGapPlan.index.length,5);
  assert.deepEqual(Array.from(owner.__csoGapPlan.index,x=>x.voice),
    ['Дубляж','Дубляж','Дубляж','Дубляж','Дубляж']);
  assert.equal(owner.__csoGapPlan.index[4].source,'hdrezka');
  assert.equal(owner.__csoGapPlan.index[3].source,'hdrezka');
});

test('320ms image probation never erases a valid slow TV still',()=>{
  const code=fragment('function prepareEpisodeArtwork(episodes,sourceItems,callback){',
    '    function metadataTitleMatch(name){');
  const timers=[],ctx={
    Image:class{set src(url){this._src=url;}},
    setTimeout(fn,ms){timers.push({fn,ms});return timers.length;},
    clearTimeout(){},Object,
    episodePoster:()=> 'https://cdn.example/series-poster.jpg',
    artworkIdentity:url=>url.toLowerCase(),posterThumbUrl:x=>x,
    artworkDimensions:Object.create(null)
  };
  const fn=vm.runInNewContext('('+code+')',ctx);
  const row={episode_number:1,still_path:'https://cdn.example/episode1.jpg',
    __csoStillSource:'TVmaze'};
  let result;
  fn([row],[],rows=>{result=rows;});
  assert.equal(result,undefined);
  timers.find(t=>t.ms===320).fn();
  assert.equal(result[0].still_path,row.still_path,
    'image without dimensions at 320ms is not invalid');
  ctx.artworkDimensions['https://cdn.example/episode1.jpg']={ratio:0.67};
  const portrait={...row};
  fn([portrait],[],rows=>{result=rows;});
  assert.equal(result[0].still_path,'','verified portrait cannot be a scene still');
});

test('TMDB thumbnail arriving after initial list updates visible cards and outranks backup',()=>{
  const code=fragment('this.getEpisodes = function(season,call,onUpdate,sourceItems){',
    '    this.watched = function(set)');
  const metadataCache=Object.create(null),metadataPending=Object.create(null);
  const timers=new Map();let timerId=0,tmdbCb=null,externalCb=null;
  const ctx={
    object:{movie:{source:'tmdb',id:123,imdb_id:'tt1111111',
      media_type:'tv',original_name:'Series'}},
    window:{},isEpisodeMedia:()=>true,localEpisodes:()=>[],
    lampaLocalEpisodeRows:()=>[],lampaVerifiedTmdbId:()=>123,
    metadataCache,metadataPending,Date,
    setTimeout(fn,ms){const id=++timerId;timers.set(id,{fn,ms});return id;},
    clearTimeout(id){timers.delete(id);},
    Lampa:{Api:{sources:{tmdb:{get(path,args,onSuccess){
      assert.equal(path,'tv/123/season/1');tmdbCb=onSuccess;
    }}}}},
    mergeEpisodes:(first,second)=>{
      const rows=new Map();
      for(const item of first||[])rows.set(item.episode_number,{...item});
      for(const item of second||[]){
        const old=rows.get(item.episode_number)||{episode_number:item.episode_number};
        rows.set(item.episode_number,{...old,
          name:old.name||item.name||'',
          still_path:old.still_path||item.still_path||'',
          __csoStillSource:old.__csoStillSource||item.__csoStillSource});
      }
      return [...rows.values()];
    },
    prepareEpisodeArtwork:(rows,source,cb)=>cb(rows),
    fetchExternalEpisodes:(season,cb)=>{externalCb=cb;},
    genericEpisodeName:name=>!name,Image:class{}
  };
  const run=vm.runInNewContext('(function(){'+code+
    ';return this.getEpisodes;})()',ctx);
  let initial=[],updates=[];
  run.call({},1,rows=>initial.push(rows),rows=>updates.push(rows),[]);
  assert(tmdbCb,'TMDB must start');
  function fire(ms){
    const entry=[...timers.entries()].find(([,v])=>v.ms===ms);
    assert(entry,'missing timer '+ms);
    timers.delete(entry[0]);entry[1].fn();
  }
  fire(950);fire(1150);
  assert.equal(initial.length,1);
  assert.equal(initial[0].length,0,
    'do not block first paint on TMDB or TVmaze');
  assert(externalCb,'TVmaze fallback started');
  externalCb({episodes:[{episode_number:1,name:'Pilot',
    still_path:'https://tvmaze.example/episode1.jpg'}]});
  assert.equal(updates.length,1);
  assert.equal(updates[0][0].still_path,'https://tvmaze.example/episode1.jpg');
  tmdbCb({episodes:[{episode_number:1,name:'Pilot',
    still_path:'/official/tmdb-frame.jpg'}]});
  assert.equal(updates.length,2,'TMDB after hedge must NOT be ignored');
  assert.equal(updates[1][0].still_path,'/official/tmdb-frame.jpg');
  const last=Object.values(metadataCache)[0];
  assert.equal(last.episodes[0].still_path,'/official/tmdb-frame.jpg');
  assert.match(src,/getEpisodes\(seasonRequested,applyEpisodeMetadata,\s*applyEpisodeMetadata,items\)/);
});


test('slow initial thumbnail probe cannot overwrite newer TMDB frames when callbacks reorder',()=>{
  const code=fragment('this.getEpisodes = function(season,call,onUpdate,sourceItems){',
    '    this.watched = function(set)');
  const cache=Object.create(null),pending=Object.create(null),timers=new Map();
  let id=0,tmdbCb,externalCb;
  const artworkCallbacks=[];
  const context={
    object:{movie:{source:'tmdb',id:543,media_type:'tv',
      original_name:'A Series'}},
    window:{},isEpisodeMedia:()=>true,localEpisodes:()=>[],
    lampaLocalEpisodeRows:()=>[],lampaVerifiedTmdbId:()=>543,
    metadataCache:cache,metadataPending:pending,Date,
    setTimeout(fn,ms){const i=++id;timers.set(i,{fn,ms});return i;},
    clearTimeout(i){timers.delete(i);},
    Lampa:{Api:{sources:{tmdb:{get(path,args,success){tmdbCb=success;}}}}},
    mergeEpisodes:(a,b)=>{
      const byId=new Map();
      for(const row of a||[])byId.set(row.episode_number,{...row});
      for(const row of b||[]){
        const prev=byId.get(row.episode_number)||{};
        byId.set(row.episode_number,{...row,
          still_path:row.still_path||prev.still_path||''});
      }
      return [...byId.values()];
    },
    prepareEpisodeArtwork:(rows,items,callback)=>{
      artworkCallbacks.push(()=>callback(rows));
    },
    fetchExternalEpisodes:(season,callback)=>{externalCb=callback;},
    genericEpisodeName:()=>false
  };
  const fn=vm.runInNewContext('(function(){'+code+
    ';return this.getEpisodes;})()',context);
  let initial=[],updated=[];
  fn.call({},1,rows=>initial.push(rows),rows=>updated.push(rows),[]);
  for(const ms of [950,1150]){
    const pair=[...timers.entries()].find(([,t])=>t.ms===ms);
    assert(pair,'missing '+ms+'ms timer');
    timers.delete(pair[0]);pair[1].fn();
  }
  assert.equal(artworkCallbacks.length,1,'first metadata probe still pending');
  tmdbCb({episodes:[{episode_number:1,name:'Episode',
    still_path:'/tmdb/true-frame.jpg'}]});
  assert.equal(artworkCallbacks.length,2,'new official frame starts another probe');
  artworkCallbacks[1]();
  assert.equal(updated.length,1);
  assert.equal(updated[0][0].still_path,'/tmdb/true-frame.jpg');
  artworkCallbacks[0]();
  assert.equal(initial.length,1);
  assert.equal(initial[0][0].still_path,'/tmdb/true-frame.jpg',
    'initial response must return newest metadata, not stale snapshot');
  assert.equal(Object.values(cache)[0].episodes[0].still_path,
    '/tmdb/true-frame.jpg');
  assert.match(src,/updateSeq!==metadataUpdateSeq/,
    'on-screen stale batch must not overwrite newer official still');
});


test('Lampa native card supplies exact-season episode artwork and never confuses CUB and TMDB IDs',()=>{
  const helpers=fragment('function lampaEpisodeCards(){',
    '    function genericEpisodeName(value){');
  const movie={source:'cub',id:991,imdb_id:'tt0903747',
    original_name:'Breaking Bad',first_air_date:'2008-01-20'};
  const native={source:'tmdb',id:1396,imdb_id:'tt0903747',
    original_name:'Breaking Bad',first_air_date:'2008-01-20',
    seasons:[{season_number:1,episodes:[
      {episode_number:1,season_number:1,still_path:'/ep1.jpg',name:'Pilot'}
    ]},{season_number:2,episodes:[
      {episode_number:1,season_number:2,still_path:'/ep2.jpg',name:'Seven Thirty-Seven'}
    ]}]};
  const wrong={source:'tmdb',id:7007,original_name:'Another Show',
    first_air_date:'2016-08-10',seasons:[{
      season_number:2,episodes:[{
        episode_number:1,still_path:'/evil.jpg'
      }]}]};
  const ctx={object:{movie},Lampa:{Activity:{active:()=>({card:native})}},
    posterThumbUrl:x=>x};
  const api=vm.runInNewContext('(function(){'+helpers+
    ';return {cards:lampaEpisodeCards,rows:lampaLocalEpisodeRows,'+
    'tmdb:lampaVerifiedTmdbId};})()',ctx);
  assert.equal(api.tmdb(),1396,'Lampa matching TMDB ID beats non-TMDB CUB ID');
  const rows=api.rows(2);
  assert.equal(rows.length,1);
  assert.equal(rows[0].still_path,'/ep2.jpg');
  assert.equal(rows[0].__csoStillSource,'Lampa');
  ctx.Lampa.Activity.active=()=>({card:wrong});
  assert.equal(api.tmdb(),0,'unrelated active card cannot supply a TMDB ID');
  assert.equal(api.rows(2).length,0,'never borrow another show stills');
});

test('episode fetch reuses Lampa.Api.seasons before direct TMDB and publishes the native still',()=>{
  const code=fragment('this.getEpisodes = function(season,call,onUpdate,sourceItems){',
    '    this.watched = function(set)');
  let native=0,direct=0;
  const cached=Object.create(null),pending=Object.create(null);
  const ctx={
    window:{},object:{movie:{id:1396,source:'tmdb',
      media_type:'tv',imdb_id:'tt0903747'}},
    localEpisodes:()=>[],lampaLocalEpisodeRows:()=>[],
    lampaVerifiedTmdbId:()=>1396,isEpisodeMedia:()=>true,
    metadataCache:cached,metadataPending:pending,
    mergeEpisodes:(a,b)=>a.length?a:b,
    prepareEpisodeArtwork:(rows,items,cb)=>cb(rows),
    fetchExternalEpisodes:()=>{},genericEpisodeName:()=>false,
    Date,setTimeout:()=>1,clearTimeout:()=>{},
    Lampa:{Api:{seasons(card,seasons,cb){
      native++;
      assert.equal(card.id,1396);
      assert.equal(card.source,'tmdb');
      assert.equal(seasons[0],2);
      cb({'2':{episodes:[{episode_number:1,season_number:2,
        name:'Episode',still_path:'/episode-one.jpg'}]}});
    },sources:{tmdb:{get(){direct++;}}}}}
  };
  const run=vm.runInNewContext('(function(){'+code+
    ';return this.getEpisodes;})()',ctx);
  let rows;
  run.call({},2,r=>rows=r,null,[]);
  assert.equal(native,1);
  assert.equal(direct,0,'Lampa native season is sufficient; no duplicate request');
  assert.equal(rows[0].still_path,'/episode-one.jpg');
  assert.equal(ctx.window.__capsuleArtworkLast.nativeRows,1);
});

test('CUB ID is never sent to TMDB; IMDb lookup resolves the exact TV show first',()=>{
  const code=fragment('this.getEpisodes = function(season,call,onUpdate,sourceItems){',
    '    this.watched = function(set)');
  const calls=[],ctx={
    window:{},object:{movie:{id:999999,source:'cub',
      media_type:'tv',imdb_id:'tt0903747',original_name:'Breaking Bad',
      first_air_date:'2008-01-20'}},
    localEpisodes:()=>[],lampaLocalEpisodeRows:()=>[],
    lampaVerifiedTmdbId:()=>0,isEpisodeMedia:()=>true,
    metadataCache:Object.create(null),metadataPending:Object.create(null),
    mergeEpisodes:(a,b)=>a.length?a:b,
    prepareEpisodeArtwork:(rows,items,cb)=>cb(rows),
    fetchExternalEpisodes:()=>{},genericEpisodeName:()=>false,
    metadataYearMatch:()=>true,
    metadataTitleMatch:x=>x==='Breaking Bad',
    Date,setTimeout:()=>1,clearTimeout:()=>{},
    Lampa:{Api:{seasons(card,seasons,cb){
      calls.push('Lampa:'+card.id);
      cb({'1':{episodes:[{episode_number:1,still_path:'/pilot.jpg'}]}});
    },sources:{tmdb:{get(route,options,success){
      calls.push(route);
      if(route.startsWith('find/'))success({
        tv_results:[{id:1396,original_name:'Breaking Bad'}]
      });else throw Error('unnecessary duplicate TMDB request');
    }}}}}
  };
  const run=vm.runInNewContext('(function(){'+code+
    ';return this.getEpisodes;})()',ctx);
  let output=[];
  run.call({},1,rows=>output=rows,null,[]);
  assert.deepEqual(calls,[
    'find/tt0903747?external_source=imdb_id','Lampa:1396']);
  assert.equal(output[0].still_path,'/pilot.jpg');
  assert.equal(ctx.window.__capsuleArtworkLast.imdbResolved,true);
});

test('TVmaze and Cinemeta episode stills fetch in parallel and publish before the last source finishes',()=>{
  const helper=fragment('function genericEpisodeName(value){',
    '    // An episode still is landscape art');
  const code=fragment('function fetchExternalEpisodes(season,callback){',
    '    this.getEpisodes = function(');
  const pending=[],ctx={
    window:{},object:{movie:{media_type:'tv',imdb_id:'tt0903747',
      original_name:'Breaking Bad'}},
    Lampa:{Storage:{get:()=>''}},
    externalCache:Object.create(null),externalPending:Object.create(null),
    Date,setTimeout:()=>1,clearTimeout:()=>{},
    addExternalIdentity:()=>{},metadataYearMatch:()=>true,
    metadataTitleMatch:x=>x==='Breaking Bad',isEpisodeMedia:()=>true,
    metadataRequest:(url,headers,cb)=>pending.push({url,cb})
  };
  const run=vm.runInNewContext('(function(){'+helper+';'+code+
    ';return fetchExternalEpisodes;})()',ctx);
  const events=[];
  run(1,data=>events.push({sources:Array.from(data.sources),
    images:data.episodes.filter(x=>!!x.still_path).length}));
  assert.equal(pending.length,2,'both networks launch before either returns');
  assert(pending.some(x=>x.url.includes('tvmaze.com/lookup')));
  assert(pending.some(x=>x.url.includes('cinemeta.strem.io')));
  pending.find(x=>x.url.includes('cinemeta')).cb({meta:{
    id:'tt0903747',name:'Breaking Bad',videos:[{
      season:1,episode:1,thumbnail:'https://meta/one.jpg'
    }]}});
  assert.equal(events.length,1,'Cinemeta still appears before TVmaze resolves');
  assert.equal(events[0].images,1);
  pending.find(x=>x.url.includes('tvmaze.com/lookup')).cb({
    id:169,name:'Breaking Bad',premiered:'2008-01-20'
  });
  const eps=pending.find(x=>x.url.includes('/shows/169/episodes'));
  assert(eps);
  eps.cb([{season:1,number:2,image:{original:'https://tvmaze/two.jpg'}}]);
  assert.equal(events.at(-1).images,2);
  assert.equal(events.at(-1).sources.includes('TVmaze'),true);
});


test('incomplete native Lampa stills fall back to English TMDB via real langs parameter',()=>{
  const helpers=fragment('function genericEpisodeName(value){',
    '    // An episode still is landscape art');
  const get=fragment('this.getEpisodes = function(season,call,onUpdate,sourceItems){',
    '    this.watched = function(set)');
  let direct=0;
  const ctx={
    window:{},object:{movie:{id:1396,source:'tmdb',media_type:'tv'}},
    Date,setTimeout:()=>1,clearTimeout:()=>{},
    localEpisodes:()=>[],lampaLocalEpisodeRows:()=>[],
    lampaVerifiedTmdbId:()=>1396,isEpisodeMedia:()=>true,
    metadataCache:Object.create(null),metadataPending:Object.create(null),
    prepareEpisodeArtwork:(rows,items,cb)=>cb(rows),
    fetchExternalEpisodes:()=>{},
    Lampa:{Api:{
      seasons(card,seasons,cb){cb({'3':{episodes:[
        {episode_number:1,name:'Episode One',still_path:'/native-1.jpg'},
        {episode_number:2,name:'Episode Two',still_path:null}
      ]}});},
      sources:{tmdb:{get(path,params,ok){
        direct++;
        assert.equal(path,'tv/1396/season/3');
        assert.equal(params.langs,'en-US',
          'native Lampa API reads params.langs, NOT params.language');
        ok({episodes:[
          {episode_number:1,name:'Episode One',still_path:null},
          {episode_number:2,name:'Episode Two',still_path:'/english-2.jpg'}
        ]});
      }}}
    }}
  };
  const run=vm.runInNewContext('(function(){'+helpers+';'+get+
    ';return this.getEpisodes;})()',ctx);
  let rows;
  run.call({},3,items=>rows=items,null,[
    {episode:1},{episode:2}
  ]);
  assert.equal(direct,1);
  assert.equal(rows.length,2);
  assert.equal(rows[0].still_path,'/native-1.jpg',
    'English fallback must not erase a valid native still');
  assert.equal(rows[1].still_path,'/english-2.jpg',
    'English fallback fills missing individual episode still');
  assert.equal(ctx.window.__capsuleArtworkLast.nativeStills,1);
  assert.equal(ctx.window.__capsuleArtworkLast.tmdbStills,1);
});

test('episode poster fallback prioritizes native Lampa landscape backdrop',()=>{
  const body=fragment('function episodePosterCandidates(){',
    '    function episodePoster(){');
  const ctx={
    posterCandidatesCache:null,
    object:{movie:{source:'tmdb',id:1396,poster_path:'/portrait.jpg',
      backdrop_path:'/landscape.jpg'}},
    lampaEpisodeCards:()=>[{
      poster_path:'/portrait.jpg',backdrop_path:'/landscape.jpg'
    }],
    posterThumbUrl:x=>x,sourceCatalog:{},
    Lampa:{Activity:{active:()=>({})}},
    Object
  };
  const run=vm.runInNewContext('('+body+')',ctx);
  const opts=run();
  assert.equal(opts[0],'/landscape.jpg');
  assert.equal(opts[1],'/portrait.jpg');
});


test('blank episode still tile registers onload before any metadata image exists',()=>{
  const fragmentBody=fragment('          if(img&&(serial||still||fallbackPoster)){',
    '          if(serial)rowsByEpisode[Number(episode_num)]');
  const img={src:'',naturalWidth:900,naturalHeight:500};
  let loaded=0,removed=0;
  const ctx={
    img,serial:true,still:'',fallbackPoster:'',episode_num:1,index:0,
    element:{episode:1},images:[],
    image:{find(){return {length:1};},addClass(){loaded++;},append(){}},
    loader:{remove(){removed++;}},
    rowsByEpisode:{},
    usePosterThumb:()=>false,scheduleThumbnail(){throw Error('no image to schedule')},
    Object
  };
  vm.runInNewContext(fragmentBody,ctx);
  assert.equal(typeof img.onload,'function',
    'tile without an initial src must still accept later episode artwork');
  assert.equal(ctx.images.length,1,
    'blank tile image remains tracked for late still updates');
  assert.equal(removed,1,'no endless spinner when every fallback is missing');
  img.src='https://cdn.example/scene.jpg';
  img.onload();
  assert.equal(loaded,1,
    'late frame onload must change the tile into its visible loaded state');
});

test('late frame is scheduled despite active focus and retains real Lampa still priority',()=>{
  const body=fragment('          // Image requests are deferred by IntersectionObserver',
    '          var offset=0;');
  const img={src:'',__csoDeferredSrc:''},requested=[];
  const entry={
    img,html:[{isConnected:true}],sourceImage:true,
    image:{removeClass(){}}
  };
  const ctx={
    changed:[{entry,row:{
      still_path:'/tmdb-frame.jpg',__csoStillSource:'Lampa'
    }}],
    posterThumbUrl:x=>x,
    scheduleThumbnail:(image,url)=>requested.push(url),
    usePosterThumb:()=>false,
    lastFocusAt:Date.now(),Date,Object
  };
  vm.runInNewContext(body,ctx);
  assert.deepEqual(requested,['/tmdb-frame.jpg'],
    'image queueing must not depend on 500ms of user inactivity');
  assert.equal(typeof img.onerror,'function',
    'late replacement must restore error handling after fallback failed');
});


test('balancer image index matches exact seasons and rejects recycled series posters',()=>{
  const block=fragment('var balancerEpisodeArt=Object.create(null)',
    '    var filter_sources = [], sourceCatalog');
  const api=vm.runInNewContext('(function(){'+block+
    ';return {remember:rememberBalancerEpisodeArt,rows:balancerEpisodeArtRows,'+
    'urls:balancerEpisodeArtUrls,season:balancerArtSeasonFromUrl,'+
    'safe:balancerArtImageUrl,stats:balancerArtStats};})()',{
      URL,Defined:{localhost:'https://online3.skaz.tv/'},
      posterThumbUrl:x=>x,episodePoster:()=> 'https://cdn.example/show.jpg',
      artworkIdentity:x=>String(x).toLowerCase()
    });
  assert.equal(api.season('https://online3.skaz.tv/rezka?x=5&s=2&t=19'),2);
  const rows=[
    {method:'play',episode:1,still_path:'https://cdn.example/s2e1.jpg',
      poster:'https://cdn.example/series-cover.jpg'},
    {method:'call',episode:2,screenshot:'https://cdn.example/s2e2.jpg',
      poster:'https://cdn.example/series-cover.jpg'},
    {method:'link',episode:3,still_path:'https://cdn.example/not-an-episode.jpg'},
    {method:'play',episode:3,still_path:'http://127.0.0.1/private.png'}
  ];
  api.remember(rows,'https://online3.skaz.tv/lite/hdrezka?x=1&s=2',
    'hdrezka');
  const found=api.rows(2);
  assert.deepEqual(Array.from(found,x=>x.episode_number),[1,2]);
  assert.equal(found[0].still_path,'https://cdn.example/s2e1.jpg');
  assert.equal(found[1].still_path,'https://cdn.example/s2e2.jpg');
  assert.equal(api.urls(2,1).includes('https://cdn.example/series-cover.jpg'),
    false,'a shared series cover is not a unique episode frame');
  api.remember([{method:'play',episode:1,
      image:'https://cdn.example/s3e1.jpg'}],
    'https://online3.skaz.tv/lite/filmix?season=3','filmix');
  assert.equal(api.rows(3)[0].still_path,'https://cdn.example/s3e1.jpg');
  assert.equal(api.rows(2)[0].still_path,'https://cdn.example/s2e1.jpg',
    'same episode number in another season must never borrow this image');
  assert.equal(api.safe('javascript:alert(1)'),'');
  assert.equal(api.safe('http://192.168.1.1/a.jpg'),'');
  assert.equal(api.safe('https://example.com/test.m3u8'),'');
  assert.equal(api.safe('https://cdn.example/valid.jpg'),
    'https://cdn.example/valid.jpg');
});

test('alternate balancer art route fetches only two trusted sources, not their media',()=>{
  const block=fragment('var balancerEpisodeArt=Object.create(null)',
    '    var filter_sources = [], sourceCatalog');
  const called=[],ctx={
    URL,Defined:{localhost:'https://online3.skaz.tv/'},
    posterThumbUrl:x=>x,episodePoster:()=>'',artworkIdentity:x=>x,
    seriesSourceEnabled:()=>true,csoSafeAutoTarget:()=>true,
    filmSkazUrl:x=>x,balanser:'alloha',
    activeContentUrl:'https://online3.skaz.tv/lite/alloha?s=1',
    responseRead:()=>null,scopedSeriesMenuKey:x=>x,
    skazAuthHeaders:()=>({}),account:x=>x,
    setTimeout:()=>1,clearTimeout(){},
    Network:class{timeout(){}clear(){}native(url,success){
      called.push(url);
      success('data-json='+called.length);
    }}
  };
  const api=vm.runInNewContext('(function(){'+block+
    ';return {route:rememberBalancerArtRoute,load:loadBalancerArtRoutes,'+
    'stats:balancerArtStats};})()',ctx);
  const root='https://online3.skaz.tv/lite/';
  api.route(1,'hdrezka',root+'hdrezka/serial?s=1');
  api.route(1,'filmix',root+'filmix/serial?s=1');
  api.route(1,'kinopub',root+'kinopub/serial?s=1');
  api.route(1,'hdrezka',root+'hdrezka/different-studio?s=1');
  const updates=[];
  api.load(1,(html,url)=>({items:[{method:'play',episode:1,
    still_path:'https://cdn.example/'+
      (url.includes('hdrezka')?'rezka':'filmix')+'.jpg'}]}),
    rows=>updates.push(rows.map(x=>x.still_path)));
  assert.equal(called.length,2,'only two alternate menus in parallel');
  assert(called[0].includes('hdrezka'));
  assert(called[1].includes('filmix'));
  assert.equal(api.stats.routeRequests,2);
  assert.equal(updates.at(-1).length,1,
    'one episode retains a single preferred image and alternate candidate');
  api.load(1,()=>({items:[]}),()=>{});
  assert.equal(called.length,2,'repeated focus must not refetch images');
});

test('episode image error tries another balancer frame before series cover',()=>{
  const body=fragment('function usePosterThumb(img,image,failedUrl){',
    '    var requestPathCounts=Object.create(null)');
  const attempts=[],img={
    src:'https://cdn.example/broken.jpg',
    __csoEpisodeArtKey:'5:12'
  };
  const ctx={
    balancerEpisodeArtUrls:(season,episode)=>{
      assert.equal(season,'5');assert.equal(episode,'12');
      return ['https://cdn.example/broken.jpg',
        'https://cdn.example/other-balancer.jpg'];
    },
    episodePosterCandidates:()=>['https://cdn.example/show-poster.jpg'],
    scheduleThumbnail:(image,url)=>attempts.push(url)
  };
  const retry=vm.runInNewContext('('+body+')',ctx);
  let result=retry(img,{removeClass(){},addClass(){}},img.src);
  assert.equal(result,true);
  assert.deepEqual(attempts,['https://cdn.example/other-balancer.jpg']);
  img.currentSrc=attempts[0];
  img.onerror();
  assert.deepEqual(attempts,[
    'https://cdn.example/other-balancer.jpg',
    'https://cdn.example/show-poster.jpg'
  ]);
});

test('provider HTML parses independent image attributes and CSS poster hints',()=>{
  const p=fragment('this.parseProviderRows = function(str,baseUrl){',
    '    this.getFileUrl = function(');
  assert(p.includes('data-screenshot'));
  assert(p.includes('data-thumbnail'));
  assert(p.includes('data-preview'));
  assert(p.includes('background(?:-image)?'));
  assert(p.includes('data.__csoProviderImages=imageHints.slice(0,7)'));
  assert(src.includes('rememberBalancerEpisodeArt(data.items||[],task.url,task.key,0)'));
  assert(src.includes('loadBalancerArtRoutes(season'));
  assert(src.includes('__csoEpisodeArtKey='));
});
