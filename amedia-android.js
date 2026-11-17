/**
 * Amedia Fast — слой ускорения и UI поверх оригинального Amedia (by Skaz).
 * Оригинальный a.js загружается без изменений: авторизация, handshake, WebSocket,
 * реклама и телеметрия остаются его собственными. Мы подменяем только загрузчик
 * HLS, конфиг плеера и экран выбора серии.
 *
 * ES5. Lampa 3.x / Android APK.
 */
(function () {
'use strict';

if (window.__amediaFast) return;
window.__amediaFast = '1.0.1';

var SOURCE = 'https://skaz.tv/amedia/a.js';

/* ------------------------------------------------------------------ *
 * Настройки
 * ------------------------------------------------------------------ */

function opt(name, def) {
  var v = Lampa.Storage.get('amedia_fast_' + name, def);
  if (v === 'true') return true;
  if (v === 'false') return false;
  return v;
}

var CFG = {
  loader:   function () { return opt('loader', true) !== false; },
  worker:   function () { return opt('worker', true) !== false; },
  direct:   function () { return opt('direct', true) !== false; },
  cache:    function () { return opt('cache', true) !== false; },
  grid:     function () { return opt('grid', true) !== false; },
  next:     function () { return opt('next', true) !== false; },
  parallel: function () { var n = parseInt(opt('parallel', 3), 10) || 3; return Math.max(1, Math.min(4, n)); },
  buffer:   function () { var n = parseInt(opt('buffer', 180), 10) || 180; return Math.max(60, Math.min(240, n)); },
  quality:  function () { return opt('quality', 'auto'); }
};

function log() {
  if (opt('debug', false) !== true) return;
  try { console.log.apply(console, ['[amedia-fast]'].concat([].slice.call(arguments))); } catch (e) {}
}

/* ------------------------------------------------------------------ *
 * Заголовки, которые браузер запрещает ставить из XHR.
 * Список совпадает с blocklist оригинала — в direct-режиме их пропускаем.
 * ------------------------------------------------------------------ */

var FORBIDDEN = {
  'user-agent': 1, 'origin': 1, 'referer': 1, 'host': 1, 'cookie': 1, 'cookie2': 1,
  'connection': 1, 'date': 1, 'expect': 1, 'keep-alive': 1, 'te': 1, 'trailer': 1,
  'transfer-encoding': 1, 'upgrade': 1, 'via': 1, 'accept-charset': 1,
  'accept-encoding': 1, 'access-control-request-headers': 1,
  'access-control-request-method': 1, 'content-length': 1,
  'sec-fetch-dest': 1, 'sec-fetch-mode': 1, 'sec-fetch-site': 1, 'sec-fetch-user': 1,
  'priority': 1, 'dnt': 1, 'upgrade-insecure-requests': 1
};

function usableHeaders(src) {
  var out = {};
  for (var k in src) {
    if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
    if (FORBIDDEN[k.toLowerCase()]) continue;
    out[k] = src[k];
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * Живые заголовки плеера.
 * Оригинал мутирует тот же объект, который передал в Player.play:
 * при ротации edge_hash он присваивает headers['Accepts-Controls'].
 * Вешаем accessor, чтобы узнавать об этом мгновенно, без поллинга.
 * ------------------------------------------------------------------ */

var HEADER_KEY = 'Accepts-Controls';
var waiters = [];
var liveHeaders = null;

function flushWaiters() {
  var list = waiters.slice();
  waiters = [];
  for (var i = 0; i < list.length; i++) {
    try { list[i](); } catch (e) {}
  }
}

function watchHeaders(h) {
  if (!h || h.__afastWatched) return;
  var value = h[HEADER_KEY];
  try {
    Object.defineProperty(h, HEADER_KEY, {
      configurable: true,
      enumerable: true,
      get: function () { return value; },
      set: function (v) {
        if (v === value) return;
        value = v;
        log('edge hash rotated');
        flushWaiters();
      }
    });
    Object.defineProperty(h, '__afastWatched', { value: true, enumerable: false });
  } catch (e) {}
}

/* ------------------------------------------------------------------ *
 * CDN-хосты. Оригинал складывает их в эти глобалы — переиспользуем,
 * чтобы не разбирать манифест самим.
 * ------------------------------------------------------------------ */

function cdnHosts() { return window.__amediaCdnHosts || []; }
function cdnIndex() { return window.__amediaCdnActiveIdx | 0; }

function isAmediaUrl(url) {
  if (!url) return false;
  var hosts = cdnHosts();
  for (var i = 0; i < hosts.length; i++) {
    if (hosts[i] && hostOf(url) === String(hosts[i]).replace(/^https?:\/\//, '').replace(/\/.*$/, '')) return true;
  }
  if (liveHeaders && liveHeaders.Referer) {
    var m = String(liveHeaders.Referer).match(/^https?:\/\/([^\/]+)/);
    if (m && hostOf(url) === m[1]) return true;
  }
  return false;
}

function applyCdn(url) {
  var hosts = cdnHosts(), idx = cdnIndex();
  if (!hosts.length || idx >= hosts.length) return url;
  return url.replace(/^(https?:\/\/)([^\/]+)/, function (all, proto, host) {
    if (!isAmediaUrl(proto + host + '/')) return all;
    return proto + hosts[idx];
  });
}

function rotateCdn(reason) {
  var hosts = cdnHosts();
  if (!hosts.length) return false;
  var next = cdnIndex() + 1;
  if (next >= hosts.length) { window.__amediaCdnActiveIdx = 0; return false; }
  window.__amediaCdnActiveIdx = next;
  log('cdn ->', hosts[next], reason || '');
  return true;
}

/* ------------------------------------------------------------------ *
 * LRU-кэш сегментов. Спасает при ретраях после ротации и при перемотке назад.
 * ------------------------------------------------------------------ */

var cacheMap = Object.create(null);
var cacheOrder = [];
var cacheBytes = 0;
var CACHE_LIMIT = (navigator.deviceMemory && navigator.deviceMemory <= 2 ? 48 : 96) * 1024 * 1024;

function cacheGet(url) {
  if (!CFG.cache()) return null;
  var hit = cacheMap[url];
  if (!hit) return null;
  var i = cacheOrder.indexOf(url);
  if (i !== -1) { cacheOrder.splice(i, 1); cacheOrder.push(url); }
  return hit;
}

function cachePut(url, buf) {
  if (!CFG.cache() || !buf || !buf.byteLength) return;
  if (buf.byteLength > CACHE_LIMIT / 3) return;
  if (cacheMap[url]) return;
  cacheMap[url] = buf;
  cacheOrder.push(url);
  cacheBytes += buf.byteLength;
  while (cacheBytes > CACHE_LIMIT && cacheOrder.length > 1) {
    var drop = cacheOrder.shift();
    cacheBytes -= (cacheMap[drop] ? cacheMap[drop].byteLength : 0);
    delete cacheMap[drop];
  }
}

function cacheClear() {
  cacheMap = Object.create(null); cacheOrder = []; cacheBytes = 0;
}

/* ------------------------------------------------------------------ *
 * Быстрое декодирование base64.
 * Побайтовый цикл оригинала на 4K-сегменте — десятки миллионов итераций.
 * data:URL отдаёт декодирование нативному коду браузера.
 * ------------------------------------------------------------------ */

function slowDecode(b64) {
  var bin = atob(b64);
  var len = bin.length;
  var out = new Uint8Array(len);
  for (var i = 0; i < len; i++) out[i] = bin.charCodeAt(i) & 0xff;
  return out.buffer;
}

function decodeBase64(b64) {
  if (window.fetch && b64.length < 40 * 1024 * 1024) {
    try {
      return fetch('data:application/octet-stream;base64,' + b64)
        .then(function (r) { return r.arrayBuffer(); })
        .catch(function () { return slowDecode(b64); });
    } catch (e) {}
  }
  try { return Promise.resolve(slowDecode(b64)); }
  catch (e) { return Promise.reject(e); }
}

/* ------------------------------------------------------------------ *
 * Мост в native-запросчик Лампы
 * ------------------------------------------------------------------ */

function unwrap(res) {
  var body = res;
  if (body && typeof body === 'object' && typeof body.body !== 'undefined') body = body.body;
  else if (typeof body === 'string' && body.charAt(0) === '{' && body.indexOf('"body"') !== -1) {
    try {
      var j = JSON.parse(body);
      if (j && typeof j.body !== 'undefined') body = j.body;
    } catch (e) {}
  }
  return typeof body === 'string' ? body : String(body == null ? '' : body);
}

function tooLarge(text) {
  return text.charAt(0) === '[' && text.indexOf('Response too large') !== -1;
}

function nativeCall(url, headers, dataType, timeout, ok, fail) {
  var net;
  try { net = new Lampa.Reguest(); } catch (e) { fail({ status: 0 }); return null; }
  try {
    net.native(url, function (res) { ok(unwrap(res)); },
      function (err) { fail(err || { status: 0 }); },
      false, { dataType: dataType, timeout: timeout || 15000, headers: headers, returnHeaders: false });
  } catch (e) { fail({ status: 0 }); return null; }
  return net;
}

/* ------------------------------------------------------------------ *
 * Параллельные Range-куски.
 * Оригинал тянет их строго по очереди — на 4K это 8–12 круговых запросов.
 * ------------------------------------------------------------------ */

var chunkSizeByHost = {};

function hostOf(url) {
  var m = String(url).match(/^https?:\/\/([^\/]+)/);
  return m ? m[1] : '';
}

function chunkSize(url) {
  return chunkSizeByHost[hostOf(url)] || 4 * 1024 * 1024;
}

function shrinkChunk(url) {
  var host = hostOf(url);
  var cur = chunkSizeByHost[host] || 4 * 1024 * 1024;
  var next = Math.max(256 * 1024, Math.floor(cur / 2));
  chunkSizeByHost[host] = next;
  return next;
}

function fetchRange(url, headers, from, to, ok, fail) {
  var h = usableHeaders(headers);
  h.Range = 'bytes=' + from + '-' + to;
  return nativeCall(url, h, 'base64', 20000, function (text) {
    if (tooLarge(text)) return ok({ large: true });
    if (!text.length) return ok({ buf: null });
    decodeBase64(text).then(function (buf) { ok({ buf: buf }); },
      function () { fail({ status: 0, text: 'decode' }); });
  }, fail);
}

function fetchChunked(url, headers, done, fail) {
  var size = chunkSize(url);
  var parallel = CFG.parallel();
  var parts = [];
  var nets = [];
  var active = 0;
  var nextIndex = 0;
  var endIndex = -1;
  var total = 0;
  var closed = false;
  var generation = 0;
  var MAX_BYTES = 512 * 1024 * 1024;

  function cancel() {
    for (var i = 0; i < nets.length; i++) {
      try { if (nets[i] && nets[i].clear) nets[i].clear(); } catch (e) {}
    }
    nets = [];
  }

  function stop() {
    if (closed) return;
    closed = true;
    generation++;
    cancel();
  }

  function error(err) {
    if (closed) return;
    stop();
    fail(err || { status: 0 });
  }

  function maybeFinish() {
    if (closed || endIndex < 0) return;
    for (var i = 0; i <= endIndex; i++) if (!parts[i]) return;
    var out = new Uint8Array(total), at = 0;
    for (var j = 0; j <= endIndex; j++) {
      out.set(new Uint8Array(parts[j]), at);
      at += parts[j].byteLength;
    }
    stop();
    done(out.buffer);
  }

  function pump() {
    if (closed) return;
    while (active < parallel && endIndex < 0 && !closed) {
      (function (slot, ticket) {
        active++;
        var start = slot * size;
        var net = fetchRange(url, headers, start, start + size - 1, function (res) {
          if (closed || ticket !== generation) return;
          active--;
          if (res.large) {
            if (size <= 256 * 1024) return error({ status: 0, text: 'range too large' });
            generation++;
            cancel();
            size = shrinkChunk(url);
            parts = []; total = 0; nextIndex = 0; endIndex = -1; active = 0;
            return pump();
          }
          var buf = res.buf;
          var len = buf ? buf.byteLength : 0;
          // Some CDNs ignore Range and return the whole file.
          if (len > size && slot === 0) {
            stop();
            return done(buf);
          }
          if (len > size) return error({ status: 0, text: 'range ignored' });
          if (!len) {
            endIndex = endIndex < 0 ? slot - 1 : Math.min(endIndex, slot - 1);
            if (endIndex < 0) return error({ status: 0, text: 'empty segment' });
          } else {
            parts[slot] = buf;
            total += len;
            if (total > MAX_BYTES) return error({ status: 0, text: 'segment too large' });
            if (len < size) endIndex = endIndex < 0 ? slot : Math.min(endIndex, slot);
          }
          maybeFinish();
          pump();
        }, function (err) {
          if (closed || ticket !== generation) return;
          active--;
          if (err && err.status === 416 && slot > 0) {
            endIndex = endIndex < 0 ? slot - 1 : Math.min(endIndex, slot - 1);
            maybeFinish();
            pump();
          } else error(err);
        });
        nets.push(net);
      })(nextIndex++, generation);
      if (nextIndex * size > MAX_BYTES + size) return error({ status: 0, text: 'segment too large' });
    }
  }

  pump();
  return { clear: stop };
}

/* ------------------------------------------------------------------ *
 * Direct-XHR. Если CDN отдаёт CORS — мост и base64 исчезают совсем.
 * Пробуем на первом же реальном запросе, отдельного пробника не делаем.
 * ------------------------------------------------------------------ */

var directMode = 'unknown'; // unknown | ok | no

function directFetch(url, context, headers, ok, fail) {
  var xhr = new XMLHttpRequest();
  var binary = context.responseType === 'arraybuffer';
  try { xhr.open('GET', url, true); } catch (e) { return fail({ status: 0, cors: true }); }
  xhr.responseType = binary ? 'arraybuffer' : 'text';
  xhr.timeout = 20000;

  var h = usableHeaders(headers);
  if (typeof context.rangeStart === 'number' && context.rangeStart >= 0) {
    var end = (typeof context.rangeEnd === 'number' && context.rangeEnd > context.rangeStart)
      ? context.rangeEnd - 1 : '';
    h.Range = 'bytes=' + context.rangeStart + '-' + end;
  }
  for (var k in h) { try { xhr.setRequestHeader(k, h[k]); } catch (e) {} }

  xhr.onload = function () {
    if (xhr.status >= 200 && xhr.status < 300) ok(xhr.response, xhr);
    else fail({ status: xhr.status, cors: false });
  };
  xhr.onerror = function () { fail({ status: 0, cors: true }); };
  xhr.ontimeout = function () { fail({ status: 0, timeout: true, cors: false }); };
  try { xhr.send(null); } catch (e) { return fail({ status: 0, cors: true }); }
  return xhr;
}

/* ------------------------------------------------------------------ *
 * Загрузчик HLS
 * ------------------------------------------------------------------ */

function newStats() {
  return {
    aborted: false, loaded: 0, retry: 0, total: 0, chunkCount: 0, bwEstimate: 0,
    loading: { start: 0, first: 0, end: 0 },
    parsing: { start: 0, end: 0 },
    buffering: { start: 0, first: 0, end: 0 }
  };
}

function now() {
  return window.performance && performance.now ? performance.now() : Date.now();
}

function buildFastLoader(BaseLoader, headers) {

  function FastLoader(config) {
    this.config = config;
    this.base = BaseLoader ? new BaseLoader(config) : null;
    this.stats = newStats();
    this.dead = false;
    this.pending = [];
    this.retries = 0;
  }

  FastLoader.prototype.trackSegment = function (url) {
    // оригинал по номеру сегмента уведомляет сервер о перемотке — сохраняем контракт
    var m = String(url).match(/-(\d+)-f\d+-[av]\d+\.ts/);
    if (!m) return;
    var n = parseInt(m[1], 10);
    if (isNaN(n)) return;
    var prev = window.__amediaLastSeg | 0;
    window.__amediaLastSeg = n;
    if (prev > 25 && Math.abs(n - prev) * 6 > 90 &&
        window.__amediaKsHandle && window.__amediaKsHandle.seeked) {
      try { window.__amediaKsHandle.seeked(); } catch (e) {}
    }
  };

  FastLoader.prototype.succeed = function (url, data, context, callbacks, network) {
    if (this.dead) return;
    var t = now();
    var len = data && (data.byteLength != null ? data.byteLength : data.length) || 0;
    this.stats.loading.first = this.stats.loading.first || t;
    this.stats.loading.end = t;
    this.stats.loaded = len;
    this.stats.total = len;
    this.stats.chunkCount++;
    var dt = this.stats.loading.end - this.stats.loading.start;
    if (dt > 0) this.stats.bwEstimate = Math.round(len * 8000 / dt);
    callbacks.onSuccess({ url: url, data: data }, this.stats, context, network || null);
  };

  FastLoader.prototype.fail = function (code, text, context, callbacks) {
    if (this.dead) return;
    callbacks.onError({ code: code || 0, text: text || 'load error' }, context, null, this.stats);
  };

  FastLoader.prototype.waitRotation = function (url, context, callbacks, retry) {
    var self = this;
    var initial = headers ? headers[HEADER_KEY] : '';
    var timer = null;

    function clean() {
      var i = waiters.indexOf(onRotate);
      if (i !== -1) waiters.splice(i, 1);
      clearTimeout(timer);
    }
    function onRotate() {
      if (self.dead) return clean();
      if (headers && headers[HEADER_KEY] === initial) { waiters.push(onRotate); return; }
      clean();
      window.__amediaCdnActiveIdx = 0;
      self.retries++;
      retry();
    }

    if (headers && headers[HEADER_KEY] !== initial) return retry();
    waiters.push(onRotate);

    timer = setTimeout(function () {
      clean();
      if (self.dead) return;
      if (rotateCdn('403 timeout')) { self.retries++; retry(); }
      else self.fail(403, 'forbidden', context, callbacks);
    }, 10000);
  };

  FastLoader.prototype.load = function (context, config, callbacks) {
    var self = this;
    var raw = context && context.url ? String(context.url) : '';
    var url = applyCdn(raw);
    if (url !== raw) context.url = url;

    this.stats = newStats();
    this.stats.loading.start = now();

    if (!isAmediaUrl(url)) {
      if (this.base) return this.base.load(context, config, callbacks);
      return this.fail(0, 'no loader', context, callbacks);
    }

    this.trackSegment(url);

    var binary = context.responseType === 'arraybuffer';
    var rangeStart = typeof context.rangeStart === 'number' ? context.rangeStart : -1;
    var rangeEnd = typeof context.rangeEnd === 'number' ? context.rangeEnd : -1;
    var cacheKey = url + (rangeStart >= 0 ? '#range=' + rangeStart + '-' + rangeEnd : '');

    if (binary) {
      var hit = cacheGet(cacheKey);
      if (hit) {
        this.stats.loading.first = this.stats.loading.start;
        return this.succeed(url, hit, context, callbacks, { cached: true });
      }
    }

    function attempt() {
      if (self.dead) return;
      var h = headers || {};

      function deliver(data, network) {
        if (binary && data instanceof ArrayBuffer) cachePut(cacheKey, data);
        self.succeed(url, data, context, callbacks, network);
      }

      function onFail(err) {
        if (self.dead) return;
        var code = err && err.status || 0;
        if (err && err.cors && directMode !== 'no') {
          directMode = 'no';
          log('direct недоступен (CORS) — перехожу на мост');
          return bridge();
        }
        if (code === 403 && self.retries < 5) {
          return self.waitRotation(url, context, callbacks, function () {
            url = applyCdn(raw);
            context.url = url;
            cacheKey = url + (rangeStart >= 0 ? '#range=' + rangeStart + '-' + rangeEnd : '');
            attempt();
          });
        }
        if ((code === 0 || code >= 500) && self.retries < 3 && rotateCdn('http ' + code)) {
          self.retries++;
          url = applyCdn(raw);
          context.url = url;
          cacheKey = url + (rangeStart >= 0 ? '#range=' + rangeStart + '-' + rangeEnd : '');
          return attempt();
        }
        self.fail(code, err && err.timeout ? 'timeout' : 'network', context, callbacks);
      }

      function bridge() {
        var nativeHeaders = usableHeaders(h);
        if (rangeStart >= 0) nativeHeaders.Range = 'bytes=' + rangeStart + '-' + (rangeEnd > rangeStart ? rangeEnd - 1 : '');
        if (!binary) {
          var n = nativeCall(url, nativeHeaders, 'text', 12000, function (text) {
            deliver(text, null);
          }, onFail);
          self.pending.push(n);
          return;
        }
        var net = nativeCall(url, nativeHeaders, 'base64', 20000, function (text) {
          if (self.dead) return;
          if (tooLarge(text)) {
            if (rangeStart >= 0) return onFail({ status: 0, text: 'range too large' });
            var job = fetchChunked(url, h, function (buf) { deliver(buf, null); }, onFail);
            self.pending.push(job);
            return;
          }
          if (!text.length) return onFail({ status: 0 });
          decodeBase64(text).then(function (buf) { deliver(buf, null); },
            function () { onFail({ status: 0 }); });
        }, onFail);
        self.pending.push(net);
      }

      if (binary && CFG.direct() && directMode !== 'no') {
        var xhr = directFetch(url, context, h, function (data, x) {
          if (directMode !== 'ok') { directMode = 'ok'; log('direct OK — мост не нужен'); }
          deliver(data, x);
        }, onFail);
        self.pending.push(xhr);
        return;
      }

      bridge();
    }

    attempt();
  };

  FastLoader.prototype.abort = function () {
    this.dead = true;
    this.stats.aborted = true;
    for (var i = 0; i < this.pending.length; i++) {
      var p = this.pending[i];
      try { if (p && p.abort) p.abort(); else if (p && p.clear) p.clear(); } catch (e) {}
    }
    this.pending = [];
    if (this.base) try { this.base.abort(); } catch (e) {}
  };

  FastLoader.prototype.destroy = function () {
    this.abort();
    if (this.base) try { this.base.destroy(); } catch (e) {}
  };

  return FastLoader;
}

/* ------------------------------------------------------------------ *
 * Обёртка Hls.
 * Оригинал оборачивает window.Hls прямо перед Player.play и в своём
 * конструкторе принудительно ставит cfg.loader. Мы оборачиваем поверх
 * и защищаем поле loader accessor'ом — его запись гасится, ours остаётся.
 * ------------------------------------------------------------------ */

var unwrapHls = null;

function tunedConfig(user) {
  var cfg = {};
  for (var k in user) if (Object.prototype.hasOwnProperty.call(user, k)) cfg[k] = user[k];

  var mem = navigator.deviceMemory || 4;
  var bufMb = CFG.buffer();
  if (mem <= 1) bufMb = Math.min(bufMb, 60);
  else if (mem <= 2) bufMb = Math.min(bufMb, 110);

  cfg.enableWorker = CFG.worker();
  cfg.capLevelToPlayerSize = false;
  cfg.autoLevelCapping = -1;
  cfg.startLevel = -1;
  cfg.lowLatencyMode = false;
  cfg.progressive = false;

  cfg.maxBufferLength = 60;
  cfg.maxMaxBufferLength = Math.max(90, bufMb);
  cfg.maxBufferSize = bufMb * 1024 * 1024;
  cfg.backBufferLength = 30;
  cfg.maxBufferHole = 0.5;
  cfg.nudgeMaxRetry = 6;

  cfg.abrEwmaDefaultEstimate = 5000000;
  cfg.abrBandWidthFactor = 0.9;
  cfg.abrBandWidthUpFactor = 1.1;

  cfg.manifestLoadingTimeOut = 8000;
  cfg.playlistLoadingTimeOut = 8000;
  cfg.levelLoadingTimeOut = 8000;
  cfg.fragLoadingTimeOut = 15000;
  cfg.manifestLoadingMaxRetry = 3;
  cfg.levelLoadingMaxRetry = 4;
  cfg.fragLoadingMaxRetry = 5;
  cfg.fragLoadingRetryDelay = 500;
  cfg.fragLoadingMaxRetryTimeout = 6000;

  var want = parseInt(CFG.quality(), 10);
  if (want) {
    cfg.startLevel = -1;
    cfg.abrEwmaDefaultEstimate = Math.max(2000000, want * 4000);
  }

  return cfg;
}

function installHls(headers) {
  if (!CFG.loader()) return;
  var Base = window.Hls;
  if (!Base || Base.__afast) return;

  var BaseLoader = Base.DefaultConfig && Base.DefaultConfig.loader;
  var Fast = buildFastLoader(BaseLoader, headers);

  function Wrapped(userConfig) {
    var cfg = tunedConfig(userConfig || {});
    Object.defineProperty(cfg, 'loader', {
      configurable: true,
      enumerable: true,
      get: function () { return Fast; },
      set: function () { /* запись оригинала гасим */ }
    });
    return new Base(cfg);
  }

  try { Object.setPrototypeOf(Wrapped, Base); } catch (e) {}
  for (var key in Base) { try { Wrapped[key] = Base[key]; } catch (e) {} }
  Wrapped.prototype = Base.prototype;
  Wrapped.__afast = true;
  Wrapped.__afastBase = Base;

  window.Hls = Wrapped;
  unwrapHls = function () {
    if (window.Hls === Wrapped) window.Hls = Base;
    unwrapHls = null;
  };
  log('Hls обёрнут, worker=' + CFG.worker());
}

/* ------------------------------------------------------------------ *
 * Экран серий: сетка с кадрами вместо сухого списка.
 * Опознаём меню оригинала по структуре пунктов (.episode), а не по тексту.
 * ------------------------------------------------------------------ */

var seasonCache = {};
var gridBox = null;
var gridController = 'amedia_grid';
var lastEpisodeMenu = null;
var lastEpisodeIndex = -1;
var lastTranslationId = null;
var autoNextPending = false;
var autoNextTimer = null;

function tmdbId(movie) {
  if (!movie) return null;
  if ((movie.source || 'tmdb') === 'tmdb' || movie.source === 'cub') return movie.id;
  return movie.tmdb_id || null;
}

function seasonEpisodes(movie, season, call) {
  var id = tmdbId(movie);
  if (!id || !season) return call({});
  var key = id + ':' + season;
  if (seasonCache[key]) return call(seasonCache[key]);
  try {
    Lampa.Api.sources.tmdb.get('tv/' + id + '/season/' + season, {}, function (data) {
      var map = {};
      ((data && data.episodes) || []).forEach(function (e) { map[e.episode_number] = e; });
      seasonCache[key] = map;
      call(map);
    }, function () { call({}); });
  } catch (e) { call({}); }
}

function activeMovie() {
  try {
    var a = Lampa.Activity.active();
    return a && (a.movie || a.card) || null;
  } catch (e) { return null; }
}

function episodeTimeline(movie, season, episode) {
  try {
    var hash = Lampa.Utils.hash([season, season > 10 ? ':' : '', episode,
      movie.original_title || movie.original_name || movie.title || movie.name].join(''));
    var link = Lampa.Timeline.link ? Lampa.Timeline.link(movie, season, episode) : null;
    return Lampa.Timeline.view(hash, link);
  } catch (e) { return null; }
}

function closeGrid(restore) {
  if (!gridBox) return;
  gridBox.remove();
  gridBox = null;
  try { Lampa.Controller.toggle(restore || 'content'); } catch (e) {}
}

function openEpisodeGrid(params) {
  var movie = activeMovie();
  var items = params.items || [];
  if (!items.length) return false;

  var season = (items[0].episode && items[0].episode.season) ||
               (lastEpisodeMenu && lastEpisodeMenu.season) || 1;
  var enabled = Lampa.Controller.enabled().name;
  if (lastEpisodeMenu !== params) lastEpisodeIndex = -1;

  closeGrid();
  cacheClear();

  gridBox = $('<div class="afast"></div>');
  var currentGrid = gridBox;
  var head = $('<div class="afast__head"></div>');
  var title = $('<div class="afast__title"></div>').text(params.title || 'Серии');
  var sub = $('<div class="afast__sub"></div>').text(items.length + ' ' + plural(items.length));
  head.append(title).append(sub);

  var body = $('<div class="afast__body"></div>');
  var scroll = new Lampa.Scroll({ mask: true, over: true });
  var grid = $('<div class="afast__grid"></div>');

  items.forEach(function (item, index) {
    var num = item.episode && item.episode.number || (index + 1);
    var card = $('<div class="afast__card selector">' +
      '<div class="afast__thumb"><img alt=""><div class="afast__num"></div>' +
      '<div class="afast__line"><div></div></div><div class="afast__seen"></div></div>' +
      '<div class="afast__name"></div><div class="afast__meta"></div></div>');

    card.find('.afast__num').text(num < 10 ? '0' + num : num);
    card.find('.afast__name').text(item.title || ('Серия ' + num));
    card.find('.afast__meta').text(item.subtitle || '');

    var line = movie ? episodeTimeline(movie, season, num) : null;
    if (line && line.percent > 0) {
      card.find('.afast__line').show().find('div').css('width', Math.min(100, line.percent) + '%');
      if (line.percent >= 90) card.find('.afast__seen').show();
    }

    card.on('hover:enter', function () {
      lastEpisodeMenu = params;
      lastEpisodeIndex = index;
      closeGrid(enabled);
      try { params.onSelect(item); } catch (e) {}
    }).on('hover:focus', function (e) {
      scroll.update($(e.target), true);
    }).on('hover:hover', function (e) {
      Lampa.Controller.collectionFocus(e.target, scroll.render());
    });

    grid.append(card);
    item.__card = card;
  });

  scroll.append(grid);
  body.append(scroll.render());
  gridBox.append(head).append(body);
  $('body').append(gridBox);

  seasonEpisodes(movie, season, function (map) {
    if (gridBox !== currentGrid) return;
    items.forEach(function (item, index) {
      var num = item.episode && item.episode.number || (index + 1);
      var ep = map[num];
      if (!ep) return;
      var card = item.__card;
      if (!card || !gridBox) return;
      if (ep.name) card.find('.afast__name').text(ep.name);
      var meta = [];
      if (ep.runtime) meta.push(ep.runtime + ' мин');
      if (ep.air_date) meta.push(String(ep.air_date).slice(0, 4));
      if (ep.vote_average) meta.push('★ ' + parseFloat(ep.vote_average).toFixed(1));
      if (meta.length) card.find('.afast__meta').text(meta.join(' · '));
      if (ep.still_path) {
        var img = card.find('img')[0];
        img.onload = function () { card.find('.afast__thumb').addClass('afast__thumb--loaded'); };
        img.onerror = function () {};
        img.src = Lampa.TMDB.image('/t/p/w300' + ep.still_path);
      }
    });
  });

  var first = grid.find('.selector')[Math.max(0, lastEpisodeIndex)] || grid.find('.selector')[0];

  Lampa.Controller.add(gridController, {
    toggle: function () {
      Lampa.Controller.collectionSet(scroll.render());
      Lampa.Controller.collectionFocus(first, scroll.render());
    },
    up: function () { if (Navigator.canmove('up')) Navigator.move('up'); },
    down: function () { if (Navigator.canmove('down')) Navigator.move('down'); },
    left: function () { if (Navigator.canmove('left')) Navigator.move('left'); },
    right: function () { if (Navigator.canmove('right')) Navigator.move('right'); },
    back: function () {
      closeGrid(enabled);
      if (params.onBack) try { params.onBack(); } catch (e) {}
    }
  });
  Lampa.Controller.toggle(gridController);
  return true;
}

function plural(n) {
  var a = n % 10, b = n % 100;
  if (a === 1 && b !== 11) return 'серия';
  if (a >= 2 && a <= 4 && (b < 10 || b >= 20)) return 'серии';
  return 'серий';
}

/* ------------------------------------------------------------------ *
 * Перехват меню оригинала.
 * Пункты сезона несут .season, серии — .episode, озвучки — .tr, дорожки — .src.
 * Никаких строк из обфусцированного массива не нужно.
 * ------------------------------------------------------------------ */

var origSelectShow = null;

function installSelect() {
  if (!Lampa.Select || origSelectShow) return;
  origSelectShow = Lampa.Select.show;

  Lampa.Select.show = function (params) {
    try {
      var items = params && params.items;
      var first = items && items[0];

      if (first && first.tr) {
        // выбор озвучки: запоминаем и умеем автоподставлять при автопереходе
        if (autoNextPending && lastTranslationId) {
          autoNextPending = false;
          clearTimeout(autoNextTimer);
          var pick = null;
          for (var i = 0; i < items.length; i++) {
            if (String(items[i].id) === String(lastTranslationId)) { pick = items[i]; break; }
          }
          pick = pick || items[0];
          setTimeout(function () { try { params.onSelect(pick); } catch (e) {} }, 30);
          return;
        }
        var wrapped = Lampa.Arrays.clone ? Lampa.Arrays.clone(params) : params;
        wrapped.onSelect = function (a) {
          lastTranslationId = a && a.id;
          try { params.onSelect(a); } catch (e) {}
        };
        return origSelectShow.call(this, wrapped);
      }

      if (first && first.episode && !first.tr && CFG.grid()) {
        lastEpisodeMenu = params;
        if (openEpisodeGrid(params)) return;
      }
    } catch (e) {
      log('select hook error', e && e.message);
    }
    return origSelectShow.apply(this, arguments);
  };
}

/* ------------------------------------------------------------------ *
 * Автопереход по сезону.
 * Следующую серию запускаем тем же штатным обработчиком оригинала —
 * вся авторизация и резолв остаются его.
 * ------------------------------------------------------------------ */

var endedVideo = null;
var onEndedVideo = null;

function unbindEnded() {
  if (endedVideo && onEndedVideo) {
    try { endedVideo.removeEventListener('ended', onEndedVideo, false); } catch (e) {}
  }
  endedVideo = null; onEndedVideo = null;
}

function bindEnded() {
  var video = null;
  try { video = Lampa.Player.video && Lampa.Player.video(); } catch (e) {}
  if (!video || !video.addEventListener) return;
  if (endedVideo === video) return;
  unbindEnded();
  endedVideo = video;

  onEndedVideo = function () {
    if (!CFG.next()) return;
    if (!lastEpisodeMenu || lastEpisodeIndex < 0) return;
    var items = lastEpisodeMenu.items || [];
    var next = items[lastEpisodeIndex + 1];
    if (!next) return;

    setTimeout(function () {
      autoNextPending = true;
      clearTimeout(autoNextTimer);
      autoNextTimer = setTimeout(function () { autoNextPending = false; }, 8000);
      lastEpisodeIndex = lastEpisodeIndex + 1;
      log('автопереход ->', next.title);
      try { lastEpisodeMenu.onSelect(next); } catch (e) { autoNextPending = false; }
    }, 600);
  };
  video.addEventListener('ended', onEndedVideo, false);
}

/* ------------------------------------------------------------------ *
 * Жизненный цикл плеера
 * ------------------------------------------------------------------ */

function installPlayerHooks() {
  if (!Lampa.Player || !Lampa.Player.listener) return;

  Lampa.Player.listener.follow('create', function (e) {
    var data = e && e.data;
    if (!data) return;
    var headers = data.hls_headers || data.headers;
    if (!headers || !data.inner) return;

    liveHeaders = headers;
    watchHeaders(headers);
    directMode = 'unknown';
    cacheClear();
    unbindEnded();
    installHls(headers);
  });

  Lampa.Player.listener.follow('start', function () {
    setTimeout(bindEnded, 400);
    setTimeout(bindEnded, 1500);
  });

  Lampa.Player.listener.follow('destroy', function () {
    if (unwrapHls) { try { unwrapHls(); } catch (e) {} }
    waiters = [];
    liveHeaders = null;
    unbindEnded();
    clearTimeout(autoNextTimer);
    autoNextPending = false;
    cacheClear();
  });
}

/* ------------------------------------------------------------------ *
 * Стили сетки
 * ------------------------------------------------------------------ */

var CSS = [
'<style>',
'.afast{position:fixed;left:0;top:0;right:0;bottom:0;z-index:60;background:#0d0f14;display:-webkit-box;display:-webkit-flex;display:-ms-flexbox;display:flex;-webkit-box-orient:vertical;-webkit-flex-direction:column;-ms-flex-direction:column;flex-direction:column}',
'.afast__head{padding:1.6em 2em 1em 2em;-webkit-flex-shrink:0;-ms-flex-negative:0;flex-shrink:0}',
'.afast__title{font-size:1.8em;font-weight:600;line-height:1.2}',
'.afast__sub{font-size:1em;opacity:.5;margin-top:.3em}',
'.afast__body{-webkit-box-flex:1;-webkit-flex:1;-ms-flex:1;flex:1;min-height:0;padding:0 1.4em}',
'.afast__grid{display:-webkit-box;display:-webkit-flex;display:-ms-flexbox;display:flex;-webkit-flex-wrap:wrap;-ms-flex-wrap:wrap;flex-wrap:wrap;padding-bottom:2em}',
'.afast__card{width:25%;padding:0 .6em 1.4em .6em;-webkit-box-sizing:border-box;box-sizing:border-box}',
'.afast__thumb{position:relative;width:100%;height:0;padding-top:56.25%;-webkit-border-radius:.6em;border-radius:.6em;overflow:hidden;background:rgba(255,255,255,.07);-webkit-transition:-webkit-box-shadow .18s ease, -webkit-transform .18s ease;transition:box-shadow .18s ease, transform .18s ease}',
'.afast__thumb img{position:absolute;left:0;top:0;width:100%;height:100%;-o-object-fit:cover;object-fit:cover;opacity:0;-webkit-transition:opacity .3s;transition:opacity .3s}',
'.afast__thumb--loaded img{opacity:1}',
'.afast__card.focus .afast__thumb{-webkit-box-shadow:0 0 0 .22em #fff;box-shadow:0 0 0 .22em #fff;-webkit-transform:scale(1.03);transform:scale(1.03)}',
'.afast__num{position:absolute;left:.5em;top:.4em;font-size:1.15em;font-weight:700;color:#fff;text-shadow:0 .05em .25em rgba(0,0,0,.8)}',
'.afast__line{position:absolute;left:0;right:0;bottom:0;height:.28em;background:rgba(0,0,0,.55);display:none}',
'.afast__line>div{height:100%;width:0;background:#fff}',
'.afast__seen{position:absolute;right:.5em;top:.5em;width:.5em;height:.5em;-webkit-border-radius:50%;border-radius:50%;background:#4ade80;display:none}',
'.afast__name{font-size:1.05em;line-height:1.35;margin-top:.55em;overflow:hidden;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical}',
'.afast__meta{font-size:.85em;opacity:.5;margin-top:.2em;line-height:1.3}',
'.afast__card.focus .afast__name{color:#fff}',
'@media screen and (max-width:1200px){.afast__card{width:33.3333%}}',
'@media screen and (max-width:700px){.afast__card{width:50%}.afast__head{padding:1.2em 1.2em .8em 1.2em}}',
'</style>'
].join('');

/* ------------------------------------------------------------------ *
 * Настройки
 * ------------------------------------------------------------------ */

function installSettings() {
  if (!Lampa.SettingsApi) return;

  Lampa.Lang.add({
    amfast_title: { ru: 'Amedia Fast', en: 'Amedia Fast', uk: 'Amedia Fast' },
    amfast_loader: { ru: 'Быстрый загрузчик', en: 'Fast loader', uk: 'Швидкий завантажувач' },
    amfast_loader_d: {
      ru: 'Нативное декодирование base64, параллельные Range-куски и кэш сегментов',
      en: 'Native base64 decoding, parallel range chunks and segment cache',
      uk: 'Нативне декодування base64, паралельні Range-шматки та кеш сегментів'
    },
    amfast_direct: { ru: 'Пробовать напрямую (без моста)', en: 'Try direct (no bridge)', uk: 'Пробувати напряму (без моста)' },
    amfast_direct_d: {
      ru: 'Если CDN отдаёт CORS — сегменты идут мимо base64. При отказе автоматически вернётся мост',
      en: 'If the CDN allows CORS, segments bypass base64. Falls back to the bridge automatically',
      uk: 'Якщо CDN віддає CORS — сегменти йдуть повз base64. При відмові автоматично повернеться міст'
    },
    amfast_worker: { ru: 'Демукс в воркере', en: 'Demux in worker', uk: 'Демукс у воркері' },
    amfast_worker_d: {
      ru: 'Разгружает главный поток — интерфейс плеера отзывчивее',
      en: 'Frees the main thread — the player UI responds faster',
      uk: 'Розвантажує головний потік — інтерфейс плеєра чутливіший'
    },
    amfast_buffer: { ru: 'Буфер, МБ', en: 'Buffer, MB', uk: 'Буфер, МБ' },
    amfast_buffer_d: {
      ru: 'Больше буфер — меньше подвисаний. На слабых устройствах ставьте 60–90',
      en: 'Bigger buffer means fewer stalls. Use 60–90 on low-memory devices',
      uk: 'Більший буфер — менше підвисань. На слабких пристроях ставте 60–90'
    },
    amfast_parallel: { ru: 'Параллельных кусков', en: 'Parallel chunks', uk: 'Паралельних шматків' },
    amfast_quality: { ru: 'Стартовое качество', en: 'Start quality', uk: 'Стартова якість' },
    amfast_quality_auto: { ru: 'Авто', en: 'Auto', uk: 'Авто' },
    amfast_grid: { ru: 'Сетка серий с кадрами', en: 'Episode grid with stills', uk: 'Сітка серій з кадрами' },
    amfast_next: { ru: 'Автопереход по сезону', en: 'Auto next episode', uk: 'Автоперехід по сезону' },
    amfast_next_d: {
      ru: 'После окончания серии запускает следующую в той же озвучке',
      en: 'Starts the next episode in the same translation when one ends',
      uk: 'Після завершення серії запускає наступну в тій самій озвучці'
    },
    amfast_cache: { ru: 'Кэш сегментов', en: 'Segment cache', uk: 'Кеш сегментів' },
    amfast_debug: { ru: 'Логи в консоль', en: 'Console logs', uk: 'Логи в консоль' }
  });

  Lampa.SettingsApi.addComponent({
    component: 'amedia_fast',
    name: Lampa.Lang.translate('amfast_title'),
    icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L4 14h6l-1 8 9-12h-6z" stroke-linejoin="round"/></svg>'
  });

  function add(name, param, field) {
    Lampa.SettingsApi.addParam({ component: 'amedia_fast', param: param, field: field });
  }

  add('loader', { name: 'amedia_fast_loader', type: 'trigger', default: true },
    { name: Lampa.Lang.translate('amfast_loader'), description: Lampa.Lang.translate('amfast_loader_d') });
  add('direct', { name: 'amedia_fast_direct', type: 'trigger', default: true },
    { name: Lampa.Lang.translate('amfast_direct'), description: Lampa.Lang.translate('amfast_direct_d') });
  add('worker', { name: 'amedia_fast_worker', type: 'trigger', default: true },
    { name: Lampa.Lang.translate('amfast_worker'), description: Lampa.Lang.translate('amfast_worker_d') });
  add('cache', { name: 'amedia_fast_cache', type: 'trigger', default: true },
    { name: Lampa.Lang.translate('amfast_cache') });
  add('parallel', { name: 'amedia_fast_parallel', type: 'select',
    values: { '1': '1', '2': '2', '3': '3', '4': '4' }, default: '3' },
    { name: Lampa.Lang.translate('amfast_parallel') });
  add('buffer', { name: 'amedia_fast_buffer', type: 'select',
    values: { '60': '60', '90': '90', '120': '120', '180': '180', '240': '240' }, default: '180' },
    { name: Lampa.Lang.translate('amfast_buffer'), description: Lampa.Lang.translate('amfast_buffer_d') });
  add('quality', { name: 'amedia_fast_quality', type: 'select',
    values: { 'auto': Lampa.Lang.translate('amfast_quality_auto'), '2160': '4K', '1080': '1080p', '720': '720p' },
    default: 'auto' },
    { name: Lampa.Lang.translate('amfast_quality') });
  add('grid', { name: 'amedia_fast_grid', type: 'trigger', default: true },
    { name: Lampa.Lang.translate('amfast_grid') });
  add('next', { name: 'amedia_fast_next', type: 'trigger', default: true },
    { name: Lampa.Lang.translate('amfast_next'), description: Lampa.Lang.translate('amfast_next_d') });
  add('debug', { name: 'amedia_fast_debug', type: 'trigger', default: false },
    { name: Lampa.Lang.translate('amfast_debug') });
}

/* ------------------------------------------------------------------ *
 * Старт
 * ------------------------------------------------------------------ */

var started = false;
var bootTimer = null;

function start() {
  if (started || !window.Lampa || !Lampa.Storage || !Lampa.SettingsApi ||
      !Lampa.Select || !Lampa.Player || !Lampa.Player.listener || !window.$) return false;
  try {
    installSettings();
    installSelect();
    installPlayerHooks();
    $('body').append(CSS);
  } catch (e) {
    console.error('[amedia-fast] startup error', e);
    return false;
  }
  started = true;

  // Оригинал грузим как есть — его подпись, реклама и телеметрия работают штатно.
  if (!window.__amediaOriginalLoaded) {
    window.__amediaOriginalLoaded = true;
    try {
      $.getScript(SOURCE).fail(function () {
        window.__amediaOriginalLoaded = false;
        log('не удалось загрузить оригинальный a.js');
      });
    } catch (e) {
      window.__amediaOriginalLoaded = false;
    }
  }

  log('готов');
  return true;
}

function boot() {
  if (start()) { if (bootTimer) clearInterval(bootTimer); bootTimer = null; }
}

if (window.Lampa && Lampa.Listener) {
  Lampa.Listener.follow('app', function (e) { if (e.type === 'ready') boot(); });
}
if (window.appready) boot();
if (!started) {
  var attempts = 0;
  bootTimer = setInterval(function () {
    boot();
    if (++attempts >= 60) { clearInterval(bootTimer); bootTimer = null; }
  }, 500);
}

})();