/**
 * Lampa Plugin: "Стоит ли смотреть?" (Should Watch?)
 * Version: 54.0 (intelligent verdicts, safer data, smoother interface)
 * Compliant with Lampa API, Memory-safe, Pure jQuery/DOM, Zero external dependencies.
 */
(function () {
    'use strict';
    if (window.should_watch_plugin_installed) return;
    window.should_watch_plugin_installed = true;
    window.should_watch_plugin_enhanced = true;

    var PLUGIN_ID = 'should_watch_plugin_enhanced';
    var CONTROLLER_ID = 'should_watch_modal_enhanced';
    var SETTINGS_FLAG = 'sw_settings_ready_v52';
    var ICON = '<svg viewBox="0 0 24 24" width="30" height="30" xmlns="http://www.w3.org/2000/svg"><path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" fill="currentColor"/></svg>';
    var ARROW_ICON = '<svg class="sw-aud-arrow" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M5 5v5a6 6 0 0 0 6 6h8" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"/><path d="M15 12l4 4-4 4" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    var FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
    var GENRE_ID_ANIM = 16, GENRE_ID_FAMILY = 10751, GENRE_ID_KIDS = 10762;

    // Dice is a coin-flip between two outcomes only. "СПОРНО" is an analysis verdict,
    // it must never drop out of the dice.
    var SW_DICE_VERDICTS = ['СТОИТ', 'НЕ СТОИТ'];

    var DEMO_DATA = {
        id: 27205,
        title: 'Начало (Inception)',
        name: 'Начало',
        vote_average: 8.4,
        vote_count: 36500,
        runtime: 148,
        release_date: '2010-07-16',
        genres: [{ id: 28, name: 'боевик' }, { id: 878, name: 'научная фантастика' }, { id: 53, name: 'триллер' }],
        overview: 'Кобб — талантливый вор, лучший из лучших в опасном искусстве извлечения: он крадёт ценные секреты из глубин подсознания во время сна.'
    };

    var _sw_session = 0, _sw_openingAt = 0, _sw_uiTimers = [];
    function uiLater(fn, ms, session) {
        var t = setTimeout(function(){
            if (session !== _sw_session || window._sw_closed) return;
            fn();
        }, ms);
        _sw_uiTimers.push(t);
        return t;
    }
    function clearUiTimers(){ _sw_uiTimers.forEach(clearTimeout); _sw_uiTimers = []; }

    var _metaCache = {};
    var _domCache = null;

    window._sw_rolling = false;
    window._sw_currentModalHtml = null;
    window._sw_closed = false;
    window._sw_loaderTimer = null;
    window._sw_activeInteractive = null;
    window._sw_prevController = null;
    window._sw_triggerElement = null;

    var INTERESTING_TAGS = [
        { re: /based on novel|основан на романе|экранизац/i, text: '✨ Экранизация книги' },
        { re: /based on true story|основан на реальных событиях|true story/i, text: '✨ На реальных событиях' },
        { re: /based on comic|comic book|графическ роман/i, text: '✨ По мотивам комикса' },
        { re: /based on video game|по мотивам игры|video game/i, text: '🎮 По мотивам игры' },
        { re: /oscar winner|academy award|лауреат оскар/i, text: '🏆 Лауреат премии Оскар' },
        { re: /cannes|venice|berlin|film festival winner/i, text: '🎬 Призёр кинофестиваля' },
        { re: /cult film|культов/i, text: '🎭 Культовый фильм' },
        { re: /remake|римейк/i, text: '🔁 Римейк' },
        { re: /sequel|сиквел/i, text: '➕ Сиквел' },
        { re: /prequel|приквел/i, text: '⏪ Приквел' },
        { re: /time travel|путешестви[яе] во времени/i, text: '⏳ Путешествия во времени' },
        { re: /heist|ограблен/i, text: '💼 История ограбления' },
        { re: /post[- ]?apocalyptic|постапокалипсис/i, text: '☣️ Постапокалипсис' },
        { re: /dystopia|антиутопи/i, text: '🏙 Антиутопия' },
        { re: /coming of age|взрослен/i, text: '🌱 История взросления' },
        { re: /cyberpunk|киберпанк/i, text: '🤖 Киберпанк' },
        { re: /outer space|space travel|космос|moon mission|lunar|марс/i, text: '🚀 Космос' },
        { re: /biographical|biopic|биограф/i, text: '📖 Биографическая история' }
    ];

    var FEATURES = [
        { re: /plot twist|twist ending|неожиданн поворот|сюжетн поворот/i, text: '🌀 Неожиданные повороты' },
        { re: /superhero|супергеро/i, text: '🦸 Супергероика' },
        { re: /strong female lead|сильн героин/i, text: '💪 Сильная героиня' },
        { re: /musical|мюзикл/i, text: '🎶 Мюзикл' },
        { re: /magic|маги|волшеб/i, text: '🪄 Магия' },
        { re: /dragon|дракон/i, text: '🐉 Драконы' },
        { re: /detective|детектив/i, text: '🕵️ Детектив' },
        { re: /spy|шпион/i, text: '🕶 Шпионские игры' },
        { re: /zombie|зомби/i, text: '🧟 Зомби' },
        { re: /vampire|вампир/i, text: '🧛 Вампиры' },
        { re: /robot|android|робот/i, text: '🤖 Роботы' },
        { re: /time loop|временн[ао]я петл/i, text: '🔁 Временная петля' },
        { re: /animal|животн/i, text: '🐾 Животные' },
        { re: /кошк|кошач/i, text: '🐱 Котики' },
        { re: /собак|пёс|пес|dog/i, text: '🐶 Собаки' },
        { re: /friendship|дружб/i, text: '🤝 О дружбе' },
        { re: /romance|романтик/i, text: '❤️ Романтика' }
    ];

    var DOM_METRICS = [['pace','Темп'],['fear','Страх'],['action','Экшен'],['violence','Насилие'],['sadness','Грусть'],['language','Лексика']].map(function(p){
        return { key: p[0], re: new RegExp(p[1] + '[\\s\\S]{0,60}?([\\d.,]+)\\s*/\\s*10') };
    });

    function getSetting(k, d) {
        try {
            if (window.Lampa && Lampa.Storage) {
                var v = Lampa.Storage.get(PLUGIN_ID + '_' + k);
                if (v !== undefined && v !== null && v !== '') return v;
            }
        } catch(e) {}
        return d;
    }

    function getSettings() {
        return {
            bad_genres: String(getSetting('bad_genres', '') || ''),
            bad_actors: String(getSetting('bad_actors', '') || ''),
            bad_directors: String(getSetting('bad_directors', '') || ''),
            min_rating: isFinite(parseFloat(getSetting('min_rating', '6'))) ? parseFloat(getSetting('min_rating', '6')) : 6,
            font_scale: parseInt(getSetting('font_scale', '20')) || 20
        };
    }

    function parseBL(s) {
        return s ? s.split(',').map(function(x){ return x.trim().toLowerCase(); }).filter(Boolean) : [];
    }

    function initSettings() {
        try {
            if (!window.Lampa || !Lampa.SettingsApi || window[SETTINGS_FLAG]) return;
            window[SETTINGS_FLAG] = true;
            Lampa.SettingsApi.addComponent({ component: PLUGIN_ID, name: 'Стоит ли смотреть', icon: ICON });
            [
                { name: 'bad_genres', type: 'input', title: 'Нелюбимые жанры', description: 'Через запятую (напр: ужасы, мелодрама)', default: '' },
                { name: 'bad_actors', type: 'input', title: 'Нелюбимые актёры', description: 'Через запятую', default: '' },
                { name: 'bad_directors', type: 'input', title: 'Нелюбимые авторы/режиссёры', description: 'Через запятую', default: '' },
                { name: 'min_rating', type: 'select', title: 'Минимальный рейтинг', values: {'0':'Любой','5':'5.0','6':'6.0','7':'7.0','8':'8.0'}, default: '6' },
                { name: 'font_scale', type: 'select', title: 'Размер шрифта', values: {'14':'14px','16':'16px','18':'18px','20':'20px','24':'24px','28':'28px'}, default: '20' },
                { name: 'reset_cache', type: 'select', title: 'Кэш данных', values: {'0':'Хранить','1':'Сбросить при следующем открытии'}, default: '0' }
            ].forEach(function(p) {
                Lampa.SettingsApi.addParam({
                    component: PLUGIN_ID,
                    param: { name: PLUGIN_ID + '_' + p.name, type: p.type, values: p.values || '', default: p.default },
                    field: { name: p.title, description: p.description }
                });
            });
        } catch(e) { console.error('[SW] initSettings:', e); }
    }

    function injectCSS() {
        if (document.getElementById('sw-plugin-styles-v56')) return;
        ['sw-plugin-styles-v51', 'sw-plugin-styles-v52', 'sw-plugin-styles-v53', 'sw-plugin-styles-v54', 'sw-plugin-styles-v55'].forEach(function(id){
            var old = document.getElementById(id);
            if (old && old.parentNode) old.parentNode.removeChild(old);
        });
        var s = document.createElement('style');
        s.id = 'sw-plugin-styles-v56';
        s.innerHTML =
            // === Trigger button on full-card ===
            '.sw-custom-button-enhanced{cursor:pointer;position:relative;transition:background .25s ease,color .25s,transform .2s ease,box-shadow .25s;display:inline-flex;align-items:center;justify-content:center;border-radius:12px;user-select:none;overflow:hidden}' +
            '.sw-custom-button-enhanced.focus{background:#343a40!important;color:#fff!important;transform:scale(1.02);box-shadow:0 2px 8px rgba(0,0,0,.4)}' +
            '.sw-custom-button-enhanced.focus svg path{fill:#fff}' +
            // === Root wrap ===
            '.sw-wrap{--sw-green:#4CAF50;--sw-red:#EF5350;--sw-orange:#FFB74D;--sw-ink:#e9ecef;--sw-mut:#adb5bd;--sw-mono:"PT Mono","Ubuntu Mono","Droid Sans Mono","Courier New",monospace;padding:12px 6px 40px;color:var(--sw-ink);font-family:' + FONT + ';font-size:20px;box-sizing:border-box;-webkit-font-smoothing:antialiased}' +
            '.sw-body{animation:swFadeIn .35s ease}' +
            '@keyframes swFadeIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}' +
            // === Loader ===
            '.sw-loader{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;padding:60px 20px;min-height:40vh;color:#9aa1a6}' +
            '.sw-loader-emoji{font-size:2.8em;line-height:1;animation:swFloat 2s ease-in-out infinite;will-change:transform}' +
            '@keyframes swFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}' +
            '.sw-loader-text{font-size:1em;font-weight:500;min-height:1.5em;text-align:center;color:#dfe6ec;letter-spacing:.02em}' +
            '.sw-loader-progress{width:220px;height:4px;border-radius:4px;background:rgba(255,255,255,.08);overflow:hidden;position:relative;margin-top:4px}' +
            '.sw-loader-progress::after{content:"";position:absolute;left:-100%;top:0;height:100%;width:100%;background:linear-gradient(90deg,transparent,#dee2e6,transparent);animation:swSlide 1.2s ease-in-out infinite;will-change:left}' +
            '@keyframes swSlide{0%{left:-100%}100%{left:100%}}' +
            // === Verdict dossier card ===
            '.sw-dossier{position:relative;background:#212529;border:1px solid #2a2e32;border-radius:16px;padding:22px 24px 20px;margin-bottom:14px;box-shadow:0 4px 16px rgba(0,0,0,.3);animation:swRise .4s ease both;overflow:hidden}' +
            '@keyframes swRise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}' +
            '.sw-verdict-word{position:relative;font-family:var(--sw-mono);font-size:2.2em;font-weight:700;letter-spacing:.04em;line-height:1;margin:0 0 16px;text-transform:uppercase;opacity:0;transform:translateY(10px);transition:opacity .55s cubic-bezier(.16,.8,.24,1),transform .55s cubic-bezier(.16,.8,.24,1);will-change:transform,opacity}' +
            '.sw-verdict-word.appear{opacity:1;transform:translateY(0)}' +
            '.sw-verdict-word.yes{color:var(--sw-green)}' +
            '.sw-verdict-word.no{color:var(--sw-red)}' +
            '.sw-verdict-word.meh{color:var(--sw-orange)}' +
            '.sw-meter{height:6px;border-radius:4px;background:rgba(255,255,255,.08);overflow:hidden;box-shadow:inset 0 1px 2px rgba(0,0,0,.3)}' +
            '.sw-meter-fill{height:100%;width:0;border-radius:4px;transition:width 1.1s cubic-bezier(.16,.8,.24,1) .1s;will-change:width}' +
            '.sw-meter-fill.yes{background:var(--sw-green)}' +
            '.sw-meter-fill.no{background:var(--sw-red)}' +
            '.sw-meter-fill.meh{background:var(--sw-orange)}' +
            // === Dice button ===
            '.sw-dicebtn{position:relative;display:flex;align-items:center;justify-content:center;width:100%;height:70px;border-radius:14px;background:#262b30;border:1px solid rgba(255,255,255,.08);margin:0 0 14px;cursor:pointer;outline:none;transition:box-shadow .25s ease,background .25s ease;-webkit-tap-highlight-color:transparent;box-shadow:0 4px 12px rgba(0,0,0,.25)}' +
            '.sw-dicebtn.focus{background:#2f353a!important;box-shadow:0 0 0 2px rgba(255,255,255,.8),0 4px 12px rgba(0,0,0,.3)}' +
            '.sw-dicebtn:active{background:#2a3035}' +
            '.sw-dicebtn:not(.sw-rolling) .sw-dice{animation:swIdleBob 2.4s ease-in-out infinite;will-change:transform}' +
            '@keyframes swIdleBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-3px)}}' +
            '.sw-dice{position:absolute;left:16px;top:50%;width:44px;height:44px;margin-top:-22px}' +
            '.sw-dice-core{display:block;width:100%;height:100%;filter:drop-shadow(0 4px 6px rgba(0,0,0,.4));transform-origin:50% 100%;will-change:transform}' +
            '.sw-dice-core svg{width:100%;height:100%;display:block}' +
            '.sw-dice-core.sw-knock{animation:swKnock .42s cubic-bezier(.33,.02,.17,1) both}' +
            '@keyframes swKnock{0%{transform:translateY(0) scale(1,1)}28%{transform:translateY(-18px) scale(1.04,1.04)}50%{transform:translateY(0) scale(1,1)}64%{transform:translateY(2px) scale(1.14,.8)}80%{transform:translateY(-4px) scale(.98,1.04)}100%{transform:translateY(0) scale(1,1)}}' +
            '.sw-dice-label{position:relative;font-family:var(--sw-mono);font-size:1.4em;font-weight:700;color:#fff;text-align:center;text-transform:lowercase;letter-spacing:.02em;transition:opacity .25s ease,transform .25s ease;pointer-events:none;padding:0 16px}' +
            '.sw-dice-label.hide{opacity:0;transform:translateY(8px)}' +
            '.sw-dice-label.res-yes{color:#66bb6a}' +
            '.sw-dice-label.res-no{color:#f19898}' +
            // === Tabs ===
            '.sw-tabs{display:grid;grid-template-columns:1fr 1fr;background:transparent;border-radius:12px;overflow:hidden;margin-bottom:14px;padding:0;gap:8px}' +
            '.sw-tab-btn{position:relative;min-height:48px;padding:10px 8px;display:flex;align-items:center;justify-content:center;gap:8px;background:#1e2226;border:1px solid transparent;outline:none;border-radius:10px;cursor:pointer;color:#c7cdd2;font-family:var(--sw-mono);font-size:0.95em;font-weight:700;text-transform:lowercase;letter-spacing:.02em;opacity:.7;transition:opacity .2s,background .2s ease,border-color .2s;user-select:none}' +
            '.sw-tab-btn.active{opacity:1;color:#fff;background:#262b30;border-color:#e9ecef;box-shadow:0 2px 8px rgba(0,0,0,.25)}' +
            '.sw-tab-btn.focus{opacity:1;background:#343a40!important;box-shadow:0 0 0 2px rgba(255,255,255,.8),0 2px 8px rgba(0,0,0,.3)}' +
            '.sw-tab-btn.sw-disabled{opacity:.35;pointer-events:none}' +
            '.sw-tab-pane{display:none}' +
            '.sw-tab-pane.active{display:block;animation:swPaneIn .35s cubic-bezier(.16,.8,.24,1) both}' +
            '@keyframes swPaneIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}' +
            // === Pros/Cons columns ===
            '.sw-columns{display:grid;grid-template-columns:1fr 1fr;gap:14px}' +
            '.sw-col{position:relative;background:#1e2226;border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:16px 18px;box-shadow:0 4px 12px rgba(0,0,0,.25)}' +
            '.sw-col.pros{border-left:8px solid #4CAF50}' +
            '.sw-col.cons{border-left:8px solid #EF5350}' +
            '.sw-list{margin:0;padding:0;list-style:none;font-size:0.95em;line-height:1.5;color:#eef1f2}' +
            '.sw-list li{position:relative;margin-bottom:14px;padding-left:0;opacity:0;transform:translateY(6px);transition:opacity .45s cubic-bezier(.16,.8,.24,1),transform .45s cubic-bezier(.16,.8,.24,1);will-change:transform,opacity}' +
            '.sw-list li:last-child{margin-bottom:0}' +
            '.sw-list li.appear{opacity:1;transform:translateY(0)}' +
            // === Atmosphere metrics ===
            '.sw-metrics-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px}' +
            '.sw-metric-card{position:relative;background:#1e2226;border:1px solid rgba(255,255,255,.06);border-radius:10px;padding:12px 14px;box-shadow:0 4px 12px rgba(0,0,0,.2);opacity:0;transform:translateY(8px);transition:opacity .45s cubic-bezier(.16,.8,.24,1),transform .45s cubic-bezier(.16,.8,.24,1);will-change:transform,opacity}' +
            '.sw-metric-card.appear{opacity:1;transform:translateY(0)}' +
            '.sw-metric-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px}' +
            '.sw-metric-name{font-family:var(--sw-mono);font-size:.78em;font-weight:700;color:#c7cdd2;text-transform:uppercase;letter-spacing:.04em}' +
            '.sw-metric-score{font-family:var(--sw-mono);font-size:1.05em;font-weight:700;white-space:nowrap}' +
            '.sw-metric-score small{font-size:0.7em;opacity:0.6;font-weight:700}' +
            '.sw-metric-score.hi{color:#EF5350}.sw-metric-score.mid{color:#E6A23C}.sw-metric-score.ok{color:#81C784}' +
            '.sw-metric-bar-bg{height:5px;border-radius:4px;background:rgba(255,255,255,.07);overflow:hidden;margin-bottom:0}' +
            '.sw-metric-bar-fill{height:100%;width:0;border-radius:4px;transition:width .9s cubic-bezier(.16,.8,.24,1) .1s;will-change:width}' +
            // === Audience box ===
            '.sw-audience-box{position:relative;background:#1e2226;border:1px solid rgba(255,255,255,.06);border-radius:12px;padding:16px 18px;box-shadow:0 4px 12px rgba(0,0,0,.2);margin-top:4px;overflow:hidden}' +
            '.sw-audience-title{font-family:var(--sw-mono);font-size:.95em;font-weight:700;text-transform:lowercase;color:#fff;letter-spacing:.02em;margin:0 0 12px}' +
            '.sw-audience-title.second{margin-top:18px}' +
            '.sw-aud-line{display:flex;align-items:flex-start;gap:10px;font-family:var(--sw-mono);font-weight:700;font-size:.9em;line-height:1.45;margin:0;text-transform:lowercase}' +
            '.sw-aud-line.yes{color:#4CAF50}' +
            '.sw-aud-line.no{color:#EF5350}' +
            '.sw-aud-arrow{width:1.1em;height:1.1em;flex:0 0 auto;margin-top:.12em}' +
            '.sw-focusable{outline:none;cursor:pointer}' +
            '@media(max-width:680px){.sw-columns{grid-template-columns:1fr}.sw-metrics-grid{grid-template-columns:1fr}.sw-verdict-word{font-size:1.8em}.sw-dice-label{font-size:1.2em}.sw-dice{width:38px;height:38px;margin-top:-19px;left:12px}.sw-dossier{padding:18px 14px 14px}}';
        s.innerHTML +=
            '.sw-wrap{--sw-green:#74d79a;--sw-red:#f1787b;--sw-orange:#f3bd68;--sw-ink:#f2f4f6;--sw-mut:#aeb5be;padding:12px 10px 32px;max-width:100%;line-height:1.45}' +
            '.sw-dossier{background:linear-gradient(135deg,#242b31,#1d2227);border:1px solid rgba(255,255,255,.11);border-radius:18px;padding:22px;box-shadow:0 8px 20px rgba(0,0,0,.16)}' +
            '.sw-verdict-word{font-size:clamp(1.5em,4vw,2.2em);letter-spacing:.015em;overflow-wrap:anywhere;margin-bottom:12px}' +
            '.sw-why{font-size:.71em;color:#bec8d0;line-height:1.45;margin-top:13px}' +
            '.sw-scale{display:flex;justify-content:space-between;color:#88939d;font-size:.61em;margin-top:6px}' +
            '.sw-col{border-radius:14px;background:rgba(255,255,255,.025);box-shadow:none;border:1px solid rgba(255,255,255,.07);padding:16px}' +
            '.sw-col.pros{border-left:3px solid var(--sw-green)}.sw-col.cons{border-left:3px solid var(--sw-red)}' +
            '.sw-col-title{font-size:.9em;font-weight:700;margin-bottom:12px;color:#f3f5f6}' +
            '.sw-list{font-size:.86em;line-height:1.45}.sw-list li{margin-bottom:10px}' +
            '.sw-tabs{gap:10px}.sw-tab-btn{font-family:' + FONT + ';font-size:.88em;border-radius:12px;min-height:50px}' +
            '.sw-tab-btn.active{border-color:rgba(255,255,255,.25)}.sw-tab-btn.focus,.sw-dicebtn.focus{box-shadow:0 0 0 2px #f2f3f4,0 4px 14px rgba(0,0,0,.24)}' +
            '.sw-dicebtn{height:64px;margin-bottom:6px;border-radius:13px;box-shadow:none}.sw-dice-label{font-family:' + FONT + ';font-size:1.1em}' +
            '.sw-dice-hint{font-size:.68em;text-align:center;color:#99a5ae;margin:0 0 18px}' +
            '.sw-note{font-size:.72em;line-height:1.4;color:#aeb7bf;margin:0 0 12px}' +
            '.sw-error{padding:45px 20px;text-align:center;color:#ef9e9e}' +
            '.sw-metric-card,.sw-audience-box{box-shadow:none;background:rgba(255,255,255,.025)}' +
            '.sw-metric-score.hi,.sw-metric-score.mid,.sw-metric-score.ok{color:#f0f2f4}' +
            '.sw-body{animation:swPaneIn .28s cubic-bezier(.2,.7,.2,1)}' +
            '.sw-list li,.sw-metric-card{will-change:auto;transition-duration:.27s}' +
            '.sw-verdict-word,.sw-meter-fill,.sw-dice-core{will-change:auto}' +
            '.sw-dicebtn:not(.sw-rolling) .sw-dice{animation:none}' +
            '@media(max-width:600px){.sw-wrap{padding:10px 4px 30px}.sw-columns,.sw-metrics-grid{grid-template-columns:1fr}.sw-dossier{padding:17px}.sw-tab-btn{font-size:.78em}.sw-dice-label{font-size:.95em}}' +
            '@media(prefers-reduced-motion:reduce){.sw-wrap *, .sw-wrap *::before,.sw-wrap *::after{animation:none!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}';
        document.head.appendChild(s);
    }

    var escMap = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    function esc(s) { if (typeof s !== 'string') return ''; return s.replace(/[&<>"']/g, function(m){ return escMap[m]; }); }
    function hasGenre(g, re) { return g.some(function(x){ return re.test((x || '').toLowerCase()); }); }
    function inText(s, re) { return re.test((s || '').toLowerCase()); }
    function inAnyText(texts, re) { return texts.some(function(s){ return inText(s, re); }); }
    function mediaType(m) { return (m && (m.media_type === 'tv' || m.first_air_date || m.number_of_seasons || (m.name && !m.title))) ? 'tv' : 'movie'; }
    function uniq(arr) { return arr.filter(function(v,i,s){ return s.indexOf(v) === i; }); }
    function fmtN(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }

    function sanitizeMovie(movie) {
        if (!movie || typeof movie !== 'object') return { title: 'Неизвестный фильм' };
        if (!movie.id && !movie.tmdb_id && !movie.title && !movie.name) return { title: 'Неизвестный фильм' };
        return movie;
    }

    function modalScroll() {
        try { if (window.Lampa && Lampa.Modal && typeof Lampa.Modal.scroll === 'function') return Lampa.Modal.scroll(); } catch(e) {}
        return null;
    }

    function findScrollParent() {
        try {
            var root = (window._sw_currentModalHtml && window._sw_currentModalHtml.length) ? window._sw_currentModalHtml[0] : null;
            if (!root) return null;
            var fallback = null;
            var p = root.parentElement;
            while (p && p !== document.documentElement) {
                var cs = window.getComputedStyle(p);
                var oy = cs.overflowY;
                if (oy === 'scroll' || oy === 'auto' || oy === 'overlay') {
                    if (p.scrollHeight > p.clientHeight + 4) return p;
                    if (!fallback) fallback = p;
                } else if (!fallback && oy !== 'visible' && p.scrollHeight > p.clientHeight + 8) {
                    fallback = p;
                }
                p = p.parentElement;
            }
            return fallback;
        } catch(e) { return null; }
    }

    function scrollModalBy(dir) {
        var sc = modalScroll();
        if (sc && typeof sc.wheel === 'function') {
            var size = Math.max(140, Math.round((window.innerHeight || 360) * 0.4));
            try {
                sc.wheel(dir * size);
                return;
            } catch(e) {}
        }
        var el = findScrollParent();
        if (!el) return;
        var step = Math.max(140, Math.round((el.clientHeight || 360) * 0.4));
        var max = Math.max(0, el.scrollHeight - el.clientHeight);
        var next = el.scrollTop + dir * step;
        el.scrollTop = Math.max(0, Math.min(max, next));
    }

    function interactiveSet() {
        var h = window._sw_currentModalHtml;
        if (!h || !h.length) return $();
        return h.find('.sw-focusable:not(.sw-disabled)').filter(':visible');
    }

    function swScrollToFocus(targetEl) {
        if (!targetEl || !targetEl.length) return;
        try {
            var sc = modalScroll();
            if (sc && typeof sc.update === 'function') {
                sc.update(targetEl, true);
                return;
            }
        } catch(e) {}
        try {
            var el = targetEl[0];
            if (el && typeof el.scrollIntoView === 'function') {
                el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        } catch(e) {}
    }

    function focusRing(el, doScroll) {
        var h = window._sw_currentModalHtml;
        if (!h || !el || !el.length) return;
        h.find('.sw-focusable').removeClass('focus');
        el.addClass('focus');
        window._sw_activeInteractive = el[0];
        if (doScroll !== false) {
            swScrollToFocus(el);
        }
    }

    function moveFocus(dir) {
        var set = interactiveSet();
        if (!set.length) return;
        var idx = -1;
        if (window._sw_activeInteractive) {
            idx = set.index(window._sw_activeInteractive);
        }
        if (idx < 0) {
            idx = (dir > 0) ? 0 : set.length - 1;
        } else {
            idx += dir;
            if (idx < 0) idx = set.length - 1;
            if (idx >= set.length) idx = 0;
        }
        focusRing(set.eq(idx), true);
    }

    function triggerActiveAction() {
        if (!window._sw_activeInteractive) return;
        var el = $(window._sw_activeInteractive);
        if (el.length) {
            el.trigger('click');
        }
    }

    function registerController() {
        if (!window.Lampa || !Lampa.Controller) return;
        Lampa.Controller.add(CONTROLLER_ID, {
            toggle: function () {
                var set = interactiveSet();
                if (set.length) {
                    focusRing(set.first(), false);
                }
            },
            up: function () { scrollModalBy(-1); },
            down: function () { scrollModalBy(1); },
            left: function () { moveFocus(-1); },
            right: function () { moveFocus(1); },
            enter: function () { triggerActiveAction(); },
            ok: function () { triggerActiveAction(); }, // Lampa TV builds may dispatch ok, not enter
            back: function () { doClose(); }
        });
    }

    function restorePrevController() {
        try {
            if (window.Lampa && Lampa.Controller) {
                var target = window._sw_prevController || 'full';
                Lampa.Controller.toggle(target);
                if (window._sw_triggerElement && window._sw_triggerElement.length) {
                    try {
                        $('.full-start__button, .selector').removeClass('focus');
                        window._sw_triggerElement.addClass('focus');
                    } catch(e) {}
                }
            }
        } catch(e) { console.error('[SW] restorePrevController:', e); }
    }

    function genreByIdOrName(genresRaw, ids, nameRe) {
        if (!genresRaw || !genresRaw.length) return false;
        for (var i = 0; i < genresRaw.length; i++) {
            var g = genresRaw[i];
            if (g && typeof g === 'object') {
                if (g.id && ids.indexOf(Number(g.id)) >= 0) return true;
                if (nameRe.test((g.name || '').toLowerCase())) return true;
            } else if (typeof g === 'string') {
                if (nameRe.test(g.toLowerCase())) return true;
            }
        }
        return false;
    }

    function loadCredits(movie) {
        try {
            if (movie.credits && ((movie.credits.cast && movie.credits.cast.length) ||
                (movie.credits.crew && movie.credits.crew.length))) {
                return Promise.resolve(movie.credits);
            }
            var id = movie.id || movie.tmdb_id;
            if (!id || !window.Lampa || !Lampa.TMDB || typeof Lampa.TMDB.credits !== 'function') {
                return Promise.resolve(null);
            }
            return new Promise(function(resolve){
                var settled = false, timer = setTimeout(function(){ done(null); }, 7000);
                function done(result) {
                    if (settled) return;
                    settled = true; clearTimeout(timer);
                    resolve(result && !result.status_code ? result : null);
                }
                try { Lampa.TMDB.credits(id, done, function(){ done(null); }); }
                catch(e) { done(null); }
            });
        } catch(e) { return Promise.resolve(null); }
    }

    function tmdbKey() {
        try { if (window.Lampa && Lampa.TMDB && Lampa.TMDB.key) return Lampa.TMDB.key; } catch(e) {}
        return '4ef0d7355d9ffb5151e987764708ce96';
    }

    function curLangCode() {
        try {
            var l = (window.Lampa && Lampa.Storage) ? Lampa.Storage.get('language', 'ru') : 'ru';
            return (l || 'ru') + '-' + (l || 'ru').toUpperCase();
        } catch(e) { return 'ru-RU'; }
    }

    function tmdbGet(path, lang) {
        return new Promise(function(resolve) {
            var complete = false;
            var timer = setTimeout(function(){ finish(null); }, 7000);
            function finish(data) {
                if (complete) return;
                complete = true;
                clearTimeout(timer);
                resolve(data && !data.status_code ? data : null);
            }
            try {
                var langCode = lang || curLangCode();
                var url = 'https://api.themoviedb.org/3' + path +
                    (path.indexOf('?') > -1 ? '&' : '?') +
                    'language=' + encodeURIComponent(langCode) +
                    '&api_key=' + encodeURIComponent(tmdbKey());
                if (window.Lampa && Lampa.Request && typeof Lampa.Request.get === 'function') {
                    Lampa.Request.get(url, finish, function(){ finish(null); }, { dataType: 'json' });
                } else if (typeof fetch === 'function') {
                    fetch(url).then(function(response){
                        return response.ok ? response.json() : null;
                    }).then(finish).catch(function(){ finish(null); });
                } else finish(null);
            } catch(e) { finish(null); }
        });
    }

    function mapUSRating(s) {
        return { 'G':0,'PG':7,'PG-13':13,'R':17,'NC-17':17,'TV-MA':17,'TV-14':14,'TV-PG':7,'TV-G':0,'TV-Y7':7,'TV-Y':0,'MA':17,'18':18,'16':16,'12':12,'12A':12,'15':15 }[(s || '').toUpperCase().trim()] || null;
    }

    function loadMeta(movie) {
        var id = movie.id || movie.tmdb_id;
        var empty = { kw: [], age: null, reviews: [], hasTrailer: false,
            enOv: '', popularity: 0, details: null };
        if (!id) return Promise.resolve(empty);
        var type = mediaType(movie), cacheKey = type + ':' + id;
        if (_metaCache[cacheKey]) return Promise.resolve(_metaCache[cacheKey]);
        if (Object.keys(_metaCache).length > 120) _metaCache = {};
        // TMDB append_to_response makes 2 HTTP requests instead of 6.
        // EN data supplies reviews and trailers which are frequently absent in RU.
        var ratingPart = type === 'tv' ? 'content_ratings' : 'release_dates';
        var pending = Promise.all([
            tmdbGet('/' + type + '/' + id +
                '?append_to_response=keywords,credits,' + ratingPart),
            tmdbGet('/' + type + '/' + id +
                '?append_to_response=reviews,videos', 'en-US')
        ]).then(function(arr) {
            var main = arr[0] || {}, en = arr[1] || {};
            var keys = main.keywords || en.keywords || {};
            var kw = (keys.keywords || keys.results || []).map(function(x){
                return x && x.name ? x.name.toLowerCase() : '';
            }).filter(Boolean);
            var age = null, certificates = main[ratingPart];
            if (certificates && certificates.results) {
                function cert(region) {
                    if (!region) return null;
                    if (type === 'tv') return region.rating || null;
                    var dates = region.release_dates || [];
                    for (var k = 0; k < dates.length; k++) {
                        if (dates[k].certification) return dates[k].certification;
                    }
                    return null;
                }
                var ru = certificates.results.filter(function(x){ return x.iso_3166_1 === 'RU'; })[0];
                var us = certificates.results.filter(function(x){ return x.iso_3166_1 === 'US'; })[0];
                var ruCert = cert(ru), usCert = cert(us);
                if (ruCert) {
                    var n = parseInt(ruCert, 10);
                    if (isFinite(n) && n >= 0 && n <= 21) age = n;
                }
                if (age === null && usCert) age = mapUSRating(usCert);
            }
            var reviewItems = (en.reviews && en.reviews.results) ||
                (main.reviews && main.reviews.results) || [];
            var reviews = reviewItems.slice(0, 6).map(function(r){
                return { author: r.author || 'Аноним',
                    text: (r.content || '').replace(/<[^>]+>/g,'').trim() };
            }).filter(function(r){ return r.text.length > 20; });
            var videos = (en.videos && en.videos.results) ||
                (main.videos && main.videos.results) || [];
            var r = { kw: kw, age: age, reviews: reviews,
                hasTrailer: videos.some(function(v){
                    return v.type === 'Trailer' && v.site === 'YouTube';
                }),
                enOv: en.overview || '', popularity: main.popularity || en.popularity || 0,
                details: arr[0] || arr[1] || null };
            // Transient network errors shouldn't poison subsequent attempts.
            if (arr[0] || arr[1]) _metaCache[cacheKey] = r;
            else delete _metaCache[cacheKey];
            return r;
        }).catch(function(){
            delete _metaCache[cacheKey];
            return empty;
        });
        _metaCache[cacheKey] = pending;
        return pending;
    }

    function hasKw(ctx, re) { return ctx.kw.some(function(k){ return re.test(k); }); }

    function reviewStats(reviews) {
        var posRe = /шедевр|великолепн|потрясающ|восхитит|блестящ|лучш|мощн|гениальн|masterpiece|brilliant|amazing|great|best|loved|perfect|outstanding|must-watch|замечательн|превосходн|отличн|весел|смешн|funny|понрав|советую|хорош|восторг|класс|рекомендую|отпад|fire|awesome|fantastic|superb|excellent/i;
        var negRe = /скучн|ужасн|провал|разочаров|слаб|затян|бессмысл|плох|boring|bad|worst|terrible|awful|disappoint|waste|dull|pointless|утомительн|неинтересн|отвратительн|глуп|слабеньк|shallow|mediocre|overrated|разочаровал|не рекомендую|уныл/i;
        var pos = 0, neg = 0;
        reviews.forEach(function(r){
            var t = r.text.toLowerCase();
            var p = (t.match(posRe) || []).length, n = (t.match(negRe) || []).length;
            if (p > n) pos++; else if (n > p) neg++;
        });
        var tone = (pos === 0 && neg === 0) ? null : (pos > neg ? 'pos' : (neg > pos ? 'neg' : 'mix'));
        return { total: reviews.length, pos: pos, neg: neg, tone: tone };
    }

    function readDomSignals(key) {
        // Never scrape body.innerText: it can contain other films, reviews and age labels.
        // Only reliable per-title API data may influence the recommendation.
        return { mm: {}, moods: [], ok: false, age: null, reviews: [] };
    }

    function lampaLocal(movie) {
        var out = { inFavorite: false, favList: null, viewedPercent: 0 };
        try {
            var id = movie.id || movie.tmdb_id || (movie.movie && (movie.movie.id || movie.movie.tmdb_id));
            if (!id) return out;
            var sid = String(id);
            if (window.Lampa && Lampa.Favorite && typeof Lampa.Favorite.list === 'function') {
                ['scheduled','later','viewed'].forEach(function(n){
                    if (out.inFavorite) return;
                    try {
                        var l = Lampa.Favorite.list(n);
                        if (Object.prototype.toString.call(l) === '[object Array]') {
                            for (var i = 0; i < l.length; i++) {
                                var x = l[i];
                                if (x && String(x.id || x.tmdb_id || '') === sid) { out.inFavorite = true; out.favList = n; break; }
                            }
                        }
                    } catch(e) {}
                });
            }
            if (window.Lampa && Lampa.Timeline && typeof Lampa.Timeline.get === 'function') {
                try {
                    var t = Lampa.Timeline.get(sid);
                    if (!t && !isNaN(Number(sid))) t = Lampa.Timeline.get(Number(sid));
                    if (t) {
                        if (t.duration > 0 && t.time >= 0) out.viewedPercent = Math.min(100, Math.round(100 * t.time / t.duration));
                        else if (typeof t.percent === 'number' && t.percent >= 0) out.viewedPercent = Math.min(100, Math.round(t.percent));
                    }
                } catch(e) {}
            }
        } catch(e) {}
        return out;
    }

    function findSparkle(meta, credits) {
        var sparks = [];
        var texts = [meta.enOv || ''].concat(meta.kw || []);
        INTERESTING_TAGS.forEach(function(t){
            if (texts.some(function(txt){ return t.re.test(txt || ''); })) sparks.push(t.text);
        });
        if (credits && credits.crew) {
            var dirs = credits.crew.filter(function(c){ return c.job === 'Director'; });
            if (dirs.length === 1 && dirs[0].name) sparks.push('🎬 Режиссёр: ' + dirs[0].name);
        }
        return sparks.slice(0, 2);
    }

    function findFeatures(meta) {
        var feats = [];
        var texts = [meta.enOv || ''].concat(meta.kw || []);
        FEATURES.forEach(function(f){
            if (texts.some(function(txt){ return f.re.test(txt || ''); })) feats.push(f.text);
        });
        return feats.slice(0, 3);
    }

    function analyze(rawMovie) {
        var movie = sanitizeMovie(rawMovie);
        return Promise.all([loadMeta(movie), Promise.resolve(lampaLocal(movie))]).then(function(arr){
            var meta = arr[0], local = arr[1];
            var credits = movie.credits || (meta.details && meta.details.credits) || null;
            var cfg = getSettings();
            var blG = parseBL(cfg.bad_genres), blA = parseBL(cfg.bad_actors), blD = parseBL(cfg.bad_directors);
            var now = new Date().getFullYear();
            var q = (movie.quality || movie.source_quality || '').toString().toUpperCase();
            var rating = Number(movie.vote_average || 0), votes = Number(movie.vote_count || 0);
            if (!isFinite(rating) || rating < 0 || rating > 10) rating = 0;
            if (!isFinite(votes) || votes < 0) votes = 0;
            if (!votes && meta.details && meta.details.vote_count) {
                votes = Number(meta.details.vote_count) || 0;
                rating = Number(meta.details.vote_average) || rating;
            }
            var runtime = parseInt(movie.runtime, 10) || 0;
            var genresRaw = (movie.genres && movie.genres.length ? movie.genres : (meta.details && meta.details.genres) || []);
            var genres = genresRaw.map(function(g){ return typeof g === 'string' ? g : (g && g.name) || ''; }).filter(Boolean);
            var ovRu = (movie.overview || (meta.details && meta.details.overview) || '').trim(), ovEn = (meta.enOv || '').trim(), ovBoth = [ovRu, ovEn];
            var firstDate = movie.release_date || movie.first_air_date || (meta.details && (meta.details.release_date || meta.details.first_air_date)) || '';
            var yr = firstDate ? parseInt(String(firstDate).substring(0,4),10) : 0;
            var dom = readDomSignals(movie.id || movie.tmdb_id || 'x');
            var mm = dom.ok ? dom.mm : {}, moods = dom.ok ? dom.moods : [];
            var domRevs = dom.reviews || [];
            var allRev = meta.reviews.concat(domRevs);
            var rt = reviewStats(allRev);
            var who = domRevs.length ? 'Комментаторы' : 'Зрители';
            var ctx = { kw: meta.kw };
            var M = 150, C = 6.1;
            var adj = votes > 0 ? ((votes * rating) + (M * C)) / (votes + M) : 0;
            var cast = (credits && credits.cast || []).slice(0, 15).map(function(c){ return c.name; }).filter(Boolean);
            var crew = credits && credits.crew || [];
            var dirs = crew.filter(function(c){ return c.job === 'Director'; }).map(function(c){ return c.name; }).filter(Boolean);
            var wrts = crew.filter(function(c){ return ['Writer','Screenplay','Story','Author'].indexOf(c.job) >= 0; }).map(function(c){ return c.name; }).filter(Boolean);
            var isAnim = genreByIdOrName(genresRaw, [GENRE_ID_ANIM], /animation|анимац|мульт|anime|аниме/);
            var hasFamilyGenre = genreByIdOrName(genresRaw, [GENRE_ID_FAMILY, GENRE_ID_KIDS], /family|семейн|kids|детск/);
            var kidsKw = hasKw(ctx, /for kids|children|family-friendly|детям|семейн|для детей|preschool|toddler|baby|nursery|cartoon for kids|kids tv|educational|animated series|дошкольн|малыш/i);

            var age = meta.age;

            function dim(kwRe, ovRe) {
                var k = hasKw(ctx, kwRe);
                var o = !!ovRe && inAnyText(ovBoth, ovRe);
                return { k: k, o: o };
            }

            var dViol = dim(/violenc|violent|gore|murder|blood|tortur|brutal|weapon|massacre|execution|stab|slaughter|gunfight|shootout|hitman|serial killer|battle/, /убийств|насил|жесток|кровь|крови|кровью|кровав|кровопролит|стрельб|перестрел|взрыв|оружи|резн|террор|бойн/);
            var dDrugs = dim(/drug|meth lab|methamphetamine|crystal meth|cocaine|heroin|marijuan|cannabis|narcotic|addiction|overdose|dealer|cartel|crack|lsd|ecstasy|opium/, /метамфетам|амфетам|наркот|кокаин|героин|марихуан|лсд|экстази|опиум|дилер|картел|зависимост/);
            var dNud = dim(/nudity|topless|strip club|stripper|full frontal|rear nudity/, /обнаж|нагот|голы|стриптиз/);
            var dSex = dim(/sex scene|sexual content|orgy|prostitut|erotic|one night stand|hooker|threesome|explicit/, /эротик|откровенн|проститут|интим|секс|постельн|презерватив/);
            var dSmoke = dim(/smoking|cigarette|cigar/, /курени|сигарет|табак/);
            var dAlc = dim(/alcohol|drunkenness|drunk|booze|hangover|beer|wine|vodka|whiskey/, /алкогол|водк|виски|выпив|пьян|похмел/);
            var dProf = dim(/profanity|strong language|swearing|f word|vulgarity/, /нецензур|сквернослов|матерщин/);
            var dSuic = dim(/suicide|self harm|suicidal/, /суицид|самоубийств|покончи/);
            var dGamb = dim(/gambl|casino|poker|betting|bookmaker|lottery|roulette|slot machine|blackjack/, /азарт|казино|ставк|покер|рулетк|лотере|букмекер/);
            var dCrime = dim(/criminal|crime|heist|robbery|mafia|gangster|prison|police|detective|thief|outlaw|cartel|drug lord|dea agent/, /криминал|преступ|грабеж|ограб|мафи|банд|тюрьм|полици|следовател|мошенник|контрабанд|крад|похищ|вору/);
            var dPsych = dim(/psychopath|sociopath|serial killer|paranoia|mental illness|schizophren|disturbing|psychological/, /психопат|социопат|маньяк|параной|безуми|шизофрен|психологическ/);
            var dIll = dim(/terminal illness|cancer|chemotherapy|leukemia|leukaemia|tumor|tumour|alzheimer|parkinson|aids|brain tumor|lung cancer|incurable/, /онколог|злокачествен|химиотерап|лейкеми|неизлечим|терминальн|альцгеймер|паркинсон|рак лёгких|рак мозга|опухол/);
            var dWar = dim(/war|vietnam|world war|soldier|combat|army/, /военн|фрон|солдат|арми|боев|войск/);
            var dChild = dim(/child abuse|abused child|child neglect|cruelty to children|child cruelty|abusive parent|child violence|pedophile|pedophilia/, /насилие над детьми|жестокое обращение с детьми|издевается над детьми|избивает детей|абьюз детей|педофил/);
            var dDarkCom = hasKw(ctx, /dark comed|black comed|satire|parody|absurd/) || inAnyText(ovBoth, /черн юмор|сатир|пароди|абсурд/);

            if (age !== null && age <= 12) { dSex.o = false; dNud.o = false; }

            var gHorror = hasGenre(genres, /horror|ужас|slasher/i);
            var gWar = hasGenre(genres, /war|военн/i);
            var gCrime = hasGenre(genres, /crime|криминал/i);
            var gThr = hasGenre(genres, /thriller|триллер/i);

            // === Улучшенные веса для проблемных тем ===
            var cViol = (dViol.k?50:0)+(dViol.o?30:0)+((mm.violence||0)>=6?40:((mm.violence||0)>=4?20:0))+(gHorror||gWar?20:(gCrime&&gThr?15:0))+(age!==null&&age>=18?15:(age!==null&&age>=16?10:0));
            var cDrugs = (dDrugs.k?70:0)+(dDrugs.o?40:0)+(gCrime?15:0)+(age!==null&&age>=16?10:0);
            var cSex = (dSex.k?50:0)+(dNud.k?40:0)+(dSex.o?30:0)+(dNud.o?30:0)+(age!==null&&age>=18?15:0);
            var cProf = (dProf.k?50:0)+(dProf.o?30:0)+((mm.language||0)>=5?40:((mm.language||0)>=3?20:0))+(age!==null&&age>=18?10:0);
            var cFear = (gHorror?50:0)+(hasKw(ctx,/horror|scary|haunted|possess|demon|jump scare|ghost/)?30:0)+((mm.fear||0)>=6?40:((mm.fear||0)>=4?20:0))+(gThr?10:0)+(dPsych.k?10:0);
            var cSuic = (dSuic.k?50:0)+(dSuic.o?30:0)+(dIll.k?10:0);
            var cAlc = (dAlc.k?40:0)+(dAlc.o?30:0);
            var cSmoke = (dSmoke.k?40:0)+(dSmoke.o?30:0);
            var cGamb = (dGamb.k?50:0)+(dGamb.o?30:0);
            var cCrime = (dCrime.k?35:0)+(dCrime.o?25:0)+(gCrime?35:0)+(age!==null&&age>=16?15:0);
            var cChild = (dChild.k?60:0)+(dChild.o?40:0);

            var hardAdult = cViol >= 50 || cDrugs >= 30 || cSex >= 30 || cChild >= 50 || !!movie.adult;
            var familyOK;
            if (isAnim) {
                if (age !== null && age <= 6) familyOK = !hardAdult;
                else if (age !== null && age <= 12) familyOK = !hardAdult && cSuic < 40 && cFear < 40 && cViol < 30;
                else if (age !== null && age >= 16) familyOK = false;
                else familyOK = !hardAdult && cSuic < 40 && cProf < 40 && (hasFamilyGenre || kidsKw);
            } else {
                familyOK = !hardAdult && cFear < 40 && cSuic < 40 && rating >= 5 && ((age !== null && age <= 12) || hasFamilyGenre || kidsKw);
            }

            var mG = genres.filter(function(g){ return blG.some(function(b){ return g.toLowerCase().indexOf(b) >= 0; }); });
            var mA = cast.filter(function(a){ return blA.some(function(b){ return a.toLowerCase().indexOf(b) >= 0; }); });
            var mD = [].concat(dirs, wrts).filter(function(p){ return blD.some(function(b){ return p.toLowerCase().indexOf(b) >= 0; }); });

            var F = [], usedG = {};
            function add(src, kind, text, w, group) {
                if (group) { if (usedG[group]) return; usedG[group] = 1; }
                F.push({ src: src, kind: kind, text: text, w: w });
            }

            findSparkle(meta, credits).forEach(function(s){ add('sparkle','pro',s,25); });
            findFeatures(meta).forEach(function(t,i){ add('sparkle','pro',t,10,'feat'+i); });

            if (meta.popularity > 100) add('card','pro','🔥 Очень популярно', 15, 'popular');
            else if (meta.popularity > 30) add('card','pro','📈 Популярно', 8, 'popular');

            if (votes >= 3000 && adj >= 8.0) add('card','pro','✨ Высокий рейтинг: ' + rating.toFixed(1) + ' (' + fmtN(votes) + ' голосов)', 30, 'ratehi');
            else if (votes >= 500 && adj >= cfg.min_rating) add('card','pro','✨ Хороший рейтинг: ' + rating.toFixed(1) + ' (' + fmtN(votes) + ' голосов)', 20, 'ratehi');
            else if (votes >= 100 && adj >= cfg.min_rating) add('card','pro','✨ Достойный рейтинг: ' + rating.toFixed(1) + ' (' + fmtN(votes) + ' голосов)', 14, 'ratehi');
            if (votes >= 100 && votes < 1500 && adj >= 7.6) add('card','pro','🔍 Высоко оценённый малоизвестный фильм', 12);
            if (votes >= 2000 && adj >= 7.8 && yr > 0 && yr <= now - 5) add('card','pro','🏛 Культурное признание', 12);
            if (yr === now) add('card','pro','🆕 Новинка ' + yr + ' года', 6, 'fresh');
            if (votes > 0 && votes < 100) add('card','con','❓ Мало оценок (' + votes + ')', 14, 'rateunc');
            if (votes === 0) add('card','con','⚠️ Нет оценок', 16, 'rateunc');
            if (votes >= 100 && adj < cfg.min_rating) add('card','con','📉 Рейтинг ниже порога: ' + rating.toFixed(1), 22, 'ratelow');
            else if (votes >= 50 && rating > 0 && rating < 5) add('card','con','📉 Низкий рейтинг: ' + rating.toFixed(1), 26, 'ratelow');
            if (runtime > 0 && runtime <= 95 && mediaType(movie) === 'movie') add('card','pro','⏱ Небольшой хронометраж: ' + runtime + ' мин', 7, 'runtime');
            else if (runtime > 150) add('card','con','⌛ Долгий хронометраж: ' + runtime + ' мин', 12, 'runtime');
            if (/CAM|TS|HDCAM|HDRIP|TELECINE|SCR|WORKPRINT|TELESYNC/i.test(q)) add('card','con','📺 Экранная копия / низкое качество', 26, 'quality');
            else if (/4K|UHD|2160p/i.test(q)) add('card','pro','🎥 Доступно в 4K UHD', 10, 'quality');
            else if (q) add('card','pro','🎥 Высокое качество (' + q + ')', 7, 'quality');

            if (mG.length) add('user','con','⛔ Нелюбимые жанры: ' + mG.join(', '), 40);
            if (mA.length) add('user','con','⛔ Нелюбимые актёры: ' + uniq(mA).slice(0,2).join(', '), 35);
            if (mD.length) add('user','con','⛔ Нелюбимые авторы: ' + uniq(mD).slice(0,2).join(', '), 35);

            if (familyOK && isAnim) add('tmdb','pro','🧸 Детский' + (age !== null ? ' (' + age + '+)' : ''), 16, 'family');
            else if (familyOK) add('tmdb','pro','👨‍👩‍👧 Семейный фильм' + (age !== null ? ' (' + age + '+)' : ''), 16, 'family');
            if (age !== null && age >= 18) add('tmdb','con','🔞 Возрастное ограничение 18+', 14, 'age');
            else if (age !== null && age >= 16) add('tmdb','con','🔞 Возрастное ограничение 16+', 12, 'age');
            if (isAnim && !familyOK && (age !== null && age >= 16 || hardAdult)) add('tmdb','con','🎭 Взрослая анимация' + (age !== null ? ' (' + age + '+)' : ''), 14, 'adultanim');

            if (cViol >= 50) add('tmdb','con','⚠️ Возможное насилие/жестокость', 16, 'violence');
            if (cDrugs >= 30) add('tmdb','con','💉 Упоминание веществ/наркотиков', 14, 'drugs');
            if (cSex >= 30) add('tmdb','con','⚠️ Темы сексуального характера', 12, 'sex');
            if (cProf >= 40) add('tmdb','con','🤬 Ненормативная лексика', 10, 'lang');
            if (cFear >= 40) add('moods','con','😱 Хоррор / страшные темы', 14, 'scare');
            else if ((mm.fear||0) >= 3.5) add('moods','pro','😬 Напряжённый сюжет', 9, 'tension');
            if (cSuic >= 40) add('tmdb','con','⚠️ Тяжёлые темы / суицид', 16, 'suic');
            if (cAlc >= 40) add('tmdb','con','🍺 Сцены алкоголя/опьянения', 6, 'alc');
            if (cSmoke >= 40) add('tmdb','con','🚬 Сцены курения', 5, 'smoke');
            if (cGamb >= 40) add('tmdb','con','🎰 Азартные игры', 10, 'gamb');
            if (cCrime >= 50) add('tmdb','pro','🕵️ Криминальный сюжет', 8, 'crime');
            if (dPsych.k || dPsych.o) add('tmdb','con','🧠 Психологическое давление', 8, 'psych');
            if (dIll.k || dIll.o) add('tmdb','con','🏥 Тема неизлечимой болезни', 6, 'ill');
            if (dWar.k || dWar.o) add('tmdb','con','🎖 Военные действия', 8, 'war');
            if (cChild >= 50) add('tmdb','con','🚸 Жестокость к детям', 18, 'childabuse');
            if (dDarkCom) add('tmdb','pro','🖤 Чёрный юмор и сатира', 8, 'darkcom');
            if (meta.hasTrailer) add('tmdb','pro','▶ Есть официальный трейлер', 5);
            if (hasGenre(genres, /documentary|документ/i)) add('tmdb','pro','🦉 Документальное кино', 8);

            if (mm.pace >= 6.5) add('moods','pro','⚡ Высокий темп и динамика', 12);
            else if (mm.pace > 0 && mm.pace <= 2.5 && runtime > 120) add('moods','con','🐢 Очень размеренный темп', 8);
            if (mm.action >= 6) add('moods','pro','💥 Насыщенный экшен', 12);
            if (mm.sadness >= 6) add('moods','pro','😢 Трогательный и эмоциональный', 10, 'sad');
            moods.forEach(function(md){
                var n = (md.name || '').toLowerCase();
                if (/вес[её]л|комедий|юмор/.test(n) && md.pct >= 20) add('moods','pro','😂 Развеселит', 14, 'fun');
                else if (/напряжен/.test(n) && md.pct >= 30) add('moods','pro','🔥 Напряжённый', 8, 'tension');
                else if (/тревож/.test(n) && md.pct >= 40) add('moods','pro','😰 Тревожная интрига', 6, 'anxiety');
                else if (/задумчив|драматич/.test(n) && md.pct >= 25) add('moods','pro','🎭 Глубокий смысл', 8);
                else if (/романтич/.test(n) && md.pct >= 18) add('moods','pro','❤️ Романтичное настроение', 8);
                else if (/загадоч/.test(n) && md.pct >= 15) add('moods','pro','🕵️ Интригующая тайна', 8);
                else if (/ностальг/.test(n) && md.pct >= 8) add('moods','pro','🕰 Ностальгический вайб', 6);
                else if (/груст/.test(n) && md.pct >= 20) add('moods','con','😔 Не для ранимых', 6, 'sad');
            });
            if (hasGenre(genres, /comedy|комедия/i) && (mm.sadness || 0) <= 3) add('moods','pro','😂 Комедийный жанр', 10, 'fun');

            if (rt.total >= 4 && rt.pos >= 3 && rt.tone === 'pos') add('reviews','pro','💬 ' + who + ' в восторге', 20, 'rev');
            else if (rt.total >= 4 && rt.neg >= 3 && rt.tone === 'neg') add('reviews','con','💬 ' + who + ' раскритиковали', 22, 'rev');
            else if (rt.total >= 4 && rt.pos >= 2 && rt.neg >= 2 && rt.tone === 'mix') add('reviews','pro','💬 Мнения разделились', 10, 'rev');

            if (local.inFavorite && local.favList === 'viewed') add('lampa','con','👁 Уже просмотрено вами', 8, 'lampa');
            else if (local.inFavorite) add('lampa','pro','🔖 Сохранено в закладках', 8, 'lampa');
            if (local.viewedPercent >= 90) add('lampa','con','👁 Досмотрено до конца (' + local.viewedPercent + '%)', 8, 'lampa');
            else if (local.viewedPercent >= 10) add('lampa','con','⏸ Приостановлено на ' + local.viewedPercent + '%', 12, 'lampa');

            // Objective clues (4K, trailers, runtime, keywords, bookmarks)
            // may enrich the explanation but must not dictate whether to watch.
            var ratingConf = votes ? Math.min(1, Math.log(1 + votes) / Math.log(1501)) : 0;
            var baseScore = votes ? (adj - cfg.min_rating) * 30 * ratingConf : 0;
            var reviewScore = rt.total >= 4 && Math.abs(rt.pos - rt.neg) >= 3
                ? Math.max(-9, Math.min(9, (rt.pos - rt.neg) * 2)) : 0;
            var prefsPenalty = (mG.length ? 42 : 0) + (mA.length ? 26 : 0) + (mD.length ? 28 : 0);
            var score = Math.max(-100, Math.min(100, Math.round(baseScore + reviewScore - prefsPenalty)));
            // Explicitly disliked genres/authors/performers matter more than
            // an average public rating, even for critically acclaimed titles.
            if (mG.length) score = Math.min(score, -36);
            else if (mA.length || mD.length) score = Math.min(score, -24);
            var lowConf = votes < 40;
            var confidence = votes >= 1500 ? 'высокая' : votes >= 150 ? 'средняя' : 'низкая';
            var meterW = Math.max(7, Math.min(93, Math.round(50 + score * 0.43)));
            var vClass, vWord;
            if (lowConf && !prefsPenalty) {
                vClass = 'meh'; vWord = 'МАЛО ДАННЫХ';
            } else if (score > 16) {
                vClass = 'yes'; vWord = 'СТОИТ';
            } else if (score < -16) {
                vClass = 'no'; vWord = 'НЕ СТОИТ';
            } else {
                vClass = 'meh'; vWord = 'СПОРНО';
            }
            var why = votes
                ? 'TMDB: ' + rating.toFixed(1) + '/10 · ' + fmtN(votes) + ' оценок · уверенность: ' + confidence
                : 'Недостаточно оценок для надёжного вывода';
            if (prefsPenalty) why += ' · учтены ваши исключения';


            var sortF = function(a,b){ return b.w - a.w; };
            var pros = F.filter(function(f){ return f.kind === 'pro'; }).sort(sortF).map(function(f){ return f.text; });
            var cons = F.filter(function(f){ return f.kind === 'con'; }).sort(sortF).map(function(f){ return f.text; });
            var prosEmpty = !pros.length;
            var consEmpty = !cons.length;
            if (prosEmpty) pros.push('ℹ️ Мало подтверждённых преимуществ');
            if (consEmpty) cons.push('ℹ️ Подтверждённых недостатков не найдено');

            // === Улучшенное определение темпа (mPace) ===
            var paceHeuristic = 5.5;
            var hasFastGenres = hasGenre(genres, /action|боевик|приключен|adventure|триллер|thriller|шпионский|spy|спорт|sport|sports/i);
            if (hasFastGenres) {
                paceHeuristic = 8.5;
            } else if (hasGenre(genres, /комедия|comedy|семейн|family|анимация|animation|мульт/i)) {
                paceHeuristic = 7.0;
            } else if (hasGenre(genres, /драма|drama|мелодрама|romance/i)) {
                paceHeuristic = 4.5;
            } else {
                paceHeuristic = 6.0;
            }
            if (hasKw(ctx, /chase|погон|fast-paced|динамичн|экшн|action|gunfight|перестрелк|explosion|взрыв|heist|ограблен|car chase|fight|драка|поединок|speed|быстр|гонк|race/i)) {
                paceHeuristic = Math.max(paceHeuristic, 9.0);
            }
            if (mm.action > 6) {
                paceHeuristic = Math.max(paceHeuristic, 8.5);
            }
            var mPace = mm.pace > 0 ? mm.pace : paceHeuristic;

            // Остальные метрики...
            var dramaHeuristic = (hasGenre(genres, /драма|drama|биография|biography|исторический|historical/i) ? 8.2 : (rating >= 8 ? 7.0 : 5.0));
            var mDrama = mm.sadness > 0 ? mm.sadness : dramaHeuristic;

            var mFear = mm.fear > 0 ? mm.fear : (hasGenre(genres, /horror|ужасы|хоррор/i) ? 8.5 : (hasGenre(genres, /thriller|триллер/i) ? 6.7 : 2.5));

            var immersionHeuristic = (hasGenre(genres, /фантастика|science fiction|sci-fi|фэнтези|fantasy|приключения|adventure/i) ? 7.5 : 5.5);
            var mImmersion = immersionHeuristic;

            var metricsEstimated = !dom.ok;
            var atmosMetrics = [
                { key: 'pace', name: 'Темп', score: Math.min(10, Math.max(1, +(mPace).toFixed(1))) },
                { key: 'fear', name: 'Напряжение', score: Math.min(10, Math.max(1, +(mFear).toFixed(1))) },
                { key: 'drama', name: 'Эмоции', score: Math.min(10, Math.max(1, +(mDrama).toFixed(1))) },
                { key: 'immersion', name: 'Атмосфера', score: Math.min(10, Math.max(1, +(mImmersion).toFixed(1))) }
            ];

            function toScale(c) { return Math.min(10, Math.max(1, +((c / 10)).toFixed(1))); }
            var advisory = [
                { key: 'violence', name: 'Насилие', raw: cViol },
                { key: 'sexnud', name: 'Секс/откровенность', raw: cSex },
                { key: 'profanity', name: 'Лексика', raw: cProf },
                { key: 'substances', name: 'Алкоголь/вещества', raw: Math.max(cAlc, cDrugs, cSmoke) }
            ];
            advisory.forEach(function(m){
                if (m.raw >= 15) {
                    atmosMetrics.push({ key: m.key, name: m.name, score: toScale(m.raw) });
                }
            });

            // === Расширенная логика аудитории ===
            var isSuperhero = hasKw(ctx, /superhero|супергеро/i) || inAnyText(ovBoth, /супергерой|супергероика|superhero/i);
            var isHistorical = hasGenre(genres, /историческ|historical|военный|war/i);
            var isComedy = hasGenre(genres, /комедия|comedy/i);
            var isCrimeThriller = gCrime && gThr;

            var targetAudience = '';
            var notSuitableFor = '';
            if (hasGenre(genres, /ужасы|хоррор/i) || inText(ovRu, /одержим|сталкер|маньяк|пугающ/i)) {
                targetAudience = 'любителям психологических триллеров и напряжённых историй';
                notSuitableFor = 'тем, кто избегает тяжёлого психологического давления';
            } else if (isSuperhero) {
                targetAudience = 'поклонникам супергероики и масштабных фантастических приключений';
                notSuitableFor = 'тем, кто не любит фантастические допущения и суперсилы';
            } else if (isHistorical) {
                targetAudience = 'любителям исторических драм и эпических полотен';
                notSuitableFor = 'тем, кто не любит неторопливое повествование и исторический контекст';
            } else if (isCrimeThriller) {
                targetAudience = 'любителям криминальных триллеров с запутанным сюжетом';
                notSuitableFor = 'тем, кто не переносит сцены насилия и мрачную атмосферу';
            } else if (isComedy) {
                targetAudience = 'любителям лёгких комедий и позитивных историй';
                notSuitableFor = 'тем, кто не любит юмор или предпочитает серьёзные темы';
            } else if (hasGenre(genres, /фантастика|sci-fi/i) && rating >= 7.5) {
                targetAudience = 'ценителям сложного научно-фантастического кино';
                notSuitableFor = 'любителям простых прямолинейных сюжетов';
            } else if (isAnim || hasFamilyGenre) {
                targetAudience = 'для уютного семейного просмотра';
                notSuitableFor = 'не для аудитории которая хочет взрослого и жестокого экшена';
            } else if (rating >= 7.8) {
                targetAudience = 'поклонникам качественного кинематографа';
                notSuitableFor = 'зрителям, ищущим лёгкое фоновое видео';
            } else {
                targetAudience = 'зрителям, заинтересованным в вечернем просмотре';
                notSuitableFor = 'искушённым критикам с высокими требованиями';
            }

            return {
                movie: movie, pros: pros, cons: cons, prosEmpty: prosEmpty, consEmpty: consEmpty,
                review: rt, score: score, norm: meterW,
                vClass: vClass, vWord: vWord, metaRich: !!(meta.kw.length || meta.reviews.length),
                why: why, lowConf: lowConf, metricsEstimated: metricsEstimated,
                atmosphere: { metrics: atmosMetrics, targetAudience: targetAudience, notSuitableFor: notSuitableFor }
            };
        });
    }

    var PIPS = {
        1: [[50,50]], 2: [[34,34],[66,66]], 3: [[30,30],[50,50],[70,70]],
        4: [[34,34],[66,34],[34,66],[66,66]], 5: [[34,34],[66,34],[50,50],[34,66],[66,66]],
        6: [[34,30],[66,30],[34,50],[66,50],[34,70],[66,70]]
    };

    function diceSVG(n) {
        var p = PIPS[n] || PIPS[1], c = '';
        for (var i = 0; i < p.length; i++) {
            c += '<circle cx="' + p[i][0] + '" cy="' + p[i][1] + '" r="9.4" fill="#e53935"/>';
        }
        return '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">' +
            '<rect x="5" y="5" width="90" height="90" rx="20" fill="#ffffff" stroke="#b0bec5" stroke-width="3"/>' +
            c + '</svg>';
    }

    function rndFace() { return 1 + Math.floor(Math.random() * 6); }
    function setFace(dice, f) { dice.html('<span class="sw-dice-core">' + diceSVG(f) + '</span>'); }

    function knockDice(dice, f, cb) {
        var core = dice.find('.sw-dice-core');
        if (!core.length) { setFace(dice, f); if (cb) cb(); return; }
        core.removeClass('sw-knock');
        void core[0].offsetWidth;
        core.addClass('sw-knock');
        setTimeout(function(){ if (core[0] && document.body.contains(core[0])) core.html(diceSVG(f)); }, 190);
        setTimeout(function(){ core.removeClass('sw-knock'); if (cb) cb(); }, 440);
    }

    function buildReadyInner(a) {
        var atmos = a.atmosphere || { metrics: [], targetAudience: '', notSuitableFor: '' };
        var metricsHtml = (atmos.metrics || []).map(function(m){
            var scoreCls = m.score >= 7.5 ? 'hi' : (m.score >= 5 ? 'mid' : 'ok');
            var fillBg = m.score >= 7.5 ? '#EF5350' : (m.score >= 5 ? '#E6A23C' : '#81C784');
            return '<div class="sw-metric-card">' +
                '<div class="sw-metric-header">' +
                '<span class="sw-metric-name">' + esc(m.name) + '</span>' +
                '<span class="sw-metric-score ' + scoreCls + '">' + m.score.toFixed(1) + ' <small>/ 10</small></span>' +
                '</div>' +
                '<div class="sw-metric-bar-bg"><div class="sw-metric-bar-fill" data-w="' + (m.score * 10) + '" style="background:' + fillBg + '"></div></div>' +
                '</div>';
        }).join('');

        var audienceHtml = '<div class="sw-audience-box">' +
            '<div class="sw-audience-title">кому стоит посмотреть</div>' +
            '<div class="sw-aud-line yes">' + ARROW_ICON + '<span>' + esc(atmos.targetAudience || 'любителям качественного кино') + '</span></div>' +
            (atmos.notSuitableFor ? '<div class="sw-audience-title second">кому не стоит смотреть</div>' +
            '<div class="sw-aud-line no">' + ARROW_ICON + '<span>' + esc(atmos.notSuitableFor) + '</span></div>' : '') +
            '</div>';

        var prosConsHtml = '<div class="sw-columns">' +
            '<div class="sw-col pros"><div class="sw-col-title">Что привлекает</div><ul class="sw-list">' + a.pros.slice(0, 8).map(function(p){ return '<li>' + esc(p) + '</li>'; }).join('') + '</ul></div>' +
            '<div class="sw-col cons"><div class="sw-col-title">Что учитывать</div><ul class="sw-list">' + a.cons.slice(0, 8).map(function(c){ return '<li>' + esc(c) + '</li>'; }).join('') + '</ul></div>' +
            '</div>';

        return '<div class="sw-dossier">' +
            '<div class="sw-verdict-word ' + a.vClass + '" id="sw-vword">' + esc(a.vWord) + '</div>' +
            '<div class="sw-meter" aria-hidden="true"><div class="sw-meter-fill ' + a.vClass + '" data-w="' + a.norm + '"></div></div>' +
            '<div class="sw-why">' + esc(a.why) + '</div>' +
            '<div class="sw-scale"><span>не смотреть</span><span>смотреть</span></div></div>' +
            '<div class="sw-dicebtn selector sw-focusable" id="sw-dice-btn" tabindex="0">' +
            '<span class="sw-dice" id="sw-dice"><span class="sw-dice-core">' + diceSVG(1) + '</span></span>' +
            '<span class="sw-dice-label" id="sw-dice-label">довериться случаю</span></div>' +
            '<div class="sw-dice-hint">Случайный выбор 50/50 — не оценка качества фильма.</div>' +
            '<div class="sw-tabs">' +
            '<div class="sw-tab-btn selector sw-focusable active" data-tab="proscons" tabindex="0">плюсы и минусы</div>' +
            '<div class="sw-tab-btn selector sw-focusable" data-tab="atmos" tabindex="0">атмосфера и темп</div>' +
            '</div>' +
            '<div class="sw-tab-pane active" id="sw-pane-proscons">' +
            prosConsHtml +
            '</div>' +
            '<div class="sw-tab-pane" id="sw-pane-atmos">' +
            (a.metricsEstimated ? '<div class="sw-note">Ориентировочная оценка по жанру и описанию, не результат опроса зрителей.</div>' : '') +
            '<div class="sw-metrics-grid">' + metricsHtml + '</div>' +
            audienceHtml +
            '</div>';
    }

    function bindTabs(html) {
        var tabBtns = html.find('.sw-tab-btn');
        var current = 'proscons', animatedMetrics = false;
        function activateTab(target, el) {
            if (target !== 'atmos' && target !== 'proscons') return;
            if (el) focusRing($(el), false);
            if (target === current) return;
            current = target;
            tabBtns.removeClass('active').attr('aria-selected','false');
            tabBtns.filter('[data-tab="' + target + '"]').addClass('active').attr('aria-selected','true');
            html.find('.sw-tab-pane').removeClass('active');
            html.find('#sw-pane-' + target).addClass('active');
            if (target === 'atmos' && !animatedMetrics) {
                animatedMetrics = true;
                html.find('#sw-pane-atmos .sw-metric-card').each(function(i){
                    var card = $(this), fill = card.find('.sw-metric-bar-fill');
                    uiLater(function(){
                        card.addClass('appear');
                        fill.css('width', (fill.attr('data-w') || 0) + '%');
                    }, 45 + i * 45, _sw_session);
                });
            }
        }
        tabBtns.on('hover:enter click', function(){
            activateTab($(this).attr('data-tab'), this);
        });
        tabBtns.on('hover:hover', function(){ focusRing($(this), false); });
        tabBtns.attr('role','tab').attr('aria-selected','false');
        tabBtns.filter('.active').attr('aria-selected','true');
    }

    function bindDice(html) {
        var btn = html.find('#sw-dice-btn'), dice = html.find('#sw-dice');
        var label = html.find('#sw-dice-label');
        if (!btn.length || !dice.length || !label.length) return;
        var session = _sw_session;
        function rollDice() {
            if (window._sw_rolling || window._sw_closed || session !== _sw_session) return;
            window._sw_rolling = true;
            btn.addClass('sw-rolling');
            var yes = Math.random() < 0.5;
            var lastFace = rndFace(), step = 0;
            label.removeClass('res-yes res-no').addClass('hide');
            function nextFace(){
                var f = rndFace();
                if (f === lastFace) f = f % 6 + 1;
                lastFace = f;
                return f;
            }
            function animate(){
                if (session !== _sw_session || window._sw_closed || !document.body.contains(btn[0])) return;
                if (step >= 3) {
                    label.text(yes ? 'смотреть' : 'не смотреть').removeClass('hide').addClass(yes ? 'res-yes' : 'res-no');
                    btn.removeClass('sw-rolling');
                    window._sw_rolling = false;
                    return;
                }
                step++;
                knockDice(dice, nextFace(), function(){ uiLater(animate, 55, session); });
            }
            animate();
        }
        btn.on('hover:hover', function(){ focusRing(btn, false); });
        btn.on('hover:enter click', rollDice);
    }

    function clearLoader() {
        if (window._sw_loaderTimer) {
            clearInterval(window._sw_loaderTimer);
            window._sw_loaderTimer = null;
        }
    }

    function cleanupModal() {
        clearUiTimers();
        window._sw_rolling = false;
        window._sw_activeInteractive = null;
        clearLoader();
        restorePrevController();
        if (window._sw_currentModalHtml) {
            try {
                window._sw_currentModalHtml.off();
                window._sw_currentModalHtml.empty();
            } catch(e) {}
            window._sw_currentModalHtml = null;
        }
    }

    function doClose() {
        if (window._sw_closed) return;
        window._sw_closed = true;
        try {
            if (window.Lampa && Lampa.Modal && typeof Lampa.Modal.close === 'function') Lampa.Modal.close();
        } catch(e) {}
        cleanupModal();
    }

    function showModal(rawMovie, triggerBtn) {
        if (Date.now() - _sw_openingAt < 350) return;
        _sw_openingAt = Date.now();
        var session = ++_sw_session;
        clearUiTimers();
        clearLoader();
        try {
            var movie = sanitizeMovie(rawMovie);
            window._sw_triggerElement = triggerBtn || null;
            try {
                if (getSetting('reset_cache','0') === '1') {
                    _metaCache = {}; _domCache = null;
                    if (window.Lampa && Lampa.Storage) Lampa.Storage.set(PLUGIN_ID + '_reset_cache','0');
                }
            } catch(e) {}
            try {
                if (window.Lampa && Lampa.Controller && Lampa.Controller.enabled()) {
                    window._sw_prevController = Lampa.Controller.enabled().name;
                }
            } catch(e) { window._sw_prevController = 'full'; }
            window._sw_closed = false;
            window._sw_rolling = false;
            window._sw_activeInteractive = null;
            var html = $('<div class="sw-wrap"><div id="sw-body"><div class="sw-loader"><div class="sw-loader-emoji">🎬</div>' +
                '<div class="sw-loader-text">Собираю сведения о фильме…</div><div class="sw-loader-progress"></div></div></div></div>');
            html.css('font-size', getSettings().font_scale + 'px');
            window._sw_currentModalHtml = html;
            if (!window.Lampa || !Lampa.Modal || typeof Lampa.Modal.open !== 'function') {
                window._sw_closed = true; return;
            }
            Lampa.Modal.open({
                title: 'Стоит ли смотреть: ' + esc(movie.title || movie.name || 'Фильм'),
                html: html, size: 'large',
                onBack: function(){
                    if (session !== _sw_session || window._sw_closed) return;
                    window._sw_closed = true;
                    cleanupModal();
                }
            });
            if (Lampa.Controller) Lampa.Controller.toggle(CONTROLLER_ID);
            analyze(movie).then(function(a){
                if (session !== _sw_session || window._sw_closed) return;
                clearLoader();
                html.find('#sw-body').html('<div class="sw-body">' + buildReadyInner(a) + '</div>');
                bindDice(html);
                bindTabs(html);
                uiLater(function(){
                    html.find('#sw-vword').addClass('appear');
                    html.find('.sw-meter-fill').each(function(){
                        this.style.width = (this.getAttribute('data-w') || 50) + '%';
                    });
                    html.find('.sw-list li').addClass('appear');
                    focusRing(html.find('#sw-dice-btn'), false);
                }, 45, session);
            }).catch(function(err){
                if (session !== _sw_session || window._sw_closed) return;
                clearLoader();
                console.error('[SW] analyze:', err);
                html.find('#sw-body').html('<div class="sw-error">Не удалось собрать данные. Закройте окно и попробуйте снова.</div>');
            });
        } catch(e) {
            console.error('[SW] showModal:', e);
            if (session === _sw_session) {
                window._sw_closed = true;
                clearUiTimers();
            }
        }
    }

    function addBtn(el, rawMovie) {
        try {
            if (!el || !el.length || el.find('.sw-custom-button-enhanced').length) return;
            var movie = sanitizeMovie(rawMovie);
            var btn = $('<div class="full-start__button selector sw-custom-button-enhanced" data-type="should_watch" tabindex="0"><div class="full-start__icon">' + ICON + '</div><span>Стоит ли смотреть</span></div>');

            btn.on('hover:enter click', function(){ showModal(movie, btn); });

            var anchor = el.find('.view--torrent,.view--online,.view--trailer').last();
            if (anchor.length) {
                anchor.after(btn);
            } else {
                var fb = el.find('.full-start__buttons,.full-start-new__buttons,.full-card__buttons,.view--buttons,.full-start__actions');
                if (fb.length) {
                    fb.append(btn);
                } else {
                    var titleEl = el.find('.full-start__title,.full-card__title');
                    if (false && titleEl.length) {
                        titleEl.after(btn);
                    } else {
                        return; // Wait for streaming/source actions container.
                    }
                }
            }
        } catch(e) { console.error('[SW] addBtn:', e); }
    }

    function startPlugin() {
        if (!window.Lampa) { console.warn('[SW] Lampa not found. Plugin disabled.'); return; }

        try { initSettings(); } catch(e) {}
        try { injectCSS(); } catch(e) {}
        try { registerController(); } catch(e) {}

        try {
            if (window.Lampa && Lampa.Listener) {
                Lampa.Listener.follow('full', function(e){
                    if (e.type !== 'complite') return;
                    try {
                        var renderEl = null;
                        if (e.object && typeof e.object.render === 'function') {
                            var res = e.object.render();
                            renderEl = (res && res.jquery) ? res : $(res);
                        } else if (e.object && e.object.activity && typeof e.object.activity.render === 'function') {
                            var res2 = e.object.activity.render();
                            renderEl = (res2 && res2.jquery) ? res2 : $(res2);
                        }

                        if (!renderEl || !renderEl.length) {
                            renderEl = $('.full-start, .full-card, .view--content');
                        }

                        var movie = e.data ? (e.data.movie || e.data) : DEMO_DATA;
                        if (renderEl && renderEl.length) {
                            addBtn(renderEl, movie);
                        }
                    } catch(err) { console.error('[SW] listener error:', err); }
                });
            }
        } catch(e) {}

        console.log('[ShouldWatch] v54.0: safer TMDB, calibrated verdicts, responsive TV navigation.');
    }

    try {
        if (window.appready) startPlugin();
        else if (window.Lampa && Lampa.Listener) {
            Lampa.Listener.follow('app', function(e){ if (e.type === 'ready') startPlugin(); });
        } else {
            $(document).ready(startPlugin);
        }
    } catch(e) {
        if (document.readyState === 'complete') startPlugin();
        else window.addEventListener('load', startPlugin);
    }
})();
