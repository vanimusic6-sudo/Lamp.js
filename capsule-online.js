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
class NetworkError extends Error { constructor(message, code) { super(message); this.name = 'NetworkError'; this.code = code; } }
function assertSkaz(url) {
  if (!validHttpUrl(url)) throw new NetworkError('Rejected malformed URL', 'URL');
  const u = new URL(url);
  if (!(u.hostname === 'skaz.tv' || u.hostname.endsWith('.skaz.tv')))
    throw new NetworkError('Rejected non-Skaz endpoint', 'HOST');
  // No silent downgrade to insecure HTTP: default backend uses HTTPS.
  if (u.protocol !== 'https:') throw new NetworkError('Insecure transport is disabled', 'HTTP');
  return u.href;
}
function resolveLink(current, next) {
  try {
    const u = new URL(next, current);
    // Skaz's old plugin publishes HTTP links. Upgrade *only* its known hosts.
    if (u.protocol === 'http:' && (u.hostname === 'skaz.tv' || u.hostname.endsWith('.skaz.tv'))) u.protocol = 'https:';
    return assertSkaz(u.href);
  } catch (_) { return ''; }
}
function lampaTransport(Lampa) {
  return function fetchText(url, signal, timeoutMs) {
    assertSkaz(url);
    return new Promise((resolve, reject) => {
      const client = new Lampa.Reguest();
      let settled = false;
      let timer;
      function finish(error, value) {
        if (settled) return;
        settled = true;
        if (timer) clearTimeout(timer);
        if (signal) signal.removeEventListener('abort', abort);
        if (error) reject(error); else resolve(value);
      }
      function abort() { try { client.clear(); } catch (_) {} finish(new NetworkError('Aborted', 'ABORT')); }
      if (signal && signal.aborted) return abort();
      if (signal) signal.addEventListener('abort', abort, { once: true });
      const ms = Math.max(1000, timeoutMs || 10000);
      client.timeout(ms);
      timer = setTimeout(() => { try { client.clear(); } catch (_) {} finish(new NetworkError('Timed out','TIMEOUT')); }, ms + 500);
      try {
        client.native(url, value => finish(null, value), err => finish(new NetworkError('Request failed', String(err && err.status || 'NETWORK'))), false, { dataType: 'text' });
      } catch (_) { finish(new NetworkError('Transport error', 'TRANSPORT')); }
    });
  };
}
const wait = (ms, signal) => new Promise((resolve,reject) => {
  if (signal && signal.aborted) return reject(new NetworkError('Aborted','ABORT'));
  let timer;
  function abort() { clearTimeout(timer); reject(new NetworkError('Aborted','ABORT')); }
  timer = setTimeout(() => { if (signal) signal.removeEventListener('abort',abort); resolve(); },ms);
  if (signal) signal.addEventListener('abort',abort,{once:true});
});
module.exports = { NetworkError, assertSkaz, resolveLink, lampaTransport, wait };

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
  result.buttons.forEach(push);
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
const { STATES, validHttpUrl } = __require("src/core/model.js");

function appendSearch(url, media) {
  const m = media.movie;
  const u = new URL(assertSkaz(url));
  const pairs = {
    id: m.id || '', imdb_id: m.imdb_id || '', kinopoisk_id: m.kinopoisk_id || '', tmdb_id: m.tmdb_id || '',
    title: m.title || m.name || '', original_title: m.original_title || m.original_name || '',
    serial: media.serial ? 1 : 0, original_language: m.original_language || '',
    year: String(m.release_date || m.first_air_date || '').slice(0,4), source: m.source || 'tmdb',
    clarification: 0, similar: 0, rchtype: ''
  };
  Object.keys(pairs).forEach(k => u.searchParams.set(k, String(pairs[k])));
  return u.href;
}
function hostBase(url) { return new URL(assertSkaz(url)).origin + '/'; }
function normalizeSourceUrl(url, base) { return resolveLink(base, url); }

