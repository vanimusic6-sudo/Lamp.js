/* Torrent Filter Pro v2.0.0 — Lampa. No third-party requests or dependencies.
 * Based on public Lampa API: Parser.get, Listener('torrent'), SettingsApi.
 * Filter/rank happens BEFORE the built-in torrent component paginates results.
 */
(function () {
  'use strict';

  var VERSION = '2.0.0';
  var KEY = 'lampa_torrent_filter_pro_v2';
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
    preferred: 'auto',           // auto / 720 / 1080 / 2160
    profile: 'balanced',         // balanced / speed / quality
    filterLevel: 'normal',       // gentle / normal / strict
    visual: true
  };
  var config = readConfig();
  var lastFallback = '';
  function log() {
    if (window.console && console.warn) {
      var a = Array.prototype.slice.call(arguments);
      a.unshift('[Torrent Filter Pro]');
      console.warn.apply(console, a);
    }
  }
  function cloneDefault() { return Object.assign({}, defaults); }
  function validate(raw) {
    var next = cloneDefault();
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return next;
    ['enabled', 'visual'].forEach(function (k) {
      if (typeof raw[k] === 'boolean') next[k] = raw[k];
    });
    if (typeof raw.badges === 'boolean' && raw.visual === undefined) next.visual = raw.badges;
    var allowed = {
      preferred: ['auto', '720', '1080', '2160'],
      profile: ['balanced', 'speed', 'quality'],
      filterLevel: ['gentle', 'normal', 'strict']
    };
    Object.keys(allowed).forEach(function (k) {
      if (allowed[k].indexOf(raw[k]) !== -1) next[k] = raw[k];
    });
    return next;
  }
  function readConfig() {
    try {
      var modern = localStorage.getItem(KEY);
      if (modern) return validate(JSON.parse(modern));
      // Переход со старой версии: сохраняем важные предпочтения без устаревших 12 полей.
      var previous = localStorage.getItem('lampa_torrent_filter_pro_v1');
      return previous ? validate(JSON.parse(previous)) : cloneDefault();
    } catch (e) {
      log('Настройки повреждены, использованы безопасные значения', e);
      return cloneDefault();
    }
  }
  function writeConfig(next) {
    var safe = validate(next);
    try { localStorage.setItem(KEY, JSON.stringify(safe)); }
    catch (e) { log('Не удалось сохранить настройки', e); }
    config = safe;
    return safe;
  }
  function trim(x) { return String(x === null || typeof x === 'undefined' ? '' : x).trim(); }
  // Авторазбор только настоящих типовых меток релиза: не путаем TS с DTS.
  var BAD_RELEASE = /(^|[^a-z0-9а-я])(?:hdcam|camrip|cam|telesync|ts|telecine|tc|dvdscr|screener|scr|workprint)(?=$|[^a-z0-9а-я])/i;
  var WEB_DL = /(?:web[ ._-]?dl|webdl)/i;
  var REMUX = /(?:^|[^a-z0-9])(?:bd)?remux(?=$|[^a-z0-9])/i;

  function quality(title, element) {
    var info = element && element.info || {};
    var general = element && element.general || {};
    var streams = element && element.ffprobe;
    if (Array.isArray(streams)) {
      var video = streams.find(function (x) { return x && x.codec_type === 'video'; });
      if (video && Number(video.width) > 200 && Number(video.height) > 200) {
        var h = Number(video.height), w = Number(video.width);
        if (h >= 1800 || w >= 3500) return 2160;
        if (h >= 980 || w >= 1850) return 1080;
        if (h >= 675 || w >= 1200) return 720;
        return 480;
      }
    }
    var line = String(title || '') + ' ' + String(info.quality || '') + ' ' +
      String(general.resolution || '');
    if (/(^|[^a-z0-9])(?:2160[pр]?|4k|uhd|ultra[ ._-]?hd)(?=$|[^a-z0-9])/i.test(line)) return 2160;
    if (/(^|[^a-z0-9])(?:1080[pр]?|full[ ._-]?hd)(?=$|[^a-z0-9])/i.test(line)) return 1080;
    if (/(^|[^a-z0-9])720[pр]?(?=$|[^a-z0-9])/i.test(line)) return 720;
    if (/(^|[^a-z0-9])(?:480[pр]?|576[pр]?|sd)(?=$|[^a-z0-9])/i.test(line)) return 480;
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
    var title = trim(item && (item.Title || item.title));
    if (!title) return null;
    var q = quality(title, item);
    var pref = Number(cfg.preferred);
    var seeds = getSeeders(item);
    var junk = BAD_RELEASE.test(title);
    var isSeries = Boolean(params && params.movie && params.movie.number_of_seasons);
    var duration = Number(params && params.movie && params.movie.runtime) || 0;
    var bitrate = !isSeries && duration > 25 && duration < 500
      ? getBytes(item) * 8 / (duration * 60 * 1000000) : 0;
    if (!Number.isFinite(bitrate) || bitrate <= 0 || bitrate > 3000) bitrate = 0;

    // Оценка 0–100 — ЭВРИСТИКА по метаданным, не измерение скорости или реального качества.
    var score = 28;
    var qualityFactor = cfg.profile === 'quality' ? 1.25 : cfg.profile === 'speed' ? 0.78 : 1;
    var availabilityFactor = cfg.profile === 'speed' ? 1.35 : cfg.profile === 'quality' ? 0.8 : 1;
    var qPoints = q === 2160 ? 22 : q === 1080 ? 24 : q === 720 ? 12 : q === 480 ? -4 : -10;
    if (pref) {
      qPoints = q === pref ? 31 : q > pref ? 11 : q === 1080 && pref === 2160 ? 12
        : q === 720 && pref === 1080 ? 8 : q === 0 ? -15 : -2;
    }
    score += qPoints * qualityFactor;
    if (seeds === null) score -= 10 * availabilityFactor;
    else if (seeds === 0) score -= 38;
    else score += Math.min(31, Math.log2(seeds + 1) * 6.2) * availabilityFactor;

    if (REMUX.test(title)) score += 18 * qualityFactor;
    else if (WEB_DL.test(title)) score += 14 * qualityFactor;
    else if (/(?:blu[ ._-]?ray|bluray|bdrip|bdr)/i.test(title)) score += 11 * qualityFactor;
    else if (/webrip/i.test(title)) score += 7 * qualityFactor;
    else if (/hdtv|dvdrip/i.test(title)) score += 2;
    if (/(?:^|[^a-z0-9])(?:x265|h265|hevc)(?=$|[^a-z0-9])/i.test(title)) score += (q >= 1080 ? 4 : 1);
    if (/(?:^|[^a-z0-9])(?:av1)(?=$|[^a-z0-9])/i.test(title)) score -= 3; // На старых ТВ декодирование может быть проблемой.
    if (/(?:^|[^a-z0-9])(?:hdr10|hdr|dolby[ ._-]?vision|dovi)(?=$|[^a-z0-9])/i.test(title) && q >= 1080) score += 3;
    if (junk) score -= 70;

    // Средний битрейт вычисляется лишь для одиночных фильмов с известной длительностью.
    if (bitrate) {
      var minimum = q >= 2160 ? 8 : q >= 1080 ? 2.5 : 0.8;
      var ceiling = q >= 2160 ? 90 : q >= 1080 ? 35 : 16;
      if (bitrate < minimum) score -= Math.min(27, (minimum - bitrate) * 5);
      if (bitrate > ceiling) score -= Math.min(24, (bitrate - ceiling) * (cfg.profile === 'quality' ? 0.35 : 1.2));
      if (cfg.profile === 'speed') score -= Math.min(22, bitrate * 0.7);
      if (seeds !== null && seeds <= 3 && bitrate > 24) score -= 18;
    }
    score = Math.max(0, Math.min(100, Math.round(score)));
    var band = junk || seeds === 0 || score < 52 ? 'poor' : score >= 79 ? 'good' : 'fair';
    return { score: score, q: q, seeds: seeds, bitrate: bitrate, band: band, junk: junk, gold: false };
  }
  function hashKey(item) {
    var hash = trim(item.hash || item.Hash || item.InfoHash || item.infoHash).toLowerCase();
    if (!/^[a-f0-9]{40}$/.test(hash)) {
      var magnet = trim(item.MagnetUri || item.magnet);
      var match = magnet.match(/(?:[?&]xt=urn:btih:)([a-f0-9]{40})(?:&|$)/i);
      hash = match ? match[1].toLowerCase() : '';
    }
    return hash;
  }
  function getLabel(q) { return q === 2160 ? '4K' : q ? q + 'p' : '?'; }
  function notify(message) {
    try { if (L && L.Noty && L.Noty.show) L.Noty.show(message); } catch (e) { log(e); }
  }
  function rank(data, params) {
    if (!data || !Array.isArray(data.Results) || !data.Results.length || !config.enabled) return data;
    try {
      var originals = data.Results;
      var seen = Object.create(null);
      var accepted = [];
      originals.forEach(function (item, index) {
        if (!item || typeof item !== 'object') return;
        var metric = analyse(item, params, config);
        if (!metric) return;
        if (config.filterLevel !== 'gentle' && metric.junk) return;
        if (config.filterLevel === 'strict' && (metric.band === 'poor' || metric.score < 60 || metric.seeds === 0)) return;
        var hash = hashKey(item);
        var entry = { item: item, metric: metric, index: index };
        // Убираем дубли одного и того же infohash, сохраняя более жизнеспособную раздачу.
        if (hash && seen[hash] !== undefined) {
          var old = accepted[seen[hash]];
          if (metric.score > old.metric.score) accepted[seen[hash]] = entry;
          return;
        }
        if (hash) seen[hash] = accepted.length;
        accepted.push(entry);
      });
      if (!accepted.length) {
        // Оставляем пользователю возможность самостоятельно выбрать источник;
        // даже редкие/старые фильмы не должны полностью исчезать из поиска.
        accepted = originals.filter(function (x) { return x && typeof x === 'object'; }).map(function (item, index) {
          return { item: item, metric: analyse(item, params, config), index: index };
        }).filter(function (x) { return x.metric; });
        var key = trim(params && params.search) + ':' + trim(params && params.movie && params.movie.id);
        if (key !== lastFallback) {
          notify('Torrent Filter Pro: подходящих нет, показаны все раздачи');
          lastFallback = key;
        }
      }
      accepted.sort(function (a, b) { return b.metric.score - a.metric.score || a.index - b.index; });
      // Сериалы не обрезаем: иначе исчезнут менее популярные сезоны.
      var series = !!(params && params.movie && params.movie.number_of_seasons);
      var list = (series ? accepted : accepted.slice(0, 40));
      var best = list.length && list[0].metric.score || 0;
      list = list.map(function (entry, index) {
        var metric = entry.metric;
        var gold = index < 3 && metric.band === 'good' && metric.score >= best - 9 &&
          metric.seeds !== 0 && !metric.junk;
        try {
          Object.defineProperty(entry.item, '__tfp', {
            value: { score: metric.score, q: metric.q, rank: index + 1,
              band: metric.band, gold: gold, seeds: metric.seeds },
            writable: true, configurable: true, enumerable: false
          });
        } catch (e) { /* Не изменяем защищённые исходные объекты. */ }
        return entry.item;
      });
      // Стандартная Lampa пересортировывает результаты по сидам после парсера.
      // Подменяем sort только у массива этого ответа и только в режиме Popular.
      // Ручная сортировка пользователя остаётся полностью стандартной.
      if (L.Storage.get('torrents_sort', 'popular') === 'popular') {
        Object.defineProperty(list, 'sort', {
          configurable: true, enumerable: false,
          value: function () {
            function lastNum(value) {
              var n = parseInt(String(value || '0').split('-').pop(), 10);
              return Number.isFinite(n) ? n : 0;
            }
            Array.prototype.sort.call(this, function (a, b) {
              if (series) {
                var ag = a && a.general || {}, bg = b && b.general || {};
                var seasonDiff = lastNum(bg.season) - lastNum(ag.season);
                if (seasonDiff) return seasonDiff;
                var episodeDiff = lastNum(bg.episodes) - lastNum(ag.episodes);
                if (episodeDiff) return episodeDiff;
              }
              return (b.__tfp ? b.__tfp.score : -1) - (a.__tfp ? a.__tfp.score : -1);
            });
            return this;
          }
        });
      }
      return Object.assign({}, data, { Results: list });
    } catch (e) {
      log('Ошибка оценки раздач — исходная выдача сохранена', e);
      return data;
    }
  }
  function quickTitle() {
    var q = config.preferred === '2160' ? '4K' : config.preferred === 'auto' ? 'Авто' : config.preferred + 'p';
    return 'Качество: ' + q;
  }
  function refreshTorrent() {
    try {
      var active = L && L.Activity && L.Activity.active && L.Activity.active();
      if (active && active.component === 'torrents' && L.Activity.replace) {
        L.Activity.replace({ page: 1 });
      }
    } catch (e) { log('Обновление выдачи не удалось', e); }
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
        { title: 'Автоматический выбор', value: 'auto' },
        { title: 'Предпочитать 720p', value: '720' },
        { title: 'Предпочитать 1080p', value: '1080' },
        { title: 'Предпочитать 4K', value: '2160' }
      ];
      options.forEach(function (item) { item.selected = item.value === config.preferred; });
      L.Select.show({
        title: 'Качество торрентов',
        items: options,
        onBack: function () { L.Controller.toggle(previous); },
        onSelect: function (choice) {
          writeConfig(Object.assign({}, config, { preferred: choice.value }));
          syncFields();
          button.find('span').text(quickTitle());
          L.Controller.toggle(previous);
          setTimeout(refreshTorrent, 0);
        }
      });
    });
    window.$(bar).append(button);
  }
  function onTorrent(event) {
    if (!event || event.type !== 'render' || !config.enabled) return;
    if (!quickScheduled) {
      quickScheduled = true;
      setTimeout(function () {
        quickScheduled = false;
        try { ensureQuick(); } catch (e) { log('Кнопка качества недоступна', e); }
      }, 0);
    }
    if (!config.visual) return;
    var info = event.element && event.element.__tfp;
    if (!info || !event.item || !event.item.find || !window.$) return;
    try {
      var item = event.item, band = info.band;
      if (['good', 'fair', 'poor'].indexOf(band) === -1) return;
      if (item.find('.tfpro-badge').length) return;
      var details = item.find('.torrent-item__details');
      if (!details.length) return;
      item.addClass('tfpro-' + band);
      var badge = window.$('<span class="tfpro-badge"></span>');
      badge.addClass('tfpro-badge--' + band);
      if (info.gold) {
        badge.addClass('tfpro-badge--gold').text('★ Лучший выбор · ' + getLabel(info.q) + ' · ' + info.score + '/100');
      } else {
        var title = band === 'good' ? 'Хороший вариант' : band === 'fair' ? 'Компромисс' : 'Слабый вариант';
        badge.text(title + ' · ' + getLabel(info.q) + ' · ' + info.score + '/100');
      }
      details.append(badge);
    } catch (e) { log('Не удалось отрисовать рейтинг', e); }
  }
  function ensureCss() {
    if (document.getElementById('tfpro-style')) return;
    var s = document.createElement('style');
    s.id = 'tfpro-style';
    s.textContent = [
      '.tfpro-quick{margin-left:.32em;white-space:nowrap}',
      '.torrent-item.tfpro-good{outline:2px solid rgba(64,193,121,.76);outline-offset:-2px;border-radius:.55em}',
      '.torrent-item.tfpro-fair{outline:2px solid rgba(233,186,69,.72);outline-offset:-2px;border-radius:.55em}',
      '.torrent-item.tfpro-poor{outline:2px solid rgba(225,91,94,.66);outline-offset:-2px;border-radius:.55em}',
      '.tfpro-badge{display:inline-block;margin:.22em .55em .15em 0;padding:.2em .52em;',
      'border:1px solid currentColor;border-radius:.48em;line-height:1.4;font-size:.76em;',
      'font-weight:500;white-space:nowrap}',
      '.tfpro-badge--good{color:#a6efbd;background:rgba(55,150,97,.12)}',
      '.tfpro-badge--fair{color:#f6d88a;background:rgba(155,121,39,.12)}',
      '.tfpro-badge--poor{color:#f5aaa9;background:rgba(155,57,61,.12)}',
      '.tfpro-badge--gold{color:#ffda76;background:rgba(179,129,38,.16);font-weight:700}',
      '.torrent-item.focus .tfpro-badge{opacity:1}',
      '@media(max-width:480px){.tfpro-badge{font-size:.7em}}'
    ].join('');
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
  function registerSettings() {
    if (!L.SettingsApi) { log('Settings API unavailable'); return; }
    var icon = '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M4 12h16M4 17h16"/><circle cx="8" cy="7" r="2" fill="currentColor"/><circle cx="16" cy="12" r="2" fill="currentColor"/><circle cx="10" cy="17" r="2" fill="currentColor"/></svg>';
    L.SettingsApi.addComponent({ component: COMPONENT, name: 'Умные торренты', icon: icon, after: 'parser' });
    syncFields();
    addParam('enabled', 'trigger', 'Умный отбор', 'Включить ранжирование раздач.');
    addParam('preferred', 'select', 'Любимое разрешение', 'Выбранное качество поднимается выше, остальные не запрещены.', {
      auto: 'Автоматически', '720': '720p', '1080': '1080p', '2160': '4K'
    });
    addParam('profile', 'select', 'Что важнее?', 'Баланс по умолчанию. Скорость сильнее учитывает раздающих, качество — тип релиза.', {
      balanced: 'Баланс', speed: 'Скорость', quality: 'Качество'
    });
    addParam('filterLevel', 'select', 'Строгость отбора', 'Мягкий показывает даже слабые раздачи; умный скрывает CAM; строгий исключает также красные.', {
      gentle: 'Мягкий', normal: 'Умный (рекомендуется)', strict: 'Строгий'
    });
    addParam('visual', 'trigger', 'Цветная оценка и звёзды',
      'Зелёный — удачный, жёлтый — компромисс, красный — слабый. ★ — лучший выбор.');
    button('reset', 'Сбросить настройки', 'Вернуться к умному режиму по умолчанию.', function () {
      writeConfig(cloneDefault());
      syncFields();
      notify('Настройки восстановлены');
      if (L.Settings && L.Settings.update) setTimeout(function () { L.Settings.update(); }, 0);
    });
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