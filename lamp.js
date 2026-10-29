/**
 * Стоит ли смотреть? · Lampa Native v56.0
 *
 * Movie/TV facts from TMDB, transparent recommendation rationale,
 * native Lampa modal actions, and a layout safe for TV, touch and D-pad.
 * Self-contained; no extra hosts, trackers or external UI libraries.
 */
(function () {
    'use strict';

    var PLUGIN = 'should_watch_plugin_enhanced';
    var STYLE_ID = 'sw56-native-style';
    var BTN = 'sw56-trigger';
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
            query('/'+kind+'/'+id+'?append_to_response=credits,keywords,'+cert,'ru-RU'),
            query('/'+kind+'/'+id+'?append_to_response=reviews,videos','en-US')
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
            return {id:isFinite(id)?id:0,name:name || GENRES[id] || '',
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
    function verifiedTopics(main) {
        var obj=main && main.keywords || {};
        var keywords=list(obj.keywords || obj.results).map(function(k){
            return clean(k && k.name,90);
        }).filter(Boolean);
        return TOPICS.filter(function(t){
            return keywords.some(function(k){return t.re.test(k);});
        }).map(function(t){return t.name;}).slice(0,6);
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
            var positive=[],caution=[];
            if (matchedGenres.length) caution.push('Ваши исключённые жанры: '+matchedGenres.join(', '));
            if (matchedActors.length) caution.push('Нелюбимые актёры: '+matchedActors.join(', '));
            if (matchedDirectors.length) caution.push('Нелюбимые режиссёры: '+matchedDirectors.join(', '));
            if(votes>=150 && bayes>=threshold+0.7)
                positive.push('Оценка зрителей '+fixed(rating)+'/10 на основе '+number(votes)+' голосов.');
            else if(votes>=150 && bayes<=threshold-0.7)
                caution.push('Зрительская оценка '+fixed(rating)+'/10 ниже выбранного порога '+fixed(threshold)+'.');
            // A moderate rating or small sample isn't evidence of quality.
            // Keep neutral observations in the confidence summary, not the pros.
            if(votes<150) caution.push('Оценок пока недостаточно для уверенного совета.');
            var age=certification(payload.main || payload.en,kind);
            var watched=0;
            try {
                if (Lampa.Timeline && typeof Lampa.Timeline.get==='function') {
                    var tm=Lampa.Timeline.get(String(movie.id || movie.tmdb_id));
                    if (tm && tm.duration>0) watched=Math.round(100*tm.time/tm.duration);
                }
            } catch(e) {}
            if (watched>=90) caution.push('Возможно, вы уже досмотрели этот фильм или сериал.');
            var reason = hasDislikes ? 'Найдены совпадения с вашими личными исключениями.'
                : votes<35 ? 'Недостаточно подтверждённых оценок для рекомендации.'
                : verdict==='СТОИТ' ? 'Зрительские оценки заметно выше вашего порога.'
                : verdict==='НЕ СТОИТ' ? 'Зрительские оценки ниже вашего порога.'
                : 'Оценки близки к вашему порогу: однозначного вывода нет.';
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
            var topics=verifiedTopics(payload.main || payload.en);
            var genreLine=genres.length?genres.slice(0,3).join(', '):'жанр не указан';
            var idHas=function(id){return genreIDs.indexOf(id)>=0;};
            var tempo=idHas(28)||idHas(12)||idHas(10759)?'Возможно, динамичный':
                idHas(18)||idHas(36)||idHas(99)?'Возможно, размеренный':'Зависит от сюжета';
            var tension=idHas(27)||idHas(53)?'Вероятно, высокое':
                idHas(35)||idHas(10751)?'Вероятно, невысокое':'Неизвестно';
            var feeling=idHas(18)||idHas(10749)?'Акцент на эмоции':
                idHas(35)?'Возможен лёгкий тон':'Неизвестно';
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


    // v56 design: no faux dashboard, overdrawn frames, fake 1-10 scores,
    // unnecessary custom fonts, huge fixed typography or looping animations.
    // Text uses the same inherited rhythm as the Lampa interface.
    function styles() {
        if (document.getElementById('sw56-native-style')) return;
        var css=[
            '.sw56,.sw56 *,.sw56 *::before,.sw56 *::after{box-sizing:border-box}',
            '.sw56{color:inherit;font-family:inherit;font-size:1em;line-height:1.46;',
            'min-width:0;max-width:100%;width:100%;padding:.05em .05em 1em}',
            '.sw56 *{min-width:0;max-width:100%}',
            '.sw56-page{min-width:0;max-width:100%;animation:sw56Reveal .21s ease-out both}',
            '@keyframes sw56Reveal{from{opacity:.45;transform:translateY(.24em)}',
            'to{opacity:1;transform:translateY(0)}}',
            '.sw56-ident{margin:0 0 1.05em}',
            '.sw56-eyebrow{font-size:.72em;opacity:.62;font-weight:600;',
            'letter-spacing:.035em;margin-bottom:.4em}',
            '.sw56-film{font-size:1.19em;font-weight:650;line-height:1.3;',
            'overflow-wrap:anywhere;word-break:normal}',
            '.sw56-chips{display:flex;flex-wrap:wrap;gap:.65em;margin-top:.55em;',
            'align-items:center;font-size:.77em;opacity:.77}',
            '.sw56-chips span{max-width:100%;overflow-wrap:anywhere}',
            '.sw56-judgement{display:flex;align-items:flex-start;gap:.7em;',
            'margin:1.15em 0 .45em;min-width:0}',
            '.sw56-dot{display:inline-block;flex:0 0 .62em;width:.62em;height:.62em;',
            'border-radius:50%;margin-top:.36em;background:#b1b1b1}',
            '.sw56-judgement--yes .sw56-dot{background:#79c698}',
            '.sw56-judgement--no .sw56-dot{background:#ec8889}',
            '.sw56-judgement--maybe .sw56-dot{background:#dcb97b}',
            '.sw56-status{font-size:1.43em;line-height:1.18;font-weight:670;',
            'overflow-wrap:anywhere}',
            '.sw56-lead{font-size:.95em;line-height:1.5;opacity:.83;margin:.15em 0 1.15em}',
            '.sw56-data{display:flex;align-items:center;flex-wrap:wrap;gap:.3em .85em;',
            'padding:.85em 0;border-top:1px solid rgba(175,175,175,.16);',
            'border-bottom:1px solid rgba(175,175,175,.16);font-size:.87em}',
            '.sw56-rating{font-weight:750;font-size:1.08em}',
            '.sw56-soft{opacity:.62}',
            '.sw56-h2{font-size:1.04em;line-height:1.3;font-weight:650;',
            'margin:1.35em 0 .5em}',
            '.sw56-item{display:flex;gap:.75em;align-items:flex-start;',
            'border-top:1px solid rgba(175,175,175,.12);padding:.65em .05em}',
            '.sw56-item:first-child{border-top:0}',
            '.sw56-item__symbol{flex:0 0 1.15em;opacity:.72;font-size:.95em;',
            'line-height:1.45}',
            '.sw56-item--plus .sw56-item__symbol{color:#80ce9b;opacity:1}',
            '.sw56-item--warn .sw56-item__symbol{color:#dcb97b;opacity:1}',
            '.sw56-item__text{flex:1;overflow-wrap:anywhere;word-break:break-word;',
            'font-size:.92em;line-height:1.53}',
            '.sw56-note{font-size:.79em;opacity:.62;line-height:1.5;',
            'margin:.9em 0 .1em;overflow-wrap:anywhere}',
            '.sw56-facts{border-top:1px solid rgba(175,175,175,.15)}',
            '.sw56-row{display:grid;grid-template-columns:minmax(0,37%) minmax(0,1fr);',
            'gap:.35em .9em;align-items:start;padding:.7em .05em;',
            'border-bottom:1px solid rgba(175,175,175,.13)}',
            '.sw56-key{font-size:.83em;opacity:.64;line-height:1.55;',
            'overflow-wrap:anywhere}',
            '.sw56-value{font-size:.91em;font-weight:520;line-height:1.52;',
            'overflow-wrap:anywhere;word-break:break-word}',
            '.sw56-highlight{border-top:1px solid rgba(175,175,175,.14);',
            'padding:.7em .05em .7em}',
            '.sw56-highlight__title{font-size:.94em;font-weight:640;margin-bottom:.16em}',
            '.sw56-highlight__text{font-size:.88em;line-height:1.5;opacity:.75}',
            '.sw56-tags{display:flex;flex-wrap:wrap;gap:.45em;margin:.55em 0}',
            '.sw56-tag{display:inline-block;max-width:100%;font-size:.8em;',
            'padding:.3em .6em;background:rgba(150,150,150,.12);',
            'border-radius:.4em;overflow-wrap:anywhere}',
            '.sw56-mood{padding:.77em .05em;border-bottom:1px solid rgba(175,175,175,.13)}',
            '.sw56-mood__name{font-size:.84em;opacity:.64;margin-bottom:.16em}',
            '.sw56-mood__value{font-size:.97em;font-weight:580}',
            '.sw56-coin{padding:.8em .95em;background:rgba(150,150,150,.12);',
            'font-size:.9em;margin-top:.7em;border-radius:.45em;',
            'animation:sw56Reveal .24s ease-out both}',
            '.sw56-modal .modal__content{min-width:0}',
            '.sw56-modal .modal__body,.sw56-modal .scroll,.sw56-modal .scroll__body,',
            '.sw56-modal .scroll__content{min-width:0;max-width:100%}',
            '.sw56-modal .modal__footer{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));',
            'gap:.35em;min-width:0;padding-top:.85em}',
            '.sw56-modal .modal__footer .modal__button{min-width:0;width:auto;max-width:100%;',
            'margin:0!important;padding:.64em .25em;font-size:.86em;text-align:center;',
            'line-height:1.25;overflow-wrap:break-word;border-radius:.48em;',
            'background:rgba(150,150,150,.12)}',
            '.sw56-modal .modal__footer .modal__button.focus{background:#fff;color:#111}',
            '.sw56-modal .modal__footer .sw56-selected:not(.focus){',
            'background:rgba(150,150,150,.24);box-shadow:inset 0 -2px 0 rgba(255,255,255,.55)}',
            '.sw56-loading{padding:1.25em 0 1.5em;min-height:8em}',
            '.sw56-loading__title{font-size:1.12em;font-weight:620;line-height:1.4}',
            '.sw56-loading__hint{font-size:.83em;opacity:.66;margin-top:.5em}',
            '.sw56-loading__bar{width:5em;height:2px;background:rgba(150,150,150,.35);',
            'margin-top:1.2em;overflow:hidden;position:relative;border-radius:3px}',
            '.sw56-loading__bar::after{content:"";display:block;width:45%;height:100%;',
            'background:rgba(255,255,255,.85);animation:sw56Load 1.1s ease-in-out infinite alternate}',
            '@keyframes sw56Load{from{transform:translateX(-100%)}to{transform:translateX(260%)}}',
            '.sw56-host .sw-custom-button-enhanced,.sw56-host .sw55-trigger{display:none!important}',
            '.sw56-trigger{min-width:0;max-width:100%}',
            '.sw56-trigger svg{width:1.45em;height:1.45em}',
            '.sw56-trigger.sw56-busy{opacity:.6;pointer-events:none}',
            '@media(max-width:600px){.sw56-row{grid-template-columns:minmax(0,1fr);gap:.12em}',
            '.sw56-film{font-size:1.09em}.sw56-status{font-size:1.28em}',
            '.sw56-modal .modal__footer .modal__button{font-size:.76em;',
            'padding:.65em .15em;letter-spacing:-.01em}}',
            '@media(max-width:350px){.sw56-modal .modal__footer .modal__button{font-size:.7em}}',
            '@media(prefers-reduced-motion:reduce){.sw56-page,.sw56-coin,.sw56-loading__bar::after{animation:none}}'
        ].join('');
        var el=document.createElement('style');
        el.id='sw56-native-style';el.textContent=css;document.head.appendChild(el);
    }
    function detail(label,value) {
        return '<div class="sw56-row"><div class="sw56-key">'+esc(label)+'</div>'+
            '<div class="sw56-value">'+esc(value)+'</div></div>';
    }
    function notes(items,kind){
        return items.map(function(t){
            return '<div class="sw56-item sw56-item--'+kind+'">'+
                '<span class="sw56-item__symbol">'+(kind==='plus'?'＋':'·')+'</span>'+
                '<span class="sw56-item__text">'+esc(t)+'</span></div>';
        }).join('');
    }
    function intro(a){
        var genres=a.genreLine && a.genreLine!=='жанр не указан' ? a.genreLine : '';
        return '<div class="sw56-ident">'+
            '<div class="sw56-eyebrow">'+(a.kind==='tv'?'СЕРИАЛ':'ФИЛЬМ')+
            (a.year?' · '+esc(a.year):'')+'</div>'+
            '<div class="sw56-film">'+esc(a.title)+'</div>'+
            (genres?'<div class="sw56-chips"><span>'+esc(genres)+'</span></div>':'')+
            '</div>';
    }
    function paneVerdict(a){
        var verdictTitle = a.tone==='yes'?'Стоит посмотреть':
            a.tone==='no'?'Скорее не стоит':
            a.tone==='unknown'?'Пока мало данных':'Неоднозначный выбор';
        var reasons = a.positive.slice(0,3).map(function(t){return {kind:'plus',text:t};});
        reasons = reasons.concat(a.caution.slice(0,4).map(function(t){return {kind:'warn',text:t};}));
        var lines=reasons.length?reasons.map(function(o){return notes([o.text],o.kind);}).join(''):
            '<div class="sw56-note">Достоверных аргументов пока недостаточно.</div>';
        return '<div class="sw56-page">'+intro(a)+
            '<div class="sw56-judgement sw56-judgement--'+esc(a.tone)+'">'+
            '<span class="sw56-dot" aria-hidden="true"></span>'+
            '<div class="sw56-status">'+esc(verdictTitle)+'</div></div>'+
            '<div class="sw56-lead">'+esc(a.reason)+'</div>'+
            '<div class="sw56-data">'+
            (a.rating&&a.votes?'<span class="sw56-rating">★ '+fixed(a.rating)+'</span>'+
                '<span class="sw56-soft">TMDB · '+number(a.votes)+' оценок</span>':
                '<span class="sw56-soft">Оценка отсутствует</span>')+
            '<span class="sw56-soft">Порог: '+fixed(a.threshold)+'/10</span></div>'+
            '<div class="sw56-h2">На чём основан совет</div>'+
            '<div class="sw56-reasons">'+lines+'</div>'+
            '<div class="sw56-note">'+esc(a.confidence)+
                '. Совет учитывает рейтинг TMDB и ваши личные исключения; '+
                'это не рецензия и не гарантия, что фильм понравится.</div>'+
            '<div id="sw56-random-result" aria-live="polite"></div>'+
            '</div>';
    }
    function paneFacts(a){
        var featured=list(a.highlights).slice(0,4).map(function(h){
            return '<div class="sw56-highlight">'+
                '<div class="sw56-highlight__title">'+esc(h.title)+'</div>'+
                (h.body?'<div class="sw56-highlight__text">'+esc(h.body)+'</div>':'')+
                '</div>';
        }).join('');
        var interestingLabels=['Киносерия','Оригинальное название','Бюджет (TMDB)','Сборы (TMDB)'];
        var basics=[],creative=[],production=[],more=[];
        list(a.facts).forEach(function(f){
            var name=f.label||'';
            if(['Жанры','Премьера','Начало показа','Хронометраж','Длительность серии',
                'Сезоны','Эпизоды','Возрастной рейтинг'].indexOf(name)>=0)basics.push(f);
            else if(['Режиссёр','Сценарий','В ролях','Создатели'].indexOf(name)>=0)creative.push(f);
            else if(['Студия','Страны производства','Язык оригинала','Статус'].indexOf(name)>=0)production.push(f);
            else more.push(f);
        });
        function group(title,fields){
            return fields.length?'<div class="sw56-h2">'+title+'</div>'+
                '<div class="sw56-facts">'+fields.map(function(f){
                    return detail(f.label,f.value);
                }).join('')+'</div>':'';
        }
        var topicTags=list(a.topics).map(function(x){
            return '<span class="sw56-tag">'+esc(x)+'</span>';
        }).join('');
        return '<div class="sw56-page">'+intro(a)+
            (featured?'<div class="sw56-h2">Интересные детали</div>'+featured:'')+
            group('Основное',basics)+group('Создатели',creative)+
            group('Производство',production)+group('Другие сведения',more)+
            (!a.facts.length?'<div class="sw56-note">Подробные сведения пока недоступны.</div>':'')+
            (topicTags?'<div class="sw56-h2">Тематика</div>'+
                '<div class="sw56-tags">'+topicTags+'</div>':'')+
            '<div class="sw56-note">'+esc(a.accuracy)+
                '. Факты взяты из полей TMDB или карточки Lampa. '+
                'Тематические метки добавлены сообществом TMDB.</div></div>';
    }
    function paneMood(a){
        var rows=list(a.atmos).map(function(m){
            return '<div class="sw56-mood"><div class="sw56-mood__name">'+esc(m.label)+
                '</div><div class="sw56-mood__value">'+esc(m.value)+'</div></div>';
        }).join('');
        return '<div class="sw56-page">'+intro(a)+
            '<div class="sw56-h2">Какой может быть просмотр</div>'+rows+
            '<div class="sw56-note">Это предположение по жанрам, а не точные показатели '+
                'темпа, эмоций или жестокости. Неизвестное не подменяется случайными цифрами.</div>'+
            (a.displayAge?'<div class="sw56-h2">Возрастной рейтинг</div>'+
                '<div class="sw56-item"><span class="sw56-item__text">'+esc(a.displayAge)+
                '</span></div>':'')+
            '</div>';
    }

    function close() {
        if (!state.opened) return;
        state.opened=false;
        state.answer=null;
        state.sheet=null;
        state.content=null;
        state.run++;
        try {Lampa.Modal.close();}catch(e){}
    }
    function switchPane(which) {
        if (!state.sheet || !state.content || !state.opened || !state.answer) return;
        if(which!=='facts' && which!=='mood') which='verdict';
        var controls=state.sheet.closest('.sw56-modal').find('.modal__footer .modal__button');
        controls.removeClass('sw56-selected');
        controls.eq(which==='facts'?1:which==='mood'?2:0).addClass('sw56-selected');
        var a=state.answer;
        state.content.html(which==='facts'?paneFacts(a):which==='mood'?paneMood(a):paneVerdict(a));
        try {
            if(Lampa.Modal && typeof Lampa.Modal.scroll==='function'){
                var scroll=Lampa.Modal.scroll();
                if(scroll && typeof scroll.reset==='function')scroll.reset();
            }
        }catch(e){}
    }
    function randomChoice() {
        if (!state.opened || !state.answer || !state.content) return;
        switchPane('verdict');
        var result = Math.random()<0.5?'Смотреть':'Не смотреть';
        state.content.find('#sw56-random-result').html(
            '<div class="sw56-coin">🎲 Случай выбрал: <strong>'+
            result+'</strong>. Это случайное решение, а не рекомендация.</div>');
    }

    function notify(s) {
        try {if(Lampa.Noty&&Lampa.Noty.show)Lampa.Noty.show(s);}catch(e){}
    }
    function stillOnCard(m) {
        try {
            var active=Lampa.Activity&&Lampa.Activity.active&&Lampa.Activity.active();
            var card=active&&active.card;
            if (card && card.id && m && m.id &&
                (String(card.id)!==String(m.id) || type(card)!==type(m))) return false;
        }catch(e){}
        return true;
    }
    function show(m,trigger) {
        if(!m || typeof m!=='object')return;
        if(state.opened || Date.now()-state.lastOpen<360)return;
        if(!Lampa.Modal || typeof Lampa.Modal.open!=='function')return;
        state.lastOpen=Date.now();
        var token=++state.run;
        var button=trigger&&trigger.length?trigger:null;
        state.movie=m;
        state.answer=null;
        state.opened=true;
        state.sheet=$('<div class="sw56"/>');
        // Relative scaling only: preserve Lampa typography and the user's saved setting.
        state.sheet.css('font-size',
            Math.max(.86,Math.min(1.12,settings().font/20)).toFixed(2)+'em');
        state.content=$('<div class="sw56-content"/>');
        state.sheet.append(state.content);
        state.content.html(
            '<div class="sw56-loading"><div class="sw56-loading__title">'+
            esc(m.title||m.name||'Фильм')+'</div>'+
            '<div class="sw56-loading__hint">Проверяем данные TMDB…</div>'+
            '<div class="sw56-loading__bar"></div></div>');
        if(button)button.addClass('sw56-busy');
        try{
            Lampa.Modal.open({
                title:'Стоит ли смотреть',
                size:'large',html:state.sheet,
                buttons_position:'outside',
                buttons:[
                    {name:'Обзор',onSelect:function(){switchPane('verdict');}},
                    {name:'Факты',onSelect:function(){switchPane('facts');}},
                    {name:'Характер',onSelect:function(){switchPane('mood');}},
                    {name:'Случайно',onSelect:randomChoice}
                ],
                onBack:close
            });
            state.sheet.closest('.modal').addClass('sw56-modal');
            state.sheet.closest('.modal').find('.modal__footer .modal__button').first()
                .addClass('sw56-selected');
        }catch(e){
            state.opened=false;state.sheet=null;state.content=null;
            if(button)button.removeClass('sw56-busy');
            console.error('[ShouldWatch] Modal:',e);
            return;
        }
        analyze(m).then(function(a){
            if(button)button.removeClass('sw56-busy');
            if(token!==state.run || !state.opened)return;
            state.answer=a;
            switchPane('verdict');
        }).catch(function(err){
            if(button)button.removeClass('sw56-busy');
            if(token!==state.run || !state.opened)return;
            console.error('[ShouldWatch] Analyze:',err);
            state.content.html('<div class="sw56-loading">'+
                '<div class="sw56-loading__title">Не удалось получить информацию</div>'+
                '<div class="sw56-loading__hint">Попробуйте открыть анализ ещё раз.</div></div>');
            notify('Не удалось выполнить анализ');
        });
    }

    function removeLegacyButtons(scope) {
        if(!scope || !scope.length)return;
        scope.find('.sw-custom-button-enhanced,.sw55-trigger').remove();
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
        row.addClass('sw56-host');
        removeLegacyButtons(root);
        // Older scripts can be registered after this one. Clean their button
        // again when their synchronous full:complite handlers finish.
        setTimeout(function(){removeLegacyButtons(root);},0);
        setTimeout(function(){removeLegacyButtons(root);},180);
        if(row.find('.'+BTN).length)return;
        var button=$('<div class="full-start__button selector '+BTN+'" tabindex="0"/>');
        button.append($('<div class="full-start__icon"/>').html(ICON));
        button.append($('<span/>').text('Стоит ли смотреть'));
        var opts=row.find('.button--options').first();
        if(opts.length)button.insertBefore(opts);
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
            if(e.options[i] && (e.options[i].shouldWatch55 || e.options[i].shouldWatch56))
                e.options.splice(i,1);
        }
        e.options.push({title:'Стоит ли смотреть',shouldWatch56:true,onSelect:function(){
            setTimeout(function(){show(c,null);},100);
        }});
    }

    function init() {
        if (initialized || window.capsule_should_watch_v56) return;
        if (!window.Lampa || !window.$ || !Lampa.Listener || !Lampa.Modal) {
            if (++bootAttempts<30) setTimeout(init,500);
            return;
        }
        initialized=true;
        window.capsule_should_watch_v56=true;
        window.should_watch_plugin_installed=true;
        window.should_watch_plugin_enhanced=true;
        styles();if(!window.sw_settings_ready_v52)initSettings();
        Lampa.Listener.follow('full',function(e){
            if (!e)return;
            if (e.type==='complite')addButton(e);
            else if(e.type==='options')addOption(e);
        });
        if (Lampa.Manifest) Lampa.Manifest.plugins={
            name:'Стоит ли смотреть',type:'other',version:'56.0',
            description:'Рекомендации и факты TMDB с нативным интерфейсом Lampa'
        };
        console.log('[ShouldWatch] v56 ready · new native UI; old buttons suppressed');
    }
    if (window.appready || document.readyState!=='loading') init();
    else document.addEventListener('DOMContentLoaded',init);
    setTimeout(init,1200);
})();
