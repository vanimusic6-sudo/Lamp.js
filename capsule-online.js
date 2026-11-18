/*
 * Capsule Online for Lampa 0.1.0
 * Companion for Skaz Onlyskaz (lampacskaz).
 *
 * Uses the upstream plugin at runtime. Does not copy its source, auth,
 * transport, signed URLs or video resolver. No external telemetry.
 * Install alongside Onlyskaz or let this plugin load the official script.
 */
(function (root) {
    'use strict';
    if (root.__capsuleSkazOnline) return;
    root.__capsuleSkazOnline = true;

    var L = null, installed = false, cssInstalled = false, settingsInstalled = false;
    var PREFIX = 'capsule_skaz_online_';
    var COMPONENT = 'capsule_skaz_online';
    var BOOT_ATTEMPTS = 0;
    var boundStats = false;
    var activeVideo = null;

    function get(key, fallback) {
        try {
            var value = L.Storage.get(PREFIX + key, fallback);
            if (value === undefined || value === null) return fallback;
            if (typeof fallback === 'boolean') return value === true || value === 'true' || value === 1;
            return value;
        } catch (ignored) { return fallback; }
    }
    function put(key, value) {
        try { L.Storage.set(PREFIX + key, value); } catch (ignored) {}
    }
    function info(message) {
        try { if (L.Noty && L.Noty.show) L.Noty.show(message); } catch (ignored) {}
    }
    function debug(message) {
        if (get('debug', false) && root.console && root.console.log)
            root.console.log('[Capsule Online]', message);
    }
    function isSeries(movie) {
        return !!(movie && (movie.name || Number(movie.number_of_seasons) > 0 || movie.type === 'tv'));
    }
    function keyOf(item) {
        var name = String(item && (item.balanser || (item.name || '').split(' ')[0]) || '');
        return name.toLowerCase().trim();
    }
    function resolution(name) {
        var value = String(name || '').toLowerCase();
        var match = value.match(/(?:^|[^\d])(2160|1440|1080|720|576|540|480|360)\s*[pр]?/);
        if (match) return Number(match[1]);
        if (/4k|uhd/.test(value)) return 2160;
        if (/2k|qhd/.test(value)) return 1440;
        if (/full.?hd|fhd/.test(value)) return 1080;
        if (/\bhd\b/.test(value)) return 720;
        if (/\bsd\b/.test(value)) return 480;
        return 0;
    }
    function qualityLimit() {
        var mode = String(get('quality', 'auto'));
        if (mode === 'max') return 4320;
        if (mode === '2160') return 2160;
        if (mode === '1080') return 1080;
        if (mode === '720') return 720;
        var height = 0, network = 0;
        try {
            height = Math.max(root.screen ? root.screen.height || 0 : 0,
                root.screen ? root.screen.width || 0 : 0);
            network = root.navigator && root.navigator.connection &&
                Number(root.navigator.connection.downlink) || 0;
        } catch (ignored) {}
        // No trusted connection estimate: use stable Full HD rather than gamble
        // on 4K (MSE support does not establish 4K decode performance).
        if (height >= 2000 && network >= 22) return 2160;
        if (network && network < 5) return 480;
        if (network && network < 10) return 720;
        return 1080;
    }
    function providerBonus(name) {
        var text = String(name || '').toLowerCase();
        if (/red.?head.?sound|\brhs\b/.test(text)) return 8;
        if (/rezka|filmix|kinopub|kodik/.test(text)) return 5;
        if (/remux/.test(text)) return 3;
        return 0;
    }
    function metrics() {
        var value = get('metrics', {});
        return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    }
    function record(source, ok, elapsed) {
        source = String(source || '').replace(/[^a-z0-9/_-]/gi, '').slice(0, 48);
        if (!source) return;
        var values = metrics(), m = values[source] || {good:0,bad:0,latency:0,at:0};
        m.good = Math.max(0, Number(m.good) || 0);
        m.bad = Math.max(0, Number(m.bad) || 0);
        if (ok) {
            m.good++;
            if (isFinite(elapsed) && elapsed > 0 && elapsed < 45000)
                m.latency = m.latency ? Math.round(m.latency * .7 + elapsed * .3) : Math.round(elapsed);
        } else {
            m.bad++;
            m.at = Date.now();
        }
        if (m.good + m.bad > 100) {
            m.good = Math.round(m.good * .65);
            m.bad = Math.round(m.bad * .65);
        }
        values[source] = m;
        var keys = Object.keys(values);
        if (keys.length > 80) {
            keys.sort(function(a,b) {
                return (values[a].at || 0) - (values[b].at || 0);
            });
            keys.slice(0,keys.length-80).forEach(function(key){delete values[key];});
        }
        put('metrics', values);
    }
    function sourceScore(item, previous) {
        if (!item || item.show === false) return -100000;
        var key = keyOf(item), quality = resolution(item.name);
        var limit = qualityLimit(), score = 20 + providerBonus(item.name);
        if (quality > 0) {
            score += Math.min(quality, limit) / 65;
            if (quality > limit) score -= 6;
        }
        var m = previous[key];
        if (m) {
            score += Math.min(32, (Number(m.good)||0) * 4);
            score -= Math.min(90, (Number(m.bad)||0) * 16);
            if (m.at && Date.now() - Number(m.at) < 10*60*1000) score -= 22;
            if (m.latency > 0) score -= Math.min(18, m.latency / 900);
        }
        return score;
    }
    function sourceOrder(rows) {
        var values = metrics();
        return (rows || []).filter(function(row) {
            return row && row.url && keyOf(row) && row.show !== false;
        }).map(function(row,index){
            return {key:keyOf(row),name:String(row.name || keyOf(row)),
                score:sourceScore(row,values),original:index};
        }).sort(function(a,b){
            return b.score-a.score || a.original-b.original;
        });
    }
    function voiceScore(label) {
        var s = String(label || '').toLowerCase();
        var points = 0;
        if (/red.?head.?sound|\brhs\b/.test(s)) points += 40;
        if (/lostfilm/.test(s)) points += 38;
        if (/newstudio|new.?studio/.test(s)) points += 36;
        if (/jaskier/.test(s)) points += 35;
        if (/кубик|куб в кубе/.test(s)) points += 29;
        if (/hdrezka|rezka|дубляж/.test(s)) points += 27;
        if (/профессиональн|многоголос/.test(s)) points += 24;
        if (/официальн|лицензионн/.test(s)) points += 21;
        if (/оригинал|original/.test(s)) points += 6;
        if (/одноголос|любительск|нейросет|автоперевод/.test(s)) points -= 18;
        if (/комментар|описательн|тифлокомментар/.test(s)) points -= 30;
        if (/18\+/.test(s)) points -= 4;
        return points;
    }
    function qualityCandidate(qualityMap) {
        if (!qualityMap || typeof qualityMap !== 'object') return null;
        var limit = qualityLimit(), best = null, fallback = null;
        Object.keys(qualityMap).forEach(function(label){
            var url = qualityMap[label];
            if (url && typeof url === 'object') url = url.url || url.src;
            if (typeof url !== 'string') return;
            url = url.split(' or ')[0].trim();
            if (!/^https?:\/\//i.test(url)) return;
            var height = resolution(label);
            if (!height) return;
            var item = {label:label,url:url,height:height};
            if (!fallback || height < fallback.height) fallback = item;
            if (height <= limit && (!best || height > best.height)) best = item;
        });
        return best || fallback;
    }
    function bindPlayerStats() {
        if (boundStats || !L.Player || !L.Player.listener) return;
        boundStats = true;
        L.Player.listener.follow('create',function(evt){
            var data = evt && (evt.data || evt);
            if (!data || !data.isonline) return;
            try { if (L.Activity.active().component !== 'lampacskaz') return; } catch (ignored) { return; }
            var key = '';
            try { key = L.Storage.get('active_balanser', ''); } catch (ignored) {}
            if (key) activeVideo = {key:String(key),at:Date.now(),confirmed:false};
        });
        if (L.PlayerVideo && L.PlayerVideo.listener) {
            ['playing','loadeddata'].forEach(function(type){
                L.PlayerVideo.listener.follow(type,function(){
                    if (!activeVideo || activeVideo.confirmed) return;
                    activeVideo.confirmed=true;
                    record(activeVideo.key,true,Date.now()-activeVideo.at);
                    debug('Поток начал воспроизводиться');
                });
            });
            L.PlayerVideo.listener.follow('error',function(evt){
                if (!activeVideo || activeVideo.confirmed) return;
                if (evt && evt.fatal === false) return;
                record(activeVideo.key,false,0);
                debug('Не удалось запустить поток');
                activeVideo=null;
            });
        }
    }

    function decorate(instance, session) {
        try {
            var view = instance.render && instance.render();
            var $view = view && view.jquery ? view : root.jQuery && root.jQuery(view);
            if (!$view || !$view.length) return;
            $view.addClass('cso-root');
            var card = $view.find('.online-prestige').first();
            if (!card.length) return;
            var status = $view.find('.cso-status');
            if (!status.length) {
                status = root.jQuery('<div class="cso-status" aria-live="polite"></div>');
                card.before(status);
            }
            var current = L.Storage.get('active_balanser', '') || 'выбирается';
            var quality = get('quality','auto') === 'auto' ? 'качество: авто' : 'качество: '+get('quality','auto');
            var route = get('auto',true) ? 'АВТОВЫБОР' : 'РУЧНОЙ ВЫБОР';
            status.text(route + '   ·   ' + current + '   ·   ' + quality);
            if (session.status) status.attr('data-state', session.status);
        } catch (error) { debug('UI: '+error.message); }
    }
    function sameActivity(instance) {
        try { return L.Activity.active().activity === instance.activity; }
        catch (ignored) { return false; }
    }
    function autoStartFilm(instance, session) {
        if (!get('autoplay',true) || !get('auto',true) || isSeries(session.movie) ||
            session.launched || !sameActivity(instance)) return;
        var tries = 0;
        (function attempt(){
            if (!sameActivity(instance) || session.launched || tries++ > 8) return;
            var view = instance.render && instance.render();
            var items = view && view.find && view.find('.online-prestige--full');
            if (items && items.length) {
                session.launched=true;
                debug('Автозапуск лучшего доступного фильма');
                items.eq(0).trigger('hover:enter');
            } else setTimeout(attempt,175);
        })();
    }
    function enhance(instance, movie) {
        if (!instance || instance.__csoEnhanced) return instance;
        instance.__csoEnhanced = true;
        var session = {movie: movie || {}, sourceOrder:[], bad:{}, attempts:0,
            launched:false, status:'ready', autoSwitch:false, voiceTried:{}};
        instance.__csoSession = session;
        var rawStartSource = instance.startSource;
        var rawChange = instance.changeBalanser;
        var rawParse = instance.parse;
        var rawDisplay = instance.display;
        var rawSetQuality = instance.setDefaultQuality;
        var rawNoAnswer = instance.doesNotAnswer;
        var rawGetFileUrl = instance.getFileUrl;
        var rawStart = instance.start;

        function activeSource() {
            try {return String(L.Storage.get('active_balanser',''));}catch(e){return '';}
        }
        function nextSource(reason) {
            if (!get('auto',true) || !get('fallback',true) ||
                session.attempts >= 3 || !sameActivity(instance)) return false;
            var current = activeSource();
            if (current) { session.bad[current] = true; record(current,false,0); }
            var next = session.sourceOrder.filter(function(row){
                return !session.bad[row.key] && row.key !== current;
            })[0];
            if (!next) return false;
            session.attempts++;
            session.status='recover';
            session.autoSwitch=true;
            info('Capsule Online: пробуем другой источник · ' + next.name);
            debug('Переход на другой балансер, причина: '+reason);
            try {
                rawChange.call(instance,next.key);
                decorate(instance,session);
                return true;
            } catch (error) { debug('Смена источника: '+error.message);return false; }
            finally { session.autoSwitch=false; }
        }

        if (typeof rawStartSource === 'function') instance.startSource = function(rows){
            if (get('auto',true) && Array.isArray(rows)) {
                session.sourceOrder=sourceOrder(rows);
                var manual = get('manual',{}), preferred = manual && manual[String(movie.id)];
                var best = session.sourceOrder.filter(function(x){
                    return x.key === preferred;
                })[0] || session.sourceOrder[0];
                if (best) {
                    var current = L.Storage.cache('online_last_balanser',3000,{});
                    if (!current || typeof current !== 'object') current={};
                    current[movie.id]=best.key;
                    L.Storage.set('online_last_balanser',current);
                    debug('Выбран '+best.name+' (оценка '+Math.round(best.score)+')');
                }
            }
            return rawStartSource.apply(this,arguments);
        };

        if (typeof rawChange === 'function') instance.changeBalanser = function(key){
            if (!session.autoSwitch && key) {
                var manual = get('manual',{});
                if (!manual || typeof manual !== 'object') manual={};
                manual[String(movie.id)] = String(key);
                put('manual',manual);
                session.bad={};
                session.attempts=0;
            }
            session.launched=false;
            return rawChange.apply(this,arguments);
        };

        if (typeof rawParse === 'function') instance.parse = function(data){
            if (get('auto',true) && get('voice','smart') !== 'original' &&
                typeof data === 'string' && typeof this.parseJsonDate === 'function') {
                try {
                    var buttons = this.parseJsonDate(data,'.videos__button');
                    if (buttons && buttons.length > 1) {
                        var preferred = this.getChoice && this.getChoice(activeSource());
                        var prevName = preferred && String(preferred.voice_name || '');
                        // A previous choice wins: it may be an explicit viewer choice.
                        if (!prevName || get('voice','smart') === 'force') {
                            var options = buttons.slice().sort(function(a,b){
                                return voiceScore(b.text)-voiceScore(a.text);
                            });
                            var best = options[0], id = activeSource()+'|'+String(best.url);
                            if (best && best.url && !session.voiceTried[id] &&
                                voiceScore(best.text) > 0 && !best.active) {
                                session.voiceTried[id]=true;
                                session.status='voice';
                                session.autoSwitch=true;
                                try {
                                    this.replaceChoice({voice:buttons.indexOf(best),
                                        voice_name:best.text,voice_url:best.url});
                                } finally {session.autoSwitch=false;}
                                debug('Озвучка: '+best.text);
                            }
                        }
                    }
                } catch(error){debug('Голос: '+error.message);}
            }
            return rawParse.apply(this,arguments);
        };

        if (typeof rawSetQuality === 'function') instance.setDefaultQuality = function(data){
            var result=rawSetQuality.apply(this,arguments);
            if (get('auto',true)) {
                var best=qualityCandidate(data && data.quality);
                if (best) {
                    data.url=best.url;
                    data.__capsuleQuality=best.label;
                }
            }
            return result;
        };

        if (typeof rawDisplay === 'function') instance.display = function(videos){
            var list = Array.isArray(videos) ? videos.slice() : videos;
            if (get('auto',true) && Array.isArray(list) && !isSeries(movie)) {
                list.sort(function(a,b) {
                    function rank(item) {
                        var keys = Object.keys(item.quality || item.qualitys || {});
                        var top=keys.reduce(function(w,k){return Math.max(w,resolution(k));},0);
                        return Math.min(qualityLimit(),top)/30 +
                            voiceScore(item.voice_name || item.text || '') +
                            (item.method === 'play' ? 3 : 0);
                    }
                    return rank(b)-rank(a);
                });
            }
            var value=rawDisplay.call(this,list);
            decorate(instance,session);
            autoStartFilm(instance,session);
            return value;
        };

        if (typeof rawNoAnswer === 'function') instance.doesNotAnswer = function(error){
            if (error && error.accsdb) return rawNoAnswer.apply(this,arguments);
            if (nextSource('нет ответа или списка видео')) return;
            return rawNoAnswer.apply(this,arguments);
        };

        if (typeof rawGetFileUrl === 'function') instance.getFileUrl = function(file,call,waiting){
            var start=Date.now(),name=activeSource();
            var wrapped=function(video, metadata){
                if (video && video.url) debug('Ссылка получена за '+(Date.now()-start)+' мс');
                else if (name) {
                    record(name,false,0);
                    if (!isSeries(movie)) {
                        // Do not auto-switch a serial mid-episode: season indexes
                        // and selected voice are not interchangeable between providers.
                        setTimeout(function(){nextSource('ссылка на фильм недоступна');},0);
                    }
                }
                if (typeof call === 'function') call.apply(this,arguments);
            };
            return rawGetFileUrl.call(this,file,wrapped,waiting);
        };

        if (typeof rawStart === 'function') instance.start = function(){
            var result=rawStart.apply(this,arguments);
            decorate(instance,session);
            return result;
        };
        return instance;
    }

    function wrappedConstructor(original) {
        if (typeof original !== 'function' || original.__csoWrapped) return original;
        function CapsuleWrappedComponent(object) {
            var originalInstance = new original(object);
            return enhance(originalInstance,object && object.movie);
        }
        CapsuleWrappedComponent.prototype = original.prototype;
        CapsuleWrappedComponent.__csoWrapped = true;
        CapsuleWrappedComponent.__csoOriginal = original;
        return CapsuleWrappedComponent;
    }

    function hookComponent() {
        if (installed || !L || !L.Component || !L.Component.add) return;
        installed=true;
        var oldAdd = L.Component.add;
        L.Component.add = function(name, ctor) {
            if (name === 'lampacskaz') ctor=wrappedConstructor(ctor);
            return oldAdd.call(this,name,ctor);
        };
        if (L.Component.get) {
            var existing=L.Component.get('lampacskaz');
            if (existing && !existing.__csoWrapped)
                L.Component.add('lampacskaz',existing);
        }
        debug('Совместимость с Onlyskaz подключена');
    }

    function installCSS() {
        if (cssInstalled || !root.document || !root.document.head) return;
        cssInstalled=true;
        var css = [
            '.cso-root .online-prestige{border:1px solid rgba(255,255,255,.085);border-radius:.8em;background:rgba(255,255,255,.055);overflow:visible;transition:background .18s ease,border-color .18s ease;box-shadow:none}',
            '.cso-root .online-prestige+.online-prestige{margin-top:.6em}',
            '.cso-root .online-prestige.focus{background:rgba(255,255,255,.125);border-color:rgba(255,255,255,.45)}',
            '.cso-root .online-prestige.focus::after{border:solid .18em rgba(255,255,255,.9);border-radius:1em;top:-.36em;right:-.36em;bottom:-.36em;left:-.36em}',
            '.cso-root .online-prestige__body{padding:1em 1.25em;min-width:0}',
            '.cso-root .online-prestige__img{width:11.8em;min-height:7em}',
            '.cso-root .online-prestige__img>img{border-radius:.75em 0 0 .75em}',
            '.cso-root .online-prestige__title{font-size:1.35em;font-weight:620;line-height:1.25;white-space:normal;-webkit-line-clamp:2;line-clamp:2}',
            '.cso-root .online-prestige__info{opacity:.78;font-size:.9em;min-width:0}',
            '.cso-root .online-prestige__quality{font-variant-numeric:tabular-nums;font-weight:650;opacity:.9}',
            '.cso-root .online-prestige__timeline{margin:.75em 0 .45em}',
            '.cso-root .online-prestige__time{opacity:.68;font-size:.88em}',
            '.cso-root .online-prestige--folder{background:rgba(255,255,255,.04)}',
            '.cso-root .online-prestige__episode-number{font-variant-numeric:tabular-nums;font-weight:700;text-shadow:0 2px 9px rgba(0,0,0,.3)}',
            '.cso-root .cso-status{padding:.4em .12em 1em;letter-spacing:.095em;font-size:.75em;font-weight:650;opacity:.62;text-transform:uppercase}',
            '.cso-root .cso-status[data-state=recover]{opacity:.88}',
            '@media(max-width:660px){.cso-root .online-prestige{border-radius:.72em}.cso-root .online-prestige__img{width:7em;min-height:5.9em}.cso-root .online-prestige__body{padding:.8em .92em}.cso-root .online-prestige__title{font-size:1.06em}.cso-root .online-prestige__head{align-items:flex-start;gap:.35em}.cso-root .online-prestige__time{padding-left:0}.cso-root .online-prestige__footer{gap:.5em}.cso-root .online-prestige__quality{padding-left:.3em}.cso-root .cso-status{font-size:.68em}}',
            '@media(prefers-reduced-motion:reduce){.cso-root .online-prestige{transition:none}}'
        ].join('\n');
        var style=root.document.createElement('style');
        style.id='capsule-skaz-online-style';
        style.textContent=css;
        root.document.head.appendChild(style);
    }

    function registerSettings() {
        if (settingsInstalled || !L || !L.SettingsApi ||
            !L.SettingsApi.addComponent || !L.SettingsApi.addParam) return;
        settingsInstalled=true;
        L.SettingsApi.addComponent({
            component:COMPONENT,name:'Capsule Online · Автовыбор',
            icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h6l3-7 3 14 3-7h3"/></svg>'
        });
        [
          ['auto','Автоматический выбор', 'Выбирать доступный балансер, озвучку и качество.',
              {true:'Включён',false:'Выключен'},true],
          ['quality','Качество','Авто учитывает размер экрана и оценку сети. Максимум — без ограничения.',
              {auto:'Авто · стабильно',max:'Максимальное',2160:'До 4K',1080:'До 1080p',720:'До 720p'},'auto'],
          ['voice','Озвучка','Учитывать прежний ручной выбор и качество студии.',
              {smart:'Авто · с памятью выбора',force:'Авто · всегда выбирать лучшую',original:'Не менять выбор Skaz'},'smart'],
          ['autoplay','Автозапуск фильмов','Первый подходящий фильм запускается автоматически. Для сериалов остаётся выбор серии.',
              {true:'Включён',false:'Выключен'},true],
          ['fallback','Резервный балансер','После ошибки поиска или получения ссылки переходить на другой доступный источник.',
              {true:'Включён',false:'Выключен'},true],
          ['debug','Отладка','Только технические сообщения без ссылок, заголовков и токенов.',
              {true:'Включена',false:'Выключена'},false]
        ].forEach(function(row){
            var values={};
            Object.keys(row[3]).forEach(function(key){
                values[key]=row[3][key];
            });
            L.SettingsApi.addParam({
                component:COMPONENT,
                param:{name:PREFIX+row[0],type:'select',values:values,default:row[4]},
                field:{name:row[1],description:row[2]}
            });
        });
        L.SettingsApi.addParam({
            component:COMPONENT,
            param:{name:PREFIX+'reset_manual',type:'trigger',default:false},
            field:{name:'Сбросить ручные предпочтения',
                description:'Заново выбирать балансер автоматически для всех фильмов и сериалов.'},
            onChange:function(value){
                if(value){put('manual',{});info('Capsule Online: ручные предпочтения сброшены');}
            }
        });
        L.SettingsApi.addParam({component:COMPONENT,
            param:{name:PREFIX+'version',type:'static'},
            field:{name:'Версия: 0.1.0 · расширение Onlyskaz',
                description:'Использует исходный сетевой плагин Skaz. Никаких собственных медиа-серверов.'}
        });
    }

    function loadUpstreamIfMissing() {
        if (root.onlyskaz_plugin) return;
        // The standalone companion works with the official Skaz plugin, even
        // if its external script cannot be retrieved from this environment.
        if (!root.jQuery || !root.jQuery.getScript) {
            info('Capsule Online: установите Onlyskaz (skaz.tv/onlines.js)');
            return;
        }
        root.jQuery.getScript('https://skaz.tv/onlines.js')
            .fail(function() {
                info('Capsule Online: Skaz не загрузился. Установите его отдельно: skaz.tv/onlines.js');
            });
    }

    function boot() {
        if (!root.Lampa || !root.Lampa.Component || !root.Lampa.Storage) {
            if (++BOOT_ATTEMPTS < 35) setTimeout(boot,300);
            return;
        }
        L=root.Lampa;
        installCSS();
        hookComponent();
        registerSettings();
        bindPlayerStats();
        if (L.Listener && L.Listener.follow) L.Listener.follow('app',function(e){
            if (e && e.type === 'ready') {
                installCSS();
                registerSettings();
                bindPlayerStats();
            }
        });
        setTimeout(loadUpstreamIfMissing,1800);
    }
    boot();

    // Expose pure ranking helpers for regression tests; no tokens or URLs.
    root.__capsuleSkazOnlineDebug = {
        sourceOrder:sourceOrder,voiceScore:voiceScore,qualityCandidate:qualityCandidate,
        resolution:resolution,qualityLimit:qualityLimit
    };
})(window);
