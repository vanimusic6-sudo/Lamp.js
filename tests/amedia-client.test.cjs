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
        Reguest:function(){this.timeout=()=>{};this.quiet=(url,success,error)=>requests.push({url,success,error});},
        Listener:appBus,
        Activity:{active() {return activeMovie ? {card:activeMovie} : null;}},
        Utils:{
            hash(value){return 'hash:' + String(value);},
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
    assert.equal(h.nativeRequests[1].request.nativeTitle,'');
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
    assert(h.selection.items[1].title.includes('720'));
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
    assert.equal(h.queueSets.length,0,'Cannot register PlayerPlaylist before Lampa starts');
    h.playerBus.send('external',data);
    assert.equal(h.queueSets.length,1,'Register after Player.playdata exists');
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
    assert(source.includes("watch.before(button)"));
    assert(!source.includes('bindMovieStart(_0x2a442b.item'));
});



test('Amedia is inserted before native Watch without intercepting its click handler',()=>{
    assert(source.includes("var watch = params.render.find('.full-start-new__buttons .button--play').first()"));
    assert(source.includes('watch.before(button)'));
    assert(!source.includes("button.off('hover:enter').on('hover:enter'"));
    assert(!source.includes('function bindMovieStart('));
});

test('The Android auto-next gate is enabled when Amedia queues episodes',()=>{
    const h=harness();
    h.storage.playlist_next=false;
    const job=h.client.begin({});
    const data={
        url:'https://cdn.test/ep1.m3u8',
        playlist:[
            {url:'https://cdn.test/ep1.m3u8',title:'Ep 1'},
            {url:'https://cdn.test/ep2.m3u8',title:'Ep 2'}
        ]
    };
    h.client.launch(job,data);
    assert.equal(h.storage.playlist_next,true);
    assert.equal(h.played[0].playlist.length,2);
    assert.equal(h.notes.filter(n=>/автопереход/i.test(n)).length,1);
    assert.equal(h.client.checkNativePlaylist(job,data).size,2);
    h.playerBus.send('external',data);
    assert.equal(h.queueSets.length,1);
});

test('Unresolved next episode explicitly warns rather than silently promising a queue',()=>{
    const h=harness(),job=h.client.begin({});
    job.queuePlanned=1;
    const data={url:'https://cdn.test/ep1.m3u8'};
    h.client.launch(job,data);
    assert.equal(h.notes.length,1);
    assert(h.notes[0].includes('только текущую'));
    assert.equal(h.played.length,1);
});

test('TVmaze and Cinemeta fallback patch missing poster and real season counts only',()=>{
    const h=harness();
    const item={id:50, name:'Example Show',original_name:'Example Show',
        first_air_date:'2021-01-01',imdb_id:'tt1234567',
        number_of_seasons:1,seasons:[{season_number:1,episode_count:6}]};
    h.setMovie(item);
    h.appBus.send('full',{type:'start',data:{movie:item}});
    const cinema=h.requests.find(x=>x.url.includes('v3-cinemeta.strem.io'));
    const maze=h.requests.find(x=>x.url.includes('/lookup/shows?imdb='));
    assert(cinema && maze);
    cinema.success({meta:{id:'tt1234567',poster:'https://catalog.test/poster.jpg',videos:[
        {id:'tt1234567:2:1',title:'Episode A',thumbnail:'https://catalog.test/2x1.jpg'}
    ]}});
    assert.equal(item.img,'https://catalog.test/poster.jpg');
    assert.equal(item.number_of_seasons,2);
    assert.equal(item.seasons.length,2);
    assert.equal(item.seasons[1].episode_count,1);
    maze.success({id:22});
    const episodes=h.requests.find(x=>x.url.includes('/shows/22?embed=episodes'));
    assert(episodes);
    episodes.success({id:22,name:'Example Show',premiered:'2021-04-01',
        image:{medium:'https://catalog.test/maze.jpg'},
        _embedded:{episodes:[{season:3,number:1,name:'Episode B',
            image:{medium:'https://catalog.test/epb.jpg'}}]}});
    assert.equal(item.number_of_seasons,3);
    assert.equal(item.seasons[2].episode_count,1);
});

test('Native Lampa episode timeline and image flow through without a second metadata fetch',async()=>{
    const h=harness();
    h.setMovie(show);
    const item=h.runEpisode({
        season_number:1,episode_number:1,original_name:'Series',
        name:'The Pilot',img:'https://lampa.example/episode1.webp',
        timeline:{hash:'native-episode-hash',time:12,duration:145,percent:8}
    });
    item.data.params.onEnter(item);
    assert.equal(h.nativeRequests[0].request.nativeTitle,'The Pilot');
    assert.equal(h.nativeRequests[0].request.nativeThumbnail,'https://lampa.example/episode1.webp');
    assert.equal(h.nativeRequests[0].request.nativeTimeline.hash,'native-episode-hash');
    const a=h.api(twoSeasons);
    await h.client.open(show,a,h.nativeRequests[0].request);
    assert.equal(a.calls[0].title.includes('The Pilot'),true);
    const video={url:'https://video.example/stream.m3u8'};
    h.client.prepare(a.calls[0].clientJob,video,a.calls[0]);
    assert.equal(video.timeline.hash,'native-episode-hash');
    assert.equal(video.timeline.time,12);
    assert.equal(video.thumbnail,'https://lampa.example/episode1.webp');
});


