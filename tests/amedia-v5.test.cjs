'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const {test} = require('node:test');
const source = fs.readFileSync(require('node:path').join(__dirname, '..', 'amedia-android.js'), 'utf8');
const from = source.indexOf('function _amediaInit');
const to = source.indexOf('\n\nfunction _0x22107b',from);
assert(from > 0 && to > from, 'Readable Amedia client must be present');
const clientCode = source.slice(from, to);

function bus() {
    const callbacks = {};
    return {
        follow(type,fn) { (callbacks[type] || (callbacks[type] = [])).push(fn); },
        send(type,data) { (callbacks[type] || []).forEach(fn=>fn(data)); },
        remove() {}
    };
}
function tree(seasons) {
    return {seasons:seasons.map((episodes,i)=>({
        number:i+1,
        episodes:episodes.map((translations,j)=>({number:j+1,translations}))
    }))};
}
function voice(id,name,file_id) {return {id,name,file_id:file_id || id+'-file'};}

function harness(platform='android') {
    let selection = null, shown = [], activeMovie = null, time = 1000000;
    const notes=[], played=[], requests=[], selected=[], nativeRequests=[], queueSets=[], timers=new Map();
    const seasonRequests=[], pushes=[], nativeSettings=[], timelineStates={};
    const winEvents = {}, docEvents={};
    let seq=0, controller = '', closedPlayers=0;
    const playerBus=bus(),videoBus=bus(),timelineBus=bus(),appBus=bus(),selectBus=bus(),modalBus=bus();
    const Lampa = {
        Storage: {
            get(name,defaultValue) {return Object.prototype.hasOwnProperty.call(storage,name) ? storage[name] : defaultValue;},
            set(name,value) {storage[name]=value;}
        },
        Platform:{is(name) {return name===platform;}}, 
        Noty:{show(msg) {notes.push(msg);}},
        Loading:{start(){},stop(){}},
        SettingsApi:{addComponent(){},addParam(){}},
        Reguest:function(){this.timeout=()=>{};this.quiet=(url,success,error)=>requests.push({url,success,error});},
        Listener:appBus,
        Activity:{active() {return activeMovie ? {card:activeMovie} : null;},
            push(p){pushes.push(p);return p;}},
        Api:{seasons(movie,from,cb){seasonRequests.push({movie,from,cb});}}, 
        Utils:{
            hash(value){return 'hash:' + String(value);},
            splitEpisodesIntoSeasons(rows) {
                return {1:rows.map((row,i)=>({...row,season_number:1,episode_number:i+1}))};
            },
            createInstance(klass,element) {
                return {
                    data:element, modules:[],
                    use(mod) {this.modules.push(mod);},
                    long() {if(this.html && this.html.fire)this.html.fire('hover:long');}
                };
            }
        },
        Select:{
            listener:selectBus,
            show(opts){selection=opts;shown.push(opts);selectBus.send('preshow',{active:opts});},
            hide(){selection=null;}
        },
        Modal:{listener:modalBus,open(){throw Error('Custom Amedia modal must not be called');}},
        Controller:{toggle(n){controller=n;}},
        PlayerPlaylist:{set(items){if(!played.length)throw new Error('Player.playdata missing');queueSets.push(items);},get(){return queueSets[queueSets.length-1] || [];}}, 
        Timeline:{
            listener:timelineBus,
            link(){return {};},
            view(hash){return Object.assign({hash,time:0,duration:120,percent:0},timelineStates[hash]||{});}
        },
        PlayerVideo:{listener:videoBus},
        Player:{
            listener:playerBus, runas(){}, 
            play(data){played.push(data);},
            playdata(){return played[played.length-1]||false;},
            close(){closedPlayers++;playerBus.send('destroy',{});}
        }
    };
    const storage={};
    const document={
        addEventListener(type,fn){(docEvents[type] || (docEvents[type]=[])).push(fn);},
        getElementById(){return null;},
        createElement(){return {};},
        head:{appendChild(){}}
    };
    const root={
        Lampa,document,AndroidJS:{openPlayer(){},storageChange(raw){nativeSettings.push(JSON.parse(raw));}}, 
        __nativeRequests:nativeRequests,
        addEventListener(type,fn){(winEvents[type] || (winEvents[type]=[])).push(fn);},
        console:{log(){}}
    };
    const FakeDate=class extends Date {static now(){return time;}};
    const script=new vm.Script('var _amediaClient;\n' +
        'function _0x252726(movie,request){window.__nativeRequests.push({movie,request});return Promise.resolve();}\n' +
        clientCode + '\n_amediaInit();_amediaClient;');
    const client=script.runInNewContext({
        window:root,document,Date:FakeDate,
        setTimeout(fn,ms){const id=++seq;timers.set(id,{fn,ms});return id;},
        clearTimeout(id){timers.delete(id);}
    },{timeout:1500});
    function api(value,type='serial') {
        const calls=[];
        return {
            calls,selected,
            lookup(){return Promise.resolve({embed:{fileList:{type},fileActiveId:'movie-file',metaSeed:'begin'},
                guard:{ready:true},hP:'mock'});},
            tree(){return value;},
            getVoice(){return 'original';},
            setVoice(movie,id){selected.push(id);},
            guard(){return Promise.resolve({ready:true});},
            play(options){calls.push(options);return Promise.resolve();}
        };
    }
    return {
        client,Lampa,root,api,notes,played,nativeRequests,queueSets,storage,requests,selected,playerBus,videoBus,timelineBus,appBus,seasonRequests,pushes,nativeSettings,timelineStates,
        get selection(){return selection;},get shown(){return shown;},get controller(){return controller;},get closedPlayers(){return closedPlayers;},
        setMovie(movie){activeMovie=movie;},
        runEpisode(data, fallback) {
            data.params={onEnter:fallback || (()=>{})};
            const item=Lampa.Utils.createInstance(null,data);
            const handlers={};
            item.html={
                on(type,fn){handlers[type]=fn;return this;},
                fire(type){if(handlers[type])handlers[type]();}
            };
            item.modules.forEach(m=>{if(m.onCreate)m.onCreate.call(item);});
            return item;
        },
        event(type){(winEvents[type] || []).forEach(fn=>fn());},
        documentEvent(type){(docEvents[type] || []).forEach(fn=>fn());},
        advance(ms){time+=ms;},
        runTimers(maxMs=1000){
            const run=Array.from(timers.entries()).filter(([,entry])=>entry.ms<=maxMs);
            run.forEach(([id,entry])=>{if(timers.delete(id))entry.fn();});
        }
    };
}
async function flush(){for(let i=0;i<20;i++)await Promise.resolve();}
const movie={id:12,title:'Кино',release_date:'2026-01-01'};
const show={id:23,name:'Сериал',original_name:'Series',first_air_date:'2026-01-01'};
const twoSeasons=tree([
    [[voice('original','Оригинал'),voice('studio','Профессиональный дубляж')],[voice('studio','Профессиональный дубляж')]],
    [[voice('studio','LostFilm')],[voice('studio','LostFilm')]]
]);


