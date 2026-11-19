/* Capsule Online 0.30.0-preview.1 | Lampa / Skaz adapter
 * Reworked from the provided 0.29.0 prototype. Uses Skaz provider data-json
 * menus; no eval, remote executable scripts, or persisted signed URLs.
 * HTTPS is preferred. Legacy HTTP fallback is anonymous: account keys are
 * never sent over plaintext HTTP. Source-controlled RCH is not bundled.
 * Skaz and Lampac are independent projects; respect upstream rights.
 */
(function (root) {
  'use strict';

  var VERSION = '0.30.0-preview.1';
  var PREFIX = 'capsule_skaz_online_';
  var COMPONENT = 'capsuleamedia';

  if (root.CapsuleOnline && root.CapsuleOnline.booted) {
    return;
  }

  var bootAttempts = 0;

  function boot() {
    var L = root.Lampa;

    if (!L || !L.Component || !L.Storage || !L.Template || !L.Lang) {
      if (++bootAttempts < 40) {
        setTimeout(boot, 250);
      }
      return;
    }

    init(L);
  }

  function init(L) {
    var $ = root.jQuery || root.$;
    var doc = root.document;
    var Network = root.Network || root.Reguest || L.Network || L.Reguest || L.Request;
    var Defined = root.Defined || {};
    // Defaults match the Skaz instance used by the proven embedded core.
    // HTTPS is preferred. Never send the Lampa account key over plaintext HTTP.
    var BASE = str(root.__capsuleSkazBase || Defined.localhost ||
      ((L.Storage.get('skazonline_servers', false) === true) ?
        'https://onlinecf3.skaz.tv/' : 'https://online3.skaz.tv/'));
    if (!/^https?:\/\//i.test(BASE)) BASE = 'https://online3.skaz.tv/';
    BASE = BASE.replace(/\/*$/, '/');
    var account = typeof root.account === 'function' ? root.account : function (url) {
      // Used exclusively for the exact HTTPS origin verified by headersFor().
      // Do not copy account identifiers into arbitrary provider URLs.
      var email = str(L.Storage.get('account_email',''));
      var uid = str(L.Storage.get('lampac_unic_id',''));
      var fields = [];
      if (email && !/[?&]account_email=/.test(url))
        fields.push('account_email=' + encodeURIComponent(email));
      if (uid && !/[?&]uid=/.test(url))
        fields.push('uid=' + encodeURIComponent(uid));
      return fields.length ? url + (url.indexOf('?') >= 0 ? '&' : '?') +
        fields.join('&') : url;
    };

    var NS = root.CapsuleOnline = {
      version: VERSION,
      L: L,
      state: {
        lastCatalog: [],
        lastFilmScan: null,
        lastSeriesScan: null, lastCatalogMovie: null
      }
    };

    root.__capsuleOnlineVersion = VERSION;

    /* =========================
       0. Basic helpers
       ========================= */

    function own(obj, key) {
      return Object.prototype.hasOwnProperty.call(obj, key);
    }

    function assign(target) {
      for (var i = 1; i < arguments.length; i++) {
        var source = arguments[i];
        if (!source) continue;
        for (var key in source) {
          if (own(source, key) && key !== '__proto__' && key !== 'prototype' && key !== 'constructor') {
            target[key] = source[key];
          }
        }
      }
      return target;
    }

    function str(value) {
      return value == null ? '' : String(value);
    }

    function trim(value) {
      return str(value).trim();
    }

    function lower(value) {
      return trim(value).toLowerCase().replace(/ё/g, 'е');
    }

    function norm(value) {
      return lower(value).replace(/[^a-zа-я0-9]+/g, ' ').trim();
    }

    function num(value, fallback) {
      var n = Number(value);
      return isFinite(n) ? n : (fallback || 0);
    }

    function boolVal(value, fallback) {
      if (value === undefined || value === null) return fallback;
      if (typeof value === 'boolean') return value;
      if (value === 1 || value === '1' || value === 'true') return true;
      if (value === 0 || value === '0' || value === 'false') return false;
      return fallback;
    }

    function escapeHtml(value) {
      return str(value).replace(/[&<>"']/g, function (ch) {
        return {
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#39;'
        }[ch];
      });
    }

    function debounceFn(fn, ms, registry) {
      var locked = false;

      return function () {
        if (locked) return;

        locked = true;

        var id = setTimeout(function () {
          locked = false;
        }, ms || 350);

        if (registry) {
          registry.push(id);
        }

        fn.apply(this, arguments);
      };
    }

    function safeCall(fn, op, fallback) {
      try {
        return fn();
      } catch (e) {
        Log.error(op, e && e.message ? e.message : String(e));
        return typeof fallback === 'function' ? fallback(e) : undefined;
      }
    }

    /* =========================
       1. Storage / cache
       ========================= */

    function get(key, fallback) {
      try {
        return L.Storage.get(PREFIX + key, fallback);
      } catch (e) {
        return fallback;
      }
    }

    function set(key, value) {
      try {
        L.Storage.set(PREFIX + key, value);
      } catch (e) {
        Log.warn('storage', e && e.message ? e.message : String(e));
      }
    }

    function bool(key, fallback) {
      return boolVal(get(key, fallback), fallback);
    }

    function remember(key, value, ttl) {
      set('cache_' + key, {
        v: value,
        e: Date.now() + num(ttl, 600000)
      });
    }

    function recall(key) {
      var item = get('cache_' + key, null);

      if (item && item.e && item.e > Date.now()) {
        return item.v;
      }

      return null;
    }

    /* =========================
       2. Privacy-safe logger
       ========================= */

    var logRing = [];

    function redact(value) {
      return str(value)
        .replace(/https?:\/\/[^\s"'<>]+/gi, '[url]')
        .replace(/(?:token|key|secret|auth|cookie|aesgcm)[^\s,;]*/gi, '[redacted]')
        .replace(/[a-f0-9]{32,}/gi, '[hash]');
    }

    function pushLog(level, op, message, data) {
      var entry = {
        t: Date.now(),
        level: level,
        op: op,
        msg: redact(message),
        data: data ? redact(str(data && data.message ? data.message : '[details]')) : ''
      };

      logRing.push(entry);

      if (logRing.length > 300) {
        logRing.shift();
      }

      if (level === 'error' && root.console && root.console.error) {
        root.console.error('[CapsuleOnline]', op, entry.msg);
      }
    }

    var Log = {
      debug: function (op, msg, data) {
        if (bool('debug', false)) {
          pushLog('debug', op, msg, data);
        }
      },
      info: function (op, msg, data) {
        pushLog('info', op, msg, data);
      },
      warn: function (op, msg, data) {
        pushLog('warn', op, msg, data);
      },
      error: function (op, msg, data) {
        pushLog('error', op, msg, data);
      },
      dump: function () {
        return logRing.map(function (e) {
          return new Date(e.t).toISOString() +
            ' [' + e.level + '] ' +
            e.op + ': ' + e.msg +
            (e.data ? ' | ' + e.data : '');
        }).join('\n');
      }
    };

    /* =========================
       3. Safe network layer
       ========================= */

    var inflight = Object.create(null);
    var htmlCache = Object.create(null);
    var htmlCacheKeys = [];
    var htmlCacheBytes = 0;
    var REQUEST_MAX_BYTES = 3 * 1024 * 1024;

    function parseUrl(value, relativeTo) {
      if (typeof value !== 'string' || !value.trim()) return null;
      try {
        value = value.trim();
        // Skaz sometimes sends a root-relative path without the slash.
        if (/^lite\/|^lifeevents[?\/]|^externalids[?\/]/i.test(value))
          relativeTo = BASE;
        var url = new URL(value, relativeTo || BASE);
        var host = url.hostname.toLowerCase();
        if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
        if (url.username || url.password || url.port && url.port !== '80' && url.port !== '443') return null;
        if (!host || host === 'localhost' || host === '0.0.0.0' ||
            /^127\./.test(host) || /^10\./.test(host) ||
            /^192\.168\./.test(host) || /^169\.254\./.test(host) ||
            /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
            /^\[/.test(host)) return null;
        return url;
      } catch (e) { return null; }
    }

    function safeUrl(value) { return !!parseUrl(value); }

    function absoluteUrl(value, base) {
      var parsed = parseUrl(str(value), base || BASE);
      return parsed ? parsed.href : '';
    }

    function signedUrl(url) {
      return /[?&](?:sig|signature|token|hash|hmac|expires|exp|auth)=/i.test(url);
    }

    function headersFor(url) {
      var parsed = parseUrl(url);
      var base = parseUrl(BASE);
      if (!parsed || !base) return {};
      // Exact origin, not substring regex (skaz.attacker.example is NOT trusted).
      // A plaintext transport never receives the account encryption key.
      var trusted = parsed.protocol === 'https:' && base.protocol === 'https:' &&
        parsed.origin === base.origin &&
        /^(?:online(?:cf)?[3457]\.skaz\.tv|skaz\.tv)$/i.test(parsed.hostname);
      if (!trusted) return {};
      var key = getStorageKey();
      return key ? { 'X-Kit-AesGcm': key } : {};
    }

    function getStorageKey() {
      try { return str(L.Storage.get('aesgcmkey', '')); }
      catch (e) { return ''; }
    }

    function requestText(url, options, callback) {
      options = options || {};
      callback = callback || function () {};
      var target = absoluteUrl(url);
      if (!target) return setTimeout(function(){callback(new Error('invalid_url'), null);}, 0);
      var timeout = Math.max(500, Math.min(15000, num(options.timeout, 4500)));
      var asJson = !!options.json;
      var key = (asJson ? 'json:' : 'text:') + timeout + ':' + target;
      var cached = !asJson && !signedUrl(target) && htmlCache[key];
      if (cached && cached.until > Date.now()) {
        return setTimeout(function(){callback(null, cached.value);}, 0);
      }
      if (inflight[key]) { inflight[key].callbacks.push(callback); return; }
      var entry = { callbacks: [callback], net: null, timer: null, settled: false };
      inflight[key] = entry;
      function finish(error, result) {
        if (entry.settled) return;
        entry.settled = true;
        clearTimeout(entry.timer);
        delete inflight[key];
        if (entry.net && entry.net.clear) {
          try { entry.net.clear(); } catch (e) {}
        }
        if (!error && typeof result === 'string' &&
            result.length > REQUEST_MAX_BYTES) {
          error = new Error('response_too_large'); result = null;
        }
        if (!error && !asJson && typeof result === 'string' && result.length < 1500000 &&
            options.cacheMs && !signedUrl(target)) {
          if (htmlCache[key]) htmlCacheBytes -= htmlCache[key].value.length;
          else htmlCacheKeys.push(key);
          htmlCache[key] = { value: result, until: Date.now() + options.cacheMs };
          htmlCacheBytes += result.length;
          while (htmlCacheKeys.length > 18 || htmlCacheBytes > 4 * 1024 * 1024) {
            var oldest = htmlCacheKeys.shift();
            if (htmlCache[oldest]) {
              htmlCacheBytes -= htmlCache[oldest].value.length;
              delete htmlCache[oldest];
            }
          }
        }
        entry.callbacks.forEach(function(fn) {
          try { fn(error, result); } catch (e) { Log.error('request_callback', e.message); }
        });
      }
      entry.timer = setTimeout(function(){ finish(new Error('timeout'), null); }, timeout);
      if (!Network) return finish(new Error('network_unavailable'), null);
      try {
        var net = entry.net = new Network();
        if (net.timeout) net.timeout(Math.max(500, timeout - 100));
        var transport = asJson && typeof net.silent === 'function' ? 'silent' : 'native';
        // Signed links are never modified by account(url).
        var finalUrl = signedUrl(target) || !headersFor(target)['X-Kit-AesGcm'] ?
          target : account(target);
        net[transport](finalUrl, function(data) {
          if (asJson && typeof data === 'string') {
            try { data = JSON.parse(data); } catch (e) { return finish(e, null); }
          }
          finish(null, data);
        }, function(error){ finish(error || new Error('network_error'), null); }, false, {
          dataType: asJson ? 'json' : 'text', headers: headersFor(target)
        });
      } catch (e) { finish(e, null); }
    }

    function requestJson(url, options, callback) {
      return requestText(url, assign({}, options, { json: true }), callback);
    }

    function clearTransientCache() {
      htmlCache = Object.create(null); htmlCacheKeys = []; htmlCacheBytes = 0;
    }

    

    /* =========================
       4. Provider health / circuit breaker
       ========================= */

    var health = recall('provider_health') || {};

    function saveHealth() {
      remember('provider_health', health, 86400000);
    }

    function recordHealth(family, ok, ms) {
      if (!family) return;

      var item = health[family] || {
        ok: 0,
        fail: 0,
        avg: 0,
        openUntil: 0
      };

      var total = item.ok + item.fail + 1;
      item.avg = Math.round((item.avg * (total - 1) + num(ms, 0)) / total);

      if (ok) {
        item.ok++;
        item.fail = Math.max(0, item.fail - 1);
        item.openUntil = 0;
      } else {
        item.fail++;

        if (item.fail >= 3) {
          item.openUntil = Date.now() + 30000;
        }
      }

      health[family] = item;
      saveHealth();
    }

    function skipProvider(family) {
      var item = health[family];
      return !!(item && item.openUntil > Date.now());
    }

    function healthScore(family) {
      var item = health[family];

      if (!item) return 50;

      var total = Math.max(1, item.ok + item.fail);
      var rate = item.ok / total;
      var speed = Math.max(0, 30 - item.avg / 50);

      return Math.round(rate * 70 + speed);
    }

    /* =========================
       5. i18n
       ========================= */

    L.Lang.add({
      cso_plugin_name: {
        ru: 'Capsule Online · Skaz',
        uk: 'Capsule Online · Skaz',
        en: 'Capsule Online · Skaz',
        zh: 'Capsule Online · Skaz'
      },
      cso_plugin_desc: {
        ru: 'Переписанный онлайн-движок с быстрым поиском, кэшем и безопасным запуском.',
        uk: 'Переписаний онлайн-рушій із швидким пошуком, кешем і безпечним запуском.',
        en: 'Rewritten online engine with fast search, cache and safe playback.',
        zh: '重写的在线引擎，支持快速搜索、缓存和安全播放。'
      },
      cso_watch: {
        ru: 'Смотреть',
        uk: 'Дивитися',
        en: 'Watch',
        zh: '观看'
      },
      title_online: {
        ru: 'Онлайн',
        uk: 'Онлайн',
        en: 'Online',
        zh: '在线'
      },
      cso_source: {
        ru: 'Источник',
        uk: 'Джерело',
        en: 'Source',
        zh: '来源'
      },
      cso_season: {
        ru: 'Сезон',
        uk: 'Сезон',
        en: 'Season',
        zh: '季'
      },
      cso_episode: {
        ru: 'Серия',
        uk: 'Серія',
        en: 'Episode',
        zh: '剧集'
      },
      cso_voice: {
        ru: 'Озвучка',
        uk: 'Озвучення',
        en: 'Voice',
        zh: '配音'
      },
      cso_quality: {
        ru: 'Качество',
        uk: 'Якість',
        en: 'Quality',
        zh: '画质'
      },
      cso_settings: {
        ru: 'Настройки',
        uk: 'Налаштування',
        en: 'Settings',
        zh: '设置'
      },
      cso_back: {
        ru: 'Назад',
        uk: 'Назад',
        en: 'Back',
        zh: '返回'
      },
      cso_searching: {
        ru: 'Ищем источник...',
        uk: 'Шукаємо джерело...',
        en: 'Searching source...',
        zh: '正在搜索来源...'
      },
      cso_no_results: {
        ru: 'Нет результатов',
        uk: 'Немає результатів',
        en: 'No results',
        zh: '没有结果'
      },
      cso_empty_text: {
        ru: 'Источник не ответил или не подошли варианты.',
        uk: 'Джерело не відповіло або варіанти не підійшли.',
        en: 'Source did not answer or no suitable variants were found.',
        zh: '来源未响应或没有找到合适的版本。'
      },
      cso_retry: {
        ru: 'Повторить',
        uk: 'Повторити',
        en: 'Retry',
        zh: '重试'
      },
      cso_choose_source: {
        ru: 'Выбор источника',
        uk: 'Вибір джерела',
        en: 'Choose source',
        zh: '选择来源'
      },
      cso_no_sources: {
        ru: 'Нет разрешённых источников',
        uk: 'Немає дозволених джерел',
        en: 'No allowed sources',
        zh: '没有允许的源'
      },
      cso_bad_link: {
        ru: 'Некорректная ссылка',
        uk: 'Некоректне посилання',
        en: 'Invalid link',
        zh: '链接无效'
      },
      cso_not_allowed: {
        ru: 'Источник или озвучка отключены настройками',
        uk: 'Джерело або озвучення вимкнено налаштуваннями',
        en: 'Source or voice disabled by settings',
        zh: '来源或配音已被设置禁用'
      },
      cso_play_error: {
        ru: 'Ошибка запуска',
        uk: 'Помилка запуску',
        en: 'Playback error',
        zh: '播放错误'
      },
      cso_better_found: {
        ru: 'Найден лучший источник',
        uk: 'Знайдено краще джерело',
        en: 'Better source found',
        zh: '发现更好的来源'
      },
      cso_settings_basic: {
        ru: 'Основное',
        uk: 'Основне',
        en: 'Basic',
        zh: '基础'
      },
      cso_auto: {
        ru: 'Автовыбор источника',
        uk: 'Автовибір джерела',
        en: 'Automatic source selection',
        zh: '自动选择来源'
      },
      cso_search_mode: {
        ru: 'Режим поиска',
        uk: 'Режим пошуку',
        en: 'Search mode',
        zh: '搜索模式'
      },
      cso_fast: {
        ru: 'Быстрый',
        uk: 'Швидкий',
        en: 'Fast',
        zh: '快速'
      },
      cso_normal: {
        ru: 'Обычный',
        uk: 'Звичайний',
        en: 'Normal',
        zh: '普通'
      },
      cso_economy: {
        ru: 'Экономный',
        uk: 'Економний',
        en: 'Economy',
        zh: '经济'
      },
      cso_fallback: {
        ru: 'Резервный источник',
        uk: 'Резервне джерело',
        en: 'Fallback source',
        zh: '备用来源'
      },
      cso_min_quality: {
        ru: 'Минимальное качество',
        uk: 'Мінімальна якість',
        en: 'Minimum quality',
        zh: '最低画质'
      },
      cso_max_quality: {
        ru: 'Максимальное качество',
        uk: 'Максимальна якість',
        en: 'Maximum quality',
        zh: '最高画质'
      },
      cso_language: {
        ru: 'Язык',
        uk: 'Мова',
        en: 'Language',
        zh: '语言'
      },
      cso_kids: {
        ru: 'Детский режим',
        uk: 'Дитячий режим',
        en: 'Kids mode',
        zh: '儿童模式'
      },
      cso_debug: {
        ru: 'Отладка',
        uk: 'Налагодження',
        en: 'Debug',
        zh: '调试'
      },
      cso_auto_upgrade: {
        ru: 'Автоулучшение источника',
        uk: 'Автопокращення джерела',
        en: 'Automatic source upgrade',
        zh: '自动升级来源'
      },
      cso_show_upgrade: {
        ru: 'Показывать лучший вариант',
        uk: 'Показувати кращий варіант',
        en: 'Show better variant',
        zh: '显示更好版本'
      },
      cso_diag_catalog: {
        ru: 'Проверить каталог Skaz',
        uk: 'Перевірити каталог Skaz',
        en: 'Check Skaz catalog',
        zh: '检查 Skaz 目录'
      },
      cso_diag_film: {
        ru: 'Последний поиск фильма',
        uk: 'Останній пошук фільму',
        en: 'Last film search',
        zh: '最近电影搜索'
      },
      cso_diag_series: {
        ru: 'Последняя проверка сериалов',
        uk: 'Остання перевірка серіалів',
        en: 'Last series probe',
        zh: '最近剧集检测'
      },
      cso_diag_logs: {
        ru: 'Показать логи',
        uk: 'Показати логи',
        en: 'Show logs',
        zh: '显示日志'
      },
      cso_clear_cache: {
        ru: 'Очистить кэш',
        uk: 'Очистити кеш',
        en: 'Clear cache',
        zh: '清理缓存'
      }
    });

    function t(key, fallback) {
      try {
        var value = L.Lang.translate(key);
        return value || fallback;
      } catch (e) {
        return fallback;
      }
    }

    /* =========================
       6. CSS
       ========================= */

    function installCSS() {
      if (doc.getElementById('capsule-online-style')) return;

      var css = [
        '.cso-root{--cso-bg:rgba(0,0,0,.32);--cso-card:rgba(255,255,255,.045);--cso-text:#fff;--cso-muted:rgba(255,255,255,.62);--cso-accent:#4cc2ff;--cso-success:#42d392;--cso-warning:#ffb648;--cso-danger:#ff5c6c;--cso-radius:.55em;color:var(--cso-text);font-variant-numeric:tabular-nums}',
        '.cso-root *{box-sizing:border-box}',
        '.cso-root .cso-header{padding:.85em 1em .45em}',
        '.cso-root .cso-title{font-size:1.25em;font-weight:700;line-height:1.25;display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;-webkit-line-clamp:2;line-clamp:2}',
        '.cso-root .cso-status{display:none;padding:0 0 .65em;font-size:.82em;opacity:.8}',
        '.cso-root .cso-status[data-state=search]{display:block;opacity:.88;color:var(--cso-accent)}',
        '.cso-root .cso-status[data-state=recover]{display:block;opacity:.88;color:var(--cso-warning)}',
        '.cso-root .torrent-filter{display:flex;flex-wrap:wrap;gap:.55em;padding:0 1em .75em}',
        '@supports not (gap: 1px){.cso-root .torrent-filter>*+*{margin-left:.55em}}',
        '.cso-root .simple-button--filter{min-height:2.55em;padding:.45em .85em;border-radius:var(--cso-radius);background:var(--cso-card);border:1px solid rgba(255,255,255,.12);cursor:pointer}',
        '.cso-root .simple-button--filter span{display:block;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:14em}',
        '.cso-root .selector.focus{background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.65);box-shadow:0 0 0 2px rgba(255,255,255,.12)}',
        '.cso-root .cso-scroll{padding:0 1em;max-height:calc(100vh - 15em);overflow:auto;overscroll-behavior:contain;-webkit-overflow-scrolling:touch}',
        '.cso-root .online-prestige{position:relative;display:flex;border-radius:.72em;background:var(--cso-bg);margin-bottom:.75em;overflow:hidden;transition:background .16s ease-out}',
        '.cso-root .online-prestige::after{content:" ";position:absolute;inset:0;border:2px solid transparent;border-radius:inherit;opacity:0;pointer-events:none;transition:opacity .16s ease-out}',
        '.cso-root .online-prestige.focus::after{border-color:rgba(255,255,255,.96);opacity:1}',
        '.cso-root .online-prestige.focus{background:rgba(255,255,255,.085)}',
        '.cso-root .online-prestige__img{width:11.8em;min-height:7em;flex:0 0 auto;background:rgba(255,255,255,.04)}',
        '.cso-root .online-prestige__img img{width:100%;height:100%;object-fit:cover;border-radius:.72em 0 0 .72em;display:block}',
        '.cso-root .online-prestige__img.cso-poster-fallback img{filter:blur(4.5px) brightness(.8);transform:scale(1.065)}',
        '.cso-root .online-prestige__body{padding:1em 1.25em;min-width:0;flex:1 1 auto}',
        '.cso-root .cso-title{font-size:1.18em;font-weight:650;line-height:1.25;margin-bottom:.35em;display:-webkit-box;-webkit-box-orient:vertical;overflow:hidden;-webkit-line-clamp:2;line-clamp:2}',
        '.cso-root .cso-meta{font-size:.82em;color:var(--cso-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
        '.cso-root .cso-episode{font-size:.78em;color:var(--cso-accent);margin-top:.35em}',
        '.cso-root .online-empty{padding:2em 1em;text-align:center}',
        '.cso-root .cso-empty-title{font-size:1.25em;font-weight:700;margin-bottom:.5em}',
        '.cso-root .cso-empty-text{font-size:.9em;color:var(--cso-muted);margin-bottom:1em}',
        '.cso-root .cso-empty-buttons{display:flex;justify-content:center;gap:.65em;flex-wrap:wrap}',
        '.cso-root .cso-end-spacer{display:block;clear:both;width:100%;height:clamp(3rem,6vh,5rem);min-height:3rem;pointer-events:none}',
        '@media(max-width:660px){.cso-root .torrent-filter{gap:.45em}.cso-root .online-prestige__img{width:8.2em;min-height:5.6em}.cso-root .online-prestige__body{padding:.8em .9em}}',
        '@media(prefers-reduced-motion:reduce){.cso-root .online-prestige,.cso-root .online-prestige::after,.cso-root .simple-button--filter,.cso-root .online-prestige__img img{transition:none!important}}'
      ].join('\n');

      var style = doc.createElement('style');
      style.id = 'capsule-online-style';
      style.textContent = css;
      doc.head.appendChild(style);
    }

    /* =========================
       7. Templates
       ========================= */

    function installTemplates() {
      L.Template.add('capsule_online_root',
        '<div class="cso-root">' +
          '<div class="cso-header">' +
            '<div class="cso-title">{title}</div>' +
            '<div class="cso-status"></div>' +
          '</div>' +
          '<div class="cso-filters torrent-filter">' +
            '<div class="simple-button--filter selector cso-source"><span>{source}</span></div>' +
            '<div class="simple-button--filter selector cso-season"><span>{season}</span></div>' +
            '<div class="simple-button--filter selector cso-settings"><span>{settings}</span></div>' +
            '<div class="simple-button--filter selector cso-back"><span>{back}</span></div>' +
          '</div>' +
          '<div class="cso-scroll"></div>' +
          '<div class="cso-end-spacer"></div>' +
        '</div>'
      );

      L.Template.add('capsule_online_card',
        '<div class="online-prestige selector cso-card">' +
          '<div class="online-prestige__img"><img alt=""></div>' +
          '<div class="online-prestige__body">' +
            '<div class="cso-title"></div>' +
            '<div class="cso-meta"></div>' +
            '<div class="cso-episode"></div>' +
          '</div>' +
        '</div>'
      );

      L.Template.add('capsule_online_empty',
        '<div class="online-empty">' +
          '<div class="cso-empty-title"></div>' +
          '<div class="cso-empty-text"></div>' +
          '<div class="cso-empty-buttons">' +
            '<div class="simple-button--filter selector cso-empty-retry"></div>' +
            '<div class="simple-button--filter selector cso-empty-settings"></div>' +
          '</div>' +
        '</div>'
      );
    }

    function tpl(name, data) {
      var out = L.Template.get(name, data || {}, true);

      if (typeof out === 'string' && $) {
        return $(out);
      }

      return out;
    }

    /* =========================
       8. Domain constants
       ========================= */

    var FAMILIES = [
      { key: 'alloha', title: 'Alloha', priority: 95, auto: true, autoSeries: true },
      { key: 'filmix', title: 'Filmix', priority: 89, auto: true, autoSeries: true },
      { key: 'hdrezka', title: 'HDRezka', priority: 93, auto: true, autoSeries: true },
      { key: 'kodik', title: 'Kodik', priority: 80, auto: true, autoSeries: true },
      { key: 'vibix', title: 'VIBIX', priority: 78, auto: true, autoSeries: true },
      { key: 'mirkinoz', title: 'Mir Kino Z', priority: 60, auto: false, autoSeries: false },
      { key: 'rezka', title: 'Rezka', priority: 55, auto: false, autoSeries: false },
      { key: 'redheadsound', title: 'RedHeadSound', priority: 70, auto: false, autoSeries: false },
      { key: 'kinopub', title: 'Kinopub', priority: 50, auto: false, autoSeries: false },
      { key: 'collaps', title: 'Collaps', priority: 45, auto: false, autoSeries: false },
      { key: 'skaztv', title: 'Skaz TV', priority: 40, auto: false, autoSeries: false }
    ];

    var FAMILY_MAP = {};
    var FAMILY_ORDER = [];

    for (var fi = 0; fi < FAMILIES.length; fi++) {
      FAMILY_MAP[FAMILIES[fi].key] = FAMILIES[fi];
      FAMILY_ORDER.push(FAMILIES[fi].key);
    }

    var VOICE_CATEGORIES = [
      'rhs', 'dub', 'lostfilm', 'rezka', 'rezka18', 'tvshows',
      'kubik', 'goblin', 'original', 'amateur', 'other'
    ];

    var VOICE_RANK = {
      rhs: 8,
      dub: 7,
      lostfilm: 6,
      rezka: 5,
      tvshows: 4,
      kubik: 3,
      goblin: 2,
      original: 1,
      amateur: 1,
      other: 0,
      rezka18: 0
    };

    function findFamily(key) {
      return FAMILY_MAP[key] || null;
    }

    function familyOf(provider) {
      var id = lower(provider && (provider.balanser || provider.id || provider.key || provider));
      var name = norm(provider && (provider.name || provider.title || provider.balanser_name || provider));

      if (!id && !name) return '';

      if (id === 'alloha' || id === 'allohatv' || /аллоха|alloha/.test(name)) return 'alloha';
      if (id === 'hdrezka' || (id === 'rezka' && /hd\s*rezka|hdrezka/.test(name)) || /hd\s*rezka|hdrezka/.test(name)) return 'hdrezka';
      if (id === 'filmix' || id === 'filmixtv' || id === 'fxapi' || /фильмикс|filmix/.test(name)) return 'filmix';
      if (id === 'vibix' || id === 'vibixtv' || /вибикс|vibix/.test(name)) return 'vibix';
      if (id === 'kodik' || id === 'kodiktv' || /кодик|kodik/.test(name)) return 'kodik';
      if (/^(?:mirkinoz|mirkino|mirkinotv|mirkino4k)$/.test(id) || /мир\s*кино\s*z|mir\s*kino\s*z/.test(name)) return 'mirkinoz';
      if (/^(?:redheadsound|redheadsoundtv|rhsprem|rhs|rhspro)$/.test(id) || /red\s*head\s*sound|рхс/.test(name)) return 'redheadsound';
      if (/^(?:kinopub|kinopubtv|kpu|kpu-tv)$/.test(id) || /кинопаб|kinopub|кпу/.test(name)) return 'kinopub';
      if (id === 'collaps' || /коллапс|collaps/.test(name)) return 'collaps';
      if (id === 'skaztv' || /skaz\s*tv/.test(name)) return 'skaztv';
      if (id === 'rezka' || (/резка/.test(name) && !/hd/.test(name))) return 'rezka';

      var first = (id || name).split(/[\s.:/-]+/)[0];
      return findFamily(first) ? first : '';
    }

    /* =========================
       9. Config
       ========================= */

    function readConfig(manual) {
      var cfg = {
        manual: !!manual,
        auto: bool('auto', true),
        mode: String(get('search_mode', 'normal')).toLowerCase(),
        fallback: bool('fallback', true),
        minQuality: num(get('min_quality', 0), 0),
        maxQuality: num(get('max_quality', 0), 0),
        language: String(get('language', 'auto')).toLowerCase(),
        kids: bool('kids', false),
        debug: bool('debug', false),
        sources: {},
        voices: {}
      };

      if (cfg.mode !== 'fast' && cfg.mode !== 'economy') {
        cfg.mode = 'normal';
      }

      for (var i = 0; i < FAMILIES.length; i++) {
        var family = FAMILIES[i];
        cfg.sources[family.key] = bool('source_' + family.key, family.auto !== false);
      }

      for (var v = 0; v < VOICE_CATEGORIES.length; v++) {
        cfg.voices['voice_' + VOICE_CATEGORIES[v]] = bool('voice_' + VOICE_CATEGORIES[v], true);
      }

      return cfg;
    }

    function sourceAllowed(family, cfg, series) {
      if (!family) return false;
      if (cfg.manual) return true;
      if (skipProvider(family)) return false;

      var f = findFamily(family);
      var defaultValue = series ? (f && f.autoSeries !== false) : (f && f.auto !== false);

      return cfg.sources[family] !== undefined ? !!cfg.sources[family] : !!defaultValue;
    }

    /* =========================
       10. Voice / language / quality
       ========================= */

    function voiceCategory(label) {
      var text = norm(label);

      if (/red head sound|rhs|ред хед саунд|рхс/.test(text)) return 'rhs';
      if (/lost film|лост фильм/.test(text)) return 'lostfilm';
      if (/rezka\s*18|резка\s*18|18\s*(?:плюс|\+)/.test(text)) return 'rezka18';
      if (/дубл|пифагор|невафильм|кинотеатр/.test(text)) return 'dub';
      if (/rezka|резка|hdrezka/.test(text)) return 'rezka';
      if (/tv shows|тв шоу|твшоу/.test(text)) return 'tvshows';
      if (/кубик\s*в\s*кубе|kubik/.test(text)) return 'kubik';
      if (/goblin|гоблин|пучков/.test(text)) return 'goblin';
      if (/original|английск|english|оригинал|без перевода/.test(text)) return 'original';
      if (/любительск|нейросеть|одноголос|авторск/.test(text)) return 'amateur';

      return 'other';
    }

    function voiceRank(label) {
      return VOICE_RANK[voiceCategory(label)] || 0;
    }

    function forbiddenVoice(label) {
      var text = norm(label);

      return /dragon\s*money|драгон\s*мани|1xbet|1win|joycasino|melbet|mostbet|vavada|pin\s*up|betboom|parimatch|leonbet|stake|казино|рекламн|промокод|sponsored/i.test(text);
    }

    function kidsBlocked(label) {
      var text = norm(label);

      return /kubik\s*v\s*kube|кубик\s*в\s*кубе|rezka\s*18|резка\s*18|18\s*(?:плюс|plus)|21\s*(?:плюс|plus)|adult|uncensored|без цензуры|ненорматив|нецензур|матерн|эротик|xxx|r-rated|nc-17|пародийн/i.test(text);
    }

    function voiceBlocked(label, cfg) {
      var category = voiceCategory(label);

      if (forbiddenVoice(label)) return true;
      if (cfg.kids && kidsBlocked(label)) return true;
      if (cfg.voices && cfg.voices['voice_' + category] === false) return true;

      return false;
    }

    function langCode(value) {
      var text = norm(value);

      if (/^(?:ru|russian|русский|русская|рус)$/.test(text)) return 'ru';
      if (/^(?:uk|ua|ukrainian|украинский|українська)$/.test(text)) return 'uk';
      if (/^(?:en|english|английский)$/.test(text)) return 'en';
      if (/^(?:original|orig|оригинал|оригинальная|оригинальный|без перевода)$/.test(text)) return 'original';

      return '';
    }

    function languageAccepted(candidate, cfg) {
      if (cfg.language === 'auto') return true;

      var got = langCode(candidate.language || candidate.voice || candidate.text || candidate.file_language);

      if (!got) return true;

      return got === cfg.language;
    }

    function langTier(candidate, cfg) {
      if (cfg.language === 'auto') return 1;

      var got = langCode(candidate.voice || candidate.text || candidate.language);

      if (!got) return 1;

      return got === cfg.language ? 2 : 0;
    }

    function qualityHeight(value) {
      var text = lower(value);

      if (/2160|4k|uhd/.test(text)) return 2160;
      if (/1440/.test(text)) return 1440;
      if (/1080|fhd/.test(text)) return 1080;
      if (/720|hd/.test(text)) return 720;
      if (/480/.test(text)) return 480;

      return 0;
    }

    function qualityOk(height, cfg) {
      if (cfg.minQuality && height > 0 && height < cfg.minQuality) return false;
      if (cfg.maxQuality && height > cfg.maxQuality) return false;
      return true;
    }

    /* =========================
       11. URL / safety / runtime
       ========================= */

    function playableMethod(method, url) {
      var m = lower(method);

      if (m === 'play' || m === 'call') return true;

      return /\.(mp4|m3u8|mpd|webm|mkv|avi)(\?|$)/i.test(url) ||
        /\/(?:play|stream|video|online)\//i.test(url) || /^https?:\/\//i.test(url);
    }

    function adMarked(obj) {
      if (!obj || typeof obj !== 'object') return false;

      return [obj.vast,obj.preroll,obj.pre_roll,obj.advertisement,obj.ads,obj.has_ads].some(function(v){return v === true || v === 1 || v === 'true' || !!(v && typeof v === 'object' && (v.url || v.src || v.tag));});
    }

    function minutes(value) {
      var n = num(value, 0);

      if (n <= 0) return 0;
      if (n > 100000) return n / 60000;
      if (n > 420) return n / 60;

      return n;
    }

    function runtimeOk(movie, candidate) {
      var reference = minutes(movie && movie.runtime);
      var actual = minutes(candidate.duration || candidate.runtime);

      if (!reference || !actual) return true;

      return Math.abs(reference - actual) <= Math.max(13, reference * 0.14);
    }

    /* =========================
       12. Candidates and ranking
       ========================= */

    function bestQuality(map, cfg) {
      if (!map || typeof map !== 'object' || Array.isArray(map)) return null;
      var options = [];
      Object.keys(map).forEach(function(label) {
        var value = map[label];
        var path = typeof value === 'string' ? value : value && (value.url || value.src);
        if (typeof path !== 'string') return;
        path = path.split(' or ')[0].trim();
        var height = qualityHeight(label);
        if (height && safeUrl(path) && qualityOk(height, cfg))
          options.push({ url: absoluteUrl(path), height: height, label: label });
      });
      options.sort(function(a,b) { return b.height - a.height; });
      return options[0] || null;
    }

    function makeCandidate(provider, file, inherited, ms) {
      inherited = inherited || {};
      file = file || {};
      var qualityMap = file.qualitys || file.quality || {};
      var qualityPick = bestQuality(qualityMap, { minQuality: 0, maxQuality: 0 });
      var url = absoluteUrl(str(file.url || file.stream || ''), inherited.base || provider.url);
      var voice = trim(file.voice_name || file.translate_voice || file.voice ||
        file.studio || inherited.voice || '');
      var qualityLabel = trim(file.quality_label || file.label ||
        (typeof file.quality === 'string' ? file.quality : '') ||
        (qualityPick && qualityPick.label) || '');
      var sn = num(file.season || file.season_number || inherited.season, 0);
      var ep = num(file.episode || file.episode_number || file.e || inherited.episode, 0);
      if (!ep) {
        var m = str(file.text).match(/(?:серия|episode|эпизод)\s*[:№#.-]*\s*(\d+)/i);
        if (m) ep = num(m[1], 0);
      }
      return {
        family: provider.family || provider.key || familyOf(provider),
        provider: provider,
        url: url,
        url_reserve: str(file.url_reserve || '').trim(),
        text: trim(file.text || ''),
        voice: voice,
        quality: qualityLabel,
        height: qualityHeight(qualityLabel) || (qualityPick ? qualityPick.height : 0),
        qualitys: qualityMap && typeof qualityMap === 'object' ? qualityMap : {},
        hdr: /hdr|dolby vision|dv/i.test(qualityLabel),
        season: sn,
        episode: ep,
        duration: num(file.duration || file.runtime, 0),
        thumbnail: trim(file.thumbnail || file.still_path || file.img || file.image || ''),
        method: lower(file.method || 'play'),
        ms: num(ms, 0),
        stream: str(file.stream || ''),
        subtitles: file.subtitles,
        segments: file.segments,
        headers: file.headers,
        original: file
      };
    }

    function acceptable(candidate, movie, cfg) {
      if (!candidate || !safeUrl(candidate.url) ||
          !/^(?:call|play)$/.test(candidate.method)) return false;
      if (forbiddenVoice(candidate.voice) || voiceBlocked(candidate.voice, cfg)) return false;
      if (adMarked(candidate.original)) return false;
      if (!qualityOk(candidate.height, cfg)) return false;
      if (!languageAccepted(candidate, cfg)) return false;
      if (!runtimeOk(movie, candidate)) return false;
      if (!sourceAllowed(candidate.family, cfg, isSeries(movie))) return false;
      return true;
    }

    function compareCandidates(a, b, cfg) {
      var al = langTier(a, cfg), bl = langTier(b, cfg);
      if (al !== bl) return bl - al;
      var av = voiceRank(a.voice), bv = voiceRank(b.voice);
      if (av !== bv) return bv - av;
      if (a.height !== b.height) return b.height - a.height;
      if (a.hdr !== b.hdr) return a.hdr ? -1 : 1;
      var ap = findFamily(a.family), bp = findFamily(b.family);
      if (ap && bp && ap.priority !== bp.priority)
        return bp.priority - ap.priority;
      var ah = healthScore(a.family), bh = healthScore(b.family);
      if (ah !== bh) return bh - ah;
      return a.ms - b.ms;
    }

    function confidence(candidate) {
      if (!candidate) return 0;
      var quality = candidate.height >= 1080 ? 0.35 :
        candidate.height >= 720 ? 0.24 : 0.12;
      return Math.min(1, quality + (voiceRank(candidate.voice) / 8) * 0.32 +
        healthScore(candidate.family) / 100 * 0.13 +
        (candidate.method === 'play' ? 0.13 : 0.05) +
        Math.max(0, 0.07 - candidate.ms / 65000));
    }

    /* =========================
       13. Fast Skaz discovery
       ========================= */

    function isSeries(movie) {
      if (!movie) return false;
      if (movie.__csoForceSeries === true) return true;
      if (movie.__csoForceMovie === true) return false;
      if (movie.media_type === 'tv' || movie.type === 'tv') return true;
      if (movie.media_type === 'movie' || movie.type === 'movie') return false;
      return !!(movie.number_of_seasons || movie.first_air_date ||
        (movie.name && !movie.title && !movie.release_date));
    }

    function movieParams(movie, serial) {
      movie = movie || {};
      var params = [
        'id=' + encodeURIComponent(movie.id || ''),
        'source=' + encodeURIComponent(movie.source || 'tmdb'),
        'serial=' + (serial ? 1 : 0),
        'year=' + encodeURIComponent(str(movie.release_date || movie.first_air_date).slice(0,4)),
        'title=' + encodeURIComponent(movie.title || movie.name || ''),
        'original_title=' + encodeURIComponent(movie.original_title || movie.original_name || ''),
        'original_language=' + encodeURIComponent(movie.original_language || ''),
        'clarification=0', 'similar=false'
      ];
      ['imdb_id','kinopoisk_id','tmdb_id'].forEach(function(k) {
        if (movie[k]) params.push(k + '=' + encodeURIComponent(movie[k]));
      });
      return params.join('&');
    }

    function appendMovieParams(url, movie, serial) {
      if (signedUrl(url) || /[?&]id=/.test(url)) return url;
      return url + (url.indexOf('?') >= 0 ? '&' : '?') + movieParams(movie, serial);
    }

    function extractProviders(json) {
      var rows = Array.isArray(json) ? json :
        json && (json.online || json.servers || json.providers) || [];
      if (!Array.isArray(rows)) return [];
      var result = [], seen = Object.create(null);
      rows.forEach(function(row) {
        if (!row || typeof row !== 'object') return;
        var family = familyOf(row);
        if (!family) return;
        var url = absoluteUrl(str(row.url || row.link || row.href ||
          ('lite/online/' + family + '/')), BASE);
        if (!url) return;
        // Different Filmix/Vibix pathways are kept as distinct providers.
        var key = family + '|' + url;
        if (seen[key]) return;
        seen[key] = true;
        result.push({
          key: family, family: family, name: str(row.name || row.title || family),
          url: url, show: row.show !== false && row.show !== 'false'
        });
      });
      return result;
    }

    var activeOrigin = BASE;
    function catalogRequest(movie, serial, endpoint, timeout, callback) {
      var target = appendMovieParams(activeOrigin + endpoint, movie, serial);
      requestJson(target, {timeout: Math.min(timeout, 3500)}, function(error,data) {
        if (!error && (extractProviders(data).length || data && data.memkey))
          return callback(null,data);
        // Some legacy Skaz instances are HTTP-only. Their public catalog
        // may be fetched anonymously, but AES key and account PII NEVER go
        // over HTTP. No downgrade for arbitrary provider domains.
        if (!/^https:\/\/(?:online(?:cf)?[3457]\.skaz\.tv)\//i.test(activeOrigin))
          return callback(error,data);
        var legacy = activeOrigin.replace(/^https:/i,'http:');
        requestJson(appendMovieParams(legacy + endpoint, movie, serial),
          {timeout: Math.min(3300,timeout)}, function(secondError, second) {
            if (!secondError && (extractProviders(second).length || second && second.memkey)) {
              activeOrigin = legacy;
              Log.warn('transport', 'HTTP-only legacy Skaz transport; no authentication headers used');
              return callback(null,second);
            }
            callback(error || secondError || new Error('catalog_empty'), data || second);
          });
      });
    }

    var catalogCache = Object.create(null);
    var catalogPending = Object.create(null);
    function getCatalog(movie, cfg, callback) {
      var serial = isSeries(movie);
      var key = str(movie.source || 'tmdb') + ':' +
        str(movie.id || norm(movie.title || movie.name)) + ':' + (serial ? 'tv' : 'film');
      var cached = catalogCache[key];
      if (cached && cached.until > Date.now()) {
        return setTimeout(function(){callback(null, cached.value);}, 0);
      }
      if (catalogPending[key]) { catalogPending[key].push(callback); return; }
      catalogPending[key] = [callback];
      var done = false;
      function finish(error, providers) {
        if (done) return;
        done = true;
        var callers = catalogPending[key] || [];
        delete catalogPending[key];
        providers = providers || [];
        if (!error && providers.length)
          catalogCache[key] = { value: providers, until: Date.now() + 45000 };
        NS.state.lastCatalog = providers;
        NS.state.lastCatalogMovie = key;
        callers.forEach(function(cb) { cb(error, providers); });
      }
      // Synchronous, immediately usable response. No lifeevents minute-long
      // poll in the hot path. A bounded async fallback is used only if empty.
      catalogRequest(movie, serial, 'lite/events?life=false', 4600,
        function(error, json) {
          var providers = extractProviders(json);
          if (providers.length) return finish(null, providers);
          catalogRequest(movie, serial, 'lite/events?life=true', 3000,
            function(secondError, live) {
              var initial = extractProviders(live);
              if (initial.length) return finish(null, initial);
              if (!live || !live.memkey)
                return finish(error || secondError || new Error('catalog_empty'), []);
              var memkey = encodeURIComponent(str(live.memkey));
              requestJson(activeOrigin + 'lifeevents?memkey=' + memkey + '&seen=0',
                { timeout: 3500 }, function(lastError, update) {
                  var rows = extractProviders(update);
                  finish(rows.length ? null : (lastError || new Error('catalog_empty')), rows);
                });
            });
        });
    }

    function primeExternalIds(movie) {
      if (!movie || !movie.id || movie.__csoIdsRequested ||
          (movie.imdb_id && movie.kinopoisk_id)) return;
      movie.__csoIdsRequested = true;
      requestJson(activeOrigin + 'externalids?id=' + encodeURIComponent(movie.id) +
        '&serial=' + (isSeries(movie) ? 1 : 0), { timeout: 1500 },
        function(error, ids) {
          if (error || !ids || typeof ids !== 'object' || Array.isArray(ids)) return;
          ['imdb_id','kinopoisk_id','tmdb_id'].forEach(function(key) {
            if (!movie[key] && ids[key]) movie[key] = ids[key];
          });
        });
    }

        function providerUrl(provider, movie) {
      return appendMovieParams(provider.url, movie, isSeries(movie));
    }

    function providerScore(provider) {
      var family = provider.key || familyOf(provider);
      var info = findFamily(family);
      return (info ? info.priority : 40) + healthScore(family) * 0.08 +
        (provider.show ? 4 : -20);
    }

    function rankProviders(providers, movie, cfg) {
      var serial = isSeries(movie);
      return providers.filter(function(p) {
        return sourceAllowed(p.key, cfg, serial) && (p.show || cfg.manual);
      }).sort(function(a,b) { return providerScore(b) - providerScore(a); });
    }

    /* =========================
       14. Inert HTML / Skaz data-json parsing
       ========================= */

    function parseProviderHtml(html, provider, inherited) {
      inherited = inherited || {};
      var result = { files: [], folders: [] };
      if (html && typeof html === 'object') {
        var rows = [].concat(html.videos || [], html.items || [], html.buttons || []);
        rows.forEach(function(row) {
          if (!row || typeof row !== 'object') return;
          if (row.method === 'link') result.folders.push(row);
          else if (row.method === 'call' || row.method === 'play') result.files.push(row);
        });
        return result;
      }
      if (typeof html !== 'string' || !html || html.length > REQUEST_MAX_BYTES) return result;
      var nodes = [];
      // DOMParser creates an inert document: no remote HTML is appended into
      // the live page and no remote scripts or event handlers are executed.
      try {
        if (typeof root.DOMParser === 'function') {
          var docu = new root.DOMParser().parseFromString(html, 'text/html');
          nodes = docu.querySelectorAll('.videos__item,.videos__button,[data-json]');
        } else if (doc && doc.createElement) {
          var template = doc.createElement('template');
          if (template.content) {
            template.innerHTML = html;
            nodes = template.content.querySelectorAll('.videos__item,.videos__button,[data-json]');
          }
        }
      } catch (e) { Log.warn('parse', e.message); }
      var seen = Object.create(null);
      for (var i = 0; i < Math.min(nodes.length, 1200); i++) {
        var el = nodes[i];
        var raw = el.getAttribute('data-json');
        if (!raw || raw.length > 65536) continue;
        var row;
        try { row = JSON.parse(raw); } catch(e) { continue; }
        if (!row || typeof row !== 'object' || Array.isArray(row)) continue;
        var url = absoluteUrl(str(row.url || row.stream), inherited.base || provider.url);
        if (!url) continue;
        var cls = str(el.getAttribute('class'));
        var isFolder = row.method === 'link' || /videos__button/.test(cls);
        var text = trim(row.text || el.textContent || '');
        var sn = num(row.season || row.season_number || el.getAttribute('s') ||
          el.getAttribute('data-season'), 0);
        var ep = num(row.episode || row.episode_number || el.getAttribute('e') ||
          el.getAttribute('data-episode'), 0);
        if (!sn) {
          var sm = text.match(/(?:сезон|season|сез\.)\s*[:№#.-]*\s*(\d+)/i);
          if (sm) sn = num(sm[1], 0);
        }
        if (!ep) {
          var em = text.match(/(?:серия|episode|эпизод)\s*[:№#.-]*\s*(\d+)/i);
          if (em) ep = num(em[1], 0);
        }
        row = assign({}, row, { url: url, text: text,
          season: isFolder ? sn : (sn || inherited.season || 0),
          episode: isFolder ? ep : (ep || inherited.episode || 0),
          method: isFolder ? 'link' : lower(row.method || 'play') });
        var key = row.method + '|' + row.url + '|' + row.episode + '|' + row.season;
        if (seen[key]) continue;
        seen[key] = true;
        if (isFolder) result.folders.push(row);
        else if (row.method === 'play' || row.method === 'call') result.files.push(row);
      }
      return result;
    }

    function folderType(row) {
      var name = norm(row.text || '');
      if (row.season || /(?:сезон|season|сез\s*\d+)/.test(name)) return 'season';
      if (/^(?:\d+\s*)?(?:серия|episode)/.test(name)) return 'episode';
      if (voiceRank(name) || /озвучк|перевод|дубляж|студия/.test(name)) return 'voice';
      return 'variant';
    }

    function folderScore(row, cfg, season) {
      var type = folderType(row), score = 0;
      if (type === 'voice') {
        if (voiceBlocked(row.text, cfg)) return -1000;
        score += 70 + voiceRank(row.text) * 10;
      } else if (type === 'season') {
        if (row.season && row.season !== season) return -1000;
        score += 145;
      } else if (type === 'episode') score += 100;
      else score += qualityHeight(row.text) ? 48 : 30;
      if (langCode(row.text) === cfg.language) score += 10;
      return score;
    }

    /* =========================
       15. Bounded provider graph crawler
       ========================= */

    function crawlProvider(provider, movie, cfg, season, deadline, callback) {
      var visited = Object.create(null), found = [], started = Date.now(),
        anyResponse = false;
      var serial = isSeries(movie), maxPages = serial ? 9 : 6;
      var queue = [{ url: providerUrl(provider, movie), voice: '', season: 0,
        depth: 0, score: 1000, base: provider.url }];
      var requested = 0, done = false;
      function finish() {
        if (done) return;
        done = true;
        recordHealth(provider.key, anyResponse, Date.now() - started);
        callback(found);
      }
      function next() {
        if (done) return;
        if (Date.now() > deadline || requested >= maxPages || !queue.length)
          return finish();
        queue.sort(function(a,b) { return b.score - a.score; });
        var task = queue.shift();
        if (visited[task.url]) return next();
        visited[task.url] = true;
        requested++;
        requestText(task.url, { timeout: Math.min(2800, Math.max(650, deadline - Date.now())),
          cacheMs: 14000 }, function(error, html) {
          if (done) return;
          if (!error && html) {
            anyResponse = true;
            var result = parseProviderHtml(html, provider, task);
            result.files.forEach(function(row) {
              var c = makeCandidate(provider, row, task, Date.now() - started);
              if (serial) {
                if (c.season !== season || c.episode <= 0) return;
              }
              if (acceptable(c, movie, cfg)) found.push(c);
            });
            var folders = result.folders.slice().sort(function(a,b) {
              return folderScore(b,cfg,season) - folderScore(a,cfg,season);
            });
            folders.forEach(function(row) {
              var score = folderScore(row, cfg, season);
              if (score < 0 || !safeUrl(row.url) || visited[row.url] || task.depth >= 5) return;
              var type = folderType(row);
              var voice = type === 'voice' ? row.text : task.voice;
              var s = type === 'season' && row.season ? row.season : task.season;
              queue.push({ url: row.url, depth: task.depth + 1, score: score,
                voice: voice, season: s,
                episode: type === 'episode' && row.episode ? row.episode : task.episode,
                base: row.url });
            });
            if (!serial && found.length && (cfg.mode === 'fast' ||
                !folders.some(function(x){ return folderType(x)==='voice'; })))
              return finish();
            if (serial && found.length &&
                found.filter(function(c){return c.episode>0;}).length >= 12)
              return finish();
          }
          next();
        });
      }
      next();
    }

    function probeProviders(providers, movie, cfg, season, callback) {
      var out = [], cursor = 0, running = 0, ended = false;
      var deadline = Date.now() + (cfg.mode === 'economy' ? 4400 :
        cfg.mode === 'fast' ? 5200 : 7200);
      var concurrency = cfg.mode === 'economy' ? 1 : 3;
      var timer = setTimeout(finish, Math.max(500, deadline - Date.now()));
      function finish() {
        if (ended) return;
        ended = true;
        clearTimeout(timer);
        callback(out);
      }
      function pump() {
        if (ended) return;
        if (Date.now() >= deadline || (!running && cursor >= providers.length))
          return finish();
        while (running < concurrency && cursor < providers.length && !ended) {
          running++;
          (function(p) {
            crawlProvider(p, movie, cfg, season, deadline, function(rows) {
              if (ended) return;
              running--;
              out.push.apply(out, rows);
              if (cfg.mode === 'economy' && out.length) return finish();
              if (cfg.mode === 'fast' && out.some(function(c){return confidence(c)>=0.80;}))
                return finish();
              pump();
            });
          })(providers[cursor++]);
        }
      }
      pump();
    }

    /* =========================
       16. Search, scoring and series completeness
       ========================= */

    function chooseSeriesCandidates(rows, season, cfg) {
      var groups = Object.create(null);
      rows.forEach(function(c) {
        if (c.season !== season || !c.episode) return;
        var id = c.family + '|' + norm(c.voice);
        if (!groups[id]) groups[id] = [];
        groups[id].push(c);
      });
      var options = Object.keys(groups).map(function(k) {
        var group = groups[k].slice().sort(function(a,b) {
          return a.episode - b.episode || compareCandidates(a,b,cfg);
        });
        var unique = [], prev = 0;
        group.forEach(function(row) {
          if (row.episode !== prev) unique.push(row);
          prev = row.episode;
        });
        return unique;
      }).filter(function(g) { return g.length; });
      options.sort(function(a,b) {
        // Completeness is the first rule, then translation and stream quality.
        return b.length - a.length || compareCandidates(a[0],b[0],cfg);
      });
      return options[0] || [];
    }

    function searchFilm(movie, cfg, context, callback) {
      NS.state.lastFilmMovie = movie;
      primeExternalIds(movie);
      getCatalog(movie, cfg, function(error, catalog) {
        if (context.state.destroyed) return;
        if (error || !catalog || !catalog.length)
          return callback(error || new Error('catalog_empty'), null);
        var providers = rankProviders(catalog, movie, cfg);
        if (context.state.currentSource)
          providers = providers.filter(function(p) { return p.key === context.state.currentSource; });
        if (!providers.length) return callback(new Error('no_allowed_providers'), null);
        probeProviders(providers, movie, cfg, 0, function(candidates) {
          if (context.state.destroyed) return;
          candidates.sort(function(a,b){return compareCandidates(a,b,cfg);});
          var best = candidates[0] || null;
          NS.state.lastFilmScan = {
            at: Date.now(), mode: cfg.mode, providers: providers.length,
            candidates: candidates.length,
            best: best ? {family:best.family,height:best.height,voice:best.voice,
              confidence:confidence(best)} : null
          };
          context.state.alternatives = candidates;
          callback(best ? null : new Error('no_candidate'), best);
        });
      });
    }

    function loadSeries(movie, season, cfg, context, callback) {
      NS.state.lastSeriesMovie = movie;
      primeExternalIds(movie);
      getCatalog(movie, cfg, function(error, catalog) {
        if (context.state.destroyed) return;
        if (error || !catalog || !catalog.length)
          return callback(error || new Error('catalog_empty'), null);
        var providers = rankProviders(catalog, movie, cfg);
        if (context.state.currentSource)
          providers = providers.filter(function(p){return p.key === context.state.currentSource;});
        if (!providers.length) return callback(new Error('no_allowed_providers'), null);
        probeProviders(providers, movie, cfg, season, function(candidates) {
          if (context.state.destroyed) return;
          var episodes = chooseSeriesCandidates(candidates, season, cfg);
          NS.state.lastSeriesScan = {at: Date.now(), season: season,
            providers: providers.length, candidates: candidates.length,
            episodes: episodes.length};
          callback(episodes.length ? null : new Error('no_episodes'), episodes);
        });
      });
    }

    

    /* =========================
       18. Playback helpers
       ========================= */

    function markHistory(movie, progress) {
      if (!movie || !movie.id) return;

      try {
        if (L.Favorite && L.Favorite.add) {
          L.Favorite.add('history', movie, num(progress, 0));
        }
      } catch (e) {
        Log.warn('history', e && e.message ? e.message : String(e));
      }
    }

    function notePreference(family) {
      if (!family) return;

      var value = num(recall('pref_' + family), 0) + 1;
      remember('pref_' + family, value, 2592000000);
    }

    function posterUrl(value) {
      value = trim(value);
      if (!value) return '';
      if (/^https?:\/\//i.test(value)) return safeUrl(value) ? value : '';
      if (/^\/[^/]/.test(value))
        return 'https://image.tmdb.org/t/p/w780' + value;
      return '';
    }

    function buildPlayData(movie, candidate) {
      var cover = posterUrl(candidate.thumbnail) ||
        posterUrl(movie.poster) || posterUrl(movie.poster_path);
      var item = {
        url: candidate.url,
        title: movie.title || movie.name || candidate.text || '',
        card: assign({}, movie, { poster: cover, img: cover }),
        poster: cover,
        thumbnail: cover,
        quality: candidate.qualitys || {},
        voice_name: candidate.voice,
        season: candidate.season,
        episode: candidate.episode,
        subtitles: candidate.subtitles,
        segments: candidate.segments,
        headers: candidate.headers || {},
        iptv: true,
        isonline: true
      };
      if (candidate.url_reserve) item.url_reserve = candidate.url_reserve;
      return item;
    }

    function qualityForResolved(candidate, response, cfg) {
      var selected = bestQuality(response.quality || response.qualitys ||
        candidate.qualitys, cfg);
      var raw = str(response.url || response.stream || candidate.stream ||
        (candidate.method === 'play' ? candidate.url : ''));
      var pieces = raw.split(' or ');
      var direct = selected ? selected.url : absoluteUrl(pieces[0]);
      var reserve = pieces.length > 1 ? absoluteUrl(pieces[1]) : '';
      var fromDirect = qualityHeight(response.quality_label || response.text || '') ||
        candidate.height;
      if (!selected && !qualityOk(fromDirect, cfg)) return null;
      if (!safeUrl(direct)) return null;
      return {
        url: direct, reserve: reserve,
        height: selected ? selected.height : fromDirect
      };
    }

    function resolveCandidate(candidate, cfg, callback) {
      if (!candidate || !safeUrl(candidate.url))
        return callback(new Error('invalid_candidate'), null);
      if (candidate.method === 'play') {
        var ready = qualityForResolved(candidate, candidate.original || {}, cfg);
        return callback(ready ? null : new Error('quality_unavailable'),
          ready ? assign({}, candidate, { url: ready.url,
            url_reserve: ready.reserve, height: ready.height }) : null);
      }
      requestJson(candidate.url, { timeout: 6800 }, function(error, response) {
        if (error || !response || typeof response !== 'object')
          return callback(error || new Error('stream_unavailable'), null);
        if (response.rch)
          return callback(new Error('provider_requires_rch'), null);
        var voice = trim(response.voice_name || response.translate_voice ||
          response.voice || candidate.voice);
        if (voiceBlocked(voice, cfg) || adMarked(response))
          return callback(new Error('voice_or_ads_blocked'), null);
        var quality = qualityForResolved(candidate, response, cfg);
        if (!quality) return callback(new Error('stream_quality_unavailable'), null);
        callback(null, assign({}, candidate, {
          url: quality.url, url_reserve: quality.reserve,
          voice: voice, height: quality.height,
          qualitys: response.quality || response.qualitys || candidate.qualitys,
          headers: response.headers || candidate.headers,
          subtitles: response.subtitles || candidate.subtitles,
          segments: response.segments || candidate.segments
        }));
      });
    }

    function startLampaPlayer(item, playlist) {
      if (!L.Player || typeof L.Player.play !== 'function')
        throw new Error('player_unavailable');
      L.Player.play(item);
      if (playlist && playlist.length && typeof L.Player.playlist === 'function')
        L.Player.playlist(playlist);
    }

    function makeSeasonPlaylist(movie, candidate, cfg, context, done) {
      var rows = context.state.cards.filter(function(c) {
        return c.season === candidate.season;
      }).sort(function(a,b){return a.episode - b.episode;});
      var chosen = null;
      var list = rows.map(function(row) {
        var item = buildPlayData(movie, row);
        if (row === candidate) chosen = item;
        if (row.method === 'call') {
          // Lampa's internal player can resolve each episode just-in-time.
          // This avoids 20+ simultaneous signed requests at startup.
          item.url = function(next) {
            resolveCandidate(row, cfg, function(error, resolved) {
              if (resolved) {
                item.url = resolved.url;
                item.quality = resolved.qualitys || {};
                item.headers = resolved.headers || {};
                item.subtitles = resolved.subtitles;
              } else item.url = '';
              if (typeof next === 'function') next();
            });
          };
        }
        return item;
      });
      if (!chosen) chosen = list[0];
      done(list, chosen);
    }

    function playCandidate(movie, candidate, cfg, context) {
      if (!candidate || !acceptable(candidate, movie, cfg)) return false;
      var revision = context.state.playRevision = (context.state.playRevision || 0) + 1;
      context.loading(true);
      function finished(error, resolved) {
        if (context.state.destroyed || revision !== context.state.playRevision) return;
        if (error || !resolved) {
          if (cfg.fallback && !context.state.currentSource && !context.state.fallbackUsed) {
            var alternatives = context.state.alternatives || [];
            var other = alternatives.find(function(x) {
              return x !== candidate && x.url !== candidate.url &&
                acceptable(x, movie, cfg);
            });
            if (other) {
              context.state.fallbackUsed = true;
              context.loading(false);
              return playCandidate(movie, other, cfg, context);
            }
          }
          context.loading(false);
          if (L.Noty && L.Noty.show)
            L.Noty.show(error && error.message === 'provider_requires_rch' ?
              'Источник требует RCH-подтверждение. Выберите другой источник.' :
              t('cso_play_error', 'Ошибка запуска'));
          return;
        }
        try {
          var item = buildPlayData(movie, resolved);
          if (isSeries(movie)) {
            makeSeasonPlaylist(movie, candidate, cfg, context, function(queue) {
              var index = context.state.cards.indexOf(candidate);
              if (index >= 0 && queue[index]) queue[index] = item;
              item.playlist = queue;
              startLampaPlayer(item, queue);
            });
          } else startLampaPlayer(item, [item]);
          markHistory(movie, 0);
          notePreference(resolved.family);
          context.loading(false);
        } catch (e) {
          context.loading(false);
          Log.error('play', e.message);
          if (L.Noty && L.Noty.show)
            L.Noty.show(t('cso_play_error', 'Ошибка запуска'));
        }
      }
      resolveCandidate(candidate, cfg, finished);
      return true;
    }

    

        /* =========================
       19. Component
       ========================= */

    function Component(activity) {
      if (!(this instanceof Component)) {
        return new Component(activity);
      }

      this.activity = activity || {};
      this.object = this.activity.object || this.activity.card || this.activity;
      this.movie = this.object.movie || this.object.card || this.object || {};
      this.cfg = readConfig(!!this.object.cso_manual_screen);

      this.state = {
        destroyed: false,
        timers: [],
        images: [],
        selectOpen: false,
        settingsOpen: false,
        current: null,
        cards: [],
        season: 1,
        scanRevision: 0,
        playRevision: 0,
        currentSource: '',
        alternatives: [],
        fallbackUsed: false
      };

      this.html = null;
      this.scroll = null;
    }

    Component.prototype.choiceKey = function () {
      return 'choice:' +
        (this.movie.source || 'tmdb') + ':' +
        (this.movie.id || norm(this.movie.title || this.movie.name));
    };

    Component.prototype.getChoice = function () {
      var choice = recall(this.choiceKey());

      if (!choice || typeof choice !== 'object') {
        choice = {
          season: 1,
          voice: 0,
          voice_name: '',
          voice_url: '',
          voice_manual: false
        };
      }

      return choice;
    };

    Component.prototype.saveChoice = function (choice) {
      remember(this.choiceKey(), choice, 2592000000);
    };

    Component.prototype.render = function () {
      if (this.state.destroyed) return;

      var title = this.movie.title || this.movie.name || t('title_online', 'Онлайн');

      this.html = tpl('capsule_online_root', {
        title: escapeHtml(title),
        source: t('cso_source', 'Источник'),
        season: t('cso_season', 'Сезон'),
        settings: t('cso_settings', 'Настройки'),
        back: t('cso_back', 'Назад')
      });

      this.bind();
      this.initScroll();
      this.installController();

      return this.html;
    };

    Component.prototype.create = function () {
      return this.render();
    };

    Component.prototype.initScroll = function () {
      // Keep a native scroll container; Lampa.Scroll expects its own internal
      // DOM tree, not the (element, options) pair used by v0.29.0.
      // The CSS overflow fallback works in both Android and TV WebViews.
      if (!this.html) return;
      var node = this.html.find('.cso-scroll');
      if (node && node.length && node.attr) node.attr('tabindex','-1');
    };

    Component.prototype.installController = function () {
      if (!L.Controller || typeof L.Controller.add !== 'function') return;
      var self = this;
      try {
        L.Controller.add('content', {
          toggle: function () {
            if (!self.html || self.state.destroyed) return;
            if (L.Controller.collectionSet)
              L.Controller.collectionSet(self.html, self.html);
            if (L.Controller.collectionFocus)
              L.Controller.collectionFocus(false, self.html);
          },
          up: function () {
            if (L.Navigator && L.Navigator.canmove && L.Navigator.canmove('up'))
              L.Navigator.move('up');
            else if (L.Controller.toggle) L.Controller.toggle('head');
          },
          down: function () {
            if (L.Navigator && L.Navigator.move) L.Navigator.move('down');
          },
          left: function () {
            if (L.Navigator && L.Navigator.move) L.Navigator.move('left');
          },
          right: function () {
            if (L.Navigator && L.Navigator.move) L.Navigator.move('right');
          },
          back: function () { return self.back(); }
        });
      } catch (e) { Log.warn('controller_install', e.message); }
    };

        Component.prototype.bind = function () {
      if (!this.html || !$) return;

      var self = this;

      var sourceBtn = this.html.find('.cso-source');
      var seasonBtn = this.html.find('.cso-season');
      var settingsBtn = this.html.find('.cso-settings');
      var backBtn = this.html.find('.cso-back');

      var onSource = debounceFn(function () {
        self.openSourcePicker();
      }, 450, this.state.timers);

      var onSeason = debounceFn(function () {
        self.openSeasonPicker();
      }, 450, this.state.timers);

      var onSettings = debounceFn(function () {
        self.openSettings();
      }, 450, this.state.timers);

      var onBack = debounceFn(function () {
        self.handleBack();
      }, 350, this.state.timers);

      sourceBtn.on('hover:enter', onSource).on('click', onSource);
      seasonBtn.on('hover:enter', onSeason).on('click', onSeason);
      settingsBtn.on('hover:enter', onSettings).on('click', onSettings);
      backBtn.on('hover:enter', onBack).on('click', onBack);
    };

    Component.prototype.start = function () {
      if (this.state.destroyed) return;
      this.state.scanRevision++;
      this.state.playRevision++;
      this.cfg = readConfig(!!this.object.cso_manual_screen || !!this.state.currentSource);
      this.state.fallbackUsed = false;
      this.state.cards = [];
      this.state.current = null;
      this.loading(true);
      if (!this.cfg.auto && !this.state.currentSource) {
        var self = this, revision = this.state.scanRevision;
        getCatalog(this.movie, this.cfg, function(error) {
          if (self.state.destroyed || revision !== self.state.scanRevision) return;
          self.loading(false);
          if (error) self.empty(error.message);
          else self.openSourcePicker();
        });
        return;
      }

      if (isSeries(this.movie)) {
        var choice = this.getChoice();
        this.state.season = num(choice.season || this.object.season || 1, 1);
        this.updateSeasonButton();
        this.loadEpisodes(this.state.season);
      } else {
        this.searchFilm();
      }
    };

    Component.prototype.loading = function (on) {
      if (this.state.destroyed) return;

      var self = this;

      if (on) {
        try {
          if (L.Loading && L.Loading.start) {
            L.Loading.start(function () {
              self.loading(false);
            });
          }
        } catch (e) {
          Log.warn('loading_start', e && e.message ? e.message : String(e));
        }

        if (this.html) {
          this.html.find('.cso-status')
            .attr('data-state', 'search')
            .text(t('cso_searching', 'Ищем источник...'));
        }
      } else {
        try {
          if (L.Loading && L.Loading.stop) {
            L.Loading.stop();
          }
        } catch (e) {
          Log.warn('loading_stop', e && e.message ? e.message : String(e));
        }

        if (this.html) {
          this.html.find('.cso-status')
            .removeAttr('data-state')
            .text('');
        }
      }
    };

    Component.prototype.updateSeasonButton = function () {
      if (!this.html) return;

      this.html.find('.cso-season span').text(
        t('cso_season', 'Сезон') + ' ' + this.state.season
      );
    };

    Component.prototype.searchFilm = function () {
      var self = this, revision = this.state.scanRevision;

      searchFilm(this.movie, this.cfg, this, function (error, best) {
        if (self.state.destroyed || revision !== self.state.scanRevision) return;

        self.loading(false);

        if (error || !best) {
          self.empty(error && error.message ? error.message : null);
          return;
        }

        self.state.current = best;
        self.drawFilm(best);
      });
    };

    Component.prototype.loadEpisodes = function (season) {
      var self = this, revision = this.state.scanRevision;

      loadSeries(this.movie, season, this.cfg, this, function (error, list) {
        if (self.state.destroyed || revision !== self.state.scanRevision) return;

        self.loading(false);

        if (error || !list || !list.length) {
          self.empty(error && error.message ? error.message : null);
          return;
        }

        self.state.cards = list;
        self.drawEpisodes(list);
      });
    };

    Component.prototype.drawFilm = function (candidate) {
      var body = this.html && this.html.find('.cso-scroll');

      if (!body) return;

      body.empty();
      body.append(this.makeCard(candidate));
      this.afterRender();
    };

    Component.prototype.drawEpisodes = function (list) {
      var body = this.html && this.html.find('.cso-scroll');

      if (!body) return;

      body.empty();

      var fragment = doc && doc.createDocumentFragment ? doc.createDocumentFragment() : null;
      for (var i = 0; i < list.length; i++) {
        var card = this.makeCard(list[i]);
        if (fragment && card && card[0]) fragment.appendChild(card[0]);
        else body.append(card);
      }
      if (fragment) body.append(fragment);

      this.afterRender();
    };

    Component.prototype.makeCard = function (candidate) {
      var self = this;
      var card = tpl('capsule_online_card');

      var title = candidate.text || this.movie.title || this.movie.name || '';
      var meta = [];

      if (candidate.height) meta.push(candidate.height + 'p');
      if (candidate.voice) meta.push(candidate.voice);
      if (candidate.family) meta.push(candidate.family);

      card.find('.cso-title').text(title);
      card.find('.cso-meta').text(meta.join(' · '));

      if (candidate.season && candidate.episode) {
        card.find('.cso-episode').text(
          t('cso_season', 'Сезон') + ' ' + candidate.season +
          ' · ' + t('cso_episode', 'Серия') + ' ' + candidate.episode
        );
      } else {
        card.find('.cso-episode').text('');
      }

      this.loadPoster(card.find('.online-prestige__img img'), candidate.thumbnail || this.movie.poster_path || this.movie.poster);

      var play = debounceFn(function () {
        self.play(candidate);
      }, 450, this.state.timers);

      card.on('hover:enter', play).on('click', play);

      return card;
    };

    Component.prototype.loadPoster = function (imgEl, url) {
      if (!imgEl || !imgEl[0]) return;
      var imgNode = imgEl[0];
      url = posterUrl(url);
      if (!url) { imgEl.parent().addClass('cso-poster-fallback'); return; }
      if (imgNode.setAttribute) imgNode.setAttribute('loading','lazy');
      imgEl.on('error', function() { imgEl.parent().addClass('cso-poster-fallback'); });
      imgNode.src = url;
    };

    Component.prototype.afterRender = function () {
      if (this.scroll && this.scroll.render) {
        try {
          this.scroll.render();
        } catch (e) {
          Log.warn('scroll_render', e && e.message ? e.message : String(e));
        }
      }

      try {
        if (!this.state.controllerReady && L.Controller && L.Controller.toggle) {
          this.state.controllerReady = true;
          L.Controller.toggle('content');
        }
      } catch (e) { Log.warn('controller_enable', e.message); }
    };

    Component.prototype.empty = function (message) {
      var body = this.html && this.html.find('.cso-scroll');

      if (!body) return;

      var html = tpl('capsule_online_empty');
      var self = this;

      html.find('.cso-empty-title').text(t('cso_no_results', 'Нет результатов'));
      html.find('.cso-empty-text').text(message || t('cso_empty_text', 'Источник не ответил или не подошли варианты.'));
      html.find('.cso-empty-retry').text(t('cso_retry', 'Повторить'));
      html.find('.cso-empty-settings').text(t('cso_settings', 'Настройки'));

      var retry = debounceFn(function () {
        self.start();
      }, 500, this.state.timers);

      var settings = debounceFn(function () {
        self.openSettings();
      }, 500, this.state.timers);

      html.find('.cso-empty-retry').on('hover:enter', retry).on('click', retry);
      html.find('.cso-empty-settings').on('hover:enter', settings).on('click', settings);

      body.empty().append(html);
      this.afterRender();
    };

    Component.prototype.play = function (candidate) {
      if (this.state.destroyed) return;

      playCandidate(this.movie, candidate, this.cfg, this);
    };

    Component.prototype.switchCandidate = function (candidate) {
      if (this.state.destroyed) return;

      this.state.current = candidate;

      if (isSeries(this.movie)) {
        this.play(candidate);
      } else {
        this.drawFilm(candidate);
        this.play(candidate);
      }
    };

    Component.prototype.openSourcePicker = function () {
      var self = this;

      if (!L.Select || !L.Select.show) {
        if (L.Noty && L.Noty.show) {
          L.Noty.show(t('cso_no_sources', 'Нет разрешённых источников'));
        }
        return;
      }

      var manualCfg = assign({}, this.cfg, { manual: true });
      var catalogKey = str(this.movie.source || 'tmdb') + ':' +
        str(this.movie.id || norm(this.movie.title || this.movie.name)) + ':' +
        (isSeries(this.movie) ? 'tv' : 'film');
      var providers = rankProviders(
        NS.state.lastCatalogMovie === catalogKey ? (NS.state.lastCatalog || []) : [],
        this.movie, manualCfg);

      if (!providers.length) {
        if (L.Noty && L.Noty.show) {
          L.Noty.show(t('cso_no_sources', 'Нет разрешённых источников'));
        }
        return;
      }

      var items = [];

      for (var i = 0; i < providers.length; i++) {
        items.push({
          title: providers[i].name || providers[i].key,
          key: providers[i].key
        });
      }

      this.state.selectOpen = true;

      L.Select.show({
        title: t('cso_choose_source', 'Выбор источника'),
        items: items,
        onSelect: function (item) {
          self.state.selectOpen = false;
          if (L.Select && L.Select.close) L.Select.close();
          if (!item || !item.key) return;

          self.cfg.manual = true;
          self.state.currentSource = item.key;
          if (self.html) self.html.find('.cso-source span').text(item.title);
          self.start();
        },
        onBack: function () {
          self.state.selectOpen = false;
        }
      });
    };

    Component.prototype.openSeasonPicker = function () {
      var self = this;

      if (!isSeries(this.movie)) return;

      if (!L.Select || !L.Select.show) return;

      var seasons = [];

      if (Array.isArray(this.movie.seasons)) {
        for (var i = 0; i < this.movie.seasons.length; i++) {
          var s = this.movie.seasons[i];
          var number = num(s && s.season_number, 0);

          if (number > 0) {
            seasons.push(number);
          }
        }
      }

      if (!seasons.length) {
        for (var n = 1; n <= 12; n++) {
          seasons.push(n);
        }
      }

      var items = [];

      for (var j = 0; j < seasons.length; j++) {
        items.push({
          title: t('cso_season', 'Сезон') + ' ' + seasons[j],
          season: seasons[j]
        });
      }

      this.state.selectOpen = true;

      L.Select.show({
        title: t('cso_season', 'Сезон'),
        items: items,
        onSelect: function (item) {
          self.state.selectOpen = false;
          if (L.Select && L.Select.close) L.Select.close();
          if (!item || !item.season) return;

          self.state.season = item.season;

          var choice = self.getChoice();
          choice.season = item.season;
          self.saveChoice(choice);

          self.state.scanRevision++;
          self.state.playRevision++;
          self.updateSeasonButton();
          self.loading(true);
          self.loadEpisodes(item.season);
        },
        onBack: function () {
          self.state.selectOpen = false;
        }
      });
    };

    Component.prototype.openSettings = function () {
      var self = this;

      if (!L.Settings || !L.Settings.create) return;

      this.state.settingsOpen = true;

      L.Settings.create(COMPONENT, {
        onBack: function () {
          self.state.settingsOpen = false;
        }
      });
    };

    Component.prototype.handleBack = function () {
      if (this.state.selectOpen) {
        this.state.selectOpen = false;
        if (L.Select && L.Select.close) L.Select.close();
        return true;
      }
      if (this.state.settingsOpen) {
        this.state.settingsOpen = false;
        if (L.Settings && L.Settings.close) L.Settings.close();
        return true;
      }
      if (L.Activity && L.Activity.backward) {
        L.Activity.backward();
      } else this.destroy();
      return true;
    };

    Component.prototype.back = function () {
      return this.handleBack();
    };
    Component.prototype.pause = function () {};
    Component.prototype.stop = function () {};

    Component.prototype.destroy = function () {
      if (this.state.destroyed) return;

      this.state.destroyed = true;
      this.state.scanRevision++;
      this.state.playRevision++;

      for (var i = 0; i < this.state.timers.length; i++) {
        clearTimeout(this.state.timers[i]);
      }

      this.state.timers = [];

      for (var j = 0; j < this.state.images.length; j++) {
        var img = this.state.images[j];
        img.onload = null;
        img.onerror = null;
        img.src = '';
      }

      this.state.images = [];

      if (this.scroll && this.scroll.destroy) {
        try {
          this.scroll.destroy();
        } catch (e) {
          Log.warn('scroll_destroy', e && e.message ? e.message : String(e));
        }
      }

      if (this.html && this.html.find) {
        try {
          this.html.find('*').off();
        } catch (e) {
          Log.warn('unbind', e && e.message ? e.message : String(e));
        }
      }


      if (L.Loading && L.Loading.stop) {
        try {
          L.Loading.stop();
        } catch (e) {
          Log.warn('loading_destroy', e && e.message ? e.message : String(e));
        }
      }
    };

    /* =========================
       20. Settings
       ========================= */

    function registerSettings() {
      if (!L.SettingsApi) return;

      var params = [
        {
          type: 'checkbox',
          name: PREFIX + 'auto',
          title: t('cso_auto', 'Автовыбор источника'),
          value: true
        },
        {
          type: 'select',
          name: PREFIX + 'search_mode',
          title: t('cso_search_mode', 'Режим поиска'),
          value: 'normal',
          values: {
            fast: t('cso_fast', 'Быстрый'),
            normal: t('cso_normal', 'Обычный'),
            economy: t('cso_economy', 'Экономный')
          }
        },
        {
          type: 'checkbox',
          name: PREFIX + 'fallback',
          title: t('cso_fallback', 'Резервный источник'),
          value: true
        },
        {
          type: 'select',
          name: PREFIX + 'min_quality',
          title: t('cso_min_quality', 'Минимальное качество'),
          value: 0,
          values: {
            0: 'Any',
            480: '480p',
            720: '720p',
            1080: '1080p',
            1440: '1440p',
            2160: '4K'
          }
        },
        {
          type: 'select',
          name: PREFIX + 'max_quality',
          title: t('cso_max_quality', 'Максимальное качество'),
          value: 0,
          values: {
            0: 'Auto',
            720: '720p',
            1080: '1080p',
            2160: '4K'
          }
        },
        {
          type: 'select',
          name: PREFIX + 'language',
          title: t('cso_language', 'Язык'),
          value: 'auto',
          values: {
            auto: 'Auto',
            ru: 'RU',
            uk: 'UK',
            en: 'EN',
            original: 'Original'
          }
        },
        {
          type: 'checkbox',
          name: PREFIX + 'kids',
          title: t('cso_kids', 'Детский режим'),
          value: false
        },
        {
          type: 'checkbox',
          name: PREFIX + 'debug',
          title: t('cso_debug', 'Отладка'),
          value: false
        }
      ];

      params.unshift({ type: 'button', name: PREFIX + 'version',
        title: 'Capsule Online · ' + VERSION, value: VERSION });

      for (var i = 0; i < FAMILIES.length; i++) {
        params.push({
          type: 'checkbox',
          name: PREFIX + 'source_' + FAMILIES[i].key,
          title: FAMILIES[i].title,
          value: FAMILIES[i].auto !== false
        });
      }

      for (var v = 0; v < VOICE_CATEGORIES.length; v++) {
        params.push({
          type: 'checkbox',
          name: PREFIX + 'voice_' + VOICE_CATEGORIES[v],
          title: 'Voice: ' + VOICE_CATEGORIES[v],
          value: true
        });
      }

      if (L.SettingsApi.addComponent) {
        L.SettingsApi.addComponent({ component: COMPONENT,
          name: t('cso_settings', 'Capsule Online'), icon: 'video' });
      }
      if (L.SettingsApi.addParam) {
        for (var p = 0; p < params.length; p++) {
          (function (param) {
            L.SettingsApi.addParam({
              component: COMPONENT,
              param: {
                name: param.name,
                type: param.type,
                value: param.value,
                values: param.values
              },
              field: {
                name: param.title,
                description: ''
              },
              onChange: function (value) {
                set(param.name.replace(PREFIX, ''), value);
              }
            });
          })(params[p]);
        }
      }

      addDiagnostics();
    }

    function addDiagnostics() {
      if (!L.SettingsApi || !L.SettingsApi.addParam) return;

      L.SettingsApi.addParam({
        component: COMPONENT,
        param: {
          name: PREFIX + 'diag_catalog',
          type: 'button'
        },
        field: {
          name: t('cso_diag_catalog', 'Проверить каталог Skaz'),
          description: ''
        },
        onChange: function () {
          var card = NS.state.lastFilmMovie || NS.state.lastSeriesMovie;
          if (!card) {
            if (L.Noty && L.Noty.show) L.Noty.show('Сначала откройте фильм или сериал');
            return;
          }
          getCatalog(card, readConfig(true), function (error, providers) {
            if (L.Noty && L.Noty.show) {
              L.Noty.show(error ? ('Ошибка: ' + error.message) : ('Каталог: ' + (providers ? providers.length : 0)));
            }
          });
        }
      });

      L.SettingsApi.addParam({
        component: COMPONENT,
        param: {
          name: PREFIX + 'diag_film',
          type: 'button'
        },
        field: {
          name: t('cso_diag_film', 'Последний поиск фильма'),
          description: ''
        },
        onChange: function () {
          var scan = NS.state.lastFilmScan;

          if (L.Select && L.Select.show) {
            L.Select.show({
              title: t('cso_diag_film', 'Последний поиск фильма'),
              items: scan ? [
                { title: 'Время: ' + new Date(scan.at).toLocaleString() },
                { title: 'Режим: ' + scan.mode },
                { title: 'Источники: ' + scan.providers },
                { title: 'Кандидаты: ' + scan.candidates },
                { title: 'Лучший: ' + (scan.best ? scan.best.family + ' ' + scan.best.height + 'p ' + scan.best.voice : 'нет') }
              ] : [{ title: 'Нет данных' }]
            });
          }
        }
      });

      L.SettingsApi.addParam({
        component: COMPONENT,
        param: {
          name: PREFIX + 'diag_series',
          type: 'button'
        },
        field: {
          name: t('cso_diag_series', 'Последняя проверка сериалов'),
          description: ''
        },
        onChange: function () {
          var scan = NS.state.lastSeriesScan;

          if (L.Select && L.Select.show) {
            L.Select.show({
              title: t('cso_diag_series', 'Последняя проверка сериалов'),
              items: scan ? [
                { title: 'Время: ' + new Date(scan.at).toLocaleString() },
                { title: 'Сезон: ' + scan.season },
                { title: 'Источники: ' + scan.providers },
                { title: 'Серии: ' + (scan.episodes || 0) }
              ] : [{ title: 'Нет данных' }]
            });
          }
        }
      });

      L.SettingsApi.addParam({
        component: COMPONENT,
        param: {
          name: PREFIX + 'diag_logs',
          type: 'button'
        },
        field: {
          name: t('cso_diag_logs', 'Показать логи'),
          description: ''
        },
        onChange: function () {
          var dump = Log.dump();

          if (L.Select && L.Select.show) {
            L.Select.show({
              title: t('cso_diag_logs', 'Показать логи'),
              items: dump ? dump.split('\n').slice(-80).map(function (line) {
                return { title: line };
              }) : [{ title: 'Логов нет' }]
            });
          }
        }
      });

      L.SettingsApi.addParam({
        component: COMPONENT,
        param: {
          name: PREFIX + 'clear_cache',
          type: 'button'
        },
        field: {
          name: t('cso_clear_cache', 'Очистить кэш'),
          description: ''
        },
        onChange: function () {
          health = {};
          saveHealth();

          clearTransientCache();
          catalogCache = Object.create(null);
          catalogPending = Object.create(null);
          NS.state.lastCatalog = [];
          NS.state.lastCatalogMovie = null;
          set('cache_provider_health', null);

          if (L.Noty && L.Noty.show) {
            L.Noty.show(t('cso_clear_cache', 'Очистить кэш') + ': OK');
          }
        }
      });
    }

    /* =========================
       21. Plugin registration
       ========================= */

    function installFullCardButton() {
      if (!$ || !L.Listener || !L.Listener.follow || !L.Activity) return;
      function open(movie, manual) {
        if (!movie || !L.Activity.push) return;
        L.Activity.push({ url: '', title: t('title_online','Онлайн'),
          component: COMPONENT, movie: movie,
          cso_manual_screen: !!manual, page: 1,
          search: movie.title || movie.name || '' });
      }
      function addButton(movie, rootEl) {
        if (!movie || !rootEl || !rootEl.length || rootEl.find('.capsule-online--button').length)
          return;
        var btn = $('<div class="full-start__button selector capsule-online--button" '+
          'style="display:flex;align-items:center;gap:.55em">'+
          '<span>▶</span><span>Capsule Online</span></div>');
        var lastLong = 0;
        btn.on('hover:long contextmenu', function(e) {
          if (e && e.preventDefault) e.preventDefault();
          lastLong = Date.now(); open(movie,true);
        });
        btn.on('hover:enter click', function() {
          if (Date.now() - lastLong < 1000) return;
          open(movie,false);
        });
        var bar = rootEl.find('.full-start-new__buttons,.full-start__buttons,.full-start__buttons-container').first();
        if (bar.length) bar.prepend(btn);
        else {
          var first = rootEl.find('.full-start__button').first();
          if (first.length) first.before(btn);
        }
      }
      L.Listener.follow('full', function(event) {
        if (!event || event.type !== 'complite') return;
        try {
          var activity = event.object && event.object.activity;
          var rootEl = activity && activity.render && activity.render();
          addButton(event.data && event.data.movie, rootEl);
        } catch(e) { Log.warn('button',e.message); }
      });
      try {
        var active = L.Activity.active && L.Activity.active();
        if (active && active.component === 'full' && active.activity && active.activity.render)
          addButton(active.card || active.movie, active.activity.render());
      } catch (e) {}
    }

        function registerPlugin() {
      if (root.capsule_amedia_core_plugin) {
        if (L.Noty && L.Noty.show)
          L.Noty.show('Capsule Online: для новой версии перезапустите Lampa');
        return;
      }
      root.capsule_amedia_core_plugin = true;

      var manifest = {
        type: 'video',
        version: VERSION,
        name: t('cso_plugin_name', 'Capsule Online · Skaz'),
        description: t('cso_plugin_desc', 'Переписанный онлайн-движок'),
        component: COMPONENT,
        onContextMenu: function () {
          return {
            name: t('cso_watch', 'Смотреть'),
            description: ''
          };
        },
        onContextLaunch: function (object) {
          var movie = object && object.movie || object || {};

          if (!L.Activity || !L.Activity.push) return;

          L.Activity.push({
            url: '',
            title: t('title_online', 'Онлайн'),
            component: COMPONENT,
            movie: movie,
            search: movie.title || movie.name || '',
            search_one: movie.title || movie.name || '',
            search_two: movie.original_title || movie.original_name || '',
            page: 1,
            cso_manual_screen: true
          });
        }
      };

      manifest.onContextLauch = manifest.onContextLaunch;
      try {
        if (L.Plugin && L.Plugin.add) L.Plugin.add(manifest);
        else if (L.Manifest && L.Manifest.plugins) L.Manifest.plugins.push(manifest);
      } catch (e) { Log.warn('manifest',e.message); }

      L.Component.add(COMPONENT, Component);
      installCSS();
      installTemplates();
      try { registerSettings(); } catch (e) { Log.warn('settings', e.message); }
      try { installFullCardButton(); } catch (e) { Log.warn('button',e.message); }

      NS.booted = true;
      if (root.__capsuleOnlineTestMode === true) NS.test = {
        safeUrl: safeUrl, headersFor: headersFor,
        parseProviderHtml: parseProviderHtml,
        extractProviders: extractProviders,
        makeCandidate: makeCandidate,
        acceptable: acceptable,
        chooseSeriesCandidates: chooseSeriesCandidates,
        bestQuality: bestQuality,
        movieParams: movieParams,
        isSeries: isSeries,
        requestText: requestText,
        resolveCandidate: resolveCandidate
      };

      Log.info('boot', 'Capsule Online rebuilt core started: ' + VERSION);
    }

    safeCall(registerPlugin, 'register_plugin', function () {
      if (L.Noty && L.Noty.show) {
        L.Noty.show('Capsule Online: ошибка регистрации, перезапустите Lampa');
      }
    });
  }

  boot();
})(window);