class SkazRegistry {
  constructor(fetchText, server) { this.fetchText = fetchText; this.server = hostBase(server); }
  async discover(media, onFound, signal, opts) {
    const options = opts || {};
    const maxPolls = options.maxPolls || 18;
    let payload = parseAnyJson(await this.fetchText(appendSearch(this.server + 'lite/events?life=true', media), signal, 15000));
    if (!payload || typeof payload !== 'object' || payload.rch || payload.blocked || payload.accsdb)
      throw new Error('Unrecognized or restricted source registry');
    const seen = new Set();
    const accept = (data) => {
      const list = Array.isArray(data.online) ? data.online : Array.isArray(data) ? data : [];
      list.forEach(entry => {
        const id = findAdapter(entry, media);
        if (!id || !entry.url) return;
        const url = normalizeSourceUrl(entry.url, this.server);
        if (!url || seen.has(id + '\u0000' + url)) return;
        seen.add(id + '\u0000' + url);
        onFound(id, url, entry);
      });
    };
    accept(payload);
    if (!payload.life && !payload.memkey) return { complete: true, found: seen.size };
    if (payload.ready) return { complete: true, found: seen.size };
    if (!payload.memkey) return { complete: false, found: seen.size, reason: 'Missing memkey' };
    for (let poll = 0; poll < maxPolls; poll++) {
      await wait(options.delayMs || 1000, signal);
      const pollUrl = appendSearch(this.server + 'lifeevents?memkey=' + encodeURIComponent(payload.memkey), media);
      try {
        payload = parseAnyJson(await this.fetchText(pollUrl,signal,6000));
        if (!payload) return { complete: false, found: seen.size, reason: 'Invalid polling response' };
        accept(payload);
        if (payload.ready) return { complete: true, found: seen.size };
      } catch (e) {
        if (signal && signal.aborted) throw e;
        if (poll === maxPolls - 1) return { complete: false, found: seen.size, reason: 'Polling unavailable' };
      }
    }
    return { complete: false, found: seen.size, reason: 'Discovery deadline reached' };
  }
}

