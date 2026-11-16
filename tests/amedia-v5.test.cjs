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
        __bridgeCalls:[],
        __nativeRequests:nativeRequests,
        addEventListener(type,fn){(winEvents[type] || (winEvents[type]=[])).push(fn);},
        console:{log(){}}
    };
    const FakeDate=class extends Date {static now(){return time;}};
    const script=new vm.Script('var _amediaClient;\n' +
        'function _0x252726(movie,request){window.__nativeRequests.push({movie,request});return Promise.resolve();}\n' +
        'function _0x1d7a2f(headers){window.__bridgeCalls.push({event:"xhr_on",headers});return function(){window.__bridgeCalls.push({event:"xhr_off"});};}\n' +
        'function _0x2e2363(headers){window.__bridgeCalls.push({event:"hls_on",headers});return function(){window.__bridgeCalls.push({event:"hls_off"});};}\n' +
        'function _0x1cb92a(options){window.__bridgeCalls.push({event:"ws_on",options});return {close:function(){window.__bridgeCalls.push({event:"ws_off"});}};}\n' +
        'function _0x302e2a(guard,hash){window.__bridgeCalls.push({event:"guard_sync",guard,hash});}\n' +
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
test('Version 5.7.0 keeps original Amedia transport, not Skaz Online network',()=>{
    assert(source.includes("var version = '5.7.0'"));
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
test('Android prepares the selected episode without blocking on signed future episodes',async()=>{
    const h=harness(),a=h.api(twoSeasons);
    await h.client.open(show,a,{season:1,episode:1});
    assert.equal(a.calls.length,1);
    assert.equal(a.calls[0].fileId,'studio-file');
    assert.equal(a.calls[0].season,1);
    assert.equal(a.calls[0].episode,1);
    assert.equal(a.calls[0].queuePlan.length,0,'External Android playlist must not contain stale signed neighbors');
    const transport=source.slice(source.indexOf('function _0x36d549('),source.indexOf('function _0x36d549(')+16000);
    assert(!transport.includes('_amediaClient.makeQueue(_amediaJob'),'Eager signed neighbor lookup must not block the selected episode');
    assert(transport.includes("if (_amediaJob.mode === 'android')"),'External playback has a direct fast launch');
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
    assert(!texts.some(s=>s.includes('С первой серии')),'Episode one must not have redundant duplicate play buttons');
    assert(texts.some(s=>s.includes('Настройки просмотра')));
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
    const continueButton=h.nodes.find(n=>n.label.startsWith('Продолжить'));
    assert(continueButton);
    continueButton.trigger('hover:enter');
    await flush();
    assert.equal(h.nativeRequests.length,0);
    assert.equal(a.calls.length,1);
    assert.equal(a.calls[0].queuePlan.length,0,'Android opens current episode directly');
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
    assert(!h.nodes.some(n=>n.label==='Список серий'),'Queue settings are not exposed to ordinary users');
});


test('Lampa builds a complete ordered queue across all seasons without prefetching 3-episode window',async()=>{
    const h=harness('ios');
    const episodes=tree([
        Array.from({length:5},(_,i)=>[voice('dub','Дубляж','s1e'+(i+1))]),
        Array.from({length:6},(_,i)=>[voice('dub','Дубляж','s2e'+(i+1))]),
        Array.from({length:4},(_,i)=>[voice('dub','Дубляж','s3e'+(i+1))])
    ]);
    const api=h.api(episodes);
    await h.client.open(show,api,{season:1,episode:2});
    assert.equal(api.calls.length,1);
    const options=api.calls[0];
    const plan=options.queuePlan;
    assert.equal(plan.length,14);
    assert.deepEqual(Array.from(plan.slice(0,5),x=>[x.season,x.episode,x.offset]),
        [[1,1,-1],[1,3,1],[1,4,2],[1,5,3],[2,1,4]]);
    assert.deepEqual(Array.from(plan.slice(-4),x=>[x.season,x.episode,x.offset]),
        [[3,1,10],[3,2,11],[3,3,12],[3,4,13]]);
    assert(!plan.some(x=>x.offset===0));
    const playback=harness('ios');
    const job=playback.client.begin({}),data={url:'https://cdn.test/s1e2.m3u8',
        season:1,episode:2,title:'Series S1E2'};
    // client.begin replaced previous not-launched job created by start(options);
    // Simulate the actual stream data before PlayerPlaylist creation.
    playback.client.launch(job,data);
    let calls=0;
    const list=playback.client.prepareLazyInnerQueue(job,options,data,()=>{calls++;return {};},
        track=>track.qualities);
    assert.equal(list.length,15);
    assert.deepEqual(Array.from(list,x=>[x.season,x.episode]),
        [[1,1],[1,2],[1,3],[1,4],[1,5],
         [2,1],[2,2],[2,3],[2,4],[2,5],[2,6],
         [3,1],[3,2],[3,3],[3,4]]);
    assert(list.every(x=>typeof x.url==='function'));
    assert.equal(calls,0,'A full serial must not require any eager stream lookup');
    assert.equal(playback.storage.amedia_v4_lastQueueSummary.size,15);
    assert.equal(playback.storage.amedia_v4_lastQueueSummary.lazy,true);
});
test('Lampa last episode of a season is followed by first episode of next season',async()=>{
    const h=harness('ios'),episodes=tree([
        Array.from({length:4},(_,i)=>[voice('dub','Dub','s1'+i)]),
        Array.from({length:5},(_,i)=>[voice('dub','Dub','s2'+i)])
    ]),api=h.api(episodes);
    await h.client.open(show,api,{season:1,episode:4});
    const opts=api.calls[0];
    assert.deepEqual(Array.from(opts.queuePlan.slice(3,5),x=>[x.season,x.episode]),
        [[2,1],[2,2]]);
    const playback=harness('ios');
    const job=playback.client.begin({});
    const data={url:'https://cdn.test/last-s1.m3u8',season:1,episode:4,title:'Last s1'};
    playback.client.launch(job,data);
    const list=playback.client.prepareLazyInnerQueue(job,opts,data,
        req=>({data:{hlsSource:[{qualities:{'720p':
            'https://cdn.test/'+req.fileActiveId+'.m3u8'}}]}}),
        track=>track.qualities);
    assert.equal(list.length,9);
    assert.deepEqual(Array.from(list.slice(3,5),x=>[x.season,x.episode]),
        [[1,4],[2,1]]);
    let next=0;
    list[4].url(()=>{next++;});
    await flush();
    assert.equal(next,1);
    assert.equal(list[4].season,2);
    assert.equal(list[4].episode,1);
    assert.equal(list[4].url,'https://cdn.test/s20.m3u8');
});
test('Android ignores legacy queue preference and avoids sending signed neighbors',async()=>{
    const h=harness('android'),episodes=tree([
        Array.from({length:6},(_,i)=>[voice('dub','Dub','s1'+i)]),
        Array.from({length:6},(_,i)=>[voice('dub','Dub','s2'+i)])
    ]),api=h.api(episodes);
    await h.client.open(show,api,{season:1,episode:4});
    assert.equal(api.calls[0].queuePlan.length,0);
    const around=harness('android'),a=around.api(episodes);
    around.storage.amedia_v4_queueDepth='surrounding';
    await around.client.open(show,a,{season:1,episode:4});
    assert.equal(a.calls[0].queuePlan.length,0);
});
test('Returning to a watched Lampa queue item refreshes its URL again, not an expired signed link',async()=>{
    const h=harness('ios'),job=h.client.begin({});
    const original={url:'https://cdn.test/ep1.m3u8',season:1,episode:1,title:'One'};
    h.client.launch(job,original);
    const treeAll=tree([[
        [voice('dub','Dub','first')],
        [voice('dub','Dub','second')],
        [voice('dub','Dub','third')]
    ]]);
    let sessions=0,resolves=0;
    const queue=h.client.prepareLazyInnerQueue(job,{
        movie:show,voiceId:'dub',queuePlan:[
            {offset:1,season:1,episode:2,voiceId:'dub',title:'Two'},
            {offset:2,season:1,episode:3,voiceId:'dub',title:'Three'}
        ],
        queueTree(){return treeAll;},
        queueLookup(){sessions++;return Promise.resolve({
            embed:{metaSeed:'session-'+sessions,embedUrl:'https://skaz.tv',fileList:{type:'serial'}},
            hP:'proof-'+sessions,guard:'guard-'+sessions
        });}
    },original,params=>{
        resolves++;return {data:{hlsSource:[{qualities:{
            '720p':'https://cdn.test/'+params.fileActiveId+'?v='+resolves}}]}};
    },track=>track.qualities);
    assert.equal(queue.length,3);
    let first=0;queue[1].url(()=>{first++;});
    await flush();
    assert.equal(first,1);
    assert.equal(queue[1].url,'https://cdn.test/second?v=1');
    h.Lampa.Player.play(queue[1]);
    h.playerBus.send('start',queue[1]);
    let next=0;queue[2].url(()=>{next++;});
    await flush();
    assert.equal(next,1);
    h.Lampa.Player.play(queue[2]);
    h.playerBus.send('start',queue[2]);
    assert.equal(typeof queue[1].url,'function',
        'An episode should become lazy again only AFTER another episode starts');
    let revisited=0;queue[1].url(()=>{revisited++;});
    await flush();
    assert.equal(revisited,1);
    assert.equal(sessions,3);
    assert.equal(resolves,3);
    assert.equal(queue[1].url,'https://cdn.test/second?v=3');
    assert.equal(queue[1].episode,2,'Repeated playback must stay on the same episode');
});

test('Old queue off setting no longer destroys the whole embedded Lampa series queue',async()=>{
    const h=harness('ios'),api=h.api(twoSeasons);
    h.storage.amedia_v4_queueDepth='off';
    await h.client.open(show,api,{season:1,episode:1});
    assert.equal(api.calls.length,1);
    assert.equal(api.calls[0].queuePlan.length,3);
});
test('Large serial creates lightweight queue entries, with no network requests before selection',async()=>{
    const h=harness('ios'),episodes=tree([
        Array.from({length:45},(_,i)=>[voice('dub','Dub','a'+i)]),
        Array.from({length:45},(_,i)=>[voice('dub','Dub','b'+i)]),
        Array.from({length:45},(_,i)=>[voice('dub','Dub','c'+i)])
    ]);
    const api=h.api(episodes);
    await h.client.open(show,api,{season:2,episode:20});
    const opts=api.calls[0];
    assert.equal(opts.queuePlan.length,134);
    const playback=harness('ios');
    const job=playback.client.begin({}),data={url:'https://cdn.test/middle.m3u8',season:2,episode:20};
    playback.client.launch(job,data);
    const list=playback.client.prepareLazyInnerQueue(job,opts,data,()=>{throw Error('eager network call');},track=>track.qualities);
    assert.equal(list.length,135);
    assert.equal(playback.requests.length,0);
    assert.equal(list[0].season,1);
    assert.equal(list[134].season,3);
});

test('Inner Lampa queue uses URL functions and NEVER requests neighboring manifests until selected',async()=>{
    const h=harness('ios'),job=h.client.begin({});
    const original={url:'https://cdn.test/first.m3u8',title:'Episode 1',
        season:1,episode:1,headers:{Referer:'https://skaz.tv/old',
        'Accepts-Controls':'old-proof',Authorizations:'Bearer old-guard'}};
    h.client.prepare(job,original,{movie:show,season:1,episode:1});
    let lookups=0,signCalls=0,ready=0;
    const sources=tree([[ 
        [voice('studio','Дубляж','first')],
        [voice('studio','Дубляж','fresh-second')],
        [voice('studio','Дубляж','fresh-third')]
    ]]);
    const options={movie:show,voiceId:'studio',guard:'old-guard',queuePlan:[
        {offset:1,season:1,episode:2,title:'Second',voiceId:'studio'},
        {offset:2,season:1,episode:3,title:'Third',voiceId:'studio'}
    ],queueLookup(){lookups++;return Promise.resolve({embed:{
        fileList:{type:'serial'},metaSeed:'latest-'+lookups,
        embedUrl:'https://skaz.tv/new'},hP:'fresh-proof',guard:'new-guard'});
    },queueTree(){return sources;}};
    h.client.launch(job,original);
    const list=h.client.prepareLazyInnerQueue(job,options,original,
        request=>{signCalls++;return {data:{pnr:'wss://skaz.tv/ws',pnk:'new-stream',
            hlsSource:[{id:'1',qualities:{
                '720p':'https://newcdn.test/episode-'+request.fileActiveId+'.m3u8'}}]}};},
        track=>track.qualities);
    assert.equal(lookups,0,'Do not request ephemeral URLs at playlist creation');
    assert.equal(signCalls,0);
    assert.equal(list.length,3);
    assert.equal(typeof list[1].url,'function');
    assert.equal(typeof list[2].url,'function');
    assert.equal(typeof list[0].url,'function','Current item also refreshes on revisit');
    h.client.publishInnerQueue(job,original);
    assert.equal(h.queueSets.length,1);
    assert.equal(h.storage.amedia_v4_lastQueueSummary.lazy,true);
    assert.equal(h.storage.amedia_v4_lastQueueSummary.resolved,0);
    const previous=h.Lampa.Player.playdata();
    list[1].url(()=>{ready++;});
    await flush();
    assert.equal(lookups,1);
    assert.equal(signCalls,1);
    assert.equal(ready,1,'Lampa receives its callback after fresh authorization');
    assert.equal(list[1].episode,2,'The signed stream must be the requested episode');
    assert.equal(list[1].url,'https://newcdn.test/episode-fresh-second.m3u8');
    assert.equal(list[1].headers.Referer,'https://skaz.tv/new');
    assert.equal(list[1].headers['Accepts-Controls'],'fresh-proof');
    assert.equal(list[1].headers.Authorizations,'Bearer new-guard',
        'Fresh signed session must not keep an outdated authorization header');
    assert.equal(list[1].__amediaStreamBackend.pnr,'wss://skaz.tv/ws');
    assert.equal(list[1].__amediaQueueItem,true);
    assert.equal(typeof list[1].error,'function','The next episode gets its own HLS recovery');
    assert.equal(typeof list[2].url,'function','Episode 3 remains unresolved');
    assert.equal(h.Lampa.Player.playdata(),previous);
});
test('Queued episode bridge rebuilds CDN host list at Lampa Player.start and resets on destroy',async()=>{
    const h=harness('ios'),job=h.client.begin({});
    h.storage.playlist_next=true;
    const item={url:'https://freshcdn.test/ep2.m3u8',
        season:1,episode:2,headers:{'Accepts-Controls':'current-proof'},
        hls_headers:{'Accepts-Controls':'current-proof'},__amediaManaged:true,
        __amediaQueueItem:true};
    h.client.launch(job,item);
    item.__amediaStreamBackend={pnr:'wss://skaz.tv/',pnk:'pnk',
        trackId:'1',resolution:'720p'};
    h.playerBus.send('start',item);
    assert.deepEqual(Array.from(h.root.__amediaCdnHosts),['freshcdn.test']);
    assert.deepEqual(h.root.__bridgeCalls.filter(x=>x.event.endsWith('_on')).map(x=>x.event),
        ['xhr_on','hls_on','ws_on']);
    assert.equal(h.root.__bridgeCalls[0].headers,item.hls_headers);
    assert.equal(h.root.__amediaCdnActiveIdx,0);
    assert.equal(h.storage.playlist_next,false);
    h.playerBus.send('destroy',{});
    assert.equal(h.storage.playlist_next,false,'Restoration waits for destroyed session');
    assert.deepEqual(h.root.__bridgeCalls.filter(x=>x.event.endsWith('_off')).map(x=>x.event),
        ['ws_off','hls_off','xhr_off']);
    h.client.stopQueuedBridge();
    assert.equal(h.root.__amediaCdnHosts[0],'freshcdn.test');
});
test('A successful queue item recovery retains fresh auth and reports failure phase without token leakage',async()=>{
    const h=harness('ios'),job=h.client.begin({});
    const data={url:'https://badcdn.test/ep2.m3u8',season:1,episode:2,
        __amediaManaged:true,__amediaQueueItem:true,
        headers:{'Accepts-Controls':'stale'},hls_headers:{'Accepts-Controls':'stale'}};
    h.client.prepare(job,data,{movie:show,season:1,episode:2});
    h.client.recoverStream(job,{movie:show,voiceId:'studio',
        queueLookup(){return Promise.resolve({embed:{metaSeed:'fresh-token',
            embedUrl:'https://skaz.tv/stream',fileList:{type:'serial'}},hP:'new-hP',
            guard:'new-guard'});},
        queueTree(){return tree([[
            [voice('studio','Dub','file1')],[voice('studio','Dub','file2')]
        ]]);}
    },data,()=>({data:{pnr:'wss://skaz.tv',pnk:'stream',
        hlsSource:[{qualities:{'720p':'https://goodcdn.test/ep2.m3u8'}}]}}),
    source=>source.qualities);
    h.client.launch(job,data);
    data.error(data,()=>{});
    await flush();
    const state=h.storage.amedia_v4_lastHlsRecovery;
    assert(state);
    assert.equal(state.episode,2);
    assert.equal(state.phase,'recovery_sent');
    assert.equal(state.attempt,1);
    assert(!JSON.stringify(state).includes('fresh-token'));
    assert(!JSON.stringify(state).includes('new-hP'));
    assert.equal(data.__amediaStreamBackend.pnk,'stream');
});
test('A failed CDN must not be preferred to a lower quality on a different host',()=>{
    const h=harness('ios');
    h.storage.amedia_v4_failedHosts={'badcdn.test':{at:1000000,count:1}};
    const chosen=h.client.chooseAdaptiveSource({
        '1080p':'https://badcdn.test/ep.m3u8',
        '720p':'https://goodcdn.test/ep.m3u8',
        '480p':'https://goodcdn.test/ep-low.m3u8'
    },'auto');
    assert.equal(chosen.url,'https://goodcdn.test/ep.m3u8');
});
test('Failed fresh episode lookup does not silently play a different episode',async()=>{
    const h=harness('ios'),job=h.client.begin({});
    const data={url:'https://cdn.test/first.m3u8',title:'Ep 1',season:1,episode:1};
    h.client.prepare(job,data,{movie:show,season:1,episode:1});
    let lookups=0,attempts=0,closed=0;
    h.Lampa.Player.close=()=>{closed++;};
    const queue=h.client.prepareLazyInnerQueue(job,{movie:show,queuePlan:[
        {offset:1,season:1,episode:2,title:'Episode 2',voiceId:'studio'}
    ],queueLookup(){lookups++;return Promise.resolve({embed:{
        fileList:{type:'serial'},metaSeed:'new',embedUrl:'https://skaz.tv'},
        hP:'proof',guard:{ready:true}});},
    queueTree(){return tree([[[voice('studio','Dub','first')]]]);}
    },data,()=>{attempts++;},t=>t.qualities);
    h.client.launch(job,data);
    let launched=0;queue[1].url(()=>{launched++;});
    await flush();
    assert.equal(lookups,2);
    assert.equal(attempts,0,'No signed request for the wrong episode');
    assert.equal(launched,0);
    assert.equal(closed,1,'Release Lampa loading lock if exact series unavailable');
    assert(h.notes.some(msg=>msg.includes('серии не удалось обновить')));
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


test('Expired original Skaz Borth is recovered with a fresh embed for EACH adjacent episode',async()=>{
    const h=harness(),job=h.client.begin({});
    const data={url:'https://cdn.test/s1e1.m3u8',title:'Pilot',
        season:1,episode:1,headers:{Referer:'https://skaz.tv/old'}};
    h.client.prepare(job,data,{movie:show,season:1,episode:1});
    const freshTree=tree([[
        [voice('dub','Дубляж','new-file-one')],
        [voice('dub','Дубляж','new-file-two')],
        [voice('dub','Дубляж','new-file-three')]
    ]]);
    const requests=[],lookups=[];
    const options={movie:show,embed:{metaSeed:'stale',embedUrl:'https://skaz.tv/old'},
        hP:'old-proof',queuePlan:[
            {offset:1,season:1,episode:2,fileId:'expired-ep2',voiceId:'dub',title:'Second'},
            {offset:2,season:1,episode:3,fileId:'expired-ep3',voiceId:'dub',title:'Third'}
        ],
        queueLookup(){const index=++lookups.length;
            return Promise.resolve({embed:{metaSeed:'fresh'+index,
                embedUrl:'https://skaz.tv/new'+index,fileList:{type:'serial'}},hP:'proof'+index});
        },
        queueTree(){return freshTree;}
    };
    // Original embed fails after primary playback. Fresh lookup has new IDs,
    // new proof and a fresh one-time seed.
    await h.client.makeQueue(job,options,data,function(req){
        requests.push({seed:req.metaSeed,fileId:req.fileActiveId,hP:req.hP});
        if(req.metaSeed==='stale')throw Error('403 signed metaSeed consumed');
        return {data:{hlsSource:[{qualities:{720:'https://cdn.test/'+req.fileActiveId+'.m3u8'}}]},
            nextSeed:'next-'+req.metaSeed};
    },track=>track.qualities);
    assert.deepEqual(Array.from(data.playlist,x=>x.episode),[1,2,3]);
    assert.deepEqual(Array.from(requests,x=>x.fileId),
        ['expired-ep2','new-file-two','new-file-three']);
    assert.deepEqual(Array.from(requests,x=>x.hP),
        ['old-proof','proof1','proof2']);
    assert.deepEqual(Array.from(job.queueReport,x=>x.state),['resolved','resolved']);
    assert(job.queueReport.every(x=>x.fresh===true));
    job.queuePlanned=2;
    h.client.launch(job,data);
    assert.equal(h.storage.amedia_v4_lastQueueSummary.size,3);
    assert.equal(h.storage.amedia_v4_lastQueueSummary.resolved,2);
});
test('Failed fresh lookup for episode 2 does NOT suppress episode 3',async()=>{
    const h=harness(),job=h.client.begin({});
    const data={url:'https://cdn.test/first.m3u8',title:'Pilot',season:1,episode:1};
    h.client.prepare(job,data,{movie:show,season:1,episode:1});
    let lookups=0;
    const options={movie:show,embed:{metaSeed:'expired'},hP:'old',queuePlan:[
        {offset:1,season:1,episode:2,fileId:'old2',voiceId:'dub',title:'Second'},
        {offset:2,season:1,episode:3,fileId:'old3',voiceId:'dub',title:'Third'}
    ],queueLookup(){lookups++;
        if(lookups===1)return Promise.reject(Error('lookup unavailable'));
        return Promise.resolve({embed:{metaSeed:'fresh',fileList:{type:'serial'}},hP:'new'});
    },queueTree(){return tree([[
        [voice('dub','Dub','a')],[voice('dub','Dub','b')],[voice('dub','Dub','new3')]
    ]])}};
    await h.client.makeQueue(job,options,data,req=>{
        if(req.metaSeed==='expired')throw Error('no more seed');
        return {data:{hlsSource:[{qualities:{'720p':'https://cdn.test/third.m3u8'}}]}};
    },track=>track.qualities);
    assert.equal(lookups,2,'Each failing item must get its own fresh Skaz lookup');
    assert.deepEqual(Array.from(data.playlist,x=>x.episode),[1,3]);
    assert.deepEqual(Array.from(job.queueReport,x=>x.state),
        ['fresh_episode_failed','resolved']);
});
test('A refreshed lookup never substitutes an unrelated episode or season',async()=>{
    const h=harness(),job=h.client.begin({});
    const data={url:'https://cdn.test/first.m3u8',title:'Pilot',season:1,episode:1};
    h.client.prepare(job,data,{movie:show,season:1,episode:1});
    const options={movie:show,embed:{metaSeed:'invalid'},hP:'old',
        queuePlan:[{offset:1,season:1,episode:2,fileId:'wrong',voiceId:'dub',title:'Second'}],
        queueLookup(){return Promise.resolve({embed:{metaSeed:'fresh',fileList:{type:'serial'}},hP:'new'});},
        queueTree(){return tree([[[voice('dub','Dub','wrong-file')]]]);}
    };
    let freshVideoCalls=0;
    await h.client.makeQueue(job,options,data,req=>{
        if(req.metaSeed==='invalid')throw Error('expired');
        freshVideoCalls++;return {};
    },track=>track.qualities);
    assert.equal(freshVideoCalls,0);
    assert.equal(data.playlist,undefined);
    assert.deepEqual(Array.from(job.queueReport,x=>x.state),['fresh_episode_failed']);
});
test('Start exposes independent queue lookup and tree resolver from the original Amedia API',async()=>{
    const h=harness(),api=h.api(twoSeasons);
    await h.client.open(show,api,{season:1,episode:1});
    assert.equal(api.calls.length,1);
    assert.equal(typeof api.calls[0].queueLookup,'function');
    assert.equal(typeof api.calls[0].queueTree,'function');
    const fresh=await api.calls[0].queueLookup();
    assert.equal(fresh.embed.metaSeed,'begin');
    assert.equal(api.calls[0].queueTree(fresh.embed.fileList),twoSeasons);
});
test('Real Android bridge boundary receives sanitized URLs and numeric timelines',()=>{
    const h=harness(),job=h.client.begin({});
    const data={url:'https://cdn.test/e1.m3u8',title:'Episode 1',
        playlist:[{url:'https://cdn.test/e1.m3u8',title:'One',
                season:1,episode:1,timeline:{hash:'a',time:'0',duration:null,percent:999,
                    handler:()=>{}}},
            {url:'https://cdn.test/e2.m3u8',title:'Two',
                season:1,episode:2,timeline:{hash:'b',time:NaN,duration:'bad',percent:-2}},
            {url:'not-a-stream',title:'broken'}]};
    const options={movie:show,season:1,episode:1};
    h.client.prepare(job,data,options);
    let received=null;
    h.root.AndroidJS.openPlayer=(url,json)=>{received=JSON.parse(json);assert.equal(url,data.url);};
    // Mirrors the real Lampa Player→Android.openPlayer→AndroidJS chain,
    // which previous tests never reached.
    h.Lampa.Player.play=d=>{
        h.root.AndroidJS.openPlayer(d.url,JSON.stringify(d));
        h.playerBus.send('external',d);
    };
    h.client.launch(job,data);
    assert(received);
    assert.deepEqual(received.playlist.map(x=>x.url),
        ['https://cdn.test/e1.m3u8','https://cdn.test/e2.m3u8']);
    assert.deepEqual(received.playlist.map(x=>x.episode),[1,2]);
    assert.deepEqual(received.playlist.map(x=>x.timeline),
        [{hash:'a',time:0,duration:0,percent:100},
         {hash:'b',time:0,duration:0,percent:0}]);
    assert(h.nativeSettings.some(x=>x.name==='playlist_next'&&x.value==='true'));
    const state=h.storage.amedia_v4_lastQueueSummary;
    assert.equal(state.size,2);
    assert.equal(state.delivered,2);
    assert.equal(state.mode,'android');
    assert(!JSON.stringify(state).includes('cdn.test'),
        'Persist only diagnostics, never signed stream URLs');
});
test('Skaz seed with an empty stream skips it and still includes a later working episode',async()=>{
    const h=harness(),job=h.client.begin({});
    const data={url:'https://cdn.test/e1.m3u8',title:'Episode 1',season:1,episode:1};
    h.client.prepare(job,data,{movie:show,season:1,episode:1});
    const embed={metaSeed:'original',embedUrl:'https://skaz.tv/embed'};
    const options={movie:show,embed,hP:'guard',queuePlan:[
        {offset:1,season:1,episode:2,title:'Bad stream',fileId:'bad'},
        {offset:2,season:1,episode:3,title:'Good stream',fileId:'good'}
    ]};
    await h.client.makeQueue(job,options,data,request=>({
        data:request.fileActiveId==='bad'?{hlsSource:[]}:
            {hlsSource:[{qualities:{720:'https://cdn.test/e3.m3u8'}}]},
        nextSeed:'updated-'+request.fileActiveId
    }),track=>track.qualities);
    assert.deepEqual(Array.from(data.playlist,x=>x.episode),[1,3]);
    assert.deepEqual(Array.from(job.queueReport,x=>x.state),['no_stream','resolved']);
    job.queuePlanned=2;
    h.client.launch(job,data);
    assert.equal(h.storage.amedia_v4_lastQueueSummary.errors[0],'no_stream');
    assert.equal(h.storage.amedia_v4_lastQueueSummary.resolved,1);
});
test('Amedia settings allow explicit player reset instead of silently changing player',async()=>{
    const h=setupHub(harness()),api=h.api(twoSeasons);
    let resets=0;h.root.AndroidJS.clearDefaultPlayer=()=>{resets++;};
    await h.client.open(show,api);h.mount();
    assert.equal(resets,0);
    h.nodes.find(n=>n.label.includes('Настройки просмотра')).trigger('hover:enter');
    const button=h.nodes.find(n=>n.label==='Выбрать другой Android-плеер');
    assert(button,'Selected external player can be reset explicitly');
    button.trigger('hover:enter');
    assert.equal(resets,1);
    assert(h.notes.some(n=>n.includes('MX Player')));
});
test('Lampa lazy queue picks a usable translation when preferred voice misses its file ID',async()=>{
    const h=harness('ios');
    const catalog=tree([[
        [voice('studio','Дубляж')],
        [{id:'studio',name:'Дубляж',file_id:''},voice('original','Оригинал','next-file')],
        [voice('studio','Дубляж','third-file')]
    ]]);
    const a=h.api(catalog);
    await h.client.open(show,a,{season:1,episode:1});
    assert.equal(a.calls.length,1);
    assert.equal(a.calls[0].queuePlan[0].fileId,'next-file');
    assert.equal(a.calls[0].queuePlan[1].fileId,'third-file');
});


test('Built-in Lampa queue waits for Player.playdata to be ready, then publishes',()=>{
    const h=harness('ios'),job=h.client.begin({});
    const data={url:'https://cdn.test/e1.m3u8',
        playlist:[{url:'https://cdn.test/e1.m3u8',title:'One'},
            {url:'https://cdn.test/e2.m3u8',title:'Two'}]};
    h.client.launch(job,data);
    let checks=0;
    h.Lampa.Player.playdata=()=>++checks>=3?data:false;
    h.client.publishInnerQueue(job,data);
    assert.equal(h.queueSets.length,0,'must not set while player is not ready');
    h.runTimers(250);
    assert.equal(h.queueSets.length,0);
    h.runTimers(250);
    assert.equal(h.queueSets.length,1);
    assert.equal(h.queueSets[0].length,2);
    const status=h.storage.amedia_v4_lastQueueSummary;
    assert.equal(status.mode,'inner');
    assert.equal(status.size,2);
    assert.equal(status.delivered,2);
    assert.equal(job.innerQueuePublished,true);
});
test('Canceled internal playback cannot publish a stale playlist in the next session',()=>{
    const h=harness('ios'),job=h.client.begin({});
    const data={url:'https://cdn.test/e1.m3u8',
        playlist:[{url:'https://cdn.test/e1.m3u8'},{url:'https://cdn.test/e2.m3u8'}]};
    h.client.launch(job,data);
    h.Lampa.Player.playdata=()=>false;
    h.client.publishInnerQueue(job,data);
    h.client.failJob(job);
    h.runTimers(250);
    h.runTimers(250);
    assert.equal(h.queueSets.length,0);
});


test('Voice preferences: dubbing studio and continuity win over generic translation, but manual choice survives',async()=>{
    const h=harness(),a=h.api(twoSeasons);
    assert(h.client.voiceScore({name:'Дубляж Red Head Sound'})>
        h.client.voiceScore({name:'TVShows'}));
    assert(h.client.voiceScore({name:'LostFilm'})>
        h.client.voiceScore({name:'Субтитры'}));
    assert(h.client.voiceScore({name:'HDrezka Studio'})>
        h.client.voiceScore({name:'Автоматический перевод нейросеть'}));
    const choices=tree([[
        [voice('tv','TVShows','tv1'),voice('rhs','Red Head Sound','rhs1')],
        [voice('rhs','Red Head Sound','rhs2'),voice('tv','TVShows','tv2')],
        [voice('rhs','Red Head Sound','rhs3'),voice('tv','TVShows','tv3')]
    ]]);
    await h.client.open(show,h.api(choices),{season:1,episode:1});
    assert.equal(h.selected[0],'rhs','Auto prefers strong studio with continuity');
    const manual=harness(),man=manual.api(choices);
    manual.storage['amedia_v4_title_hash:tv:tmdb:23']={voice:'tv',voiceLabel:'TVShows'};
    await manual.client.open(show,man,{season:1,episode:1});
    assert.equal(man.calls.length,1);
    assert.equal(man.calls[0].fileId,'tv1','Manual choice always outranks auto studio weighting');
});
test('Adaptive quality respects measured connection and never blindly prefers 4K',()=>{
    const h=harness('ios');
    h.root.navigator={connection:{downlink:2.4,effectiveType:'3g'}};
    const variants={'360p':'https://cdn.test/360.m3u8',
        '480p':'https://cdn.test/480.m3u8',
        '720p':'https://cdn.test/720.m3u8',
        '1080p':'https://cdn.test/1080.m3u8',
        '2160p':'https://cdn.test/4k.m3u8'};
    assert.equal(h.client.chooseAdaptiveSource(variants,'auto').height,480);
    h.root.navigator.connection.downlink=14;
    h.root.navigator.connection.effectiveType='4g';
    assert.equal(h.client.chooseAdaptiveSource(variants,'auto').height,1080);
    h.root.navigator.connection.saveData=true;
    assert.equal(h.client.chooseAdaptiveSource(variants,'auto').height,480);
    h.root.navigator.connection.saveData=false;
    assert.equal(h.client.chooseAdaptiveSource(variants,'720').height,720);
});
test('Repeated failures of one CDN lower auto cap without ignoring a manual 1080p request',()=>{
    const h=harness('ios');
    const variants={'480p':'https://onecdn.test/480.m3u8',
        '720p':'https://onecdn.test/720.m3u8',
        '1080p':'https://onecdn.test/1080.m3u8'};
    h.storage.amedia_v4_failedHosts={'onecdn.test':{at:1000000,count:3}};
    assert.equal(h.client.chooseAdaptiveSource(variants,'auto').height,720);
    assert.equal(h.client.chooseAdaptiveSource(variants,'1080').height,1080);
    h.storage.amedia_v4_failedHosts['onecdn.test'].count=5;
    assert.equal(h.client.chooseAdaptiveSource(variants,'auto').height,480);
});
test('Quality auto is applied to the actual playback data, not only playlist candidates',()=>{
    const h=harness('ios'),job=h.client.begin({});
    h.root.navigator={connection:{downlink:2.2,effectiveType:'3g'}};
    const data={url:'https://cdn.test/1080.m3u8',
        quality:{'480p':'https://cdn.test/480.m3u8',
                 '720p':'https://cdn.test/720.m3u8',
                 '1080p':'https://cdn.test/1080.m3u8'}};
    h.client.prepare(job,data,{movie:show});
    assert.equal(data.url,'https://cdn.test/480.m3u8');
    assert.equal(data.__amediaAutoHeight,480);
    assert.equal(data.quality['1080p'],'https://cdn.test/1080.m3u8',
        'Keep remaining qualities for recovery');
});
test('Skaz heartbeat resolution uses the exact selected stream quality label',()=>{
    const h=harness('ios');
    h.root.navigator={connection:{downlink:2.1,effectiveType:'3g'}};
    const variants={'480p':'https://cdn.test/480.m3u8',
        '720p':'https://cdn.test/720.m3u8',
        '1080p':'https://cdn.test/1080.m3u8'};
    assert.equal(h.client.selectedResolution({movie:show},variants,'1080p'),'480p');
    assert(source.includes('_0x3a4edf=_amediaClient.selectedResolution('),
        'Original Skaz heartbeat must be in sync with adapted URL');
    h.storage['amedia_v4_title_hash:tv:tmdb:23']={quality:'720'};
    assert.equal(h.client.selectedResolution({movie:show},variants,'1080p'),'720p',
        'Manual quality and Skaz heartbeat must use the same resolution');
});
test('Fatal manifest failure first chooses another bitrate for SAME episode, without leaving player',()=>{
    const h=harness('ios'),job=h.client.begin({});
    const data={url:'https://badcdn.test/ep2-1080.m3u8',title:'Episode 2',season:1,episode:2,
        quality:{'1080p':'https://badcdn.test/ep2-1080.m3u8',
            '720p':'https://othercdn.test/ep2-720.m3u8'}};
    h.client.prepare(job,data,{movie:show,season:1,episode:2});
    h.client.recoverStream(job,{movie:show,voiceId:'studio'},data,()=>{},t=>t.qualities);
    assert.equal(data.url_reserve,undefined,'No competing Lampa reserve hook');
    h.client.launch(job,data);
    let redirected=null;
    data.error(data,url=>{redirected=url;});
    assert.equal(redirected,'https://othercdn.test/ep2-720.m3u8');
    assert.equal(data.episode,2);
    assert.equal(h.nativeRequests.length,0);
    assert.equal(data.__amediaRecoveryBusy,false);
});
test('Manifest error with no bitrate alternative re-resolves the exact episode with new Skaz context',async()=>{
    const h=harness('ios'),job=h.client.begin({});
    const data={url:'https://oldcdn.test/ep2.m3u8',title:'Second',season:1,episode:2};
    h.client.prepare(job,data,{movie:show,season:1,episode:2});
    const catalog=tree([[[voice('studio','Дубляж','file1')],
        [voice('studio','Дубляж','fresh2')],[voice('studio','Дубляж','fresh3')]]]);
    let lookup=0,requested=null,redirected=null;
    const opts={movie:show,voiceId:'studio',
        queueTree(){return catalog;},
        queueLookup(){lookup++;return Promise.resolve({embed:{metaSeed:'new-seed',
            embedUrl:'https://skaz.tv/referer',fileList:{type:'serial'}},hP:'new-guard'});}};
    h.client.recoverStream(job,opts,data,req=>{
        requested=req;
        return {data:{hlsSource:[{qualities:{'720p':'https://newcdn.test/ep2-fresh.m3u8'}}]}};
    },track=>track.qualities);
    h.client.launch(job,data);
    data.error(data,url=>{redirected=url;});
    await flush();
    assert.equal(lookup,1);
    assert.equal(requested.fileActiveId,'fresh2');
    assert.equal(requested.metaSeed,'new-seed');
    assert.equal(redirected,'https://newcdn.test/ep2-fresh.m3u8');
    assert.equal(data.episode,2,'Recovery must not jump to episode 3');
    assert.equal(h.nativeRequests.length,0);
});
test('Failed seek and manifest error can NEVER automatically advance to episode 3',()=>{
    const h=harness('ios'),job=h.client.begin({});
    h.storage.playlist_next=true;
    let next=0;
    h.Lampa.PlayerPlaylist.canNext=()=>true;
    h.Lampa.PlayerPlaylist.next=()=>{next++;};
    const data={url:'https://cdn.test/ep2.m3u8',title:'Episode 2',
        season:1,episode:2,__amediaManaged:true};
    h.client.launch(job,data);
    h.playerBus.send('start',data);
    assert.equal(h.storage.playlist_next,false,'Disable unverified Lampa auto-next');
    h.videoBus.send('error',{fatal:true,details:'manifestLoadError'});
    h.videoBus.send('ended',{});
    assert.equal(next,0,'Fatal manifest cannot be interpreted as episode end');
    h.videoBus.send('loadeddata',{duration:1800});
    h.videoBus.send('timeupdate',{duration:1800,current:1750});
    h.advance(15000);h.videoBus.send('ended',{});
    assert.equal(next,0,'Player must reach the actual end');
    h.videoBus.send('timeupdate',{duration:1800,current:1797});
    h.videoBus.send('ended',{});
    assert.equal(next,1,'Genuine end still allows automatic next');
    h.playerBus.send('start',{url:'https://other.test/movie.mp4'});
    assert.equal(h.storage.playlist_next,true,'Original global setting restored');
});
test('Recovery failure is bounded; current episode is kept instead of inventing another',async()=>{
    const h=harness('ios'),job=h.client.begin({});
    const data={url:'https://old.test/ep2.m3u8',title:'Ep 2',season:1,episode:2};
    h.client.prepare(job,data,{movie:show,season:1,episode:2});
    let lookup=0;
    h.client.recoverStream(job,{movie:show,
        queueLookup(){lookup++;return Promise.reject(Error('offline'));},
        queueTree(){return twoSeasons;}},data,()=>{},t=>t.qualities);
    h.client.launch(job,data);
    let redirected=false;
    data.error(data,()=>{redirected=true;});
    await flush();
    assert.equal(lookup,2,'At most two fresh attempts');
    assert.equal(redirected,false,'Do not switch to a random stream');
    assert.equal(data.episode,2);
    assert.equal(data.__amediaRecoveryFailed,true);
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
    assert(!source.includes("['queueDepth', 'Очередь серий'"));
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

test('Lampa season list renders at most 32 episodes initially on TV',async()=>{
    const h=setupHub(harness('ios')),episodes=tree([
        Array.from({length:88},(_,i)=>[voice('dub','Дубляж','ep'+i)])
    ]);
    await h.client.open(show,h.api(episodes));
    const hub=h.mount();
    assert.equal(h.nodes.filter(n=>n.markup.includes('class="selector amedia-hub__episode')).length,32);
    const more=h.nodes.find(n=>n.label.startsWith('Показать ещё'));
    assert(more,'Long seasons must offer the next page');
    more.trigger('hover:enter');
    assert(h.nodes.filter(n=>n.markup.includes('class="selector amedia-hub__episode')).length>32);
    hub.destroy();
});
test('Lampa controller uses canonical Scroll and Explorer roots',async()=>{
    const h=setupHub(harness('ios')),received=[];
    h.Lampa.Controller.collectionSet=(...args)=>received.push(args);
    await h.client.open(show,h.api(twoSeasons));
    const hub=h.mount();
    const row=h.nodes.find(n=>n.markup.includes('class="selector amedia-hub__episode'));
    row.trigger('hover:focus');
    hub.redraw();
    assert(received.some(args=>args.length===2),'Native Lampa expects both Scroll and Explorer roots');
    assert(source.includes('focusKey=row.attr(\'data-am-key\')'),'Focus key preserved through metadata redraw');
    hub.destroy();
});
test('TMDB image helper missing does not blank every episode thumbnail',async()=>{
    const h=setupHub(harness('ios'));
    await h.client.open({...show,backdrop_path:'/known-backdrop.jpg'},h.api(twoSeasons));
    h.mount();
    assert(h.nodes.some(n=>n.attributes.src==='https://image.tmdb.org/t/p/w780/known-backdrop.jpg'));
});
test('Translation selection labels explain known voice type',async()=>{
    const h=setupHub(harness('ios'));
    await h.client.open(show,h.api(twoSeasons));
    const hub=h.mount();
    const row=h.nodes.find(n=>n.markup.includes('class="selector amedia-hub__episode'));
    row.trigger('hover:long');
    assert(h.nodes.some(n=>n.label.includes('Профессиональный дубляж · дубляж')));
    hub.destroy();
});
test('Lampa full-series playlist keeps all lazy signed URL resolvers',()=>{
    const h=harness('ios'),job=h.client.begin({});
    const data={url:'https://cdn.test/ep1.m3u8',title:'Episode 1',season:1,episode:1};
    const descriptors=[
        {offset:1,season:1,episode:2,title:'Episode 2',voiceId:'dub'},
        {offset:2,season:2,episode:1,title:'Episode 3',voiceId:'dub'}
    ];
    const queue=h.client.prepareLazyInnerQueue(job,{movie:show,voiceId:'dub',queuePlan:descriptors},data,()=>{},()=>({}));
    assert.equal(queue.length,3);
    assert(queue.every(x=>typeof x.url==='function'));
    const report=h.client.checkNativePlaylist(job,data);
    assert.equal(report.size,3);
    assert.equal(report.currentIndex,0);
    assert.equal(data.playlist[2].season,2);
    assert.equal(report.resolved,0,'URL functions are not yet signed streams');
});
