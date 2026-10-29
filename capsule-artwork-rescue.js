/*
 * Capsule Artwork Rescue for Lampa 2.1.0
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
    var VERSION = '2.1.0';
    var CACHE_TTL = 7 * 86400000;
    var CACHE_LIMIT = 220;
    var NETWORK_TIMEOUT = 6500;
    var IMAGE_TIMEOUT = 6000;
    var broken = /(?:^|\/)img_(?:broken|load)\.svg(?:[?#]|$)/i;
    var allowedHosts = /(?:^|\.)(?:image\.tmdb\.org|imagetmdb\.com|static\.tvmaze\.com|assets\.fanart\.tv|fanart\.tv|m\.media-amazon\.com|img\.omdbapi\.com|s4\.anilist\.co|cdn\.myanimelist\.net|upload\.wikimedia\.org|images\.metahub\.space|episodes\.metahub\.space|kinopoiskapiunofficial\.tech|kinopoisk\.ru|st\.kp\.yandex\.net|avatars\.mds\.yandex\.net|image\.kinopoisk\.dev|cdn\.yandex\.net|kinobd\.net|shikimori\.one|shikimori\.io)$/i;
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
        rejectedTitles: 0, matchingByDate: 0, matchingByAgreement: 0, kpResolved: 0,
        externalOnlyChecks: 0, externalOnlyShown: 0, externalOnlyMissing: 0 };
    var episodeData = {}, seasonSnapshots = {}, episodeRefreshTimer = null;
    var episodeTitleLookups = {}, episodeTitleBudget = {}, episodeTitleQueue = [];
    var uniqueEpisodeMissing = {}, uniqueEpisodeFound = {};
    var voteCandidates = {}, tmdbMapping = {};
    var episodeTitleActive = 0;
    var qualityTasks = [], qualityActive = 0, qualityRecent = {}, qualityWinners = {};
    var QUALITY_MAX_ACTIVE = 2, QUALITY_MAX_QUEUED = 28;
    var QUALITY_LIMITS = { poster: 700, still: 700, backdrop: 1250 };
    var russianServiceStats = {poiskkino:{ok:0, fail:0}, kpu:{ok:0, fail:0}};
    var kpIdentityCache = {};
    var kinobdUsage = [], kinobdStats = {requests:0, successes:0, noResponse:0,
        noMatch:0, artwork:0, rejected:0};
    var observedKP = {};

    function enabled() {
        if (!window.Lampa || !Lampa.Storage) return true;
        var v = Lampa.Storage.get(PREFIX + 'enabled', 'true');
        return v !== false && v !== 'false';
    }
    function qualityMode() {
        var v = setting('quality_mode');
        return v === 'missing' || v === 'alternatives' || v === 'auto' || v === 'only_alternatives' ? v : 'auto';
    }
    function onlyAlternatives() { return enabled() && qualityMode() === 'only_alternatives'; }
    function sourcePack() {
        var preferred = setting('source_pack');
        if (preferred === 'global') return 'global';
        // Legacy 'russian' should not require keys silently on update.
        if (preferred === 'russian' && (ruKey('kpu_key') || ruKey('poiskkino_key'))) return 'russian';
        return 'free';
    }
    function ruKey(name) {
        var value=setting(name);
        // Never include keys in URLs, caches, console, or exported diagnostics.
        return /^[a-zA-Z0-9._-]{8,256}$/.test(value) ? value : '';
    }
    function independentArtwork(url) {
        var valid = imageUrl(url);
        if (!valid || /(?:image\.tmdb\.org|imagetmdb\.com|themoviedb\.org)/i.test(valid)) return '';
        return valid;
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
    function queueRequest(url, body, authorization) {
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
                    xhr.timeout = authorization ? 4500 : NETWORK_TIMEOUT;
                    if (body) xhr.setRequestHeader('Content-Type', 'application/json');
                    // Only send the user's private token to the exact service,
                    // not a proxy, redirect chosen by us or a search result.
                    var provider = authorization && authorization.provider;
                    if (authorization && authorization.key) {
                        var allowed = provider === 'poiskkino' ?
                            /^https:\/\/api\.poiskkino\.dev\/v1\.5\//.test(url) :
                            provider === 'kpu' ?
                            /^https:\/\/kinopoiskapiunofficial\.tech\/api\//.test(url) : false;
                        if (!allowed) return finish(null);
                        xhr.setRequestHeader('X-API-KEY', authorization.key);
                    }
                    xhr.onreadystatechange = function () {
                        if (xhr.readyState !== 4) return;
                        if (xhr.status >= 200 && xhr.status < 300) {
                            try {
                                if (provider && russianServiceStats[provider]) russianServiceStats[provider].ok++;
                                finish(JSON.parse(xhr.responseText));
                            } catch (_) { finish(null); }
                        } else {
                            if (provider && russianServiceStats[provider]) russianServiceStats[provider].fail++;
                            finish(null);
                        }
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

    function tmdbJson(route, language) {
        var client = Lampa.TMDB;
        if (!client || typeof client.api !== 'function' || typeof client.key !== 'function') return Promise.resolve(null);
        try {
            var url = route + (route.indexOf('?') < 0 ? '?' : '&') + 'api_key=' +
                encodeURIComponent(client.key()) + '&language=' + encodeURIComponent(language || 'ru-RU');
            return queueRequest(client.api(url));
        } catch (_) { return Promise.resolve(null); }
    }
    function resolveTmdbIdentity(movie) {
        if (!movie || !names(movie).length) return Promise.resolve(null);
        if ((!movie.source || movie.source === 'tmdb') && /^\d+$/.test(String(movie.id || ''))) {
            return Promise.resolve({id:Number(movie.id), source:'tmdb', type:isTv(movie)?'tv':'movie',
                name:movie.name, original_name:movie.original_name, title:movie.title,
                original_title:movie.original_title, first_air_date:movie.first_air_date,
                release_date:movie.release_date, year:movie.year, imdb_id:movie.imdb_id,
                images:movie.images});
        }
        // KP IDs look like KP_1234: these are NOT TMDB IDs.
        if (!/^(KP|kinopoisk)$/i.test(String(movie.source || ''))) return Promise.resolve(null);
        var fingerprint = cacheId(movie,'identity');
        if (tmdbMapping[fingerprint]) return Promise.resolve(tmdbMapping[fingerprint]);
        return once('identity:'+fingerprint, function () {
            var wantedTV = isTv(movie), imdb = String(movie.imdb_id || '');
            function verify(candidates, byId) {
                candidates = (Array.isArray(candidates)?candidates:[]).filter(function (c) {
                    if (!/^\d+$/.test(String(c.id || ''))) return false;
                    if (byId) return true; // IMDb lookup confirms exact identity.
                    var year = filmYear(movie), otherYear = filmYear(c);
                    var n = names(movie);
                    return year && otherYear && year === otherYear &&
                        n.some(function (v) { return names(c).indexOf(v) >= 0; });
                });
                if (candidates.length !== 1) return null; // Ambiguous => leave original
                var result = Object.assign({}, candidates[0], {
                    source:'tmdb', type:wantedTV ? 'tv' : 'movie', imdb_id:imdb || '',
                    __capsuleMappedFrom:'KP'
                });
                tmdbMapping[fingerprint] = result;
                stats.kpResolved++;
                return result;
            }
            if (/^tt\d{6,10}$/.test(imdb)) {
                return tmdbJson('find/'+encodeURIComponent(imdb)+'?external_source=imdb_id').then(function (json) {
                    var found = verify(json && json[wantedTV ? 'tv_results':'movie_results'],true);
                    return found || null; // Never fall through to fuzzy text if IMDb ID was supplied.
                });
            }
            var title = filmTitle(movie), year=filmYear(movie);
            if (!title || !year || title.length<2 || title.length>100) return Promise.resolve(null);
            var route='search/'+(wantedTV ? 'tv':'movie')+'?query='+encodeURIComponent(title)+
                (wantedTV?'&first_air_date_year=':'&primary_release_year=')+year;
            return tmdbJson(route).then(function (json) {
                return verify(json && json.results,false);
            });
        }).catch(function () { return null; });
    }
    function mappedTmdbArtwork(movie, kind) {
        return resolveTmdbIdentity(movie).then(function (resolved) {
            if (!resolved) return [];
            var path=kind === 'poster'?resolved.poster_path:resolved.backdrop_path;
            if (!/^\/[a-zA-Z0-9_./-]+\.(?:jpe?g|png|webp)$/i.test(String(path||''))) return [];
            return firstUrls(['https://image.tmdb.org/t/p/'+(kind === 'poster'?'w780':'w1280')+path]);
        });
    }

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

    function targetEpisode(movie, ep) {
        var sn=Number(ep && ep.season), num=Number(ep && ep.number);
        if (!sn || !num) return null;
        var lists=[];
        var snap=seasonSnapshots[cacheId(movie,'show')];
        if (snap && Number(snap.season) === sn) lists.push(snap.list);
        if (currentFull && String(currentFull.movie.id) === String(movie.id) &&
            currentFull.movie.source === movie.source && currentFull.episodes) {
            lists.push(currentFull.episodes.episodes);
        }
        for (var i=0;i<lists.length;i++) {
            if (!Array.isArray(lists[i])) continue;
            var item=lists[i].find(function (e) {
                return episodeSeason(e,sn) === sn && episodeNumber(e) === num;
            });
            if (item) return item;
        }
        return null;
    }
    function exactCatalogStill(movie, ep, catalog) {
        if (!ep || !ep.season || !ep.number) return Promise.resolve([]);
        var expected=targetEpisode(movie,ep);
        // If there is no native episode record, numeric equality alone is too
        // weak to claim a still belongs to the right regional broadcast.
        if (!expected) return Promise.resolve([]);
        var lookup = catalog === 'TVmaze' ? tvMazeCatalog(movie) : cinemetaCatalog(movie);
        return lookup.then(function (entries) {
            var found=(entries||[]).find(function (e) {
                return episodeNumber(e) === Number(ep.number) &&
                    episodeSeason(e,ep.season) === Number(ep.season);
            });
            if (!safeEpisodeMatch(movie,expected,found,catalog)) return [];
            var image=found.image || {};
            return firstUrls([image.original,image.medium]);
        }).catch(function () { return []; });
    }


    // Russian-first providers:
    // (1) KPU for localized episode names; (2) PoiskKino for episode-specific
    // stills; (3) PoiskKino/KPU film poster and backdrop images.
    // Both require the user's own token; there is no hard-coded shared key.

    // KinoBD's documented public read-only API exposes search, film details
    // and film image galleries. No account or API key is required.
    // Its image gallery is film-level: NEVER infer a TV episode still from it.
    // The search query parameter and exact JSON shape are not documented in
    // the publicly indexed summary, so accept only validated IDs/title+year.
    function kbArray(value) {
        if (Array.isArray(value)) return value;
        if (!value || typeof value !== 'object') return [];
        if (Array.isArray(value.data)) return value.data;
        if (Array.isArray(value.items)) return value.items;
        if (Array.isArray(value.results)) return value.results;
        if (Array.isArray(value.films)) return value.films;
        if (value.data && typeof value.data === 'object') return kbArray(value.data);
        return [];
    }
    function kbObject(value) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
        if (value.data && !Array.isArray(value.data) && typeof value.data === 'object') return value.data;
        if (value.film && typeof value.film === 'object') return value.film;
        return value;
    }
    function kbRequest(route) {
        if (kinobdUsage.length > 100) kinobdUsage = [];
        var now = Date.now();
        kinobdUsage = kinobdUsage.filter(function (t) { return now - t < 60000; });
        // Leave headroom below the advertised 60/min/IP anonymous limit.
        if (kinobdUsage.length >= 18) return Promise.resolve(null);
        kinobdUsage.push(now);
        kinobdStats.requests++;
        return queueRequest('https://kinobd.net/api/' + route).then(function (data) {
            if (data && typeof data === 'object') kinobdStats.successes++;
            else kinobdStats.noResponse++;
            return data;
        }).catch(function () {
            kinobdStats.noResponse++;
            return null;
        });
    }
    function kbCandidate(movie, candidate) {
        if (!candidate || typeof candidate !== 'object') return false;
        var id = Number(candidate.id);
        if (!Number.isInteger(id) || id < 1) return false;
        var tv = isTv(movie), type = cleanTitle(candidate.type || candidate.media_type || '');
        if (type && (tv ? /^(movie|film)$/.test(type) : /^(tv|series|serial|show)$/.test(type)))
            return false;
        var imdb = String(movie.imdb_id || '');
        var imdbFound = String(candidate.imdb_id || candidate.imdbId || '');
        if (/^tt\d{6,10}$/.test(imdb) && /^tt\d{6,10}$/.test(imdbFound) && imdb !== imdbFound) return false;
        var kp = knownKinopoiskId(movie), kpFound = Number(candidate.kinopoisk_id || candidate.kinopoiskId || 0);
        if (kp && kpFound && kp !== kpFound) return false;
        var tmdb = (movie.source === 'tmdb' || !movie.source) ? Number(movie.id) : 0;
        var tmdbFound = Number(candidate.tmdb_id || candidate.tmdbId || 0);
        if (tmdb && tmdbFound && tmdb !== tmdbFound) return false;
        var exactIdentifier =
            kp && kpFound === kp ||
            tmdb && tmdbFound === tmdb ||
            /^tt\d{6,10}$/.test(imdb) && imdb === imdbFound;
        if (exactIdentifier) return true;
        var year = filmYear(movie);
        var otherYear = filmYear({year:candidate.year || candidate.release_year ||
            candidate.release_date || candidate.first_air_date || candidate.premiered});
        // Never use a search result without a verified identity or year/title.
        if (!year || !otherYear || year !== otherYear) return false;
        return matchScore(movie, [
            candidate.name, candidate.title, candidate.name_ru, candidate.nameRu,
            candidate.original_title, candidate.original_name, candidate.title_en
        ], otherYear) >= 0.97;
    }
    function kbFind(movie) {
        if (!movie || !names(movie).length) return Promise.resolve(null);
        var id = cacheId(movie, 'kinobd-film');
        return once('kinobd:film:' + id, function () {
            var title = textValue(movie.name || movie.title || movie.original_name || movie.original_title);
            if (!title || title.length > 100 || !filmYear(movie)) return Promise.resolve(null);
            var route = 'films/search/' + (isTv(movie) ? 'series' : 'movie');
            var queries = ['query=', 'q='];
            function search(i) {
                if (i >= queries.length) return Promise.resolve(null);
                return kbRequest(route + '?' + queries[i] + encodeURIComponent(title)).then(function (result) {
                    if (!result) return search(i + 1);
                    var candidates = kbArray(result).filter(function (c) { return kbCandidate(movie, c); });
                    if (candidates.length !== 1) {
                        if (!candidates.length) return search(i + 1);
                        kinobdStats.rejected++;
                        return null;
                    }
                    var found = candidates[0];
                    return kbRequest('films/' + Number(found.id)).then(function (detail) {
                        var resolved = kbObject(detail);
                        if (!resolved || !kbCandidate(movie, resolved)) {
                            kinobdStats.rejected++;
                            return null;
                        }
                        return resolved;
                    });
                });
            }
            return search(0).then(function (found) {
                if (!found) kinobdStats.noMatch++;
                return found;
            });
        }).catch(function () { return null; });
    }
    function kbImageURL(value) {
        var val = typeof value === 'string' ? value :
            (value && (value.url || value.src || value.original || value.image_url || value.path));
        if (typeof val !== 'string' || val.length > 1400) return '';
        // Relative paths can only resolve against the KinoBD origin.
        if (val.charAt(0) === '/' && val.charAt(1) !== '/') val = 'https://kinobd.net' + val;
        return independentArtwork(val);
    }
    function kbGalleryImages(gallery, kind) {
        var data = kbObject(gallery) || {};
        var key = kind === 'poster' ? 'posters' : 'backdrops';
        var items = [];
        [data[key], data.images && data.images[key], data.images].forEach(function (part) {
            if (!Array.isArray(part)) return;
            part.forEach(function (item) {
                if (Array.isArray(data.images) && part === data.images) {
                    var type = cleanTitle(item && (item.type || item.category || item.kind) || '');
                    if (kind === 'poster' && type !== 'poster') return;
                    if (kind === 'backdrop' && !/^(backdrop|background)$/.test(type)) return;
                }
                items.push(item);
            });
        });
        return firstUrls(items.map(kbImageURL));
    }
    function kinoBdArtwork(movie, kind) {
        if (kind === 'still') return Promise.resolve([]); // No verified S/E binding.
        return kbFind(movie).then(function (film) {
            if (!film) return [];
            var urls = [];
            if (kind === 'poster') {
                urls = [film.poster, film.poster_url, film.posterUrl];
            } else {
                urls = [film.backdrop, film.backdrop_url, film.backdropUrl, film.background];
            }
            var initial = firstUrls(urls.map(kbImageURL));
            return once('kinobd:gallery:' + film.id, function () {
                return kbRequest('films/' + Number(film.id) + '/images');
            }).then(function (gallery) {
                var result = firstUrls(kbGalleryImages(gallery, kind).concat(initial));
                if (result.length) kinobdStats.artwork++;
                return result;
            });
        }).catch(function () { return []; });
    }
    // Re-use titles/stills already seen in a KP source response. No additional
    // request, account or hidden key. Never turn a show background into a still.
    function kpAlias(movie) {
        if (!movie) return '';
        var imdb = String(movie.imdb_id || '');
        if (/^tt\d{6,10}$/.test(imdb)) return 'imdb:' + imdb;
        var id = knownKinopoiskId(movie);
        if (id) return 'kp:' + id;
        var title = cleanTitle(movie.original_name || movie.name || movie.original_title || movie.title);
        return title && filmYear(movie) ? 'name:' + title + ':' + filmYear(movie) : '';
    }
    function captureKP(movie, list, season) {
        var source = String(movie && movie.source || '').toLowerCase();
        if (source !== 'kp' && source !== 'kinopoisk' || !Array.isArray(list)) return;
        var alias = kpAlias(movie);
        if (!alias) return;
        var entries = observedKP[alias] || (observedKP[alias] = {});
        list.forEach(function (ep) {
            var num = episodeNumber(ep), sn = episodeSeason(ep, season);
            if (!num || !sn) return;
            var name = goodEpisodeName(ep.name) ? ep.name : '';
            var image = kbImageURL(ep.img) || kbImageURL(ep.still) || '';
            if (!name && !image) return;
            entries[sn + ':' + num] = {
                name:name, image:image, date:episodeAir(ep),
                imdb:movie.imdb_id || '', year:filmYear(movie)
            };
        });
        if (Object.keys(observedKP).length > 40) observedKP = {};
    }
    function reusedKPEpisode(movie, target, season) {
        var alias = kpAlias(movie), sn = episodeSeason(target,season), num = episodeNumber(target);
        var observed = alias && observedKP[alias] && observedKP[alias][sn + ':' + num];
        if (!observed) return null;
        var expected = episodeAir(target);
        if (expected != null && observed.date != null && Math.abs(expected - observed.date) > 2) return null;
        if (alias.indexOf('name:') === 0 && (expected == null || observed.date == null)) return null;
        return observed;
    }

    function knownKinopoiskId(movie) {
        var options=[movie.kinopoisk_id,movie.kinopoiskId,movie.kp_id,
            movie.external_ids && movie.external_ids.kinopoisk_id];
        var source=String(movie.source || '');
        if (/^(KP|kinopoisk)$/i.test(source)) {
            options.push(String(movie.id || '').replace(/^KP_/i,''));
        }
        for (var i=0;i<options.length;i++) {
            var x=String(options[i]||'');
            if (/^[1-9]\d{0,9}$/.test(x)) return Number(x);
        }
        return 0;
    }
    function poiskRequest(route) {
        var key=ruKey('poiskkino_key');
        if (!key) return Promise.resolve(null);
        return queueRequest('https://api.poiskkino.dev/v1.5/'+route,null,{provider:'poiskkino',key:key});
    }
    function kpuRequest(route) {
        var key=ruKey('kpu_key');
        if (!key) return Promise.resolve(null);
        return queueRequest('https://kinopoiskapiunofficial.tech/api/'+route,null,{provider:'kpu',key:key});
    }
    function validateKpCandidate(movie, candidate) {
        if (!candidate || typeof candidate !== 'object') return false;
        var im=String(movie.imdb_id || ''),
            foundIm=String(candidate.imdbId || candidate.imdbID || candidate.externalId && candidate.externalId.imdb || '');
        if (/^tt\d{6,10}$/.test(im) && /^tt\d{6,10}$/.test(foundIm) && im !== foundIm) return false;
        var year=filmYear(movie), other=filmYear(candidate),
            sameYear=!year || !other || Math.abs(year-other) <= 1;
        var titles=[candidate.name,candidate.nameRu,candidate.nameEn,candidate.alternativeName,candidate.enName];
        return sameYear && matchScore(movie,titles,year && !other ? year : other) >= 0.97;
    }
    function uniqueKpCandidate(movie, items) {
        var good=(Array.isArray(items)?items:[]).filter(function (v) {
            var id=Number(v.id || v.kinopoiskId || v.filmId || 0);
            return id > 0 && validateKpCandidate(movie,v);
        });
        return good.length === 1 ? Number(good[0].id || good[0].kinopoiskId || good[0].filmId) : 0;
    }
    function findKpId(movie, provider) {
        if (!movie) return Promise.resolve(0);
        var direct=knownKinopoiskId(movie);
        if (direct) return Promise.resolve(direct);
        var idKey=cacheId(movie, 'russian-id') + ':' + provider;
        if (kpIdentityCache[idKey]) return Promise.resolve(kpIdentityCache[idKey]);
        var name=textValue(movie.name || movie.title || movie.original_name || movie.original_title);
        if (!name || name.length > 100 || !filmYear(movie)) return Promise.resolve(0);
        return once('kp-id:'+idKey,function () {
            if (provider === 'poiskkino') {
                return poiskRequest('movie/search?query='+encodeURIComponent(name)+'&limit=8')
                    .then(function (res) { return uniqueKpCandidate(movie, res && (res.docs || res.results)); });
            }
            return kpuRequest('v2.1/films/search-by-keyword?keyword='+encodeURIComponent(name)+'&page=1')
                .then(function (res) { return uniqueKpCandidate(movie,res && res.films); });
        }).then(function (id) {
            if (id) kpIdentityCache[idKey]=id;
            return id || 0;
        }).catch(function () {return 0;});
    }
    function poiskMovie(movie) {
        return findKpId(movie,'poiskkino').then(function (id) {
            if (!id) return null;
            return once('poisk-movie:'+id,function () {
                return poiskRequest('movie/'+id);
            }).then(function (v) {
                if (!v || Number(v.id) !== id) return null;
                // Direct KP id is already identity-verified; text search must
                // be independently verified before any field is accepted.
                if (!knownKinopoiskId(movie) && !validateKpCandidate(movie,v)) return null;
                return v;
            });
        }).catch(function () {return null;});
    }
    function kpuMovie(movie) {
        return findKpId(movie,'kpu').then(function (id) {
            if (!id) return null;
            return once('kpu-movie:'+id,function () { return kpuRequest('v2.2/films/'+id); })
                .then(function (v) {return v && Number(v.kinopoiskId) === id ? v : null;});
        }).catch(function () {return null;});
    }
    function russianPosters(movie, kind) {
        if (kind === 'still') return Promise.resolve([]);
        return poiskMovie(movie).then(function (v) {
            var pic=v && (kind === 'poster' ? v.poster : v.backdrop);
            return firstUrls([pic && pic.url, pic && pic.previewUrl]);
        });
    }
    function unofficialPosters(movie, kind) {
        if (kind === 'still') return Promise.resolve([]);
        return kpuMovie(movie).then(function (v) {
            return firstUrls(kind === 'poster' ?
                [v && v.posterUrl, v && v.posterUrlPreview] :
                [v && v.coverUrl]);
        });
    }
    function poiskSeason(movie, season) {
        if (!isTv(movie) || !ruKey('poiskkino_key')) return Promise.resolve([]);
        return findKpId(movie,'poiskkino').then(function (id) {
            if (!id) return [];
            return once('poisk-season:'+id+':'+season,function () {
                return poiskRequest('season?movieId='+id+'&number='+Number(season)+'&limit=5');
            }).then(function (data) {
                var docs=data && data.docs;
                if (!Array.isArray(docs)) return [];
                var matches=docs.filter(function (v) {
                    return Number(v.movieId)===id && Number(v.number)===Number(season);
                });
                if (matches.length!==1 || !Array.isArray(matches[0].episodes)) return [];
                return matches[0].episodes.map(function (e) {
                    var frame=e.still;
                    return {season_number:Number(season),episode_number:Number(e.number),
                        name:textValue(e.name || e.enName),air_date:e.airDate || e.date || '',
                        __capsuleTrustedIdentity:'kp',
                        image:frame && frame.url ? {original:frame.url,medium:frame.previewUrl} : null};
                });
            });
        }).catch(function () {return [];});
    }
    function kpuSeason(movie, season) {
        if (!isTv(movie) || !ruKey('kpu_key')) return Promise.resolve([]);
        return findKpId(movie,'kpu').then(function (id) {
            if (!id) return [];
            return once('kpu-season:'+id,function () {
                return kpuRequest('v2.2/films/'+id+'/seasons');
            }).then(function (data) {
                var items=data && data.items;
                if (!Array.isArray(items)) return [];
                var match=items.filter(function (v) {return Number(v.number)===Number(season);});
                if (match.length!==1 || !Array.isArray(match[0].episodes)) return [];
                return match[0].episodes.map(function (e) {
                    return {season_number:Number(season),episode_number:Number(e.episodeNumber),
                        name:textValue(e.nameRu || e.nameEn),air_date:e.releaseDate || '',
                        __capsuleTrustedIdentity:'kp',image:null};
                });
            });
        }).catch(function () {return [];});
    }
    function poiskEpisodeImage(movie, ep) {
        if (!ep || !ep.season || !ep.number) return Promise.resolve([]);
        return poiskSeason(movie,ep.season).then(function (items) {
            var target=targetEpisode(movie,ep);
            if (!target) return [];
            var found=items.find(function (v) {return episodeNumber(v)===Number(ep.number);});
            if (!safeEpisodeMatch(movie,target,found,'ПоискКино')) return [];
            return firstUrls([found.image && found.image.original,found.image && found.image.medium]);
        });
    }

    function providers(m, kind, ep) {
        var steps = [];
        if (kind === 'still') {
            if (sourcePack() === 'russian' || sourcePack() === 'global')
                steps.push({name:'ПоискКино: кадр серии',call:function(){return poiskEpisodeImage(m,ep);}});
        } else {
            // Anonymous no-key Russian-first poster catalog.
            steps.push({name:'KinoBD: постер/фон',call:function(){return kinoBdArtwork(m,kind);}});
            if (sourcePack() !== 'free') {
                steps.push({name:'ПоискКино: постер',call:function(){return russianPosters(m,kind);}});
                steps.push({name:'КП Unofficial: постер',call:function(){return unofficialPosters(m,kind);}});
            }
        }
        // The old catalog pack remains optional. It is slow or blocked on
        // some Russian connections and must not block all card loading.
        if (sourcePack() === 'russian' || sourcePack() === 'free') return steps;
        if (kind !== 'still') steps.push({ name: 'TMDB mirror', call: function () { return Promise.resolve(tmdbAlternates(m, kind)); } });
        if (kind !== 'still' && /^(KP|kinopoisk)$/i.test(String(m.source || ''))) {
            // KP uses 'KP_12345' IDs, not TMDB IDs. Resolve by verified
            // identity early; otherwise a long Wikipedia lookup blocks rescue.
            steps.push({ name: 'KP matched image', call: function () { return mappedTmdbArtwork(m,kind); } });
        }
        if (kind === 'still') {
            steps.push({ name: 'TVmaze', call: function () { return exactCatalogStill(m, ep, 'TVmaze'); } });
            steps.push({ name: 'Cinemeta', call: function () { return exactCatalogStill(m, ep, 'Cinemeta'); } });
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
            if (/^(KP|kinopoisk)$/i.test(String(m.source || ''))) {
                steps.push({ name: 'KP mapped TMDB gallery', call: function () { return galleryFor(m,kind); } });
            }
        }
        return steps;
    }
    function resolveArtwork(m, kind, ep, blockedUrls) {
        var exclusive = onlyAlternatives();
        // Separate cache prevents reuse of images obtained from TMDB mirrors.
        var id = cacheId(m, kind, ep) + (exclusive ? ':only-external' : '');
        var ignore = blockedUrls || {};
        var cached = disk[id];
        var steps = providers(m, kind, ep);
        if (exclusive) {
            steps = steps.filter(function (step) {
                return !/^(?:TMDB|KP matched|KP mapped)/i.test(step.name);
            });
        }
        if (kind === 'still' && ep) {
            var known = episodeData[episodeKey(m, ep.season, ep.number)];
            if (known && known.url && (!exclusive || independentArtwork(known.url)))
                steps.unshift({name: 'episode metadata', call: function () { return Promise.resolve([known.url]); }});
        }
        if (cached && cached.expires > Date.now() &&
            (exclusive ? independentArtwork(cached.url) : imageUrl(cached.url))) {
            steps.unshift({ name: 'cache', call: function () { return Promise.resolve([cached.url]); } });
        }
        function next(i) {
            if (i >= steps.length) return Promise.resolve(null);
            var step = steps[i];
            return Promise.resolve().then(step.call).catch(function () { return []; }).then(function (urls) {
                urls = exclusive ? firstUrls(urls).filter(independentArtwork) : firstUrls(urls);
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
        if (!Number.isInteger(Number(season)) || !Number.isInteger(Number(number)) ||
            Number(season) < 1 || Number(number) < 1) return Promise.resolve(null);
        return resolveTmdbIdentity(movie).then(function (mapped) {
            if (!mapped || !isTv(mapped)) return null;
            var route='tv/'+mapped.id+'/season/'+Number(season)+'/episode/'+Number(number)+'/'+suffix;
            return once('episode:exact:'+route,function () {
                stats.episodeApiCalls++;
                return tmdbJson(route);
            });
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
        if (source === 'TMDB English' || source === 'TMDB translations' ||
            (confidence === 'kp' && (source === 'КП: названия' || source === 'ПоискКино'))) return title;
        var votes = voteCandidates[key] || (voteCandidates[key] = {});
        var clean = cleanTitle(title);
        var v = votes[clean] || (votes[clean] = {title: title, sources: {}});
        // Epguides stills are sourced from TVmaze; counting both as
        // independent confirmations would manufacture false consensus.
        var family = source === 'Epguides' ? 'TVmaze' : source;
        v.sources[family] = true;
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
        if (found.__capsuleTrustedIdentity === 'imdb' || found.__capsuleTrustedIdentity === 'kp') return true;
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
        return resolveTmdbIdentity(movie).then(function (mapped) {
            if (!mapped || !isTv(mapped)) return [];
            return once('episode:english:'+mapped.id+':'+season,function () {
                return tmdbJson('tv/'+mapped.id+'/season/'+Number(season),'en-US');
            }).then(function (data) {
                return data && Array.isArray(data.episodes) ? data.episodes : [];
            });
        }).catch(function () { return []; });
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
        // Already obtained KP source metadata has priority when strictly
        // compatible. Names are copied without fetching new APIs.
        needed.forEach(function (e) {
            var old = reusedKPEpisode(movie,e,hint);
            if (!old) return;
            var k = episodeKey(movie, episodeSeason(e,hint), episodeNumber(e));
            var detail = episodeData[k] || (episodeData[k] = {});
            if (genericName(e.name) && goodEpisodeName(old.name)) {
                e.name = e.title = detail.name = old.name;
                stats.namesFilled++; stats.nameSources['KP cached'] =
                    (stats.nameSources['KP cached'] || 0) + 1;
                uniqueEpisodeFound[k] = 'KP cached';
            }
            if (!e.still_path && !e.img && old.image && independentArtwork(old.image)) {
                e.img = old.image; detail.url = old.image; stats.episodeStills++;
            }
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
                    var certainty = found.__capsuleTrustedIdentity === 'kp' ? 'kp' :
                        (episodeAir(e) != null && episodeAir(found) != null ? 'date' : 'imdb');
                    var confirmed = titleVote(movie, e, kind, found.name, certainty);
                    if (confirmed) {
                        e.name = e.title = detail.name = confirmed;
                        stats.namesFilled++;
                        uniqueEpisodeFound[key] = kind;
                        stats.nameSources[kind] = (stats.nameSources[kind] || 0) + 1;
                        changed = true;
                    }
                }
                var link = (kind === 'TVmaze' || kind === 'Cinemeta' || kind === 'Epguides' ||
                    kind === 'ПоискКино') && found.image ?
                    imageUrl(found.image.original || found.image.medium) : '';
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
            if (sourcePack() === 'global' && needed.some(function (e) { return episodeSeason(e, hint) === Number(sn) && genericName(e.name); }))
                tmdbEnglish(movie, Number(sn)).then(function (episodes) { merge(episodes, 'TMDB English'); });
        });
        var seasonIds=Object.keys(seasons);
        if (sourcePack() !== 'free') seasonIds.forEach(function (season) {
            kpuSeason(movie,Number(season)).then(function (items) {merge(items,'КП: названия');});
            poiskSeason(movie,Number(season)).then(function (items) {merge(items,'ПоискКино');});
        });
        if (sourcePack() === 'global') {
            tvMazeCatalog(movie).then(function (episodes) { merge(episodes, 'TVmaze'); });
            cinemetaCatalog(movie).then(function (episodes) { merge(episodes, 'Cinemeta'); });
        }
        // Only one request per show/season. Never block the native page.
        var seasonKeys = Object.keys(seasons);
        if (seasonKeys.length && sourcePack() === 'global') {
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
    function safeEpisodeHydrate(movie, list, season) {
        try { hydrateEpisodes(movie, list, season); }
        catch (e) { console.warn('[Artwork Rescue] nonfatal episode metadata:', e); }
    }
    function kpIntegrationState() {
        var sources = Lampa.Api && Lampa.Api.sources || {};
        var params = Lampa.Params && Lampa.Params.values && Lampa.Params.values.source || {};
        return {
            registered: Boolean(sources.KP || sources.kinopoisk),
            selectable: Boolean(params.KP || params.kinopoisk),
            mapped: stats.kpResolved
        };
    }
    function addEpisodeHooks() {
        if (!Lampa.Api || Lampa.Api.__capsuleArtEpisodes) return;
        Lampa.Api.__capsuleArtEpisodes = true;
        var seasons = Lampa.Api.seasons, full = Lampa.Api.full;
        if (typeof seasons === 'function') Lampa.Api.seasons = function (movie, nums, callback) {
            var context = this;
            return seasons.call(context, movie, nums, function (result) {
                var source = String(movie && movie.source || 'tmdb').toLowerCase();
                function hydrateSafely() {
                    try {
                        if (!movie || !result || !Array.isArray(nums)) return;
                        if (source !== 'tmdb' && source !== 'kp' && source !== 'kinopoisk') return;
                        nums.forEach(function (sn) {
                            var data = result[sn];
                            if (!data || !Array.isArray(data.episodes)) return;
                            captureKP(movie, data.episodes, sn);
                            rememberEpisodes(movie, sn, data.episodes);
                            safeEpisodeHydrate(movie, data.episodes, sn);
                        });
                        scheduleEpisodeRefresh();
                    } catch (e) { console.warn('[Artwork Rescue] season hook nonfatal:', e); }
                }
                // Native TMDB can be enriched before rendering; preserve KP's
                // callback ordering to avoid altering registration/search logic.
                if (source === 'tmdb') hydrateSafely();
                try { if (typeof callback === 'function') callback(result); }
                finally {
                    if (source !== 'tmdb') setTimeout(hydrateSafely, 0);
                    else try { scheduleEpisodeRefresh(); } catch (_) {}
                }
            });
        };
        if (typeof full === 'function') Lampa.Api.full = function (params, callback, error) {
            var context = this;
            return full.call(context, params, function (data) {
                var source = String(data && data.movie && data.movie.source || 'tmdb').toLowerCase();
                function hydrateSafely() {
                    try {
                        if (!data || !data.movie || !data.episodes ||
                            !Array.isArray(data.episodes.episodes)) return;
                        if (source !== 'tmdb' && source !== 'kp' && source !== 'kinopoisk') return;
                        captureKP(data.movie, data.episodes.episodes, data.episodes.season_number);
                        rememberEpisodes(data.movie, data.episodes.season_number, data.episodes.episodes);
                        safeEpisodeHydrate(data.movie, data.episodes.episodes, data.episodes.season_number);
                        scheduleEpisodeRefresh();
                    } catch (e) { console.warn('[Artwork Rescue] full hook nonfatal:', e); }
                }
                if (source === 'tmdb') hydrateSafely();
                try { if (typeof callback === 'function') callback(data); }
                finally { if (source !== 'tmdb') setTimeout(hydrateSafely, 0); }
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
        return resolveTmdbIdentity(movie).then(function (mapped) {
            if (!mapped) return [];
            var key=(isTv(mapped)?'tv:':'movie:')+mapped.id+':'+kind;
            return once('gallery:'+key,function () {
                if (mapped.images && (mapped.images.posters || mapped.images.backdrops)) return Promise.resolve(mapped.images);
                var route=(isTv(mapped)?'tv/':'movie/')+mapped.id+
                    '/images?include_image_language=ru,en,null';
                return tmdbJson(route);
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
        if (!enabled() || qualityMode() === 'missing' || onlyAlternatives() || !relevant(img) || !img.isConnected) return false;
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
        if (!enabled() || qualityMode() === 'missing' || onlyAlternatives() || !relevant(img) || !img.isConnected) return;
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

    // The image-only gate hides native artwork from first render. The metadata
    // pipeline (including TMDB IDs and translations) is deliberately unchanged.
    var EXTERNAL_CLASS = 'capsule-artwork-external-only';
    var EXTERNAL_VISIBLE = 'data-capsule-external-visible';
    function syncExternalMode() {
        if (!document.body) return;
        if (!document.getElementById || !document.getElementById('capsule-artwork-exclusive-css')) {
            var style = document.createElement && document.createElement('style');
            if (style) {
                style.id = 'capsule-artwork-exclusive-css';
                var q = 'body.' + EXTERNAL_CLASS + ' ';
                var selectors = [
                    '.card img.card__img', 'img.full--poster', 'img.full-start__background',
                    '.full-episode__img img', '.season-episode__img img'
                ];
                style.textContent = selectors.map(function (v) {
                    return q + v + ':not([' + EXTERNAL_VISIBLE + '="1"])';
                }).join(',') + '{opacity:0!important;}' +
                    q + 'img[src*="image.tmdb.org"],' + q + 'img[src*="imagetmdb.com"]' +
                    '{opacity:0!important;}';
                (document.head || document.body).appendChild(style);
            }
        }
        if (document.body.classList) document.body.classList.toggle(EXTERNAL_CLASS, onlyAlternatives());
    }
    function showExternalAfterLoad(img) {
        if (!onlyAlternatives() || !relevant(img)) return;
        var state = img.__capsuleArtwork, src = img.currentSrc || img.getAttribute('src') || '';
        if (state && state.externalUrl === src && independentArtwork(src) && img.naturalWidth > 0) {
            if (img.getAttribute(EXTERNAL_VISIBLE) !== '1') {
                img.setAttribute(EXTERNAL_VISIBLE, '1');
                stats.externalOnlyShown++;
            }
        } else {
            img.removeAttribute(EXTERNAL_VISIBLE);
            inspectExternalOnly(img);
        }
    }
    function inspectExternalOnly(img) {
        if (!onlyAlternatives() || !relevant(img) || !img.isConnected) return;
        var context = contextFor(img);
        var state = img.__capsuleArtwork || (img.__capsuleArtwork = {});
        var src = img.getAttribute('src') || '';
        if (img.getAttribute(EXTERNAL_VISIBLE) === '1' &&
            (!independentArtwork(src) || src !== state.externalUrl))
            img.removeAttribute(EXTERNAL_VISIBLE);
        if (!context || !context.movie || !names(context.movie).length ||
            (context.kind === 'still' && (!context.ep || !context.ep.season || !context.ep.number))) return;
        var key = cacheId(context.movie, context.kind, context.ep);
        if (state.externalContext !== key) {
            state.externalContext = key;
            state.externalUrl = '';
            state.externalBlocked = {};
            state.externalBusy = false;
            state.externalRetry = 0;
        }
        if (state.externalUrl && src === state.externalUrl) {
            if (img.naturalWidth > 0) showExternalAfterLoad(img);
            return;
        }
        // Native Lampa lazy-loader may rewrite src. Reapply known alternative.
        if (state.externalUrl && independentArtwork(state.externalUrl)) {
            img.removeAttribute(EXTERNAL_VISIBLE);
            img.src = state.externalUrl;
            return;
        }
        if (state.externalBusy || (state.externalRetry && Date.now() < state.externalRetry)) return;
        state.externalBusy = true;
        stats.externalOnlyChecks++;
        resolveArtwork(context.movie, context.kind, context.ep, state.externalBlocked).then(function (found) {
            state.externalBusy = false;
            if (!onlyAlternatives() || !img.isConnected || state.externalContext !== key) return;
            var actual = contextFor(img);
            if (!actual || cacheId(actual.movie, actual.kind, actual.ep) !== key) return;
            if (!found || !independentArtwork(found.url)) {
                stats.externalOnlyMissing++;
                state.externalRetry = Date.now() + 120000;
                return; // No independent image: intentionally leave it blank.
            }
            state.externalUrl = found.url;
            img.removeAttribute(EXTERNAL_VISIBLE);
            if ((img.getAttribute('src') || '') !== found.url) img.src = found.url;
            else if (img.naturalWidth > 0) showExternalAfterLoad(img);
        }).catch(function () { state.externalBusy = false; });
    }
    function externalImageError(img) {
        if (!onlyAlternatives()) return;
        var state = img.__capsuleArtwork;
        if (!state || !state.externalUrl ||
            (img.getAttribute('src') || '') !== state.externalUrl) return;
        var context = contextFor(img);
        if (!context) return;
        state.externalBlocked[state.externalUrl] = true;
        delete disk[cacheId(context.movie, context.kind, context.ep) + ':only-external'];
        state.externalUrl = '';
        img.removeAttribute(EXTERNAL_VISIBLE);
        setTimeout(function () { inspectExternalOnly(img); }, 20);
    }

    function recover(img, reason) {
        if (!enabled() || !relevant(img) || !img.isConnected) return;
        if (onlyAlternatives()) { inspectExternalOnly(img); return; }
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
        if (onlyAlternatives()) { inspectExternalOnly(img); return; }
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
        if (enabled() && d.episodes && Array.isArray(d.episodes.episodes) &&
            (!d.movie.source || /^(?:tmdb|kp|kinopoisk)$/i.test(String(d.movie.source)))) {
            safeEpisodeHydrate(d.movie, d.episodes.episodes, d.episodes.season_number);
        }
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
                values: { auto: 'Сбалансированный: сохранять хорошие оригиналы',
                    alternatives: 'Предпочитать альтернативы при явном улучшении',
                    missing: 'Только отсутствующие картинки',
                    only_alternatives: 'ТОЛЬКО альтернативы — оригиналы отключены' },
                default: 'auto' },
                onChange: function () { setTimeout(function () {
                    syncExternalMode();
                    scheduleInspect(document.body);
                }, 0); },
                field: { name: 'Качество изображений',
                    description: 'Больше никаких замен поверх уже показанной картинки: улучшения готовятся заранее и применяются при новом открытии.' } },
            { param: { name: PREFIX + 'source_pack', type: 'select',
                values: {free:'Без ключей: KinoBD + данные Lampa/KP',russian:'Российские API с ключами (необязательно)',global:'Все источники (включая зарубежные)'},
                default:'free' },
                field: {name:'Каталоги изображений и названий',
                    description:'Без ключей: постеры KinoBD, названия и кадры из уже загруженных данных Lampa/KP. Серийные кадры без подтверждения не подменяем.'} },
            { param: { name: PREFIX + 'check_free', type: 'button' },
                field: {name:'Проверить KinoBD без ключа/VPN',
                    description:'Проверка живого ответа из Lampa. Пустой результат не считается доступностью.'},
                onChange: function () {
                    kbRequest('filters').then(function (data) {
                        var valid = data && typeof data === 'object' && Object.keys(data).length > 0;
                        if (Lampa.Noty && Lampa.Noty.show)
                            Lampa.Noty.show(valid ? 'KinoBD: API отвечает. Картинки и CORS CDN проверяются при открытии фильма.'
                                : 'KinoBD: нет корректного JSON (сеть / CORS / API).');
                    });
                } },
            { param: { name: PREFIX + 'kpu_key', type: 'input', values: 'string', default: '', placeholder:'X-API-KEY' },
                field: {name:'Ключ КП Unofficial — названия серий',
                    description:'Бесплатный личный ключ: kinopoiskapiunofficial.tech. Запросы идут напрямую.'} },
            { param: { name: PREFIX + 'poiskkino_key', type: 'input', values: 'string', default: '', placeholder:'X-API-KEY' },
                field: {name:'Ключ ПоискКино — кадры и постеры',
                    description:'Личный бесплатный демо-ключ: poiskkino.dev. Ключ остаётся в настройках Lampa.'} },
            { param: { name: PREFIX + 'check_ru', type: 'button' },
                field: {name: 'Проверить источники без VPN',
                    description: 'Два прямых запроса с личными ключами. Покажет, доступны ли русские API в текущей сети.'},
                onChange: function () {
                    var kp = ruKey('kpu_key'), poisk = ruKey('poiskkino_key');
                    var check1 = kp ?
                        kpuRequest('v2.2/films/301').then(function (v) {
                            return v && Number(v.kinopoiskId)===301 ? 'работает' : 'нет ответа / CORS / ключ';
                        }) : Promise.resolve('нет ключа');
                    var check2 = poisk ?
                        poiskRequest('movie/535341').then(function (v) {
                            return v && Number(v.id)===535341 ? 'работает' : 'нет ответа / CORS / ключ';
                        }) : Promise.resolve('нет ключа');
                    Promise.all([check1,check2]).then(function (results) {
                        if (Lampa.Noty && Lampa.Noty.show)
                            Lampa.Noty.show('КП Unofficial: '+results[0]+' | ПоискКино: '+results[1]);
                    });
                } },
            { param: { name: PREFIX + 'fanart_key', type: 'input', values: 'string', default: '', placeholder: 'client_key' },
                field: { name: 'Ключ Fanart.tv (необязательно)', description: 'Личный ключ с fanart.tv. Хранится локально в настройках Lampa.' } },
            { param: { name: PREFIX + 'omdb_key', type: 'input', values: 'string', default: '', placeholder: 'API key' },
                field: { name: 'Ключ OMDb (необязательно)', description: 'С ключом OMDb добавляются постеры IMDb.' } },
            { param: { name: PREFIX + 'diagnostics', type: 'button' },
                field: { name: 'Проверить работу плагина',
                    description: 'Версия, режим и счётчики реально проверенных и изменённых изображений.' },
                onChange: function () {
                    var x = stats, kp = kpIntegrationState();
                    var status = 'Artwork Rescue ' + VERSION + ' | ' + qualityMode() +
                        ' | поисков: ' + x.qualityAttempts + ' | подготовлено: ' + x.qualityPrepared +
                        ' | показано: ' + x.verifiedRendered + ' | ошибок: ' + x.replacementErrors +
                        ' | списков серий: ' + x.episodeLists + ' | нет названий: ' + x.missingEpisodeNames +
                        ' | найдено имён: ' + x.namesFilled +
                        ' | уникальных без названий: ' + Object.keys(uniqueEpisodeMissing).length +
                        ' | уникальных исправлено: ' + Object.keys(uniqueEpisodeFound).length +
                        ' | эпизоды TMDB: ' + x.episodeApiCalls +
                        ' | отклонено: ' + x.rejectedTitles +
                        ' | KP: ' + (kp.registered ? (kp.selectable ? 'есть и в меню' : 'есть, но нет в меню') : 'не зарегистрирован') +
                        ' | KP→TMDB: ' + x.kpResolved +
                        ' | только альтернативы: ' + x.externalOnlyShown + '/' + x.externalOnlyChecks +
                        ' | нет картинки: ' + x.externalOnlyMissing +
                        ' | KinoBD API: ' + kinobdStats.successes + '/' + kinobdStats.requests +
                        ' | совпадений: ' + kinobdStats.artwork +
                        ' | KP в памяти: ' + Object.keys(observedKP).length +
                        ' | RU: ' + sourcePack() +
                        ' | ключи КП:' + (ruKey('kpu_key')?'есть':'нет') +
                        ', ПоискКино:' + (ruKey('poiskkino_key')?'есть':'нет') +
                        ' | успехи API: ' + russianServiceStats.kpu.ok + '/' + russianServiceStats.poiskkino.ok +
                        ' | ошибки API: ' + russianServiceStats.kpu.fail + '/' + russianServiceStats.poiskkino.fail +
                        ' | источники имён: ' + JSON.stringify(x.nameSources) +
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
        syncExternalMode();
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
            if (onlyAlternatives()) showExternalAfterLoad(img);
            else inspectQuality(img);
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
            if (onlyAlternatives()) externalImageError(img);
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
            resolveTmdbIdentity: resolveTmdbIdentity, tmdbJson: tmdbJson, mappedTmdbArtwork: mappedTmdbArtwork,
            safeEpisodeMatch: safeEpisodeMatch, titleVote: titleVote,
            exactCatalogStill: exactCatalogStill, targetEpisode: targetEpisode,
            kpIntegrationState: kpIntegrationState, safeEpisodeHydrate: safeEpisodeHydrate,
            epguidesCatalog: epguidesCatalog,
            knownEpisodeName: knownEpisodeName, tmdbFullSize: tmdbFullSize, applyPrepared: applyPrepared,
            tmdbEpisodeStills: tmdbEpisodeStills, episodeTitlesFromTMDB: episodeTitlesFromTMDB,
            highQualityCandidate: highQualityCandidate, inspectQuality: inspectQuality,
            independentArtwork: independentArtwork, onlyAlternatives: onlyAlternatives,
            sourcePack: sourcePack, kinoBdArtwork: kinoBdArtwork, kbFind: kbFind,
            kbImageURL: kbImageURL, kbCandidate: kbCandidate, kbGalleryImages: kbGalleryImages,
            captureKP: captureKP, reusedKPEpisode: reusedKPEpisode, kpAlias: kpAlias,
            findKpId: findKpId, poiskSeason: poiskSeason,
            kpuSeason: kpuSeason, russianPosters: russianPosters,
            unofficialPosters: unofficialPosters, poiskEpisodeImage: poiskEpisodeImage,
            inspectExternalOnly: inspectExternalOnly, showExternalAfterLoad: showExternalAfterLoad,
            syncExternalMode: syncExternalMode, externalImageError: externalImageError
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