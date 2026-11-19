/* Capsule Online NEXT 1.0.0-rc1
 * Clean-room client for Lampa's documented component/player interfaces and
 * Lampac's public catalog/menu response shapes. No bundled upstream scripts.
 * Uses a single synchronous catalog request and bounded parallel root sampling.
 * Preview build: actual Skaz responses and native playlists require device tests.
 */
(function (root) {
  'use strict';
  if (root.__capsuleOnlineNext) return;
  root.__capsuleOnlineNext = true;

  var VERSION = '1.0.0-rc1';
  var COMPONENT = 'capsule_online_next';
  var PREFIX = 'capsule_next_';
  var HOST = 'http://online3.skaz.tv/';
  var SERIES_ORDER = ['alloha', 'hdrezka', 'vibix', 'filmix', 'kodik'];
  var MOVIE_ORDER = ['alloha', 'hdrezka', 'filmix', 'mirkinoz', 'vibix', 'kodik'];
  var VOICES = ['rhs', 'dub', 'lostfilm', 'rezka', 'tvshows', 'kubik', 'rezka18'];
  var L = null, initialized = false, settingsInstalled = false, bootAttempts = 0;

  function setting(key, fallback) {
    try {
      var value = L && L.Storage.get(PREFIX + key, null);
      if (value === undefined || value === null) {
        value = L && L.Storage.get('capsule_skaz_online_' + key, fallback);
      }
      return value === undefined || value === null ? fallback : value;
    } catch (ignored) { return fallback; }
  }
  function enabled(key, fallback) {
    var value = setting(key, fallback);
    return value !== false && value !== 0 && value !== 'false' &&
      value !== '0' && value !== 'off';
  }
  function normalize(value) {
    return String(value || '').toLowerCase().replace(/ё/g, 'е').trim();
  }
  function family(row) {
    var id = normalize(row && (row.balanser || row.source || row.key));
    var name = normalize(row && row.name);
    if (/hd[\s._-]*rezka/.test(name) || /^hdrezka(?:tv)?$/.test(id)) return 'hdrezka';
    if (/^(?:rezka|rezkatv)$/.test(id)) return 'hdrezka';
    if (/^(?:alloha|allohatv)$/.test(id) || /^alloha\b/.test(name)) return 'alloha';
    if (/^vibix\b/.test(name)) return 'vibix';
    if (/^(?:filmix|filmixtv|fxapi|rc\/filmix|rc\/fxapi)$/.test(id)) return 'filmix';
    if (/^(?:vibix|vibixtv)$/.test(id)) return 'vibix';
    if (/^(?:kodik|kodiktv)$/.test(id)) return 'kodik';
    if (/^(?:mirkino|mirkinoz|mirkino-z|mir-kino-z|mirkinotv-z)$/.test(id) ||
        /^(?:мир\s*кино|mir\s*kino).*?\bz\b/.test(name)) return 'mirkinoz';
    return id || name.split(/\s+/)[0] || '';
  }
  function isSeries(movie) {
    if (!movie) return false;
    if (movie.__capsuleForceSeries) return true;
    if (movie.media_type === 'tv' || movie.type === 'tv') return true;
    if (movie.media_type === 'movie' || movie.type === 'movie') return false;
    return Number(movie.number_of_seasons) > 0 ||
      !!(movie.name && !movie.title && !movie.release_date);
  }
  function voiceCategory(label) {
    var name = normalize(label);
    if (/\brhs\b|red[\s._-]*head[\s._-]*sound|рхс/.test(name)) return 'rhs';
    if (/(?:hd)?\s*rezka.*18\s*\+|резка.*18\s*\+/.test(name)) return 'rezka18';
    if (/дубл|дублирован|невафильм|пифагор/.test(name)) return 'dub';
    if (/lost[\s._-]*film|лостфильм|лост\s*фильм/.test(name)) return 'lostfilm';
    if (/tv[\s._-]*shows?|тв[\s._-]*шоу|твшоу/.test(name)) return 'tvshows';
    if (/кубик\s*(?:в\s*)?кубе|kubik/.test(name)) return 'kubik';
    if (/rezka|резка/.test(name)) return 'rezka';
    return '';
  }
  function forbiddenVoice(label) {
    var value = normalize(label);
    if (/(?:1x(?:bet|slots)|1win|joycasino|melbet|mostbet|vavada|pin[\s-]?up|букмекер|казино|dragon[\s-]?money|драгонмани)/.test(value))
      return true;
    if (enabled('kids', false) && /кубик\s*(?:в\s*)?кубе|rezka\s*18\s*\+|резка\s*18\s*\+|18\s*\+|без\s*цензуры|нецензур|с\s*матом/.test(value))
      return true;
    var group = voiceCategory(label);
    return !!group && !enabled('voice_' + group, true);
  }
  function voiceRank(label) {
    if (forbiddenVoice(label)) return -10000;
    var type = voiceCategory(label);
    var rank = VOICES.indexOf(type);
    return rank < 0 ? 5 : (VOICES.length - rank) * 10;
  }
  function resolution(label) {
    var value = normalize(label);
    var match = value.match(/(?:^|[^\d])(2160|1440|1080|720|576|540|480|360)\s*[pр]?(?:$|[^\d])/);
    if (match) return Number(match[1]);
    if (/4k|uhd/.test(value)) return 2160;
    if (/2k|qhd/.test(value)) return 1440;
    if (/fhd|full[\s-]*hd/.test(value)) return 1080;
    if (/\bhd\b/.test(value)) return 720;
    return 0;
  }
  function maxQuality() {
    var stored = Number(setting('quality', 2160));
    return [480, 720, 1080, 2160].indexOf(stored) < 0 ? 2160 : stored;
  }
  function qualityMap(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    return Object.keys(value).map(function (label) {
      return { label: label, height: resolution(label), url: value[label] };
    }).filter(function (item) { return typeof item.url === 'string' && !!item.url; });
  }
  function qualityChoice(row) {
    var list = qualityMap(row.quality || row.qualitys);
    list.sort(function (a, b) { return b.height - a.height; });
    var top = list.find(function (entry) { return entry.height <= maxQuality(); });
    return top || null;
  }
  function safeUrl(value) {
    return typeof value === 'string' &&
      (/^https?:\/\//i.test(value) || /^\/(?!\/)/.test(value));
  }
  function absoluteUrl(value) {
    if (!safeUrl(value)) return '';
    return value.charAt(0) === '/' ? HOST.replace(/\/$/, '') + value : value;
  }
  function poster(movie, row) {
    var path = row && (row.poster || row.img || row.image || row.cover) ||
      movie && (movie.img || movie.poster || movie.poster_path || movie.backdrop_path) || '';
    if (!path) return '';
    if (/^https?:\/\//.test(path)) return path;
    if (path.charAt(0) === '/' && /^\/(?:proxyimg|img|api\/img)(?:\/|\?)/i.test(path))
      return HOST.replace(/\/$/, '') + path;
    if (path.charAt(0) === '/' && L && L.TMDB && L.TMDB.image)
      return L.TMDB.image(path, 'w300');
    return '';
  }
  function sortCatalog(rows, serial, all) {
    var order = serial ? SERIES_ORDER : MOVIE_ORDER;
    var distinct = Object.create(null);
    (Array.isArray(rows) ? rows : []).forEach(function (row) {
      if (!row || !safeUrl(row.url)) return;
      var key = family(row);
      if (!all && (order.indexOf(key) < 0 || !enabled('source_' + key, true))) return;
      if (!key) return;
      var existing = distinct[key], published = row.show !== false && row.show !== 'false';
      var seasonCount = Number(row.season_count || row.seasons_count || row.total_seasons) || 0;
      if (Array.isArray(row.seasons)) seasonCount = Math.max(seasonCount, row.seasons.length);
      if (!existing || (!existing.published && published)) {
        distinct[key] = { key: key, name: String(row.name || key),
          url: absoluteUrl(row.url), published: published,
          seasonCount: seasonCount, aliases: [] };
      }
      distinct[key].seasonCount = Math.max(distinct[key].seasonCount, seasonCount);
      distinct[key].aliases.push(absoluteUrl(row.url));
    });
    return Object.keys(distinct).map(function (key) { return distinct[key]; })
      .sort(function (a, b) {
        return (order.indexOf(a.key) < 0 ? 999 : order.indexOf(a.key)) -
          (order.indexOf(b.key) < 0 ? 999 : order.indexOf(b.key));
      });
  }
  function parseMenu(html) {
    var result = { folders: [], voices: [], playable: [] };
    if (typeof html !== 'string' || !html || html.length > 4 * 1024 * 1024 ||
        !root.DOMParser) return result;
    try {
      var document = new root.DOMParser().parseFromString(html, 'text/html');
      var nodes = document.querySelectorAll('.videos__item, .videos__button');
      for (var i = 0; i < nodes.length && i < 1200; i++) {
        var node = nodes[i], raw = node.getAttribute('data-json');
        if (!raw || raw.length > 32768) continue;
        var data;
        try { data = JSON.parse(raw); } catch (ignored) { continue; }
        if (!data || typeof data !== 'object' || Array.isArray(data)) continue;
        var label = (node.textContent || data.text || '').trim().slice(0, 180);
        var voice = String(data.voice_name || data.translate_voice || data.studio || '');
        if (forbiddenVoice(voice)) continue;
        var url = absoluteUrl(data.url || '');
        if (!url) continue;
        var entry = Object.assign({}, data, {
          url: url, text: label || String(data.text || ''),
          season: Number(node.getAttribute('s') || data.season || 0) || 0,
          episode: Number(node.getAttribute('e') || data.episode || 0) || 0,
          active: node.classList.contains('active') || node.classList.contains('selected') ||
            data.active === true
        });
        if (node.classList.contains('videos__button')) {
          if (!forbiddenVoice(entry.text)) result.voices.push(entry);
        } else if (entry.method === 'play' || entry.method === 'call') {
          result.playable.push(entry);
        } else if (entry.method === 'link' || entry.similar) {
          result.folders.push(entry);
        }
      }
    } catch (ignored) {}
    return result;
  }
  function seasonNumber(row) {
    var text = normalize(row.text);
    var match = text.match(/(?:сезон|season|сез\.)\s*[:№#.\s-]*(\d{1,3})/) ||
      text.match(/^(\d{1,3})\s*(?:сезон|season)/);
    return row.season > 0 ? row.season : (match ? Number(match[1]) : 0);
  }
  function episodeNumber(row) {
    if (Number(row.episode) > 0) return Number(row.episode);
    var match = normalize(row.text).match(/(?:серия|episode|эпизод)\s*[:№#.\s-]*(\d{1,4})/);
    return match ? Number(match[1]) : 0;
  }
  function languageTier(row, voice) {
    var name = normalize([voice, row && row.voice_name, row && row.translate_voice,
      row && row.audio_language, row && row.language].join(' '));
    if (/\b(?:ru|rus|russian)\b|русск|дубл|рхс|лостфильм/.test(name)) return 3;
    if (/\b(?:en|eng|english)\b|английск|оригинал/.test(name)) return 1;
    return 2; // unknown is not proof of a foreign-language soundtrack
  }
  function bestVoice(voices) {
    return (voices || []).filter(function (voice) { return !forbiddenVoice(voice.text); })
      .slice().sort(function (a, b) {
        return languageTier(b, b.text) - languageTier(a, a.text) ||
          voiceRank(b.text) - voiceRank(a.text);
      })[0] || null;
  }
  function scoreSource(source, serial, order) {
    var menu = source.preview || { folders: [], voices: [], playable: [] };
    var numbers = menu.folders.map(seasonNumber).filter(function (n) { return n > 0; });
    var known = numbers.length ? (new Set(numbers)).size : source.seasonCount;
    var voice = bestVoice(menu.voices);
    var lang = voice ? languageTier(voice, voice.text) : 2;
    var bestHeight = menu.playable.reduce(function (max, row) {
      var q = qualityChoice(row);
      return Math.max(max, q ? q.height : resolution(row.text));
    }, 0);
    var index = order.indexOf(source.key);
    var preference = index < 0 ? 0 : order.length - index;
    if (serial)
      return known * 1000 + (numbers.indexOf(1) >= 0 ? 350 : 0) +
        lang * 45 + (voice ? voiceRank(voice.text) : 0) + preference;
    return lang * 10000 + bestHeight * 4 + (voice ? voiceRank(voice.text) : 0) +
      (source.published ? 20 : 0) + preference;
  }
  function params(movie) {
    var base = {
      id: movie.id || '',
      title: movie.title || movie.name || '',
      original_title: movie.original_title || movie.original_name || '',
      serial: isSeries(movie) ? 1 : 0,
      source: movie.source || 'tmdb',
      year: String(movie.release_date || movie.first_air_date || '').slice(0, 4),
      original_language: movie.original_language || '',
      clarification: 0, similar: false
    };
    ['imdb_id', 'kinopoisk_id', 'tmdb_id'].forEach(function (key) {
      if (movie[key]) base[key] = movie[key];
    });
    return Object.keys(base).map(function (key) {
      return encodeURIComponent(key) + '=' + encodeURIComponent(String(base[key]));
    }).join('&');
  }
  function withParams(url, movie) {
    return url + (url.indexOf('?') >= 0 ? '&' : '?') + params(movie);
  }
  function accountUrl(url) {
    if (/(?:[?&](?:sig|signature|token|hash|hmac|expires|exp|auth)=)/i.test(url)) return url;
    var parts = [];
    var email = setting('account_email', '');
    try { email = L.Storage.get('account_email', ''); } catch (ignored) {}
    if (email && !/[?&]account_email=/.test(url))
      parts.push('account_email=' + encodeURIComponent(email));
    var uid = '';
    try { uid = L.Storage.get('lampac_unic_id', ''); } catch (ignored) {}
    if (uid && !/[?&]uid=/.test(url)) parts.push('uid=' + encodeURIComponent(uid));
    return url + (parts.length ? (url.indexOf('?') >= 0 ? '&' : '?') + parts.join('&') : '');
  }
  function network(url, mode, timeoutMs, session) {
    return new Promise(function (resolve, reject) {
      if (!L || !L.Reguest || !safeUrl(url)) return reject(new Error('Некорректная ссылка'));
      var request = new L.Reguest(), done = false, timeout = null;
      function settle(error, data) {
        if (done) return;
        done = true;
        root.clearTimeout(timeout);
        try { request.clear(); } catch (ignored) {}
        if (session && session.requests) session.requests.delete(request);
        if (error) reject(error); else resolve(data);
      }
      if (session && session.requests) session.requests.add(request);
      timeout = root.setTimeout(function () {
        settle(new Error('Тайм-аут источника'));
      }, timeoutMs);
      try {
        if (request.timeout) request.timeout(Math.max(1000, timeoutMs - 150));
        var headers = { 'X-Kit-AesGcm': setting('aesgcm', '') };
        try { headers['X-Kit-AesGcm'] = L.Storage.get('aesgcmkey', ''); }
        catch (ignored) {}
        var opts = { headers: headers };
        if (mode === 'text') opts.dataType = 'text';
        // Do not rewrite signed URLs or execute remotely provided JS.
        request[mode === 'catalog' ? 'silent' : 'native'](
          accountUrl(absoluteUrl(url)), function (data) { settle(null, data); },
          function () { settle(new Error('Источник недоступен')); }, false, opts);
      } catch (error) { settle(error); }
    });
  }
  function catalog(movie, session) {
    var url = withParams(HOST + 'lite/events?life=false', movie);
    return network(url, 'catalog', 8500, session).then(function (payload) {
      if (payload && payload.accsdb) throw new Error('Skaz: требуется авторизация');
      if (typeof payload === 'string') {
        try { payload = JSON.parse(payload); } catch (ignored) {}
      }
      if (Array.isArray(payload)) return payload;
      if (payload && Array.isArray(payload.online)) return payload.online;
      throw new Error('Каталог не вернул список источников');
    });
  }
  function resolveStream(row, session) {
    if (row.method === 'play' || row.stream && safeUrl(row.stream)) {
      return Promise.resolve(Object.assign({}, row, {
        url: row.stream && safeUrl(row.stream) ? absoluteUrl(row.stream) : row.url
      }));
    }
    return network(row.url, 'json', 7500, session).then(function (stream) {
      if (typeof stream === 'string') {
        try { stream = JSON.parse(stream); } catch (ignored) {}
      }
      if (stream && stream.rch)
        throw new Error('Источник требует RCH-подключение. Этот безопасный движок его пока не поддерживает');
      if (!stream || !safeUrl(stream.url)) throw new Error('Источник не выдал видео');
      return Object.assign({}, row, stream, { url: absoluteUrl(stream.url) });
    });
  }
  function notification(message) {
    try { if (L.Noty && L.Noty.show) L.Noty.show(message); }
    catch (ignored) {}
  }
  function choosePlaylistQuality(stream) {
    var selected = qualityChoice(stream);
    if (selected && safeUrl(selected.url)) {
      stream.quality = stream.quality || stream.qualitys;
      stream.url = absoluteUrl(selected.url);
    }
    return stream;
  }

  function Screen(activity) {
    var self = this;
    var movie = activity.movie || {};
    var serial = isSeries(movie);
    var manual = !!activity.capsule_manual;
    var session = { requests: new Set(), dead: false, stage: 0, bootStarted: Date.now() };
    var sources = [], selected = null, current = null;
    var listRows = [], voices = [], seasons = [], depth = 0;
    var visited = new Set(), path = [], progressKey =
      PREFIX + 'progress_' + String(movie.id || movie.imdb_id || movie.title || movie.name || '');
    var lastFocus = null, touchTime = 0;
    var outer = root.document.createElement('div');
    outer.className = 'cnext-root';
    var head = root.document.createElement('div');
    head.className = 'cnext-head';
    var heading = root.document.createElement('div');
    heading.className = 'cnext-heading';
    heading.textContent = String(movie.title || movie.name || 'Capsule Online');
    var subtitle = root.document.createElement('div');
    subtitle.className = 'cnext-subtitle';
    subtitle.textContent = serial ? 'Серии' : 'Фильм';
    var nav = root.document.createElement('div');
    nav.className = 'cnext-nav';
    head.appendChild(heading); head.appendChild(subtitle); head.appendChild(nav);
    outer.appendChild(head);
    var scroll = new L.Scroll({ mask: true, over: true });
    outer.appendChild(scroll.render()[0]);
    var $outer = root.$(outer);

    function active() { return !session.dead; }
    function stage() {
      session.stage += 1;
      session.requests.forEach(function (req) {
        try { req.clear(); } catch (ignored) {}
      });
      session.requests.clear();
      return session.stage;
    }
    function stale(ticket) { return !active() || ticket !== session.stage; }
    function label(text) { subtitle.textContent = text; }
    function element(cls, text) {
      var node = root.document.createElement('div');
      node.className = cls;
      node.textContent = String(text || '');
      return node;
    }
    function click(node, fn) {
      node.classList.add('selector');
      function activate() {
        var now = Date.now();
        if (now - touchTime < 250) return;
        touchTime = now;
        if (active()) fn();
      }
      node.addEventListener('click', activate);
      root.$(node).on('hover:enter', activate);
    }
    function navButton(text, fn) {
      var el = element('cnext-nav-button', text);
      click(el, fn);
      nav.appendChild(el);
      return el;
    }
    function repaintNav() {
      nav.textContent = '';
      navButton('Источник · ' + (selected ? selected.name : '—'), chooseSource);
      if (serial) navButton('Сезон' + (current && current.season ? ' ' + current.season : ''), chooseSeason);
      navButton('Озвучка' + (current && current.voice ? ' · ' + current.voice : ''), chooseVoice);
      navButton('↻', function () { start(true); });
    }
    function redraw(items) {
      listRows = items.slice();
      scroll.clear();
      var fragment = root.document.createDocumentFragment();
      items.forEach(function (row) {
        var card = element('cnext-card', '');
        var coverUrl = poster(movie, row);
        if (coverUrl) {
          var image = root.document.createElement('img');
          image.className = 'cnext-poster';
          image.alt = '';
          image.loading = 'lazy';
          image.src = coverUrl;
          card.appendChild(image);
        } else {
          card.appendChild(element('cnext-fallback', String(row.episode || '▶')));
        }
        var details = element('cnext-text', '');
        details.appendChild(element('cnext-title', row.label || row.text || 'Видео'));
        if (row.sub) details.appendChild(element('cnext-detail', row.sub));
        card.appendChild(details);
        if (row.qualityLabel) card.appendChild(element('cnext-quality', row.qualityLabel));
        click(card, row.action);
        root.$(card).on('hover:focus', function () {
          lastFocus = card;
          if (!scroll.update) return;
          var viewport = scroll.render()[0];
          if (viewport && viewport.getBoundingClientRect && card.getBoundingClientRect) {
            var a = card.getBoundingClientRect(), b = viewport.getBoundingClientRect();
            if (a.top >= b.top + 18 && a.bottom <= b.bottom - 18) return;
          }
          scroll.update(root.$(card), true);
        });
        fragment.appendChild(card);
      });
      scroll.append(fragment);
      if (L.Controller && L.Controller.enable) L.Controller.enable('content');
    }
    function message(text, retry) {
      label('Capsule Online');
      redraw([{ label: text, sub: retry ? 'Нажмите, чтобы повторить' : '',
        action: retry ? function () { start(true); } : function () {} }]);
    }
    function select(title, items, callback) {
      if (!items.length) return notification('Нет доступных вариантов');
      L.Select.show({
        title: title, items: items,
        onBack: function () { L.Controller.toggle('content'); },
        onSelect: function (row) {
          L.Select.close();
          callback(row);
        }
      });
    }
    function chooseSource() {
      select('Источники', sources.map(function (source) {
        return { title: source.name + (source.key === (selected && selected.key) ? ' ✓' : '') +
            (!source.published ? ' · не подтверждён' : ''),
          key: source.key };
      }), function (row) {
        var next = sources.find(function (item) { return item.key === row.key; });
        if (next && next !== selected) openSource(next, true);
      });
    }
    function chooseSeason() {
      select('Сезон', seasons.map(function (item) {
        return { title: 'Сезон ' + item.number, url: item.url, number: item.number };
      }), function (entry) {
        if (!safeUrl(entry.url)) return;
        current.season = entry.number;
        loadMenu(entry.url, { voice: current.voice, season: entry.number }, 1, true);
      });
    }
    function chooseVoice() {
      select('Озвучка', voices.map(function (item) {
        return { title: item.text, url: item.url };
      }), function (entry) {
        if (!safeUrl(entry.url)) return;
        current.voice = entry.title;
        loadMenu(entry.url, { voice: entry.title, season: current.season }, 1, true);
      });
    }
    function drawVideos(videos) {
      videos.sort(function (a, b) {
        if (!serial) {
          var aq = qualityChoice(a), bq = qualityChoice(b);
          return languageTier(b, current.voice) - languageTier(a, current.voice) ||
            (bq ? bq.height : resolution(b.text)) -
            (aq ? aq.height : resolution(a.text)) ||
            voiceRank(b.voice_name || b.translate_voice) -
            voiceRank(a.voice_name || a.translate_voice);
        }
        return (episodeNumber(a) || 99999) - (episodeNumber(b) || 99999);
      });
      label(selected.name + ' · ' + (current.voice || 'Автовыбор'));
      repaintNav();
      var seen = Object.create(null);
      var unique = videos.filter(function (row) {
        var n = episodeNumber(row);
        var k = String(n || row.url);
        if (seen[k]) return false;
        seen[k] = true;
        return true;
      });
      redraw(unique.map(function (row, index) {
        var ep = episodeNumber(row);
        var q = qualityChoice(row);
        var name = serial ? ('Серия ' + (ep || index + 1)) :
          (row.text || movie.title || 'Смотреть');
        return { label: name, text: row.text, episode: ep,
          qualityLabel: q ? q.label : (resolution(row.text) || '') + '',
          sub: serial ? row.text : current.voice,
          action: function () { play(row, unique); } };
      }));
      if (!serial && !manual && enabled('autoplay', true) && unique[0])
        play(unique[0], unique);
    }
    function play(row, rows) {
      var ticket = session.stage;
      label('Подготавливаем видео…');
      resolveStream(row, session).then(function (stream) {
        if (stale(ticket)) return;
        stream = choosePlaylistQuality(stream);
        var first = Object.assign({}, stream, { iptv: true, isonline: true,
          title: serial ? (row.text || 'Серия ' + episodeNumber(row)) :
            (movie.title || movie.name || 'Фильм'),
          img: poster(movie, row), movie: movie
        });
        var internal = String(L.Storage.field('player') || 'inner') === 'inner';
        var playlist = [first];
        if (serial) {
          rows.forEach(function (entry) {
            if (entry === row) return;
            var item = Object.assign({}, entry, {
              title: entry.text || 'Серия ' + episodeNumber(entry),
              img: poster(movie, entry)
            });
            if (entry.method === 'play' || safeUrl(entry.stream))
              item.url = absoluteUrl(entry.stream || entry.url);
            else if (internal) item.url = function (done) {
              resolveStream(entry, { requests: new Set() }).then(function (value) {
                item.url = choosePlaylistQuality(value).url || '';
                done();
              }, function () { item.url = ''; done(); });
            };
            else item.url = ''; // external players cannot evaluate JS callbacks
            if (item.url) playlist.push(item);
          });
        }
        if (serial) {
          try {
            L.Storage.set(progressKey, {
              season: current.season || row.season || 1,
              episode: episodeNumber(row) || 1
            });
          } catch (ignored) {}
        }
        L.Player.play(first);
        L.Player.playlist(playlist);
        label(selected.name + ' · ' + (current.voice || 'Автовыбор'));
      }).catch(function (error) {
        if (stale(ticket)) return;
        label('Не удалось запустить видео');
        notification(String(error && error.message || 'Видео недоступно'));
        if (!manual && enabled('auto', true) && selected) {
          selected.failed = true;
          var reserve = sources.find(function (item) { return !item.failed && !item.opened; });
          if (reserve) openSource(reserve, false);
        }
      });
    }
    function loadMenu(url, info, level, userChoice, cached) {
      if (session.dead) return;
      var ticket = stage();
      current = info || { voice: '', season: 0 };
      label('Загружаем список…');
      repaintNav();
      var remaining = 23000 - (Date.now() - session.bootStarted);
      if (!userChoice && remaining <= 0) {
        message('Автоматический поиск превысил 23 секунды', true);
        return;
      }
      var request = cached ? Promise.resolve(cached) :
        network(url, 'text', userChoice ? 6500 : Math.max(750, Math.min(6500, remaining)), session);
      request.then(function (html) {
        if (stale(ticket)) return;
        if (html && typeof html === 'object' && html.rch)
          throw new Error('Источник требует защищённый RCH-мост');
        var menu = parseMenu(html);
        var stamp = url + '|' + level;
        if (visited.has(stamp) && !userChoice)
          throw new Error('Источник вернул циклическое меню');
        visited.add(stamp);
        if (menu.voices.length) voices = menu.voices.filter(function (v) {
          return !forbiddenVoice(v.text);
        });
        var folders = menu.folders.filter(function (f) { return !!safeUrl(f.url); });
        var seasonItems = folders.map(function (f) {
          return { url: f.url, number: seasonNumber(f) };
        }).filter(function (item) { return item.number > 0; });
        if (seasonItems.length) {
          seasons = seasonItems.slice().sort(function (a, b) { return a.number - b.number; });
          if (!current.season) {
            var saved = setting(progressKey.replace(PREFIX, ''), null);
            current.season = saved && Number(saved.season) || 1;
          }
        }
        if (menu.voices.length && !userChoice && !current.voice) {
          var preferred = bestVoice(menu.voices);
          if (preferred && !preferred.active && preferred.url !== url) {
            current.voice = preferred.text;
            return loadMenu(preferred.url, current, level + 1, false);
          }
          if (preferred && preferred.active) current.voice = preferred.text;
        }
        if (menu.playable.length) return drawVideos(menu.playable);
        if (level >= 8) throw new Error('Слишком много вложенных меню');
        if (seasonItems.length) {
          var next = seasonItems.find(function (v) { return v.number === current.season; }) ||
            seasons[0];
          if (next) {
            current.season = next.number;
            return loadMenu(next.url, current, level + 1, false);
          }
        }
        if (menu.voices.length && !userChoice) {
          var chosen = bestVoice(menu.voices);
          if (chosen && chosen.url !== url) {
            current.voice = chosen.text;
            return loadMenu(chosen.url, current, level + 1, false);
          }
        }
        if (folders.length) {
          // Generic one-folder source wrappers are common in Lampac.
          if (folders.length === 1)
            return loadMenu(folders[0].url, current, level + 1, false);
          repaintNav();
          return redraw(folders.map(function (f) {
            return { label: f.text, sub: selected.name,
              action: function () {
                loadMenu(f.url, current, level + 1, true);
              } };
          }));
        }
        if (!userChoice) {
          var another = sources.find(function (s) {
            return s !== selected && !s.failed && !s.opened;
          });
          if (another) {
            selected.failed = true;
            return openSource(another, false);
          }
        }
        message('Список видео не найден', true);
      }).catch(function (error) {
        if (stale(ticket)) return;
        selected.failed = true;
        if (!userChoice) {
          var another = sources.find(function (s) {
            return s !== selected && !s.failed && !s.opened;
          });
          if (another) return openSource(another, false);
        }
        message('Ошибка источника: ' + String(error && error.message || 'Нет ответа'), true);
      });
    }
    function openSource(source, chosen) {
      if (session.dead || !source) return;
      if (chosen) session.bootStarted = Date.now();
      selected = source;
      source.opened = true;
      visited.clear(); path = []; depth = 0;
      seasons = []; voices = []; current = { voice: '', season: 0 };
      repaintNav();
      loadMenu(withParams(source.url, movie), current, 0, !!chosen, source.previewHtml || null);
    }
    function preflight(list, ticket) {
      var wanted = list.slice(0, 6);
      var previews = wanted.map(function (source) {
        return network(withParams(source.url, movie), 'text', 2500, session)
          .then(function (html) {
            if (stale(ticket)) return;
            var menu = parseMenu(html);
            if (menu.folders.length + menu.voices.length + menu.playable.length) {
              source.preview = menu;
              source.previewHtml = html;
            }
          }, function () {});
      });
      return Promise.all(previews);
    }
    function start(refresh) {
      if (!active()) return;
      var ticket = stage();
      selected = null; current = null; sources = [];
      session.bootStarted = Date.now();
      label('Получаем каталог источников…');
      repaintNav();
      redraw([{ label: 'Поиск источников', sub: 'Без повторных проверок и ожидания всех переводов',
        action: function () {} }]);
      catalog(movie, session).then(function (rows) {
        if (stale(ticket)) return;
        sources = sortCatalog(rows, serial, manual);
        if (!sources.length) throw new Error('Подходящие источники не найдены');
        if (manual || !enabled('auto', true)) {
          return openSource(sources[0], true);
        }
        label('Сравниваем доступные источники…');
        return preflight(sources, ticket).then(function () {
          if (stale(ticket)) return;
          var order = serial ? SERIES_ORDER : MOVIE_ORDER;
          sources.sort(function (a, b) {
            return scoreSource(b, serial, order) - scoreSource(a, serial, order);
          });
          openSource(sources[0], false);
        });
      }).catch(function (error) {
        if (stale(ticket)) return;
        message('Каталог: ' + String(error && error.message || 'Нет ответа'), true);
      });
    }
    this.create = function () { return $outer; };
    this.render = function () { return $outer; };
    this.start = function () {
      if (L.Controller) {
        L.Controller.add('content', {
          toggle: function () {
            L.Controller.collectionSet(scroll.render(), $outer);
            L.Controller.collectionFocus(lastFocus || false, $outer);
          },
          up: function () {
            if (root.Navigator && root.Navigator.canmove('up')) root.Navigator.move('up');
            else L.Controller.toggle('head');
          },
          down: function () { if (root.Navigator) root.Navigator.move('down'); },
          left: function () {
            if (root.Navigator && root.Navigator.canmove('left')) root.Navigator.move('left');
            else L.Controller.toggle('menu');
          },
          right: function () {
            if (root.Navigator && root.Navigator.canmove('right')) root.Navigator.move('right');
          },
          back: function () { L.Activity.backward(); }
        });
        L.Controller.toggle('content');
      }
      if (!this.started) { this.started = true; start(false); }
    };
    this.pause = function () {};
    this.stop = function () {};
    this.destroy = function () {
      session.dead = true; stage();
      if (scroll.destroy) scroll.destroy();
    };
  }

  function installCSS() {
    if (root.document.getElementById('capsule-online-next-style')) return;
    var style = root.document.createElement('style');
    style.id = 'capsule-online-next-style';
    style.textContent = [
      '.cnext-root{width:100%;height:100%;box-sizing:border-box;padding:1.1em 1.5em 2em;color:inherit}',
      '.cnext-head{margin-bottom:1em}.cnext-heading{font-size:1.4em;font-weight:700}',
      '.cnext-subtitle{opacity:.68;font-size:.85em;margin-top:.3em}',
      '.cnext-nav{display:flex;gap:.55em;flex-wrap:wrap;margin:1.05em 0 .45em}',
      '.cnext-nav-button{padding:.55em .9em;border-radius:.65em;background:rgba(255,255,255,.075);border:1px solid transparent;font-size:.92em}',
      '.cnext-card{display:flex;align-items:center;min-height:4.2em;gap:.8em;padding:.6em .75em;margin:.36em 0;border:1px solid transparent;border-radius:.8em;background:rgba(255,255,255,.065);box-sizing:border-box}',
      '.cnext-card.focus,.cnext-nav-button.focus{border-color:currentColor;background:rgba(255,255,255,.14)}',
      '.cnext-card .cnext-poster{width:4.8em;height:3.15em;object-fit:cover;border-radius:.48em;flex-shrink:0;background:rgba(255,255,255,.08)}',
      '.cnext-fallback{width:4.8em;min-height:3.15em;display:flex;align-items:center;justify-content:center;border-radius:.48em;background:rgba(255,255,255,.08);flex-shrink:0}',
      '.cnext-text{min-width:0;flex:1}.cnext-title{font-weight:650;font-size:1em;line-height:1.25}',
      '.cnext-detail{opacity:.66;font-size:.8em;margin-top:.2em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
      '.cnext-quality{font-size:.78em;opacity:.7;margin-left:auto}',
      '@media(max-width:650px){.cnext-root{padding:.7em .75em 3.2rem}.cnext-card{min-height:3.6em}.cnext-card .cnext-poster,.cnext-fallback{width:3.6em;height:2.7em}}',
      '@media(prefers-reduced-motion:reduce){.cnext-card,.cnext-nav-button{transition:none}}'
    ].join('');
    root.document.head.appendChild(style);
  }
  function settings() {
    if (settingsInstalled) return;
    if (!L.SettingsApi || !L.SettingsApi.addComponent || !L.SettingsApi.addParam) return;
    settingsInstalled = true;
    L.SettingsApi.addComponent({ component: COMPONENT, name: 'Capsule Online NEXT',
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 4v16l13-8z"/></svg>' });
    function option(key, name, values, def, desc) {
      L.SettingsApi.addParam({ component: COMPONENT,
        param: { name: PREFIX + key, type: 'select', values: values, default: def },
        field: { name: name, description: desc || '' } });
    }
    option('auto', 'Автовыбор', { true: 'Включён', false: 'Выключен' }, true);
    option('autoplay', 'Автозапуск фильмов', { true: 'Включён', false: 'Выключен' }, true);
    option('quality', 'Максимальное качество', {
      2160: 'До 4K', 1080: 'До 1080p', 720: 'До 720p', 480: 'До 480p'
    }, 2160);
    option('kids', 'Детский режим (по меткам озвучек)',
      { true: 'Включён', false: 'Выключен' }, false);
    [
      ['alloha', 'Alloha'], ['hdrezka', 'HDRezka'], ['vibix', 'VIBIX'],
      ['filmix', 'Filmix'], ['kodik', 'Kodik'], ['mirkinoz', 'Мир кино Z']
    ].forEach(function (row) {
      option('source_' + row[0], row[1], { true: 'Разрешён', false: 'Отключён' }, true);
    });
    VOICES.forEach(function (key) {
      option('voice_' + key, 'Озвучка · ' + key.toUpperCase(),
        { true: 'Разрешена', false: 'Отключена' }, true);
    });
    L.SettingsApi.addParam({ component: COMPONENT,
      param: { name: PREFIX + 'version', type: 'static' },
      field: { name: 'Capsule Online NEXT ' + VERSION,
        description: 'Предварительная версия. Без удалённого eval и без скрытой полной проверки сезонов.' } });
  }
  function addButton(event) {
    var movie = event && event.data && event.data.movie || event && event.movie;
    if (!movie || !root.$) return;
    var dom = event && event.object && event.object.activity &&
      event.object.activity.render && event.object.activity.render();
    if (!dom || !dom.find) return;
    if (dom.find('.capsule-online-next-button').length) return;
    var button = root.$('<div class="full-start__button selector capsule-online-next-button"><span>Capsule Online NEXT</span></div>');
    var lastLaunch = 0;
    function launch(manual) {
      var now = Date.now();
      if (now - lastLaunch < 550) return;
      lastLaunch = now;
      L.Activity.push({ component: COMPONENT, movie: movie,
        title: 'Capsule Online NEXT', page: 1, capsule_manual: !!manual });
    }
    button.on('hover:enter click', function () { launch(false); });
    button.on('hover:long contextmenu', function (e) {
      if (e && e.preventDefault) e.preventDefault();
      launch(true);
    });
    var bar = dom.find('.full-start-new__buttons, .full-start__buttons, .full-start__buttons-container').first();
    if (bar.length) bar.prepend(button);
  }
  function boot() {
    if (!root.Lampa || !root.document || !root.$ || !root.Lampa.Component ||
        !root.Lampa.Component.add || !root.Lampa.Scroll || !root.Lampa.Activity) {
      if (++bootAttempts < 35) root.setTimeout(boot, 250);
      return;
    }
    L = root.Lampa;
    if (initialized) return;
    if (!L.Component || !L.Component.add || !L.Scroll || !L.Activity) return;
    initialized = true;
    installCSS();
    L.Component.add(COMPONENT, Screen);
    settings();
    if (L.Listener && L.Listener.follow) {
      L.Listener.follow('full', function (event) {
        if (event && (event.type === 'complite' || event.type === 'complete'))
          addButton(event);
      });
      L.Listener.follow('app', function (event) {
        if (event && event.type === 'ready') { installCSS(); settings(); }
      });
    }
  }
  // Pure helpers are exposed for deterministic mocked tests. Never return tokens or links.
  root.__capsuleOnlineNextDebug = {
    version: VERSION, family: family, isSeries: isSeries, voiceRank: voiceRank,
    resolution: resolution, parseMenu: parseMenu, sortCatalog: sortCatalog,
    scoreSource: scoreSource, bestVoice: bestVoice, seasonNumber: seasonNumber
  };
  boot();
})(window);