class GraphCrawler {
  constructor(options) {
    this.catalog = options.catalog;
    this.source = options.source;
    this.fetchText = options.fetchText;
    this.parseHtml = options.parseHtml || parseHtmlInBrowser;
    this.signal = options.signal;
    this.onChange = options.onChange || function() {};
    this.concurrency = options.concurrency || 2;
    this.maxNodes = options.maxNodes || 10000; // hard safety guard, never counted as complete on overflow
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
  addRoot(url, media) {
    const target = appendSearch(url, media);
    this.enqueue(target, {});
  }
  enqueue(url, context) {
    if (this.sealed && this._settled) return;
    const target = resolveLink(url,url);
    if (!target || this.visited.has(target) || this.pending.has(target)) return;
    if (this.visited.size + this.pending.size >= this.maxNodes) {
      if (!this.issues.includes('Safety request ceiling reached')) this.issues.push('Safety request ceiling reached');
      this.onChange();
      return;
    }
    this.pending.add(target);
    this.queue.push({ url: target, context });
    this.started = true;
    this.pump();
  }
  seal() { this.sealed = true; this.pump(); }
  stop() { this.sealed = true; this.queue.length = 0; this.pending.clear(); this.pump(); }
  async page(task) {
    const signal = this.signal;
    let payload;
    for (let attempt = 0; attempt < 2; attempt++) {
      try { payload = await this.fetchText(task.url, signal, 11000); break; }
      catch (e) {
        if (signal && signal.aborted) return;
        if (attempt === 1) { this.failedPages++; this.issues.push('Network: ' + String(e && e.code || 'error')); return; }
        await wait(350,signal).catch(() => {});
      }
    }
    let parsed;
    try { parsed = parseSkazPage(payload, this.parseHtml); }
    catch (_) { this.failedPages++; this.issues.push('Failed to parse response'); return; }
    if (parsed.error) { this.failedPages++; this.issues.push(parsed.error); return; }
    if (parsed.relay) {
      const relay = resolveLink(task.url,parsed.relay);
      if (relay) this.enqueue(relay,task.context);
      else { this.failedPages++; this.issues.push('Unsupported relay host'); }
      return;
    }
    this.pages++;
    if (this.catalog.sources.get(this.source)?.state === STATES.LOADING)
      this.catalog.sourceStatus(this.source,STATES.PARTIAL,'Catalogue traversal in progress');
    const unresolvedBefore = this.catalog.unresolved.length;
    parsed.items.forEach(item => {
      const season = item.season == null ? task.context.season : item.season;
      const episode = item.episode;
      const voice = item.voice_name || item.translate || parsed.activeVoice || task.context.voice || '';
      const playUrl = item.method === 'play' ?
        (() => { try {
          // Preserve the provider's `url1 or url2` delimiter (URL.href would encode spaces).
          const literal = String(item.url || '');
          return validHttpUrl(literal) ? literal : (validHttpUrl(new URL(literal,task.url).href) ? new URL(literal,task.url).href : '');
        } catch (_) { return ''; } })() : resolveLink(task.url,item.url);
      const row = { source: this.source, method: item.method, url: playUrl,
        stream: item.stream, season, episode, voice,
        voiceId: item.voice_id || item.translation_id || '',
        quality: extractQuality(item),
        subtitles: item.subtitles, edition: item.edition || 'main',
        confirmed: false }; // URL discovery is not proof of successful playback.
      if (this.catalog.add(row)) this.added++;
    });
    if (this.catalog.unresolved.length > unresolvedBefore) this.issues.push('Unresolved episode identities');
    parsed.links.forEach(link => {
      const url = resolveLink(task.url,link.url);
      if (!url) { this.issues.push('Rejected linked URL'); return; }
      const season = isSeasonLabel(link.text) ? seasonFromLabel(link.text) : task.context.season;
      const voice = isSeasonLabel(link.text) ? (parsed.activeVoice || task.context.voice) : (link.text || task.context.voice);
      this.enqueue(url, { season, voice });
    });
    this.onChange();
  }
  pump() {
    while (this.running < this.concurrency && this.queue.length && !(this.signal && this.signal.aborted)) {
      const task = this.queue.shift();
      this.pending.delete(task.url);
      if (this.visited.has(task.url)) continue;
      this.visited.add(task.url);
      this.running++;
      this.page(task).catch(e => {
        if (!(this.signal && this.signal.aborted)) { this.failedPages++; this.issues.push(String(e && e.message || 'Unknown')); }
      }).finally(() => { this.running--; this.onChange(); this.pump(); });
    }
    if (this.sealed && this.running === 0 && (this.queue.length === 0 || (this.signal && this.signal.aborted)) && !this._settled) {
      this._settled = true;
      const state = this.signal && this.signal.aborted ? STATES.PARTIAL : this.issues.length ?
        (this.pages ? STATES.PARTIAL : STATES.ERROR) : STATES.COMPLETE;
      this.catalog.sourceStatus(this.source,state,
        'pages=' + this.pages + ', variants=' + this.added + (this.issues.length ? ', issues=' + this.issues.length : ''));
      this.onChange();
      this._resolve({ source: this.source, state, pages: this.pages, variants: this.added, issues: this.issues.slice() });
    }
  }
}
module.exports = { SkazRegistry, GraphCrawler, appendSearch };

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
    this.onUpdate = options.onUpdate || function() {};
    this.generation = 0;
    this.abortController = null;
    this._lastRevision = -1;
    this._renderTimer = null;
  }
  cancel() {
    if (this.abortController) this.abortController.abort();
    if (this._renderTimer) { clearTimeout(this._renderTimer); this._renderTimer = null; }
    this.generation++;
  }
  emit(catalog, gen) {
    if (this.generation !== gen) return;
    if (catalog.revision === this._lastRevision) return;
    this._lastRevision = catalog.revision;
    const snapshot = catalog.snapshot();
    this.onUpdate({ catalog: snapshot, plan: select(snapshot) });
  }
  schedule(catalog, gen) {
    if (this._renderTimer || this.generation !== gen) return;
    this._renderTimer = setTimeout(() => {
      this._renderTimer = null;
      this.emit(catalog,gen);
    }, 80);
  }
  async search(media) {
    this.cancel();
    const gen = this.generation;
    const controller = new AbortController();
    this.abortController = controller;
    const catalog = new Catalog(media);
    const sourceList = allowed(media);
    const crawlers = new Map();
    sourceList.forEach(source => catalog.sourceStatus(source,STATES.LOADING,'Waiting for registry'));
    this.emit(catalog,gen);
    const registry = new SkazRegistry(this.fetchText, this.server);
    let discovery;
    try {
      discovery = await registry.discover(media,(source,url) => {
        if (this.generation !== gen || controller.signal.aborted) return;
        let crawler = crawlers.get(source);
        if (!crawler) {
          crawler = new GraphCrawler({ catalog, source, fetchText: this.fetchText, parseHtml: this.parseHtml,
            signal: controller.signal, onChange: () => this.schedule(catalog,gen) });
          crawlers.set(source,crawler);
          catalog.sourceStatus(source, STATES.LOADING,'Crawling');
        }
        crawler.addRoot(url,media);
        this.schedule(catalog,gen);
      },controller.signal);
    } catch (e) {
      if (this.generation !== gen || controller.signal.aborted) return null;
      discovery = { complete: false, reason: 'Registry request failed' };
    }
    if (this.generation !== gen || controller.signal.aborted) return null;
    sourceList.forEach(source => {
      const crawler = crawlers.get(source);
      if (crawler) crawler.seal();
      else catalog.sourceStatus(source, discovery.complete ? STATES.UNAVAILABLE : STATES.PARTIAL,
        discovery.complete ? 'Not listed by registry' : (discovery.reason || 'Registry incomplete'));
    });
    this.emit(catalog,gen);
    await Promise.all(Array.from(crawlers.values()).map(c => c.done));
    if (this.generation !== gen || controller.signal.aborted) return null;
    this.emit(catalog,gen);
    return { catalog: catalog.snapshot(), plan: select(catalog.snapshot()), discovery };
  }
}
module.exports = { SearchEngine };

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
      L.Player.playlist(playlist);
      L.Player.play(first);
    } catch (_) { if (generation === this.session && L.Noty) L.Noty.show('Не удалось получить рабочую ссылку'); }
  }
}
module.exports = { PlaybackManager, resolveCandidate, mediaUrl };

};
__modules["src/ui/lampa.js"] = function(module, exports, __require) {
'use strict';
const { SearchEngine } = __require("src/core/engine.js");
const { PlaybackManager } = __require("src/playback/manager.js");
const { allowed } = __require("src/sources/adapters.js");
const { STATES } = __require("src/core/model.js");
const { lampaTransport } = __require("src/core/network.js");
const { parseHtmlInBrowser } = __require("src/sources/skaz-parser.js");

const COMPONENT = 'capsule_next_online';
const SERVER = 'https://online3.skaz.tv/'; // Must be checked on a live Lampa installation.
const CSS = `
.cnext-screen{padding:1.2em 1.4em 3em;max-width:88em}
.cnext-title{font-size:1.8em;font-weight:650;margin:0 0 .25em;line-height:1.25}
.cnext-subtitle{opacity:.65;font-size:.88em;margin:0 0 1em}
.cnext-seasons{display:flex;flex-wrap:wrap;gap:.6em;margin:0 0 1.3em}
.cnext-season,.cnext-episode,.cnext-movie{border-radius:.55em;background:rgba(255,255,255,.08);color:inherit;cursor:pointer;transition:background .12s}
.cnext-season{padding:.7em 1em;min-width:5.2em;text-align:center}
.cnext-season--selected{box-shadow:inset 0 0 0 2px rgba(255,255,255,.55)}
.cnext-episode{padding:.9em 1em;margin:.36em 0;display:flex;align-items:center;gap:.8em;min-height:2.6em}
.cnext-num{opacity:.55;min-width:2.7em}.cnext-label{flex:1}
.cnext-movie{padding:1em 1.7em;display:inline-flex;align-items:center;min-height:2.4em;font-size:1.1em}
.cnext-season.focus,.cnext-season.hover,.cnext-episode.focus,.cnext-episode.hover,.cnext-movie.focus,.cnext-movie.hover,
.cnext-season:focus,.cnext-episode:focus,.cnext-movie:focus{background:#f4f4f4;color:#111}
.cnext-empty{opacity:.7;padding:1em 0}
@media(max-width:700px){.cnext-screen{padding:.85em}.cnext-title{font-size:1.3em}.cnext-season{padding:.7em .8em}}
`;

function install(Lampa) {
  if (!Lampa || !Lampa.Component || !Lampa.Listener || !Lampa.Player || !Lampa.Scroll || !Lampa.Explorer) return false;
  if (window.__capsule_next_plugin) return true;
  const $ = window.jQuery || window.$;
  if (!$) return false;
  window.__capsule_next_plugin = true;
  $('<style id="capsule-next-style"></style>').text(CSS).appendTo('head');
  const transport = lampaTransport(Lampa);
  const playback = new PlaybackManager(Lampa,transport);

  function Screen(object) {
    const self = this;
    const media = { movie: object.movie || {}, serial: !!(object.movie && (object.movie.name || object.movie.number_of_seasons)) };
    const scroll = new Lampa.Scroll({ mask: true, over: true });
    const explorer = new Lampa.Explorer(object);
    const root = $('<div class="cnext-screen"></div>');
    const heading = $('<h2 class="cnext-title"></h2>').text(media.movie.title || media.movie.name || 'Видео');
    const status = $('<div class="cnext-subtitle"></div>').text('Поиск источников…');
    const seasons = $('<div class="cnext-seasons"></div>');
    const contents = $('<div class="cnext-content"></div>');
    root.append(heading,status,seasons,contents);
    scroll.body().append(root);
    explorer.appendFiles(scroll.render());
    let viewPlan = [];
    let viewCatalog = null;
    let selectedSeason = null;
    let seasonWasSelected = false;
    let visibleFingerprint = '';
    let focused = null;
    let wasDestroyed = false;
    let opening = false;
    let started = false;
    const engine = new SearchEngine({ fetchText: transport, parseHtml: parseHtmlInBrowser, server: SERVER,
      onUpdate: update });

    function activate(element, handler) {
      element.on('hover:enter click',function(ev) {
        if (ev && ev.type === 'click' && Date.now() - (element.data('cnext-enter') || 0) < 400) return;
        if (ev && ev.type === 'hover:enter') element.data('cnext-enter',Date.now());
        handler();
      });
      element.on('hover:focus',function() {
        focused = element.attr('data-cnext-id');
        scroll.update(element,true);
      });
    }
    function openEntry(entry) {
      if (opening || !entry || !entry.primary) return;
      opening = true;
      playback.start(viewPlan,entry,media).finally(() => { opening=false; });
    }
    function update(data) {
      if (wasDestroyed) return;
      viewPlan = data.plan;
      viewCatalog = data.catalog;
      const states = Array.from(data.catalog.sources.values()).map(s => s.state);
      const complete = states.filter(s => s === STATES.COMPLETE || s === STATES.UNAVAILABLE).length;
      const partial = states.some(s => s === STATES.PARTIAL || s === STATES.ERROR);
      const allFinished = states.every(s => s === STATES.COMPLETE || s === STATES.UNAVAILABLE || s === STATES.PARTIAL || s === STATES.ERROR);
      const count = viewPlan.length;
      const label = count ? (media.serial ? count + ' серий найдено' : 'Фильм найден') : 'Идёт поиск';
      status.text(label + ' · ' + complete + '/' + states.length + ' источников проверено' +
        (partial ? ' · некоторые данные недоступны' : allFinished ? '' : ' · предварительный каталог'));
      redraw();
    }
    function redraw() {
      if (!viewCatalog) return;
      const seasonNumbers = [...new Set(viewPlan.map(e => e.season).filter(n => n != null))].sort((a,b) => a-b);
      if (!seasonWasSelected && media.serial) selectedSeason = seasonNumbers.find(n => n > 0) ?? seasonNumbers[0] ?? null;
      if (seasonWasSelected && !seasonNumbers.includes(selectedSeason)) selectedSeason = seasonNumbers[0] ?? null;
      const shown = media.serial ? viewPlan.filter(e => e.season === selectedSeason) : viewPlan;
      const fingerprint = JSON.stringify({ seasons: seasonNumbers, selectedSeason,
        rows: shown.map(e => [e.key,e.primary && e.primary.id]) });
      if (fingerprint === visibleFingerprint) return;
      visibleFingerprint = fingerprint;
      seasons.empty();
      contents.empty();
      if (media.serial) seasonNumbers.forEach(season => {
        const btn = $('<div class="cnext-season selector" tabindex="0"></div>').text('Сезон ' + season);
        btn.attr('data-cnext-id','season-'+season);
        if (season === selectedSeason) btn.addClass('cnext-season--selected');
        activate(btn,() => { selectedSeason=season; seasonWasSelected=true; visibleFingerprint=''; redraw(); });
        seasons.append(btn);
      });
      if (!shown.length) {
        const waiting = Array.from(viewCatalog.sources.values()).some(s => s.state === STATES.LOADING || s.state === STATES.PARTIAL);
        contents.append($('<div class="cnext-empty"></div>').text(waiting ? 'Каталог дополняется…' : 'Доступные варианты не найдены'));
      } else if (!media.serial) {
        const btn = $('<div class="cnext-movie selector" tabindex="0">Смотреть</div>');
        btn.attr('data-cnext-id','movie');
        activate(btn,() => openEntry(shown[0]));
        contents.append(btn);
      } else shown.forEach(entry => {
        const item = $('<div class="cnext-episode selector" tabindex="0"></div>');
        item.attr('data-cnext-id',entry.key);
        item.append($('<span class="cnext-num"></span>').text(entry.episode));
        item.append($('<span class="cnext-label"></span>').text(entry.edition === 'main' ? 'Серия ' + entry.episode : 'Серия ' + entry.episode + ' · ' + entry.edition));
        activate(item,() => openEntry(entry));
        contents.append(item);
      });
      if (started) {
        Lampa.Controller.collectionSet(scroll.render(),explorer.render());
        const target = focused && root.find('.selector').filter(function() { return $(this).attr('data-cnext-id') === focused; });
        if (target && target.length) Lampa.Controller.collectionFocus(target[0],scroll.render());
      }
    }
    this.create = () => explorer.render();
    this.render = () => explorer.render();
    this.start = () => {
      started=true;
      Lampa.Controller.add('content', {
        toggle: () => { Lampa.Controller.collectionSet(scroll.render(),explorer.render()); Lampa.Controller.collectionFocus(root.find('.selector')[0] || false,scroll.render()); },
        left: () => Lampa.Navigator.canmove('left') ? Lampa.Navigator.move('left') : Lampa.Controller.toggle('menu'),
        right: () => Lampa.Navigator.move('right'),
        up: () => Lampa.Navigator.canmove('up') ? Lampa.Navigator.move('up') : Lampa.Controller.toggle('head'),
        down: () => Lampa.Navigator.move('down'),
        back: () => Lampa.Activity.backward()
      });
      Lampa.Controller.toggle('content');
      engine.search(media).catch(() => { if (!wasDestroyed) status.text('Ошибка поиска. Попробуйте открыть карточку повторно.'); });
    };
    this.pause = function() {};
    this.stop = function() {};
    this.destroy = () => { wasDestroyed=true; engine.cancel(); scroll.destroy(); root.remove(); };
  }
  Lampa.Component.add(COMPONENT,Screen);
  function addButton(e) {
    if (!e || e.type !== 'complite') return;
    const activity = e.object && e.object.activity;
    const card = e.data && e.data.movie;
    if (!activity || !card) return;
    const container = activity.render();
    if (!container || container.find('.cnext-start').length) return;
    const btn = $('<div class="full-start__button selector cnext-start" tabindex="0">Смотреть · Capsule</div>');
    activateCard(btn,card);
    const buttons = container.find('.full-start-new__buttons, .full-start__buttons').first();
    if (buttons.length) buttons.append(btn);
    else { const anchor = container.find('.view--torrent, .full-start__button').first();
      if (anchor.length) anchor.after(btn); else container.append(btn); }
  }
  function activateCard(btn,card) {
    let last=0;
    btn.on('hover:enter click',function(e) {
      if (e.type === 'click' && Date.now()-last < 400) return;
      last = Date.now();
      Lampa.Activity.push({ title: 'Capsule', url: '', component: COMPONENT, movie: card, page: 1 });
    });
  }
  Lampa.Listener.follow('full',addButton);
  if (Lampa.Manifest) Lampa.Manifest.plugins = {
    type: 'video', version: '0.1.0-research', name: 'Capsule Next', description: 'Автоматический каталог',component: COMPONENT,
    onContextLauch: card => Lampa.Activity.push({ title: 'Capsule', url:'', component: COMPONENT, movie:card, page:1 })
  };
  return true;
}
module.exports = { install, COMPONENT, SERVER };

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
