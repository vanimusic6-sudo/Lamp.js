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

function harness() {
    let selection = null, shown = [], activeMovie = null, time = 1000000;
    const notes=[], played=[], requests=[], selected=[], nativeRequests=[], queueSets=[], timers=new Map();
    const winEvents = {}, docEvents={};
    let seq=0, controller = '';
    const playerBus=bus(),timelineBus=bus(),appBus=bus(),selectBus=bus(),modalBus=bus();
    const Lampa = {
        Storage: {
            get(name,defaultValue) {return Object.prototype.hasOwnProperty.call(storage,name) ? storage[name] : defaultValue;},
            set(name,value) {storage[name]=value;}
        },
        Platform:{is(name) {return name==='android';}},
        Noty:{show(msg) {notes.push(msg);}},
        Loading:{start(){},stop(){}},
        SettingsApi:{addComponent(){},addParam(){}},
        Listener:appBus,
        Activity:{active() {return activeMovie ? {card:activeMovie} : null;}},
        Utils:{
            hash(value){return 'hash:' + String(value);},
            createInstance(klass,element) {
                return {
                    data:element, modules:[],
                    use(mod) {this.modules.push(mod);},
                    long() {this.modules.forEach(m=>{if(m.onLong)m.onLong.call(this);});}
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
        PlayerPlaylist:{set(items){queueSets.push(items);},get(){return queueSets[queueSets.length-1] || [];}},
        Timeline:{
            listener:timelineBus,
            link(){return {};},
            view(hash){return {hash,time:0,duration:120,percent:0};}
        },
        Player:{
            listener:playerBus, runas(){},
            play(data){played.push(data);}
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
        Lampa,document,AndroidJS:{openPlayer(){}},
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
        client,Lampa,api,notes,played,nativeRequests,queueSets,storage,requests,selected,playerBus,timelineBus,appBus,
        get selection(){return selection;},get shown(){return shown;},get controller(){return controller;},
        setMovie(movie){activeMovie=movie;},
        runEpisode(data, fallback) {
            data.params={onEnter:fallback || (()=>{})};
            const item=Lampa.Utils.createInstance(null,data);
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

test('Film launches directly from native Lampa button with no plugin screen',async()=>{
    const h=harness(),a=h.api(null,'movie');
    await h.client.open(movie,a);
    assert.equal(a.calls.length,1);
    assert.equal(a.calls[0].fileId,'movie-file');
    assert.equal(h.shown.length,0);
    assert.equal(a.calls[0].movie.title,'Кино');
});

test('Exact native series episode plays automatically with strongest dubbing',async()=>{
    const h=harness(),a=h.api(twoSeasons);
    await h.client.open(show,a,{season:1,episode:1});
    assert.equal(a.calls.length,1);
    assert.equal(a.calls[0].season,1);
    assert.equal(a.calls[0].episode,1);
    assert.equal(a.calls[0].fileId,'studio-file');
    assert.equal(h.shown.length,0);
    assert.equal(a.calls[0].queuePlan.length,1);
});

test('Native episode click and long press hook both Full rows and seasons screen',()=>{
    const h=harness();
    h.setMovie(show);
    let old=0;
    const element={season_number:2,episode_number:1,original_name:'Series',left_days:1};
    const ep=h.runEpisode(element,()=>old++);
    element.params.onEnter(ep);
    assert.equal(old,0,'Original EpisodeMenu must be bypassed for an available series');
    assert.equal(h.nativeRequests[0].request.season,2);
    assert.equal(h.nativeRequests[0].request.episode,1);
    assert.equal(h.nativeRequests[0].request.manual,false);
    h.advance(1000);
    ep.long();
    assert.equal(h.nativeRequests[1].request.manual,true);
    assert.equal(h.nativeRequests[1].request.episode,1);
    element.params.onEnter(ep);
    assert.equal(h.nativeRequests.length,2,'keyup after a long press must not double-launch');
});

test('Native episode handler preserves original Lampa action without a valid show',()=>{
    const h=harness();
    let old=0;
    const data={season_number:1,episode_number:1};
    const ep=h.runEpisode(data,()=>old++);
    data.params.onEnter(ep);
    assert.equal(old,1);
    assert.equal(h.nativeRequests.length,0);
});

test('Missing requested episode must never silently start another',async()=>{
    const h=harness(),a=h.api(twoSeasons);
    await h.client.open(show,a,{season:2,episode:99});
    assert.equal(a.calls.length,0);
    assert.equal(h.notes.length,1);
});

test('Long press opens only native Lampa Select; settings persist across plays',async()=>{
    const h=harness(),a=h.api(twoSeasons);
    await h.client.open(show,a,{season:1,episode:1,manual:true});
    assert.equal(a.calls.length,0);
    assert.equal(h.selection.items[0].action,'voice');
    h.selection.onSelect({action:'voice'});
    const studio=h.selection.items.find(i=>i.value==='studio');
    assert(studio);
    h.selection.onSelect(studio);
    assert.equal(h.selection.items[0].action,'voice');
    h.selection.onSelect({action:'quality'});
    h.selection.onSelect({value:'720'});
    assert(h.selection.items[0].title.includes('720'));
    h.selection.onSelect({action:'play'});
    await flush();
    assert.equal(a.calls.length,1);
    assert.equal(a.calls[0].fileId,'studio-file');
    const keys=Object.keys(h.storage).filter(x=>x.includes('title_'));
    assert.equal(keys.length,1);
    assert.equal(h.storage[keys[0]].quality,'720');
    assert.equal(h.storage[keys[0]].voice,'studio');
    // Native quality override is applied when the signed HLS manifest arrives.
    const data={url:'https://example.org/1080.m3u8',
        quality:{'720p':'https://example.org/720.m3u8', '1080p':'https://example.org/1080.m3u8'}};
    h.client.prepare(a.calls[0].clientJob,data,a.calls[0]);
    assert.equal(data.url,'https://example.org/720.m3u8');
});

test('Voice choice for a title survives a new lookup and can be reset',async()=>{
    const h=harness(),a=h.api(twoSeasons);
    await h.client.open(show,a,{season:1,episode:1,manual:true});
    h.selection.onSelect({action:'voice'});
    h.selection.onSelect({value:'original',label:'Оригинал'});
    h.selection.onSelect({action:'play'});
    await flush();
    assert.equal(a.calls[0].fileId,'original-file');
    const b=h.api(twoSeasons);
    await h.client.open(show,b,{season:1,episode:1});
    assert.equal(b.calls[0].fileId,'original-file');
    await h.client.open(show,h.api(twoSeasons),{season:1,episode:1,manual:true});
    h.selection.onSelect({action:'reset'});
    assert(h.selection.items[0].title.includes('Автоматически'));
});

test('Long press on movie can pick an HLS audio track at first launch',async()=>{
    const h=harness(),a=h.api(null,'movie');
    await h.client.open(movie,a,{manual:true});
    assert(h.selection);
    h.selection.onSelect({action:'voice'});
    h.selection.onSelect({value:'ask'});
    h.selection.onSelect({action:'play'});
    await flush();
    assert.equal(a.calls.length,1);
    const pending=a.calls[0].audioPick([
        {name:'Original',audioId:'original'},
        {name:'Дубляж',audioId:'dub'}
    ]);
    assert(h.selection.items.some(x=>x.index===1));
    h.selection.onSelect({index:1});
    assert.equal(await pending,1);
    assert.equal(h.selected.at(-1),'dub');
    const keys=Object.keys(h.storage).filter(x=>x.includes('title_'));
    assert.equal(h.storage[keys[0]].voice,'dub');
});

test('Signed native playlist is serialized with current position and previous/next',async()=>{
    const h=harness(),job=h.client.begin({});
    const data={title:'S1E2',url:'https://cdn.example.com/current.m3u8',
        headers:{'Accepts-Controls':'mock'},quality:{'1080p':'https://cdn.example.com/current.m3u8'}};
    const embed={metaSeed:'start'};
    const options={movie:show,season:1,episode:2,embed,hP:'hp',
        queuePlan:[
            {offset:-1,season:1,episode:1,fileId:'prev',title:'Previous'},
            {offset:1,season:1,episode:3,fileId:'next',title:'Next'}
        ]};
    h.client.prepare(job,data,options);
    const resolved=[];
    await h.client.makeQueue(job,options,data,req=>{
        resolved.push(req.fileActiveId);
        return Promise.resolve({data:{hlsSource:[{quality:{
            '1080':'https://cdn.example.com/'+req.fileActiveId+'.m3u8'
        }}]},nextSeed:'new-seed'});
    },track=>track.quality);
    assert.deepEqual(resolved,['prev','next']);
    assert.equal(data.playlist.length,3);
    assert.equal(data.playlist[1].url,data.url);
    assert.equal(data.playlist[0].season,1);
    assert.equal(data.playlist[2].episode,3);
    h.client.launch(job,data);
    assert.equal(h.played.length,1);
    assert.equal(h.queueSets.length,1,'Lampa does not emit Player.start for external Android');
    assert.equal(JSON.parse(JSON.stringify(h.played[0])).playlist[2].url,'https://cdn.example.com/next.m3u8');
});

test('Expired/ambiguous Amedia seed cannot block primary stream',async()=>{
    const h=harness(),job=h.client.begin({});
    const data={title:'S1E1',url:'https://cdn.example.com/current.m3u8'};
    const embed={metaSeed:'start'};
    const opts={movie:show,season:1,episode:1,embed,hP:'hp',queuePlan:[
        {offset:1,season:1,episode:2,fileId:'next',title:'Next'}
    ]};
    h.client.prepare(job,data,opts);
    await h.client.makeQueue(job,opts,data,()=>Promise.reject(new Error('Timed out')),x=>x.quality);
    assert.equal(data.url,'https://cdn.example.com/current.m3u8');
    assert.equal(data.playlist,undefined);
    assert.equal(embed.__amediaSeedInvalid,true);
});

test('Android-return fallback advances only after a matching 100% completion',()=>{
    const h=harness();
    const ctx={movie:show,tree:twoSeasons,season:twoSeasons.seasons[0],
        episode:twoSeasons.seasons[0].episodes[0]};
    const job=h.client.begin({ctx});
    const data={title:'S1E1',url:'https://example.net/video.m3u8',
        timeline:{hash:'episode-1',time:0,duration:180,percent:0}};
    h.client.launch(job,data);
    h.playerBus.send('external',data);
    h.advance(2000);
    h.event('focus');
    h.runTimers(1000);
    assert.equal(h.nativeRequests.length,0,'Focus alone is never completion');
    h.timelineBus.send('update',{data:{hash:'episode-1',
        road:{time:180,duration:180,percent:100}}});
    h.runTimers(1000);
    assert.equal(h.nativeRequests.length,1);
    assert.equal(h.nativeRequests[0].request.season,1);
    assert.equal(h.nativeRequests[0].request.episode,2);
});

test('Android return without completion never launches another episode',()=>{
    const h=harness();
    const ctx={movie:show,tree:twoSeasons,season:twoSeasons.seasons[0],
        episode:twoSeasons.seasons[0].episodes[0]};
    const job=h.client.begin({ctx});
    const data={title:'S1E1',url:'https://example.net/video.m3u8',
        timeline:{hash:'episode-1',time:0,duration:180,percent:0}};
    h.client.launch(job,data);
    h.playerBus.send('external',data);
    h.advance(2000);
    h.event('focus');
    h.timelineBus.send('update',{data:{hash:'other-episode',
        road:{time:180,duration:180,percent:100}}});
    h.runTimers(1000);
    assert.equal(h.nativeRequests.length,0);
});

test('No custom series modal or TMDB metadata search code remains',()=>{
    assert(!clientCode.includes('function openHub('));
    assert(!clientCode.includes('function installHubStyle('));
    assert(!clientCode.includes('function fetchSeasonArt('));
    assert(!clientCode.includes('function enrichEpisodeMetadata('));
    assert(source.includes('function _0x220c04('));
    assert(source.includes("button.on('hover:long'"));
    assert(source.includes("region.prepend(button)"));
});
