/* Capsule Online 0.23.0 — unified Skaz films and curated series, energy-conscious UI.
 * Source credit: Skaz online/Lampac; community mirror used for reference:
 * https://github.com/voipoddsns/voipoddsns.github.io/blob/main/plugins/lampa_plugins/o.js
 * Third-party upstream licensing has not been established.
 */
/* CAPSULE EMBEDDED ONLINE CORE START */
(function() {
if(window.capsule_amedia_core_plugin){
  // Lampa cannot hot-swap an already registered video component. Without
  // this warning a cached old plugin silently continues to run.
  try{
    if(window.__capsuleOnlineVersion!=='0.23.0' &&
       Lampa.Noty&&typeof Lampa.Noty.show==='function')
      Lampa.Noty.show('Capsule Online: для обновления полностью перезапустите Lampa');
  }catch(ignore){}
  return;
}
window.__capsuleOnlineVersion='0.23.0';
var cf = Lampa.Storage.get('skazonline_servers');
if (cf==true) {
	var vybor = [
'http://onlinecf3.skaz.tv/',
'http://onlinecf4.skaz.tv/',
'http://onlinecf5.skaz.tv/',
'http://onlinecf7.skaz.tv/'
]; var dd = "cf";}
else {
var vybor = [
'http://online3.skaz.tv/',
'http://online4.skaz.tv/',
'http://online5.skaz.tv/',
'http://online7.skaz.tv/'
];
var dd = '';
}
var randomIndex = Math.floor(Math.random() * vybor.length);
var randomUrl = vybor[randomIndex];

  var Defined = {
    api: 'lampac',
    localhost: randomUrl,
    apn: ''
  };

  
  var unic_id = Lampa.Storage.get('lampac_unic_id', '');
  if (!unic_id) {
    unic_id = Lampa.Utils.uid(8).toLowerCase();
    Lampa.Storage.set('lampac_unic_id', unic_id);
  }
  
    function getAndroidVersion() {
  if (Lampa.Platform.is('android')) {
    try {
      var current = AndroidJS.appVersion().split('-');
      return parseInt(current.pop());
    } catch (e) {
      return 0;
    }
  } else {
    return 0;
  }
}

var hostkey = 'http://online'+dd+'3.skaz.tv'.replace('http://', '').replace('https://', '');

if (!window.rch_nws || !window.rch_nws[hostkey]) {
  if (!window.rch_nws) window.rch_nws = {};

  window.rch_nws[hostkey] = {
    type: Lampa.Platform.is('android') ? 'apk' : Lampa.Platform.is('tizen') ? 'cors' : undefined,
    startTypeInvoke: false,
    rchRegistry: false,
    apkVersion: getAndroidVersion()
  };
}

window.rch_nws[hostkey].typeInvoke = function rchtypeInvoke(host, call) {
  if (!window.rch_nws[hostkey].startTypeInvoke) {
    window.rch_nws[hostkey].startTypeInvoke = true;

    var check = function check(good) {
      window.rch_nws[hostkey].type = Lampa.Platform.is('android') ? 'apk' : good ? 'cors' : 'web';
      call();
    };

    if (Lampa.Platform.is('android') || Lampa.Platform.is('tizen')) check(true);
    else {
      var net = new Lampa.Reguest();
      net.silent('http://online'+dd+'3.skaz.tv'.indexOf(location.host) >= 0 ? 'https://github.com/' : host + '/cors/check', function() {
        check(true);
      }, function() {
        check(false);
      }, false, {
        dataType: 'text'
      });
    }
  } else call();
};

window.rch_nws[hostkey].Registry = function RchRegistry(client, startConnection) {
  window.rch_nws[hostkey].typeInvoke('http://online'+dd+'3.skaz.tv', function() {

    client.invoke("RchRegistry", {
      version: 154,
      host: location.host,
      rchtype: Lampa.Platform.is('android') ? 'apk' : Lampa.Platform.is('tizen') ? 'cors' : (window.rch_nws[hostkey].type || 'web'),
      apkVersion: window.rch_nws[hostkey].apkVersion,
      player: Lampa.Storage.field('player'),
	  account_email: Lampa.Storage.get('account_email', ''),
	  unic_id: Lampa.Storage.get('lampac_unic_id', ''),
	  profile_id: Lampa.Storage.get('lampac_profile_id', ''),
	  token: ''
    });

    if (client._shouldReconnect && window.rch_nws[hostkey].rchRegistry) {
      if (startConnection) startConnection();
      return;
    }

    window.rch_nws[hostkey].rchRegistry = true;

    client.on('RchRegistry', function(clientIp) {
      if (startConnection) startConnection();
    });

    client.on("RchClient", function(rchId, url, data, headers, returnHeaders) {
      var network = new Lampa.Reguest();
	  
	  function sendResult(uri, html) {
	    $.ajax({
	      url: 'http://online'+dd+'3.skaz.tv/rch/' + uri + '?id=' + rchId,
	      type: 'POST',
	      data: html,
	      async: true,
	      cache: false,
	      contentType: false,
	      processData: false,
	      success: function(j) {},
	      error: function() {
	        client.invoke("RchResult", rchId, '');
	      }
	    });
	  }

      function result(html) {
        if (Lampa.Arrays.isObject(html) || Lampa.Arrays.isArray(html)) {
          html = JSON.stringify(html);
        }

        if (typeof CompressionStream !== 'undefined' && html && html.length > 1000) {
          var compressionStream = new CompressionStream('gzip');
          var encoder = new TextEncoder();
          var readable = new ReadableStream({
            start: function(controller) {
              controller.enqueue(encoder.encode(html));
              controller.close();
            }
          });
          var compressedStream = readable.pipeThrough(compressionStream);
          new Response(compressedStream).arrayBuffer()
            .then(function(compressedBuffer) {
              var compressedArray = new Uint8Array(compressedBuffer);
              if (compressedArray.length > html.length) {
                sendResult('result', html);
              } else {
                sendResult('gzresult', compressedArray);
              }
            })
            .catch(function() {
              sendResult('result', html);
            });

        } else {
          sendResult('result', html);
        }
      }

      if (url == 'eval') {

        result(eval(data));
      } else if (url == 'evalrun') {

        eval(data);
      } else if (url == 'ping') {
        result('pong');
      } else {

        network["native"](url, result, function(e) {

          result('');
        }, data, {
          dataType: 'text',
          timeout: 1000 * 8,
          headers: headers,
          returnHeaders: returnHeaders
        });
      }
    });

    client.on('Connected', function(connectionId) {

      window.rch_nws[hostkey].connectionId = connectionId;
    });
    client.on('Closed', function() {

    });
    client.on('Error', function(err) {

    });
  });
};
  // Do not probe the Skaz server on every Lampa startup. Registry() already
  // invokes typeInvoke when an actual serial request needs the RCH bridge.
  // This keeps film-only sessions completely free from online-balancer probes.

  function rchInvoke(json, call) {
    if (window.nwsClient && window.nwsClient[hostkey] && window.nwsClient[hostkey]._shouldReconnect){
      call();
      return;
    }
    if (!window.nwsClient) window.nwsClient = {};
    if (window.nwsClient[hostkey] && window.nwsClient[hostkey].socket)
      window.nwsClient[hostkey].socket.close();
    window.nwsClient[hostkey] = new NativeWsClient(json.nws, {
      autoReconnect: false
    });
    window.nwsClient[hostkey].on('Connected', function(connectionId) {
      window.rch_nws[hostkey].Registry(window.nwsClient[hostkey], function() {
        call();
      });
    });
    window.nwsClient[hostkey].connect();
  }

  function rchRun(json, call) {
    if (typeof NativeWsClient == 'undefined') {
      Lampa.Utils.putScript(["http://online"+dd+"3.skaz.tv/js/nws-client-es5.js?v18112025"], function() {}, false, function() {
        rchInvoke(json, call);
      }, true);
    } else {
      rchInvoke(json, call);
    }
  }

  function account(url) {
    url = url + '';
    if (url.indexOf('account_email=') == -1) {
      var email = Lampa.Storage.get('account_email');
      if (email) url = Lampa.Utils.addUrlComponent(url, 'account_email=' + encodeURIComponent(email));
    }
    if (url.indexOf('uid=') == -1) {
      var uid = Lampa.Storage.get('lampac_unic_id', '');
      if (uid) url = Lampa.Utils.addUrlComponent(url, 'uid=' + encodeURIComponent(uid));
    }
    if (url.indexOf('token=') == -1) {
      var token = '';
      if (token != '') url = Lampa.Utils.addUrlComponent(url, 'token=');
    }
    if (url.indexOf('nws_id=') == -1 && window.rch_nws && window.rch_nws[hostkey]) {
      var nws_id = window.rch_nws[hostkey].connectionId || Lampa.Storage.get('lampac_nws_id', '');
      if (nws_id) url = Lampa.Utils.addUrlComponent(url, 'nws_id=' + encodeURIComponent(nws_id));
    }
    return url;
  }
  
  var Network = Lampa.Reguest;

  // Read both legacy JSON-string and current object preferences for every
  // entry point: series component and full-card button share this helper.
  function readClarificationStore(){
      var stored=Lampa.Storage.get('clarification_search',{});
      if(typeof stored==='string'){
        try{stored=JSON.parse(stored);}catch(e){stored={};}
      }
      return stored&&typeof stored==='object'&&!Array.isArray(stored)?stored:{};
    }
    
  // Shared by the full-card launch button and the online screen.
    function isEpisodeMedia(movie){
      if(!movie)return false;
      // Explicit Lampa media type wins over mixed or recycled metadata.
      if(movie.media_type==='movie'||movie.type==='movie')return false;
      if(movie.media_type==='tv'||movie.type==='tv')return true;
      if(Number(movie.number_of_seasons)>0)return true;
      return !!(movie.name&&!movie.title&&!movie.release_date);
    }

    function balanserName(row) {
      var id=String(row&&row.balanser||'').toLowerCase().trim();
      var name=String(row&&row.name||'').toLowerCase().trim();
      if(/^(?:мир\s*кино|mir\s*kino|mirkino)\s*[-.]?\s*z\b/.test(name)||
          /^(?:mirkino|mirkinoz|mir-kino(?:-z)?|mir_kino(?:_z)?|mirkino-z)$/.test(id))
        return 'mirkinoz';
      if(id)return id;
      if(/^hd\s*[-.]?\s*rezka\b/.test(name))return 'hdrezka';
      if(/^(?:мир\s*кино|mir\s*kino|mirkino)\s*[-.]?\s*z\b/i.test(name))
        return 'mirkinoz';
      if(/^(?:кпу|kpu|кинопаб)$/i.test(name)||id==='kpu')return 'kinopub';
      if(/^skaz\s+tv\b/.test(name))return 'skaztv';
      return name.split(/[\s.:/-]+/)[0];
    }
    window.__capsuleSerialKey=balanserName;

    function automaticSelectionEnabled(){
      var value=Lampa.Storage.get('capsule_skaz_online_auto',true);
      return value!==false&&value!=='false'&&value!==0&&value!=='0';
    }
    function forbiddenVoice(value){
      var label=String(value||'').toLowerCase().replace(/ё/g,'е');
      return /dragon\s*[-_.]?\s*money(?:\s*studio)?|драгон\s*мани|драгонмани|(?:1x(?:bet|slots)|1win|joycasino|melbet|mostbet|vavada|pin[ -]?up|betboom|parimatch|leonbet|stake\s*casino|казино\s*онлайн)|(?:рекламн(?:ая|ый|ое)|промокод|промо\s*код|sponsored\s*(?:voice|dub|studio)|букмекерск(?:ая|ий))/i.test(label);
    }
    window.__capsuleNoAdVoice=forbiddenVoice;
    window.__capsuleLang={
      current:playbackLanguage,detect:sourceLanguage,
      accepted:languageAccepted
    };
    // Source order is a deterministic tie-break, NEVER a substitute for
    // the language, actual stream resolution, or requested voice.
    // 'КПУ' is the KinoPub source family (Skaz may call it "kpu").
    function filmSourceFamily(row){
      var id=balanserName(row),name=String(row&&row.name||'').toLowerCase();
      if(isMirKinoZ(row)||
          /^(?:mirkino|mirkinotv|mir[-_]?kino(?:[-_]?(?:z|4k|tv))?)$/i.test(id)||
          /^(?:мир\s*кино|mir\s*kino|mirkino)(?:\s*[-.]?\s*(?:z|4k))?(?:\s|$)/i.test(name))
        return 'mirkinoz';
      if(/^(?:hdrezka|hdrezkatv|hd-rezka|hdrezka-tv|rezkaprem|rezkapremium|rhsprem-rezka)$/.test(id)||/^hd\s*[-.]?\s*rezka/.test(name))
        return 'hdrezka';
      if(/^(?:rezka|rezkatv)$/.test(id))return 'rezka';
      if(/^(?:alloha|allohatv)$/.test(id))return 'alloha';
      if(/^(?:rc\/)?(?:filmix|filmixtv|fxapi)$/.test(id))return 'filmix';
      if(/^(?:kinopub|kinopubtv|kpu|kpu-tv|kpu_tv|kp|kinopubpro)$/.test(id))return 'kinopub';
      if(/^(?:collaps|collaps-dash|collapsdash)$/.test(id))return 'collaps';
      if(/^(?:kodik|kodiktv)$/.test(id))return 'kodik';
      if(/^(?:redheadsound|redheadsoundtv|rhsprem|rc\/rhs|rhs|rhs-premium|rhspro)$/.test(id))return 'redheadsound';
      if(/^(?:vibix|vibixtv)$/.test(id))return 'vibix';
      return /^skaz/.test(id)?'skaztv':id;
    }
    function filmSearchMode(){
      return String(Lampa.Storage.get('capsule_skaz_online_search_mode','normal'))==='economy'?
        'economy':'normal';
    }
    function filmKidsMode(){
      var enabled=Lampa.Storage.get('capsule_skaz_online_kids',false);
      return enabled===true||enabled==='true'||enabled===1||enabled==='1';
    }
    function filmKidsVoiceBlocked(value){
      if(!filmKidsMode())return false;
      var label=String(value||'').toLowerCase().replace(/ё/g,'е');
      // Use explicit labels, never assume every cartoon dub is safe.
      return /кубик\s*(?:в\s*)?кубе|kubik\s*v\s*kube|rezka\s*18\s*\+|(?:hd\s*)?резка\s*18\s*\+|(?:18\s*\+|21\s*\+|18\s*плюс|adult|uncensored|без\s*цензуры|ненормативн|нецензурн|с\s*матом|матерн|эротик|xxx|r-rated|nc-17|пародийн\w*\s*перевод)/i.test(label);
    }
    function filmSettingAllowed(key){
      var value=Lampa.Storage.get('capsule_skaz_online_'+key,true);
      if(value===false||value===0)return false;
      return !/^(?:false|0|off|no|disabled|disable|выключено|отключено|запрещено)$/i.test(
        String(value===null||value===undefined?'true':value).trim());
    }
    function filmVoiceCategory(label){
      var text=String(label||'').toLowerCase().replace(/ё/g,'е').trim();
      if(!text)return '';
      // Quality, season and episode folders do not describe a translation.
      if(/^(?:сезон|season|серия|episode|episodes?|качество|quality|серии)(?:\s|[:№#.-]|$)/i.test(text)||
          /^\d{1,3}\s*(?:серия|season|episode|эпизод|сезон)/i.test(text)||
          /^(?:[\d\s.,+/-]*|(?:4k|uhd|2k|fhd|full\s*hd|hd|sd|hdr|dolby\s*vision|\d{3,4}\s*[pр])(?:\s*(?:hdr\d*\+?|dolby\s*vision|hevc|x265|av1|dv))*)$/i.test(text))
        return '';
      if(/red[\s._-]*head[\s._-]*sound|\brhs\b|ред[\s._-]*хед[\s._-]*саунд|рхс/.test(text))return 'rhs';
      if(/(?:rezka|резка|hdrezka|hd[\s.-]*резка)[^\n]{0,20}18\s*\+/.test(text))return 'rezka18';
      if(/дубл(?:ир(?:ован|ов)|я[жг]|еж|\.)|дублирован|пифагор|невафильм|официальн.*дубл|кинотеатральн/.test(text))return 'dub';
      if(/lost[\s._-]*film|лост[\s._-]*фильм/.test(text))return 'lostfilm';
      if(/tv[\s._-]*shows?|тв[\s._-]*шоу|твшоу/.test(text))return 'tvshows';
      if(/кубик\s*(?:в\s*)?кубе|kubik\s*v\s*kube/.test(text))return 'kubik';
      if(/\bgoblin\b|гоблин|(?:дмитри[йя]\s*)?пучков|\b(?:dmitry|dmitriy|dmitri)\s*puchkov\b|божья\s*искра/.test(text))return 'goblin';
      if(/(?:rezka|резка|hdrezka|hd[\s.-]*резка)/.test(text))return 'rezka';
      if(/оригинал(?:ьн[а-я]*)?\s*(?:дорожк|звук)|\boriginal\b|без\s*перевода|английск|\benglish\b/.test(text))return 'original';
      if(/любительск|одноголос|нейросет|авторск|пародийн/.test(text))return 'amateur';
      return 'other';
    }
    function filmVoiceBlocked(value){
      if(forbiddenVoice(value)||filmKidsVoiceBlocked(value))return true;
      var text=String(value||'').toLowerCase().replace(/ё/g,'е');
      // A mixed title like "Гоблин / Дублированный" must respect BOTH
      // exclusions, not only the first category in the ranking regex.
      if(!filmSettingAllowed('voice_goblin')&&
          /\bgoblin\b|гоблин|(?:дмитри[йя]\s*)?пучков|\b(?:dmitry|dmitriy|dmitri)\s*puchkov\b|божья\s*искра/.test(text))
        return true;
      var category=filmVoiceCategory(value);
      return !!category&&!filmSettingAllowed('voice_'+category);
    }
    function filmVoiceRestrictionsActive(){
      return ['rhs','dub','lostfilm','rezka','tvshows','kubik','rezka18',
        'goblin','original','amateur','other'].some(function(category){
        return !filmSettingAllowed('voice_'+category);
      });
    }
    function filmVoiceIdentityKnown(label){
      var text=String(label||'').trim();
      if(!text||/^(?:неизвестно|неизвестная|unknown|без названия|no voice|n\/a|по умолчанию|default|авто|auto)$/i.test(text))
        return false;
      return !!filmVoiceCategory(text);
    }
    function filmPlaybackVoiceKnown(file,voice,stream){
      if(filmVoiceIdentityKnown(voice))return true;
      var props=['voice_name','translate_voice','voice','voice_title','voiceName',
        'voiceLabel','voice_label','translation','translate','translator',
        'studio','dub','dubbing','audio_name','audio_title','track_name'];
      return [file,stream].some(function(row){
        if(!row||typeof row!=='object')return false;
        return props.some(function(prop){
          var v=row[prop];
          return typeof v==='string'&&filmVoiceIdentityKnown(v)||
            !!(v&&typeof v==='object'&&
              typeof v.name==='string'&&filmVoiceIdentityKnown(v.name));
        });
      });
    }
    function filmVoiceTitleBlocked(value){
      // A generic film title is not evidence of an 'Other' translation.
      // The actual voice metadata is checked independently.
      if(forbiddenVoice(value)||filmKidsVoiceBlocked(value))return true;
      var category=filmVoiceCategory(value);
      return !!category&&category!=='other'&&!filmSettingAllowed('voice_'+category);
    }
    function filmAdMarked(item){
      if(!item||typeof item!=='object')return false;
      function present(value){
        return value===true||value===1||value==='true'||
          !!(value&&typeof value==='object'&&
            (value.url||value.vast||value.tag||value.src));
      }
      return present(item.vast)||present(item.preroll)||
        present(item.pre_roll)||present(item.advertisement)||
        present(item.ads)||present(item.has_ads);
    }
    function filmSourceEnabled(row){
      var family=filmSourceFamily(typeof row==='string'?{balanser:row}:row);
      return !family||filmSettingAllowed('source_'+family);
    }
    // Studios may be identified only on a folder or the signed stream.
    function filmVoiceFieldsBlocked(item){
      if(!item)return false;
      if(typeof item==='string')return filmVoiceBlocked(item);
      if(typeof item!=='object')return false;
      var fields=['voice_name','translate_voice','voice','voice_title',
        'voiceName','voiceLabel','voice_label','translation','translate',
        'translator','studio','dub','dubbing','audio_name','audio_title',
        'audio_track','track_name','sound_name'];
      return fields.some(function(field){
        var v=item[field];
        if(typeof v==='string')return filmVoiceBlocked(v);
        if(Array.isArray(v))return v.some(function(x){
          return typeof x==='string'&&filmVoiceBlocked(x);
        });
        return v&&typeof v==='object'&&typeof v.name==='string'&&
          filmVoiceBlocked(v.name);
      })||filmVoiceTitleBlocked(item.text||'');
    }
    function filmPlaybackAllowed(provider,file,voice,stream,finalCheck){
      if(!filmSourceEnabled(provider)||filmVoiceBlocked(voice)||
         filmVoiceFieldsBlocked(file)||filmVoiceFieldsBlocked(stream)||
         filmAdMarked(file)||filmAdMarked(stream))return false;
      // Most serial episode cards omit the translation field. Turning off
      // Goblin must not make every otherwise-available episode disappear.
      // Explicitly banned studios are still rejected from every populated
      // metadata field, inherited voice and signed stream response.
      // 'Другие / неизвестные' is the dedicated strict unknown-voice switch.
      if(finalCheck&&!filmSettingAllowed('voice_other')&&
          !filmPlaybackVoiceKnown(file,voice,stream))return false;
      return true;
    }
    function filmMinimumQuality(){
      var value=String(Lampa.Storage.get('capsule_skaz_online_min_quality','any'));
      return /^(?:480|720|1080|2160)$/.test(value)?Number(value):0;
    }
    var SERIES_FAMILIES=['alloha','hdrezka','filmix','kinopub',
      'vibix','kodik','redheadsound'];
    var SERIES_CHECK_ORDER=['alloha','hdrezka','vibix','kodik',
      'kinopub','redheadsound','filmix'];
    var FILM_FAMILIES=['alloha','filmix','hdrezka','mirkinoz',
      'skaztv','redheadsound'];
    function filmSourceOrder(){
      return String(Lampa.Storage.get('capsule_skaz_online_quality','auto'))==='max'?
        ['mirkinoz','alloha','hdrezka','filmix','skaztv','redheadsound']:
        ['alloha','hdrezka','filmix','mirkinoz','skaztv','redheadsound'];
    }
    function seriesSourceEnabled(row){
      var family=filmSourceFamily(typeof row==='string'?{balanser:row}:row);
      return SERIES_FAMILIES.indexOf(family)>=0&&filmSourceEnabled({balanser:family});
    }
    function movieSourceEnabled(row){
      var family=filmSourceFamily(typeof row==='string'?{balanser:row}:row);
      return FILM_FAMILIES.indexOf(family)>=0&&filmSourceEnabled({balanser:family});
    }
    function filmSourcePriority(row){
      var index=filmSourceOrder().indexOf(filmSourceFamily(row));
      return index<0?0:filmSourceOrder().length-index;
    }
    function filmSourceScore(row){
      return filmSourcePriority(row)*20;
    }
    window.__capsuleFilmPriorities={
      mode:filmSearchMode,kids:filmKidsMode,
      sources:filmSourceOrder,source:filmSourceFamily,
      enabled:filmSourceEnabled,minimum:filmMinimumQuality,
      voiceCategory:filmVoiceCategory,kidsBlocked:filmKidsVoiceBlocked,
      allowed:filmPlaybackAllowed,voiceMetadataBlocked:filmVoiceFieldsBlocked
    };
    function sameFilmTitle(a,b){
      function norm(value){
        return String(value||'').toLowerCase().replace(/ё/g,'е')
            .replace(/[^a-zа-я0-9]+/g,' ').trim().replace(/\s+/g,' ');
      }
      var x=norm(a),y=norm(b);
      if(!x||!y)return false;
      if(x===y)return true;
      // A prefix is NOT a film match: Toy Story != Toy Story 2.
      // A provider may append the release year, but not another title.
      return x.replace(/\s+(?:19|20)\d{2}$/,'')===y||
          y.replace(/\s+(?:19|20)\d{2}$/,'')===x;
    }
    function playbackLanguage(){
      var value=String(Lampa.Storage.get('capsule_skaz_online_language','auto')||'auto').toLowerCase();
      return /^(?:auto|ru|uk|en|original)$/.test(value)?value:'auto';
    }
    // Selection Policy v3: an original movie language is not an audio track.
    function voiceLanguage(name,explicit){
      function codeFor(v){
        var t=String(v||'').trim().toLowerCase().replace(/ё/g,'е');
        if(/^(?:ru(?:-ru)?|rus|russian|русск(?:ий|ая|ое)|рус)$/.test(t))return 'ru';
        if(/^(?:uk|ua|ukr|ukrainian|украинск(?:ий|ая|ое)|українська)$/.test(t))return 'uk';
        if(/^(?:en(?:-us|-gb)?|eng|english|английск(?:ий|ая|ое))$/.test(t))return 'en';
        if(/^(?:original|orig|оригинал|оригинальная|оригинальный)$/.test(t))return 'original';
        return '';
      }
      var explicitCode=codeFor(explicit);
      if(explicitCode)return explicitCode;
      var t=String(name||'').toLowerCase().replace(/ё/g,'е');
      if(/укра[їи]н|укр\.?\s*(?:озвуч|дубляж|мова)|\b(?:ukr|ukrainian|ua\s*dub)\b/.test(t))return 'uk';
      if(/английск|англійськ|\b(?:english|eng\s*dub)\b/.test(t))return 'en';
      if(/оригинал(?:ьн[а-я]*)?\s*(?:дорожка|звук)|\b(?:original\s*(?:audio|track|language)|in\s*original)\b|без\s*перевода/.test(t))return 'original';
      // "Оригинальный дубляж" means a dub, NOT the original-language audio.
      if(/дубл(?:ир(?:ован|ов)|я[жг]|еж|\.)|дублирован|русск|(?:^|[\s(\[{])рус(?=$|[\s)\]}.,])|російськ|\b(?:rus|russian|ru\s*dub)\b|\brhs\b|рхс|red.?head.?sound|lost.?film|лост.?фильм|newstudio|jaskier|профессиональн|многоголос|пифагор|невафильм|кинотеатральн|\b(?:goblin|kubik)\b|гоблин|кубик\s*(?:в\s*)?кубе|\b(?:rezka|hdrezka|tvshows?|tvshow)\b|резка|тв\s*шоу|твшоу/.test(t))return 'ru';
      if(/\b(?:original|orig)\b|оригинал(?:ьн[а-я]*)?/.test(t))return 'original';
      return '';
    }
    function explicitAudioLanguage(row){
      row=row||{};
      var keys=['audio_language','voice_language','audio_lang','voice_lang',
        'translation_language','dub_language'];
      for(var i=0;i<keys.length;i++){
        var lang=voiceLanguage('',row[keys[i]]);
        if(lang)return lang;
      }
      return '';
    }
    function sourceLanguage(row,voice){
      row=row||{};
      var attached=row.voice_name||row.translate_voice||row.voice||row.text||'';
      var label=attached||voice||'';
      var inferred=voiceLanguage(attached)||voiceLanguage(voice);
      // The actual item's stated voice overrides a stale parent/header voice.
      return inferred||explicitAudioLanguage(row)||
        (!label?voiceLanguage('',row.language||row.lang):'');
    }
    function trackLanguage(file,voice,stream){
      file=file||{};stream=stream||{};
      var label=file.voice_name||file.translate_voice||file.voice||voice||file.text||'';
      var named=voiceLanguage(label)||voiceLanguage(voice);
      // A dubbed label denotes Russian on Skaz unless it explicitly names
      // Ukrainian/English/original. Generic 'audio_language' can refer to
      // the film's original language and must not outrank a named dub.
      var samePlayUrl=!!(file.method==='play'&&stream&&
        file.url&&stream.url&&String(file.url)===String(stream.url));
      var signed=stream&&stream!==file&&!samePlayUrl?stream:null;
      var strong=signed?voiceLanguage(signed.voice_name||
        signed.translate_voice||signed.voice||'')||
        voiceLanguage('',signed.voice_language||signed.voice_lang||
          signed.translation_language||signed.dub_language):'';
      var weak=(signed?explicitAudioLanguage(signed):'')||
        (!label?explicitAudioLanguage(file):'');
      var stated=strong||named||weak||sourceLanguage(file,voice);
      var conflict=!!(strong&&named&&strong!==named);
      return {lang:conflict?'':stated,conflict:conflict,
        stated:strong||weak,named:named};
    }
    function playbackLanguageTier(file,voice,stream){
      var ev=trackLanguage(file,voice,stream),lang=ev.lang,wanted=playbackLanguage();
      if(wanted==='auto'){
        if(lang==='uk')return -1;
        if(ev.conflict)return 1;
        // Unlabelled but permitted Skaz 2160p must not lose to a 1080p
        // merely for having no explicit "Rus" marker. This is *only*
        // an auto-ranking policy, NOT a claim of verified Russian audio.
        // Explicit English/original remain less preferred, Ukrainian
        // and contradictory track metadata still follow earlier guards.
        return lang==='ru'||!lang?4:1;
      }
      if(ev.conflict)return -1;
      if(wanted==='original')return lang==='original'?4:lang==='en'?3:-1;
      return lang===wanted?4:-1;
    }
    function languageAccepted(row,voice){
      return playbackLanguageTier(row,voice,null)>=0;
    }
    function filmMinutes(value,unit){
      if(value===undefined||value===null||value==='')return 0;
      if(typeof value==='string'){
        var input=value.trim().toLowerCase();
        var clock=input.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
        if(clock){
          var first=Number(clock[1]),second=Number(clock[2]);
          if(clock[3])return first*60+second+Number(clock[3])/60;
          // Skaz prints full-length movies as HH:MM ("01:45" = 105
          // minutes). The old code interpreted it as MM:SS (1.75 min),
          // which caused the matching Alloha movie to be rejected.
          // Large first fields (>4) are probably minute:second clips.
          if(first<=4)return first*60+second;
          return first+second/60;
        }
        var m=input.match(/(\d{1,4})\s*(?:мин|minutes?|mins?|min\b)/);
        if(m)return Number(m[1]);
        value=Number(input);
      }
      var n=Number(value);
      if(!isFinite(n)||n<=0)return 0;
      if(unit==='seconds')return n/60;
      if(unit==='milliseconds')return n/60000;
      if(n>100000)return n/60000;
      if(n>420)return n/60;
      return n;
    }
    function filmKnownMinutes(row){
      if(!row||typeof row!=='object')return 0;
      return filmMinutes(row.duration_seconds||row.duration_sec||row.length_seconds,'seconds')||
        filmMinutes(row.duration_ms,'milliseconds')||
        filmMinutes(row.runtime||row.duration||row.length||row.time||row.playtime);
    }
    function filmRuntimeMatches(reference,actual){
      if(!reference||!actual)return true;
      return Math.abs(reference-actual)<=Math.max(13,reference*.14);
    }
    function chooseVerifiedRuntime(rows,reference){
      var match=Array.isArray(rows)?rows.slice():[];
      var ref=filmMinutes(reference);
      if(ref){
        var eligible=match.filter(function(row){
          return filmRuntimeMatches(ref,filmKnownMinutes(row.stream)||
              filmKnownMinutes(row.file));
        });
        eligible.sort(function(a,b){
          var da=filmKnownMinutes(a.stream)||filmKnownMinutes(a.file);
          var db=filmKnownMinutes(b.stream)||filmKnownMinutes(b.file);
          return (db?1:0)-(da?1:0);
        });
        return eligible;
      }
      var measured=match.map(function(row){
        return {row:row,runtime:filmKnownMinutes(row.stream)||
            filmKnownMinutes(row.file)};
      }).filter(function(v){return v.runtime>0;});
      if(measured.length<2)return match;
      var best=[], ambiguous=false;
      measured.forEach(function(candidate){
        var cluster=measured.filter(function(entry){
          return filmRuntimeMatches(candidate.runtime,entry.runtime);
        });
        if(cluster.length>best.length){best=cluster;ambiguous=false;}
        else if(cluster.length===best.length&&
            best.length&&Math.abs(best[0].runtime-candidate.runtime)>17)
          ambiguous=true;
      });
      if(best.length<2||ambiguous)return [];
      return match.filter(function(entry){
        var runtime=filmKnownMinutes(entry.stream)||filmKnownMinutes(entry.file);
        return runtime&&filmRuntimeMatches(best[0].runtime,runtime);
      });
    }
    function filmItemAllowed(movie,row){
      if(!row||typeof row!=='object')return false;
      // Reject explicit episodes even when the provider answers a movie query.
      if(Number(row.season)>0||Number(row.episode)>0||
          Number(row.season_number)>0||Number(row.episode_number)>0)return false;
      if(row.serial===true||row.serial===1||row.serial==='true'||row.serial==='1'||
          row.is_series===true||row.is_series===1)return false;
      var kind=String(row.media_type||row.type||'').toLowerCase();
      if(/^(?:tv|serial|series|tvshow|anime-serial)$/.test(kind))return false;
      if(row.method==='link'&&/^(?:сезон|season)\s*[№#:.-]?\s*\d+/i.test(String(row.text||'')))
        return false;
      var idKeys=['imdb_id','kinopoisk_id','tmdb_id'],idMatched=false;
      for(var i=0;i<idKeys.length;i++){
        var id=idKeys[i];
        if(movie[id]&&row[id]){
          if(String(movie[id])!==String(row[id]))return false;
          idMatched=true;
        }
      }
      var expectedYear=parseInt(String(movie.release_date||'').slice(0,4),10);
      var foundYear=parseInt(String(row.year||row.release_year||row.release_date||'').slice(0,4),10);
      if(expectedYear>1900&&foundYear>1900&&Math.abs(expectedYear-foundYear)>1)return false;
      var stated=String(row.movie_title||row.film_title||row.content_title||
          row.original_title||'').trim();
      if(row.similar)stated=String(row.title||row.text||stated).trim();
      var runtimeExpected=filmMinutes(movie.runtime);
      var runtimeFound=filmKnownMinutes(row);
      if(!filmRuntimeMatches(runtimeExpected,runtimeFound))return false;
      if(stated&&!sameFilmTitle(stated,movie.title||movie.name)&&
          !sameFilmTitle(stated,movie.original_title||movie.original_name)){
        // Alloha can call Coco "Праздник всей жизни" (an alternate
        // localization) on a verified 2160p file. The old title-only veto
        // rejected it THREE times (HTML, candidate, signed response).
        // Explicit mismatching IDs/year/runtime still take precedence.
        // No title override for "similar" recommendation cards.
        var yearMatched=expectedYear>1900&&foundYear>1900&&
          expectedYear===foundYear;
        // Some Alloha playable rows expose only an HH:MM duration; the
        // release year is supplied separately by Lampa's TMDB card.
        var runtimeMatched=runtimeExpected>=40&&runtimeFound>=40&&
          filmRuntimeMatches(runtimeExpected,runtimeFound);
        if(row.similar||!(idMatched||yearMatched||runtimeMatched))
          return false;
      }
      return true;
    }

    // Keep every safe server-advertised source. An allow-list of only six
    // brands silently removed usable alternatives from the source menu.
    // Explicitly disabled or advertising-labelled streams remain excluded.
    // Only these five families may be probed for SERIES. Keep film
    // discovery and 4K-specific providers independent and unchanged.
    function seriesFamily(row){
      // VIBIX and Filmix are independent series providers.
      return filmSourceFamily(row);
    }
    function fiveSeriesProvider(row){
      var obj=typeof row==='string'?{balanser:row}:row||{};
      return seriesSourceEnabled(obj)&&!forbiddenVoice(obj.name||'');
    }
    function allowedSeriesProvider(row){
      var obj=typeof row==='string'?{balanser:row}:row||{};
      return movieSourceEnabled(obj)&&!forbiddenVoice(obj.name||'');
    }
    window.__capsuleSerialAllowed=fiveSeriesProvider;
    window.__capsuleSerialFamily=seriesFamily;
    function sourceExplanation(row){
      var key=balanserName(row);
      if(isMirKinoZ(row))
        return 'Мир кино Z · фильмы, 4K/HDR при наличии настоящей версии. Нужна быстрая стабильная сеть; для сериалов не используется. Автоматика проверяет поток.';
      if(key==='alloha'||key==='allohatv')
        return 'Alloha · широкий каталог сезонов и переводов. Рекомендуется для сериалов, если подтверждено покрытие. Выбор озвучки не должен скрывать сезоны.';
      if(key==='rezka'||key==='hdrezka'||key==='rezkatv'||key==='hdrezkatv')
        return 'Rezka / HDRezka · качественные переводы и стабильные версии, но охват сезонов может различаться.';
      if(/^(?:rc\/)?(?:filmix|filmixtv|fxapi)$/.test(key))
        return 'Filmix · резервный источник для фильмов и сериалов. Доступные сезоны, переводы и качество зависят от конкретной карточки.';
      if(key==='kinopub'||key==='kpu'||key==='kpu-tv')
        return 'KinoPub · альтернативные версии хорошего качества. Для отдельных ссылок могут требоваться авторизация или подписка.';
      if(/^(?:collaps|collaps-dash|collapsdash)$/.test(key))
        return 'Collaps · дополнительный источник, только при доступном видеопотоке без рекламной метки.';
      if(/^(?:kodik|kodiktv)$/.test(key))
        return 'Kodik · дополнительный источник, особенно для аниме и сериалов; проверяется язык и реальное качество.';
      if(/^(?:rhsprem|redheadsound|rc\/rhs|rhs)$/.test(key))
        return 'RedHeadSound · переводы RHS, при наличии в каталоге Skaz.';
      if(/^(?:vibix|vibixtv)$/.test(key))
        return 'Vibix · дополнительный источник, доступен только при рабочем ответе и разрешённой озвучке.';
      if(/^skaz/.test(key))
        return 'Skaz TV · источник из основного каталога Skaz. Реальное качество и набор серий проверяются по ответу сервера.';
      return 'Источник Skaz · качество и доступность зависят от ответа сервера.';
    }
    window.__capsuleSourceInfo=sourceExplanation;
    function isMirKinoZ(row){
      var key=balanserName(row);
      return /^(?:mirkino|mirkinoz|mir-kino(?:-z)?|mir_kino(?:_z)?|mirkino-z|mirkinotv-z)$/.test(key)||
        /^(?:мир\s*кино|mir\s*kino|mirkino)\s*[-.]?\s*z(?:\b|\s|$)/i.test(
          String(row&&row.name||''));
    }

  // Headless film-only route. No Activity.push(), DOM screen or Amedia catalog.
  // Uses exactly the Skaz endpoint, auth/account and RCH bridge of the series
  // component. Bound all scanning, signing and retries for low-power TVs.
  var capsuleFilmJob=null, capsuleFilmSeq=0, lastFilmKey='', lastFilmTap=0;
  function filmRequestParams(base,movie) {
    var query=[
      'id='+encodeURIComponent(movie.id||''),
      'title='+encodeURIComponent(movie.title||movie.name||''),
      'original_title='+encodeURIComponent(movie.original_title||movie.original_name||''),
      'serial=0',
      'source='+encodeURIComponent(movie.source||'tmdb'),
      'year='+encodeURIComponent(String(movie.release_date||'').slice(0,4)),
      'original_language='+encodeURIComponent(movie.original_language||''),
      'clarification=0','similar=false'
    ];
    ['imdb_id','kinopoisk_id','tmdb_id'].forEach(function(k){
      if(movie[k])query.push(k+'='+encodeURIComponent(movie[k]));
    });
    // Same RCH fallback as the working series requestParams.
    var rch=(window.rch_nws&&window.rch_nws[hostkey])||
      (window.rch&&window.rch[hostkey]);
    query.push('rchtype='+encodeURIComponent(rch&&rch.type||''));
    var email=Lampa.Storage.get('account_email','');
    if(email)query.push('cub_id='+Lampa.Utils.hash(email));
    return base+(base.indexOf('?')>=0?'&':'?')+query.join('&');
  }
  function filmValidUrl(url,allowRelative){
    var value=String(url||'').trim();
    return /^(?:https?:\/\/)/i.test(value)||
      !!(allowRelative&&/^\/(?!\/)/.test(value));
  }
  function filmSkazUrl(url){
    var value=String(url||'').trim();
    if(/^\/(?!\/)/.test(value))
      return Defined.localhost.replace(/\/+$/,'/')+value.replace(/^\/+/, '');
    return value;
  }
  function filmParseHtml(html,movie) {
    var result={videos:[],voices:[],links:[]};
    if(typeof html!=='string'||!html||html.length>4*1024*1024)return result;
    try {
      var body=$('<div></div>');
      if($.parseHTML&&typeof document!=='undefined')
        body.append($.parseHTML(html,document,false));
      else body.html(html);
      function read(selector,destination) {
        body.find(selector).each(function(){
          try {
            var elem=$(this),raw=elem.attr('data-json');
            if(!raw||raw.length>65536)return;
            var item=JSON.parse(raw);
            if(!item||typeof item!=='object'||Array.isArray(item))return;
            if(!item.runtime&&elem.attr('data-runtime'))
              item.runtime=elem.attr('data-runtime');
            var season=Number(elem.attr('s')),episode=Number(elem.attr('e'));
            if(season>0)item.season=season;
            if(episode>0)item.episode=episode;
            // Voice and quality folders are navigation, not video metadata.
            // Alloha may reuse a source-level serial/type/title flag in these
            // menu rows; never reject an entire branch as the wrong movie.
            var folder=destination==='voices'||item.method==='link';
            if(!folder&&!filmItemAllowed(movie,item))return;
            if(!filmValidUrl(item.url,true))return;
            item.text=String(item.text||elem.text()||'').trim();
            // A 4K/720p row may not contain a voice label. The selected
            // translation belongs to the parent voice URL and must be carried
            // into the candidate before enforcing the language setting.
            if(filmVoiceBlocked(item.voice_name||item.translate_voice||'')||
                (destination==='voices'?filmVoiceBlocked(item.text):
                  filmVoiceTitleBlocked(item.text)))return;
            if(destination==='voices')result.voices.push(item);
            else if(item.method==='play'||item.method==='call')
              result.videos.push(item);
            else if(item.method==='link')result.links.push(item);
          }catch(ignored){}
        });
      }
      read('.videos__item','videos');
      read('.videos__button','voices');
    }catch(ignored){}
    return result;
  }
  // Source reports may expose a direct URL, or a separate quality map
  // containing 720, 1080 and 4K. We must never rank the initial 720 link
  // while discarding a confirmed 2160p alternate in the SAME translation.
  function filmQualityHeight(name){
    var label=String(name||'').toLowerCase(),height=0;
    var matches=label.match(/(?:4320|2160|1440|1080|720|576|480|360)\s*[pр]?\b/g)||[];
    matches.forEach(function(item){
      height=Math.max(height,parseInt(item,10)||0);
    });
    if(/\b\d{3,4}\s*[x×]\s*2160\b/.test(label))height=Math.max(height,2160);
    if(/\b(?:4k|uhd|ultra\s*hd)\b/.test(label))height=Math.max(height,2160);
    if(/\b(?:2k|qhd)\b/.test(label))height=Math.max(height,1440);
    if(/\b(?:fhd|full\s*hd)\b/.test(label))height=Math.max(height,1080);
    if(/\bhd\b/.test(label)&&!height)height=720;
    return height;
  }
  function filmQualityOptions(input){
    var map=input&&typeof input==='object'&&!Array.isArray(input)?input:null;
    if(!map)return [];
    var options=[];
    Object.keys(map).forEach(function(label){
      var item=map[label],url=item;
      if(item&&typeof item==='object')url=item.url||item.src||item.file;
      if(typeof url!=='string')return;
      url=url.split(' or ')[0].trim();
      var height=filmQualityHeight(label);
      if(height&&filmValidUrl(url,false))
        options.push({height:height,url:url,label:label,
          hdr:/\b(?:hdr10?\+?|dolby\s*vision|dv|hdr)\b/i.test(
            label+' '+String(item&&item.hdr||''))});
    });
    return options.sort(function(a,b){
      return b.height-a.height||Number(b.hdr)-Number(a.hdr);
    });
  }
  function filmQualityCeiling(){
    var value=String(Lampa.Storage.get('capsule_skaz_online_quality','auto'));
    if(value==='max')return 4320;
    if(value==='2160')return 2160;
    if(value==='1080')return 1080;
    if(value==='720')return 720;
    // NetworkInformation.downlink is unavailable on most TV WebViews.
    // Unknown bandwidth is NOT evidence of a slow network: keep 4K as a
    // candidate. 4K/HDR remains explicitly configurable down to 1080.
    // Normal mode never invents a 720p ceiling from TV WebView estimates.
    // Speed-based caps are intentionally exclusive to Economy.
    if(filmSearchMode()==='normal')return 2160;
    var downlink=0;
    try{downlink=Number(window.navigator&&window.navigator.connection&&
        window.navigator.connection.downlink)||0;}catch(ignored){}
    return downlink&&downlink<7?720:downlink&&downlink<20?1080:2160;
  }
  function filmQualityChoice(map){
    var options=filmQualityOptions(map),limit=filmQualityCeiling(),
        minimum=filmMinimumQuality();
    if(!options.length)return null;
    var allowed=options.filter(function(q){return q.height>=minimum&&q.height<=limit;});
    // A configured minimum cannot silently fall back to a lower resolution.
    return allowed[0]||(minimum?null:options[options.length-1]);
  }
  function filmOrderedQuality(map){
    if(!map||typeof map!=='object'||Array.isArray(map))return {};
    var ordered={};
    Object.keys(map).sort(function(a,b){
      return filmQualityHeight(b)-filmQualityHeight(a);
    }).forEach(function(key){
      if(!filmMinimumQuality()||filmQualityHeight(key)>=filmMinimumQuality())
        ordered[key]=map[key];
    });
    return ordered;
  }
  function filmNormalizeStream(response,file){
    var stream=response;
    if(typeof stream==='string')stream={url:stream};
    if(!stream||typeof stream!=='object'||Array.isArray(stream))
      return null;
    // Several Skaz backends report a stream under file / video.
    if(!filmValidUrl(stream.url,false)){
      var alternate=stream.file||stream.video||stream.stream;
      if(typeof alternate==='string'&&filmValidUrl(alternate,false))
        stream=Object.assign({},stream,{url:alternate});
      else if(alternate&&typeof alternate==='object'&&
          filmValidUrl(alternate.url,false))
        stream=Object.assign({},stream,alternate);
    }
    if(!filmValidUrl(stream.url,false)){
      var variant=filmQualityChoice(filmStreamQuality(file,stream));
      if(variant)stream=Object.assign({},stream,{url:variant.url});
    }
    return filmValidUrl(stream.url,false)?stream:null;
  }
  function filmStreamQuality(file,stream){
    var merged={},valid=false;
    [file&&file.quality,file&&file.qualitys,
      stream&&stream.quality,stream&&stream.qualitys].forEach(function(map){
      if(!map||typeof map!=='object'||Array.isArray(map))return;
      Object.keys(map).forEach(function(label){
        var value=map[label],url=value;
        if(value&&typeof value==='object')url=value.url||value.src||value.file;
        if(typeof url==='string'&&filmValidUrl(url.split(' or ')[0],false)){
          merged[label]=value;
          valid=true;
        }
      });
    });
    return valid?merged:null;
  }
  function filmDeclaredQuality(row){
    // Some providers expose 2160p in info / description rather than
    // quality_label. Never stop checking at "Дублированный" (row.text).
    if(!row||typeof row!=='object')return {height:0,label:''};
    var values=[row.quality_label,row.quality_name,row.video_quality,
      row.resolution,row.quality,row.qualitys,row.height,row.video_height,
      row.info,row.description,row.text],best={height:0,label:''};
    values.forEach(function(value){
      if(typeof value!=='string'&&typeof value!=='number')return;
      var label=String(value);
      if(label.length>600)return;
      var height=filmQualityHeight(label);
      if(height>best.height)best={height:height,label:label};
    });
    return best;
  }
  function filmEffectiveQuality(file,stream){
    var quality=filmQualityChoice(filmStreamQuality(file,stream));
    if(quality)return quality;
    var resolved=filmDeclaredQuality(stream),preview=filmDeclaredQuality(file);
    var info=resolved.height?resolved:preview;
    return {height:info.height,
      hdr:/\b(?:hdr|dolby\s*vision|dv)\b/i.test(info.label),
      url:String(stream&&stream.url||file&&file.url||''),label:info.label};
  }
  function filmQualityMeetsMinimum(file,stream,finalCheck){
    var minimum=filmMinimumQuality();
    if(!minimum)return true;
    // An unsigned preview is not authoritative: its 720p map may hide 4K
    // when the signed 'call' response arrives.
    if(!finalCheck&&file&&file.method==='call')return true;
    var map=filmStreamQuality(file,stream);
    if(map)return !!filmQualityChoice(map);
    var height=filmEffectiveQuality(file,stream).height;
    return height>=minimum&&height<=filmQualityCeiling();
  }
  // One shared lexicographic policy. No additive provider coefficients:
  // language -> actual resolution -> studio/dub -> HDR -> provider.
  function filmVoiceRank(label){
    var t=String(label||'').toLowerCase().replace(/ё/g,'е');
    if(filmVoiceBlocked(t))return -10000;
    if(/red[\s._-]*head[\s._-]*sound|\brhs\b|ред[\s._-]*хед[\s._-]*саунд|рхс/.test(t))return 8;
    if(/дубл(?:ир(?:ован|ов)|я[жг]|еж|\.)|дублирован|пифагор|невафильм|официальн.*дубл|кинотеатральн/.test(t))return 7;
    if(/lost[\s._-]*film|лост[\s._-]*фильм/.test(t))return 6;
    if(/(?:rezka|резка|hdrezka|hd[\s.-]*резка)/.test(t))return /18\s*\+/.test(t)?2:5;
    if(/tv[\s._-]*shows?|тв[\s._-]*шоу|твшоу/.test(t))return 4;
    if(/кубик\s*(?:в\s*)?кубе|kubik\s*v\s*kube/.test(t))return 3;
    if(/\bgoblin\b|гоблин|пародийн|авторск|одноголос|любительск|нейросеть/.test(t))return 2;
    if(/оригинал|\boriginal\b|английск|\benglish\b/.test(t))return 0;
    return 1;
  }
  function filmCandidateVoice(file,voice,stream){
    // A provider may put "Дублированный" in the card's text/info while
    // leaving the nominal voice_name blank or generic.
    var values=[],layers=[stream,file];
    layers.forEach(function(row){
      if(!row||typeof row!=='object')return;
      ['voice_name','translate_voice','voice','voice_title','studio',
        'audio_title','audio_track','track_name','translation'].forEach(
        function(name){if(typeof row[name]==='string')values.push(row[name]);});
    });
    values.push(voice);
    if(file&&typeof file.text==='string')values.push(file.text);
    if(file&&typeof file.info==='string'&&file.info.length<=180)
      values.push(file.info);
    for(var i=0;i<values.length;i++){
      var label=String(values[i]||'').trim();
      if(label&&(filmVoiceRank(label)>=2||voiceLanguage(label)))return label;
    }
    return String(voice||file&&file.voice_name||file&&file.translate_voice||
      file&&file.text||'');
  }
  function filmVoiceGrade(label){return filmVoiceRank(label);}
  window.__capsuleFilmVoiceRank=filmVoiceRank;
  window.__capsuleVoiceBlocked=filmVoiceBlocked;
  function filmLanguagePriority(file,voice,stream){
    return playbackLanguageTier(file,voice,stream);
  }
  function filmSelectionProfile(item){
    if(!item||!item.file)return {blocked:true,vector:[]};
    var file=item.file,voice=filmCandidateVoice(file,item.voice,item.stream);
    if(!filmPlaybackAllowed(item.provider,file,voice,item.stream))
      return {blocked:true,vector:[]};
    if(/\b(?:camrip|telesync|cam|ts|trailer|teaser|sample)\b|экранка|трейлер/i.test(voice))
      return {blocked:true,vector:[]};
    var tier=filmLanguagePriority(file,voice,item.stream);
    if(tier<0)return {blocked:true,vector:[]};
    if(!filmQualityMeetsMinimum(file,item.stream,
        !!item.stream||file.method==='play'))return {blocked:true,vector:[]};
    var quality=filmEffectiveQuality(file,item.stream),height=quality.height;
    var resolution=height>=4320?7:height>=2160?6:height>=1440?5:
      height>=1080?4:height>=720?3:height>=480?2:height>0?1:0;
    var voiceRank=filmVoiceRank(voice);
    if(voiceRank<0)return {blocked:true,vector:[]};
    return {blocked:false,language:trackLanguage(file,voice,item.stream),
      quality:quality,voice:voice,source:filmSourceFamily(item.provider),
      vector:[tier,resolution,voiceRank,quality.hdr?1:0,
        filmSourcePriority(item.provider)]};
  }
  function filmCandidateScore(item){
    var p=filmSelectionProfile(item);
    if(p.blocked)return -100000;
    var v=p.vector;
    return v[0]*1000000000+v[1]*1000000+v[2]*10000+v[3]*1000+v[4];
  }
  function filmCompareCandidates(a,b){
    var x=filmSelectionProfile(a),y=filmSelectionProfile(b);
    if(x.blocked!==y.blocked)return x.blocked?1:-1;
    for(var i=0;i<5;i++){
      var d=(y.vector[i]||0)-(x.vector[i]||0);
      if(d)return d;
    }
    var key=function(item){return [filmSourceFamily(item.provider),
      String(item.voice||''),String(item.file&&item.file.text||''),
      String(item.file&&item.file.url||'')].join('\u0001');};
    var aa=key(a),bb=key(b);
    return aa<bb?-1:aa>bb?1:0;
  }
  window.__capsuleSelectionV3={
    language:trackLanguage,languageTier:playbackLanguageTier,
    voiceRank:filmVoiceRank,profile:filmSelectionProfile,
    score:filmCandidateScore,compare:filmCompareCandidates,
    choose:function(list){return (list||[]).slice().sort(filmCompareCandidates)[0]||null;}
  };
  // Transient IDs only: never cache provider responses or signed streams.
  var idMemory=Object.create(null),idMemoryOrder=[];
  function idMemoryKey(movie){
    if(!movie||movie.id===undefined||movie.id===null)return '';
    var year=String(movie.release_date||movie.first_air_date||'').slice(0,4);
    return (isEpisodeMedia(movie)?'tv:':'film:')+
      String(movie.source||'tmdb')+':'+String(movie.id)+':'+year;
  }
  function reuseExternalIds(movie){
    var key=idMemoryKey(movie),entry=key&&idMemory[key];
    if(!entry||entry.until<Date.now())return false;
    ['imdb_id','kinopoisk_id','tmdb_id'].forEach(function(name){
      if(!movie[name]&&entry[name])movie[name]=entry[name];
    });
    return true;
  }
  function rememberExternalIds(movie){
    var key=idMemoryKey(movie);
    if(!key||!(movie.imdb_id||movie.kinopoisk_id))return;
    if(!idMemory[key])idMemoryOrder.push(key);
    idMemory[key]={imdb_id:movie.imdb_id||'',
      kinopoisk_id:movie.kinopoisk_id||'',tmdb_id:movie.tmdb_id||'',
      until:Date.now()+15*60*1000};
    while(idMemoryOrder.length>32)delete idMemory[idMemoryOrder.shift()];
  }
  function filmAutoLaunch(movie) {
    var reusedIds=reuseExternalIds(movie);
    if(!movie||isEpisodeMedia(movie))return false;
    var key=String(movie.imdb_id||movie.kinopoisk_id||movie.id||movie.title||'');
    var now=Date.now();
    if(capsuleFilmJob&&!capsuleFilmJob.closed&&key===capsuleFilmJob.key)return true;
    if(lastFilmKey===key&&now-lastFilmTap<750)return true;
    lastFilmKey=key;lastFilmTap=now;
    if(capsuleFilmJob&&!capsuleFilmJob.closed)capsuleFilmJob.close();
    var job={id:++capsuleFilmSeq,key:key,closed:false,phase:'catalog',startedAt:Date.now(),resolveStartedAt:0,
      net:[],timers:[],candidates:[],seen:Object.create(null),resolved:[],
      economyIndex:0,economyBusy:false,scanFinished:false,
      report:{status:'catalog',mode:filmSearchMode(),
        catalog:[],probed:[],candidateCount:0,resolvedCount:0,
        qualityBySource:{},languagesBySource:{},
        resolvedBySource:{},comparisonBySource:{},selected:null,
        idsReused:!!reusedIds,httpRequests:0,signedCallsCoalesced:0,
        elapsedMs:0,catalogMs:0,scanMs:0,resolveMs:0}};
    capsuleFilmJob=job;
    // Privacy-safe diagnostics: never store playback URLs, tokens or the
    // film title. Lampa console: window.__capsuleFilmLastScan.
    window.__capsuleFilmLastScan=job.report;
    function debugFilm(message){
      try{
        if(Lampa.Storage.get('capsule_skaz_online_debug',false)&&
            window.console&&window.console.log)
          window.console.log('[Capsule Online]',message);
      }catch(ignored){}
    }
    function alive(){return !job.closed&&capsuleFilmJob===job;}
    function timer(fn,ms){
      var id=setTimeout(function(){if(alive())fn();},ms);
      job.timers.push(id);return id;
    }
    job.close=function(){
      if(job.closed)return;
      job.closed=true;
      if(typeof clearTimeout==='function')job.timers.forEach(clearTimeout);
      job.net.forEach(function(net){try{net.clear();}catch(ignored){}});
      if(capsuleFilmJob===job)capsuleFilmJob=null;
      try{Lampa.Loading.stop();}catch(ignored){}
    };
    function showError(message){
      if(!alive())return;
      job.report.status='error';
      job.report.error=message;
      job.report.elapsedMs=Date.now()-job.startedAt;
      debugFilm(message);
      job.close();
      if(Lampa.Noty&&Lampa.Noty.show)Lampa.Noty.show(message);
    }
    function request(url,mode,callback,retried) {
      if(!alive())return;
      job.report.httpRequests++;
      url=filmSkazUrl(url);
      var net=new Network(),settled=false;
      job.net.push(net);
      var economy=filmSearchMode()==='economy';
      var deadline=retried?11000:mode==='catalog'?
        (economy?4400:6200):(economy?3800:7200);
      var handle=timer(function(){
        if(settled)return;settled=true;
        try{net.clear();}catch(e){}
        callback(null);
      },deadline);
      try {
        if(net.timeout)net.timeout(deadline-300);
        var done=function(response){
          if(settled||!alive())return;
          settled=true;clearTimeout(handle);
          if(response&&typeof response==='object'&&response.rch){
            if(retried)return callback(null);
            try {
              rchRun(response,function(){
                if(alive())request(url,mode,callback,true);
              });
            }catch(e){callback(null);}
            return;
          }
          if((mode==='catalog'||mode==='json')&&typeof response==='string'){
            try{response=JSON.parse(response);}
            catch(e){if(mode==='catalog')response=null;}
          }
          try{callback(response);}
          catch(unexpected){showError('Skaz: ошибка обработки ответа источника');}
        };
        var fail=function(){done(null);};
        var options={headers:{'X-Kit-AesGcm':Lampa.Storage.get('aesgcmkey','')}};
        if(mode==='text')options.dataType='text';
        // Catalog endpoints return JSON, source endpoints HTML; the film
        // resolution endpoint returns signed JSON and may require RCH.
        var method=mode==='catalog'?'silent':'native';
        // Opaque Skaz voice/quality links may contain a signature bound
        // to the exact query string. Do not append uid/account parameters.
        var signed=/(?:[?&](?:sig|signature|token|hash|hmac|expires|exp|auth)=)/i
          .test(String(url||''));
        net[method](signed?url:account(url),done,fail,false,options);
      }catch(error){
        if(!settled){
          settled=true;clearTimeout(handle);
          try{callback(null);}catch(unexpected){showError('Skaz: ошибка источника');}
        }else if(alive())showError('Skaz: не удалось обработать ответ');
      }
    }
    function orderFilmProviders(rows){
      var groups=Object.create(null),names=[];
      (rows||[]).forEach(function(row){
        var key=balanserName(row);
        if(!groups[key]){groups[key]=[];names.push(key);}
        groups[key].push(row);
      });
      names.sort(function(a,b){
        return filmSourceScore(groups[b][0])-filmSourceScore(groups[a][0]);
      });
      var result=[],pending=true;
      // Round-robin by family: Mir Kino and Alloha must be inspected
      // before the 5th Rezka mirror, not crowded out by duplicate entries.
      while(pending){
        pending=false;
        names.forEach(function(name){
          if(groups[name].length){
            result.push(groups[name].shift());
            pending=true;
          }
        });
      }
      return result;
    }
    function extractProviders(response){
      var rows=response&&Array.isArray(response.online)?response.online:[];
      var seen=Object.create(null),result=[];
      rows.forEach(function(row){
        // A catalog row describes a provider, not necessarily a movie card.
        // It can carry "serial", media_type or quality capabilities belonging
        // to the source. Applying the playable-video filmItemAllowed() test
        // here mistakenly removed otherwise valid Alloha film providers.
        // Validate the actual movie title/episode on each returned video.
        if(!row||!allowedSeriesProvider(row)||
            !filmValidUrl(row.url,true))return;
        var id=balanserName(row),key=id+'|'+String(row.url).trim();
        if(!id||seen[key])return;
        seen[key]=true;result.push(row);
      });
      return orderFilmProviders(result);
    }
    function addCandidate(provider,file,voice) {
      if(!alive()||!file||!filmPlaybackAllowed(provider,file,voice)||!filmItemAllowed(movie,file)||
          filmLanguagePriority(file,voice||file.voice_name||file.text)<0||
          !filmValidUrl(file.url,true)||!['play','call'].includes(file.method))return;
      var identity=filmSourceFamily(provider)+'|'+String(file.url)+'|'+String(voice||file.voice_name||'');
      if(job.seen[identity])return;
      job.seen[identity]=true;
      job.candidates.push({provider:provider,file:file,
          voice:voice||file.voice_name||file.translate_voice||file.text||'',
          movie:movie});
      job.report.candidateCount++;
      var family=filmSourceFamily(provider),height=filmEffectiveQuality(file).height;
      var language=sourceLanguage(file,voice||file.voice_name||file.text)||'unknown';
      var langs=job.report.languagesBySource[family]||{};
      langs[language]=(langs[language]||0)+1;
      job.report.languagesBySource[family]=langs;
      job.report.qualityBySource[family]=Math.max(
        job.report.qualityBySource[family]||0,height);
      if(filmSearchMode()==='economy')economyPump();
    }
    function probeSource(provider,complete) {
      // Skaz returns SIGNED voice/folder URLs. Only the ROOT provider URL
      // accepts our Lampa card parameters. Appending card params to child
      // links (old behavior) broke Alloha's 4K and Mir Kino Z responses.
      var visited=Object.create(null),queue=[{
        url:provider.url,voice:'',depth:0,root:true
      }],active=0,count=0,finished=false;
      var providerFamily=filmSourceFamily(provider),providerStat=null;
      if(!job.report.providerStages)job.report.providerStages={};
      providerStat=job.report.providerStages[providerFamily];
      if(!providerStat)providerStat=job.report.providerStages[providerFamily]={
        requests:0,responses:0,voiceFolders:0,linkFolders:0,
        videoRows:0,accepted:0
      };
      // Alloha voice folders can contain several further quality folders.
      var maxRequests=32,maxDepth=5,maxParallel=3;
      function queuePriority(item){
        var lang=sourceLanguage({},item.voice),rank=filmVoiceRank(item.voice);
        return (lang==='ru'?4:!lang?2:lang==='uk'?0:1)*100000+
          Math.max(0,rank)*1000+filmQualityHeight(item.label)+item.depth*30;
      }
      function finish(){
        if(finished)return;
        finished=true;complete();
      }
      function schedule(){
        if(!alive()||finished)return;
        if(!queue.length&&!active)return finish();
        while(active<maxParallel&&queue.length&&count<maxRequests){
          queue.sort(function(a,b){return queuePriority(b)-queuePriority(a);});
          var task=queue.shift(),url=filmSkazUrl(task.url);
          if(!filmValidUrl(url,true)||visited[url]||task.depth>maxDepth)
            continue;
          visited[url]=true;count++;active++;
          providerStat.requests++;
          // URL for a translation is an opaque, sometimes signed payload.
          var target=task.root?filmRequestParams(url,movie):url;
          (function(node){
            request(target,'text',function(body){
              if(!alive()||finished)return;
              if(typeof body==='string'&&body.length)providerStat.responses++;
              var parsed=filmParseHtml(body,movie);
              providerStat.voiceFolders+=parsed.voices.length;
              providerStat.linkFolders+=parsed.links.length;
              providerStat.videoRows+=parsed.videos.length;
              parsed.videos.forEach(function(file){
                var before=job.report.candidateCount;
                addCandidate(provider,file,node.voice);
                if(job.report.candidateCount>before)providerStat.accepted++;
              });
              // Preserve all voice and quality folders, even when a page
              // already has one playable 720p variant.
              var children=parsed.voices.concat(parsed.links).filter(function(item){
                if(!item||!filmPlaybackAllowed(provider,item,
                    item.text&&filmVoiceCategory(item.text)!=='other'?item.text:'')||
                    !filmValidUrl(item.url,true)||visited[filmSkazUrl(item.url)])return false;
                var lang=sourceLanguage(item,item.text);
                var wanted=playbackLanguage();
                return wanted==='auto'?lang!=='uk':
                  !lang||lang===wanted||(wanted==='original'&&lang==='en');
              });
              children.sort(function(a,b){
                // Prefer a verified/theatrical dub over an unknown 4K
                // voice; *within a voice tier* explore the 4K branch first.
                var aVoice=filmVoiceRank(a.text),bVoice=filmVoiceRank(b.text);
                if(aVoice!==bVoice)return bVoice-aVoice;
                return filmQualityHeight(b.text)-filmQualityHeight(a.text);
              });
              if(node.depth<maxDepth){
                children.forEach(function(child){
                  if(!visited[filmSkazUrl(child.url)]&&queue.length<maxRequests*2){
                    var label=String(child.text||child.voice_name||'');
                    var language=sourceLanguage(child,label);
                    var inherited=node.voice;
                    // Quality-label folders must not override voice identity.
                    var nextVoice=language?label:inherited;
                    queue.push({url:child.url,voice:nextVoice,label:label,
                      depth:node.depth+1,root:false});
                  }
                });
              }
              active--;schedule();
            });
          })(task);
        }
        if(!active&&(!queue.length||count>=maxRequests))finish();
      }
      schedule();
    }
    function playVerified(choice) {
      if(!alive())return;
      var file=choice.file,stream=choice.stream;
      if(!filmPlaybackAllowed(choice.provider,file,choice.voice,stream,true))
        return showError('Skaz: не удалось подтвердить разрешённую озвучку');
      if(!filmQualityMeetsMinimum(file,stream,true))
        return showError('Skaz: нет видео не ниже '+filmMinimumQuality()+'p');
      if(filmLanguagePriority(file,choice.voice||file.voice_name||file.text,stream)<0||
          filmVoiceBlocked(choice.voice||file.voice_name||file.text))
        return showError('Skaz: язык выбранного фильма не соответствует настройке');
      if(!stream||!filmValidUrl(stream.url,false))return showError('Skaz: поток недоступен');
      var data={
        title:movie.title||movie.name||file.text||'Фильм',
        card:movie,
        url:stream.url,
        quality:filmOrderedQuality(filmStreamQuality(file,stream)),
        headers:stream.headers||{},
        subtitles:stream.subtitles||file.subtitles,
        segments:stream.segments||file.segments,
        hls_manifest_timeout:stream.hls_manifest_timeout||file.hls_manifest_timeout,
        voice_name:choice.voice||file.voice_name||'',
        isonline:true,iptv:true
      };
      // Film progress uses the same hash as Lampa.Timeline.watched(card).
      // Android Player forwards timeline.time as data.position on launch.
      try{
        if(Lampa.Timeline&&Lampa.Timeline.view&&Lampa.Utils&&
            Lampa.Utils.hash){
          var canonical=movie.original_title||movie.original_name||
              movie.title||movie.name||String(movie.id||'');
          var hash=Lampa.Utils.hash(String(canonical));
          var meta=Lampa.Timeline.link?Lampa.Timeline.link(movie):undefined;
          data.timeline=Lampa.Timeline.view(hash,meta);
          if(data.timeline&&Number(data.timeline.percent)>=95)
            data.timeline.time=0;
        }
      }catch(progressError){debugFilm('Таймкод недоступен');}
      if(data.url.indexOf(' or ')>=0){
        var alternates=data.url.split(' or ');
        data.url=alternates[0];data.url_reserve=alternates[1];
      }
      var best=filmQualityChoice(data.quality);
      if(best&&filmValidUrl(best.url,false)){
        data.url=best.url;
        data.__capsuleQuality=best.label;
      }
      job.report.status='selected';
      job.report.elapsedMs=Date.now()-job.startedAt;
      job.report.resolveMs=job.resolveStartedAt?
        Date.now()-job.resolveStartedAt:0;
      job.report.selected={source:filmSourceFamily(choice.provider),
        quality:best?best.height:filmEffectiveQuality(file,stream).height,
        hdr:!!(best&&best.hdr),
        language:sourceLanguage(stream,choice.voice)||'unknown'};
      debugFilm('Фильм: '+job.report.selected.source+
        ' · '+job.report.selected.quality+'p'+
        (job.report.selected.hdr?' HDR':'')+
        ' · проверено вариантов: '+job.report.resolvedCount);
      job.close();
      try {
        Lampa.Player.play(data);
        Lampa.Player.playlist([data]);
        // Search does not read or write cached film preferences.
        if(movie.id&&Lampa.Favorite&&Lampa.Favorite.add)
          Lampa.Favorite.add('history',movie,100);
      }catch(error){
        if(Lampa.Noty&&Lampa.Noty.show)Lampa.Noty.show('Skaz: не удалось запустить видео');
      }
    }
    // ECONOMY = first *valid resolved stream*, no full source comparison.
    // A failed quick mirror is not a successful answer: keep trying.
    function economyPump(){
      if(!alive()||filmSearchMode()!=='economy'||job.economyBusy)return;
      while(job.economyIndex<job.candidates.length){
        var item=job.candidates[job.economyIndex++];
        if(filmCandidateScore(item)<0)continue;
        job.economyBusy=true;
        (function(candidate){
          function done(stream){
            if(!alive())return;
            job.economyBusy=false;
            stream=filmNormalizeStream(stream,candidate.file);
            if(stream&&filmValidUrl(stream.url,false)&&
                filmItemAllowed(movie,stream)&&
                filmQualityMeetsMinimum(candidate.file,stream,true)&&
                filmPlaybackAllowed(candidate.provider,candidate.file,candidate.voice,stream,true)&&
                filmLanguagePriority(candidate.file,candidate.voice,stream)>=0){
              var chosen={provider:candidate.provider,file:candidate.file,
                voice:candidate.voice,stream:stream};
              job.resolved.push(chosen);
              job.report.resolvedCount++;
              return playVerified(chosen);
            }
            economyPump();
          }
          if(candidate.file.method==='play')done(candidate.file);
          else request(candidate.file.url,'json',done);
        })(item);
        return;
      }
      if(job.scanFinished)showError('Skaz: нет подходящего потока для выбранного языка');
    }
    function resolveCandidates(){
      if(!alive()||job.phase==='resolve')return;
      job.phase='resolve';
      job.resolveStartedAt=Date.now();
      job.report.scanMs=job.resolveStartedAt-(job.scanStartedAt||job.startedAt);
      // The initial 720p link can hide 4K in its resolved quality map.
      // Resolve a broad, provider-diverse set BEFORE ranking by resolution.
      var valid=job.candidates.filter(function(candidate){
        return filmCandidateScore(candidate)>-1000;
      });
      if(!valid.length)return showError('Skaz: выбранная озвучка или фильм не найдены');
      // Fair signing: 48 Rezka mirrors must not displace Alloha's 4K.
      var groups=Object.create(null),families=[];
      valid.forEach(function(candidate){
        var id=filmSourceFamily(candidate.provider);
        if(!groups[id]){groups[id]=[];families.push(id);}
        groups[id].push(candidate);
      });
      families.sort(function(a,b){
        return filmSourceOrder().indexOf(a)-filmSourceOrder().indexOf(b);
      });
      families.forEach(function(id){
        groups[id].sort(filmCompareCandidates);
      });
      var ranked=[],more=true;
      while(more){
        more=false;
        families.forEach(function(id){
          if(groups[id].length){ranked.push(groups[id].shift());more=true;}
        });
      }
      var position=0,pending=0,finished=0,limit=Math.min(90,ranked.length);
      var signingInFlight=Object.create(null),pumpScheduled=false;
      function nextBatch(){
        if(pumpScheduled||!alive())return;
        pumpScheduled=true;
        // Yield between completed batches: avoid synchronous recursion
        // through dozens of already-playable links on the UI thread.
        timer(function(){pumpScheduled=false;pump();},0);
      }
      function decide(){
        if(!alive())return;
        var viable=job.resolved.filter(function(entry){
          return filmPlaybackAllowed(entry.provider,entry.file,entry.voice,entry.stream,true)&&
            filmLanguagePriority(entry.file,
              entry.voice||entry.file.voice_name||entry.file.text,entry.stream)>=0;
        });
        function selectWithReference(reference){
          if(!alive())return;
          var candidates=chooseVerifiedRuntime(viable,reference);
          job.report.runtimeReference=Number(reference)||0;
          var families=Object.create(null);
          candidates.forEach(function(candidate){
            var id=filmSourceFamily(candidate.provider),
                group=families[id]||(families[id]={count:0,best:null});
            group.count++;
            if(!group.best||filmCompareCandidates(candidate,group.best)<0)
              group.best=candidate;
          });
          var summary=Object.create(null);
          Object.keys(families).forEach(function(id){
            var group=families[id],profile=filmSelectionProfile(group.best);
            if(!profile.blocked)summary[id]={
              count:group.count,
              quality:profile.quality.height,
              languageTier:profile.vector[0],
              languageEvidence:profile.language.lang||'не указан',
              voiceRank:profile.vector[2],
              qualityTier:profile.vector[1]
            };
          });
          job.report.comparisonBySource=summary;
          candidates.sort(filmCompareCandidates);
          if(candidates.length)return playVerified(candidates[0]);
          if(viable.length)return showError(
            'Skaz: длительности версий расходятся — фильм не запускаем наугад');
          showError('Skaz: нет подходящего фильма или языка озвучки');
        }
        var reference=filmMinutes(movie.runtime);
        if(reference)return selectWithReference(reference);
        var known=viable.map(function(entry){
          return filmKnownMinutes(entry.stream)||filmKnownMinutes(entry.file);
        }).filter(function(n){return n>0;});
        if(known.length<2||Math.max.apply(null,known)-Math.min.apply(null,known)<18)
          return selectWithReference(0);
        // If providers disagree, use Lampa's own TMDB reference rather
        // than guessing which similarly named release is the actual film.
        var tmdb=Lampa.Api&&Lampa.Api.sources&&Lampa.Api.sources.tmdb;
        var id=Number(movie.tmdb_id||(
          movie.source==='tmdb'||!movie.source?movie.id:0));
        if(!tmdb||!tmdb.get||!id)return selectWithReference(0);
        var delivered=false;
        var stop=timer(function(){
          if(!delivered){delivered=true;selectWithReference(0);}
        },1500);
        try{
          tmdb.get('movie/'+id,{},function(data){
            if(delivered)return;
            delivered=true;clearTimeout(stop);
            selectWithReference(data&&data.runtime);
          },function(){
            if(delivered)return;
            delivered=true;clearTimeout(stop);selectWithReference(0);
          });
        }catch(e){
          if(!delivered){delivered=true;clearTimeout(stop);selectWithReference(0);}
        }
      }
      function pump(){
        if(!alive())return;
        if(finished>=limit&&pending===0)return decide();
        while(pending<5&&position<limit){
          var item=ranked[position++];
          pending++;
          function resolved(item,stream){
            if(!alive())return;
            var family=filmSourceFamily(item.provider),
                stat=job.report.resolvedBySource[family];
            if(!stat)stat=job.report.resolvedBySource[family]={
              checked:0,passed:0,maxQuality:0,rejected:{}};
            stat.checked++;
            stream=filmNormalizeStream(stream,item.file);
            var reason='';
            if(!stream||!filmValidUrl(stream.url,false))reason='нет ссылки';
            else if(!filmItemAllowed(movie,stream))reason='не тот фильм';
            else if(!filmQualityMeetsMinimum(item.file,stream,true))
              reason='ограничение качества';
            else if(!filmPlaybackAllowed(item.provider,item.file,item.voice,stream,true))
              reason='запрет озвучки';
            else if(filmLanguagePriority(item.file,
                item.voice||item.file.voice_name||item.file.text,stream)<0)
              reason='язык';
            if(!reason){
              var chosen={provider:item.provider,file:item.file,voice:item.voice,
                stream:stream};
              chosen.file=Object.assign({},item.file,{
                qualitys:filmStreamQuality(item.file,stream)
              });
              job.resolved.push(chosen);
              job.report.resolvedCount++;
              stat.passed++;
              stat.maxQuality=Math.max(stat.maxQuality,
                filmEffectiveQuality(chosen.file,stream).height);
              job.report.qualityBySource[family]=Math.max(
                job.report.qualityBySource[family]||0,
                filmEffectiveQuality(chosen.file,stream).height);
            }else stat.rejected[reason]=(stat.rejected[reason]||0)+1;
            pending--;finished++;nextBatch();
          }
          (function(candidate){
            var file=candidate.file;
            if(file.method==='play')return resolved(candidate,file);
            // Single-flight for identical signed URLs; independent voice
            // candidates still receive a separate result and score.
            var url=String(file.url||'');
            if(signingInFlight[url]){
              job.report.signedCallsCoalesced++;
              signingInFlight[url].push(function(stream){
                resolved(candidate,stream);
              });
            }else{
              signingInFlight[url]=[function(stream){
                resolved(candidate,stream);
              }];
              request(url,'json',function(stream){
                var waiting=signingInFlight[url]||[];
                delete signingInFlight[url];
                waiting.forEach(function(done){done(stream);});
              });
            }
          })(item);
        }
      }
      pump();
    }
    function scanProviders(providers){
      if(!alive())return;
      if(!providers.length)return showError('Skaz: фильм не найден среди доступных источников');
      job.phase='scan';
      job.scanStartedAt=Date.now();
      job.report.catalogMs=job.scanStartedAt-job.startedAt;
      var queued=0,running=0,ended=0,extended=false,
          activeFamilies=Object.create(null),total=Math.min(providers.length,24);
      // SEARCH BARRIER: network completion order never chooses the
      // film. Probe every scheduled provider (including Mir Kino Z) before
      // resolving, or use the bounded search deadline as a partial result.
      // The first completed 720p is only a candidate, not a winner.
      job.report.status='scanning';
      function closeScanOnDeadline(){
        if(!alive()||job.phase!=='scan')return;
        job.report.searchDeadline=true;
        // Complete slow Alloha/Filmix folders before selecting the first 720p.
        if(filmSearchMode()==='normal'&&!extended&&
            (activeFamilies.alloha||activeFamilies.filmix)){
          extended=true;
          job.report.extendedFor=Object.keys(activeFamilies).filter(function(key){
            return !!activeFamilies[key];
          });
          timer(closeScanOnDeadline,9000);
          return;
        }
        job.report.pendingAtDeadline=Object.keys(activeFamilies).filter(function(key){
          return !!activeFamilies[key];
        });
        if(filmSearchMode()==='economy'){
          job.scanFinished=true;
          economyPump();
        }else resolveCandidates();
      }
      timer(closeScanOnDeadline,filmSearchMode()==='economy'?10000:26000);
      function pump(){
        if(!alive()||job.phase!=='scan')return;
        if(ended===total){
          job.scanFinished=true;
          if(filmSearchMode()==='economy')economyPump();
          else resolveCandidates();
          return;
        }
        while(running<3&&queued<total){
          var source=providers[queued++];running++;
          var family=filmSourceFamily(source);
          activeFamilies[family]=(activeFamilies[family]||0)+1;
          var named=balanserName(source);
          if(job.report.probed.indexOf(named)===-1)
            job.report.probed.push(named);
          (function(scannedFamily){
            probeSource(source,function(){
              if(!alive())return;
              activeFamilies[scannedFamily]--;
              running--;ended++;pump();
            });
          })(family);
        }
      }
      pump();
    }
    function withCatalog(data){
      if(!alive())return;
      if(data&&data.accsdb)return showError(String(data.msg||'Skaz: требуется авторизация'));
      try{
        job.report.rawCatalog=(data&&Array.isArray(data.online)?data.online:[])
          .map(function(r){return String(r&&r.balanser||'')+'|'+String(r&&r.name||'');});
      }catch(ignored){}
      var initial=extractProviders(data);
      job.report.catalog=initial.map(function(row){
        return balanserName(row);
      });
      debugFilm('Каталог Skaz: '+job.report.catalog.join(', '));
      if(data&&data.life){
        var next=Defined.localhost+'lifeevents?memkey='+
            encodeURIComponent(data.memkey||'');
        var catalogDeadline=Date.now()+(filmSearchMode()==='economy'?0:11000);
        var catalogRows=initial.slice(),catalogAttempts=0;
        function pollLive(){
          if(!alive())return;
          catalogAttempts++;
          request(filmRequestParams(next,movie),'catalog',function(live){
            if(!alive())return;
            if(live&&live.accsdb)return showError(String(live.msg||'Skaz: требуется авторизация'));
            extractProviders(live).forEach(function(row){catalogRows.push(row);});
            var seen=Object.create(null);
            var combined=catalogRows.slice().reverse().filter(function(row){
              var id=balanserName(row)+'|'+String(row.url||'').trim();
              if(seen[id])return false;seen[id]=true;return true;
            });
            job.report.catalog=combined.map(function(row){return balanserName(row);})
              .filter(function(id,pos,list){return list.indexOf(id)===pos;});
            // A placeholder Alloha source may arrive while its checksearch
            // is still pending (show:false). Do not stop catalog polling just
            // because the ID appeared; wait for a usable response or for the
            // backend's confirmed completion, as the serial path already does.
            var allohaReady=!filmSourceEnabled({balanser:'alloha'})||
              combined.some(function(row){
                return filmSourceFamily(row)==='alloha'&&
                  row.show!==false&&row.show!=='false'&&
                  row.show!==0&&row.show!=='0'&&
                  filmValidUrl(row.url,true);
              });
            job.report.catalogAttempts=catalogAttempts;
            job.report.allohaCatalogReady=allohaReady;
            if(filmSearchMode()==='economy'||allohaReady||
                (live&&live.ready===true)||
                Date.now()>=catalogDeadline||catalogAttempts>=6){
              scanProviders(orderFilmProviders(combined));
            }else timer(pollLive,850);
          });
        }
        pollLive();
      }else scanProviders(initial);
    }
    try{Lampa.Loading.start(function(){job.close();});}catch(ignored){}
    function watchdog(){
      // 0.11.1: never cut the resolve phase short while it is still making
      // progress; 4K often hides in the quality map of a resolved stream.
      if(job.phase==='resolve'&&job.resolveStartedAt&&
          filmSearchMode()!=='economy'&&
          Date.now()-job.resolveStartedAt<16000&&
          Date.now()-job.startedAt<60000){
        timer(watchdog,1500);return;
      }
      // The final watchdog is only a failsafe. It must not launch a
      // worse translation when an already resolved official dub exists.
      if(job.phase==='scan'||job.phase==='catalog'){
        if(filmSearchMode()==='economy'){
          job.scanFinished=true;
          economyPump();
          if(alive()&&!job.economyBusy)
            showError('Skaz: экономный поиск не нашёл рабочего потока');
        }else resolveCandidates();
      }else if(job.resolved.length){
        var emergency=chooseVerifiedRuntime(job.resolved,movie.runtime);
        if(emergency.length)playVerified(emergency.sort(filmCompareCandidates)[0]);
        else showError('Skaz: не удалось подтвердить длительность фильма');
      }else showError('Skaz: время ожидания фильма истекло');
        }
    timer(watchdog,filmSearchMode()==='economy'?14000:68000);
    // Match the normal series pipeline: /externalids precedes /lite/events.
    // Alloha commonly searches by KinoPoisk/IMDb identifiers, whereas Filmix
    // may return a title-only hit. Missing IDs previously made movie-only
    // Alloha look unavailable even though the serial path worked.
    function startCatalog(){
      if(!alive())return;
      request(filmRequestParams(Defined.localhost+'lite/events?life=true',movie),
        'catalog',withCatalog);
    }
    if(movie.imdb_id&&movie.kinopoisk_id)startCatalog();
    else {
      var lookup=['id='+encodeURIComponent(movie.id||''),'serial=0'];
      if(movie.imdb_id)lookup.push('imdb_id='+encodeURIComponent(movie.imdb_id));
      if(movie.kinopoisk_id)lookup.push('kinopoisk_id='+encodeURIComponent(movie.kinopoisk_id));
      job.report.externalIdsRequested=true;
      request(Defined.localhost+'externalids?'+lookup.join('&'),'catalog',
        function(ids){
          if(!alive())return;
          if(ids&&typeof ids==='object'&&!Array.isArray(ids)){
            ['imdb_id','kinopoisk_id','tmdb_id'].forEach(function(key){
              if(ids[key]&&(!movie[key]||movie[key]===''))
                movie[key]=ids[key];
            });
          }
          job.report.externalIdsReady=!!(movie.imdb_id||movie.kinopoisk_id);
          rememberExternalIds(movie);
          startCatalog(); // Failure or timeout must never block Filmix etc.
        });
    }
    return true;
  }
  window.__capsuleFilmAutoLaunch=filmAutoLaunch;
  window.__capsuleFilmAutoDebug={
    parse:filmParseHtml,requestParams:filmRequestParams,
    score:filmCandidateScore,sourceScore:filmSourceScore
  };

  function component(object) {
    var network = new Network();
    var scroll = new Lampa.Scroll({
      mask: true,
      over: true
    });
    // Coalesce repeated TV focus events into one Lampa scroll update per
    // animation frame without modifying the native Lampa scroll physics.
    var pendingFocus=null,focusScrollFrame=0;
    function cancelFocusScroll(){
      pendingFocus=null;
      if(focusScrollFrame){
        if(window.cancelAnimationFrame)window.cancelAnimationFrame(focusScrollFrame);
        else clearTimeout(focusScrollFrame);
      }
      focusScrollFrame=0;
    }
    function scheduleFocusScroll(node){
      if(!node)return;
      pendingFocus=node;
      if(focusScrollFrame)return;
      var raf=window.requestAnimationFrame||function(cb){return setTimeout(cb,16);};
      focusScrollFrame=raf(function(){
        focusScrollFrame=0;
        var target=pendingFocus;pendingFocus=null;
        if(!target || !scroll.update||target.isConnected===false)return;
        // On TV the old center-on-EVERY-focus forced a layout measurement
        // and animated the whole list for every D-pad step. Only scroll
        // when the next card actually approaches the viewport edge.
        var viewport=scroll.render&&scroll.render()[0];
        if(viewport&&target.getBoundingClientRect){
          var itemBounds=target.getBoundingClientRect(),
              viewBounds=viewport.getBoundingClientRect(),
              margin=Math.min(36,Math.max(8,itemBounds.height*.12));
          if(itemBounds.top>=viewBounds.top+margin&&
             itemBounds.bottom<=viewBounds.bottom-margin)return;
        }
        scroll.update($(target),true);
      });
    }
    var files = new Lampa.Explorer(object);
    var filter = new Lampa.Filter(object);
    var sources = {};
    var last,lastFocusedEpisode='';
    var source;
    var balanser;
    var initialized;
    var balanser_timer;
    var images = [];
    function posterThumbUrl(value){
      if(value&&typeof value==='object')
        value=value.url||value.src||value.poster_path||value.path||'';
      value=String(value||'').trim();
      if(!value||value==='undefined'||value==='null')return '';
      if(/^https?:\/\//i.test(value))return value;
      if(/^\/\/[^/]+/.test(value))return 'https:'+value;
      if(/^t\/p\//.test(value)){
        try{return Lampa.TMDB.image(value);}catch(ignored){}
      }
      // Skaz may return image paths relative to its own /proxyimg,
      // whereas TMDB paths begin with a bare /poster.jpg. Resolve the
      // former against Skaz, not accidentally against TMDB.
      if(/^\/?(?:proxyimg|images|img|thumbs|covers)\//i.test(value)){
        try{
          var relative=value.replace(/^\//,''),
              root=String(Defined.localhost||'').replace(/\/?$/,'/');
          return account(root+relative);
        }catch(ignored){}
      }
      if(value.charAt(0)!=='/')return '';
      // Lampa.Api.img uses the same poster resolver as card thumbnails;
      // older TMDB-only URLs missed images present elsewhere in Lampa.
      try{
        if(Lampa.Api&&typeof Lampa.Api.img==='function'){
          var result=Lampa.Api.img(value);
          if(typeof result==='string'&&/^https?:\/\//i.test(result))return result;
        }
      }catch(ignored){}
      try{return Lampa.TMDB.image('t/p/w300'+value);}
      catch(ignored){return '';}
    }
    function episodePoster(){
      var card=object.movie||{},active={};
      try{
        if(Lampa.Activity&&Lampa.Activity.active)
          active=Lampa.Activity.active().card||{};
      }catch(ignored){}
      var choices=[card.poster_path,card.poster,card.img,card.cover,
        card.image,card.poster_url,card.posterUrl,card.backdrop_path,
        card.backdrop,active.poster_path,active.poster,active.img,active.cover];
      for(var i=0;i<choices.length;i++){
        var url=posterThumbUrl(choices[i]);
        if(url)return url;
      }
      return '';
    }
    function usePosterThumb(img,image){
      var url=episodePoster();
      if(!url||!img)return false;
      image.addClass('cso-poster-fallback');
      img.onerror=function(){img.onerror=null;img.src='./img/img_broken.svg';};
      img.src=url;
      return true;
    }
    var requestPathCounts=Object.create(null);
    var filter_sources = [], sourceCatalog = Object.create(null);
    // Canonical TV catalog: five family keys, even when Skaz supplies
    // several aliases (filmixtv/fxapi). Their URLs remain internal options.
    // Films retain their original independent catalog.
    function mergeCatalogRows(rows){
      var arrived=[],seen=Object.create(null),series=isEpisodeMedia(object.movie);
      (Array.isArray(rows)?rows:[]).forEach(function(row){
        if(!row||!eligibleProvider(row))return;
        var key=series?seriesFamily(row):filmSourceFamily(row);
        if(!key)return;
        var sourceFamily=filmSourceFamily(row),
            old=sourceCatalog[key]||{},newUrl=String(row.url||'').trim(),
            live=filmValidUrl(newUrl,true),
            url=String(old.url||''),
            primaryFamily=old.primaryFamily||sourceFamily,
            shown=row.show!==false&&row.show!=='false'&&
              row.show!==0&&row.show!=='0';
        if(!seen[key]){seen[key]=true;arrived.push(key);}
        // A server may publish Filmix aliases with different menu routes.
        // They are not sixth/seventh TV sources; scan them INSIDE Filmix.
        var aliases=Array.isArray(old.aliases)?old.aliases.slice():[];
        if(live&&!aliases.some(function(item){return item.url===newUrl;}))
          aliases.push({url:newUrl,name:String(row.name||key)});
        if(live&&(!filmValidUrl(url,true)||(shown&&!old.show))){
          url=newUrl;
          primaryFamily=sourceFamily;
        }
        var count=Number(row.season_count||row.seasons_count||
          row.total_seasons)||0;
        var seasons=row.seasons||row.season_list;
        if(Array.isArray(seasons))count=Math.max(count,seasons.length);
        else if(seasons&&typeof seasons==='object')
          count=Math.max(count,Object.keys(seasons).length);
        else if(Number(seasons)>0)count=Math.max(count,Number(seasons));
        sourceCatalog[key]={
          url:url||newUrl,name:series?
            ({alloha:'Alloha',filmix:'Filmix',kinopub:'KinoPub',
              rezka:'Rezka',hdrezka:'HDRezka'}[key]||key):
            String(row.name||old.name||key),
          seasonCount:Math.max(count,Number(old.seasonCount)||0),
          show:live||!!(old.show&&filmValidUrl(old.url,true)),
          aliases:aliases,primaryFamily:primaryFamily
        };
      });
      return arrived;
    }
    var requestRevision=0, activeContentUrl='', seasonButton=null, lastSeasonTap=0;
    var automaticVoiceVisited=Object.create(null);
    var requestedPlayer=''; // one-shot context menu runas override
    // Playback version/voice selection lives only as long as this screen.
    var sessionChoices=Object.create(null);
    var filter_translate = {
      season: Lampa.Lang.translate('torrent_serial_season'),
      voice: Lampa.Lang.translate('torrent_parser_voice'),
      source: Lampa.Lang.translate('settings_rest_source')
    };
    var filter_find = {
      season: [],
      voice: []
    };
	
    // Provider search UI is unnecessary for six-source episodic playback.
    // Avoid an additional call to Skaz every time a component is created.
	
    function eligibleProvider(row){
      if(!row||typeof row!=='object')return false;
      if(isEpisodeMedia(object.movie)){
        if(!fiveSeriesProvider(row))return false;
      }else if(!allowedSeriesProvider(row))return false;
      // Allowlisted catalog entries are retained regardless of voice ranking.
      // Missing URLs are visible but cannot be auto-launched.
      var url=String(row.url||'').trim();
      return (isEpisodeMedia(object.movie)?
        fiveSeriesProvider(row):filmSourceEnabled(row))&&
          (!url||/^(?:https?:\/\/|\/(?!\/))/i.test(url))&&
          (isEpisodeMedia(object.movie)||filmItemAllowed(object.movie,row));
    }
    // Pure helpers also serve the series/film wrapper and tests.
    window.__capsuleFilmHelpers={
      isSeries:isEpisodeMedia,sourceScore:filmSourceScore,
      allow:filmItemAllowed,eligible:eligibleProvider
    };
    // Never invent URLs: extra sources only appear when Skaz returns them.
    var serialProviderSlots=[
      ['alloha','Alloha'],['hdrezka','HDRezka'],['vibix','VIBIX'],
      ['kodik','Kodik'],['kinopub','KinoPub'],['redheadsound','RHS'],
      ['filmix','Filmix']
    ];
    function completeSerialCatalog(){
      serialProviderSlots.forEach(function(slot){
        if(!filmSourceEnabled({balanser:slot[0]}))return;
        if(!sourceCatalog[slot[0]])
          sourceCatalog[slot[0]]={url:'',name:slot[1],show:false};
      });
    }
	
	function clarificationSearchAdd(value){
		var id = Lampa.Utils.hash(object.movie.number_of_seasons ? object.movie.original_name : object.movie.original_title);
		var all = readClarificationStore();
		
		all[id] = value;
		
		Lampa.Storage.set('clarification_search',all);
	}
	
	function clarificationSearchDelete(){
		var id = Lampa.Utils.hash(object.movie.number_of_seasons ? object.movie.original_name : object.movie.original_title);
		var all = readClarificationStore();
		
		delete all[id];
		
		Lampa.Storage.set('clarification_search',all);
	}
	
    this.initialize = function() {
      var _this = this;
      this.loading(true);
      filter.onSearch = function(value) {
		  
		clarificationSearchAdd(value);
		
        Lampa.Activity.replace({
          search: value,
          clarification: true,
          similar: true
        });
      };
      filter.onBack = function() {
        _this.start();
      };
      filter.render().find('.selector').on('hover:enter', function() {
        clearInterval(balanser_timer);
      });
      filter.render().find('.filter--search').appendTo(filter.render().find('.torrent-filter'));
      filter.onSelect = function(type, a, b) {
        if (type == 'filter') {
          if (a.reset) {
			  clarificationSearchDelete();
			  
            _this.replaceChoice({
              season: 0,
              voice: 0,
              voice_url: '',
              voice_name: ''
            });
            setTimeout(function() {
              Lampa.Select.close();
              Lampa.Activity.replace({
				  clarification: 0,
				  similar: 0
			  });
            }, 10);
          } else {
            var entries=a&&filter_find[a.stype], selectedItem=entries&&b&&entries[b.index];
            if(!selectedItem||!selectedItem.url)return;
            var url=selectedItem.url;
            var choice = _this.getChoice();
            if (a.stype == 'voice') {
              choice.voice_name = filter_find.voice[b.index].title;
              choice.voice_url = url;
              choice.voice_manual = true;
            }
            choice[a.stype] = b.index;
            _this.saveChoice(choice);
            _this.reset();
            _this.request(url);
            setTimeout(Lampa.Select.close, 10);
          }
        } else if (type == 'sort') {
          Lampa.Select.close();
          // changeBalanser validates and applies the source without
          // recreating the component or losing the selected item.
          _this.changeBalanser(a.source);
        }
      };
      if (filter.addButtonBack) filter.addButtonBack();
      filter.render().find('.lampac-balanser-loader').remove();
      filter.render().find('.filter--sort span').first().text('Источник');
      // Lampa's hover:long is fired by holding OK/Enter on Android TV.
      function describeSource(key){
        var row=sources[key]||{name:key};
        if(Lampa.Noty&&Lampa.Noty.show)
          Lampa.Noty.show(sourceExplanation({balanser:key,name:row.name}));
      }
      filter.render().find('.filter--sort').on('hover:long contextmenu',function(e){
        if(e&&e.preventDefault)e.preventDefault();
        describeSource(balanser);
      });
      if(typeof document!=='undefined'){
        // Dropdown rows are rendered outside this component by Lampa.Select.
        // Observe ONLY long presses and only when this source screen is active.
        $(document).on('hover:long.csoSources',[
            '.selectbox__item','.selectbox-item','.selectbox .selector',
            '.select__item'].join(','),function(event){
          try{
            if(!Lampa.Activity||Lampa.Activity.active().activity!==_this.activity)
              return;
            var title=String($(this).text()||'').toLowerCase();
            var keys=Object.keys(sources).sort(function(a,b){
              return sources[b].name.length-sources[a].name.length;
            });
            var match=keys.find(function(key){
              return title.indexOf(String(sources[key].name).toLowerCase())===0;
            });
            if(!match)return;
            if(event&&event.stopImmediatePropagation)event.stopImmediatePropagation();
            if(event&&event.preventDefault)event.preventDefault();
            describeSource(match);
          }catch(ignored){}
        });
      }
      filter.render().find('.filter--filter span').first().text('Озвучка');
      scroll.body().addClass('torrent-list');
      files.appendFiles(scroll.render());
      files.appendHead(filter.render());
      // Standalone season selector immediately BEFORE the regular filters.
      // It uses Lampa's native selector and Select menu for TV/phone input.
      seasonButton=$('<div class="simple-button simple-button--filter selector capsule-season-button hide"><span>Сезон</span><div></div></div>');
      filter.render().find('.filter--filter').first().before(seasonButton);
      function seasonPress(){
        var now=Date.now();
        if(now-lastSeasonTap<550)return;
        lastSeasonTap=now;
        _this.showSeasonPicker();
      }
      seasonButton.on('hover:enter',seasonPress).on('click',seasonPress);
      scroll.minus(files.render().find('.explorer__files-head'));
      scroll.body().append(Lampa.Template.get('lampac_content_loading'));
      Lampa.Controller.enable('content');
      this.loading(false);
	  if(object.balanser){
        if(!(isEpisodeMedia(object.movie)?
            fiveSeriesProvider({balanser:object.balanser}):
            allowedSeriesProvider({balanser:object.balanser}))){
          _this.noConnectToServer(new Error('Источник недоступен'));
          return;
        }
		  files.render().find('.filter--search').remove();
		  sources = {};
		  sources[object.balanser] = {name: object.balanser};
		  balanser = object.balanser;
		  filter_sources = [];
		  
		  return network["native"](account(object.url.replace('rjson=','nojson=')), this.parse.bind(this), function(){
			  files.render().find('.torrent-filter').remove();
			  _this.empty();
		  }, false, {
            dataType: 'text',
			headers: {'X-Kit-AesGcm': Lampa.Storage.get('aesgcmkey', '')}
		  });
	  } 
      // External ID lookup runs alongside the catalog, not in front of it.
      // Lampa's own TMDB ID is already enough to begin provider discovery.
      this.externalids();
      this.createSource().then(function(){
        _this.search();
      })["catch"](function(error){
        _this.noConnectToServer(error);
      });
    };
    this.rch = function(json, noreset) {
      var _this2 = this;
	  rchRun(json, function() {
        if (!noreset) _this2.find();
        else noreset();
	  });
    };
    this.externalids = function(){
      return new Promise(function(resolve){
        reuseExternalIds(object.movie);
        if(object.movie.imdb_id&&object.movie.kinopoisk_id)
          return resolve();
        var query=[
          'id='+encodeURIComponent(object.movie.id),
          'serial='+(isEpisodeMedia(object.movie)?1:0)
        ];
        if(object.movie.imdb_id)query.push(
          'imdb_id='+encodeURIComponent(object.movie.imdb_id));
        if(object.movie.kinopoisk_id)query.push(
          'kinopoisk_id='+encodeURIComponent(object.movie.kinopoisk_id));
        var req=new Network(),finished=false;
        var timer=setTimeout(function(){finish();},1000);
        function finish(json){
          if(finished)return;
          finished=true;clearTimeout(timer);
          if(json&&typeof json==='object'){
            ['imdb_id','kinopoisk_id','tmdb_id'].forEach(function(key){
              if(json[key]&&!object.movie[key])object.movie[key]=json[key];
            });
          }
          rememberExternalIds(object.movie);
          resolve();
        }
        try{
          if(req.timeout)req.timeout(900);
          req.silent(account(Defined.localhost+'externalids?'+query.join('&')),
            finish,function(){finish();},false,{
              headers:{'X-Kit-AesGcm':Lampa.Storage.get('aesgcmkey','')}});
        }catch(error){finish();}
      });
    };
    // One source of truth: swap the selected URL and refresh the existing
    // screen. Activity.replace() destroyed the selected state and fell back
    // to the first balancer before each new playback request.
    this.changeBalanser = function(name) {
      var next=sources[name];
      if(!filmSourceEnabled({balanser:name,name:next&&next.name})){
        if(Lampa.Noty&&Lampa.Noty.show)
          Lampa.Noty.show('Балансер отключён: '+name);
        return false;
      }
      // An explicit user selection may try a source with a previously
      // negative availability flag, provided Skaz gave a usable URL.
      // Only automation is bound to show:true.
      if(!next||!filmValidUrl(next.url,true)){
        if(Lampa.Noty&&Lampa.Noty.show)
          Lampa.Noty.show('Источник сейчас недоступен: '+(next?next.name:name));
        // Filter.show marks the clicked item selected *before* onSelect.
        // Roll back its tentative selection to the actual active source.
        if(balanser&&sources[balanser])
          this.filter({source:filter_sources},this.getChoice());
        return false;
      }
      if(name===balanser){
        this.filter({source:filter_sources},this.getChoice());
        return true;
      }
      // Manual selection is local to the currently open screen.
      this.__csoActiveVariant='';
      balanser=name;
      source=next.url;
      Lampa.Storage.set('amedia_auto_active_balanser',name);
      // Invalidate in-flight callbacks and redraw only this source screen.
      ++requestRevision;
      requestPathCounts=Object.create(null);
      automaticVoiceVisited=Object.create(null);
      filter_find={season:[],voice:[]};
      this.replaceChoice({voice:0,voice_url:'',voice_name:'',voice_manual:false});
      this.reset();
      this.updateSeasonButton();
      this.search();
      return true;
    };
        this.requestParams = function(url) {
      var query = [];
      var card_source = object.movie.source || 'tmdb'; //Lampa.Storage.field('source')
      query.push('id=' + encodeURIComponent(object.movie.id));
      if (object.movie.imdb_id) query.push('imdb_id=' + (object.movie.imdb_id || ''));
      if (object.movie.kinopoisk_id) query.push('kinopoisk_id=' + (object.movie.kinopoisk_id || ''));
	  if (object.movie.tmdb_id) query.push('tmdb_id=' + (object.movie.tmdb_id || ''));
      query.push('title=' + encodeURIComponent(object.clarification ? object.search : object.movie.title || object.movie.name));
      query.push('original_title=' + encodeURIComponent(object.movie.original_title || object.movie.original_name));
      query.push('serial=' + (isEpisodeMedia(object.movie) ? 1 : 0));
      query.push('original_language=' + (object.movie.original_language || ''));
      query.push('year=' + ((object.movie.release_date || object.movie.first_air_date || '0000') + '').slice(0, 4));
      query.push('source=' + card_source);
      query.push('clarification=' + (object.clarification ? 1 : 0));
      query.push('similar=' + (object.similar ? true : false));
      query.push('rchtype=' + (((window.rch_nws && window.rch_nws[hostkey]) ? window.rch_nws[hostkey].type : (window.rch && window.rch[hostkey]) ? window.rch[hostkey].type : '') || ''));
      if (Lampa.Storage.get('account_email', '')) query.push('cub_id=' + Lampa.Utils.hash(Lampa.Storage.get('account_email', '')));
      return url + (url.indexOf('?') >= 0 ? '&' : '?') + query.join('&');
    };
    // Two-stage series selector: every provider root first, then every
    // voice menu. Bound time and concurrency, NEVER the number of sources
    // or translators considered. The visible source list remains complete.
    this.compareSeriesSources = function(ready,callback){
      var owner=this,keys=(ready||[]).filter(function(key){
        return !!(sources[key]&&fiveSeriesProvider({
          balanser:key,name:sources[key].name})&&
          filmValidUrl(sources[key].url,true));
      });
      keys.sort(function(a,b){
        return SERIES_CHECK_ORDER.indexOf(a)-SERIES_CHECK_ORDER.indexOf(b);
      });
      owner.__csoBestSeriesVoice=Object.create(null);
      owner.__csoSeriesSourceScores=Object.create(null);
      if(!keys.length||!isEpisodeMedia(object.movie)||
          !automaticSelectionEnabled()||object.lampac_custom_select)
        return callback(null);
      function seasonCount(row){
        var number=Number(row&&row.seasonCount)||0;
        return Math.max(0,Math.min(80,number));
      }
      var expected=Number(object.movie.number_of_seasons)||0;
      var diag={compared:keys.slice(),expectedSeasons:expected,
        started:Date.now(),providers:Object.create(null),deadlineHit:false,
        strategy:filmSearchMode()==='economy'?'catalog':'all-source-parallel'};
      window.__capsuleSeriesLastScan=diag;
      // Economy inspects all catalog entries without adding network hops.
      if(filmSearchMode()==='economy'||typeof document==='undefined'||
          typeof $!=='function'){
        var catalogScores=Object.create(null);
        keys.forEach(function(key){
          var advertised=seasonCount(sources[key]);
          catalogScores[key]=advertised*100000000;
          diag.providers[key]={voice:'каталог',seasons:0,
            estimatedSeasons:advertised,catalogSeasons:advertised,
            requests:0,stage:'catalog',score:catalogScores[key]};
        });
        owner.__csoSeriesSourceScores=catalogScores;
        diag.elapsed=Date.now()-diag.started;
        return callback(catalogScores);
      }
      var states=Object.create(null),queue=[],open=[],active=0,
          ended=false,score=Object.create(null),maxConcurrent=8,
          scanDeadline=Date.now()+3900,
          firstWave=keys.slice(0,3),secondWave=keys.slice(3),
          secondStarted=false;
      var timer=setTimeout(function(){
        diag.deadlineHit=true;finish();
      },3900);
      function norm(value){
        return String(value||'').toLowerCase().replace(/ё/g,'е')
          .replace(/\s+/g,' ').trim();
      }
      function voiceFrom(row){
        return String(row&&(
          row.voice_name||row.translate_voice||row.voice||
          row.translation||row.studio)||'').trim();
      }
      function seasonIds(rows){
        var unique=Object.create(null);
        (rows||[]).forEach(function(row){
          if(!row)return;
          var label=String(row.text||''),m=label.match(
            /(?:сезон|season|saison|сез\.)\s*[:№#.\- ]*\s*(\d{1,2})/i)||
            label.match(/^(\d{1,2})\s*(?:-?й\s*)?(?:сезон|season|сез\.)/i)||
            label.match(/^s(\d{1,2})(?:\b|e\d)/i);
          var n=Number(row.season_number||(m&&m[1])||0);
          if(!n&&(row.method==='play'||row.method==='call'))
            n=Number(row.season)||0;
          if(n>0&&n<=80)unique[n]=true;
          var data=row.seasons;
          if(Array.isArray(data)){
            data.forEach(function(item){
              var x=Number(item&&item.number||item&&item.season_number||item);
              if(x>0&&x<=80)unique[x]=true;
            });
          }else if(data&&typeof data==='object'){
            Object.keys(data).forEach(function(key){
              var x=Number(key);
              if(x>0&&x<=80)unique[x]=true;
            });
          }
        });
        return Object.keys(unique).map(Number).sort(function(x,y){return x-y;});
      }
      function isSeason(row){
        if(!row||row.method==='play'||row.method==='call')return false;
        var label=String(row.text||'');
        return /(?:сезон|season|saison|сез\.)\s*[:№#.\- ]*\s*\d{1,2}|^\d{1,2}\s*(?:-?й\s*)?(?:сезон|season|сез\.)|^s\d{1,2}(?:\b|e\d)/i.test(label)||
          !!row.season_number||!!row.season&&!filmVoiceIdentityKnown(label);
      }
      function nestedFilmix(row,st){
        if(st.key!=='filmix'||!row||isSeason(row)||
           !(row.__csoButton||row.method==='link'))return false;
        var label=norm(row.text);
        return /(?:^|[\s/:(-])(?:vibix|вибикс)(?:$|[\s/):-])/.test(label)||
          /^(?:filmix|филмикс)(?:\s|$)/.test(label);
      }
      function isVoice(row,st){
        return !!row&&!isSeason(row)&&!episodeRow(row)&&
          !nestedFilmix(row,st)&&
          (row.__csoButton||row.method==='link')&&
          filmVoiceIdentityKnown(row.text)&&!filmVoiceBlocked(row.text);
      }
      function episodeRow(row){
        if(!row||isSeason(row))return false;
        if(row.method==='play'||row.method==='call')return true;
        if(row.episode||row.episode_number||row.episodeNumber)return true;
        return /^(?:(?:серия|эпизод|episode|ep\.?)\s*[:№#.\- ]*\s*\d{1,3}|\d{1,3}\s*(?:-?я\s*)?(?:серия|эпизод|episode)|s\d{1,2}\s*e\d{1,3})/i.test(String(row.text||''));
      }
      function stateVoice(st,label,ctx){
        ctx=ctx||{};
        label=String(label||'').trim();
        var variant=ctx.variant||st.key,key=variant+'|'+norm(label);
        if(!st.voices[key])st.voices[key]={
          text:label||'Неизвестно',variant:variant,
          variantName:ctx.variantName||st.name,
          route:Array.isArray(ctx.route)?ctx.route.slice():[],
          rootUrl:ctx.rootUrl||st.primaryUrl,
          seasons:Object.create(null),samples:Object.create(null),
          playable:false,quality:0,episodeCount:0
        };
        return st.voices[key];
      }
      function record(st,label,numbers,kind,playable,ctx,episodeCount,quality){
        label=String(label||'').trim();
        if(filmVoiceBlocked(label)||filmLanguagePriority({text:label},label)<0)
          return;
        var v=stateVoice(st,label,ctx),
            target=kind==='sample'?v.samples:v.seasons;
        (numbers||[]).forEach(function(n){
          if(n>0&&n<=80)target[n]=true;
        });
        if(playable)v.playable=true;
        v.episodeCount=Math.max(v.episodeCount,Number(episodeCount)||0);
        v.quality=Math.max(v.quality,Number(quality)||0);
      }
      function parseRows(html,st){
        var result=[];
        if(typeof html!=='string'||!html||html.length>3*1024*1024)
          return result;
        try{
          var container=$('<div></div>');
          if($.parseHTML)container.append($.parseHTML(html,document,false));
          else container.html(html);
          container.find('.videos__button,.videos__item').each(function(){
            try{
              var el=$(this),raw=el.attr('data-json');
              if(!raw||raw.length>32768)return;
              var row=JSON.parse(raw);
              if(!row||typeof row!=='object'||Array.isArray(row))return;
              row.text=String(row.text||el.text()||'').trim();
              row.__csoButton=el.is('.videos__button');
              var season=Number(el.attr('s')||el.attr('data-season')||0);
              if(season>0&&season<=80)row.season=season;
              if(filmVoiceBlocked(row.voice_name||'')||
                 filmVoiceBlocked(row.translate_voice||'')||
                 (row.__csoButton&&filmVoiceBlocked(row.text)&&
                  !nestedFilmix(row,st))||
                 !filmPlaybackAllowed({balanser:st.key},row,
                   row.__csoButton?row.text:'')||
                 !filmValidUrl(row.url,true))return;
              result.push(row);
            }catch(error){}
          });
        }catch(error){}
        return result;
      }
      function enqueue(st,url,context,depth,front){
        url=filmSkazUrl(url);
        if(ended||depth>4||!filmValidUrl(url,false)||st.seen[url])
          return false;
        st.seen[url]=true;
        var item={st:st,url:url,ctx:context,depth:depth};
        if(front)queue.unshift(item);else queue.push(item);
        return true;
      }
      function examine(st,rows,ctx,depth){
        var variants=rows.filter(function(row){return nestedFilmix(row,st);}),
            voices=rows.filter(function(row){return isVoice(row,st);}),
            seasons=rows.filter(isSeason),coverage=seasonIds(seasons),
            variant=ctx.variant||st.key;
        if(coverage.length){
          if(ctx.voice)record(st,ctx.voice,coverage,'direct',false,ctx);
          else if(!st.variantRoots[variant]||
               coverage.length>st.variantRoots[variant].length)
            st.variantRoots[variant]=coverage;
        }
        if(ctx.season&&voices.length){
          var sampled=st.variantSamples[variant]||
            (st.variantSamples[variant]=[]);
          if(sampled.indexOf(ctx.season)<0)sampled.push(ctx.season);
          voices.forEach(function(row){
            record(st,row.text,[ctx.season],'sample',false,ctx);
          });
        }
        var playable=rows.filter(function(row){
          return row.method==='play'||row.method==='call';
        }),episodeEntries=rows.filter(episodeRow);
        playable.forEach(function(row){
          var label=ctx.voice||voiceFrom(row),n=seasonIds([row]);
          if(!n.length&&ctx.season)n=[ctx.season];
          var quality=filmEffectiveQuality(row,null);
          record(st,label,n,'direct',true,ctx,episodeEntries.length,
            Number(quality&&quality.height)||0);
        });
        // Episode links are a signal of coverage, not a reason to fetch
        // every signed episode. The selected player resolves only on demand.
        if(episodeEntries.length&&ctx.voice)
          record(st,ctx.voice,ctx.season?[ctx.season]:[],
            'direct',false,ctx,episodeEntries.length,0);
        if(depth>=4)return;
        // VIBIX is a nested Filmix route. Compare its studios independently,
        // but NEVER add VIBIX as a sixth top-level provider.
        variants.forEach(function(row){
          var label=/vibix|вибикс/i.test(row.text)?'Vibix':'Filmix';
          enqueue(st,row.url,{
            variant:variant+'/'+norm(label),variantName:label,
            route:(ctx.route||[]).concat([{
              text:row.text,url:filmSkazUrl(row.url)}]),
            rootUrl:ctx.rootUrl||st.primaryUrl,voice:'',season:0
          },depth+1,false);
        });
        voices.forEach(function(row){
          enqueue(st,row.url,{
            variant:variant,variantName:ctx.variantName,
            route:ctx.route||[],rootUrl:ctx.rootUrl,
            voice:row.text,season:ctx.season||0
          },depth+1,false);
        });
        if(seasons.length){
          var positions;
          if(ctx.voice){
            // Only ONE representative season menu per voice is needed for
            // episode-count evidence; never request each episode URL.
            positions=[seasons.length-1];
          }else{
            // Season-first catalogs: sample start/middle/end to infer
            // which translation covers the show without a full crawl.
            positions=seasons.length>3?
              [0,Math.floor((seasons.length-1)/2),seasons.length-1]:
              seasons.map(function(_row,i){return i;});
          }
          positions.forEach(function(i){
            var row=seasons[i],n=seasonIds([row])[0]||0;
            if(n>0)enqueue(st,row.url,{
              variant:variant,variantName:ctx.variantName,
              route:ctx.route||[],rootUrl:ctx.rootUrl,
              voice:ctx.voice||'',season:n
            },depth+1,false);
          });
        }
        if(variants.length||voices.length||seasons.length)return;
        if(!playable.length&&!episodeEntries.length)
          rows.forEach(function(row){
            if(row.method==='link'&&!isVoice(row,st)&&
               !nestedFilmix(row,st)&&!isSeason(row)&&!episodeRow(row))
              enqueue(st,row.url,ctx,depth+1,false);
          });
      }
      function grade(st,v){
        var merged=Object.assign(Object.create(null),v.seasons,v.samples),
            verified=Object.keys(merged).length,
            observed=Object.keys(v.samples).length,
            estimated=Object.keys(v.seasons).length,
            roots=st.variantRoots[v.variant]||[],
            sampleCount=(st.variantSamples[v.variant]||[]).length;
        if(roots.length>1&&sampleCount>0&&observed>0)
          estimated=Math.max(estimated,roots.length*
            (observed/sampleCount)*(observed>=2?0.84:0.30));
        if(!verified&&st.catalogSeasons&&v.variant===st.key)
          estimated=Math.max(estimated,st.catalogSeasons*0.20);
        if(!filmVoiceIdentityKnown(v.text))estimated*=0.35;
        var lang=filmLanguagePriority({text:v.text},v.text);
        if(lang<0||filmVoiceBlocked(v.text))return null;
        var quality=v.quality>=2160?4:v.quality>=1080?3:
          v.quality>=720?2:v.quality>0?1:0;
        // Whole-show coverage first, then language, stream quality and studio.
        return {value:estimated*100000000+
          Math.min(100,v.episodeCount)*100000+
          lang*10000+quality*1000+
          Math.max(0,filmVoiceRank(v.text))*10+(v.playable?5:0),
          verified:verified,estimate:estimated};
      }
      function finish(){
        if(ended)return;
        ended=true;clearTimeout(timer);
        open.forEach(function(req){try{req.clear();}catch(ignore){}});
        keys.forEach(function(key){
          var st=states[key],winner=null,best=null;
          Object.keys(st.voices).forEach(function(label){
            var v=st.voices[label],g=grade(st,v);
            if(g&&(!best||g.value>best.value)){winner=v;best=g;}
          });
          var roots=Object.keys(st.variantRoots).reduce(function(count,k){
            return Math.max(count,(st.variantRoots[k]||[]).length);
          },0);
          var weak=Math.max(st.catalogSeasons*(st.show?0.22:0.1),
            roots*0.28)*100000000;
          var rating=Math.max(weak,best?best.value:0);
          score[key]=rating;
          if(winner)owner.__csoBestSeriesVoice[key]={
            text:winner.text,variant:winner.variant,
            variantName:winner.variantName,route:winner.route.slice(),
            rootUrl:winner.rootUrl,
            seasons:best.verified,
            estimatedSeasons:Math.round(best.estimate),
            coverageKnown:best.verified>0
          };
          diag.providers[key]={name:st.name,
            voice:winner?winner.text:'',variant:winner?winner.variantName:'',
            seasons:best?best.verified:0,
            estimatedSeasons:best?Math.round(best.estimate):0,
            catalogSeasons:st.catalogSeasons,
            rootSeasons:winner?
              (st.variantRoots[winner.variant]||[]).length:0,
            samples:winner?
              (st.variantSamples[winner.variant]||[]).length:0,
            sampleEpisodes:winner?winner.episodeCount:0,
            requests:st.requests,voiceVariants:Object.keys(st.voices).length,
            stage:st.rootLoaded?'inspected':'catalog',score:Math.round(rating)};
        });
        owner.__csoSeriesSourceScores=score;
        diag.elapsed=Date.now()-diag.started;
        diag.unprocessed=queue.length;
        callback(score);
      }
      function runTask(task){
        var st=task.st,req=new Network(),closed=false;
        active++;st.requests++;
        open.push(req);
        var timeout=setTimeout(function(){completed('');},1400);
        if(req.timeout)req.timeout(1250);
        function completed(html){
          if(closed)return;
          closed=true;clearTimeout(timeout);active--;
          if(ended)return;
          if(task.depth===0)st.rootLoaded=true;
          examine(st,parseRows(html,st),task.ctx,task.depth);
          // Pump on a fresh turn: synchronous callbacks and cached network
          // responses must not recurse through hundreds of directories.
          if(!pumpQueued){
            pumpQueued=true;
            setTimeout(function(){pumpQueued=false;pump();},0);
          }
        }
        try{
          var url=task.depth===0?owner.requestParams(task.url):task.url,
              signed=/(?:[?&](?:sig|signature|token|hash|hmac|exp|expires)=)/i.test(url);
          req.native(signed?url:account(url),completed,
            function(){completed('');},false,{dataType:'text',
              headers:{'X-Kit-AesGcm':Lampa.Storage.get('aesgcmkey','')}});
        }catch(error){completed('');}
      }
      var pumpQueued=false;
      function nextTask(){
        var index=0,best=Infinity;
        for(var i=0;i<queue.length;i++){
          var item=queue[i],
              cost=item.depth===0?-100000:item.st.probesStarted*10+item.depth;
          if(cost<best){best=cost;index=i;}
        }
        return queue.splice(index,1)[0];
      }
      function queueRoot(st){
        var row=sources[st.key],key=st.key;
        enqueue(st,row.url,{variant:key,variantName:st.name,
          rootUrl:row.url,route:[],voice:'',season:0},0,false);
        (Array.isArray(row.aliases)?row.aliases:[]).forEach(function(alias,i){
          if(alias&&alias.url&&alias.url!==row.url)
            enqueue(st,alias.url,{
              variant:key+'/alias'+i,variantName:alias.name||st.name,
              rootUrl:alias.url,route:[],voice:'',season:0
            },0,false);
        });
      }
      function firstWaveExcellent(){
        if(!expected)return false;
        var best=null,bestScore=-Infinity,bestGrade=null;
        firstWave.forEach(function(key){
          var st=states[key];
          Object.keys(st.voices).forEach(function(id){
            var voice=st.voices[id],rating=grade(st,voice);
            if(rating&&rating.value>bestScore){
              best=voice;bestScore=rating.value;bestGrade=rating;
            }
          });
        });
        // Only a verified complete professional dub warrants early exit.
        // A complete 2x2 / TVShows candidate should allow searching later
        // options for a better translation.
        return !!(bestGrade&&bestGrade.verified>=expected&&best&&
          filmVoiceRank(best.text)>=7);
      }
      function pump(){
        if(ended)return;
        while(active<maxConcurrent&&queue.length&&Date.now()<scanDeadline){
          var task=nextTask();
          if(task.depth>0)task.st.probesStarted++;
          runTask(task);
        }
        if(active===0&&queue.length===0){
          if(!secondStarted&&secondWave.length&&!firstWaveExcellent()){
            secondStarted=true;
            secondWave.forEach(function(key){queueRoot(states[key]);});
            if(queue.length)pump();
            else finish();
          }else{
            diag.firstThreeSufficient=!secondStarted;
            finish();
          }
        }
      }
      keys.forEach(function(key){
        var row=sources[key];
        states[key]={key:key,name:row.name||key,show:row.show!==false,
          primaryUrl:row.url,catalogSeasons:seasonCount(row),
          variantRoots:Object.create(null),variantSamples:Object.create(null),
          rootLoaded:false,voices:Object.create(null),requests:0,
          probesStarted:0,seen:Object.create(null)};
      });
      firstWave.forEach(function(key){queueRoot(states[key]);});
      pump();
    };
    this.currentSourceRows = function(){
      return Object.keys(sourceCatalog).map(function(key){
        var value=sourceCatalog[key]||{};
        return {balanser:key,name:value.name||key,url:value.url||'',
          show:!!value.show,season_count:value.seasonCount||0};
      });
    };
    this.startSource = function(json) {
      var owner=this;
      return new Promise(function(resolve,reject){
        var rows=Array.isArray(json)?json:json&&Array.isArray(json.online)?json.online:[],
            arrival=mergeCatalogRows(rows);
        // lifeevents may return a partial provider list. A missing row
        // MUST NOT hide Alloha (or seasons) discovered in lite/events.
        Object.keys(sourceCatalog).forEach(function(key){
          var row={balanser:key,name:sourceCatalog[key]&&sourceCatalog[key].name};
          if(!(isEpisodeMedia(object.movie)?
              fiveSeriesProvider(row):allowedSeriesProvider(row)))
            delete sourceCatalog[key];
        });
        if(isEpisodeMedia(object.movie))completeSerialCatalog();
        sources=sourceCatalog;
        filter_sources=Object.keys(sources);
        // Candidate set MUST be the union of initial lite/events and
        // incremental lifeevents, not merely the most recent event batch.
        var ready=Object.keys(sources).filter(function(key){
          return !!(sources[key]&&filmSourceEnabled({balanser:key,
              name:sources[key].name})&&
              filmValidUrl(sources[key].url,true));
        });
        ready.sort(function(a,b){
          var x=arrival.indexOf(a),y=arrival.indexOf(b);
          return (x<0?999+x:x)-(y<0?999+y:y);
        });
        if(isEpisodeMedia(object.movie)&&automaticSelectionEnabled()){
          // Number of seasons is not language/quality evidence. Inspect the
          // voice and stream menus before selecting in Normal mode.
          ready.sort(function(a,b){
            return arrival.indexOf(a)-arrival.indexOf(b)||a.localeCompare(b);
          });
        }
        if(!isEpisodeMedia(object.movie)&&automaticSelectionEnabled()){
          ready.sort(function(a,b){
            return filmSourceScore(sources[b])-filmSourceScore(sources[a])||
              arrival.indexOf(a)-arrival.indexOf(b);
          });
          filter_sources=ready.concat(filter_sources.filter(function(k){
            return ready.indexOf(k)===-1;
          }));
        }
        if(!ready.length){
          filter.set('sort',filter_sources.map(function(key){
            return {title:sources[key].name,source:key,selected:false,
                ghost:!filmValidUrl(sources[key].url,true)};
          }));
          return reject(new Error(isEpisodeMedia(object.movie) ? 'Нет доступных источников сериала' : 'Нет подходящих источников фильма в Skaz'));
        }
        // Only the current explicit source request can pin a provider.
        var pin=object.lampac_custom_select;
        function choose(preflight){
          if(window.__capsuleSeriesLastScan){
            window.__capsuleSeriesLastScan.finalCandidates=ready.slice();
            window.__capsuleSeriesLastScan.preflightUsed=!!preflight;
            window.__capsuleSeriesLastScan.discovered=Object.keys(sources).length;
            window.__capsuleSeriesLastScan.eligible=ready.length;
          }
          if(preflight&&!pin){
            // Preserve allowed uninspected alternatives; discard providers
            // PROVEN to offer only forbidden translations before choosing.
            ready=ready.filter(function(key){return preflight[key]!==-100000;});
            ready.sort(function(a,b){
              var aa=Object.prototype.hasOwnProperty.call(preflight,a)?preflight[a]:0;
              var bb=Object.prototype.hasOwnProperty.call(preflight,b)?preflight[b]:0;
              // Translation coverage wins. Never restore Filmix priority
              // merely because one response could not be inspected.
              return bb-aa||a.localeCompare(b);
            });
          }
          // Keep a deduplicated list: a rejected-only provider must not
          // re-enter the visible source choices through legacy UI filters.
          // The menu must expose every discovered provider, including a
          // temporarily unavailable row with no URL. Only AUTO playback
          // requires a valid URL. Preserve source order and grey entries.
          filter_sources=ready.concat(Object.keys(sources).filter(function(k){
            return ready.indexOf(k)<0;
          }));
          if(!ready.length)return reject(
            new Error('Нет доступных версий с разрешённой озвучкой'));
          balanser=pin&&sources[pin]&&filmSourceEnabled({
              balanser:pin,name:sources[pin].name})&&
              filmValidUrl(sources[pin].url,true)?pin:ready[0];
          source=sources[balanser].url;
          owner.__csoActiveVariant='';
          var preferredRoot=owner.__csoBestSeriesVoice&&
            owner.__csoBestSeriesVoice[balanser];
          if(!pin&&preferredRoot&&filmValidUrl(preferredRoot.rootUrl,true)){
            source=preferredRoot.rootUrl;
            if(balanser==='filmix'&&preferredRoot.variantName==='Vibix'&&
               (!preferredRoot.route||!preferredRoot.route.length))
              owner.__csoActiveVariant='Vibix';
          }
          Lampa.Storage.set('amedia_auto_active_balanser',balanser);
          if(window.__capsuleSeriesLastScan)
            window.__capsuleSeriesLastScan.selected=balanser;
          resolve(rows);
        }
        owner.compareSeriesSources(ready,choose);
      });
    };
            // Gated, bounded life-events check: no 15-second polling and no probing
    // every balancer. Accept first advertised available catalog response.
    // Fetch the companion catalog exactly once for each screen.
    // It is complementary, not a fallback restricted to five sources.
    // The UI waits briefly for the second catalog, without throwing away
    // a later answer. Late entries refresh source options, not the tiles.
    this.lifeSource = function(){
      var owner=this;
      return new Promise(function(resolve){
        if(!owner.memkey)return resolve([]);
        var req=new Network(),returned=false,settled=false;
        var timer=setTimeout(function(){
          if(settled)return;
          returned=true;resolve([]);
        },1350);
        function finish(rows){
          if(settled)return;
          settled=true;clearTimeout(timer);
          rows=Array.isArray(rows)?rows:[];
          if(returned){
            if(rows.length)owner.acceptLateSourceRows(rows);
          }else{
            returned=true;resolve(rows);
          }
        }
        try{
          if(req.timeout)req.timeout(3600);
          var url=owner.requestParams(Defined.localhost+
            'lifeevents?memkey='+(owner.memkey||''));
          req.silent(account(url),function(json){
            finish(json&&json.online);
          },function(){finish([]);},false,{headers:{
            'X-Kit-AesGcm':Lampa.Storage.get('aesgcmkey','')}});
        }catch(error){finish([]);}
      });
    };
    this.acceptLateSourceRows = function(rows){
      if(this.__csoDead)return;
      var oldOrder=Object.keys(sourceCatalog),
          late=mergeCatalogRows(rows);
      if(!late.length)return;
      sources=sourceCatalog;
      var additions=Object.keys(sources).filter(function(key){
        return filmSourceEnabled({balanser:key,name:sources[key].name})&&
          filter_sources.indexOf(key)<0;
      });
      filter_sources=filter_sources.concat(additions);
      if(window.__capsuleSeriesLastScan){
        window.__capsuleSeriesLastScan.discovered=Object.keys(sources).length;
        window.__capsuleSeriesLastScan.lateCatalogAdded=additions.slice();
      }
      // Only update source filter options. Never recreate the episode cards
      // or silently change the chosen balancer after first paint.
      if(!balanser||!filter||typeof filter.set!=='function')return;
      try{
        filter.set('sort',filter_sources.map(function(key){
          var entry=sources[key]||{};
          return {title:String(entry.name||key)+
            (entry.show?'':' · недоступен'),source:key,
            selected:key===balanser,ghost:!filmValidUrl(entry.url,true),
            recommended:key===balanser};
        }));
      }catch(ignore){}
    };
    this.createSource = function(){
      var owner=this;
      return new Promise(function(resolve,reject){
        var req=new Network(),settled=false;
        var timer=setTimeout(function(){
          if(settled)return;
          settled=true;
          try{req.clear();}catch(ignore){}
          reject(new Error('Каталог Skaz не ответил'));
        },3100);
        function fail(error){
          if(settled)return;
          settled=true;clearTimeout(timer);
          reject(error||new Error('Каталог Skaz недоступен'));
        }
        function receive(json){
          if(settled)return;
          settled=true;clearTimeout(timer);
          if(!json||typeof json!=='object')
            return reject(new Error('Пустой каталог Skaz'));
          if(json.accsdb)return reject(json);
          var initial=Array.isArray(json.online)?json.online:[];
          owner.memkey=json.memkey||'';
          // Never infer that exactly five advertised providers is complete.
          // Keep the full union of lite/events and lifeevents, including
          // late Vibix and sources with temporarily empty URLs.
          var present=Object.create(null);
          if(isEpisodeMedia(object.movie)){
            initial.forEach(function(row){
              if(fiveSeriesProvider(row)&&filmValidUrl(row.url,true))
                present[seriesFamily(row)]=true;
            });
          }
          // All FIVE original TV families are already available: no reason
          // to poll the complementary catalog. If one is missing, make one
          // short supplementary request rather than dropping that provider.
          var tvComplete=isEpisodeMedia(object.movie)&&
            FIVE_SERIES_FAMILIES.every(function(key){return present[key];});
          var supplement=!tvComplete&&(json.life||owner.memkey)?
            owner.lifeSource():Promise.resolve([]);
          supplement.then(function(extra){
            return owner.startSource(initial.concat(extra||[]));
          }).then(resolve,reject);
        }
        try{
          if(req.timeout)req.timeout(2900);
          req.silent(account(owner.requestParams(
            Defined.localhost+'lite/events?life=true')),receive,fail,false,{
            headers:{'X-Kit-AesGcm':Lampa.Storage.get('aesgcmkey','')}});
        }catch(error){fail(error);}
      });
    };
    this.create = function() {
      return this.render();
    };
    /**
     * Начать поиск
     */
    this.search = function() { //this.loading(true)
      this.filter({
        source: filter_sources
      }, this.getChoice());
      this.find();
    };
    this.find = function(){
      requestPathCounts=Object.create(null);
      this.request(this.requestParams(source));
    };
    this.request = function(url){
      activeContentUrl=String(url||'');
      var self=this,revision=++requestRevision,selected=balanser,
          path=String(url||'');
      requestPathCounts[path]=(requestPathCounts[path]||0)+1;
      if(requestPathCounts[path]>2){
        this.doesNotAnswer(new Error('Источник вернул циклическое меню'));
        return;
      }
      var elapsed=false,
          limit=filmSearchMode()==='economy'?3100:4300;
      // Lampa.Reguest timeout is transport-dependent. A real wall-clock
      // deadline prevents 20s+ spinners when a provider never calls back.
      var watchdog=setTimeout(function(){
        if(elapsed)return;
        elapsed=true;
        if(revision!==requestRevision||selected!==balanser)return;
        try{network.clear();}catch(ignore){}
        self.doesNotAnswer(new Error('Истёк срок ожидания каталога серий'));
      },limit);
      if(network.timeout)network.timeout(limit);
      try{
        network.native(account(url),function(html){
          if(elapsed)return;
          elapsed=true;clearTimeout(watchdog);
          if(revision===requestRevision&&selected===balanser)
            self.parse(html);
        },function(error){
          if(elapsed)return;
          elapsed=true;clearTimeout(watchdog);
          if(revision===requestRevision&&selected===balanser)
            self.doesNotAnswer(error);
        },false,{dataType:'text',headers:{
          'X-Kit-AesGcm':Lampa.Storage.get('aesgcmkey','')}});
      }catch(error){
        if(elapsed)return;
        elapsed=true;clearTimeout(watchdog);
        if(revision===requestRevision&&selected===balanser)
          self.doesNotAnswer(error);
      }
    };
    // A single malformed data-json record must not hide every other episode.
    // One parse per response. Previous UI parsed and traversed the same HTML
    // twice (episodes and voice buttons), blocking lower-end TV WebViews.
    this.parseProviderRows = function(str){
      var result={items:[],buttons:[]};
      if(typeof str!=='string'||!str||str.length>4*1024*1024)return result;
      try{
        var root=$('<div></div>');
        if($.parseHTML&&typeof document!=='undefined')
          root.append($.parseHTML(str,document,false));
        else root.html(str);
        root.find('.videos__button,.videos__item').each(function(){
          try{
            var item=$(this),raw=item.attr('data-json');
            if(!raw||raw.length>32768)return;
            var data=JSON.parse(raw);
            if(!data||typeof data!=='object'||Array.isArray(data))return;
            var button=item.is('.videos__button');
            var season=item.attr('s'),episode=item.attr('e'),title=item.text();
            if(!button&&(filmVoiceTitleBlocked(title)||
                filmVoiceFieldsBlocked(data)))return;
            if(!isEpisodeMedia(object.movie)&&!button){
              if(/\d+p/i.test(title)){
                if(!data.quality||typeof data.quality!=='object'){
                  data.quality={};data.quality[title]=data.url;
                }
                title=object.movie.title;
              }
              if(title==='По умолчанию')title=object.movie.title;
            }
            if(episode&&isFinite(Number(episode)))
              data.episode=parseInt(episode,10);
            if(season&&isFinite(Number(season)))
              data.season=parseInt(season,10);
            if(title)data.text=title;
            data.active=item.hasClass('active')||item.hasClass('selected')||
              item.hasClass('videos__button--active')||
              item.attr('aria-selected')==='true'||
              item.attr('data-active')==='true'||
              data.active===true||data.active==='true'||data.active===1||
              data.selected===true||data.selected==='true'||data.selected===1;
            (button?result.buttons:result.items).push(data);
          }catch(error){/* reject this row only */}
        });
      }catch(error){/* bad response does not crash the component */}
      return result;
    };
    this.getFileUrl = function(file, call, waiting_rch) {
	  var _this = this;
      if(!file||!file.url){if(typeof call==='function')call(false,{});return;}
      var selectedProvider={balanser:balanser,name:sources[balanser]&&sources[balanser].name};
      var chosenVoice=this.getChoice(balanser).voice_name||'';
      if(!filmPlaybackAllowed(selectedProvider,file,chosenVoice)){
        if(Lampa.Noty&&Lampa.Noty.show)
          Lampa.Noty.show('Источник или озвучка отключены настройками Capsule Online');
        if(typeof call==='function')call(false,{});
        return;
      }
      if(isEpisodeMedia(object.movie)){
        var preferred=this.getChoice(),voice=String(file.voice_name||
            file.translate_voice||(preferred&&preferred.voice_name)||file.text||'');
        if(!languageAccepted(file,voice)){
          if(Lampa.Noty&&Lampa.Noty.show)
            Lampa.Noty.show('Язык выбранного видео не соответствует настройке. Выберите другую озвучку.');
          if(typeof call==='function')call(false,{});
          return;
        }
      }
	  
      if(Lampa.Storage.field('player') !== 'inner' && file.stream && Lampa.Platform.is('apple')){
		  var newfile = Lampa.Arrays.clone(file);
		  newfile.method = 'play';
		  newfile.url = file.stream;
		  call(newfile, {});
	  }
      else if (file.method == 'play') {
        if(!filmPlaybackAllowed(selectedProvider,file,chosenVoice,file,true))
          return call(false,{});
        call(file, {});
      }
      else {
        Lampa.Loading.start(function() {
          Lampa.Loading.stop();
          Lampa.Controller.toggle('content');
          network.clear();
        });
        // Link signing can take longer than the incremental catalog check.
        if(network.timeout)network.timeout(filmSearchMode()==='economy'?6500:14500);
        var signed=/(?:[?&](?:sig|signature|token|hash|hmac|expires|exp|auth)=)/i
          .test(String(file.url||''));
        network["native"](signed?file.url:account(file.url), function(json) {
            if(!json||typeof json!=='object'){
              Lampa.Loading.stop();
              return call(false,{});
            }
			if(json.rch){
				if(waiting_rch) {
					waiting_rch = false;
					Lampa.Loading.stop();
					call(false, {});
				}
				else {
					_this.rch(json,function(){
						Lampa.Loading.stop();
						
						_this.getFileUrl(file, call, true);
					});
				}
			}
			else{
				Lampa.Loading.stop();
                if(!filmPlaybackAllowed(selectedProvider,file,chosenVoice,json,true)){
                  if(Lampa.Noty&&Lampa.Noty.show)
                    Lampa.Noty.show('Источник не подтвердил разрешённую озвучку');
                  return call(false,{});
                }
				call(json, json);
			}
        }, function() {
          Lampa.Loading.stop();
          call(false, {});
        }, false, {
			headers: {'X-Kit-AesGcm': Lampa.Storage.get('aesgcmkey', '')}
            });
      }
    };
    this.toPlayElement = function(file) {
      var play = {
        title: file.title,
        card: object.movie,
        url: file.url,
        quality: file.qualitys,
        timeline: file.timeline,
        subtitles: file.subtitles,
		segments: file.segments,
        callback: file.mark,
		season: file.season,
		episode: file.episode,
		voice_name: file.voice_name,
		thumbnail: file.thumbnail
      };
      return play;
    };
    this.orUrlReserve = function(data) {
      if (data.url && typeof data.url == 'string' && data.url.indexOf(" or ") !== -1) {
        var urls = data.url.split(" or ");
        data.url = urls[0];
        data.url_reserve = urls[1];
      }
    };
    this.setDefaultQuality = function(data) {
      var map=data&&data.quality;
      var minimum=filmMinimumQuality();
      if(!map||typeof map!=='object'||Array.isArray(map)){
        return !minimum||filmQualityHeight(data&&(
          data.quality_label||data.__capsuleQuality||data.text||''))>=minimum;
      }
      if(minimum){
        var best=filmQualityChoice(map);
        if(!best)return false;
        data.url=best.url;data.__capsuleQuality=best.label;
        data.quality=filmOrderedQuality(map);
        this.orUrlReserve(data);
        return true;
      }
      var target=Number(Lampa.Storage.field('video_quality_default'))||0;
      Object.keys(map).forEach(function(label){
        var url=map[label];
        if(typeof url!=='string')return;
        if(parseInt(label,10)===target){
          data.url=url;this.orUrlReserve(data);
        }
        if(url.indexOf(' or ')!==-1)map[label]=url.split(' or ')[0];
      },this);
      return true;
    };
    // Android.openPlayer serializes only playlist items with STRING URLs.
    // Alloha often provides method:'call' with no direct stream per episode.
    // Resolve those signed calls before opening a native/external player.
    this.prepareExternalPlaylist = function(playlist,done){
      var owner=this,needs=playlist.filter(function(cell){
        return cell&&cell.__capsuleEpisode&&!filmValidUrl(cell.url,false);
      });
      if(!needs.length)return done(playlist);
      var sourceBefore=balanser,revisionBefore=requestRevision;
      var next=0,active=0,finished=0,closed=false;
      var timer=setTimeout(finish,30000);
      function finish(){
        if(closed)return;
        closed=true;clearTimeout(timer);
        if(sourceBefore!==balanser||revisionBefore!==requestRevision)return;
        var available=playlist.filter(function(cell){
          return cell&&filmValidUrl(cell.url,false);
        });
        if(available.length!==playlist.length&&Lampa.Noty&&Lampa.Noty.show)
          Lampa.Noty.show('Плейлист: '+available.length+' из '+playlist.length+
            ' серий. Не все ссылки доступны.');
        done(available);
      }
      function pump(){
        if(closed)return;
        while(active<5&&next<needs.length){
          (function(cell){
            active++;
            owner.getFileUrl(cell.__capsuleEpisode,function(stream,response){
              active--;finished++;
              if(closed)return;
              if(stream&&filmValidUrl(stream.url,false)){
                response=response||{};
                cell.url=stream.url.split(' or ')[0];
                cell.headers=response.headers||stream.headers;
                cell.quality=response.quality||stream.quality||
                  cell.__capsuleEpisode.qualitys;
                cell.subtitles=stream.subtitles||cell.subtitles;
                cell.segments=response.segments||stream.segments;
                owner.orUrlReserve(cell);
                if(owner.setDefaultQuality(cell)===false)cell.url='';
              }else cell.url='';
              if(finished===needs.length)return finish();
              pump();
            },true);
          })(needs[next++]);
        }
        if(finished===needs.length)finish();
      }
      pump();
    };
    this.display = function(videos) {
      var _this5 = this;
      var sourceNow={balanser:balanser,name:sources[balanser]&&sources[balanser].name};
      var chosenVoice=this.getChoice(balanser).voice_name||'';
      videos=(videos||[]).filter(function(file){
        return filmPlaybackAllowed(sourceNow,file,chosenVoice,file,
          file.method==='play');
      });
      if(!videos.length){
        this.doesNotAnswer(new Error('Нет видео с разрешённой озвучкой'));
        return;
      }
      this.draw(videos, {
        onEnter: function onEnter(item, html) {
          var chosenPlayer=requestedPlayer;
          requestedPlayer='';
          _this5.getFileUrl(item, function(json, json_call) {
            if (json && json.url) {
              var playlist = [];
              var mode=String(chosenPlayer||Lampa.Storage.field('player')||'inner');
              var externalPlaylist=mode!=='inner'&&mode!=='lampa';
              var first = _this5.toPlayElement(item);
              first.url = json.url;
              first.headers = json_call.headers || json.headers;
              first.quality = json_call.quality || item.qualitys;
			  first.segments = json_call.segments || item.segments;
              first.hls_manifest_timeout = json_call.hls_manifest_timeout || json.hls_manifest_timeout;
              first.subtitles = json.subtitles;
			  first.subtitles_call = json_call.subtitles_call || json.subtitles_call;
			  if (json.vast && json.vast.url) {
                first.vast_url = json.vast.url;
                first.vast_msg = json.vast.msg;
                first.vast_region = json.vast.region;
                first.vast_platform = json.vast.platform;
                first.vast_screen = json.vast.screen;
			  }
              _this5.orUrlReserve(first);
              if(_this5.setDefaultQuality(first)===false){
                Lampa.Noty.show('Skaz: нет видео не ниже '+filmMinimumQuality()+'p');
                return;
              }
              if (item.season) {
                videos.forEach(function(elem) {
                  var cell = _this5.toPlayElement(elem);
                  if (elem == item) {
                    // This episode was just resolved and quality-verified.
                    // Never re-check its stale 720p preview map.
                    cell.url=first.url;
                    cell.quality=first.quality;
                    cell.__capsuleQuality=first.__capsuleQuality;
                    cell.headers=first.headers;
                  } else {
                    if (elem.method == 'call') {
                      if (externalPlaylist) {
                        cell.__capsuleEpisode=elem;
                        cell.url=filmValidUrl(elem.stream,false)?elem.stream:'';
                        if(!cell.url)delete cell.quality;
                      } else {
                        cell.url = function(call) {
                          _this5.getFileUrl(elem, function(stream, stream_json) {
                            stream_json=stream_json||{};
                            if (stream && stream.url) {
                              cell.url = stream.url;
                              cell.quality = stream_json.quality || elem.qualitys;
							  cell.segments = stream_json.segments || elem.segments;
                              cell.subtitles = stream.subtitles;
                              _this5.orUrlReserve(cell);
                              if(_this5.setDefaultQuality(cell)===false){
                                cell.url='';
                                Lampa.Noty.show('Skaz: серия недоступна от '+filmMinimumQuality()+'p');
                              }else elem.mark();
                            } else {
                              cell.url = '';
                              Lampa.Noty.show(Lampa.Lang.translate('lampac_nolink'));
                            }
                            call();
                          }, function() {
                            cell.url = '';
                            call();
                          });
                        };
                      }
                    } else {
                      cell.url = elem.url;
                    }
                  }
                  _this5.orUrlReserve(cell);
                  // A deferred inner-player resolver does not know quality yet.
                  // Keep it callable; its signed response is validated above.
                  if(elem!==item&&typeof cell.url!=='function'&&
                      !(externalPlaylist&&cell.__capsuleEpisode)&&
                      _this5.setDefaultQuality(cell)===false)cell.url='';
                  playlist.push(cell);
                }); //Lampa.Player.playlist(playlist) 
              } else {
                playlist.push(first);
              }
              function launch(ready){
                if(!ready||!ready.length)return;
                ready.forEach(function(cell){delete cell.__capsuleEpisode;});
                if(ready.length>1)first.playlist=ready;
                if(!first.url){
                  Lampa.Noty.show(Lampa.Lang.translate('lampac_nolink'));
                  return;
                }
                first.iptv=true;
                first.isonline=true;
                Lampa.Player.play(first);
                Lampa.Player.playlist(ready);
                if(first.subtitles_call)_this5.loadSubtitles(first.subtitles_call);
                item.mark();
              }
              if(item.season&&externalPlaylist)
                _this5.prepareExternalPlaylist(playlist,launch);
              else launch(playlist);
            } else Lampa.Noty.show(Lampa.Lang.translate('lampac_nolink'));
          }, true);
        },
        onContextMenu: function onContextMenu(item, html, data, call) {
          _this5.getFileUrl(item, function(stream) {
            call({
              file:stream&&stream.url||'',
              quality:item.qualitys||{}
            });
          }, true);
        }
      });
      this.filter({
        season: filter_find.season.map(function(s) {
          return s.title;
        }),
        voice: filter_find.voice.map(function(b) {
          return b.title;
        })
      }, this.getChoice());
    };
	this.loadSubtitles = function(link){
		network.silent(account(link), function(subs){
			Lampa.Player.subtitles(subs)
		}, function() {},false, {
			headers: {'X-Kit-AesGcm': Lampa.Storage.get('aesgcmkey', '')}
		  })
	}
    this.parse = function(str) {
      var json = Lampa.Arrays.decodeJson(str, {});
      if (Lampa.Arrays.isObject(str) && str.rch) json = str;
      if(!json||typeof json!=='object')json={};
      if (json.rch) return this.rch(json);
      try {
        var selectedProvider={balanser:balanser,name:sources[balanser]&&sources[balanser].name};
        if(!filmSourceEnabled(selectedProvider)){
          this.doesNotAnswer(new Error('Этот балансер отключён в настройках'));
          return;
        }
        var parsed=this.parseProviderRows(str);
        var items=parsed.items,rawButtons=parsed.buttons;
        // Source ranking and playback MUST agree. If the best Filmix
        // rendition lives under its VIBIX branch, enter that exact nested
        // route before choosing a translation. A bare voice-name ranking
        // previously chose Filmix but opened its inferior default branch.
        var bestRoute=this.__csoBestSeriesVoice&&
          this.__csoBestSeriesVoice[balanser];
        if(isEpisodeMedia(object.movie)&&automaticSelectionEnabled()&&
           filmSearchMode()==='normal'&&bestRoute&&
           Array.isArray(bestRoute.route)&&bestRoute.route.length&&
           !this.getChoice(balanser).voice_manual){
          var rowOptions=rawButtons.concat(items);
          for(var routeIndex=0;routeIndex<bestRoute.route.length;routeIndex++){
            var step=bestRoute.route[routeIndex],next=rowOptions.find(function(row){
              return row&&filmSkazUrl(row.url)===filmSkazUrl(step.url);
            });
            var path=next&&filmSkazUrl(next.url),visit=balanser+'|variant|'+path;
            if(next&&filmValidUrl(path,true)&&
               path!==filmSkazUrl(activeContentUrl)&&
               !automaticVoiceVisited[visit]){
              automaticVoiceVisited[visit]=true;
              this.__csoActiveVariant=bestRoute.variantName||'';
              this.request(next.url);
              return;
            }
          }
        }
        var bannedActive=rawButtons.some(function(button){
          return button.active&&(filmVoiceBlocked(button.text)||
            filmVoiceFieldsBlocked(button));
        });
        var buttons=rawButtons.filter(function(button){
          return !filmVoiceBlocked(button.text)&&!filmVoiceFieldsBlocked(button);
        });
        items=items.filter(function(item){
          return !filmVoiceFieldsBlocked(item)&&
            (item.method!=='play'||filmQualityMeetsMinimum(item,item,true));
        });
        // A selected language never changes provider or removes seasons.
        var usableButtons=buttons.filter(function(item){
          return languageAccepted(item,item.text);
        });
        if(usableButtons.length)buttons=usableButtons;
        var verifiedVoice=this.__csoBestSeriesVoice&&
          this.__csoBestSeriesVoice[balanser];
        buttons.sort(function(a,b){
          if(verifiedVoice&&isEpisodeMedia(object.movie)&&
              automaticSelectionEnabled()&&filmSearchMode()!=='economy'){
            var aaPreferred=a.text===verifiedVoice.text?1:0;
            var bbPreferred=b.text===verifiedVoice.text?1:0;
            if(aaPreferred!==bbPreferred)return bbPreferred-aaPreferred;
          }
          var aa=filmLanguagePriority(a,a.text),bb=filmLanguagePriority(b,b.text);
          return bb-aa||filmVoiceRank(b.text)-filmVoiceRank(a.text)||
            String(a.text||'').localeCompare(String(b.text||''));
        });
        // Active voice is a source-level property: the individual episode
        // card may omit it. Remember it *only* for the current screen.
        var activeAllowed=buttons.find(function(button){
          return button.active&&filmVoiceIdentityKnown(button.text);
        });
        if(activeAllowed){
          this.replaceChoice({
            voice:buttons.indexOf(activeAllowed),
            voice_name:activeAllowed.text,
            voice_url:activeAllowed.url,
            voice_manual:this.getChoice(balanser).voice_manual
          });
        }
        var savedVoice=this.getChoice(balanser);
        var confirmedSaved=filmVoiceIdentityKnown(savedVoice.voice_name)&&
          !filmVoiceBlocked(savedVoice.voice_name);
        var voiceOptions=buttons.filter(function(button){
          return filmVoiceIdentityKnown(button.text)&&
            filmValidUrl(button.url,true)&&
            filmLanguagePriority(button,button.text)>=0;
        });
        var advertisedVoice=rawButtons.some(function(button){
          return filmVoiceIdentityKnown(button.text);
        });
        if(bannedActive||
           (filmVoiceRestrictionsActive()&&advertisedVoice&&
             !activeAllowed&&!confirmedSaved)){
          var replacement=voiceOptions.find(function(button){
            return button.url!==activeContentUrl&&
              !automaticVoiceVisited[balanser+'|'+button.url];
          });
          if(replacement){
            automaticVoiceVisited[balanser+'|'+replacement.url]=true;
            this.replaceChoice({voice:buttons.indexOf(replacement),
              voice_name:replacement.text,voice_url:replacement.url,
              voice_manual:false});
            this.request(replacement.url);
            return;
          }
          if(bannedActive||(!confirmedSaved&&!activeAllowed)){
            // Never play an explicitly banned active voice, even if we
            // previously visited an allowed folder and ran out of retries.
            this.doesNotAnswer(new Error(
              'Источник не предоставил доступную разрешённую озвучку'));
            return;
          }
        }
        if(!isEpisodeMedia(object.movie)){
          items=items.filter(function(item){
            return filmItemAllowed(object.movie,item)&&
                languageAccepted(item,item.voice_name||item.translate_voice||item.text);
          });
          if(!items.length&&!buttons.length){
            this.doesNotAnswer(new Error('Источник вернул сериал или другой фильм'));
            return;
          }
        }
        // Alloha/Filmix can expose the selected voice as a folder only.
        if(!isEpisodeMedia(object.movie)&&!items.length&&buttons.length){
          var previous=this.getChoice(balanser);
          var preferred=buttons.find(function(b){
            return b.url===previous.voice_url||
              previous.voice_name&&b.text===previous.voice_name;
          });
          var selectedVoice=preferred||buttons[0];
          if(!filmValidUrl(selectedVoice.url,true)||
              selectedVoice.url===activeContentUrl){
            this.doesNotAnswer(new Error('Источник не открыл выбранную озвучку'));
            return;
          }
          this.replaceChoice({voice_name:selectedVoice.text,
            voice_url:selectedVoice.url});
          this.request(selectedVoice.url);
          return;
        }
        // One policy for voice selection in both series and films.
        // A manual voice is never overridden.
        if(buttons.length&&automaticSelectionEnabled()&&
            filmSearchMode()!=='economy'&&
            !this.getChoice(balanser).voice_manual){
          var suitable=buttons.filter(function(b){
            return filmLanguagePriority(b,b.text,null)>=0&&filmVoiceRank(b.text)>=0;
          });
          var preferredSeriesVoice=this.__csoBestSeriesVoice&&this.__csoBestSeriesVoice[balanser];
          suitable.sort(function(a,b){
            if(preferredSeriesVoice&&isEpisodeMedia(object.movie)){
              var aa=a.text===preferredSeriesVoice.text?1:0,bb=b.text===preferredSeriesVoice.text?1:0;
              if(aa!==bb)return bb-aa;
            }
            return filmLanguagePriority(b,b.text,null)-filmLanguagePriority(a,a.text,null)||
              filmVoiceRank(b.text)-filmVoiceRank(a.text)||
              String(a.text).localeCompare(String(b.text));
          });
          var voice=suitable[0],key=balanser+'|'+String(voice&&voice.url||'');
          if(voice&&!voice.active&&filmValidUrl(voice.url,true)&&
              voice.url!==activeContentUrl&&!automaticVoiceVisited[key]){
            automaticVoiceVisited[key]=true;
            this.replaceChoice({voice:buttons.indexOf(voice),
              voice_name:voice.text,voice_url:voice.url,voice_manual:false});
            this.request(voice.url);
            return;
          }
        }
        if (items.length == 1 && items[0].method == 'link' && !items[0].similar) {
          filter_find.season = items.map(function(s) {
            return {
              title: s.text,
              url: s.url
            };
          });
          this.replaceChoice({
            season: 0
          });
          this.request(items[0].url);
        } else {
          this.activity.loader(false);
          var videos = items.filter(function(v) {
            return v.method == 'play' || v.method == 'call';
          });
          var sameLanguageVideos=videos.filter(function(v){
            return languageAccepted(v,v.voice_name||v.translate_voice||v.text);
          });
          if(sameLanguageVideos.length)videos=sameLanguageVideos;
          var similar = items.filter(function(v) {
            return v.similar;
          });
          if (videos.length) {
            if (buttons.length) {
              filter_find.voice = buttons.map(function(b) {
                return {
                  title: b.text,
                  url: b.url
                };
              });
              var select_voice_url = this.getChoice(balanser).voice_url;
              var select_voice_name = this.getChoice(balanser).voice_name;
              var find_voice_url = buttons.find(function(v) {
                return v.url == select_voice_url;
              });
              var find_voice_name = buttons.find(function(v) {
                return v.text == select_voice_name;
              });
              var find_voice_active = buttons.find(function(v) {
                return v.active;
              }); ////console.log('b',buttons)
              ////console.log('u',find_voice_url)
              ////console.log('n',find_voice_name)
              ////console.log('a',find_voice_active)
              if (find_voice_url && !find_voice_url.active &&
                (!isEpisodeMedia(object.movie)||this.getChoice().voice_manual)) {
                //console.log('Lampac', 'go to voice', find_voice_url);
                this.replaceChoice({
                  voice: buttons.indexOf(find_voice_url),
                  voice_name: find_voice_url.text
                });
                this.request(find_voice_url.url);
              } else if (find_voice_name && !find_voice_name.active &&
                         (!isEpisodeMedia(object.movie)||this.getChoice().voice_manual)) {
                //console.log('Lampac', 'go to voice', find_voice_name);
                this.replaceChoice({
                  voice: buttons.indexOf(find_voice_name),
                  voice_name: find_voice_name.text
                });
                this.request(find_voice_name.url);
              } else {
                if (find_voice_active) {
                  this.replaceChoice({
                    voice: buttons.indexOf(find_voice_active),
                    voice_name: find_voice_active.text
                  });
                }
                this.display(videos);
              }
            } else {
              // A signed voice submenu can omit the voice buttons entirely.
              // Keep the confirmed translation inherited from the parent
              // folder; clearing it here lost the Goblin exclusion.
              var current=this.getChoice(balanser);
              if(filmVoiceBlocked(current.voice_name||'')){
                this.doesNotAnswer(new Error('Запрещённая озвучка'));
                return;
              }
              if(!filmVoiceIdentityKnown(current.voice_name)){
                var declared=videos.find(function(video){
                  return filmVoiceIdentityKnown(
                    video.voice_name||video.translate_voice||'');
                });
                if(declared){
                  this.replaceChoice({
                    voice_name:declared.voice_name||declared.translate_voice,
                    voice_manual:false
                  });
                }
              }
              this.display(videos);
            }
          } else if (items.length) {
            if (similar.length) {
              this.similars(similar);
              this.activity.loader(false);
            } else { //this.activity.loader(true)
              filter_find.season = items.map(function(s) {
                return {
                  title: s.text,
                  url: s.url
                };
              });
              var select_season = this.getChoice(balanser).season;
              if(object.lampac_continue_season){
                var resume=Number(object.lampac_continue_season);
                var found=filter_find.season.findIndex(function(row){
                  var title=String(row.title||'');
                  var m=title.match(/(?:сезон|season)\s*[:№#.-]?\s*(\d+)/i);
                  return m?Number(m[1])===resume:title.trim()===String(resume);
                });
                if(found>=0){
                  select_season=found;
                  this.getChoice(balanser).season=found;
                }
                delete object.lampac_continue_season;
              }
              var season = filter_find.season[select_season];
              if (!season) season = filter_find.season[0];
              //console.log('Lampac', 'go to season', season);
              this.request(season.url);
            }
          } else {
            this.doesNotAnswer(json);
          }
        }
      } catch (e) {
        //console.log('Lampac', 'error', e.stack);
        this.doesNotAnswer(e);
      }
    };
    this.similars = function(json) {
      var _this6 = this;
      var staged=document.createDocumentFragment();
      json.forEach(function(elem) {
        elem.title = elem.text;
        elem.info = '';
        var info = [];
        var year = ((elem.start_date || elem.year || object.movie.release_date || object.movie.first_air_date || '') + '').slice(0, 4);
        if (year) info.push(year);
        if (elem.details) info.push(elem.details);
        var name = elem.title || elem.text;
        elem.title = name;
        elem.time = elem.time || '';
        elem.info = info.join('<span class="online-prestige-split">●</span>');
        var item = Lampa.Template.get('lampac_prestige_folder', elem);
		if (elem.img) {
		  var image = $('<img style="height: 7em; width: 7em; border-radius: 0.3em;"/>');
		  item.find('.online-prestige__folder').empty().append(image);

		  if (elem.img !== undefined) {
		    if (elem.img.charAt(0) === '/')
		      elem.img = Defined.localhost + elem.img.substring(1);
		    if (elem.img.indexOf('/proxyimg') !== -1)
		      elem.img = account(elem.img);
		  }

		  Lampa.Utils.imgLoad(image, elem.img);
		}
        item.on('hover:enter', function() {
          _this6.reset();
          _this6.request(elem.url);
        }).on('hover:focus', function(e) {
          last = e.target;
          scheduleFocusScroll(e.target);
        });
        if(item&&item[0])staged.appendChild(item[0]);
      });
      // Lampa defines Element.append with appendChild: never pass HTML strings.
      var endSpacer=document.createElement('div');
      endSpacer.className='cso-end-spacer';
      endSpacer.setAttribute('aria-hidden','true');
      staged.appendChild(endSpacer);
      scroll.clear();
      scroll.append(staged);
	  this.filter({
        season: filter_find.season.map(function(s) {
          return s.title;
        }),
        voice: filter_find.voice.map(function(b) {
          return b.title;
        })
      }, this.getChoice());
      Lampa.Controller.enable('content');
    };
    this.getChoice = function(for_balanser) {
      var name=for_balanser||balanser;
      if(!sessionChoices[name]){
        // Old source/voice versions are migrated and purged once at startup.
        // Never read amedia_auto_choice_* again after this point.
        var progress=Lampa.Storage.cache('amedia_auto_progress_'+name,3000,{});
        var saved=progress&&typeof progress==='object'&&!Array.isArray(progress)?
          progress[object.movie.id]:null;
        if(!saved||typeof saved!=='object'||Array.isArray(saved))saved={};
        var viewed=saved.episodes_view;
        if(!viewed||typeof viewed!=='object'||Array.isArray(viewed))viewed={};
        sessionChoices[name]={
          season:Math.max(0,Math.trunc(Number(saved.season)||0)),
          voice:0,voice_name:'',voice_url:'',voice_id:0,voice_manual:false,
          episodes_view:Object.assign({},viewed)
        };
      }
      return sessionChoices[name];
    };
    this.saveChoice = function(choice, for_balanser) {
      var name=for_balanser||balanser;
      sessionChoices[name]=choice;
      // Persist only playback progress, never the playback version.
      var data=Lampa.Storage.cache('amedia_auto_progress_'+name,3000,{});
      if(!data||typeof data!=='object'||Array.isArray(data))data={};
      var progress={
        season:Math.max(0,Math.trunc(Number(choice.season)||0)),
        episodes_view:choice.episodes_view&&typeof choice.episodes_view==='object'?
          Object.assign({},choice.episodes_view):{}
      };
      if(JSON.stringify(data[object.movie.id])!==JSON.stringify(progress)){
        data[object.movie.id]=progress;
        Lampa.Storage.set('amedia_auto_progress_'+name,data);
      }
    };
    this.replaceChoice = function(choice, for_balanser) {
      var to = this.getChoice(for_balanser);
      Lampa.Arrays.extend(to, choice, true);
      this.saveChoice(to, for_balanser);
    };
    this.clearImages = function() {
      images.forEach(function(img) {
        img.onerror=null;
        img.onload=null;
        if(img.removeAttribute)img.removeAttribute('src');
      });
      images=[];
    };
    /**
     * Очистить список файлов
     */
    this.reset = function() {

      ++requestRevision;
      ++drawGeneration; // invalidate any late TMDB metadata callback
      requestPathCounts=Object.create(null);
      cancelFocusScroll();
      last = false;
      clearInterval(balanser_timer);
      network.clear();
      this.clearImages();
      scroll.render().find('.empty').remove();
      scroll.clear();
      scroll.reset();
      scroll.body().append(Lampa.Template.get('lampac_content_loading'));
    };
    /**
     * Загрузка
     */
    this.loading = function(status) {
      if (status) this.activity.loader(true);
      else {
        this.activity.loader(false);
        this.activity.toggle();
      }
    };
    /**
     * Построить фильтр
     */
    this.updateSeasonButton = function(){
      if(!seasonButton||!seasonButton.length)return;
      var seasons=filter_find.season||[];
      seasonButton.toggleClass('hide',!seasons.length)
          .toggleClass('selector',!!seasons.length);
      var selected=this.getChoice();
      var entry=seasons[selected.season]||seasons[0];
      var seasonLabel=entry?String(entry.title||'').trim():'';
      seasonLabel=seasonLabel.replace(/^(?:сезон|season)\s*[:№#-]?\s*/i,'');
      seasonButton.find('div').text(seasonLabel.slice(0,25));
    };
    this.showSeasonPicker = function(){
      var self=this, seasons=filter_find.season||[];
      if(!seasons.length){
        Lampa.Noty.show('Доступные сезоны ещё загружаются');
        return;
      }
      var selected=this.getChoice().season;
      Lampa.Select.show({
        title:'Сезон',
        items:seasons.map(function(item,index){
          return {title:item.title,index:index,selected:index===selected};
        }),
        onBack:function(){Lampa.Controller.toggle('content');},
        onSelect:function(item){
          if(!item || !seasons[item.index])return;
          Lampa.Select.close();
          var next=seasons[item.index], current=self.getChoice();
          if(current.season===item.index){
            Lampa.Controller.toggle('content');
            return;
          }
          // Keep preferred studio by NAME across seasons, but never reuse
          // the previous season's signed voice URL.
          self.replaceChoice({season:item.index,voice:0,voice_url:'',
              voice_name:'',voice_manual:false});
          self.updateSeasonButton();
          self.reset();
          self.request(next.url);
          Lampa.Controller.toggle('content');
        }
      });
    };
    this.filter = function(filter_items, choice) {
      filter_items=filter_items||{};
      var _this7 = this;
      var select = [];
      var add = function add(type, title) {
        var need = _this7.getChoice();
        var items = filter_items[type]||[];
        var subitems = [];
        var value = need[type];
        items.forEach(function(name, i) {
          subitems.push({
            title: name,
            selected: value == i,
            index: i
          });
        });
        select.push({
          title: title,
          subtitle: items[value],
          items: subitems,
          stype: type
        });
      };
      filter_sources=filter_sources.filter(function(key){
        return !!sources[key]&&filmSourceEnabled({
          balanser:key,name:sources[key].name});
      });
      filter_items.source = filter_sources.slice();
      select.push({
        title: Lampa.Lang.translate('torrent_parser_reset'),
        reset: true
      });
      // A single translation is not a choice. In addition to hiding the
      // button, don't insert a dead "Озвучка" selector in filter options.
      var hasVoiceVariants=Array.isArray(filter_items.voice)&&
        filter_items.voice.length>1;
      if(hasVoiceVariants)
        add('voice',Lampa.Lang.translate('torrent_parser_voice'));
      filter.set('filter',select);
      var voiceControl=filter.render().find('.filter--filter');
      if(voiceControl&&voiceControl.toggleClass)
        voiceControl.toggleClass('hide',!hasVoiceVariants);
      if(voiceControl&&voiceControl.css)
        voiceControl.css('display',hasVoiceVariants?'':'none');
      filter.set('sort', filter_sources.filter(function(e){
        return !!sources[e]&&filmSourceEnabled({
          balanser:e,name:sources[e].name});
      }).map(function(e) {
        return {
          title: sources[e].name+
            (e===balanser&&_this7.__csoActiveVariant==='Vibix'?
              ' · VIBIX':'')+
            (sources[e].show?'':' · недоступен'),
          source: e,
          csoDescription:sourceExplanation({balanser:e,name:sources[e].name}),
          recommended: e===filter_sources[0]&&!!sources[e].show,
          selected: e == balanser,
          ghost: !filmValidUrl(sources[e].url,true)
        };
      }));
      this.selected(filter_items);
      this.updateSeasonButton();
    };
    /**
     * Показать что выбрано в фильтре
     */
    this.selected = function(filter_items) {
      var need = this.getChoice(),
        select = [];
      for (var i in need) {
        if (filter_items[i] && filter_items[i].length &&
            filter_items[i][need[i]]!==undefined) {
          if (i == 'voice') {
            select.push(filter_translate[i] + ': ' + filter_items[i][need[i]]);
          } else if(i!=='source'&&i!=='season') {
            select.push(filter_translate[i]+': '+filter_items[i][need[i]]);
          }
        }
      }
      filter.chosen('filter', select);
      var title=sources[balanser]?sources[balanser].name:balanser||'—';
      if(balanser==='filmix'&&this.__csoActiveVariant==='Vibix')
        title+=' · VIBIX';
      filter.chosen('sort', [title]);
    };
    // Fallback catalog metadata. TMDB and the original Lampa card remain first.
    // Backup requests never block the episode list or provide playback links.
    var metadataCache=Object.create(null),metadataPending=Object.create(null);
    var externalCache=Object.create(null),externalPending=Object.create(null);
    function localEpisodes(season){
      var card=object.movie||{},result=[];
      if(Array.isArray(card.episodes))result=card.episodes;
      else if(Array.isArray(card.season_episodes))result=card.season_episodes;
      else if(Array.isArray(card.seasons)){
        var entry=card.seasons.find(function(row){
          return row&&Number(row.season_number||row.number)===Number(season);
        });
        if(entry&&Array.isArray(entry.episodes))result=entry.episodes;
      }
      return result.filter(function(row){
        return row&&typeof row==='object'&&
          (!row.season_number||Number(row.season_number)===Number(season));
      });
    }
    function genericEpisodeName(value){
      return !value||/^(?:episode|эпизод|серия|сер\.)\s*[#№]?\s*\d+$/i.test(String(value).trim());
    }
    function mergeEpisodes(first,second){
      var map=Object.create(null),order=[];
      (Array.isArray(first)?first:[]).forEach(function(row){
        var number=Number(row&&row.episode_number);
        if(!row||!(number>0&&number<=500))return;
        if(!map[number])order.push(number);
        map[number]=Object.assign({},row);
      });
      (Array.isArray(second)?second:[]).forEach(function(row){
        var number=Number(row&&row.episode_number);
        if(!row||!(number>0&&number<=500))return;
        if(!map[number]){map[number]={episode_number:number};order.push(number);}
        var dest=map[number];
        if(genericEpisodeName(dest.name)&&!genericEpisodeName(row.name))
          dest.name=row.name;
        if(!dest.still_path&&(row.still_path||row.image)){
          dest.still_path=row.still_path||row.image;
          if(row.__csoStillSource)dest.__csoStillSource=row.__csoStillSource;
        }
        if(!dest.air_date&&row.air_date)dest.air_date=row.air_date;
        if(!dest.runtime&&row.runtime)dest.runtime=row.runtime;
      });
      return order.sort(function(a,b){return a-b;}).map(function(n){return map[n];});
    }
    // An episode still is landscape art from that episode, not a series poster.
    // Classify before rendering so artwork never visibly swaps in the list.
    var artworkDimensions=Object.create(null);
    function artworkIdentity(value){
      var url=posterThumbUrl(value);
      if(!url)return '';
      return url.replace(/[?#].*$/,'')
        .replace(/\/(?:w\d+|original|w780|w300|w185)\//i,'/image/')
        .toLowerCase();
    }
    function prepareEpisodeArtwork(episodes,sourceItems,callback){
      episodes=Array.isArray(episodes)?episodes:[];
      sourceItems=Array.isArray(sourceItems)?sourceItems:[];
      var cards=episodes.concat(sourceItems),poster=artworkIdentity(episodePoster());
      var candidates=[],seen=Object.create(null),owners=Object.create(null);
      function candidate(row,source){
        if(!row)return '';
        var raw=source?(row.still_path||row.img||row.image||row.thumb||
          (!row.__csoThumbnail&&row.thumbnail)||''):
          (row.still_path||row.image||'');
        return posterThumbUrl(raw);
      }
      cards.forEach(function(row,index){
        var url=candidate(row,index>=episodes.length),id=artworkIdentity(url);
        if(!id)return;
        var episodeId=Number(row&&(row.episode_number||row.episode))||0;
        var ident=episodeId?'e'+episodeId:'unknown'+index;
        if(!owners[id])owners[id]=Object.create(null);
        owners[id][ident]=true;
      });
      cards.forEach(function(row,index){
        var source=index>=episodes.length,url=candidate(row,source);
        if(!url)return;
        var id=artworkIdentity(url);
        // Same still in two records for the SAME episode is legitimate.
        // Repeated across distinct episodes is probably a show poster.
        if(id===poster||(owners[id]&&Object.keys(owners[id]).length>1)){
          if(source)row.__csoSourceStillInvalid=true;
          else {row.still_path='';row.image='';}
          return;
        }
        if(!seen[id]){seen[id]=true;candidates.push({url:url,id:id});}
      });
      if(!candidates.length||typeof Image!=='function')return callback(episodes);
      var index=0,active=0,complete=0,finished=false,max=6;
      var timer=setTimeout(function(){settle();},550);
      function settle(){
        if(finished)return;
        finished=true;clearTimeout(timer);
        cards.forEach(function(row,i){
          var source=i>=episodes.length,url=candidate(row,source),id=artworkIdentity(url);
          if(!id)return;
          var size=artworkDimensions[id];
          // Unknown external image is not trusted as episode artwork.
          // Official TMDB/Lampa stills survive temporary image network errors.
          var untrusted=source||row.__csoStillSource&&row.__csoStillSource!=='TMDB';
          var bad=size===false||size&&size.ratio<1.12||
            (!size&&untrusted);
          if(bad){
            if(source)row.__csoSourceStillInvalid=true;
            else {row.still_path='';row.image='';}
          }
        });
        callback(episodes);
      }
      function pump(){
        if(finished)return;
        while(active<max&&index<candidates.length){
          (function(entry){
            active++;
            if(artworkDimensions[entry.id]!==undefined){
              active--;complete++;return;
            }
            var img=new Image(),didFinish=false;
            function end(ok){
              if(didFinish)return;
              didFinish=true;img.onload=null;img.onerror=null;
              var width=Number(img.naturalWidth)||0,
                  height=Number(img.naturalHeight)||0;
              artworkDimensions[entry.id]=ok&&height>0?
                {ratio:width/height}:false;
              active--;complete++;
              if(complete>=candidates.length)settle();else pump();
            }
            img.onload=function(){end(true);};
            img.onerror=function(){end(false);};
            img.src=entry.url;
          })(candidates[index++]);
        }
        if(complete>=candidates.length)settle();
      }
      pump();
    }
    function metadataTitleMatch(name){
      function norm(value){return String(value||'').toLowerCase().replace(/ё/g,'е')
        .replace(/[^a-zа-я0-9]+/gi,' ').trim();}
      var card=object.movie||{};
      var wanted=[card.title,card.name,card.original_title,card.original_name,
        object.search,object.search_one,object.search_two].map(norm).filter(Boolean);
      return !!norm(name)&&wanted.indexOf(norm(name))>=0;
    }
    function metadataYearMatch(year){
      var card=object.movie||{};
      var reference=Number(String(card.first_air_date||card.release_date||
        card.year||'').slice(0,4));
      return !reference||!year||Math.abs(reference-Number(year))<=1;
    }
    function metadataRequest(url,headers,callback){
      var req=new Network(),settled=false;
      var timer=setTimeout(function(){
        if(settled)return;settled=true;
        try{req.clear();}catch(ignored){}
        callback(null);
      },3650);
      function done(json){
        if(settled)return;settled=true;clearTimeout(timer);
        if(typeof json==='string'){try{json=JSON.parse(json);}catch(e){json=null;}}
        callback(json&&typeof json==='object'?json:null);
      }
      try{
        if(req.timeout)req.timeout(3300);
        req.silent(url,done,function(){done(null);},false,
          {headers:headers||{}});
      }catch(e){done(null);}
    }
    function addExternalIdentity(meta){
      var card=object.movie||{};
      if(meta.poster&&!episodePoster()){
        // External URLs must stay absolute: no TMDB-only image prefix.
        if(!card.poster_path&&!card.poster)card.poster=meta.poster;
      }
      if(meta.title&&!card.title&&!card.name){
        if(isEpisodeMedia(card))card.name=meta.title;
        else card.title=meta.title;
      }
    }
    function fetchExternalEpisodes(season,callback){
      var card=object.movie||{};
      var imdb=String(card.imdb_id||'').trim();
      var wantedTitle=String(card.original_name||card.original_title||
        card.name||card.title||object.search||'').trim();
      var russianTitle=String(card.title||card.name||object.search||
        wantedTitle).trim();
      var kp=String(card.kp_id||card.kinopoiskId||
        ((card.source==='kinopoisk'||card.source==='kp')?
          card.kinopoisk_id:'')||'').trim();
      var key=String(Lampa.Storage.get('capsule_skaz_online_kinopoisk_key','')||'').trim();
      // Some providers misuse "kinopoisk_id" for a TMDB ID. Only accept
      // the KinoPoisk result after comparing its title and release year.
      var cacheKey=[imdb,kp,wantedTitle,season,!!key].join('|');
      var cached=externalCache[cacheKey];
      if(cached&&cached.until>Date.now())return callback(cached.meta);
      if(externalPending[cacheKey]){
        externalPending[cacheKey].push(callback);
        return;
      }
      externalPending[cacheKey]=[callback];
      var result={poster:'',title:'',episodes:[],sources:[]};
      var finished=false,deadline=setTimeout(finish,11200);
      function finish(){
        if(finished)return;finished=true;clearTimeout(deadline);
        addExternalIdentity(result);
        externalCache[cacheKey]={meta:result,until:Date.now()+
          (result.episodes.length||result.poster?20*60*1000:45*1000)};
        var listeners=externalPending[cacheKey]||[];
        delete externalPending[cacheKey];
        window.__capsuleMetadataLast={sources:result.sources.slice(),
          episodeCount:result.episodes.length,hasPoster:!!result.poster};
        listeners.forEach(function(cb){try{cb(result);}catch(e){}});
      }
      function merge(meta,source){
        if(!meta)return;
        if(!result.poster&&/^https?:\/\//i.test(meta.poster||''))
          result.poster=meta.poster;
        if(!result.title&&meta.title)result.title=String(meta.title);
        result.episodes=mergeEpisodes(result.episodes,
          (Array.isArray(meta.episodes)?meta.episodes:[]).map(function(row){
            return Object.assign({},row,{__csoStillSource:source});
          }));
        if(result.sources.indexOf(source)<0)result.sources.push(source);
      }
      function enough(){
        return !!result.poster&&result.episodes.length>0&&
          result.episodes.some(function(row){return !!row.still_path;});
      }
      function cinemeta(){
        if(!/^tt\d{6,12}$/i.test(imdb))return finish();
        var type=isEpisodeMedia(card)?'series':'movie';
        metadataRequest('https://v3-cinemeta.strem.io/meta/'+type+'/'+
          encodeURIComponent(imdb)+'.json',null,function(json){
          var meta=json&&json.meta;
          if(meta&&String(meta.id||imdb).indexOf(imdb)>=0){
            merge({poster:meta.poster||'',title:meta.name||'',
              episodes:(Array.isArray(meta.videos)?meta.videos:[])
                .filter(function(row){
                  return Number(row.season)===Number(season)&&
                    Number(row.episode)>0;
                }).map(function(row){
                  return {episode_number:Number(row.episode),
                    name:row.title||row.name||'',still_path:row.thumbnail||'',
                    air_date:String(row.released||'').slice(0,10)};
                })},'Cinemeta');
          }
          finish();
        });
      }
      function tvmaze(){
        if(!isEpisodeMedia(card))return cinemeta();
        var lookup=/^tt\d{6,12}$/i.test(imdb)?
          'https://api.tvmaze.com/lookup/shows?imdb='+encodeURIComponent(imdb):
          wantedTitle?'https://api.tvmaze.com/search/shows?q='+
            encodeURIComponent(wantedTitle):'';
        if(!lookup)return cinemeta();
        metadataRequest(lookup,null,function(json){
          var show=Array.isArray(json)?
            (json.map(function(row){return row&&row.show;}).filter(function(row){
              return row&&metadataTitleMatch(row.name)&&
                metadataYearMatch(String(row.premiered||'').slice(0,4));
            })[0]||null):json;
          if(!show||!(Number(show.id)>0)||(!imdb&&
              (!metadataTitleMatch(show.name)||
                !metadataYearMatch(String(show.premiered||'').slice(0,4)))))
            return cinemeta();
          var poster=show.image&&(show.image.original||show.image.medium)||'';
          merge({poster:poster,title:show.name||'',episodes:[]},'TVmaze');
          metadataRequest('https://api.tvmaze.com/shows/'+
            Number(show.id)+'/episodes',null,function(rows){
            if(Array.isArray(rows)){
              merge({episodes:rows.filter(function(row){
                return Number(row.season)===Number(season)&&
                  Number(row.number)>0;
              }).map(function(row){
                return {episode_number:Number(row.number),name:row.name||'',
                  still_path:row.image&&(row.image.medium||
                    row.image.original)||'',air_date:row.airdate||'',
                  runtime:Number(row.runtime)||0};
              })},'TVmaze');
            }
            if(enough())finish();else cinemeta();
          });
        });
      }
      function kinopoisk(){
        if(!key)return tvmaze();
        function gotFilm(json){
          if(!json||!metadataYearMatch(json.year||json.yearStart)||
             !(metadataTitleMatch(json.nameRu)||metadataTitleMatch(json.nameEn)||
               metadataTitleMatch(json.nameOriginal)))return tvmaze();
          var filmId=Number(json.kinopoiskId||json.filmId||kp);
          merge({title:json.nameRu||json.nameEn||'',
            poster:json.posterUrl||json.posterUrlPreview||'',episodes:[]},
            'Кинопоиск');
          if(!isEpisodeMedia(card)||!filmId)return tvmaze();
          metadataRequest('https://kinopoiskapiunofficial.tech/api/v2.2/films/'+
            filmId+'/seasons',{'X-API-KEY':key},function(data){
            var items=data&&Array.isArray(data.items)?data.items:[];
            var group=items.filter(function(item){
              return Number(item.number)===Number(season);
            })[0];
            if(group&&Array.isArray(group.episodes)){
              merge({episodes:group.episodes.map(function(ep){
                return {episode_number:Number(ep.episodeNumber)||0,
                  name:ep.nameRu||ep.nameEn||'',
                  air_date:ep.releaseDate||''};
              })},'Кинопоиск');
            }
            tvmaze();
          });
        }
        if(/^\d{1,10}$/.test(kp)){
          metadataRequest('https://kinopoiskapiunofficial.tech/api/v2.2/films/'+
            encodeURIComponent(kp),{'X-API-KEY':key},gotFilm);
        }else if(wantedTitle){
          metadataRequest('https://kinopoiskapiunofficial.tech/api/v2.1/films/search-by-keyword?keyword='+
            encodeURIComponent(russianTitle)+'&page=1',{'X-API-KEY':key},
            function(data){
              var films=data&&Array.isArray(data.films)?data.films:[];
              var found=films.find(function(row){
                return metadataYearMatch(row.year)&&
                  (metadataTitleMatch(row.nameRu)||
                    metadataTitleMatch(row.nameEn));
              });
              if(!found)return tvmaze();
              metadataRequest('https://kinopoiskapiunofficial.tech/api/v2.2/films/'+
                Number(found.filmId),{'X-API-KEY':key},gotFilm);
            });
        }else tvmaze();
      }
      kinopoisk();
    }
    this.getEpisodes = function(season,call,onUpdate,sourceItems){
      var embedded=localEpisodes(season),card=object.movie||{},
          rawId=(card.source==='tmdb'||!card.source)?card.id:card.tmdb_id,
          id=Number(rawId),key=[
            String(card.imdb_id||card.original_name||card.name||card.id||''),
            String(id||''),Number(season)||0].join(':'),
          cached=metadataCache[key];
      if(!isEpisodeMedia(card)){call(embedded);return;}
      if(cached&&cached.expire>Date.now())
        return prepareEpisodeArtwork(mergeEpisodes(cached.episodes,embedded),
          sourceItems||[],call);
      if(metadataPending[key]){
        metadataPending[key].push({call:call,items:sourceItems||[]});
        return;
      }
      metadataPending[key]=[{call:call,items:sourceItems||[]}];
      var best=embedded,sourceRows=sourceItems||[],
          finished=false,tmdbDone=false,externalStarted=false;
      // One wall-clock budget instead of TMDB -> backups -> image probing
      // sequential waits. Late callbacks only warm the cache for next open.
      var deadline=setTimeout(finish,1150);
      function finish(){
        if(finished)return;
        finished=true;clearTimeout(deadline);
        var material=best;
        prepareEpisodeArtwork(material,sourceRows,function(rows){
          metadataCache[key]={episodes:rows,expire:Date.now()+
            (rows.length?20*60*1000:45000)};
          var listeners=metadataPending[key]||[];
          delete metadataPending[key];
          listeners.forEach(function(listener){
            if(listener.items===sourceRows){
              try{listener.call(rows);}catch(ignore){}
            }else{
              prepareEpisodeArtwork(rows,listener.items,function(prepared){
                try{listener.call(prepared);}catch(ignore){}
              });
            }
          });
        });
      }
      function usefulStill(rows){
        return Array.isArray(rows)&&rows.length&&rows.some(function(row){
          return row&&row.still_path&&!genericEpisodeName(row.name);
        });
      }
      function needMore(rows){
        return !Array.isArray(rows)||!rows.length||
          rows.some(function(ep){
            return !ep||!ep.still_path||genericEpisodeName(ep.name);
          })||rows.length<Math.max(embedded.length,sourceRows.length);
      }
      function fallback(){
        if(externalStarted||finished)return;
        externalStarted=true;
        fetchExternalEpisodes(season,function(meta){
          // Once rendered, do not visibly replace tiles. Future openings
          // may benefit from the completed external metadata.
          if(meta&&meta.episodes){
            var merged=mergeEpisodes(best,meta.episodes);
            if(!finished){
              best=merged;
              if(tmdbDone&&usefulStill(best)&&!needMore(best))finish();
            }else{
              var current=metadataCache[key];
              if(current)current.episodes=mergeEpisodes(current.episodes,merged);
            }
          }
        });
      }
      // Start backup slightly after TMDB, concurrently if TMDB is sluggish.
      var fallbackTimer=setTimeout(fallback,600);
      if(!isFinite(id)||id<1||!Lampa.Api||!Lampa.Api.sources||
          !Lampa.Api.sources.tmdb||!Lampa.Api.sources.tmdb.get){
        clearTimeout(fallbackTimer);fallback();return;
      }
      var tmdbTimer=setTimeout(function(){
        if(tmdbDone)return;tmdbDone=true;fallback();
      },950);
      function received(rows){
        if(tmdbDone)return;
        tmdbDone=true;clearTimeout(tmdbTimer);
        rows=Array.isArray(rows)?rows:[];
        if(rows.length){
          best=mergeEpisodes(rows.map(function(row){
            return Object.assign({},row,{__csoStillSource:'TMDB'});
          }),best);
        }
        if(needMore(best))fallback();
        else{clearTimeout(fallbackTimer);finish();}
      }
      try{
        Lampa.Api.sources.tmdb.get('tv/'+id+'/season/'+season,{},
          function(data){received(data&&data.episodes);},
          function(){received([]);});
      }catch(error){received([]);}
    };
    this.watched = function(set) {
      var file_id = Lampa.Utils.hash(object.movie.number_of_seasons ? object.movie.original_name : object.movie.original_title);
      var watched = Lampa.Storage.cache('amedia_auto_watched_last', 5000, {});
      if (set) {
        if (!watched[file_id]) watched[file_id] = {};
        Lampa.Arrays.extend(watched[file_id], set, true);
        // Clean obsolete playback-version metadata from existing entries.
        delete watched[file_id].balanser;
        delete watched[file_id].balanser_name;
        delete watched[file_id].voice_id;
        delete watched[file_id].voice_name;
        Lampa.Storage.set('amedia_auto_watched_last', watched);
        this.updateWatched();
      } else {
        return watched[file_id];
      }
    };
    this.updateWatched = function() {
      var watched = this.watched();
      var body = scroll.body().find('.online-prestige-watched .online-prestige-watched__body').empty();
      if (watched) {
        var line = [];
        if (watched.season) line.push(Lampa.Lang.translate('torrent_serial_season') + ' ' + watched.season);
        if (watched.episode) line.push(Lampa.Lang.translate('torrent_serial_episode') + ' ' + watched.episode);
        line.forEach(function(n) {
          body.append('<span>' + n + '</span>');
        });
      } else body.append('<span>' + Lampa.Lang.translate('lampac_no_watch_history') + '</span>');
    };
    /**
     * Отрисовка файлов
     */
    var drawGeneration=0;
    this.draw = function(items) {
      var generation=++drawGeneration;
      var drawRequestRevision=requestRevision,drawBalancer=balanser;
      var _this8 = this;
      var params = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      if (!items.length) return this.empty();
      // Draw from Skaz/Lampa immediately; enrich metadata in the cards
      // after TMDB returns, without clearing or reconstructing the list.
      var rowsByEpisode=Object.create(null);
      this.getEpisodes(items[0].season, function(episodes) {
        if(generation!==drawGeneration||drawRequestRevision!==requestRevision||
           drawBalancer!==balanser)return; // late source / season callback
        // Lampa.Scroll.append ultimately calls DOM append(). Repeatedly
        // appending dozens of rows caused layout/paint churn on TV WebView.
        var stagedRows=document.createDocumentFragment();
        function stageRow(row){if(row&&row[0])stagedRows.appendChild(row[0]);}
        var episodeIndex=Object.create(null);
        episodes.forEach(function(row){
          if(row&&row.episode_number)episodeIndex[Number(row.episode_number)]=row;
        });
        var fallbackPoster=episodePoster();
        // Retire old thumbnails only after swapping to the new fragment:
        // detached image loads must not keep firing on hidden TV rows.
        var oldImages=images;images=[];
        var viewed = Lampa.Storage.cache('online_view', 5000, []);
        var lastPlayableEpisode=_this8.getLastEpisode(items);
        var serial = isEpisodeMedia(object.movie);
        var choice = _this8.getChoice();
        var fully = window.innerWidth > 480;
        var scroll_to_element = false;
        var scroll_to_mark = false;
        items.forEach(function(element, index) {
          var episode = serial&&!params.similars?
            (episodeIndex[Number(element.episode||index+1)]||false):false;
          var episode_num = element.episode || index + 1;
          var sourceTitle=String(element.title||element.name||element.text||'').trim();
          var specificTitle=!!sourceTitle&&
            !/^(?:(?:серия|эпизод|episode|сер\.)\s*[#№]?\s*\d+|\d+\s*(?:серия|эпизод|episode)?|дублированный|дубляж|по умолчанию)$/i.test(sourceTitle);
          var episode_last = choice.episodes_view[element.season];
          var voice_name = serial ?
            (choice.voice_name||(filter_find.voice[0]&&filter_find.voice[0].title)||
              element.voice_name||'Неизвестно'):
            (element.voice_name||element.translate_voice||element.text||
              choice.voice_name||'Неизвестно');
          if (element.quality) {
            element.qualitys = element.quality;
            element.quality = Lampa.Arrays.getKeys(element.quality)[0];
          }
          Lampa.Arrays.extend(element, {
            voice_name: voice_name,
            info: voice_name.length > 60 ? voice_name.substr(0, 60) + '...' : voice_name,
            quality: '',
            time: Lampa.Utils.secondsToTime((episode ? episode.runtime : object.movie.runtime) * 60, true)
          });
          var hash_timeline = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title].join('') : object.movie.original_title);
          var hash_behold = Lampa.Utils.hash(element.season ? [element.season, element.season > 10 ? ':' : '', element.episode, object.movie.original_title, element.voice_name].join('') : object.movie.original_title + element.voice_name);
          var data = {
            hash_timeline: hash_timeline,
            hash_behold: hash_behold
          };
          var info = [];
          if (element.season) {
            element.translate_episode_end = lastPlayableEpisode;
            element.translate_voice = element.voice_name;
          }
          if (element.text && !episode) element.title = element.text;
          // Link progress to the card rather than the provider/voice URL.
          // This allows native Lampa resume after switching Alloha/Filmix.
          element.timeline = Lampa.Timeline.view(hash_timeline,
            Lampa.Timeline.link?Lampa.Timeline.link(
              object.movie,element.season,element.episode):undefined);
          if (episode) {
            if(!specificTitle&&episode.name)element.title=episode.name;
            if (element.info.length < 30 && episode.vote_average) info.push(Lampa.Template.get('lampac_prestige_rate', {
              rate: parseFloat(episode.vote_average + '').toFixed(1)
            }, true));
            if (episode.air_date && fully) info.push(Lampa.Utils.parseTime(episode.air_date).full);
          } else if (object.movie.release_date && fully) {
            info.push(Lampa.Utils.parseTime(object.movie.release_date).full);
          }
          if (!serial && object.movie.tagline && element.info.length < 30) info.push(object.movie.tagline);
          if (element.info) info.push(element.info);
          if (info.length) element.info = info.map(function(i) {
            return '<span>' + i + '</span>';
          }).join('<span class="online-prestige-split">●</span>');
          var html = Lampa.Template.get('lampac_prestige_full', element);
          var episodeKey=String(element.season||0)+':'+String(element.episode||index+1);
          html.attr('data-cso-episode',episodeKey);
          var loader = html.find('.online-prestige__loader');
          var image = html.find('.online-prestige__img');
		  if(object.balanser) image.hide();
          if (serial && typeof episode_last !== 'undefined' && episode_last == episode_num) {
            scroll_to_element = html;
          }
          // When TMDB has no episode still, softly reuse the title poster.
          // Keep the frame and numbering stable; never request a blank TMDB URL.
          var img=html.find('img')[0];
          var sourceStill=serial&&element.__csoSourceStillInvalid?'':
            posterThumbUrl(element.still_path||element.img||
            element.image||(serial?'':element.poster_path||element.poster)||
            element.thumb||(!element.__csoThumbnail?element.thumbnail:'')||
            (serial?'':element.cover));
          var still=sourceStill||(episode?posterThumbUrl(episode.still_path):
              posterThumbUrl(serial?'':object.movie.backdrop_path));
          if(img&&(still||fallbackPoster)){
            img.onload=function(){
              image.addClass('online-prestige__img--loaded');
              loader.remove();
              if(serial&&!image.find('.online-prestige__episode-number').length)
                image.append('<div class="online-prestige__episode-number">'+
                    ('0'+(element.episode||index+1)).slice(-2)+'</div>');
            };
            img.onerror=function(){
              if(!image.hasClass('cso-poster-fallback')&&usePosterThumb(img,image))
                return;
              img.onerror=null;loader.remove();
              img.src='./img/img_broken.svg';
            };
            img.loading='lazy';img.decoding='async';
            if(still)img.src=still;
            else usePosterThumb(img,image);
            images.push(img);
            element.thumbnail=img.src;
            element.__csoThumbnail=true;
          }else{
            loader.remove();
            if(serial)image.append('<div class="online-prestige__episode-number">'+
                ('0'+(element.episode||index+1)).slice(-2)+'</div>');
          }
          if(serial)rowsByEpisode[Number(episode_num)]={
            html:html,img:img,image:image,element:element,
            specificTitle:specificTitle,sourceImage:!!sourceStill
          };
          html.find('.online-prestige__timeline').append(Lampa.Timeline.render(element.timeline));
          if (viewed.indexOf(hash_behold) !== -1) {
            scroll_to_mark = html;
            html.find('.online-prestige__img').append('<div class="online-prestige__viewed">' + Lampa.Template.get('icon_viewed', {}, true) + '</div>');
          }
          element.mark = function() {
            viewed = Lampa.Storage.cache('online_view', 5000, []);
            if (viewed.indexOf(hash_behold) == -1) {
              viewed.push(hash_behold);
              Lampa.Storage.set('online_view', viewed);
              if (html.find('.online-prestige__viewed').length == 0) {
                html.find('.online-prestige__img').append('<div class="online-prestige__viewed">' + Lampa.Template.get('icon_viewed', {}, true) + '</div>');
              }
            }
            choice = _this8.getChoice();
            if (serial) {
              choice.episodes_view[element.season] = episode_num;
            }
            _this8.saveChoice(choice);
            _this8.watched({
              episode: element.episode,
              season: element.season
            });
          };
          element.unmark = function() {
            viewed = Lampa.Storage.cache('online_view', 5000, []);
            if (viewed.indexOf(hash_behold) !== -1) {
              Lampa.Arrays.remove(viewed, hash_behold);
              Lampa.Storage.set('online_view', viewed);
              Lampa.Storage.remove('online_view', hash_behold);
              html.find('.online-prestige__viewed').remove();
            }
          };
          element.timeclear = function() {
            element.timeline.percent = 0;
            element.timeline.time = 0;
            element.timeline.duration = 0;
            Lampa.Timeline.update(element.timeline);
          };
          html.on('hover:enter', function() {
            if (object.movie.id) Lampa.Favorite.add('history', object.movie, 100);
            if (params.onEnter) params.onEnter(element, html, data);
          }).on('hover:focus', function(e) {
            var focused=e.currentTarget||e.target;
            last=focused;
            lastFocusedEpisode=episodeKey;

            if(params.onFocus)params.onFocus(element,html,data);
            scheduleFocusScroll(focused);
          });
          if (params.onRender) params.onRender(element, html, data);
          _this8.contextMenu({
            html: html,
            element: element,
            onFile: function onFile(call) {
              if (params.onContextMenu) params.onContextMenu(element, html, data, call);
            },
            onClearAllMark: function onClearAllMark() {
              items.forEach(function(elem) {
                elem.unmark();
              });
            },
            onClearAllTime: function onClearAllTime() {
              items.forEach(function(elem) {
                elem.timeclear();
              });
            }
          });
          stageRow(html);
        });
        if (serial && episodes.length > items.length && !params.similars) {
          // At most 12 nonplayable placeholders; huge TMDB seasons used to
          // render 100+ inert cards and stutter on Android TV WebViews.
          var left=episodes.slice(items.length,items.length+12);
          left.forEach(function(episode) {
            var info = [];
            if (episode.vote_average) info.push(Lampa.Template.get('lampac_prestige_rate', {
              rate: parseFloat(episode.vote_average + '').toFixed(1)
            }, true));
            if (episode.air_date) info.push(Lampa.Utils.parseTime(episode.air_date).full);
            var air = new Date((episode.air_date + '').replace(/-/g, '/'));
            var now = Date.now();
            var day = Math.round((air.getTime() - now) / (24 * 60 * 60 * 1000));
            var txt = Lampa.Lang.translate('full_episode_days_left') + ': ' + day;
            var html = Lampa.Template.get('lampac_prestige_full', {
              time: Lampa.Utils.secondsToTime((episode ? episode.runtime : object.movie.runtime) * 60, true),
              info: info.length ? info.map(function(i) {
                return '<span>' + i + '</span>';
              }).join('<span class="online-prestige-split">●</span>') : '',
              title: episode.name,
              quality: day > 0 ? txt : ''
            });
            var loader = html.find('.online-prestige__loader');
            var image = html.find('.online-prestige__img');
            var season = items[0] ? items[0].season : 1;
            html.find('.online-prestige__timeline').append(Lampa.Timeline.render(Lampa.Timeline.view(Lampa.Utils.hash([season, episode.episode_number, object.movie.original_title].join('')))));
            var img = html.find('img')[0];
            var still=posterThumbUrl(episode.still_path);
            if(img&&(still||episodePoster())){
              img.onload=function(){
                image.addClass('online-prestige__img--loaded');
                loader.remove();
                if(!image.find('.online-prestige__episode-number').length)
                  image.append('<div class="online-prestige__episode-number">'+
                      ('0'+episode.episode_number).slice(-2)+'</div>');
              };
              img.onerror=function(){
                if(!image.hasClass('cso-poster-fallback')&&usePosterThumb(img,image))
                  return;
                img.onerror=null;loader.remove();img.src='./img/img_broken.svg';
              };
              img.loading='lazy';img.decoding='async';
              if(still)img.src=still;
              else usePosterThumb(img,image);
              images.push(img);
            }else{
              loader.remove();
              image.append('<div class="online-prestige__episode-number">'+
                  ('0'+episode.episode_number).slice(-2)+'</div>');
            }
            html.on('hover:focus', function(e) {
              var focused=e.currentTarget||e.target;
              last=focused;
              lastFocusedEpisode=String(season)+':'+String(episode.episode_number);

              scheduleFocusScroll(focused);
            });
            html.css('opacity', '0.5');
            stageRow(html);
          });
        }
        // One atomic DOM swap rather than a blank frame + progressive rows.
        var wholeList=document.createDocumentFragment();
        if(!object.balanser){
          var watchedNode=Lampa.Template.get('lampac_prestige_watched',{});
          if(watchedNode&&watchedNode[0])wholeList.appendChild(watchedNode[0]);
        }
        wholeList.appendChild(stagedRows);
        var endSpacer=document.createElement('div');
        endSpacer.className='cso-end-spacer';
        endSpacer.setAttribute('aria-hidden','true');
        wholeList.appendChild(endSpacer);
        scroll.clear();
        scroll.append(wholeList);
        _this8.updateWatched();
        oldImages.forEach(function(img){
          if(!img)return;
          img.onerror=null;img.onload=null;
          try{if(img.removeAttribute)img.removeAttribute('src');}
          catch(ignored){}
        });
        var rootBody=scroll.body(), rowFocus=null;
        if(lastFocusedEpisode){
          rowFocus=rootBody.find('.online-prestige--full[data-cso-episode="'+
            lastFocusedEpisode.replace(/[^0-9:]/g,'')+'"]').first();
        }
        if(scroll_to_element&&scroll_to_element[0]&&
           scroll_to_element[0].isConnected)last=scroll_to_element[0];
        else if(scroll_to_mark)last=scroll_to_mark[0];
        else if(rowFocus&&rowFocus.length)last=rowFocus[0];
        else last=rootBody.find('.online-prestige--full.selector').first()[0]||false;

        Lampa.Controller.enable('content');

        // --- Auto-play continue episode ---
        if (object.lampac_continue_episode) {
          var target_ep = object.lampac_continue_episode;
          delete object.lampac_continue_episode; // prevent re-trigger on navigation

          var target_item = items.find(function(el) {
            return el.episode == target_ep;
          });

          if (target_item) {
            setTimeout(function() {
              var target_html = scroll.body().find('.online-prestige--full').eq(items.indexOf(target_item));
              if (target_html.length) {
                last = target_html[0];
                scroll.update(target_html, true);
                target_html.trigger('hover:enter');
              }
            }, 300);
          }
        }
      },null,items);
    };
    /**
     * Меню
     */
    this.contextMenu = function(params) {
      params.html.on('hover:long', function() {
        function show(extra) {
          var enabled = Lampa.Controller.enabled().name;
          var menu = [];
          if (Lampa.Platform.is('webos')) {
            menu.push({
              title: Lampa.Lang.translate('player_lauch') + ' - Webos',
              player: 'webos'
            });
          }
          if (Lampa.Platform.is('android')) {
            menu.push({
              title: Lampa.Lang.translate('player_lauch') + ' - Android',
              player: 'android'
            });
          }
          menu.push({
            title: Lampa.Lang.translate('player_lauch') + ' - Lampa',
            player: 'lampa'
          });
          menu.push({
            title: Lampa.Lang.translate('lampac_video'),
            separator: true
          });
          menu.push({
            title: Lampa.Lang.translate('torrent_parser_label_title'),
            mark: true
          });
          menu.push({
            title: Lampa.Lang.translate('torrent_parser_label_cancel_title'),
            unmark: true
          });
          menu.push({
            title: Lampa.Lang.translate('time_reset'),
            timeclear: true
          });
          if (extra) {
            menu.push({
              title: Lampa.Lang.translate('copy_link'),
              copylink: true
            });
          }
          if (window.lampac_online_context_menu)
            window.lampac_online_context_menu.push(menu, extra, params);
          menu.push({
            title: Lampa.Lang.translate('more'),
            separator: true
          });
          if (Lampa.Account.logged() && params.element && typeof params.element.season !== 'undefined' && params.element.translate_voice) {
            menu.push({
              title: Lampa.Lang.translate('lampac_voice_subscribe'),
              subscribe: true
            });
          }
          menu.push({
            title: Lampa.Lang.translate('lampac_clear_all_marks'),
            clearallmark: true
          });
          menu.push({
            title: Lampa.Lang.translate('lampac_clear_all_timecodes'),
            timeclearall: true
          });
          Lampa.Select.show({
            title: Lampa.Lang.translate('title_action'),
            items: menu,
            onBack: function onBack() {
              Lampa.Controller.toggle(enabled);
            },
            onSelect: function onSelect(a) {
              if (a.mark) params.element.mark();
              if (a.unmark) params.element.unmark();
              if (a.timeclear) params.element.timeclear();
              if (a.clearallmark) params.onClearAllMark();
              if (a.timeclearall) params.onClearAllTime();
              if (window.lampac_online_context_menu)
                window.lampac_online_context_menu.onSelect(a, params);
              Lampa.Controller.toggle(enabled);
              if (a.player) {
                // "Запустить через Android" may override the configured
                // default internal player for this single video launch.
                requestedPlayer=a.player;
                Lampa.Player.runas(a.player);
                params.html.trigger('hover:enter');
              }
              if (a.copylink) {
                if (extra.quality) {
                  var qual = [];
                  for (var i in extra.quality) {
                    qual.push({
                      title: i,
                      file: extra.quality[i]
                    });
                  }
                  Lampa.Select.show({
                    title: Lampa.Lang.translate('settings_server_links'),
                    items: qual,
                    onBack: function onBack() {
                      Lampa.Controller.toggle(enabled);
                    },
                    onSelect: function onSelect(b) {
                      Lampa.Utils.copyTextToClipboard(b.file, function() {
                        Lampa.Noty.show(Lampa.Lang.translate('copy_secuses'));
                      }, function() {
                        Lampa.Noty.show(Lampa.Lang.translate('copy_error'));
                      });
                    }
                  });
                } else {
                  Lampa.Utils.copyTextToClipboard(extra.file, function() {
                    Lampa.Noty.show(Lampa.Lang.translate('copy_secuses'));
                  }, function() {
                    Lampa.Noty.show(Lampa.Lang.translate('copy_error'));
                  });
                }
              }
              if (a.subscribe) {
                Lampa.Account.subscribeToTranslation({
                  card: object.movie,
                  season: params.element.season,
                  episode: params.element.translate_episode_end,
                  voice: params.element.translate_voice
                }, function() {
                  Lampa.Noty.show(Lampa.Lang.translate('lampac_voice_success'));
                }, function() {
                  Lampa.Noty.show(Lampa.Lang.translate('lampac_voice_error'));
                });
              }
            }
          });
        }
        params.onFile(show);
      }).on('hover:focus', function() {
        if (Lampa.Helper) Lampa.Helper.show('online_file', Lampa.Lang.translate('helper_online_file'), params.html);
      });
    };
    /**
     * Показать пустой результат
     */
    this.empty = function() {
      var html = Lampa.Template.get('lampac_does_not_answer', {});
      html.find('.online-empty__buttons').remove();
      html.find('.online-empty__title').text(Lampa.Lang.translate('empty_title_two'));
      html.find('.online-empty__time').text(Lampa.Lang.translate('empty_text'));
      scroll.clear();
      scroll.append(html);
      this.loading(false);
    };
    this.noConnectToServer = function(er) {
      var html = Lampa.Template.get('lampac_does_not_answer', {});
      html.find('.online-empty__buttons').remove();
      html.find('.online-empty__title').text(Lampa.Lang.translate('title_error'));
      html.find('.online-empty__time').text(er && er.accsdb ? String(er.msg||'') : Lampa.Lang.translate('lampac_does_not_answer_text') .replace('{balanser}', (sources[balanser]&&sources[balanser].name)||'—'));
      scroll.clear();
      scroll.append(html);
      this.loading(false);
    };
    this.doesNotAnswer = function(er) {
      var _this9 = this;
      this.reset();
      var html = Lampa.Template.get('lampac_does_not_answer', {
        balanser: balanser
      });
      if(er && er.accsdb) html.find('.online-empty__title').text(String(er.msg||''));
	  
      // No 5-second cyclic timer: on one source it could retry forever,
      // and on multiple sources it caused unsolicited repeated requests.
      html.find('.online-empty__time').text(
        'Источник недоступен. Выберите другой из разрешённых.');
      html.find('.cancel').on('hover:enter',function(){clearInterval(balanser_timer);});
      html.find('.change').on('hover:enter',function(){
        filter.render().find('.filter--sort').trigger('hover:enter');
      });
      scroll.clear();
      scroll.append(html);
      this.loading(false);
    };
    this.getLastEpisode = function(items) {
      var last_episode = 0;
      items.forEach(function(e) {
        if (typeof e.episode !== 'undefined') last_episode = Math.max(last_episode, parseInt(e.episode));
      });
      return last_episode;
    };
    /**
     * Начать навигацию по файлам
     */
    this.start = function() {
      if (Lampa.Activity.active().activity !== this.activity) return;
      if (!initialized) {
        initialized = true;
        this.initialize();
      }
      // Keep Lampa's already-rendered card background. Recomputing its blur
      // during source-screen start caused a full-screen WebView paint hitch.
      Lampa.Controller.add('content', {
        toggle: function toggle() {
          Lampa.Controller.collectionSet(scroll.render(), files.render());
          Lampa.Controller.collectionFocus(last || false, scroll.render());
        },
        gone: function gone() {
          clearTimeout(balanser_timer);
        },
        up: function up() {
          if (Navigator.canmove('up')) {
            Navigator.move('up');
          } else Lampa.Controller.toggle('head');
        },
        down: function down() {
          Navigator.move('down');
        },
        right: function right() {
          if (Navigator.canmove('right')) Navigator.move('right');
          else filter.show(Lampa.Lang.translate('title_filter'), 'filter');
        },
        left: function left() {
          if (Navigator.canmove('left')) Navigator.move('left');
          else Lampa.Controller.toggle('menu');
        },
        back: this.back.bind(this)
      });
      Lampa.Controller.toggle('content');
    };
    this.render = function() {
      return files.render();
    };
    this.back = function() {
      Lampa.Activity.backward();
    };
    this.pause = function() {};
    this.stop = function() {};
    this.destroy = function() {
      this.__csoDead=true;
      ++drawGeneration;
      ++requestRevision;
      cancelFocusScroll();
      network.clear();
      if(typeof document!=='undefined'&&typeof $==='function')
        $(document).off('hover:long.csoSources');
      this.clearImages();
      files.destroy();
      scroll.destroy();
      clearInterval(balanser_timer);
    };
  }
  
  // Removed dead global search-provider registration and its network client.
  function startPlugin() {
    window.capsule_amedia_core_plugin = true;
    var manifst = {
      type: 'video',
      version: '0.23.0',
      name: 'Capsule Online · Skaz',
      description: 'Плагин для просмотра онлайн сериалов и фильмов',
      component: 'capsuleamedia',
      onContextMenu: function onContextMenu(object) {
        return {
          name: Lampa.Lang.translate('lampac_watch'),
          description: ''
        };
      },
      onContextLauch: function onContextLauch(object) {
        var movie = object || {};
        // The context/long-press action is the manual film source screen.
        // A normal tap on the Capsule Online button still auto-launches.
        if(!isEpisodeMedia(movie))return window.__capsuleOpenSkazChoices(movie);
        resetTemplates();
        Lampa.Component.add('capsuleamedia', component);
		
		var id = Lampa.Utils.hash(object.number_of_seasons ? object.original_name : object.original_title);
		var all = readClarificationStore();
		
		// --- Continue watching logic ---
		var isSeries = isEpisodeMedia(object);
		var continueEnabled = Lampa.Storage.field('amedia_auto_continue_play') === true;
		var file_id = Lampa.Utils.hash(object.number_of_seasons ? object.original_name : object.original_title);
		var watched = Lampa.Storage.cache('amedia_auto_watched_last', 5000, {});
		var watchedData = watched[file_id];

		if (isSeries && continueEnabled && watchedData && watchedData.season && watchedData.episode) {
		  var line = [];
		  
		  
		  line.push(Lampa.Lang.translate('torrent_serial_season') + ' ' + watchedData.season);
		  line.push(Lampa.Lang.translate('torrent_serial_episode') + ' ' + watchedData.episode);

		  Lampa.Select.show({
		    title: Lampa.Lang.translate('lampac_continue_watch'),
		    items: [
		      { title: '▶ ' + Lampa.Lang.translate('lampac_continue_yes') + ' (' + line.join(' · ') + ')', continue_yes: true },
		      { title: Lampa.Lang.translate('lampac_continue_no'), continue_no: true }
		    ],
		    onBack: function() {
		      Lampa.Controller.toggle('content');
		    },
		    onSelect: function(sel) {
		      Lampa.Select.close();

		      if (sel.continue_yes) {
                // Re-evaluate sources and voice when resuming; keep episode only.
                Lampa.Activity.push({
		          url: '',
		          title: Lampa.Lang.translate('title_online'),
		          component: 'capsuleamedia',
		          search: all[id] ? all[id] : object.title,
		          search_one: object.title,
		          search_two: object.original_title,
		          movie: object,
		          page: 1,
		          clarification: all[id] ? true : false,
		          lampac_continue_episode: parseInt(watchedData.episode) || 1,
                  lampac_continue_season: parseInt(watchedData.season) || 1
		        });
		      } else {
		        Lampa.Activity.push({
		          url: '',
		          title: Lampa.Lang.translate('title_online'),
		          component: 'capsuleamedia',
		          search: all[id] ? all[id] : object.title,
		          search_one: object.title,
		          search_two: object.original_title,
		          movie: object,
		          page: 1,
		          clarification: all[id] ? true : false
		        });
		      }
		    }
		  });
		} else {
        Lampa.Activity.push({
          url: '',
          title: Lampa.Lang.translate('title_online'),
          component: 'capsuleamedia',
          search: all[id] ? all[id] : object.title,
          search_one: object.title,
          search_two: object.original_title,
          movie: object,
          page: 1,
		  clarification: all[id] ? true : false
        });
		}
      }
    };
    Lampa.Manifest.plugins = manifst;
    Lampa.Lang.add({
      lampac_continue_watch: {
        ru: 'Продолжить просмотр?',
        en: 'Continue watching?',
        uk: 'Продовжити перегляд?',
        zh: '继续观看？'
      },
      lampac_continue_yes: {
        ru: 'Продолжить',
        en: 'Continue',
        uk: 'Продовжити',
        zh: '继续'
      },
      lampac_continue_no: {
        ru: 'Выбрать серию',
        en: 'Choose episode',
        uk: 'Обрати серію',
        zh: '选择剧集'
      },
      lampac_continue_enable: {
        ru: 'Предлагать продолжение',
        en: 'Suggest continue watching',
        uk: 'Пропонувати продовження',
        zh: '建议继续观看'
      },
      lampac_continue_enable_descr: {
        ru: 'Показывать диалог продолжения при входе в сериал',
        en: 'Show continue dialog when entering a series',
        uk: 'Показувати діалог продовження при вході в серіал',
        zh: '进入剧集时显示继续对话框'
      },
      lampac_watch: { //
        ru: 'Смотреть онлайн',
        en: 'Watch online',
        uk: 'Дивитися онлайн',
        zh: '在线观看'
      },
      lampac_video: { //
        ru: 'Видео',
        en: 'Video',
        uk: 'Відео',
        zh: '视频'
      },
      lampac_no_watch_history: {
        ru: 'Нет истории просмотра',
        en: 'No browsing history',
        ua: 'Немає історії перегляду',
        zh: '没有浏览历史'
      },
      lampac_nolink: {
        ru: 'Не удалось извлечь ссылку',
        uk: 'Неможливо отримати посилання',
        en: 'Failed to fetch link',
        zh: '获取链接失败'
      },
      lampac_balanser: { //
        ru: 'Источник',
        uk: 'Джерело',
        en: 'Source',
        zh: '来源'
      },
      helper_online_file: { //
        ru: 'Удерживайте клавишу "ОК" для вызова контекстного меню',
        uk: 'Утримуйте клавішу "ОК" для виклику контекстного меню',
        en: 'Hold the "OK" key to bring up the context menu',
        zh: '按住“确定”键调出上下文菜单'
      },
      title_online: { //
        ru: 'Онлайн',
        uk: 'Онлайн',
        en: 'Online',
        zh: '在线的'
      },
      lampac_voice_subscribe: { //
        ru: 'Подписаться на перевод',
        uk: 'Підписатися на переклад',
        en: 'Subscribe to translation',
        zh: '订阅翻译'
      },
      lampac_voice_success: { //
        ru: 'Вы успешно подписались',
        uk: 'Ви успішно підписалися',
        en: 'You have successfully subscribed',
        zh: '您已成功订阅'
      },
      lampac_voice_error: { //
        ru: 'Возникла ошибка',
        uk: 'Виникла помилка',
        en: 'An error has occurred',
        zh: '发生了错误'
      },
      lampac_clear_all_marks: { //
        ru: 'Очистить все метки',
        uk: 'Очистити всі мітки',
        en: 'Clear all labels',
        zh: '清除所有标签'
      },
      lampac_clear_all_timecodes: { //
        ru: 'Очистить все тайм-коды',
        uk: 'Очистити всі тайм-коди',
        en: 'Clear all timecodes',
        zh: '清除所有时间代码'
      },
      lampac_change_balanser: { //
        ru: 'Изменить балансер',
        uk: 'Змінити балансер',
        en: 'Change balancer',
        zh: '更改平衡器'
      },
      lampac_balanser_dont_work: { //
        ru: 'Поиск не дал результатов',
        uk: 'Пошук не дав результатів',
        en: 'Search  did not return any results',
        zh: '搜索 未返回任何结果'
      },
      lampac_balanser_timeout: { //
        ru: 'Источник будет переключен автоматически через <span class="timeout">10</span> секунд.',
        uk: 'Джерело буде автоматично переключено через <span class="timeout">10</span> секунд.',
        en: 'The source will be switched automatically after <span class="timeout">10</span> seconds.',
        zh: '平衡器将在<span class="timeout">10</span>秒内自动切换。'
      },
      lampac_does_not_answer_text: {
        ru: 'Поиск на ({balanser}) не дал результатов',
        uk: 'Пошук на ({balanser}) не дав результатів',
        en: 'Search on ({balanser}) did not return any results',
        zh: '搜索 ({balanser}) 未返回任何结果'
      }
    });
    Lampa.Template.add('lampac_css', "\n        <style>\n        @charset 'UTF-8';.online-prestige{position:relative;-webkit-border-radius:.3em;border-radius:.3em;background-color:rgba(0,0,0,0.3);display:-webkit-box;display:-webkit-flex;display:-moz-box;display:-ms-flexbox;display:flex}.online-prestige__body{padding:1.2em;line-height:1.3;-webkit-box-flex:1;-webkit-flex-grow:1;-moz-box-flex:1;-ms-flex-positive:1;flex-grow:1;position:relative}@media screen and (max-width:480px){.online-prestige__body{padding:.8em 1.2em}}.online-prestige__img{position:relative;width:13em;-webkit-flex-shrink:0;-ms-flex-negative:0;flex-shrink:0;min-height:8.2em}.online-prestige__img>img{position:absolute;top:0;left:0;width:100%;height:100%;-o-object-fit:cover;object-fit:cover;-webkit-border-radius:.3em;border-radius:.3em;opacity:0;-webkit-transition:opacity .3s;-o-transition:opacity .3s;-moz-transition:opacity .3s;transition:opacity .3s}.online-prestige__img--loaded>img{opacity:1}@media screen and (max-width:480px){.online-prestige__img{width:7em;min-height:6em}}.online-prestige__folder{padding:1em;-webkit-flex-shrink:0;-ms-flex-negative:0;flex-shrink:0}.online-prestige__folder>svg{width:4.4em !important;height:4.4em !important}.online-prestige__viewed{position:absolute;top:1em;left:1em;background:rgba(0,0,0,0.45);-webkit-border-radius:100%;border-radius:100%;padding:.25em;font-size:.76em}.online-prestige__viewed>svg{width:1.5em !important;height:1.5em !important}.online-prestige__episode-number{position:absolute;top:0;left:0;right:0;bottom:0;display:-webkit-box;display:-webkit-flex;display:-moz-box;display:-ms-flexbox;display:flex;-webkit-box-align:center;-webkit-align-items:center;-moz-box-align:center;-ms-flex-align:center;align-items:center;-webkit-box-pack:center;-webkit-justify-content:center;-moz-box-pack:center;-ms-flex-pack:center;justify-content:center;font-size:2em}.online-prestige__loader{position:absolute;top:50%;left:50%;width:2em;height:2em;margin-left:-1em;margin-top:-1em;background:url(./img/loader.svg) no-repeat center center;-webkit-background-size:contain;-o-background-size:contain;background-size:contain}.online-prestige__head,.online-prestige__footer{display:-webkit-box;display:-webkit-flex;display:-moz-box;display:-ms-flexbox;display:flex;-webkit-box-pack:justify;-webkit-justify-content:space-between;-moz-box-pack:justify;-ms-flex-pack:justify;justify-content:space-between;-webkit-box-align:center;-webkit-align-items:center;-moz-box-align:center;-ms-flex-align:center;align-items:center}.online-prestige__timeline{margin:.8em 0}.online-prestige__timeline>.time-line{display:block !important}.online-prestige__title{font-size:1.7em;overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:1;line-clamp:1;-webkit-box-orient:vertical}@media screen and (max-width:480px){.online-prestige__title{font-size:1.4em}}.online-prestige__time{padding-left:2em}.online-prestige__info{display:-webkit-box;display:-webkit-flex;display:-moz-box;display:-ms-flexbox;display:flex;-webkit-box-align:center;-webkit-align-items:center;-moz-box-align:center;-ms-flex-align:center;align-items:center}.online-prestige__info>*{overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:1;line-clamp:1;-webkit-box-orient:vertical}.online-prestige__quality{padding-left:1em;white-space:nowrap}.online-prestige__scan-file{position:absolute;bottom:0;left:0;right:0}.online-prestige__scan-file .broadcast__scan{margin:0}.online-prestige .online-prestige-split{font-size:.8em;margin:0 1em;-webkit-flex-shrink:0;-ms-flex-negative:0;flex-shrink:0}.online-prestige+.online-prestige{margin-top:1.5em}.online-prestige--folder .online-prestige__footer{margin-top:.8em}.online-prestige-watched{padding:1em}.online-prestige-watched__icon>svg{width:1.5em;height:1.5em}.online-prestige-watched__body{padding-left:1em;padding-top:.1em;display:-webkit-box;display:-webkit-flex;display:-moz-box;display:-ms-flexbox;display:flex;-webkit-flex-wrap:wrap;-ms-flex-wrap:wrap;flex-wrap:wrap}.online-prestige-watched__body>span+span::before{content:' ● ';vertical-align:top;display:inline-block;margin:0 .5em}.online-prestige-rate{display:-webkit-inline-box;display:-webkit-inline-flex;display:-moz-inline-box;display:-ms-inline-flexbox;display:inline-flex;-webkit-box-align:center;-webkit-align-items:center;-moz-box-align:center;-ms-flex-align:center;align-items:center}.online-prestige-rate>svg{width:1.3em !important;height:1.3em !important}.online-prestige-rate>span{font-weight:600;font-size:1.1em;padding-left:.7em}.online-empty{line-height:1.4}.online-empty__title{font-size:1.8em;margin-bottom:.3em}.online-empty__time{font-size:1.2em;font-weight:300;margin-bottom:1.6em}.online-empty__buttons{display:-webkit-box;display:-webkit-flex;display:-moz-box;display:-ms-flexbox;display:flex}.online-empty__buttons>*+*{margin-left:1em}.online-empty__button{background:rgba(0,0,0,0.3);font-size:1.2em;padding:.5em 1.2em;-webkit-border-radius:.2em;border-radius:.2em;margin-bottom:2.4em}.online-empty__button.focus{background:#fff;color:black}.online-empty__templates .online-empty-template:nth-child(2){opacity:.5}.online-empty__templates .online-empty-template:nth-child(3){opacity:.2}.online-empty-template{background-color:rgba(255,255,255,0.3);padding:1em;display:-webkit-box;display:-webkit-flex;display:-moz-box;display:-ms-flexbox;display:flex;-webkit-box-align:center;-webkit-align-items:center;-moz-box-align:center;-ms-flex-align:center;align-items:center;-webkit-border-radius:.3em;border-radius:.3em}.online-empty-template>*{background:rgba(0,0,0,0.3);-webkit-border-radius:.3em;border-radius:.3em}.online-empty-template__ico{width:4em;height:4em;margin-right:2.4em}.online-empty-template__body{height:1.7em;width:70%}.online-empty-template+.online-empty-template{margin-top:1em}\n        </style>\n    ");
    $('body').append(Lampa.Template.get('lampac_css', {}, true));

    function resetTemplates() {
      Lampa.Template.add('lampac_prestige_full', "<div class=\"online-prestige online-prestige--full selector\">\n            <div class=\"online-prestige__img\">\n                <img alt=\"\">\n                <div class=\"online-prestige__loader\"></div>\n            </div>\n            <div class=\"online-prestige__body\">\n                <div class=\"online-prestige__head\">\n                    <div class=\"online-prestige__title\">{title}</div>\n                    <div class=\"online-prestige__time\">{time}</div>\n                </div>\n\n                <div class=\"online-prestige__timeline\"></div>\n\n                <div class=\"online-prestige__footer\">\n                    <div class=\"online-prestige__info\">{info}</div>\n                    <div class=\"online-prestige__quality\">{quality}</div>\n                </div>\n            </div>\n        </div>");
      Lampa.Template.add('lampac_content_loading', "<div class=\"online-empty\">\n            <div class=\"broadcast__scan\"><div></div></div>\n\t\t\t\n            <div class=\"online-empty__templates\">\n                <div class=\"online-empty-template selector\">\n                    <div class=\"online-empty-template__ico\"></div>\n                    <div class=\"online-empty-template__body\"></div>\n                </div>\n                <div class=\"online-empty-template\">\n                    <div class=\"online-empty-template__ico\"></div>\n                    <div class=\"online-empty-template__body\"></div>\n                </div>\n                <div class=\"online-empty-template\">\n                    <div class=\"online-empty-template__ico\"></div>\n                    <div class=\"online-empty-template__body\"></div>\n                </div>\n            </div>\n        </div>");
      Lampa.Template.add('lampac_does_not_answer', "<div class=\"online-empty\">\n            <div class=\"online-empty__title\">\n                #{lampac_balanser_dont_work}\n            </div>\n            <div class=\"online-empty__time\">\n                #{lampac_balanser_timeout}\n            </div>\n            <div class=\"online-empty__buttons\">\n                <div class=\"online-empty__button selector cancel\">#{cancel}</div>\n                <div class=\"online-empty__button selector change\">#{lampac_change_balanser}</div>\n            </div>\n            <div class=\"online-empty__templates\">\n                <div class=\"online-empty-template\">\n                    <div class=\"online-empty-template__ico\"></div>\n                    <div class=\"online-empty-template__body\"></div>\n                </div>\n                <div class=\"online-empty-template\">\n                    <div class=\"online-empty-template__ico\"></div>\n                    <div class=\"online-empty-template__body\"></div>\n                </div>\n                <div class=\"online-empty-template\">\n                    <div class=\"online-empty-template__ico\"></div>\n                    <div class=\"online-empty-template__body\"></div>\n                </div>\n            </div>\n        </div>");
      Lampa.Template.add('lampac_prestige_rate', "<div class=\"online-prestige-rate\">\n            <svg width=\"17\" height=\"16\" viewBox=\"0 0 17 16\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n                <path d=\"M8.39409 0.192139L10.99 5.30994L16.7882 6.20387L12.5475 10.4277L13.5819 15.9311L8.39409 13.2425L3.20626 15.9311L4.24065 10.4277L0 6.20387L5.79819 5.30994L8.39409 0.192139Z\" fill=\"#fff\"></path>\n            </svg>\n            <span>{rate}</span>\n        </div>");
      Lampa.Template.add('lampac_prestige_folder', "<div class=\"online-prestige online-prestige--folder selector\">\n            <div class=\"online-prestige__folder\">\n                <svg viewBox=\"0 0 128 112\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n                    <rect y=\"20\" width=\"128\" height=\"92\" rx=\"13\" fill=\"white\"></rect>\n                    <path d=\"M29.9963 8H98.0037C96.0446 3.3021 91.4079 0 86 0H42C36.5921 0 31.9555 3.3021 29.9963 8Z\" fill=\"white\" fill-opacity=\"0.23\"></path>\n                    <rect x=\"11\" y=\"8\" width=\"106\" height=\"76\" rx=\"13\" fill=\"white\" fill-opacity=\"0.51\"></rect>\n                </svg>\n            </div>\n            <div class=\"online-prestige__body\">\n                <div class=\"online-prestige__head\">\n                    <div class=\"online-prestige__title\">{title}</div>\n                    <div class=\"online-prestige__time\">{time}</div>\n                </div>\n\n                <div class=\"online-prestige__footer\">\n                    <div class=\"online-prestige__info\">{info}</div>\n                </div>\n            </div>\n        </div>");
      Lampa.Template.add('lampac_prestige_watched', "<div class=\"online-prestige online-prestige-watched selector\">\n            <div class=\"online-prestige-watched__icon\">\n                <svg width=\"21\" height=\"21\" viewBox=\"0 0 21 21\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n                    <circle cx=\"10.5\" cy=\"10.5\" r=\"9\" stroke=\"currentColor\" stroke-width=\"3\"/>\n                    <path d=\"M14.8477 10.5628L8.20312 14.399L8.20313 6.72656L14.8477 10.5628Z\" fill=\"currentColor\"/>\n                </svg>\n            </div>\n            <div class=\"online-prestige-watched__body\">\n                \n            </div>\n        </div>");
    }
    var button = '<div class="full-start__button selector view--online capsule-online--button">' +
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" fill="none" aria-hidden="true">' +
      '<rect x="4" y="4" width="40" height="40" rx="13" stroke="currentColor" stroke-width="2.3"/>' +
      '<path d="M19 14.5L34 24 19 33.5V14.5Z" fill="currentColor"/></svg>' +
      '<span>Capsule Online</span></div>';
    Lampa.Component.add('capsuleamedia', component); //то же самое
    resetTemplates();

    var lastOpenChoicesAt=0;
    window.__capsuleOpenSkazChoices=function(movie){
      if(!movie||!Lampa.Activity||!Lampa.Activity.push)return false;
      if(Date.now()-lastOpenChoicesAt<650)return true;
      lastOpenChoicesAt=Date.now();
      // Opening the manual picker cancels in-flight auto playback so a
      // slow 4K probe cannot unexpectedly launch over the source menu.
      if(capsuleFilmJob&&!capsuleFilmJob.closed)capsuleFilmJob.close();
      var card=Object.assign({},movie);
      var title=String(card.title||card.name||'');
      try{
        Lampa.Activity.push({
          url:'',title:Lampa.Lang.translate('title_online'),
          component:'capsuleamedia',movie:card,page:1,
          search:title,search_one:title,
          search_two:String(card.original_title||card.original_name||title)
        });
        return true;
      }catch(error){
        if(Lampa.Noty&&Lampa.Noty.show)Lampa.Noty.show('Не удалось открыть список источников');
        return false;
      }
    };

    function addButton(e) {
    var activityRoot = null;
    try { activityRoot = Lampa.Activity.active().activity.render(); } catch (ignored) {}
    if (!e || !e.movie || !activityRoot || !activityRoot.length) return;
    if (activityRoot.find('.capsule-online--button').length) return;
    var btn = $(Lampa.Lang.translate(button));
    var lastActivated=0,longPressedAt=0;
    function openLong(event){
        if(event&&event.preventDefault)event.preventDefault();
        if(event&&event.stopImmediatePropagation)event.stopImmediatePropagation();
        var now=Date.now();
        if(now-longPressedAt<700)return;
        longPressedAt=now;
        window.__capsuleOpenSkazChoices(e.movie||{});
    }
    function activate(){
        // Some WebViews fire a normal click after a long tap. Suppress it
        // so auto-play doesn't race the manual source picker.
        var now=Date.now();
        if(now-longPressedAt<1100)return;
        if (now-lastActivated<650)return;
        lastActivated=now;
        var movie = e.movie || {};
        if (!isEpisodeMedia(movie)) {
            window.__capsuleFilmAutoLaunch(movie);
            return;
        }
        resetTemplates();
        Lampa.Component.add('capsuleamedia', component);
        
        var id = Lampa.Utils.hash(e.movie.number_of_seasons ? e.movie.original_name : e.movie.original_title);
        var all = readClarificationStore();
        
        // --- Continue watching logic ---
        var isSeries = isEpisodeMedia(e.movie);
        var continueEnabled = Lampa.Storage.field('amedia_auto_continue_play') === true;
        var file_id = Lampa.Utils.hash(e.movie.number_of_seasons ? e.movie.original_name : e.movie.original_title);
        var watched = Lampa.Storage.cache('amedia_auto_watched_last', 5000, {});
        var watchedData = watched[file_id];

        if (isSeries && continueEnabled && watchedData && watchedData.season && watchedData.episode) {
          var line = [];
          
          
          line.push(Lampa.Lang.translate('torrent_serial_season') + ' ' + watchedData.season);
          line.push(Lampa.Lang.translate('torrent_serial_episode') + ' ' + watchedData.episode);

          Lampa.Select.show({
            title: Lampa.Lang.translate('lampac_continue_watch'),
            items: [
              { title: '▶ ' + Lampa.Lang.translate('lampac_continue_yes') + ' (' + line.join(' · ') + ')', continue_yes: true },
              { title: Lampa.Lang.translate('lampac_continue_no'), continue_no: true }
            ],
            onBack: function() {
              Lampa.Controller.toggle('content');
            },
            onSelect: function(sel) {
              Lampa.Select.close();

              if (sel.continue_yes) {
                // Resume episode with a freshly chosen source and dub.
                Lampa.Activity.push({
                  url: '',
                  title: Lampa.Lang.translate('title_online'),
                  component: 'capsuleamedia',
                  search: all[id] ? all[id] : e.movie.title,
                  search_one: e.movie.title,
                  search_two: e.movie.original_title,
                  movie: e.movie,
                  page: 1,
                  clarification: all[id] ? true : false,
                  lampac_continue_episode: parseInt(watchedData.episode) || 1,
                  lampac_continue_season: parseInt(watchedData.season) || 1
                });
              } else {
                Lampa.Activity.push({
                  url: '',
                  title: Lampa.Lang.translate('title_online'),
                  component: 'capsuleamedia',
                  search: all[id] ? all[id] : e.movie.title,
                  search_one: e.movie.title,
                  search_two: e.movie.original_title,
                  movie: e.movie,
                  page: 1,
                  clarification: all[id] ? true : false
                });
              }
            }
          });
        } else {
        Lampa.Activity.push({
            url: '',
            title: Lampa.Lang.translate('title_online'),
            component: 'capsuleamedia',
            search: all[id] ? all[id] : e.movie.title,
            search_one: e.movie.title,
            search_two: e.movie.original_title,
            movie: e.movie,
            page: 1,
            clarification: all[id] ? true : false
        });
        }
    }
    btn.on('hover:long contextmenu',openLong);
    btn.on('hover:enter',activate);
    btn.on('click',activate);

    // Place Capsule Online in the full-screen action row. The old
    // .view--torrent anchor is not present in all current Lampa layouts.
    var bar = activityRoot.find('.full-start-new__buttons, .full-start__buttons, .full-start__buttons-container').first();
    var first = activityRoot.find('.full-start__button').first();
    if (bar.length) bar.prepend(btn);
    else if (first.length) first.before(btn);
    else if (e.render && e.render.length) e.render.after(btn);
    else activityRoot.find('.full-start').first().prepend(btn);
    btn.attr('data-capsule-online','1');
}
    Lampa.Listener.follow('full', function(e) {
      if (e.type == 'complite') {
        addButton({
          render: e.object.activity.render().find('.view--torrent'),
          movie: e.data.movie
        });
      }
    });
    try {
      if (Lampa.Activity.active().component == 'full') {
        addButton({
          render: Lampa.Activity.active().activity.render().find('.view--torrent'),
          movie: Lampa.Activity.active().card
        });
      }
    } catch (e) {}
    if (Lampa.Manifest.app_digital >= 177) {
      var balansers_sync = ["filmix", 'filmixtv', "fxapi", "rezka", "rhsprem", "lumex", "videodb", "collaps", "collaps-dash", "hdvb", "zetflix", "kodik", "ashdi", "kinoukr", "kinotochka", "remux", "iframevideo", "cdnmovies", "anilibria", "animedia", "animego", "animevost", "animebesst", "redheadsound", "alloha", "animelib", "moonanime", "kinopub", "vibix", "vdbmovies", "fancdn", "cdnvideohub", "vokino", "rc/filmix", "rc/fxapi", "rc/rhs", "vcdn", "videocdn", "mirage", "hydraflix","videasy","vidsrc","movpi","vidlink","twoembed","autoembed","smashystream","autoembed","rgshows", "pidtor", "videoseed", "iptvonline", "veoveo"];
      balansers_sync.forEach(function(name) {
        Lampa.Storage.sync('amedia_auto_progress_' + name, 'object_object');
      });
      Lampa.Storage.sync('amedia_auto_watched_last', 'object_object');
      Lampa.Storage.sync('amedia_auto_continue_play', 'bool');
    }
  }
  if (!window.capsule_amedia_core_plugin) startPlugin();
})();
/* CAPSULE AUTOPICK MODULE START */
/*
 * Capsule Online for Lampa 0.23.0
 * Single Skaz transport for both films and series; automatic matching and source selection.
 *
 * Contains the source adapter and automation without loading another plugin.
 * Media links and remote authentication still come from the source servers.
 * Installs by itself; original Skaz plugin is optional.
 */
(function (root) {
    'use strict';
    if (root.__capsuleSkazOnline) return;
    root.__capsuleSkazOnline = true;

    var L = null, installed = false, cssInstalled = false, settingsInstalled = false;
    var PREFIX = 'capsule_skaz_online_';
    var COMPONENT = 'capsule_skaz_online';
    var BOOT_ATTEMPTS = 0;
    function get(key, fallback) {
        try {
            var value = L.Storage.get(PREFIX + key, fallback);
            if (value === undefined || value === null) return fallback;
            if (typeof fallback === 'boolean') return value === true || value === 'true' || value === 1;
            return value;
        } catch (ignored) { return fallback; }
    }
    function info(message) {
        try { if (L.Noty && L.Noty.show) L.Noty.show(message); } catch (ignored) {}
    }
    function debug(message) {
        if (get('debug', false) && root.console && root.console.log)
            root.console.log('[Capsule Online]', message);
    }
    function isSeries(movie) {
        if(root.__capsuleFilmHelpers)return root.__capsuleFilmHelpers.isSeries(movie);
        if(!movie)return false;
        if(movie.media_type==='movie'||movie.type==='movie')return false;
        return !!(movie.media_type==='tv'||movie.type==='tv'||
            Number(movie.number_of_seasons)>0||(movie.name&&!movie.title&&!movie.release_date));
    }
    function keyOf(item) {
        if(root.__capsuleSerialKey)return root.__capsuleSerialKey(item);
        var id=String(item&&item.balanser||'').trim().toLowerCase();
        if(id)return id;
        var name=String(item&&item.name||'').toLowerCase().trim();
        if(/^hd\s*[-.]?\s*rezka\b/.test(name))return 'hdrezka';
        if(/^(?:мир\s*кино|mir\s*kino|mirkino)\s*[-.]?\s*z\b/i.test(name))
        return 'mirkinoz';
        if(/^skaz\s+tv\b/.test(name))return 'skaztv';
        return name.split(/[\s.:/-]+/)[0];
    }
    function resolution(name) {
        var value = String(name || '').toLowerCase();
        var match = value.match(/(?:^|[^\d])(2160|1440|1080|720|576|540|480|360)\s*[pр]?/);
        if (match) return Number(match[1]);
        if (/4k|uhd/.test(value)) return 2160;
        if (/2k|qhd/.test(value)) return 1440;
        if (/full.?hd|fhd/.test(value)) return 1080;
        if (/\bhd\b/.test(value)) return 720;
        if (/\bsd\b/.test(value)) return 480;
        return 0;
    }
    function qualityLimit() {
        var mode = String(get('quality', 'auto'));
        if (mode === 'max') return 4320;
        if (mode === '2160') return 2160;
        if (mode === '1080') return 1080;
        if (mode === '720') return 720;
        var height = 0, network = 0;
        try {
            height = Math.max(root.screen ? root.screen.height || 0 : 0,
                root.screen ? root.screen.width || 0 : 0);
            network = root.navigator && root.navigator.connection &&
                Number(root.navigator.connection.downlink) || 0;
        } catch (ignored) {}
        // The previous default silently capped 4K to Full HD and then
        // selected the 720 fallback. An UNKNOWN TV bandwidth is not slow.
        // Explicit quality settings still override this automatic ceiling.
        if(root.__capsuleFilmPriorities&&
            root.__capsuleFilmPriorities.mode()==='normal')return 2160;
        if(network&&network<7)return 720;
        if(network&&network<20)return 1080;
        return 2160;
    }
    // Curated series providers only. A large quality claim does not make an
    // unknown aggregator (Umbrella etc.) a safe automatic choice.
    function providerFamily(item) {
        var key=keyOf(item),name=String(item&&item.name||'').toLowerCase().trim();
        if(root.__capsuleFilmPriorities&&root.__capsuleFilmPriorities.source){
            var family=root.__capsuleFilmPriorities.source(item);
            if(['collaps','kodik','redheadsound','vibix'].indexOf(family)>=0)
                return family;
        }
        if(key==='kpu'||key==='kpu-tv')return 'kinopub';
        if(/^(?:hd)?rezka(?:tv)?$/.test(key)||
            (key==='hd'&&/^hd\s*[-.]?\s*rezka\b/.test(name)))return 'rezka';
        if(/^alloha(?:tv)?$/.test(key))return 'alloha';
        if(/^(?:rc\/)?(?:filmix(?:tv)?|fxapi)$/.test(key))return 'filmix';
        if(/^skaz(?:tv|online)?$/.test(key))return 'skaz';
        if(/^(?:kinopub|kpu|kpu-tv)$/.test(key))return 'kinopub';
        if(/^(?:mirkino|mirkinoz|mir-kino(?:-z)?|mir_kino(?:_z)?|mirkino-z|mirkinotv-z)$/.test(key)||
            /^(?:мир\s*кино|mir\s*kino|mirkino)\s*[-.]?\s*z/i.test(name))
            return 'mirkinoz';
        return '';
    }
    function sourceOrder(rows,movie){
        var film=!!movie&&!isSeries(movie);
        var order=[],latest=Object.create(null),available=
            Array.isArray(rows)?rows:rows&&Array.isArray(rows.online)?rows.online:[];
        available.forEach(function(row){
            if(!row||typeof row!=='object')return;
            // Only curated providers received from Skaz may be auto-picked.
            if(!providerFamily(row)||
                (!film&&root.__capsuleSerialAllowed&&
                 !root.__capsuleSerialAllowed(row)))return;
            if(root.__capsuleFilmPriorities&&root.__capsuleFilmPriorities.enabled&&
                !root.__capsuleFilmPriorities.enabled(film?row:{
                  balanser:root.__capsuleSerialFamily?
                    root.__capsuleSerialFamily(row):providerFamily(row)
                }))return;
            if(film&&root.__capsuleFilmHelpers&&
                !root.__capsuleFilmHelpers.allow(movie,row))return;
            var key=film?keyOf(row):
                (root.__capsuleSerialFamily?
                 root.__capsuleSerialFamily(row):providerFamily(row));
            if(!key)return;
            if(!Object.prototype.hasOwnProperty.call(latest,key))order.push(key);
            latest[key]=row; // final status wins
        });
        var result=order.filter(function(key){
            var row=latest[key],url=String(row&&row.url||'');
            return !!(row&&/^(?:https?:\/\/|\/(?!\/))/i.test(url)&&
                row.show!==false&&row.show!=='false'&&row.show!==0&&row.show!=='0');
        }).map(function(key,index){
            var row=latest[key];
            return {key:key,name:String(row.name||key),
                score:film&&root.__capsuleFilmHelpers?
                    root.__capsuleFilmHelpers.sourceScore(row):0,
                original:index,
                seasonCount:Number(row.season_count||row.seasons_count||0)||0};
        });
        if(film)result.sort(function(a,b){
            if(root.__capsuleFilmPriorities&&root.__capsuleFilmPriorities.sources){
                var order=root.__capsuleFilmPriorities.sources();
                var aa=providerFamily({balanser:a.key,name:a.name});
                var bb=providerFamily({balanser:b.key,name:b.name});
                var ia=order.indexOf(aa),ib=order.indexOf(bb);
                return (ia<0?999:ia)-(ib<0?999:ib)||a.original-b.original;
            }
            return b.score-a.score||a.original-b.original;
        });
        else {
            var rank=['alloha','hdrezka','vibix','kodik','kinopub',
              'redheadsound','filmix'];
            result.sort(function(a,b){
                return rank.indexOf(a.key)-rank.indexOf(b.key)||
                  b.seasonCount-a.seasonCount||a.original-b.original;
            });
        }
        return result;
    }
        function voiceScore(label){
        if(root.__capsuleFilmVoiceRank)return root.__capsuleFilmVoiceRank(label)*10;
        if(root.__capsuleNoAdVoice&&root.__capsuleNoAdVoice(label))return -10000;
        // Fallback until bundled core registers on older Lampa builds.
        var value=String(label||'').toLowerCase();
        if(/red.?head.?sound|\brhs\b/.test(value))return 80;
        if(/lost.?film/.test(value))return 60;
        if(/дубляж|дублирован/.test(value))return 70;
        if(/rezka|резка/.test(value))return 50;
        if(/tv.?show|тв.?шоу/.test(value))return 40;
        if(/кубик\s*в\s*кубе/.test(value))return 30;
        if(/любительск|нейросеть|одноголос/.test(value))return -10;
        return 10;
    }
    function qualityCandidate(qualityMap) {
        if (!qualityMap || typeof qualityMap !== 'object'||Array.isArray(qualityMap))return null;
        var limit = qualityLimit(), best = null, fallback = null,
            minimum = Number(get('min_quality','any'))||0;
        Object.keys(qualityMap).forEach(function(label){
            var url = qualityMap[label];
            if (url && typeof url === 'object') url = url.url || url.src;
            if (typeof url !== 'string') return;
            url = url.split(' or ')[0].trim();
            if (!/^https?:\/\//i.test(url)) return;
            var height = resolution(label);
            if (!height||height<minimum) return;
            var item = {label:label,url:url,height:height};
            if (!fallback || height < fallback.height) fallback = item;
            if (height <= limit && (!best || height > best.height)) best = item;
        });
        return best || (minimum?null:fallback);
    }
    function filmVideoScore(video){
        var policy=root.__capsuleSelectionV3;
        var label=String(video&&(video.voice_name||video.translate_voice||
            video.text||video.title)||'');
        if(policy)return policy.score({file:video,stream:video,voice:label,
            provider:{balanser:''}});
        // Only for shells which run the UI wrapper without the embedded core.
        // Normal Lampa always uses the exact same v3 selection engine above.
        if(/\b(?:camrip|cam|ts|telesync|trailer|teaser|sample)\b|экранка|трейлер/i.test(label))
            return -100000;
        var q=qualityCandidate(video&&(video.qualitys||video.quality));
        return (q?q.height:resolution(label))*100+Math.max(0,voiceScore(label))*10;
    }
    function decorate(instance, session) {
        try {
            var view = instance.render && instance.render();
            var jq=root.jQuery||root.$||(typeof $==='function'?$:null);
            var $view=view&&view.jquery?view:(jq&&jq(view));
            if (!$view || !$view.length) return;
            $view.addClass('cso-root');
            if (session._lastView !== $view[0]) { session._lastView=$view[0];session._lastStatus=''; }
            var status = $view.find('.cso-status');
            if (!status.length) {
                status = jq('<div class="cso-status" aria-live="polite"></div>');
                // Files are appended asynchronously, whereas the filter header
                // is present immediately after the source's initialize().
                // Place the indicator in the head, outside the scroll item list:
                // no extra D-pad selector or shifted episode indexes.
                var head = $view.find('.torrent-filter').first();
                if (head.length) head.after(status);
                else $view.prepend(status);
            }
            var current = L.Storage.get('amedia_auto_active_balanser', '') || 'выбирается';
            var label=session.status==='recover' ? 'Подключаем резервный источник · '+current : '';
            if(session._lastStatus!==label){status.text(label);session._lastStatus=label;}
            if (session.status) status.attr('data-state', session.status);
        } catch (error) { debug('UI: '+error.message); }
    }
    function sameActivity(instance) {
        try { return L.Activity.active().activity === instance.activity; }
        catch (ignored) { return false; }
    }
    // Both films and series share one Skaz component and playback engine.
    // Automatic recovery stays on this screen; manual source selection wins.
    function enhance(instance,movie){
        if(!instance||instance.__csoEnhanced)return instance;
        instance.__csoEnhanced=true;
        var session={sourceOrder:[],bad:Object.create(null),
            attempts:0,status:'ready',autoSwitch:false,manualSelection:false,
            voiceTried:Object.create(null)};
        instance.__csoSession=session;
        var raw={
            startSource:instance.startSource,change:instance.changeBalanser,
            parse:instance.parse,quality:instance.setDefaultQuality,
            getFileUrl:instance.getFileUrl,
            display:instance.display,error:instance.doesNotAnswer,
            start:instance.start
        };
        function activeSource(){
            try{return String(L.Storage.get('amedia_auto_active_balanser',''));}
            catch(e){return '';}
        }
        function recoveryOrder(rows){
            var items=sourceOrder(rows,movie),scores=instance.__csoSeriesSourceScores;
            if(isSeries(movie)&&scores){
                items.sort(function(a,b){
                    var x=Object.prototype.hasOwnProperty.call(scores,a.key)?scores[a.key]:0,
                        y=Object.prototype.hasOwnProperty.call(scores,b.key)?scores[b.key]:0;
                    return y-x||a.original-b.original||
                        a.key.localeCompare(b.key);
                });
            }
            return items;
        }
        function fallback(reason){
            if(!get('auto',true)||!get('fallback',true)||
               session.manualSelection||session.attempts>=8||
               !sameActivity(instance))return false;
            // A lifeevents update may contain only one provider; the core
            // catalog holds the complete set of available alternatives.
            if(typeof instance.currentSourceRows==='function'){
                var all=recoveryOrder(instance.currentSourceRows());
                if(all.length)session.sourceOrder=all;
            }
            var current=activeSource();
            if(current)session.bad[current]=true;
            var next=session.sourceOrder.filter(function(row){
                var policy=root.__capsuleFilmPriorities;
                return row.key!==current&&!session.bad[row.key]&&
                    (!policy||!policy.enabled||policy.enabled({balanser:row.key,name:row.name}));
            })[0];
            if(!next)return false;
            session.attempts++;
            session.bad[next.key]=true;
            session.status='recover';
            session.autoSwitch=true;
            try{
                var ok=raw.change.call(instance,next.key);
                if(ok===false)return fallback(reason);
                decorate(instance,session);
                debug('Резервный источник '+next.name+' · '+reason);
                info('Skaz: пробуем '+next.name);
                return true;
            }catch(e){debug('Ошибка резервного источника: '+e.message);return false;}
            finally{session.autoSwitch=false;}
        }
        if(typeof raw.startSource==='function')instance.startSource=function(rows){
            session.sourceOrder=recoveryOrder(rows);
            var result=raw.startSource.apply(this,arguments);
            if(result&&typeof result.then==='function')
                return result.then(function(value){
                    if(typeof instance.currentSourceRows==='function'){
                        var all=recoveryOrder(instance.currentSourceRows());
                        if(all.length)session.sourceOrder=all;
                    }
                    return value;
                });
            return result;
        };
        if(typeof raw.change==='function')instance.changeBalanser=function(key){
            var result=raw.change.apply(this,arguments);
            if(result===false)return false;
            if(!session.autoSwitch){
                session.manualSelection=true;
                session.bad=Object.create(null);
                session.attempts=0;
                session.status='ready';
            }
            decorate(instance,session);
            return result;
        };
        // Native parse handles voice automation; avoid a competing wrapper.
        if(typeof raw.quality==='function')instance.setDefaultQuality=function(data){
            var result=raw.quality.apply(this,arguments);
            if(result===false)return false;
            if(get('auto',true)){
                var selected=qualityCandidate(data&&data.quality);
                if(selected){data.url=selected.url;data.__capsuleQuality=selected.label;}
            }
            return result;
        };
        if(typeof raw.getFileUrl==='function')
            instance.getFileUrl=function(file,callback,waiting){
                var owner=this,settled=false;
                return raw.getFileUrl.call(owner,file,function(stream,details){
                    if(settled)return;
                    settled=true;
                    if((!stream||!stream.url)&&!session.manualSelection)
                        fallback('нет подходящей ссылки или разрешённой озвучки');
                    if(typeof callback==='function')callback(stream,details);
                },waiting);
            };
        if(typeof raw.display==='function')instance.display=function(videos){
            var policy=root.__capsuleFilmPriorities;
            var sourceNow=activeSource();
            var currentChoice=instance.getChoice&&instance.getChoice();
            var voice=currentChoice&&currentChoice.voice_name||'';
            var selected=(Array.isArray(videos)?videos:[]).filter(function(file){
                return !policy||!policy.allowed||
                    policy.allowed({balanser:sourceNow},file,voice,file,
                        file.method==='play');
            });
            if(!selected.length){
                if(!fallback('нет разрешённых версий у источника'))
                    info('Capsule Online: нет доступных версий с нужной озвучкой');
                return;
            }
            if(get('auto',true)&&!isSeries(movie)&&selected.length>1){
                selected.sort(function(a,b){
                    return filmVideoScore(b)-filmVideoScore(a);
                });
            }
            var result=raw.display.call(this,selected);
            session.status='ready';
            decorate(instance,session);
            return result;
        };
        if(typeof raw.error==='function')instance.doesNotAnswer=function(error){
            var status=String(error&&(error.status||error.code)||'');
            if(error&&error.accsdb||/^(401|403|429)$/.test(status))
                return raw.error.apply(this,arguments);
            if(fallback(isSeries(movie)?'нет доступных серий':'нет подходящего фильма'))return;
            return raw.error.apply(this,arguments);
        };
        if(typeof raw.start==='function')instance.start=function(){
            var result=raw.start.apply(this,arguments);
            decorate(instance,session);
            return result;
        };
        return instance;
    }

        function wrappedConstructor(original) {
        if (typeof original !== 'function' || original.__csoWrapped) return original;
        function CapsuleWrappedComponent(object) {
            var originalInstance = new original(object);
            return enhance(originalInstance,object && object.movie);
        }
        CapsuleWrappedComponent.prototype = original.prototype;
        CapsuleWrappedComponent.__csoWrapped = true;
        CapsuleWrappedComponent.__csoOriginal = original;
        return CapsuleWrappedComponent;
    }

    function hookComponent() {
        if (installed || !L || !L.Component || !L.Component.add) return;
        installed=true;
        var oldAdd = L.Component.add;
        L.Component.add = function(name, ctor) {
            if (name === 'capsuleamedia') ctor=wrappedConstructor(ctor);
            return oldAdd.call(this,name,ctor);
        };
        if (L.Component.get) {
            var existing=L.Component.get('capsuleamedia');
            if (existing && !existing.__csoWrapped)
                L.Component.add('capsuleamedia',existing);
        }
        debug('Единый движок Skaz зарегистрирован');
    }

    function installCSS() {
        if (cssInstalled || !root.document || !root.document.head) return;
        cssInstalled=true;
        var css = [
            '.cso-root .online-prestige{position:relative;isolation:isolate;border:0;border-radius:.8em;background:rgba(255,255,255,.055);overflow:hidden;box-shadow:none;transition:background-color .14s ease-out}',
            '.cso-root .online-prestige+.online-prestige{margin-top:.6em}',
            '.cso-folder-row .settings-param__name{font-weight:650}',
            '.cso-folder-row .settings-param__descr{opacity:.62}',
            '.cso-root .cso-end-spacer{display:block;clear:both;flex:0 0 auto;width:100%;height:clamp(3rem,6vh,5rem);min-height:3rem;pointer-events:none;user-select:none}',
            '.cso-root .online-prestige::after{content:""!important;display:block!important;position:absolute!important;inset:0!important;width:auto!important;height:auto!important;margin:0!important;padding:0!important;pointer-events:none!important;border:2px solid transparent!important;border-radius:inherit!important;box-shadow:none!important;opacity:0;z-index:12!important;box-sizing:border-box!important;transition:none}',
            '.cso-root .online-prestige.focus::after{border-color:rgba(255,255,255,.96)!important;opacity:1!important;transition:opacity .085s ease-out}',
            '.cso-root .online-prestige.focus{background:rgba(255,255,255,.085)}',
            '.cso-root .online-prestige__body{padding:1em 1.25em;min-width:0}',
            '.cso-root .online-prestige__img{width:11.8em;min-height:7em}',
            '.cso-root .online-prestige__img>img{border-radius:.8em 0 0 .8em;transition:opacity .25s ease-out}',
            '.cso-root .online-prestige__img.cso-poster-fallback>img{filter:blur(4.5px) brightness(.80);transform:scale(1.065);object-fit:cover}',
            '.cso-root .online-prestige__title{font-size:1.35em;font-weight:620;line-height:1.25;white-space:normal;-webkit-line-clamp:2;line-clamp:2}',
            '.cso-root .online-prestige__info{opacity:.78;font-size:.9em;min-width:0}',
            '.cso-root .online-prestige__quality{font-variant-numeric:tabular-nums;font-weight:650;opacity:.9}',
            '.cso-root .online-prestige__timeline{margin:.75em 0 .45em}',
            '.cso-root .online-prestige__time{opacity:.68;font-size:.88em}',
            '.cso-root .online-prestige--folder{background:rgba(255,255,255,.04)}',
            '.cso-root .online-prestige__episode-number{font-variant-numeric:tabular-nums;font-weight:700;text-shadow:0 2px 9px rgba(0,0,0,.3)}',
            '.cso-root .torrent-filter{display:flex!important;align-items:center;flex-wrap:wrap;gap:.55em;padding:.45em 0 .95em;margin:0 0 .7em;background:none!important;border-bottom:1px solid rgba(255,255,255,.10)}',
            '.cso-root .torrent-filter .simple-button--filter,.cso-root .torrent-filter .filter--sort,.cso-root .torrent-filter .filter--filter{display:flex;align-items:center;gap:.48em;max-width:100%;min-width:0;min-height:2.9em;box-sizing:border-box;border:1px solid rgba(255,255,255,.14);border-radius:.72em;padding:.5em .85em;margin:0!important;background:rgba(255,255,255,.045);box-shadow:none;transition:background-color .15s ease,border-color .15s ease}',
            '.cso-root .torrent-filter .filter--sort{order:1;flex:1 1 14em;min-width:10em}',
            '.cso-root .torrent-filter .filter--filter.hide{display:none!important}',
            '.cso-root .torrent-filter .capsule-season-button{order:2;flex:0 1 auto}',
            '.cso-root .torrent-filter .filter--filter{order:3;flex:0 1 auto}',
            '.cso-root .torrent-filter .filter--search{order:4;flex:0 1 auto;min-width:0}',
            '.cso-root .torrent-filter .selector.focus{background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.65)}',
            '.cso-root .torrent-filter .simple-button--filter span,.cso-root .torrent-filter .simple-button--filter div,.cso-root .torrent-filter .filter--sort span,.cso-root .torrent-filter .filter--filter span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}',
            '.cso-root .torrent-filter .capsule-season-button>span{font-weight:650}',
            '.cso-root .torrent-filter .capsule-season-button>div{opacity:.65;font-size:.9em}',
            '.cso-root .cso-status{display:none;padding:0 0 .65em;font-size:.82em;opacity:.8}',
            '.cso-root .cso-status[data-state=recover]{display:block;opacity:.88}',
            '@media(max-width:660px){.cso-root .cso-end-spacer{height:3.2rem;min-height:3.2rem}}',
            '@media(max-width:660px){.cso-root .torrent-filter{gap:.45em}.cso-root .torrent-filter .filter--sort{flex:1 0 100%;min-width:0}.cso-root .torrent-filter .simple-button--filter{min-height:2.65em;padding:.42em .7em}.cso-root .online-prestige{border-radius:.72em}.cso-root .online-prestige__img>img{border-radius:.72em 0 0 .72em}.cso-root .online-prestige__img{width:7em;min-height:5.9em}.cso-root .online-prestige__body{padding:.8em .92em}.cso-root .online-prestige__title{font-size:1.06em}.cso-root .online-prestige__head{align-items:flex-start;gap:.35em}.cso-root .online-prestige__time{padding-left:0}.cso-root .online-prestige__footer{gap:.5em}.cso-root .online-prestige__quality{padding-left:.3em}.cso-root .cso-status{font-size:.68em}}',
            '@media(prefers-reduced-motion:reduce){.cso-root .online-prestige,.cso-root .online-prestige::after,.cso-root .torrent-filter .simple-button--filter,.cso-root .online-prestige__img>img{transition:none}}'
        ].join('\n');
        var style=root.document.createElement('style');
        style.id='capsule-skaz-online-style';
        style.textContent=css;
        root.document.head.appendChild(style);
    }

    function registerSettings() {
        if(settingsInstalled||!L||!L.SettingsApi||
           !L.SettingsApi.addComponent||!L.SettingsApi.addParam)return;
        settingsInstalled=true;
        // Only the parent component is displayed in Lampa's main settings.
        // Children are native Settings.create pages accessed from parent buttons.
        // Storage key names never change during this UI migration.
        var groups=[
          [COMPONENT,'Capsule Online'],
          [COMPONENT+'_basic','Capsule Online · Основное'],
          [COMPONENT+'_video','Capsule Online · Видео'],
          [COMPONENT+'_sources','Capsule Online · Балансеры'],
          [COMPONENT+'_voices','Capsule Online · Озвучки'],
          [COMPONENT+'_system','Capsule Online · Система']
        ];
        var icon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h6l3-7 3 14 3-7h3"/></svg>';
        groups.forEach(function(row){
          L.SettingsApi.addComponent({component:row[0],name:row[1],icon:icon});
        });
        // SettingsApi.addComponent registers every component in the main
        // settings view, so hide child folders when Lampa opens that view.
        // Lampa emits "open" with the current main.render() DOM before showing it.
        if(L.Settings&&L.Settings.listener&&L.Settings.listener.follow){
          L.Settings.listener.follow('open',function(e){
            if(e&&e.name==='main'&&e.body&&e.body.find)
              e.body.find('.settings-folder[data-component^="'+COMPONENT+'_"]').remove();
          });
        }
        function folder(key,title,description,index){
          var child=COMPONENT+'_'+key;
          L.SettingsApi.addParam({component:COMPONENT,
            param:{name:PREFIX+'open_'+key,type:'button'},
            field:{name:'›  '+title,description:description},
            onChange:function(){
              if(!L.Settings||!L.Settings.create)return;
              // Destroy parent settings scroll/listeners through the native
              // controller before opening another page; do not leak it.
              var active=L.Controller&&L.Controller.enabled&&L.Controller.enabled();
              if(active&&active.name==='settings_component'&&
                  active.controller&&typeof active.controller.back==='function')
                active.controller.back();
              L.Settings.create(child,{
                onBack:function(){L.Settings.create(COMPONENT,{last_index:index});}
              });
            },
            onRender:function(item){item.addClass('cso-folder-row');}
          });
        }
        [
          ['basic','Основное','Автовыбор, режим поиска и резервный источник'],
          ['video','Видео','Качество и язык'],
          ['sources','Балансеры','Разрешённые источники'],
          ['voices','Озвучки','Приоритеты и ограничения переводов'],
          ['system','Система','Версия, кэш и диагностика']
        ].forEach(function(entry,index){
          folder(entry[0],entry[1],entry[2],index);
        });
        function select(group,key,title,description,values,defaultValue){
          L.SettingsApi.addParam({component:group,
            param:{name:PREFIX+key,type:'select',values:values,default:defaultValue},
            field:{name:title,description:description}
          });
        }
        function note(group,key,title,description){
          L.SettingsApi.addParam({component:group,
            param:{name:PREFIX+key,type:'static'},
            field:{name:title,description:description}
          });
        }
        function toggle(group,key,title){
          select(group,key,title,'Отключённый вариант не участвует в выборе и воспроизведении.',
            {true:'Разрешено',false:'Отключено'},true);
        }
        var basics=COMPONENT+'_basic';
        select(basics,'auto','Автовыбор',
          'Подбирать подходящий поток для фильмов и сериалов.',
          {true:'Включён',false:'Выключен'},true);
        select(basics,'search_mode','Режим поиска',
          'Обычный сравнивает качество и озвучку; экономный ищет быстрый подходящий ответ.',
          {normal:'Обычный · качество',economy:'Экономный · быстро'},'normal');
        select(basics,'fallback','Резервный источник',
          'При недоступности одного балансера переключаться на следующий разрешённый.',
          {true:'Включён',false:'Выключен'},true);

        var video=COMPONENT+'_video';
        select(video,'quality','Максимальное качество',
          'Верхний предел. Если он ниже минимального, подходящего потока нет.',
          {auto:'Авто · лучшее доступное',max:'Максимальное',
            2160:'До 4K',1080:'До 1080p',720:'До 720p'},'auto');
        select(video,'min_quality','Минимальное качество',
          'Жёсткое ограничение: не запускать поток ниже выбранного разрешения.',
          {any:'Без ограничения',480:'Не ниже 480p',720:'Не ниже 720p',
            1080:'Не ниже 1080p',2160:'Не ниже 4K'},'any');
        select(video,'language','Язык воспроизведения',
          'Авто предпочитает русский язык; точный язык запрещает другие дорожки.',
          {auto:'Авто · русский предпочтительно',ru:'Русский',
            uk:'Украинский',en:'Английский',original:'Оригинальная дорожка'},'auto');

        var sources=COMPONENT+'_sources';
        note(sources,'sources_info','Источники сериалов и фильмов',
          'Сериалы: Alloha, HDRezka, Filmix, KinoPub, VIBIX, Kodik, RHS. '+
          'Фильмы: Alloha, Filmix, HDRezka, Мир кино Z, Skaz TV, RHS.');
        [
          ['alloha','Alloha'],['hdrezka','HDRezka'],['filmix','Filmix'],
          ['kinopub','KinoPub / КПУ'],['vibix','VIBIX'],['kodik','Kodik'],
          ['redheadsound','RHS'],['mirkinoz','Мир кино Z'],['skaztv','Skaz TV']
        ].forEach(function(row){toggle(sources,'source_'+row[0],row[1]);});

        var voices=COMPONENT+'_voices';
        select(voices,'voice','Приоритет озвучки',
          'При одинаковых языке и качестве предпочитать RHS, дубляж, LostFilm и далее по рейтингу.',
          {smart:'Авто · по приоритету',force:'Авто · всегда по приоритету',
            original:'Не менять вручную'},'smart');
        select(voices,'kids','Детский режим',
          'Скрывает явно взрослые и нецензурные переводы; не заменяет возрастной рейтинг.',
          {true:'Включён',false:'Выключен'},false);
        note(voices,'voices_info','Разрешённые озвучки',
          'Отключённые переводы исключаются из поиска и списка выбора.');
        [
          ['rhs','RHS / Red Head Sound'],['dub','Дублированный перевод'],
          ['lostfilm','LostFilm'],['rezka','Rezka / HDRezka'],
          ['tvshows','TVShows'],['kubik','Кубик в Кубе'],
          ['rezka18','Rezka 18+'],['goblin','Гоблин'],
          ['original','Оригинальная дорожка / English'],
          ['amateur','Авторские / любительские / нейро'],
          ['other','Другие / неизвестные']
        ].forEach(function(row){toggle(voices,'voice_'+row[0],row[1]);});

        var system=COMPONENT+'_system';
        L.SettingsApi.addParam({component:system,
          param:{name:PREFIX+'kinopoisk_key',type:'input',default:''},
          field:{name:'Ключ API Кинопоиска',
            description:'Необязательно. Для русских названий, постеров и серий. Получить собственный ключ на kinopoiskapiunofficial.tech; без него работают TVmaze и Cinemeta.'}
        });
        select(system,'debug','Диагностика',
          'Технические сообщения без ссылок на видео и токенов.',
          {true:'Включена',false:'Выключена'},false);
        L.SettingsApi.addParam({
          component:system,
          param:{name:PREFIX+'last_series_probe',type:'button'},
          field:{name:'Последнее сравнение сериалов',
            description:'Показывает охват сезонов по каждому балансеру, без ссылок и личных данных.'},
          onChange:function(){
            var report=root.__capsuleSeriesLastScan;
            if(!report){
              if(L.Noty&&L.Noty.show)
                L.Noty.show('Сначала откройте сериал в обычном режиме.');
              return;
            }
            var names=Array.isArray(report.compared)?report.compared:[],
                data=report.providers||{},result=[
                  {title:'Выбрано: '+String(report.selected||'не определено')},
                  {title:'Каталог: '+(Number(report.discovered)||names.length)+
                    ' · доступных адресов: '+(Number(report.eligible)||names.length)+
                    ' · ожидаемых сезонов: '+(Number(report.expectedSeasons)||'?')},
                  {title:'Сравнение: '+((Number(report.elapsed)||0)/1000).toFixed(2)+
                    ' с · лимит достигнут: '+((report.timeout||report.deadlineHit)?'да':'нет')}
                ];
            var choices=Array.isArray(report.finalCandidates)?
              report.finalCandidates:[],absent=choices.filter(function(key){
                return names.indexOf(key)<0;
              });
            if(absent.length)result.push({title:'Не исследованы: '+absent.join(', ')});
            names.forEach(function(name){
              var row=data[name]||{};
              result.push({title:name+
                ' · озвучка: '+String(row.voice||'не определена')+
                ' · сезоны: '+(Number(row.seasons)||0)+
                (Number(row.estimatedSeasons)>Number(row.seasons)?
                   ' / оценка '+row.estimatedSeasons:'')+
                (row.variant&&row.variant!==row.name?
                  ' · вариант: '+row.variant:'')+
                (Number(row.sampleEpisodes)>0?
                  ' · серий в выборке: '+row.sampleEpisodes:'')+
                ' · запросы: '+(Number(row.requests||row.inspected)||0)+
                (row.voiceVariants!==undefined?' · озвучек: '+row.voiceVariants:'')});
              if(row.rootSeasons)result.push({title:
                '  Корневых сезонов: '+row.rootSeasons+
                ' · проверено выборок: '+(Number(row.samples)||0)});
            });
            if(L.Select&&L.Select.show)L.Select.show({
              title:'Capsule Online · сравнение сериалов',
              items:result,onSelect:function(){},
              onBack:function(){
                if(L.Settings&&L.Settings.create)L.Settings.create(system,{
                  onBack:function(){L.Settings.create(COMPONENT);}
                });
              }
            });
          }
        });
        L.SettingsApi.addParam({
          component:system,
          param:{name:PREFIX+'last_film_probe',type:'button'},
          field:{name:'Последний поиск фильма',
            description:'Показывает этапы поиска без названий, ссылок, аккаунта и токенов.'},
          onChange:function(){
            var report=root.__capsuleFilmLastScan;
            if(!report){
              if(L.Noty&&L.Noty.show)L.Noty.show('Сначала запустите поиск фильма.');
              return;
            }
            var stages=report.providerStages||{},
                names=['alloha','filmix','mirkinoz','kinopub',
                  'rezka','hdrezka','redheadsound','collaps','kodik','vibix'];
            var selected=report.selected,
                resolved=report.resolvedBySource||{},
                compared=report.comparisonBySource||{};
            var entries=[
              {title:'Этап: '+String(report.status||'неизвестен')+
                ' · режим: '+String(report.mode||'?')},
              {title:'В каталоге: '+(Array.isArray(report.catalog)?
                report.catalog.join(', ').slice(0,165):'нет данных')},
              {title:'Всего видеоверсий: '+(Number(report.candidateCount)||0)+
                ' · подтверждено: '+(Number(report.resolvedCount)||0)},
              {title:'Время: '+(report.elapsedMs?
                (report.elapsedMs/1000).toFixed(1)+' с':'ещё выполняется')+
                ' · HTTP: '+(Number(report.httpRequests)||0)+
                ' · общих подписей: '+(Number(report.signedCallsCoalesced)||0)+
                ' · ID из памяти: '+(report.idsReused?'да':'нет')},
              {title:'Этапы: каталог '+((report.catalogMs||0)/1000).toFixed(1)+
                ' с · обзор '+((report.scanMs||0)/1000).toFixed(1)+
                ' с · проверка '+((report.resolveMs||0)/1000).toFixed(1)+' с'}
            ];
            if(selected)entries.push({title:'Выбрано: '+selected.source+
              ' · '+(selected.quality||'?')+'p'+
              ' · язык '+String(selected.language||'?')});
            if(report.runtimeReference)entries.push({
              title:'Проверка продолжительности: '+report.runtimeReference+' мин'
            });
            names.forEach(function(name){
              var p=stages[name],v=resolved[name],c=compared[name];
              if(!p&&!v&&!c&&(!Array.isArray(report.catalog)||
                  report.catalog.indexOf(name)<0))return;
              p=p||{};v=v||{};c=c||{};
              entries.push({title:name+' · запросы '+(p.requests||0)+
                ', ответы '+(p.responses||0)+
                ', папки '+((p.voiceFolders||0)+(p.linkFolders||0))+
                ', видео '+(p.videoRows||0)+', принято '+(p.accepted||0)});
              entries.push({title:'  Проверено: '+(v.checked||0)+
                ' · прошло: '+(v.passed||0)+
                ' · макс. поток: '+(v.maxQuality||0)+'p'});
              if(c.count)entries.push({title:'  В финале: '+c.count+
                ' · оценка: '+c.quality+'p, язык '+c.languageTier+
                ' ('+String(c.languageEvidence||'?')+')'+
                ', озвучка '+c.voiceRank});
              var rejected=v.rejected||{};
              var reasons=Object.keys(rejected).map(function(reason){
                return reason+': '+rejected[reason];
              });
              if(reasons.length)entries.push({title:'  Отсеяно: '+
                reasons.join('; ').slice(0,180)});
            });
            if(report.error)entries.push({title:'Ошибка: '+
                String(report.error).slice(0,155)});
            if(L.Select&&L.Select.show)L.Select.show({
              title:'Диагностика фильма · без ссылок',
              items:entries,
              onSelect:function(){},
              onBack:function(){
                if(L.Settings&&L.Settings.create)L.Settings.create(system,{
                  onBack:function(){L.Settings.create(COMPONENT);}
                });
              }
            });
          }
        });
        note(system,'cache_info','Кэш версий отключён',
          'Старые записи выбора источника и озвучки удаляются однократно. Прогресс просмотра сохраняется.');
        note(system,'version','Версия: 0.23.0',
          'Ускоренный выбор источника, поддержка обеих структур сезонов и диагностика сравнения.');
    }

    function migrateOldPlaybackCache(){
        // V2 migration runs once per device. It only touches this plugin's
        // legacy selection keys, not Lampa's global video cache or history.
        var marker=PREFIX+'playback_cache_cleanup_v2';
        try{if(L.Storage.get(marker,false)===true)return;}catch(e){}
        var providers=[
          'alloha','allohatv','filmix','filmixtv','fxapi','rc/filmix','rc/fxapi',
          'kinopub','kpu','kpu-tv','rezka','rezkatv','hdrezka','hdrezkatv',
          'skaztv','skazonline','skaz','mirkino','mirkinoz','mir-kino-z',
          'mir_kino_z','mirkinotv-z','rhsprem','lumex','videodb','collaps',
          'collaps-dash','hdvb','zetflix','kodik','ashdi','kinoukr',
          'kinotochka','remux','iframevideo','cdnmovies','anilibria',
          'animedia','animego','animevost','animebesst','redheadsound',
          'animelib','moonanime','vibix','vdbmovies','fancdn','cdnvideohub',
          'vokino','rc/rhs','rc/fxapi','rc/filmix','vcdn','videocdn',
          'mirage','hydraflix','veoveo','veo2','veo'
        ];
        var failures=0,migrated=0;
        function objectMap(value){
          if(typeof value==='string'){
            try{value=JSON.parse(value);}catch(ignore){value=null;}
          }
          return value&&typeof value==='object'&&!Array.isArray(value)?value:{};
        }
        function clear(key){
          try{
            if(typeof L.Storage.remove==='function')L.Storage.remove(key);
            else L.Storage.set(key,{});
            return true;
          }catch(error){failures++;return false;}
        }
        var seen=Object.create(null);
        providers.forEach(function(provider){
          if(seen[provider])return;
          seen[provider]=true;
          var legacyKey='amedia_auto_choice_'+provider,
              old=objectMap(L.Storage.get(legacyKey,{}));
          var ids=Object.keys(old);
          if(!ids.length){clear(legacyKey);return;}
          var progressKey='amedia_auto_progress_'+provider;
          var progress=objectMap(L.Storage.get(progressKey,{})),modified=false;
          ids.forEach(function(id){
            var saved=old[id];
            if(!saved||typeof saved!=='object'||Array.isArray(saved)||
               Object.prototype.hasOwnProperty.call(progress,id))return;
            var episodes=objectMap(saved.episodes_view);
            progress[id]={
              season:Math.max(0,Math.trunc(Number(saved.season)||0)),
              episodes_view:Object.assign({},episodes)
            };
            modified=true;migrated++;
          });
          if(modified){
            try{L.Storage.set(progressKey,progress);}
            catch(error){failures++;return;} // never delete un-migrated data
          }
          clear(legacyKey);
        });
        // Watched episode/season positions stay intact; stale voice/source go.
        try{
          var watched=objectMap(L.Storage.get('amedia_auto_watched_last',{}));
          var changed=false;
          Object.keys(watched).forEach(function(key){
            var entry=watched[key];
            if(!entry||typeof entry!=='object')return;
            ['balanser','balanser_name','voice_id','voice_name'].forEach(function(field){
              if(Object.prototype.hasOwnProperty.call(entry,field)){
                delete entry[field];changed=true;
              }
            });
          });
          if(changed)L.Storage.set('amedia_auto_watched_last',watched);
        }catch(error){failures++;}
        clear('amedia_auto_last_balanser');
        clear('amedia_auto_active_balanser');
        if(!failures){
          try{L.Storage.set(marker,true);}
          catch(error){failures++;}
        }
        if(failures)debug('Не все старые записи удалены; повторим при новом запуске.');
        else debug('Старые версии очищены; перенесено записей прогресса: '+migrated);
    }

        function boot() {
        if (!root.Lampa || !root.Lampa.Component || !root.Lampa.Storage) {
            if (++BOOT_ATTEMPTS < 35) setTimeout(boot,300);
            return;
        }
        L=root.Lampa;
        migrateOldPlaybackCache();
        installCSS();
        hookComponent();
        registerSettings();
        
        if (L.Listener && L.Listener.follow) L.Listener.follow('app',function(e){
            if (e && e.type === 'ready') {
                installCSS();
                registerSettings();
                
            }
        });
        // Skaz-compatible transport is bundled in this file.
    }
    boot();

    // Expose pure ranking helpers for regression tests; no tokens or URLs.
    root.__capsuleSkazOnlineDebug = {
        sourceOrder:sourceOrder,voiceScore:voiceScore,filmVideoScore:filmVideoScore,
        qualityCandidate:qualityCandidate,resolution:resolution,qualityLimit:qualityLimit
    };
})(window);
