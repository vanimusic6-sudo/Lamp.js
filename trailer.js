/*
 * CAPSULE Trailer for Lampa
 * Multi-provider trailer aggregator with isolated discovery and playback adapters.
 *
 * Integration points verified against current Lampa source:
 * - Lampa.Listener 'full' / type 'complite'
 * - .buttons--container / source grouping in full/start/buttons.js
 * - Lampa.Activity / Lampa.Component
 * - Lampa.Scroll / Lampa.Controller / global Navigator
 * - Lampa.Reguest
 * - Lampa.Player / Lampa.PlayerVideo.registerTube
 *
 * Discovery / playback layers:
 * - OK.ru, VK Video and Dzen are stable trailer sources.
 *
 */
(function () {
    'use strict';

    if (window.capsule_trailer_ready) return;
    window.capsule_trailer_ready = true;

    var VERSION = '3.21.0';
    var COMPONENT = 'capsule_trailer';
    var NAV_CONTROLLER = 'content';
    var CACHE_KEY = 'capsule_trailer_cache_v21';
    var CACHE_TTL = 1000 * 60 * 60 * 6;
    var CACHE_MAX = 40;
    var SEARCH_TIMEOUT = 8000;
    var RESOLVE_TIMEOUT = 7000;
    var AUTO_SCORE_MIN = 260;
    var AUTO_SETTLE_MS = 420;
    var AUTO_SEARCH_MAX_MS = 2600;
    var jsonpSerial = 0;

    var ICON = '' +
        '<svg width="42" height="42" viewBox="0 0 42 42" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
            '<rect x="3.5" y="9.5" width="35" height="23" rx="11.5" stroke="currentColor" stroke-width="2.35"/>' +
            '<path d="M17 14.8L27.5 21L17 27.2V14.8Z" fill="currentColor"/>' +
        '</svg>';

    function log() {
        if (!window.console || !console.log) return;
        var args = ['[CAPSULE Trailer]'];
        for (var i = 0; i < arguments.length; i++) args.push(arguments[i]);
        try { console.log.apply(console, args); } catch (e) {}
    }

    function parseMaybeJson(data) {
        if (typeof data !== 'string') return data;
        try { return JSON.parse(data); } catch (e) { return null; }
    }

    function cleanText(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/ё/g, 'е')
            .replace(/[^0-9a-zа-я]+/gi, ' ')
            .replace(/\s+/g, ' ')
            .replace(/^\s+|\s+$/g, '');
    }

    function escapeHtml(value) {
        return String(value == null ? '' : value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function yearOf(movie) {
        var date = movie && (movie.release_date || movie.first_air_date) || '';
        var match = String(date).match(/^(\d{4})/);
        return match ? match[1] : '';
    }

    function mediaType(movie) {
        if (!movie) return 'movie';
        if (movie.media_type === 'tv' || movie.name || movie.original_name || movie.first_air_date) return 'tv';
        return 'movie';
    }

    function titleVariants(movie) {
        var raw = [
            movie && movie.title,
            movie && movie.name,
            movie && movie.original_title,
            movie && movie.original_name
        ];
        var out = [];
        var seen = {};
        for (var i = 0; i < raw.length; i++) {
            var value = cleanText(raw[i]);
            if (value && !seen[value]) {
                seen[value] = true;
                out.push(value);
            }
        }
        return out;
    }

    function words(value) {
        var text = cleanText(value);
        return text ? text.split(' ') : [];
    }

    function secondsText(value) {
        var n = parseInt(value, 10);
        if (!n || n < 1) return '';
        var m = Math.floor(n / 60);
        var s = n % 60;
        return m + ':' + (s < 10 ? '0' : '') + s;
    }

    function inferLanguage(item) {
        if (item.language) return String(item.language).toUpperCase();
        var text = cleanText((item.title || '') + ' ' + (item.description || ''));
        if (/(русск|дубляж|дублирован|озвуч)/.test(text)) return 'RU';
        if (/(english|original trailer)/.test(text)) return 'EN';
        return '';
    }

    function isTrailerTitle(title) {
        var text = cleanText(title);
        return /(^| )(трейлер|trailer|тизер|teaser)( |$)/.test(text);
    }

    function noisyTrailerTitle(title, movie) {
        var text = cleanText(title);
        if (!text) return true;

        if (/(обзор|реакци|разбор|рецензи|мнение|объяснен|пасхалк|теори|интервью|саундтрек|soundtrack|review|reaction|breakdown|interview|behind the scenes|making of|featurette|fan made|fanmade|concept trailer|concept teaser|gameplay|walkthrough)/.test(text)) return true;
        if (/(трейлер игры|трейлер к игре|игровой трейлер|video game trailer|game trailer)/.test(text)) return true;
        if (/(полный фильм|фильм полностью|full movie|watch online|смотреть онлайн)/.test(text)) return true;
        if (/(отрывок|фрагмент|сцена|клип|clip|scene|tv spot)/.test(text)) return true;

        if (mediaType(movie) !== 'tv' && /(сезон|season|серия|эпизод|episode)/.test(text)) return true;
        if (mediaType(movie) === 'tv' && /(серия|эпизод|episode\s*\d+)/.test(text)) return true;

        return false;
    }

    function meaningfulTitleWords(value) {
        var stop = {
            'the':1,'a':1,'an':1,'of':1,'and':1,'or':1,'to':1,'in':1,'on':1,'for':1,
            'и':1,'в':1,'во':1,'на':1,'с':1,'со':1,'к':1,'ко':1,'из':1,'по':1,'для':1
        };
        var input = words(value);
        var out = [];
        for (var i = 0; i < input.length; i++) {
            if (input[i].length > 1 && !stop[input[i]]) out.push(input[i]);
        }
        return out;
    }

    function shortTitleConflict(resultTitle, variants) {
        var allowed = {
            'трейлер':1,'trailer':1,'тизер':1,'teaser':1,'официальный':1,'official':1,
            'русский':1,'russian':1,'дублированный':1,'дублирован':1,'dubbed':1,
            'мультфильм':1,'мульт':1,'animation':1,'animated':1,'анимационный':1,
            'фильм':1,'film':1,'movie':1,'hd':1,'uhd':1,'fullhd':1
        };
        var result = meaningfulTitleWords(resultTitle);

        for (var v = 0; v < variants.length; v++) {
            var base = meaningfulTitleWords(variants[v]);
            if (base.length !== 1) continue;

            var target = base[0];
            if (result.indexOf(target) < 0) continue;

            var foreign = [];
            for (var i = 0; i < result.length; i++) {
                var token = result[i];
                if (token === target || allowed[token]) continue;
                if (/^(?:19|20)\d{2}$/.test(token)) continue;
                if (/^(?:2160|1440|1080|720|480|360|240|144)p?$/.test(token)) continue;
                foreign.push(token);
            }

            if (!foreign.length) return false;
        }

        for (var k = 0; k < variants.length; k++) {
            if (meaningfulTitleWords(variants[k]).length === 1) {
                var one = meaningfulTitleWords(variants[k])[0];
                if (result.indexOf(one) >= 0) return true;
            }
        }

        return false;
    }

    function semanticTrailerKey(item) {
        var generic = {
            'трейлер':1,'trailer':1,'тизер':1,'teaser':1,'официальный':1,'official':1,
            'русский':1,'russian':1,'дублированный':1,'дублирован':1,'dubbed':1,
            'hd':1,'uhd':1,'fullhd':1,'4k':1,'2160p':1,'1440p':1,'1080p':1,'720p':1,'480p':1
        };
        var input = words(item && item.title || '');
        var out = [];
        for (var i = 0; i < input.length; i++) {
            var token = input[i];
            if (generic[token]) continue;
            if (/^(?:19|20)\d{2}$/.test(token)) continue;
            out.push(token);
        }
        return out.join(' ') || cleanText(item && item.title || '');
    }

    function dedupeCandidates(items) {
        var map = {};
        var out = [];
        for (var i = 0; i < (items || []).length; i++) {
            var item = items[i];
            var key = semanticTrailerKey(item);
            if (!key) key = item.canonical || item.id || String(i);
            if (!map[key]) {
                map[key] = item;
                out.push(item);
            }
            else if ((item.score || 0) > (map[key].score || 0)) {
                var old = map[key];
                var at = out.indexOf(old);
                if (at >= 0) out[at] = item;
                map[key] = item;
            }
        }
        out.sort(function (a, b) { return (b.score || 0) - (a.score || 0); });
        return out;
    }

    function explicitYears(text) {
        var matches = String(text || '').match(/(?:19|20)\d{2}/g) || [];
        var out = [];
        for (var i = 0; i < matches.length; i++) {
            if (out.indexOf(matches[i]) < 0) out.push(matches[i]);
        }
        return out;
    }

    function titleHasMovieYear(item, movie) {
        var year = yearOf(movie);
        if (!year || !item) return false;
        return explicitYears(item.title || '').indexOf(year) >= 0;
    }

    function preferMovieYear(items, movie, unwrap) {
        items = items || [];
        var exact = [];

        for (var i = 0; i < items.length; i++) {
            var candidate = unwrap ? unwrap(items[i]) : items[i];
            if (candidate && titleHasMovieYear(candidate, movie)) exact.push(items[i]);
        }

        return exact.length ? exact : items;
    }

    function coverage(resultTitle, variant) {
        var target = words(variant);
        var hay = ' ' + cleanText(resultTitle) + ' ';
        if (!target.length) return 0;
        var found = 0;
        for (var i = 0; i < target.length; i++) {
            if (hay.indexOf(' ' + target[i] + ' ') >= 0) found++;
        }
        return found / target.length;
    }

    function qualityNumber(value) {
        var match = String(value || '').match(/(2160|1440|1080|720|480|360|240|144)/);
        return match ? parseInt(match[1], 10) : 0;
    }

    function preferredQuality() {
        var value = String(Lampa.Storage.field('capsule_trailer_quality') || 'best');
        if (value === 'best') return 0;
        return qualityNumber(value);
    }

    function settingEnabled(name, defaultValue) {
        var value = Lampa.Storage.field(name);
        if (value === undefined || value === null || value === '') return defaultValue !== false;
        if (value === false || value === 0) return false;
        value = String(value).toLowerCase();
        return value !== 'false' && value !== '0' && value !== 'off' && value !== 'no';
    }

    function qualityPriorityScore(height) {
        height = parseInt(height, 10) || 0;
        if (!height) return 0;

        var preferred = preferredQuality();
        if (!preferred) {
            if (height >= 2160) return 28;
            if (height >= 1080) return 22;
            if (height >= 720) return 14;
            if (height >= 480) return 5;
            return 0;
        }

        if (height === preferred) return 42;
        if (height > preferred) {
            var above = height / preferred;
            return Math.max(18, 32 - Math.round((above - 1) * 8));
        }

        var ratio = height / preferred;
        return Math.max(-24, Math.round(24 * ratio) - 24);
    }

    function yandexTypeHeight(url) {
        var match = String(url || '').match(/[?&]type=(\d)(?:&|$)/);
        if (!match) return 0;
        var map = { '4': 144, '0': 240, '1': 360, '2': 480, '3': 720, '5': 1080, '6': 1440, '7': 2160 };
        return map[match[1]] || 0;
    }

    function pickPreferredStream(streams) {
        if (!streams || !streams.length) return null;

        var prepared = [];
        for (var i = 0; i < streams.length; i++) {
            var stream = streams[i] || {};
            var url = String(stream.url || '');
            if (!/^https?:\/\//i.test(url)) continue;
            prepared.push({
                url: url,
                height: parseInt(stream.height, 10) || qualityNumber(stream.quality || stream.label || stream.name) || yandexTypeHeight(url)
            });
        }
        if (!prepared.length) return null;

        prepared.sort(function (a, b) {
            var preferred = preferredQuality();
            if (!preferred) return (b.height || 0) - (a.height || 0);

            var ad = a.height ? Math.abs(a.height - preferred) : 99999;
            var bd = b.height ? Math.abs(b.height - preferred) : 99999;
            if (ad !== bd) return ad - bd;

            var aBelow = a.height && a.height <= preferred;
            var bBelow = b.height && b.height <= preferred;
            if (aBelow !== bBelow) return aBelow ? -1 : 1;
            return (b.height || 0) - (a.height || 0);
        });

        return prepared[0];
    }

    function trailerKind(value) {
        var text = cleanText(value);
        if (/(^| )(тизер|teaser)( |$)/.test(text)) return 'teaser';
        if (/(^| )(трейлер|trailer)( |$)/.test(text)) return 'trailer';
        return '';
    }

    function movieKey(movie) {
        return mediaType(movie) + ':' + (movie && movie.id || cleanText(movie && (movie.title || movie.name) || '')) + ':' + yearOf(movie);
    }

    function scoreCandidate(item, movie, exactMovieMatch) {
        if (!item || !item.title) return -9999;
        var duration = parseInt(item.duration, 10) || 0;
        var kind = item.kind || trailerKind(item.title);
        if (!kind && !exactMovieMatch) return -9999;
        if (noisyTrailerTitle(item.title, movie)) return -9999;

        if (duration) {
            if (kind === 'teaser' && (duration < 8 || duration > (exactMovieMatch ? 360 : 240))) return -9999;
            if (kind !== 'teaser' && (duration < 15 || duration > (exactMovieMatch ? 600 : 420))) return -9999;
        }

        var score = exactMovieMatch ? 260 : 0;
        var variants = titleVariants(movie);
        var resultTitle = cleanText(item.title);
        var best = exactMovieMatch ? 100 : 0;

        for (var i = 0; i < variants.length; i++) {
            var c = coverage(resultTitle, variants[i]);
            var value = Math.round(c * 100);
            if (resultTitle.indexOf(variants[i]) >= 0) value += 95;
            if (c === 1) value += 35;
            if (value > best) best = value;
        }

        if (!exactMovieMatch) {
            var meaningful = meaningfulTitleWords(movie && (movie.title || movie.name || movie.original_title || movie.original_name) || '');
            if (best < 80) return -9999;
            if (meaningful.length <= 2 && best < 150) return -9999;
            if (shortTitleConflict(item.title, variants)) return -9999;
        }
        score += best;

        var year = yearOf(movie);
        var years = explicitYears(item.title + ' ' + (item.description || ''));
        if (year) {
            if (String(item.year || '') === year || years.indexOf(year) >= 0) score += 45;
            else if (years.length) {
                var near = false;
                for (var y = 0; y < years.length; y++) {
                    if (Math.abs(parseInt(years[y], 10) - parseInt(year, 10)) <= 1) near = true;
                }
                if (!near && !exactMovieMatch) return -9999;
                if (!near) score -= 60;
            }
        }

        var text = cleanText(item.title + ' ' + (item.description || ''));
        var lang = inferLanguage(item).toLowerCase();
        if (item.official || /(^| )(официальн|official)( |$)/.test(text)) score += 42;
        if (kind === 'trailer') score += 28;
        if (kind === 'teaser') score += 10;
        if (lang === 'ru' || lang === 'rus') score += 34;
        if (duration >= 45 && duration <= 240) score += 16;

        var quality = qualityNumber(item.qualityHint);
        score += qualityPriorityScore(quality);

        if (mediaType(movie) === 'tv') {
            if (/(сериал|series|season|сезон)/.test(text)) score += 10;
        }
        else if (/(сериал|season|сезон)/.test(text) && !exactMovieMatch) {
            score -= 45;
        }

        var transport = parseInt(item.transportScore, 10) || 0;
        score += Math.min(18, Math.max(0, Math.round(transport / 6)));
        return score;
    }

    function cacheGet(key) {
        var cache = Lampa.Storage.get(CACHE_KEY, {});
        if (!cache || typeof cache !== 'object') return null;
        var entry = cache[key];
        if (!entry || !entry.time || Date.now() - entry.time > CACHE_TTL || !entry.items) return null;
        return entry.items;
    }

    function cachePut(key, items) {
        var cache = Lampa.Storage.get(CACHE_KEY, {});
        if (!cache || typeof cache !== 'object') cache = {};
        cache[key] = { time: Date.now(), items: items };
        var keys = Object.keys(cache);
        if (keys.length > CACHE_MAX) {
            keys.sort(function (a, b) { return (cache[a].time || 0) - (cache[b].time || 0); });
            while (keys.length > CACHE_MAX) delete cache[keys.shift()];
        }
        Lampa.Storage.set(CACHE_KEY, cache, true);
    }

    function cacheDropMovie(movie) {
        var cache = Lampa.Storage.get(CACHE_KEY, {});
        if (!cache || typeof cache !== 'object') return;
        var suffix = ':' + movieKey(movie);
        var changed = false;
        Object.keys(cache).forEach(function (key) {
            if (key.slice(-suffix.length) === suffix) {
                delete cache[key];
                changed = true;
            }
        });
        if (changed) Lampa.Storage.set(CACHE_KEY, cache, true);
    }

    function jsonp(url, timeout, done) {
        var callbackName = '__capsuleTrailerJsonp' + Date.now() + '_' + (++jsonpSerial);
        var script = document.createElement('script');
        var timer = null;
        var finished = false;

        function finish(error, data) {
            if (finished) return;
            finished = true;
            if (timer) clearTimeout(timer);
            try { if (script.parentNode) script.parentNode.removeChild(script); } catch (e) {}
            try { delete window[callbackName]; } catch (e2) { window[callbackName] = undefined; }
            done(error, data);
        }

        window[callbackName] = function (data) { finish(null, data); };
        script.async = true;
        script.onerror = function () { finish(new Error('jsonp-network')); };
        script.src = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'format=jsonp&callback=' + encodeURIComponent(callbackName);
        document.head.appendChild(script);
        timer = setTimeout(function () { finish(new Error('jsonp-timeout')); }, timeout || SEARCH_TIMEOUT);

        return function () { finish(new Error('cancelled')); };
    }

    function requestData(url, dataType, timeout, done, extraHeaders) {
        var network = new Lampa.Reguest();
        var finished = false;
        var headers = { 'Accept': dataType === 'text' ? 'text/html,*/*' : 'application/json' };
        network.timeout(timeout || SEARCH_TIMEOUT);

        if (extraHeaders) {
            for (var headerName in extraHeaders) {
                if (Object.prototype.hasOwnProperty.call(extraHeaders, headerName)) headers[headerName] = extraHeaders[headerName];
            }
        }

        function finish(error, data) {
            if (finished) return;
            finished = true;
            try { network.clear(); } catch (e) {}
            if (!error && dataType === 'json') data = parseMaybeJson(data);
            done(error, data);
        }

        try {
            network.native(url, function (data) {
                finish(null, data);
            }, function () {
                finish(new Error('network'));
            }, false, {
                timeout: timeout || SEARCH_TIMEOUT,
                dataType: dataType,
                headers: headers
            });
        }
        catch (e) {
            finish(e);
        }

        return function () {
            finished = true;
            try { network.clear(); } catch (e) {}
        };
    }

    function nativeRequest(url, timeout, done, headers) {
        return requestData(url, 'json', timeout, done, headers);
    }

    function textRequest(url, timeout, done, headers) {
        return requestData(url, 'text', timeout, done, headers);
    }

    function postRequest(url, dataType, timeout, postData, done) {
        var network = new Lampa.Reguest();
        var finished = false;
        network.timeout(timeout || SEARCH_TIMEOUT);

        function finish(error, data) {
            if (finished) return;
            finished = true;
            try { network.clear(); } catch (e) {}
            if (!error && dataType === 'json') data = parseMaybeJson(data);
            done(error, data);
        }

        try {
            network.native(url, function (data) {
                finish(null, data);
            }, function () {
                finish(new Error('network'));
            }, postData || '', {
                timeout: timeout || SEARCH_TIMEOUT,
                dataType: dataType,
                headers: {
                    'Accept': dataType === 'text' ? 'text/html,*/*' : 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8'
                }
            });
        }
        catch (e) {
            finish(e);
        }

        return function () {
            finished = true;
            try { network.clear(); } catch (e) {}
        };
    }

    function directMediaUrl(url) {
        return /^https?:\/\//i.test(String(url || '')) && /\.(?:m3u8|mpd|mp4|m4v)(?:[?#]|$)/i.test(String(url || ''));
    }

    function capsuleMediaUrl(url, type) {
        url = String(url || '');
        if (!url) return '';
        var hash = type === 'hls' ? 'capsule-hls' : 'capsule-direct';
        var clean = url.replace(/#.*$/, '');
        return clean + '#' + hash;
    }

    function playbackHeaders(source) {
        var headers = { 'User-Agent': 'Mozilla/5.0' };
        if (source === 'ok') headers.Referer = 'https://ok.ru/';
        else if (source === 'vk') headers.Referer = 'https://vkvideo.ru/';
        else if (source === 'dzen') headers.Referer = 'https://dzen.ru/';
        return headers;
    }

    function attachAlternateStreams(data, alternatives) {
        var queue = [];
        var seen = {};
        var current = String(data && data.url || '').replace(/#.*$/, '');
        alternatives = alternatives || [];

        for (var i = 0; i < alternatives.length; i++) {
            var item = alternatives[i] || {};
            var url = String(item.url || '');
            var clean = url.replace(/#.*$/, '');
            if (!url || clean === current || seen[clean]) continue;
            seen[clean] = true;
            queue.push(item);
        }

        if (!queue.length) return data;

        data.error = function (work, use) {
            if (!queue.length) {
                work.capsule_retry_inflight_until = 0;
                return;
            }
            var next = queue.shift();
            work.url = next.url;
            work.capsule_retry_inflight_until = Date.now() + 1800;
            work.capsule_retry_count = (parseInt(work.capsule_retry_count, 10) || 0) + 1;

            if (next.hls_type) work.hls_type = next.hls_type;
            else if (work.hls_type) delete work.hls_type;

            if (next.headers) work.headers = next.headers;
            use(next.url);
        };

        return data;
    }

    function decodeHtmlEntities(value) {
        value = String(value || '');
        if (value.indexOf('&') < 0) return value;
        return value.replace(/&(#x?[0-9a-f]+|quot|amp|apos|#39|lt|gt|nbsp);/gi, function (all, entity) {
            var name = String(entity || '').toLowerCase();
            if (name === 'quot') return '"';
            if (name === 'amp') return '&';
            if (name === 'apos' || name === '#39') return "'";
            if (name === 'lt') return '<';
            if (name === 'gt') return '>';
            if (name === 'nbsp') return ' ';
            if (name.charAt(0) === '#') {
                var hex = name.charAt(1) === 'x';
                var num = parseInt(name.slice(hex ? 2 : 1), hex ? 16 : 10);
                if (!isNaN(num)) return String.fromCharCode(num);
            }
            return all;
        });
    }

    function htmlAttribute(tag, name) {
        var marker = name + '=';
        var at = tag.indexOf(marker);
        if (at < 0) return '';
        var start = at + marker.length;
        var quote = tag.charAt(start);
        if (quote !== '"' && quote !== "'") return '';
        var end = tag.indexOf(quote, start + 1);
        return end < 0 ? '' : tag.slice(start + 1, end);
    }

    function okNativeProvider(value) {
        value = String(value || '').replace(/_/g, '').toUpperCase();
        return !value || value === 'UPLOADEDODKL' || value === 'LIVETVAPP';
    }

    function parseOkSearch(text, movie) {
        text = String(text || '');
        var component = text.indexOf('<video-search-result');
        var tagEnd = component < 0 ? -1 : text.indexOf('>', component);
        if (component < 0 || tagEnd < 0) return [];
        var encoded = htmlAttribute(text.slice(component, tagEnd + 1), 'data-props');
        if (!encoded) return [];
        var props;
        try { props = JSON.parse(decodeHtmlEntities(encoded)); } catch (e) { return []; }
        var list = props && props.videos && props.videos.list;
        if (!list || Object.prototype.toString.call(list) !== '[object Array]') return [];

        var out = [];
        var seen = {};
        for (var i = 0; i < list.length && out.length < 10; i++) {
            var card = list[i] || {};
            var raw = card.movie || {};
            if (raw.blocked || !okNativeProvider(raw.provider)) continue;
            var id = String(raw.id || '');
            if (!/^-?\d+$/.test(id) || seen[id]) continue;
            var title = decodeHtmlEntities(card.name || raw.title || '');
            if (!title) continue;
            var durationMs = parseInt(raw.duration, 10) || 0;
            var width = parseInt(raw.width, 10) || 0;
            var height = parseInt(raw.height, 10) || 0;
            var thumbnail = decodeHtmlEntities(card.imageUrl || (raw.thumbnail && (raw.thumbnail.big || raw.thumbnail.small)) || '');
            var item = {
                id: 'ok:' + id,
                canonical: 'ok:' + id,
                provider: 'ok',
                providerName: 'OK.ru',
                title: title,
                description: decodeHtmlEntities(card.description || ''),
                duration: durationMs > 1000 ? Math.round(durationMs / 1000) : durationMs,
                thumbnail: thumbnail,
                author: '',
                language: /русск|дублирован|дубляж/i.test(title) ? 'ru' : '',
                qualityHint: height ? height + 'p' : (width >= 1900 ? '1080p' : width >= 1200 ? '720p' : ''),
                year: '',
                kind: trailerKind(title),
                official: /официальн|official/i.test(title),
                okId: id,
                url: 'https://ok.ru/video/' + id,
                transportScore: 95,
                exactMovieMatch: false
            };
            item.score = scoreCandidate(item, movie, false);
            if (item.score >= 0) {
                seen[id] = true;
                out.push(item);
            }
        }
        out = dedupeCandidates(out);
        return out.slice(0, 6);
    }

    function okQualityHeight(name, url) {
        var map = { mobile: 144, lowest: 240, low: 360, sd: 480, hd: 720, full: 1080, quad: 1440, ultra: 2160 };
        var key = String(name || '').toLowerCase();
        if (map[key]) return map[key];
        var type = String(url || '').match(/[?&]type=(\d)(?:&|$)/);
        if (type) {
            var typeMap = { '4': 144, '0': 240, '1': 360, '2': 480, '3': 720, '5': 1080, '6': 1440, '7': 2160 };
            if (typeMap[type[1]]) return typeMap[type[1]];
        }
        return qualityNumber(name);
    }

    function parseOkPlayerOptions(text, id) {
        text = String(text || '');
        var cursor = 0;
        while (cursor < text.length) {
            var at = text.indexOf('data-options=', cursor);
            if (at < 0) break;
            var start = at + 'data-options='.length;
            var quote = text.charAt(start);
            if (quote !== '"' && quote !== "'") {
                cursor = start + 1;
                continue;
            }
            var end = text.indexOf(quote, start + 1);
            if (end < 0) break;
            var decoded = decodeHtmlEntities(text.slice(start + 1, end));
            if (decoded.indexOf(String(id)) >= 0) {
                try { return JSON.parse(decoded); } catch (e) { return null; }
            }
            cursor = end + 1;
        }
        return null;
    }

    function okMetadataFromPlayer(player, done) {
        if (!player || player.isExternalPlayer) return done(new Error('ok-external'));
        var flashvars = player.flashvars || {};
        var metadata = flashvars.metadata;
        if (metadata && typeof metadata === 'object') return done(null, metadata);
        if (metadata && typeof metadata === 'string') {
            try { return done(null, JSON.parse(metadata)); } catch (e) {}
        }
        var metadataUrl = String(flashvars.metadataUrl || '');
        if (!metadataUrl) return done(new Error('ok-no-metadata'));
        try { metadataUrl = decodeURIComponent(metadataUrl); } catch (e2) {}
        if (metadataUrl.indexOf('//') === 0) metadataUrl = 'https:' + metadataUrl;
        else if (metadataUrl.charAt(0) === '/') metadataUrl = 'https://ok.ru' + metadataUrl;
        if (!/^https?:\/\//i.test(metadataUrl)) return done(new Error('ok-metadata-url'));
        var body = flashvars.location ? 'st.location=' + encodeURIComponent(flashvars.location) : 'st.location=';
        return postRequest(metadataUrl, 'json', RESOLVE_TIMEOUT, body, done);
    }

    function resolveOk(item, context, done) {
        var id = item.okId;
        if (!id) {
            done(new Error('ok-id'));
            return function () {};
        }

        var cancelled = false;
        var cancelCurrent = textRequest('https://ok.ru/videoembed/' + encodeURIComponent(id), RESOLVE_TIMEOUT, function (error, text) {
            if (cancelled) return;
            if (error || !text) return done(error || new Error('ok-player'));

            var player = parseOkPlayerOptions(text, id);
            if (!player) return done(new Error('ok-options'));

            cancelCurrent = okMetadataFromPlayer(player, function (metaError, metadata) {
                if (cancelled) return;
                if (metaError || !metadata) return done(metaError || new Error('ok-metadata'));

                var videos = metadata.videos || [];
                var direct = [];

                for (var i = 0; i < videos.length; i++) {
                    var stream = videos[i] || {};
                    var streamUrl = String(stream.url || '');
                    if (!/^https?:\/\//i.test(streamUrl)) continue;

                    var height = okQualityHeight(stream.name, streamUrl);
                    direct.push({
                        url: streamUrl,
                        height: height,
                        name: stream.name || ''
                    });

                }

                var selected = pickPreferredStream(direct);
                var selectedType = 'direct';
                var hls = metadata.hlsManifestUrl || metadata.ondemandHls || '';

                if ((!selected || !selected.url) && hls && /^https?:\/\//i.test(hls)) {
                    selected = { url: hls, height: 0 };
                    selectedType = 'hls';
                }

                if (!selected || !selected.url) return done(new Error('ok-no-stream'));

                var selectedUrl = selectedType === 'direct' ? capsuleMediaUrl(selected.url, 'direct') :
                    capsuleMediaUrl(selected.url, 'hls');
                var result = {
                    url: selectedUrl,
                    title: item.title,
                    card: context.movie,
                    capsule_trailer: true,
                    capsule_source: selectedType === 'direct' ? 'ok-direct' : 'ok-hls',
                    headers: playbackHeaders('ok'),
                    hls_manifest_timeout: 15000
                };

                if (selectedType === 'hls') result.hls_type = 'native';

                var alternates = [];
                for (var vi = 0; vi < direct.length; vi++) {
                    if (!direct[vi] || !direct[vi].url || direct[vi].url === selected.url) continue;
                    alternates.push({
                        url: capsuleMediaUrl(direct[vi].url, 'direct'),
                        hls_type: '',
                        headers: playbackHeaders('ok')
                    });
                }
                if (hls && /^https?:\/\//i.test(hls) && hls !== selected.url) {
                    alternates.push({
                        url: capsuleMediaUrl(hls, 'hls'),
                        hls_type: 'native',
                        headers: playbackHeaders('ok')
                    });
                }
                attachAlternateStreams(result, alternates);

                done(null, result);
            });
        });

        return function () {
            cancelled = true;
            if (cancelCurrent) cancelCurrent();
        };
    }

    var OkProvider = {
        id: 'ok',
        name: 'OK',
        tier: 'stable',
        autoplay: true,
        search: function (context, done) {
            if (!settingEnabled('capsule_trailer_ok', true)) {
                done(null, []);
                return function () {};
            }

            var movie = context.movie || {};
            var title = movie.title || movie.name || movie.original_title || movie.original_name || '';
            var original = movie.original_title || movie.original_name || '';
            var year = yearOf(movie);
            var key = 'ok:' + movieKey(movie);
            var cached = cacheGet(key);
            if (cached) {
                done(null, cached);
                return function () {};
            }
            var queries = [];
            var all = [];
            var seen = {};
            var index = 0;
            var cancelled = false;
            var cancelCurrent = null;

            function addQuery(value) {
                value = String(value || '').replace(/^\s+|\s+$/g, '');
                if (value && queries.indexOf(value) < 0) queries.push(value);
            }

            addQuery([title, year, 'трейлер'].join(' '));
            if (original && cleanText(original) !== cleanText(title)) addQuery([original, year, 'trailer'].join(' '));

            function finish() {
                if (cancelled) return;
                all.sort(function (a, b) { return b.score - a.score; });
                all = all.slice(0, 6);
                cachePut(key, all);
                done(null, all);
            }

            function next() {
                if (cancelled) return;
                if (index >= queries.length) return finish();
                var query = queries[index++];
                var url = 'https://ok.ru/video/search?st.cmd=anonymVideo&st.ft=search&st.gsq=' + encodeURIComponent(query) + '&st.m=SEARCH';
                cancelCurrent = textRequest(url, 7000, function (error, text) {
                    if (!error && text) {
                        var items = parseOkSearch(text, movie);
                        for (var i = 0; i < items.length; i++) {
                            if (!seen[items[i].canonical]) {
                                seen[items[i].canonical] = true;
                                all.push(items[i]);
                            }
                        }
                    }

                    if (index === 1 && all.length >= 2) return finish();
                    next();
                });
            }

            next();
            return function () {
                cancelled = true;
                if (cancelCurrent) cancelCurrent();
            };
        },
        resolve: resolveOk
    };

    function dzenVideoId(value) {
        var match = String(value || '').match(/\/video\/watch\/([0-9a-z_-]+)/i);
        return match ? match[1] : '';
    }

    function dzenThumbnail(image) {
        image = image || {};
        if (image.url) return String(image.url);
        var template = String(image.urlTemplate || '');
        var namespace = String(image.namespace || '');
        if (!template || !namespace) return '';
        return template
            .replace('{namespace}', namespace)
            .replace('{size}', String(image.sizeName || 'scale_1200'));
    }

    function dzenDimensions(video) {
        video = video || {};
        var width = parseInt(video.width, 10) || 0;
        var height = parseInt(video.height, 10) || 0;
        var resolutions = video.resolutions;
        if (Object.prototype.toString.call(resolutions) === '[object Array]') {
            for (var i = 0; i < resolutions.length; i++) {
                var row = resolutions[i] || {};
                var rw = parseInt(row.width, 10) || 0;
                var rh = parseInt(row.height, 10) || 0;
                if (rw > width) {
                    width = rw;
                    height = rh;
                }
            }
        }
        return { width: width, height: height };
    }

    function normalizeDzenSearch(data, movie) {
        var feed = data && (data.feedData || data);
        var rows = feed && feed.items;
        var out = [];
        var seen = {};
        if (Object.prototype.toString.call(rows) !== '[object Array]') return out;

        for (var i = 0; i < rows.length && out.length < 8; i++) {
            var raw = rows[i] || {};
            var video = raw.video || {};
            var id = dzenVideoId(raw.link || '');
            var title = decodeHtmlEntities(raw.title || '');
            if (!id || !title || seen[id]) continue;

            var dimensions = dzenDimensions(video);
            var item = {
                id: 'dzen:' + id,
                canonical: 'dzen:' + id,
                provider: 'dzen',
                providerName: 'Дзен',
                title: title,
                description: '',
                duration: parseInt(video.duration, 10) || 0,
                thumbnail: dzenThumbnail(raw.image),
                author: '',
                language: /русск|дублирован|дубляж/i.test(title) ? 'ru' : '',
                qualityHint: dimensions.height ? dimensions.height + 'p' : '',
                year: '',
                kind: trailerKind(title),
                official: /официальн|official/i.test(title),
                dzenId: id,
                dzenVideo: video,
                url: 'https://dzen.ru/video/watch/' + id,
                transportScore: 66,
                exactMovieMatch: false
            };
            item.score = scoreCandidate(item, movie, false);
            if (item.score >= 0) {
                seen[id] = true;
                out.push(item);
            }
        }

        out = dedupeCandidates(out);
        return out.slice(0, 5);
    }

    function parseDzenDuration(value) {
        var parts = String(value || '').split(':');
        var seconds = 0;
        for (var i = 0; i < parts.length; i++) {
            var part = parseInt(parts[i], 10);
            if (isNaN(part)) return 0;
            seconds = seconds * 60 + part;
        }
        return seconds;
    }

    function normalizeDzenHtml(text, movie) {
        text = String(text || '');
        var marker = 'https://dzen.ru/video/watch/';
        var cursor = 0;
        var out = [];
        var seen = {};

        while (out.length < 6) {
            var linkAt = text.indexOf(marker, cursor);
            if (linkAt < 0) break;

            var idStart = linkAt + marker.length;
            var idEnd = idStart;
            while (idEnd < text.length && /[0-9a-z_-]/i.test(text.charAt(idEnd))) idEnd++;
            var id = text.slice(idStart, idEnd);
            cursor = idEnd;

            if (!id || seen[id]) continue;

            var articleStart = text.lastIndexOf('<article', linkAt);
            var articleEnd = text.indexOf('</article>', linkAt);
            if (articleStart < 0 || articleEnd < 0 || articleEnd - articleStart > 80000) continue;

            var card = text.slice(articleStart, articleEnd);
            var titleMatch = card.match(/data-testid=["']card-part-title["'][^>]*>([^<]+)/i);
            if (!titleMatch) titleMatch = card.match(/aria-label=["']([^"']+)["'][^>]*[^>]*href=["'][^"']*\/video\/watch\//i);
            var title = decodeHtmlEntities(titleMatch ? titleMatch[1] : '');
            if (!title) continue;

            var durationMatch = card.match(/aria-label=["']Общая длительность видео["'][^>]*>([^<]+)/i);
            var thumbnailMatch = card.match(/background-image\s*:\s*url\(([^)]+)\)/i);
            var thumbnail = thumbnailMatch ? String(thumbnailMatch[1] || '').replace(/^["']|["']$/g, '') : '';

            var item = {
                id: 'dzen:' + id,
                canonical: 'dzen:' + id,
                provider: 'dzen',
                providerName: 'Дзен',
                title: title,
                description: '',
                duration: durationMatch ? parseDzenDuration(durationMatch[1]) : 0,
                thumbnail: decodeHtmlEntities(thumbnail),
                author: '',
                language: /русск|дублирован|дубляж/i.test(title) ? 'ru' : '',
                qualityHint: '',
                year: '',
                kind: trailerKind(title),
                official: /официальн|official/i.test(title),
                dzenId: id,
                url: marker + id,
                transportScore: 62,
                exactMovieMatch: false
            };
            item.score = scoreCandidate(item, movie, false);
            if (item.score >= 0) {
                seen[id] = true;
                out.push(item);
            }
        }

        out = dedupeCandidates(out);
        return out.slice(0, 5);
    }

    function jsonObjectAt(text, start) {
        var depth = 0;
        var string = false;
        var escaped = false;

        for (var i = start; i < text.length; i++) {
            var current = text.charAt(i);

            if (string) {
                if (escaped) escaped = false;
                else if (current === '\\') escaped = true;
                else if (current === '"') string = false;
                continue;
            }

            if (current === '"') string = true;
            else if (current === '{') depth++;
            else if (current === '}' && --depth === 0) return text.slice(start, i + 1);
        }

        return '';
    }

    function dzenVideoFromPage(text) {
        text = String(text || '');
        var metadata = text.indexOf('"videoMetaResponse"');
        var params = metadata < 0 ? -1 : text.lastIndexOf('var _params', metadata);
        var start = params < 0 ? -1 : text.indexOf('{', params);
        if (start < 0) return null;

        var json = jsonObjectAt(text, start);
        if (!json) return null;

        try {
            var root = JSON.parse(json);
            return root && root.ssrData && root.ssrData.videoMetaResponse && root.ssrData.videoMetaResponse.video || null;
        }
        catch (e) {
            return null;
        }
    }

    function dzenStreamGroups(video) {
        video = video || {};
        var direct = [];
        var hls = [];
        var dash = [];

        function push(url, height) {
            url = String(url || '');
            if (/^\/\//.test(url)) url = 'https:' + url;
            if (!/^https?:\/\//i.test(url)) return;
            var entry = { url: url, height: parseInt(height, 10) || yandexTypeHeight(url) || 0 };
            if (/\.m3u8(?:[?#]|$)|[?&]ct=8(?:&|$)/i.test(url)) hls.push(entry);
            else if (/\.mpd(?:[?#]|$)|[?&]ct=6(?:&|$)/i.test(url)) dash.push(entry);
            else direct.push(entry);
        }

        push(video.id, 0);

        var streams = video.streams;
        if (Object.prototype.toString.call(streams) === '[object Array]') {
            for (var i = 0; i < streams.length; i++) push(streams[i], 0);
        }

        var one = video.oneVideoStreams;
        if (Object.prototype.toString.call(one) === '[object Array]') {
            var qualityMap = { ultra:2160, quad:1440, fullhd:1080, full:1080, hd:720, sd:480, low:360, lowest:240, mobile:144 };
            for (var j = 0; j < one.length; j++) {
                var row = one[j] || {};
                push(row.url, qualityMap[String(row.type || '').toLowerCase()] || qualityNumber(row.type));
            }
        }

        return { direct: direct, hls: hls, dash: dash };
    }

    function finishDzenResolve(video, item, context, done) {
        var groups = dzenStreamGroups(video);
        var type = '';
        var selected = pickPreferredStream(groups.direct);

        if (selected) type = 'direct';
        else {
            selected = pickPreferredStream(groups.hls);
            if (selected) type = 'hls';
            else {
                selected = pickPreferredStream(groups.dash);
                if (selected) type = 'dash';
            }
        }

        if (!selected || !selected.url) {
            done(new Error('dzen-stream'));
            return;
        }

        var playUrl = type === 'direct' ? capsuleMediaUrl(selected.url, 'direct') :
            (type === 'hls' ? capsuleMediaUrl(selected.url, 'hls') : selected.url);

        var result = {
            url: playUrl,
            title: item.title,
            card: context.movie,
            capsule_trailer: true,
            capsule_source: type === 'direct' ? 'dzen-direct' : 'dzen-' + type,
            headers: playbackHeaders('dzen'),
            hls_manifest_timeout: 12000
        };
        if (type === 'hls') result.hls_type = 'native';

        var alternatives = [];
        function addAlternatives(list, alternativeType) {
            for (var i = 0; i < list.length; i++) {
                var stream = list[i] || {};
                if (!stream.url || stream.url === selected.url) continue;
                alternatives.push({
                    url: alternativeType === 'direct' ? capsuleMediaUrl(stream.url, 'direct') :
                        (alternativeType === 'hls' ? capsuleMediaUrl(stream.url, 'hls') : stream.url),
                    hls_type: alternativeType === 'hls' ? 'native' : '',
                    headers: playbackHeaders('dzen')
                });
            }
        }
        addAlternatives(groups.direct, 'direct');
        addAlternatives(groups.hls, 'hls');
        addAlternatives(groups.dash, 'dash');
        attachAlternateStreams(result, alternatives);

        done(null, result);
    }

    function resolveDzen(item, context, done) {
        var immediate = dzenStreamGroups(item.dzenVideo || {});
        if (immediate.direct.length || immediate.hls.length || immediate.dash.length) {
            finishDzenResolve(item.dzenVideo, item, context, done);
            return function () {};
        }

        var page = item.url || ('https://dzen.ru/video/watch/' + item.dzenId);
        return textRequest(page, 6000, function (error, text) {
            if (error || !text) return done(error || new Error('dzen-page'));
            var video = dzenVideoFromPage(text);
            if (!video) return done(new Error('dzen-metadata'));
            finishDzenResolve(video, item, context, done);
        }, playbackHeaders('dzen'));
    }

    var DzenProvider = {
        id: 'dzen',
        name: 'Дзен',
        tier: 'stable',
        autoplay: true,
        search: function (context, done) {
            if (!settingEnabled('capsule_trailer_dzen', true)) {
                done(null, []);
                return function () {};
            }

            var movie = context.movie || {};
            var title = movie.title || movie.name || movie.original_title || movie.original_name || '';
            var year = yearOf(movie);
            var query = [title, year, 'трейлер'].join(' ').replace(/\s+/g, ' ');
            var jsonUrl = 'https://dzen.ru/api/web/v1/zen-search' +
                '?country_code=ru&forced_request_type=long_video_search' +
                '&query=' + encodeURIComponent(query) +
                '&clid=1400&type_filter=video&lang=ru';
            var htmlUrl = 'https://dzen.ru/search?query=' + encodeURIComponent(query) + '&type_filter=video';
            var cancelled = false;
            var cancelCurrent = nativeRequest(jsonUrl, 5500, function (error, data) {
                if (cancelled) return;
                var items = !error ? normalizeDzenSearch(data, movie) : [];

                if (items.length) {
                    done(null, items);
                    return;
                }

                cancelCurrent = textRequest(htmlUrl, 5500, function (htmlError, text) {
                    if (cancelled) return;
                    if (htmlError || !text) return done(htmlError || error || new Error('dzen-search'), []);
                    done(null, normalizeDzenHtml(text, movie));
                }, playbackHeaders('dzen'));
            });

            return function () {
                cancelled = true;
                if (cancelCurrent) cancelCurrent();
            };
        },
        resolve: resolveDzen
    };

    var VK_CLIENT_ID = '52461373';
    var VK_API_VERSION = '5.282';
    var vkAnonymous = { token: '', expires: 0 };

    function vkAnonymousToken(done) {
        var now = Math.floor(Date.now() / 1000);
        if (vkAnonymous.token && now + 60 < vkAnonymous.expires) {
            done(null, vkAnonymous.token);
            return function () {};
        }

        return postRequest(
            'https://login.vk.com/?act=get_anonym_token',
            'json',
            5500,
            'client_id=' + encodeURIComponent(VK_CLIENT_ID),
            function (error, data) {
                var root = data || {};
                var payload = root.data || {};
                var token = String(payload.access_token || '');
                if (error || String(root.type || '') !== 'okay' || !token) {
                    done(error || new Error('vk-anonymous-token'));
                    return;
                }

                vkAnonymous.token = token;
                vkAnonymous.expires = parseInt(payload.expired_at, 10) || now + 600;
                done(null, token);
            }
        );
    }

    function vkBestImage(images) {
        if (Object.prototype.toString.call(images) !== '[object Array]') return '';
        var best = '';
        var bestWidth = 0;
        for (var i = 0; i < images.length; i++) {
            var row = images[i] || {};
            var url = String(row.url || '');
            if (/^\/\//.test(url)) url = 'https:' + url;
            var width = parseInt(row.width, 10) || 0;
            if (url && width >= bestWidth) {
                best = url;
                bestWidth = width;
            }
        }
        return best;
    }

    function vkMaxHeight(video) {
        var files = video && video.files || {};
        var best = 0;
        for (var key in files) {
            if (!Object.prototype.hasOwnProperty.call(files, key)) continue;
            var match = String(key).match(/^mp4_(\d+)$/);
            if (match && /^https?:\/\//i.test(String(files[key] || ''))) {
                best = Math.max(best, parseInt(match[1], 10) || 0);
            }
        }
        return best || parseInt(video && video.height, 10) || 0;
    }

    function normalizeVkSearch(data, movie) {
        var response = data && data.response;
        var rows = response && response.catalog_videos;
        var out = [];
        var seen = {};
        if (Object.prototype.toString.call(rows) !== '[object Array]') return out;

        for (var i = 0; i < rows.length && out.length < 8; i++) {
            var wrapper = rows[i] || {};
            var video = wrapper.video || {};
            var owner = String(video.owner_id == null ? '' : video.owner_id);
            var id = String(video.id == null ? '' : video.id);
            var title = String(video.title || '');
            if (!owner || !id || !title) continue;

            var videoId = owner + '_' + id;
            if (seen[videoId]) continue;

            var height = vkMaxHeight(video);
            var item = {
                id: 'vk:' + videoId,
                canonical: 'vk:' + videoId,
                provider: 'vk',
                providerName: 'VK Video',
                title: title,
                description: String(video.description || ''),
                duration: parseInt(video.duration, 10) || 0,
                thumbnail: vkBestImage(video.image),
                author: '',
                language: /русск|дублирован|дубляж/i.test(title) ? 'ru' : '',
                qualityHint: height ? height + 'p' : '',
                year: '',
                kind: trailerKind(title),
                official: /официальн|official/i.test(title),
                vkId: videoId,
                url: 'https://vkvideo.ru/video' + videoId,
                transportScore: 72,
                exactMovieMatch: false
            };
            item.score = scoreCandidate(item, movie, false);
            if (item.score >= 0) {
                seen[videoId] = true;
                out.push(item);
            }
        }

        out = dedupeCandidates(out);
        return out.slice(0, 5);
    }

    function vkStreamGroups(files) {
        files = files || {};
        var direct = [];
        var hls = [];
        var dash = [];

        for (var key in files) {
            if (!Object.prototype.hasOwnProperty.call(files, key)) continue;
            var url = String(files[key] || '');
            if (/^\/\//.test(url)) url = 'https:' + url;
            if (!/^https?:\/\//i.test(url)) continue;

            var directMatch = String(key).match(/^mp4_(\d+)$/);
            if (directMatch) {
                direct.push({ url: url, height: parseInt(directMatch[1], 10) || 0 });
                continue;
            }

            if (/^hls/.test(key) && !/live_playback/.test(key)) hls.push({ url: url, height: 0 });
            else if (/^dash/.test(key) && !/live_playback/.test(key) && key !== 'dash_uni') dash.push({ url: url, height: 0 });
        }

        return { direct: direct, hls: hls, dash: dash };
    }

    function resolveVk(item, context, done) {
        var cancelled = false;
        var cancelCurrent = vkAnonymousToken(function (tokenError, token) {
            if (cancelled) return;
            if (tokenError || !token) return done(tokenError || new Error('vk-token'));

            var url = 'https://api.vk.com/method/video.getByIds?v=' + encodeURIComponent(VK_API_VERSION) +
                '&client_id=' + encodeURIComponent(VK_CLIENT_ID);
            var body = 'access_token=' + encodeURIComponent(token) +
                '&videos=' + encodeURIComponent(item.vkId) +
                '&video_fields=' + encodeURIComponent('files');

            cancelCurrent = postRequest(url, 'json', 6000, body, function (error, data) {
                if (cancelled) return;

                if (data && data.error && parseInt(data.error.error_code, 10) === 5) {
                    vkAnonymous.token = '';
                    vkAnonymous.expires = 0;
                }

                var rows = data && data.response && data.response.items;
                var video = Object.prototype.toString.call(rows) === '[object Array]' ? rows[0] : null;
                var groups = vkStreamGroups(video && video.files);

                if (error || !video || (!groups.direct.length && !groups.hls.length && !groups.dash.length)) {
                    done(error || new Error('vk-stream'));
                    return;
                }

                var type = '';
                var selected = pickPreferredStream(groups.direct);
                if (selected) type = 'direct';
                else {
                    selected = pickPreferredStream(groups.hls);
                    if (selected) type = 'hls';
                    else {
                        selected = pickPreferredStream(groups.dash);
                        if (selected) type = 'dash';
                    }
                }

                if (!selected || !selected.url) return done(new Error('vk-stream'));

                var playUrl = type === 'direct' ? capsuleMediaUrl(selected.url, 'direct') :
                    (type === 'hls' ? capsuleMediaUrl(selected.url, 'hls') : selected.url);
                var result = {
                    url: playUrl,
                    title: item.title,
                    card: context.movie,
                    capsule_trailer: true,
                    capsule_source: type === 'direct' ? 'vk-direct' : 'vk-' + type,
                    headers: playbackHeaders('vk'),
                    hls_manifest_timeout: 12000
                };
                if (type === 'hls') result.hls_type = 'native';

                var alternatives = [];
                function addAlternatives(list, alternativeType) {
                    for (var ai = 0; ai < list.length; ai++) {
                        var stream = list[ai] || {};
                        if (!stream.url || stream.url === selected.url) continue;
                        alternatives.push({
                            url: alternativeType === 'direct' ? capsuleMediaUrl(stream.url, 'direct') :
                                (alternativeType === 'hls' ? capsuleMediaUrl(stream.url, 'hls') : stream.url),
                            hls_type: alternativeType === 'hls' ? 'native' : '',
                            headers: playbackHeaders('vk')
                        });
                    }
                }
                addAlternatives(groups.direct, 'direct');
                addAlternatives(groups.hls, 'hls');
                addAlternatives(groups.dash, 'dash');
                attachAlternateStreams(result, alternatives);

                done(null, result);
            });
        });

        return function () {
            cancelled = true;
            if (cancelCurrent) cancelCurrent();
        };
    }

    var VkProvider = {
        id: 'vk',
        name: 'VK Video',
        tier: 'stable',
        autoplay: true,
        search: function (context, done) {
            if (!settingEnabled('capsule_trailer_vk', true)) {
                done(null, []);
                return function () {};
            }

            var movie = context.movie || {};
            var title = movie.title || movie.name || movie.original_title || movie.original_name || '';
            var year = yearOf(movie);
            var query = [title, year, 'трейлер'].join(' ').replace(/\s+/g, ' ');
            var cancelled = false;
            var cancelCurrent = vkAnonymousToken(function (tokenError, token) {
                if (cancelled) return;
                if (tokenError || !token) return done(tokenError || new Error('vk-token'), []);

                var url = 'https://api.vkvideo.ru/method/catalog.getVideoSearchWeb2' +
                    '?v=' + encodeURIComponent(VK_API_VERSION) +
                    '&client_id=' + encodeURIComponent(VK_CLIENT_ID) +
                    '&count=30&q=' + encodeURIComponent(query) +
                    '&content_type=video&access_token=' + encodeURIComponent(token);

                cancelCurrent = nativeRequest(url, 5500, function (error, data) {
                    if (cancelled) return;
                    if (data && data.error && parseInt(data.error.error_code, 10) === 5) {
                        vkAnonymous.token = '';
                        vkAnonymous.expires = 0;
                    }
                    if (error || !data || data.error) return done(error || new Error('vk-search'), []);
                    done(null, normalizeVkSearch(data, movie));
                });
            });

            return function () {
                cancelled = true;
                if (cancelCurrent) cancelCurrent();
            };
        },
        resolve: resolveVk
    };

    var PROVIDERS = [OkProvider, VkProvider, DzenProvider];

    function closeSourceSelectionState() {
        try {
            if (Lampa.Select && Lampa.Select.opened && Lampa.Select.opened()) Lampa.Select.close();
        }
        catch (e) {}

        try {
            if (Lampa.Activity && typeof Lampa.Activity.mixState === 'function') Lampa.Activity.mixState();
        }
        catch (e2) {}

        try { Lampa.Controller.toggle('content'); } catch (e3) {}
    }

    function collectAutoplayCandidates(context, done) {
        var active = true;
        var finished = false;
        var cancels = [];
        var providers = [];
        var pending = 0;
        var candidates = {};
        var timer = null;

        for (var p = 0; p < PROVIDERS.length; p++) {
            if (PROVIDERS[p].autoplay !== false) providers.push(PROVIDERS[p]);
        }

        pending = providers.length;

        function finish() {
            if (!active || finished) return;
            finished = true;
            clearTimeout(timer);

            for (var i = 0; i < cancels.length; i++) {
                try { cancels[i](); } catch (e) {}
            }
            cancels = [];

            var result = [];
            for (var key in candidates) {
                if (Object.prototype.hasOwnProperty.call(candidates, key)) result.push(candidates[key]);
            }

            result = preferMovieYear(result, context.movie, function (entry) {
                return entry && entry.item;
            });

            result.sort(function (a, b) {
                return (b.item.score || 0) - (a.item.score || 0);
            });

            done(result);
        }

        function add(provider, items) {
            items = items || [];
            for (var i = 0; i < items.length; i++) {
                var item = items[i];
                item.score = scoreCandidate(item, context.movie, item.exactMovieMatch === true);
                if (item.score < 0) continue;

                var key = semanticTrailerKey(item) || item.canonical || item.id || (provider.id + ':' + i);
                var current = candidates[key];
                if (!current || item.score > current.item.score) {
                    candidates[key] = { item: item, provider: provider };
                }
            }
        }

        function providerDone(provider, error, items) {
            if (!active || finished) return;
            if (!error) add(provider, items);
            pending--;
            if (pending <= 0) finish();
        }

        if (!pending) {
            done([]);
            return function () {};
        }

        timer = setTimeout(finish, AUTO_SEARCH_MAX_MS);

        for (var i = 0; i < providers.length; i++) {
            (function (provider) {
                var called = false;
                function complete(error, items) {
                    if (called) return;
                    called = true;
                    providerDone(provider, error, items);
                }

                try {
                    var cancel = provider.search(context, complete);
                    if (typeof cancel === 'function') cancels.push(cancel);
                }
                catch (e) {
                    complete(e, []);
                }
            })(providers[i]);
        }

        return function () {
            active = false;
            clearTimeout(timer);
            for (var i = 0; i < cancels.length; i++) {
                try { cancels[i](); } catch (e) {}
            }
            cancels = [];
        };
    }

    function startBestTrailer(context, done) {
        var cancelled = false;
        var searchCancel = collectAutoplayCandidates(context, function (results) {
            if (cancelled) return;

            if (!results.length || !results[0].item || results[0].item.score < AUTO_SCORE_MIN) {
                done(false);
                return;
            }

            var index = 0;
            var resolveCancel = null;

            function next() {
                if (cancelled) return;

                if (index >= results.length) {
                    done(false);
                    return;
                }

                var selected = results[index++];
                if (!selected || !selected.provider || typeof selected.provider.resolve !== 'function') {
                    next();
                    return;
                }

                if (selected.item.score < AUTO_SCORE_MIN) {
                    done(false);
                    return;
                }

                var settled = false;
                var currentCancel = selected.provider.resolve(selected.item, context, function (error, data) {
                    settled = true;
                    resolveCancel = null;
                    if (cancelled) return;

                    if (error || !data || !data.url) {
                        next();
                        return;
                    }

                    closeSourceSelectionState();

                    try {
                        Lampa.Player.play(data);
                        done(true);
                    }
                    catch (e) {
                        log('autoplay Player.play error', e);
                        next();
                    }
                });

                resolveCancel = settled ? null : (typeof currentCancel === 'function' ? currentCancel : null);
            }

            next();
        });

        return function () {
            cancelled = true;
            if (searchCancel) {
                try { searchCancel(); } catch (e) {}
            }
        };
    }

    function registerCapsuleMediaTube() {
        if (!Lampa.PlayerVideo || typeof Lampa.PlayerVideo.registerTube !== 'function') return;
        if (window.capsule_trailer_media_tube) return;

        var probe = document.createElement('video');
        var registration = {
            name: 'CAPSULE MEDIA',
            verify: function (src) {
                src = String(src || '');
                if (src.indexOf('#capsule-direct') >= 0) return true;
                if (src.indexOf('#capsule-hls') >= 0) {
                    try {
                        return !!probe.canPlayType('application/vnd.apple.mpegurl');
                    }
                    catch (e) {
                        return false;
                    }
                }
                return false;
            },
            create: function (callVideo) {
                var object = $('<video class="player-video__video" poster="./img/video_poster.png" playsinline></video>');
                var video = object[0];
                try { video.removeAttribute('crossorigin'); } catch (e) {}
                try { video.setAttribute('preload', 'metadata'); } catch (e2) {}
                callVideo(video);
                return object;
            }
        };

        if (Lampa.PlayerVideo.registerTube(registration)) {
            window.capsule_trailer_media_tube = registration;
        }
    }

    function registerPlaybackFallback() {
        if (window.capsule_trailer_playback_fallback) return;
        if (!Lampa.Player || !Lampa.Player.listener || !Lampa.PlayerVideo || !Lampa.PlayerVideo.listener) return;
        window.capsule_trailer_playback_fallback = true;

        Lampa.Player.listener.follow('start', function (data) {
            if (!data || !data.capsule_trailer) return;

            var active = true;
            var used = false;

            function cleanup() {
                if (!active) return;
                active = false;
                try { Lampa.PlayerVideo.listener.remove('error', onError); } catch (e) {}
                try { Lampa.Player.listener.remove('destroy', onDestroy); } catch (e2) {}
            }

            function onDestroy() {
                cleanup();
            }

            function closePlayer() {
                setTimeout(function () {
                    try {
                        if (Lampa.Player.opened && Lampa.Player.opened()) Lampa.Player.close();
                    }
                    catch (e) {}
                }, 0);
            }

            function onError(event) {
                if (!active || used || !event || !event.fatal) return;

                setTimeout(function () {
                    if (!active || used) return;

                    if (data.capsule_retry_inflight_until && Date.now() < data.capsule_retry_inflight_until) {
                        return;
                    }

                    if (data.capsule_fallback) {
                        used = true;
                        var fallbackData = {
                            url: data.capsule_fallback,
                            title: data.title,
                            card: data.card,
                            capsule_trailer: true,
                            capsule_source: data.capsule_fallback_source || 'fallback',
                            headers: data.headers || null
                        };

                        cleanup();
                        Lampa.Noty.show('Прямой поток недоступен, пробуем резервный способ воспроизведения');

                        setTimeout(function () {
                            try {
                                if (Lampa.Player.opened && Lampa.Player.opened()) Lampa.Player.close();
                            }
                            catch (e) {}

                            setTimeout(function () {
                                try { Lampa.Player.play(fallbackData); }
                                catch (e2) { Lampa.Noty.show('Видео недоступно'); }
                            }, 100);
                        }, 0);
                        return;
                    }

                    if (Lampa.Platform && Lampa.Platform.is && Lampa.Platform.is('android') && !data.capsule_native_retry) {
                        used = true;
                        var nativeData = {
                            url: data.url,
                            title: data.title,
                            card: data.card,
                            capsule_trailer: true,
                            capsule_source: data.capsule_source || 'capsule',
                            capsule_native_retry: true,
                            launch_player: 'android',
                            headers: data.headers || null
                        };

                        cleanup();
                        Lampa.Noty.show('Внутренний плеер не принял поток, пробуем Android-плеер');

                        setTimeout(function () {
                            try {
                                if (Lampa.Player.opened && Lampa.Player.opened()) Lampa.Player.close();
                            }
                            catch (e3) {}

                            setTimeout(function () {
                                try { Lampa.Player.play(nativeData); }
                                catch (e4) { Lampa.Noty.show('Видео недоступно'); }
                            }, 120);
                        }, 0);
                        return;
                    }

                    used = true;
                    cleanup();
                    Lampa.Noty.show('Этот вариант недоступен — выберите другой');
                    closePlayer();
                }, 80);
            }

            Lampa.PlayerVideo.listener.follow('error', onError);
            Lampa.Player.listener.follow('destroy', onDestroy);
        });
    }

    function addStyles() {
        if (document.getElementById('capsule-trailer-style')) return;
        var style = document.createElement('style');
        style.id = 'capsule-trailer-style';
        style.textContent = '' +
            '.capsule-trailer-scroll{width:100%;height:100%;box-sizing:border-box;background:#17181a}' +
            '.capsule-trailer{width:100%;min-height:100%;box-sizing:border-box;color:inherit;background:#17181a;padding-bottom:3em}' +

            '.capsule-trailer__hero{position:relative;width:100%;height:25.5em;overflow:hidden;background:#17181a}' +
            '.capsule-trailer__backdrop{position:absolute;left:50%;top:0;bottom:0;width:128%;max-width:none!important;height:100%;object-fit:cover;object-position:50% 42%;opacity:.95;transform:translateX(-50%);transform-origin:50% 100%;filter:saturate(.96) contrast(1.035)}' +
            '.capsule-trailer__hero:after{content:"";position:absolute;z-index:1;left:0;right:0;top:24%;bottom:-1px;background:linear-gradient(180deg,rgba(23,24,26,0) 0%,rgba(23,24,26,.006) 10%,rgba(23,24,26,.018) 20%,rgba(23,24,26,.04) 30%,rgba(23,24,26,.08) 40%,rgba(23,24,26,.14) 50%,rgba(23,24,26,.24) 60%,rgba(23,24,26,.38) 69%,rgba(23,24,26,.54) 77%,rgba(23,24,26,.69) 84%,rgba(23,24,26,.82) 90%,rgba(23,24,26,.91) 94%,rgba(23,24,26,.97) 97%,#17181a 100%)}' +
            '.capsule-trailer__hero-inner{position:absolute;z-index:2;left:2.35em;right:2.35em;bottom:1.9em;max-width:75em;margin:0 auto}' +
            '.capsule-trailer__title{font-size:2.3em;font-weight:600;line-height:1.04;letter-spacing:-.027em;max-width:19em;text-shadow:0 .08em .34em rgba(0,0,0,.42)}' +
            '.capsule-trailer__hero-meta{display:flex;align-items:center;gap:.62em;font-size:.86em;opacity:.63;margin-top:.62em}' +
            '.capsule-trailer__hero-meta span+span:before{content:"•";margin-right:.62em;opacity:.52}' +

            '.capsule-trailer__panel{position:relative;z-index:2;max-width:78em;margin:-.15em auto 0;background:transparent;min-height:17em}' +
            '.capsule-trailer__summary{display:flex;align-items:center;justify-content:space-between;min-height:2.8em;padding:.48em 1.25em .62em;box-sizing:border-box;gap:.8em}' +
            '.capsule-trailer__status{font-size:.92em;font-weight:500;opacity:.62;white-space:nowrap;flex:0 0 auto}' +
            '.capsule-trailer__filter-control{display:inline-flex;align-items:center;justify-content:space-between;gap:.7em;min-width:8.4em;min-height:2.15em;padding:.3em .72em .3em .82em;border-radius:.62em;font-size:.78em;font-weight:520;line-height:1;opacity:.62;background:rgba(255,255,255,.045);box-sizing:border-box;transition:background-color .12s ease,opacity .12s ease,transform .12s ease;white-space:nowrap}' +
            '.capsule-trailer__filter-control svg{width:.82em;height:.82em;opacity:.68}' +
            '.capsule-trailer__filter-control.focus,.capsule-trailer__filter-control:hover{opacity:1;background:rgba(255,255,255,.13);transform:scale(1.02)}' +
            '.capsule-trailer__results{padding:0 .72em 6em;box-sizing:border-box}' +

            '.capsule-trailer__item{display:flex;align-items:center;position:relative;min-height:8.05em;padding:.72em .72em;border-radius:.92em;box-sizing:border-box;transition:background-color .12s ease,transform .12s ease}' +
            '.capsule-trailer__item+.capsule-trailer__item:before{content:"";position:absolute;left:13.15em;right:.72em;top:0;height:1px;background:rgba(255,255,255,.046)}' +
            '.capsule-trailer__item.focus,.capsule-trailer__item:hover{background:rgba(255,255,255,.082)}' +
            '.capsule-trailer__item.focus{transform:scale(1.004)}' +
            '.capsule-trailer__item--filtered{display:none!important}' +
            '.capsule-trailer__thumb{width:11.35em;height:6.39em;object-fit:cover;border-radius:.86em;background:#232427;flex:0 0 auto;margin-right:1.08em}' +
            '.capsule-trailer__thumb--empty{display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.58)}' +
            '.capsule-trailer__thumb--empty svg{width:3.05em;height:3.05em}' +
            '.capsule-trailer__meta{min-width:0;flex:1;padding-right:.1em}' +
            '.capsule-trailer__topline{display:flex;align-items:flex-start;gap:.82em;min-width:0}' +
            '.capsule-trailer__name{font-size:1.04em;font-weight:500;line-height:1.31;flex:1;min-width:0;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}' +
            '.capsule-trailer__source{flex:0 0 auto;font-size:.64em;font-weight:570;letter-spacing:.045em;text-transform:uppercase;opacity:.58;padding:.34em .54em;border:0;border-radius:.52em;background:rgba(255,255,255,.055);margin-top:.05em}' +
            '.capsule-trailer__line{font-size:.82em;opacity:.48;margin-top:.4em;line-height:1.35}' +
            '.capsule-trailer__empty{padding:2.8em 1em 1.8em;text-align:center;opacity:.52;font-size:.95em}' +
            '.capsule-trailer__retry{display:table;margin:1em auto 0;padding:.68em 1em;border-radius:.7em;background:rgba(255,255,255,.085)}' +

            '.capsule-trailer__loading{padding:.15em .72em 1.2em}' +
            '.capsule-trailer__loading.hide{display:none}' +
            '.capsule-trailer__skeleton{display:flex;align-items:center;min-height:8.05em;padding:.72em;box-sizing:border-box}' +
            '.capsule-trailer__skeleton-thumb{width:11.35em;height:6.39em;border-radius:.86em;background:rgba(255,255,255,.05);flex:0 0 auto;margin-right:1.08em}' +
            '.capsule-trailer__skeleton-copy{flex:1}' +
            '.capsule-trailer__skeleton-line{height:.72em;border-radius:.5em;background:rgba(255,255,255,.05);width:58%;margin:.5em 0}' +
            '.capsule-trailer__skeleton-line.small{width:36%;opacity:.72}' +

            '.view--capsule-trailer svg{width:1.58em;height:1.58em}' +

            '.capsule-trailer--compact .capsule-trailer__hero{height:auto;min-height:0;overflow:visible;background:#17181a;padding:1.25em 2.2em .72em;box-sizing:border-box}' +
            '.capsule-trailer--compact .capsule-trailer__backdrop,.capsule-trailer--compact .capsule-trailer__hero:after{display:none}' +
            '.capsule-trailer--compact .capsule-trailer__hero-inner{position:relative;left:auto;right:auto;bottom:auto;max-width:75em;margin:0 auto}' +
            '.capsule-trailer--compact .capsule-trailer__title{font-size:1.72em;max-width:none;text-shadow:none}' +
            '.capsule-trailer--compact .capsule-trailer__hero-meta{margin-top:.42em}' +
            '.capsule-trailer--compact .capsule-trailer__panel{margin-top:0}' +

            'body.true--mobile:not(.orientation--landscape) .capsule-trailer__results{padding-bottom:14em}' +
            'body.true--mobile.orientation--landscape .capsule-trailer__results{padding-right:12em}' +

            '@media(max-width:700px){' +
                '.capsule-trailer__hero{height:20.2em}' +
                '.capsule-trailer--compact .capsule-trailer__hero{height:auto;padding:.85em 1.15em .55em}' +
                '.capsule-trailer--compact .capsule-trailer__title{font-size:1.42em}' +
                '.capsule-trailer--compact .capsule-trailer__hero-meta{font-size:.76em;margin-top:.34em}' +
                '.capsule-trailer__backdrop{left:50%;top:0;bottom:0;width:138%;max-width:none!important;height:100%;object-position:50% 44%;transform:translateX(-50%);transform-origin:50% 100%}' +
                '.capsule-trailer__hero:after{top:22%;background:linear-gradient(180deg,rgba(23,24,26,0) 0%,rgba(23,24,26,.005) 9%,rgba(23,24,26,.016) 19%,rgba(23,24,26,.038) 29%,rgba(23,24,26,.075) 39%,rgba(23,24,26,.135) 49%,rgba(23,24,26,.23) 59%,rgba(23,24,26,.37) 68%,rgba(23,24,26,.53) 77%,rgba(23,24,26,.69) 84%,rgba(23,24,26,.83) 90%,rgba(23,24,26,.92) 94%,rgba(23,24,26,.975) 97%,#17181a 100%)}' +
                '.capsule-trailer__hero-inner{left:1.22em;right:1.22em;bottom:.82em}' +
                '.capsule-trailer__title{font-size:1.72em;max-width:14em}' +
                '.capsule-trailer__hero-meta{font-size:.79em;margin-top:.46em}' +
                '.capsule-trailer__summary{padding:.38em 1.03em .5em;gap:.58em;min-height:2.6em}' +
                '.capsule-trailer__status{font-size:.83em}' +
                '.capsule-trailer__filter-control{font-size:.7em;min-width:7.6em;min-height:2.05em;padding:.28em .62em .28em .7em;border-radius:.58em}' +
                '.capsule-trailer__results{padding:0 .5em 5em}' +
                '.capsule-trailer__item{min-height:6.85em;padding:.63em .58em;border-radius:.82em}' +
                '.capsule-trailer__item+.capsule-trailer__item:before{left:9.55em;right:.58em}' +
                '.capsule-trailer__thumb{width:8.25em;height:4.64em;border-radius:.68em;margin-right:.78em}' +
                '.capsule-trailer__thumb--empty svg{width:2.35em;height:2.35em}' +
                '.capsule-trailer__name{font-size:.94em;line-height:1.29}' +
                '.capsule-trailer__source{font-size:.56em;padding:.31em .44em;border-radius:.48em}' +
                '.capsule-trailer__line{font-size:.74em;margin-top:.3em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
                '.capsule-trailer__loading{padding:0 .5em 1em}' +
                '.capsule-trailer__skeleton{min-height:6.85em;padding:.63em .58em}' +
                '.capsule-trailer__skeleton-thumb{width:8.25em;height:4.64em;border-radius:.68em;margin-right:.78em}' +
            '}';
        document.head.appendChild(style);
    }

    function imageUrl(movie) {
        if (!movie || !movie.poster_path) return '';
        if (Lampa.Api && Lampa.Api.img) {
            try { return Lampa.Api.img(movie.poster_path, 'w300'); } catch (e) {}
        }
        return 'https://image.tmdb.org/t/p/w300' + movie.poster_path;
    }

    function backdropUrl(movie) {
        if (!movie) return '';
        if (movie.backdrop_path) {
            if (Lampa.Api && Lampa.Api.img) {
                try { return Lampa.Api.img(movie.backdrop_path, 'w1280'); } catch (e) {}
            }
            return 'https://image.tmdb.org/t/p/w1280' + movie.backdrop_path;
        }
        return movie.background_image || '';
    }

    function TrailerComponent(object) {
        var self = this;
        var movie = object.movie || {};
        var context = { movie: movie, videos: object.videos || { results: [] } };
        var scroll = new Lampa.Scroll({ mask: true, over: true, nopadding: true, step: 280 });
        var html = scroll.render();
        var content = $('<div class="capsule-trailer"></div>');
        html.addClass('capsule-trailer-scroll');
        var status = $('<div class="capsule-trailer__status"></div>');
        var filterRoot = $('' +
            '<div class="capsule-trailer__filter-control selector">' +
                '<span class="capsule-trailer__filter-label">Все</span>' +
                '<svg viewBox="0 0 12 8" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M1.5 1.5L6 6L10.5 1.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
            '</div>'
        );
        var summary = $('<div class="capsule-trailer__summary"></div>');
        var panel = $('<div class="capsule-trailer__panel"></div>');
        var loading = $('' +
            '<div class="capsule-trailer__loading">' +
                '<div class="capsule-trailer__skeleton"><div class="capsule-trailer__skeleton-thumb"></div><div class="capsule-trailer__skeleton-copy"><div class="capsule-trailer__skeleton-line"></div><div class="capsule-trailer__skeleton-line small"></div></div></div>' +
                '<div class="capsule-trailer__skeleton"><div class="capsule-trailer__skeleton-thumb"></div><div class="capsule-trailer__skeleton-copy"><div class="capsule-trailer__skeleton-line"></div><div class="capsule-trailer__skeleton-line small"></div></div></div>' +
                '<div class="capsule-trailer__skeleton"><div class="capsule-trailer__skeleton-thumb"></div><div class="capsule-trailer__skeleton-copy"><div class="capsule-trailer__skeleton-line"></div><div class="capsule-trailer__skeleton-line small"></div></div></div>' +
            '</div>'
        );
        filterRoot.addClass('hide');
        var resultRoot = $('<div class="capsule-trailer__results"></div>');
        var alive = true;
        var started = false;
        var last = null;
        var pendingProviders = 0;
        var totalResults = 0;
        var failures = [];
        var cancels = [];
        var resolvingCancel = null;
        var stagedResults = [];
        var bestFound = null;
        var autoTimer = null;
        var autoStarted = false;
        var activeFilter = 'all';
        var availableFilters = [];
        var layoutBound = false;

        function compactLayoutMode() {
            try {
                if (Lampa.Platform && typeof Lampa.Platform.screen === 'function' && Lampa.Platform.screen('tv')) return true;
            }
            catch (e) {}

            return window.innerWidth > window.innerHeight;
        }

        function updateLayoutMode() {
            content.toggleClass('capsule-trailer--compact', compactLayoutMode());
            try { scroll.height(); } catch (e) {}
        }

        function header() {
            var backdrop = backdropUrl(movie);
            var title = movie.title || movie.name || movie.original_title || movie.original_name || 'Трейлеры';
            var year = yearOf(movie);
            var type = mediaType(movie) === 'tv' ? 'Сериал' : 'Фильм';
            var image = backdrop ? '<img class="capsule-trailer__backdrop" src="' + escapeHtml(backdrop) + '" />' : '';
            return $(
                '<div class="capsule-trailer__hero">' +
                    image +
                    '<div class="capsule-trailer__hero-inner">' +
                        '<div class="capsule-trailer__title">' + escapeHtml(title) + '</div>' +
                        '<div class="capsule-trailer__hero-meta">' +
                            (year ? '<span>' + escapeHtml(year) + '</span>' : '') +
                            '<span>' + type + '</span>' +
                        '</div>' +
                    '</div>' +
                '</div>'
            );
        }

        function ensureVisible(item) {
            if (!item || !item.length) return;

            try {
                var node = item[0];
                var viewport = scroll.render(true);
                if (!node || !viewport || !node.getBoundingClientRect || !viewport.getBoundingClientRect) return;

                var rect = node.getBoundingClientRect();
                var box = viewport.getBoundingClientRect();
                var margin = 18;

                if (rect.bottom > box.bottom - margin) {
                    scroll.shift(rect.bottom - (box.bottom - margin));
                }
                else if (rect.top < box.top + margin) {
                    scroll.shift(rect.top - (box.top + margin));
                }
            }
            catch (e) {}
        }

        function refreshCollection(item) {
            if (!started || !Lampa.Activity.own(self)) return;
            var enabled = Lampa.Controller.enabled();
            if (!enabled || enabled.name !== NAV_CONTROLLER) return;
            if (item) Lampa.Controller.collectionAppend(item);

            if (!last) {
                try { scroll.reset(); } catch (e) {}
                var first = scroll.render().find('.selector').filter(function () {
                    return !$(this).hasClass('hide') && this.offsetParent !== null;
                }).first();

                if (first.length) Lampa.Controller.collectionFocus(first, scroll.render(), true);
            }
        }

        function languageLabel(item) {
            var lang = inferLanguage(item).toLowerCase();
            if (lang === 'ru' || lang === 'rus') return 'Русский';
            if (lang === 'en' || lang === 'eng') return 'Английский';
            return lang ? lang.toUpperCase() : '';
        }

            function itemMeta(item) {
            var parts = [];
            var kind = item.kind || trailerKind(item.title);
            if (kind === 'teaser') parts.push('Тизер');
            else parts.push('Трейлер');
            var lang = languageLabel(item);
            if (lang) parts.push(lang);
            if (item.qualityHint) parts.push(item.qualityHint);
            if (item.duration) parts.push(secondsText(item.duration));
            return parts;
        }

        function sourceLabel(item, provider) {
            var value = item.providerName || (provider && provider.name) || '';
            return String(value || '').replace(/^OK$/i, 'OK.ru');
        }

        function makeItem(item, provider) {
            var meta = itemMeta(item);
            var source = sourceLabel(item, provider);
            var thumb = item.thumbnail ?
                '<img class="capsule-trailer__thumb" src="' + escapeHtml(item.thumbnail) + '" />' :
                '<div class="capsule-trailer__thumb capsule-trailer__thumb--empty">' + ICON + '</div>';
            var el = $(
                '<div class="capsule-trailer__item selector" data-score="' + escapeHtml(item.score || 0) + '" data-provider="' + escapeHtml(provider && provider.id || item.provider || '') + '" data-year-exact="' + (titleHasMovieYear(item, movie) ? '1' : '0') + '">' +
                    thumb +
                    '<div class="capsule-trailer__meta">' +
                        '<div class="capsule-trailer__topline">' +
                            '<div class="capsule-trailer__name">' + escapeHtml(item.title) + '</div>' +
                            (source ? '<div class="capsule-trailer__source">' + escapeHtml(source) + '</div>' : '') +
                        '</div>' +
                        '<div class="capsule-trailer__line">' + escapeHtml(meta.join(' · ')) + '</div>' +
                    '</div>' +
                '</div>'
            );

            el.on('hover:focus', function () {
                last = el;
                ensureVisible(el);
            });

            el.on('hover:enter', function () {
                play(item, provider);
            });

            return el;
        }

        function filterLabel(id) {
            if (id === 'all') return 'Все';
            if (id === 'ok') return 'OK';
            if (id === 'vk') return 'VK';
            if (id === 'dzen') return 'Дзен';
            return id;
        }

        function visibleItems() {
            return resultRoot.children('.capsule-trailer__item').filter(function () {
                return !$(this).hasClass('capsule-trailer__item--filtered');
            });
        }

        function countText(count) {
            return count + ' ' + (count === 1 ? 'вариант' : (count > 1 && count < 5 ? 'варианта' : 'вариантов'));
        }

        function updateStatusForFilter() {
            if (!totalResults) return;
            status.text(countText(visibleItems().length));
        }

        function updateFilterControl() {
            filterRoot.find('.capsule-trailer__filter-label').text(filterLabel(activeFilter));
            filterRoot.toggleClass('hide', !availableFilters.length);
        }

        function applySourceFilter(id, restoreFocus) {
            activeFilter = id || 'all';

            resultRoot.children('.capsule-trailer__item').each(function () {
                var row = $(this);
                var visible = activeFilter === 'all' || row.attr('data-provider') === activeFilter;
                row.toggleClass('capsule-trailer__item--filtered', !visible);
            });

            updateFilterControl();
            updateStatusForFilter();

            if (started && Lampa.Activity.own(self)) {
                try {
                    Lampa.Controller.collectionSet(scroll.render());

                    var focus = restoreFocus ? filterRoot : visibleItems().first();
                    if (focus && focus.length) {
                        last = focus;
                        Lampa.Controller.collectionFocus(focus, scroll.render());
                    }
                }
                catch (e) {}
            }
        }

        function rebuildSourceFilters() {
            var available = {};
            resultRoot.children('.capsule-trailer__item').each(function () {
                var provider = String($(this).attr('data-provider') || '');
                if (provider) available[provider] = true;
            });

            var order = ['ok', 'vk', 'dzen'];
            availableFilters = [];

            for (var i = 0; i < order.length; i++) {
                if (available[order[i]]) availableFilters.push(order[i]);
            }

            if (activeFilter !== 'all' && !available[activeFilter]) activeFilter = 'all';
            applySourceFilter(activeFilter, false);
        }

        function openSourceFilter() {
            var items = [{
                title: 'Все источники',
                filter: 'all',
                selected: activeFilter === 'all'
            }];

            for (var i = 0; i < availableFilters.length; i++) {
                var id = availableFilters[i];
                items.push({
                    title: filterLabel(id),
                    filter: id,
                    selected: activeFilter === id
                });
            }

            Lampa.Select.show({
                title: 'Источник трейлера',
                items: items,
                onSelect: function (item) {
                    applySourceFilter(item && item.filter || 'all', true);
                    try { Lampa.Activity.mixState(); } catch (e) {}
                    try { Lampa.Controller.toggle(NAV_CONTROLLER); } catch (e2) {}
                },
                onBack: function () {
                    try { Lampa.Controller.toggle(NAV_CONTROLLER); } catch (e) {}
                }
            });
        }

        filterRoot.on('hover:focus', function () {
            last = filterRoot;
        });

        filterRoot.on('hover:enter', openSourceFilter);

        function scheduleAutoPlay() {
            return;
        }

        function stageResults(provider, items) {
            if (!alive || !items || !items.length) return;

            for (var i = 0; i < items.length; i++) {
                var item = items[i];
                item.score = scoreCandidate(item, movie, item.exactMovieMatch === true);
                if (item.score < 0) continue;

                stagedResults.push({
                    item: item,
                    provider: provider
                });
            }
        }

        function finalizeResults() {
            var byKey = {};
            var bySemantic = {};
            var prepared = [];

            for (var i = 0; i < stagedResults.length; i++) {
                var entry = stagedResults[i];
                var item = entry.item;
                var provider = entry.provider;
                var key = item.canonical || item.id || (provider.id + ':' + i + ':' + item.title);

                if (byKey[key]) {
                    if ((byKey[key].item.score || 0) >= (item.score || 0)) continue;
                    byKey[key].discarded = true;
                }

                var semanticBase = semanticTrailerKey(item);
                var semantic = semanticBase ? provider.id + ':' + semanticBase : '';

                if (semantic && bySemantic[semantic]) {
                    if ((bySemantic[semantic].item.score || 0) >= (item.score || 0)) continue;
                    bySemantic[semantic].discarded = true;
                }

                var current = {
                    item: item,
                    provider: provider,
                    key: key,
                    semantic: semantic,
                    discarded: false
                };

                byKey[key] = current;
                if (semantic) bySemantic[semantic] = current;
                prepared.push(current);
            }

            var compact = [];
            for (var p = 0; p < prepared.length; p++) {
                if (!prepared[p].discarded) compact.push(prepared[p]);
            }

            compact = preferMovieYear(compact, movie, function (entry) {
                return entry && entry.item;
            });

            compact.sort(function (a, b) {
                return (b.item.score || 0) - (a.item.score || 0);
            });

            resultRoot.empty();
            totalResults = compact.length;
            bestFound = compact.length ? {
                item: compact[0].item,
                provider: compact[0].provider
            } : null;

            for (var r = 0; r < compact.length; r++) {
                resultRoot.append(makeItem(compact[r].item, compact[r].provider));
            }

            rebuildSourceFilters();
        }

        function providerDone(provider, error, items) {
            if (!alive) return;
            if (error) failures.push(provider.id);
            stageResults(provider, items || []);
            pendingProviders--;
            if (pendingProviders <= 0) searchFinished();
        }

        function runProviders() {
            if (!alive) return;
            pendingProviders = PROVIDERS.length;
            status.text('Ищем лучшие варианты…');
            loading.removeClass('hide');
            filterRoot.addClass('hide');
            resultRoot.empty();

            for (var i = 0; i < PROVIDERS.length; i++) {
                (function (provider) {
                    var finished = false;
                    function finish(error, items) {
                        if (finished) return;
                        finished = true;
                        providerDone(provider, error, items);
                    }
                    try {
                        var cancel = provider.search(context, finish);
                        if (typeof cancel === 'function') cancels.push(cancel);
                    }
                    catch (e) {
                        log('provider search error', provider.id, e);
                        finish(e, []);
                    }
                })(PROVIDERS[i]);
            }
        }

        function clearSearchState() {
            for (var i = 0; i < cancels.length; i++) {
                try { cancels[i](); } catch (e) {}
            }
            cancels = [];
            pendingProviders = 0;
            totalResults = 0;
            failures = [];
            stagedResults = [];
            bestFound = null;
            autoStarted = false;
            clearTimeout(autoTimer);
            autoTimer = null;
            last = null;
            activeFilter = 'all';
            availableFilters = [];
            filterRoot.addClass('hide');
            filterRoot.find('.capsule-trailer__filter-label').text('Все');
            resultRoot.empty();
            loading.removeClass('hide');
        }

        function retry() {
            cacheDropMovie(movie);
            clearSearchState();
            status.text('Ищем лучшие варианты…');
            runProviders();
        }

        function addRetry() {
            var retryButton = $('<div class="capsule-trailer__retry selector">Повторить поиск</div>');
            retryButton.on('hover:focus', function () {
                last = retryButton;
                ensureVisible(retryButton);
            });
            retryButton.on('hover:enter', retry);
            resultRoot.append(retryButton);
            refreshCollection(retryButton);
        }

        function searchFinished() {
            if (!alive) return;

            finalizeResults();
            loading.addClass('hide');
            self.activity.loader(false);

            if (totalResults) {
                filterRoot.removeClass('hide');
                updateStatusForFilter();
                scheduleAutoPlay();

                if (started && Lampa.Activity.own(self)) {
                    try {
                        Lampa.Controller.collectionSet(scroll.render(), false, true);
                        if (!last) {
                            var first = resultRoot.children('.capsule-trailer__item').first();
                            if (first.length) Lampa.Controller.collectionFocus(first, scroll.render(), true);
                        }
                    }
                    catch (e) {}
                }
            }
            else {
                status.text(failures.length ? 'Источники сейчас недоступны' : 'Трейлеры не найдены');
                resultRoot.append('<div class="capsule-trailer__empty">Для этой карточки подходящих трейлеров не найдено.</div>');
                addRetry();
            }
            self.activity.toggle();
        }

        function play(item, provider) {
            if (!alive || !provider || typeof provider.resolve !== 'function') return;
            if (resolvingCancel) {
                try { resolvingCancel(); } catch (e) {}
                resolvingCancel = null;
            }
            self.activity.loader(true);
            var settled = false;
            var cancelResolve = provider.resolve(item, context, function (error, data) {
                settled = true;
                resolvingCancel = null;
                if (!alive) return;
                self.activity.loader(false);
                if (error || !data || !data.url) {
                    Lampa.Noty.show('Видео недоступно');
                    return;
                }
                try {
                    Lampa.Player.play(data);
                }
                catch (e) {
                    log('Player.play error', e);
                    Lampa.Noty.show('Не удалось запустить видео');
                }
            });
            resolvingCancel = settled ? null : (typeof cancelResolve === 'function' ? cancelResolve : null);
        }

        this.create = function () {
            content.append(header());
            summary.append(status);
            summary.append(filterRoot);
            panel.append(summary);
            panel.append(loading);
            panel.append(resultRoot);
            content.append(panel);
            scroll.append(content);

            updateLayoutMode();
            if (!layoutBound) {
                window.addEventListener('resize', updateLayoutMode);
                window.addEventListener('orientationchange', updateLayoutMode);
                layoutBound = true;
            }

            try { scroll.height(); } catch (e) {}
            status.text('Ищем лучшие варианты…');
            runProviders();
            return this.render();
        };

        this.start = function () {
            if (!Lampa.Activity.own(this)) return;
            started = true;

            Lampa.Controller.add(NAV_CONTROLLER, {
                toggle: function () {
                    Lampa.Controller.collectionSet(scroll.render(), false, true);

                    var target = last;
                    if (target && (!target.length || !target[0] || target[0].offsetParent === null)) target = false;

                    if (!target) {
                        try { scroll.reset(); } catch (e) {}
                    }

                    Lampa.Controller.collectionFocus(target || false, scroll.render(), true);
                },
                up: function () {
                    if (Navigator.canmove('up')) Navigator.move('up');
                    else Lampa.Controller.toggle('head');
                },
                down: function () {
                    if (Navigator.canmove('down')) Navigator.move('down');
                },
                left: function () {
                    if (Navigator.canmove('left')) Navigator.move('left');
                    else Lampa.Controller.toggle('menu');
                },
                right: function () {
                    if (Navigator.canmove('right')) Navigator.move('right');
                },
                back: function () {
                    Lampa.Activity.backward();
                }
            });

            Lampa.Controller.toggle(NAV_CONTROLLER);
        };

        this.stop = function () {
            started = false;
        };

        this.render = function () {
            return html;
        };

        this.destroy = function () {
            alive = false;
            started = false;

            if (layoutBound) {
                window.removeEventListener('resize', updateLayoutMode);
                window.removeEventListener('orientationchange', updateLayoutMode);
                layoutBound = false;
            }

            clearTimeout(autoTimer);
            autoTimer = null;
            if (resolvingCancel) {
                try { resolvingCancel(); } catch (e) {}
                resolvingCancel = null;
            }
            for (var i = 0; i < cancels.length; i++) {
                try { cancels[i](); } catch (e2) {}
            }
            cancels = [];
            try { scroll.destroy(); } catch (e3) {}
        };
    }

    function setupSettings() {
        if (!Lampa.SettingsApi || typeof Lampa.SettingsApi.addComponent !== 'function' || typeof Lampa.SettingsApi.addParam !== 'function') return;

        Lampa.SettingsApi.addComponent({
            component: 'capsule_trailer_settings',
            name: 'CAPSULE trailer',
            icon: ICON
        });

        Lampa.SettingsApi.addParam({
            component: 'capsule_trailer_settings',
            param: { type: 'title' },
            field: { name: 'Поведение' }
        });

        Lampa.SettingsApi.addParam({
            component: 'capsule_trailer_settings',
            param: {
                name: 'capsule_trailer_autoplay',
                type: 'trigger',
                default: true
            },
            field: {
                name: 'Сразу запускать лучший трейлер',
                description: 'Выбирает наиболее подходящий трейлер по названию, году, языку и качеству и запускает его сразу.'
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'capsule_trailer_settings',
            param: {
                name: 'capsule_trailer_replace_native',
                type: 'trigger',
                default: false
            },
            field: {
                name: 'Заменить стандартные трейлеры Lampa',
                description: 'Скрывает стандартную кнопку трейлеров и оставляет только CAPSULE Trailer.'
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'capsule_trailer_settings',
            param: {
                name: 'capsule_trailer_quality',
                type: 'select',
                values: {
                    'best': 'Максимальное доступное',
                    '2160': '2160p',
                    '1440': '1440p',
                    '1080': '1080p',
                    '720': '720p',
                    '480': '480p'
                },
                default: 'best'
            },
            field: {
                name: 'Предпочитаемое качество',
                description: 'По умолчанию выбирается максимальное доступное качество. При выборе конкретного значения используется ближайший доступный вариант.'
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'capsule_trailer_settings',
            param: { type: 'title' },
            field: { name: 'Источники' }
        });

        Lampa.SettingsApi.addParam({
            component: 'capsule_trailer_settings',
            param: {
                name: 'capsule_trailer_ok',
                type: 'trigger',
                default: true
            },
            field: {
                name: 'OK.ru',
                description: 'Использовать трейлеры из OK.ru. Участвует в автоматическом выборе лучшего варианта.'
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'capsule_trailer_settings',
            param: {
                name: 'capsule_trailer_vk',
                type: 'trigger',
                default: true
            },
            field: {
                name: 'VK Video',
                description: 'Использовать трейлеры из VK Video. Участвует в автоматическом выборе лучшего варианта.'
            }
        });

        Lampa.SettingsApi.addParam({
            component: 'capsule_trailer_settings',
            param: {
                name: 'capsule_trailer_dzen',
                type: 'trigger',
                default: true
            },
            field: {
                name: 'Дзен',
                description: 'Использовать трейлеры из Дзена. Участвует в автоматическом выборе лучшего варианта.'
            }
        });
    }

    function addCardButton(event) {
        if (!event || event.type !== 'complite' || !event.data || !event.data.movie || !event.object || !event.object.activity) return;
        var movie = event.data.movie;
        if (movie.adult) return;

        var render = event.object.activity.render();
        if (!render || !render.find) return;
        if (render.find('.view--capsule-trailer').length) return;

        var container = render.find('.buttons--container');
        if (!container.length) return;

        var nativeTrailer = container.find('.view--trailer').last();
        var replaceNative = settingEnabled('capsule_trailer_replace_native', false);

        var button = $('' +
            '<div class="full-start__button selector view--capsule-trailer" data-subtitle="CAPSULE Trailer · агрегатор">' +
                ICON +
                '<span>Трейлеры</span>' +
            '</div>'
        );

        function openTrailerList() {
            Lampa.Activity.push({
                url: '',
                title: 'Трейлеры',
                component: COMPONENT,
                page: 1,
                movie: movie,
                videos: event.data.videos || { results: [] },
                capsule_version: VERSION
            });
        }

        button.on('hover:enter', function () {
            if (!settingEnabled('capsule_trailer_autoplay', true)) {
                openTrailerList();
                return;
            }

            if (button.data('capsule-autoplay-busy')) return;
            button.data('capsule-autoplay-busy', true);

            closeSourceSelectionState();

            startBestTrailer({
                movie: movie,
                videos: event.data.videos || { results: [] }
            }, function (started) {
                button.data('capsule-autoplay-busy', false);
                if (!started) openTrailerList();
            });
        });

        if (replaceNative && nativeTrailer.length) {
            nativeTrailer.before(button);
            nativeTrailer.remove();
        }
        else if (nativeTrailer.length) nativeTrailer.after(button);
        else container.append(button);
    }

    function init() {
        addStyles();
        setupSettings();
        registerCapsuleMediaTube();
        registerPlaybackFallback();
        if (!Lampa.Component.get(COMPONENT)) Lampa.Component.add(COMPONENT, TrailerComponent);
        Lampa.Listener.follow('full', addCardButton);
        log('ready', VERSION);
    }

    if (window.appready) init();
    else Lampa.Listener.follow('app', function (event) {
        if (event && event.type === 'ready') init();
    });
})();
