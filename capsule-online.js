/* Capsule Next — original implementation, 2026. Not a copy of Skaz. */
(function(){
'use strict';
var __modules = {};
var __cache = {};
__modules["src/core/model.js"] = function(module, exports, __require) {
'use strict';

const SOURCE_ORDER = Object.freeze({ alloha: 0, hdrezka: 1, filmix: 2, vibix: 3, mirkino: 3 });
const STATES = Object.freeze({ LOADING: 'loading', PARTIAL: 'partial', COMPLETE: 'complete', UNAVAILABLE: 'unavailable', ERROR: 'error' });

function normalizedVoice(value) {
  return String(value || 'Неизвестная озвучка').trim().toLowerCase().replace(/ё/g, 'е')
    .replace(/[\s._\-–—]+/g, ' ').replace(/[^a-zа-я0-9 ]/gi, '').trim() || 'неизвестная озвучка';
}
function isRussian(voice) {
  const s = String(voice || '').toLowerCase();
  if (/original|оригинал|английск|english|subtitles|субтитр|україн|украин/.test(s)) return false;
  return /дубл|озвуч|многоголос|двухголос|русск|russian|lostfilm|tvshows|rezka|hdrezka|2x2|jaskier|кубик|колдфильм|байбако|alexfilm|newstudio|профес|невафильм|рхс|red head sound/.test(s);
}
function voiceRank(voice) {
  const text = String(voice || '').toLowerCase();
  if (!isRussian(text)) return 0;
  if (/дубл|дублирован|russian dub|рхс|red head sound|невафильм/.test(text)) return 5;
  if (/lostfilm|tvshows|hdrezka|rezka|многоголос|2x2/.test(text)) return 4;
  if (/двухголос|newstudio|coldfilm|jaskier/.test(text)) return 3;
  if (/авторск|одноголос/.test(text)) return 1;
  return 2;
}
function qualityRank(quality) {
  const s = String(quality || '').toLowerCase();
  const m = s.match(/(?:^|\D)(2160|1440|1080|720|576|480|360)(?:\D|$)/);
  if (m) return Number(m[1]);
  if (/4k|uhd/.test(s)) return 2160;
  if (/fhd|full\s*hd/.test(s)) return 1080;
  if (/\bhd\b/.test(s)) return 720;
  return 0;
}
function positiveInteger(value, allowZero) {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  const s = String(value).trim();
  if (!/^\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) && (n > 0 || (allowZero && n === 0)) ? n : null;
}
function makeIdentity(media) {
  if (!media || !media.movie) throw new Error('Missing Lampa movie');
  const movie = media.movie;
  const kind = media.serial ? 'tv' : 'movie';
  const tmdb = positiveInteger(movie.tmdb_id || movie.id, false);
  const imdb = /^tt\d+$/.test(String(movie.imdb_id || '')) ? String(movie.imdb_id) : '';
  const kp = positiveInteger(movie.kinopoisk_id, false);
  let id;
  if (tmdb && (!movie.source || movie.source === 'tmdb')) id = 'tmdb:' + kind + ':' + tmdb;
  else if (imdb) id = 'imdb:' + kind + ':' + imdb;
  else if (kp) id = 'kp:' + kind + ':' + kp;
  else {
    const title = String(movie.original_name || movie.original_title || movie.name || movie.title || '').trim().toLowerCase();
    const year = String(movie.first_air_date || movie.release_date || '').slice(0, 4);
    if (!title || !/^\d{4}$/.test(year)) throw new Error('Missing reliable media identity');
    id = 'title:' + kind + ':' + title + ':' + year;
  }
  return id;
}
function episodeKey(identity, season, episode, edition) {
  const s = positiveInteger(season, true);
  const e = positiveInteger(episode, false);
  if (s === null || e === null) return null;
  const cut = String(edition || 'main').toLowerCase().replace(/[^\wа-яё-]/gi, '').slice(0, 60) || 'main';
  return identity + ':s' + s + ':e' + e + ':cut:' + cut;
}
function textCompare(a, b) { return String(a).localeCompare(String(b), 'en'); }
function candidateId(c) {
  return [c.source, c.method, c.url, c.season == null ? '' : c.season, c.episode == null ? '' : c.episode,
    normalizedVoice(c.voice), c.edition || 'main', c.quality || ''].join('\u0001');
}
function validHttpUrl(url) { try { const u = new URL(url); return (u.protocol === 'https:' || u.protocol === 'http:') && !u.username && !u.password; } catch (_) { return false; } }

class Catalog {
  constructor(media) {
    this.media = media;
    this.identity = makeIdentity(media);
    this.serial = !!media.serial;
    this.entries = new Map();
    this.sources = new Map();
    this.unresolved = [];
    this.revision = 0;
  }
  sourceStatus(name, state, detail) {
    const previous = this.sources.get(name);
    const record = { state, detail: String(detail || ''), updatedAt: Date.now() };
    if (!previous || previous.state !== state || previous.detail !== record.detail) this.revision++;
    this.sources.set(name, record);
  }
  add(raw) {
    if (!raw || !validHttpUrl(raw.url) || !['call', 'play'].includes(raw.method)) return false;
    if (!Object.prototype.hasOwnProperty.call(SOURCE_ORDER, raw.source)) return false;
    if (raw.kind && raw.kind !== (this.serial ? 'tv' : 'movie')) return false;
    if (raw.mediaId && raw.mediaId !== this.identity) return false;
    const season = this.serial ? positiveInteger(raw.season, true) : null;
    const episode = this.serial ? positiveInteger(raw.episode, false) : null;
    if (this.serial && (season === null || episode === null)) {
      if (this.unresolved.length < 200) this.unresolved.push({ source: raw.source, reason: 'episode-number-missing' });
      return false;
    }
    const key = this.serial ? episodeKey(this.identity, season, episode, raw.edition) : this.identity;
    if (!key) return false;
    const c = {
      source: raw.source, url: raw.url, method: raw.method,
      season, episode, edition: String(raw.edition || 'main'),
      voice: String(raw.voice || 'Неизвестная озвучка').trim(),
      voiceId: String(raw.voiceId || ''),
      quality: String(raw.quality || ''),
      stream: validHttpUrl(raw.stream) ? raw.stream : '',
      subtitles: raw.subtitles || null,
      headers: raw.headers || null,
      confirmed: raw.confirmed === true, // 'true' means resolved, not that playback was successful
      mediaId: this.identity
    };
    c.id = candidateId(c);
    let entry = this.entries.get(key);
    if (!entry) {
      entry = { key, season, episode, edition: c.edition, alternatives: new Map() };
      this.entries.set(key, entry);
    }
    if (entry.alternatives.has(c.id)) return false;
    entry.alternatives.set(c.id, c);
    this.revision++;
    return true;
  }
  episodes() {
    return Array.from(this.entries.values()).sort((a,b) => (a.season || 0) - (b.season || 0) ||
      (a.episode || 0) - (b.episode || 0) || textCompare(a.edition,b.edition));
  }
  snapshot() { return { identity: this.identity, revision: this.revision, serial: this.serial,
    episodes: this.episodes(), sources: new Map(this.sources), unresolved: this.unresolved.slice() }; }
}
module.exports = { SOURCE_ORDER, STATES, Catalog, makeIdentity, episodeKey, positiveInteger, normalizedVoice, voiceRank, isRussian, qualityRank, candidateId, validHttpUrl, textCompare };

};
__modules["src/core/selection.js"] = function(module, exports, __require) {
'use strict';
const { SOURCE_ORDER, normalizedVoice, voiceRank, qualityRank, textCompare } = __require("src/core/model.js");

const sourceRank = c => SOURCE_ORDER[c.source] == null ? 99 : SOURCE_ORDER[c.source];
function orderCandidates(a, b) {
  return voiceRank(b.voice) - voiceRank(a.voice) || Number(b.confirmed) - Number(a.confirmed) ||
    qualityRank(b.quality) - qualityRank(a.quality) || sourceRank(a) - sourceRank(b) || textCompare(a.id, b.id);
}
function betterScore(a, b) {
  if (!b) return true;
  // Strict lexicographic comparison; a better voice can never compensate for a switch.
  for (let i = 0; i < a.metrics.length; i++) {
    if (a.metrics[i] !== b.metrics[i]) return a.metrics[i] < b.metrics[i];
  }
  // Deterministic tie-break without storing O(episodes²) path strings.
  let left = a, right = b;
  while (left && right) {
    const order = textCompare(left.candidate.id, right.candidate.id);
    if (order) return order < 0;
    left = left.previous; right = right.previous;
  }
  return !!right;
}
function dynamicPlan(episodes) {
  if (!episodes.length) return new Map();
  const groups = episodes.map(entry => {
    const voices = new Map();
    Array.from(entry.alternatives.values()).sort(orderCandidates).forEach(c => {
      const v = normalizedVoice(c.voice);
      if (!voices.has(v)) voices.set(v, c);
    });
    return Array.from(voices.values()).sort(orderCandidates);
  });
  let prev = [];
  groups.forEach((group, index) => {
    const current = [];
    group.forEach(candidate => {
      const rank = voiceRank(candidate.voice), quality = qualityRank(candidate.quality);
      const choices = index ? prev : [null];
      let best = null;
      choices.forEach(p => {
        const switchedVoice = p && normalizedVoice(p.candidate.voice) !== normalizedVoice(candidate.voice) ? 1 : 0;
        const switchedSource = p && p.candidate.source !== candidate.source ? 1 : 0;
        const prior = p ? p.metrics : [0,0,0,0,0];
        const metrics = [prior[0] + switchedVoice,
          prior[1] - rank, prior[2] - Number(candidate.confirmed),
          prior[3] - quality, prior[4] + switchedSource];
        const path = { candidate, previous: p, metrics };
        if (betterScore(path, best)) best = path;
      });
      current.push(best);
    });
    if (!current.length) throw new Error('Episode without variants');
    prev = current;
  });
  let winner = null;
  prev.forEach(p => { if (betterScore(p,winner)) winner=p; });
  const result = new Map();
  for (let i = episodes.length - 1; i >= 0; i--) {
    result.set(episodes[i].key, winner.candidate.id);
    winner = winner.previous;
  }
  return result;
}
function select(snapshot) {
  const entries = snapshot.episodes;
  if (!snapshot.serial) return entries.map(entry => {
    const alternatives = Array.from(entry.alternatives.values()).sort(orderCandidates);
    return Object.assign({},entry,{ primary: alternatives[0] || null, alternatives });
  });
  // Per-season optimized paths: no gaps added or episodes dropped under any condition.
  const preferred = new Map();
  const seasons = new Map();
  entries.forEach(e => { const group = seasons.get(e.season) || []; group.push(e); seasons.set(e.season, group); });
  seasons.forEach(episodes => dynamicPlan(episodes).forEach((id, key) => preferred.set(key,id)));
  return entries.map(entry => {
    const alternatives = Array.from(entry.alternatives.values()).sort(orderCandidates);
    const mainId = preferred.get(entry.key);
    const index = alternatives.findIndex(a => a.id === mainId);
    if (index > 0) alternatives.unshift(alternatives.splice(index,1)[0]);
    return { key: entry.key, season: entry.season, episode: entry.episode, edition: entry.edition,
      primary: alternatives[0] || null, alternatives };
  });
}
module.exports = { select, dynamicPlan, orderCandidates };

};
__modules["src/core/network.js"] = function(module, exports, __require) {
'use strict';
const { validHttpUrl } = __require("src/core/model.js");

class NetworkError extends Error {
  constructor(message, code) { super(message); this.name = 'NetworkError'; this.code = code; }
}
function assertSkaz(url) {
  if (!validHttpUrl(url)) throw new NetworkError('Некорректный адрес', 'URL');
  const u = new URL(url);
  if (!/^(?:[a-z0-9-]+\.)?skaz\.tv$/i.test(u.hostname))
    throw new NetworkError('Адрес не принадлежит Skaz', 'HOST');
  return u.href;
}
function resolveLink(current, next) {
  try { return assertSkaz(new URL(String(next),current).href); }
  catch (_) { return ''; }
}
function withCredentials(Lampa, url) {
  const u = new URL(assertSkaz(url));
  const storage = Lampa && Lampa.Storage;
  if (!storage || typeof storage.get !== 'function') return u.href;
  const uid = storage.get('lampac_unic_id', '');
  if (uid && !u.searchParams.has('uid')) u.searchParams.set('uid', String(uid));
  // Insecure HTTP servers must NEVER receive personal email or bearer credentials.
  if (u.protocol === 'https:') {
    const email = storage.get('account_email', '');
    if (email && !u.searchParams.has('account_email')) u.searchParams.set('account_email',String(email));
    const nws = storage.get('lampac_nws_id', '');
    if (nws && !u.searchParams.has('nws_id')) u.searchParams.set('nws_id',String(nws));
  }
  return u.href;
}
function lampaTransport(Lampa) {
  return function fetchText(url, signal, timeoutMs) {
    const endpoint = withCredentials(Lampa, url);
    return new Promise((resolve, reject) => {
      const client = new Lampa.Reguest();
      let settled = false, timer;
      function finish(error, value) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (signal) signal.removeEventListener('abort', abort);
        if (error) reject(error); else resolve(value);
      }
      function abort() { try { client.clear(); } catch (_) {} finish(new NetworkError('Запрос отменён', 'ABORT')); }
      if (signal && signal.aborted) return abort();
      if (signal) signal.addEventListener('abort', abort, { once: true });
      const ms = Math.max(800, timeoutMs || 9000);
      if (typeof client.timeout === 'function') client.timeout(ms);
      timer = setTimeout(() => { try { client.clear(); } catch (_) {} finish(new NetworkError('Истекло время ответа','TIMEOUT')); }, ms + 350);
      try {
        const headers = {};
        // This header is used by the stock Skaz client; never expose its value to untrusted hosts.
        if (new URL(endpoint).protocol === 'https:' && Lampa.Storage) {
          const aesKey = Lampa.Storage.get('aesgcmkey', '');
          if (aesKey) headers['X-Kit-AesGcm'] = aesKey;
        }
        client.native(endpoint, value => finish(null, value), error =>
          finish(new NetworkError('Сетевой запрос не выполнен',String(error && (error.status || error.code) || 'NETWORK'))),
          false, { dataType: 'text', headers });
      } catch (e) { finish(new NetworkError('Ошибка сетевого клиента','TRANSPORT')); }
    });
  };
}
function wait(ms, signal) {
  return new Promise((resolve,reject) => {
    if (signal && signal.aborted) return reject(new NetworkError('Запрос отменён','ABORT'));
    let timer;
    const abort = () => { clearTimeout(timer); reject(new NetworkError('Запрос отменён','ABORT')); };
    timer = setTimeout(() => { if (signal) signal.removeEventListener('abort',abort); resolve(); },ms);
    if (signal) signal.addEventListener('abort',abort,{once:true});
  });
}
module.exports = { NetworkError, assertSkaz, resolveLink, lampaTransport, withCredentials, wait };

};
__modules["src/sources/adapters.js"] = function(module, exports, __require) {
'use strict';
// These adapters identify independent catalogues exposed by a Skaz/Lampac server.
// They are NOT implementations of undocumented direct provider APIs.
const DEFINITIONS = Object.freeze({
  alloha: { label: 'Alloha', serial: true, movie: true,
    match: (key, title) => /^(alloha)(?:\b|\d|_|-)/i.test(key) || /^alloha\b/i.test(title) },
  hdrezka: { label: 'HDRezka', serial: true, movie: true,
    match: (key, title) => /^(hdrezka|rezka)(?:\b|\d|_|-)/i.test(key) || /\bhd\s*rezka\b|\bрезка\b/i.test(title) },
  filmix: { label: 'Filmix', serial: true, movie: true,
    match: (key, title) => /^filmix(?:\b|\d|_|-)/i.test(key) || /^filmix\b/i.test(title) },
  vibix: { label: 'Vibix', serial: true, movie: false,
    match: (key, title) => /^vibix(?:\b|\d|_|-)/i.test(key) || /^vibix\b/i.test(title) },
  mirkino: { label: 'Мир кино З', serial: false, movie: true,
    // The exact route has not been confirmed from the supplied Skaz source.
    match: (key, title) => /^(mirkino|mirkinoz|mirkino3|mirkinos)(?:\b|\d|_|-)/i.test(key) || /^мир\s*кино\s*[з3z]\b/i.test(title) }
});
const SOURCES = Object.keys(DEFINITIONS);
function allowed(media) { return SOURCES.filter(k => media.serial ? DEFINITIONS[k].serial : DEFINITIONS[k].movie); }
function findAdapter(sourceInfo, media) {
  if (!sourceInfo || typeof sourceInfo !== 'object') return '';
  const key = String(sourceInfo.balanser || sourceInfo.name || '').split(/\s+/)[0].toLowerCase();
  const title = String(sourceInfo.name || '');
  return allowed(media).find(k => DEFINITIONS[k].match(key, title)) || '';
}
module.exports = { DEFINITIONS, allowed, findAdapter };

};
__modules["src/sources/skaz-parser.js"] = function(module, exports, __require) {
'use strict';
const { validHttpUrl, positiveInteger, qualityRank } = __require("src/core/model.js");

function decodeRelay(payload) {
  if (!payload || typeof payload !== 'object' || typeof payload.fv !== 'string') return '';
  try { return atob(payload.fv.split('').reverse().join('')); } catch (_) { return ''; }
}
function parseAnyJson(data) {
  if (data && typeof data === 'object') return data;
  if (typeof data !== 'string') return null;
  const str = data.trim();
  if (str[0] !== '{' && str[0] !== '[') return null;
  try { return JSON.parse(str); } catch (_) { return null; }
}
function isSeasonLabel(label) {
  const text = String(label || '').trim();
  return /^\d+\s*[-]?[йя]?\s*(?:сезон|season)$/i.test(text) || /^(?:сезон|season)\s*\d+$/i.test(text);
}
function seasonFromLabel(label) {
  if (!isSeasonLabel(label)) return null;
  const m = String(label).match(/\d+/);
  return m ? positiveInteger(m[0], true) : null;
}
function extractQuality(obj) {
  const raw = obj.maxquality || obj.qualitys || obj.quality || '';
  if (typeof raw === 'string') return raw;
  if (raw && typeof raw === 'object') {
    return Object.keys(raw).sort((a,b) => qualityRank(b) - qualityRank(a))[0] || '';
  }
  return '';
}
function parseSkazPage(body, htmlParser) {
  const data = parseAnyJson(body);
  if (data) {
    if (data.rch || data.accsdb || data.blocked || data.error) {
      return { links: [], items: [], relay: '', error: data.rch ? 'Requires RCH support' :
        data.accsdb ? 'Access restricted' : data.blocked ? 'Blocked' : 'Backend error' };
    }
    const relay = decodeRelay(data);
    if (relay) return { links: [], items: [], relay, error: '' };
    if (Array.isArray(data.streams)) {
      const items = data.streams.filter(s => s && validHttpUrl(s.url)).map(s => ({
        method: 'play', url: s.url, season: s.season, episode: s.episode,
        text: s.voice || 'Неизвестная озвучка', voice_name: s.voice || '',
        maxquality: s.quality || '', active: true
      }));
      return { links: [], items, relay: '', error: '' };
    }
    // Unexpected JSON is not an empty catalogue.
    return { links: [], items: [], relay: '', error: 'Unknown JSON response' };
  }
  if (typeof body !== 'string') return { links: [], items: [], relay: '', error: 'Invalid response type' };
  if (!/videos__(?:item|button|line)/.test(body)) return { links: [], items: [], relay: '', error: 'Unknown HTML response' };
  const result = htmlParser(body);
  if (!result || !Array.isArray(result.items) || !Array.isArray(result.buttons))
    return { links: [], items: [], relay: '', error: 'Unrecognized HTML response' };
  const links = [];
  const items = [];
  const voiceLinks = result.buttons.filter(b => b && b.url && !isSeasonLabel(b.text));
  const currentVoice = voiceLinks.find(x => x.active);
  const activeVoice = currentVoice ? currentVoice.text : '';
  const push = obj => {
    if (!obj || obj.similar) return;
    if ((obj.method === 'play' || obj.method === 'call') && obj.url) {
      const c = Object.assign({},obj);
      c.voice_name = c.voice_name || c.translate || activeVoice || ''; 
      items.push(c);
    } else if ((obj.method === 'link' || !obj.method) && obj.url) links.push(obj);
  };
  result.items.forEach(push);
  // Buttons describe season/voice navigation. Even if a backend uses a `call`
  // method on a button, it must be traversed as a catalogue link, not played.
  result.buttons.forEach(b => { if (b && b.url) links.push({method:'link',url:b.url,text:b.text,active:b.active}); });
  // All voice and season links are followed. Never apply TOP-N filters.
  return { links, items, relay: '', error: '', activeVoice };
}
function parseHtmlInBrowser(str) {
  // Parse detached markup only. Remove elements capable of fetching remote resources.
  const inert = str.replace(/<(?:script|iframe|img|image|video|audio|source|object|embed|link|meta)\b[^>]*>/gi, '');
  const doc = new DOMParser().parseFromString(inert, 'text/html');
  function read(selector) {
    return Array.from(doc.querySelectorAll(selector)).map(el => {
      const raw = el.getAttribute('data-json');
      if (!raw) return null;
      let data;
      try { data = JSON.parse(raw); } catch (_) { return null; }
      if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
      const season = el.getAttribute('s');
      const episode = el.getAttribute('e');
      if (season !== null) data.season = season;
      if (episode !== null) data.episode = episode;
      data.text = (el.textContent || '').trim();
      data.active = el.classList.contains('active');
      return data;
    }).filter(Boolean);
  }
  return { items: read('.videos__item'), buttons: read('.videos__button') };
}
module.exports = { parseSkazPage, parseHtmlInBrowser, isSeasonLabel, seasonFromLabel, extractQuality, parseAnyJson };

};
__modules["src/sources/skaz-gateway.js"] = function(module, exports, __require) {
'use strict';
const { assertSkaz, resolveLink, wait } = __require("src/core/network.js");
const { parseAnyJson, parseSkazPage, parseHtmlInBrowser, extractQuality, isSeasonLabel, seasonFromLabel } = __require("src/sources/skaz-parser.js");
const { findAdapter, allowed } = __require("src/sources/adapters.js");
const { STATES, validHttpUrl, positiveInteger } = __require("src/core/model.js");

function appendSearch(url, media) {
  const m = media.movie;
  const u = new URL(assertSkaz(url));
  const pairs = {
    id: m.id || '', imdb_id: m.imdb_id || '', kinopoisk_id: m.kinopoisk_id || '', tmdb_id: m.tmdb_id || '',
    title: m.title || m.name || '', original_title: m.original_title || m.original_name || '',
    serial: media.serial ? 1 : 0, original_language: m.original_language || '',
    year: String(m.release_date || m.first_air_date || '').slice(0,4), source: m.source || 'tmdb',
    clarification: 0, similar: false, rchtype: ''
  };
  Object.keys(pairs).forEach(k => u.searchParams.set(k, String(pairs[k])));
  return u.href;
}
function hostBase(url) { return new URL(assertSkaz(url)).origin + '/'; }
function discoveryRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.online)) return payload.online;
  return [];
}
// A nonempty list of providers is useful immediately, but does not prove every
// provider is available. Deadlines are reported as PARTIAL, not as an empty result.
class SkazRegistry {
  constructor(fetchText, server) {
    this.fetchText = fetchText;
    this.server = hostBase(server);
  }
  async discover(media, onFound, signal, opts) {
    const options = opts || {};
    const retries = Number.isInteger(options.maxPolls) ? options.maxPolls : 5;
    const interval = Number.isInteger(options.delayMs) ? options.delayMs : 700;
    const seen = new Set();
    let failed = 0, partial = false;
    const accept = payload => {
      for (const entry of discoveryRows(payload)) {
        const id = findAdapter(entry,media);
        if (!id || !entry.url) continue;
        const url = resolveLink(this.server, entry.url);
        if (!url || seen.has(id+'\0'+url)) continue;
        seen.add(id+'\0'+url);
        onFound(id,url,entry);
      }
    };
    // The original Skaz/Lampac client supports both routes; life=false is
    // often complete immediately, while life=true can require memkey polls.
    const plain = (async () => {
      try {
        const payload = parseAnyJson(await this.fetchText(appendSearch(this.server+'lite/events?life=false',media),signal,8000));
        if (!payload || payload.rch || payload.accsdb || payload.blocked) throw Error('Restricted/invalid discovery');
        accept(payload);
        return {ok:true,complete:!payload.life && discoveryRows(payload).length>0};
      } catch (e) {
        if (signal && signal.aborted) throw e;
        failed++;
        return {ok:false,complete:false};
      }
    })();
    const streaming = (async () => {
      let payload;
      try {
        payload = parseAnyJson(await this.fetchText(appendSearch(this.server+'lite/events?life=true',media),signal,8000));
      } catch (e) {
        if (signal && signal.aborted) throw e;
        failed++; return {ok:false,complete:false};
      }
      if (!payload || payload.rch || payload.blocked || payload.accsdb) {
        failed++; return {ok:false,complete:false};
      }
      accept(payload);
      if (!payload.life && !payload.memkey) return {ok:true,complete:true};
      if (payload.ready) return {ok:true,complete:true};
      if (!payload.memkey) return {ok:true,complete:false};
      const memkey = String(payload.memkey);
      for (let i=0; i<retries; i++) {
        await wait(interval, signal);
        try {
          payload = parseAnyJson(await this.fetchText(appendSearch(this.server+'lifeevents?memkey='+encodeURIComponent(memkey),media),signal,3500));
          if (!payload || payload.rch || payload.blocked || payload.accsdb) { partial=true; break; }
          accept(payload);
          if (payload.ready) return {ok:true,complete:true};
        } catch (e) { if (signal && signal.aborted) throw e; partial=true; }
      }
      return {ok:true,complete:false};
    })();
    const results = await Promise.all([plain,streaming]);
    return { complete: results.some(r=>r.complete), found: seen.size, failed,
      partial: partial || results.some(r=>!r.complete),
      reason: seen.size ? 'Получены не все данные источников' : 'Не удалось получить доступные источники' };
  }
}
function episodeFromText(value) {
  const text = String(value || '');
  const a = /(?:^|\s)(\d{1,4})\s*(?:[-–.]\s*)?(?:сер(?:ия|ии|ию|ий)?|эпизод|episode|ep\.?)(?:\s|$)/i.exec(text);
  const b = /(?:сер(?:ия|ии|ию|ий)?|эпизод|episode|ep\.?)\s*[№#:.-]?\s*(\d{1,4})/i.exec(text);
  return positiveInteger((a||b||[])[1],false);
}
class GraphCrawler {
  constructor(options) {
    this.catalog = options.catalog;
    this.source = options.source;
    this.fetchText = options.fetchText;
    this.parseHtml = options.parseHtml || parseHtmlInBrowser;
    this.signal = options.signal;
    this.media = options.media || this.catalog.media;
    this.onChange = options.onChange || function(){};
    this.concurrency = Math.min(4,Math.max(1,options.concurrency || 2));
    this.maxNodes = options.maxNodes || 1500; // safety, overflow => PARTIAL
    this.queue = [];
    this.visited = new Set();
    this.pending = new Set();
    this.running = 0;
    this.sealed = false;
    this.started = false;
    this.issues = [];
    this.added = 0;
    this.pages = 0;
    this.failedPages = 0;
    this._settled = false;
    this.done = new Promise(resolve => { this._resolve = resolve; });
  }
  addRoot(url) { this.enqueue(url,{}); }
  enqueue(url, context) {
    if (this._settled || (this.signal && this.signal.aborted)) return;
    const target = resolveLink(url,url);
    if (!target) { this.issues.push('Некорректная ссылка каталога'); return; }
    let request;
    try { request = appendSearch(target,this.media); } catch (_) { this.issues.push('Некорректная ссылка каталога'); return; }
    if (this.visited.has(request) || this.pending.has(request)) return;
    if (this.visited.size+this.pending.size >= this.maxNodes) {
      if (!this.issues.includes('Превышен безопасный предел обхода')) this.issues.push('Превышен безопасный предел обхода');
      this.onChange(); return;
    }
    this.pending.add(request);
    this.queue.push({url:request,context});
    this.started = true;
    this.pump();
  }
  seal() { this.sealed = true; this.pump(); }
  stop() { if (!this.issues.includes('Обход остановлен по лимиту времени')) this.issues.push('Обход остановлен по лимиту времени'); this.sealed = true; this.queue.length = 0; this.pending.clear(); this.pump(); }
  async page(task) {
    if (this.signal && this.signal.aborted) return;
    let body;
    for (let attempt=0;attempt<2;attempt++) {
      try { body = await this.fetchText(task.url,this.signal,7500); break; }
      catch(e) {
        if (this.signal && this.signal.aborted) return;
        if (attempt===1) { this.failedPages++; this.issues.push('Ошибка сети: '+String(e && e.code || 'NETWORK')); return; }
        await wait(200,this.signal).catch(()=>{});
      }
    }
    let parsed;
    try { parsed = parseSkazPage(body,this.parseHtml); }
    catch(e) { this.failedPages++; this.issues.push('Не удалось разобрать каталог'); return; }
    if (parsed.error) { this.failedPages++; this.issues.push(parsed.error); return; }
    if (parsed.relay) { this.enqueue(parsed.relay,task.context); return; }
    this.pages++;
    if (this.catalog.sources.get(this.source)?.state === STATES.LOADING)
      this.catalog.sourceStatus(this.source,STATES.PARTIAL,'Чтение каталога');
    for (const item of parsed.items) {
      const season = item.season == null ? task.context.season : item.season;
      const episode = item.episode != null ? item.episode : episodeFromText(item.text);
      const voice = item.voice_name || item.translate || parsed.activeVoice || task.context.voice || '';
      let playUrl = '';
      if (item.method === 'call') playUrl = resolveLink(task.url,item.url);
      else {
        const literal = String(item.url || '').split(/\s+or\s+/i)[0].trim();
        if (validHttpUrl(literal)) playUrl=literal;
        else { try { const relative=new URL(literal,task.url).href; if (validHttpUrl(relative)) playUrl=relative; } catch (_) {} }
        // Never treat a concatenated URL pair as a single player URL.
      }
      if (this.catalog.add({source:this.source,method:item.method,url:playUrl,stream:item.stream,
        season,episode,voice,voiceId:item.voice_id || item.translation_id || '',quality:extractQuality(item),
        subtitles:item.subtitles,edition:item.edition||'main',confirmed:false})) this.added++;
    }
    for (const link of parsed.links) {
      const target=resolveLink(task.url,link.url);
      if (!target) { this.issues.push('Отклонена ссылка вне Skaz'); continue; }
      const isSeason = isSeasonLabel(link.text);
      const season = isSeason ? seasonFromLabel(link.text) : task.context.season;
      const voice = isSeason ? (parsed.activeVoice || task.context.voice) : (link.text || task.context.voice);
      this.enqueue(target,{season,voice});
    }
    this.onChange();
  }
  pump() {
    while (this.running<this.concurrency && this.queue.length && !(this.signal && this.signal.aborted)) {
      const task=this.queue.shift();
      this.pending.delete(task.url);
      if (this.visited.has(task.url)) continue;
      this.visited.add(task.url);
      this.running++;
      this.page(task).catch(e=>{if (!(this.signal && this.signal.aborted)) {this.failedPages++;this.issues.push(String(e && e.message || e));}})
        .finally(()=>{this.running--;this.onChange();this.pump();});
    }
    if (this.sealed && (this.running===0) && (this.queue.length===0 || (this.signal && this.signal.aborted)) && !this._settled) {
      this._settled=true;
      const state=this.signal && this.signal.aborted ? STATES.PARTIAL : this.issues.length ?
        (this.pages ? STATES.PARTIAL : STATES.ERROR) : STATES.COMPLETE;
      this.catalog.sourceStatus(this.source,state,'страниц='+this.pages+', вариантов='+this.added+
        (this.issues.length ? ', проблем='+this.issues.length : ''));
      this.onChange();
      this._resolve({source:this.source,state,pages:this.pages,variants:this.added,issues:this.issues.slice()});
    }
  }
}
module.exports={ SkazRegistry, GraphCrawler, appendSearch, episodeFromText };

};
__modules["src/core/engine.js"] = function(module, exports, __require) {
'use strict';
const { Catalog, STATES } = __require("src/core/model.js");
const { select } = __require("src/core/selection.js");
const { SkazRegistry, GraphCrawler } = __require("src/sources/skaz-gateway.js");
const { allowed } = __require("src/sources/adapters.js");

class SearchEngine {
  constructor(options) {
    this.fetchText = options.fetchText;
    this.server = options.server;
    this.parseHtml = options.parseHtml;
    this.onUpdate = options.onUpdate || function(){};
    this.generation = 0;
    this.abortController = null;
    this._lastRevision = -1;
    this._renderTimer = null;
    this._active = null;
  }
  cancel() {
    if (this.abortController) this.abortController.abort();
    if (this._renderTimer) clearTimeout(this._renderTimer);
    this._renderTimer = null;
    this.generation++;
    this._lastRevision = -1;
  }
  emit(catalog,gen,done) {
    if (this.generation !== gen) return;
    if (catalog.revision === this._lastRevision && !done) return;
    this._lastRevision = catalog.revision;
    const snapshot = catalog.snapshot();
    this.onUpdate({catalog:snapshot,plan:select(snapshot),done:!!done});
  }
  schedule(catalog,gen) {
    if (this._renderTimer || this.generation !== gen) return;
    this._renderTimer = setTimeout(()=>{
      this._renderTimer = null;
      this.emit(catalog,gen,false);
    },100);
  }
  async search(media) {
    this.cancel();
    const gen=this.generation;
    const controller=new AbortController();
    this.abortController=controller;
    const catalog=new Catalog(media);
    const sources=allowed(media);
    const crawlers=new Map();
    sources.forEach(source=>catalog.sourceStatus(source,STATES.LOADING,'Поиск источника'));
    this.emit(catalog,gen,false);
    // Maximum discovery + traversal time, not a false assertion of completeness.
    const timeout=setTimeout(()=>{
      if (this.generation !== gen || controller.signal.aborted) return;
      crawlers.forEach(c=>c.stop());
    },20000);
    let discovery;
    try {
      try {
        const registry=new SkazRegistry(this.fetchText,this.server);
        discovery=await registry.discover(media,(source,url)=>{
          if (this.generation !== gen || controller.signal.aborted) return;
          let crawler=crawlers.get(source);
          if (!crawler) {
            crawler=new GraphCrawler({catalog,source,media,fetchText:this.fetchText,parseHtml:this.parseHtml,
              signal:controller.signal,onChange:()=>this.schedule(catalog,gen)});
            crawlers.set(source,crawler);
          }
          crawler.addRoot(url);
          this.schedule(catalog,gen);
        },controller.signal);
      } catch(e) {
        if (this.generation!==gen || controller.signal.aborted) return null;
        discovery={complete:false,reason:'Сервер каталога не ответил'};
      }
      if (this.generation!==gen || controller.signal.aborted) return null;
      sources.forEach(source=>{
        const crawler=crawlers.get(source);
        if (crawler) crawler.seal();
        else catalog.sourceStatus(source,discovery.complete ? STATES.UNAVAILABLE : STATES.ERROR,
          discovery.complete ? 'Источник не найден' : discovery.reason);
      });
      this.emit(catalog,gen,false);
      await Promise.all(Array.from(crawlers.values()).map(c=>c.done));
      if (this.generation!==gen || controller.signal.aborted) return null;
      this.emit(catalog,gen,true);
      return {catalog:catalog.snapshot(),plan:select(catalog.snapshot()),discovery};
    } finally {
      clearTimeout(timeout);
    }
  }
}
module.exports={SearchEngine};

};
__modules["src/playback/manager.js"] = function(module, exports, __require) {
'use strict';
const { validHttpUrl } = __require("src/core/model.js");
const { assertSkaz } = __require("src/core/network.js");
const { parseAnyJson } = __require("src/sources/skaz-parser.js");
function mediaUrl(raw) {
  const candidates = String(raw || '').split(/\s+or\s+/i).map(s => s.trim());
  const ok = candidates.filter(validHttpUrl);
  if (!ok.length) throw new Error('No valid stream URL');
  return { url: ok[0], url_reserve: ok[1] || '' };
}
async function resolveCandidate(candidate, fetchText, signal) {
  if (!candidate) throw new Error('Missing stream candidate');
  let result;
  if (candidate.method === 'play') {
    result = { url: candidate.stream || candidate.url, subtitles: candidate.subtitles, headers: candidate.headers };
  } else if (candidate.method === 'call') {
    const endpoint = assertSkaz(candidate.url);
    const body = await fetchText(endpoint, signal, 12000);
    result = parseAnyJson(body);
    if (!result || result.rch || result.blocked || result.accsdb) throw new Error('Stream resolution failed');
  } else throw new Error('Unknown playback method');
  const addresses = mediaUrl(result.url || result.stream);
  return {
    ...addresses, headers: result.headers && typeof result.headers === 'object' ? result.headers : null,
    quality: result.quality && typeof result.quality === 'object' ? result.quality : {},
    subtitles: result.subtitles || candidate.subtitles || null,
    segments: result.segments || null
  };
}
class PlaybackManager {
  constructor(Lampa, fetchText) { this.Lampa = Lampa; this.fetchText = fetchText; this.session = 0; }
  stop() { this.session++; }
  async resolveOptions(entry, generation, signal, except) {
    const bad = except || new Set();
    let last;
    for (const candidate of entry.alternatives) {
      if (bad.has(candidate.id)) continue;
      try {
        const stream = await resolveCandidate(candidate,this.fetchText,signal);
        if (generation !== this.session) return null;
        return { candidate, stream };
      } catch (e) { last=e; bad.add(candidate.id); }
    }
    throw last || new Error('No playable candidates');
  }
  async start(plan, entry, media) {
    this.stop();
    const generation = this.session;
    const L = this.Lampa;
    const seasonItems = media.serial ? plan.filter(p => p.season === entry.season).sort((a,b) =>
      a.episode - b.episode || String(a.edition).localeCompare(String(b.edition))) : [entry];
    const title = String(media.movie.title || media.movie.name || 'Видео');
    const makeCell = item => ({
      title: media.serial ? title + ' · Сезон ' + item.season + ', серия ' + item.episode : title,
      url: '', season: item.season || undefined, episode: item.episode || undefined,
      isonline: true, iptv: false
    });
    const playlist = seasonItems.map(item => makeCell(item));
    const selectedIndex = seasonItems.findIndex(item => item.key === entry.key);
    if (selectedIndex < 0) return;
    const item = seasonItems[selectedIndex];
    const first = playlist[selectedIndex];
    try {
      const resolved = await this.resolveOptions(item,generation,null);
      if (generation !== this.session || !resolved) return;
      Object.assign(first,resolved.stream,{ voice_name: resolved.candidate.voice });
      playlist.forEach((cell,i) => {
        if (i === selectedIndex) return;
        const other = seasonItems[i];
        cell.url = call => {
          this.resolveOptions(other,generation,null).then(res => {
            if (res && generation === this.session) Object.assign(cell,res.stream,{ voice_name: res.candidate.voice });
            else cell.url = '';
            call();
          }).catch(() => { cell.url = ''; call(); });
        };
      });
      // Match the working Skaz/Lampa handoff contract: attach the full
      // playlist to the first playable item and start playback before setting
      // the queue. Lampa consumes the `iptv` flag for online streams.
      first.iptv = true;
      first.isonline = true;
      if (playlist.length > 1) first.playlist = playlist;
      L.Player.play(first);
      L.Player.playlist(playlist);
    } catch (_) { if (generation === this.session && L.Noty) L.Noty.show('Не удалось получить рабочую ссылку'); }
  }
}
module.exports = { PlaybackManager, resolveCandidate, mediaUrl };

};
__modules["src/ui/lampa.js"] = function(module, exports, __require) {
'use strict';
const { SearchEngine } = __require("src/core/engine.js");
const { PlaybackManager } = __require("src/playback/manager.js");
const { STATES } = __require("src/core/model.js");
const { lampaTransport } = __require("src/core/network.js");
const { parseHtmlInBrowser } = __require("src/sources/skaz-parser.js");

const COMPONENT='capsule_next_online';
const SERVERS=['http://online3.skaz.tv/','http://online4.skaz.tv/','http://online5.skaz.tv/','http://online7.skaz.tv/'];
// Visual language follows the earlier Capsule Online cards and Lampa's native selectors.
// No styles or copied source code from third-party Skaz are included.
const CSS = `
.cso-root{padding:1.2em 1.5em 4.5em;max-width:87em;min-height:50vh}
.cso-hero{display:flex;align-items:center;gap:1.4em;margin-bottom:1.35em;min-height:4em}
.cso-hero__poster{width:7.5em;height:4.3em;flex-shrink:0;border-radius:.72em;object-fit:cover;background:rgba(255,255,255,.08)}
.cso-hero__poster--empty{display:none}
.cso-hero__body{min-width:0}
.cso-hero__title{font-size:1.65em;line-height:1.23;font-weight:650;overflow-wrap:break-word}
.cso-hero__desc{font-size:.91em;opacity:.62;margin-top:.4em;line-height:1.35}
.cso-simple-head{display:flex;align-items:center;gap:1em;flex-wrap:wrap;margin:0 0 1.05em}
.cso-simple-head__label{font-size:1.13em;font-weight:650;opacity:.85}
.cso-season-button{display:flex;align-items:center;gap:.7em;min-height:2.55em;padding:.55em 1.1em;border-radius:.65em;border:1px solid rgba(255,255,255,.24);background:rgba(255,255,255,.055);font-weight:600;cursor:pointer}
.cso-season-button .cso-season-caret{opacity:.65;font-size:.82em}
.cso-season-button.focus,.cso-season-button.hover,.cso-season-button:focus{background:#fff;color:#111;border-color:#fff}
.cso-list{display:flex;flex-direction:column;gap:.58em}
.cso-row{position:relative;display:flex;align-items:center;border:1px solid transparent;min-height:5.7em;border-radius:.85em;background:rgba(255,255,255,.055);overflow:hidden;cursor:pointer;transition:background .15s,border-color .15s}
.cso-row.focus,.cso-row.hover,.cso-row:focus{background:rgba(255,255,255,.11);border-color:rgba(255,255,255,.85)}
.cso-row__thumb{position:relative;width:10.5em;min-height:5.7em;align-self:stretch;flex:0 0 auto;background:linear-gradient(135deg,rgba(255,255,255,.11),rgba(255,255,255,.025));overflow:hidden}
.cso-row__thumb img{display:block;width:100%;height:100%;object-fit:cover;position:absolute;inset:0}
.cso-row__badge{position:absolute;left:.55em;bottom:.45em;font-size:.77em;font-weight:700;background:rgba(14,16,25,.7);padding:.3em .5em;border-radius:.36em;color:#fff}
.cso-row__body{flex:1;min-width:0;padding:.9em 1.25em}
.cso-row__title{font-weight:620;font-size:1.24em;line-height:1.3;overflow-wrap:break-word}
.cso-row__meta{opacity:.64;font-size:.85em;margin-top:.48em}
.cso-state{margin:1.1em 0;font-size:.91em;line-height:1.55;opacity:.76;max-width:58em}
.cso-state[data-state=fail]{opacity:1}
.cso-retry{display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.3);background:rgba(255,255,255,.075);padding:.75em 1.15em;border-radius:.65em;cursor:pointer}
.cso-retry.focus,.cso-retry.hover,.cso-retry:focus{background:#fff;color:#111}
.cso-movie-button{padding:1em 2.2em;background:rgba(255,255,255,.11);display:inline-flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.3);border-radius:.7em;font-weight:650;cursor:pointer}
.cso-movie-button.focus,.cso-movie-button.hover,.cso-movie-button:focus{background:#fff;color:#111}
@media(max-width:700px){.cso-root{padding:.8em .85em 3em}.cso-hero__poster{width:5.4em;height:3.6em}.cso-hero__title{font-size:1.3em}.cso-row__thumb{width:6.8em;min-height:5.2em}.cso-row__body{padding:.75em .8em}.cso-row__title{font-size:1.05em}}
@media(prefers-reduced-motion:reduce){.cso-row{transition:none}}
`;
function serialMedia(movie){ return !!(movie && (movie.name || movie.original_name || movie.number_of_seasons || movie.first_air_date || movie.media_type==='tv')); }
function safePoster(Lampa, movie) {
  const raw=movie && (movie.backdrop_path||movie.poster_path);
  if (typeof raw!=='string' || !/^\/[a-zA-Z0-9_./-]+\.(?:jpe?g|png|webp)$/i.test(raw)) return '';
  if (Lampa.TMDB && typeof Lampa.TMDB.image==='function') { try { return Lampa.TMDB.image('t/p/w300'+raw); } catch (_) {} }
  return 'https://image.tmdb.org/t/p/w300'+raw;
}
function install(Lampa) {
  if (!Lampa || !Lampa.Component || !Lampa.Listener || !Lampa.Player || !Lampa.Scroll || !Lampa.Explorer) return false;
  if (window.__capsule_next_plugin) return true;
  const $=window.jQuery||window.$;
  if (!$) return false;
  window.__capsule_next_plugin=true;
  if (!$('#capsule-next-style').length) $('<style id="capsule-next-style"></style>').text(CSS).appendTo('head');
  const transport=lampaTransport(Lampa);
  const playback=new PlaybackManager(Lampa,transport);
  function Screen(object) {
    const movie=object.movie||{};
    const media={movie,serial:serialMedia(movie)};
    const scroll=new Lampa.Scroll({mask:true,over:true});
    const explorer=new Lampa.Explorer(object);
    const root=$('<div class="cso-root"></div>');
    const poster=$('<img class="cso-hero__poster" alt="">');
    const posterUrl=safePoster(Lampa,movie);
    if (posterUrl) poster.attr('src',posterUrl);
    else poster.addClass('cso-hero__poster--empty');
    const title=$('<div class="cso-hero__title"></div>').text(movie.title||movie.name||'Capsule');
    const desc=$('<div class="cso-hero__desc"></div>').text(media.serial?'Все доступные серии':'Автоматический выбор воспроизведения');
    const hero=$('<div class="cso-hero"></div>').append(poster,$('<div class="cso-hero__body"></div>').append(title,desc));
    const seasonBtn=$('<div class="cso-season-button selector" tabindex="0"></div>');
    const toolbar=$('<div class="cso-simple-head"></div>').append($('<span class="cso-simple-head__label"></span>').text('Серии'),seasonBtn);
    const content=$('<div class="cso-list"></div>');
    const state=$('<div class="cso-state" aria-live="polite"></div>');
    const retry=$('<div class="cso-retry selector" tabindex="0">Повторить поиск</div>').hide();
    root.append(hero,media.serial?toolbar:$('<div></div>'),content,state,retry);
    scroll.body().append(root);
    explorer.appendFiles(scroll.render());
    let plan=[],catalog=null,finished=false,selectedSeason=null,seasonTouched=false;
    let fingerprint='',focusedId='',destroyed=false,started=false,opening=false;
    let engine=null,searchGeneration=0;
    function chooseServer(index) { return SERVERS[index % SERVERS.length]; }
    function bind(element,action) {
      let lastEvent=0;
      element.on('hover:enter click',function(event){
        const now=Date.now();
        if (event.type==='click' && now-lastEvent<450) return;
        lastEvent=now;
        action();
      });
      element.on('hover:focus',function(){
        focusedId=element.attr('data-cso-id')||'';
        try { scroll.update(element,true); } catch (_) {}
      });
    }
    function focusRestore(){
      if (!started || destroyed) return;
      try {
        Lampa.Controller.collectionSet(scroll.render(),explorer.render());
        const available=root.find('.selector:visible');
        let target=focusedId ? available.filter(function(){return $(this).attr('data-cso-id')===focusedId;})[0] : null;
        if (!target) target=available[0];
        if (target) Lampa.Controller.collectionFocus(target,scroll.render());
      } catch (_) {}
    }
    function chooseSeason(){
      if (!catalog || !Lampa.Select || typeof Lampa.Select.show!=='function') return;
      const nums=Array.from(new Set(plan.map(p=>p.season).filter(n=>n!==null))).sort((a,b)=>a-b);
      if (!nums.length) return;
      Lampa.Select.show({title:'Выберите сезон',items:nums.map(n=>({title:'Сезон '+n,season:n})),
        onBack:()=>Lampa.Controller.toggle('content'),
        onSelect:item=>{
          selectedSeason=item.season; seasonTouched=true;
          fingerprint=''; render();
          Lampa.Controller.toggle('content');
          focusRestore();
        }});
    }
    seasonBtn.attr('data-cso-id','season');
    bind(seasonBtn,chooseSeason);
    function play(entry){
      if (opening||!entry||!entry.primary) return;
      opening=true;
      playback.start(plan,entry,media).catch(()=>{
        if (Lampa.Noty) Lampa.Noty.show('Не удалось запустить видео');
      }).finally(()=>{opening=false;});
    }
    function render(){
      if (!catalog || destroyed) return;
      const allSeasons=Array.from(new Set(plan.map(p=>p.season).filter(n=>n!==null))).sort((a,b)=>a-b);
      if (!seasonTouched && media.serial) selectedSeason=allSeasons.find(n=>n>0) ?? allSeasons[0] ?? null;
      if (seasonTouched && !allSeasons.includes(selectedSeason)) selectedSeason=allSeasons[0] ?? null;
      const visible=media.serial?plan.filter(p=>p.season===selectedSeason):plan;
      const rowkey=JSON.stringify({s:selectedSeason,rows:visible.map(e=>[e.key,e.primary&&e.primary.id]),done:finished});
      if (rowkey===fingerprint) return;
      fingerprint=rowkey;
      if (media.serial) seasonBtn.empty().append($('<span></span>').text(selectedSeason===null?'Сезоны':'Сезон '+selectedSeason),$('<span class="cso-season-caret"></span>').text('▾'));
      content.empty();
      if (!media.serial && visible.length) {
        const row=$('<div class="cso-movie-button selector" tabindex="0">Смотреть</div>').attr('data-cso-id','movie');
        bind(row,()=>play(visible[0]));content.append(row);
      } else if (media.serial) {
        visible.forEach(entry=>{
          const row=$('<div class="cso-row online-prestige selector" tabindex="0"></div>').attr('data-cso-id',entry.key);
          const thumb=$('<div class="cso-row__thumb"></div>');
          if (posterUrl) thumb.append($('<img alt="" loading="lazy">').attr('src',posterUrl));
          thumb.append($('<span class="cso-row__badge"></span>').text(String(entry.episode)));
          const info=$('<div class="cso-row__body"></div>');
          info.append($('<div class="cso-row__title"></div>').text('Серия '+entry.episode+(entry.edition==='main'?'':' · '+entry.edition)));
          info.append($('<div class="cso-row__meta"></div>').text('Нажмите для просмотра'));
          row.append(thumb,info);bind(row,()=>play(entry));content.append(row);
        });
      }
      focusRestore();
    }
    function statusInfo(data){
      const states=Array.from(data.catalog.sources.values());
      const ended=states.filter(v=>v.state!==STATES.LOADING&&v.state!==STATES.PARTIAL).length;
      // PARTIAL is terminal only after the search promise settles.
      const failures=states.filter(v=>v.state===STATES.ERROR||v.state===STATES.PARTIAL).length;
      const total=states.length;
      if (data.done) finished=true;
      const summary=data.plan.length ? media.serial?data.plan.length+' серий доступно':'Фильм найден' : '';
      if (!finished) {
        state.attr('data-state','search').text((summary?summary+' · ':'')+'Проверяем каталоги ('+ended+'/'+total+')…');
        retry.hide();
      } else if (data.plan.length) {
        state.attr('data-state','ready').text(summary+(failures?' · Некоторые источники ответили не полностью.':'') );
        retry.hide();
      } else {
        state.attr('data-state','fail').text('Не удалось получить воспроизводимые данные. '+
          (failures?'Часть источников недоступна или вернула ошибку.':'Источники не нашли доступных вариантов.'));
        retry.show();
      }
    }
    function update(data){
      if (destroyed) return;
      plan=data.plan;catalog=data.catalog;
      statusInfo(data);render();
    }
    bind(retry,()=>startSearch(true));
    async function startSearch(again){
      if (destroyed) return;
      searchGeneration++;
      const version=searchGeneration;
      if (engine) engine.cancel();
      finished=false;fingerprint='';
      state.attr('data-state','search').text('Поиск доступных источников…');
      retry.hide();
      // Server failures are isolated: retrying once on another known Skaz mirror
      // is safe, but never recursively retry indefinitely.
      const index=again ? 1 : 0;
      engine=new SearchEngine({fetchText:transport,parseHtml:parseHtmlInBrowser,server:chooseServer(index),onUpdate:update});
      try {
        await engine.search(media);
      } catch (e) {
        if (destroyed || version!==searchGeneration) return;
        finished=true;
        state.attr('data-state','fail').text('Ошибка поиска: '+String(e&&e.message||'неизвестная ошибка'));
        retry.show();
        focusRestore();
      }
    }
    this.create=()=>explorer.render();
    this.render=()=>explorer.render();
    this.start=()=>{
      if (started) {Lampa.Controller.toggle('content');return;}
      started=true;
      Lampa.Controller.add('content',{
        toggle:()=>{
          Lampa.Controller.collectionSet(scroll.render(),explorer.render());
          const f=root.find('.selector:visible')[0];
          if(f) Lampa.Controller.collectionFocus(f,scroll.render());
        },
        left:()=>Lampa.Navigator.canmove('left')?Lampa.Navigator.move('left'):Lampa.Controller.toggle('menu'),
        right:()=>Lampa.Navigator.move('right'),
        up:()=>Lampa.Navigator.canmove('up')?Lampa.Navigator.move('up'):Lampa.Controller.toggle('head'),
        down:()=>Lampa.Navigator.move('down'),
        back:()=>Lampa.Activity.backward()
      });
      Lampa.Controller.toggle('content');
      startSearch(false);
    };
    this.pause=()=>{};
    this.stop=()=>{};
    this.destroy=()=>{
      destroyed=true;
      if (engine) engine.cancel();
      playback.stop();
      scroll.destroy();root.remove();
    };
  }
  Lampa.Component.add(COMPONENT,Screen);
  Lampa.Listener.follow('full',e=>{
    if (!e || e.type!=='complite') return;
    const card=e.data&&e.data.movie,activity=e.object&&e.object.activity;
    if (!card||!activity) return;
    const container=activity.render();
    if (!container || container.find('.capsule-next-start').length) return;
    const button=$('<div class="full-start__button selector capsule-next-start" tabindex="0"><span>Capsule Online</span></div>');
    let last=0;
    button.on('hover:enter click',event=>{
      if(event.type==='click'&&Date.now()-last<450)return;
      last=Date.now();
      Lampa.Activity.push({title:'Capsule Online',url:'',component:COMPONENT,movie:card,page:1});
    });
    const holder=container.find('.full-start-new__buttons,.full-start__buttons').first();
    if(holder.length) holder.append(button);
    else {
      const anchor=container.find('.view--torrent,.full-start__button').first();
      if(anchor.length)anchor.after(button);
      else container.append(button);
    }
  });
  if (Lampa.Manifest) Lampa.Manifest.plugins={type:'video',version:'0.2.0',name:'Capsule Online',
    description:'Автоматический поиск и единый каталог',component:COMPONENT,
    onContextLauch:movie=>Lampa.Activity.push({title:'Capsule Online',url:'',component:COMPONENT,movie,page:1})};
  return true;
}
module.exports={install,COMPONENT,SERVERS,CSS,serialMedia,safePoster};

};
__modules["src/main.js"] = function(module, exports, __require) {
'use strict';
const { install } = __require("src/ui/lampa.js");
(function boot() {
  if (typeof window === 'undefined') return;
  if (window.Lampa && window.Lampa.Component) { install(window.Lampa); return; }
  if (window.Lampa && window.Lampa.Listener) window.Lampa.Listener.follow('app', () => install(window.Lampa));
})();

};
function __require(id){if(__cache[id])return __cache[id].exports;var fn=__modules[id];if(!fn)throw Error('Missing '+id);var m={exports:{}};__cache[id]=m;fn(m,m.exports,__require);return m.exports;}
__require('src/main.js');
})();
