'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const src=fs.readFileSync(path.join(__dirname,'..','capsule-online.js'),'utf8');

function fragment(from,to){
  const start=src.indexOf(from);
  assert.notEqual(start,-1,'missing source anchor: '+from);
  const end=src.indexOf(to,start+from.length);
  assert.notEqual(end,-1,'missing source end anchor: '+to);
  return src.slice(start,end);
}

test('catalog progress advances on real events and stops after render',()=>{
  assert.match(src,/reportCatalogStep\(1,'Получаем каталог источников'\)/);
  assert.match(src,/reportCatalogStep\(2,'Проверяем сезоны и озвучки'\)/);
  assert.match(src,/reportCatalogStep\(3,'Готовим список серий'\)/);
  assert.match(src,/scroll\.append\(wholeList\);\s*reportCatalogStep\(4,''\)/);
  assert.match(src,/catalogProgressClosed=true;/);
  assert.match(src,/prefers-reduced-motion:reduce.*cso-catalog-progress/);
  assert.doesNotMatch(fragment('function reportCatalogStep(step,label){','\n    var source;'),/setInterval/);
});

test('progress does not write after component is destroyed',()=>{
  const observed={};
  const widget={
    length:1,
    attr(key,value){observed[key]=value;return this;},
    toggleClass(key,value){observed[key]=value;return this;},
    find(selector){return {text(value){observed[selector]=value;}};}
  };
  const context={catalogProgress:widget,catalogProgressStep:-1,
    catalogProgressLabel:'',catalogProgressClosed:false};
  const code=fragment('function reportCatalogStep(step,label){','\n    var source;');
  const update=vm.runInNewContext('('+code+')',context);
  update(2,'Проверяем сезоны и озвучки');
  assert.equal(observed['data-step'],'2');
  assert.equal(observed['cso-catalog-progress--visible'],true);
  assert.equal(observed['.cso-catalog-progress__step'],'Этап 3 из 4');
  update(4,'');
  assert.equal(observed['cso-catalog-progress--visible'],false);
  const count=Object.keys(observed).length;
  context.catalogProgressClosed=true;
  update(1,'Не должно отображаться');
  assert.equal(Object.keys(observed).length,count);
  assert.equal(context.catalogProgressStep,4);
});

test('repeated UP moves row by row; only an intentional pause opens seasons',()=>{
  const season={kind:'season'};
  const first={kind:'episode',key:'1:1',previousElementSibling:null};
  const second={kind:'episode',key:'1:2',previousElementSibling:first};
  const third={kind:'episode',key:'1:3',previousElementSibling:second};
  const focus=[];
  let now=1000,nativeMoves=0,headToggles=0;
  const context={
    last:third,lastUpKeyAt:0,lastFocusAt:999,
    object:{movie:{number_of_seasons:1}},isEpisodeMedia:()=>true,
    Date:{now:()=>now},
    $(el){return {
      is(sel){return el.kind==='episode'&&sel==='.online-prestige--full.selector';},
      attr(name){return name==='data-cso-episode'?el.key:'';}
    };},
    seasonButton:Object.assign([season],{hasClass:()=>false}),
    scroll:{render:()=>({kind:'scroll'})},
    files:{render:()=>({kind:'files'})},
    scheduleFocusScroll(node){context.lastFocusAt=now;},
    Lampa:{Controller:{
      collectionFocus(node){focus.push(node);}
      ,toggle(){headToggles++;}
    }},
    Navigator:{canmove:()=>true,move(){nativeMoves++;}}
  };
  const handler=fragment('        up: function up() {','        down: function down() {').trim().replace(/,\s*$/,'');
  const up=vm.runInNewContext('({'+handler+'}).up',context);
  up();
  assert.equal(context.last,second);
  now=1120;up();
  assert.equal(context.last,first);
  now=1240;up();
  now=1360;up();
  assert.equal(context.last,first,'held UP may not steal focus');
  assert.equal(nativeMoves,0);
  assert.equal(headToggles,0);
  now=2600;up();
  assert.equal(context.last,season,'separate UP after a pause opens season');
  assert.deepEqual(focus.map(x=>x.kind),['episode','episode','season']);
});
