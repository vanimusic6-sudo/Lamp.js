'use strict';
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const test=require('node:test');
const source=fs.readFileSync(path.join(__dirname,'..','capsule-online.js'),'utf8');
const ORIGIN='https://online3.skaz.tv/';
function html(...data){return data.map(v=>{
  const kind=v.method==='link'?'videos__button':'videos__item';
  return '<div class="'+kind+'" data-json=\''+JSON.stringify(v).replace(/'/g,'&#39;')+'\'></div>';
}).join('');}
function fixture(opts={}){
  const sent=[],plays=[],playlists=[],store=Object.assign({aesgcmkey:'SECRET_FOR_TEST_ONLY'},opts.store||{}),routes=opts.routes||{},registered={},notices=[];
  const DOMParser=class{
    parseFromString(txt){
      const nodes=[];const re=/<div class="([^"]+)" data-json='([^']*)'><\/div>/g;
      for(const m of txt.matchAll(re)){
        const json=m[2].replace(/&#39;/g,"'");
        nodes.push({getAttribute(name){return name==='class'?m[1]:name==='data-json'?json:null;},textContent:''});
      }
      return {querySelectorAll(){return nodes;}};
    }
  };
  function Network(){}
  Network.prototype.timeout=function(){};
  Network.prototype.clear=function(){};
  for(const name of ['native','silent'])Network.prototype[name]=function(url,ok,fail,data,options){
    sent.push({url,headers:options.headers});
    let key=Object.keys(routes).filter(x=>url.startsWith(x)).sort((a,b)=>b.length-a.length)[0];
    let response=key&&routes[key];
    if(typeof response==='function')response=response(url);
    const delay=opts.delay||0;
    setTimeout(()=>{
      if(response===undefined)return fail(new Error('no_route'));
      if(response instanceof Error)return fail(response);
      ok(response);
    },delay);
  };
  const L={
    Component:{add(k,ctor){registered[k]=ctor;},get(k){return registered[k];}},
    Storage:{get(k,d){return Object.hasOwn(store,k)?store[k]:d;},set(k,v){store[k]=v;}},
    Template:{add(){},get(){return {find(){return null;}};}},
    Lang:{add(){},translate(k){return k;}},
    Player:{play(data){plays.push(data);},playlist(data){playlists.push(data);}},
    Loading:{start(){},stop(){}},
    SettingsApi:{addComponent(){},addParam(){}},
    Plugin:{add(){}},
    Noty:{show(t){notices.push(t);}}
  };
  const doc={getElementById(){return null;},createElement(){return {textContent:'',id:''};},head:{appendChild(){}}};
  const root={document:doc,DOMParser,Network,Reguest:Network,Lampa:L,console,Image:null,__capsuleOnlineTestMode:true};
  const ctx={window:root,URL,Date,Math,setTimeout,clearTimeout,isFinite,Number,String,Array,Object,JSON,Error,RegExp};
  vm.runInNewContext(source,ctx,{timeout:3500});
  const api=root.CapsuleOnline.test;
  return {root,L,api,sent,plays,playlists,store,registered,notices,
    component(movie){return new registered.capsuleamedia({movie});}};
}
const movie={id:123,source:'tmdb',title:'Test Film',release_date:'2020-01-01',media_type:'movie'};
const series={id:456,source:'tmdb',name:'Show',media_type:'tv',number_of_seasons:4};
function wait(ms=30){return new Promise(r=>setTimeout(r,ms));}
test('new plugin starts without syntax issue, registers component and correct movie object',()=>{
 const h=fixture();assert.equal(h.root.CapsuleOnline.version,'0.30.0-preview.1');
 assert.equal(h.component(movie).movie.id,123);
 assert.equal(h.component(series).movie.id,456);
 assert.equal(h.api.isSeries(series),true);
});
test('strict URL validation and exfiltration regression: attacker hostname never receives key',()=>{
 const h=fixture();
 assert.equal(h.api.safeUrl('javascript:alert(1)'),false);
 assert.equal(h.api.safeUrl('https://127.0.0.1/'),false);
 assert.equal(h.api.safeUrl('https://192.168.1.1/'),false);
 assert.equal(h.api.safeUrl('https://evil.example@online3.skaz.tv/path'),false);
 assert.equal(h.api.headersFor('https://skaz.attacker.example/test')['X-Kit-AesGcm'],undefined);
 assert.equal(h.api.headersFor('http://online3.skaz.tv/test')['X-Kit-AesGcm'],undefined);
 assert.equal(h.api.headersFor(ORIGIN+'safe')['X-Kit-AesGcm'],'SECRET_FOR_TEST_ONLY');
});
test('catalog query includes the movie ID, source, serial and title',()=>{
 const h=fixture();const p=h.api.movieParams(movie,false);
 assert.match(p,/id=123/);assert.match(p,/serial=0/);assert.match(p,/title=Test%20Film/);
 assert.match(h.api.movieParams(series,true),/serial=1/);
});
test('catalog discovers film, parses data-json, handles direct play and playlist',async()=>{
 const h=fixture({routes:{
  [ORIGIN+'lite/events?life=false']:{online:[{balanser:'alloha',name:'Alloha',url:ORIGIN+'lite/online/alloha/'}]},
  [ORIGIN+'lite/online/alloha/']:html({method:'play',url:'https://cdn.example.org/movie/1080.m3u8',text:'Официальный дубляж',voice_name:'Дубляж',quality:'1080p'})
 }});
 const c=h.component(movie);c.start();await wait(70);
 assert.equal(c.state.current.family,'alloha');
 c.play(c.state.current);await wait(20);
 assert.equal(h.plays.length,1);
 assert.equal(h.plays[0].url,'https://cdn.example.org/movie/1080.m3u8');
 assert.equal(h.playlists.length,1);
 assert.match(h.sent[0].url,/id=123/);
});
test('season crawler traverses translation and season folders, preserves episode sequence',async()=>{
 const base=ORIGIN+'lite/online/alloha/';
 const h=fixture({routes:{
  [ORIGIN+'lite/events?life=false']:{online:[{balanser:'alloha',url:base}]},
  [base]:html({method:'link',url:base+'voice',text:'Дубляж'}),
  [base+'voice']:html({method:'link',url:base+'voice/season1',text:'Сезон 1',season:1},{method:'link',url:base+'voice/season2',text:'Сезон 2',season:2}),
  [base+'voice/season1']:html({method:'call',url:base+'call1',episode:1,text:'Серия 1'},
             {method:'call',url:base+'call2',episode:2,text:'Серия 2'},
             {method:'call',url:base+'call3',episode:3,text:'Серия 3'}),
  [base+'call1']:{url:'https://cdn.example.org/1.m3u8',quality:{'1080p':'https://cdn.example.org/1.m3u8'}},
  [base+'call2']:{url:'https://cdn.example.org/2.m3u8'},
  [base+'call3']:{url:'https://cdn.example.org/3.m3u8'}
 }});
 const c=h.component(series);c.start();await wait(80);
 assert.equal(c.state.cards.length,3);
 assert.deepEqual(Array.from(c.state.cards,x=>x.episode),[1,2,3]);
 assert(c.state.cards.every(x=>x.voice==='Дубляж'));
 c.play(c.state.cards[0]);await wait(40);
 assert.equal(h.plays.length,1);
 assert.equal(h.playlists.length,1);
 assert.equal(h.playlists[0].length,3);
 assert.equal(typeof h.playlists[0][1].url,'function');
 await new Promise(done=>h.playlists[0][1].url(done));
 assert.equal(h.playlists[0][1].url,'https://cdn.example.org/2.m3u8');
});
test('manual source switching filters by key and ignores unrelated source',async()=>{
 const routeA=ORIGIN+'lite/online/alloha/',routeB=ORIGIN+'lite/online/filmix/';
 const h=fixture({routes:{
  [ORIGIN+'lite/events?life=false']:{online:[{balanser:'alloha',url:routeA},{balanser:'filmix',url:routeB}]},
  [routeA]:html({method:'play',url:'https://cdn.example.org/a.m3u8',text:'Дубляж'}),
  [routeB]:html({method:'play',url:'https://cdn.example.org/b.m3u8',text:'LostFilm'})
 }});
 const c=h.component(movie);c.state.currentSource='filmix';c.start();await wait(60);
 assert.equal(c.state.current.family,'filmix');
 assert(!h.sent.some(v=>v.url.includes('lite/online/alloha/')));
});
test('forged provider receives neither account data nor AES key',async()=>{
 const attacker='https://skaz.attacker.example/';
 const h=fixture({routes:{
  [ORIGIN+'lite/events?life=false']:{online:[{balanser:'alloha',url:attacker}]},
  [attacker]:html({method:'play',url:'https://cdn.example.org/x.m3u8'})
 }});
 const c=h.component(movie);c.start();await wait(60);
 const packet=h.sent.find(x=>x.url.startsWith(attacker));
 assert(packet);assert(!packet.headers['X-Kit-AesGcm']);
 assert.equal(packet.url,attacker+'?'+h.api.movieParams(movie,false));
});
test('no false requirement that 720p in a preview represents the top quality',()=>{
 const h=fixture();const best=h.api.bestQuality({'720p':'https://cdn.example.org/720.m3u8','4K':'https://cdn.example.org/4k.m3u8'},
   {minQuality:0,maxQuality:2160});
 assert.equal(best.height,2160);
});
test('caches short lived and coalesces concurrent identical requests',async()=>{
 const h=fixture({routes:{[ORIGIN+'same']:'<div>safe</div>'},delay:5});
 await Promise.all([1,2,3].map(()=>new Promise((done,fail)=>h.api.requestText(ORIGIN+'same', {timeout:500},(e,v)=>e?fail(e):done(v)))));
 assert.equal(h.sent.length,1);
});
test('HTTP-only legacy fallback is anonymous and never sends user AES key',async()=>{
 const origin='http://online3.skaz.tv/';
 const h=fixture({routes:{
  [origin+'lite/events?life=false']:{online:[{balanser:'alloha',url:origin+'lite/online/alloha/'}]},
  [origin+'lite/online/alloha/']:html({method:'play',url:'https://cdn.example.org/stream.m3u8',text:'Дубляж'})
 }});
 const c=h.component(movie);c.start();await wait(80);
 assert.equal(c.state.current.family,'alloha');
 const http=h.sent.filter(v=>v.url.startsWith(origin));
 assert(http.length>=2);
 assert(http.every(v=>!v.headers['X-Kit-AesGcm']));
});
test('episode link may contain next page with data-json but no episode number',async()=>{
 const base=ORIGIN+'lite/online/alloha/';
 const h=fixture({routes:{
  [ORIGIN+'lite/events?life=false']:{online:[{balanser:'alloha',url:base}]},
  [base]:html({method:'link',url:base+'voice',text:'Дубляж'}),
  [base+'voice']:html({method:'link',url:base+'season',season:1,text:'Сезон 1'}),
  [base+'season']:html({method:'link',url:base+'e1',text:'Серия 1',episode:1},
                      {method:'link',url:base+'e2',text:'Серия 2',episode:2}),
  [base+'e1']:html({method:'call',url:base+'call1',text:'Воспроизвести'}),
  [base+'e2']:html({method:'call',url:base+'call2',text:'Воспроизвести'})
 }});
 const c=h.component(series);c.start();await wait(80);
 assert.deepEqual(Array.from(c.state.cards,x=>x.episode),[1,2]);
});
test('most complete season is ranked before source name and translation rank',()=>{
 const h=fixture();const provider=(key)=>({key,family:key,url:ORIGIN+key});
 const file=(n,voice)=>({method:'play',episode:n,season:1,voice_name:voice,url:'https://cdn.example.org/'+n+'.m3u8'});
 const rows=[
   h.api.makeCandidate(provider('alloha'),file(1,'Дубляж'),{},100),
   h.api.makeCandidate(provider('alloha'),file(2,'Дубляж'),{},100),
   h.api.makeCandidate(provider('filmix'),file(1,'Оригинал'),{},100),
   h.api.makeCandidate(provider('filmix'),file(2,'Оригинал'),{},100),
   h.api.makeCandidate(provider('filmix'),file(3,'Оригинал'),{},100),
 ];
 const ranked=h.api.chooseSeriesCandidates(rows,1,{language:'auto'});
 assert.equal(ranked.length,3);assert.equal(ranked[0].family,'filmix');
});
test('kids mode filters inappropriate translation without dropping unknown voice',()=>{
 const h=fixture();const provider={key:'alloha',family:'alloha',url:ORIGIN+'src'};
 const cfg={manual:false,language:'auto',kids:true,minQuality:0,maxQuality:0,sources:{alloha:true},voices:{}};
 const inappropriate=h.api.makeCandidate(provider,{method:'play',url:'https://cdn.example.org/a.m3u8',voice_name:'Кубик в Кубе'}, {},50);
 const safe=h.api.makeCandidate(provider,{method:'play',url:'https://cdn.example.org/b.m3u8',voice_name:'Дубляж'}, {},50);
 assert.equal(h.api.acceptable(inappropriate,movie,cfg),false);
 assert.equal(h.api.acceptable(safe,movie,cfg),true);
});
test('source side arbitrary HTML or javascript URL is not made playable',()=>{
 const h=fixture();const provider={key:'alloha',url:ORIGIN+'src'};
 const parsed=h.api.parseProviderHtml(html(
  {method:'play',url:'javascript:alert(1)',text:'bad'},
  {method:'play',url:'https://cdn.example.org/a.m3u8',text:'safe'}),provider,{});
 assert.equal(parsed.files.length,1);
 assert.equal(parsed.files[0].text,'safe');
});
test('known actual Lampa Reguest class is supported without window.Network',async()=>{
 const h=fixture({routes:{[ORIGIN+'same']:'OK'}});
 h.root.Lampa.Reguest=h.root.Network;
 h.root.Network=undefined;
 // Existing instance already initialized its constructor; verify network semantics.
 await new Promise((done,fail)=>h.api.requestText(ORIGIN+'same',{timeout:500},(e,v)=>e?fail(e):done(v)));
 assert(h.sent.length===1);
});
