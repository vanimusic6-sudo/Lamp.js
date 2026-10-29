/**
 * Стоит ли смотреть? · Native Lampa Edition v55.0
 *
 * Movie/TV facts from TMDB, transparent recommendation rationale,
 * native Lampa modal actions, and a layout safe for TV, touch and D-pad.
 * Self-contained; no extra hosts, trackers or external UI libraries.
 */
(function () {
    'use strict';

    var PLUGIN = 'should_watch_plugin_enhanced';
    var STYLE_ID = 'sw55-styles';
    var BTN = 'sw55-trigger';
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
            var genreObjs=genreList(payload.main,movie);
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
            var positive=[],caution=[];
            if (matchedGenres.length) caution.push('Ваши исключённые жанры: '+matchedGenres.join(', '));
            if (matchedActors.length) caution.push('Нелюбимые актёры: '+matchedActors.join(', '));
            if (matchedDirectors.length) caution.push('Нелюбимые режиссёры: '+matchedDirectors.join(', '));
            if(votes>=150 && bayes>=threshold+0.7)
                positive.push('Оценка зрителей '+fixed(rating)+'/10 на основе '+number(votes)+' голосов.');
            else if(votes>=150 && bayes<=threshold-0.7)
                caution.push('Зрительская оценка '+fixed(rating)+'/10 ниже выбранного порога '+fixed(threshold)+'.');
            else if(votes>=35)
                positive.push('Есть '+number(votes)+' оценок зрителей; преимущество перед вашим порогом неочевидно.');
            if(votes<150) caution.push('Оценок пока недостаточно для уверенного совета.');
            var age=certification(payload.main,kind);
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
                if (value && facts.length<24) facts.push({label:label,value:value,origin:origin||'TMDB'});
            }
            var title=clean(main.title||main.name||movie.title||movie.name||'Фильм',250);
            var firstDate=main.release_date||main.first_air_date||movie.release_date||movie.first_air_date;
            fact(kind==='tv'?'Начало показа':'Премьера',clean(firstDate,40));
            fact('Жанры',genres.join(', '));
            fact('Режиссёр',dir.join(', '));
            fact('Сценарий',write.join(', '));
            fact('В ролях',cast.slice(0,6).join(', '));
            var duration=Number(main.runtime || movie.runtime || (main.episode_run_time && main.episode_run_time[0]) || 0);
            if(duration>0 && duration<1200)fact(kind==='tv'?'Длительность серии':'Хронометраж',duration+' мин');
            if(kind==='tv') {
                if(Number(main.number_of_seasons)>0) fact('Сезоны',main.number_of_seasons);
                if(Number(main.number_of_episodes)>0) fact('Эпизоды',main.number_of_episodes);
                var creators=names(main.created_by,4);
                if(creators.length) fact('Создатели',creators.join(', '));
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
            var topics=verifiedTopics(payload.main);
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
                title:title,kind:kind,year:year(firstDate),verdict:verdict,tone:tone,
                reason:reason,rating:rating,votes:votes,confidence:confidence,
                threshold:threshold,position:position,
                positive:positive,caution:caution,facts:facts,topics:topics,
                atmos:atmos,genreLine:genreLine,accuracy:accuracy,
                partial:!(payload.main || payload.en),disliked:hasDislikes,
                displayAge:age,studio:(main.production_companies||[]).length>0,
                hasTrailer:list(en.videos&&en.videos.results).some(function(v){
                    return v && v.type==='Trailer' && v.site==='YouTube';
                })
            };
        });
    }

    function styles() {
        if (document.getElementById(STYLE_ID)) return;
        var css = [
            '.sw55,.sw55 *,.sw55 *:before,.sw55 *:after{box-sizing:border-box}',
            '.sw55{width:100%;max-width:100%;min-width:0;padding:.35em .3em 1.3em;',
            'color:inherit;font-family:inherit;line-height:1.5;overflow-wrap:break-word}',
            '.sw55 *{min-width:0;max-width:100%;overflow-wrap:break-word}',
            '.sw55-screen{animation:sw55Fade .22s ease both}',
            '@keyframes sw55Fade{from{opacity:.18}to{opacity:1}}',
            '.sw55-panel{padding:1em 1.1em;background:rgba(128,128,128,.105);',
            'border:1px solid rgba(128,128,128,.22);border-radius:.65em;margin:0 0 .75em}',
            '.sw55-topline{font-size:.72em;opacity:.67;margin-bottom:.65em}',
            '.sw55-verdict{font-size:1.8em;line-height:1.12;letter-spacing:-.02em;font-weight:750;',
            'margin-bottom:.5em;overflow-wrap:anywhere}',
            '.sw55-verdict--yes{color:#69c993}.sw55-verdict--no{color:#f07b80}',
            '.sw55-verdict--maybe{color:#efbc67}.sw55-verdict--unknown{color:inherit}',
            '.sw55-context{font-size:.86em;opacity:.9;line-height:1.55}',
            '.sw55-meter{height:.33em;position:relative;background:rgba(128,128,128,.28);',
            'border-radius:.4em;margin:1em 0 .4em}',
            '.sw55-meter:after{content:"";position:absolute;left:50%;top:-.13em;bottom:-.13em;',
            'width:2px;background:currentColor;opacity:.45}',
            '.sw55-meter__marker{position:absolute;top:50%;left:50%;height:.85em;width:.85em;',
            'border-radius:50%;background:currentColor;border:2px solid rgba(140,140,140,.6);',
            'transform:translate(-50%,-50%);transition:left .5s cubic-bezier(.22,.7,.28,1)}',
            '.sw55-scale{display:flex;justify-content:space-between;gap:1em;opacity:.6;font-size:.65em}',
            '.sw55-section{font-size:1.08em;font-weight:700;margin:1.1em 0 .5em}',
            '.sw55-list{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:.75em}',
            '.sw55-subpanel{padding:.9em 1em;background:rgba(128,128,128,.09);',
            'border-radius:.55em;border:1px solid rgba(128,128,128,.17)}',
            '.sw55-subhead{font-size:.9em;font-weight:700;margin:0 0 .75em}',
            '.sw55-point{font-size:.86em;line-height:1.5;padding:.35em 0;',
            'border-top:1px solid rgba(128,128,128,.14)}',
            '.sw55-point:first-of-type{border:0}',
            '.sw55-positive .sw55-subhead{color:#76d59d}',
            '.sw55-caution .sw55-subhead{color:#f0b879}',
            '.sw55-micro{font-size:.75em;opacity:.67;line-height:1.5;margin:.7em .1em}',
            '.sw55-facts{background:rgba(128,128,128,.09);border-radius:.65em;',
            'padding:.3em .95em;border:1px solid rgba(128,128,128,.17)}',
            '.sw55-row{display:grid;grid-template-columns:minmax(0,36%) minmax(0,1fr);',
            'gap:1em;padding:.65em 0;border-bottom:1px solid rgba(128,128,128,.18)}',
            '.sw55-row:last-child{border:0}',
            '.sw55-label{opacity:.65;font-size:.83em}',
            '.sw55-value{font-size:.9em;text-align:left;overflow-wrap:anywhere;word-break:break-word}',
            '.sw55-tags{display:flex;flex-wrap:wrap;gap:.45em;margin:.5em 0 1em}',
            '.sw55-tag{display:inline-flex;max-width:100%;border:1px solid rgba(128,128,128,.28);',
            'border-radius:.4em;background:rgba(128,128,128,.11);padding:.3em .6em;font-size:.79em}',
            '.sw55-mood{padding:.9em 1em;margin:.6em 0;border:1px solid rgba(128,128,128,.18);',
            'border-radius:.55em;background:rgba(128,128,128,.09)}',
            '.sw55-mood-name{opacity:.66;font-size:.77em;margin-bottom:.25em}',
            '.sw55-mood-value{font-weight:600;font-size:.95em}',
            '.sw55-random{padding:.65em .9em;border-radius:.45em;background:rgba(128,128,128,.15);',
            'margin-top:.8em;font-weight:650;animation:sw55Fade .25s ease both}',
            '.sw55-tabs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.4em;',
            'margin:.1em 0 .8em}',
            '.sw55-tab{display:flex;align-items:center;justify-content:center;min-height:2.65em;',
            'font-size:.85em;text-align:center;padding:.45em .25em;border-radius:.55em;',
            'background:rgba(128,128,128,.12);border:1px solid rgba(128,128,128,.18);',
            'cursor:pointer;overflow-wrap:anywhere}',
            '.sw55-tab.sw55-current{background:rgba(128,128,128,.24);font-weight:700}',
            '.sw55-tab.focus{background:#fff;color:#111;border-color:#fff}',
            '.sw55-trigger{max-width:100%;min-width:0}',
            '.sw55-trigger svg{width:1.5em;height:1.5em}',
            '.sw55-trigger.sw55-busy{opacity:.6;pointer-events:none}',
            '@media(max-width:760px){.sw55-list{grid-template-columns:minmax(0,1fr)}',
            '.sw55-row{grid-template-columns:minmax(0,1fr);gap:.12em}',
            '.sw55-panel{padding:.85em}.sw55-verdict{font-size:1.5em}',
            '.sw55-facts{padding:.2em .7em}}',
            '@media(prefers-reduced-motion:reduce){.sw55-screen,.sw55-random{animation:none}',
            '.sw55-meter__marker{transition:none}}'
        ].join('');
        var st=document.createElement('style');
        st.id=STYLE_ID;
        st.textContent=css;
        document.head.appendChild(st);
    }

    function p(text) { return '<div class="sw55-point">'+esc(text)+'</div>'; }
    function paneVerdict(a) {
        var good=a.positive.length?a.positive:['Объективных преимуществ по имеющимся сведениям не выявлено.'];
        var risk=a.caution.length?a.caution:['Явных личных ограничений или существенных рисков по доступным данным нет.'];
        return '<div class="sw55-screen">' +
            '<div class="sw55-panel">' +
                '<div class="sw55-topline">СТОИТ ЛИ СМОТРЕТЬ · '+esc(a.kind==='tv'?'СЕРИАЛ':'ФИЛЬМ')+
                    (a.year?' · '+esc(a.year):'')+'</div>' +
                '<div class="sw55-verdict sw55-verdict--'+a.tone+'">'+esc(a.verdict)+'</div>' +
                '<div class="sw55-context">'+esc(a.reason)+'</div>' +
                '<div class="sw55-meter"><div class="sw55-meter__marker" data-position="'+a.position+'"></div></div>' +
                '<div class="sw55-scale"><span>Ниже вашего порога</span><span>Выше порога</span></div>' +
                '<div class="sw55-micro">'+esc(a.confidence)+
                    ' · Порог: '+fixed(a.threshold)+'/10 · Источник: TMDB</div>' +
            '</div>' +
            '<div class="sw55-section">Аргументы</div>' +
            '<div class="sw55-list">' +
                '<div class="sw55-subpanel sw55-positive"><div class="sw55-subhead">В пользу просмотра</div>'+
                    good.slice(0,5).map(p).join('')+'</div>' +
                '<div class="sw55-subpanel sw55-caution"><div class="sw55-subhead">Что учесть</div>'+
                    risk.slice(0,5).map(p).join('')+'</div>' +
            '</div>' +
            '<div class="sw55-micro">Рекомендация основана на оценках зрителей и ваших исключениях, '+
                'а не на придуманном ИИ обзоре. Нажмите «Факты» для просмотра исходных данных.</div>' +
            '<div id="sw55-random-result" aria-live="polite"></div>' +
            '</div>';
    }
    function paneFacts(a) {
        var rows=a.facts.map(function(f) {
            return '<div class="sw55-row"><div class="sw55-label">'+esc(f.label)+'</div>' +
                '<div class="sw55-value">'+esc(f.value)+'</div></div>';
        }).join('');
        var tags=a.topics.map(function(t){
            return '<span class="sw55-tag">'+esc(t)+'</span>';
        }).join('');
        return '<div class="sw55-screen">' +
            '<div class="sw55-section">Факты и сведения</div>' +
            '<div class="sw55-micro">'+esc(a.accuracy)+'. Пустые поля не подменяются догадками.</div>' +
            (rows?'<div class="sw55-facts">'+rows+'</div>':
                '<div class="sw55-panel">У TMDB пока недостаточно сведений об этом произведении.</div>')+
            (tags?'<div class="sw55-section">Тематические метки</div>'+
                '<div class="sw55-tags">'+tags+'</div>'+
                '<div class="sw55-micro">Метки сообщества TMDB, а не проверенные события '+
                'или гарантия конкретных сцен в фильме.</div>':'') +
            '<div class="sw55-micro">Все поля приведены без автоматического выдумывания фактов. '+
            'Возрастная маркировка сохраняет исходную страну и систему рейтингов.</div>' +
            '</div>';
    }
    function paneMood(a) {
        var cards=a.atmos.map(function(m){
            return '<div class="sw55-mood"><div class="sw55-mood-name">'+esc(m.label)+'</div>'+
                '<div class="sw55-mood-value">'+esc(m.value)+'</div></div>';
        }).join('');
        return '<div class="sw55-screen">' +
            '<div class="sw55-section">Характер просмотра</div>' +
            '<div class="sw55-micro">Это осторожные предположения по жанрам, а не измеренные '+
                'оценки темпа, эмоций или зрительского настроения.</div>' +
            cards +
            '<div class="sw55-section">Жанры</div>' +
            '<div class="sw55-panel">'+esc(a.genreLine)+'</div>' +
            (a.displayAge ? '<div class="sw55-micro">Возрастная маркировка: '+
                esc(a.displayAge)+'</div>':'') +
            '<div class="sw55-micro">Подробную информацию без предположений смотрите во вкладке «Факты».</div>' +
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
        if (!state.sheet || !state.content || !state.answer || !state.opened) return;
        var a=state.answer;
        state.sheet.find('.sw55-tab').removeClass('sw55-current');
        state.sheet.find('.sw55-tab[data-tab="'+which+'"]').addClass('sw55-current');
        state.content.html(which==='facts'?paneFacts(a):which==='mood'?paneMood(a):paneVerdict(a));
        var marker=state.content.find('.sw55-meter__marker'), token=state.run;
        if(marker.length) setTimeout(function(){
            if(token===state.run && state.opened && marker.closest('body').length)
                marker.css('left',marker.attr('data-position')+'%');
        },35);
        try {
            // Lampa.Scroll.update requires a target element. Its reset() is
            // the correct way to avoid blank/cropped content after changing tabs.
            if (Lampa.Modal && typeof Lampa.Modal.scroll==='function') {
                var sc=Lampa.Modal.scroll();
                if(sc && typeof sc.reset==='function') sc.reset();
            }
        }catch(e){}
    }

    function randomChoice() {
        if (!state.opened || !state.sheet) return;
        var yes=Math.random()<.5;
        switchPane('verdict');
        var box=state.content.find('#sw55-random-result');
        box.html('<div class="sw55-random">🎲 Случайный выбор: '+
            (yes?'смотреть':'не смотреть')+'</div>');
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
        var now=Date.now();
        if(now-state.lastOpen<400) return;
        if (state.opened) return;
        state.lastOpen=now;
        var token=++state.run;
        var button=trigger && trigger.length?trigger:null;
        if(button){
            button.addClass('sw55-busy');
            button.find('span').text('Анализ…');
        }
        function release(){
            if(button){button.removeClass('sw55-busy');button.find('span').text('Стоит ли смотреть');}
        }
        analyze(m).then(function(a){
            release();
            if(token!==state.run || !stillOnCard(m))return;
            if(!Lampa.Modal||typeof Lampa.Modal.open!=='function')return;
            state.answer=a;
            state.movie=m;
            state.opened=true;
            state.sheet=$('<div class="sw55"/>');
            state.sheet.css('font-size',settings().font+'px');
            var tabs=$('<div class="sw55-tabs"/>');
            [['verdict','Вердикт'],['facts','Факты'],['mood','Атмосфера']].forEach(function(t){
                tabs.append($('<div class="sw55-tab selector" tabindex="0"/>')
                    .attr('data-tab',t[0]).text(t[1]));
            });
            state.content=$('<div class="sw55-content"/>');
            state.sheet.append(tabs).append(state.content);
            state.content.html(paneVerdict(a));
            Lampa.Modal.open({
                title:'Стоит ли смотреть · '+a.title,
                size:'large',
                html:state.sheet,
                select:state.sheet.find('.sw55-tab').first(),
                onSelect:function(el){
                    var target=el && el.attr && el.attr('data-tab');
                    if(target) switchPane(target);
                },
                buttons_position:'outside',
                buttons:[
                    {name:'🎲 Случайный выбор',onSelect:randomChoice},
                    {name:'Закрыть',onSelect:close}
                ],
                onBack:close
            });
            switchPane('verdict');
        }).catch(function(err){
            release();
            if(token!==state.run)return;
            console.error('[ShouldWatch] analyze error',err);
            notify('Не удалось выполнить анализ. Попробуйте снова.');
        });
    }

    function addButton(e) {
        var c=getCard(e),root=e&&e.body&&$(e.body);
        if(!c || !root || !root.length)return;
        var row=root.find('.full-start-new__buttons,.full-start__buttons').first();
        if(!row.length||row.find('.'+BTN).length)return;
        var button=$('<div class="full-start__button selector '+BTN+'" tabindex="0"/>');
        button.append($('<div class="full-start__icon"/>').html(ICON));
        button.append($('<span/>').text('Стоит ли смотреть'));
        var options=row.find('.button--options').first();
        if(options.length) button.insertBefore(options);
        else row.append(button);
        var lastPress=0;
        button.on('hover:enter click',function(event){
            if(event.type==='click')event.preventDefault();
            var time=Date.now();if(time-lastPress<420)return;
            lastPress=time;show(c,button);
        });
    }
    function addOption(e) {
        var c=getCard(e);
        if(!c||!e.options||!Array.isArray(e.options))return;
        if(e.options.some(function(x){return x && x.shouldWatch55;}))return;
        e.options.push({title:'Стоит ли смотреть',shouldWatch55:true,onSelect:function(){
            setTimeout(function(){show(c,null);},100);
        }});
    }

    function init() {
        if (initialized || window.should_watch_plugin_installed) return;
        if (!window.Lampa || !window.$ || !Lampa.Listener || !Lampa.Modal) {
            if (++bootAttempts<30) setTimeout(init,500);
            return;
        }
        initialized=true;
        window.should_watch_plugin_installed=true;
        window.should_watch_plugin_enhanced=true;
        styles();initSettings();
        Lampa.Listener.follow('full',function(e){
            if (!e)return;
            if (e.type==='complite')addButton(e);
            else if(e.type==='options')addOption(e);
        });
        if (Lampa.Manifest) Lampa.Manifest.plugins={
            name:'Стоит ли смотреть',type:'other',version:'55.0',
            description:'Рекомендации и факты TMDB с нативным интерфейсом Lampa'
        };
        console.log('[ShouldWatch] v55 ready · native UI and verified TMDB facts');
    }
    if (window.appready || document.readyState!=='loading') init();
    else document.addEventListener('DOMContentLoaded',init);
    setTimeout(init,1200);
})();
