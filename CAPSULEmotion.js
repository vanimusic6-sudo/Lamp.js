/*
 * CAPSULE Motion 5.0.0 — Lampa motion repair / spatial spring system.
 * Copyright (c) 2026 CAPSULE. GPL-2.0-or-later.
 *
 * Rebuilt after studying Lampa's activity, settings, selectbox, modal, scroll
 * lifecycle and the recorded mobile regression in normal (non-light) mode.
 * No Lampa controller patches; scrolling contract and playback are untouched.
 */
(function () {
    'use strict';
    var VERSION='5.0.0', KEY='capsule_motion_runtime', COMPONENT='capsule_motion';
    var existing=window[KEY];
    if(existing){
        if(existing.version===VERSION)return;
        if(typeof existing.stop!=='function')return;
        try {existing.stop();} catch(e){return;}
    }

    var profiles={
        fluid:{name:'Пластичный', focus:268, press:188, scene:305, popup:300, bounce:.79, warp:.023},
        elastic:{name:'Упругий',focus:300, press:206, scene:335, popup:325, bounce:.72, warp:.031},
        subtle:{name:'Деликатный',focus:215, press:155, scene:255, popup:245, bounce:.89, warp:.012}
    };
    var profileName='fluid', initialized=false, active=false, reduced=false, destroyed=false;
    var style=null, cursor=null, cursorAnim=null, cursorTarget=null, raf=0;
    var observer=null, media=null, mediaListener=null, appListener=null, bootTimer=0, bootTries=0;
    var subs=[], timers=new Set(), animations=new Set(), recentAction=null;
    var tabPills=new Map(), tabRaf=0, navToken=0, overlayMorph=null;
    var settingsRegistered=false, lastPage=null;

    function get(name,fallback){try{var v=Lampa.Storage.get('capsule_motion_'+name,fallback);return v==null?fallback:v;}catch(e){return fallback;}}
    function flag(name){var x=get(name,true);return x===true||x==='true'||x===1;}
    function p(){return profiles[profileName]||profiles.fluid;}
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
    function unlisten(){subs.forEach(function(x){try{if(x.bus.remove)x.bus.remove(x.event,x.fn);}catch(e){}});subs=[];if(observer){observer.disconnect();observer=null;}if(typeof jQuery==='function')jQuery(document).off('.capsulemotion5');}

    // A sampled, damped, second-order spring. Precomputed keyframes: no
    // permanent rAF loop, no opacity fog, no scaling text on whole pages.
    function spring(t,zeta,frequency){
        var a=zeta*frequency,wd=frequency*Math.sqrt(Math.max(1e-6,1-zeta*zeta));
        return 1-Math.exp(-a*t)*(Math.cos(wd*t)+a/wd*Math.sin(wd*t));
    }
    function sampled(duration,maker){
        var frames=[], count=Math.min(32,Math.max(16,Math.round(duration/12)));
        for(var i=0;i<=count;i++){
            var f=i/count, x=i===count?1:spring(f*duration/1000,p().bounce,24);
            var value=maker(x,f);value.offset=f;frames.push(value);
        }
        return frames;
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
            var f=i/45,x=i===45?1:spring(f*.28,p().bounce,24);
            stops.push((Math.round(x*10000)/10000)+' '+(Math.round(f*10000)/100)+'%');
        }
        return 'linear('+stops.join(',')+')';
    }
    var CSS=`
/* No blanket activity fade: Lampa's .activity--active decides visibility.
   Do not animate .activity__body: loading/content recycling shares that node. */
body.cm5-on{--cm5-focus:{{focus}}ms;--cm5-press:{{press}}ms;
 --cm5-travel:cubic-bezier(.18,.87,.23,1);--cm5-spring:cubic-bezier(.18,.8,.2,1)}
@supports (transition-timing-function:linear(0,1)){
 body.cm5-on{--cm5-spring:{{spring}}}
}
/* Lampa normally crossfades overlapping 100%-size activity layers for 300ms
   while advanced mode additionally lifts the entire activity body by 14%.
   In non-light mode that moves rich backdrops, reveals the previous screen and
   creates the persistent footer ghost shown around 26–29s in the recording.
   Switch visibility atomically; keep Lampa's own loading state untouched. */
body.cm5-on:not(.no--animation) .activity{transition:none!important}
body.cm5-on:not(.no--animation) .activity__body{animation:none!important}
/* Keep stock advanced--animation from fighting with our card/control motion. */
body.cm5-on:not(.no--animation) .card.focus .card__view,
body.cm5-on:not(.no--animation) .card.hover .card__view,
body.cm5-on:not(.no--animation) .card.animate-trigger-enter .card__view,
body.cm5-on:not(.no--animation) .card-episode.focus .full-episode,
body.cm5-on:not(.no--animation) .card-episode.animate-trigger-enter .full-episode,
body.cm5-on:not(.no--animation) .explorer-card__head-img.focus,
body.cm5-on:not(.no--animation) .card-more.focus .card-more__box,
body.cm5-on:not(.no--animation) .head__action.focus,
body.cm5-on:not(.no--animation) .simple-button.focus,
body.cm5-on:not(.no--animation) .menu__item.focus,
body.cm5-on:not(.no--animation) .settings-folder.focus .settings-folder__icon,
body.cm5-on:not(.no--animation) .full-start__button.focus,
body.cm5-on:not(.no--animation) .modal__button.focus,
body.cm5-on:not(.no--animation) .torrent-item.focus{
 animation:none!important;
}
/* GPU-friendly scale on the existing visual box. Do not reshape image masks,
   inject blur, or create a second moving copy of an entire detail screen. */
body.cm5-on.cm5-focus:not(.no--animation) .card__view,
body.cm5-on.cm5-focus:not(.no--animation) .card-episode .full-episode,
body.cm5-on.cm5-focus:not(.no--animation) .card-more__box,
body.cm5-on.cm5-focus:not(.no--animation) .explorer-card__head-img{
 transition:transform var(--cm5-focus) var(--cm5-spring)!important;
}
body.cm5-on.cm5-focus:not(.no--animation) .card.focus .card__view,
body.cm5-on.cm5-focus:not(.no--animation) .card.hover .card__view,
body.cm5-on.cm5-focus:not(.no--animation) .card-episode.focus .full-episode,
body.cm5-on.cm5-focus:not(.no--animation) .card-more.focus .card-more__box,
body.cm5-on.cm5-focus:not(.no--animation) .explorer-card__head-img.focus{
 transform:scale(1.014) translateZ(0);
}
/* Avoid permanent will-change on hundreds of posters. */
body.cm5-on .card__view{will-change:auto!important}
/* Keep the 300ms Scroll controller contract and its manual no-transition flags. */
body.cm5-on:not(.no--animation) .scroll__body:not(.notransition):not(.transition-reset){
 transition:transform 300ms cubic-bezier(.2,.83,.25,1)!important;
}
/* Menu motion is layout-dependent: normal Lampa shifts content; light mode
   does not. We do not force a transform on either version. */
body.cm5-on.cm5-panels:not(.no--animation) .wrap__left,
body.cm5-on.cm5-panels:not(.no--animation) .wrap__content{
 transition:transform 290ms cubic-bezier(.18,.86,.22,1)!important;
}
/* Sharp, unblurred backdrop. Lampa's blur(1em) amplified visual defects and
   triggers expensive full-screen GPU resampling in the rich interface. */
body.cm5-on.cm5-panels:not(.no--animation) .selectbox__layer,
body.cm5-on.cm5-panels:not(.no--animation) .settings__layer,
body.cm5-on.cm5-panels:not(.no--animation) .modal__layer{
 backdrop-filter:none!important;-webkit-backdrop-filter:none!important;
 background:rgba(0,0,0,.18);
}
/* Modal blur is on .modal ITSELF in Lampa, not on .modal__layer. */
body.cm5-on.cm5-panels:not(.no--animation) .modal{
 backdrop-filter:none!important;-webkit-backdrop-filter:none!important;
}
/* Avoid transforming the text surface of a modal by JS and CSS simultaneously. */
@keyframes cm5-modal-enter{
 0%{transform:translate3d(0,20px,0)}
 74%{transform:translate3d(0,-2.8px,0)}
 100%{transform:translate3d(0,0,0)}
}
@keyframes cm5-modal-exit{
 0%{transform:translate3d(0,0,0)}
 100%{transform:translate3d(0,30px,0)}
}
body.cm5-on.cm5-panels:not(.no--animation) .modal.animate:not(.animate-down) .modal__content{
 animation:cm5-modal-enter {{popup}}ms cubic-bezier(.19,.8,.22,1) both!important;
}
body.cm5-on.cm5-panels:not(.no--animation) .modal.animate-down .modal__content{
 animation:cm5-modal-exit 175ms cubic-bezier(.35,0,.7,1) both!important;
}
/* Never set inline transform on settings/selectbox. Native stylesheet has
   transform:translateY(100%) when closed; .animate persists while open. */
@keyframes cm5-bottom-in{
 /* The container changes curvature while it travels; the text never scales. */
 0%{transform:translate3d(0,100%,0);border-top-left-radius:2.8em;border-top-right-radius:2.8em}
 72%{transform:translate3d(0,-1.1%,0);border-top-left-radius:1.72em;border-top-right-radius:1.72em}
 100%{transform:translate3d(0,0,0);border-top-left-radius:2em;border-top-right-radius:2em}
}
@keyframes cm5-bottom-out{
 0%{transform:translate3d(0,0,0);border-top-left-radius:2em;border-top-right-radius:2em}
 100%{transform:translate3d(0,100%,0);border-top-left-radius:2.8em;border-top-right-radius:2.8em}
}
@media screen and (max-width:480px){
 body.cm5-on.cm5-panels:not(.no--animation) .settings.animate:not(.animate-down) .settings__content,
 body.cm5-on.cm5-panels:not(.no--animation) .selectbox.animate:not(.animate-down) .selectbox__content{
   animation:cm5-bottom-in 315ms cubic-bezier(.22,.85,.2,1) both!important;
   transition:none!important;
 }
 body.cm5-on.cm5-panels:not(.no--animation) .settings.animate-down .settings__content,
 body.cm5-on.cm5-panels:not(.no--animation) .selectbox.animate-down .selectbox__content{
   animation:cm5-bottom-out 175ms cubic-bezier(.35,0,.65,1) both!important;
   transition:none!important;
 }
}
@media screen and (min-width:481px){
 body.cm5-on.cm5-panels:not(.no--animation) .settings__content,
 body.cm5-on.cm5-panels:not(.no--animation) .selectbox__content{
   transition:transform 290ms cubic-bezier(.2,.84,.24,1)!important;
 }
}
/* Focus halo (TV / mouse only). Hidden whenever an overlay is open. */
.cm5-cursor{position:fixed;left:0;top:0;width:0;height:0;box-sizing:border-box;
 border:2px solid rgba(255,255,255,.95);border-radius:12px;z-index:15;
 pointer-events:none;contain:layout style;transform-origin:center center;
 box-shadow:0 0 0 1px rgba(0,0,0,.19)}
.cm5-cursor.cm5-hidden{display:none}
/* This highlight lives behind the tabs' content and is removed on stop. */
body.cm5-on:not(.no--animation) .navigation-tabs.cm5-tabs-ready{position:relative}
body.cm5-on:not(.no--animation) .navigation-tabs.cm5-tabs-ready>.navigation-tabs__button{position:relative;z-index:1}
body.cm5-on:not(.no--animation) .navigation-tabs.cm5-tabs-ready>.navigation-tabs__button.active{background:transparent!important}
.cm5-tab-pill{position:absolute;pointer-events:none;z-index:0;border-radius:.4em;
 background:rgba(255,255,255,.32);transform-origin:center center}
/* Rich Lampa uses its own background/poster image loading. No overrides here. */
@media(prefers-reduced-motion:reduce){
 body.cm5-on .cm5-cursor{display:none!important}
}
`;
    function setupCSS(){
        if(!style){style=document.createElement('style');style.id='capsule-motion-style-v5';(document.head||document.documentElement).appendChild(style);}
        var value=CSS.replace(/\{\{(focus|press|popup|spring)\}\}/g,function(_,key){
            if(key==='spring')return springEasing();if(key==='popup')return p().popup;
            return p()[key];
        });
        if(style.textContent!==value)style.textContent=value;
    }
    function hideCursor(){
        clearAnimation(cursorAnim);cursorAnim=null;cursorTarget=null;
        if(cursor)cursor.classList.add('cm5-hidden');
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
        if(!cursor){cursor=document.createElement('div');cursor.className='cm5-cursor cm5-hidden';cursor.setAttribute('aria-hidden','true');document.body.appendChild(cursor);}
        if(cursorTarget===selected&&!cursor.classList.contains('cm5-hidden'))return;
        var old=cursor.classList.contains('cm5-hidden')?null:visibleRect(cursor);
        clearAnimation(cursorAnim);cursorAnim=null;
        cursor.classList.remove('cm5-hidden');
        cursor.style.left=r.left+'px';cursor.style.top=r.top+'px';
        cursor.style.width=r.width+'px';cursor.style.height=r.height+'px';
        cursor.style.borderRadius=clamp(r.width*.06,9,20)+'px';
        var d=old?Math.hypot(r.left-old.left,r.top-old.top):0;
        if(old&&d<Math.max(innerHeight,innerWidth)*.65){
            var dx=old.left-r.left,dy=old.top-r.top;
            var sx=clamp(old.width/r.width,.4,2.5),sy=clamp(old.height/r.height,.4,2.5);
            var duration=clamp(p().focus+d*.06,p().focus,p().focus+70);
            cursorAnim=animate(cursor,sampled(duration,function(x){
                var k=1-x,st=p().warp*Math.sin(Math.PI*clamp(x,0,1));
                return {transform:'translate3d('+(dx*k).toFixed(2)+'px,'+(dy*k).toFixed(2)+'px,0) scale('+(1+(sx-1)*k+st).toFixed(4)+','+(1+(sy-1)*k-st*.4).toFixed(4)+')'};
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
        if(el.matches('.head__action,.simple-button,.full-start__button,.modal__button,.navigation-bar__item,.navigation-tabs__button,.player-panel .button'))return el;
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
        var rest=isCard&&el.classList.contains('focus')?1.014:1;
        var dur=p().press;
        var a=animate(node,sampled(dur,function(progress,f){
            var impact=Math.sin(Math.PI*clamp(progress,0,1));
            var sx=rest*(1-.029*impact),sy=rest*(1+.017*impact);
            return {transform:'scale('+sx.toFixed(4)+','+sy.toFixed(4)+')'};
        }),dur,function(){if(presses.get(node)===a)presses.delete(node);});
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
        session.animation=animate(img,sampled(duration,function(x){
            var rest=1-x,k=clamp(x,0,1),j=p().warp*Math.sin(Math.PI*k);
            return {transform:'translate3d('+(deltaX*rest).toFixed(2)+'px,'+(deltaY*rest).toFixed(2)+'px,0) scale('+(1+(scaleX-1)*rest+j).toFixed(4)+','+(1+(scaleY-1)*rest-j*.4).toFixed(4)+')'};
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
            var span=document.createElement('div');span.className='cm5-tab-pill';span.setAttribute('aria-hidden','true');
            group.insertBefore(span,group.firstChild);group.classList.add('cm5-tabs-ready');
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
                data.animation=animate(pill,sampled(p().focus,function(x){
                    var k=1-x;return {transform:'translate3d('+(deltaX*k).toFixed(2)+'px,'+(deltaY*k).toFixed(2)+'px,0) scale('+(1+(scaleX-1)*k).toFixed(4)+','+(1+(scaleY-1)*k).toFixed(4)+')'};
                }),p().focus);
            }
        }
    }
    function scheduleTabs(){if(tabRaf)return;tabRaf=later(function(){tabRaf=0;if(isMobile())return;Array.from(document.querySelectorAll('.activity--active .navigation-tabs')).forEach(updatePill);});}
    function clearTabs(){tabPills.forEach(function(data,group){clearAnimation(data.animation);data.node.remove();group.classList.remove('cm5-tabs-ready');});tabPills.clear();}

    function activityChange(event){
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
            tryPosterMorph(node);
        }else recentAction=null;
    }
    function setupObserver(){
        if(typeof MutationObserver==='undefined')return;
        observer=new MutationObserver(function(changes){
            if(!active)return;
            var cursorChange=false,tabChange=false;
            for(var i=0;i<changes.length;i++){
                var m=changes[i],el=m.target;
                if(m.type!=='attributes'||!el||!el.classList)continue;
                if(el===document.body){
                    cursorChange=true;
                    if(noMotion()){stopMorph();clearTabs();hideCursor();}
                    // A change to light--version can invalidate shared-element
                    // mapping and change wrap/menu layout mid-animation.
                    if((m.oldValue||'').indexOf('light--version')!==-1||el.classList.contains('light--version'))stopMorph();
                    continue;
                }
                if(m.attributeName!=='class'||!el.matches)continue;
                if(el.matches('.selector,.activity,.modal,.settings,.selectbox'))cursorChange=true;
                if(el.matches('.navigation-tabs__button,.activity'))tabChange=true;
                if(el.matches('.modal.animate-down,.settings.animate-down,.selectbox.animate-down'))stopMorph();
            }
            if(cursorChange)scheduleCursor();if(tabChange)scheduleTabs();
        });
        observer.observe(document.body,{subtree:true,attributes:true,attributeOldValue:true,attributeFilter:['class']});
    }
    function registerEvents(){
        listen(Lampa.Listener,'activity',function(e){
            if(!e||!active)return;
            if(e.type==='start')activityChange(e);
            if(e.type==='destroy'){stopMorph();clearTabs();scheduleCursor();scheduleTabs();}
        });
        if(typeof jQuery==='function'){
            var $=jQuery;
            $(document).on('hover:focus.capsulemotion5','.selector',function(){scheduleCursor();});
            $(document).on('hover:enter.capsulemotion5','.selector',function(){lastAction(this);press(this);});
            // Touchstart is immediate; click may fire later, but don't send
            // a second press. Lampa binds its own click and navigation.
            $(document).on('pointerdown.capsulemotion5 touchstart.capsulemotion5','.selector',function(e){
                if(e.type==='pointerdown'&&e.originalEvent&&e.originalEvent.pointerType==='touch')return;
                lastAction(this);press(this);
            });
        }
        setupObserver();
        listen(Lampa.Listener,'resize_end',function(){stopMorph();hideCursor();clearTabs();scheduleCursor();scheduleTabs();});
    }
    function apply(){
        if(!initialized||destroyed||!document.body)return;
        profileName=String(get('mode','fluid'));if(!profiles[profileName]&&profileName!=='off')profileName='fluid';
        reduced=!!(media&&media.matches&&flag('respect_reduce'));
        var wants=profileName!=='off'&&!reduced;
        active=wants&&typeof Element!=='undefined'&&typeof Element.prototype.animate==='function';
        ['cm5-on','cm5-focus','cm5-panels'].forEach(function(x){document.body.classList.remove(x);});
        stopMorph();hideCursor();clearTabs();stopAnimations();
        if(!active)return;
        setupCSS();document.body.classList.add('cm5-on');
        if(flag('focus'))document.body.classList.add('cm5-focus');
        if(flag('panels'))document.body.classList.add('cm5-panels');
        scheduleCursor();scheduleTabs();
    }
    function registerSettings(){
        if(!Lampa.SettingsApi||!Lampa.SettingsApi.addComponent)return;
        var icon='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 12c5-12 13 12 18 0"/><circle cx="12" cy="12" r="3"/></svg>';
        Lampa.SettingsApi.addComponent({component:COMPONENT,name:'CAPSULE Motion · Spatial',icon:icon});settingsRegistered=true;
        function add(key,type,def,name,descr,values){
            var param={name:'capsule_motion_'+key,type:type,default:def};if(values)param.values=values;
            Lampa.SettingsApi.addParam({component:COMPONENT,param:param,field:{name:name,description:descr||''},onChange:apply});
        }
        add('mode','select','fluid','Профиль движения','Физичные короткие движения, без дымки и вязкости.',{fluid:'Пластичный',elastic:'Упругий',subtle:'Деликатный',off:'Выключено'});
        add('focus','trigger',true,'Живой фокус','Тактильное нажатие и перемещающаяся рамка на ТВ.');
        add('morph','trigger',true,'Карточка → экран','Только при точном совпадении постеров; на мобильном отключено во избежание разрывов.');
        add('panels','trigger',true,'Пластичные окна','Непрерывный переход без принудительных transform и размытия.');
        add('respect_reduce','trigger',true,'Уважать уменьшение движения','Не анимировать при системном запросе уменьшить движения.');
        // The 4.x option is retained in storage but no longer applies blanket page shifts.
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
        unlisten();stopMorph();hideCursor();clearTabs();stopAnimations();
        if(cursor){cursor.remove();cursor=null;}
        if(style){style.remove();style=null;}
        if(document.body)['cm5-on','cm5-focus','cm5-panels'].forEach(function(x){document.body.classList.remove(x);});
        if(settingsRegistered&&window.Lampa&&Lampa.SettingsApi&&Lampa.SettingsApi.removeComponent)Lampa.SettingsApi.removeComponent(COMPONENT);
        if(window[KEY]===api)delete window[KEY];
    }
    var api={version:VERSION,stop:stop,refresh:apply,diagnostics:function(){return {
        version:VERSION,enabled:active&&!noMotion(),mode:profileName,richMode:!!(document.body&&!document.body.classList.contains('light--version')),
        activeAnimations:animations.size,posterOverlay:!!overlayMorph,focusOverlay:!!(cursor&&!cursor.classList.contains('cm5-hidden')),
        inlineSheetMutations:0
    };}};
    window[KEY]=api;boot();
})();