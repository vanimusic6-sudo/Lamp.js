/*
 * CAPSULE Motion 8.1.0 — liquid microphysics with stable panel geometry.
 * Copyright (c) 2026 CAPSULE. GPL-2.0-or-later.
 *
 * Rebuilt after studying Lampa's activity, settings, selectbox, modal, scroll
 * lifecycle and the recorded mobile regression in normal (non-light) mode.
 * No Lampa controller patches; scrolling contract and playback are untouched.
 */
(function () {
    'use strict';
    var VERSION='8.1.0', KEY='capsule_motion_runtime', COMPONENT='capsule_motion';
    var existing=window[KEY];
    if(existing){
        if(existing.version===VERSION)return;
        if(typeof existing.stop!=='function')return;
        try {existing.stop();} catch(e){return;}
    }

    // One carefully tuned motion language. Modes were slowing everything down;
    // keep motion tuning internal and expose only a single on/off setting.
    var motion={focus:322,press:205,scene:355,popup:345,bounce:.77,warp:.036};
    var initialized=false, active=false, reduced=false, destroyed=false;
    var style=null, cursor=null, cursorAnim=null, cursorTarget=null, raf=0;
    var observer=null, media=null, mediaListener=null, appListener=null, bootTimer=0, bootTries=0;
    var subs=[], timers=new Set(), animations=new Set(), recentAction=null;
    var tabPills=new Map(), tabRaf=0, navToken=0, overlayMorph=null;
    var settingsRegistered=false, lastPage=null;
    var modalMetrics=new WeakMap(), leavingWindows=new Set();
    var panelOpens=new WeakMap(), exitCount=0, modalExitCount=0;
    var sheetExits=new Map(), sheetEntries=new Map(), menuAnim=null, swipeSheetUntil=new Map();
    var swipeModal=new WeakSet(), lastActivityAt=0;

    function get(name,fallback){try{var v=Lampa.Storage.get('capsule_motion_'+name,fallback);return v==null?fallback:v;}catch(e){return fallback;}}
    // Upgrade: preserve an explicitly disabled old preset until user changes the switch.
    // The old per-feature toggles no longer fragment the animation system.
    function enabledSetting(){
        var setting=get('enabled',null);
        if(setting===null||typeof setting==='undefined')return String(get('mode','fluid'))!=='off';
        return setting===true||setting==='true'||setting===1;
    }
    function flag(name){return name==='enabled'?enabledSetting():true;}
    function p(){return motion;}
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
    function isMobile(){return (innerWidth<=480)||document.body.classList.contains('mobile--view');}
    function noMotion(){return !active||destroyed||reduced||document.body.classList.contains('no--animation');}
    function work(){return !noMotion()&&typeof Element!=='undefined'&&typeof Element.prototype.animate==='function';}
    function hasBusyOverlay(){return document.body.classList.contains('settings--open')||document.body.classList.contains('selectbox--open')||document.body.classList.contains('menu--open')||!!document.querySelector('.modal:not(.hide)');}
    function isTouchOnly(){return !!(window.matchMedia&&matchMedia('(hover: none)').matches)||isMobile();}
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
        var freq=kind==='press'?24:kind==='exit'?18.0:kind==='panel'?18.2:18.8;
        var damping=kind==='press'?.76:kind==='exit'?.85:kind==='panel'?.80:p().bounce;
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
        var rise=isMobilePanel?23:23, squash=isMobilePanel?.009:.030;
        // Stable corners and under-sheet skirt; desktop dialogs can compress
        // very slightly, but never reshape the corner radius itself.
        return 'translate3d(0,'+(rise*closed).toFixed(2)+'px,0) scale('+(1-(isMobilePanel?.004:.026)*closed).toFixed(5)+','+(1-squash*closed).toFixed(5)+')';
    }
    function animate(node,frames,duration,finish){
        if(!work()||!node||!node.isConnected||!node.animate)return null;
        try {
            var a=node.animate(frames,{duration:duration,easing:'linear',fill:'none'});
            animations.add(a);
            var completed=false;
            function end(){if(completed)return;completed=true;animations.delete(a);if(finish)finish();}
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
 --cm8-travel:cubic-bezier(.36,0,.15,1);--cm8-spring:cubic-bezier(.34,0,.16,1)}
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
body.cm8-on.cm8-panels:not(.no--animation) .modal.animate .modal__content{
 animation:none!important;
}
/* The Lampa panels' border radii are layout geometry, NOT animation frames.
   A matching-color bottom skirt covers the small region opened by movement;
   it does not scale, blur or affect the actual panel's click targets. */
@media screen and (max-width:480px){
 body.cm8-on.cm8-panels:not(.no--animation) .modal__content,
 body.cm8-on.cm8-panels:not(.no--animation) .settings__content,
 body.cm8-on.cm8-panels:not(.no--animation) .selectbox__content{
   transform-origin:50% 100%;
 }
 body.cm8-on.cm8-panels:not(.no--animation) .modal__content::after,
 body.cm8-on.cm8-panels:not(.no--animation) .settings__content::after,
 body.cm8-on.cm8-panels:not(.no--animation) .selectbox__content::after{
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
/* Focus halo (TV / mouse only). Hidden whenever an overlay is open. */
.cm8-cursor{position:fixed;left:0;top:0;width:0;height:0;box-sizing:border-box;
 border:2px solid rgba(255,255,255,.95);border-radius:12px;z-index:15;
 pointer-events:none;contain:layout style;transform-origin:center center;
 box-shadow:0 0 0 1px rgba(0,0,0,.19)}
.cm8-cursor.cm8-hidden{display:none}
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
        if(!style){style=document.createElement('style');style.id='capsule-motion-style-v7';(document.head||document.documentElement).appendChild(style);}
        var value=CSS.replace(/\{\{(focus|press|popup|scene|spring)\}\}/g,function(_,key){
            if(key==='spring')return springEasing();if(key==='popup')return p().popup;
            return p()[key];
        });
        if(style.textContent!==value)style.textContent=value;
    }
    function hideCursor(){
        clearAnimation(cursorAnim);cursorAnim=null;cursorTarget=null;
        if(cursor)cursor.classList.add('cm8-hidden');
    }
    function pickFocus(){
        // Lampa can keep .focus in inactive activities. Scope to current visible UI.
        var context=document.querySelector('.modal:not(.hide)')||
            (document.body.classList.contains('selectbox--open')?document.querySelector('.selectbox'):null)||
            (document.body.classList.contains('settings--open')?document.querySelector('.settings'):null)||
            document.querySelector('.activity--active')||document;
        var focused=context.querySelectorAll('.selector.focus,.card.focus,.card.hover');
        for(var i=focused.length-1;i>=0;i--){
            var el=focused[i];if(onscreen(visibleRect(el))&&el.offsetParent!==null)return el;
        }
        return null;
    }
    function cursorRect(node){
        if(!node)return null;
        var v=node.matches('.card')?node.querySelector('.card__view'):
            node.matches('.card-episode')?node.querySelector('.full-episode'):
            node.matches('.card-more')?node.querySelector('.card-more__box'):node;
        var r=visibleRect(v);if(!r)return null;
        var pad=3;return {left:r.left-pad,top:r.top-pad,width:r.width+2*pad,height:r.height+2*pad,
            right:r.right+pad,bottom:r.bottom+pad};
    }
    function focusAllowed(el){return !!(el&&el.matches&&el.matches('.card,.card-episode,.card-more,.explorer-card__head-img,.navigation-tabs__button,.navigation-bar__item'));}
    function syncCursor(){
        raf=0;
        if(!work()||!flag('focus')||isTouchOnly()||hasBusyOverlay())return hideCursor();
        var selected=pickFocus();if(!focusAllowed(selected))return hideCursor();
        var r=cursorRect(selected);if(!onscreen(r))return hideCursor();
        if(!cursor){cursor=document.createElement('div');cursor.className='cm8-cursor cm8-hidden';cursor.setAttribute('aria-hidden','true');document.body.appendChild(cursor);}
        if(cursorTarget===selected&&!cursor.classList.contains('cm8-hidden'))return;
        var old=cursor.classList.contains('cm8-hidden')?null:visibleRect(cursor);
        clearAnimation(cursorAnim);cursorAnim=null;
        cursor.classList.remove('cm8-hidden');
        cursor.style.left=r.left+'px';cursor.style.top=r.top+'px';
        cursor.style.width=r.width+'px';cursor.style.height=r.height+'px';
        cursor.style.borderRadius=clamp(r.width*.06,9,20)+'px';
        var d=old?Math.hypot(r.left-old.left,r.top-old.top):0;
        if(old&&d<Math.max(innerHeight,innerWidth)*.65){
            var dx=old.left-r.left,dy=old.top-r.top;
            var sx=clamp(old.width/r.width,.4,2.5),sy=clamp(old.height/r.height,.4,2.5);
            var duration=clamp(p().focus+d*.042,p().focus,p().focus+52);
            cursorAnim=animate(cursor,sampled(duration,function(x,f){
                // Travel stretches along its axis, then recovers. Never smear text.
                var k=1-x,swell=p().warp*cushion(f),micro=.013*ripple(f);
                var alongX=Math.abs(dx)/(d||1),alongY=Math.abs(dy)/(d||1);
                var stretchX=swell*(alongX*1.15-alongY*.34)+micro;
                var stretchY=swell*(alongY*1.15-alongX*.34)-micro*.65;
                var radius=clamp(r.width*.06,9,20)*(1+.28*swell);
                return {transform:'translate3d('+(dx*k).toFixed(2)+'px,'+(dy*k).toFixed(2)+'px,0) scale('+(1+(sx-1)*k+stretchX).toFixed(4)+','+(1+(sy-1)*k+stretchY).toFixed(4)+')',borderRadius:radius.toFixed(2)+'px'};
            }),duration);
        }
        cursorTarget=selected;
    }
    function scheduleCursor(){if(!raf)raf=later(syncCursor);}
    function visualFor(el){
        if(!el||!el.matches)return null;
        if(el.matches('.card'))return el.querySelector('.card__view');
        if(el.matches('.card-episode'))return el.querySelector('.full-episode');
        if(el.matches('.card-more'))return el.querySelector('.card-more__box');
        if(el.matches('.head__action,.simple-button,.full-start__button,.modal__button,.navigation-bar__item,.navigation-tabs__button,.player-panel .button,.menu__item,.settings-folder,.settings-param,.selectbox-item'))return el;
        return null;
    }
    var presses=new WeakMap(), pressTimes=new WeakMap();
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
        var rest=isCard&&el.classList.contains('focus')?(el.classList.contains('card--wide')?1.009:1.018):1;
        var dur=p().press;
        var a=animate(node,sampled(dur,function(x,f){
            // Contact compresses the surface; recoil grows into a tiny squash.
            // Two axes trade volume, rather than scaling every piece of UI equally.
            var impact=contactEnvelope(f),recoil=elasticTail(f);
            var row=el.matches('.menu__item,.settings-folder,.settings-param,.selectbox-item');
            var strength=isCard?(el.classList.contains('card--wide')?.57:.82):(row?.53:1);
            // Compress forward on contact, gently displace mass to the other
            // axis and settle. Wide artwork stays significantly more rigid.
            var sx=rest*(1-.046*strength*impact+.020*strength*recoil);
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
        // Keep corner radii fixed. A matching outgoing path makes motion reversible.
        var mobile=isMobile();
        var a=animate(pane,sampled(d,function(x){
            return {transform:modalPose(1-x,mobile)};
        },'panel'),d);
        if(a)panelOpens.set(node,a);
    }
    function forgetModal(node){
        if(!node)return;
        var open=panelOpens.get(node);if(open)clearAnimation(open);
        panelOpens.delete(node);
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
        var mobile=isMobile(),d=mobile?255:p().popup;
        var a=animate(pane,sampled(d,function(x,f){
            var k=clamp(x,0,1),edge=clamp((f-.90)/.10,0,1);
            return {transform:modalPose(k,mobile),opacity:String(1-edge)};
        },'exit'),d,function(){clone.remove();leavingWindows.delete(clone);});
        if(!a){clone.remove();leavingWindows.delete(clone);}
        // Also handle hidden tabs / cancelled animations without leaked clones.
        timeout(function(){if(clone.isConnected)clone.remove();leavingWindows.delete(clone);},d+65);
    }
    function sheetProgressPercent(pane){
        try{
            // Snapshot the live compositor position BEFORE canceling an exit.
            // DOMMatrixReadOnly is absent on older TVs; CSS matrix parsing is enough.
            var v=getComputedStyle(pane).transform;
            if(!v||v==='none')return 0;
            var match=/matrix(3d)?\(([^)]+)\)/.exec(v);
            if(!match)return 0;
            var coords=match[2].split(',').map(parseFloat);
            var y=match[1]?coords[13]:coords[5];
            return clamp(100*y/Math.max(1,pane.offsetHeight),0,104);
        }catch(e){return 0;}
    }
    function sheetEntry(kind){
        if(!work()||!isMobile())return;
        var root=document.querySelector('.'+kind),pane=root&&root.querySelector('.'+kind+'__content');
        if(!pane||!pane.isConnected)return;
        var prev=sheetEntries.get(kind),oldExit=sheetExits.get(kind);
        var startPercent=oldExit?sheetProgressPercent(pane):104;
        if(prev)clearAnimation(prev);
        if(oldExit){clearAnimation(oldExit);sheetExits.delete(kind);}
        // The whole sheet is a rigid rounded surface. Its geometry is fixed.
        // The under-sheet continuation ensures no dark stripe peeks out below.
        var d=oldExit?265:325;
        var a=animate(pane,sampled(d,function(x){
            return {transform:'translate3d(0,'+((1-x)*startPercent).toFixed(3)+'%,0)'};
        },'panel'),d,function(){if(sheetEntries.get(kind)===a)sheetEntries.delete(kind);});
        if(a)sheetEntries.set(kind,a);
    }
    function sheetExit(kind,swipe){
        if(!work()||!isMobile())return;
        var root=document.querySelector('.'+kind),pane=root&&root.querySelector('.'+kind+'__content');
        if(!root||!pane||!pane.isConnected)return;
        var previous=sheetExits.get(kind);if(previous)return;
        var incoming=sheetEntries.get(kind),starting=incoming?sheetProgressPercent(pane):0;
        if(incoming){clearAnimation(incoming);sheetEntries.delete(kind);}
        // Match opening's exact endpoints. Swipe retains Lampa's 200ms back
        // contract, while regular close uses a symmetric 325ms travel.
        var d=swipe?170:325;
        var a=animate(pane,sampled(d,function(x){
            var y=starting+(100-starting)*x;
            return {transform:'translate3d(0,'+y.toFixed(3)+'%,0)'};
        },swipe?'exit':'panel'),d,function(){if(sheetExits.get(kind)===a)sheetExits.delete(kind);});
        if(a){sheetExits.set(kind,a);exitCount++;}
    }
    function menuChange(open){
        if(!work()||!flag('panels')||!document.body.classList.contains('light--version'))return;
        var node=document.querySelector('.wrap__left .menu');
        if(!node||!onscreen(visibleRect(node)))return;
        clearAnimation(menuAnim);menuAnim=null;
        var d=295;
        menuAnim=animate(node,sampled(d,function(x,f){
            var k=open?1-x:x;
            var swell=p().warp*.28*cushion(f),j=.004*ripple(f);
            return {transform:'translate3d('+(-11*k).toFixed(2)+'px,0,0) scale('+(1-.013*k+swell+j).toFixed(4)+','+(1-.009*k-swell*.50-j*.72).toFixed(4)+')'};
        }),d);
    }
    function removeLeavingWindows(){
        leavingWindows.forEach(function(el){el.remove();});leavingWindows.clear();
        sheetExits.forEach(function(a){clearAnimation(a);});sheetExits.clear();
        sheetEntries.forEach(function(a){clearAnimation(a);});sheetEntries.clear();
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
                        if((swipeSheetUntil.get('settings')||0)<=now())sheetExit('settings',false);
                    }
                    if(from.indexOf('selectbox--open')>=0&&!el.classList.contains('selectbox--open')){
                        if((swipeSheetUntil.get('selectbox')||0)<=now())sheetExit('selectbox',false);
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
                    if(el.matches('.modal'))swipeModal.add(el);
                    else if(el.matches('.settings')){swipeSheetUntil.set('settings',now()+450);sheetExit('settings',true);}
                    else if(el.matches('.selectbox')){swipeSheetUntil.set('selectbox',now()+450);sheetExit('selectbox',true);}
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
            $(document).on('hover:enter.capsulemotion8','.selector',function(){lastAction(this);press(this);});
            // Touchstart is immediate; click may fire later, but don't send
            // a second press. Lampa binds its own click and navigation.
            $(document).on('pointerdown.capsulemotion8 touchstart.capsulemotion8','.selector',function(e){
                if(e.type==='pointerdown'&&e.originalEvent&&e.originalEvent.pointerType==='touch')return;
                lastAction(this);press(this);
            });
        }
        setupObserver();
        listen(Lampa.Listener,'resize_end',function(){stopMorph();hideCursor();clearTabs();scheduleCursor();scheduleTabs();});
    }
    function apply(){
        if(!initialized||destroyed||!document.body)return;
        reduced=!!(media&&media.matches);
        active=enabledSetting()&&!reduced&&typeof Element!=='undefined'&&typeof Element.prototype.animate==='function';
        ['cm8-on','cm8-focus','cm8-panels'].forEach(function(x){document.body.classList.remove(x);});
        stopMorph();hideCursor();clearTabs();removeLeavingWindows();stopAnimations();
        if(!active)return;
        setupCSS();document.body.classList.add('cm8-on','cm8-focus','cm8-panels');
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
        unlisten();stopMorph();hideCursor();clearTabs();removeLeavingWindows();stopAnimations();
        if(cursor){cursor.remove();cursor=null;}
        if(style){style.remove();style=null;}
        if(document.body)['cm8-on','cm8-focus','cm8-panels'].forEach(function(x){document.body.classList.remove(x);});
        if(settingsRegistered&&window.Lampa&&Lampa.SettingsApi&&Lampa.SettingsApi.removeComponent)Lampa.SettingsApi.removeComponent(COMPONENT);
        if(window[KEY]===api)delete window[KEY];
    }
    var api={version:VERSION,stop:stop,refresh:apply,diagnostics:function(){return {
        version:VERSION,enabled:active&&!noMotion(),mode:'liquid-balanced',richMode:!!(document.body&&!document.body.classList.contains('light--version')),
        activeAnimations:animations.size,posterOverlay:!!overlayMorph,focusOverlay:!!(cursor&&!cursor.classList.contains('cm8-hidden')),
        inlineSheetMutations:0, sheetExitsStarted:exitCount, modalExitClones:modalExitCount, exitingWindows:leavingWindows.size
    };}};
    window[KEY]=api;boot();
})();
