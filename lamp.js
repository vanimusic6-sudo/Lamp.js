/**
 * Стоит ли смотреть? · Lampa Native v57.0
 *
 * Movie/TV facts from TMDB, transparent recommendation rationale,
 * native Lampa modal actions, and a layout safe for TV, touch and D-pad.
 * Self-contained; no extra hosts, trackers or external UI libraries.
 */
(function () {
    'use strict';

    var PLUGIN = 'should_watch_plugin_enhanced';
    var STYLE_ID = 'sw57-style';
    var BTN = 'sw57-trigger';
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



    // v57: native Lampa typography, carefully layered cards and no clipping.
    // Only opacity is animated: transformed blocks can clip against TV scroll view.
    function styles() {
        if (document.getElementById('sw57-style')) return;
        var rules = [
            '.sw57,.sw57 *,.sw57 *::before,.sw57 *::after{box-sizing:border-box}',
            '.sw57{font-family:inherit;color:inherit;width:100%;max-width:100%;min-width:0;',
            'padding:.15em .12em 1.4em;line-height:1.48;overflow-wrap:break-word}',
            '.sw57 *{min-width:0;max-width:100%}',
            '.sw57-page{animation:sw57Appear .24s ease-out both;min-width:0}',
            '@keyframes sw57Appear{from{opacity:.25}to{opacity:1}}',
            '.sw57-surface{background:linear-gradient(147deg,rgba(160,160,160,.17),',
            'rgba(100,100,100,.10));border:1px solid rgba(185,185,185,.19);',
            'box-shadow:0 .5em 1.5em rgba(0,0,0,.14);border-radius:.85em}',
            '.sw57-hero{padding:1.25em 1.3em 1.15em;margin:0 0 1.1em;',
            'background:linear-gradient(152deg,rgba(165,165,165,.19),',
            'rgba(110,110,110,.075));border:1px solid rgba(190,190,190,.22);',
            'border-radius:1em;box-shadow:0 .65em 1.8em rgba(0,0,0,.18);',
            'position:relative;min-width:0;overflow:visible}',
            '.sw57-hero::before{content:"";display:block;position:absolute;',
            'left:1.3em;top:0;width:3.4em;height:.19em;border-radius:0 0 .4em .4em;',
            'background:#bdc4cb}',
            '.sw57-hero--yes::before{background:#7fcea0}',
            '.sw57-hero--no::before{background:#ee8b89}',
            '.sw57-hero--maybe::before{background:#e7b96d}',
            '.sw57-ident{min-width:0;margin-bottom:1em}',
            '.sw57-eyebrow{font-size:.84em;font-weight:590;opacity:.7;',
            'letter-spacing:.025em;line-height:1.4;margin-bottom:.32em}',
            '.sw57-film{font-size:1.37em;line-height:1.26;font-weight:650;',
            'overflow-wrap:anywhere;word-break:normal}',
            '.sw57-genres{margin-top:.45em;opacity:.72;font-size:.94em;',
            'line-height:1.4;overflow-wrap:anywhere}',
            '.sw57-divider{height:1px;background:rgba(190,190,190,.16);',
            'margin:1.05em 0}',
            '.sw57-statusline{display:flex;align-items:center;gap:.78em;min-width:0}',
            '.sw57-status-icon{display:grid;place-items:center;flex:0 0 2.45em;',
            'height:2.45em;width:2.45em;max-width:none;border-radius:.68em;',
            'background:rgba(180,180,180,.16);font-size:1em;font-weight:700}',
            '.sw57-hero--yes .sw57-status-icon{color:#91e3b0;background:rgba(95,198,133,.14)}',
            '.sw57-hero--no .sw57-status-icon{color:#ffacaa;background:rgba(235,105,105,.14)}',
            '.sw57-hero--maybe .sw57-status-icon{color:#f4d091;',
            'background:rgba(225,171,83,.14)}',
            '.sw57-status{font-size:1.43em;font-weight:710;line-height:1.22;',
            'letter-spacing:-.01em;overflow-wrap:anywhere}',
            '.sw57-lead{font-size:1.03em;opacity:.89;line-height:1.56;',
            'margin:.9em 0 1.15em;overflow-wrap:anywhere}',
            '.sw57-meta{display:flex;flex-wrap:wrap;align-items:center;',
            'gap:.55em .65em;min-width:0}',
            '.sw57-badge{display:inline-flex;align-items:center;gap:.36em;',
            'padding:.47em .72em;border:1px solid rgba(170,170,170,.24);',
            'background:rgba(30,30,30,.10);border-radius:.5em;',
            'font-size:.91em;line-height:1.4;overflow-wrap:anywhere}',
            '.sw57-badge strong{font-size:1.1em;font-weight:750}',
            '.sw57-badge--muted{opacity:.76}',
            '.sw57-section{font-size:1.18em;line-height:1.32;font-weight:680;',
            'margin:1.18em 0 .7em;letter-spacing:-.01em}',
            '.sw57-columns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));',
            'gap:.78em;min-width:0}',
            '.sw57-card{min-width:0;border-radius:.82em;padding:1.05em 1.08em;',
            'border:1px solid rgba(185,185,185,.17);',
            'background:linear-gradient(145deg,rgba(150,150,150,.14),',
            'rgba(110,110,110,.07));box-shadow:0 .45em 1.25em rgba(0,0,0,.12)}',
            '.sw57-card__heading{display:flex;gap:.48em;align-items:center;',
            'font-size:1.06em;font-weight:680;margin-bottom:.7em}',
            '.sw57-card__indicator{height:.5em;width:.5em;max-width:none;',
            'flex:0 0 .5em;border-radius:50%;background:#c8c8c8}',
            '.sw57-card--pro .sw57-card__indicator{background:#8bd8a8}',
            '.sw57-card--con .sw57-card__indicator{background:#e9b57d}',
            '.sw57-point{font-size:.98em;line-height:1.55;padding:.65em 0;',
            'border-top:1px solid rgba(185,185,185,.14);overflow-wrap:anywhere}',
            '.sw57-point:first-child{border-top:0;padding-top:.1em}',
            '.sw57-hint{border-radius:.7em;margin-top:1em;padding:.85em 1em;',
            'background:rgba(145,145,145,.09);border:1px solid rgba(155,155,155,.10);',
            'font-size:.91em;line-height:1.53;opacity:.79;overflow-wrap:anywhere}',
            '.sw57-subhead{font-size:1.13em;line-height:1.3;font-weight:680;',
            'margin:1.23em 0 .66em}',
            '.sw57-info-list{border-radius:.8em;min-width:0;overflow:hidden;',
            'border:1px solid rgba(185,185,185,.17);',
            'background:linear-gradient(145deg,rgba(150,150,150,.13),',
            'rgba(100,100,100,.055));box-shadow:0 .35em 1em rgba(0,0,0,.09)}',
            '.sw57-info{display:grid;grid-template-columns:minmax(0,38%) minmax(0,1fr);',
            'gap:.8em;align-items:start;min-width:0;padding:.82em .97em;',
            'border-bottom:1px solid rgba(185,185,185,.13)}',
            '.sw57-info:last-child{border-bottom:none}',
            '.sw57-info__key{font-size:.94em;opacity:.71;line-height:1.5;',
            'overflow-wrap:anywhere}',
            '.sw57-info__val{font-size:1em;font-weight:550;line-height:1.51;',
            'overflow-wrap:anywhere;word-break:break-word}',
            '.sw57-fact-card{padding:1em 1.08em;margin-bottom:.64em;',
            'border-radius:.75em;background:linear-gradient(145deg,',
            'rgba(160,160,160,.16),rgba(110,110,110,.075));',
            'border:1px solid rgba(180,180,180,.16);',
            'box-shadow:0 .35em 1em rgba(0,0,0,.11)}',
            '.sw57-fact-card__title{font-size:1.05em;font-weight:670;',
            'margin-bottom:.28em;line-height:1.36}',
            '.sw57-fact-card__text{font-size:.99em;line-height:1.52;opacity:.87}',
            '.sw57-tags{display:flex;flex-wrap:wrap;gap:.48em}',
            '.sw57-tag{display:inline-block;max-width:100%;font-size:.93em;',
            'padding:.43em .72em;border:1px solid rgba(170,170,170,.19);',
            'border-radius:.5em;background:rgba(150,150,150,.115);',
            'line-height:1.36;overflow-wrap:anywhere}',
            '.sw57-moods{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));',
            'gap:.75em}',
            '.sw57-mood{border-radius:.8em;padding:1.03em 1.08em;',
            'background:linear-gradient(145deg,rgba(157,157,157,.15),rgba(110,110,110,.07));',
            'border:1px solid rgba(180,180,180,.16);box-shadow:0 .4em 1em rgba(0,0,0,.1)}',
            '.sw57-mood__name{font-size:.92em;opacity:.73;margin-bottom:.35em}',
            '.sw57-mood__value{font-size:1.11em;font-weight:660;line-height:1.4}',
            '.sw57-coin{padding:1em 1.1em;border-radius:.75em;',
            'border:1px solid rgba(185,185,185,.18);',
            'background:linear-gradient(140deg,rgba(157,157,157,.19),',
            'rgba(110,110,110,.085));box-shadow:0 .45em 1.2em rgba(0,0,0,.13);',
            'animation:sw57Appear .2s ease-out both;margin-top:1em}',
            '.sw57-loading{min-height:9em;padding:1.25em 1.1em;',
            'border-radius:.86em;background:rgba(140,140,140,.11);',
            'border:1px solid rgba(170,170,170,.15)}',
            '.sw57-loading__title{font-size:1.2em;font-weight:660}',
            '.sw57-loading__hint{font-size:1em;opacity:.77;margin-top:.7em}',
            '.sw57-loading__bar{height:.25em;width:8em;overflow:hidden;',
            'border-radius:1em;background:rgba(170,170,170,.25);margin-top:1.25em}',
            '.sw57-loading__bar::after{content:"";display:block;height:100%;',
            'width:48%;border-radius:1em;background:rgba(235,235,235,.8);',
            'animation:sw57Load 1.1s ease-in-out infinite alternate}',
            '@keyframes sw57Load{from{transform:translateX(-100%)}',
            'to{transform:translateX(260%)}}',
            '.sw57-modal .modal__content{min-width:0}',
            '.sw57-modal .modal__body,.sw57-modal .scroll,',
            '.sw57-modal .scroll__body,.sw57-modal .scroll__content{min-width:0;max-width:100%}',
            '.sw57-modal .modal__footer{display:grid;gap:.55em;',
            'grid-template-columns:repeat(4,minmax(0,1fr));padding-top:1em}',
            '.sw57-modal .modal__footer .modal__button{margin:0!important;',
            'min-width:0;max-width:100%;padding:.82em .5em;',
            'border:1px solid rgba(170,170,170,.15);border-radius:.65em;',
            'background:rgba(170,170,170,.12);text-align:center;',
            'font-size:1.02em;line-height:1.3;overflow-wrap:break-word;',
            'transition:background .18s ease,border-color .18s ease}',
            '.sw57-modal .modal__footer .modal__button.focus{background:#fff;',
            'color:#141414;border-color:#fff}',
            '.sw57-modal .modal__footer .sw57-selected:not(.focus){',
            'background:rgba(170,170,170,.23);border-color:rgba(210,210,210,.28)}',
            '.sw57-host .sw-custom-button-enhanced,.sw57-host .sw55-trigger,',
            '.sw57-host .sw56-trigger{display:none!important}',
            '.sw57-trigger{min-width:0;max-width:100%}',
            '.sw57-trigger svg{width:1.45em;height:1.45em}',
            '.sw57-trigger.sw57-busy{opacity:.65;pointer-events:none}',
            '@media(max-width:730px){',
            '.sw57-columns,.sw57-moods{grid-template-columns:minmax(0,1fr)}',
            '.sw57-info{grid-template-columns:minmax(0,1fr);gap:.2em}',
            '.sw57-hero{padding:1.13em 1.08em}',
            '.sw57-hero::before{left:1.08em}',
            '.sw57-film{font-size:1.27em}.sw57-status{font-size:1.35em}',
            '.sw57-modal .modal__footer{grid-template-columns:repeat(2,minmax(0,1fr))}',
            '.sw57-modal .modal__footer .modal__button{font-size:1em;',
            'padding:.74em .55em}}',
            '@media(max-width:390px){.sw57-hero{padding:.95em .9em}',
            '.sw57-card{padding:.92em}.sw57-meta{gap:.4em}',
            '.sw57-badge{font-size:.86em}}',
            '@media(prefers-reduced-motion:reduce){.sw57-page,.sw57-coin,',
            '.sw57-loading__bar::after{animation:none!important}',
            '.sw57-modal .modal__footer .modal__button{transition:none!important}}'
        ].join('');
        var style=document.createElement('style');
        style.id='sw57-style';style.textContent=rules;
        document.head.appendChild(style);
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
    function intro(a){
        var g=a.genreLine && a.genreLine!=='жанр не указан' ? a.genreLine : '';
        return '<div class="sw57-ident">'+
            '<div class="sw57-eyebrow">'+(a.kind==='tv'?'СЕРИАЛ':'ФИЛЬМ')+
            (a.year?' · '+esc(a.year):'')+'</div>'+
            '<div class="sw57-film">'+esc(a.title)+'</div>'+
            (g?'<div class="sw57-genres">'+esc(g)+'</div>':'')+
            '</div>';
    }
    function paneVerdict(a){
        var label=a.tone==='yes'?'Стоит посмотреть':a.tone==='no'?'Скорее не стоит':
            a.tone==='unknown'?'Недостаточно данных':'Неоднозначный выбор';
        var symbol=a.tone==='yes'?'✓':a.tone==='no'?'−':a.tone==='unknown'?'i':'?';
        var pro=a.positive.length?a.positive:
            ['Убедительных аргументов в пользу просмотра пока нет.'];
        var con=a.caution.length?a.caution:
            ['Явных ограничений в доступных данных не найдено.'];
        return '<div class="sw57-page">'+
            '<section class="sw57-hero sw57-hero--'+esc(a.tone)+'">'+
            intro(a)+
            '<div class="sw57-divider"></div>'+
            '<div class="sw57-statusline">'+
            '<span class="sw57-status-icon" aria-hidden="true">'+symbol+'</span>'+
            '<div class="sw57-status">'+esc(label)+'</div></div>'+
            '<div class="sw57-lead">'+esc(a.reason)+'</div>'+
            '<div class="sw57-meta">'+
            (a.votes && a.rating?'<span class="sw57-badge">'+
                '<strong>★ '+fixed(a.rating)+'</strong><span>TMDB</span></span>'+
                '<span class="sw57-badge sw57-badge--muted">'+
                number(a.votes)+' оценок</span>':
                '<span class="sw57-badge sw57-badge--muted">Нет оценок</span>')+
            '<span class="sw57-badge sw57-badge--muted">Ваш порог '+
                fixed(a.threshold)+'/10</span></div></section>'+
            '<div class="sw57-section">Почему такой вывод</div>'+
            '<div class="sw57-columns">'+
            infoCard('В пользу',noteLines(pro),'pro')+
            infoCard('Что учитывать',noteLines(con),'con')+
            '</div>'+
            '<div class="sw57-hint">'+esc(a.confidence)+
            '. Рекомендация опирается на TMDB и ваши настройки. '+
            'Она не гарантирует, что фильм понравится.</div>'+
            '<div id="sw57-random-result" aria-live="polite"></div></div>';
    }

    function paneFacts(a){
        var basics=[],creators=[],production=[],misc=[];
        list(a.facts).forEach(function(f){
            var n=f.label||'';
            if(['Жанры','Премьера','Начало показа','Хронометраж',
                'Длительность серии','Сезоны','Эпизоды','Возрастной рейтинг'].indexOf(n)>=0)
                basics.push(f);
            else if(['Режиссёр','Сценарий','В ролях','Создатели'].indexOf(n)>=0)
                creators.push(f);
            else if(['Студия','Страны производства','Язык оригинала','Статус'].indexOf(n)>=0)
                production.push(f);
            else misc.push(f);
        });
        function group(title,arr){
            return arr.length?'<div class="sw57-subhead">'+title+'</div>'+
                '<div class="sw57-info-list">'+arr.map(function(f){
                    return detail(f.label,f.value);
                }).join('')+'</div>':'';
        }
        var highlights=list(a.highlights).slice(0,4).map(function(h){
            return '<div class="sw57-fact-card">'+
                '<div class="sw57-fact-card__title">'+esc(h.title)+'</div>'+
                (h.body?'<div class="sw57-fact-card__text">'+esc(h.body)+'</div>':'')+
                '</div>';
        }).join('');
        var topics=list(a.topics).map(function(t){
            return '<span class="sw57-tag">'+esc(t)+'</span>';
        }).join('');
        return '<div class="sw57-page">'+
            '<div class="sw57-hero">'+intro(a)+
            '<div class="sw57-hint">Подтверждённые сведения из карточки и TMDB</div></div>'+
            (highlights?'<div class="sw57-subhead">Интересные детали</div>'+highlights:'')+
            group('Основная информация',basics)+
            group('Создатели',creators)+
            group('Производство',production)+
            group('Дополнительно',misc)+
            (topics?'<div class="sw57-subhead">Тематика</div>'+
                '<div class="sw57-tags">'+topics+'</div>':'')+
            (!a.facts.length?'<div class="sw57-hint">Сведения пока недоступны.</div>':'')+
            '<div class="sw57-hint">'+esc(a.accuracy)+
            '. Метки тематики добавляются участниками TMDB.</div></div>';
    }

    function paneMood(a){
        var mood=list(a.atmos).map(function(m){
            return '<div class="sw57-mood">'+
                '<div class="sw57-mood__name">'+esc(m.label)+'</div>'+
                '<div class="sw57-mood__value">'+esc(m.value)+'</div></div>';
        }).join('');
        return '<div class="sw57-page">'+
            '<div class="sw57-hero">'+intro(a)+
            '<div class="sw57-hint">Предполагаемый характер фильма или сериала</div></div>'+
            '<div class="sw57-section">Атмосфера</div>'+
            '<div class="sw57-moods">'+mood+'</div>'+
            '<div class="sw57-hint">Показатели приблизительные: определены по жанрам, '+
                'а не по опросу зрителей.</div>'+
            (a.displayAge?'<div class="sw57-subhead">Возрастная маркировка</div>'+
                '<div class="sw57-fact-card">'+esc(a.displayAge)+'</div>':'')+
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
        var controls=state.sheet.closest('.sw57-modal').find('.modal__footer .modal__button');
        controls.removeClass('sw57-selected');
        controls.eq(which==='facts'?1:which==='mood'?2:0).addClass('sw57-selected');
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
        state.content.find('#sw57-random-result').html(
            '<div class="sw57-coin">🎲 Случай выбрал: <strong>'+
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
        state.sheet=$('<div class="sw57"/>');
        // Relative scaling only: preserve Lampa typography and the user's saved setting.
        state.sheet.css('font-size',
            Math.max(1,Math.min(1.32,settings().font/18)).toFixed(2)+'em');
        state.content=$('<div class="sw57-content"/>');
        state.sheet.append(state.content);
        state.content.html(
            '<div class="sw57-loading"><div class="sw57-loading__title">'+
            esc(m.title||m.name||'Фильм')+'</div>'+
            '<div class="sw57-loading__hint">Проверяем данные TMDB…</div>'+
            '<div class="sw57-loading__bar"></div></div>');
        if(button)button.addClass('sw57-busy');
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
            state.sheet.closest('.modal').addClass('sw57-modal');
            state.sheet.closest('.modal').find('.modal__footer .modal__button').first()
                .addClass('sw57-selected');
        }catch(e){
            state.opened=false;state.sheet=null;state.content=null;
            if(button)button.removeClass('sw57-busy');
            console.error('[ShouldWatch] Modal:',e);
            return;
        }
        analyze(m).then(function(a){
            if(button)button.removeClass('sw57-busy');
            if(token!==state.run || !state.opened)return;
            state.answer=a;
            switchPane('verdict');
        }).catch(function(err){
            if(button)button.removeClass('sw57-busy');
            if(token!==state.run || !state.opened)return;
            console.error('[ShouldWatch] Analyze:',err);
            state.content.html('<div class="sw57-loading">'+
                '<div class="sw57-loading__title">Не удалось получить информацию</div>'+
                '<div class="sw57-loading__hint">Попробуйте открыть анализ ещё раз.</div></div>');
            notify('Не удалось выполнить анализ');
        });
    }

    function removeLegacyButtons(scope) {
        if(!scope || !scope.length)return;
        scope.find('.sw-custom-button-enhanced,.sw55-trigger,.sw56-trigger').remove();
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
        row.addClass('sw57-host');
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
            if(e.options[i] && (e.options[i].shouldWatch55 || e.options[i].shouldWatch56 || e.options[i].shouldWatch57))
                e.options.splice(i,1);
        }
        e.options.push({title:'Стоит ли смотреть',shouldWatch57:true,onSelect:function(){
            setTimeout(function(){show(c,null);},100);
        }});
    }

    function init() {
        if (initialized || window.capsule_should_watch_v57) return;
        if (!window.Lampa || !window.$ || !Lampa.Listener || !Lampa.Modal) {
            if (++bootAttempts<30) setTimeout(init,500);
            return;
        }
        initialized=true;
        window.capsule_should_watch_v57=true;
        window.should_watch_plugin_installed=true;
        window.should_watch_plugin_enhanced=true;
        styles();if(!window.sw_settings_ready_v52)initSettings();
        Lampa.Listener.follow('full',function(e){
            if (!e)return;
            if (e.type==='complite')addButton(e);
            else if(e.type==='options')addOption(e);
        });
        if (Lampa.Manifest) Lampa.Manifest.plugins={
            name:'Стоит ли смотреть',type:'other',version:'57.0',
            description:'Рекомендации и факты TMDB с нативным интерфейсом Lampa'
        };
        console.log('[ShouldWatch] v57 ready · richer Lampa UI with original source button position');
    }
    if (window.appready || document.readyState!=='loading') init();
    else document.addEventListener('DOMContentLoaded',init);
    setTimeout(init,1200);
})();
