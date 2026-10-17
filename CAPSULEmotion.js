/*
 * CAPSULE Motion 4.0.0 — Spatial Motion for Lampa
 * Copyright (c) 2026 CAPSULE. GPL-2.0-or-later.
 *
 * A new animation system: spatial focus tracking, true geometry interpolation,
 * spring-driven, interruptible WAAPI, shared poster morph, reversible transitions.
 * No whole-screen opacity veils, faux blur, generic slow-down, or monkey patches
 * to Lampa's controller, scrolling offsets, video or application state.
 *
 * Reference: Lampa CSS & component lifecycle (yumata/lampa-source).
 */
(function () {
    'use strict';

    var VERSION = '4.0.0';
    var KEY = 'capsule_motion_runtime';
    var previous = window[KEY];
    if (previous) {
        if (previous.version === VERSION) return;
        if (typeof previous.stop !== 'function') return;
        try { previous.stop(); } catch (err) { return; }
    }

    var COMPONENT = 'capsule_motion';
    var STYLE_ID = 'capsule-motion-spatial-v4';
    var CLASSES = ['cm4-on','cm4-focus-on','cm4-panels-on','cm4-morph-on','cm4-details-on'];
    var PROFILES = {
        fluid:   { name:'Пластичный', zeta:.76, freq:24, focus:305, press:205, panel:415, scene:435, stretch:.045, lift:.017 },
        elastic: { name:'Упругий',   zeta:.68, freq:23, focus:350, press:235, panel:445, scene:465, stretch:.062, lift:.022 },
        subtle:  { name:'Деликатный',zeta:.88, freq:27, focus:245, press:155, panel:315, scene:350, stretch:.023, lift:.010 }
    };

    var initialized = false;
    var destroyed = false;
    var active = false;
    var reduced = false;
    var mode = 'fluid';
    var style = null;
    var cursor = null;
    var cursorTarget = null;
    var cursorAnimation = null;
    var cursorTick = 0;
    var pills = new Map();
    var pillTick = 0;
    var observer = null;
    var media = null;
    var mediaCallback = null;
    var appReadyHandler = null;
    var subscriptions = [];
    var animations = new Set();
    var timers = new Set();
    var moveTimestamps = new WeakMap();
    var cardAnimations = new WeakMap();
    var lastCard = null;
    var morphSession = null;
    var morphNode = null;
    var morphAnimation = null;
    var lastFullToken = -1;
    var panels = new WeakMap();
    var settingsOpen = false;
    var savedPaneTransforms = new Map();
    var bootAttempts = 0;
    var bootTimer = 0;

    var CSS = `
/* All changes are gated by cm4-on and Lampa's own motion switch. */
body.cm4-on:not(.no--animation) .card__view,
body.cm4-on:not(.no--animation) .card-episode .full-episode,
body.cm4-on:not(.no--animation) .explorer-card__head-img,
body.cm4-on:not(.no--animation) .card-more__box {
    transition:none !important;
}
body.cm4-on:not(.no--animation) .card.focus .card__view,
body.cm4-on:not(.no--animation) .card.hover .card__view,
body.cm4-on:not(.no--animation) .card-episode.focus .full-episode,
body.cm4-on:not(.no--animation) .explorer-card__head-img.focus,
body.cm4-on:not(.no--animation) .card-more.focus .card-more__box {
    transform:scale(1.017) translateZ(0);
}
body.cm4-on:not(.no--animation) .card:not(.card--wide).focus .card__view,
body.cm4-on:not(.no--animation) .card:not(.card--wide).hover .card__view,
body.cm4-on:not(.no--animation) .card-episode.focus .full-episode,
body.cm4-on:not(.no--animation) .explorer-card__head-img.focus,
body.cm4-on:not(.no--animation) .card.animate-trigger-enter .card__view,
body.cm4-on:not(.no--animation) .card-episode.animate-trigger-enter .full-episode,
body.cm4-on:not(.no--animation) .head__action.focus,
body.cm4-on:not(.no--animation) .menu__item.focus,
body.cm4-on:not(.no--animation) .simple-button.focus,
body.cm4-on:not(.no--animation) .full-start__button.focus,
body.cm4-on:not(.no--animation) .settings-folder.focus .settings-folder__icon,
body.cm4-on:not(.no--animation) .player-panel .button.animate-trigger-enter,
body.cm4-on:not(.no--animation) .modal.animate .modal__content,
body.cm4-on:not(.no--animation) .activity:not(.activity--load) .activity__body {
    animation:none !important;
}
body.cm4-on:not(.no--animation) .activity__body {
    animation:none !important;
}
body.cm4-on:not(.no--animation) .activity { transition:none !important; }
body.cm4-on:not(.no--animation) .wrap__left,
body.cm4-on:not(.no--animation) .wrap__content,
body.cm4-on:not(.no--animation) .settings__content,
body.cm4-on:not(.no--animation) .selectbox__content {
    transition:transform .295s cubic-bezier(.19,.9,.21,1) !important;
}
/* 300ms duration is part of Lampa.Scroll's timing contract. */
body.cm4-on:not(.no--animation) .scroll__body:not(.notransition):not(.transition-reset) {
    transition:transform 300ms cubic-bezier(.17,.81,.25,1) !important;
}
body.cm4-on:not(.no--animation) .player-panel {
    transition:transform .26s cubic-bezier(.22,.85,.2,1),opacity .16s linear !important;
}
body.cm4-on:not(.no--animation) .background,
body.cm4-on:not(.no--animation) .background__one,
body.cm4-on:not(.no--animation) .background__two,
body.cm4-on:not(.no--animation) .full-start__background {
    transition-duration:.22s !important;
}
/* Original sheet entrance is disabled only when the spatial system runs. */
@media screen and (max-width:480px) {
    body.cm4-on:not(.no--animation) .selectbox.animate:not(.animate-down) .selectbox__content,
    body.cm4-on:not(.no--animation) .settings.animate:not(.animate-down) .settings__content {
        animation:none!important;
    }
    @keyframes cm4-sheet-out {
        from {transform:translate3d(0,0,0) scale(1)}
        to {transform:translate3d(0,60px,0) scale(.965)}
    }
    body.cm4-on:not(.no--animation) .selectbox.animate-down .selectbox__content,
    body.cm4-on:not(.no--animation) .settings.animate-down .settings__content,
    body.cm4-on:not(.no--animation) .modal.animate-down .modal__content {
        animation:cm4-sheet-out .18s cubic-bezier(.35,0,.8,.45) both!important;
    }
}
/* The selected tab is one continuous piece of material. */
body.cm4-on .navigation-tabs.cm4-pill-ready {position:relative}
body.cm4-on .navigation-tabs.cm4-pill-ready .navigation-tabs__button {z-index:1}
body.cm4-on .navigation-tabs.cm4-pill-ready .navigation-tabs__button.active {background:transparent!important}
.cm4-active-pill {position:absolute;z-index:0;pointer-events:none;border-radius:.35em;
    background:rgba(255,255,255,.34);transform-origin:center center;contain:layout style}
/* A real travelling focus geometry. No full-page tint, no opacity filter. */
.cm4-tracker {
    position:fixed;box-sizing:border-box;pointer-events:none;
    border:3px solid rgba(255,255,255,.98);border-radius:16px;
    z-index:85;left:0;top:0;width:0;height:0;
    box-shadow:0 0 0 1px rgba(0,0,0,.18);
    contain:layout style;transform-origin:center center;
}
.cm4-tracker.cm4-tracker-hidden {display:none}
body.cm4-on.cm4-focus-on:not(.no--animation) .card.focus .card__view::after,
body.cm4-on.cm4-focus-on:not(.no--animation) .card-more.focus .card-more__box::after,
body.cm4-on.cm4-focus-on:not(.no--animation) .card-episode.focus .full-episode::after {display:none!important}
.cm4-hero-morph {position:fixed;pointer-events:none;z-index:70;object-fit:cover;
    margin:0!important;padding:0!important;max-width:none!important;max-height:none!important;
    border:0;box-sizing:border-box;transform-origin:0 0;contain:paint;}
.cm4-running {will-change:transform!important;backface-visibility:hidden}
/* No replacement animation in reduced-motion or Lampa's own no--animation. */
@media (prefers-reduced-motion:reduce) {
    body.cm4-on:not(.no--animation) .scroll__body:not(.notransition) {transition-duration:0ms!important;}
    .cm4-tracker{display:none!important}
}
`;

    function log() { if (console && console.log) console.log.apply(console, ['[CAPSULE Motion 4]'].concat([].slice.call(arguments))); }
    function warn() { if (console && console.warn) console.warn.apply(console, ['[CAPSULE Motion 4]'].concat([].slice.call(arguments))); }
    function storage(name, defaultValue) {
        try { var v=Lampa.Storage.get('capsule_motion_'+name,defaultValue);return v===undefined||v===null?defaultValue:v; }
        catch(e) { return defaultValue; }
    }
    function enabledOption(name) {
        var v=storage(name,true); return v===true||v==='true'||v===1;
    }
    function profile(){return PROFILES[mode]||PROFILES.fluid;}
    function canAnimate() {
        return active && !destroyed && !reduced && !!document.body &&
            !document.body.classList.contains('no--animation') && typeof Element!=='undefined' &&
            typeof Element.prototype.animate==='function';
    }
    function clamp(value,a,b){return Math.max(a,Math.min(b,value));}
    function timestamp(){return window.performance && performance.now?performance.now():Date.now();}
    function after(ms,cb){var id=setTimeout(function(){timers.delete(id);cb();},ms);timers.add(id);return id;}
    function later(cb){return window.requestAnimationFrame?requestAnimationFrame(cb):after(16,cb);}
    function cleanTimer(id){if(id){clearTimeout(id);timers.delete(id);}}
    function clearTimers(){timers.forEach(clearTimeout);timers.clear();}
    function rectOf(el){
        if(!el || !el.isConnected || !el.getBoundingClientRect) return null;
        var r=el.getBoundingClientRect();
        if(!isFinite(r.left)||r.width<2||r.height<2) return null;
        return {left:r.left,top:r.top,width:r.width,height:r.height,right:r.right,bottom:r.bottom};
    }
    function onScreen(r){return r&&r.right>0&&r.bottom>0&&r.left<innerWidth&&r.top<innerHeight;}
    function subscribe(bus,name,handler){
        if(bus&&bus.follow) {bus.follow(name,handler);subscriptions.push({bus:bus,name:name,handler:handler});}
    }
    function stopSubs(){
        subscriptions.forEach(function(s){try{if(s.bus.remove)s.bus.remove(s.name,s.handler);}catch(e){}});
        subscriptions=[];
    }
    function animate(el,keyframes,options,finish){
        if(!canAnimate() || !el || !el.animate) {if(finish)finish();return null;}
        try {
            var anim=el.animate(keyframes,options);
            animations.add(anim);
            el.classList.add('cm4-running');
            var ended=false;
            function end(){
                if(ended)return;
                ended=true;animations.delete(anim);
                if(el.classList)el.classList.remove('cm4-running');
                if(finish)finish();
            }
            anim.onfinish=end;anim.oncancel=end;
            return anim;
        } catch(e){ if(finish)finish();return null; }
    }
    function allCancel(){Array.from(animations).forEach(function(a){try{a.cancel()}catch(e){}});animations.clear();}

    // A true sampled damped spring, not an easing-duration swap. Generated frames
    // run on the browser compositor, JS does not render one frame per RAF.
    function spring(t,zeta,omega){
        var a=zeta*omega;
        if(zeta<1){
            var wd=omega*Math.sqrt(1-zeta*zeta);
            return 1-Math.exp(-a*t)*(Math.cos(wd*t)+(a/wd)*Math.sin(wd*t));
        }
        if(zeta===1)return 1-Math.exp(-omega*t)*(1+omega*t);
        var s=Math.sqrt(zeta*zeta-1), r1=-omega*(zeta-s),r2=-omega*(zeta+s);
        return 1-(r2*Math.exp(r1*t)-r1*Math.exp(r2*t))/(r2-r1);
    }
    function frames(duration,make,kind,rate){
        var p=profile(), out=[],n= Math.max(14, Math.min(34,Math.round(duration/14)));
        var z=kind==='press'?Math.max(.65,p.zeta-.09):p.zeta;
        var o=p.freq*(kind==='press'?1.32:rate||1);
        for(var i=0;i<=n;i++){
            var f=i/n;
            var progress=i===n?1:spring(f*duration/1000,z,o);
            var frame=make(progress,f);
            frame.offset=f;
            out.push(frame);
        }
        return out;
    }
    function elastic(el,kind,make,duration,finish){
        return animate(el,frames(duration,make,kind),{duration:duration,easing:'linear',fill:'none'},finish);
    }

    function visualNode(item){
        if(!item || !item.matches)return null;
        if(item.matches('.card'))return item.querySelector('.card__view');
        if(item.matches('.card-episode'))return item.querySelector('.full-episode');
        if(item.matches('.card-more'))return item.querySelector('.card-more__box');
        if(item.matches('.explorer-card__head-img'))return item;
        if(item.matches('.head__action,.full-start__button,.simple-button,.modal__button,.navigation-tabs__button,.navigation-bar__item,.tag-count,.player-panel .button'))return item;
        if(item.matches('.settings-folder'))return item.querySelector('.settings-folder__icon');
        return null;
    }
    function focusUpdate(item,on){
        if(!canAnimate() || !enabledOption('focus'))return;
        var node=visualNode(item);if(!node)return;
        var old=cardAnimations.get(node);
        if(old){try{old.cancel()}catch(e){}}
        var card=!!(item.matches('.card,.card-episode,.card-more,.explorer-card__head-img'));
        var p=profile();var steady=on?(card?1.017:1):1;
        var oldScale=on?1:card?1.017:1;
        var exaggeration=card?p.stretch*.45:0;
        var dy=on&&card?-p.lift*18:0;
        var duration=card?p.focus:Math.min(220,p.focus);
        var a=elastic(node,'focus',function(x){
            var s=oldScale+(steady-oldScale)*x;
            var squash=(Math.sin(clamp(x,0,1)*Math.PI)*exaggeration);
            return {transform:'translate3d(0,'+(dy*x).toFixed(2)+'px,0) scale('+((s+squash).toFixed(4))+','+((s-squash*.47).toFixed(4))+')'};
        },duration);
        if(a)cardAnimations.set(node,a);
    }
    function press(item){
        if(!canAnimate()||!enabledOption('focus'))return;
        var node=visualNode(item);if(!node)return;
        var card=item.matches('.card,.card-episode,.card-more');
        var p=profile(),s=card?1.017:1;
        var a=cardAnimations.get(node);if(a){try{a.cancel()}catch(e){}}
        a=elastic(node,'press',function(v){
            var wave=Math.sin(Math.PI*clamp(v,0,1));
            var dx=1-.038*wave,dy=1+.023*wave;
            return {transform:'scale('+ (s*dx).toFixed(4)+','+(s*dy).toFixed(4)+')'};
        },p.press);
        if(a)cardAnimations.set(node,a);
    }
    function focusedItem(){
        // Controller actively sets .focus. Avoid scanning every .selector.
        var list=document.querySelectorAll('.selector.focus, .card.focus, .card.hover, .explorer-card__head-img.focus');
        for(var i=list.length-1;i>=0;i--){
            if(onScreen(rectOf(list[i]))&&list[i].offsetParent!==null) return list[i];
        }
        return null;
    }
    function focusTargetRect(target){
        var node=visualNode(target)||target;
        var r=rectOf(node); if(!r)return null;
        if(target.matches('.card,.card-episode,.card-more')){
            r={left:r.left-5,top:r.top-5,width:r.width+10,height:r.height+10,right:r.right+5,bottom:r.bottom+5};
        }
        return r;
    }
    function cursorMode(target){return !!target&&target.matches('.card,.card-episode,.card-more,.explorer-card__head-img,.navigation-tabs__button,.navigation-bar__item');}
    function ensureCursor(){
        if(cursor || !document.body)return;
        cursor=document.createElement('div');cursor.className='cm4-tracker cm4-tracker-hidden';
        cursor.setAttribute('aria-hidden','true');document.body.appendChild(cursor);
    }
    function hideCursor(){
        if(cursorAnimation){try{cursorAnimation.cancel()}catch(e){}}
        cursorAnimation=null;
        if(cursor)cursor.classList.add('cm4-tracker-hidden');
        cursorTarget=null;
    }
    function updateCursor(item){
        if(!canAnimate()||!enabledOption('focus')||!cursorMode(item)||document.body.classList.contains('player--viewing'))return hideCursor();
        var to=focusTargetRect(item);
        if(!onScreen(to))return hideCursor();
        ensureCursor();
        var from=cursor.classList.contains('cm4-tracker-hidden')?null:rectOf(cursor);
        if(cursorAnimation){
            // getBoundingClientRect above captures the CURRENT visual point;
            // each new remote key press can retarget in flight without a snap.
            try{cursorAnimation.cancel()}catch(e){}
            cursorAnimation=null;
        }
        cursor.classList.remove('cm4-tracker-hidden');
        cursor.style.left=to.left+'px';cursor.style.top=to.top+'px';
        cursor.style.width=to.width+'px';cursor.style.height=to.height+'px';
        cursor.style.borderRadius=clamp(to.width*.065,8,22)+'px';
        var distance=from?Math.hypot(from.left-to.left,from.top-to.top):0;
        if(from&&distance>Math.max(innerWidth,innerHeight)*.72)from=null;
        if(from){
            var dx=from.left-to.left,dy=from.top-to.top;
            var sx=clamp(from.width/to.width,.4,2.5),sy=clamp(from.height/to.height,.4,2.5);
            var dur=Math.max(230,Math.min(410,profile().focus+distance*.055));
            cursorAnimation=elastic(cursor,'focus',function(x){
                var a=1-x;
                var warp=profile().stretch*Math.sin(Math.PI*clamp(x,0,1));
                var anisotropy= Math.sign(dx)*warp;
                return {transform:'translate3d('+(dx*a).toFixed(2)+'px,'+(dy*a).toFixed(2)+'px,0) scale('+ (1+(sx-1)*a+anisotropy).toFixed(4)+','+(1+(sy-1)*a-anisotropy*.48).toFixed(4)+')'};
            },dur);
        } else {
            cursorAnimation=elastic(cursor,'focus',function(x){return {transform:'scale('+( .94+.06*x).toFixed(4)+')'};},180);
        }
        cursorTarget=item;
    }
    function queueCursor(item){
        if(cursorTick)return;
        cursorTick=later(function(){cursorTick=0;updateCursor(item&&item.isConnected?item:focusedItem());});
    }


    function paintPill(container){
        if(!canAnimate()||!enabledOption('focus')||!container||!container.isConnected)return;
        var target=container.querySelector('.navigation-tabs__button.active');
        if(!target)return;
        var t=rectOf(target),host=rectOf(container);
        if(!t||!host)return;
        var r={left:t.left-host.left,top:t.top-host.top,width:t.width,height:t.height};
        var info=pills.get(container);
        if(!info){
            var el=document.createElement('div');el.className='cm4-active-pill';
            el.setAttribute('aria-hidden','true');container.insertBefore(el,container.firstChild);
            container.classList.add('cm4-pill-ready');
            info={node:el,animation:null};pills.set(container,info);
        }
        var el=info.node;
        var old=el.style.width?el.getBoundingClientRect():null;
        if(info.animation){try{info.animation.cancel();}catch(e){}}
        el.style.left=r.left+'px';el.style.top=r.top+'px';
        el.style.width=r.width+'px';el.style.height=r.height+'px';
        if(old){
            var dx=old.left-t.left,dy=old.top-t.top;
            if(Math.abs(dx)+Math.abs(dy)<.8)return;
            var sx=clamp(old.width/r.width,.25,4),sy=clamp(old.height/r.height,.25,4);
            info.animation=elastic(el,'focus',function(x){
                var f=1-x,warp=profile().stretch*.8*Math.sin(Math.PI*clamp(x,0,1));
                return {transform:'translate3d('+(dx*f).toFixed(2)+'px,'+(dy*f).toFixed(2)+'px,0) scale('+(1+(sx-1)*f+warp).toFixed(4)+','+(1+(sy-1)*f-warp*.3).toFixed(4)+')'};
            },profile().focus+50);
        }
    }
    function queuePill(container){
        if(pillTick)return;
        pillTick=later(function(){
            pillTick=0;
            if(container)paintPill(container);
            else Array.from(document.querySelectorAll('.activity--active .navigation-tabs')).forEach(paintPill);
        });
    }
    function clearPills(){
        pills.forEach(function(info,parent){
            if(info.animation){try{info.animation.cancel();}catch(e){}}
            if(info.node)info.node.remove();
            if(parent&&parent.classList)parent.classList.remove('cm4-pill-ready');
        });
        pills.clear();
    }

    function recordCard(element){
        if(!enabledOption('morph')||!element)return;
        var card=element.closest&&element.closest('.card,.card-episode,.card--wide');
        if(!card || !card.isConnected)return;
        var image=card.querySelector('.card__img, .card__view img, .full-episode__img img, img');
        var rect=rectOf(image || card.querySelector('.card__view'));
        if(!rect||!onScreen(rect))return;
        var url=image&&(image.currentSrc||image.src);
        if(!url||!/^https?:|^data:|^blob:/.test(url))return;
        lastCard={node:card,image:image,url:url,rect:rect,time:Date.now()};
    }
    function posterForFull(root){
        if(!root||!root.querySelector)return null;
        return root.querySelector('.full-start-new__poster img, .full-start__poster img, .full-start-new__img, .full-start__img');
    }
    function findActivityRoot(object){
        var e=object&&object.activity&&object.activity.render;
        if(e){try{var node=object.activity.render(true);if(node&&node.jquery)node=node[0];return node||null;}catch(e){}}
        return document.querySelector('.activity--active');
    }
    function cancelMorph(){
        if(morphAnimation){try{morphAnimation.cancel()}catch(e){}}
        morphAnimation=null;
        if(morphNode){morphNode.remove();morphNode=null;}
        if(morphSession&&morphSession.hidden){
            morphSession.hidden.forEach(function(x){if(x.node&&x.node.style)x.node.style.visibility=x.value;});
            morphSession.hidden=[];
        }
    }
    function transitionPoster(srcRect,dest,srcUrl,forward,sourceCard){
        if(!canAnimate()||!enabledOption('morph'))return false;
        var destRect=rectOf(dest);
        if(!srcRect||!onScreen(srcRect)||!destRect||!onScreen(destRect)||!srcUrl)return false;
        if(!/^https?:|^data:|^blob:/.test(srcUrl))return false;
        cancelMorph();
        var clone=document.createElement('img');
        clone.className='cm4-hero-morph';clone.src=srcUrl;clone.alt='';clone.setAttribute('aria-hidden','true');
        clone.style.left=destRect.left+'px';clone.style.top=destRect.top+'px';
        clone.style.width=destRect.width+'px';clone.style.height=destRect.height+'px';
        var targetCss=window.getComputedStyle(dest);
        var endRadius=targetCss.borderRadius||'12px';
        clone.style.borderRadius=endRadius;
        document.body.appendChild(clone);
        morphNode=clone;
        var saved=dest.style.visibility;
        dest.style.visibility='hidden';
        morphSession={source:sourceCard||null,url:srcUrl,poster:dest,hidden:[{node:dest,value:saved}]};
        var dx=srcRect.left-destRect.left,dy=srcRect.top-destRect.top;
        var sx=clamp(srcRect.width/destRect.width,.04,10),sy=clamp(srcRect.height/destRect.height,.04,10);
        var distance=Math.hypot(dx,dy);
        var dur=clamp(profile().scene+distance*.07,300,560);
        var a=elastic(clone,'scene',function(v){
            var rest=1-v,stretch=profile().stretch*Math.sin(Math.PI*clamp(v,0,1));
            var ox=Math.sign(dx)*stretch,oy= -Math.sign(dx)*stretch*.55;
            return {transform:'translate3d('+(dx*rest).toFixed(2)+'px,'+(dy*rest).toFixed(2)+'px,0) scale('+(1+(sx-1)*rest+ox).toFixed(4)+','+(1+(sy-1)*rest+oy).toFixed(4)+')',borderRadius:(16*rest+parseFloat(endRadius||12)*v).toFixed(1)+'px'};
        },dur,function(){
            if(morphNode===clone){clone.remove();morphNode=null;}
            dest.style.visibility=saved;
            if(morphSession)morphSession.hidden=[];
            if(!forward)morphSession=null;
        });
        if(!a){clone.remove();morphNode=null;dest.style.visibility=saved;return false;}
        morphAnimation=a;
        return true;
    }
    function fullReady(object){
        if(!enabledOption('morph')||!lastCard||Date.now()-lastCard.time>3500||lastFullToken===lastCard.time)return;
        var source=lastCard;
        var root=findActivityRoot(object);
        var tries=0;
        function attempt(){
            if(!canAnimate()||lastFullToken===source.time||tries++>17||Date.now()-source.time>3500)return;
            if(!root||!root.isConnected){root=findActivityRoot(object);}
            var target=posterForFull(root);
            if(target&&transitionPoster(source.rect,target,source.url,true,source.node)) {
                lastFullToken=source.time;
                if(morphSession){morphSession.source=source.node; morphSession.url=source.url;morphSession.poster=target;}
                return;
            }
            after(70,attempt);
        }
        attempt();
    }
    function backMorph(){
        var old=morphSession;
        if(!old||!old.source||!old.poster||!old.source.isConnected||!old.poster.isConnected)return;
        var source=old.source.querySelector('.card__img,.card__view img,.full-episode__img img,img');
        if(!source)return;
        var from=rectOf(old.poster),to=rectOf(source);
        if(!from||!to||!onScreen(from)||!onScreen(to))return;
        // Back transition is a self-contained visual clone: the old activity
        // can be removed by Lampa after 200ms while the geometry still settles.
        transitionPoster(from,source,old.url,false,old.source);
    }

    function animatePane(type,raw){
        if(!canAnimate()||!enabledOption('panels'))return;
        var pane=raw&&raw.jquery?raw[0]:raw;
        if(!pane||!pane.isConnected)return;
        if(type==='settings'||type==='select') {
            pane=pane.querySelector(type==='settings'?'.settings__content':'.selectbox__content')||pane;
        } else if(type==='modal') {
            pane=pane.querySelector('.modal__content')||pane;
        }
        if(!pane||!pane.isConnected)return;
        var old=panels.get(pane); if(old){try{old.cancel()}catch(e){}}
        var mobile=innerWidth<=480;
        var p=profile(),dur=type==='modal'?p.panel:p.panel-35;
        // Mobile Lampa sheets have a *permanent* translateY(100%) base rule.
        // Inline zero only during opening, restore exact original on close.
        if((type==='settings'||type==='select')&&mobile) {
            if(!savedPaneTransforms.has(pane))savedPaneTransforms.set(pane,pane.style.transform);
            pane.style.transform='translate3d(0,0,0)';
        }
        var target=mobile||type==='modal'?pane:(pane.querySelector('.settings__body,.selectbox__body')||pane);
        var options={duration:dur,easing:'linear',fill:'none'};
        var frameset=frames(dur,function(x){
            var back=1-x;
            if(mobile){
                return {transform:'translate3d(0,'+(Math.max(0,32*back)).toFixed(2)+'px,0) scale('+(1-.08*back).toFixed(4)+','+(1-.055*back).toFixed(4)+')',borderRadius:(22+12*Math.min(1,Math.abs(back))).toFixed(1)+'px'};
            }
            return {transform:'translate3d('+(19*back).toFixed(2)+'px,'+(8*back).toFixed(2)+'px,0) scale('+(1-.036*back).toFixed(4)+')'};
        },'panel');
        // Native .animate class still controls layout, not the movement.
        var a=animate(target,frameset,options);
        if(a)panels.set(pane,a);
    }
    function restorePane(type){
        savedPaneTransforms.forEach(function(value,pane){
            if(!pane||!pane.style)return;
            var sel=type==='settings'?'.settings__content':'.selectbox__content';
            if(pane.matches&&pane.matches(sel)){
                var a=panels.get(pane);if(a){try{a.cancel()}catch(e){}}
                pane.style.transform=value;savedPaneTransforms.delete(pane);
            }
        });
    }
    function pageMotion(event){
        if(!canAnimate()||!enabledOption('details'))return;
        var root=findActivityRoot(event.object),pane=root&&root.querySelector('.activity__body');
        if(!pane || !pane.isConnected)return;
        var dur=Math.min(profile().scene,380);
        // Opening should remain immediate. No alpha 0→1 and no text veil.
        var a=animate(pane,frames(dur,function(v){
            var f=1-v;return {transform:'translate3d(0,'+(12*f).toFixed(2)+'px,0) scale('+(1-.019*f).toFixed(4)+')'};
        },'scene'),{duration:dur,easing:'linear',fill:'none'});
    }
    function listenEvents(){
        if(!window.Lampa)return;
        subscribe(Lampa.Listener,'activity',function(e){
            if(!e||!active)return;
            if(e.type==='start'){
                queueCursor(null);
                queuePill(null);
                if(e.component==='full')fullReady(e.object);
                else pageMotion(e);
            }
            if(e.type==='destroy'&&morphSession&&morphSession.poster&&!morphSession.poster.isConnected)cancelMorph();
        });
        if(Lampa.Activity && Lampa.Activity.listener){
            subscribe(Lampa.Activity.listener,'backward',function(){if(active)backMorph();});
        }
        if(Lampa.Listener){
            subscribe(Lampa.Listener,'full',function(e){if(active&&e&&e.type==='complite')fullReady(e.object);});
        }
        if(Lampa.Modal&&Lampa.Modal.listener){
            subscribe(Lampa.Modal.listener,'fullshow',function(e){later(function(){animatePane('modal',e&&e.html);});});
        }
        if(Lampa.Select&&Lampa.Select.listener){
            subscribe(Lampa.Select.listener,'fullshow',function(e){later(function(){if(document.body.classList.contains('selectbox--open'))animatePane('select',e&&e.html);});});
            subscribe(Lampa.Select.listener,'hide',function(){restorePane('select');});
            subscribe(Lampa.Select.listener,'close',function(){restorePane('select');});
        }
        if(Lampa.Settings&&Lampa.Settings.listener){
            subscribe(Lampa.Settings.listener,'open',function(){later(function(){animatePane('settings',document.querySelector('.settings'));});});
            subscribe(Lampa.Settings.listener,'close',function(){restorePane('settings');});
        }
        if(typeof window.jQuery==='function'){
            var $=window.jQuery;
            $(document).on('hover:focus.capsulemotion4', '.selector', function(){
                var el=this;recordCard(el);focusUpdate(el,true);queueCursor(el);
            });
            $(document).on('hover:enter.capsulemotion4', '.selector',function(){
                recordCard(this);press(this);
            });
            $(document).on('pointerdown.capsulemotion4 touchstart.capsulemotion4', '.selector',function(){
                recordCard(this);
                // Press response respects real touch velocity, no content scaling overlays.
                if(canAnimate())press(this);
            });
        }
        // Backup for Lampa instances where jQuery custom focus events do not bubble.
        if(typeof MutationObserver!=='undefined'){
            observer=new MutationObserver(function(records){
                if(!active)return;
                var candidate=null;
                for(var i=0;i<records.length;i++){
                    var x=records[i],el=x.target;
                    if(x.attributeName!=='class'||!el.classList||!el.matches)continue;
                    if(el===document.body){
                        if(!el.classList.contains('settings--open'))restorePane('settings');
                        if(!el.classList.contains('selectbox--open'))restorePane('select');
                        continue;
                    }
                    if(el.matches('.modal.animate-down,.settings.animate-down,.selectbox.animate-down')){
                        var pane=el.querySelector('.modal__content,.settings__content,.selectbox__content');
                        var anim=pane&&panels.get(pane);if(anim){try{anim.cancel();}catch(e){}}
                    }
                    if(el.matches('.navigation-tabs__button')&&el.classList.contains('active'))queuePill(el.closest('.navigation-tabs'));
                    if(!enabledOption('focus')||!el.matches('.selector'))continue;
                    var wasFocused=/(?:^|\s)focus(?:\s|$)/.test(x.oldValue||'');
                    var isFocused=el.classList.contains('focus');
                    if(wasFocused&&!isFocused)focusUpdate(el,false);
                    if(!wasFocused&&isFocused)candidate=el;
                }
                if(candidate && candidate!==cursorTarget){recordCard(candidate);focusUpdate(candidate,true);queueCursor(candidate);}
            });
            observer.observe(document.body,{subtree:true,attributes:true,attributeOldValue:true,attributeFilter:['class']});
        }
    }
    function unlisten(){
        stopSubs();
        if(observer){observer.disconnect();observer=null;}
        if(typeof jQuery==='function')jQuery(document).off('.capsulemotion4');
    }

    function installCSS(){
        if(style&&style.parentNode)return;
        style=document.createElement('style');style.id=STYLE_ID;style.textContent=CSS;
        (document.head||document.documentElement).appendChild(style);
    }
    function refresh(){
        if(!initialized||destroyed||!document.body)return;
        mode=String(storage('mode','fluid'));
        if(!PROFILES[mode] && mode!=='off')mode='fluid';
        reduced=!!(media&&media.matches&&enabledOption('respect_reduce'));
        active=mode!=='off'&&!reduced && typeof Element!=='undefined' && typeof Element.prototype.animate==='function';
        CLASSES.forEach(function(c){document.body.classList.remove(c);});
        if(!active){allCancel();hideCursor();cancelMorph();clearPills();restorePane('select');restorePane('settings');return;}
        document.body.classList.add('cm4-on');
        if(enabledOption('focus'))document.body.classList.add('cm4-focus-on');
        if(enabledOption('panels'))document.body.classList.add('cm4-panels-on');
        if(enabledOption('morph'))document.body.classList.add('cm4-morph-on');
        if(enabledOption('details'))document.body.classList.add('cm4-details-on');
        queueCursor(null);
        queuePill(null);
    }
    function initSettings(){
        if(!Lampa.SettingsApi||!Lampa.SettingsApi.addComponent)return;
        var icon='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 12c5-12 13 12 18 0"/><circle cx="12" cy="12" r="3"/></svg>';
        Lampa.SettingsApi.addComponent({component:COMPONENT,name:'CAPSULE Motion · Spatial',icon:icon});
        function param(name,type,def,label,descr,values){
            var p={name:'capsule_motion_'+name,type:type,default:def};if(values)p.values=values;
            Lampa.SettingsApi.addParam({component:COMPONENT,param:p,field:{name:label,description:descr||''},onChange:refresh});
        }
        param('mode','select','fluid','Физика движения','Пространственные анимации без дымки и долгих остановок.',{
            fluid:'Пластичный',elastic:'Упругий',subtle:'Деликатный',off:'Выключено'
        });
        param('focus','trigger',true,'Живой фокус','Мягкий переход фокусной рамки и деформация выбранной карточки.');
        param('morph','trigger',true,'Карточка → экран','Перетекание обложки в постер там, где доступен исходный и конечный элемент.');
        param('panels','trigger',true,'Пластичные окна','Раскрытие модальных окон, селекторов и настроек.');
        param('details','trigger',true,'Переходы страниц','Пространственное появление страниц без полупрозрачной дымки.');
        param('respect_reduce','trigger',true,'Уважать уменьшение движения','Автоматическое отключение сложных эффектов при системном ограничении.');
    }
    function init(){
        if(initialized||destroyed)return;
        if(!window.Lampa||!Lampa.Listener||!Lampa.Storage||!document.body)return;
        initialized=true;
        installCSS();
        media=window.matchMedia?matchMedia('(prefers-reduced-motion: reduce)'):null;
        if(media){mediaCallback=refresh;try{
            if(media.addEventListener)media.addEventListener('change',mediaCallback);
            else if(media.addListener)media.addListener(mediaCallback);
        }catch(e){}}
        initSettings();listenEvents();refresh();
        log('ready; spatial geometry, sampled spring, reversible shared poster');
    }
    function boot(){
        if(destroyed||initialized)return;
        if(window.appready && window.Lampa&&document.body)return init();
        if(window.Lampa && Lampa.Listener && !appReadyHandler){
            appReadyHandler=function(e){if(e&&e.type==='ready'){if(Lampa.Listener.remove)Lampa.Listener.remove('app',appReadyHandler);appReadyHandler=null;init();}};
            Lampa.Listener.follow('app',appReadyHandler);
        }
        if(bootAttempts++<80)bootTimer=after(250,boot);
    }
    function stop(){
        if(destroyed)return;
        destroyed=true;active=false;
        cleanTimer(bootTimer);clearTimers();
        if(appReadyHandler&&window.Lampa&&Lampa.Listener&&Lampa.Listener.remove)Lampa.Listener.remove('app',appReadyHandler);
        if(media&&mediaCallback){try{
            if(media.removeEventListener)media.removeEventListener('change',mediaCallback);
            else if(media.removeListener)media.removeListener(mediaCallback);
        }catch(e){}}
        unlisten();allCancel();cancelMorph();hideCursor();clearPills();
        if(cursor){cursor.remove();cursor=null;}
        restorePane('settings');restorePane('select');
        if(style){style.remove();style=null;}
        if(document.body)CLASSES.forEach(function(c){document.body.classList.remove(c);});
        if(window.Lampa&&Lampa.SettingsApi&&Lampa.SettingsApi.removeComponent)Lampa.SettingsApi.removeComponent(COMPONENT);
        if(window[KEY]===api)delete window[KEY];
    }
    var api={version:VERSION,stop:stop,refresh:refresh,
        diagnostics:function(){return {version:VERSION,initialized:initialized,enabled:active,mode:mode,animations:animations.size,observer:!!observer,hasTracker:!!cursor,hasMorph:!!morphNode};}
    };
    window[KEY]=api;
    boot();
})();