test('Preferred dubbing name stays effective across episodes whose translation IDs change',async()=>{
    const h=harness();
    const subtitles=tree([[
        [voice('first','Studio Aurora','first-file'),voice('default','Профессиональный дубляж','default-file')],
        [voice('second','Studio Aurora','second-file'),voice('default2','Профессиональный дубляж','default2-file')]
    ]]);
    const a=h.api(subtitles);
    await h.client.open(show,a,{season:1,episode:1,manual:true});
    h.selection.onSelect({action:'voice'});
    h.selection.onSelect({value:'first',label:'Studio Aurora'});
    h.selection.onSelect({action:'play'});
    await flush();
    assert.equal(a.calls[0].fileId,'first-file');
    const b=h.api(subtitles);
    await h.client.open(show,b,{season:1,episode:2});
    assert.equal(b.calls[0].fileId,'second-file');
});

test('An unreleased native Lampa episode retains the original native action',()=>{
    const h=harness();
    h.setMovie(show);
    let originalCalls=0;
    const episode=h.runEpisode({
        season_number:1,episode_number:5,original_name:'Series',
        air_date:'2099-01-01',left_days:40
    },()=>originalCalls++);
    episode.data.params.onEnter(episode);
    assert.equal(originalCalls,1);
    assert.equal(h.nativeRequests.length,0);
});


test('Video lookup retries once after transient failure with a new request', async()=>{
    const h=harness(), a=h.api(null,'movie');
    const lookup=a.lookup;
    let attempts=0;
    a.lookup=()=>{
        attempts++;
        return attempts===1 ? Promise.reject(new Error('temporary network loss')) : lookup();
    };
    const task=h.client.open(movie,a);
    await flush();
    h.runTimers(800);
    await task;
    assert.equal(attempts,2);
    assert.equal(a.calls.length,1);
    assert.deepEqual(h.notes,[]);
});

test('Failed Amedia translation gets exactly one fresh lookup and alternate source', async()=>{
    const h=harness();
    const available=tree([[
        [voice('dub','Профессиональный дубляж','broken-file'),
            voice('studio','LostFilm','working-file')]
    ]]);
    const a=h.api(available);
    const playCalls=[];
    let lookups=0;
    const nativeLookup=a.lookup;
    a.lookup=()=>{lookups++;return nativeLookup();};
    a.play=(options)=>{
        playCalls.push(options);
        return playCalls.length===1 ?
            Promise.reject(new Error('one file cannot be played')) : Promise.resolve();
    };
    await h.client.open(show,a,{season:1,episode:1});
    assert.equal(playCalls.length,2);
    assert.equal(playCalls[0].fileId,'broken-file');
    assert.equal(playCalls[1].fileId,'working-file');
    assert.equal(lookups,2);
    assert.deepEqual(h.notes,[]);
});

test('Film startup failure gets one fresh Amedia embed, no infinite retry', async()=>{
    const h=harness(),a=h.api(null,'movie');
    let calls=0;
    a.play=()=>{calls++;return Promise.reject(new Error('unsupported CDN'));};
    await h.client.open(movie,a);
    assert.equal(calls,2);
    assert.equal(h.notes.length,1);
});

test('Amedia queue stream extractor supports multiple audio and 1080p variants',()=>{
    const h=harness();
    const res={
        data:{hlsSource:[
            {quality:{'1080':'bad'}},
            {quality:{'720p':'https://cdn.test/video720.m3u8|fallback',
                '1080p':'https://cdn.test/video1080.m3u8|fallback'}}
        ]}
    };
    const pick=(t)=>t.quality;
    assert.equal(h.client.bestQueueStream(res,pick,'auto'),'https://cdn.test/video1080.m3u8');
    assert.equal(h.client.bestQueueStream(res,pick,'720'),'https://cdn.test/video720.m3u8');
});

test('Native queue checks drop malformed playlist entries safely',()=>{
    const h=harness(),job=h.client.begin({});
    const data={url:'https://cdn.test/now.m3u8',playlist:[
        {url:'not-a-video'}, {url:'https://cdn.test/now.m3u8'},
        {url:'https://cdn.test/next.m3u8'}
    ]};
    const result=h.client.checkNativePlaylist(job,data);
    assert.equal(result.size,2);
    assert.equal(result.currentIndex,0);
    assert.equal(data.playlist.length,2);
});
