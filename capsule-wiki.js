/* CAPSULE Wiki 1.5.0 — parallel genre-aware search, year and Wikidata verification */
(function(){
'use strict';
if(window.CapsuleWikiPlugin)return;
window.CapsuleWikiPlugin=true;
var installed=false,visible=false,nonce=0,article=null,cache={},lastTouch=0;
var svg='<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M3 5.5c3.6-1.6 6.6-1.3 9 0v14c-2.4-1.3-5.4-1.6-9 0V5.5Zm18 0c-3.6-1.6-6.6-1.3-9 0v14c2.4-1.3 5.4-1.6 9 0V5.5Z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>';
function trim(s){return String(s==null?'':s).replace(/\s+/g,' ').trim();}
function norm(s){return trim(s).toLowerCase().replace(/ё/g,'е').replace(/[«»“”"':,.!?—–\-]+/g,' ').replace(/\s+/g,' ').trim();}
function unique(xs){var r=[],seen={};xs.forEach(function(x){x=trim(x);if(x&&!seen[x.toLowerCase()]){seen[x.toLowerCase()]=1;r.push(x);}});return r;}

function type(c){return c.first_air_date||c.number_of_seasons||(!c.release_date&&c.original_name)?'tv':'movie';}
function year(c){var x=String(c.release_date||c.first_air_date||c.year||'').match(/(?:18|19|20)\d{2}/);return x?Number(x[0]):0;}
function getCard(e){return e&&(e.link&&e.link.card||e.data&&e.data.movie||e.object&&e.object.card||e.object&&e.object.movie||e.props&&e.props.get&&e.props.get('movie'));}
function request(host,options){
var p={format:'json',formatversion:2,origin:'*',maxlag:5};
Object.keys(options).forEach(function(k){p[k]=options[k];});
return $.ajax({url:'https://'+host+'/w/api.php',data:p,dataType:'json',timeout:4500,crossDomain:true,cache:true});
}
function media(c){
var kind=type(c),genres=(Array.isArray(c.genres)&&c.genres.length?c.genres:c.genre_ids)||[],ids=[],names=[];
if(!Array.isArray(genres))genres=[];
genres.forEach(function(g){if(typeof g==='number')ids.push(g);else if(g){if(g.id)ids.push(Number(g.id));if(g.name)names.push(norm(g.name));}});
function has(id,rx){return ids.indexOf(id)>=0||names.some(function(s){return rx.test(s);});}
var anim=has(16,/анимац|мульт|animation|anime/);
var doc=has(99,/документ|documentary/);
var reality=kind==='tv'&&has(10764,/реалити|reality/);
var special=anim?'animation':doc?'documentary':reality?'reality':'default';
var ru=kind==='tv'?'сериал':'фильм',en=kind==='tv'?'television series':'film';
var typed=kind==='tv'?(anim?'мультсериал':doc?'документальный сериал':reality?'реалити-шоу':ru):(anim?'мультфильм':doc?'документальный фильм':ru);
var english=kind==='tv'?(anim?'animated series':doc?'documentary series':reality?'reality series':en):(anim?'animated film':doc?'documentary film':en);
return {kind:kind,special:special,ru:ru,en:en,typed:typed,english:english};
}
function releaseYears(text){
var lead=trim(text).slice(0,360),years=[],rules=[
/(?:фильм|мультфильм|сериал|телесериал|аниме|кинолента)[^.]{0,95}?\b((?:18|19|20)\d{2})\s*(?:года|г\.|год)/ig,
/\b((?:18|19|20)\d{2})\s*(?:года|г\.)[^.]{0,65}(?:фильм|мультфильм|сериал|телесериал)/ig,
/\b((?:18|19|20)\d{2})\s+(?:film|movie|television series|tv series|animated|documentary)/ig,
/(?:released|premiered|aired|produced)\s+(?:in\s+)?\b((?:18|19|20)\d{2})\b/ig];
rules.forEach(function(r){var m;while((m=r.exec(lead))!==null){var y=Number(m[1]);if(years.indexOf(y)<0)years.push(y);}});return years;}
function score(p,c,info){
if(!p||p.missing||(p.pageprops&&p.pageprops.disambiguation!==undefined)||/\(значения\)|disambiguation/i.test(p.title||''))return -999;
var title=trim(p.title||''),base=norm(title.replace(/\s*\([^)]*\)\s*$/,'')),names=unique([c.title,c.name,c.original_title,c.original_name]),similarity=-999;
names.forEach(function(n){n=norm(n);if(base===n)similarity=Math.max(similarity,90);
else if(n.length>5&&base.indexOf(n+' ')===0&&base.length-n.length<=22)similarity=Math.max(similarity,43);
else if(base.length>5&&n.indexOf(base+' ')===0&&n.length-base.length<=22)similarity=Math.max(similarity,37);});
if(similarity<0)return -999;
var s=similarity,y=year(c),suffix=title.match(/\([^)]*?((?:18|19|20)\d{2})[^)]*\)\s*$/);
if(y&&suffix){var pageYear=Number(suffix[1]);if(Math.abs(pageYear-y)>1)return -999;s+=pageYear===y?65:4;}
var description=norm((p.title||'')+' '+(p.extract||'').slice(0,440)),
film=/(фильм|кинофильм|кинолента|кинокартин|feature film|animated film|\bfilm\b|\bmovie\b|motion picture)/i.test(description),
tv=/(телесериал|мультсериал|аниме-сериал|сериал(?:\W|$)|television series|tv series|animated series|anime series|miniseries|mini.series)/i.test(description),
animation=/(мультфильм|мультсериал|аниме|анимационн|animated|animation)/i.test(description),
documentary=/(документальн|documentary)/i.test(description);
if(info.kind==='tv')s+=tv?29:film?-76:0;
else s+=film?29:tv?-76:0;
if(info.special==='animation')s+=animation?28:documentary?-38:0;
if(info.special==='documentary')s+=documentary?28:animation?-38:0;
if(info.special==='reality'&&/(reality|реалити)/i.test(description))s+=22;
if(y){var years=releaseYears(p.extract);
if(years.length){var dist=Math.min.apply(null,years.map(function(a){return Math.abs(a-y);}));
s+=dist===0?43:dist===1?0:-125;}}
if(/(?:список|саундтрек|персонаж|франшиза|list of|soundtrack|character|franchise)/i.test(title))s-=108;
return s;
}
function statementValues(e,prop){
var claims=e&&e.claims&&e.claims[prop]||[],out=[];
claims.forEach(function(s){var v=s.mainsnak&&s.mainsnak.datavalue&&s.mainsnak.datavalue.value;if(s.rank!=='deprecated'&&v!=null)out.push(v);});return out;}
function verifyEntity(e,c,info){
if(!e||e.missing)return {bonus:0,exact:false,reject:false};
var field=info.kind==='tv'?'P4983':'P4947',opposite=info.kind==='tv'?'P4947':'P4983',
tmdb=String(c.tmdb_id||c.tmdbId||((!c.source||c.source==='tmdb')&&c.id)||'');
var actual=statementValues(e,field).map(String),wrong=statementValues(e,opposite);
if(/^\d+$/.test(tmdb)&&actual.length){if(actual.indexOf(tmdb)>=0)return {bonus:450,exact:true,reject:false};
return {bonus:-500,exact:false,reject:true};}
if(wrong.length&&!actual.length)return {bonus:-250,exact:false,reject:true};
var bonus=0,y=year(c);
var years=unique(statementValues(e,'P577').concat(statementValues(e,'P580')).map(function(v){
var m=v&&v.time&&String(v.time).match(/[+-]((?:18|19|20)\d{2})/);return m?m[1]:'';}));
if(y&&years.length){var diff=Math.min.apply(null,years.map(function(x){return Math.abs(Number(x)-y);}));
if(diff===0)bonus+=68;else if(diff===1)bonus+=5;else if(diff>=2)return {bonus:-250,exact:false,reject:true};}
var kinds=statementValues(e,'P31').map(function(x){return x.id||'';}),
film=['Q11424','Q202866','Q24869','Q506240','Q29168811'],
tv=['Q5398426','Q581714','Q15416','Q1259759','Q526877','Q1047299','Q113687694'];
var isFilm=kinds.some(function(x){return film.indexOf(x)>=0;});
var isTv=kinds.some(function(x){return tv.indexOf(x)>=0;});
if((info.kind==='tv'&&isFilm&&!isTv)||(info.kind==='movie'&&isTv&&!isFilm))
return {bonus:-250,exact:false,reject:true};
if(isFilm||isTv)bonus+=22;
if(info.special==='animation'&&kinds.indexOf('Q202866')>=0)bonus+=26;
return {bonus:bonus,exact:false,reject:false};
}

/* Fast path: batch exact article titles per language (no search index). */
function search(c,success,fail){
var info=media(c),y=year(c),local=trim(c.title||c.name),original=trim(c.original_title||c.original_name)||local;
if(!local&&!original){fail('Отсутствует название произведения.');return;}
var jobs=[],visited={};
function add(lang,name,suffixes){
if(!name)return;
var titles=unique(suffixes.map(function(s){return trim(name+s);}));
var fresh=titles.filter(function(t){var k=lang+':'+norm(t);if(visited[k])return false;visited[k]=1;return true;});
if(fresh.length)jobs.push({language:lang,titles:fresh.join('|')});
}
var ru=[],en=[];
if(y){ru.push(' ('+info.typed+', '+y+')',' ('+info.ru+', '+y+')',' ('+y+')');
en.push(' ('+y+' '+info.english+')',' ('+y+' '+info.en+')');}
ru.push(' ('+info.typed+')',' ('+info.ru+')','');
en.push(' ('+info.en+')','');
add('ru',local,ru);
if(original&&norm(original)!==norm(local))add('ru',original,ru.slice(0,2).concat(['']));
add('en',original,en);
var chosen=null,remaining=jobs.length,done=false;
function finish(){
if(done)return;done=true;
if(chosen)success({page:chosen.page,language:chosen.language});
else searchFallback(c,success,fail);
}
jobs.forEach(function(job){
request(job.language+'.wikipedia.org',{action:'query',titles:job.titles,redirects:1,
prop:'pageprops|extracts',ppprop:'wikibase_item',exintro:1,explaintext:1,exchars:750})
.done(function(response){
(response&&response.query&&response.query.pages||[]).forEach(function(p){
var points=score(p,c,info),name=trim(p.title||''),
sameYear=!y||new RegExp('\\b'+y+'\\b').test(name)||releaseYears(p.extract).indexOf(y)>=0;
if(points>=(y?155:116)&&sameYear&&(!chosen||points>chosen.score)){
chosen={page:p,language:job.language,score:points};
}
});
if(chosen&&chosen.score>=180)finish();
})
.always(function(){if(--remaining===0)finish();});
});
}

function searchFallback(c,success,fail){
var info=media(c),original=trim(c.original_title||c.original_name),local=trim(c.title||c.name),y=year(c),
waves=[[],[]],planned={},found={},finished=false;
function add(w,lang,name,kind,withYear){if(!name)return;
var q=trim(name+' '+(withYear&&y?y:'')+' '+(kind||'')),key=lang+'|'+norm(q);
if(!planned[key]){planned[key]=1;waves[w].push({language:lang,query:q});}}
add(0,'ru',local,info.typed,true);


add(0,'en',original||local,info.english,true);

add(1,'ru',local,'',false);

add(1,'en',original||local,'',false);
if(!waves[0].length){fail('У фильма отсутствует название.');return;}
function collect(lang,response){
var pages=response&&response.query&&response.query.pages||[];
pages.forEach(function(p){var s=score(p,c,info);if(s<25)return;var key=lang+'|'+p.pageid;
if(!found[key]||found[key].textScore<s)found[key]={language:lang,page:p,textScore:s};});
}
function evaluate(then){
var candidates=Object.keys(found).map(function(k){return found[k];}).sort(function(a,b){return b.textScore-a.textScore;}).slice(0,18);
if(!candidates.length){then(null);return;}
var ids=unique(candidates.map(function(x){return x.page.pageprops&&x.page.pageprops.wikibase_item||'';})).filter(function(s){return /^Q\d+$/.test(s);});
function select(entities){
var sorted=candidates.map(function(x){
var id=x.page.pageprops&&x.page.pageprops.wikibase_item,v=verifyEntity(entities[id],c,info);
return {language:x.language,page:x.page,score:x.textScore+v.bonus,reject:v.reject,exact:v.exact,hasEntity:!!entities[id]};});
sorted.sort(function(a,b){return b.score-a.score;});
var best=sorted[0],threshold=y?151:120;
if(!best||best.reject){then(null);return;}
var evidence=!y||best.exact||best.hasEntity||releaseYears(best.page.extract).indexOf(y)>=0||
new RegExp('\\b'+y+'\\b').test(best.page.title);
then(best&&(best.exact||best.score>=threshold&&evidence)?best:null);
}
if(!ids.length){select({});return;}
request('www.wikidata.org',{action:'wbgetentities',ids:ids.join('|'),props:'claims'})
.done(function(r){select(r&&r.entities||{});}).fail(function(){select({});});
}
function wave(index){
var jobs=waves[index],remaining=jobs.length,available=false;
if(!remaining){fail('Не нашлось достоверной статьи с таким годом и типом произведения.');return;}
jobs.forEach(function(q){request(q.language+'.wikipedia.org',{action:'query',generator:'search',gsrsearch:q.query,gsrnamespace:0,gsrlimit:6,
prop:'pageprops|extracts',ppprop:'wikibase_item',exintro:1,explaintext:1,exchars:700})
.done(function(result){available=true;collect(q.language,result);})
.always(function(){if(--remaining)return;
evaluate(function(best){if(finished)return;if(best){finished=true;success(best);}
else if(index===0)wave(1);
else fail(available||Object.keys(found).length?'Не удалось подтвердить название, год и тип фильма.':'Wikipedia не отвечает или подходящая статья отсутствует.');});});});
}
wave(0);
}

function sectionRank(s){s=norm(s);
if(/интересн|факт|trivia|behind the scene/.test(s))return 100;
if(/создани|производств|съемк|съ.мк|разработк|production|filming|development|casting/.test(s))return 90;
if(/наград|преми|номинаци|awards|accolades/.test(s))return 80;
if(/музык|саундтрек|soundtrack|music|эффект|visual effects/.test(s))return 70;
if(/прокат|восприяти|критик|release|reception|box office/.test(s))return 60;
return 0;}

/* A single parse request provides both infobox metadata and complete fact sections. */
function articleData(found,done){
request(found.language+'.wikipedia.org',{action:'parse',page:found.page.title,prop:'text',disableeditsection:1})
.done(function(response){
var html=response&&response.parse&&response.parse.text;
if(typeof html!=='string'&&html)html=html['*'];
if(typeof html!=='string'||!window.DOMParser){done([],[],true);return;}
try{
var doc=new DOMParser().parseFromString(html.slice(0,1200000),'text/html'),body=doc.querySelector('.mw-parser-output')||doc.body;
if(!body){done([],[]);return;}
var banned=body.querySelectorAll('script,style,nav,footer,sup,.reference,.mw-editsection,.navbox,.toc,.reflist,.references,.metadata,.noprint,ol.references');
for(var j=0;j<banned.length;j++)if(banned[j].parentNode)banned[j].parentNode.removeChild(banned[j]);
var columns=[
['Режиссёр',/режисс|directed by/i],
['Сценарий',/сценар|written by|screenplay|story by/i],
['Продюсер',/продюсер|produced by/i],
['Композитор',/композитор|music by|music composed by/i],
['Студия',/студи|производство|production compan/i],
['Страна',/страна|countr/i],
['Язык оригинала',/язык|language/i],
['Дата премьеры',/премьер|дата выхода|release date|original release/i],
['Длительность',/длительн|running time/i],
['Бюджет',/бюджет|budget/i],
['Сборы',/кассовые сборы|box office/i]
],fields=[],table=body.querySelector('table.infobox');
if(table){
var rows=table.querySelectorAll('tr');
for(var k=0;k<rows.length&&k<80;k++){
var th=rows[k].querySelector('th'),td=rows[k].querySelector('td');
if(!th||!td)continue;
var key=trim(th.textContent),position=-1;
for(var z=0;z<columns.length;z++)if(columns[z][1].test(key)){position=z;break;}
if(position<0||fields.some(function(x){return x.label===columns[position][0];}))continue;
var copy=td.cloneNode(true),breaks=copy.querySelectorAll('br');
for(var n=0;n<breaks.length;n++)breaks[n].parentNode.replaceChild(doc.createTextNode(', '),breaks[n]);
var value=trim(copy.textContent).replace(/\[\s*\d+\s*\]/g,'');
if(value&&value.length<=340)fields.push({label:columns[position][0],value:value});
}
}
var current=null,groups=[],nodes=body.querySelectorAll('h2,h3,p,li'),processed=0;
for(var i=0;i<nodes.length&&i<1800;i++){
var el=nodes[i],tag=el.tagName.toLowerCase();
if(tag==='h2'||tag==='h3'){
var title=trim(el.textContent).replace(/\[править.*?\]/ig,'');
var rank=sectionRank(title);
current=rank?{title:title,rank:rank,paragraphs:[]}:null;
if(current)groups.push(current);
continue;
}
if(!current||current.paragraphs.length>=3||el.closest('table,aside,.infobox,.navbox,.hatnote,.toc'))continue;
var value=trim(el.textContent).replace(/\[\s*\d+\s*\]/g,'');
if(value.length>=65&&value.length<=1600&&current.paragraphs.indexOf(value)<0){
current.paragraphs.push(value.slice(0,720));processed++;if(processed>=40)break;
}
}
groups=groups.filter(function(g){return g.paragraphs.length>0;}).sort(function(a,b){return b.rank-a.rank;}).slice(0,3);
done(groups,fields,false);
}catch(e){console.warn('[CAPSULE Wiki] article parsing failed',e);done([],[],true);}
}).fail(function(){done([],[],true);});
}


/* Use the Russian sitelink of the exact Wikidata item, not a guessed translated title. */
function resolveRussian(found,finish){
if(!found||found.language==='ru'){finish(found);return;}
var id=found.page&&found.page.pageprops&&found.page.pageprops.wikibase_item;
if(!/^Q\d+$/.test(id||'')){finish(found);return;}
request('www.wikidata.org',{action:'wbgetentities',ids:id,props:'sitelinks',sitefilter:'ruwiki'})
.done(function(result){
var item=result&&result.entities&&result.entities[id],linked=item&&item.sitelinks&&item.sitelinks.ruwiki;
if(!linked||!linked.title){finish(found);return;}
request('ru.wikipedia.org',{action:'query',titles:linked.title,redirects:1,prop:'pageprops|extracts',
ppprop:'wikibase_item',exintro:1,explaintext:1,exchars:950})
.done(function(r){
var pages=r&&r.query&&r.query.pages||[],page=null;
pages.forEach(function(x){if(!x.missing&&(x.pageprops&&x.pageprops.wikibase_item===id||!x.pageprops||!x.pageprops.wikibase_item))page=x;});
finish(page?{language:'ru',page:page}:found);
}).fail(function(){finish(found);});
}).fail(function(){finish(found);});
}
/* MyMemory is a keyless best-effort fallback; text sent is public Wikipedia content.
   The service limits requests to 500 bytes and may rate-limit or be inaccessible. */
function byteLength(s){try{return unescape(encodeURIComponent(s)).length;}catch(e){return s.length*3;}}
function excerpt(text,maxBytes){
text=trim(text);if(byteLength(text)<=maxBytes)return text;
var parts=text.match(/[^.!?。！？]+[.!?。！？]+(?:\s|$)/g)||[],out='';
parts.forEach(function(p){if(byteLength(out+p)<=maxBytes)out+=p;});
if(out.length>=55)return trim(out);
var cut='';
for(var i=0;i<text.length;i++){if(byteLength(cut+text.charAt(i))>maxBytes)break;cut+=text.charAt(i);}
return trim(cut).replace(/\s+\S*$/,'');
}

/* Only prose with a clear Russian-language majority is allowed into the visible article. */
function russianText(text){
var value=trim(text),cyr=(value.match(/[А-Яа-яЁё]/g)||[]).length;
var latin=(value.match(/[A-Za-zÀ-ÿ]/g)||[]).length;
return cyr>=8&&cyr>=latin*0.8;
}
function russianTitle(text){
var cyr=(String(text).match(/[А-Яа-яЁё]/g)||[]).length;
var latin=(String(text).match(/[A-Za-zÀ-ÿ]/g)||[]).length;
return cyr>=2&&cyr>=latin;
}

function safeRussianField(row){
var value=trim(row&&row.value||''),key=trim(row&&row.label||'');
if(!value)return null;
if(key==='Язык оригинала'){
var translated={english:'английский язык',french:'французский язык',german:'немецкий язык',
spanish:'испанский язык',italian:'итальянский язык',japanese:'японский язык',
korean:'корейский язык',chinese:'китайский язык',russian:'русский язык'};
if(translated[value.toLowerCase()])value=translated[value.toLowerCase()];
}
var cyr=(value.match(/[А-Яа-яЁё]/g)||[]).length,
latin=(value.match(/[A-Za-zÀ-ÿ]/g)||[]).length;
if(cyr>0)return {label:key,value:value};
if(latin<3)return {label:key,value:value};
var words=value.match(/[A-Za-zÀ-ÿ]+/g)||[];
// Keep proper nouns ("Christopher Nolan", "Warner Bros"), never whole sentences.
if(words.length<=4&&value.length<=48&&words.every(function(w){return /^[A-ZÀ-Ý]/.test(w);})){
return {label:key,value:value};
}
return null;
}
function russianOverview(card){
var text=trim(card.overview||card.description||'');
return russianText(text)?text:'';
}
function displayTitle(card,found,label){
var names=unique([card.title,card.name,label]);
for(var i=0;i<names.length;i++)if(russianTitle(names[i]))return names[i];
return (type(card)==='tv'?'Сериал':'Фильм')+(year(card)?' · '+year(card):'');
}
function translateShort(text,sourceLang,done){
var input=excerpt(text,420);
var supported=['en','es','fr','de','it','pt','pl','tr','uk','ja','zh','ko'];
var lang=String(sourceLang||'en').toLowerCase().split('-')[0];
if(lang==='ru'){if(russianText(input)){done(input);return;}lang='en';}
if(!input||supported.indexOf(lang)<0){done(null);return;}
$.ajax({url:'https://api.mymemory.translated.net/get',
data:{q:input,langpair:lang+'|ru'},dataType:'json',timeout:3400,crossDomain:true,cache:true})
.done(function(response){
var translated=trim(response&&response.responseData&&response.responseData.translatedText);
var status=Number(response&&response.responseStatus||0);
if(status===200&&russianText(translated)&&!/(MYMEMORY|WARNING|INVALID LANGUAGE|QUERY LENGTH|TRANSLATION NOT AVAILABLE)/i.test(translated))
done(translated);
else done(null);
}).fail(function(){done(null);});
}
function parseWikidataDate(value){
var match=value&&String(value.time||'').match(/[+-](\d{4})-(\d{2})-(\d{2})/);
if(!match||Number(match[1])<1880)return '';
return match[2]==='00'||match[3]==='00'?match[1]:match[3]+'.'+match[2]+'.'+match[1];
}
/* Structured fallback metadata is resolved through Russian Wikidata labels only.
   Never show raw foreign-language infobox content. */
function russianMetadata(found,done){
var id=found.page&&found.page.pageprops&&found.page.pageprops.wikibase_item;
if(!/^Q\d+$/.test(id||'')){done([],null);return;}
request('www.wikidata.org',{action:'wbgetentities',ids:id,props:'claims|labels',languages:'ru'})
.done(function(response){
var entity=response&&response.entities&&response.entities[id];
if(!entity){done([],null);return;}
var title=entity.labels&&entity.labels.ru&&entity.labels.ru.value||null;
var definitions=[['Режиссёр','P57'],['Сценарий','P58'],['Продюсер','P162'],
['Композитор','P86'],['Студия','P272'],['Страна','P495'],['Язык оригинала','P364']],
fields=[],ids=[];
definitions.forEach(function(column){
var list=statementValues(entity,column[1]).map(function(v){return v&&v.id;})
.filter(function(q){return /^Q\d+$/.test(q||'');}).slice(0,3);
if(list.length){fields.push({label:column[0],ids:list});ids=ids.concat(list);}
});
var dates=statementValues(entity,'P577').concat(statementValues(entity,'P580'));
for(var i=0;i<dates.length;i++){var d=parseWikidataDate(dates[i]);if(d){fields.push({label:'Дата премьеры',value:d});break;}}
var duration=statementValues(entity,'P2047')[0];
if(duration&&String(duration.unit||'').indexOf('Q7727')>=0&&Number(duration.amount)>0)
fields.push({label:'Длительность',value:Math.round(Number(duration.amount))+' мин'});
ids=unique(ids).slice(0,18);
if(!ids.length){done(fields.filter(function(x){return x.value;}),title);return;}
request('www.wikidata.org',{action:'wbgetentities',ids:ids.join('|'),props:'labels',languages:'ru'})
.done(function(r){
var things=r&&r.entities||{};
fields.forEach(function(row){
if(!row.ids)return;
row.value=row.ids.map(function(q){
var value=things[q]&&things[q].labels&&things[q].labels.ru&&things[q].labels.ru.value||'';
return value;
}).filter(Boolean).join(', ');
delete row.ids;
});
done(fields.filter(function(x){return x.value;}),title);
}).fail(function(){done(fields.filter(function(x){return x.value;}),title);});
}).fail(function(){done([],null);});
}
function russianResult(found,card,facts,meta,title,done){
var tasks=[],out={title:displayTitle(card,found,title),
language:found.language,linkTitle:found.page.title,sourceLanguage:found.language,
summary:russianOverview(card),facts:[],fields:meta,complete:true,translated:false,foreignUnavailable:false};
var intro=trim(found.page.extract||'');
if(intro)tasks.push({kind:'intro',text:intro});
facts.slice(0,2).forEach(function(group){
if(group.paragraphs&&group.paragraphs.length)tasks.push({kind:'fact',rank:group.rank,text:group.paragraphs[0]});
});
tasks=tasks.slice(0,4);
if(!tasks.length){out.foreignUnavailable=true;done(out,false);return;}
var pending=tasks.length,count=0;
tasks.forEach(function(task){
if(russianText(task.text)){
apply(task,task.text);
return;
}
translateShort(task.text,found.language,function(result){if(result){apply(task,result);}else finish();});
function apply(a,text){
if(!russianText(text)){finish();return;}
count++;
if(a.kind==='intro')out.summary=text;
else{
var heading=a.rank>=100?'Интересные факты':a.rank>=90?'Создание и съёмки':a.rank>=80?'Награды':a.rank>=70?'Музыка и спецэффекты':'Прокат и отзывы';
out.facts.push({title:heading,rank:a.rank,paragraphs:[text]});
}
finish();
}
function finish(){
if(!--pending){out.facts.sort(function(a,b){return b.rank-a.rank;});
out.translated=count>0;out.foreignUnavailable=count===0;out.translationPartial=count<tasks.length;
done(out,count>0);
}
}
});
}

/* Cache complete snapshots, not intermediate UI. Limit storage to avoid filling TV memory. */
function readCached(key){
var c=cache[key];
if(!c&&Lampa.Storage&&Lampa.Storage.get){
try{var saved=Lampa.Storage.get('capsule_wiki_snapshots',{});c=saved&&saved[key];}catch(e){}
}
if(c&&Date.now()-c.time<259200000){cache[key]=c;return c.result;}
return null;
}
function writeCached(key,result){
var obj={time:Date.now(),result:result};cache[key]=obj;
if(!Lampa.Storage||!Lampa.Storage.get||!Lampa.Storage.set)return;
try{
var saved=Lampa.Storage.get('capsule_wiki_snapshots',{})||{};
saved[key]=obj;
var entries=Object.keys(saved).sort(function(a,b){return saved[b].time-saved[a].time;});
entries.slice(24).forEach(function(k){delete saved[k];});
Lampa.Storage.set('capsule_wiki_snapshots',saved);
}catch(e){}
}

function load(c,success,fail){
var key='v15_'+type(c)+'_'+(c.id||'')+'_'+norm(c.original_title||c.original_name||c.title||c.name)+'_'+year(c);
var saved=readCached(key);if(saved){success(saved);return;}
search(c,function(found){
resolveRussian(found,function(chosen){
var isRussian=chosen.language==='ru'&&russianText(chosen.page.extract||'');
var details=null,meta=null,ruTitle=null,receivedArticle=false,receivedMeta=isRussian;
if(!isRussian)russianMetadata(chosen,function(rows,label){meta=rows;ruTitle=label;receivedMeta=true;finish();});
articleData(chosen,function(facts,fields,unavailable){
details={facts:facts,fields:fields,unavailable:unavailable};receivedArticle=true;finish();
});
function finish(){
if(!receivedArticle||!receivedMeta)return;
receivedArticle=false;
var facts=details.facts,fields=details.fields,unavailable=details.unavailable;
if(isRussian){
var cleanFacts=facts.map(function(group){return {
title:russianTitle(group.title)?group.title:(group.rank>=100?'Интересные факты':group.rank>=90?'Создание и съёмки':group.rank>=80?'Награды':group.rank>=70?'Музыка и спецэффекты':'Прокат и отзывы'),
rank:group.rank,paragraphs:(group.paragraphs||[]).filter(russianText)
};}).filter(function(group){return group.paragraphs.length>0;});
var cleanFields=fields.map(safeRussianField).filter(Boolean);
var title=russianTitle(chosen.page.title)?chosen.page.title:displayTitle(c,chosen);
var result={title:title,linkTitle:chosen.page.title,language:'ru',
summary:trim(chosen.page.extract),facts:cleanFacts,fields:cleanFields,complete:true,detailUnavailable:!!unavailable};
if(!unavailable)writeCached(key,result);
success(result);
}else{
russianResult(chosen,c,facts,meta||[],ruTitle,function(result,translated){
if(!unavailable&&translated&&!result.translationPartial)writeCached(key,result);
success(result);
});
}
}
});
},fail);
}

function label(tag,cls,t){return $('<'+tag+'/>').addClass(cls).text(t);}

/* The app's base font is scaled by Lampa. Relative sizes respect TV DPI. */
var fontSizes=[90,100,115,130,145,160,180],fontSetting='capsule_wiki_font_scale';
function isTV(){
try{if(Lampa.Platform&&Lampa.Platform.screen)return !!Lampa.Platform.screen('tv');}catch(e){}
return window.innerWidth>=960&&!('ontouchstart' in window);
}
function currentFont(){
var stored='auto';
try{if(Lampa.Storage&&Lampa.Storage.get)stored=String(Lampa.Storage.get(fontSetting,'auto'));}catch(e){}
if(stored==='auto')return isTV()?130:100;
var size=parseInt(stored,10);
return fontSizes.indexOf(size)>=0?size:(isTV()?130:100);
}
function fontLabel(){return currentFont()+'%';}
function applyFont(){
if(!Lampa.Modal||!Lampa.Modal.render)return;
var modal=Lampa.Modal.render();
if(!modal||!modal.length||!modal.hasClass('modal--capsule-wiki'))return;
modal.find('.capsule-wiki').css('font-size',(currentFont()/100)+'em');
modal.find('.capsule-wiki__font-value').text(fontLabel());
}
function changeFont(step){
var size=currentFont(),index=fontSizes.indexOf(size);
if(index<0){index=0;for(var i=0;i<fontSizes.length;i++)if(fontSizes[i]<=size)index=i;}
index=Math.max(0,Math.min(fontSizes.length-1,index+step));
try{Lampa.Storage.set(fontSetting,String(fontSizes[index]));}catch(e){}
applyFont();
}
function registerWikiSettings(){
var api=Lampa.SettingsApi;
if(!api||!api.addComponent||!api.addParam)return;
try{
api.addComponent({component:'capsule_wiki',name:'CAPSULE Wiki',icon:svg});
api.addParam({component:'capsule_wiki',
param:{name:fontSetting,type:'select',
values:{auto:'Автоматически',90:'Компактный (90%)',100:'Обычный (100%)',115:'Крупный (115%)',130:'Для ТВ (130%)',145:'Очень крупный (145%)',160:'Максимальный (160%)',180:'Огромный (180%)'},
default:'auto'},
field:{name:'Размер текста',description:'Можно менять прямо в окне Wiki кнопками A− и A+'},
onChange:applyFont});
}catch(e){console.warn('[CAPSULE Wiki] settings unavailable',e);}
}

function content(r){
var wrap=$('<div class="capsule-wiki"/>').css('font-size',(currentFont()/100)+'em').toggleClass('capsule-wiki--tv',isTV());
wrap.append(label('div','capsule-wiki__muted',r.translated?'Wikipedia · перевод на русский':r.foreignUnavailable?'Wikipedia · оригинал на '+String(r.language||'EN').toUpperCase():'Wikipedia · '+r.language.toUpperCase()));
wrap.append(label('div','capsule-wiki__title',r.title));
if(r.summary){wrap.append(label('div','capsule-wiki__head','О фильме'));wrap.append(label('div','capsule-wiki__text',r.summary.slice(0,2100)));}
if(r.fields.length){wrap.append(label('div','capsule-wiki__head','Расширенная информация'));
var grid=$('<div class="capsule-wiki__grid"/>');r.fields.forEach(function(f){var line=$('<div class="capsule-wiki__row"/>');line.append(label('div','capsule-wiki__key',f.label));line.append(label('div','capsule-wiki__val',f.value));grid.append(line);});wrap.append(grid);}
if(r.facts.length){wrap.append(label('div','capsule-wiki__head','Интересные факты и подробности'));r.facts.forEach(function(f){wrap.append(label('div','capsule-wiki__sub',f.title));f.paragraphs.forEach(function(s){wrap.append(label('div','capsule-wiki__text',s));});});}
if(r.foreignUnavailable)wrap.append(label('div','capsule-wiki__text','Русский текст этой статьи недоступен. Показаны только сведения на русском языке; ссылку на оригинал можно скопировать ниже.'));
else if(r.detailUnavailable)wrap.append(label('div','capsule-wiki__text','Дополнительные сведения временно недоступны. Попробуйте открыть Wiki ещё раз.'));
else if(!r.facts.length&&!r.fields.length&&r.complete&&!r.translated)wrap.append(label('div','capsule-wiki__text','В статье нет отдельных разделов с дополнительными фактами.'));
wrap.append(label('div','capsule-wiki__muted capsule-wiki__end',r.translated?'Источник: Wikipedia; перевод — MyMemory. Автоматический перевод может содержать неточности.':'Источник: Wikipedia. Информация основана на найденной статье.'));
return wrap;}
function copy(){
if(!article){Lampa.Noty.show('Ссылка ещё не загружена');return;}
var url='https://'+article.language+'.wikipedia.org/wiki/'+encodeURIComponent(String(article.linkTitle||article.title).replace(/ /g,'_'));
try{Lampa.Utils.copyTextToClipboard(url,function(){Lampa.Noty.show('Ссылка скопирована');},function(){Lampa.Noty.show(url);});}catch(e){Lampa.Noty.show(url);}}
function close(){if(!visible)return;visible=false;nonce++;Lampa.Modal.close();if(Lampa.Controller)Lampa.Controller.toggle('content');}

/* Never open an empty modal: finish one snapshot, then render the whole page once. */
var loading=false,loadingKey='',loadingTimer=null;
function busyIndicator(on){
var all=$('.capsule-wiki__button');
all.toggleClass('capsule-wiki--loading',on);
all.find('span').text(on?'Wiki · загрузка':'Wiki');
}
function stillOnCard(c){
try{
var active=Lampa.Activity&&Lampa.Activity.active&&Lampa.Activity.active();
var current=active&&active.card;
if(current&&current.id&&c.id&&String(current.id)!==String(c.id))return false;
}catch(e){}
return true;
}

var wikiToolbarIcons={
link:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.1 0l2.4-2.4a5 5 0 0 0-7.1-7.1L11 4.9"/><path d="M14 11a5 5 0 0 0-7.1 0l-2.4 2.4a5 5 0 0 0 7.1 7.1L13 19.1"/></svg>',
close:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'
};
/* Keep native Lampa footer selector nodes/events, only rearrange their presentation. */
function arrangeToolbar(modal){
if(!modal||!modal.length)return;
var footer=modal.find('.modal__footer').first(),buttons=footer.children('.modal__button');
if(buttons.length!==4||footer.find('.capsule-wiki__tools').length)return;
var font=$('<div class="capsule-wiki__tools capsule-wiki__tools--size"/>'),
actions=$('<div class="capsule-wiki__tools capsule-wiki__tools--actions"/>');
var minus=buttons.eq(0),plus=buttons.eq(1),link=buttons.eq(2),exit=buttons.eq(3);
minus.addClass('capsule-wiki__tool capsule-wiki__tool--scale').attr('aria-label','Уменьшить текст');
plus.addClass('capsule-wiki__tool capsule-wiki__tool--scale').attr('aria-label','Увеличить текст');
link.addClass('capsule-wiki__tool capsule-wiki__tool--link').text('Ссылка').prepend($(wikiToolbarIcons.link));
exit.addClass('capsule-wiki__tool capsule-wiki__tool--exit').text('Закрыть').prepend($(wikiToolbarIcons.close));
font.append(minus).append(label('span','capsule-wiki__font-value',fontLabel())).append(plus);
actions.append(link).append(exit);
footer.empty().append(font).append(actions).addClass('capsule-wiki__toolbar');
}

function show(card){
if(!card||!Lampa.Modal)return;
var key=type(card)+':'+(card.id||'')+':'+year(card);
if(loading&&loadingKey===key)return;
if(visible)return;
var token=++nonce;loading=true;loadingKey=key;article=null;
busyIndicator(true);
if(loadingTimer)clearTimeout(loadingTimer);
loadingTimer=setTimeout(function(){
if(token===nonce&&loading&&Lampa.Noty)Lampa.Noty.show('Wiki: получаем сведения…');
},750);
function stop(){
if(token!==nonce)return false;
if(loadingTimer){clearTimeout(loadingTimer);loadingTimer=null;}
loading=false;loadingKey='';busyIndicator(false);
return true;
}
load(card,function(r){
if(!stop()||!stillOnCard(card))return;
article=r;visible=true;
Lampa.Modal.open({title:'Wiki · '+trim(card.title||card.name||card.original_title||'Фильм'),size:'large',html:content(r),
buttons_position:'outside',buttons:[{name:'A−',onSelect:function(){changeFont(-1);}},{name:'A+',onSelect:function(){changeFont(1);}},{name:'Ссылка',onSelect:copy},{name:'Закрыть',onSelect:close}],onBack:close});
if(Lampa.Modal.render){var modal=Lampa.Modal.render();if(modal&&modal.length){modal.addClass('modal--capsule-wiki').toggleClass('modal--capsule-wiki-tv',isTV());arrangeToolbar(modal);}}
applyFont();
},function(error){
if(!stop()||!stillOnCard(card))return;
if(Lampa.Noty)Lampa.Noty.show('Wiki: '+error);
});
}

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
var stylesheet=[
'.capsule-wiki{box-sizing:border-box;max-width:100%;padding:.2em .2em .8em;line-height:1.64;color:inherit;word-break:normal;overflow-wrap:anywhere;text-align:left;}',
'.capsule-wiki *{box-sizing:border-box;max-width:100%;}',
'.capsule-wiki__title{font-size:1.32em;font-weight:650;line-height:1.25;margin:.3em 0 .85em;}',
'.capsule-wiki__muted{font-size:.76em;opacity:.68;line-height:1.45;}',
'.capsule-wiki__head{font-size:1.13em;font-weight:700;line-height:1.3;margin:1.25em 0 .6em;}',
'.capsule-wiki__sub{font-weight:650;font-size:1em;margin:1.1em 0 .42em;}',
'.capsule-wiki__text{font-size:1em;line-height:1.64;opacity:.95;margin:0 0 1em;white-space:normal;overflow-wrap:anywhere;}',
'.capsule-wiki__grid{background:rgba(130,130,130,.10);border-radius:.7em;padding:.1em .8em;margin:.5em 0 .8em;}',
'.capsule-wiki__row{display:flex;gap:1.15em;align-items:baseline;justify-content:space-between;padding:.65em .1em;border-bottom:1px solid rgba(150,150,150,.18);overflow-wrap:anywhere;}',
'.capsule-wiki__row:last-child{border:0;}',
'.capsule-wiki__key{flex:0 0 31%;min-width:0;opacity:.7;font-size:.88em;}',
'.capsule-wiki__val{flex:1;min-width:0;text-align:left;line-height:1.48;}',
'.capsule-wiki__end{margin-top:1.5em;}',
'.capsule-wiki__button svg{width:1.5em;height:1.5em;}',
'.capsule-wiki__button.capsule-wiki--loading{opacity:.64;pointer-events:none;}',
'.modal--capsule-wiki .modal__content{box-sizing:border-box;max-width:min(88vw,1150px)!important;width:min(88vw,1150px);}',
'.modal--capsule-wiki .modal__title{font-size:1.75em;font-weight:600;line-height:1.2;overflow-wrap:anywhere;}',
'.modal--capsule-wiki .modal__head{margin-bottom:1.05em;}',

'.modal--capsule-wiki .modal__footer.capsule-wiki__toolbar{display:flex;flex-wrap:nowrap;align-items:center;justify-content:space-between;gap:1.2em;padding-top:1em;border-top:1px solid rgba(180,180,180,.16);margin-top:.4em;}',
'.modal--capsule-wiki .capsule-wiki__tools{display:flex;align-items:stretch;min-width:0;gap:.35em;padding:.28em;background:rgba(148,148,148,.10);border:1px solid rgba(155,155,155,.13);border-radius:.85em;}',
'.modal--capsule-wiki .capsule-wiki__tools--size{flex:0 0 auto;}',
'.modal--capsule-wiki .capsule-wiki__tools--actions{flex:0 1 auto;gap:.2em;}',
'.modal--capsule-wiki .capsule-wiki__font-value{font-size:1em;font-weight:650;opacity:.84;display:flex;align-items:center;justify-content:center;min-width:3.8em;padding:0 .3em;white-space:nowrap;}',
'.modal--capsule-wiki .modal__button.capsule-wiki__tool{margin:0!important;flex:0 0 auto;display:flex;align-items:center;justify-content:center;gap:.45em;border:0;background:transparent;border-radius:.65em;padding:.65em .95em;min-height:2.65em;min-width:2.65em;font-size:1.05em;line-height:1.1;white-space:nowrap;transition:background-color .14s ease,color .14s ease,box-shadow .14s ease;}',
'.modal--capsule-wiki .capsule-wiki__tool--scale{font-weight:750;font-size:1.2em!important;padding:.5em .8em!important;}',
'.modal--capsule-wiki .capsule-wiki__tool svg{height:1.15em;width:1.15em;flex-shrink:0;}',
'.modal--capsule-wiki .modal__button.capsule-wiki__tool.focus{background:#fff;color:#111;box-shadow:0 0 0 2px rgba(255,255,255,.55);outline:0;}',
'.modal--capsule-wiki .capsule-wiki__tool--exit{font-weight:650;}',
'.modal--capsule-wiki .scroll__body,.modal--capsule-wiki .scroll__content{min-width:0;}',
'.modal--capsule-wiki-tv .modal__content{max-width:min(86vw,1080px)!important;width:min(86vw,1080px);padding:1.45em 1.65em;}',
'.modal--capsule-wiki-tv .modal__footer{gap:.85em;}',
'.modal--capsule-wiki-tv .modal__button{min-height:3.1em;min-width:4.1em;}',

'@media(max-width:700px){.modal--capsule-wiki .modal__content{width:100%!important;max-width:100%!important;padding:1em;}',
'.modal--capsule-wiki .modal__footer.capsule-wiki__toolbar{gap:.65em;flex-wrap:wrap;}',
'.modal--capsule-wiki .capsule-wiki__tools{width:100%;justify-content:center;}',
'.modal--capsule-wiki .capsule-wiki__tools--actions{justify-content:space-around;}',
'.modal--capsule-wiki .capsule-wiki__tools--actions .capsule-wiki__tool{flex:1 1 0;}',
'.capsule-wiki__row{display:block;}.capsule-wiki__key{margin-bottom:.15em;}.capsule-wiki__val{text-align:left;}',
'.capsule-wiki__text{line-height:1.53;}}',
'@media(prefers-reduced-motion:reduce){.modal--capsule-wiki .modal__button{transition:none;}}'
].join('');
$('<style id="capsule-wiki-style"/>').text(stylesheet).appendTo('head');
}
function init(){if(installed)return;if(!window.Lampa||!window.$||!Lampa.Listener||!Lampa.Modal){setTimeout(init,500);return;}
installed=true;css();registerWikiSettings();Lampa.Listener.follow('full',function(e){if(!e)return;if(e.type==='complite')addButton(e);if(e.type==='options')addOption(e);});
if(Lampa.Manifest)Lampa.Manifest.plugins={name:'CAPSULE Wiki',type:'other',version:'1.5.0',description:'Интересные факты и расширенные сведения из Wikipedia'};
console.log('[CAPSULE Wiki] ready');}
if(window.appready||document.readyState!=='loading')init();else document.addEventListener('DOMContentLoaded',init);
setTimeout(init,1300);
})();
