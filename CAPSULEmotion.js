/*
 * CAPSULE Motion 3.0.0 — responsive spring motion for Lampa.
 * Standalone CSS/JS enhancement; no Lampa core or playback overrides.
 * No blur, opacity veils, whole-page dimming, delayed text, or frame loops.
 * Copyright (c) 2026 CAPSULE. GPL-2.0-or-later.
 */
(function () {
    'use strict';

    var VERSION = '3.0.0';
    var KEY = 'capsule_motion_runtime';
    var PREVIOUS = window[KEY];
    if (PREVIOUS) {
        if (PREVIOUS.version === VERSION) return;
        if (typeof PREVIOUS.stop !== 'function') return;
        try { PREVIOUS.stop(); } catch (e) { return; }
    }

    var PREFIX = 'capsule_motion_';
    var COMPONENT = 'capsule_motion';
    var STYLE_ID = 'capsule-motion-style-v3';
    // Lampa's TV Scroll implementation assumes a 300ms transition end.
    // Keep that exact duration: change only its interpolation.
    var SCROLL_MS = 300;
    var PROFILES = {
        silk:   {name:'Живой',      nav:340, focus:295, page:255, popup:320, press:155, color:105, bg:210, detail:215, lift:'-.13em', scale:'1.014', bounce:.87},
        cloud:  {name:'Упругий',    nav:375, focus:335, page:270, popup:355, press:170, color:105, bg:225, detail:230, lift:'-.16em', scale:'1.018', bounce:.82},
        cinema: {name:'Кино',       nav:390, focus:310, page:280, popup:380, press:155, color:110, bg:245, detail:235, lift:'-.14em', scale:'1.014', bounce:.88},
        light:  {name:'Быстрый',    nav:240, focus:225, page:190, popup:250, press:135, color:85,  bg:165, detail:155, lift:'-.09em', scale:'1.010', bounce:.96}
    };
    var BODY_CLASSES = ['cm3-enabled', 'cm3-cards', 'cm3-ui', 'cm3-player', 'cm3-details'];
    var started = false;
    var destroyed = false;
    var active = false;
    var preset = 'silk';
    var style = null;
    var styleKey = '';
    var bootTimer = null;
    var bootAttempts = 0;
    var appListener = null;
    var appListenerAttached = false;
    var settingsListener = null;
    var settingsListenerAttached = false;
    var settingsAnim = null;
    var settingsAnimElement = null;
    var fallbackTimer = null;
    var reduceMedia = null;
    var reduceListener = null;

    // Normalized response of a damped second-order spring to a unit step,
    // with a small initial velocity so movement *responds immediately*.
    // Overshoot is ~0.5-1%, not the long rubber-band oscillation of v2.
    // We precompute the curve ONCE: CSS compositor animates thereafter.
    function springCurve(zeta, omega, initialVelocity, sampleCount) {
        var a = zeta * omega;
        var wd = omega * Math.sqrt(1-zeta*zeta);
        var stops = [];
        for (var i=0;i<=sampleCount;i++) {
            var t = i/sampleCount;
            var displacement = Math.exp(-a*t) *
                (Math.cos(wd*t) + (a-initialVelocity)/wd*Math.sin(wd*t));
            var progress = 1 - displacement;
            if (i===0) progress = 0;
            if (i===sampleCount) progress = 1; // settle exactly at final frame
            stops.push(Number(progress.toFixed(5)) + ' ' + Number((100*t).toFixed(3)) + '%');
        }
        return 'linear(' + stops.join(',') + ')';
    }

    var CSS_TEXT = `
/* A 3.x plugin never obscures or blurs UI. Only geometry moves. */
body.cm3-enabled {
    --cm3-move: cubic-bezier(.17,.82,.22,1);
    --cm3-touch: cubic-bezier(.18,.82,.2,1);
    --cm3-precise: cubic-bezier(.22,.7,.22,1);
    --cm3-nav: {{nav}}ms;
    --cm3-focus: {{focus}}ms;
    --cm3-page: {{page}}ms;
    --cm3-pop: {{popup}}ms;
    --cm3-press: {{press}}ms;
    --cm3-color: {{color}}ms;
    --cm3-bg: {{bg}}ms;
    --cm3-detail: {{detail}}ms;
    --cm3-lift: {{lift}};
    --cm3-scale: {{scale}};
}
@supports (animation-timing-function: linear(0,1)) {
    body.cm3-enabled {
        --cm3-move: {{springMove}};
        --cm3-touch: {{springTouch}};
    }
}
@keyframes cm3-enter {
    from {transform:translate3d(0,.65em,0)}
    to   {transform:translate3d(0,0,0)}
}
@keyframes cm3-popup {
    from {transform:translate3d(0,.75em,0) scale(.988)}
    to   {transform:translate3d(0,0,0) scale(1)}
}
@keyframes cm3-sheet-in {
    from {transform:translate3d(0,15%,0)}
    to   {transform:translate3d(0,0,0)}
}
@keyframes cm3-sheet-out {
    from {transform:translate3d(0,0,0)}
    to   {transform:translate3d(0,100%,0)}
}
@keyframes cm3-press-card {
    0%,100% {transform:translate3d(0,var(--cm3-lift),0) scale(var(--cm3-scale))}
    36% {transform:translate3d(0,0,0) scale(.975)}
    67% {transform:translate3d(0,var(--cm3-lift),0) scale(1.018)}
}
@keyframes cm3-press-control {
    0%,100% {transform:scale(1.018)}
    36% {transform:scale(.970)}
    70% {transform:scale(1.023)}
}
@keyframes cm3-press-rest {
    0%,100% {transform:scale(1)}
    36% {transform:scale(.973)}
    70% {transform:scale(1.008)}
}
@keyframes cm3-press-row {
    0%,100% {transform:translate3d(.1em,0,0)}
    36% {transform:translate3d(.02em,0,0) scale(.993)}
    70% {transform:translate3d(.12em,0,0)}
}
@keyframes cm3-reveal-details {
    from {transform:translate3d(0,.25em,0)}
    to {transform:translate3d(0,0,0)}
}
/* Fast page handoff. Do not fade the page or body through a translucent frame. */
body.cm3-enabled.cm3-ui:not(.no--animation) .activity {
    transition:opacity 80ms linear;
}
body.cm3-enabled.cm3-ui:not(.no--animation) .activity__body {
    transition:opacity 105ms linear; /* preserve native load/hide functionality */
}
body.cm3-enabled.cm3-ui.advanced--animation:not(.no--animation)
    .activity:not(.activity--load) .activity__body {animation:none !important}
body.cm3-enabled.cm3-ui:not(.no--animation)
    .activity.activity--active:not(.activity--load) .activity__body {
    animation:cm3-enter var(--cm3-page) var(--cm3-move) both !important;
}
/* Do not change established geometry, positioning, or DOM navigation. */
body.cm3-enabled.cm3-ui:not(.no--animation) .wrap__left,
body.cm3-enabled.cm3-ui:not(.no--animation) .wrap__content,
body.cm3-enabled.cm3-ui:not(.no--animation) .settings__content,
body.cm3-enabled.cm3-ui:not(.no--animation) .selectbox__content {
    transition-property:transform;
    transition-duration:var(--cm3-nav);
    transition-timing-function:var(--cm3-move);
}
body.cm3-enabled.cm3-ui:not(.no--animation) .scroll__body:not(.notransition):not(.transition-reset) {
    transition:transform 300ms var(--cm3-precise),-webkit-transform 300ms var(--cm3-precise);
}
body.cm3-enabled.cm3-ui:not(.no--animation) .scroll__body.notransition,
body.cm3-enabled.cm3-ui:not(.no--animation) .scroll__body.transition-reset {
    transition:none !important;
}
/* Background crossfade belongs to backgrounds only; never affect text. */
body.cm3-enabled.cm3-ui:not(.no--animation) .background,
body.cm3-enabled.cm3-ui:not(.no--animation) .background__one,
body.cm3-enabled.cm3-ui:not(.no--animation) .background__two,
body.cm3-enabled.cm3-ui:not(.no--animation) .background__fade,
body.cm3-enabled.cm3-ui:not(.no--animation) .full-start__background {
    transition:opacity var(--cm3-bg) linear;
}
body.cm3-enabled.cm3-ui.advanced--animation:not(.no--animation)
    .full-start__background.loaded {animation:none !important}
body.cm3-enabled.cm3-ui:not(.no--animation) .full-start-new__img {
    transition:opacity var(--cm3-bg) linear,
               transform var(--cm3-page) var(--cm3-move);
}
/* Only focused cards gain transient layers. Never repaint entire card grids. */
body.cm3-enabled.cm3-cards:not(.no--animation) .card,
body.cm3-enabled.cm3-ui:not(.no--animation) .settings-folder,
body.cm3-enabled.cm3-ui:not(.no--animation) .settings-param,
body.cm3-enabled.cm3-ui:not(.no--animation) .selectbox-item {
    will-change:auto;
}
body.cm3-enabled.cm3-cards:not(.no--animation) .card__view,
body.cm3-enabled.cm3-cards:not(.no--animation) .card-more__box,
body.cm3-enabled.cm3-cards:not(.no--animation) .card-episode .full-episode,
body.cm3-enabled.cm3-cards:not(.no--animation) .explorer-card__head-img {
    transition:transform var(--cm3-focus) var(--cm3-touch);
}
body.cm3-enabled.cm3-cards:not(.no--animation) .card.focus .card__view,
body.cm3-enabled.cm3-cards:not(.no--animation) .card.hover .card__view,
body.cm3-enabled.cm3-cards:not(.no--animation) .card-more.focus .card-more__box,
body.cm3-enabled.cm3-cards:not(.no--animation) .card-episode.focus .full-episode,
body.cm3-enabled.cm3-cards:not(.no--animation) .explorer-card__head-img.focus {
    transform:translate3d(0,var(--cm3-lift),0) scale(var(--cm3-scale));
}
body.cm3-enabled.cm3-cards:not(.no--animation) .card--wide.focus .card__view,
body.cm3-enabled.cm3-cards:not(.no--animation) .card--wide.hover .card__view {
    transform:translate3d(0,-.09em,0) scale(1.008);
}
/* Stock animation-card-focus, animation-trigger-enter and animation-file-focus
   override transition transforms; remove ONLY on targets that we animate. */
body.cm3-enabled.cm3-cards.advanced--animation:not(.no--animation)
    .card:not(.card--wide).focus .card__view,
body.cm3-enabled.cm3-cards.advanced--animation:not(.no--animation)
    .card:not(.card--wide).hover .card__view,
body.cm3-enabled.cm3-cards.advanced--animation:not(.no--animation)
    .card-episode.focus .full-episode,
body.cm3-enabled.cm3-cards.advanced--animation:not(.no--animation)
    .card-episode.hover .full-episode,
body.cm3-enabled.cm3-cards.advanced--animation:not(.no--animation)
    .explorer-card__head-img.focus ,
body.cm3-enabled.cm3-cards.advanced--animation:not(.no--animation)
    .explorer-card__head-img.hover {
    animation:none !important;
}
body.cm3-enabled.cm3-cards.advanced--animation:not(.no--animation)
    .card:not(.card--wide).animate-trigger-enter .card__view,
body.cm3-enabled.cm3-cards.advanced--animation:not(.no--animation)
    .card-episode.animate-trigger-enter .full-episode,
body.cm3-enabled.cm3-cards.advanced--animation:not(.no--animation)
    .explorer-card__head-img.animate-trigger-enter {
    animation:cm3-press-card var(--cm3-press) var(--cm3-touch) both !important;
}
/* Ring appears quickly; poster pixels are never faded or blurred. */
body.cm3-enabled.cm3-cards:not(.no--animation) .card .card__view::after,
body.cm3-enabled.cm3-cards:not(.no--animation) .card-more .card-more__box::after,
body.cm3-enabled.cm3-cards:not(.no--animation) .card-episode .full-episode::after {
    transition:opacity 90ms linear;
}
/* Buttons and rows: immediate contrast, physical spatial response. */
body.cm3-enabled.cm3-ui:not(.no--animation) .menu__item,
body.cm3-enabled.cm3-ui:not(.no--animation) .head__action,
body.cm3-enabled.cm3-ui:not(.no--animation) .settings-folder,
body.cm3-enabled.cm3-ui:not(.no--animation) .settings-param,
body.cm3-enabled.cm3-ui:not(.no--animation) .selectbox-item,
body.cm3-enabled.cm3-ui:not(.no--animation) .navigation-tabs__button,
body.cm3-enabled.cm3-ui:not(.no--animation) .navigation-bar__item,
body.cm3-enabled.cm3-ui:not(.no--animation) .full-start__button,
body.cm3-enabled.cm3-ui:not(.no--animation) .simple-button,
body.cm3-enabled.cm3-ui:not(.no--animation) .modal__button,
body.cm3-enabled.cm3-ui:not(.no--animation) .search-source,
body.cm3-enabled.cm3-ui:not(.no--animation) .search-history-key,
body.cm3-enabled.cm3-ui:not(.no--animation) .hg-button,
body.cm3-enabled.cm3-ui:not(.no--animation) .tag-count,
body.cm3-enabled.cm3-ui:not(.no--animation) .full-descr__tag,
body.cm3-enabled.cm3-ui:not(.no--animation) .full-review,
body.cm3-enabled.cm3-ui:not(.no--animation) .full-review-add,
body.cm3-enabled.cm3-ui:not(.no--animation) .torrent-item,
body.cm3-enabled.cm3-ui:not(.no--animation) .season-episode,
body.cm3-enabled.cm3-ui:not(.no--animation) .feed-item {
    transition:transform var(--cm3-focus) var(--cm3-touch),
               background-color var(--cm3-color) linear,
               color var(--cm3-color) linear;
}
body.cm3-enabled.cm3-ui:not(.no--animation) .menu__item.focus,
body.cm3-enabled.cm3-ui:not(.no--animation) .menu__item.hover,
body.cm3-enabled.cm3-ui:not(.no--animation) .settings-folder.focus,
body.cm3-enabled.cm3-ui:not(.no--animation) .settings-param.focus,
body.cm3-enabled.cm3-ui:not(.no--animation) .selectbox-item.focus,
body.cm3-enabled.cm3-ui:not(.no--animation) .torrent-item.focus,
body.cm3-enabled.cm3-ui:not(.no--animation) .search-source.focus,
body.cm3-enabled.cm3-ui:not(.no--animation) .search-history-key.focus,
body.cm3-enabled.cm3-ui:not(.no--animation) .full-review.focus {
    transform:translate3d(.10em,0,0);
}
body.cm3-enabled.cm3-ui:not(.no--animation) .head__action.focus,
body.cm3-enabled.cm3-ui:not(.no--animation) .head__action.hover,
body.cm3-enabled.cm3-ui:not(.no--animation) .navigation-tabs__button.focus,
body.cm3-enabled.cm3-ui:not(.no--animation) .navigation-bar__item.focus,
body.cm3-enabled.cm3-ui:not(.no--animation) .full-start__button.focus,
body.cm3-enabled.cm3-ui:not(.no--animation) .simple-button.focus,
body.cm3-enabled.cm3-ui:not(.no--animation) .modal__button.focus,
body.cm3-enabled.cm3-ui:not(.no--animation) .hg-button.focus,
body.cm3-enabled.cm3-ui:not(.no--animation) .tag-count.focus,
body.cm3-enabled.cm3-ui:not(.no--animation) .full-descr__tag.focus,
body.cm3-enabled.cm3-ui:not(.no--animation) .full-review-add.focus {
    transform:scale(1.018);
}
body.cm3-enabled.cm3-ui.advanced--animation:not(.no--animation)
    .head__action.focus,
body.cm3-enabled.cm3-ui.advanced--animation:not(.no--animation)
    .head__action.hover,
body.cm3-enabled.cm3-ui.advanced--animation:not(.no--animation)
    .menu__item.focus,
body.cm3-enabled.cm3-ui.advanced--animation:not(.no--animation)
    .menu__item.hover,
body.cm3-enabled.cm3-ui.advanced--animation:not(.no--animation)
    .full-start__button.focus,
body.cm3-enabled.cm3-ui.advanced--animation:not(.no--animation)
    .full-start__button.hover,
body.cm3-enabled.cm3-ui.advanced--animation:not(.no--animation)
    .simple-button.focus,
body.cm3-enabled.cm3-ui.advanced--animation:not(.no--animation)
    .simple-button.hover,
body.cm3-enabled.cm3-ui.advanced--animation:not(.no--animation)
    .torrent-item.focus,
body.cm3-enabled.cm3-ui.advanced--animation:not(.no--animation)
    .torrent-item.hover,
body.cm3-enabled.cm3-ui.advanced--animation:not(.no--animation)
    .tag-count.focus,
body.cm3-enabled.cm3-ui.advanced--animation:not(.no--animation)
    .tag-count.hover,
body.cm3-enabled.cm3-ui.advanced--animation:not(.no--animation)
    .full-descr__tag.focus,
body.cm3-enabled.cm3-ui.advanced--animation:not(.no--animation)
    .full-descr__tag.hover,
body.cm3-enabled.cm3-ui.advanced--animation:not(.no--animation)
    .full-review.focus,
body.cm3-enabled.cm3-ui.advanced--animation:not(.no--animation)
    .full-review.hover,
body.cm3-enabled.cm3-ui.advanced--animation:not(.no--animation)
    .full-review-add.focus,
body.cm3-enabled.cm3-ui.advanced--animation:not(.no--animation)
    .full-review-add.hover,
body.cm3-enabled.cm3-ui.advanced--animation:not(.no--animation)
    .settings-folder.focus .settings-folder__icon,
body.cm3-enabled.cm3-ui.advanced--animation:not(.no--animation)
    .settings-folder.hover .settings-folder__icon,
body.cm3-enabled.cm3-ui.advanced--animation:not(.no--animation)
    .full-person.focus .full-person__photo ,
body.cm3-enabled.cm3-ui.advanced--animation:not(.no--animation)
    .full-person.hover .full-person__photo {
    animation:none !important;
}
body.cm3-enabled.cm3-ui.advanced--animation:not(.no--animation)
    .menu__item.animate-trigger-enter,
body.cm3-enabled.cm3-ui.advanced--animation:not(.no--animation)
    .torrent-item.animate-trigger-enter,
body.cm3-enabled.cm3-ui.advanced--animation:not(.no--animation)
    .full-review.animate-trigger-enter {
    animation:cm3-press-row var(--cm3-press) var(--cm3-touch) both !important;
}
body.cm3-enabled.cm3-ui.advanced--animation:not(.no--animation)
    .head__action.animate-trigger-enter,
body.cm3-enabled.cm3-ui.advanced--animation:not(.no--animation)
    .full-start__button.animate-trigger-enter,
body.cm3-enabled.cm3-ui.advanced--animation:not(.no--animation)
    .simple-button.animate-trigger-enter,
body.cm3-enabled.cm3-ui.advanced--animation:not(.no--animation)
    .tag-count.animate-trigger-enter,
body.cm3-enabled.cm3-ui.advanced--animation:not(.no--animation)
    .full-descr__tag.animate-trigger-enter,
body.cm3-enabled.cm3-ui.advanced--animation:not(.no--animation)
    .full-review-add.animate-trigger-enter {
    animation:cm3-press-control var(--cm3-press) var(--cm3-touch) both !important;
}
body.cm3-enabled.cm3-ui.advanced--animation:not(.no--animation)
    .head__action.animate-trigger-enter:not(.focus):not(.hover),
body.cm3-enabled.cm3-ui.advanced--animation:not(.no--animation)
    .full-start__button.animate-trigger-enter:not(.focus):not(.hover),
body.cm3-enabled.cm3-ui.advanced--animation:not(.no--animation)
    .simple-button.animate-trigger-enter:not(.focus):not(.hover) {
    animation:cm3-press-rest var(--cm3-press) var(--cm3-touch) both !important;
}
/* Dialog movement is transform-only: previous translucent popups were 'smoky'. */
body.cm3-enabled.cm3-ui:not(.no--animation) .modal.animate .modal__content {
    animation:cm3-popup var(--cm3-pop) var(--cm3-move) both !important;
}
body.cm3-enabled.cm3-ui:not(.no--animation) .modal.modal--full.animate .modal__content {
    animation:cm3-enter var(--cm3-pop) var(--cm3-move) both !important;
}
body.cm3-enabled.cm3-ui:not(.no--animation) .noty {
    transition:transform var(--cm3-nav) var(--cm3-move),opacity 125ms linear;
}
/* Optional detail motion moves just 4px: text never fades or waits for a delay. */
body.cm3-enabled.cm3-details.cm3-ui:not(.no--animation) .settings__body.cm3-settings-swap,
body.cm3-enabled.cm3-details.cm3-ui:not(.no--animation)
    .activity--active:not(.activity--load) .full-start-new__title,
body.cm3-enabled.cm3-details.cm3-ui:not(.no--animation)
    .activity--active:not(.activity--load) .full-start__title {
    animation:cm3-reveal-details var(--cm3-detail) var(--cm3-move) both;
}
/* Only controls; video image, timeline, progress & subtitles remain native. */
body.cm3-enabled.cm3-player:not(.no--animation) .player-panel {
    transition:transform var(--cm3-nav) var(--cm3-move),opacity 135ms linear;
}
body.cm3-enabled.cm3-player:not(.no--animation) .player-panel .button {
    transition:transform var(--cm3-focus) var(--cm3-touch),
               background-color var(--cm3-color) linear,
               color var(--cm3-color) linear;
}
body.cm3-enabled.cm3-player:not(.no--animation) .player-panel .button.focus {
    transform:scale(1.018);
}
body.cm3-enabled.cm3-player:not(.no--animation) .player-panel .button.animate-trigger-enter {
    animation:cm3-press-control var(--cm3-press) var(--cm3-touch) both !important;
}
body.cm3-enabled.cm3-player:not(.no--animation) .player-panel .tooltip {
    transition:opacity 100ms linear;
}
body.cm3-enabled.cm3-player:not(.no--animation) .player-panel-iptv__channel > div {
    transition:transform var(--cm3-nav) var(--cm3-move),opacity 120ms linear;
}
/* Lampa closes swipe-down sheets via Controller.back at 200ms:
   a longer exit would be cut off and look broken. */
@media screen and (max-width:480px) {
    body.cm3-enabled.cm3-ui:not(.no--animation) .selectbox.animate:not(.animate-down) .selectbox__content,
    body.cm3-enabled.cm3-ui:not(.no--animation) .settings.animate:not(.animate-down) .settings__content,
    body.cm3-enabled.cm3-ui:not(.no--animation) .modal.animate:not(.animate-down) .modal__content {
        animation:cm3-sheet-in var(--cm3-pop) var(--cm3-move) both !important;
    }
    body.cm3-enabled.cm3-ui:not(.no--animation) .selectbox.animate-down .selectbox__content,
    body.cm3-enabled.cm3-ui:not(.no--animation) .settings.animate-down .settings__content,
    body.cm3-enabled.cm3-ui:not(.no--animation) .modal.animate-down .modal__content {
        animation:cm3-sheet-out 170ms cubic-bezier(.45,0,.75,.7) both !important;
    }
}
@media (prefers-reduced-motion:reduce) {
    body.cm3-enabled.cm3-ui:not(.no--animation) .activity__body,
    body.cm3-enabled.cm3-cards:not(.no--animation) .card__view,
    body.cm3-enabled.cm3-ui:not(.no--animation) .modal__content {
        transition-duration:0ms !important;
        animation:none !important;
    }
}
`;

    function read(key, fallback) {
        try {
            var value = window.Lampa && Lampa.Storage && Lampa.Storage.field(PREFIX + key);
            return value == null ? fallback : value;
        } catch (e) { return fallback; }
    }
    function yes(value) { return value !== false && value !== 'false' && value !== '0' && value !== 0; }
    function systemReduced() { return !!(reduceMedia && reduceMedia.matches && yes(read('respect_reduced_v1',true))); }
    function clearClasses() {
        if (!document.body || !document.body.classList) return;
        for (var i=0;i<BODY_CLASSES.length;i++) document.body.classList.remove(BODY_CLASSES[i]);
    }
    function cssFor(p) {
        var vars = {
            nav:p.nav,focus:p.focus,page:p.page,popup:p.popup,press:p.press,
            color:p.color,bg:p.bg,detail:p.detail,lift:p.lift,scale:p.scale,
            springMove:springCurve(.9,10,.6,54),
            springTouch:springCurve(p.bounce,11,.6,54)
        };
        return CSS_TEXT.replace(/\{\{([A-Za-z]+)\}\}/g,function (_,key) { return String(vars[key]); });
    }
    function cancelSettings() {
        if (settingsAnim && settingsAnim.cancel) { try { settingsAnim.cancel(); } catch (e) {} }
        settingsAnim = null;
        if (settingsAnimElement && settingsAnimElement.classList)
            settingsAnimElement.classList.remove('cm3-settings-swap');
        settingsAnimElement = null;
        if (fallbackTimer) { clearTimeout(fallbackTimer); fallbackTimer = null; }
    }
    function apply() {
        if (!started || destroyed || !document.body) return;
        preset = String(read('preset_v1','silk'));
        if (preset !== 'off' && !PROFILES[preset]) preset = 'silk';
        clearClasses();
        active = preset !== 'off' && !systemReduced() &&
            !document.body.classList.contains('no--animation');
        if (!active) { cancelSettings(); return; }
        if (!style) {
            style = document.createElement('style');
            style.id = STYLE_ID;
            style.type = 'text/css';
            (document.head || document.body).appendChild(style);
        }
        if (styleKey !== preset) { style.textContent = cssFor(PROFILES[preset]); styleKey = preset; }
        document.body.classList.add('cm3-enabled');
        if (yes(read('cards_v1',true))) document.body.classList.add('cm3-cards');
        if (yes(read('navigation_v1',true))) document.body.classList.add('cm3-ui');
        if (yes(read('player_v1',true))) document.body.classList.add('cm3-player');
        if (yes(read('microdetails_v3',false))) document.body.classList.add('cm3-details');
    }
    function settingsOpen(event) {
        if (!active || !yes(read('microdetails_v3',false)) || !event || !event.body) return;
        var pane = document.querySelector && document.querySelector('.settings__body');
        if (!pane) return;
        cancelSettings();
        // No opacity: from the first frame every letter is 100% visible.
        if (typeof pane.animate === 'function') {
            try {
                settingsAnimElement = pane;
                settingsAnim = pane.animate(
                    [{transform:'translate3d(0,4px,0)'},{transform:'translate3d(0,0,0)'}],
                    {duration:PROFILES[preset].detail,easing:'cubic-bezier(.18,.82,.22,1)',fill:'none'}
                );
                return;
            } catch (e) { settingsAnim = null; }
        }
        settingsAnimElement = pane;
        pane.classList.add('cm3-settings-swap');
        fallbackTimer = setTimeout(function () {
            if (settingsAnimElement === pane) {
                pane.classList.remove('cm3-settings-swap');
                settingsAnimElement = null;
            }
        },PROFILES[preset].detail+20);
    }
    function register() {
        var api = Lampa.SettingsApi;
        api.addComponent({component:COMPONENT,name:'CAPSULE Motion',icon:
            '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2 17c4-10 5 8 10-2s7-10 10-5"/></svg>'});
        api.addParam({component:COMPONENT,param:{name:PREFIX+'preset_v1',type:'select',default:'silk',values:{
            silk:'Живой — точная физика',cloud:'Упругий — чуть больше инерции',
            cinema:'Кино — выразительные переходы',light:'Быстрый — слабые устройства',off:'Выключено'
        }},field:{name:'Стиль движений',description:'Быстрый отклик и мягкая остановка вместо замедленного затухания.'},onChange:apply});
        api.addParam({component:COMPONENT,param:{name:PREFIX+'cards_v1',type:'trigger',default:true},
            field:{name:'Карточки и постеры',description:'Лёгкая пружина и тактильные нажатия.'},onChange:apply});
        api.addParam({component:COMPONENT,param:{name:PREFIX+'navigation_v1',type:'trigger',default:true},
            field:{name:'Меню, страницы и окна',description:'Микросдвиги без дымки и исчезающего текста.'},onChange:apply});
        api.addParam({component:COMPONENT,param:{name:PREFIX+'player_v1',type:'trigger',default:true},
            field:{name:'Управление плеером',description:'Только кнопки и панель; поток и таймлайн не затрагиваются.'},onChange:apply});
        api.addParam({component:COMPONENT,param:{name:PREFIX+'microdetails_v3',type:'trigger',default:false},
            field:{name:'Микродвижение текста',description:'Необязательные 4px, без прозрачности и задержек.'},onChange:apply});
        api.addParam({component:COMPONENT,param:{name:PREFIX+'respect_reduced_v1',type:'trigger',default:true},
            field:{name:'Учитывать системное уменьшение движений'},onChange:apply});
    }
    function init() {
        if (started || destroyed || !document.body || !window.Lampa || !Lampa.SettingsApi || !Lampa.Storage) return;
        try {
            register();
            started = true;
            if (window.matchMedia) {
                reduceMedia = window.matchMedia('(prefers-reduced-motion: reduce)');
                reduceListener = function () { apply(); };
                if (reduceMedia && reduceMedia.addEventListener) reduceMedia.addEventListener('change',reduceListener);
                else if (reduceMedia && reduceMedia.addListener) reduceMedia.addListener(reduceListener);
            }
            if (Lampa.Settings && Lampa.Settings.listener && Lampa.Settings.listener.follow) {
                settingsListener = settingsOpen;
                Lampa.Settings.listener.follow('open',settingsListener);
                settingsListenerAttached = true;
            }
            apply();
        } catch (error) {
            clearClasses();
            if (window.console && console.error) console.error('[CAPSULE Motion] init failed',error);
        }
    }
    function boot() {
        if (started || destroyed) return;
        if (window.Lampa && Lampa.Listener && Lampa.SettingsApi && document.body) {
            if (window.appready) return init();
            if (!appListenerAttached && Lampa.Listener.follow) {
                appListener = function (e) { if (e && e.type === 'ready') init(); };
                Lampa.Listener.follow('app',appListener);
                appListenerAttached = true;
            }
            if (window.appready) init();
        } else if (++bootAttempts < 120) bootTimer = setTimeout(boot,100);
    }
    window[KEY] = {
        version:VERSION,
        apply:apply,
        status:function () {
            return {version:VERSION,preset:preset,initialized:started,
                active:!!(active && document.body && !document.body.classList.contains('no--animation')),
                springCssSupported:!!(window.CSS && window.CSS.supports && window.CSS.supports('transition-timing-function','linear(0, 1)')),
                reducedMotion:systemReduced(),scrollDuration:SCROLL_MS};
        },
        stop:function () {
            destroyed = true;
            if (bootTimer) clearTimeout(bootTimer);
            cancelSettings();
            if (reduceMedia && reduceListener) {
                if (reduceMedia.removeEventListener) reduceMedia.removeEventListener('change',reduceListener);
                else if (reduceMedia.removeListener) reduceMedia.removeListener(reduceListener);
            }
            if (appListenerAttached && appListener && window.Lampa && Lampa.Listener && Lampa.Listener.remove)
                Lampa.Listener.remove('app',appListener);
            if (settingsListenerAttached && settingsListener && window.Lampa && Lampa.Settings && Lampa.Settings.listener && Lampa.Settings.listener.remove)
                Lampa.Settings.listener.remove('open',settingsListener);
            clearClasses();
            if (style && style.parentNode) style.parentNode.removeChild(style);
            style = null;
            if (started && window.Lampa && Lampa.SettingsApi && Lampa.SettingsApi.removeComponent)
                Lampa.SettingsApi.removeComponent(COMPONENT);
            if (window[KEY] === this) delete window[KEY];
        }
    };
    boot();
})();
