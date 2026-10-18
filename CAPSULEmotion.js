/*
 * CAPSULE Motion 9.4.0 — local poster gleam, solid sheet entrances and TV cinematic springs.
 * Copyright (c) 2026 CAPSULE. GPL-2.0-or-later.
 *
 * Rebuilt after studying Lampa's activity, settings, selectbox, modal, scroll
 * lifecycle and the recorded mobile regression in normal (non-light) mode.
 * No Lampa controller patches; scrolling contract and playback are untouched.
 */
(function () {
    'use strict';
    var VERSION='9.4.0', KEY='capsule_motion_runtime', COMPONENT='capsule_motion';
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
    var style=null, overlayMorph=null;
    var observer=null, componentObservers=[], modalObservers=new Map();
    var media=null, mediaListener=null, appListener=null, bootTimer=0, bootTries=0;
    var interactionsBound=false, visibilityHandler=null;
    var lowPower=!!((navigator.hardwareConcurrency && navigator.hardwareConcurrency<=2) ||
                    (navigator.deviceMemory && navigator.deviceMemory<=2));
    var subs=[], timers=new Set(), animations=new Set(), recentAction=null;

    var settingsRegistered=false, lastPage=null;
    var modalMetrics=new WeakMap(), leavingWindows=new Set();
    var panelOpens=new WeakMap(), exitCount=0, modalExitCount=0;
    var sheetExits=new Map(), sheetEntries=new Map(), menuAnim=null, swipeSheetUntil=new Map();
    var gleamBox=null, gleamBeam=null, gleamAnim=null, gleamCount=0;
    var swipeModal=new WeakSet(), modalSwipeAnimations=new WeakMap(), lastActivityAt=0;
    var longAnimations=new WeakMap();
    var latestTouch=null, touchHold=null, touchHoldStart=null;
    var interactionCounts={tvLong:0,phoneHolds:0};

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
    function visibleRect(node){
        if(!node||!node.isConnected||!node.getBoundingClientRect)return null;
        var r=node.getBoundingClientRect();
        if(!isFinite(r.left)||!isFinite(r.width)||r.width<3||r.height<3)return null;
        return {left:r.left,top:r.top,width:r.width,height:r.height,right:r.right,bottom:r.bottom};
    }
    function onscreen(r){return !!r&&r.right>0&&r.left<innerWidth&&r.bottom>0&&r.top<innerHeight;}
    function isMobile(){return !tvMode()&&((innerWidth<=480)||document.body.classList.contains('mobile--view')||!!(window.Lampa&&Lampa.Platform&&Lampa.Platform.screen&&Lampa.Platform.screen('mobile')));}
    function noMotion(){return !active||destroyed||reduced||document.hidden||document.body.classList.contains('no--animation');}
    function work(){return !noMotion()&&typeof Element!=='undefined'&&typeof Element.prototype.animate==='function';}
    function listen(bus,event,fn){if(bus&&bus.follow){bus.follow(event,fn);subs.push({bus:bus,event:event,fn:fn});}}
    function unlisten(){
        subs.forEach(function(x){try{if(x.bus.remove)x.bus.remove(x.event,x.fn);}catch(e){}});subs=[];
        suspendObservers();stopInteractions();
    }

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
        var freq=kind==='press'?24:kind==='exit'?19.0:kind==='panel'?(tvMode()?17.1:15.7):18.3;
        var damping=kind==='press'?.72:kind==='exit'?.88:kind==='panel'?(tvMode()?.75:.70):p().bounce;
        var seconds=duration/1000,final=spring(seconds,damping,freq);
        return final>.3?spring(f*seconds,damping,freq)/final:f;
    }
    function sampled(duration,maker,kind){
        var frames=[],count=Math.min(lowPower?18:30,Math.max(12,Math.ceil(duration/(lowPower?19:12))));
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
        for(var i=0;i<=27;i++){
            var f=i/27,x=progress(f,p().focus);
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
body.cm8-on .card,
body.cm8-on .card__view,
body.cm8-on .settings-param,
body.cm8-on .settings-folder{will-change:auto!important}
body.cm8-on.cm9-tv .card.focus .card__view{will-change:transform}
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
/* The stock full-screen blur layer remains visible *throughout* the sheet
   entrance. Never animate its opacity or replace its filter: it must hide the
   underlying activity from the first presentation frame. */
body.cm8-on.cm8-panels.settings--open .settings__layer,
body.cm8-on.cm8-panels.selectbox--open .selectbox__layer{
 opacity:1!important;transition:none!important;animation:none!important;
} 
/* Modal entries are driven by WAAPI, after Lampa has finished attaching
   the window. Entries can be interrupted; no duplicated CSS animation. */
body.cm8-on.cm8-panels:not(.no--animation) .modal.animate .modal__content,
body.cm8-on.cm8-panels:not(.no--animation) .modal.animate-down .modal__content{
 animation:none!important;
}
/* Swipe exit is driven in the same compositor as entry, never the native
   300ms CSS exit that outlives Lampa's 200ms removal timeout. */
/* Handheld sheets keep their actual curved shell throughout the transition.
   The attached, opaque footer follows the bottom edge during overshoot; never
   scale or crop the whole panel and never change its border-radius mid-flight. */
@media screen and (max-width:480px){
 body.cm8-on.cm8-panels:not(.no--animation) .modal__content,
 body.cm8-on.cm8-panels:not(.no--animation) .settings__content,
 body.cm8-on.cm8-panels:not(.no--animation) .selectbox__content{
   transform-origin:50% 100%;
   -webkit-backface-visibility:hidden;backface-visibility:hidden;
 }
 body.cm8-on.cm8-panels:not(.no--animation) .modal__content::after,
 body.cm8-on.cm8-panels:not(.no--animation) .settings__content::after,
 body.cm8-on.cm8-panels:not(.no--animation) .selectbox__content::after{
   content:'';position:absolute;top:calc(100% - 1px);left:0;right:0;
   height:clamp(215px,32vh,300px);background:inherit;border-radius:0;
   pointer-events:none;
 }
 /* Lampa's native bottom-sheet CSS plays a 300ms animation even when its
    controllers remove the panel after 200ms. One WAAPI owner per surface. */
 body.cm8-on.cm8-panels:not(.no--animation) .settings__content,
 body.cm8-on.cm8-panels:not(.no--animation) .selectbox__content{
   animation:none!important;transition:none!important;
   transform:translate3d(0,100%,0);
   clip-path:none!important;
 }
 body.cm8-on.cm8-panels.settings--open:not(.no--animation) .settings__content,
 body.cm8-on.cm8-panels.selectbox--open:not(.no--animation) .selectbox__content{
   transform:translate3d(0,0,0);
 }
}
@media screen and (min-width:481px){
 body.cm8-on.cm8-panels.cm94-waapi:not(.no--animation) .settings__content,
 body.cm8-on.cm8-panels.cm94-waapi:not(.no--animation) .selectbox__content{
   transition:none!important;animation:none!important;
   transform-origin:100% 65%;
 }
 body.cm8-on.cm8-panels:not(.cm94-waapi):not(.no--animation) .settings__content,
 body.cm8-on.cm8-panels:not(.cm94-waapi):not(.no--animation) .selectbox__content{
   transition:transform 330ms var(--cm8-spring)!important;
 }
} 
/* TV modal entrances feel like a cover becoming a full screen: slight depth,
   curved recoil at the end, with a solid shell and no translucency masks. */
body.cm8-on.cm9-tv.cm8-panels:not(.no--animation) .modal__content{
 transform-origin:50% 75%;
}
/* Restored LIGHT ON ARTWORK ONLY; never illuminate the travelling white
   focus backdrop. One clipped compositor layer per actual focus interaction. */
.cm94-poster-gleam{position:absolute;inset:0;border-radius:1em;
 pointer-events:none;overflow:hidden;z-index:5;contain:paint;}
.cm94-poster-gleam__beam{position:absolute;top:-10%;bottom:-10%;left:0;width:42%;
 background:linear-gradient(90deg,transparent,rgba(255,255,255,.06) 24%,
 rgba(255,255,255,.23) 49%,rgba(255,255,255,.06) 75%,transparent);
 transform:translate3d(-175%,0,0) skewX(-12deg);}
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
 transition:transform 255ms var(--cm8-spring)!important;
}
/* White native focus frame: no light sweeps ON THE FOCUS BACKING, no box shadow,
   no fixed-position halo, no extra composited child per poster. */
body.cm8-on.cm9-tv.cm8-focus:not(.no--animation) .card__view::after{
 content:"";position:absolute;top:-.5em;left:-.5em;right:-.5em;bottom:-.5em;
 border:.3em solid #fff;border-radius:1.4em;z-index:-1;pointer-events:none;
 opacity:0;transition:opacity 125ms ease-out!important;
}
body.cm8-on.cm9-tv.cm8-focus:not(.no--animation) .card.focus .card__view::after,
body.cm8-on.cm9-tv.cm8-focus:not(.no--animation) .card.hover .card__view::after{opacity:1}
body.cm8-on.cm9-tv.cm8-focus:not(.no--animation) .card.hover:not(.focus) .card__view::after{opacity:.6}
/* Keep native tab active background. Moving spotlight pills caused extra
   geometry reads/writes during navigation without improving usability. */
body.cm8-on.cm9-low-power.cm9-tv.cm8-focus:not(.no--animation) .card.focus .card__view,
body.cm8-on.cm9-low-power.cm9-tv.cm8-focus:not(.no--animation) .card.hover .card__view{transform:scale(1.032) translateZ(0)}
body.cm8-on.cm9-low-power.cm9-tv.cm8-focus:not(.no--animation) .card--wide.focus .card__view,
body.cm8-on.cm9-low-power.cm9-tv.cm8-focus:not(.no--animation) .card--wide.hover .card__view{transform:scale(1.016) translateZ(0)}
/* Lampa owns normal background/poster image loading; we do not filter it. */
`;
    function setupCSS(){
        if(!style){style=document.createElement('style');style.id='capsule-motion-style-v94';(document.head||document.documentElement).appendChild(style);}
        var value=CSS.replace(/\{\{(focus|press|popup|scene|spring)\}\}/g,function(_,key){
            if(key==='spring')return springEasing();if(key==='popup')return p().popup;
            return p()[key];
        });
        if(style.textContent!==value)style.textContent=value;
    }
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
    function removeGleam(){
        clearAnimation(gleamAnim);gleamAnim=null;gleamBeam=null;
        if(gleamBox){gleamBox.remove();gleamBox=null;}
    }
    function gleam(el,emphatic){
        if(!work()||!el||!el.matches||!el.matches('.card,.card-episode,.card-more'))return;
        // Only actual cover rectangles; never the white focus frame, tabs or
        // fullscreen activity. One short-lived composited beam in the whole app.
        var node=visualFor(el),r=visibleRect(node);
        if(!node||!onscreen(r)||r.width>innerWidth*.76)return;
        removeGleam();
        var box=document.createElement('div');box.className='cm94-poster-gleam';
        box.setAttribute('aria-hidden','true');
        var beam=document.createElement('div');beam.className='cm94-poster-gleam__beam';
        beam.style.opacity=emphatic?'.83':'.67';
        box.appendChild(beam);node.appendChild(box);
        gleamBox=box;gleamBeam=beam;
        var d=lowPower?260:(emphatic?365:320);
        // 2 GPU-compositable transforms; zero global DOM observation.
        gleamAnim=animate(beam,[
            {transform:'translate3d(-180%,0,0) skewX(-12deg)'},
            {transform:'translate3d(340%,0,0) skewX(-12deg)'}
        ],d,function(){if(gleamBox===box)removeGleam();});
        if(!gleamAnim)removeGleam();else gleamCount++;
    }
    function cardLong(el){
        if(!work()||!el||!el.matches||!el.matches('.card,.card-episode,.card-more,.explorer-card__head-img'))return;
        var node=visualFor(el),r=visibleRect(node);if(!node||!onscreen(r))return;
        var existing=longAnimations.get(node);clearAnimation(existing);
        var tv=tvMode(),choice=tv?Math.floor(Math.random()*3):0;
        var base=el.classList.contains('focus')?(tv?(el.classList.contains('card--wide')?(lowPower?1.016:1.026):(lowPower?1.032:1.052)):1.018):1;
        var duration=tv?275:300;
        var phase=function(x){return Math.sin(Math.PI*x);};
        var a=animate(node,sampled(duration,function(x,f){
            var b=phase(f),u=Math.sin(2*Math.PI*f)*Math.pow(Math.sin(Math.PI*f),2);
            var y=choice===2?-4.2*b:0;
            // Deterministic per frame, no jitter from changing randomness.
            var rotation=choice===1?1.15*u:0;
            var amp=tv?.022:.018;
            var sx=base*(1+(choice===0?amp*b:choice===2?.006*b:choice===1?.005*u:0));
            var sy=base*(1+(choice===0?amp*.52*b:choice===2?.011*b:choice===1?-.004*u:0));
            return {transform:'translate3d(0,'+y.toFixed(2)+'px,0) rotate('+rotation.toFixed(3)+'deg) scale('+sx.toFixed(4)+','+sy.toFixed(4)+')'};
        },'press'),duration,function(){longAnimations.delete(node);});
        if(a)longAnimations.set(node,a);
        if(tv){interactionCounts.tvLong++;gleam(el,true);}else interactionCounts.phoneHolds++;
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
        if(el.matches('.card,.card-episode,.card-more')&&!tvMode())gleam(el,true);
        var last=presses.get(node);clearAnimation(last);
        var isCard=el.matches('.card,.card-episode,.card-more');
        // Small anisotropic deformation: tight, visibly physical, no large zoom.
        var rest=isCard&&el.classList.contains('focus')?(tvMode()?(el.classList.contains('card--wide')?(lowPower?1.016:1.026):(lowPower?1.032:1.052)):(el.classList.contains('card--wide')?1.009:1.018)):1;
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
        if(lowPower||!work()||!flag('morph')||!recentAction||!root||!root.isConnected)return;
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
    // Rich interfaces need choreography, not an opacity veil over the page.
    // Move only the top-level content cluster; avoid gigantic background layers.
    function enterScene(root){
        if(lowPower||!work()||!flag('panels')||!root)return;
        var visual=root.querySelector('.full-start-new__right,.full-start__left,.full-start__body,.settings__body');
        if(!visual||!onscreen(visibleRect(visual)))return;
        var d=p().scene;
        animate(visual,sampled(d,function(x,f){
            // Move only the content cluster, never a backdrop or settings rows.
            var y=12*(1-x)+1.6*elasticTail(f);
            return {transform:'translate3d(0,'+y.toFixed(2)+'px,0)'};
        },'panel'),d);
    }
    // Independent, bottom-anchored physical entry: no wipe/reveal mask and no
    // full-height "flying layout". Contents and rounded shell stay together.
    function translateYAtRest(pane,fallback){
        try{
            var tr=getComputedStyle(pane).transform;
            var m=/matrix(3d)?\(([^)]+)\)/.exec(tr||'');
            if(m){var v=m[2].split(',').map(parseFloat);var y=m[1]?v[13]:v[5];
                if(isFinite(y))return y;}
        }catch(e){}
        return fallback;
    }
    function sheetRise(pane){
        var r=visibleRect(pane),height=r?r.height:innerHeight*.5;
        return clamp(height*.29,64,Math.min(198,innerHeight*.31));
    }
    function modalOpen(node){
        if(!node||!node.isConnected)return;
        var pane=node.querySelector('.modal__content');if(!pane)return;
        var r=visibleRect(pane);if(r)modalMetrics.set(node,r);
        if(!work()||!flag('panels')||!r||!onscreen(r))return;
        var prev=panelOpens.get(node);if(prev)clearAnimation(prev);
        var mobile=innerWidth<=480,d=mobile?360:(tvMode()?435:p().popup);
        var from=mobile?sheetRise(pane):23;
        var a=animate(pane,sampled(d,function(x,f){
            if(mobile){
                var shift=from*(1-x),rest=1-x;
                // x has a small natural overshoot; no bottom-corner morphing.
                var accent=.004*cushion(f);
                return {transform:'translate3d(0,'+shift.toFixed(2)+'px,0) scaleY('+(1-.010*rest-accent*.4).toFixed(5)+')'};
            }
            var rest=1-x,tail=elasticTail(f);
            return {transform:'translate3d(0,'+(32*rest+1.8*tail).toFixed(2)+'px,0) rotate('+(0.32*rest-.09*tail).toFixed(3)+'deg) scale('+(1-.042*rest+.002*tail).toFixed(5)+','+(1-.030*rest-.002*tail).toFixed(5)+')'};
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
        var open=panelOpens.get(node),current=open?translateYAtRest(pane,0):0;
        if(open)clearAnimation(open);
        panelOpens.delete(node);
        var h=visibleRect(pane),out=(h?h.height:innerHeight*.6)+16;
        var d=186; // Lampa sends Controller.back() after 200ms.
        var motion=animate(pane,sampled(d,function(x,f){
            var y=current+(out-current)*x;
            var shrink=.009*cushion(f);
            return {transform:'translate3d(0,'+y.toFixed(2)+'px,0) scale('+(1-shrink).toFixed(5)+','+(1-shrink*.7).toFixed(5)+')'};
        },'exit'),d,null,'forwards');
        var veil=animate(node,sampled(d,function(x,f){
            var a=clamp((f-.54)/.46,0,1);a=a*a*(3-2*a);
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
        var originalPane=node.querySelector('.modal__content');if(!originalPane)return;
        var complex=!!node.querySelector('video,iframe,canvas,object,embed') ||
                    node.querySelectorAll('*').length>40;
        var clone,pane;
        if(complex){
            // Avoid cloning interactive trees / images / images that decode on exit.
            clone=document.createElement('div');clone.className=node.className;
            pane=document.createElement('div');pane.className=originalPane.className;
            var caption=node.querySelector('.modal__title');
            if(caption){var title=document.createElement('div');title.className='modal__title';title.textContent=caption.textContent||'';pane.appendChild(title);}
            clone.appendChild(pane);
        }else{
            clone=node.cloneNode(true);pane=clone.querySelector('.modal__content');
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
        // Closing retraces the physical entry. The last pixels disappear
        // below the viewport instead of being chopped by an inset mask.
        var mobile=innerWidth<=480,d=mobile?280:p().popup;
        var bottom=mobile?Math.max(metric.height+14,innerHeight-metric.top+12):0;
        var a=animate(pane,sampled(d,function(x,f){
            var k=clamp(x,0,1),edge=clamp((f-.72)/.28,0,1);
            return mobile?{transform:'translate3d(0,'+(bottom*k).toFixed(2)+'px,0) scale('+(1-.013*cushion(f)).toFixed(5)+')',opacity:String(1-edge)}:
                {transform:modalPose(k,false),opacity:String(1-edge)};
        },'exit'),d,function(){clone.remove();leavingWindows.delete(clone);});
        if(!a){clone.remove();leavingWindows.delete(clone);}
        // Also handle hidden tabs / cancelled animations without leaked clones.
        timeout(function(){if(clone.isConnected)clone.remove();leavingWindows.delete(clone);},d+65);
    }
    // Each interruption samples the actual presentation transform before
    // cancelling the old WAAPI animation. New motion begins from that point,
    // not from an obsolete closed/open state (no teleport on rapid taps).
    function sheetPose(y,scaleX,scaleY){
        return 'translate3d(0,'+y.toFixed(2)+'px,0) scale('+scaleX.toFixed(5)+','+scaleY.toFixed(5)+')';
    }
    function readTranslate(pane,axis,fallback){
        try{
            var t=getComputedStyle(pane).transform;
            if(!t||t==='none')return 0;
            var m=/matrix(3d)?\(([^)]+)\)/.exec(t);
            if(m){var values=m[2].split(',').map(parseFloat);
                var v=m[1]?values[axis==='x'?12:13]:values[axis==='x'?4:5];
                if(isFinite(v))return v;
            }
        }catch(e){}
        return fallback;
    }
    function tvSheetEntry(kind){
        var root=document.querySelector('.'+kind),pane=root&&root.querySelector('.'+kind+'__content');
        if(!pane||!pane.isConnected)return;
        var prev=sheetEntries.get(kind)||sheetExits.get(kind);
        var finalX=-pane.offsetWidth;
        if(!isFinite(finalX)||finalX>=-10)return;
        var startX=prev?readTranslate(pane,'x',finalX+60):finalX+Math.min(78,pane.offsetWidth*.22);
        // Sample the actual compositor position BEFORE cancelling an exit.
        clearAnimation(sheetEntries.get(kind));clearAnimation(sheetExits.get(kind));
        sheetEntries.delete(kind);sheetExits.delete(kind);
        var travel=startX-finalX, d=440;
        var a=animate(pane,sampled(d,function(x,f){
            var remaining=1-x;
            var wobble=2.4*elasticTail(f);
            var dx=travel*remaining+wobble;
            var dy=13*remaining+.9*elasticTail(f);
            var sx=1-.026*remaining+.003*elasticTail(f);
            var sy=1-.019*remaining-.002*elasticTail(f);
            var tilt=.60*remaining-.16*elasticTail(f);
            return {transform:'translate3d('+(finalX+dx).toFixed(2)+'px,'+dy.toFixed(2)+'px,0) rotate('+tilt.toFixed(3)+'deg) scale('+sx.toFixed(5)+','+sy.toFixed(5)+')'};
        },'panel'),d,function(){if(sheetEntries.get(kind)===a)sheetEntries.delete(kind);});
        if(a)sheetEntries.set(kind,a);
    }
    function tvSheetExit(kind){
        var root=document.querySelector('.'+kind),pane=root&&root.querySelector('.'+kind+'__content');
        if(!pane||!pane.isConnected)return;
        // Body has already lost --open when the observer runs: CSS is now
        // at its CLOSED x=0. Recover the visible OPEN position explicitly.
        var prior=sheetEntries.get(kind)||sheetExits.get(kind);
        var x=prior?readTranslate(pane,'x',-pane.offsetWidth):-pane.offsetWidth;
        clearAnimation(sheetEntries.get(kind));clearAnimation(sheetExits.get(kind));
        sheetEntries.delete(kind);sheetExits.delete(kind);
        var d=290, a=animate(pane,sampled(d,function(q,f){
            // Closed state: pane's left:100% with no translation. Same direction
            // and gently receding scale as the entry, no fade exposing content.
            return {transform:'translate3d('+(x*(1-q)).toFixed(2)+'px,'+(9*q).toFixed(2)+'px,0) scale('+(1-.018*q).toFixed(5)+','+(1-.009*q).toFixed(5)+')'};
        },'exit'),d,function(){if(sheetExits.get(kind)===a)sheetExits.delete(kind);});
        if(a)sheetExits.set(kind,a);
    }
    function sheetEntry(kind){
        if(!work())return;
        if(innerWidth>480){tvSheetEntry(kind);return;}
        var root=document.querySelector('.'+kind),pane=root&&root.querySelector('.'+kind+'__content');
        if(!pane||!pane.isConnected)return;
        var incoming=sheetEntries.get(kind),previous=sheetExits.get(kind);
        var travel=sheetRise(pane),begin=previous?translateYAtRest(pane,travel):travel;
        if(incoming)clearAnimation(incoming);
        if(previous){clearAnimation(previous);sheetExits.delete(kind);}
        var d=365;
        var a=animate(pane,sampled(d,function(x,f){
            var shift=begin*(1-x),rest=1-x;
            var bounce=.0045*cushion(f);
            return {transform:sheetPose(shift,1,1-.010*rest-.4*bounce)};
        },'panel'),d,function(){
            if(sheetEntries.get(kind)===a)sheetEntries.delete(kind);
        });
        if(a)sheetEntries.set(kind,a);
    }
    function sheetExit(kind,swipe){
        if(!work())return;
        if(innerWidth>480){tvSheetExit(kind);return;}
        var root=document.querySelector('.'+kind),pane=root&&root.querySelector('.'+kind+'__content');
        if(!root||!pane||!pane.isConnected)return;
        if(sheetExits.get(kind))return;
        var incoming=sheetEntries.get(kind);
        var start=incoming?translateYAtRest(pane,0):0;
        if(incoming){clearAnimation(incoming);sheetEntries.delete(kind);}
        var rect=visibleRect(pane),out=(rect?rect.height:innerHeight*.6)+16;
        // Swipe has a hard 200ms lifetime. Do not re-enter open geometry on
        // the final frame: hold its destination until Lampa updates the class.
        var d=swipe?185:270;
        var a=animate(pane,sampled(d,function(x,f){
            var shift=start+(out-start)*x;
            var squeeze=.013*cushion(f);
            return {transform:sheetPose(shift,1-squeeze,1-squeeze*.58)};
        },'exit'),d,
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
        sheetExits.forEach(function(a){clearAnimation(a);});sheetExits.clear();
        sheetEntries.forEach(function(a){clearAnimation(a);});sheetEntries.clear();
        swipeSheetUntil.clear();
        clearAnimation(menuAnim);menuAnim=null;
        removeGleam();
    }

    // Settings contents are replaced synchronously by Lampa. The old row
    // animation made the first items jump whenever a category was switched;
    // leave content in its final position and animate only enclosing surfaces.
    function activityChange(event){
        lastActivityAt=now();removeLeavingWindows();
        // A page switch can remove the old tab container without removing
        // our detached Map entry; release all per-page geometry on navigation.
        stopMorph();
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
    function suspendObservers(){
        if(observer){observer.disconnect();observer=null;}
        componentObservers.forEach(function(o){o.disconnect();});componentObservers=[];
        modalObservers.forEach(function(o){o.disconnect();});modalObservers.clear();
    }
    function watchModal(node){
        if(!node||modalObservers.has(node)||node.classList.contains('cm8-outgoing-modal'))return;
        var o=new MutationObserver(function(records){
            if(!active)return;
            records.forEach(function(m){
                var was=m.oldValue||'';
                if(node.classList.contains('animate-down')&&was.indexOf('animate-down')<0)
                    modalSwipeExit(node);
                else if(node.classList.contains('animate')&&was.indexOf('animate')<0)
                    modalOpen(node);
            });
        });
        o.observe(node,{attributes:true,attributeFilter:['class'],attributeOldValue:true});
        modalObservers.set(node,o);
        if(node.classList.contains('animate-down'))modalSwipeExit(node);
        else if(node.classList.contains('animate'))modalOpen(node);
    }
    function watchSheet(node){
        if(!node)return;
        var kind=node.classList.contains('settings')?'settings':'selectbox';
        var o=new MutationObserver(function(records){
            if(!active)return;
            records.forEach(function(m){
                if(node.classList.contains('animate-down')&&(m.oldValue||'').indexOf('animate-down')<0){
                    swipeSheetUntil.set(kind,true);sheetExit(kind,true);
                }
            });
        });
        o.observe(node,{attributes:true,attributeFilter:['class'],attributeOldValue:true});
        componentObservers.push(o);
    }
    function setupObserver(){
        if(observer||typeof MutationObserver==='undefined')return;
        // Lampa appends modals directly to document.body. Root panels are
        // persistent. Neither needs 10,000 descendants observed for class changes.
        observer=new MutationObserver(function(changes){
            if(!active)return;
            changes.forEach(function(m){
                if(m.type==='childList'){
                    Array.from(m.removedNodes).forEach(function(node){
                        if(node.nodeType===1&&node.matches&&node.matches('.modal')){
                            var o=modalObservers.get(node);if(o){o.disconnect();modalObservers.delete(node);}
                            modalRemoved(node);
                        }
                    });
                    Array.from(m.addedNodes).forEach(function(node){
                        if(node.nodeType===1&&node.matches&&node.matches('.modal'))watchModal(node);
                    });
                    return;
                }
                var from=m.oldValue||'',el=document.body;
                if(noMotion()){
                    stopMorph();removeLeavingWindows();stopAnimations();return;
                }
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
            });
        });
        observer.observe(document.body,{attributes:true,attributeFilter:['class'],attributeOldValue:true,childList:true,subtree:false});
        Array.from(document.querySelectorAll('.settings,.selectbox')).forEach(watchSheet);
        Array.from(document.querySelectorAll('body > .modal')).forEach(watchModal);
    }
    function bindInteractions(){
        if(interactionsBound||typeof jQuery!=='function')return;
        interactionsBound=true;
        var $=jQuery;
        $(document).on('hover:focus.capsulemotion8 hover:hover.capsulemotion8','.card,.card-episode,.card-more',function(){
            if(tvMode()&&!document.body.classList.contains('settings--open')&&!document.body.classList.contains('selectbox--open'))gleam(this,false);
        });
        $(document).on('hover:long.capsulemotion8','.card,.card-episode,.card-more,.explorer-card__head-img',function(){cardLong(this);});
        $(document).on('hover:enter.capsulemotion8','.selector',function(){
            if(this.matches('.card,.card-episode'))lastAction(this);
            press(this);
        });
        $(document).on('pointerdown.capsulemotion8 touchstart.capsulemotion8','.selector',function(e){
            if(e.type==='pointerdown'&&e.originalEvent&&e.originalEvent.pointerType==='touch')return;
            if(this.matches('.card,.card-episode'))lastAction(this);
            press(this);
        });
    }
    function stopInteractions(){
        if(interactionsBound&&typeof jQuery==='function')jQuery(document).off('.capsulemotion8');
        removeGleam();interactionsBound=false;
    }
    function registerEvents(){
        if(Lampa.Modal&&Lampa.Modal.listener){
            listen(Lampa.Modal.listener,'fullshow',function(event){
                if(!active)return;
                var el=event&&event.html&&(event.html[0]||event.html);
                if(!el||!el.querySelector)return;
                var pane=el.querySelector('.modal__content');
                var r=visibleRect(pane);if(r)modalMetrics.set(el,r);
                if(!modalObservers.has(el))watchModal(el);
            });
        }
        listen(Lampa.Listener,'activity',function(e){
            if(!e||!active)return;
            if(e.type==='start')activityChange(e);
            if(e.type==='destroy')stopMorph();
        });
        listen(Lampa.Listener,'resize_end',function(){apply();});
        visibilityHandler=function(){if(document.hidden){
            stopMorph();removeLeavingWindows();stopAnimations();
        }};
        document.addEventListener('visibilitychange',visibilityHandler,{passive:true});
    }
    function apply(){
        if(!initialized||destroyed||!document.body)return;
        reduced=!!(media&&media.matches);
        active=enabledSetting()&&!reduced; // CSS-only focus fallback for older TVs without WAAPI
        suspendObservers();stopInteractions();
        ['cm8-on','cm8-focus','cm8-panels','cm9-tv','cm9-phone','cm9-low-power','cm94-waapi'].forEach(function(x){document.body.classList.remove(x);});
        stopMorph();removeLeavingWindows();stopAnimations();
        if(!active)return;
        setupCSS();document.body.classList.add('cm8-on','cm8-focus','cm8-panels',tvMode()?'cm9-tv':'cm9-phone');
        if(lowPower)document.body.classList.add('cm9-low-power');
        if(typeof Element!=='undefined'&&typeof Element.prototype.animate==='function')document.body.classList.add('cm94-waapi');
        setupObserver();bindInteractions();
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
        if(appListener&&window.Lampa&&Lampa.Listener&&Lampa.Listener.remove)Lampa.Listener.remove('app',appListener);
        if(media&&mediaListener){try{if(media.removeEventListener)media.removeEventListener('change',mediaListener);else if(media.removeListener)media.removeListener(mediaListener);}catch(e){}}
        unlisten();stopMorph();removeLeavingWindows();stopAnimations();
        if(visibilityHandler)document.removeEventListener('visibilitychange',visibilityHandler);
        if(style){style.remove();style=null;}
        if(document.body)['cm8-on','cm8-focus','cm8-panels','cm9-tv','cm9-phone','cm9-low-power','cm94-waapi'].forEach(function(x){document.body.classList.remove(x);});
        if(settingsRegistered&&window.Lampa&&Lampa.SettingsApi&&Lampa.SettingsApi.removeComponent)Lampa.SettingsApi.removeComponent(COMPONENT);
        if(window[KEY]===api)delete window[KEY];
    }
    var api={version:VERSION,stop:stop,refresh:apply,diagnostics:function(){return {
        version:VERSION,enabled:active&&!noMotion(),mode:tvMode()?'television':'phone',waapi:typeof Element!=='undefined'&&typeof Element.prototype.animate==='function',richMode:!!(document.body&&!document.body.classList.contains('light--version')),
        activeAnimations:animations.size,posterOverlay:!!overlayMorph,focusOverlay:false,
        tvLongEffects:interactionCounts.tvLong,shineEffects:gleamCount,phoneLongEffects:interactionCounts.phoneHolds,
        lowPower:lowPower,observerScope:'body + 2 panels + opened modals',posterGleam:!!gleamBox,
        inlineSheetMutations:0,sheetExitsStarted:exitCount,modalExitClones:modalExitCount,exitingWindows:leavingWindows.size
    };}};
    window[KEY]=api;boot();
})();