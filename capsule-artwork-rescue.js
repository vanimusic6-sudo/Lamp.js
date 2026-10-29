/*
 * Capsule Artwork Rescue for Lampa 1.7.0
 * A conservative, client-side fallback for film/TV posters, backgrounds and episode stills. \n * Quality upgrades are prepared offscreen, never painted over an already visible image.
 * Source: standalone plugin. No keys, trackers, proxy services or remote scripts bundled.
 * API sources: TVmaze (CC BY-SA), Stremio Cinemeta, Fanart.tv (optional key),
 * OMDb (optional key), AniList, Tenrai and Wikipedia. TMDB images remain first priority.
 */
(function () {
    'use strict';

    if (window.plugin_capsule_artwork_rescue_ready) return;
    window.plugin_capsule_artwork_rescue_ready = true;

    var PREFIX = 'capsule_art_';
    var STORAGE_KEY = 'capsule_art_cache_v1';
    var VERSION = '1.7.0';
    var CACHE_TTL = 7 * 86400000;
    var CACHE_LIMIT = 220;
    var NETWORK_TIMEOUT = 6500;
    var IMAGE_TIMEOUT = 6000;
    var broken = /(?:^|\/)img_(?:broken|load)\.svg(?:[?#]|$)/i;
    var allowedHosts = /(?:^|\.)(?:image\.tmdb\.org|imagetmdb\.com|static\.tvmaze\.com|assets\.fanart\.tv|fanart\.tv|m\.media-amazon\.com|img\.omdbapi\.com|s4\.anilist\.co|cdn\.myanimelist\.net|upload\.wikimedia\.org|images\.metahub\.space|episodes\.metahub\.space)$/i;
    var disk = {};
    var inFlight = {};
    var networkMemo = {};
    var work = [];
    var networkRunning = 0;
    var imageJobs = [];
    var imagesRunning = 0;
    var running = false;
    var currentFull = null;
    var watcher = null;
    var pendingNodes = [];
    var flushTimer = null;
    var stats = { rescued: 0, attempted: 0, failed: 0, bySource: {}, namesFilled: 0,
        episodeStills: 0, imagesSeen: 0, loadedImages: 0, qualityAttempts: 0,
        qualityFound: 0, lastSource: '', verifiedRendered: 0, replacementErrors: 0, qualityPrepared: 0,
        episodeLists: 0, missingEpisodeNames: 0, visibleEpisodeTitles: 0,
        episodeApiCalls: 0, episodeApiNames: 0, episodeApiStills: 0, nameSources: {},
        rejectedTitles: 0, matchingByDate: 0, matchingByAgreement: 0, kpResolved: 0 };
    var episodeData = {}, seasonSnapshots = {}, episodeRefreshTimer = null;
    var episodeTitleLookups = {}, episodeTitleBudget = {}, episodeTitleQueue = [];
    var uniqueEpisodeMissing = {}, uniqueEpisodeFound = {};
    var voteCandidates = {}, tmdbMapping = {};
    var episodeTitleActive = 0;
    var qualityTasks = [], qualityActive = 0, qualityRecent = {}, qualityWinners = {};
    var QUALITY_MAX_ACTIVE = 2, QUALITY_MAX_QUEUED = 28;
    var QUALITY_LIMITS = { poster: 700, still: 700, backdrop: 1250 };

    function enabled() {
        if (!window.Lampa || !Lampa.Storage) return true;
        var v = Lampa.Storage.get(PREFIX + 'enabled', 'true');
        return v !== false && v !== 'false';
    }
    function qualityMode() {
        var v = setting('quality_mode');
        return v === 'missing' || v === 'alternatives' || v === 'auto' ? v : 'auto';
    }
    function setting(k) {
        try { return String(Lampa.Storage.get(PREFIX + k, '') || '').trim(); }
        catch (_) { return ''; }
    }
    function textValue(v) { return typeof v === 'string' ? v.trim() : ''; }
    function cleanTitle(t) {
        return textValue(t).toLowerCase().replace(/ё/g, 'е').replace(/&/g, ' and ')
            .replace(/[^a-zа-я0-9\u0400-\u04ff\u3040-\u30ff\u3400-\u9fff]+/ig, ' ')
            .replace(/\b(the|a|an)\b/g, ' ').replace(/\s+/g, ' ').trim();
    }
    function names(m) {
        var list = [m.original_title, m.original_name, m.title, m.name];
        return list.map(cleanTitle).filter(function (x, i, a) { return x && a.indexOf(x) === i; });
    }
    function titleSimilarity(a, b) {
        a = cleanTitle(a); b = cleanTitle(b);
        if (!a || !b) return 0;
        if (a === b) return 1;
        var as = a.split(' '), bs = b.split(' ');
        var shared = as.filter(function (x) { return bs.indexOf(x) >= 0; }).length;
        var overlap = (2 * shared) / (as.length + bs.length);
        if (a.length > 5 && b.length > 5 && (a.indexOf(b) === 0 || b.indexOf(a) === 0)) {
            overlap = Math.max(overlap, 0.9 * Math.min(a.length, b.length) / Math.max(a.length, b.length));
        }
        return overlap;
    }
    function filmYear(m) {
        var y = String(m.release_date || m.first_air_date || m.year || m.premiered || '').match(/^(19|20)\d{2}/);
        return y ? Number(y[0]) : 0;
    }
    function matchScore(m, aliases, candidateYear) {
        var best = 0, a = names(m);
        (aliases || []).forEach(function (b) {
            a.forEach(function (n) { best = Math.max(best, titleSimilarity(n, b)); });
        });
        var year = filmYear(m);
        if (year && candidateYear && Math.abs(year - candidateYear) > 1) return -1;
        return best;
    }
    function isTv(m) {
        return m.media_type === 'tv' || m.type === 'tv' ||
            (!!(m.name || m.first_air_date || m.number_of_seasons) && m.media_type !== 'movie');
    }
    function isAnime(m) {
        return m.anime === true || m.original_language === 'ja' ||
            m.original_language === 'ko' || m.original_language === 'zh' ||
            /[\u3040-\u30ff\u3400-\u9fff]/.test(String(m.original_name || m.original_title || ''));
    }
    function imageUrl(v) {
        if (typeof v !== 'string' || v.length > 1600) return '';
        try {
            var u = new URL(v, window.location.href);
            return u.protocol === 'https:' && allowedHosts.test(u.hostname) ? u.href : '';
        } catch (_) { return ''; }
    }
    function firstUrls(items) {
        var seen = {};
        return (items || []).map(imageUrl).filter(function (u) {
            if (!u || seen[u]) return false;
            seen[u] = true; return true;
        }).slice(0, 5);
    }
    function loadDisk() {
        try {
            disk = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || '{}');
            if (!disk || typeof disk !== 'object') disk = {};
        } catch (_) { disk = {}; }
    }
    function saveDisk() {
        try {
            var now = Date.now();
            Object.keys(disk).forEach(function (k) {
                if (!disk[k] || disk[k].expires < now || !imageUrl(disk[k].url)) delete disk[k];
            });
            var keys = Object.keys(disk).sort(function (a, b) { return disk[b].expires - disk[a].expires; });
            keys.slice(CACHE_LIMIT).forEach(function (k) { delete disk[k]; });
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(disk));
        } catch (_) { /* Private browsing / quota: in-memory cache still works. */ }
    }
    function cacheId(m, kind, ep) {
        var identifier = m.imdb_id && /^tt\d+$/.test(m.imdb_id) ? m.imdb_id :
            (m.id ? (String(m.source || 'tmdb') + ':' + m.id) : names(m).join('|').slice(0, 70));
        return [isTv(m) ? 'tv' : 'movie', identifier, kind,
            ep && ep.season || 0, ep && ep.number || 0].join(':');
    }
    function queueRequest(url, body) {
        return new Promise(function (resolve) {
            if (work.length >= 100) return resolve(null);
            work.push(function (done) {
                var xhr = new XMLHttpRequest();
                var finished = false;
                function finish(v) {
                    if (finished) return;
                    finished = true;
                    resolve(v); done();
                }
                try {
                    xhr.open(body ? 'POST' : 'GET', url, true);
                    xhr.timeout = NETWORK_TIMEOUT;
                    if (body) xhr.setRequestHeader('Content-Type', 'application/json');
                    xhr.onreadystatechange = function () {
                        if (xhr.readyState !== 4) return;
                        if (xhr.status >= 200 && xhr.status < 300) {
                            try { finish(JSON.parse(xhr.responseText)); } catch (_) { finish(null); }
                        } else finish(null);
                    };
                    xhr.onerror = xhr.ontimeout = xhr.onabort = function () { finish(null); };
                    xhr.send(body ? JSON.stringify(body) : null);
                } catch (_) { finish(null); }
            });
            pump();
        });
    }
    function pump() {
        while (networkRunning < 4 && work.length) {
            networkRunning++;
            work.shift()(function () { networkRunning--; pump(); });
        }
    }
    function once(key, fn) {
        var entry = networkMemo[key];
        if (entry && entry.expires > Date.now()) return Promise.resolve(entry.value);
        if (!inFlight[key]) {
            inFlight[key] = Promise.resolve().then(fn).then(function (r) {
                delete inFlight[key];
                if (r) {
                    if (Object.keys(networkMemo).length > 120) networkMemo = {};
                    networkMemo[key] = { value: r, expires: Date.now() + 20 * 60000 };
                }
                return r;
            }, function () { delete inFlight[key]; return null; });
        }
        return inFlight[key];
    }
    function imagePump() {
        while (imagesRunning < 6 && imageJobs.length) {
            imagesRunning++;
            imageJobs.shift()(function () { imagesRunning--; imagePump(); });
        }
    }
    function probe(url) {
        return new Promise(function (resolve) {
            if (imageJobs.length >= 90) return resolve(false);
            imageJobs.push(function (done) {
                var test = new Image();
                var finished = false;
                var timeout = setTimeout(function () { end(false); }, IMAGE_TIMEOUT);
                function end(ok) {
                    if (finished) return;
                    finished = true;
                    clearTimeout(timeout);
                    test.onload = test.onerror = null;
                    test.src = '';
                    resolve(ok);
                    done();
                }
                test.onload = function () { end(true); };
                test.onerror = function () { end(false); };
                test.src = url;
            });
            imagePump();
        });
    }
    function filmTitle(m) { return textValue(m.original_title || m.original_name || m.title || m.name); }
    function tmdbAlternates(m, kind) {
        var path = kind === 'poster' ? (m.poster_path || m.profile_path) : m.backdrop_path;
        if (kind === 'still' || !/^\/[\w\-/.]+\.(?:jpe?g|png|webp)$/i.test(String(path || ''))) return [];
        var p = '/t/p/' + (kind === 'poster' ? 'w500' : 'w780') + path;
        return firstUrls(['https://image.tmdb.org' + p, 'https://imagetmdb.com' + p]);
    }
    function rankFanart(a) {
        return (a || []).slice().sort(function (x, y) {
            function score(v) {
                var lang = v.lang === 'ru' ? 3 : v.lang === 'en' ? 2 : v.lang === '00' ? 1 : 0;
                return lang * 10000 + Math.min(Number(v.likes) || 0, 9999);
            }
            return score(y) - score(x);
        }).map(function (v) { return v.url; });
    }
    function fanart(m, kind) {
        // Lampa can display cards from other catalogues whose numeric IDs are not TMDB IDs.
        // Do not treat those unrelated IDs as TMDB identifiers.
        if (m.source && m.source !== 'tmdb') return Promise.resolve([]);
        var key = setting('fanart_key');
        if (!key || !/^[A-Za-z0-9_-]{8,100}$/.test(key) || !/^\d+$/.test(String(m.id || ''))) return Promise.resolve([]);
        var tv = isTv(m);
        var url = 'https://webservice.fanart.tv/v3.2/' + (tv ? 'tv/' : 'movies/') + m.id +
            (tv ? '?source=tmdb&' : '?') + 'client_key=' + encodeURIComponent(key);
        return once('fanart:' + (tv ? 'tv' : 'movie') + ':' + m.id + ':' + key, function () {
            return queueRequest(url);
        }).then(function (d) {
            if (!d) return [];
            var types = kind === 'poster' ? (tv ? ['tvposter'] : ['movieposter']) :
                (tv ? ['showbackground', 'tvthumb'] : ['moviebackground', 'moviethumb']);
            return firstUrls([].concat.apply([], types.map(function (t) { return rankFanart(d[t]); })));
        });
    }
    function tvMazeShow(m) {
        var id = m.imdb_id;
        var lookup = id && /^tt\d{6,10}$/.test(id) ?
            queueRequest('https://api.tvmaze.com/lookup/shows?imdb=' + encodeURIComponent(id)) : Promise.resolve(null);
        return lookup.then(function (found) {
            if (found && found.id) return found;
            // Search original spelling, too: turning "Пёс" into "пес" can
            // make a Cyrillic TVmaze search miss the exact show.
            var list = [m.original_name, m.name, m.original_title, m.title]
                .map(textValue).filter(function (v, i, arr) {
                    return v && arr.indexOf(v) === i;
                }).slice(0, 4);
            if (!list.length) list = names(m).slice(0, 2);
            function tryTitle(i) {
                if (i >= list.length) return Promise.resolve(null);
                return queueRequest('https://api.tvmaze.com/search/shows?q=' + encodeURIComponent(list[i])).then(function (arr) {
                    if (!Array.isArray(arr)) return tryTitle(i + 1);
                    var candidates = arr.map(function (v) { return v.show || v; }).map(function (v) {
                        return { show: v, score: matchScore(m, [v.name], filmYear(v)) };
                    }).sort(function (a, b) { return b.score - a.score; });
                    if (candidates.length && candidates[0].score >= 0.90) return candidates[0].show;
                    return tryTitle(i + 1);
                });
            }
            return tryTitle(0);
        });
    }
    function tvMaze(m, kind, ep) {
        if (!isTv(m)) return Promise.resolve([]);
        return once('maze:show:' + (m.imdb_id || filmTitle(m)) + ':' + filmYear(m), function () {
            return tvMazeShow(m);
        }).then(function (show) {
            if (!show || !show.id) return [];
            if (kind === 'still') {
                if (!ep || !ep.number || !ep.season) return [];
                return once('maze:episodes:' + show.id, function () {
                    return queueRequest('https://api.tvmaze.com/shows/' + show.id + '/episodes?specials=1');
                }).then(function (list) {
                    if (!Array.isArray(list)) return [];
                    var episode = list.find(function (e) {
                        return Number(e.season) === Number(ep.season) && Number(e.number) === Number(ep.number);
                    });
                    return firstUrls(episode && episode.image ? [episode.image.original, episode.image.medium] : []);
                });
            }
            return once('maze:images:' + show.id, function () {
                return queueRequest('https://api.tvmaze.com/shows/' + show.id + '/images');
            }).then(function (list) {
                var ordered = [];
                if (Array.isArray(list)) {
                    var types = kind === 'poster' ? ['poster'] : ['background', 'banner'];
                    types.forEach(function (type) {
                        list.filter(function (x) { return x.type === type; })
                            .sort(function (a, b) { return Number(b.main) - Number(a.main); })
                            .forEach(function (x) { if (x.resolutions) ordered.push((x.resolutions.original || x.resolutions.medium || {}).url); });
                    });
                }
                if (kind === 'poster' && show.image) ordered.push(show.image.original);
                return firstUrls(ordered);
            });
        });
    }
    function cinemeta(m, kind, ep) {
        var imdb = String(m.imdb_id || '');
        var type = isTv(m) ? 'series' : 'movie';
        function findId() {
            if (/^tt\d{6,10}$/.test(imdb)) return Promise.resolve(imdb);
            var title = filmTitle(m);
            if (!title || title.length < 3 || title.length > 95) return Promise.resolve('');
            var url = 'https://v3-cinemeta.strem.io/catalog/' + type + '/top/search=' +
                encodeURIComponent(title) + '.json';
            return once('cinemeta:search:' + type + ':' + title, function () {
                return queueRequest(url);
            }).then(function (d) {
                var list = d && d.metas || [];
                var best = list.map(function (v) {
                    return { data: v, score: matchScore(m, [v.name],
                        Number((v.releaseInfo || '').slice(0, 4))) };
                }).sort(function (a, b) { return b.score - a.score; });
                var hit = best[0];
                return hit && hit.score >= 0.96 && /^tt\d{6,10}$/.test(hit.data.id) ? hit.data.id : '';
            });
        }
        return findId().then(function (id) {
            if (!id) return [];
            return once('cinemeta:meta:' + type + ':' + id, function () {
                return queueRequest('https://v3-cinemeta.strem.io/meta/' + type + '/' + id + '.json');
            }).then(function (d) {
                var meta = d && d.meta;
                if (!meta || (meta.id && meta.id !== id)) return [];
                // An IMDb ID is exact. A title-only search must also pass year/title validation.
                if (!/^tt\d+$/.test(imdb) && matchScore(m, [meta.name],
                    Number(String(meta.releaseInfo || '').slice(0, 4))) < 0.90) return [];
                if (kind === 'still') {
                    if (!ep || !ep.number || !ep.season || !Array.isArray(meta.videos)) return [];
                    var episode = meta.videos.find(function (v) {
                        return Number(v.season) === Number(ep.season) &&
                            Number(v.episode) === Number(ep.number);
                    });
                    return firstUrls(episode && episode.thumbnail ? [episode.thumbnail] : []);
                }
                return firstUrls(kind === 'poster' ? [meta.poster] : [meta.background]);
            });
        });
    }
    function omdb(m, kind) {
        if (kind !== 'poster') return Promise.resolve([]);
        var key = setting('omdb_key');
        if (!/^[A-Za-z0-9]{5,16}$/.test(key)) return Promise.resolve([]);
        var id = /^tt\d+$/.test(String(m.imdb_id || '')) ? m.imdb_id : '';
        var name = filmTitle(m);
        if (!id && !name) return Promise.resolve([]);
        var url = 'https://www.omdbapi.com/?apikey=' + encodeURIComponent(key) + '&plot=short&' +
            (id ? 'i=' + encodeURIComponent(id) : 't=' + encodeURIComponent(name) + (filmYear(m) ? '&y=' + filmYear(m) : ''));
        return once('omdb:' + url, function () { return queueRequest(url); }).then(function (d) {
            if (!d || d.Response === 'False') return [];
            if (id && d.imdbID && d.imdbID !== id) return [];
            if (!id && matchScore(m, [d.Title], Number(d.Year && d.Year.slice(0, 4))) < 0.90) return [];
            return firstUrls([d.Poster]);
        });
    }
    function anilist(m, kind) {
        if (kind === 'still' || !isAnime(m)) return Promise.resolve([]);
        var name = filmTitle(m);
        if (!name) return Promise.resolve([]);
        var q = 'query($search:String){Page(perPage:8){media(search:$search,type:ANIME,isAdult:false){title{romaji english native}startDate{year}coverImage{extraLarge large}bannerImage}}}';
        return once('anilist:' + name, function () {
            return queueRequest('https://graphql.anilist.co', { query: q, variables: { search: name } });
        }).then(function (d) {
            var entries = d && d.data && d.data.Page && d.data.Page.media || [];
            var list = entries.map(function (a) {
                return { data: a, score: matchScore(m, [a.title.romaji, a.title.english, a.title.native], a.startDate && a.startDate.year) };
            }).sort(function (a, b) { return b.score - a.score; });
            if (!list.length || list[0].score < 0.87) return [];
            var a = list[0].data;
            return firstUrls(kind === 'poster' ? [a.coverImage.extraLarge, a.coverImage.large] : [a.bannerImage]);
        });
    }
    function tenrai(m, kind) {
        if (kind !== 'poster' || !isAnime(m)) return Promise.resolve([]);
        var name = filmTitle(m);
        if (!name) return Promise.resolve([]);
        return once('tenrai:' + name, function () {
            return queueRequest('https://api.tenrai.org/v1/anime?q=' + encodeURIComponent(name) + '&limit=8&sfw=1');
        }).then(function (d) {
            var entries = d && d.data || [];
            var list = entries.map(function (a) {
                return { data: a, score: matchScore(m, [a.title, a.title_english, a.title_japanese],
                    a.aired && a.aired.from && Number(String(a.aired.from).slice(0, 4))) };
            }).sort(function (a, b) { return b.score - a.score; });
            if (!list.length || list[0].score < 0.87) return [];
            var images = list[0].data.images || {};
            return firstUrls([images.jpg && images.jpg.large_image_url, images.webp && images.webp.large_image_url]);
        });
    }
    function wikipedia(m, kind) {
        if (kind === 'still') return Promise.resolve([]);
        var title = filmTitle(m);
        if (!title || title.length > 90) return Promise.resolve([]);
        var lang = /[а-яё]/i.test(title) ? 'ru' : 'en';
        var url = 'https://' + lang + '.wikipedia.org/w/api.php?action=query&generator=search&gsrnamespace=0' +
            '&gsrsearch=' + encodeURIComponent('intitle:"' + title.replace(/["<>]/g, '') + '"') +
            '&gsrlimit=6&prop=pageimages&pithumbsize=900&format=json&origin=*';
        return once('wiki:' + lang + ':' + title, function () { return queueRequest(url); }).then(function (d) {
            var pages = d && d.query && d.query.pages;
            if (!pages) return [];
            var ranked = Object.keys(pages).map(function (k) {
                var p = pages[k], titleClean = String(p.title || '').replace(/\s*\([^)]*\)\s*$/, '');
                return { data: p, score: matchScore(m, [titleClean], 0) };
            }).sort(function (a, b) { return b.score - a.score; });
            var candidates = ranked.filter(function (r) { return r.score >= 0.98; });
            if (!candidates.length) return [];
            // Wikipedia often has several distinct films/shows with the same title.
            // Never pick one arbitrarily if the disambiguation cannot be verified.
            if (candidates.length > 1) {
                var year = filmYear(m);
                candidates = candidates.filter(function (r) {
                    var raw = String(r.data.title || '');
                    var match = raw.match(/\((19|20)\d{2}[^)]*\)/);
                    return year && match && Number(match[0].slice(1, 5)) === year;
                });
                if (candidates.length !== 1) return [];
            }
            return firstUrls([candidates[0].data.thumbnail && candidates[0].data.thumbnail.source]);
        });
    }
    function providers(m, kind, ep) {
        // TMDB first. Never replace a successfully loaded TMDB image.
        var steps = [];
        if (kind !== 'still') steps.push({ name: 'TMDB mirror', call: function () { return Promise.resolve(tmdbAlternates(m, kind)); } });
        if (kind === 'still') {
            steps.push({ name: 'TVmaze', call: function () { return tvMaze(m, kind, ep); } });
            steps.push({ name: 'Cinemeta', call: function () { return cinemeta(m, kind, ep); } });
            steps.push({ name: 'TMDB exact episode stills', call: function () { return tmdbEpisodeStills(m, ep); } });
            steps.push({ name: 'Fanart.tv (show)', call: function () { return fanart(m, 'backdrop'); } });
            steps.push({ name: 'TMDB show background', call: function () { return Promise.resolve(tmdbAlternates(m, 'backdrop')); } });
            steps.push({ name: 'TVmaze show background', call: function () { return tvMaze(m, 'backdrop'); } });
            steps.push({ name: 'Cinemeta show background', call: function () { return cinemeta(m, 'backdrop'); } });
            steps.push({ name: 'TVmaze show poster', call: function () { return tvMaze(m, 'poster'); } });
            steps.push({ name: 'Cinemeta show poster', call: function () { return cinemeta(m, 'poster'); } });
        } else {
            steps.push({ name: 'Fanart.tv', call: function () { return fanart(m, kind); } });
            steps.push({ name: 'Cinemeta', call: function () { return cinemeta(m, kind); } });
            steps.push({ name: 'TVmaze', call: function () { return tvMaze(m, kind); } });
            steps.push({ name: 'OMDb', call: function () { return omdb(m, kind); } });
            steps.push({ name: 'AniList', call: function () { return anilist(m, kind); } });
            steps.push({ name: 'Tenrai', call: function () { return tenrai(m, kind); } });
            steps.push({ name: 'Wikipedia', call: function () { return wikipedia(m, kind); } });
        }
        return steps;
    }
    function resolveArtwork(m, kind, ep, blockedUrls) {
        var id = cacheId(m, kind, ep);
        var ignore = blockedUrls || {};
        var cached = disk[id];
        var steps = providers(m, kind, ep);
        if (kind === 'still' && ep) {
            var known = episodeData[episodeKey(m, ep.season, ep.number)];
            if (known && known.url) steps.unshift({name: 'episode metadata', call: function () { return Promise.resolve([known.url]); }});
        }
        if (cached && cached.expires > Date.now() && imageUrl(cached.url)) {
            steps.unshift({ name: 'cache', call: function () { return Promise.resolve([cached.url]); } });
        }
        function next(i) {
            if (i >= steps.length) return Promise.resolve(null);
            var step = steps[i];
            return Promise.resolve().then(step.call).catch(function () { return []; }).then(function (urls) {
                urls = firstUrls(urls);
                function testAt(j) {
                    if (j >= urls.length) return next(i + 1);
                    var u = urls[j];
                    if (ignore[u]) return testAt(j + 1);
                    ignore[u] = true;
                    return probe(u).then(function (valid) {
                        if (!valid) { if (step.name === 'cache') delete disk[id]; return testAt(j + 1); }
                        disk[id] = { url: u, expires: Date.now() + CACHE_TTL };
                        saveDisk();
                        return { url: u, source: step.name };
                    });
                }
                return testAt(0);
            });
        }
        return next(0);
    }

    // Lampa renders "Серия 1" when the TMDB episode title is missing.
    // Rescue title + thumbnail independently from the TVmaze or English TMDB episode catalog.
    function genericName(s) {
        var n = cleanTitle(s);
        return !n || /^(tba|unknown|untitled|без названия|название неизвестно|название не указано|название отсутствует)$/.test(n) ||
            /^(episode|episodes|ep|series|серия|серии|эпизод|эпизоды|серія|часть)\s*(?:№|#)?\s*\d+$/.test(n) ||
            /^\d+\s*(episode|ep|серия|эпизод|серія)$/.test(n) || /^s\d+e\d+$/.test(n);
    }
    function goodEpisodeName(s) {
        return textValue(s).length > 1 && textValue(s).length < 180 && !genericName(s);
    }
    function episodeNumber(e) { return Number(e && (e.episode_number || e.episode || e.number)) || 0; }
    function episodeSeason(e, hint) {
        return Number(e && (e.season_number != null ? e.season_number : e.season)) || Number(hint) || 0;
    }
    function knownEpisodeName() {
        // Do not hard-code broadcaster episode ordering.
        // Regional rebroadcasts and re-edits number episodes differently.
        return '';
    }
    function episodeKey(movie, season, num) {
        return cacheId(movie, 'still', {season: season, number: num});
    }

    // Precise per-episode metadata via Lampa's own authenticated TMDB API.
    // A season summary may have no title/still even while an alternate language
    // or additional image exists for the exact episode.
    function tmdbEpisodeGet(movie, season, number, suffix) {
        if ((movie.source && movie.source !== 'tmdb') ||
            !/^\d+$/.test(String(movie.id || '')) || !Number.isInteger(Number(season)) ||
            !Number.isInteger(Number(number)) || Number(season) < 1 || Number(number) < 1) {
            return Promise.resolve(null);
        }
        // Lampa.Api.sources.tmdb.get() has season-specific response handling
        // for every route containing /season/1, including episode routes.
        // Use the official Lampa.TMDB URL builder instead, keeping the
        // user's configured TMDB proxy and avoiding a native parsing crash.
        var api = Lampa.TMDB;
        if (!api || typeof api.api !== 'function' || typeof api.key !== 'function') return Promise.resolve(null);
        var route = 'tv/' + movie.id + '/season/' + Number(season) + '/episode/' + Number(number) + '/' + suffix;
        return once('episode:exact:' + route, function () {
            try {
                var divider = route.indexOf('?') >= 0 ? '&' : '?';
                var url = api.api(route + divider + 'api_key=' + encodeURIComponent(api.key()) + '&language=ru-RU');
                stats.episodeApiCalls++;
                return queueRequest(url);
            } catch (_) { return Promise.resolve(null); }
        });
    }
    function tmdbEpisodeStills(movie, ep) {
        if (!ep || !ep.season || !ep.number) return Promise.resolve([]);
        return tmdbEpisodeGet(movie, ep.season, ep.number, 'images?include_image_language=ru,en,null')
            .then(function (response) {
                var array = response && response.stills;
                if (!Array.isArray(array)) return [];
                var order = array.filter(function (v) {
                    return /^\/[a-zA-Z0-9_./\-]+\.(?:jpe?g|png|webp)$/i.test(String(v.file_path || '')) &&
                        Number(v.width) >= 400 && Number(v.height) >= 200;
                }).sort(function (a, b) {
                    return (Number(b.vote_average || 0) - Number(a.vote_average || 0)) +
                        (Number(b.vote_count || 0) - Number(a.vote_count || 0)) / 30;
                });
                var urls = firstUrls(order.slice(0, 4).map(function (v) {
                    return 'https://image.tmdb.org/t/p/w780' + v.file_path;
                }));
                if (urls.length) stats.episodeApiStills++;
                return urls;
            }).catch(function () { return []; });
    }
    function episodeTitlesFromTMDB(movie, season, number) {
        return tmdbEpisodeGet(movie, season, number, 'translations').then(function (res) {
            var data = res && res.translations;
            if (!Array.isArray(data)) return '';
            var preferred = ['ru', 'uk', 'en'];
            for (var i = 0; i < preferred.length; i++) {
                var records = data.filter(function (v) { return v.iso_639_1 === preferred[i]; });
                for (var j = 0; j < records.length; j++) {
                    var title = records[j].data && records[j].data.name;
                    if (goodEpisodeName(title)) return title;
                }
            }
            return '';
        }).catch(function () { return ''; });
    }
    function pumpEpisodeTitles() {
        while (episodeTitleActive < 2 && episodeTitleQueue.length) {
            var next = episodeTitleQueue.shift();
            episodeTitleActive++;
            next().then(function () {
                episodeTitleActive--; pumpEpisodeTitles();
            }, function () {
                episodeTitleActive--; pumpEpisodeTitles();
            });
        }
    }
    function titleFromEpisodeSource(row, movie, season, number, textNode) {
        if (!textNode || !genericName(textNode.textContent) || !enabled()) return;
        var key = episodeKey(movie, season, number);
        if (episodeTitleLookups[key]) return;
        var showId = cacheId(movie, 'show');
        // Avoid thousands of API requests on long seasons; prioritize visible rows.
        var used = episodeTitleBudget[showId] || 0;
        if (used >= 8 || episodeTitleQueue.length >= 16) return;
        episodeTitleBudget[showId] = used + 1;
        episodeTitleLookups[key] = true;
        episodeTitleQueue.push(function () {
            return episodeTitlesFromTMDB(movie, season, number).then(function (name) {
                if (!name) return;
                var detail = episodeData[key] || (episodeData[key] = {});
                if (!detail.name) { detail.name = name; stats.namesFilled++; stats.episodeApiNames++;
                    uniqueEpisodeFound[key] = 'TMDB translations';
                    stats.nameSources.translations = (stats.nameSources.translations || 0) + 1; }
                var stillThisEpisode = row.__capsuleEpisode &&
                    episodeKey(row.__capsuleEpisode.movie, row.__capsuleEpisode.season, row.__capsuleEpisode.number) === key;
                if (stillThisEpisode && textNode.isConnected !== false && genericName(textNode.textContent)) {
                    textNode.textContent = name;
                    stats.visibleEpisodeTitles++;
                }
            });
        });
        pumpEpisodeTitles();
    }


    function utcDay(s) {
        var match = String(s || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
        return match ? Date.UTC(+match[1], +match[2]-1, +match[3]) / 86400000 : null;
    }
    function episodeAir(e) {
        return utcDay(e && (e.air_date || e.airdate || e.release_date || e.aired));
    }
    function titleVote(movie, target, source, title, confidence) {
        var season = episodeSeason(target, 0), number = episodeNumber(target);
        var key = episodeKey(movie, season, number);
        if (!goodEpisodeName(title) || !season || !number) return '';
        if (source === 'TMDB English' || source === 'TMDB translations') return title;
        var votes = voteCandidates[key] || (voteCandidates[key] = {});
        var clean = cleanTitle(title);
        var v = votes[clean] || (votes[clean] = {title: title, sources: {}});
        v.sources[source] = true;
        var count = Object.keys(v.sources).length;
        if (confidence === 'date' && count >= 1) { stats.matchingByDate++; return title; }
        if (count >= 2) { stats.matchingByAgreement++; return title; }
        return '';
    }
    function safeEpisodeMatch(movie, target, found, source) {
        if (!found) return false;
        if (episodeNumber(found) !== episodeNumber(target) ||
            episodeSeason(found) !== episodeSeason(target)) return false;
        if (source === 'TMDB English') return true;
        var targetDate = episodeAir(target), candidateDate = episodeAir(found);
        if (targetDate != null && candidateDate != null) {
            if (Math.abs(targetDate - candidateDate) > 2) { stats.rejectedTitles++; return false; }
            return true;
        }
        if (found.__capsuleTrustedIdentity === 'imdb') return true;
        // Exact number alone cannot establish correspondence between
        // broadcasters that number Russian and international cuts differently.
        stats.rejectedTitles++;
        return false;
    }

    function tvMazeCatalog(movie) {
        return once('maze:show:' + (movie.imdb_id || filmTitle(movie)) + ':' + filmYear(movie),
            function () { return tvMazeShow(movie); }).then(function (show) {
            if (!show || !show.id) return [];
            return once('maze:episodes:' + show.id, function () {
                return queueRequest('https://api.tvmaze.com/shows/' + show.id + '/episodes?specials=1');
            }).then(function (v) {
                var trusted = movie.imdb_id && show.externals &&
                    show.externals.imdb === movie.imdb_id;
                return Array.isArray(v) ? v.map(function (e) {
                    return Object.assign({}, e, {__capsuleTrustedIdentity: trusted ? 'imdb' : ''});
                }) : [];
            });
        }).catch(function () { return []; });
    }


    // Epguides has a separate episode-title catalog, with TVmaze still images.
    // This is an optional, no-key browser API and may be unavailable/CORS-blocked.
    // Strict identity checks prevent pairing a Russian show with a namesake.
    function epguidesCatalog(movie) {
        var titles = [movie.original_name, movie.name, movie.original_title, movie.title]
            .map(textValue).filter(function (v, i, a) { return v && v.length >= 3 && a.indexOf(v) === i; })
            .slice(0, 2);
        var imdb = String(movie.imdb_id || '');
        function search(i) {
            if (i >= titles.length) return Promise.resolve([]);
            var query = 'https://epguides.frecar.no/shows/search?query=' + encodeURIComponent(titles[i]);
            return once('epguides:search:' + titles[i], function () { return queueRequest(query); })
                .then(function (resp) {
                    var found = Array.isArray(resp) ? resp : resp && (resp.results || resp.shows || resp.items) || [];
                    if (!Array.isArray(found)) return search(i+1);
                    var matches = found.filter(function (v) {
                        if (!v || typeof v !== 'object') return false;
                        if (imdb && v.imdb_id && imdb !== v.imdb_id) return false;
                        var y = filmYear(movie), fy = filmYear({first_air_date: v.start_date || v.first_air_date || ''});
                        if (y && fy && Math.abs(y-fy) > 1) return false;
                        return matchScore(movie, [v.title || v.name || ''], fy) >= 0.96;
                    });
                    if (matches.length !== 1) return search(i+1);
                    var show = matches[0];
                    var key = String(show.epguides_key || show.key || '').trim();
                    if (!/^[a-zA-Z0-9_-]{2,90}$/.test(key)) return search(i+1);
                    var seasons = Object.keys(movie.__capsuleRequestedSeasons || {});
                    var sn = Number(seasons[0] || 0);
                    if (!sn) return Promise.resolve([]);
                    var endpoint = 'https://epguides.frecar.no/shows/' + encodeURIComponent(key) +
                        '/seasons/' + sn + '/episodes';
                    return once('epguides:episodes:' + key + ':' + sn, function () { return queueRequest(endpoint); })
                        .then(function (response) {
                            var items = Array.isArray(response) ? response : response && (response.episodes || response.results) || [];
                            if (!Array.isArray(items)) return [];
                            return items.filter(function (v) {
                                var number = Number(v.episode_number || v.number);
                                return number > 0;
                            }).map(function (v) {
                                return {season: Number(v.season || sn),
                                    episode_number: Number(v.episode_number || v.number),
                                    name: v.title || '', air_date: v.release_date || '',
                                    __capsuleTrustedIdentity: imdb && show.imdb_id === imdb ? 'imdb' : '',
                                    image: v.poster_url ? {original:v.poster_url}: null};
                            });
                        });
                }).catch(function () { return []; });
        }
        return search(0);
    }

    function cinemetaCatalog(movie) {
        var imdb = String(movie.imdb_id || '');
        var type = 'series';
        function findId() {
            if (/^tt\d{6,10}$/.test(imdb)) return Promise.resolve(imdb);
            var title = filmTitle(movie);
            if (!title || title.length < 3 || title.length > 95) return Promise.resolve('');
            return once('cinemeta:search:' + type + ':' + title, function () {
                return queueRequest('https://v3-cinemeta.strem.io/catalog/series/top/search=' +
                    encodeURIComponent(title) + '.json');
            }).then(function (data) {
                var ranked = (data && data.metas || []).filter(function (v) {
                    return /^tt\d{6,10}$/.test(String(v.id || ''));
                }).map(function (v) {
                    return {id: v.id, score: matchScore(movie, [v.name], Number((v.releaseInfo || '').slice(0, 4)))};
                }).sort(function (a, b) { return b.score - a.score; });
                return ranked.length && ranked[0].score >= 0.96 ? ranked[0].id : '';
            });
        }
        return findId().then(function (id) {
            if (!id) return [];
            return once('cinemeta:meta:series:' + id, function () {
                return queueRequest('https://v3-cinemeta.strem.io/meta/series/' + id + '.json');
            }).then(function (data) {
                var meta = data && data.meta;
                if (!meta || (meta.id && meta.id !== id) || !Array.isArray(meta.videos)) return [];
                if (!/^tt\d+$/.test(imdb) &&
                    matchScore(movie, [meta.name], Number(String(meta.releaseInfo || '').slice(0, 4))) < 0.9) return [];
                return meta.videos.map(function (v) {
                    return {season: v.season, episode_number: v.episode,
                        name: v.title || v.name || '', air_date: v.released || v.air_date || '',
                        __capsuleTrustedIdentity: /^tt\d{6,10}$/.test(imdb) ? 'imdb' : '',
                        image: v.thumbnail ? {original:v.thumbnail} : null};
                });
            });
        }).catch(function () { return []; });
    }

    function tmdbEnglish(movie, season) {
        if ((movie.source && movie.source !== 'tmdb') || !/^\d+$/.test(String(movie.id || ''))) return Promise.resolve([]);
        var api = Lampa.Api && Lampa.Api.sources && Lampa.Api.sources.tmdb;
        if (!api || typeof api.get !== 'function') return Promise.resolve([]);
        return once('episode:english:' + movie.id + ':' + season, function () {
            return new Promise(function (resolve) {
                var finished = false;
                var timeout = setTimeout(function () { done(null); }, 5500);
                function done(data) {
                    if (finished) return;
                    finished = true;
                    clearTimeout(timeout);
                    resolve(data);
                }
                try { api.get('tv/' + movie.id + '/season/' + season, {langs: 'en'},
                    done, function () { done(null); }, {life: 7 * 24 * 60}); }
                catch (_) { done(null); }
            });
        }).then(function (data) { return data && Array.isArray(data.episodes) ? data.episodes : []; });
    }
    function scheduleEpisodeRefresh() {
        if (episodeRefreshTimer) return;
        episodeRefreshTimer = setTimeout(function () {
            episodeRefreshTimer = null;
            if (!enabled() || !document.querySelectorAll) return;
            var movie = cardFromActivity() || (currentFull && currentFull.movie);
            if (!movie || !isTv(movie)) return;
            var activeKey = cacheId(movie, 'show');
            var snapshot = seasonSnapshots[activeKey];
            var seasonRows = document.querySelectorAll('.season-episode');
            if (snapshot && snapshot.movie.id === movie.id && seasonRows.length) {
                seasonRows.forEach(function (row, i) {
                    var numEl = row.querySelector('.season-episode__episode-number');
                    var num = Number(numEl && numEl.textContent) || 0;
                    if (!num && seasonRows.length === snapshot.list.length) num = episodeNumber(snapshot.list[i]);
                    if (!num) return;
                    applyEpisodeNode(row, movie, snapshot.season, num, '.season-episode__title', '.season-episode__img img');
                });
            }
            if (currentFull && currentFull.movie && currentFull.movie.id === movie.id) {
                var list = currentFull.episodes && currentFull.episodes.episodes;
                if (!Array.isArray(list)) return;
                document.querySelectorAll('.full-episode').forEach(function (row) {
                    var numEl = row.querySelector('.full-episode__num');
                    var num = Number(numEl && numEl.textContent) || 0;
                    if (!num) return;
                    var episode = list.find(function (e) { return episodeNumber(e) === num; });
                    if (!episode) return;
                    var season = episodeSeason(episode, currentFull.episodes.season_number);
                    if (season) applyEpisodeNode(row, movie, season, num, '.full-episode__name', '.full-episode__img img');
                });
            }
        }, 80);
    }
    function applyEpisodeNode(row, movie, season, number, titleSelector, imageSelector) {
        var data = episodeData[episodeKey(movie, season, number)];
        row.__capsuleEpisode = {movie: movie, season: season, number: number};
        // Even when no alternate metadata exists, attempt fallback images.
        if (!data) {
            var earlyTitle = row.querySelector(titleSelector);
            if (earlyTitle && genericName(earlyTitle.textContent)) titleFromEpisodeSource(row, movie, season, number, earlyTitle);
            var missingImage = row.querySelector(imageSelector);
            if (missingImage && badSrc(missingImage)) recover(missingImage, 'missing');
            return;
        }
        var title = row.querySelector(titleSelector);
        if (title && data.name && genericName(title.textContent)) {
            title.textContent = data.name;
            stats.visibleEpisodeTitles++;
        }
        if (title && genericName(title.textContent)) titleFromEpisodeSource(row, movie, season, number, title);
        var img = row.querySelector(imageSelector);
        if (img && data.url && badSrc(img)) img.src = data.url;
        // An episode row can exist with an empty <img src> and no image
        // load/error event. Now that its exact S/E is known, explicitly run
        // recovery; previously this silent state was never retried.
        if (img && badSrc(img)) recover(img, 'missing');
        // Some native episode images finish loading before the episode
        // context has been attached. Audit those already-loaded images.
        if (img && img.complete && img.naturalWidth) inspectQuality(img);
    }
    function hydrateEpisodes(movie, list, hint) {
        if (!enabled() || !movie || !isTv(movie) || !Array.isArray(list)) return;
        stats.episodeLists++;
        stats.missingEpisodeNames += list.filter(function (e) {
            var missing = episodeNumber(e) && genericName(e.name);
            if (missing) uniqueEpisodeMissing[episodeKey(movie, episodeSeason(e, hint), episodeNumber(e))] = true;
            return missing;
        }).length;
        var needed = list.filter(function (e) {
            return episodeNumber(e) && (genericName(e.name) || (!e.still_path && !e.img));
        });
        needed.forEach(function (e) {
            if (!genericName(e.name)) return;
            var sn = episodeSeason(e, hint), num = episodeNumber(e);
            var known = knownEpisodeName(movie, sn, num, e.air_date);
            if (!known) return;
            e.name = e.title = known;
            var key = episodeKey(movie, sn, num);
            var detail = episodeData[key] || (episodeData[key] = {});
            detail.name = known;
            stats.namesFilled++;
            uniqueEpisodeFound[key] = 'audited';
            stats.nameSources.audited = (stats.nameSources.audited || 0) + 1;
        });
        if (needed.length) scheduleEpisodeRefresh();
        if (!needed.length) return;
        var seasons = {};
        needed.forEach(function (e) {
            var sn = episodeSeason(e, hint);
            if (sn) seasons[sn] = true;
        });
        function merge(remote, kind) {
            if (!Array.isArray(remote)) return;
            var index = {};
            remote.forEach(function (e) {
                var sn = episodeSeason(e, hint), num = episodeNumber(e);
                if (sn && num) index[sn + ':' + num] = e;
            });
            var changed = false;
            needed.forEach(function (e) {
                var sn = episodeSeason(e, hint), num = episodeNumber(e);
                var found = index[sn + ':' + num];
                if (!found || !safeEpisodeMatch(movie, e, found, kind)) return;
                var key = episodeKey(movie, sn, num);
                var detail = episodeData[key] || (episodeData[key] = {});
                if (genericName(e.name) && goodEpisodeName(found.name)) {
                    var certainty = episodeAir(e) != null && episodeAir(found) != null ? 'date' : 'imdb';
                    var confirmed = titleVote(movie, e, kind, found.name, certainty);
                    if (confirmed) {
                        e.name = e.title = detail.name = confirmed;
                        stats.namesFilled++;
                        uniqueEpisodeFound[key] = kind;
                        stats.nameSources[kind] = (stats.nameSources[kind] || 0) + 1;
                        changed = true;
                    }
                }
                var link = (kind === 'TVmaze' || kind === 'Cinemeta' || kind === 'Epguides') && found.image ? imageUrl(found.image.original || found.image.medium) : '';
                // Frame still must map to the same episode; do not borrow
                // images from a different regional numbering/air date.
                if (link && !detail.url) detail.url = link;
                if (link && !e.still_path && !e.img) {
                    e.img = link;
                    stats.episodeStills++;
                    changed = true;
                }
            });
            if (changed) scheduleEpisodeRefresh();
        }
        Object.keys(seasons).forEach(function (sn) {
            // English metadata is a second try if a localized TMDB title is empty.
            if (needed.some(function (e) { return episodeSeason(e, hint) === Number(sn) && genericName(e.name); }))
                tmdbEnglish(movie, Number(sn)).then(function (episodes) { merge(episodes, 'TMDB English'); });
        });
        tvMazeCatalog(movie).then(function (episodes) { merge(episodes, 'TVmaze'); });
        cinemetaCatalog(movie).then(function (episodes) { merge(episodes, 'Cinemeta'); });
        // Only one request per show/season. Never block the native page.
        var seasonKeys = Object.keys(seasons);
        if (seasonKeys.length) {
            seasonKeys.forEach(function (sn) {
                var requested = {};
                requested[sn] = true;
                var epgMovie = Object.assign({}, movie, {__capsuleRequestedSeasons: requested});
                epguidesCatalog(epgMovie).then(function (episodes) { merge(episodes, 'Epguides'); });
            });
        }
    }
    function rememberEpisodes(movie, season, list) {
        if (!movie || !Array.isArray(list)) return;
        seasonSnapshots[cacheId(movie, 'show')] = {movie: movie, season: Number(season), list: list};
        if (Object.keys(seasonSnapshots).length > 16) seasonSnapshots = {};
    }
    function addEpisodeHooks() {
        if (!Lampa.Api || Lampa.Api.__capsuleArtEpisodes) return;
        Lampa.Api.__capsuleArtEpisodes = true;
        var seasons = Lampa.Api.seasons, full = Lampa.Api.full;
        if (typeof seasons === 'function') Lampa.Api.seasons = function (movie, nums, callback) {
            return seasons.call(this, movie, nums, function (result) {
                if (result && Array.isArray(nums)) {
                    nums.forEach(function (sn) {
                        var data = result[sn];
                        if (!data || !Array.isArray(data.episodes)) return;
                        rememberEpisodes(movie, sn, data.episodes);
                        hydrateEpisodes(movie, data.episodes, sn);
                    });
                }
                // Apply audited names BEFORE native Lampa builds the rows.
                if (typeof callback === 'function') callback(result);
                scheduleEpisodeRefresh();
            });
        };
        if (typeof full === 'function') Lampa.Api.full = function (params, callback, error) {
            return full.call(this, params, function (data) {
                if (data && data.movie && data.episodes && Array.isArray(data.episodes.episodes)) {
                    hydrateEpisodes(data.movie, data.episodes.episodes, data.episodes.season_number);
                }
                if (typeof callback === 'function') callback(data);
                scheduleEpisodeRefresh();
            }, error);
        };
    }

    function cardFromActivity() {
        try { return Lampa.Activity.active().card || Lampa.Activity.active().movie || null; }
        catch (_) { return null; }
    }
    function contextFor(img) {
        var holder = img.closest('.card');
        if (holder && holder.card_data && (holder.card_data.title || holder.card_data.name || holder.card_data.id)) {
            var data = holder.card_data;
            var style = data.params && data.params.style && data.params.style.name;
            return { movie: data, kind: style === 'wide' || style === 'collection' ? 'backdrop' : 'poster' };
        }
        var fullRoot = img.closest('.full-episode, .season-episode');
        if (fullRoot) {
            if (fullRoot.__capsuleEpisode) {
                var mapped = fullRoot.__capsuleEpisode;
                return { movie: mapped.movie, kind: 'still', ep: {season: mapped.season, number: mapped.number} };
            }
            var movie = cardFromActivity() || (currentFull && currentFull.movie);
            if (!movie) return null;
            var season = 0, number = 0;
            if (fullRoot.classList.contains('full-episode')) {
                var el = fullRoot.querySelector('.full-episode__num');
                number = Number(el && el.textContent.replace(/\D+/g, '')) || 0;
                if (currentFull && currentFull.movie.id === movie.id) {
                    var eps = currentFull.episodes || {};
                    season = Number(eps.season_number) || 0;
                    if (!season && Array.isArray(eps.episodes)) {
                        var hit = eps.episodes.filter(function (e) { return Number(e.episode_number) === number; })[0];
                        season = Number(hit && hit.season_number) || 0;
                    }
                }
            } else {
                try { season = Number(Lampa.Activity.active().season) || 0; } catch (_) {}
                if (!season && currentFull && currentFull.movie.id === movie.id) {
                    season = Number(currentFull.episodes && currentFull.episodes.seasons_count) || 0;
                }
                if (!season) season = Number(movie.number_of_seasons) || 1;
                // The native list prints the actual episode number after image load.
                // Prefer that over the row index, which is unsafe if episodes are omitted.
                var numberNode = fullRoot.querySelector('.season-episode__episode-number');
                number = Number(numberNode && numberNode.textContent.replace(/\D+/g, '')) || 0;
                if (!number) {
                    var siblings = img.closest('.activity') || document;
                    var items = siblings.querySelectorAll('.season-episode');
                    // Use row index only when the number of rendered rows exactly
                    // matches the official count for this season (no missing episodes).
                    var seasonInfo = (movie.seasons || []).filter(function (s) {
                        return Number(s.season_number) === season;
                    })[0];
                    if (seasonInfo && Number(seasonInfo.episode_count) === items.length) {
                        for (var i = 0; i < items.length; i++) if (items[i] === fullRoot) { number = i + 1; break; }
                    }
                }
            }
            if (!season || !number) return null;
            return { movie: movie, kind: 'still', ep: { season: season, number: number } };
        }
        if (img.classList.contains('full--poster') || img.classList.contains('full-start__background')) {
            var fm = currentFull && currentFull.movie || cardFromActivity();
            return fm ? { movie: fm, kind: img.classList.contains('full--poster') ? 'poster' : 'backdrop' } : null;
        }
        // Standalone episode card: use active show, not an unrelated list item.
        if (img.closest('.full-episode__img')) {
            var m = cardFromActivity();
            if (m) return { movie: m, kind: 'backdrop' };
        }
        return null;
    }

    // Evaluate genuinely different images from the film's TMDB artwork gallery,
    // *not* just a bigger version of the same picture.
    function galleryFor(movie, kind, avoidSrc) {
        if (kind === 'still') return Promise.resolve([]);
        if ((movie.source && movie.source !== 'tmdb') ||
            !/^\d+$/.test(String(movie.id || ''))) return Promise.resolve([]);
        var key = (isTv(movie) ? 'tv:' : 'movie:') + movie.id + ':' + kind;
        return once('gallery:' + key, function () {
            if (movie.images && (movie.images.posters || movie.images.backdrops)) return Promise.resolve(movie.images);
            var api = Lampa.Api && Lampa.Api.sources && Lampa.Api.sources.tmdb;
            if (!api || typeof api.get !== 'function') return Promise.resolve(null);
            return new Promise(function (resolve) {
                var finished = false;
                var timer = setTimeout(function () { finish(null); }, 5600);
                function finish(data) {
                    if (finished) return;
                    finished = true;
                    clearTimeout(timer);
                    resolve(data);
                }
                try {
                    api.get((isTv(movie) ? 'tv/' : 'movie/') + movie.id +
                        '/images?include_image_language=ru,en,null', {}, finish, function () { finish(null); },
                        {life: 60 * 24 * 7});
                } catch (_) { finish(null); }
            });
        }).then(function (data) {
            var images = data && data[kind === 'poster' ? 'posters' : 'backdrops'];
            if (!Array.isArray(images)) return [];
            return images.filter(function (v) {
                var aspect = Number(v.aspect_ratio), width = Number(v.width);
                return typeof v.file_path === 'string' && /^\/[\w\-/.]+\.(?:jpe?g|png|webp)$/i.test(v.file_path)
                    && (!avoidSrc || avoidSrc.indexOf(v.file_path) === -1)
                    && width >= (kind === 'poster' ? 500 : 900)
                    && (kind === 'poster' ? aspect > 0.58 && aspect < 0.85 : aspect > 1.45 && aspect < 2.1);
            }).sort(function (a, b) {
                function rating(v) {
                    var score = Math.min(10, Number(v.vote_average) || 0) * 6
                        + Math.log(1 + (Number(v.vote_count) || 0)) * 7;
                    var lang = String(v.iso_639_1 || '');
                    if (lang === 'ru') score += 10;
                    else if (!lang || lang === 'en') score += 4;
                    return score;
                }
                return rating(b) - rating(a);
            }).slice(0, 5).map(function (v) {
                return 'https://image.tmdb.org/t/p/' + (kind === 'poster' ? 'w780' : 'w1280') + v.file_path;
            });
        }).catch(function () { return []; });
    }

    function highQualityCandidate(ctx, currentSrc, currentW, currentH, mode) {
        var tasks = [];
        var original = tmdbFullSize(currentSrc);
        if (original && original !== currentSrc && mode !== 'alternatives') tasks.push({
            name: 'TMDB original', call: function () { return Promise.resolve([original]); }
        });
        var remote = providers(ctx.movie, ctx.kind, ctx.ep).filter(function (p) {
            return !/^TMDB/i.test(p.name);
        });
        var gallery = {name: 'TMDB artwork gallery', call: function () {
            return galleryFor(ctx.movie, ctx.kind, currentSrc);
        }};
        if (ctx.kind !== 'still') {
            // "Alternatives" means actually try independent sources, including
            // when IMDb ID is missing. Gallery is a LAST fallback, not first.
            if (mode === 'alternatives') {
                remote.forEach(function (p) { tasks.push(p); });
                tasks.push(gallery);
            } else {
                var imdb = String(ctx.movie.imdb_id || '');
                var preferred = /^tt\d{6,10}$/.test(imdb) ?
                    remote.filter(function (p) { return p.name === 'Cinemeta'; }) : [];
                preferred.forEach(function (p) { tasks.push(p); });
                tasks.push(gallery);
                remote.forEach(function (p) {
                    if (preferred.indexOf(p) === -1) tasks.push(p);
                });
            }
        } else {
            remote.forEach(function (p) { tasks.push(p); });
        }
        if (original && original !== currentSrc && mode === 'alternatives') tasks.push({
            name: 'TMDB original (last resort)', call: function () { return Promise.resolve([original]); }
        });
        var lowerLimit = QUALITY_LIMITS[ctx.kind] || 600;
        function search(i) {
            if (i >= tasks.length) return Promise.resolve(null);
            return Promise.resolve().then(tasks[i].call).catch(function () { return []; }).then(function (urls) {
                urls = firstUrls(urls).slice(0, 3);
                function evaluate(j) {
                    if (j >= urls.length) return search(i + 1);
                    var url = urls[j];
                    if (url === currentSrc) return evaluate(j + 1);
                    return probeSize(url).then(function (size) {
                        if (!size || !size.width || !size.height) return evaluate(j + 1);
                        var ratio = size.width / size.height;
                        var oldRatio = currentW / Math.max(currentH, 1);
                        if (ctx.kind === 'poster' && (ratio > 0.87 || ratio < 0.48)) return evaluate(j + 1);
                        if (ctx.kind !== 'poster' && ratio < 1.20) return evaluate(j + 1);
                        // Reject incompatible crops and merely different art of the same resolution.
                        if (Math.abs(ratio - oldRatio) > (ctx.kind === 'poster' ? 0.14 : 0.27)) return evaluate(j + 1);
                        var growth = size.width / Math.max(currentW, 1);
                        var acceptable = mode === 'alternatives' ?
                            (growth >= 1.65 && size.width >= Math.max(lowerLimit, currentW + 200)) :
                            (growth >= 1.85 && size.width >= Math.max(lowerLimit, currentW + 250));
                        if (!acceptable) return evaluate(j + 1);
                        return {url: url, source: tasks[i].name, width: size.width};
                    });
                }
                return evaluate(0);
            });
        }
        return search(0);
    }
    function tmdbFullSize(src) {
        if (!/^https:\/\/(?:[^\/]*\.)?(?:tmdb\.org|imagetmdb\.com)\//i.test(src || '')) return '';
        var updated = String(src).replace(/\/t\/p\/(?:w\d{2,4}|original)\//i, '/t/p/original/');
        return updated !== src ? imageUrl(updated) : '';
    }
    function probeSize(url) {
        return new Promise(function (resolve) {
            if (imageJobs.length >= 90) return resolve(null);
            imageJobs.push(function (done) {
                var obj = new Image(), finished = false;
                var timer = setTimeout(function () { finish(null); }, IMAGE_TIMEOUT);
                function finish(value) {
                    if (finished) return;
                    finished = true;
                    clearTimeout(timer);
                    obj.onload = obj.onerror = null;
                    obj.src = '';
                    resolve(value);
                    done();
                }
                obj.onload = function () {
                    finish({width: obj.naturalWidth || obj.width || 0, height: obj.naturalHeight || obj.height || 0});
                };
                obj.onerror = function () { finish(null); };
                obj.src = url;
            });
            imagePump();
        });
    }
    function cachedUpgradeKey(ctx, src, mode) {
        return 'quality:' + cacheId(ctx.movie, ctx.kind, ctx.ep) + ':' + mode + ':' + src;
    }
    function applyPrepared(img) {
        if (!enabled() || qualityMode() === 'missing' || !relevant(img) || !img.isConnected) return false;
        // Never visibly overwrite a successfully loaded original image.
        if (img.naturalWidth > 0) return false; // Even partially decoded images may already be painted.
        var src = img.getAttribute('src') || '';
        if (!src || broken.test(src)) return false;
        var ctx = contextFor(img);
        if (!ctx || !ctx.movie || !names(ctx.movie).length) return false;
        var mode = qualityMode(), key = cachedUpgradeKey(ctx, src, mode);
        var cached = disk[key], url = qualityWinners[key] || (cached && cached.expires > Date.now() && imageUrl(cached.url) ? cached.url : '');
        if (!url || url === src) return false;
        var state = img.__capsuleArtwork || (img.__capsuleArtwork = {});
        if (state.applied === url) return false;
        state.applied = url;
        state.pendingVerified = url;
        stats.rescued++;
        img.src = url;
        return true;
    }
    function qualityPump() {
        while (qualityActive < QUALITY_MAX_ACTIVE && qualityTasks.length) {
            var job = qualityTasks.shift();
            qualityActive++;
            job(function () {
                qualityActive--;
                qualityPump();
            });
        }
    }
    function queueQuality(fn) {
        if (qualityTasks.length >= QUALITY_MAX_QUEUED) return false;
        qualityTasks.push(fn);
        qualityPump();
        return true;
    }
    function inspectQuality(img) {
        if (!enabled() || qualityMode() === 'missing' || !relevant(img) || !img.isConnected) return;
        var src = img.getAttribute('src') || '';
        if (broken.test(src) || !src || !img.naturalWidth || !img.naturalHeight) return;
        var state = img.__capsuleArtwork || (img.__capsuleArtwork = {});
        if (state.applied === src || state.qualitySrc === src || state.busy) return;
        var ctx = contextFor(img);
        if (!ctx || !ctx.movie || !names(ctx.movie).length) return;
        // Never attempt to improve a still unless the exact S/E is identified.
        if (ctx.kind === 'still' && (!ctx.ep || !ctx.ep.season || !ctx.ep.number)) return;
        var r = typeof img.getBoundingClientRect === 'function' ? img.getBoundingClientRect() : null;
        if (r && (r.bottom < -200 || r.top > window.innerHeight + 250)) return;
        var w = img.naturalWidth, h = img.naturalHeight, mode = qualityMode();
        var threshold = QUALITY_LIMITS[ctx.kind] || 600;
        if (ctx.kind === 'poster' && img.matches && img.matches('.full--poster')) threshold = 650;
        // Image quality is about the screen size, not just intrinsic pixels.
        // Native 500px art is entirely adequate for a 170px thumbnail.
        var displayWidth = r && r.width > 0 ? r.width :
            (img.clientWidth || img.width || 0);
        var deviceScale = Math.min(3, Math.max(1, window.devicePixelRatio || 1));
        var neededWidth = displayWidth > 0 ?
            Math.max(320, Math.ceil(displayWidth * deviceScale * 1.15)) : threshold;
        if (mode === 'auto' && w >= neededWidth) return;
        if (mode !== 'alternatives' && w >= threshold && neededWidth <= threshold) return;
        var key = cachedUpgradeKey(ctx, src, mode);
        // Cache hits are only applied to *unrendered* images via applyPrepared.
        // This function runs after load: never swap a visible picture here.
        if (qualityWinners[key] || (disk[key] && disk[key].expires > Date.now())) return;
        if (qualityRecent[key] && Date.now() - qualityRecent[key] < 15 * 60 * 1000) return;
        state.qualitySrc = src;
        stats.qualityAttempts++;
        var enqueued = queueQuality(function (done) {
            highQualityCandidate(ctx, src, w, h, mode).then(function (better) {
                if (!better || !img.isConnected || !enabled()) return;
                if ((img.getAttribute('src') || '') !== src) return;
                if (qualityMode() !== mode) return;
                var currentCtx = contextFor(img);
                if (!currentCtx || cacheId(currentCtx.movie, currentCtx.kind, currentCtx.ep) !== cacheId(ctx.movie, ctx.kind, ctx.ep)) return;
                // The source is still showing correctly. Save an upgrade for its
                // next load, without a distracting in-place poster replacement.
                qualityWinners[key] = better.url;
                disk[key] = {url: better.url, expires: Date.now() + CACHE_TTL};
                saveDisk();
                stats.qualityFound++;
                stats.qualityPrepared++;
                stats.lastSource = better.source;
                stats.bySource[better.source] = (stats.bySource[better.source] || 0) + 1;
                if (Object.keys(qualityWinners).length > 250) qualityWinners = {};
            }).catch(function () {}).then(done, done);
        });
        if (enqueued) {
            qualityRecent[key] = Date.now();
            if (Object.keys(qualityRecent).length > 500) qualityRecent = {};
        } else {
            state.qualitySrc = '';
        }
    }
    function relevant(img) {
        return !!(img && img.tagName === 'IMG' && img.matches(
            '.card .card__img, .full--poster, .full-start__background, ' +
            '.full-episode__img img, .season-episode__img img, .card_episode .full-episode__img img'));
    }
    function badSrc(img) {
        var src = img.getAttribute('src') || '';
        return !src || broken.test(src);
    }
    function injectBackground(movie, url) {
        if (!currentFull || currentFull.movie.id !== movie.id || window.innerWidth <= 790) return;
        if (window.lampa_settings && window.lampa_settings.light_version) return;
        var root = currentFull.root;
        if (!root || !root.isConnected) return;
        var parent = root.querySelector('.full-start-new, .full-start, .full-start-new__poster');
        if (!parent) return;
        var img = root.querySelector('.full-start__background');
        if (!img) {
            img = document.createElement('img');
            img.className = 'full-start__background loaded';
            parent.insertBefore(img, parent.firstChild);
        }
        if (!img.src || badSrc(img)) img.src = url;
    }
    function recover(img, reason) {
        if (!enabled() || !relevant(img) || !img.isConnected) return;
        var ctx = contextFor(img);
        if (!ctx || !ctx.movie || !names(ctx.movie).length) return;
        var state = img.__capsuleArtwork || (img.__capsuleArtwork = { busy: false, done: false, tried: {}, last: '' });
        var ctxKey = cacheId(ctx.movie, ctx.kind, ctx.ep);
        if (state.contextKey !== ctxKey) {
            state = img.__capsuleArtwork = { busy: false, done: false, tried: {}, last: '', contextKey: ctxKey };
        }
        if (state.busy || (state.noMoreUntil && Date.now() < state.noMoreUntil)) return;
        var present = img.getAttribute('src') || '';
        if (reason !== 'error' && !badSrc(img)) return;
        if (state.done && present === state.last && reason !== 'error') return;
        if (state.done && badSrc(img)) state.done = false;
        state.busy = true;
        state.last = present;
        stats.attempted++;
        if (present && !broken.test(present)) state.tried[present] = true;
        var movie = ctx.movie;
        var key = cacheId(movie, ctx.kind, ctx.ep);
        resolveArtwork(movie, ctx.kind, ctx.ep, state.tried).then(function (result) {
            state.busy = false;
            if (!img.isConnected || !enabled()) return;
            // Lampa may have loaded a good image while fallback lookup was running.
            var current = img.getAttribute('src') || '';
            if (current && current !== present && !broken.test(current) && current !== state.applied) return;
            if (!result) { state.done = true; state.noMoreUntil = Date.now() + 20 * 60000; stats.failed++; return; }
            state.done = true;
            state.applied = result.url;
            state.last = result.url;
            stats.rescued++;
            stats.bySource[result.source] = (stats.bySource[result.source] || 0) + 1;
            state.pendingVerified = result.url;
            img.src = result.url;
            var holder = img.closest('.card');
            if (holder) {
                var overlay = holder.querySelector('.card__img-broken');
                if (overlay) overlay.parentNode.removeChild(overlay);
            }
            // Only set complementary image fields, never overwrite TMDB paths or other metadata.
            if (ctx.kind === 'poster' && !movie.img) movie.img = result.url;
            if (ctx.kind === 'backdrop' && !movie.background_image) movie.background_image = result.url;
            if (ctx.kind === 'backdrop') injectBackground(movie, result.url);
            if (ctx.kind === 'still') {
                var parent = img.closest('.full-episode, .season-episode');
                if (parent) parent.classList.add('full-episode--loaded');
            }
        }).catch(function () { state.busy = false; });
    }
    function inspect(img) {
        if (!enabled() || !relevant(img)) return;
        stats.imagesSeen++;
        if (badSrc(img)) {
            // Lampa's lazy-load placeholder is not itself a loading failure.
            var src = img.getAttribute('src') || '';
            if (/img_load\.svg/.test(src)) return;
            recover(img, 'missing');
        } else {
            applyPrepared(img);
            if (img.complete && img.naturalWidth) inspectQuality(img);
        }
    }
    function inspectTree(root) {
        if (!root || root.nodeType !== 1) return;
        if (root.tagName === 'IMG') inspect(root);
        var imgs = root.querySelectorAll && root.querySelectorAll('img');
        if (imgs) for (var i = 0; i < imgs.length; i++) inspect(imgs[i]);
        if (root.matches && (root.matches('.season-episode, .full-episode') || root.querySelector('.season-episode, .full-episode'))) scheduleEpisodeRefresh();
    }
    function scheduleInspect(node) {
        if (!node || node.nodeType !== 1) return;
        if (pendingNodes.indexOf(node) === -1 && pendingNodes.length < 240) pendingNodes.push(node);
        if (flushTimer) return;
        flushTimer = setTimeout(function () {
            flushTimer = null;
            var nodes = pendingNodes.splice(0, 120);
            nodes.forEach(inspectTree);
            if (pendingNodes.length) scheduleInspect(pendingNodes.shift());
        }, 80);
    }
    function fullEvent(e) {
        if (!e || (e.type !== 'start' && e.type !== 'complite')) return;
        var d = e.data || {};
        if (!d.movie) return;
        var root = e.body && (e.body[0] || e.body);
        currentFull = { movie: d.movie, episodes: d.episodes || {}, root: root };
        if (e.type === 'complite' && root) scheduleInspect(root);
        if (e.type === 'complite') scheduleEpisodeRefresh();
        if (enabled() && d.episodes && Array.isArray(d.episodes.episodes)) hydrateEpisodes(d.movie, d.episodes.episodes, d.episodes.season_number);
        if (e.type === 'complite' && !d.movie.backdrop_path && enabled()) {
            // Even when Lampa removes the missing background element, restore it if possible.
            var movie = d.movie;
            resolveArtwork(movie, 'backdrop').then(function (result) {
                if (result && currentFull && currentFull.movie.id === movie.id) injectBackground(movie, result.url);
            });
        }
    }
    function initSettings() {
        if (!Lampa.SettingsApi) return;
        var icon = '<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
            '<rect x="3" y="4" width="18" height="16" rx="3" stroke="currentColor" stroke-width="2"/>' +
            '<circle cx="9" cy="10" r="2" stroke="currentColor" stroke-width="1.5"/>' +
            '<path d="M4 18l6-6 4 4 3-3 4 5" stroke="currentColor" stroke-width="1.5"/></svg>';
        Lampa.SettingsApi.addComponent({ component: 'capsule_artwork', name: 'Capsule Artwork Rescue', icon: icon });
        [
            { param: { name: PREFIX + 'enabled', type: 'trigger', default: true },
                field: { name: 'Дополнительные источники изображений', description: 'Восстановление отсутствующих картинок и названий серий.' } },
            { param: { name: PREFIX + 'quality_mode', type: 'select',
                values: { auto: 'Сбалансированный: сохранять хорошие оригиналы', alternatives: 'Предпочитать альтернативы при явном улучшении', missing: 'Только отсутствующие картинки' },
                default: 'auto' },
                field: { name: 'Качество изображений',
                    description: 'Больше никаких замен поверх уже показанной картинки: улучшения готовятся заранее и применяются при новом открытии.' } },
            { param: { name: PREFIX + 'fanart_key', type: 'input', values: 'string', default: '', placeholder: 'client_key' },
                field: { name: 'Ключ Fanart.tv (необязательно)', description: 'Личный ключ с fanart.tv. Хранится локально в настройках Lampa.' } },
            { param: { name: PREFIX + 'omdb_key', type: 'input', values: 'string', default: '', placeholder: 'API key' },
                field: { name: 'Ключ OMDb (необязательно)', description: 'С ключом OMDb добавляются постеры IMDb.' } },
            { param: { name: PREFIX + 'diagnostics', type: 'button' },
                field: { name: 'Проверить работу плагина',
                    description: 'Версия, режим и счётчики реально проверенных и изменённых изображений.' },
                onChange: function () {
                    var x = stats;
                    var status = 'Artwork Rescue ' + VERSION + ' | ' + qualityMode() +
                        ' | поисков: ' + x.qualityAttempts + ' | подготовлено: ' + x.qualityPrepared +
                        ' | показано: ' + x.verifiedRendered + ' | ошибок: ' + x.replacementErrors +
                        ' | списков серий: ' + x.episodeLists + ' | нет названий: ' + x.missingEpisodeNames +
                        ' | найдено имён: ' + x.namesFilled +
                        ' | уникальных без названий: ' + Object.keys(uniqueEpisodeMissing).length +
                        ' | уникальных исправлено: ' + Object.keys(uniqueEpisodeFound).length +
                        ' | эпизоды TMDB: ' + x.episodeApiCalls +
                        ' | отклонено: ' + x.rejectedTitles +
                        ' | KP→TMDB: ' + x.kpResolved + ' | источники имён: ' + JSON.stringify(x.nameSources) +
                        ' | последний: ' + (x.lastSource || '-');
                    console.log('[Artwork Rescue] diagnostics', status, JSON.stringify(x));
                    if (Lampa.Noty && Lampa.Noty.show) Lampa.Noty.show(status);
                } },
            { param: { name: PREFIX + 'clear', type: 'button' },
                field: { name: 'Очистить кэш обложек', description: 'Удалить сохранённые URL найденных изображений.' },
                onChange: function () { disk = {}; saveDisk(); if (Lampa.Noty) Lampa.Noty.show('Кэш Artwork Rescue очищен'); } },
            { param: { name: PREFIX + 'info', type: 'title' },
                field: { name: 'TVmaze · Cinemeta · Fanart.tv · OMDb · AniList · Tenrai · Wikipedia' } },
            { param: { name: PREFIX + 'privacy', type: 'title' },
                field: { name: 'Поиск отправляет название/ID фильма выбранным API. Без аналитики и внешних скриптов.' } },
            { param: { name: PREFIX + 'credits', type: 'title' },
                field: { name: 'Изображения TVmaze — CC BY-SA · tvmaze.com' } }
        ].forEach(function (x) { x.component = 'capsule_artwork'; Lampa.SettingsApi.addParam(x); });
    }
    function start() {
        if (running || !window.Lampa || !document.body) return;
        running = true;
        loadDisk();
        try { initSettings(); } catch (e) { console.warn('[Artwork Rescue] settings:', e); }
        try { addEpisodeHooks(); } catch (e) { console.warn('[Artwork Rescue] episode hooks:', e); }
        if (Lampa.Listener && Lampa.Listener.follow) Lampa.Listener.follow('full', fullEvent);
        document.addEventListener('load', function (e) {
            var img = e.target;
            if (!img || img.tagName !== 'IMG') return;
            stats.loadedImages++;
            var state = img.__capsuleArtwork;
            if (state && state.pendingVerified &&
                (img.currentSrc || img.src || '') === state.pendingVerified && img.naturalWidth > 0) {
                stats.verifiedRendered++;
                state.pendingVerified = '';
            }
            inspectQuality(img);
        }, true);
        document.addEventListener('error', function (e) {
            var img = e.target;
            if (!relevant(img)) return;
            var state = img.__capsuleArtwork;
            if (state && state.pendingVerified &&
                (img.currentSrc || img.src || '') === state.pendingVerified) {
                stats.replacementErrors++;
                state.pendingVerified = '';
            }
            // Do not cancel Lampa's own handlers, avoid modifying other plugins' logic.
            recover(img, 'error');
        }, true);
        watcher = new MutationObserver(function (records) {
            if (!enabled()) return;
            for (var i = 0; i < records.length; i++) {
                var r = records[i];
                if (r.type === 'attributes') scheduleInspect(r.target);
                else for (var j = 0; j < r.addedNodes.length; j++) scheduleInspect(r.addedNodes[j]);
            }
        });
        watcher.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src'] });
        scheduleInspect(document.body);
        console.log('[Artwork Rescue] ' + VERSION + ' started');
    }
    // Diagnostic API intentionally returns no keys or movie titles.
    window.CapsuleArtworkRescue = {
        version: VERSION,
        stats: function () { return JSON.parse(JSON.stringify(stats)); }
    };
    if (window.CAPSULE_ARTWORK_TEST) {
        window.CapsuleArtworkRescue._test = {
            cleanTitle: cleanTitle, titleSimilarity: titleSimilarity, matchScore: matchScore,
            imageUrl: imageUrl, cacheId: cacheId, tvMaze: tvMaze, cinemeta: cinemeta,
            resolveArtwork: resolveArtwork, contextFor: contextFor, fullEvent: fullEvent,
            inspect: inspect, recover: recover, genericName: genericName,
            hydrateEpisodes: hydrateEpisodes, scheduleEpisodeRefresh: scheduleEpisodeRefresh,
            addEpisodeHooks: addEpisodeHooks, cinemetaCatalog: cinemetaCatalog, galleryFor: galleryFor,
            safeEpisodeMatch: safeEpisodeMatch, titleVote: titleVote,
            epguidesCatalog: epguidesCatalog,
            knownEpisodeName: knownEpisodeName, tmdbFullSize: tmdbFullSize, applyPrepared: applyPrepared,
            tmdbEpisodeStills: tmdbEpisodeStills, episodeTitlesFromTMDB: episodeTitlesFromTMDB,
            highQualityCandidate: highQualityCandidate, inspectQuality: inspectQuality
        };
    }
    if (window.appready) start();
    else if (window.Lampa && Lampa.Listener && Lampa.Listener.follow) {
        Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') start(); });
    } else {
        var count = 0;
        var boot = setInterval(function () {
            if (window.appready && window.Lampa) { clearInterval(boot); start(); }
            if (++count > 80) clearInterval(boot);
        }, 250);
    }
}());