function setupHub(h) {
    const nodes=[], constructors={};
    class Dom {
        constructor(markup) {
            this.markup=String(markup||'');
            this.children=[];this.handlers={};this.attributes={};this.label='';
            this.length=1;this[0]=this;
            nodes.push(this);
        }
        text(value){if(value===undefined)return this.label;this.label=String(value);return this;}
        append(child){this.children.push(child);return this;}
        on(name,handler){this.handlers[name]=handler;return this;}
        attr(key,value){if(value===undefined)return this.attributes[key];this.attributes[key]=value;return this;}
        css(name,value){this.styles=this.styles||{};if(typeof name==='object')Object.assign(this.styles,name);else if(name!==undefined&&value!==undefined)this.styles[name]=value;return this;}
        remove(){this.removed=true;return this;}
        first(){return this;}
        find(query) {
            const expected=query.replace(/^\./,'');
            let found;
            function walk(node) {
                for(const child of node.children) {
                    if (!child || typeof child !== 'object') continue;
                    if(child.markup && child.markup.includes(expected) && !found)found=child;
                    walk(child);
                }
            }
            walk(this);
            return found || new Dom('');
        }
        trigger(name){if(this.handlers[name])this.handlers[name]({currentTarget:this});}
    }
    h.root.$=value=>value instanceof Dom?value:new Dom(value);
    h.Lampa.Component={add(name,fn){constructors[name]=fn;}};
    h.Lampa.Scroll=class {
        constructor(){this.dom=new Dom('<scroll>');}
        clear(){this.dom.children=[];}
        append(row){this.dom.append(row);}
        render(){return this.dom;}
        update(){}
        destroy(){}
    };
    h.Lampa.Explorer=class {
        constructor(){this.dom=new Dom('<explorer>');}
        appendFiles(row){this.dom.append(row);}
        render(){return this.dom;}
        destroy(){}
    };
    h.Lampa.Controller.add=(name,opts)=>{h._controller=opts;};
    h.Lampa.Controller.collectionSet=()=>{};
    h.Lampa.Controller.collectionFocus=()=>{};
    h.Lampa.Controller.enabled=()=>({name:h.controller});
    h.nodes=nodes;h.components=constructors;
    h.mount=()=>{
        const ctor=constructors.amedia_hub_v6;
        assert(ctor,'Amedia component must be registered with Lampa');
        const instance=new ctor(h.pushes[h.pushes.length-1]);
        // Exact Lampa ActivitySlide lifecycle: create() first, then start().
        assert.equal(typeof instance.create,'function','Lampa ActivitySlide needs component.create()');
        assert.equal(typeof instance.render,'function');
        const rendered=instance.create();
        assert.equal(rendered,instance.render(),'Activity must receive the rendered root');
        assert(instance.alive);
        instance.start();
        return instance;
    };
    return h;
}
test('Version 5.2 keeps original Amedia transport, not Skaz Online network',()=>{
    assert(source.includes("var version = '5.2.0'"));
    assert(source.includes('function _0x220c04('),'Skaz original playback handler is intact');
    assert(source.includes('function _0x252726('),'Skaz original launcher is intact');
    assert(!source.includes('window.__skazOnlineAuto'));
    assert(!source.includes('online3.skaz.tv'));
});
test('The Lampa-native default hooks are not monkey patched globally',()=>{
    const h=harness();
    const originalCreate=h.Lampa.Utils.createInstance;
    const originalSeasons=h.Lampa.Api.seasons;
    const originalSelect=h.Lampa.Select.show;
    const originalPush=h.Lampa.Activity.push;
    assert.equal(h.Lampa.Utils.createInstance,originalCreate);
    assert.equal(h.Lampa.Api.seasons,originalSeasons);
    assert.equal(h.Lampa.Select.show,originalSelect);
    assert.equal(h.Lampa.Activity.push,originalPush);
    assert.equal(h.Lampa.Utils.createInstance.__amediaNativeHook,undefined);
    assert.equal(h.Lampa.Api.seasons.__amediaRecovery,undefined);
});
test('Lampa ActivitySlide create() builds Amedia UI before start() without an empty page',async()=>{
    const h=setupHub(harness()), a=h.api(twoSeasons);
    await h.client.open(show,a);
    const hub=h.mount();
    assert(hub.alive);
    const explorer=hub.render();
    assert(explorer.children.length>0,'Explorer contains a scroll root after create');
    const allText=h.nodes.map(n=>n.label).filter(Boolean);
    assert(allText.some(x=>x.includes('Сезон 1')),'Real Amedia content is rendered');
    assert(allText.some(x=>x.includes('Продолжить')),'Continue button is rendered');
    hub.destroy();
});
test('Native Lampa episode pages are never hijacked by Amedia',()=>{
    const h=harness();
    const nativeEnter=()=>{};
    const episode={data:{episode_number:1,season_number:1,params:{onEnter:nativeEnter}}};
    h.appBus.send('full',{type:'build',name:'episodes',item:{items:[episode]}});
    assert.equal(episode.data.params.onEnter,nativeEnter);
    assert.equal(episode.__amediaNativeEpisode,undefined);
});
test('Films continue directly into Skaz Amedia player',async()=>{
    const h=harness(),a=h.api(null,'movie');
    await h.client.open(movie,a);
    assert.equal(a.calls.length,1);
    assert.equal(a.calls[0].fileId,'movie-file');
    assert.equal(h.pushes.length,0);
});
test('Exact episode uses ranked voice and plans the next two playable episodes',async()=>{
    const h=harness(),a=h.api(twoSeasons);
    await h.client.open(show,a,{season:1,episode:1});
    assert.equal(a.calls.length,1);
    assert.equal(a.calls[0].fileId,'studio-file');
    assert.equal(a.calls[0].season,1);
    assert.equal(a.calls[0].episode,1);
    assert.deepEqual(Array.from(a.calls[0].queuePlan.map(x=>x.episode)),[2,1]);
    assert.equal(a.calls[0].queuePlan.length,2);
    assert(a.calls[0].queuePlan.every(x=>x.fileId),'Every queued episode has a file ID');
});
test('Missing requested episode never silently plays a different one',async()=>{
    const h=harness(),a=h.api(twoSeasons);
    await h.client.open(show,a,{season:99,episode:12});
    assert.equal(a.calls.length,0);
    assert(h.notes.join(' ').includes('нет'));
});
test('Amedia series opens dedicated bespoke hub using Lampa Activity/Explorer/Scroll',async()=>{
    const h=setupHub(harness()),a=h.api(twoSeasons);
    await h.client.open(show,a);
    assert.equal(a.calls.length,0,'Opening a hub must not autoplay');
    assert.equal(h.pushes.length,1);
    assert.equal(h.pushes[0].component,'amedia_hub_v6');
    const instance=h.mount();
    assert(instance.alive);
    const texts=h.nodes.map(node=>node.label).filter(Boolean);
    assert(texts.includes('Сезон 1'));
    assert(texts.includes('Сезон 2'));
    assert(texts.some(s=>s.includes('Продолжить')));
    assert(texts.some(s=>s.includes('Смотреть с начала')));
    assert(texts.some(s=>s.includes('Озвучка и качество')));
    instance.destroy();
});
test('Hub episode click sends exact episode and ranked voice to Amedia',async()=>{
    const h=setupHub(harness()),a=h.api(twoSeasons);
    await h.client.open(show,a);
    h.mount();
    const rows=h.nodes.filter(n=>n.markup.includes('class="selector amedia-hub__episode'));
    assert.equal(rows.length,2,'Initial season should have two available episodes');
    rows[1].trigger('hover:enter');
    await flush();
    assert.equal(a.calls.length,1);
    assert.equal(a.calls[0].season,1);
    assert.equal(a.calls[0].episode,2);
    assert.equal(a.calls[0].fileId,'studio-file');
});
test('Season selector presents season 1 first, then season 2 (no inverted order)',async()=>{
    const h=setupHub(harness()),a=h.api(twoSeasons);
    const unsorted={seasons:[twoSeasons.seasons[1],twoSeasons.seasons[0]]};
    await h.client.open(show,h.api(unsorted));
    h.mount();
    const labels=h.nodes.filter(n=>n.markup.includes('amedia-hub__pill') && /^Сезон /.test(n.label)).map(n=>n.label);
    assert.deepEqual(labels.slice(0,2),['Сезон 1','Сезон 2']);
});
test('Continue action starts a queue-enabled Amedia playback, not a native episode request',async()=>{
    const h=setupHub(harness()),a=h.api(twoSeasons);
    await h.client.open(show,a);
    h.mount();
    const continueButton=h.nodes.find(n=>n.label.startsWith('▶ Продолжить'));
    assert(continueButton);
    continueButton.trigger('hover:enter');
    await flush();
    assert.equal(h.nativeRequests.length,0);
    assert.equal(a.calls.length,1);
    assert.equal(a.calls[0].queuePlan.length,2);
    assert.equal(a.calls[0].queuePlan[0].episode,2);
});
test('Long press opens native Amedia settings panel without Lampa Select',async()=>{
    const h=setupHub(harness()),a=h.api(twoSeasons);
    await h.client.open(show,a);h.mount();
    const row=h.nodes.find(n=>n.markup.includes('class="selector amedia-hub__episode'));
    assert(row);
    row.trigger('hover:long');
    assert.equal(h.selection,null);
    assert(h.nodes.some(n=>n.label==='Настройки просмотра'));
    assert(h.nodes.some(n=>n.label==='Озвучка'));
    assert(h.nodes.some(n=>n.label==='Качество'));
    assert(h.nodes.some(n=>n.label==='Очередь Android'));
});
test('Android bridge preserves a real multi-episode playlist and enables native auto-next',()=>{
    const h=harness(),job=h.client.begin({});
    const data={url:'https://video.test/current.m3u8',title:'Ep 2',
        quality:{'720p':'https://video.test/current.m3u8'},
        playlist:[{url:'https://video.test/current.m3u8'},{url:'https://video.test/next.m3u8'}]};
    const options={movie:show,season:1,episode:2};
    h.client.prepare(job,data,options);
    assert.equal(data.playlist.length,2);
    h.client.launch(job,data);
    assert.equal(h.played.length,1);
    assert.equal(h.played[0].playlist.length,2);
    assert(h.nativeSettings.some(x=>x.name==='playlist_next'&&x.value==='true'));
    assert.notEqual(h.storage.playlist_next,false);
    assert.equal(job.queueResult.size,2);
    assert.equal(h.queueSets.length,0);
});
test('Queue resolver turns Skaz file IDs into playable URLs in strict order',async()=>{
    const h=harness(),job=h.client.begin({});
    const data={url:'https://cdn.test/ep1.m3u8',title:'Episode 1',
        season:1,episode:1,headers:{Referer:'https://skaz.tv'}};
    h.client.prepare(job,data,{movie:show,season:1,episode:1});
    const embed={metaSeed:'seed-start',embedUrl:'https://skaz.tv/embedded'};
    const options={movie:show,embed,hP:'guard',queuePlan:[
        {offset:1,season:1,episode:2,title:'Episode 2',fileId:'ep2'},
        {offset:2,season:2,episode:1,title:'Episode 3',fileId:'ep3'}
    ]};
    const calls=[];
    await h.client.makeQueue(job,options,data,function(request){
        calls.push(request);
        const name=request.fileActiveId;
        return {data:{hlsSource:[{qualities:{'720p':'https://cdn.test/'+name+'.m3u8'}}]},
            nextSeed:'seed-'+name};
    },track=>track.qualities);
    assert.deepEqual(calls.map(x=>x.fileActiveId),['ep2','ep3']);
    assert.equal(calls[1].metaSeed,'seed-ep2','Every stream must use refreshed Skaz metaSeed');
    assert.deepEqual(Array.from(data.playlist,x=>x.url),[
        'https://cdn.test/ep1.m3u8','https://cdn.test/ep2.m3u8','https://cdn.test/ep3.m3u8'
    ]);
    assert.deepEqual(Array.from(data.playlist,x=>x.episode),[1,2,1]);
    assert(data.playlist.every(x=>x.url.startsWith('https://')));
});
test('Android completion does not double-advance once native playlist reported second item',()=>{
    const h=harness();
    const ctx={movie:show,tree:twoSeasons,season:twoSeasons.seasons[0],
        episode:twoSeasons.seasons[0].episodes[0]};
    const job=h.client.begin({ctx});
    const data={url:'https://cdn.test/ep1.m3u8',timeline:{hash:'hash-t',time:0,duration:120,percent:0},
        playlist:[{url:'https://cdn.test/ep1.m3u8',timeline:{hash:'hash-t'}},
            {url:'https://cdn.test/ep2.m3u8',timeline:{hash:'hash-next'}}]};
    h.client.launch(job,data);h.playerBus.send('external',data);
    h.advance(15000);h.event('focus');
    h.timelineBus.send('update',{data:{hash:'hash-next',road:{time:15,duration:100,percent:15}}});
    h.timelineBus.send('update',{data:{hash:'hash-t',road:{time:0,duration:0,percent:100}}});
    h.runTimers(3000);
    assert.equal(h.nativeRequests.length,0,'The external player really started episode 2');
});
test('Android ignores playlist: fresh continuation is still available on return',()=>{
    const h=harness();
    const ctx={movie:show,tree:twoSeasons,season:twoSeasons.seasons[0],
        episode:twoSeasons.seasons[0].episodes[0]};
    const job=h.client.begin({ctx});
    const data={url:'https://cdn.test/ep1.m3u8',timeline:{hash:'hash-t',time:0,duration:120,percent:0},
        playlist:[{url:'https://cdn.test/ep1.m3u8',timeline:{hash:'hash-t'}},
            {url:'https://cdn.test/ep2.m3u8',timeline:{hash:'hash-next'}}]};
    h.client.launch(job,data);h.playerBus.send('external',data);
    h.advance(15000);h.event('focus');
    h.timelineBus.send('update',{data:{hash:'hash-t',road:{time:0,duration:0,percent:100}}});
    h.runTimers(3000);
    assert.equal(h.nativeRequests.length,1,'A player ignoring its playlist must not block fallback');
    assert.equal(h.nativeRequests[0].request.episode,2);
});
test('Disabling auto-next stops Android return-based advance',()=>{
    const h=harness();
    h.storage.amedia_v4_autoNext=false;
    const ctx={movie:show,tree:twoSeasons,season:twoSeasons.seasons[0],
        episode:twoSeasons.seasons[0].episodes[0]};
    const job=h.client.begin({ctx});
    const data={url:'https://cdn.test/ep1.m3u8',timeline:{hash:'test-hash',time:0,duration:30,percent:0}};
    h.client.launch(job,data);
    h.playerBus.send('external',data);
    h.advance(15000);
    h.event('focus');
    h.timelineBus.send('update',{data:{hash:'test-hash',road:{time:0,duration:0,percent:100}}});
    h.runTimers(1000);
    assert.equal(h.nativeRequests.length,0);
});
test('Android auto-next runs only when completion is confirmed',()=>{
    const h=harness();
    const ctx={movie:show,tree:twoSeasons,season:twoSeasons.seasons[0],
        episode:twoSeasons.seasons[0].episodes[0]};
    const job=h.client.begin({ctx});
    const data={url:'https://cdn.test/ep1.m3u8',timeline:{hash:'test-hash',time:0,duration:30,percent:0}};
    h.client.launch(job,data);h.playerBus.send('external',data);
    h.advance(15000);h.event('focus');
    h.runTimers(3000);
    assert.equal(h.nativeRequests.length,0);
    h.timelineBus.send('update',{data:{hash:'test-hash',road:{time:0,duration:0,percent:100}}});
    h.runTimers(3000);
    assert.equal(h.nativeRequests.length,1);
    assert.equal(h.nativeRequests[0].request.episode,2);
});
test('Subsequent titles do not leak a previously selected voice',async()=>{
    const h=harness(),a=h.api(twoSeasons);
    await h.client.open(show,a,{season:1,episode:1,manual:true});
    assert(h.selection);
    h.selection.onSelect({action:'voice'});
    const studio=h.selection.items.find(x=>x.value==='studio');
    h.selection.onSelect(studio);
    h.selection.onSelect({action:'play'});
    await flush();
    assert.equal(a.calls.length,1);
    assert.equal(a.calls[0].fileId,'studio-file');
});
test('Configured settings show version and a fresh-request auto-next switch',()=>{
    assert(source.includes("name:'Версия плагина: ' + version"));
    assert(source.includes("type:'static'"));
    assert(source.includes("['autoNext', 'Автопродолжение при одиночном видео'"));
    assert(source.includes("['queueDepth', 'Очередь серий'"));
});
test('Hub refreshes metadata without trusting an unrelated series',async()=>{
    const h=setupHub(harness()),a=h.api(twoSeasons);
    const card={...show,imdb_id:'tt1234567',img:'https://cover.test/original.webp'};
    await h.client.open(card,a);h.mount();
    const q=h.requests.find(x=>x.url.includes('cinemeta.strem.io'));
    assert(q,'Verified external catalog can be used for fallback metadata');
    q.success({meta:{id:'tt1234567',videos:[{id:'tt1234567:1:1',
        title:'Pilot',thumbnail:'https://cover.test/pilot.webp'}]}});
    assert(h.nodes.some(n=>n.label==='Pilot'));
});


