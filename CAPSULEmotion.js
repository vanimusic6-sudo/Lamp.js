/*
 * CAPSULE Motion for Lampa — UI motion layer, v1.0.0
 * Standalone Lampa plugin. No core patches, no library dependencies.
 * Based on the public yumata/lampa-source SCSS and interaction lifecycle.
 * GPL-2.0-compatible distribution. Copyright (c) 2026 CAPSULE.
 */
(function () {
    'use strict';

    var VERSION = '1.0.0';
    var KEY = 'capsule_motion_runtime';
    if (window[KEY]) return;

    var PREFIX = 'capsule_motion_';
    var SETTINGS_COMPONENT = 'capsule_motion';
    var STYLE_ID = 'capsule-motion-styles-v1';
    var PRESETS = {
        silk:   { navigation: 380, focus: 330, page: 425, popup: 450, surface: 520, color: 175, press: 260, scroll: 300 },
        cinema: { navigation: 455, focus: 395, page: 545, popup: 560, surface: 640, color: 195, press: 315, scroll: 300 },
        light:  { navigation: 245, focus: 215, page: 280, popup: 295, surface: 350, color: 120, press: 185, scroll: 300 }
    };
    var bodyClasses = [
        'capsule-motion-on', 'capsule-motion-cards', 'capsule-motion-navigation',
        'capsule-motion-player', 'capsule-motion-respect-reduced'
    ];
    var initialized = false;
    var destroyed = false;
    var initTimer = null;
    var retries = 0;
    var motionMedia = null;
    var motionListener = null;
    var style = null;
    var selectedPreset = 'silk';
    var lastStyledPreset = null;

    // Every selector is scoped to the plugin and respects Lampa's native
    // no--animation switch. Layout, navigation, scroll offsets and video are untouched.
    var STYLES = `
@keyframes capsule-motion-page-in {
    from { opacity: .82; transform: translate3d(0, .8em, 0); }
    to   { opacity: 1; transform: translate3d(0, 0, 0); }
}
@keyframes capsule-motion-dialog-in {
    from { opacity: 0; transform: translate3d(0, 1.1em, 0) scale(.985); }
    to   { opacity: 1; transform: translate3d(0, 0, 0) scale(1); }
}
@keyframes capsule-motion-full-in {
    from { opacity: .45; transform: translate3d(0, 1.25em, 0); }
    to   { opacity: 1; transform: translate3d(0, 0, 0); }
}
@keyframes capsule-motion-sheet-in {
    from { opacity: .84; transform: translate3d(0, 18%, 0); }
    to   { opacity: 1; transform: translate3d(0, 0, 0); }
}
@keyframes capsule-motion-sheet-out {
    from { opacity: 1; transform: translate3d(0, 0, 0); }
    to   { opacity: .82; transform: translate3d(0, 100%, 0); }
}
@keyframes capsule-motion-ring-in {
    from { opacity: .12; } to { opacity: 1; }
}
@keyframes capsule-motion-press-card {
    0% { transform: translate3d(0, -.22em, 0) scale(1.016); }
    44% { transform: translate3d(0, 0, 0) scale(.973); }
    76% { transform: translate3d(0, -.23em, 0) scale(1.019); }
    100% { transform: translate3d(0, -.22em, 0) scale(1.016); }
}
@keyframes capsule-motion-press-control {
    0% { transform: scale(1); }
    42% { transform: scale(.945); }
    74% { transform: scale(1.018); }
    100% { transform: scale(1); }
}

/* Navigation: native .wrap, .activity and panel transformations are retained. */
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .wrap__left,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .wrap__content {
    transition: transform {{navigation}}ms cubic-bezier(.22, 1, .36, 1);
}
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .activity {
    transition: opacity {{page}}ms cubic-bezier(.25, .5, .25, 1);
}
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .activity__body {
    transition: opacity {{page}}ms cubic-bezier(.25, .5, .25, 1);
}
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .activity--active:not(.activity--load) .activity__body {
    animation: capsule-motion-page-in {{page}}ms cubic-bezier(.22, 1, .36, 1) backwards !important;
}
body.capsule-motion-on.capsule-motion-navigation.advanced--animation:not(.no--animation) .activity:not(.activity--active) .activity__body {
    animation: none !important;
}
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .settings__content,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .selectbox__content {
    transition: transform {{navigation}}ms cubic-bezier(.22, 1, .36, 1);
}
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .background {
    transition: opacity {{surface}}ms ease;
}
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .background__one,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .background__two,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .background__fade,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .full-start__background {
    transition: opacity {{surface}}ms ease;
}
body.capsule-motion-on.capsule-motion-navigation.advanced--animation:not(.no--animation) .full-start__background.loaded {
    animation: none !important;
}
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .full-start-new__img {
    transition: opacity {{surface}}ms ease, transform {{page}}ms cubic-bezier(.22, 1, .36, 1);
}

/* TV navigation uses -webkit-transform inline. Never animate immediate/drag scroll. */
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .scroll__body:not(.notransition):not(.transition-reset) {
    transition: -webkit-transform {{scroll}}ms cubic-bezier(.2, .72, .24, 1),
                transform {{scroll}}ms cubic-bezier(.2, .72, .24, 1);
}

/* Cards: small composited lift, no reflow or poster/image animation. */
/* Native .card uses a permanent will-change layer per item. Avoid hundreds of
   dormant compositing layers; animate only the inner view when focused. */
body.capsule-motion-on.capsule-motion-cards:not(.no--animation) .card {
    will-change: auto;
}
body.capsule-motion-on.capsule-motion-cards:not(.no--animation) .card__view,
body.capsule-motion-on.capsule-motion-cards:not(.no--animation) .card-more__box,
body.capsule-motion-on.capsule-motion-cards:not(.no--animation) .card-episode .full-episode,
body.capsule-motion-on.capsule-motion-cards:not(.no--animation) .explorer-card__head-img {
    transition: transform {{focus}}ms cubic-bezier(.2, .75, .18, 1);
}
body.capsule-motion-on.capsule-motion-cards:not(.no--animation) .card.focus .card__view,
body.capsule-motion-on.capsule-motion-cards:not(.no--animation) .card.hover .card__view,
body.capsule-motion-on.capsule-motion-cards:not(.no--animation) .card-more.focus .card-more__box,
body.capsule-motion-on.capsule-motion-cards:not(.no--animation) .card-episode.focus .full-episode,
body.capsule-motion-on.capsule-motion-cards:not(.no--animation) .explorer-card__head-img.focus {
    transform: translate3d(0, -.22em, 0) scale(1.016);
}
body.capsule-motion-on.capsule-motion-cards:not(.no--animation) .card--wide.focus .card__view,
body.capsule-motion-on.capsule-motion-cards:not(.no--animation) .card--wide.hover .card__view {
    transform: translate3d(0, -.12em, 0) scale(1.007);
}
body.capsule-motion-on.capsule-motion-cards:not(.no--animation) .card.focus .card__view::after,
body.capsule-motion-on.capsule-motion-cards:not(.no--animation) .card.hover .card__view::after,
body.capsule-motion-on.capsule-motion-cards:not(.no--animation) .card-episode.focus .full-episode::after,
body.capsule-motion-on.capsule-motion-cards:not(.no--animation) .card-more.focus .card-more__box::after {
    animation: capsule-motion-ring-in {{color}}ms ease-out both;
}
/* Replace Lampa's 200ms focus bounce only where our smooth focus transition exists. */
body.capsule-motion-on.capsule-motion-cards.advanced--animation:not(.no--animation) .card:not(.card--wide).focus:not(.animate-trigger-enter) .card__view,
body.capsule-motion-on.capsule-motion-cards.advanced--animation:not(.no--animation) .card:not(.card--wide).hover:not(.animate-trigger-enter) .card__view,
body.capsule-motion-on.capsule-motion-cards.advanced--animation:not(.no--animation) .card-episode.focus:not(.animate-trigger-enter) .full-episode,
body.capsule-motion-on.capsule-motion-cards.advanced--animation:not(.no--animation) .explorer-card__head-img.focus:not(.animate-trigger-enter) {
    animation: none !important;
}
body.capsule-motion-on.capsule-motion-cards.advanced--animation:not(.no--animation) .card:not(.card--wide).animate-trigger-enter .card__view {
    animation: capsule-motion-press-card {{press}}ms cubic-bezier(.2, .65, .3, 1) both !important;
}
body.capsule-motion-on.capsule-motion-cards.advanced--animation:not(.no--animation) .card-episode.animate-trigger-enter .full-episode,
body.capsule-motion-on.capsule-motion-cards.advanced--animation:not(.no--animation) .explorer-card__head-img.animate-trigger-enter {
    animation: capsule-motion-press-control {{press}}ms cubic-bezier(.2, .65, .3, 1) both !important;
}

/* Focus states: colors stay 100% native; only movement and interpolation change. */
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .menu__item,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .head__action,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .settings-folder,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .settings-param,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .selectbox-item,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .navigation-tabs__button,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .navigation-bar__item,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .full-start__button,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .simple-button,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .modal__button,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .search-source,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .search-history-key,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .hg-button,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .full-person__photo,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .full-descr__tag,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .tag-count,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .full-review,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .full-review-add,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .torrent-item {
    will-change: auto;
    transition: transform {{focus}}ms cubic-bezier(.2, .75, .18, 1),
                background-color {{color}}ms ease-out, color {{color}}ms ease-out;
}
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .menu__item.focus,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .menu__item.hover {
    transform: translate3d(.12em, 0, 0);
}
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .head__action.focus,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .head__action.hover,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .navigation-tabs__button.focus,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .navigation-bar__item.focus,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .full-start__button.focus,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .simple-button.focus,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .modal__button.focus,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .hg-button.focus,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .full-descr__tag.focus,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .tag-count.focus,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .full-review-add.focus {
    transform: scale(1.035);
}
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .settings-folder.focus,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .settings-param.focus,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .selectbox-item.focus,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .search-source.focus,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .search-history-key.focus,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .torrent-item.focus,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .full-review.focus {
    transform: translate3d(.12em, 0, 0);
}
body.capsule-motion-on.capsule-motion-navigation.advanced--animation:not(.no--animation) .head__action.focus:not(.animate-trigger-enter),
body.capsule-motion-on.capsule-motion-navigation.advanced--animation:not(.no--animation) .menu__item.focus:not(.animate-trigger-enter),
body.capsule-motion-on.capsule-motion-navigation.advanced--animation:not(.no--animation) .full-start__button.focus:not(.animate-trigger-enter),
body.capsule-motion-on.capsule-motion-navigation.advanced--animation:not(.no--animation) .simple-button.focus:not(.animate-trigger-enter),
body.capsule-motion-on.capsule-motion-navigation.advanced--animation:not(.no--animation) .head__action.hover:not(.animate-trigger-enter),
body.capsule-motion-on.capsule-motion-navigation.advanced--animation:not(.no--animation) .menu__item.hover:not(.animate-trigger-enter),
body.capsule-motion-on.capsule-motion-navigation.advanced--animation:not(.no--animation) .settings-folder.focus .settings-folder__icon,
body.capsule-motion-on.capsule-motion-navigation.advanced--animation:not(.no--animation) .full-person.focus .full-person__photo,
body.capsule-motion-on.capsule-motion-navigation.advanced--animation:not(.no--animation) .torrent-item.focus:not(.animate-trigger-enter),
body.capsule-motion-on.capsule-motion-navigation.advanced--animation:not(.no--animation) .full-descr__tag.focus:not(.animate-trigger-enter),
body.capsule-motion-on.capsule-motion-navigation.advanced--animation:not(.no--animation) .tag-count.focus:not(.animate-trigger-enter),
body.capsule-motion-on.capsule-motion-navigation.advanced--animation:not(.no--animation) .full-review.focus:not(.animate-trigger-enter),
body.capsule-motion-on.capsule-motion-navigation.advanced--animation:not(.no--animation) .full-review-add.focus:not(.animate-trigger-enter) {
    animation: none !important;
}
body.capsule-motion-on.capsule-motion-navigation.advanced--animation:not(.no--animation) .head__action.animate-trigger-enter,
body.capsule-motion-on.capsule-motion-navigation.advanced--animation:not(.no--animation) .menu__item.animate-trigger-enter,
body.capsule-motion-on.capsule-motion-navigation.advanced--animation:not(.no--animation) .full-start__button.animate-trigger-enter,
body.capsule-motion-on.capsule-motion-navigation.advanced--animation:not(.no--animation) .simple-button.animate-trigger-enter,
body.capsule-motion-on.capsule-motion-navigation.advanced--animation:not(.no--animation) .torrent-item.animate-trigger-enter,
body.capsule-motion-on.capsule-motion-navigation.advanced--animation:not(.no--animation) .full-descr__tag.animate-trigger-enter,
body.capsule-motion-on.capsule-motion-navigation.advanced--animation:not(.no--animation) .tag-count.animate-trigger-enter,
body.capsule-motion-on.capsule-motion-navigation.advanced--animation:not(.no--animation) .full-review.animate-trigger-enter,
body.capsule-motion-on.capsule-motion-navigation.advanced--animation:not(.no--animation) .full-review-add.animate-trigger-enter {
    animation: capsule-motion-press-control {{press}}ms cubic-bezier(.2, .65, .3, 1) both !important;
}
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .modal.animate .modal__content {
    animation: capsule-motion-dialog-in {{popup}}ms cubic-bezier(.22, 1, .36, 1) both !important;
}
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .modal.modal--full.animate .modal__content {
    animation: capsule-motion-full-in {{popup}}ms cubic-bezier(.22, 1, .36, 1) both !important;
}
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .noty {
    transition: transform {{navigation}}ms cubic-bezier(.22, 1, .36, 1),
                opacity {{navigation}}ms ease-out;
}

/* Media controls: only the panel and discrete buttons, never video frames/timeline. */
body.capsule-motion-on.capsule-motion-player:not(.no--animation) .player-panel {
    transition: transform {{navigation}}ms cubic-bezier(.22, 1, .36, 1),
                opacity {{navigation}}ms ease-out;
}
body.capsule-motion-on.capsule-motion-player:not(.no--animation) .player-panel .button {
    transition: transform {{focus}}ms cubic-bezier(.2, .75, .18, 1),
                background-color {{color}}ms ease-out, color {{color}}ms ease-out;
}
body.capsule-motion-on.capsule-motion-player:not(.no--animation) .player-panel .button.focus {
    transform: scale(1.035);
}
body.capsule-motion-on.capsule-motion-player:not(.no--animation) .player-panel .button.animate-trigger-enter {
    animation: capsule-motion-press-control {{press}}ms cubic-bezier(.2, .65, .3, 1) both !important;
}
body.capsule-motion-on.capsule-motion-player:not(.no--animation) .player-panel .tooltip {
    transition: opacity {{color}}ms ease-out;
}
body.capsule-motion-on.capsule-motion-player:not(.no--animation) .player-panel-iptv__channel > div {
    transition: transform {{navigation}}ms cubic-bezier(.22, 1, .36, 1),
                opacity {{navigation}}ms ease-out;
}

/* Mobile bottom sheets: opening can be soft. Swipe-to-close is hardcoded at
   200ms in Lampa, so exiting MUST finish before that deadline. */
@media screen and (max-width: 480px) {
    body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .selectbox.animate:not(.animate-down) .selectbox__content,
    body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .settings.animate:not(.animate-down) .settings__content {
        animation: capsule-motion-sheet-in {{popup}}ms cubic-bezier(.22, 1, .36, 1) both !important;
    }
    body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .selectbox.animate-down .selectbox__content,
    body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .settings.animate-down .settings__content {
        animation: capsule-motion-sheet-out 175ms cubic-bezier(.55, 0, 1, .75) both !important;
    }
    body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .modal.animate:not(.animate-down) .modal__content {
        animation: capsule-motion-sheet-in {{popup}}ms cubic-bezier(.22, 1, .36, 1) both !important;
    }
    body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .modal.animate-down .modal__content {
        animation: capsule-motion-sheet-out 175ms cubic-bezier(.55, 0, 1, .75) both !important;
    }
}

/* Never insist on motion when accessibility mode is enabled. */
@media (prefers-reduced-motion: reduce) {
    body.capsule-motion-on.capsule-motion-respect-reduced:not(.no--animation) .activity__body,
    body.capsule-motion-on.capsule-motion-respect-reduced:not(.no--animation) .modal__content,
    body.capsule-motion-on.capsule-motion-respect-reduced:not(.no--animation) .selectbox__content,
    body.capsule-motion-on.capsule-motion-respect-reduced:not(.no--animation) .settings__content,
    body.capsule-motion-on.capsule-motion-respect-reduced:not(.no--animation) .card__view,
    body.capsule-motion-on.capsule-motion-respect-reduced:not(.no--animation) .scroll__body {
        animation: none !important;
        transition-duration: 0ms !important;
    }
}
`;

    function log(message) {
        if (window.console && console.log) console.log('[CAPSULE Motion] ' + message);
    }

    function read(name, fallback) {
        try {
            var value = window.Lampa && Lampa.Storage && Lampa.Storage.field(PREFIX + name);
            return value === undefined || value === null ? fallback : value;
        } catch (e) { return fallback; }
    }

    function enabled(value) {
        return value !== false && value !== 'false' && value !== 0 && value !== '0';
    }

    function reduced() {
        return !!(motionMedia && motionMedia.matches && enabled(read('respect_reduced_v1', true)));
    }

    function clearClasses() {
        if (!document.body) return;
        for (var i = 0; i < bodyClasses.length; i++) document.body.classList.remove(bodyClasses[i]);
    }

    function renderCss(profile) {
        return STYLES.replace(/\{\{(navigation|focus|page|popup|surface|color|press|scroll)\}\}/g, function (all, name) {
            return String(profile[name]);
        });
    }

    function apply() {
        if (!initialized || destroyed || !document.body) return;
        var preset = String(read('preset_v1', 'silk'));
        selectedPreset = preset === 'off' || PRESETS[preset] ? preset : 'silk';
        clearClasses();
        if (preset === 'off' || reduced()) return;
        if (!style) {
            style = document.createElement('style');
            lastStyledPreset = null;
            style.id = STYLE_ID;
            style.type = 'text/css';
            (document.head || document.body).appendChild(style);
        }
        if (lastStyledPreset !== selectedPreset) {
            style.textContent = renderCss(PRESETS[selectedPreset]);
            lastStyledPreset = selectedPreset;
        }
        document.body.classList.add('capsule-motion-on');
        if (enabled(read('respect_reduced_v1', true))) document.body.classList.add('capsule-motion-respect-reduced');
        if (enabled(read('cards_v1', true))) document.body.classList.add('capsule-motion-cards');
        if (enabled(read('navigation_v1', true))) document.body.classList.add('capsule-motion-navigation');
        if (enabled(read('player_v1', true))) document.body.classList.add('capsule-motion-player');
    }

    function register() {
        var api = Lampa.SettingsApi;
        api.addComponent({
            component: SETTINGS_COMPONENT,
            name: 'CAPSULE Motion',
            icon: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M3 16c4-12 7 12 12 0s5-6 6-8"/><circle cx="5" cy="8" r="1"/></svg>'
        });
        api.addParam({
            component: SETTINGS_COMPONENT,
            param: {
                name: PREFIX + 'preset_v1', type: 'select', default: 'silk',
                values: {
                    silk: 'Шёлк — мягкая плавность',
                    cinema: 'Кино — особенно плавно',
                    light: 'Лёгкий — для слабых устройств',
                    off: 'Выключено'
                }
            },
            field: {
                name: 'Режим плавности',
                description: 'Заменяет анимации Lampa без вмешательства в воспроизведение и навигацию.'
            },
            onChange: apply
        });
        api.addParam({
            component: SETTINGS_COMPONENT,
            param: { name: PREFIX + 'cards_v1', type: 'trigger', default: true },
            field: { name: 'Карточки и постеры', description: 'Мягкое перемещение и отклик при фокусе и нажатии.' },
            onChange: apply
        });
        api.addParam({
            component: SETTINGS_COMPONENT,
            param: { name: PREFIX + 'navigation_v1', type: 'trigger', default: true },
            field: { name: 'Меню и окна', description: 'Переходы экранов, скролл, настройки и модальные окна.' },
            onChange: apply
        });
        api.addParam({
            component: SETTINGS_COMPONENT,
            param: { name: PREFIX + 'player_v1', type: 'trigger', default: true },
            field: { name: 'Кнопки видеоплеера', description: 'Только интерфейс управления, без изменения видеопотока.' },
            onChange: apply
        });
        api.addParam({
            component: SETTINGS_COMPONENT,
            param: { name: PREFIX + 'respect_reduced_v1', type: 'trigger', default: true },
            field: { name: 'Учитывать уменьшение анимаций в системе' },
            onChange: apply
        });
    }

    function init() {
        if (initialized || destroyed) return;
        if (!window.Lampa || !Lampa.SettingsApi || !Lampa.Storage || !document.body) return;
        try {
            register();
            initialized = true;
            if (window.matchMedia) {
                motionMedia = window.matchMedia('(prefers-reduced-motion: reduce)');
                motionListener = function () { apply(); };
                if (motionMedia.addEventListener) motionMedia.addEventListener('change', motionListener);
                else if (motionMedia.addListener) motionMedia.addListener(motionListener);
            }
            apply();
            log('v' + VERSION + ' loaded (' + selectedPreset + ')');
        } catch (error) {
            log('Initialization failed: ' + (error && error.message ? error.message : error));
            clearClasses();
        }
    }

    function boot() {
        if (initialized || destroyed) return;
        if (window.Lampa && Lampa.Listener && Lampa.SettingsApi && document.body) {
            if (window.appready) {
                init();
            } else {
                Lampa.Listener.follow('app', function (event) {
                    if (event && event.type === 'ready') init();
                });
                if (window.appready) init();
            }
        } else if (retries++ < 120) {
            initTimer = setTimeout(boot, 100);
        } else {
            log('Lampa APIs not found; plugin not initialized');
        }
    }

    window[KEY] = {
        version: VERSION,
        apply: apply,
        status: function () {
            return {
                initialized: initialized, preset: selectedPreset,
                active: !!(document.body && document.body.classList.contains('capsule-motion-on')),
                reducedMotion: reduced(),
                nativeAnimationDisabled: !!(document.body && document.body.classList.contains('no--animation'))
            };
        },
        stop: function () {
            destroyed = true;
            if (initTimer) clearTimeout(initTimer);
            if (motionMedia && motionListener) {
                if (motionMedia.removeEventListener) motionMedia.removeEventListener('change', motionListener);
                else if (motionMedia.removeListener) motionMedia.removeListener(motionListener);
            }
            clearClasses();
            if (style && style.parentNode) style.parentNode.removeChild(style);
            style = null;
            lastStyledPreset = null;
            if (initialized && Lampa.SettingsApi && Lampa.SettingsApi.removeComponent) {
                Lampa.SettingsApi.removeComponent(SETTINGS_COMPONENT);
            }
            delete window[KEY];
        }
    };

    boot();
})();