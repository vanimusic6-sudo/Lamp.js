/*
 * CAPSULE Motion 9.1.0 — device-specific kinetic motion / gentle liquid feedback.
 * Copyright (c) 2026 CAPSULE. GPL-2.0-or-later.
 *
 * Rebuilt after studying Lampa's activity, settings, selectbox, modal, scroll
 * lifecycle and the recorded mobile regression in normal (non-light) mode.
 * No Lampa controller patches; scrolling contract and playback are untouched.
 */
(function () {
    'use strict';
    var VERSION='9.1.0', KEY='capsule_motion_runtime', COMPONENT='capsule_motion';
    var existing=window[KEY];
    if(existing){
        if(existing.version===VERSION)return;
        if(typeof existing.stop!=='function')return;
        try {existing.stop();} catch(e){return;}
    }

    // One carefully tuned motion language. Modes were slowing everything down;
    // keep motion tuning internal and expose only a single on/off setting.
    // One toggle; separate physical tuning for television and handheld devices.
    // On TVs the visual focus travels further and has more presence; on phones
    // actions respond quickly and sheets have pronounced (but short) settling.
    var phoneMotion={focus:285,press:245,scene:350,popup:405,bounce:.71,warp:.043};
    var tvMotion={focus:385,press:195,scene:325,popup:340,bounce:.79,warp:.047};
    var initialized=false, active=false, reduced=false, destroyed=false;
    var style=null, cursor=null, cursorAnim=null, cursorTarget=null, raf=0;
    var observer=null, media=null, mediaListener=null, appListener=null, bootTimer=0, bootTries=0;
    var subs=[], timers=new Set(), animations=new Set(), recentAction=null;
    var tabPills=new Map(), tabRaf=0, navToken=0, overlayMorph=null;
    var settingsRegistered=false, lastPage=null;
    var modalMetrics=new WeakMap(), leavingWindows=new Set();
    var panelOpens=new WeakMap(), exitCount=0, modalExitCount=0;
    var sheetExits=new Map(), sheetEntries=new Map(), menuAnim=null, swipeSheetUntil=new Map();
    var swipeModal=new WeakSet(), modalSwipeAnimations=new WeakMap(), lastActivityAt=0;
    var focusShine=null, shineAnimation=null, shineWait=0, longAnimations=new WeakMap();
    var latestTouch=null, touchHold=null, touchHoldStart=null;
    var interactionCounts={tvLong:0,shine:0,phoneHolds:0};

    function get(name,fallback){try{var v=Lampa.Storage.get('capsule_motion_'+name,fallback);return v==null?fallback:v;}catch(e){return fallback;}}
    // Upgrade: preserve an explicitly disabled old preset until user changes the switch.
    // The old per-feature toggles no longer fragment the animation system.
    function enabledSetting(){
        var setting=get('enabled',null);
        if(setting===null||typeof setting==='undefined')return String(get('mode','fluid'))!=='off';
        return setting===true||setting==='true'||setting===1;
    }
    function flag(name){return name==='enabled'?enabledSetting():true;}
    function tvMode(){
        try{if(window.Lampa&&Lampa.Platform&&Lampa.Platform.screen){
            if(Lampa.Platform.screen('tv'))return true;
            if(Lampa.Platform.screen('mobile'))return false;
        }}catch(e){}
        // Browser fallback: avoid treating large landscape phones as TVs.
        return innerWidth>740 && !!(window.matchMedia&&matchMedia('(hover: hover) and (pointer: fine)').matches);
    }
    function p(){return tvMode()?tvMotion:phoneMotion;}
    function now(){return window.performance&&performance.now?performance.now():Date.now();}
    function clamp(x,a,b){return Math.max(a,Math.min(b,x));}
    function timeout(fn,ms){var id=setTimeout(function(){timers.delete(id);fn();},ms);timers.add(id);return id;}
    function clearTimers(){timers.forEach(function(id){clearTimeout(id);});timers.clear();}
    function later(fn){return typeof requestAnimationFrame==='function'?requestAnimationFrame(fn):timeout(fn,16);}
    function cancelLater(id){if(!id)return;if(typeof cancelAnimationFrame==='function')cancelAnimationFrame(id);clearTimeout(id);timers.delete(id);}
    function visibleRect(node){
        if(!node||!node.isConnected||!node.getBoundingClientRect)return null;
        var r=node.getBoundingClientRect();
        if(!isFinite(r.left)||!isFinite(r.width)||r.width<3||r.height<3)return null;
        return {left:r.left,top:r.top,width:r.width,height:r.height,right:r.right,bottom:r.bottom};
    }
    function onscreen(r){return !!r&&r.right>0&&r.left<innerWidth&&r.bottom>0&&r.top<innerHeight;}
    function isMobile(){return !tvMode()&&((innerWidth<=480)||document.body.classList.contains('mobile--view')||!!(window.Lampa&&Lampa.Platform&&Lampa.Platform.screen&&Lampa.Platform.screen('mobile')));}
    function noMotion(){return !active||destroyed||reduced||document.body.classList.contains('no--animation');}
    function work(){return !noMotion()&&typeof Element!=='undefined'&&typeof Element.prototype.animate==='function';}
    function hasBusyOverlay(){return document.body.classList.contains('settings--open')||document.body.classList.contains('selectbox--open')||document.body.classList.contains('menu--open')||!!document.querySelector('.modal:not(.hide)');}
    function isTouchOnly(){return !tvMode()&&(!!(window.matchMedia&&matchMedia('(hover: none)').matches)||isMobile());}
    function listen(bus,event,fn){if(bus&&bus.follow){bus.follow(event,fn);subs.push({bus:bus,event:event,fn:fn});}}
    function unlisten(){subs.forEach(function(x){try{if(x.bus.remove)x.bus.remove(x.event,x.fn);}catch(e){}});subs=[];if(observer){observer.disconnect();observer=null;}if(typeof jQuery==='function')jQuery(document).off('.capsulemotion8');}

    // A sampled, damped, second-order spring. Precomputed keyframes: no
    // permanent rAF loop, no opacity fog, no scaling text on whole pages.
    function spring(t,zeta,frequency){
        var a=zeta*frequency,wd=frequency*Math.sqrt(Math.max(1e-6,1-zeta*zeta));
        return 1-Math.exp(-a*t)*(Math.cos(wd*t)+a/wd*Math.sin(wd*t));
    }
    // Physical 2nd order step response with zero starting velocity.
    // Normalize by its actual endpoint; the last frame does not jump to 1.
    // Lower frequency creates a visible anticipation without adding delays.
    function progress(f,duration,kind){
        if(f<=0)return 0;if(f>=1)return 1;
        // Zero initial velocity; the first frames accelerate rather than jumping.
        // Short presses settle quickly; bigger surfaces have a gentle, visible crest.
        var freq=kind==='press'?24:kind==='exit'?19.0:kind==='panel'?(tvMode()?18:15.7):18.3;
        var damping=kind==='press'?.72:kind==='exit'?.88:kind==='panel'?(tvMode()?.82:.70):p().bounce;
        var seconds=duration/1000,final=spring(seconds,damping,freq);
        return final>.3?spring(f*seconds,damping,freq)/final:f;
    }
    function sampled(duration,maker,kind){
        var frames=[],count=Math.min(56,Math.max(24,Math.ceil(duration/7.5)));
        for(var i=0;i<=count;i++){
            var f=i/count, value=maker(progress(f,duration,kind),f);
            if(!value||typeof value!=='object')throw Error('CAPSULE Motion: invalid sampled frame');
            value.offset=f;frames.push(value);
        }
        return frames;
    }
    // Non-periodic secondary response: one subtle compression and a clean recoil.
    // It has zero value and zero first derivative at both ends.
    function ripple(f){var si=Math.sin(Math.PI*f);return si*si*Math.sin(2*Math.PI*f);}
    function cushion(f){var si=Math.sin(Math.PI*f);return si*si;}
    // Liquid deformation: an eased impact, then a small volume-preserving
    // rebound. Both start and end at rest (zero displacement AND velocity).
    // Deliberately limited to a single selected surface; no grid-wide wobble.
    function contactEnvelope(f){
        var v=30*f;
        return (1-(1+v)*Math.exp(-v))*Math.pow(Math.max(0,1-f),1.85);
    }
    function elasticTail(f){
        return Math.sin(2.4*Math.PI*f)*cushion(f)*Math.exp(-1.45*f);
    }

    // Flat translation and stable radii on surfaces. Only content/focus can squash.
    function panelTravel(x,closed){return closed*(1-x);}
    function modalPose(closed,isMobilePanel){
        // Mobile sheets remain anchored; a shallow entrance prevents black gaps.
        var rise=isMobilePanel?33:23, squash=isMobilePanel?.014:.030;
        // Stable corners and under-sheet skirt; desktop dialogs can compress
        // very slightly, but never reshape the corner radius itself.
        return 'translate3d(0,'+(rise*closed).toFixed(2)+'px,0) scale('+(1-(isMobilePanel?.004:.026)*closed).toFixed(5)+','+(1-squash*closed).toFixed(5)+')';
    }
    function animate(node,frames,duration,finish,fill){
        if(!work()||!node||!node.isConnected||!node.animate)return null;
        try {
            var a=node.animate(frames,{duration:duration,easing:'linear',fill:fill||'none'});
            animations.add(a);
            var completed=false;
            function end(){if(completed)return;completed=true;if(fill!=='forwards'||a.playState!=='finished')animations.delete(a);if(finish)finish();}
            a.onfinish=end;a.oncancel=end;
            return a;
        }catch(e){return null;}
    }
    function clearAnimation(a){if(a){try{a.onfinish=null;a.oncancel=null;a.cancel();}catch(e){}animations.delete(a);}}
    function stopAnimations(){Array.from(animations).forEach(clearAnimation);animations.clear();}

    // Precompute CSS interpolation once, with a cubic fallback for old TV WebViews.
    function springEasing(){
        var stops=[];
        for(var i=0;i<=45;i++){
            var f=i/45,x=progress(f,p().focus);
            stops.push((Math.round(x*10000)/10000)+' '+(Math.round(f*10000)/100)+'%');
        }
        return 'linear('+stops.join(',')+')';
    }
    var CSS=`
/* No blanket activity fade: Lampa's .activity--active decides visibility.
   Do not animate .activity__body: loading/content recycling shares that node. */
body.cm8-on{--cm8-focus:{{focus}}ms;--cm8-press:{{press}}ms;
 --cm8-travel:cubic-bezier(.28,.04,.21,1);--cm8-spring:cubic-bezier(.27,.05,.17,1)}
@supports (transition-timing-function:linear(0,1)){
 body.cm8-on{--cm8-spring:{{spring}}}
}
/* Lampa normally crossfades overlapping 100%-size activity layers for 300ms
   while advanced mode additionally lifts the entire activity body by 14%.
   In non-light mode that moves rich backdrops, reveals the previous screen and
   creates the persistent footer ghost shown around 26–29s in the recording.
   Switch visibility atomically; keep Lampa's own loading state untouched. */
body.cm8-on:not(.no--animation) .activity{transition:none!important}
body.cm8-on:not(.no--animation) .activity__body{animation:none!important}
/* The rich mode uses extra activity animations under advanced--animation.
   Disable those only; moving the whole page makes overlapping layers bleed. */
body.cm8-on:not(.no--animation) .activity--active .animate-up-content{animation:none!important}
/* Keep stock advanced--animation from fighting with our card/control motion. */
body.cm8-on:not(.no--animation) .card.focus .card__view,
body.cm8-on:not(.no--animation) .card.hover .card__view,
body.cm8-on:not(.no--animation) .card.animate-trigger-enter .card__view,
body.cm8-on:not(.no--animation) .card-episode.focus .full-episode,
body.cm8-on:not(.no--animation) .card-episode.animate-trigger-enter .full-episode,
body.cm8-on:not(.no--animation) .explorer-card__head-img.focus,
body.cm8-on:not(.no--animation) .card-more.focus .card-more__box,
body.cm8-on:not(.no--animation) .head__action.focus,
body.cm8-on:not(.no--animation) .simple-button.focus,
body.cm8-on:not(.no--animation) .menu__item.focus,
body.cm8-on:not(.no--animation) .settings-folder.focus .settings-folder__icon,
body.cm8-on:not(.no--animation) .full-start__button.focus,
body.cm8-on:not(.no--animation) .modal__button.focus,
body.cm8-on:not(.no--animation) .torrent-item.focus{
 animation:none!important;
}
/* GPU-friendly scale on the existing visual box. Do not reshape image masks,
   inject blur, or create a second moving copy of an entire detail screen. */
body.cm8-on.cm8-focus:not(.no--animation) .card__view,
body.cm8-on.cm8-focus:not(.no--animation) .card-episode .full-episode,
body.cm8-on.cm8-focus:not(.no--animation) .card-more__box,
body.cm8-on.cm8-focus:not(.no--animation) .explorer-card__head-img{
 transition:transform var(--cm8-focus) var(--cm8-spring)!important;
}
body.cm8-on.cm8-focus:not(.no--animation) .card.focus .card__view,
body.cm8-on.cm8-focus:not(.no--animation) .card.hover .card__view,
body.cm8-on.cm8-focus:not(.no--animation) .card-episode.focus .full-episode,
body.cm8-on.cm8-focus:not(.no--animation) .card-more.focus .card-more__box,
body.cm8-on.cm8-focus:not(.no--animation) .explorer-card__head-img.focus{
 transform:scale(1.018) translateZ(0);
}
body.cm8-on.cm8-focus:not(.no--animation) .card--wide.focus .card__view,
body.cm8-on.cm8-focus:not(.no--animation) .card--wide.hover .card__view{
 transform:scale(1.009) translateZ(0);
}
/* TV: the border glides between posters; focused art rises towards the viewer.
   The light remains on the poster itself, never overlaid across a whole page. */
body.cm8-on.cm9-tv.cm8-focus:not(.no--animation) .card.focus .card__view,
body.cm8-on.cm9-tv.cm8-focus:not(.no--animation) .card.hover .card__view,
body.cm8-on.cm9-tv.cm8-focus:not(.no--animation) .card-episode.focus .full-episode,
body.cm8-on.cm9-tv.cm8-focus:not(.no--animation) .card-more.focus .card-more__box{
 transform:scale(1.052) translateZ(0);
}
body.cm8-on.cm9-tv.cm8-focus:not(.no--animation) .card--wide.focus .card__view,
body.cm8-on.cm9-tv.cm8-focus:not(.no--animation) .card--wide.hover .card__view{
 transform:scale(1.026) translateZ(0);
}
body.cm8-on.cm9-tv:not(.no--animation) .card.focus .card__view::after,
body.cm8-on.cm9-tv:not(.no--animation) .card.hover .card__view::after,
body.cm8-on.cm9-tv:not(.no--animation) .card-episode.focus .full-episode::after{
 opacity:.26;transition:opacity .24s ease-out;
}
/* Focus changes in lists and player buttons are small and friendly, not noisy. */
body.cm8-on.cm9-tv:not(.no--animation) .settings-param,
body.cm8-on.cm9-tv:not(.no--animation) .settings-folder,
body.cm8-on.cm9-tv:not(.no--animation) .selectbox-item,
body.cm8-on.cm9-tv:not(.no--animation) .menu__item,
body.cm8-on.cm9-tv:not(.no--animation) .navigation-tabs__button,
body.cm8-on.cm9-tv:not(.no--animation) .player-panel .button{
 transition:background-color 185ms ease-out,color 185ms ease-out,transform 265ms var(--cm8-spring);
}
body.cm8-on.cm9-tv:not(.no--animation) .settings-param.focus,
body.cm8-on.cm9-tv:not(.no--animation) .settings-folder.focus,
body.cm8-on.cm9-tv:not(.no--animation) .selectbox-item.focus,
body.cm8-on.cm9-tv:not(.no--animation) .menu__item.focus{
 transform:scale(1.012);
}
/* TV controls and top-bar selectors were nearly unanimated in stock Lampa. */
body.cm8-on.cm9-tv:not(.no--animation) .head__action,
body.cm8-on.cm9-tv:not(.no--animation) .full-start__button,
body.cm8-on.cm9-tv:not(.no--animation) .simple-button,
body.cm8-on.cm9-tv:not(.no--animation) .navigation-bar__item,
body.cm8-on.cm9-tv:not(.no--animation) .player-panel .button{
 transition:transform 265ms var(--cm8-spring),background-color 185ms ease-out!important;
}
body.cm8-on.cm9-tv:not(.no--animation) .head__action.focus,
body.cm8-on.cm9-tv:not(.no--animation) .full-start__button.focus,
body.cm8-on.cm9-tv:not(.no--animation) .simple-button.focus,
body.cm8-on.cm9-tv:not(.no--animation) .navigation-bar__item.focus,
body.cm8-on.cm9-tv:not(.no--animation) .player-panel .button.focus{
 transform:scale(1.046);
}
/* Phones get quicker tactile reactions, not oversized hover effects. */
body.cm8-on.cm9-phone:not(.no--animation) .head__action,
body.cm8-on.cm9-phone:not(.no--animation) .navigation-tabs__button,
body.cm8-on.cm9-phone:not(.no--animation) .full-start__button{
 transition:transform 240ms var(--cm8-spring),background-color 170ms ease-out!important;
}

/* Avoid permanent will-change on hundreds of posters. */
body.cm8-on .card__view{will-change:auto!important}
/* Keep the 300ms Scroll controller contract and its manual no-transition flags. */
body.cm8-on:not(.no--animation) .scroll__body:not(.notransition):not(.transition-reset){
 transition:transform 300ms cubic-bezier(.2,.83,.25,1)!important;
}
/* Menu motion is layout-dependent: normal Lampa shifts content; light mode
   does not. We do not force a transform on either version. */
body.cm8-on.cm8-panels:not(.no--animation) .wrap__left,
body.cm8-on.cm8-panels:not(.no--animation) .wrap__content{
 transition:transform 270ms var(--cm8-spring)!important;
}
/* Sharp, unblurred backdrop. Lampa's blur(1em) amplified visual defects and
   triggers expensive full-screen GPU resampling in the rich interface. */
body.cm8-on.cm8-panels:not(.no--animation) .selectbox__layer,
body.cm8-on.cm8-panels:not(.no--animation) .settings__layer,
body.cm8-on.cm8-panels:not(.no--animation) .modal__layer{
 backdrop-filter:none!important;-webkit-backdrop-filter:none!important;
 background:rgba(0,0,0,.18);
}
/* Modal blur is on .modal ITSELF in Lampa, not on .modal__layer. */
body.cm8-on.cm8-panels:not(.no--animation) .modal{
 backdrop-filter:none!important;-webkit-backdrop-filter:none!important;
}
/* Modal entries are driven by WAAPI, after Lampa has finished attaching
   the window. Entries can be interrupted; no duplicated CSS animation. */
body.cm8-on.cm8-panels:not(.no--animation) .modal.animate .modal__content,
body.cm8-on.cm8-panels:not(.no--animation) .modal.animate-down .modal__content{
 animation:none!important;
}
/* Swipe exit is driven in the same compositor as entry, never the native
   300ms CSS exit that outlives Lampa's 200ms removal timeout. */
/* The Lampa panels' border radii are layout geometry, NOT animation frames.
   A matching-color bottom skirt covers the small region opened by movement;
   it does not scale, blur or affect the actual panel's click targets. */
@media screen and (max-width:480px){
 body.cm8-on.cm8-panels:not(.no--animation) .modal__content,
 body.cm8-on.cm8-panels:not(.no--animation) .settings__content,
 body.cm8-on.cm8-panels:not(.no--animation) .selectbox__content{
   transform-origin:50% 100%;
 }
 body.cm8-on.cm8-panels:not(.no--animation) .modal__content::after{
   content:'';position:absolute;top:calc(100% - 1px);left:0;right:0;
   height:110px;background:inherit;border-radius:0;pointer-events:none;
 }
}
/* Lampa's native mobile sheet animation uses forwards even when a panel
   is closed without .animate-down, leaving an invisible-but-interactive sheet.
   All sheet geometry is now authored in WAAPI, open/closed base transforms in CSS.
   This also prevents the old animation reasserting itself after our exit. */
@media screen and (max-width:480px){
 body.cm8-on.cm8-panels:not(.no--animation) .settings__content,
 body.cm8-on.cm8-panels:not(.no--animation) .selectbox__content{
  animation:none!important; transition:none!important;
  transform:translate3d(0,100%,0);
  clip-path:inset(0 0 0 0);
 }
 body.cm8-on.cm8-panels.settings--open:not(.no--animation) .settings__content,
 body.cm8-on.cm8-panels.selectbox--open:not(.no--animation) .selectbox__content{
  transform:translate3d(0,0,0);
 }
}
@media screen and (min-width:481px){
 body.cm8-on.cm8-panels:not(.no--animation) .settings__content,
 body.cm8-on.cm8-panels:not(.no--animation) .selectbox__content{
   transition:transform 310ms var(--cm8-spring)!important;
 }
}
/* Transition snapshots retain their exact positions, do not block input or
   darken the scene. Removed after a maximum of 230ms. */
.cm8-outgoing-modal{pointer-events:none!important;background:transparent!important;
 backdrop-filter:none!important;-webkit-backdrop-filter:none!important;
 position:fixed!important;inset:0!important;z-index:999!important}
.cm8-outgoing-modal .modal__content{transition:none!important;animation:none!important;
 pointer-events:none!important}
@media(prefers-reduced-motion:reduce){
 body.cm8-on .cm8-outgoing-modal{display:none!important}
}
/* The menu receives a quick impact on phones without blurring the entire scene.
   The native .wrap geometry handles layout; only the inner menu animates. */
body.cm8-on.cm9-phone:not(.no--animation) .wrap__left,
body.cm8-on.cm9-phone:not(.no--animation) .wrap__content{
 transition:transform 330ms var(--cm8-spring)!important;
}
/* Single-card focus only: native focus is not animated across the entire
   viewport. A travelling fixed halo lost alignment during scrolling and fast
   navigation. The poster's own pseudo-element moves with the content.
   The unfocused pseudo-element is retained to allow a short fade OUT. */
body.cm8-on.cm9-tv.cm8-focus:not(.no--animation) .card__view::after {
 content:""; position:absolute; top:-.5em;left:-.5em;right:-.5em;bottom:-.5em;
 border:.3em solid #fff; border-radius:1.4em;z-index:-1;pointer-events:none;
 opacity:0; transform:scale(.985);
 transition:opacity 170ms ease-out,transform 235ms cubic-bezier(.2,.7,.23,1),
  box-shadow 220ms ease-out!important;
 box-shadow:0 0 0 transparent;
}
body.cm8-on.cm9-tv.cm8-focus:not(.no--animation) .card.focus .card__view::after,
body.cm8-on.cm9-tv.cm8-focus:not(.no--animation) .card.hover .card__view::after {
 opacity:1;transform:scale(1);
 box-shadow:0 0 14px rgba(255,255,255,.13);
}
body.cm8-on.cm9-tv.cm8-focus:not(.no--animation) .card.hover:not(.focus) .card__view::after {
 opacity:.62;
}
body.cm8-on.cm9-tv.cm8-focus:not(.no--animation) .card-episode .full-episode::after{
 opacity:0;transition:opacity 165ms ease-out,box-shadow 210ms ease-out!important;
}
body.cm8-on.cm9-tv.cm8-focus:not(.no--animation) .card-episode.focus .full-episode::after{
 opacity:1;box-shadow:0 0 12px rgba(255,255,255,.10);
}
/* The short highlight is a child of the card. No position:fixed overlay,
   no bounding-box sampling per frame, no repaint of full screen on scroll. */
.cm9-shine{position:absolute;inset:0;pointer-events:none;z-index:5;
 overflow:hidden;border-radius:1em;box-sizing:border-box;contain:paint}
.cm9-shine__beam{position:absolute;top:-12%;bottom:-12%;left:0;width:48%;
 background:linear-gradient(90deg,transparent,rgba(255,255,255,.05) 23%,
 rgba(255,255,255,.21) 51%,rgba(255,255,255,.05) 76%,transparent);
 transform:translate3d(-140%,0,0) skewX(-13deg)}
/* This highlight lives behind the tabs' content and is removed on stop. */
body.cm8-on:not(.no--animation) .navigation-tabs.cm8-tabs-ready{position:relative}
body.cm8-on:not(.no--animation) .navigation-tabs.cm8-tabs-ready>.navigation-tabs__button{position:relative;z-index:1}
body.cm8-on:not(.no--animation) .navigation-tabs.cm8-tabs-ready>.navigation-tabs__button.active{background:transparent!important}
.cm8-tab-pill{position:absolute;pointer-events:none;z-index:0;border-radius:.4em;
 background:rgba(255,255,255,.32);transform-origin:center center}
/* Rich Lampa uses its own background/poster image loading. No overrides here. */
@media(prefers-reduced-motion:reduce){
 body.cm8-on .cm8-cursor{display:none!important}
}
`;
    function setupCSS(){
        if(!style){style=document.createElement('style');style.id='capsule-motion-style-v91';(document.head||document.documentElement).appendChild(style);}
        var value=CSS.replace(/\{\{(focus|press|popup|scene|spring)\}\}/g,function(_,key){
            if(key==='spring')return springEasing();if(key==='popup')return p().popup;
            return p()[key];
        });
        if(style.textContent!==value)style.textContent=value;
    }
    function hideCursor(){
        if(shineWait){clearTimeout(shineWait);timers.delete(shineWait);shineWait=0;}
        removeShine();
        clearAnimation(cursorAnim);cursorAnim=null;cursorTarget=null;
        if(cursor){cursor.remove();cursor=null;}
    }
    function pickFocus(){
        // Lampa may keep old focus classes in hidden activities.
        var context=document.querySelector('.activity--active')||document;
        var focused=context.querySelectorAll('.card.focus,.card.hover,.card-episode.focus,.card-more.focus,.explorer-card__head-img.focus');
        for(var i=focused.length-1;i>=0;i--){
            var node=focused[i],v=visualFor(node),r=visibleRect(v);
            if(r&&onscreen(r)&&node.offsetParent!==null)return node;
        }
        return null;
    }
    function syncCursor(){
        raf=0;
        if(!work()||!flag('focus')||isTouchOnly()||hasBusyOverlay())return hideCursor();
        var selected=pickFocus();
        if(!selected)return hideCursor();
        // Native card border is the single source of truth. Never duplicate
        // it as a travelling, fixed layer that races the focus transform.
        if(selected===cursorTarget)return;
        cursorTarget=selected;
        removeShine();
        if(shineWait){clearTimeout(shineWait);timers.delete(shineWait);shineWait=0;}
        // Delay ONLY the specular glint, not the focus/outline. During fast D-pad
        // repeats it does not strobe or jump across several distant cards.
        shineWait=timeout(function(){
            shineWait=0;
            if(cursorTarget===selected&&selected.isConnected&&
                (selected.classList.contains('focus')||selected.classList.contains('hover'))&&
                !hasBusyOverlay()&&document.body.classList.contains('cm9-tv'))shine(selected,false);
        },82);
    }
    function scheduleCursor(){if(!raf)raf=later(syncCursor);}
    function visualFor(el){
        if(!el||!el.matches)return null;
        if(el.matches('.card'))return el.querySelector('.card__view');
        if(el.matches('.card-episode'))return el.querySelector('.full-episode');
        if(el.matches('.card-more'))return el.querySelector('.card-more__box');
        if(el.matches('.explorer-card__head-img'))return el;
        if(el.matches('.head__action,.simple-button,.full-start__button,.modal__button,.navigation-bar__item,.navigation-tabs__button,.player-panel .button,.menu__item,.settings-folder,.settings-param,.selectbox-item'))return el;
        return null;
    }
    var presses=new WeakMap(), pressTimes=new WeakMap();
    function removeShine(){
        clearAnimation(shineAnimation);shineAnimation=null;
        if(focusShine)focusShine.remove();focusShine=null;
    }
    function shine(el,emphatic){
        if(!work()||!tvMode()||hasBusyOverlay()||!el||!el.matches||
           !el.matches('.card,.card-episode,.card-more'))return;
        var node=visualFor(el),rect=visibleRect(node);
        if(!node||!rect||!onscreen(rect)||rect.width>innerWidth*.7)return;
        removeShine();
        var box=document.createElement('div');box.className='cm9-shine';
        box.setAttribute('aria-hidden','true');
        var beam=document.createElement('div');beam.className='cm9-shine__beam';
        beam.style.opacity=emphatic?'.82':'.62';
        box.appendChild(beam);node.appendChild(box);focusShine=box;
        var duration=emphatic?355:295;
        shineAnimation=animate(beam,[
            {transform:'translate3d(-150%,0,0) skewX(-13deg)'},
            {transform:'translate3d(320%,0,0) skewX(-13deg)'}
        ],duration,function(){if(focusShine===box)removeShine();});
        if(!shineAnimation)removeShine();
        interactionCounts.shine++;
    }
    function cardLong(el){
        if(!work()||!el||!el.matches||!el.matches('.card,.card-episode,.card-more,.explorer-card__head-img'))return;
        var node=visualFor(el),r=visibleRect(node);if(!node||!onscreen(r))return;
        var existing=longAnimations.get(node);clearAnimation(existing);
        var tv=tvMode(),choice=tv?Math.floor(Math.random()*4):0;
        var base=el.classList.contains('focus')?(tv?(el.classList.contains('card--wide')?1.026:1.052):1.018):1;
        var duration=tv?275:300;
        var phase=function(x){return Math.sin(Math.PI*x);};
        var a=animate(node,sampled(duration,function(x,f){
            var b=phase(f),u=Math.sin(2*Math.PI*f)*Math.pow(Math.sin(Math.PI*f),2);
            var y=choice===3?-5.5*b:0;
            // Deterministic per frame, no jitter from changing randomness.
            var rotation=choice===2?1.25*u:0;
            var amp=tv?.022:.018;
            var sx=base*(1+(choice===0?amp*b:choice===3?.006*b:choice===2?.005*u:0));
            var sy=base*(1+(choice===0?amp*.52*b:choice===3?.011*b:choice===2?-.004*u:0));
            return {transform:'translate3d(0,'+y.toFixed(2)+'px,0) rotate('+rotation.toFixed(3)+'deg) scale('+sx.toFixed(4)+','+sy.toFixed(4)+')'};
        },'press'),duration,function(){longAnimations.delete(node);});
        if(a)longAnimations.set(node,a);
        if(choice===1||choice===2)shine(el,true);
        if(tv)interactionCounts.tvLong++;else interactionCounts.phoneHolds++;
    }
    function press(el){
        if(!work()||!flag('focus'))return;
        var node=visualFor(el);if(!node||!onscreen(visibleRect(node)))return;
        // A mobile gesture reaches both touchstart and Lampa's hover:enter.
        // Without deduplication the same animation restarts a few frames later:
        // this was perceived as a "second kick"/jitter in rich mode.
        var t=now(),prev=pressTimes.get(node)||-1000;
        if(t-prev<145)return;
        pressTimes.set(node,t);
        var last=presses.get(node);clearAnimation(last);
        var isCard=el.matches('.card,.card-episode,.card-more');
        // Small anisotropic deformation: tight, visibly physical, no large zoom.
        var rest=isCard&&el.classList.contains('focus')?(tvMode()?(el.classList.contains('card--wide')?1.026:1.052):(el.classList.contains('card--wide')?1.009:1.018)):1;
        var dur=p().press;
        var a=animate(node,sampled(dur,function(x,f){
            // Contact compresses the surface; recoil grows into a tiny squash.
            // Two axes trade volume, rather than scaling every piece of UI equally.
            var impact=contactEnvelope(f),recoil=elasticTail(f);
            var row=el.matches('.menu__item,.settings-folder,.settings-param,.selectbox-item');
            var strength=isCard?(el.classList.contains('card--wide')?.63:.96):(row?.53:1);
            if(tvMode())strength*=.70; // stronger TV focus, softer action feedback
            // Springy handheld touch: the two axes trade mass instead of just
            // shrinking together; wide artwork stays restrained.
            var sx=rest*(1-.051*strength*impact+.022*strength*recoil);
            var sy=rest*(1+.030*strength*impact-.013*strength*recoil);
            var angle=(isCard?.13:.30)*strength*recoil;
            return {transform:'scale('+sx.toFixed(4)+','+sy.toFixed(4)+') rotate('+angle.toFixed(3)+'deg)'};
        },'press'),dur,function(){if(presses.get(node)===a)presses.delete(node);});
        if(a)presses.set(node,a);
    }
    function normalizeImage(url){
        if(!url)return '';
        try{
            var a=document.createElement('a');a.href=url;
            var path=decodeURIComponent(a.pathname||'');
            var file=path.split('/').pop()||'';
            // TMDB often resizes a poster via /w342/, /w500/, /original/.
            return file.replace(/\.(jpg|jpeg|png|webp)$/i,'').toLowerCase();
        }catch(e){return '';}
    }
    function candidatePoster(node){return node&&node.querySelector&&node.querySelector('.full-start-new__poster .full-start-new__img,.full-start__poster .full-start__img');}
    function lastAction(el){
        var card=el&&el.closest&&el.closest('.card,.card-episode');if(!card||!card.isConnected)return;
        var img=card.querySelector('.card__img,.card__view img');if(!img||!img.complete||!img.naturalWidth)return;
        var r=visibleRect(img),name=normalizeImage(img.currentSrc||img.src);
        if(!onscreen(r)||!name||r.width/r.height>.92)return;
        recentAction={card:card,url:img.currentSrc||img.src,name:name,rect:r,at:now()};
    }
    function stopMorph(){
        if(!overlayMorph)return;
        var m=overlayMorph;overlayMorph=null;
        clearAnimation(m.animation);
        if(m.to&&m.to.isConnected&&m.to.style.visibility==='hidden')m.to.style.visibility=m.was;
        if(m.node)m.node.remove();
    }
    function tryPosterMorph(root){
        if(!work()||!flag('morph')||!recentAction||!root||!root.isConnected)return;
        // Lampa's RICH MOBILE full poster is a square/backdrop area with a
        // gradient mask. Stretching a portrait into it caused the huge cover
        // and white gaps visible at 1-3s and 26-29s in the user's video.
        var m=isMobile(), action=recentAction;recentAction=null;
        if(m)return;
        if(now()-action.at>850||!action.card.isConnected)return;
        var target=candidatePoster(root);
        if(!target||!target.complete||!target.naturalWidth)return;
        var end=visibleRect(target),start=action.rect;
        if(!onscreen(end)||!onscreen(start)||end.width/end.height>.83)return;
        var key=normalizeImage(target.currentSrc||target.src);
        if(!key||key!==action.name)return;
        // Never hide the destination until the replacement has decoded.
        var img=document.createElement('img');
        img.src=action.url;img.alt='';img.setAttribute('aria-hidden','true');
        img.style.cssText='position:fixed;pointer-events:none;z-index:12;object-fit:cover;margin:0;padding:0;max-width:none;border:0;box-sizing:border-box;transform-origin:0 0;';
        img.style.left=end.left+'px';img.style.top=end.top+'px';
        img.style.width=end.width+'px';img.style.height=end.height+'px';
        img.style.borderRadius='12px';
        stopMorph();document.body.appendChild(img);
        var saved=target.style.visibility;target.style.visibility='hidden';
        var deltaX=start.left-end.left,deltaY=start.top-end.top;
        var scaleX=clamp(start.width/end.width,.2,3),scaleY=clamp(start.height/end.height,.2,3);
        var duration=p().scene;
        var session={node:img,to:target,was:saved,animation:null};overlayMorph=session;
        session.animation=animate(img,sampled(duration,function(x,f){
            var rest=1-x,j=p().warp*.30*cushion(f);
            var sx=1+(scaleX-1)*rest+j,sy=1+(scaleY-1)*rest-j*.4;
            return {transform:'translate3d('+(deltaX*rest).toFixed(2)+'px,'+(deltaY*rest).toFixed(2)+'px,0) scale('+sx.toFixed(4)+','+sy.toFixed(4)+')',borderRadius:(12+8*(1-rest)).toFixed(2)+'px'};
        }),duration,function(){if(overlayMorph===session)stopMorph();});
        if(!session.animation)stopMorph();
    }
    function updatePill(group){
        if(!work()||!flag('focus')||!group||!group.isConnected)return;
        // Do not create a travelling pill in mobile nav or when the tab uses
        // Lampa's own clipped scroll transforms, which distort the geometry.
        if(isMobile()||hasBusyOverlay())return;
        var target=group.querySelector('.navigation-tabs__button.active');
        if(target&&target.parentElement!==group)return;
        if(!target)return;
        var rect=visibleRect(target),holder=visibleRect(group);
        if(!rect||!holder)return;
        var data=tabPills.get(group);
        if(!data){
            var span=document.createElement('div');span.className='cm8-tab-pill';span.setAttribute('aria-hidden','true');
            group.insertBefore(span,group.firstChild);group.classList.add('cm8-tabs-ready');
            data={node:span,animation:null};tabPills.set(group,data);
        }
        var pill=data.node,old=pill.style.width?visibleRect(pill):null;
        clearAnimation(data.animation);data.animation=null;
        pill.style.left=(rect.left-holder.left)+'px';pill.style.top=(rect.top-holder.top)+'px';
        pill.style.width=rect.width+'px';pill.style.height=rect.height+'px';
        if(old&&onscreen(old)){
            var deltaX=old.left-rect.left,deltaY=old.top-rect.top;
            if(Math.hypot(deltaX,deltaY)>.6){
                var scaleX=old.width/rect.width,scaleY=old.height/rect.height;
                data.animation=animate(pill,sampled(p().focus,function(x,f){
                    var k=1-x,travel=Math.abs(deltaX)+Math.abs(deltaY);
                    var s=Math.min(.042,travel/1800)*cushion(f)+.008*ripple(f);
                    return {transform:'translate3d('+(deltaX*k).toFixed(2)+'px,'+(deltaY*k).toFixed(2)+'px,0) scale('+(1+(scaleX-1)*k+s).toFixed(4)+','+(1+(scaleY-1)*k-s*.45).toFixed(4)+')'};
                }),p().focus);
            }
        }
    }
    function scheduleTabs(){if(tabRaf)return;tabRaf=later(function(){tabRaf=0;if(isMobile())return;Array.from(document.querySelectorAll('.activity--active .navigation-tabs')).forEach(updatePill);});}
    function clearTabs(){tabPills.forEach(function(data,group){clearAnimation(data.animation);data.node.remove();group.classList.remove('cm8-tabs-ready');});tabPills.clear();}

    // Rich interfaces need choreography, not an opacity veil over the page.
    // Move only the top-level content cluster; avoid gigantic background layers.
    function enterScene(root){
        if(!work()||!flag('panels')||!root)return;
        var visual=root.querySelector('.full-start-new__right,.full-start__left,.full-start__body,.settings__body');
        if(!visual||!onscreen(visibleRect(visual)))return;
        var d=p().scene;
        animate(visual,sampled(d,function(x,f){
            // Move only the content cluster, never a backdrop or settings rows.
            var y=12*(1-x)+1.6*elasticTail(f);
            return {transform:'translate3d(0,'+y.toFixed(2)+'px,0)'};
        },'panel'),d);
    }
    function modalOpen(node){
        if(!node||!node.isConnected)return;
        var pane=node.querySelector('.modal__content');if(!pane)return;
        var r=visibleRect(pane);if(r)modalMetrics.set(node,r);
        if(!work()||!flag('panels')||!r||!onscreen(r))return;
        var prev=panelOpens.get(node);if(prev)clearAnimation(prev);
        var d=p().popup;
        // Short, pronounced spring without transitioning the corner radius.
        var mobile=innerWidth<=480;
        var a=animate(pane,sampled(d,function(x,f){
            if(mobile){
                return {clipPath:'inset('+(clamp(100*(1-x),0,100)).toFixed(3)+'% 0 0 0 round 2em 2em 0 0)',
                  transform:'translate3d(0,'+(8*(1-x)).toFixed(2)+'px,0)'};
            }
            return {transform:'translate3d(0,'+(23*(1-x)).toFixed(2)+'px,0) scale('+(1-.026*(1-x)).toFixed(5)+')'};
        },'panel'),d);
        if(a)panelOpens.set(node,a);
    }
    function forgetModal(node){
        if(!node)return;
        var open=panelOpens.get(node);if(open)clearAnimation(open);
        panelOpens.delete(node);
        var swipe=modalSwipeAnimations.get(node);
        if(swipe){swipe.forEach(clearAnimation);modalSwipeAnimations.delete(node);}
    }
    // Lampa starts swipe-to-close by adding .animate-down, then removes
    // the modal after 200ms. Its own .3s CSS animation cannot finish in time.
    // Animate the live modal BEFORE removal (no delayed cloned ghost). Hold
    // the final frame until the original is actually detached.
    function modalSwipeExit(node){
        if(!work()||innerWidth>480||!node||!node.isConnected||swipeModal.has(node))return;
        var pane=node.querySelector('.modal__content');if(!pane)return;
        swipeModal.add(node);
        var raw='';
        try{raw=getComputedStyle(pane).transform;}catch(e){}
        var matrix=/matrix(3d)?\(([^)]+)\)/.exec(raw||'');
        var coords=matrix?matrix[2].split(',').map(parseFloat):null;
        var y=coords?(matrix[1]?coords[13]:coords[5]):0;
        var start=clamp(y/76,0,1);
        // A mid-entry modal may already be cropped; continue from that frame.
        try{var cut=/inset\(\s*([\d.]+)%/.exec(getComputedStyle(pane).clipPath||'');
            if(cut)start=clamp(parseFloat(cut[1])/100,0,1);
        }catch(e){}
        var open=panelOpens.get(node);
        if(open)clearAnimation(open);
        panelOpens.delete(node);
        var d=188; // Lampa calls Controller.back() at 200ms after swipe.
        var motion=animate(pane,sampled(d,function(x){
            var k=start+(1-start)*x;
            return {clipPath:'inset('+(clamp(100*k,0,100)).toFixed(3)+'% 0 0 0 round 2em 2em 0 0)',
                transform:'translate3d(0,'+(12*k).toFixed(2)+'px,0)'};
        },'exit'),d,null,'forwards');
        var veil=animate(node,sampled(d,function(x,f){
            // Parent fades together with its backdrop; no residue after exit.
            var a=clamp((f-.10)/.87,0,1);
            a=a*a*(3-2*a);
            return {opacity:String((1-a).toFixed(5))};
        },'exit'),d,null,'forwards');
        modalSwipeAnimations.set(node,[motion,veil].filter(Boolean));
    }
    function modalRemoved(node){
        if(!node||node.classList.contains('cm8-outgoing-modal'))return;
        var metric=modalMetrics.get(node);forgetModal(node);
        if(swipeModal.has(node)||now()-lastActivityAt<150)return;
        if(!work()||!flag('panels')||!metric||!onscreen(metric))return;
        if(document.hidden||document.body.classList.contains('no--animation'))return;
        // Do not retain a modal containing video/players or large arbitrary
        // plugin DOM trees; use a light shell for those cases.
        var clone=node.cloneNode(true), originalPane=node.querySelector('.modal__content');
        var pane=clone.querySelector('.modal__content');if(!pane)return;
        if(node.querySelector('video,iframe,canvas,object,embed')||node.querySelectorAll('*').length>155){
            pane.innerHTML='';
            var caption=node.querySelector('.modal__title');
            if(caption){var title=document.createElement('div');title.className='modal__title';title.textContent=caption.textContent||'';pane.appendChild(title);}
        }else{
            Array.from(clone.querySelectorAll('input,textarea,select,script,video,iframe,canvas,object,embed')).forEach(function(x){x.remove();});
        }
        clone.removeAttribute('id');clone.classList.remove('animate','animate-down','hide');
        clone.classList.add('cm8-outgoing-modal');
        clone.setAttribute('aria-hidden','true');
        pane.style.setProperty('position','fixed','important');
        pane.style.setProperty('left',metric.left+'px','important');
        pane.style.setProperty('top',metric.top+'px','important');
        pane.style.setProperty('width',metric.width+'px','important');
        pane.style.setProperty('height',metric.height+'px','important');
        pane.style.setProperty('max-width','none','important');
        pane.style.setProperty('right','auto','important');
        pane.style.setProperty('bottom','auto','important');
        pane.style.setProperty('margin','0','important');
        pane.style.setProperty('animation','none','important');
        pane.style.setProperty('transition','none','important');
        // No radius changes on the clone, either: preserve native geometry.
        document.body.appendChild(clone);leavingWindows.add(clone);modalExitCount++;
        // Same spatial path as opening, played in reverse. The late-only fade
        // hides the cloned snapshot before removal, never veils the live screen.
        var mobile=innerWidth<=480,d=mobile?255:p().popup;
        var a=animate(pane,sampled(d,function(x,f){
            var k=clamp(x,0,1),edge=clamp((f-.90)/.10,0,1);
            return mobile?{clipPath:'inset('+(100*k).toFixed(3)+'% 0 0 0 round 2em 2em 0 0)',
                transform:'translate3d(0,'+(12*k).toFixed(2)+'px,0)',opacity:String(1-edge)}:
                {transform:modalPose(k,false),opacity:String(1-edge)};
        },'exit'),d,function(){clone.remove();leavingWindows.delete(clone);});
        if(!a){clone.remove();leavingWindows.delete(clone);}
        // Also handle hidden tabs / cancelled animations without leaked clones.
        timeout(function(){if(clone.isConnected)clone.remove();leavingWindows.delete(clone);},d+65);
    }
    function sheetClipPercent(pane){
        try{
            var cp=getComputedStyle(pane).clipPath||'';
            var m=/inset\(\s*([\d.]+)%/.exec(cp);
            return m?clamp(parseFloat(m[1]),0,100):0;
        }catch(e){return 0;}
    }
    function sheetFrames(duration,begin,end,isOpening){
        return sampled(duration,function(x,f){
            // Crop the surface toward its BOTTOM instead of moving its entire
            // height across the viewport. Corners and footer never reveal gaps.
            var cut=clamp(begin+(end-begin)*x,0,100);
            var drift=isOpening?(1-x)*8:x*12;
            return {
                clipPath:'inset('+cut.toFixed(3)+'% 0 0 0 round 2em 2em 0 0)',
                transform:'translate3d(0,'+drift.toFixed(3)+'px,0)'
            };
        },isOpening?'panel':'exit');
    }
    function sheetEntry(kind){
        if(!work()||innerWidth>480)return;
        var root=document.querySelector('.'+kind),pane=root&&root.querySelector('.'+kind+'__content');
        if(!pane||!pane.isConnected)return;
        var incoming=sheetEntries.get(kind),previous=sheetExits.get(kind);
        var begin=previous?sheetClipPercent(pane):100;
        if(incoming)clearAnimation(incoming);
        if(previous){clearAnimation(previous);sheetExits.delete(kind);}
        // Existing app state has already moved the panel to its FINAL geometry.
        // Only the visibility mask unfolds, no huge full-content slide.
        var d=320;
        var a=animate(pane,sheetFrames(d,begin,0,true),d,function(){
            if(sheetEntries.get(kind)===a)sheetEntries.delete(kind);
        });
        if(a)sheetEntries.set(kind,a);
    }
    function sheetExit(kind,swipe){
        if(!work()||innerWidth>480)return;
        var root=document.querySelector('.'+kind),pane=root&&root.querySelector('.'+kind+'__content');
        if(!root||!pane||!pane.isConnected)return;
        if(sheetExits.get(kind))return;
        var incoming=sheetEntries.get(kind);
        var starting=incoming?sheetClipPercent(pane):0;
        if(incoming){clearAnimation(incoming);sheetEntries.delete(kind);}
        // Swipe's 200ms Controller.back() contract is preserved. Hold the
        // fully clipped last frame until Lampa closes it, preventing a flash.
        var d=swipe?184:220;
        var a=animate(pane,sheetFrames(d,starting,100,false),d,
            swipe?null:function(){if(sheetExits.get(kind)===a)sheetExits.delete(kind);},
            swipe?'forwards':'none');
        if(a){sheetExits.set(kind,a);exitCount++;}
    }
    function menuChange(open){
        if(!work()||!flag('panels')||!isMobile())return;
        var node=document.querySelector('.wrap__left .menu');
        if(!node||!node.isConnected)return;
        clearAnimation(menuAnim);menuAnim=null;
        // Real sidebar layout movement is done by Lampa's wrap transforms.
        // Only the menu contents get a small, reversible counter-movement.
        var d=open?365:225;
        var direction=open?1:0;
        menuAnim=animate(node,sampled(d,function(x,f){
            var state=direction?1-x:x;
            var pulse=.009*cushion(f)+.006*ripple(f);
            var xOffset=-26*state+5*pulse*5;
            return {transform:'translate3d('+xOffset.toFixed(3)+'px,0,0) scale('+(1-.028*state+pulse).toFixed(5)+','+(1-.011*state-.55*pulse).toFixed(5)+')'};
        },open?'panel':'exit'),d);
    }
    function removeLeavingWindows(){
        leavingWindows.forEach(function(el){el.remove();});leavingWindows.clear();
        removeShine();
        sheetExits.forEach(function(a){clearAnimation(a);});sheetExits.clear();
        sheetEntries.forEach(function(a){clearAnimation(a);});sheetEntries.clear();
        swipeSheetUntil.clear();
        clearAnimation(menuAnim);menuAnim=null;
    }

    // Settings contents are replaced synchronously by Lampa. The old row
    // animation made the first items jump whenever a category was switched;
    // leave content in its final position and animate only enclosing surfaces.
    function activityChange(event){
        lastActivityAt=now();removeLeavingWindows();
        // A page switch can remove the old tab container without removing
        // our detached Map entry; release all per-page geometry on navigation.
        stopMorph();hideCursor();clearTabs();scheduleTabs();
        if(event&&event.component==='full'&&event.type==='start'){
            var node=null;
            try{node=event.object&&event.object.activity&&event.object.activity.render(true);}catch(e){}
            if(node&&node.jquery)node=node[0];
            if(!node)node=document.querySelector('.activity--active');
            // At this point real media may not have loaded. Morph is strictly
            // opt-in and only with already-decoded, matching portrait posters.
            tryPosterMorph(node);enterScene(node);
        }else recentAction=null;
    }
    function setupObserver(){
        if(typeof MutationObserver==='undefined')return;
        observer=new MutationObserver(function(changes){
            if(!active)return;
            var cursorChange=false,tabChange=false;
            for(var i=0;i<changes.length;i++){
                var m=changes[i],el=m.target;
                if(m.type==='childList'){
                    // Never animate individual settings rows on childList changes.
                    for(var j=0;j<m.removedNodes.length;j++){
                        var gone=m.removedNodes[j];
                        if(gone.nodeType===1&&gone.matches&&gone.matches('.modal'))modalRemoved(gone);
                    }
                    continue;
                }
                if(m.type!=='attributes'||!el||!el.classList)continue;
                if(el===document.body){
                    cursorChange=true;
                    if(noMotion()){stopMorph();clearTabs();hideCursor();removeLeavingWindows();}
                    var from=m.oldValue||'';
                    if(from.indexOf('light--version')!==-1||el.classList.contains('light--version'))stopMorph();
                    if(from.indexOf('settings--open')>=0&&!el.classList.contains('settings--open')){
                        if(swipeSheetUntil.has('settings')){
                            var closingSettings=sheetExits.get('settings');
                            if(closingSettings)clearAnimation(closingSettings);
                            sheetExits.delete('settings');swipeSheetUntil.delete('settings');
                        }else sheetExit('settings',false);
                    }
                    if(from.indexOf('selectbox--open')>=0&&!el.classList.contains('selectbox--open')){
                        if(swipeSheetUntil.has('selectbox')){
                            var closingSelect=sheetExits.get('selectbox');
                            if(closingSelect)clearAnimation(closingSelect);
                            sheetExits.delete('selectbox');swipeSheetUntil.delete('selectbox');
                        }else sheetExit('selectbox',false);
                    }
                    if(from.indexOf('settings--open')<0&&el.classList.contains('settings--open'))sheetEntry('settings');
                    if(from.indexOf('selectbox--open')<0&&el.classList.contains('selectbox--open'))sheetEntry('selectbox');
                    if(from.indexOf('menu--open')>=0&&!el.classList.contains('menu--open'))menuChange(false);
                    if(from.indexOf('menu--open')<0&&el.classList.contains('menu--open'))menuChange(true);
                    continue;
                }
                if(m.attributeName!=='class'||!el.matches)continue;
                if(el.matches('.selector,.activity,.modal,.settings,.selectbox'))cursorChange=true;
                if(el.matches('.navigation-tabs__button,.activity'))tabChange=true;
                if(el.matches('.modal.animate-down,.settings.animate-down,.selectbox.animate-down')){
                    stopMorph();
                    if(el.matches('.modal'))modalSwipeExit(el);
                    else if(el.matches('.settings')){swipeSheetUntil.set('settings',true);sheetExit('settings',true);}
                    else if(el.matches('.selectbox')){swipeSheetUntil.set('selectbox',true);sheetExit('selectbox',true);}
                }
                // On modal entry Lampa adds .animate after inserting the node.
                if(el.matches('.modal')&&el.classList.contains('animate')&&
                   (m.oldValue||'').indexOf('animate')===-1)modalOpen(el);
            }
            if(cursorChange)scheduleCursor();if(tabChange)scheduleTabs();
        });
        observer.observe(document.body,{childList:true,subtree:true,attributes:true,attributeOldValue:true,attributeFilter:['class']});
    }
    function registerEvents(){
        if(Lampa.Modal&&Lampa.Modal.listener){
            listen(Lampa.Modal.listener,'fullshow',function(event){
                var el=event&&event.html&&(event.html[0]||event.html);
                if(!el||!el.querySelector)return;
                var pane=el.querySelector('.modal__content');
                var r=visibleRect(pane);if(r)modalMetrics.set(el,r);
            });
        }
        listen(Lampa.Listener,'activity',function(e){
            if(!e||!active)return;
            if(e.type==='start')activityChange(e);
            if(e.type==='destroy'){stopMorph();clearTabs();scheduleCursor();scheduleTabs();}
        });
        if(typeof jQuery==='function'){
            var $=jQuery;
            $(document).on('hover:focus.capsulemotion8','.selector',function(){scheduleCursor();});
            // Lampa emits hover:long for TV remote and 800ms touch holds.
            // Pure visual reaction; existing long-press functionality is untouched.
            $(document).on('hover:long.capsulemotion8','.selector',function(){cardLong(this);});
            $(document).on('hover:enter.capsulemotion8','.selector',function(){lastAction(this);press(this);});
            // Touchstart is immediate; click may fire later, but don't send
            // a second press. Lampa binds its own click and navigation.
            $(document).on('pointerdown.capsulemotion8 touchstart.capsulemotion8','.selector',function(e){
                if(e.type==='pointerdown'&&e.originalEvent&&e.originalEvent.pointerType==='touch')return;
                lastAction(this);press(this);
            });
        }
        setupObserver();
        listen(Lampa.Listener,'resize_end',function(){apply();});
    }
    function apply(){
        if(!initialized||destroyed||!document.body)return;
        reduced=!!(media&&media.matches);
        active=enabledSetting()&&!reduced; // CSS-only focus fallback for older TVs without WAAPI
        ['cm8-on','cm8-focus','cm8-panels','cm9-tv','cm9-phone'].forEach(function(x){document.body.classList.remove(x);});
        stopMorph();hideCursor();removeShine();clearTabs();removeLeavingWindows();stopAnimations();
        if(!active)return;
        setupCSS();document.body.classList.add('cm8-on','cm8-focus','cm8-panels',tvMode()?'cm9-tv':'cm9-phone');
        scheduleCursor();scheduleTabs();
    }
    function registerSettings(){
        if(!Lampa.SettingsApi||!Lampa.SettingsApi.addComponent)return;
        var icon='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 12c5-12 13 12 18 0"/><circle cx="12" cy="12" r="3"/></svg>';
        // Version changes can reload without a full Lampa restart. Clear the
        // previous component and its old multiple options before registering.
        if(Lampa.SettingsApi.removeComponent)Lampa.SettingsApi.removeComponent(COMPONENT);
        Lampa.SettingsApi.addComponent({component:COMPONENT,name:'CAPSULE Motion',icon:icon});settingsRegistered=true;
        Lampa.SettingsApi.addParam({
            component:COMPONENT,
            param:{name:'capsule_motion_enabled',type:'trigger',default:enabledSetting()},
            field:{name:'Новые анимации',description:'Пластичная физика интерфейса · вкл/выкл'},
            onChange:apply
        });
    }
    function initialize(){
        if(initialized||destroyed||!window.Lampa||!Lampa.Storage||!Lampa.Listener||!document.body)return;
        initialized=true;
        media=window.matchMedia?window.matchMedia('(prefers-reduced-motion: reduce)'):null;
        if(media){mediaListener=apply;try{if(media.addEventListener)media.addEventListener('change',apply);else if(media.addListener)media.addListener(apply);}catch(e){}}
        registerSettings();registerEvents();apply();
    }
    function boot(){
        if(destroyed||initialized)return;
        if(window.appready&&window.Lampa&&document.body)return initialize();
        if(window.Lampa&&Lampa.Listener&&!appListener){
            appListener=function(e){if(e&&e.type==='ready'){if(Lampa.Listener.remove)Lampa.Listener.remove('app',appListener);appListener=null;initialize();}};
            Lampa.Listener.follow('app',appListener);
        }
        if(bootTries++<80)bootTimer=timeout(boot,250);
    }
    function stop(){
        if(destroyed)return;
        destroyed=true;active=false;
        clearTimeout(bootTimer);clearTimers();
        cancelLater(raf);cancelLater(tabRaf);raf=tabRaf=0;
        if(appListener&&window.Lampa&&Lampa.Listener&&Lampa.Listener.remove)Lampa.Listener.remove('app',appListener);
        if(media&&mediaListener){try{if(media.removeEventListener)media.removeEventListener('change',mediaListener);else if(media.removeListener)media.removeListener(mediaListener);}catch(e){}}
        unlisten();stopMorph();hideCursor();removeShine();clearTabs();removeLeavingWindows();stopAnimations();
        if(cursor){cursor.remove();cursor=null;}
        if(style){style.remove();style=null;}
        if(document.body)['cm8-on','cm8-focus','cm8-panels','cm9-tv','cm9-phone'].forEach(function(x){document.body.classList.remove(x);});
        if(settingsRegistered&&window.Lampa&&Lampa.SettingsApi&&Lampa.SettingsApi.removeComponent)Lampa.SettingsApi.removeComponent(COMPONENT);
        if(window[KEY]===api)delete window[KEY];
    }
    var api={version:VERSION,stop:stop,refresh:apply,diagnostics:function(){return {
        version:VERSION,enabled:active&&!noMotion(),mode:tvMode()?'television':'phone',waapi:typeof Element!=='undefined'&&typeof Element.prototype.animate==='function',richMode:!!(document.body&&!document.body.classList.contains('light--version')),
        activeAnimations:animations.size,posterOverlay:!!overlayMorph,focusOverlay:!!(cursor&&!cursor.classList.contains('cm8-hidden')),
        tvLongEffects:interactionCounts.tvLong,shineEffects:interactionCounts.shine,phoneLongEffects:interactionCounts.phoneHolds,inlineSheetMutations:0, sheetExitsStarted:exitCount, modalExitClones:modalExitCount, exitingWindows:leavingWindows.size
    };}};
    window[KEY]=api;boot();
})();