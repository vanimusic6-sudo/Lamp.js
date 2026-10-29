/* CAPSULE Wiki 1.0.0 — facts from Wikipedia and structured data from Wikidata */
(function(){
'use strict';
if(window.CapsuleWikiPlugin)return;
window.CapsuleWikiPlugin=true;
var installed=false,visible=false,nonce=0,article=null,cache={},lastTouch=0;
var svg='<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 5.5c3.6-1.6 6.6-1.3 9 0v14c-2.4-1.3-5.4-1.6-9 0V5.5Zm18 0c-3.6-1.6-6.6-1.3-9 0v14c2.4-1.3 5.4-1.6 9 0V5.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
function trim(s){return String(s==null?'':s).replace(/\s+/g,' ').trim();}
function norm(s){return trim(s).toLowerCase().replace(/ё/g,'е').replace(/[«»“”"':,.!?—–\-]+/g,' ').replace(/\s+/g,' ').trim();}
function unique(xs){var r=[],seen={};xs.forEach(function(x){x=trim(x);if(x&&!seen[x.toLowerCase()]){seen[x.toLowerCase()]=1;r.push(x);}});return r;}
function type(c){return c.original_name||c.first_air_date||c.number_of_seasons?'tv':'movie';}
function year(c){var y=String(c.release_date||c.first_air_date||c.year||'').match(/(?:19|20)\d{2}/);return y?y[0]:'';}
function getCard(e){return e&&(e.link&&e.link.card||e.data&&e.data.movie||e.object&&e.object.card||e.object&&e.object.movie||e.props&&e.props.get&&e.props.get('movie'));}
function request(host,options){var p={format:'json',formatversion:2,origin:'*',maxlag:5};Object.keys(options).forEach(function(k){p[k]=options[k];});
return $.ajax({url:'https://'+host+'/w/api.php',data:p,dataType:'json',timeout:10000,crossDomain:true,cache:true});}
function score(p,c){
if(!p||p.missing||p.pageprops&&p.pageprops.disambiguation!==undefined||/\(значения\)|disambiguation/i.test(p.title||''))return -999;
var title=norm(p.title).replace(/\s+\([^)]*\)$/,''),names=unique([c.title,c.name,c.original_title,c.original_name]),value=-30;
names.forEach(function(n){n=norm(n);if(n===title)value=Math.max(value,60);else if(title.indexOf(n)===0&&n.length>5)value=Math.max(value,46);else if(n.indexOf(title)===0&&title.length>5)value=Math.max(value,30);});
var description=norm((p.title||'')+' '+(p.extract||'')),film=/(фильм|кинокартин|кинолент|кинофильм|film|movie|motion picture)/i.test(description),tv=/(сериал|телесериал|television series|tv series)/i.test(description);
value+=type(c)==='tv'?(tv?22:film?-22:0):(film?22:tv?-45:0);
var y=year(c),years=(p.title||'').match(/(?:19|20)\d{2}/g)||[];
if(y)value+=years.indexOf(y)>=0?35:years.length?-42:(p.extract||'').indexOf(y)>=0?15:-6;
if(/(список|саундтрек|персонаж|franchise|list of|character)/i.test(description.slice(0,150)))value-=24;
return value;
}
function search(c,success,fail){
var names=unique([c.title,c.name,c.original_title,c.original_name]),y=year(c),tv=type(c)==='tv',plan=[],i=0,best=null,highest=-999;
if(names[0])plan.push(['ru',names[0]+' '+y+(tv?' сериал':' фильм')]);
if(names[1])plan.push(['ru',names[1]+' '+y+(tv?' сериал':' фильм')]);
if(names[0])plan.push(['ru',names[0]]);
if(names[1])plan.push(['en',names[1]+' '+y+(tv?' television series':' film')]);
if(names[0])plan.push(['en',names[0]+' '+y]);
if(names[1])plan.push(['en',names[1]]);
function next(){if(i>=plan.length){if(best&&highest>=66)success(best);else fail('Точную статью о фильме найти не удалось.');return;}
var q=plan[i++];
request(q[0]+'.wikipedia.org',{action:'query',generator:'search',gsrsearch:trim(q[1]),gsrnamespace:0,gsrlimit:7,prop:'pageprops|extracts',ppprop:'wikibase_item',exintro:1,explaintext:1,exchars:900})
.done(function(data){var pages=data&&data.query&&data.query.pages||[];
pages.forEach(function(p){var s=score(p,c);if(s>highest){highest=s;best={language:q[0],page:p};}});
if(highest>=85)success(best);else next();}).fail(next);}
next();
}
function sectionRank(s){s=norm(s);
if(/интересн|факт|trivia|behind the scene/.test(s))return 100;
if(/создани|производств|съемк|съ.мк|разработк|production|filming|development|casting/.test(s))return 90;
if(/наград|преми|номинаци|awards|accolades/.test(s))return 80;
if(/музык|саундтрек|soundtrack|music|эффект|visual effects/.test(s))return 70;
if(/прокат|восприяти|критик|release|reception|box office/.test(s))return 60;
return 0;}
function htmlText(html){
if(!html||!window.DOMParser)return [];
var doc=new DOMParser().parseFromString(String(html).slice(0,150000),'text/html');
var bad=doc.querySelectorAll('script,style,sup,.reference,.mw-editsection,.navbox,table,figure,ol.references');
for(var k=0;k<bad.length;k++)if(bad[k].parentNode)bad[k].parentNode.removeChild(bad[k]);
var nodes=doc.querySelectorAll('p,li'),text=[];
for(var j=0;j<nodes.length;j++){var s=trim(nodes[j].textContent).replace(/\[\s*\d+\s*\]/g,'');
if(s.length>=60&&s.length<=1500&&text.indexOf(s)<0)text.push(s.slice(0,650));if(text.length>=4)break;}
return text;}
function facts(found,done){var page=found.page.title,host=found.language+'.wikipedia.org';
request(host,{action:'parse',page:page,prop:'sections'}).done(function(data){
var s=data&&data.parse&&data.parse.sections||[],candidates=[];
s.forEach(function(x){var rank=sectionRank(x.line||'');if(rank&&(!x.ancestors||!x.ancestors.length||x.toclevel<=3))candidates.push({index:x.index,title:trim((x.line||'').replace(/<[^>]+>/g,'')),rank:rank});});
candidates.sort(function(a,b){return b.rank-a.rank;});candidates=candidates.slice(0,3);
if(!candidates.length){done([]);return;}
var remaining=candidates.length,out=[];
candidates.forEach(function(x){
request(host,{action:'parse',page:page,prop:'text',section:x.index}).done(function(r){var h=r&&r.parse&&r.parse.text,p=htmlText(typeof h==='string'?h:h&&h['*']);if(p.length)out.push({title:x.title,rank:x.rank,paragraphs:p.slice(0,3)});})
.always(function(){if(!--remaining){out.sort(function(a,b){return b.rank-a.rank;});done(out);}});
});
}).fail(function(){done([]);});}
function claim(e,p,max){var claims=e&&e.claims&&e.claims[p]||[],out=[];claims.forEach(function(c){var v=c.mainsnak&&c.mainsnak.datavalue&&c.mainsnak.datavalue.value;if(v&&c.rank!=='deprecated'&&out.length<max)out.push(v);});return out;}
function fields(found,done){
var id=found.page.pageprops&&found.page.pageprops.wikibase_item;
if(!/^Q\d+$/.test(id||'')){done([]);return;}
request('www.wikidata.org',{action:'wbgetentities',ids:id,props:'claims'}).done(function(r){
var e=r&&r.entities&&r.entities[id];if(!e){done([]);return;}
var columns=[['Режиссёр','P57',3],['Сценарий','P58',3],['Продюсер','P162',3],['Композитор','P86',2],['Студия','P272',3],['Страна','P495',3],['Язык оригинала','P364',2]],rows=[],ids=[];
columns.forEach(function(x){var q=claim(e,x[1],x[2]).map(function(v){return v.id;}).filter(function(n){return /^Q\d+$/.test(n||'');});if(q.length){rows.push({label:x[0],ids:q});ids=ids.concat(q);}});
var release=claim(e,'P577',1);if(release.length&&release[0].time){var m=String(release[0].time).match(/\+(\d{4})-(\d\d)-(\d\d)/);if(m&&Number(m[1])>1890)rows.push({label:'Дата премьеры',value:m[3]==='00'||m[2]==='00'?m[1]:m[3]+'.'+m[2]+'.'+m[1]});}
var dur=claim(e,'P2047',1);if(dur.length&&dur[0].amount&&/Q7727|1$/.test(dur[0].unit||'')){var n=Number(dur[0].amount);if(n>0&&n<10000)rows.push({label:'Длительность',value:Math.round(n)+' мин'});}
ids=unique(ids).slice(0,32);
if(!ids.length){done(rows.filter(function(x){return x.value;}));return;}
request('www.wikidata.org',{action:'wbgetentities',ids:ids.join('|'),props:'labels',languages:'ru|en',languagefallback:1}).done(function(d){
var en=d&&d.entities||{};
rows.forEach(function(x){if(!x.ids)return;x.value=x.ids.map(function(q){var l=en[q]&&en[q].labels;return l&&(l.ru&&l.ru.value||l.en&&l.en.value)||'';}).filter(Boolean).join(', ');delete x.ids;});
done(rows.filter(function(x){return x.value;}));
}).fail(function(){done(rows.filter(function(x){return x.value;}));});
}).fail(function(){done([]);});}
function load(c,success,fail){
var key=type(c)+'_'+(c.id||'')+'_'+norm(c.original_title||c.original_name||c.title||c.name)+'_'+year(c),cached=cache[key];
if(cached&&Date.now()-cached.time<43200000){success(cached.result);return;}
search(c,function(found){var result={title:found.page.title,language:found.language,summary:trim(found.page.extract),facts:[],fields:[]},pending=2;
function finish(){if(!--pending){cache[key]={time:Date.now(),result:result};success(result);}}
facts(found,function(a){result.facts=a;finish();});fields(found,function(a){result.fields=a;finish();});
},fail);}
function label(tag,cls,t){return $('<'+tag+'/>').addClass(cls).text(t);}
function content(r){
var wrap=$('<div class="capsule-wiki"/>');
wrap.append(label('div','capsule-wiki__muted','Wikipedia · '+r.language.toUpperCase()+' / Wikidata'));
wrap.append(label('div','capsule-wiki__title',r.title));
if(r.summary){wrap.append(label('div','capsule-wiki__head','О фильме'));wrap.append(label('div','capsule-wiki__text',r.summary.slice(0,2100)));}
if(r.fields.length){wrap.append(label('div','capsule-wiki__head','Расширенная информация'));
var grid=$('<div class="capsule-wiki__grid"/>');r.fields.forEach(function(f){var line=$('<div class="capsule-wiki__row"/>');line.append(label('div','capsule-wiki__key',f.label));line.append(label('div','capsule-wiki__val',f.value));grid.append(line);});wrap.append(grid);}
if(r.facts.length){wrap.append(label('div','capsule-wiki__head','Интересные факты и подробности'));r.facts.forEach(function(f){wrap.append(label('div','capsule-wiki__sub',f.title));f.paragraphs.forEach(function(s){wrap.append(label('div','capsule-wiki__text',s));});});}
if(!r.facts.length&&!r.fields.length)wrap.append(label('div','capsule-wiki__text','В статье нет отдельных разделов с дополнительными фактами.'));
wrap.append(label('div','capsule-wiki__muted capsule-wiki__end','Источник: Wikipedia и Wikidata. Факты извлечены из статьи без генерации текста.'));
return wrap;}
function copy(){
if(!article){Lampa.Noty.show('Ссылка ещё не загружена');return;}
var url='https://'+article.language+'.wikipedia.org/wiki/'+encodeURIComponent(article.title.replace(/ /g,'_'));
try{Lampa.Utils.copyTextToClipboard(url,function(){Lampa.Noty.show('Ссылка скопирована');},function(){Lampa.Noty.show(url);});}catch(e){Lampa.Noty.show(url);}}
function close(){if(!visible)return;visible=false;nonce++;Lampa.Modal.close();if(Lampa.Controller)Lampa.Controller.toggle('content');}
function show(card){
if(!card||!Lampa.Modal)return;if(visible)close();
var token=++nonce;article=null;visible=true;
Lampa.Modal.open({title:'Wiki · '+trim(card.title||card.name||card.original_title||'Фильм'),size:'large',
html:$('<div class="capsule-wiki"/>').append(label('div','capsule-wiki__text','Ищем статью в Википедии и собираем факты…')),
buttons_position:'outside',buttons:[{name:'Скопировать ссылку',onSelect:copy},{name:'Закрыть',onSelect:close}],onBack:close});
load(card,function(r){if(!visible||token!==nonce)return;article=r;Lampa.Modal.update(content(r));},function(error){if(!visible||token!==nonce)return;Lampa.Modal.update($('<div class="capsule-wiki"/>').append(label('div','capsule-wiki__text',error+' Проверьте доступ к wikipedia.org.')));});}
function addButton(e){
var card=getCard(e),root=e.body&&$(e.body);if(!card||!root||!root.length)return;
var row=root.find('.full-start-new__buttons, .full-start__buttons').first();
if(!row.length||row.find('.capsule-wiki__button').length)return;
var el=$('<div class="full-start__button selector capsule-wiki__button"/>');el.append($(svg)).append($('<span/>').text('Wiki'));
var more=row.find('.button--options').first();if(more.length)el.insertBefore(more);else row.append(el);
el.on('hover:enter click',function(event){if(event.type==='click')event.preventDefault();if(Date.now()-lastTouch<450)return;lastTouch=Date.now();show(card);});}
function addOption(e){var c=getCard(e);if(!c||!e.options)return;
if(e.options.some(function(x){return x.capsuleWiki;}))return;
e.options.unshift({title:'Wiki · интересные факты',capsuleWiki:true,onSelect:function(){setTimeout(function(){show(c);},80);}});}
function css(){
if($('#capsule-wiki-style').length)return;
$('<style id="capsule-wiki-style"/>').text('.capsule-wiki{padding:.35em .15em 1em;line-height:1.56;color:inherit}.capsule-wiki__title{font-size:1.4em;font-weight:700;margin:.35em 0 .8em}.capsule-wiki__muted{font-size:.8em;opacity:.58}.capsule-wiki__head{font-size:1.2em;font-weight:700;margin:1.25em 0 .55em}.capsule-wiki__sub{font-weight:650;margin:1.05em 0 .4em}.capsule-wiki__text{font-size:.97em;line-height:1.58;opacity:.92;margin:0 0 .9em;overflow-wrap:anywhere}.capsule-wiki__grid{background:rgba(130,130,130,.1);border-radius:.7em;padding:.2em .9em}.capsule-wiki__row{display:flex;gap:1em;justify-content:space-between;padding:.6em 0;border-bottom:1px solid rgba(150,150,150,.16)}.capsule-wiki__row:last-child{border:0}.capsule-wiki__key{flex:0 0 38%;opacity:.66}.capsule-wiki__val{text-align:right;flex:1}.capsule-wiki__end{margin-top:1.4em}.capsule-wiki__button svg{width:1.5em;height:1.5em}@media(max-width:600px){.capsule-wiki__row{display:block}.capsule-wiki__val{text-align:left}}').appendTo('head');}
function init(){if(installed)return;if(!window.Lampa||!window.$||!Lampa.Listener||!Lampa.Modal){setTimeout(init,500);return;}
installed=true;css();Lampa.Listener.follow('full',function(e){if(!e)return;if(e.type==='complite')addButton(e);if(e.type==='options')addOption(e);});
if(Lampa.Manifest)Lampa.Manifest.plugins={name:'CAPSULE Wiki',type:'other',version:'1.0.0',description:'Интересные факты и расширенные сведения из Wikipedia и Wikidata'};
console.log('[CAPSULE Wiki] ready');}
if(window.appready||document.readyState!=='loading')init();else document.addEventListener('DOMContentLoaded',init);
setTimeout(init,1300);
})();
