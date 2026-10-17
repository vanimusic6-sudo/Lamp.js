/*
 * CAPSULE Motion 2.0.0 — Lampa kinetic motion system.
 * Independent plugin; no Lampa core overrides, no external dependencies.
 * Designed from Lampa's animation.scss, interaction/scroll.js, modal.js,
 * select.js, settings.js, controller.js and Fluent/Material motion principles.
 * Project: CAPSULE. Released under GPL-2.0-or-later.
 */
(function () {
    'use strict';

    var VERSION = '2.0.0';
    var KEY = 'capsule_motion_runtime';
    var OLD = window[KEY];
    // Same-URL updates must replace an already running 1.x plugin, not layer
    // two conflicting stylesheets and duplicate settings on top of each other.
    if (OLD) {
        if (OLD.version === VERSION) return;
        if (!OLD.stop || typeof OLD.stop !== 'function') return;
        try { OLD.stop(); } catch (e) { return; }
    }

    var PREFIX = 'capsule_motion_';
    var COMPONENT = 'capsule_motion';
    var STYLE_ID = 'capsule-motion-styles-v2';
    // Durations are intentionally differentiated: short responses remain
    // responsive; surfaces take longer. Lampa's scrolling ALWAYS stays at 300ms
    // because interaction/scroll.js uses time-dependent transition callbacks.
    var PRESETS = {
        silk:  { nav: 545, focus: 465, page: 535, popup: 560, surface: 690, color: 245, press: 360, detail: 565, float: '-.20em' },
        cloud: { nav: 680, focus: 550, page: 670, popup: 690, surface: 820, color: 300, press: 420, detail: 690, float: '-.24em' },
        cinema:{ nav: 625, focus: 480, page: 615, popup: 665, surface: 800, color: 260, press: 365, detail: 635, float: '-.19em' },
        light: { nav: 300, focus: 270, page: 325, popup: 320, surface: 400, color: 150, press: 245, detail: 300, float: '-.12em' }
    };
    var CLASSES = [
        'capsule-motion-on','capsule-motion-cards', 'capsule-motion-navigation',
        'capsule-motion-player','capsule-motion-details','capsule-motion-respect-reduced'
    ];
    var active = false;
    var started = false;
    var destroyed = false;
    var style = null;
    var stylePreset = null;
    var selectedPreset = 'silk';
    var initTimer = 0;
    var retries = 0;
    var media = null;
    var mediaListener = null;
    var appListener = null;
    var settingsListener = null;
    var appListenerBound = false;
    var settingsListenerBound = false;
    var lastSwapElement = null;
    var lastSwapAnimation = null;
    var swapSerial = 0;

    // Real damped second-order system, sampled once at initialization into a
    // CSS linear() easing. Physical response starts at zero velocity, then
    // slows gradually. Old TV WebViews use the cubic-bezier fallback instead.
    function physicalCurve(zeta, frequency, count) {
        var wd = frequency * Math.sqrt(1 - zeta*zeta);
        function value(t) {
            return 1 - Math.exp(-zeta*frequency*t) *
                (Math.cos(wd*t) + (zeta*frequency/wd)*Math.sin(wd*t));
        }
        var finalValue = value(1);
        var stops = [];
        for (var i=0; i<=count; i++) {
            var progress = i / count;
            var v = value(progress) / finalValue;
            // At most ~0.2% overshoot for a refined, non-bouncy settle.
            v = Math.max(0, Math.min(1.003, v));
            stops.push(Number(v.toFixed(5)) + ' ' + Number((progress * 100).toFixed(3)) + '%');
        }
        return 'linear(' + stops.join(',') + ')';
    }

    var STYLES = `
/* CSS-only fallback for TVs; progressive spring easing below for newer WebViews. */
body.capsule-motion-on {
    --cm-enter: cubic-bezier(.42,0,.42,1);
    --cm-focus: cubic-bezier(.40,0,.43,1);
    --cm-exit: cubic-bezier(.4,.05,.7,.7);
    --cm-navigation-ms: {{nav}}ms;
    --cm-focus-ms: {{focus}}ms;
    --cm-page-ms: {{page}}ms;
    --cm-pop-ms: {{popup}}ms;
    --cm-surface-ms: {{surface}}ms;
    --cm-color-ms: {{color}}ms;
    --cm-press-ms: {{press}}ms;
    --cm-detail-ms: {{detail}}ms;
    --cm-lift: {{float}};
}
@supports (animation-timing-function: linear(0, 1)) {
    body.capsule-motion-on {
        --cm-enter: {{springEnter}};
        --cm-focus: {{springFocus}};
    }
}
@keyframes cm-page {
    0% { opacity:.46; transform:translate3d(0, 1.4em,0); }
    100% { opacity:1; transform:translate3d(0,0,0); }
}
@keyframes cm-reveal {
    0% {opacity:0; transform:translate3d(0, .65em, 0);}
    100% {opacity:1; transform:translate3d(0,0,0);}
}
@keyframes cm-reveal-opacity {from {opacity:.3;} to {opacity:1;} }
@keyframes cm-dialog {
    0% {opacity:0;transform:translate3d(0,1.6em,0) scale(.976);}
    100% {opacity:1;transform:translate3d(0,0,0) scale(1);}
}
@keyframes cm-sheet {
    from { transform:translate3d(0,32%,0);opacity:.65; }
    to { transform:translate3d(0,0,0);opacity:1; }
}
@keyframes cm-sheet-out {
    from { transform:translate3d(0,0,0);opacity:1; }
    to { transform:translate3d(0,100%,0);opacity:.85; }
}
@keyframes cm-focus-ring { from {opacity:0;} to {opacity:1;} }
/* Match focus state on frame zero and last frame: no snapping after a press. */
@keyframes cm-press-card {
    0% {transform:translate3d(0,var(--cm-lift),0) scale(1.012);}
    43% {transform:translate3d(0,0,0) scale(.972);}
    76% {transform:translate3d(0,var(--cm-lift),0) scale(1.004);}
    100% {transform:translate3d(0,var(--cm-lift),0) scale(1.012);}
}
@keyframes cm-press-scale {
    0%,100% {transform:scale(1.022);}
    45% {transform:scale(.965);}
    77% {transform:scale(1.008);}
}
@keyframes cm-press-row {
    0%,100% {transform:translate3d(.12em,0,0);}
    45% {transform:translate3d(.04em,0,0) scale(.982);}
    78% {transform:translate3d(.11em,0,0);}
}
@keyframes cm-press-rest {
    0%,100% {transform:scale(1);}
    44% {transform:scale(.968);}
    78% {transform:scale(1.01);}
}
@keyframes cm-veil {from {opacity:0;} to {opacity:1;} }

/* NAVIGATION — no changes to actual positions, z-index or input routing. */
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .wrap__left,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .wrap__content,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .settings__content,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .selectbox__content {
    transition-property:transform;
    transition-duration:var(--cm-navigation-ms);
    transition-timing-function:var(--cm-enter);
}
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .activity,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .activity__body {
    transition:opacity var(--cm-page-ms) ease-in-out;
}
/* Lampa applies animation-activity (200ms) only when advanced animation is on. */
body.capsule-motion-on.capsule-motion-navigation.advanced--animation:not(.no--animation)
    .activity:not(.activity--load) .activity__body {
    animation:none !important;
}
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation)
    .activity.activity--active:not(.activity--load) .activity__body {
    animation:cm-page var(--cm-page-ms) var(--cm-enter) backwards !important;
}
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .background {
    transition:opacity var(--cm-surface-ms) ease-in-out;
}
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .background__one,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .background__two,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .background__fade,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .full-start__background {
    transition:opacity var(--cm-surface-ms) ease-in-out;
}
body.capsule-motion-on.capsule-motion-navigation.advanced--animation:not(.no--animation)
    .full-start__background.loaded {animation:none !important;}
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .full-start-new__img {
    transition:opacity var(--cm-surface-ms) ease-in-out,
    transform var(--cm-page-ms) var(--cm-enter);
}
/* TV uses -webkit-transform inline. KEEP EXACTLY 300ms, for onAnimateEnd. */
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation)
    .scroll__body:not(.notransition):not(.transition-reset) {
    transition:transform 300ms var(--cm-enter),-webkit-transform 300ms var(--cm-enter);
}
/* Instant touch drag & Lampa's immediate() ALWAYS override normal easing. */
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation)
    .scroll__body.notransition,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation)
    .scroll__body.transition-reset {transition:none !important;}

/* CARDS — lift on inner view; image masks, grid geometry, data unchanged. */
body.capsule-motion-on.capsule-motion-cards:not(.no--animation) .card,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .settings-folder,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .settings-param,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .selectbox-item {
    will-change:auto; /* native Lampa keeps layers alive on entire catalogs */
}
body.capsule-motion-on.capsule-motion-cards:not(.no--animation) .card__view,
body.capsule-motion-on.capsule-motion-cards:not(.no--animation) .card-more__box,
body.capsule-motion-on.capsule-motion-cards:not(.no--animation) .card-episode .full-episode,
body.capsule-motion-on.capsule-motion-cards:not(.no--animation) .explorer-card__head-img {
    transition:transform var(--cm-focus-ms) var(--cm-focus);
}
body.capsule-motion-on.capsule-motion-cards:not(.no--animation) .card.focus .card__view,
body.capsule-motion-on.capsule-motion-cards:not(.no--animation) .card.hover .card__view,
body.capsule-motion-on.capsule-motion-cards:not(.no--animation) .card-more.focus .card-more__box,
body.capsule-motion-on.capsule-motion-cards:not(.no--animation) .card-episode.focus .full-episode,
body.capsule-motion-on.capsule-motion-cards:not(.no--animation) .explorer-card__head-img.focus {
    transform:translate3d(0,var(--cm-lift),0) scale(1.012);
}
body.capsule-motion-on.capsule-motion-cards:not(.no--animation) .card--wide.focus .card__view,
body.capsule-motion-on.capsule-motion-cards:not(.no--animation) .card--wide.hover .card__view {
    transform:translate3d(0,-.10em,0) scale(1.006);
}
body.capsule-motion-on.capsule-motion-cards:not(.no--animation) .card.focus .card__view::after,
body.capsule-motion-on.capsule-motion-cards:not(.no--animation) .card.hover .card__view::after,
body.capsule-motion-on.capsule-motion-cards:not(.no--animation) .card-more.focus .card-more__box::after,
body.capsule-motion-on.capsule-motion-cards:not(.no--animation) .card-episode.focus .full-episode::after {
    animation:cm-focus-ring var(--cm-color-ms) ease-out both;
}
/* Native 200ms focus jump / bounce must NEVER run on the same element. */
body.capsule-motion-on.capsule-motion-cards.advanced--animation:not(.no--animation)
    .card:not(.card--wide).focus .card__view,
body.capsule-motion-on.capsule-motion-cards.advanced--animation:not(.no--animation)
    .card:not(.card--wide).hover .card__view,
body.capsule-motion-on.capsule-motion-cards.advanced--animation:not(.no--animation)
    .card-episode.focus .full-episode,
body.capsule-motion-on.capsule-motion-cards.advanced--animation:not(.no--animation)
    .explorer-card__head-img.focus {animation:none !important;}
body.capsule-motion-on.capsule-motion-cards.advanced--animation:not(.no--animation)
    .card:not(.card--wide).animate-trigger-enter .card__view {
    animation:cm-press-card var(--cm-press-ms) var(--cm-focus) both !important;
}
body.capsule-motion-on.capsule-motion-cards.advanced--animation:not(.no--animation)
    .card-episode.animate-trigger-enter .full-episode,
body.capsule-motion-on.capsule-motion-cards.advanced--animation:not(.no--animation)
    .explorer-card__head-img.animate-trigger-enter {
    animation:cm-press-card var(--cm-press-ms) var(--cm-focus) both !important;
}

/* CONTROLS — transition *colors* and *position* without changing the colorway. */
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
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .torrent-item,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .season-episode,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .feed-item {
    transition:transform var(--cm-focus-ms) var(--cm-focus),
        background-color var(--cm-color-ms) ease-in-out,
        color var(--cm-color-ms) ease-in-out;
}
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .menu__item.focus,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .menu__item.hover,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .settings-folder.focus,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .settings-param.focus,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .selectbox-item.focus,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .torrent-item.focus,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .search-source.focus,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .search-history-key.focus,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .full-review.focus {
    transform:translate3d(.12em,0,0);
}
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .head__action.focus,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .head__action.hover,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .navigation-tabs__button.focus,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .navigation-bar__item.focus,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .full-start__button.focus,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .simple-button.focus,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .modal__button.focus,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .hg-button.focus,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .tag-count.focus,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .full-descr__tag.focus,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .full-review-add.focus {
    transform:scale(1.022);
}
/* Kill EVERY stock advanced bounce on our targets, otherwise 200ms punches
   through the smoother CSS transitions, causing the 'too sharp' report. */
body.capsule-motion-on.capsule-motion-navigation.advanced--animation:not(.no--animation)
    .head__action.focus:not(.animate-trigger-enter),
body.capsule-motion-on.capsule-motion-navigation.advanced--animation:not(.no--animation)
    .menu__item.focus:not(.animate-trigger-enter),
body.capsule-motion-on.capsule-motion-navigation.advanced--animation:not(.no--animation)
    .full-start__button.focus:not(.animate-trigger-enter),
body.capsule-motion-on.capsule-motion-navigation.advanced--animation:not(.no--animation)
    .simple-button.focus:not(.animate-trigger-enter),
body.capsule-motion-on.capsule-motion-navigation.advanced--animation:not(.no--animation)
    .torrent-item.focus:not(.animate-trigger-enter),
body.capsule-motion-on.capsule-motion-navigation.advanced--animation:not(.no--animation)
    .tag-count.focus:not(.animate-trigger-enter),
body.capsule-motion-on.capsule-motion-navigation.advanced--animation:not(.no--animation)
    .full-descr__tag.focus:not(.animate-trigger-enter),
body.capsule-motion-on.capsule-motion-navigation.advanced--animation:not(.no--animation)
    .full-review.focus:not(.animate-trigger-enter),
body.capsule-motion-on.capsule-motion-navigation.advanced--animation:not(.no--animation)
    .full-review-add.focus:not(.animate-trigger-enter),
body.capsule-motion-on.capsule-motion-navigation.advanced--animation:not(.no--animation)
    .settings-folder.focus .settings-folder__icon,
body.capsule-motion-on.capsule-motion-navigation.advanced--animation:not(.no--animation)
    .full-person.focus .full-person__photo {animation:none !important;}
body.capsule-motion-on.capsule-motion-navigation.advanced--animation:not(.no--animation)
    .menu__item.animate-trigger-enter,
body.capsule-motion-on.capsule-motion-navigation.advanced--animation:not(.no--animation)
    .torrent-item.animate-trigger-enter,
body.capsule-motion-on.capsule-motion-navigation.advanced--animation:not(.no--animation)
    .full-review.animate-trigger-enter {
    animation:cm-press-row var(--cm-press-ms) var(--cm-focus) both !important;
}
body.capsule-motion-on.capsule-motion-navigation.advanced--animation:not(.no--animation)
    .head__action.animate-trigger-enter,
body.capsule-motion-on.capsule-motion-navigation.advanced--animation:not(.no--animation)
    .full-start__button.animate-trigger-enter,
body.capsule-motion-on.capsule-motion-navigation.advanced--animation:not(.no--animation)
    .simple-button.animate-trigger-enter,
body.capsule-motion-on.capsule-motion-navigation.advanced--animation:not(.no--animation)
    .tag-count.animate-trigger-enter,
body.capsule-motion-on.capsule-motion-navigation.advanced--animation:not(.no--animation)
    .full-descr__tag.animate-trigger-enter,
body.capsule-motion-on.capsule-motion-navigation.advanced--animation:not(.no--animation)
    .full-review-add.animate-trigger-enter {
    animation:cm-press-scale var(--cm-press-ms) var(--cm-focus) both !important;
}

/* Touch taps may be dispatched without TV focus. Start those at rest. */
body.capsule-motion-on.capsule-motion-navigation.advanced--animation:not(.no--animation)
    .head__action.animate-trigger-enter:not(.focus):not(.hover),
body.capsule-motion-on.capsule-motion-navigation.advanced--animation:not(.no--animation)
    .full-start__button.animate-trigger-enter:not(.focus):not(.hover),
body.capsule-motion-on.capsule-motion-navigation.advanced--animation:not(.no--animation)
    .simple-button.animate-trigger-enter:not(.focus):not(.hover) {
    animation:cm-press-rest var(--cm-press-ms) var(--cm-focus) both !important;
}
/* DIALOGS — opacity + limited translation instead of abrupt scale/jump. */
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .modal.animate .modal__content {
    animation:cm-dialog var(--cm-pop-ms) var(--cm-enter) both !important;
}
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .modal.modal--full.animate .modal__content {
    animation:cm-page var(--cm-pop-ms) var(--cm-enter) both !important;
}
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .modal.animate {
    animation:cm-veil var(--cm-color-ms) ease-in-out both;
}
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .settings.animate .settings__layer,
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .selectbox.animate .selectbox__layer {
    animation:cm-veil var(--cm-color-ms) ease-in-out both;
}
body.capsule-motion-on.capsule-motion-navigation:not(.no--animation) .noty {
    transition:transform var(--cm-navigation-ms) var(--cm-enter),
               opacity var(--cm-navigation-ms) ease-in-out;
}

/* Interior choreography: stage information in consistent reading order. */
body.capsule-motion-on.capsule-motion-details.capsule-motion-navigation:not(.no--animation)
    .activity--active:not(.activity--load) .full-start-new__title,
body.capsule-motion-on.capsule-motion-details.capsule-motion-navigation:not(.no--animation)
    .activity--active:not(.activity--load) .full-start__title {
    animation:cm-reveal var(--cm-detail-ms) var(--cm-enter) 35ms both;
}
body.capsule-motion-on.capsule-motion-details.capsule-motion-navigation:not(.no--animation)
    .activity--active:not(.activity--load) .full-start-new__details,
body.capsule-motion-on.capsule-motion-details.capsule-motion-navigation:not(.no--animation)
    .activity--active:not(.activity--load) .full-start__deta {
    animation:cm-reveal var(--cm-detail-ms) var(--cm-enter) 95ms both;
}
body.capsule-motion-on.capsule-motion-details.capsule-motion-navigation:not(.no--animation)
    .activity--active:not(.activity--load) .full-start-new__buttons,
body.capsule-motion-on.capsule-motion-details.capsule-motion-navigation:not(.no--animation)
    .activity--active:not(.activity--load) .full-start__buttons {
    animation:cm-reveal var(--cm-detail-ms) var(--cm-enter) 145ms both;
}
body.capsule-motion-on.capsule-motion-details.capsule-motion-navigation:not(.no--animation)
    .modal.animate .modal__head {
    animation:cm-reveal-opacity var(--cm-detail-ms) ease-in-out 55ms both;
}
body.capsule-motion-on.capsule-motion-details.capsule-motion-navigation:not(.no--animation)
    .modal.animate .modal__footer {
    animation:cm-reveal-opacity var(--cm-detail-ms) ease-in-out 125ms both;
}
/* A settings subsection is replaced via DOM, so old UI ordinarily snaps to
   new content. A lightweight JS settings.open listener animates only opacity. */
body.capsule-motion-on.capsule-motion-details.capsule-motion-navigation:not(.no--animation)
    .settings__body.cm-settings-swap {
    animation:cm-reveal-opacity var(--cm-detail-ms) ease-in-out both;
}

/* PLAYER controls only. No video, timeline, progress, subtitles or audio. */
body.capsule-motion-on.capsule-motion-player:not(.no--animation) .player-panel {
    transition:transform var(--cm-navigation-ms) var(--cm-enter),
               opacity var(--cm-navigation-ms) ease-in-out;
}
body.capsule-motion-on.capsule-motion-player:not(.no--animation) .player-panel .button {
    transition:transform var(--cm-focus-ms) var(--cm-focus),
               background-color var(--cm-color-ms) ease-in-out,
               color var(--cm-color-ms) ease-in-out;
}
body.capsule-motion-on.capsule-motion-player:not(.no--animation) .player-panel .button.focus {
    transform:scale(1.022);
}
body.capsule-motion-on.capsule-motion-player:not(.no--animation) .player-panel .button.animate-trigger-enter {
    animation:cm-press-scale var(--cm-press-ms) var(--cm-focus) both !important;
}
body.capsule-motion-on.capsule-motion-player:not(.no--animation) .player-panel .tooltip {
    transition:opacity var(--cm-color-ms) ease-in-out;
}
body.capsule-motion-on.capsule-motion-player:not(.no--animation) .player-panel-iptv__channel > div {
    transition:transform var(--cm-navigation-ms) var(--cm-enter),
               opacity var(--cm-navigation-ms) ease-in-out;
}

/* Lampa calls Controller.back() 200ms after mobile swipe-down. Exit must
   COMPLETE by that deadline, whatever the selected entrance duration is. */
@media screen and (max-width: 480px) {
    body.capsule-motion-on.capsule-motion-navigation:not(.no--animation)
        .selectbox.animate:not(.animate-down) .selectbox__content,
    body.capsule-motion-on.capsule-motion-navigation:not(.no--animation)
        .settings.animate:not(.animate-down) .settings__content,
    body.capsule-motion-on.capsule-motion-navigation:not(.no--animation)
        .modal.animate:not(.animate-down) .modal__content {
        animation:cm-sheet var(--cm-pop-ms) var(--cm-enter) both !important;
    }
    body.capsule-motion-on.capsule-motion-navigation:not(.no--animation)
        .selectbox.animate-down .selectbox__content,
    body.capsule-motion-on.capsule-motion-navigation:not(.no--animation)
        .settings.animate-down .settings__content,
    body.capsule-motion-on.capsule-motion-navigation:not(.no--animation)
        .modal.animate-down .modal__content {
        animation:cm-sheet-out 175ms var(--cm-exit) both !important;
    }
}
/* Respect user/system accessibility and Lampa's native no--animation. */
@media (prefers-reduced-motion: reduce) {
    body.capsule-motion-on.capsule-motion-respect-reduced:not(.no--animation) .activity__body,
    body.capsule-motion-on.capsule-motion-respect-reduced:not(.no--animation) .card__view,
    body.capsule-motion-on.capsule-motion-respect-reduced:not(.no--animation) .modal__content,
    body.capsule-motion-on.capsule-motion-respect-reduced:not(.no--animation) .settings__content,
    body.capsule-motion-on.capsule-motion-respect-reduced:not(.no--animation) .selectbox__content,
    body.capsule-motion-on.capsule-motion-respect-reduced:not(.no--animation) .scroll__body {
        animation:none !important;transition-duration:0ms !important;
    }
}
`;

    function log(message) {
        if (window.console && console.log) console.log('[CAPSULE Motion] ' + message);
    }
    function read(name, fallback) {
        try {
            var value = window.Lampa && Lampa.Storage && Lampa.Storage.field(PREFIX+name);
            return value == null ? fallback : value;
        } catch (e) { return fallback; }
    }
    function enabled(value) {
        return value !== false && value !== 'false' && value !== 0 && value !== '0';
    }
    function reduced() {
        return !!(media && media.matches && enabled(read('respect_reduced_v1',true)));
    }
    function clean() {
        if (!document.body) return;
        for (var i=0;i<CLASSES.length;i++) document.body.classList.remove(CLASSES[i]);
    }
    function renderCss(profile) {
        var replacements = {
            nav:profile.nav,focus:profile.focus,page:profile.page,popup:profile.popup,
            surface:profile.surface,color:profile.color,press:profile.press,
            detail:profile.detail,float:profile.float,
            springEnter:physicalCurve(.96,4.2,30),
            springFocus:physicalCurve(.95,3.5,30)
        };
        return STYLES.replace(/\{\{([a-zA-Z]+)\}\}/g,function (_,key) {
            return String(replacements[key]);
        });
    }
    function cancelSwap() {
        swapSerial++;
        if (lastSwapAnimation && lastSwapAnimation.cancel) {
            try { lastSwapAnimation.cancel(); } catch (e) {}
        }
        lastSwapAnimation = null;
        if (lastSwapElement && lastSwapElement.classList)
            lastSwapElement.classList.remove('cm-settings-swap');
        lastSwapElement = null;
    }
    function apply() {
        if (!started || destroyed || !document.body) return;
        selectedPreset = String(read('preset_v1','silk'));
        if (selectedPreset !== 'off' && !PRESETS[selectedPreset]) selectedPreset = 'silk';
        clean();
        active = selectedPreset !== 'off' && !reduced() &&
                 !document.body.classList.contains('no--animation');
        if (!active) {cancelSwap();return;}
        if (!style) {
            style = document.createElement('style');
            style.id = STYLE_ID;
            style.type = 'text/css';
            (document.head||document.body).appendChild(style);
        }
        if (stylePreset !== selectedPreset) {
            style.textContent = renderCss(PRESETS[selectedPreset]);
            stylePreset = selectedPreset;
        }
        document.body.classList.add('capsule-motion-on');
        if (enabled(read('cards_v1',true))) document.body.classList.add('capsule-motion-cards');
        if (enabled(read('navigation_v1',true))) document.body.classList.add('capsule-motion-navigation');
        if (enabled(read('player_v1',true))) document.body.classList.add('capsule-motion-player');
        if (enabled(read('details_v2',true))) document.body.classList.add('capsule-motion-details');
        if (enabled(read('respect_reduced_v1',true))) document.body.classList.add('capsule-motion-respect-reduced');
    }
    function settingsOpen(event) {
        if (!active || !enabled(read('details_v2',true)) || !enabled(read('navigation_v1',true))) return;
        if (!event || !event.body) return;
        // Lampa removes/reattaches settings subcomponents when switching. Do not
        // touch scroll or focus; animate only the content host's opacity.
        var pane = document.querySelector && document.querySelector('.settings__body');
        if (!pane || !pane.classList) return;
        var ongoing = lastSwapAnimation && lastSwapElement === pane;
        var fromOpacity = .52;
        if (ongoing && window.getComputedStyle) {
            try {
                fromOpacity = Math.max(.52, Math.min(1, parseFloat(window.getComputedStyle(pane).opacity) || .52));
            } catch (e) {}
        }
        cancelSwap();
        var serial = swapSerial;
        // Prefer Web Animations API (interruptible from current visual state).
        if (typeof pane.animate === 'function') {
            try {
                lastSwapElement = pane;
                lastSwapAnimation = pane.animate(
                    [{opacity:fromOpacity},{opacity:1}],
                    {duration: PRESETS[selectedPreset].detail, easing:'cubic-bezier(.42,0,.42,1)', fill:'none'}
                );
                return;
            } catch (e) { lastSwapAnimation = null; }
        }
        // Fallback for old TV engines: only one class-based opacity animation.
        // Remove class after event; no layout reading and no frame loop.
        lastSwapElement = pane;
        pane.classList.add('cm-settings-swap');
        var duration = PRESETS[selectedPreset].detail;
        setTimeout(function () {
            if (serial === swapSerial && lastSwapElement === pane) {
                pane.classList.remove('cm-settings-swap');
                lastSwapElement = null;
            }
        }, duration+20);
    }
    function register() {
        var api = Lampa.SettingsApi;
        api.addComponent({
            component:COMPONENT, name:'CAPSULE Motion',
            icon:'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><path d="M3 16c4-12 7 12 12 0s5-6 6-8"/><circle cx="5" cy="8" r="1"/></svg>'
        });
        api.addParam({
            component:COMPONENT,
            param:{name:PREFIX+'preset_v1',type:'select',default:'silk',values:{
                silk:'Шёлк — мягко и естественно',
                cloud:'Облако — максимально мягко',
                cinema:'Кино — плавные большие переходы',
                light:'Лёгкий — слабые устройства',
                off:'Выключено (стандартная Lampa)'
            }},
            field:{name:'Плавность интерфейса',description:'Натуральные траектории, без резких ускорений и скачков.'},
            onChange:apply
        });
        api.addParam({component:COMPONENT,param:{name:PREFIX+'cards_v1',type:'trigger',default:true},
            field:{name:'Карточки и постеры',description:'Мягкий фокус, нажатие и затухание рамки.'},onChange:apply});
        api.addParam({component:COMPONENT,param:{name:PREFIX+'navigation_v1',type:'trigger',default:true},
            field:{name:'Меню, страницы и диалоги',description:'Переходы, боковое меню, шторки и TV-прокрутка.'},onChange:apply});
        api.addParam({component:COMPONENT,param:{name:PREFIX+'details_v2',type:'trigger',default:true},
            field:{name:'Появление текста и элементов',description:'Мягкая последовательная анимация деталей и настроек.'},onChange:apply});
        api.addParam({component:COMPONENT,param:{name:PREFIX+'player_v1',type:'trigger',default:true},
            field:{name:'Элементы видеоплеера',description:'Анимация панели без влияния на видео и звук.'},onChange:apply});
        api.addParam({component:COMPONENT,param:{name:PREFIX+'respect_reduced_v1',type:'trigger',default:true},
            field:{name:'Учитывать уменьшение движения в системе'},onChange:apply});
    }
    function init() {
        if (started || destroyed) return;
        if (!window.Lampa || !Lampa.Storage || !Lampa.SettingsApi || !document.body) return;
        try {
            register();
            started = true;
            if (window.matchMedia) {
                media = window.matchMedia('(prefers-reduced-motion: reduce)');
                mediaListener = function () { apply(); };
                if (media.addEventListener) media.addEventListener('change',mediaListener);
                else if (media.addListener) media.addListener(mediaListener);
            }
            if (Lampa.Settings && Lampa.Settings.listener && Lampa.Settings.listener.follow) {
                settingsListener = settingsOpen;
                Lampa.Settings.listener.follow('open',settingsListener);
                settingsListenerBound = true;
            }
            apply();
            log('v'+VERSION+' initialized — '+selectedPreset);
        } catch (error) {
            clean();
            log('Initialization error: '+String(error&&error.message||error));
        }
    }
    function boot() {
        if (started || destroyed) return;
        if (window.Lampa && Lampa.Listener && Lampa.SettingsApi && document.body) {
            if (window.appready) return init();
            if (!appListenerBound) {
                appListener = function (event) { if (event && event.type === 'ready') init(); };
                Lampa.Listener.follow('app',appListener);
                appListenerBound = true;
            }
            if (window.appready) init();
        } else if (retries++ < 120) initTimer = setTimeout(boot,100);
        else log('Lampa APIs not ready; plugin not installed');
    }
    window[KEY] = {
        version:VERSION, apply:apply,
        status:function () {
            return {version:VERSION,initialized:started,preset:selectedPreset,active:active,
                physicalEasingSupported:!!(window.CSS && window.CSS.supports && window.CSS.supports('animation-timing-function','linear(0, 1)')),
                reducedMotion:reduced(), nativeAnimationDisabled:!!(document.body&&document.body.classList.contains('no--animation'))};
        },
        stop:function () {
            destroyed = true;
            if (initTimer) clearTimeout(initTimer);
            cancelSwap();
            if (media && mediaListener) {
                if (media.removeEventListener) media.removeEventListener('change',mediaListener);
                else if (media.removeListener) media.removeListener(mediaListener);
            }
            if (appListenerBound && appListener && Lampa.Listener && Lampa.Listener.remove)
                Lampa.Listener.remove('app',appListener);
            if (settingsListenerBound && settingsListener && Lampa.Settings && Lampa.Settings.listener && Lampa.Settings.listener.remove)
                Lampa.Settings.listener.remove('open',settingsListener);
            clean();
            if (style && style.parentNode) style.parentNode.removeChild(style);
            style = null;
            stylePreset = null;
            if (started && Lampa.SettingsApi && Lampa.SettingsApi.removeComponent)
                Lampa.SettingsApi.removeComponent(COMPONENT);
            delete window[KEY];
        }
    };
    boot();
})();