/* Torrent Filter Pro v1.0.0 — Lampa. No third-party requests or dependencies.
 * Based on public Lampa API: Parser.get, Listener('torrent'), SettingsApi.
 * Filter/rank happens BEFORE the built-in torrent component paginates results.
 */
(function () {
  'use strict';

  var VERSION = '1.0.0';
  var KEY = 'lampa_torrent_filter_pro_v1';
  var COMPONENT = 'torrent_filter_pro';
  var PREFIX = 'tfpro_';
  var bootTimer = null;
  var initialized = false;
  var originalGet = null;
  var patchedGet = null;
  var listener = null;
  var quickScheduled = false;
  var L = null;
  var defaults = {
    enabled: true,
    preferred: '1080',          // 720, 1080, 2160, auto
    qualityRule: 'prefer',      // prefer / only
    profile: 'balanced',        // balanced / speed / quality
    minSeeders: '2',            // 0, 2, 5, 10
    maxResults: '20',           // 10, 20, 40, 80, all
    maxBitrate: '0',            // 0 = no limit (estimated, Mbps)
    blacklist: 'CAM,HDCAM,TS,TELESYNC,TC,TELECINE,SCR,SCREENER,DVDSCR,WORKPRINT',
    whitelist: '',              // optional: at least one word must match
    fallback: true,             // when all excluded, show originals + notification
    badges: true
  };
  var config = readConfig();

  function log() {
    if (window.console && console.warn) {
      var a = Array.prototype.slice.call(arguments);
      a.unshift('[Torrent Filter Pro]');
      console.warn.apply(console, a);
    }
  }
  function cloneDefault() { return Object.assign({}, defaults); }
  function validate(raw) {
    var c = cloneDefault();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return c;
    Object.keys(defaults).forEach(function (k) {
      if (!Object.prototype.hasOwnProperty.call(raw, k)) return;
      var v = raw[k];
      if (typeof defaults[k] === 'boolean') {
        if (typeof v === 'boolean') c[k] = v;
      } else if (typeof v === 'string' && v.length < 2000) {
        c[k] = v;
      }
    });
    var checks = {
      preferred: ['720','1080','2160','auto'],
      qualityRule: ['prefer','only'],
      profile: ['balanced','speed','quality'],
      minSeeders: ['0','2','5','10'],
      maxResults: ['10','20','40','80','all'],
      maxBitrate: ['0','8','15','25','50']
    };
    Object.keys(checks).forEach(function (k) {
      if (checks[k].indexOf(c[k]) < 0) c[k] = defaults[k];
    });
    return c;
  }
  function readConfig() {
    try { return validate(JSON.parse(localStorage.getItem(KEY) || '{}')); }
    catch (e) { log('Настройки повреждены; использованы значения по умолчанию', e); return cloneDefault(); }
  }
  function writeConfig(next) {
    var safe = validate(next);
    try { localStorage.setItem(KEY, JSON.stringify(safe)); }
    catch (e) { log('Не удалось сохранить настройки', e); }
    config = safe;
    return safe;
  }
  function trim(x) { return String(x === null || typeof x === 'undefined' ? '' : x).trim(); }
  function tokens(value) {
    return trim(value).split(/[;,\n]+/).map(function (s) { return s.trim(); }).filter(Boolean).slice(0, 100);
  }
  function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function matchesToken(title, token) {
    // Boundaries avoid a blacklist "TS" inadvertently matching "DTS" or "TEST".
    var word = escapeRegExp(token);
    var before = /^[a-z0-9]/i.test(token) ? '(^|[^a-z0-9])' : '';
    var after = /[a-z0-9]$/i.test(token) ? '(?=$|[^a-z0-9])' : '';
    try { return new RegExp(before + word + after, 'i').test(title); }
    catch (e) { return false; }
  }
  function listMatches(title, list) {
    return list.some(function (word) { return matchesToken(title, word); });
  }
  function quality(title, element) {
    var t = title.toLowerCase();
    var hints = element && element.general || {};
    var info = element && element.info || {};
    var q = String(info.quality || hints.resolution || hints.quality || '').toLowerCase();
    // Explicit numeric labels take precedence over ambiguous 'UHD' source labels.
    if (/(^|[^a-z0-9])(?:2160[pр]?|4k)(?=$|[^a-z0-9])/.test(t + ' ' + q)) return 2160;
    if (/(^|[^a-z0-9])(?:1080[pр]?|full[ ._-]?hd)(?=$|[^a-z0-9])/.test(t + ' ' + q)) return 1080;
    if (/(^|[^a-z0-9])720[pр]?(?=$|[^a-z0-9])/.test(t + ' ' + q)) return 720;
    if (/(^|[^a-z0-9])(?:480[pр]?|576[pр]?|sd)(?=$|[^a-z0-9])/.test(t + ' ' + q)) return 480;
    if (/(^|[^a-z0-9])(?:uhd|ultra[ ._-]?hd)(?=$|[^a-z0-9])/.test(t + ' ' + q)) return 2160;
    return 0;
  }
  function getSeeders(r) {
    var v = r.Seeders;
    if (v === undefined || v === null) v = r.seeders;
    if (v === undefined || v === null) v = r.Seed;
    var n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.floor(n)) : null;
  }
  function getBytes(r) {
    var v = r.Size;
    if (v === undefined || v === null) v = r.size;
    if (typeof v === 'number') return v > 10000000 ? v : 0;
    var str = trim(v).replace(',', '.');
    if (/^\d+(?:\.\d+)?$/.test(str)) return Number(str) > 10000000 ? Number(str) : 0;
    var m = str.match(/([\d.]+)\s*(tb|gb|mb|тб|гб|мб)/i);
    if (!m) return 0;
    var unit = m[2].toLowerCase();
    var exponent = /^(tb|тб)$/.test(unit) ? 4 : /^(gb|гб)$/.test(unit) ? 3 : 2;
    return Number(m[1]) * Math.pow(1024, exponent);
  }
  function analyse(item, params, cfg) {
    var title = trim(item.Title || item.title);
    if (!title) return null;
    if (listMatches(title, tokens(cfg.blacklist))) return null;
    var allowed = tokens(cfg.whitelist);
    if (allowed.length && !listMatches(title, allowed)) return null;
    var q = quality(title, item);
    var pref = Number(cfg.preferred);
    if (cfg.qualityRule === 'only' && pref && q !== pref) return null;
    var seeds = getSeeders(item);
    if (seeds !== null && seeds < Number(cfg.minSeeders)) return null;

    var isSeries = Boolean(params && params.movie && params.movie.number_of_seasons);
    var duration = params && params.movie && Number(params.movie.runtime) || 0;
    var bitrate = (!isSeries && duration > 25 && duration < 500)
      ? getBytes(item) * 8 / (duration * 60 * 1000000) : 0;
    if (!Number.isFinite(bitrate) || bitrate < 0 || bitrate > 5000) bitrate = 0;
    if (Number(cfg.maxBitrate) && bitrate && bitrate > Number(cfg.maxBitrate)) return null;

    var qTier = q === 2160 ? 3 : q === 1080 ? 2 : q === 720 ? 1 : q === 480 ? 0 : -1;
    var pTier = pref === 2160 ? 3 : pref === 1080 ? 2 : pref === 720 ? 1 : -1;
    var qualityWeight = cfg.profile === 'quality' ? 1.55 : cfg.profile === 'speed' ? 0.7 : 1;
    var seedWeight = cfg.profile === 'speed' ? 24 : cfg.profile === 'quality' ? 10 : 17;
    var score = 0;

    if (pTier >= 0) score += qTier >= 0 ? 90 - Math.abs(qTier - pTier) * 42 : -60;
    else score += qTier >= 0 ? 22 + qTier * 12 : -30;
    score *= qualityWeight;

    // Seed count is an indicator of availability, not a measured download speed.
    if (seeds === null) score -= 25;
    else if (seeds === 0) score -= 90;
    else score += Math.min(130, Math.log2(seeds + 1) * seedWeight);

    if (/\bremux\b/i.test(title)) score += cfg.profile === 'quality' ? 26 : -2;
    else if (/web[ ._-]?dl|webdl/i.test(title)) score += 24;
    else if (/blu[ ._-]?ray|bluray|bdremux/i.test(title)) score += 17;
    else if (/bdrip/i.test(title)) score += 11;
    else if (/webrip/i.test(title)) score += 9;
    if (/\b(?:x265|h265|hevc)\b/i.test(title)) score += 7;
    if (/\b(?:av1)\b/i.test(title)) score += 2;
    if (/\b(?:hdr10\+?|dolby[ ._-]?vision|dovi)\b/i.test(title) && q >= 1080) score += 6;

    // Estimated total bitrate of a film. Doesn't apply to season packs.
    if (bitrate) {
      var floor = q === 2160 ? 8 : q === 1080 ? 2 : 0.8;
      var ceiling = q === 2160 ? 75 : q === 1080 ? 28 : 14;
      if (bitrate < floor) score -= Math.min(35, (floor - bitrate) * 6);
      if (bitrate > ceiling && cfg.profile !== 'quality') score -= Math.min(40, (bitrate - ceiling) * 1.2);
      if (cfg.profile === 'speed') score -= Math.min(25, bitrate * 0.55);
    }
    return { score: Math.round(score * 10) / 10, q: q, seeds: seeds, bitrate: bitrate };
  }
  function getLabel(q) { return q === 2160 ? '4K' : q ? q + 'p' : '?'; }
  function notify(message) {
    try { if (L && L.Noty && L.Noty.show) L.Noty.show(message); } catch (e) { log(e); }
  }
  function rank(data, params) {
    if (!data || !Array.isArray(data.Results) || !data.Results.length || !config.enabled) return data;
    try {
      var originals = data.Results;
      var accepted = [];
      originals.forEach(function (item, index) {
        if (!item || typeof item !== 'object') return;
        var metric = analyse(item, params, config);
        if (metric) accepted.push({ item: item, metric: metric, index: index });
      });
      if (!accepted.length) {
        if (config.fallback) {
          notify('Torrent Filter Pro: подходящих раздач нет — показан исходный список');
          return data;
        }
        // Preserve the standard Lampa empty-result UI, do not create fake entries.
        return Object.assign({}, data, { Results: [] });
      }
      accepted.sort(function (a, b) { return b.metric.score - a.metric.score || a.index - b.index; });
      // Avoid losing whole seasons because one season has more seeds/releases.
      var seriesResults = !!(params && params.movie && params.movie.number_of_seasons);
      var limit = seriesResults || config.maxResults === 'all' ? accepted.length : Number(config.maxResults);
      var list = accepted.slice(0, limit).map(function (entry, index) {
        // Non-enumerable metadata: not serialized, not sent to parsers / TorrServer.
        try {
          Object.defineProperty(entry.item, '__tfp', { value: {
            score: entry.metric.score, q: entry.metric.q, rank: index + 1
          }, writable: true, configurable: true });
        } catch (e) { /* Frozen source objects are still displayed normally. */ }
        return entry.item;
      });
      // The stock component re-sorts results before pagination.
      // Override sort ONLY on this response array, ONLY for native "Popular".
      // For series: sort by season/episode (native behavior), then smart score.
      // Other sort modes are untouched; Array.prototype is never changed.
      var nativeMode = L.Storage.get('torrents_sort', 'popular');
      var series = !!(params && params.movie && params.movie.number_of_seasons);
      if (nativeMode === 'popular') {
        Object.defineProperty(list, 'sort', {
          configurable: true, enumerable: false,
          value: function (comparison) {
            function lastNum(value) {
              var n = parseInt(String(value || '0').split('-').pop(), 10);
              return Number.isFinite(n) ? n : 0;
            }
            return Array.prototype.sort.call(this, function (a, b) {
              if (series) {
                var ag = a && a.general || {}, bg = b && b.general || {};
                var season = lastNum(bg.season) - lastNum(ag.season);
                if (season) return season;
                var episode = lastNum(bg.episodes) - lastNum(ag.episodes);
                if (episode) return episode;
              }
              var as = a && a.__tfp ? a.__tfp.score : -Infinity;
              var bs = b && b.__tfp ? b.__tfp.score : -Infinity;
              return bs - as;
            });
          }
        });
      }
      return Object.assign({}, data, { Results: list });
    } catch (e) {
      log('Ошибка фильтрации; сохранена исходная выдача', e);
      return data;
    }
  }

  function quickTitle() {
    var mode = config.qualityRule === 'only' && config.preferred !== 'auto' ? 'Только ' : '';
    return '★ ' + mode + (config.preferred === '2160' ? '4K' : config.preferred === 'auto' ? 'Авто' : config.preferred + 'p');
  }
  function ensureQuick() {
    if (!window.$ || !document.querySelectorAll || !L || !L.Select) return;
    var bars = document.querySelectorAll('.torrent-filter');
    var bar = bars.length ? bars[bars.length - 1] : null;
    if (!bar || bar.querySelector('.tfpro-quick')) return;
    var button = window.$('<div class="simple-button simple-button--filter selector tfpro-quick"><span></span></div>');
    button.find('span').text(quickTitle());
    button.on('hover:enter', function () {
      var previous = L.Controller.enabled().name;
      var options = [
        { title:'Автоматически', preferred:'auto', rule:'prefer' },
        { title:'Предпочитать 720p', preferred:'720', rule:'prefer' },
        { title:'Предпочитать 1080p', preferred:'1080', rule:'prefer' },
        { title:'Предпочитать 4K', preferred:'2160', rule:'prefer' },
        { title:'Только 720p', preferred:'720', rule:'only' },
        { title:'Только 1080p', preferred:'1080', rule:'only' },
        { title:'Только 4K', preferred:'2160', rule:'only' }
      ];
      options.forEach(function (item) {
        item.selected = item.preferred === config.preferred && item.rule === config.qualityRule;
      });
      L.Select.show({
        title: 'Torrent Filter Pro — качество', items:options,
        onBack:function () { L.Controller.toggle(previous); },
        onSelect:function (choice) {
          writeConfig(Object.assign({}, config, {
            preferred:choice.preferred, qualityRule:choice.rule
          }));
          syncFields();
          button.find('span').text(quickTitle());
          L.Controller.toggle(previous);
          // Native Activity.replace re-runs Parser.get, not just the visible page.
          setTimeout(function () {
            try {
              if (L.Activity && L.Activity.active() && L.Activity.active().component === 'torrents') {
                L.Activity.replace({ page:1 });
              }
            } catch (e) { log('Ошибка обновления списка', e); }
          }, 0);
        }
      });
    });
    window.$(bar).append(button);
  }
  function onTorrent(event) {
    if (!event || event.type !== 'render' || !config.enabled) return;
    // The torrent page is attached to document after the render loop finishes.
    if (!quickScheduled) {
      quickScheduled = true;
      setTimeout(function () {
        quickScheduled = false;
        try { ensureQuick(); } catch (e) { log('Quick quality menu error', e); }
      }, 0);
    }
    if (!config.badges) return;
    var info = event.element && event.element.__tfp;
    if (!info || !event.item || !event.item.find || !window.$) return;
    try {
      var details = event.item.find('.torrent-item__details');
      if (!details.length || event.item.find('.tfpro-badge').length) return;
      var badge = window.$('<div class="tfpro-badge"></div>');
      badge.text('★ ' + info.rank + ' · ' + getLabel(info.q) + ' · ' + Math.round(info.score) + ' баллов');
      details.append(badge);
    } catch (e) { log('Не удалось показать оценку раздачи', e); }
  }
  function ensureCss() {
    if (document.getElementById('tfpro-style')) return;
    var s = document.createElement('style');
    s.id = 'tfpro-style';
    s.textContent = '.tfpro-quick{margin-left:.4em;white-space:nowrap}.tfpro-badge{display:inline-block;margin:.3em .6em .2em 0;padding:.22em .48em;border-radius:.42em;background:rgba(83,186,138,.15);border:1px solid rgba(83,186,138,.40);color:#aaf0ca;font-size:.78em;white-space:nowrap;line-height:1.45}';
    document.head.appendChild(s);
  }
  function setField(key, value) {
    config[key] = value;
    writeConfig(config);
  }
  function syncFields() {
    if (!L || !L.Storage) return;
    Object.keys(defaults).forEach(function (key) {
      try { L.Storage.set(PREFIX + key, config[key]); }
      catch (e) { log('Storage unavailable', key, e); }
    });
  }
  function addParam(name, type, title, description, values) {
    var key = PREFIX + name;
    L.SettingsApi.addParam({
      component: COMPONENT,
      param: { name: key, type: type, values: values || '', default: defaults[name] },
      field: { name: title, description: description || '' },
      onChange: function (value) {
        if (name === 'blacklist' || name === 'whitelist') value = trim(value).slice(0, 1999);
        else if (typeof defaults[name] === 'boolean') value = value === true || value === 'true';
        else value = String(value);
        setField(name, value);
      }
    });
  }
  function button(id, title, description, action) {
    L.SettingsApi.addParam({
      component: COMPONENT,
      param: { name: PREFIX + id, type: 'button' },
      field: { name: title, description: description || '' },
      onChange: action
    });
  }
  function exportJson() {
    var data = JSON.stringify({ version: VERSION, settings: config });
    try {
      L.Input.edit({ value: data, nomic: true, title: 'Скопируйте настройки JSON' }, function () {});
    } catch (e) { log('Экспорт через поле ввода недоступен', e); notify('Экспорт настроек недоступен в этой версии Lampa'); }
  }
  function importJson() {
    try {
      L.Input.edit({ value: '', nomic: true, title: 'Вставьте JSON Torrent Filter Pro' }, function (s) {
        if (!s) return;
        try {
          var parsed = JSON.parse(s);
          if (!parsed || typeof parsed !== 'object' || (!parsed.settings && !parsed.enabled && parsed.enabled !== false)) throw Error('Bad structure');
          writeConfig(parsed.settings || parsed);
          syncFields();
          notify('Torrent Filter Pro: настройки импортированы. Откройте меню повторно.');
        } catch (e) { log('Ошибка импорта', e); notify('Torrent Filter Pro: неверный JSON'); }
      });
    } catch (e) { log(e); notify('Импорт недоступен'); }
  }
  function registerSettings() {
    if (!L.SettingsApi || !L.Input) { log('Settings API unavailable'); return; }
    var icon = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M4 12h16M4 17h16"/><circle cx="8" cy="7" r="2" fill="currentColor"/><circle cx="16" cy="12" r="2" fill="currentColor"/><circle cx="10" cy="17" r="2" fill="currentColor"/></svg>';
    L.SettingsApi.addComponent({ component: COMPONENT, name: 'Torrent Filter Pro', icon: icon, after: 'parser' });
    syncFields();
    addParam('enabled', 'trigger', 'Включить умный отбор', 'Отключение оставляет выдачу без изменений.');
    addParam('preferred', 'select', 'Желаемое разрешение', 'Предпочтение влияет на оценку; само по себе не запрещает другие разрешения.', {
      'auto': 'Автоматически', '720': '720p', '1080': '1080p', '2160': '4K (2160p)'
    });
    addParam('qualityRule', 'select', 'Правило разрешения', 'Предпочитать — повышать в рейтинге; Только выбранное — исключать остальные.', {
      'prefer': 'Предпочитать', 'only': 'Только выбранное'
    });
    addParam('profile', 'select', 'Баланс отбора', 'Скорость — больше вес сидов; Качество — больше вес релиза и разрешения.', {
      'balanced': 'Баланс', 'speed': 'Скорость', 'quality': 'Качество'
    });
    addParam('minSeeders', 'select', 'Минимум сидов', 'При неизвестном числе сидов раздача остаётся, но получает штраф.', {
      '0': 'Нет ограничения', '2': '2', '5': '5', '10': '10'
    });
    addParam('maxResults', 'select', 'Сколько лучших показывать', 'Для фильмов отбирает лучших ДО постраничной выдачи. Для сериалов сохраняет все сезоны.', {
      '10': '10', '20': '20', '40': '40', '80': '80', 'all': 'Все прошедшие фильтр'
    });
    addParam('maxBitrate', 'select', 'Оценочный максимум битрейта', 'Только для фильмов с известной длительностью; по размеру файла, не замер сети.', {
      '0': 'Без ограничения', '8': '8 Мбит/с', '15': '15 Мбит/с', '25': '25 Мбит/с', '50': '50 Мбит/с'
    });
    addParam('blacklist', 'input', 'Запрещённые слова', 'Через запятую. Например: CAM,TS,SCREENER. Слово RIP специально не блокируется.');
    addParam('whitelist', 'input', 'Обязательное слово (любое)', 'Пусто — выключено. Например: WEB-DL,REMUX.');
    addParam('fallback', 'trigger', 'Оставлять исходную выдачу при нуле', 'Если ни одного совпадения, показать оригинальные результаты и предупреждение.');
    addParam('badges', 'trigger', 'Показывать рейтинг у раздач', 'Значок № места, разрешение и оценка алгоритма.');
    button('reset', 'Сбросить фильтры', 'Восстановить значения по умолчанию.', function () {
      writeConfig(cloneDefault()); syncFields(); notify('Фильтры сброшены. Откройте меню снова.');
    });
    button('export', 'Экспорт настроек (JSON)', 'Текст для переноса настроек между устройствами.', exportJson);
    button('import', 'Импорт настроек (JSON)', 'Вставьте ранее экспортированный JSON.', importJson);
  }

  function start() {
    if (initialized) return true;
    if (!window.Lampa || !window.Lampa.Parser || typeof window.Lampa.Parser.get !== 'function' ||
        !window.Lampa.Listener || !window.Lampa.SettingsApi || !window.Lampa.Storage) return false;
    L = window.Lampa;
    originalGet = L.Parser.get;
    patchedGet = function (params, onSuccess, onFailure) {
      // Ignore all unrelated parser consumers and preserve original errors.
      var isTorrentScreen = !!(params && (params.component === 'torrents' || (params.movie && typeof params.page !== 'undefined' && !params.other)));
      if (!isTorrentScreen || typeof onSuccess !== 'function' || !config.enabled) {
        return originalGet.apply(this, arguments);
      }
      return originalGet.call(this, params, function (data) {
        var result = rank(data, params);
        onSuccess(result);
      }, onFailure);
    };
    L.Parser.get = patchedGet;
    listener = onTorrent;
    L.Listener.follow('torrent', listener);
    try { registerSettings(); ensureCss(); }
    catch (e) { log('Ошибка регистрации интерфейса настроек', e); }
    initialized = true;
    log('Запущен', VERSION);
    return true;
  }
  function destroy() {
    if (bootTimer) { clearInterval(bootTimer); bootTimer = null; }
    if (L && originalGet && L.Parser.get === patchedGet) L.Parser.get = originalGet;
    if (L && listener && L.Listener.remove) L.Listener.remove('torrent', listener);
    if (L && L.SettingsApi && L.SettingsApi.removeComponent) L.SettingsApi.removeComponent(COMPONENT);
    var css = document.getElementById('tfpro-style'); if (css) css.remove();
    initialized = false;
    listener = null;
    if (window.TorrentFilterPro === api) delete window.TorrentFilterPro;
  }
  var api = {
    version: VERSION,
    getSettings: function () { return Object.assign({}, config); },
    setSettings: function (next) { var c = writeConfig(Object.assign({}, config, next)); syncFields(); return c; },
    evaluate: function (element, movie) { return analyse(element, { movie: movie || {} }, config); },
    destroy: destroy
  };
  if (window.TorrentFilterPro) return;
  window.TorrentFilterPro = api;
  if (!start()) {
    var tries = 0;
    bootTimer = setInterval(function () {
      if (start() || ++tries >= 60) {
        clearInterval(bootTimer); bootTimer = null;
        if (!initialized) log('Lampa API не появился, установка не завершена');
      }
    }, 500);
  }
}());