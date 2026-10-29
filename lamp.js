/**
 * Стоит ли смотреть? · Lampa Original Layout v60.0
 *
 * Movie/TV facts from TMDB, transparent recommendation rationale,
 * native Lampa modal actions, and a layout safe for TV, touch and D-pad.
 * Self-contained; no extra hosts, trackers or external UI libraries.
 */
(function () {
    'use strict';

    var PLUGIN = 'should_watch_plugin_enhanced';
    var STYLE_ID = 'sw59-styles';
    var BTN = 'sw59-trigger';
    var requests = Object.create(null);
    var state = { run: 0, lastOpen: 0, opened: false, sheet: null, content: null, answer: null, movie: null };
    var initialized = false, bootAttempts = 0;
    var ICON = '<svg viewBox="0 0 24 24" width="26" height="26" xmlns="http://www.w3.org/2000/svg"><path fill="currentColor" d="M12 4c-5 0-9.4 3.2-11 8 1.6 4.8 6 8 11 8s9.4-3.2 11-8c-1.6-4.8-6-8-11-8zm0 13.5a5.5 5.5 0 1 1 0-11 5.5 5.5 0 0 1 0 11zm0-2.4a3.1 3.1 0 1 0 0-6.2 3.1 3.1 0 0 0 0 6.2z"/></svg>';

    var GENRES = {
        12: 'Приключения', 14: 'Фэнтези', 16: 'Мультфильм',
        18: 'Драма', 27: 'Ужасы', 28: 'Боевик', 35: 'Комедия',
        36: 'История', 37: 'Вестерн', 53: 'Триллер', 80: 'Криминал',
        99: 'Документальный', 878: 'Фантастика', 9648: 'Детектив',
        10402: 'Музыка', 10749: 'Мелодрама', 10751: 'Семейный',
        10752: 'Военный', 10759: 'Боевик и приключения',
        10762: 'Для детей', 10764: 'Реалити', 10765: 'Фантастика',
        10766: 'Мыльная опера', 10768: 'Военный', 10770: 'Телефильм'
    };
    var LANGS = {ru:'русский',en:'английский',fr:'французский',
        de:'немецкий',es:'испанский',it:'итальянский',ja:'японский',
        ko:'корейский',zh:'китайский',hi:'хинди',tr:'турецкий'};
    var TOPICS = [
        {name:'По мотивам книги',re:/^(based on (a |the )?(novel|book)|literary adaptation|экранизация|по мотивам книги)$/i},
        {name:'По реальным событиям',re:/^(based on (a )?true story|based on real events|true story|реальные события)$/i},
        {name:'Комиксы',re:/^(based on (a )?comic book|based on comics|comic book|комиксы)$/i},
        {name:'Видеоигры',re:/^(based on (a )?video game|video game adaptation|по мотивам игры)$/i},
        {name:'Путешествия во времени',re:/^(time travel|time loop|путешествие во времени|временная петля)$/i},
        {name:'Космос',re:/^(outer space|space travel|space exploration|космос)$/i},
        {name:'Антиутопия',re:/^(dystopia|dystopian|антиутопия)$/i},
        {name:'Постапокалипсис',re:/^(post.apocalyptic|post.apocalypse|постапокалипсис)$/i},
        {name:'Детективная история',re:/^(investigation|murder mystery|detective|расследование)$/i},
        {name:'Ограбление',re:/^(heist|bank robbery|ограбление)$/i},
        {name:'Шпионаж',re:/^(espionage|spy|secret agent|шпионаж)$/i},
        {name:'Киберпанк',re:/^(cyberpunk|киберпанк)$/i},
        {name:'Супергерои',re:/^(superhero|superheroes|супергерои)$/i}
    ];

    function clean(s, n) {
        if (s === null || s === undefined) return '';
        return String(s).replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ')
            .trim().slice(0, n || 240);
    }
    function esc(s) {
        return clean(s, 3000).replace(/[&<>"']/g, function(c){
            return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
        });
    }
    function number(n) { return Number(n).toLocaleString('ru-RU'); }
    function fixed(n) { return Number(n).toFixed(1).replace('.', ','); }
    function unique(a) { return a.filter(function(v,i){ return !!v && a.indexOf(v) === i; }); }
    function list(a) { return (Array.isArray(a) ? a : []).filter(Boolean); }
    function type(m) {
        return m && (m.media_type === 'tv' || m.first_air_date || m.number_of_seasons ||
            (!m.title && (m.name || m.original_name))) ? 'tv' : 'movie';
    }
    function getCard(e) {
        var c = e && (e.link && e.link.card || e.data && (e.data.movie || e.data) ||
            e.object && (e.object.card || e.object.movie) ||
            e.props && e.props.get && e.props.get('movie'));
        if (!c || typeof c !== 'object') return null;
        return c.movie && typeof c.movie === 'object' ? c.movie : c;
    }
    function getSetting(key, fallback) {
        try {
            if (Lampa.Storage) {
                var value = Lampa.Storage.get(PLUGIN + '_' + key);
                if (value !== undefined && value !== null && value !== '') return value;
            }
        } catch(e) {}
        return fallback;
    }
    function settings() {
        var min = Number(getSetting('min_rating', '6'));
        if (!isFinite(min)) min = 6;
        var font = Number(getSetting('font_scale', '20'));
        return {
            min: Math.max(0, Math.min(10, min)),
            font: Math.max(16, Math.min(24, font || 20)),
            genres: splitPref(getSetting('bad_genres','')),
            actors: splitPref(getSetting('bad_actors','')),
            directors: splitPref(getSetting('bad_directors',''))
        };
    }
    function splitPref(text) {
        return clean(text, 1200).toLowerCase().split(/[,;\n]+/).map(function(s){
            return s.trim();
        }).filter(function(s){return s.length >= 2;});
    }
    function initSettings() {
        if (!Lampa.SettingsApi) return;
        try {
            Lampa.SettingsApi.addComponent({component:PLUGIN,name:'Стоит ли смотреть',icon:ICON});
            [
                {key:'min_rating',type:'select',label:'Минимальный рейтинг',
                    values:{'0':'Любой','5':'5,0','6':'6,0','7':'7,0','8':'8,0','9':'9,0'},def:'6'},
                {key:'bad_genres',type:'input',label:'Не нравятся жанры',
                    info:'Через запятую, например: ужасы, мелодрама',def:''},
                {key:'bad_actors',type:'input',label:'Не нравятся актёры',
                    info:'Имена через запятую',def:''},
                {key:'bad_directors',type:'input',label:'Не нравятся режиссёры',
                    info:'Имена через запятую',def:''},
                {key:'font_scale',type:'select',label:'Размер текста',
                    values:{'16':'Небольшой','18':'Средний','20':'Обычный','22':'Большой','24':'Крупный'},def:'20'},
                {key:'reset_cache',type:'select',label:'Обновить информацию',
                    values:{'0':'Кэшировать','1':'Сбросить кэш при следующем запросе'},def:'0'}
            ].forEach(function(x) {
                Lampa.SettingsApi.addParam({
                    component:PLUGIN,
                    param:{name:PLUGIN+'_'+x.key,type:x.type,values:x.values||'',default:x.def},
                    field:{name:x.label,description:x.info||''}
                });
            });
        } catch(e) { console.warn('[ShouldWatch] Settings:',e); }
    }

    function tmdbKey() {
        try { if (Lampa.TMDB && Lampa.TMDB.key) return Lampa.TMDB.key; } catch(e) {}
        return '4ef0d7355d9ffb5151e987764708ce96';
    }
    function query(path, lang) {
        return new Promise(function(resolve){
            var done = false, timer = setTimeout(function(){ settle(null); }, 6500);
            function settle(data) {
                if (done) return;
                done = true; clearTimeout(timer);
                resolve(data && !data.status_code && typeof data === 'object' ? data : null);
            }
            var url = 'https://api.themoviedb.org/3' + path +
                (path.indexOf('?') >= 0 ? '&' : '?') +
                'language=' + encodeURIComponent(lang || 'ru-RU') +
                '&api_key=' + encodeURIComponent(tmdbKey());
            try {
                if (Lampa.Request && typeof Lampa.Request.get === 'function') {
                    Lampa.Request.get(url, settle, function(){ settle(null); }, {dataType:'json'});
                } else if (typeof fetch === 'function') {
                    fetch(url).then(function(r){return r.ok ? r.json() : null;})
                        .then(settle).catch(function(){settle(null);});
                } else settle(null);
            } catch(e) { settle(null); }
        });
    }
    function resetCacheIfRequested() {
        if (String(getSetting('reset_cache','0')) !== '1') return;
        requests = Object.create(null);
        try { Lampa.Storage.set(PLUGIN+'_reset_cache','0'); } catch(e) {}
    }
    function normalizeName(value) {
        return clean(value,220).toLowerCase().replace(/ё/g,'е')
            .replace(/[^a-z0-9а-я]+/g,' ').trim();
    }
    function sameWork(card, detail) {
        if (!detail || !detail.id) return false;
        // Even successful HTTP responses can represent a different title when
        // a card's "id" came from a source other than TMDB.
        var y1=year(card.release_date || card.first_air_date);
        var y2=year(detail.release_date || detail.first_air_date);
        if(y1 && y2 && Math.abs(Number(y1)-Number(y2))>2)return false;
        if(card.tmdb_id && String(card.tmdb_id)===String(detail.id))return true;
        var left=[card.title,card.name,card.original_title,card.original_name]
            .map(normalizeName).filter(Boolean);
        var right=[detail.title,detail.name,detail.original_title,detail.original_name]
            .map(normalizeName).filter(Boolean);
        if (!left.length || !right.length)return true; // Rely on matched numeric ID.
        if(left.some(function(x){return right.indexOf(x)>=0;}))return true;
        // Different localized titles may have unrelated spellings; compare
        // original titles only if the card actually supplied one.
        var orig=normalizeName(card.original_title || card.original_name);
        var remote=normalizeName(detail.original_title || detail.original_name);
        if(orig && remote)return orig===remote;
        var cardLocal=normalizeName(card.title || card.name);
        var remoteLocal=normalizeName(detail.title || detail.name);
        var alphabet=function(t){return /[а-я]/.test(t)?'cyr':/[a-z]/.test(t)?'lat':'other';};
        if(cardLocal && remoteLocal && alphabet(cardLocal)===alphabet(remoteLocal))return false;
        return true;
    }
    function loadMeta(m) {
        resetCacheIfRequested();
        var id = m && (m.tmdb_id || m.id);
        if (!id || !/^\d+$/.test(String(id))) return Promise.resolve({main:null,en:null});
        var kind=type(m), key=kind+':'+id, item=requests[key];
        if (item && (!item.expires || item.expires>Date.now())) return item.promise;
        if (Object.keys(requests).length > 60) requests=Object.create(null);
        var cert = kind==='tv' ? 'content_ratings' : 'release_dates';
        var pending=Promise.all([
            query('/'+kind+'/'+id+'?append_to_response=credits,keywords,reviews,'+cert,'ru-RU'),
            query('/'+kind+'/'+id+'?append_to_response=reviews,videos,keywords','en-US')
        ]).then(function(data){
            var out={main:data[0],en:data[1]};
            if(out.main && !sameWork(m,out.main))out.main=null;
            if(out.en && !sameWork(m,out.en))out.en=null;
            if (!out.main && !out.en) { delete requests[key]; return out; }
            if (requests[key]) requests[key]={promise:Promise.resolve(out),expires:Date.now()+1800000};
            return out;
        }).catch(function(){
            delete requests[key];
            return {main:null,en:null};
        });
        requests[key]={promise:pending,expires:0};
        return pending;
    }

    function genreList(main, card) {
        var raw=list((main && main.genres && main.genres.length ? main.genres : card.genres));
        if (!raw.length) raw=list(card.genre_ids);
        var items=raw.map(function(g){
            var id=Number(g && g.id || g), name=clean(g && g.name,80);
            // Normalized RU names let Russian preferences match English TMDB genres.
            return {id:isFinite(id)?id:0,name:GENRES[id] || name || '',
                aliases:unique([name,GENRES[id]||''])};
        });
        return items.filter(function(g){return !!g.name;});
    }
    function names(items, max) {
        return unique(list(items).map(function(x){return clean(x && x.name,85);})).slice(0,max);
    }
    function directors(credits) {
        return names(list(credits && credits.crew).filter(function(p){
            return p && (p.job==='Director' || p.job==='Series Director');
        }),4);
    }
    function writers(credits) {
        return names(list(credits && credits.crew).filter(function(p){
            return p && /^(Writer|Screenplay|Story|Author|Created by)$/.test(p.job || '');
        }),4);
    }
    function certification(main, kind) {
        var data=main && main[kind==='tv'?'content_ratings':'release_dates'];
        var arr=list(data && data.results);
        function value(country) {
            var region=arr.filter(function(x){return x.iso_3166_1===country;})[0];
            if (!region) return '';
            if (kind==='tv') return clean(region.rating,20);
            var r=list(region.release_dates);
            for(var i=0;i<r.length;i++){
                if(r[i].certification) return clean(r[i].certification,20);
            }
            return '';
        }
        var ru=value('RU'),us=value('US');
        return ru ? 'Россия: '+ru : us ? 'США: '+us : '';
    }
    function verifiedTopics(main, alternative) {
        var sources=[main,alternative], words=[];
        sources.forEach(function(data){
            var obj=data && data.keywords || {};
            list(obj.keywords || obj.results).forEach(function(k){
                var term=clean(k&&k.name,90);
                if(term)words.push(term);
            });
        });
        words=unique(words.map(function(w){return w.toLowerCase();}));
        return TOPICS.filter(function(t){
            return words.some(function(w){return t.re.test(w);});
        }).map(function(t){return t.name;}).slice(0,8);
    }
    function matches(prefs, values) {
        var hits=[];
        list(values).forEach(function(v){
            list(prefs).forEach(function(p){
                if (clean(v,140).toLowerCase().indexOf(p)!==-1) hits.push(clean(v,140));
            });
        });
        return unique(hits).slice(0,4);
    }
    function gradeStats(en) {
        var ratings=list(en && en.reviews && en.reviews.results).map(function(r){
            var n=Number(r && r.author_details && r.author_details.rating);
            return isFinite(n) && n>0 && n<=10 ? n : null;
        }).filter(function(n){return n!==null;});
        if (ratings.length < 2) return null;
        return {mean:ratings.reduce(function(a,b){return a+b;},0)/ratings.length,n:ratings.length};
    }
    function year(date) {
        var m=clean(date,40).match(/^(?:18|19|20)\d{2}/);
        return m ? m[0] : '';
    }

    // Evidence first: a short, concrete reason must be traceable to the
    // current movie's TMDB fields or the user's own filters.
    function reviewSnapshot(main, en) {
        var seen={}, ratings=[];
        [main,en].forEach(function(source){
            list(source && source.reviews && source.reviews.results).forEach(function(review){
                if(!review)return;
                var id=clean(review.id||review.url||'',110);
                if(id && seen[id])return;
                if(id)seen[id]=true;
                var n=Number(review.author_details && review.author_details.rating);
                if(isFinite(n) && n>=1 && n<=10)ratings.push(n);
            });
        });
        var positives=0, negatives=0;
        ratings.forEach(function(n){if(n>=7)positives++;else if(n<=4)negatives++;});
        return {total:ratings.length,positive:positives,negative:negatives};
    }

    // Only report concrete review aspects if at least two separate rated reviews
    // agree; treat them as opinions, never as objective film facts.
    function reviewAspects(main,en){
        var sources=[main,en],reviewers={},candidates=[];
        sources.forEach(function(source){
            list(source&&source.reviews&&source.reviews.results).forEach(function(r){
                if(!r || !r.content)return;
                var id=clean(r.id||r.url||'',120);
                if(id && reviewers[id])return;
                if(id)reviewers[id]=true;
                var rating=Number(r.author_details&&r.author_details.rating);
                if(!isFinite(rating)||rating<1||rating>10)return;
                var content=clean(String(r.content).replace(/<[^>]+>/g,' '),8000).toLowerCase();
                if(content.length<25)return;
                candidates.push({content:content,rating:rating});
            });
        });
        var rules=[
            {key:'acting',name:'актёрскую игру',
                yes:/\b(?:excellent|great|amazing|strong|superb|outstanding) (?:acting|performances?)\b|\b(?:acting|performances?) (?:is|are|was|were) (?:excellent|great|amazing|superb)\b|отличн\w* игр\w* акт[её]р|сильн\w* акт[её]рск\w* игр/i,
                no:/\b(?:poor|bad|weak|wooden|terrible) (?:acting|performances?)\b|\b(?:acting|performances?) (?:is|are|was|were) (?:bad|weak|terrible)\b|слаб\w* игр\w* акт[её]р|плох\w* акт[её]рск\w* игр/i},
            {key:'visual',name:'визуальную часть',
                yes:/\b(?:beautiful|stunning|gorgeous|excellent|amazing) (?:cinematography|visuals|photography)\b|красив\w* (?:картинк\w*|съ[её]мк\w*|визуал)|отличн\w* операторск\w* работ/i,
                no:/\b(?:poor|bad|cheap|terrible) (?:cgi|visual effects|cinematography)\b|плох\w* (?:график\w*|спецэффект\w*|операторск\w* работ)/i},
            {key:'story',name:'сюжет',
                yes:/\b(?:excellent|great|brilliant|engaging|compelling) (?:story|plot|script|writing)\b|интересн\w* сюжет|сильн\w* сценар|продуманн\w* сюжет/i,
                no:/\b(?:weak|poor|bad|predictable|confusing) (?:story|plot|script|writing)\b|\bplot holes?\b|слаб\w* сценар|предсказуем\w* сюжет|сюжетн\w* дыр/i},
            {key:'pace',name:'темп повествования',
                yes:/\b(?:well.paced|perfect pacing|great pacing|tight pacing)\b|хорош\w* темп\w* повествован/i,
                no:/\b(?:slow pacing|too slow|drags? on|dragged on|poor pacing|uneven pacing)\b|затянут\w* (?:фильм|сюжет|сериал|повествован)|слишком медленн\w* темп/i},
            {key:'music',name:'музыку',
                yes:/\b(?:great|excellent|beautiful|amazing|fantastic) (?:soundtrack|score|music)\b|отличн\w* (?:саундтрек|музык\w*)|прекрасн\w* музык/i,
                no:/\b(?:bad|poor|annoying|terrible) (?:soundtrack|score|music)\b|плох\w* (?:саундтрек|музык\w*)/i}
        ];
        var pros=[],cons=[];
        rules.forEach(function(rule){
            var positive=0,negative=0;
            candidates.forEach(function(r){
                var sentences=r.content.split(/[.!?](?:\s|$)/);
                var yay=false,nay=false;
                sentences.forEach(function(sentence){
                    if(ratingAllows(r.rating,true) && rule.yes.test(sentence) &&
                        !negatedPhrase(sentence,rule.yes))yay=true;
                    if(ratingAllows(r.rating,false) && rule.no.test(sentence) &&
                        !negatedPhrase(sentence,rule.no))nay=true;
                });
                if(yay)positive++;
                if(nay)negative++;
            });
            if(positive>=2)pros.push('В '+positive+' отзывах TMDB хвалят '+rule.name+'.');
            if(negative>=2)cons.push('В '+negative+' отзывах TMDB критикуют '+rule.name+'.');
        });
        function ratingAllows(rating,pro){return pro?rating>=7:rating<=6;}
        function negatedPhrase(sentence,pattern){
            var m=sentence.match(pattern);
            if(!m)return false;
            var i=sentence.indexOf(m[0]);
            var prev=sentence.substring(Math.max(0,i-15),i);
            return /\b(?:not|never|no|isn't|wasn't)\s*$|(?:не|совсем не)\s*$/i.test(prev);
        }
        return {positive:pros.slice(0,2),negative:cons.slice(0,2),reviewCount:candidates.length};
    }

    function collectArguments(ctx){
        var pros=[],cons=[],seen={};
        function add(side,key,text){
            if(!text || seen[key])return;
            seen[key]=true;
            (side==='pro'?pros:cons).push(text);
        }
        if(ctx.matchedGenres.length)
            add('con','genre','Нежелательный жанр: '+ctx.matchedGenres.join(', ')+'.');
        if(ctx.matchedActors.length)
            add('con','cast','В составе есть актёры из вашего списка исключений: '+
                ctx.matchedActors.join(', ')+'.');
        if(ctx.matchedDirectors.length)
            add('con','director','Режиссёр из списка исключений: '+
                ctx.matchedDirectors.join(', ')+'.');
        var enough=ctx.votes>=150;
        if(enough && ctx.bayes >= ctx.threshold+0.7)
            add('pro','score','Высокая оценка TMDB: '+fixed(ctx.rating)+'/10 ('+
                number(ctx.votes)+' голосов).');
        else if(enough && ctx.bayes <= ctx.threshold-0.7)
            add('con','score','Оценка TMDB: '+fixed(ctx.rating)+'/10, ниже выбранного порога '+
                fixed(ctx.threshold)+'.');
        // Scores near the threshold are neutral, not evidence of a positive.
        if(ctx.votes<150)
            add('con','few-votes',ctx.votes ? 'Пока лишь '+number(ctx.votes)+
                ' оценок — вывод предварительный.' :
                'На TMDB пока нет достаточного количества оценок.');
        // Specific repeated review themes complement rating statistics.
        var aspects=ctx.aspects || {positive:[],negative:[]};
        aspects.positive.forEach(function(t,i){add('pro','aspect-pro-'+i,t);});
        aspects.negative.forEach(function(t,i){add('con','aspect-con-'+i,t);});
        var reviews=ctx.reviews;
        if(reviews.total>=4){
            if(reviews.positive/reviews.total>=.7)
                add('pro','reviews','Среди '+reviews.total+' отзывов с оценками на TMDB '+
                    reviews.positive+' положительных.');
            else if(reviews.negative/reviews.total>=.6)
                add('con','reviews','Среди '+reviews.total+' отзывов с оценками на TMDB '+
                    reviews.negative+' низких оценок.');
            else if(reviews.positive>=2 && reviews.negative>=2)
                add('con','reviews-mixed','Отзывы TMDB с оценками разделились: '+
                    reviews.positive+' положительных, '+reviews.negative+' отрицательных '+
                    'из '+reviews.total+'.');
        }
        if(ctx.kind==='movie' && ctx.runtime>0 && ctx.runtime<=95)
            add('pro','short','Хронометраж '+ctx.runtime+' минут — компактный фильм.');
        else if(ctx.kind==='movie' && ctx.runtime>=155) {
            var minutes=ctx.runtime, lastTwo=minutes%100, last=minutes%10;
            var unit=(lastTwo>=11 && lastTwo<=14) ? 'минут' :
                (last===1?'минута':(last>=2 && last<=4?'минуты':'минут'));
            add('con','long','Хронометраж '+minutes+' '+unit+
                ' — на просмотр потребуется больше времени.');
        }
        var count=Number(ctx.details && ctx.details.number_of_seasons)||0;
        if(ctx.kind==='tv' && count>=5)
            add('con','seasons','В сериале '+count+' сезонов — длительный просмотр.');
        if(ctx.kind==='movie' && ctx.details && ctx.details.belongs_to_collection &&
            ctx.details.belongs_to_collection.name)
            add('con','collection','Часть киносерии «'+
                clean(ctx.details.belongs_to_collection.name,100)+
                '». При желании проверьте порядок просмотра.');
        // Genre and theme are factual; they describe suitability rather than
        // pretending a film's action, script or acting has been watched.
        var topic=ctx.topics[0];
        if(topic) add('pro','topic','Тема по меткам TMDB: '+topic+'.');
        var genreNames=ctx.genres.filter(function(name){
            return clean(name).length>0;
        });
        if(genreNames.length && !ctx.matchedGenres.length)
            add('pro','genres','Жанры: '+genreNames.slice(0,2).join(', ')+'.');
        if(ctx.watched>=90)
            add('con','seen','В истории просмотра фильм уже отмечен как просмотренный.');
        if(pros.length===0)
            pros.push('Пока недостаточно подтверждённых данных о преимуществах.');
        if(cons.length===0)
            cons.push('Существенных ограничений по доступным сведениям не выявлено.');
        return {positive:pros.slice(0,4),caution:cons.slice(0,4)};
    }

    function analyze(movie) {
        var cfg=settings(), kind=type(movie);
        return loadMeta(movie).then(function(payload){
            var main=payload.main || payload.en || {},en=payload.en || {};
            var genreObjs=genreList(payload.main || payload.en,movie);
            var genres=genreObjs.map(function(g){return g.name;});
            var genreIDs=genreObjs.map(function(g){return g.id;});
            var credits=main.credits || movie.credits || {};
            var cast=names(list(credits.cast).slice(0,16),8);
            var dir=directors(credits), write=writers(credits);
            var matchedGenres=matches(cfg.genres,genreObjs.reduce(function(a,g){
                return a.concat(g.aliases);
            },[]));
            var matchedActors=matches(cfg.actors,cast);
            var matchedDirectors=matches(cfg.directors,dir);
            var rating=Number(main.vote_average !== undefined ? main.vote_average : movie.vote_average);
            var votes=Number(main.vote_count !== undefined ? main.vote_count : movie.vote_count);
            if (!isFinite(rating) || rating<=0 || rating>10) rating=0;
            if (!isFinite(votes) || votes<0) votes=0;
            if (!votes) rating=0;
            var bayes=votes ? (votes*rating+180*6.1)/(votes+180) : 0;
            var threshold=cfg.min;
            var hasDislikes=matchedGenres.length+matchedActors.length+matchedDirectors.length>0;
            var verdict='СПОРНО', tone='maybe';
            if (hasDislikes) {verdict='НЕ СТОИТ';tone='no';}
            else if (votes<35) {verdict='МАЛО ДАННЫХ';tone='unknown';}
            else if(votes>=150 && bayes>=threshold+0.7) {verdict='СТОИТ';tone='yes';}
            else if(votes>=150 && bayes<=threshold-0.7) {verdict='НЕ СТОИТ';tone='no';}
            var confidence=votes>=1500?'Много оценок':votes>=150?'Достаточно оценок':
                votes>0?'Мало оценок':'Нет оценок';
            if(!payload.main && !payload.en) confidence+=' · TMDB не удалось проверить';
            // Arguments are gathered after the remaining metadata has been examined.
            var age=certification(payload.main || payload.en,kind);
            var watched=0;
            try {
                if (Lampa.Timeline && typeof Lampa.Timeline.get==='function') {
                    var tm=Lampa.Timeline.get(String(movie.id || movie.tmdb_id));
                    if (tm && tm.duration>0) watched=Math.round(100*tm.time/tm.duration);
                }
            } catch(e) {}
            // Watched state is evaluated with the other evidence below.
            var reason = hasDislikes ? 'Совпадение с вашими исключениями.'
                : votes<35 ? 'Пока недостаточно оценок для уверенного вывода.'
                : verdict==='СТОИТ' ? 'Рейтинг заметно выше выбранного порога.'
                : verdict==='НЕ СТОИТ' ? 'Рейтинг ниже выбранного порога.'
                : 'Оценки не дают однозначного ответа.';
            var facts=[];
            function fact(label,value,origin) {
                value=clean(value,450);
                if(value && facts.length<26)facts.push({
                    label:label,value:value,origin:origin || (payload.main || payload.en ? 'TMDB' : 'Карточка Lampa')
                });
            }
            var highlights=[];
            function highlight(title, description) {
                title=clean(title,160);description=clean(description,420);
                if(title && highlights.length<5) highlights.push({title:title,body:description});
            }
            var title=clean(movie.title||movie.name||main.title||main.name||'Фильм',250);
            var firstDate=main.release_date||main.first_air_date||movie.release_date||movie.first_air_date;
            var original=clean(main.original_title||main.original_name||movie.original_title||movie.original_name,200);
            var displayed=clean(main.title||main.name||movie.title||movie.name,200);
            if(original && displayed && normalizeName(original)!==normalizeName(displayed)){
                fact('Оригинальное название',original);
                highlight('Другое название', 'Оригинальное название: «'+original+'».');
            }
            fact(kind==='tv'?'Начало показа':'Премьера',clean(firstDate,40));
            fact('Жанры',genres.join(', '));
            fact('Режиссёр',dir.join(', '));
            fact('Сценарий',write.join(', '));
            var joint=dir.filter(function(d){return write.indexOf(d)!==-1;});
            if(joint.length)highlight('Авторский фильм',
                joint[0]+' указан в TMDB одновременно как режиссёр и автор сценария.');
            fact('В ролях',cast.slice(0,6).join(', '));
            var duration=Number(main.runtime || movie.runtime || (main.episode_run_time && main.episode_run_time[0]) || 0);
            if(duration>0 && duration<1200)fact(kind==='tv'?'Длительность серии':'Хронометраж',duration+' мин');
            if(kind==='movie' && main.belongs_to_collection && main.belongs_to_collection.name){
                var collection=clean(main.belongs_to_collection.name,140);
                fact('Киносерия',collection);
                highlight('Часть киносерии', 'Входит в коллекцию «'+collection+'» по данным TMDB.');
            }
            var budget=Number(main.budget||0), revenue=Number(main.revenue||0);
            function money(amount){return '$'+number(Math.round(amount));}
            if(kind==='movie' && isFinite(budget) && budget>0)fact('Бюджет (TMDB)',money(budget));
            if(kind==='movie' && isFinite(revenue) && revenue>0)fact('Сборы (TMDB)',money(revenue));
            if(budget>0 && revenue>0)highlight('Бюджет и сборы',
                'В TMDB указано: бюджет '+money(budget)+', мировые сборы '+money(revenue)+
                '. Эти цифры не равны чистой прибыли.');
            if(kind==='tv') {
                if(Number(main.number_of_seasons)>0) fact('Сезоны',main.number_of_seasons);
                if(Number(main.number_of_episodes)>0) fact('Эпизоды',main.number_of_episodes);
                var creators=names(main.created_by,4);
                if(creators.length)fact('Создатели',creators.join(', '));
                if(main.status)fact('Статус',clean(main.status,60));
                if(main.first_air_date && main.last_air_date &&
                    year(main.first_air_date)!==year(main.last_air_date)){
                    highlight('Период выхода','Первые серии датированы '+year(main.first_air_date)+
                        ' годом, последние — '+year(main.last_air_date)+' годом (TMDB).');
                }
            }
            var country=unique(list(main.production_countries).map(function(c){
                return clean(c && c.name,70);
            })).slice(0,4);
            fact('Страны производства',country.join(', '));
            fact('Студия',names(main.production_companies,3).join(', '));
            var language=clean(main.original_language||movie.original_language,10);
            if(language)fact('Язык оригинала',LANGS[language]||language.toUpperCase());
            fact('Возрастной рейтинг',age);
            if(rating && votes) fact('Рейтинг TMDB',fixed(rating)+'/10 ('+number(votes)+' оценок)');
            var reviewGrades=gradeStats(en);
            if(reviewGrades)fact('Оценки авторов отзывов',
                fixed(reviewGrades.mean)+'/10 · выборка '+reviewGrades.n+' отзывов');
            var topics=verifiedTopics(payload.main || movie, payload.en);
            var args=collectArguments({
                rating:rating,votes:votes,bayes:bayes,threshold:threshold,
                matchedGenres:matchedGenres,matchedActors:matchedActors,
                matchedDirectors:matchedDirectors,genres:genres,topics:topics,
                runtime:duration,kind:kind,details:main,watched:watched,
                reviews:reviewSnapshot(payload.main,payload.en),
                aspects:reviewAspects(payload.main,payload.en)
            });
            var positive=args.positive,caution=args.caution;
            var genreLine=genres.length?genres.slice(0,3).join(', '):'жанр не указан';
            var idHas=function(id){return genreIDs.indexOf(id)>=0;};
            var tempo=idHas(28)||idHas(12)||idHas(10759)?'Скорее бодрый':
                idHas(18)||idHas(36)||idHas(99)?'Скорее неспешный':'Как пойдёт';
            var tension=idHas(27)||idHas(53)?'Может быть напряжённо':
                idHas(35)||idHas(10751)?'Скорее спокойно':'Трудно сказать';
            var feeling=idHas(18)||idHas(10749)?'Может задеть за живое':
                idHas(35)?'Скорее лёгкий':'По жанру неясно';
            var atmos=[
                {label:'Темп',value:tempo},
                {label:'Напряжение',value:tension},
                {label:'Эмоциональность',value:feeling}
            ];
            var accuracy=(payload.main || payload.en) ? 'Данные фильма подтверждены TMDB'
                : 'Неполные сведения из карточки Lampa';
            var position=votes?Math.max(7,Math.min(93,Math.round(50+(bayes-threshold)*12))):50;
            return {
                title:title,kind:kind,year:year(firstDate),verdict:verdict,tone:tone,original:original,
                reason:reason,rating:rating,votes:votes,confidence:confidence,
                threshold:threshold,position:position,
                positive:positive,caution:caution,facts:facts,topics:topics,highlights:highlights,
                atmos:atmos,genreLine:genreLine,accuracy:accuracy,
                partial:!(payload.main || payload.en),disliked:hasDislikes,
                displayAge:age,studio:(main.production_companies||[]).length>0,
                hasTrailer:list(en.videos&&en.videos.results).some(function(v){
                    return v && v.type==='Trailer' && v.site==='YouTube';
                })
            };
        });
    }



    // v57: native Lampa typography, carefully layered cards and no clipping.
    // Only opacity is animated: transformed blocks can clip against TV scroll view.
    function styles() {
        if(document.getElementById('sw59-styles'))return;
        var el=document.createElement('style');
        el.id='sw59-styles';
        el.textContent="\n/* ShouldWatch v59: original visual order, readable TV focus and no fake gauges. */\n.sw59,.sw59 *,.sw59 *::before,.sw59 *::after{box-sizing:border-box}\n.sw59{--sw59-green:#82dba3;--sw59-red:#f18b8a;--sw59-yellow:#f1c27a;\n--sw59-blue:#a3cffa;max-width:100%;min-width:0;width:100%;\nfont-family:inherit;color:inherit;line-height:1.44;padding:.08em .1em 1em}\n.sw59 *{min-width:0;max-width:100%;overflow-wrap:break-word}\n.sw59-loading{padding:2.2em 1em;display:flex;flex-direction:column;gap:.6em}\n.sw59-loading strong{font-size:1.18em}\n.sw59-loading span{font-size:.85em;opacity:.72}\n.sw59-progress{width:8em;height:.22em;overflow:hidden;border-radius:1em;\nbackground:rgba(180,180,180,.17);margin-top:.6em}\n.sw59-progress::after{content:\"\";display:block;width:45%;height:100%;\nbackground:#b4d9fa;animation:sw59-loading 1.1s ease-in-out infinite alternate}\n@keyframes sw59-loading{from{transform:translateX(-100%)}to{transform:translateX(260%)}}\n.sw59-body{animation:sw59-in .22s ease-out both}\n@keyframes sw59-in{from{opacity:.23}to{opacity:1}}\n.sw59-verdict{position:relative;padding:1em 1.13em .89em;border-radius:.86em;\nborder:1px solid rgba(160,160,160,.2);background:linear-gradient(130deg,\nrgba(87,91,99,.26),rgba(53,57,67,.24));\nbox-shadow:0 .35em 1.2em rgba(0,0,0,.16);margin-bottom:.62em}\n.sw59-verdict::before{content:\"\";position:absolute;top:0;left:1.14em;\nheight:3px;width:3.8em;max-width:38%;border-radius:0 0 4px 4px;background:var(--sw59-blue)}\n.sw59-verdict--yes{border-color:rgba(130,219,163,.34);background:linear-gradient(125deg,rgba(49,112,74,.31),rgba(48,64,56,.20))}\n.sw59-verdict--no{border-color:rgba(241,139,138,.31);background:linear-gradient(125deg,rgba(118,49,53,.28),rgba(64,53,57,.2))}\n.sw59-verdict--maybe{border-color:rgba(241,194,122,.3);background:linear-gradient(125deg,rgba(129,89,38,.24),rgba(65,57,43,.19))}\n.sw59-verdict--unknown{border-color:rgba(163,207,250,.31);background:linear-gradient(125deg,rgba(53,81,111,.27),rgba(49,59,69,.19))}\n.sw59-verdict--yes::before{background:var(--sw59-green)}\n.sw59-verdict--no::before{background:var(--sw59-red)}\n.sw59-verdict--maybe::before{background:var(--sw59-yellow)}\n.sw59-verdict-top{display:flex;justify-content:space-between;align-items:center;gap:.7em}\n.sw59-verdict-name{font-size:1.54em;font-weight:790;line-height:1.13;\nletter-spacing:-.02em;text-transform:none;overflow-wrap:anywhere}\n.sw59-verdict--yes .sw59-verdict-name{color:var(--sw59-green)}\n.sw59-verdict--no .sw59-verdict-name{color:var(--sw59-red)}\n.sw59-verdict--maybe .sw59-verdict-name{color:var(--sw59-yellow)}\n.sw59-verdict--unknown .sw59-verdict-name{color:var(--sw59-blue)}\n.sw59-rating{flex:0 0 auto;white-space:nowrap;border:1px solid rgba(241,194,122,.31);\nborder-radius:.46em;padding:.3em .56em;background:rgba(166,113,34,.17);\nfont-weight:700;color:var(--sw59-yellow);font-size:1em}\n.sw59-summary{font-size:.94em;line-height:1.42;margin-top:.55em;opacity:.91}\n.sw59-meter{height:.31em;border-radius:.5em;background:rgba(188,188,188,.18);\noverflow:hidden;margin-top:.84em;position:relative}\n.sw59-meter-fill{height:100%;width:0;border-radius:inherit;\ntransition:width .62s cubic-bezier(.2,.7,.28,1);background:var(--sw59-blue)}\n.sw59-verdict--yes .sw59-meter-fill{background:var(--sw59-green)}\n.sw59-verdict--no .sw59-meter-fill{background:var(--sw59-red)}\n.sw59-verdict--maybe .sw59-meter-fill{background:var(--sw59-yellow)}\n.sw59-rating-note{font-size:.71em;opacity:.62;margin-top:.5em;line-height:1.35}\n.sw59-dice{width:100%;max-width:100%;min-height:3.55em;display:flex;\nalign-items:center;justify-content:center;gap:.75em;padding:.54em 1em;\nbackground:linear-gradient(130deg,rgba(85,101,124,.27),rgba(52,61,76,.22));\nborder:1px solid rgba(163,207,250,.29);border-radius:.72em;\ncursor:pointer;margin-bottom:.65em;outline:none;transition:background .18s ease,border-color .18s ease,box-shadow .18s ease}\n.sw59-dice:hover{background:rgba(93,128,167,.31)}\n.sw59-dice.focus,.sw59-tab.focus{background:#f3f5f7!important;color:#182029!important;\nborder-color:#fff!important;box-shadow:0 0 0 2px rgba(255,255,255,.95)}\n.sw59-dice-copy{display:flex;flex-direction:column;justify-content:center;min-width:0;gap:.12em}\n.sw59-dice-svg{display:flex;align-items:center;justify-content:center;\nflex:0 0 2.1em;width:2.1em;height:2.1em;max-width:none}\n.sw59-dice-svg svg{width:2.1em;height:2.1em;display:block;max-width:none}\n.sw59-dice-title{font-size:1.02em;font-weight:720;line-height:1.32}\n.sw59-dice-hint{font-size:.68em;opacity:.65;line-height:1.32;margin-top:.14em}\n.sw59-dice.is-rolling .sw59-dice-svg{animation:sw59-toss .38s cubic-bezier(.24,.65,.3,1)}\n@keyframes sw59-toss{0%{transform:rotate(0) translateY(0)}\n45%{transform:rotate(22deg) translateY(-.35em)}\n100%{transform:rotate(0) translateY(0)}}\n.sw59-tabs{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.54em;\nmargin-bottom:.67em}\n.sw59-tab{display:flex;align-items:center;justify-content:center;min-height:2.85em;\nborder-radius:.62em;padding:.5em .4em;\nbackground:rgba(85,93,104,.24);border:1px solid rgba(180,180,180,.14);\ncolor:inherit;opacity:.72;font-size:.89em;font-weight:690;\ncursor:pointer;text-align:center;line-height:1.3;transition:background .18s ease,opacity .18s ease}\n.sw59-tab.active{opacity:1;background:rgba(104,139,177,.3);\nborder-color:rgba(162,207,250,.53);color:#b9ddff}\n.sw59-pane{display:none;min-width:0}\n.sw59-pane.active{display:block;animation:sw59-in .18s ease-out both}\n.sw59-columns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.65em}\n.sw59-col{min-width:0;border:1px solid rgba(170,170,170,.15);border-radius:.69em;\npadding:.9em 1em;background:linear-gradient(130deg,rgba(87,96,109,.18),rgba(53,57,64,.19));\nbox-shadow:0 .28em .8em rgba(0,0,0,.11)}\n.sw59-col--good{border-color:rgba(130,219,163,.28)}\n.sw59-col--bad{border-color:rgba(241,194,122,.28)}\n.sw59-col-head{font-size:.94em;font-weight:750;margin-bottom:.55em}\n.sw59-col--good .sw59-col-head{color:var(--sw59-green)}\n.sw59-col--bad .sw59-col-head{color:var(--sw59-yellow)}\n.sw59-col-list{margin:0;padding:0;list-style:none}\n.sw59-col-list li{font-size:.88em;line-height:1.46;padding:.42em 0;\nborder-top:1px solid rgba(188,188,188,.12)}\n.sw59-col-list li:first-child{padding-top:0;border-top:0}\n.sw59-extra{display:flex;flex-wrap:wrap;gap:.43em;margin-top:.6em}\n.sw59-extra-item{font-size:.72em;line-height:1.37;padding:.37em .55em;\nborder-radius:.43em;border:1px solid rgba(143,194,240,.23);background:rgba(63,108,155,.15)}\n.sw59-extra-item strong{color:var(--sw59-blue)}\n.sw59-atmos{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.6em}\n.sw59-atmos-card{border-radius:.64em;padding:.85em .9em;border:1px solid rgba(163,207,250,.2);\nbackground:linear-gradient(130deg,rgba(63,95,126,.24),rgba(51,60,73,.17))}\n.sw59-atmos-card:nth-child(2){border-color:rgba(241,194,122,.3);\nbackground:rgba(107,86,56,.21)}\n.sw59-atmos-card:nth-child(3){border-color:rgba(130,219,163,.28);\nbackground:rgba(61,95,75,.2)}\n.sw59-atmos-title{font-size:.76em;opacity:.78;margin-bottom:.33em}\n.sw59-atmos-text{font-size:1.01em;font-weight:650;line-height:1.32}\n.sw59-atmos-note{font-size:.74em;opacity:.71;margin-top:.74em}\n.sw59-modal .modal__head{margin-bottom:.63em}\n.sw59-modal .modal__title{font-size:1.32em;line-height:1.28;overflow-wrap:anywhere}\n.sw59-modal .modal__content,.sw59-modal .modal__body,.sw59-modal .scroll,\n.sw59-modal .scroll__body,.sw59-modal .scroll__content{max-width:100%;min-width:0}\n.sw59-modal .modal__footer{display:none!important}\n.sw59-trigger{max-width:100%;min-width:0}\n.sw59-trigger svg{width:1.45em;height:1.45em}\n.sw59-host .sw57-trigger,.sw59-host .sw58-trigger,.sw59-host .sw56-trigger,\n.sw59-host .sw55-trigger,.sw59-host .sw-custom-button-enhanced{display:none!important}\n.sw59-trigger.sw59-busy{opacity:.64;pointer-events:none}\n@media(min-width:940px) and (min-height:540px){\n.sw59-modal .modal__content{max-width:84%}\n.sw59-col-list li{font-size:.84em}\n.sw59-columns{gap:.75em}\n}\n@media(max-width:620px){\n.sw59-columns{grid-template-columns:minmax(0,1fr);gap:.45em}\n.sw59-col{padding:.73em .84em}\n.sw59-col-list li{font-size:.87em;padding:.3em 0}\n.sw59-atmos{grid-template-columns:minmax(0,1fr)}\n.sw59-verdict-name{font-size:1.3em}\n.sw59-rating{font-size:.88em}\n.sw59-tab{font-size:.83em}\n.sw59-modal .modal__title{font-size:1.15em}\n}\n@media(prefers-reduced-motion:reduce){\n.sw59-body,.sw59-pane,.sw59-dice.is-rolling .sw59-dice-svg,\n.sw59-progress::after{animation:none!important}\n.sw59-dice,.sw59-tab,.sw59-meter-fill{transition:none!important}\n}\n";
        el.textContent += "\n/* v60: functional red/green emphasis, stable dice and restrained motion */\n.sw59{--sw59-red:#f2767c}\n.sw59-col--bad{\n border-color:rgba(242,118,124,.41);\n background:rgba(116,47,57,.21);\n}\n.sw59-col--bad .sw59-col-head{color:var(--sw59-red)}\n.sw59-col--good{background:rgba(46,94,65,.18)}\n.sw59-verdict::before{display:none}\n.sw59-verdict{box-shadow:0 .25em .72em rgba(0,0,0,.16)}\n.sw59-verdict--yes{border-left:3px solid var(--sw59-green)}\n.sw59-verdict--no{border-left:3px solid var(--sw59-red)}\n.sw59-verdict--maybe{border-left:3px solid var(--sw59-yellow)}\n.sw59-verdict--unknown{border-left:3px solid var(--sw59-blue)}\n.sw59-col,.sw59-atmos-card{box-shadow:none}\n.sw59-dice{\n display:grid;\n grid-template-columns:2.15em minmax(0,1fr) 2.15em;\n align-items:center;gap:.58em;\n height:4.15em;min-height:4.15em;max-height:4.15em;\n padding:.5em .83em;\n}\n.sw59-dice-svg{grid-column:1;grid-row:1;width:2.1em;height:2.1em;\n flex:none;justify-self:center}\n.sw59-dice-copy{grid-column:2;grid-row:1;\n align-items:center;justify-content:center;text-align:center;min-height:2.8em;\n width:100%;overflow:hidden;gap:.05em}\n.sw59-dice::after{content:\"\";grid-column:3;grid-row:1;width:2.15em}\n.sw59-dice-title{display:block;font-size:1.02em;font-weight:720;\n line-height:1.34;min-height:1.34em;white-space:nowrap;overflow:hidden;\n text-overflow:ellipsis}\n.sw59-dice-hint{display:block;font-size:.67em;line-height:1.27;\n min-height:1.27em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}\n@keyframes sw60-slide{from{opacity:0;transform:translateY(.3em)}\n to{opacity:1;transform:translateY(0)}}\n.sw59-verdict{animation:sw60-slide .32s cubic-bezier(.21,.73,.25,1) both}\n.sw59-dice{animation:sw60-slide .35s cubic-bezier(.21,.73,.25,1) .045s both}\n.sw59-tabs{animation:sw60-slide .33s cubic-bezier(.21,.73,.25,1) .075s both}\n.sw59-pane.active{animation:sw59-in .2s ease-out both}\n.sw59-col{animation:sw59-in .24s ease-out both}\n.sw59-col:nth-child(2){animation-delay:.065s}\n.sw59-tab.active{transition:background .2s ease,color .2s ease,border-color .2s ease}\n.sw59-dice.focus{box-shadow:0 0 0 2px #fff,0 .2em .6em rgba(0,0,0,.25)}\n@media(max-width:400px){\n .sw59-dice{grid-template-columns:1.85em minmax(0,1fr) 1.85em;\n gap:.38em;padding:.45em .62em}\n .sw59-dice::after{width:1.85em}\n .sw59-dice-title{font-size:.92em}\n}\n@media(prefers-reduced-motion:reduce){\n .sw59-verdict,.sw59-dice,.sw59-tabs,.sw59-col{animation:none!important}\n}\n";
        document.head.appendChild(el);
    }

    function detail(label,value){
        return '<div class="sw57-info"><div class="sw57-info__key">'+esc(label)+'</div>'+
            '<div class="sw57-info__val">'+esc(value)+'</div></div>';
    }
    function infoCard(label,content,tone) {
        return '<div class="sw57-card sw57-card--'+tone+'">'+
            '<div class="sw57-card__heading"><span class="sw57-card__indicator"></span>'+
            '<span>'+esc(label)+'</span></div>'+
            '<div class="sw57-card__items">'+content+'</div></div>';
    }
    function noteLines(arr){
        return list(arr).slice(0,4).map(function(t){
            return '<div class="sw57-point">'+esc(t)+'</div>';
        }).join('');
    }


    function diceFace(face){
        var places={
            1:[[12,12]], 2:[[7,7],[17,17]],
            3:[[7,7],[12,12],[17,17]],
            4:[[7,7],[17,7],[7,17],[17,17]],
            5:[[7,7],[17,7],[12,12],[7,17],[17,17]],
            6:[[7,6],[17,6],[7,12],[17,12],[7,18],[17,18]]
        };
        return '<svg viewBox="0 0 24 24" aria-hidden="true">'+
            '<rect x="1" y="1" width="22" height="22" rx="5" fill="#f7f8fa"/>'+
            (places[face]||places[1]).map(function(p){
                return '<circle cx="'+p[0]+'" cy="'+p[1]+'" r="2" fill="#e64c56"/>';
            }).join('')+'</svg>';
    }
    function smallFacts(a){
        var order=['Режиссёр','Хронометраж','Длительность серии','Возрастной рейтинг',
            'Создатели','Страны производства'];
        var found={};
        list(a.facts).forEach(function(f){if(f&&f.label&&f.value&&!found[f.label])found[f.label]=f.value;});
        return order.filter(function(n){return found[n];}).slice(0,3)
            .map(function(n){return '<span class="sw59-extra-item"><strong>'+esc(n)+
                ':</strong> '+esc(found[n])+'</span>';}).join('');
    }
    function classicView(a){
        var verdict=a.tone==='yes'?'Стоит смотреть':a.tone==='no'?'Не стоит смотреть':
            a.tone==='unknown'?'Мало данных':'Неоднозначно';
        var mood=list(a.atmos).slice(0,3).map(function(m){
            return '<div class="sw59-atmos-card">'+
                '<div class="sw59-atmos-title">'+esc(m.label)+'</div>'+
                '<div class="sw59-atmos-text">'+esc(m.value)+'</div></div>';
        }).join('');
        var good=a.positive.length?a.positive:
            ['Преимущества пока не подтверждены доступными данными.'];
        var caution=a.caution.length?a.caution:
            ['Явных ограничений по доступным данным не найдено.'];
        var factChips=smallFacts(a);
        var hasRating=a.rating>0 && a.votes>0;
        var bar=hasRating ? Math.max(0,Math.min(100,Math.round(a.rating*10))):0;
        return '<div class="sw59-body">'+
            '<section class="sw59-verdict sw59-verdict--'+esc(a.tone)+'">'+
                '<div class="sw59-verdict-top">'+
                    '<div class="sw59-verdict-name">'+esc(verdict)+'</div>'+
                    (hasRating?'<div class="sw59-rating">★ '+fixed(a.rating)+'</div>':'')+
                '</div>'+
                '<div class="sw59-summary">'+esc(a.reason)+'</div>'+
                (hasRating?'<div class="sw59-meter"><div class="sw59-meter-fill" data-width="'+bar+'"></div></div>':'')+
                '<div class="sw59-rating-note">'+
                    (hasRating?'TMDB · '+number(a.votes)+' оценок':'Оценок пока нет')+
                    ' · '+esc(a.confidence)+'</div>'+
            '</section>'+
            '<div class="sw59-dice selector sw59-focusable" id="sw59-roll" tabindex="0">'+
                '<span class="sw59-dice-svg">'+diceFace(1)+'</span>'+
                '<span class="sw59-dice-copy"><span class="sw59-dice-title">Бросить кубик</span>'+
                    '<span class="sw59-dice-hint">Случайный выбор · 50/50</span></span>'+
            '</div>'+
            '<div class="sw59-tabs">'+
                '<div class="sw59-tab selector sw59-focusable active" data-pane="pros" tabindex="0">плюсы и минусы</div>'+
                '<div class="sw59-tab selector sw59-focusable" data-pane="atmos" tabindex="0">атмосфера и темп</div>'+
            '</div>'+
            '<div class="sw59-pane active" data-content="pros">'+
                '<div class="sw59-columns">'+
                    '<div class="sw59-col sw59-col--good">'+
                        '<div class="sw59-col-head">Плюсы</div>'+
                        '<ul class="sw59-col-list">'+good.slice(0,4).map(function(t){return '<li>'+esc(t)+'</li>';}).join('')+'</ul>'+
                    '</div>'+
                    '<div class="sw59-col sw59-col--bad">'+
                        '<div class="sw59-col-head">Минусы</div>'+
                        '<ul class="sw59-col-list">'+caution.slice(0,4).map(function(t){return '<li>'+esc(t)+'</li>';}).join('')+'</ul>'+
                    '</div>'+
                '</div>'+
                (factChips?'<div class="sw59-extra">'+factChips+'</div>':'')+
            '</div>'+
            '<div class="sw59-pane" data-content="atmos">'+
                '<div class="sw59-atmos">'+mood+'</div>'+
                '<div class="sw59-atmos-note">Предположения по жанрам, не оценки зрителей.</div>'+
                (a.genreLine && a.genreLine!=='жанр не указан'?
                    '<div class="sw59-extra"><span class="sw59-extra-item">'+esc(a.genreLine)+'</span></div>':'')+
            '</div>'+
        '</div>';
    }


    var SW59_CONTROLLER='should_watch_v59';
    function currentScroll(){
        try{return Lampa.Modal && typeof Lampa.Modal.scroll==='function'?Lampa.Modal.scroll():null;}
        catch(e){return null;}
    }
    function scrollBy(dir){
        var scroll=currentScroll();
        if(scroll && typeof scroll.wheel==='function'){
            scroll.wheel(dir*Math.max(110,Math.round((window.innerHeight||650)*.25)));
        }
    }
    function controls(){
        return state.sheet?state.sheet.find('.sw59-focusable').filter(':visible'):$();
    }
    function focusControl(el,doScroll){
        if(!state.sheet || !el || !el.length)return;
        state.sheet.find('.sw59-focusable').removeClass('focus');
        el.addClass('focus');
        state.focused=el[0];
        if(doScroll){
            try{
                var sc=currentScroll();
                if(sc && typeof sc.update==='function')sc.update(el,false);
            }catch(e){}
        }
    }
    function moveControl(delta){
        var set=controls();
        if(!set.length)return;
        var i=set.index(state.focused);
        i=i<0?0:(i+delta+set.length)%set.length;
        focusControl(set.eq(i),true);
    }
    function runFocused(){
        var current=state.focused?$(state.focused):controls().first();
        if(current.length)current.trigger('click');
    }
    function registerTVController(){
        if(!Lampa.Controller || typeof Lampa.Controller.add!=='function')return;
        try{Lampa.Controller.add(SW59_CONTROLLER,{
            toggle:function(){if(state.opened)focusControl(controls().first(),false);},
            up:function(){scrollBy(-1);},
            down:function(){scrollBy(1);},
            left:function(){moveControl(-1);},
            right:function(){moveControl(1);},
            enter:runFocused,
            ok:runFocused,
            back:close
        });}catch(e){console.warn('[ShouldWatch] TV controls unavailable:',e);}
    }
    function close(){
        if(!state.opened)return;
        state.opened=false;
        state.run++;
        if(state.diceTimer)clearTimeout(state.diceTimer);
        state.diceTimer=null;
        var backTo=state.prevController||'full';
        state.answer=null;state.focused=null;state.sheet=null;state.content=null;
        try{Lampa.Modal.close();}catch(e){}
        try{
            if(Lampa.Controller && typeof Lampa.Controller.enabled==='function'){
                var now=Lampa.Controller.enabled();
                if(now && now.name===SW59_CONTROLLER)Lampa.Controller.toggle(backTo);
            }
        }catch(e){}
    }
    function switchPane(which){
        if(!state.opened || !state.answer || !state.sheet)return;
        var pane=which==='atmos'?'atmos':'pros';
        state.sheet.find('.sw59-tab').removeClass('active');
        var button=state.sheet.find('.sw59-tab[data-pane="'+pane+'"]');
        button.addClass('active');
        state.sheet.find('.sw59-pane').removeClass('active');
        state.sheet.find('.sw59-pane[data-content="'+pane+'"]').addClass('active');
        focusControl(button,false);
        var sc=currentScroll();
        try{if(sc && typeof sc.reset==='function')sc.reset();}catch(e){}
    }
    function randomChoice(){
        if(!state.opened || !state.answer || state.rolling)return;
        var btn=state.sheet.find('#sw59-roll');
        if(!btn.length)return;
        state.rolling=true;
        var token=state.run,choice=Math.random()<.5;
        btn.addClass('is-rolling');
        state.diceTimer=setTimeout(function(){
            if(token!==state.run || !state.opened)return;
            var el=state.sheet.find('#sw59-roll');
            el.find('.sw59-dice-svg').html(diceFace(1+Math.floor(Math.random()*6)));
            el.find('.sw59-dice-title').text(choice?'Смотреть':'Не смотреть');
            el.find('.sw59-dice-hint').text('Случайный выбор · 50/50');
            el.removeClass('is-rolling');
            state.rolling=false;
        },390);
    }
    function bindClassic(){
        if(!state.sheet)return;
        state.sheet.find('.sw59-tab').off('click.sw59').on('click.sw59',function(){
            switchPane($(this).attr('data-pane'));
        });
        state.sheet.find('#sw59-roll').off('click.sw59').on('click.sw59',randomChoice);
        var meter=state.sheet.find('.sw59-meter-fill');
        setTimeout(function(){
            if(!state.opened || !meter.length || !meter.closest('body').length)return;
            meter.css('width',(Number(meter.attr('data-width'))||0)+'%');
        },35);
        focusControl(state.sheet.find('#sw59-roll'),false);
        try{var sc=currentScroll();if(sc && typeof sc.reset==='function')sc.reset();}catch(e){}
    }
    function notify(t){
        try{if(Lampa.Noty && Lampa.Noty.show)Lampa.Noty.show(t);}catch(e){}
    }
    function stillOnCard(m){
        try{
            var active=Lampa.Activity&&Lampa.Activity.active&&Lampa.Activity.active();
            var card=active && active.card;
            if(card && card.id && m && m.id &&
                (String(card.id)!==String(m.id)||type(card)!==type(m)))return false;
        }catch(e){}
        return true;
    }
    function show(m,trigger){
        if(!m || typeof m!=='object' || state.opened ||
            Date.now()-state.lastOpen<350 || !Lampa.Modal || !Lampa.Modal.open)return;
        state.lastOpen=Date.now();
        var token=++state.run,button=trigger&&trigger.length?trigger:null;
        state.rolling=false;state.focused=null;state.movie=m;state.answer=null;
        state.opened=true;state.useCustom=false;
        try{
            if(Lampa.Controller && typeof Lampa.Controller.enabled==='function'){
                var previous=Lampa.Controller.enabled();
                state.prevController=previous && previous.name || 'full';
            }
        }catch(e){state.prevController='full';}
        state.sheet=$('<div class="sw59"/>');
        // Keep native Lampa sizing; don't repeat fixed 20px+ monospaced type.
        state.sheet.css('font-size',
            Math.max(.94,Math.min(1.17,settings().font/19)).toFixed(2)+'em');
        state.content=$('<div class="sw59-content"/>');
        state.sheet.append(state.content);
        state.content.html('<div class="sw59-loading"><strong>'+
            esc(m.title||m.name||'Фильм')+'</strong>'+
            '<span>Смотрим, что про него известно…</span>'+
            '<div class="sw59-progress"></div></div>');
        if(button)button.addClass('sw59-busy');
        try{
            Lampa.Modal.open({
                title:'Стоит ли смотреть: '+clean(m.title||m.name||'Фильм',160),
                size:'large',html:state.sheet,
                onSelect:function(el){
                    if(!el || !el.attr)return;
                    var which=el.attr('data-pane');
                    if(which)switchPane(which);
                    else if(el.attr('id')==='sw59-roll')randomChoice();
                },
                onBack:close
            });
            state.sheet.closest('.modal').addClass('sw59-modal');
        }catch(e){
            state.opened=false;state.sheet=null;state.content=null;
            if(button)button.removeClass('sw59-busy');
            console.error('[ShouldWatch] modal:',e);
            return;
        }
        // A controller failure must not strand an open modal on its loader.
        try{
            if(Lampa.Controller && typeof Lampa.Controller.toggle==='function' &&
                typeof Lampa.Controller.add==='function'){
                Lampa.Controller.toggle(SW59_CONTROLLER);
                state.useCustom=true;
            }
        }catch(e){
            state.useCustom=false;
            console.warn('[ShouldWatch] Using native modal navigation:',e);
        }
        analyze(m).then(function(a){
            if(button)button.removeClass('sw59-busy');
            if(token!==state.run || !state.opened || !stillOnCard(m))return;
            state.answer=a;
            state.content.html(classicView(a));
            // Lampa binds its selectors only on Modal.open/update.
            // Custom TV controller doesn't need update, preserving focus and scroll.
            if(!state.useCustom && Lampa.Modal && typeof Lampa.Modal.update==='function'){
                Lampa.Modal.update(state.sheet);
            }
            bindClassic();
        }).catch(function(err){
            if(button)button.removeClass('sw59-busy');
            if(token!==state.run || !state.opened)return;
            console.error('[ShouldWatch] analysis:',err);
            state.content.html('<div class="sw59-loading"><strong>Что-то не загрузилось</strong>'+
                '<span>Попробуй открыть ещё раз.</span></div>');
            notify('Не удалось получить данные');
        });
    }

    function removeLegacyButtons(scope) {
        if(!scope || !scope.length)return;
        scope.find('.sw-custom-button-enhanced,.sw55-trigger,.sw56-trigger,.sw57-trigger,.sw58-trigger').remove();
    }
    function addButton(e) {
        var c=getCard(e),root=e&&e.body&&$(e.body);
        if(!root || !root.length) {
            try {
                if(e && e.object && typeof e.object.render==='function')
                    root=$(e.object.render());
                else if(e && e.object && e.object.activity &&
                    typeof e.object.activity.render==='function')
                    root=$(e.object.activity.render());
            }catch(err){}
        }
        if(!c||!root||!root.length)return;
        var row=root.filter('.full-start-new__buttons,.full-start__buttons').first();
        if(!row.length) row=root.find('.full-start-new__buttons,.full-start__buttons').first();
        if(!row.length)return;
        row.addClass('sw59-host');
        removeLegacyButtons(root);
        // Older scripts can be registered after this one. Clean their button
        // again when their synchronous full:complite handlers finish.
        setTimeout(function(){removeLegacyButtons(root);},0);
        setTimeout(function(){removeLegacyButtons(root);},180);
        if(row.find('.'+BTN).length)return;
        var button=$('<div class="full-start__button selector '+BTN+'" tabindex="0"/>');
        button.append($('<div class="full-start__icon"/>').html(ICON));
        button.append($('<span/>').text('Стоит ли'));
        // Match the original plugin's button position after source actions.
        var anchor=root.find('.view--torrent,.view--online,.view--trailer').last();
        if(!anchor.length)anchor=row.find('.view--torrent,.view--online,.view--trailer').last();
        if(anchor.length)anchor.after(button);
        else row.append(button);
        var pressAt=0;
        button.on('hover:enter click',function(e){
            if(e.type==='click')e.preventDefault();
            var t=Date.now();
            if(t-pressAt<380)return;
            pressAt=t;
            show(c,button);
        });
    }
    function addOption(e) {
        var c=getCard(e);
        if(!c||!e.options||!Array.isArray(e.options))return;
        // Remove stale duplicate entries from v55 if both URLs are still loaded.
        for(var i=e.options.length-1;i>=0;i--){
            if(e.options[i] && (e.options[i].shouldWatch55 || e.options[i].shouldWatch56 || e.options[i].shouldWatch57 || e.options[i].shouldWatch58 || e.options[i].shouldWatch59))
                e.options.splice(i,1);
        }
        e.options.push({title:'Стоит ли смотреть',shouldWatch59:true,onSelect:function(){
            setTimeout(function(){show(c,null);},100);
        }});
    }

    function init() {
        if (initialized || window.capsule_should_watch_v59) return;
        if (!window.Lampa || !window.$ || !Lampa.Listener || !Lampa.Modal) {
            if (++bootAttempts<30) setTimeout(init,500);
            return;
        }
        initialized=true;
        window.capsule_should_watch_v59=true;
        window.capsule_should_watch_v58=true;
        window.capsule_should_watch_v57=true;
        window.capsule_should_watch_v56=true; // Ignore cached versions.
        window.capsule_should_watch_v57=true; // Prevent cached v57 from initializing afterwards.
        window.should_watch_plugin_installed=true;
        window.should_watch_plugin_enhanced=true;
        styles();
        if(!window.sw_settings_ready_v52){initSettings();window.sw_settings_ready_v52=true;}
        registerTVController();
        Lampa.Listener.follow('full',function(e){
            if (!e)return;
            if (e.type==='complite')addButton(e);
            else if(e.type==='options')addOption(e);
        });
        if (Lampa.Manifest) Lampa.Manifest.plugins={
            name:'Стоит ли смотреть',type:'other',version:'60.0',
            description:'Рекомендации и факты TMDB с нативным интерфейсом Lampa'
        };
        console.log('[ShouldWatch] v60 ready · evidence-backed pros/cons, stable dice and restrained animations');
    }
    if (window.appready || document.readyState!=='loading') init();
    else document.addEventListener('DOMContentLoaded',init);
    setTimeout(init,1200);
})();
