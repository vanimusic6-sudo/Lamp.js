/**
 * Amedia Diag 1.1 — on-screen diagnostics for Lampa.
 * Independent plugin; does not modify Amedia or the playback pipeline.
 * Install alongside Amedia. Network speed test starts only on request.
 */
(function () {
  'use strict';
  if (window.__amediaDiag) return;
  window.__amediaDiag = '1.1.0';

  var L = window.Lampa, $ = window.$;
  var ready = false, bootTimer = null;
  var R = { lines: [], speed: null, speedState: 'не запускался' };
  var live = fresh();
  var report = null, reportBody = null, reportScroll = null, oldControl = 'content';
  var hud = null, hudTimer = null, reportTimer = null;
  var unwrap = null, observations = [], observing = false, session = false, sessionWork = null;
  var activeSpeed = null;

  function fresh() {
    return { on: false, mbps: 0, win: [], frags: 0, err403: 0, stalls: 0,
      mode: '—', worker: '?', cap: '?', buf: 0, q: 0, levels: [],
      frames: 0, dropped: 0, runtimeStalls: 0, runtimeRecoveries: 0 };
  }
  function now() {
    return window.performance && window.performance.now ? window.performance.now() : Date.now();
  }
  function fmt(value, digits) {
    var n = Number(value);
    return isFinite(n) ? n.toFixed(digits === undefined ? 1 : digits) : '—';
  }
  function add(label, value) {
    R.lines.push({ k: String(label), v: String(value === undefined ? '—' : value) });
  }
  function read(key, fallback) {
    try { return L.Storage.get(key, fallback); } catch (e) { return fallback; }
  }
  function video() {
    try {
      var v = L.PlayerVideo && L.PlayerVideo.video && L.PlayerVideo.video();
      if (v && v.jquery) v = v[0];
      return v && typeof v.currentTime === 'number' ? v : null;
    } catch (e) { return null; }
  }
  function currentWork() {
    try { return L.Player && L.Player.playdata && L.Player.playdata(); }
    catch (e) { return null; }
  }
  function snapshotVideo() {
    var v = video(), ahead = 0;
    if (v) {
      try {
        var ranges = v.buffered, pos = Number(v.currentTime) || 0;
        for (var i = 0; ranges && i < Math.min(ranges.length, 24); i++) {
          if (ranges.start(i) <= pos + 0.15 && ranges.end(i) > pos) {
            ahead = Math.max(ahead, ranges.end(i) - pos);
          }
        }
      } catch (e) {}
      live.q = v.videoHeight || 0;
      if (typeof v.getVideoPlaybackQuality === 'function') {
        try {
          var quality = v.getVideoPlaybackQuality();
          live.frames = Number(quality.totalVideoFrames) || 0;
          live.dropped = Number(quality.droppedVideoFrames) || 0;
        } catch (e) {}
      }
    }
    live.buf = ahead;
    // Our independent Amedia runtime already has a watchdog. Reading its
    // counters is safe; wrapping its own Hls constructor is not.
    var existing = read('amedia_v4_runtimeStats', null);
    if (existing && Date.now() - Number(existing.at || 0) < 30 * 60 * 1000) {
      live.runtimeStalls = Number(existing.stalls) || 0;
      live.runtimeRecoveries = Number(existing.recoveries) || 0;
    }
  }
  function collect() {
    snapshotVideo();
    R.lines = [];
    var platform = 'другая';
    try {
      platform = L.Platform.is('android') ? 'Android' :
        L.Platform.is('tizen') ? 'Tizen' : L.Platform.is('webos') ? 'webOS' : 'другая';
    } catch (e) {}
    add('Платформа', platform);
    var app = 'нет данных';
    try { if (window.AndroidJS && window.AndroidJS.appVersion) app = window.AndroidJS.appVersion(); }
    catch (e) {}
    add('Версия приложения', app);
    add('Ядер CPU', navigator.hardwareConcurrency || '?');
    add('Память deviceMemory', navigator.deviceMemory || '?');
    add('Экран', window.screen ? window.screen.width + ' × ' + window.screen.height : '—');

    add('— Поддержка MSE —', '');
    var mse = window.MediaSource;
    [
      ['H.264 1080p', 'avc1.640028'],
      ['H.264 High 5.1', 'avc1.640034'],
      ['HEVC 8bit', 'hvc1.1.6.L120.B0'],
      ['HEVC 10bit HDR', 'hvc1.2.4.L150.B0'],
      ['AV1', 'av01.0.12M.08']
    ].forEach(function (row) {
      var supported = false;
      try { supported = !!(mse && mse.isTypeSupported &&
        mse.isTypeSupported('video/mp4; codecs="' + row[1] + '"')); } catch (e) {}
      add(row[0], supported ? 'ЕСТЬ' : 'НЕТ');
    });

    add('— Плеер Lampa —', '');
    add('Воспроизведение', session ? 'идёт' : 'не запущено');
    add('HLS мониторинг', live.on ? 'активен' : 'через HTMLVideoElement');
    add('Режим', live.mode);
    add('Worker', live.worker);
    add('capLevelToPlayerSize', live.cap);
    add('HLS фрагментов', live.frags || 'нет данных');
    add('Ошибки HTTP 403', live.on ? live.err403 : 'нет данных');
    add('HLS bufferStalled', live.on ? live.stalls : 'нет данных');
    add('Amedia: зависания', live.runtimeStalls);
    add('Amedia: восстановления', live.runtimeRecoveries);

    add('— Производительность —', '');
    add('Прямой канал XHR', R.speed === null ? R.speedState : fmt(R.speed, 1) + ' Мбит/с');
    add('Скорость HLS-фрагментов', live.mbps ? fmt(live.mbps, 2) + ' Мбит/с' : 'нет данных');
    add('Видео', live.q ? live.q + 'p' : '—');
    add('Буфер вперёд', fmt(live.buf, 1) + ' с');
    if (live.frames) add('Потеря кадров', fmt(100 * live.dropped / live.frames, 2) + '%');
    if (live.levels.length) {
      add('— HLS качества —', '');
      live.levels.slice(0, 20).forEach(function (level) {
        add((level.height || '?') + 'p', fmt((level.bitrate || 0) / 1000000, 2) + ' Мбит/с');
      });
    }
    add('— Интерпретация —', '');
    var need = 0;
    live.levels.forEach(function (l) {
      if (Number(l.height) === 2160) need = Math.max(need, Number(l.bitrate || 0) / 1000000);
    });
    if (need && live.mbps) {
      add('4K требует (поток)', fmt(need, 1) + ' Мбит/с');
      add('4K запас по скорости', live.mbps >= need * 1.3 ? 'вероятно достаточен' : 'не подтверждён');
    }
    if (live.mbps && R.speed) {
      add('Разница канал / HLS', fmt(R.speed / live.mbps, 1) + '×');
      add('Примечание', 'Разница не доказывает проблему моста');
    }
  }

  // Optional direct test only. Smaller transfer protects low-memory TV boxes.
  function speedTest(done) {
    if (activeSpeed) return;
    R.speed = null; R.speedState = 'идёт замер…';
    if (done) done();
    var xhr = new XMLHttpRequest(), t0 = now();
    activeSpeed = xhr;
    var url = 'https://speed.cloudflare.com/__down?bytes=8000000&r=' + Date.now();
    function finish(message) {
      if (activeSpeed !== xhr) return;
      activeSpeed = null;
      if (message) R.speedState = message;
      if (done) done();
    }
    try {
      xhr.open('GET', url, true);
      xhr.responseType = 'arraybuffer';
      xhr.timeout = 20000;
      xhr.onload = function () {
        var sec = (now() - t0) / 1000;
        var bytes = xhr.response && xhr.response.byteLength || 0;
        if (xhr.status >= 200 && xhr.status < 300 && bytes && sec > 0) {
          R.speed = bytes * 8 / sec / 1000000;
          finish('готово');
        } else finish('HTTP ' + xhr.status + ' / пустой ответ');
      };
      xhr.onerror = function () { finish('CORS или ошибка сети'); };
      xhr.ontimeout = function () { finish('таймаут 20 с'); };
      xhr.onabort = function () { finish('прерван'); };
      xhr.send(null);
    } catch (e) { finish('XHR недоступен'); }
  }

  function observe(instance, Base) {
    if (!instance || typeof instance.on !== 'function') return;
    var E = Base.Events || {}, config = instance.config || {};
    live.on = true;
    live.worker = config.enableWorker === true ? 'включён' :
      config.enableWorker === false ? 'выключен' : '?';
    live.cap = config.capLevelToPlayerSize === undefined ? '?' :
      String(config.capLevelToPlayerSize);
    function listen(name, fn) {
      if (!name) return;
      try {
        instance.on(name, fn);
        observations.push({ instance: instance, name: name, fn: fn });
      } catch (e) {}
    }
    listen(E.MANIFEST_PARSED, function () {
      live.levels = (instance.levels || []).map(function (l) {
        return { height: Number(l.height) || 0, bitrate: Number(l.bitrate) || 0 };
      });
    });
    listen(E.FRAG_LOADED, function (ev, d) {
      var data = d && (d.part || d.frag), st = data && data.stats || d && d.stats;
      if (!st || !st.loading) return;
      var ms = Number(st.loading.end) - Number(st.loading.start);
      var bytes = Number(st.loaded) || 0;
      if (!(ms > 0 && bytes > 0)) return;
      live.frags++;
      live.win.push({ bytes: bytes, ms: ms, at: now() });
      var cutoff = now() - 25000;
      while (live.win.length && live.win[0].at < cutoff) live.win.shift();
      if (live.win.length > 40) live.win.splice(0, live.win.length - 40);
      var sumBytes = 0, sumMs = 0;
      live.win.forEach(function (p) { sumBytes += p.bytes; sumMs += p.ms; });
      if (sumMs) live.mbps = sumBytes * 8 / (sumMs * 1000);
    });
    listen(E.ERROR, function (ev, data) {
      if (!data) return;
      if (data.response && Number(data.response.code) === 403) live.err403++;
      if (data.details && /bufferStalled|bufferSeekOverHole/i.test(data.details)) live.stalls++;
    });
  }
  function unwatch() {
    observations.forEach(function (o) {
      try { if (o.instance && o.instance.off) o.instance.off(o.name, o.fn); } catch (e) {}
    });
    observations = [];
    if (unwrap) { try { unwrap(); } catch (e) {} }
    unwrap = null; observing = false; live.on = false;
  }
  function installWatch() {
    if (observing) return;
    var Base = window.Hls, work = currentWork();
    // Amedia 5.15 installs its own temporary Hls constructor. Wrapping it
    // causes an invalid unwind order on Player.destroy. Do not chain it.
    if (!Base || typeof Base !== 'function' || Base.__diagWatch ||
        (work && work.__amediaManaged) || /AmediaHls/i.test(Base.name || '')) return;
    function Watch(config) {
      var instance = new Base(config);
      try { observe(instance, Base); } catch (e) {}
      return instance;
    }
    Watch.prototype = Base.prototype;
    try {
      if (Object.setPrototypeOf) Object.setPrototypeOf(Watch, Base);
      else Object.getOwnPropertyNames(Base).forEach(function (key) {
        if (key === 'prototype' || key === 'length' || key === 'name') return;
        try { Object.defineProperty(Watch, key, Object.getOwnPropertyDescriptor(Base, key)); }
        catch (e) {}
      });
      Watch.__diagWatch = true;
      window.Hls = Watch;
      if (window.Hls !== Watch) return;
      observing = true;
      unwrap = function () { if (window.Hls === Watch) window.Hls = Base; };
    } catch (e) {
      try { if (window.Hls === Watch) window.Hls = Base; } catch (ignored) {}
    }
  }

  function hudStop() {
    if (hudTimer !== null) clearInterval(hudTimer);
    hudTimer = null;
    if (hud) { hud.remove(); hud = null; }
  }
  function hudStart() {
    hudStop();
    if (!session || read('amdiag_hud', true) === false) return;
    hud = $('<div></div>').css({
      position: 'fixed', right: '1em', top: '1em', zIndex: 9997,
      background: 'rgba(8,12,18,.84)', color: '#fff', fontSize: '0.9em',
      lineHeight: '1.45', padding: '.65em .85em', borderRadius: '.65em',
      pointerEvents: 'none', whiteSpace: 'pre', fontFamily: 'monospace',
      maxWidth: '75vw'
    }).appendTo('body');
    function update() {
      if (!hud) return;
      snapshotVideo();
      var stalls = live.on ? live.stalls : live.runtimeStalls;
      hud.text('HLS  ' + (live.mbps ? fmt(live.mbps, 2) : '—') + ' Мбит/с\n' +
        'Буфер  ' + fmt(live.buf, 1) + ' с\n' +
        'Видео  ' + (live.q || '—') + 'p\n' +
        '403  ' + (live.on ? live.err403 : '—') + '   стопы  ' + stalls);
    }
    update();
    hudTimer = setInterval(update, 1000);
  }

  function closeScreen() {
    if (!report) return;
    if (reportTimer !== null) clearInterval(reportTimer);
    reportTimer = null;
    report.remove();
    report = null; reportBody = null; reportScroll = null;
    try { L.Controller.toggle(oldControl); } catch (e) {}
  }
  function showScreen() {
    if (report) { collect(); renderLines(); return; }
    collect();
    try {
      var c = L.Controller.enabled();
      oldControl = c && c.name && c.name !== 'amdiag' ? c.name : 'content';
    } catch (e) { oldControl = 'content'; }
    report = $('<div></div>').css({
      position: 'fixed', inset: '0', zIndex: 9998, color: '#f5f6f8',
      background: '#11161e', display: 'flex', flexDirection: 'column',
      fontFamily: 'inherit'
    });
    var header = $('<div></div>').css({ padding: '1.2em 1.5em .65em', flexShrink: 0 });
    header.append($('<div></div>').text('Диагностика Amedia').css({
      fontSize: '1.5em', fontWeight: '700'
    }));
    header.append($('<div></div>').text('↑ ↓ — прокрутка · ← → — действия · Назад — закрыть')
      .css({ opacity: .62, marginTop: '.35em', fontSize: '.85em' }));
    var actions = $('<div></div>').css({
      display: 'flex', gap: '.6em', padding: '.6em 1.5em 1em', flexShrink: 0, flexWrap: 'wrap'
    });
    var actionButtons = [], focused = 0;
    function button(label, fn) {
      var b = $('<div class="selector"></div>').text(label).css({
        padding: '.7em 1.2em', borderRadius: '.6em',
        background: '#263345', border: '1px solid #47556a', fontWeight: '600'
      });
      var last = 0;
      function press() {
        var t = Date.now(); if (t - last < 250) return;
        last = t; fn();
      }
      b.on('hover:enter click', press);
      b.on('hover:focus', function () {
        focused = actionButtons.indexOf(b);
        b.css({ background: '#eef1f5', color: '#101722' });
      });
      b.on('hover:blur', function () {
        b.css({ background: '#263345', color: '#f5f6f8' });
      });
      actionButtons.push(b); actions.append(b);
    }
    button('Замерить канал', function () {
      speedTest(function () { if (report) { collect(); renderLines(); } });
    });
    button('Обновить', function () { collect(); renderLines(); });
    button('Закрыть', closeScreen);
    reportScroll = $('<div></div>').css({
      flex: '1 1 0', minHeight: '0', overflowY: 'auto',
      overscrollBehavior: 'contain', touchAction: 'pan-y',
      WebkitOverflowScrolling: 'touch', padding: '0 1.2em 2em'
    });
    reportBody = $('<div></div>');
    reportScroll.append(reportBody);
    report.append(header, actions, reportScroll).appendTo('body');
    renderLines();
    function focusAction(index) {
      focused = Math.max(0, Math.min(actionButtons.length - 1, index));
      try {
        if (L.Controller.collectionSet) L.Controller.collectionSet(actions, report);
        if (L.Controller.collectionFocus)
          L.Controller.collectionFocus(actionButtons[focused][0], report);
      } catch (e) {}
    }
    L.Controller.add('amdiag', {
      toggle: function () { focusAction(focused); },
      up: function () { reportScroll.scrollTop(Math.max(0, reportScroll.scrollTop() - 130)); },
      down: function () { reportScroll.scrollTop(reportScroll.scrollTop() + 130); },
      left: function () { focusAction(focused - 1); },
      right: function () { focusAction(focused + 1); },
      back: closeScreen
    });
    L.Controller.toggle('amdiag');
  }
  function renderLines() {
    if (!reportBody) return;
    reportBody.empty();
    R.lines.forEach(function (line) {
      var heading = line.v === '';
      var item = $('<div></div>').css({
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        flexWrap: 'wrap', gap: '.4em', padding: '.45em .7em',
        marginBottom: '.17em', borderRadius: '.4em',
        background: heading ? 'transparent' : '#1c2633',
        color: heading ? '#a8b6c8' : '#f5f6f8',
        marginTop: heading ? '.7em' : '0'
      });
      item.append($('<span></span>').text(line.k));
      if (!heading) item.append($('<strong></strong>').text(line.v).css({ textAlign: 'right' }));
      reportBody.append(item);
    });
  }
  function onPlayback(event, first) {
    var work = event && (event.data || event) || currentWork();
    if (!first && session && sessionWork === work) { hudStartIfMissing(); return; }
    if (session && sessionWork === work) return;
    unwatch(); hudStop(); live = fresh();
    session = true; sessionWork = work;
    live.mode = work && work.hls_headers ? 'заголовки Amedia' :
      work && work.__amediaManaged ? 'Amedia / внутренний' : 'Lampa / встроенный';
    installWatch();
    setTimeout(hudStartIfMissing, 400);
  }
  function hudStartIfMissing() {
    if (session && !hud) hudStart();
  }
  function onDestroy() {
    session = false; sessionWork = null;
    unwatch(); hudStop();
  }
  function start() {
    if (ready || !L || !L.SettingsApi || !L.Lang || !L.Storage ||
        !L.Controller || !L.Player || !L.Player.listener || !$) return false;
    ready = true;
    if (bootTimer) clearInterval(bootTimer);
    L.Lang.add({
      amdiag_name: { ru: 'Диагностика Amedia', en: 'Amedia diagnostics', uk: 'Діагностика Amedia' },
      amdiag_show: { ru: 'Отчёт на экране', en: 'On-screen report', uk: 'Звіт на екрані' },
      amdiag_speed: { ru: 'Замерить скорость канала', en: 'Measure channel speed', uk: 'Заміряти швидкість каналу' },
      amdiag_hud: { ru: 'Показатели поверх плеера', en: 'In-player statistics', uk: 'Статистика поверх плеєра' }
    });
    L.SettingsApi.addComponent({
      component: 'amedia_diag', name: L.Lang.translate('amdiag_name'),
      icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19V5m5 14V9m5 10v-7m5 7V7" stroke-linecap="round"/></svg>'
    });
    L.SettingsApi.addParam({
      component: 'amedia_diag', param: { name: 'amdiag_show', type: 'button' },
      field: { name: L.Lang.translate('amdiag_show') }, onChange: showScreen
    });
    L.SettingsApi.addParam({
      component: 'amedia_diag', param: { name: 'amdiag_speed', type: 'button' },
      field: { name: L.Lang.translate('amdiag_speed') },
      onChange: function () {
        try { L.Noty.show('Измеряю канал…'); } catch (e) {}
        speedTest(function () {
          try { L.Noty.show(R.speed === null ? R.speedState : fmt(R.speed, 1) + ' Мбит/с'); }
          catch (e) {}
        });
      }
    });
    L.SettingsApi.addParam({
      component: 'amedia_diag', param: { name: 'amdiag_hud', type: 'trigger', default: true },
      field: { name: L.Lang.translate('amdiag_hud'),
        description: 'Буфер, видео, скорость и ошибки без открытия консоли' }
    });
    L.Player.listener.follow('start', function (ev) { onPlayback(ev, true); });
    L.Player.listener.follow('create', function (ev) { onPlayback(ev, false); });
    L.Player.listener.follow('destroy', onDestroy);
    return true;
  }
  if (window.appready) start();
  if (L && L.Listener) L.Listener.follow('app', function (e) {
    if (e && e.type === 'ready') start();
  });
  if (!ready) {
    var attempts = 0;
    bootTimer = setInterval(function () {
      if (start() || ++attempts > 60) clearInterval(bootTimer);
    }, 500);
  }
}());