test('Localized Lampa season metadata overrides English Skaz titles and fills episode still',async()=>{
    const h=setupHub(harness()), a=h.api(tree([
        [[voice('studio','Дубляж')],[voice('studio','Дубляж')]]
    ]));
    h.Lampa.Api.img=(path,size)=>'https://image.tmdb.test/'+size+path;
    const card={...show,id:103,backdrop_path:'/back.jpg'};
    a.tree().x=0;
    const epTree=tree([[[voice('studio','Дубляж')],[voice('studio','Дубляж')]]]);
    epTree.seasons[0].episodes[0].name='Stick or Twist';
    await h.client.open(card,h.api(epTree));
    h.mount();
    assert(h.nodes.some(n=>n.label==='Stick or Twist'));
    const request=h.seasonRequests.find(x=>x.from[0]===1);
    assert(request,'Episode metadata must be requested via Lampa.Api.seasons');
    request.cb({1:{episodes:[{season_number:1,episode_number:1,name:'Русское название серии',
        still_path:'/ep-one.jpg'}]}});
    assert(h.nodes.some(n=>n.label==='Русское название серии'));
    assert(h.nodes.some(n=>n.attributes.src==='https://image.tmdb.test/w500/ep-one.jpg'));
});
test('Mobile swipe over episode does not launch playback; finger tap does',async()=>{
    const h=setupHub(harness()),a=h.api(twoSeasons);
    h.Lampa.Platform.screen=(type)=>type==='mobile';
    await h.client.open(show,a);h.mount();
    const rows=h.nodes.filter(n=>n.markup.includes('class="selector amedia-hub__episode'));
    assert(rows.length>=2);
    const scrollNode=h.nodes.find(n=>n.markup==='<scroll>');
    assert.equal(scrollNode.styles['overflow-y'],'auto');
    assert.equal(scrollNode.styles['touch-action'],'pan-y');
    const swipe=rows[0];
    swipe.handlers.touchstart({touches:[{clientX:42,clientY:350}]});
    swipe.handlers.touchmove({touches:[{clientX:44,clientY:175}]});
    swipe.handlers.touchend({});
    swipe.trigger('click');
    await flush();
    assert.equal(a.calls.length,0,'Swiping cannot accidentally start video');
    const tap=rows[1];
    tap.handlers.touchstart({touches:[{clientX:42,clientY:330}]});
    tap.handlers.touchend({});
    tap.trigger('click');
    await flush();
    assert.equal(a.calls.length,1,'Touch tap must work without hover:enter');
    assert.equal(a.calls[0].episode,2);
});
test('Missing episode still uses visible fallback artwork rather than blank gray tile',async()=>{
    const h=setupHub(harness()),a=h.api(twoSeasons);
    h.Lampa.Api.img=(path,size)=>'https://image.tmdb.test/'+size+path;
    await h.client.open({...show,backdrop_path:'/backdrop.jpg'},a);h.mount();
    assert(h.nodes.some(n=>n.markup.includes('amedia-hub__thumb--fallback')));
    assert(h.nodes.some(n=>n.attributes.src==='https://image.tmdb.test/w780/backdrop.jpg'));
});
test('Amedia button is present for TV series as well as movies',()=>{
    const start=source.indexOf('function _0x220c04(params)');
    const end=source.indexOf('function _0x108f48()',start);
    assert(start>0 && end>start);
    const button=source.slice(start,end);
    assert(!button.includes('if (_amediaClient.isSeries(movie)) return;'),
        'Amedia must not disappear from TV series cards');
    assert(button.includes("toolbar.find('.button, .selector').first()"),
        'TV series screen may have no Play button');
    assert(button.includes('else toolbar.append(button)'),
        'The Amedia entry must work when there is no Watch button');
    assert(button.includes("_0x252726(movie, {manual:false})"));
});
