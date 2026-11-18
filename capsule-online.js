/* Capsule Online 0.15.2 — unified Skaz films and curated series, energy-conscious UI.
 * Source credit: Skaz online/Lampac; community mirror used for reference:
 * https://github.com/voipoddsns/voipoddsns.github.io/blob/main/plugins/lampa_plugins/o.js
 * Third-party upstream licensing has not been established.
 */
/* CAPSULE EMBEDDED ONLINE CORE START */
(function() {
if (window.capsule_amedia_core_plugin) return;
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
      if(/^(?:hdrezka|hdrezkatv|hd-rezka)$/.test(id)||/^hd\s*[-.]?\s*rezka/.test(name))
        return 'hdrezka';
      if(/^(?:rezka|rezkatv)$/.test(id))return 'rezka';
      if(/^(?:alloha|allohatv)$/.test(id))return 'alloha';
      if(/^(?:rc\/)?(?:filmix|filmixtv|fxapi)$/.test(id))return 'filmix';
      if(/^(?:kinopub|kpu|kpu-tv)$/.test(id))return 'kinopub';
      if(/^(?:collaps|collaps-dash|collapsdash)$/.test(id))return 'collaps';
      if(/^(?:kodik|kodiktv)$/.test(id))return 'kodik';
      if(/^(?:redheadsound|rhsprem|rc\/rhs|rhs)$/.test(id))return 'redheadsound';
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
    function filmSourceOrder(){
      return String(Lampa.Storage.get('capsule_skaz_online_quality','auto'))==='max'?
        ['mirkinoz','filmix','alloha','kinopub','rezka','hdrezka',
          'redheadsound','collaps','kodik','vibix','skaztv']:
        ['alloha','filmix','kinopub','mirkinoz','rezka','hdrezka',
          'redheadsound','collaps','kodik','vibix','skaztv'];
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
      if(/дубл(?:ир(?:ован|ов)|я[жг]|еж|\.)|дублирован|русск|російськ|\b(?:rus|russian|ru\s*dub)\b|\brhs\b|рхс|red.?head.?sound|lost.?film|лост.?фильм|newstudio|jaskier|профессиональн|многоголос|пифагор|невафильм|кинотеатральн|\b(?:goblin|kubik)\b|гоблин|кубик\s*(?:в\s*)?кубе|\b(?:rezka|hdrezka|tvshows?|tvshow)\b|резка|тв\s*шоу|твшоу/.test(t))return 'ru';
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
      var named=voiceLanguage(label);
      // A file card can describe the movie's original language. Only signed,
      // distinct stream metadata is strong enough to contradict its voice.
      var samePlayUrl=!!(file&&file.method==='play'&&stream&&
        file.url&&stream.url&&String(file.url)===String(stream.url));
      var stated=(stream&&stream!==file&&!samePlayUrl?
        explicitAudioLanguage(stream):'')||
        (!label?explicitAudioLanguage(file):'');
      var conflict=!!(stated&&named&&stated!==named);
      return {lang:conflict?'':stated||named||sourceLanguage(file),
        conflict:conflict,stated:stated,named:named};
    }
    function playbackLanguageTier(file,voice,stream){
      var ev=trackLanguage(file,voice,stream),lang=ev.lang,wanted=playbackLanguage();
      if(wanted==='auto'){
        if(lang==='uk')return -1;
        if(ev.conflict)return 1;
        return lang==='ru'?4:!lang?2:1;
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
        if(clock)return clock[3]?
            Number(clock[1])*60+Number(clock[2])+Number(clock[3])/60:
            Number(clock[1])+Number(clock[2])/60;
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
      var idKeys=['imdb_id','kinopoisk_id','tmdb_id'];
      for(var i=0;i<idKeys.length;i++){
        var id=idKeys[i];
        if(movie[id]&&row[id]&&String(movie[id])!==String(row[id]))return false;
      }
      var expectedYear=parseInt(String(movie.release_date||'').slice(0,4),10);
      var foundYear=parseInt(String(row.year||row.release_year||row.release_date||'').slice(0,4),10);
      if(expectedYear>1900&&foundYear>1900&&Math.abs(expectedYear-foundYear)>1)return false;
      var stated=String(row.movie_title||row.film_title||row.content_title||
          row.original_title||'').trim();
      if(row.similar)stated=String(row.title||row.text||stated).trim();
      if(!filmRuntimeMatches(filmMinutes(movie.runtime),filmKnownMinutes(row)))return false;
      if(stated&&!sameFilmTitle(stated,movie.title||movie.name)&&
          !sameFilmTitle(stated,movie.original_title||movie.original_name))return false;
      return true;
    }

    // Curated provider allow-list. Server-supplied unknown/ad-funded mirrors
    // never enter auto selection, even if the response advertises 4K.
    function allowedSeriesProvider(row) {
      if(!filmSourceEnabled(row))return false;
      var id=String(typeof row==='string'?row:row&&row.balanser||'').toLowerCase().trim();
      var name=String(row&&row.name||'').toLowerCase().trim();
      if(forbiddenVoice(name)||filmAdMarked(row))return false;
      if(/^(?:collaps|collaps-dash|collapsdash|kodik|kodiktv|redheadsound|rhsprem|rc\/rhs|rhs|vibix|vibixtv)$/.test(id))
        return true;
      if(/^(?:hd)?rezka(?:tv)?$/.test(id))return true;
      if(/^(?:kpu|kpu-tv)$/.test(id))return true;
      if(/^alloha(?:tv)?$/.test(id))return true;
      if(/^(?:rc\/)?(?:filmix(?:tv)?|fxapi)$/.test(id))return true;
      if(/^skaz(?:tv|online)?$/.test(id))return true;
      if(/^(?:kinopub|kpu)$/.test(id))return true;
      if(/^(?:mirkino|mirkinoz|mir-kino(?:-z)?|mir_kino(?:_z)?|mirkino-z|mirkinotv-z|mirkinotv)$/.test(id))
        return true;
      if(/^(?:veoveo|veo2|veo)$/.test(id))return false;
      // Some Skaz variants include suffixes. Require both identity
      // and display name to belong to the original six families.
      var mir=/^(?:(?:мир\s*кино|mir\s*kino|mirkino)\s*[-.]?\s*z)(?:\b|\s|[-.:]|$)/i.test(name);
      if(mir)return !id||/^(?:mir|мир)/i.test(id);
      var named=/^(?:(?:hd\s*[-.]?\s*)?rezka|alloha|filmix|skaz\s*tv|skaz|kinopub)(?:\b|\s|[-.:]|$)/i.test(name);
      return named&&(!id||/^(?:alloha|rezka|hdrezka|filmix|fxapi|rc\/filmix|rc\/fxapi|skaz|kinopub)/.test(id));
    }
    window.__capsuleSerialAllowed=allowedSeriesProvider;
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
    var rch=window.rch_nws&&window.rch_nws[hostkey];
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
            if(!filmItemAllowed(movie,item))return;
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
  function filmEffectiveQuality(file,stream){
    var quality=filmQualityChoice(filmStreamQuality(file,stream));
    if(quality)return quality;
    var label=String(stream&&stream.quality_label||file&&file.quality_label||
        stream&&stream.text||file&&file.text||'');
    var height=filmQualityHeight(label);
    return {height:height,hdr:/\b(?:hdr|dolby\s*vision|dv)\b/i.test(label),
      url:String(stream&&stream.url||file&&file.url||''),label:label};
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
  function filmVoiceGrade(label){return filmVoiceRank(label);}
  window.__capsuleFilmVoiceRank=filmVoiceRank;
  window.__capsuleVoiceBlocked=filmVoiceBlocked;
  function filmLanguagePriority(file,voice,stream){
    return playbackLanguageTier(file,voice,stream);
  }
  function filmSelectionProfile(item){
    if(!item||!item.file)return {blocked:true,vector:[]};
    var file=item.file,voice=String(item.voice||file.voice_name||
      file.translate_voice||'');
    if(!filmPlaybackAllowed(item.provider,file,voice,item.stream))
      return {blocked:true,vector:[]};
    if(!voice)voice=String(file.text||'');
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
  function filmAutoLaunch(movie) {
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
        qualityBySource:{},languagesBySource:{},selected:null}};
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
      debugFilm(message);
      job.close();
      if(Lampa.Noty&&Lampa.Noty.show)Lampa.Noty.show(message);
    }
    function request(url,mode,callback,retried) {
      if(!alive())return;
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
        if(!row||!allowedSeriesProvider(row)||!filmItemAllowed(movie,row)||
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
          var task=queue.shift(),url=String(task.url||'');
          if(!filmValidUrl(url,true)||visited[url]||task.depth>maxDepth)
            continue;
          visited[url]=true;count++;active++;
          // URL for a translation is an opaque, sometimes signed payload.
          var target=task.root?filmRequestParams(url,movie):url;
          (function(node){
            request(target,'text',function(body){
              if(!alive()||finished)return;
              var parsed=filmParseHtml(body,movie);
              parsed.videos.forEach(function(file){
                addCandidate(provider,file,node.voice);
              });
              // Preserve all voice and quality folders, even when a page
              // already has one playable 720p variant.
              var children=parsed.voices.concat(parsed.links).filter(function(item){
                if(!item||!filmPlaybackAllowed(provider,item,
                    item.text&&filmVoiceCategory(item.text)!=='other'?item.text:'')||
                    !filmValidUrl(item.url,true)||visited[item.url])return false;
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
                  if(!visited[child.url]&&queue.length<maxRequests*2){
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
        url:stream.url,
        quality:filmOrderedQuality(filmStreamQuality(file,stream)),
        headers:stream.headers||{},
        subtitles:stream.subtitles||file.subtitles,
        segments:stream.segments||file.segments,
        hls_manifest_timeout:stream.hls_manifest_timeout||file.hls_manifest_timeout,
        voice_name:choice.voice||file.voice_name||'',
        isonline:true,iptv:true
      };
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
          candidates.sort(function(a,b){
            return filmCompareCandidates(a,b);
          });
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
            stream=filmNormalizeStream(stream,item.file);
            if(stream&&filmValidUrl(stream.url,false)&&
                filmItemAllowed(movie,stream)&&
                filmQualityMeetsMinimum(item.file,stream,true)&&
                filmPlaybackAllowed(item.provider,item.file,item.voice,stream,true)&&
                filmLanguagePriority(item.file,
                  item.voice||item.file.voice_name||item.file.text,stream)>=0){
              var chosen={provider:item.provider,file:item.file,voice:item.voice,
                stream:stream};
              // Use the actually resolved quality, not just the preview.
              chosen.file=Object.assign({},item.file,{
                qualitys:filmStreamQuality(item.file,stream)
              });
              job.resolved.push(chosen);
              job.report.resolvedCount++;
              var family=filmSourceFamily(item.provider);
              job.report.qualityBySource[family]=Math.max(
                job.report.qualityBySource[family]||0,
                filmEffectiveQuality(chosen.file,stream).height);
            }
            pending--;finished++;pump();
          }
          (function(candidate){
            var file=candidate.file;
            if(file.method==='play')return resolved(candidate,file);
            request(file.url,'json',function(stream){
              resolved(candidate,stream);
            });
          })(item);
        }
      }
      pump();
    }
    function scanProviders(providers){
      if(!alive())return;
      if(!providers.length)return showError('Skaz: фильм не найден среди доступных источников');
      job.phase='scan';
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
            var allohas=!filmSourceEnabled({balanser:'alloha'})||combined.some(function(row){
              return filmSourceFamily(row)==='alloha';
            });
            job.report.catalogAttempts=catalogAttempts;
            if(filmSearchMode()==='economy'||allohas||
                Date.now()>=catalogDeadline||catalogAttempts>=4){
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
    request(filmRequestParams(Defined.localhost+'lite/events?life=true',movie),
      'catalog',withCatalog);
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
    var pendingFocus=null,focusScrollFrame=0,lastFocusScroll=null;
    function cancelFocusScroll(){
      pendingFocus=null;lastFocusScroll=null;
      if(focusScrollFrame){
        if(window.cancelAnimationFrame)window.cancelAnimationFrame(focusScrollFrame);
        else clearTimeout(focusScrollFrame);
      }
      focusScrollFrame=0;
    }
    function scheduleFocusScroll(node){
      if(!node || (node===lastFocusScroll&&!focusScrollFrame))return;
      pendingFocus=node;
      if(focusScrollFrame)return;
      var raf=window.requestAnimationFrame||function(cb){return setTimeout(cb,16);};
      focusScrollFrame=raf(function(){
        focusScrollFrame=0;
        var target=pendingFocus;pendingFocus=null;
        if(!target || target===lastFocusScroll || !scroll.update)return;
        lastFocusScroll=target;
        scroll.update($(target),true);
      });
    }
    var files = new Lampa.Explorer(object);
    var filter = new Lampa.Filter(object);
    var sources = {};
    var last, persistentFocus=null, lastFocusedEpisode='';
    function markEpisodeFocus(node){
      // Lampa sometimes delivers a child element as the focus target.
      // Focus styling belongs to the card, never to the nested thumbnail.
      if(node&&node.closest&&!node.classList.contains('online-prestige'))
        node=node.closest('.online-prestige')||node;
      if(persistentFocus===node)return;
      if(persistentFocus&&persistentFocus.classList)
        persistentFocus.classList.remove('cso-row-focused');
      persistentFocus=node||null;
      if(persistentFocus&&persistentFocus.classList)
        persistentFocus.classList.add('cso-row-focused');
    }
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
    var number_of_requests = 0;
    var number_of_requests_timer;
    var life_wait_timer;
    var filter_sources = [], sourceCatalog = Object.create(null);
    var requestRevision=0, activeContentUrl='', seasonButton=null, lastSeasonTap=0;
    var automaticVoiceVisited=Object.create(null);
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
      if(!row||typeof row!=='object'||!allowedSeriesProvider(row))return false;
      if(isEpisodeMedia(object.movie)&&filmSourceFamily(row)==='mirkinoz')return false;
      // Allowlisted catalog entries are retained regardless of voice ranking.
      // Missing URLs are visible but cannot be auto-launched.
      var url=String(row.url||'').trim();
      return filmSourceEnabled(row)&&
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
      ['rezka','Rezka'],['hdrezka','HDRezka'],['alloha','Alloha'],
      ['filmix','Filmix'],['skaztv','Skaz TV'],['kinopub','KinoPub']
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
        if(!allowedSeriesProvider({balanser:object.balanser})){
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
      this.externalids().then(function() {
        return _this.createSource();
      }).then(function(json) {
        // /lite/withsearch is no longer queried. Its obsolete empty table
        // was hiding search unconditionally, regardless of the provider.
        _this.search();
      })["catch"](function(e) {
        _this.noConnectToServer(e);
      });
    };
    this.rch = function(json, noreset) {
      var _this2 = this;
	  rchRun(json, function() {
        if (!noreset) _this2.find();
        else noreset();
	  });
    };
    this.externalids = function() {
      return new Promise(function(resolve, reject) {
        if (!object.movie.imdb_id || !object.movie.kinopoisk_id) {
          var query = [];
          query.push('id=' + encodeURIComponent(object.movie.id));
          query.push('serial=' + (isEpisodeMedia(object.movie) ? 1 : 0));
          if (object.movie.imdb_id) query.push('imdb_id=' + (object.movie.imdb_id || ''));
          if (object.movie.kinopoisk_id) query.push('kinopoisk_id=' + (object.movie.kinopoisk_id || ''));
          var url = Defined.localhost + 'externalids?' + query.join('&');
          network.timeout(1800);
          network.silent(account(url), function(json) {
            if(json&&typeof json==='object'){
              ['imdb_id','kinopoisk_id','tmdb_id'].forEach(function(key){
                if(json[key]&&(!object.movie[key]||object.movie[key]===''))
                  object.movie[key]=json[key];
              });
            }
            resolve();
          }, function() {
            resolve();
          }, false, {
			headers: {'X-Kit-AesGcm': Lampa.Storage.get('aesgcmkey', '')}
		  });
        } else resolve();
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
      balanser=name;
      source=next.url;
      Lampa.Storage.set('amedia_auto_active_balanser',name);
      // Invalidate in-flight callbacks and redraw only this source screen.
      ++requestRevision;
      clearTimeout(number_of_requests_timer);
      number_of_requests=0;
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
    // Bounded series preflight: inspect voice/quality menus before selecting
    // a provider. Never mutate the playback request or the component.
    this.compareSeriesSources = function(ready,callback){
      var context=this;
      if(!isEpisodeMedia(object.movie)||!automaticSelectionEnabled()||
          filmSearchMode()==='economy'||object.lampac_custom_select||ready.length<2||
          typeof document==='undefined'||typeof $!=='function')
        return callback(null);
      var selected=ready.slice().sort(function(a,b){
        return filmSourcePriority({balanser:b})-filmSourcePriority({balanser:a})||
          String(a).localeCompare(String(b));
      }).slice(0,9);
      var scores=Object.create(null),blockedObserved=Object.create(null),
          pending=selected.length,ended=false,requests=[],total=0;
      function finish(){
        if(ended)return;ended=true;clearTimeout(stop);
        requests.forEach(function(req){try{req.clear();}catch(ignored){}});
        // A provider whose accessible menu contains only excluded voices
        // cannot beat an unprobed or confirmed-good provider.
        Object.keys(blockedObserved).forEach(function(key){
          if(!Object.prototype.hasOwnProperty.call(scores,key))
            scores[key]=-100000;
        });
        callback(scores);
      }
      var stop=setTimeout(finish,15500);
      function rank(key,voice,file){
        var entry={provider:{balanser:key},file:file||{text:voice},voice:voice};
        var profile=filmSelectionProfile(entry);
        if(profile.blocked)return;
        var score=filmCandidateScore(entry);
        if(!scores[key]||score>scores[key])scores[key]=score;
      }
      function parseRows(html,key){
        var rows=[];
        if(typeof html!=='string'||!html||html.length>3*1024*1024)return rows;
        try{
          var body=$('<div></div>');
          if($.parseHTML&&typeof document!=='undefined')
            body.append($.parseHTML(html,document,false));
          else body.html(html);
          body.find('.videos__button,.videos__item').each(function(){
            try{
              var el=$(this),raw=el.attr('data-json');
              if(!raw||raw.length>32768)return;
              var item=JSON.parse(raw);
              if(!item||typeof item!=='object'||Array.isArray(item))return;
              item.text=String(item.text||el.text()||'').trim();
              item.__voiceButton=el.is('.videos__button');
              var explicitlyBanned=(item.__voiceButton&&filmVoiceBlocked(item.text))||
                filmVoiceBlocked(item.voice_name||'')||
                filmVoiceBlocked(item.translate_voice||'')||
                filmAdMarked(item);
              if(explicitlyBanned){
                blockedObserved[key]=true;
                return;
              }
              if(!filmValidUrl(item.url,true)||
                  !filmPlaybackAllowed({balanser:key},item,
                    item.__voiceButton?item.text:''))return;
              rows.push(item);
            }catch(ignored){}
          });
        }catch(ignored){}
        return rows;
      }
      function walk(key,url,voice,depth,seen,complete,rootRequest){
        if(ended)return;
        url=filmSkazUrl(url);
        if(!filmValidUrl(url,false)||seen[url]||depth>3||total>=18)
          return complete();
        seen[url]=true;total++;
        var req=new Network();requests.push(req);
        if(req.timeout)req.timeout(6800);
        var settled=false;
        var localTimer=setTimeout(function(){
          if(settled||ended)return;settled=true;
          try{req.clear();}catch(ignored){}
          complete();
        },7100);
        var target=rootRequest?context.requestParams(url):url;
        var signed=/(?:[?&](?:sig|signature|token|hash|hmac|expires|exp|auth)=)/i.test(target);
        function done(html){
          if(ended||settled)return;settled=true;clearTimeout(localTimer);
          var rows=parseRows(html,key);
          var videos=rows.filter(function(row){
            return !row.__voiceButton&&(row.method==='play'||row.method==='call');
          });
          videos.forEach(function(row){
            rank(key,voice||row.voice_name||row.translate_voice||'',row);
          });
          var links=rows.filter(function(row){
            return row.method==='link'&&!row.__voiceButton;
          });
          var voices=rows.filter(function(row){return row.__voiceButton;});
          voices.forEach(function(row){
            if(voiceLanguage(row.text))rank(key,row.text,row);
          });
          if(depth<3){
            var options=(voices.length?voices:links).filter(function(row){
              return filmLanguagePriority(row,row.text)>=0;
            }).sort(function(a,b){
              return filmLanguagePriority(b,b.text)-filmLanguagePriority(a,a.text)||
                filmVoiceRank(b.text)-filmVoiceRank(a.text)||
                String(a.url).localeCompare(String(b.url));
            });
            var child=options[0];
            if(child&&child.url&&!seen[filmSkazUrl(child.url)]){
              var nextVoice=voices.length?child.text:voice;
              return walk(key,child.url,nextVoice,depth+1,seen,complete,false);
            }
          }
          complete();
        }
        try{req.native(signed?target:account(target),done,function(){done('');},
          false,{dataType:'text',headers:{'X-Kit-AesGcm':
            Lampa.Storage.get('aesgcmkey','')}});
        }catch(error){done('');}
      }
      selected.forEach(function(key){
        walk(key,sources[key].url,'',0,Object.create(null),function(){
          if(--pending===0)finish();
        },true);
      });
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
        var rows=Array.isArray(json)?json:json&&Array.isArray(json.online)?json.online:[];
        var seen=Object.create(null), arrival=[];
        rows.forEach(function(row){
          if(!row||!eligibleProvider(row))return;
          var key=balanserName(row);
          if(!seen[key])arrival.push(key);
          seen[key]=true;
          var existing=sourceCatalog[key];
          var url=typeof row.url==='string'&&row.url.trim()?row.url.trim():
              existing&&existing.url||'';
          var seasons=row.seasons||row.season_list;
          var count=Array.isArray(seasons)?seasons.length:
              Number(row.season_count||row.seasons_count||row.total_seasons||0);
          sourceCatalog[key]={
            url:url,name:String(row.name||existing&&existing.name||key),
            seasonCount:Math.max(count>0?count:0,existing&&existing.seasonCount||0),
            show:(row.show!==false && row.show!=='false' &&
                  row.show!==0 && row.show!=='0' && filmValidUrl(url,true))||
                  !!(existing&&existing.show&&filmValidUrl(existing.url,true))
          };
        });
        // lifeevents may return a partial provider list. A missing row
        // MUST NOT hide Alloha (or seasons) discovered in lite/events.
        Object.keys(sourceCatalog).forEach(function(key){
          if(!allowedSeriesProvider({balanser:key}))delete sourceCatalog[key];
        });
        if(isEpisodeMedia(object.movie))completeSerialCatalog();
        sources=sourceCatalog;
        filter_sources=Object.keys(sources);
        // Candidate set MUST be the union of initial lite/events and
        // incremental lifeevents, not merely the most recent event batch.
        var ready=Object.keys(sources).filter(function(key){
          return !!(sources[key]&&sources[key].show&&
              filmValidUrl(sources[key].url,true));
        });
        // On some Skaz servers lite/events reports show:false before the
        // lifeevents status update, even though a usable provider URL exists.
        // Only as last resort, try these known URLs instead of declaring
        // ALL serial balancers unavailable without checking any of them.
        if(!ready.length&&isEpisodeMedia(object.movie)){
          ready=Object.keys(sources).filter(function(key){
            return !!(sources[key]&&filmSourceEnabled({
              balanser:key,name:sources[key].name})&&
              filmValidUrl(sources[key].url,true));
          });
        }
        var originalOrder=ready.slice();
        ready.sort(function(a,b){
          var x=arrival.indexOf(a),y=arrival.indexOf(b);
          return (x<0?999+x:x)-(y<0?999+y:y);
        });
        if(isEpisodeMedia(object.movie)&&automaticSelectionEnabled()){
          // Number of seasons is not language/quality evidence. Inspect the
          // voice and stream menus before selecting in Normal mode.
          ready.sort(function(a,b){
            return filmSourcePriority({balanser:b})-
              filmSourcePriority({balanser:a})||String(a).localeCompare(String(b));
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
          if(preflight&&!pin){
            // Preserve allowed uninspected alternatives; discard providers
            // PROVEN to offer only forbidden translations before choosing.
            ready=ready.filter(function(key){return preflight[key]!==-100000;});
            ready.sort(function(a,b){
              var aa=Object.prototype.hasOwnProperty.call(preflight,a)?preflight[a]:0;
              var bb=Object.prototype.hasOwnProperty.call(preflight,b)?preflight[b]:0;
              return bb-aa||filmSourcePriority({balanser:b})-
                filmSourcePriority({balanser:a})||a.localeCompare(b);
            });
          }
          // Keep a deduplicated list: a rejected-only provider must not
          // re-enter the visible source choices through legacy UI filters.
          filter_sources=ready.slice();
          if(!ready.length)return reject(
            new Error('Нет доступных версий с разрешённой озвучкой'));
          balanser=pin&&sources[pin]&&filmSourceEnabled({
              balanser:pin,name:sources[pin].name})&&
              filmValidUrl(sources[pin].url,true)?pin:ready[0];
          source=sources[balanser].url;
          Lampa.Storage.set('amedia_auto_active_balanser',balanser);
          resolve(rows);
        }
        owner.compareSeriesSources(ready,choose);
      });
    };
            // Gated, bounded life-events check: no 15-second polling and no probing
    // every balancer. Accept first advertised available catalog response.
    this.lifeSource = function() {
      var owner=this;
      return new Promise(function(resolve,reject) {
        var url=owner.requestParams(Defined.localhost+'lifeevents?memkey='+(owner.memkey||''));
        var economy=filmSearchMode()==='economy';
        var until=Date.now()+(economy?3500:11200);
        var attempts=0,done=false,rows=Object.create(null),order=[];
        function remember(list){
          (Array.isArray(list)?list:[]).forEach(function(row){
            if(!row||!eligibleProvider(row))return;
            var id=balanserName(row),prev=rows[id];
            if(!Object.prototype.hasOwnProperty.call(rows,id))order.push(id);
            var ready=filmValidUrl(row.url,true)&&row.show!==false&&
              row.show!=='false'&&row.show!==0&&row.show!=='0';
            if(!prev||ready||!filmValidUrl(prev.url,true)||
                prev.show===false)rows[id]=row;
          });
        }
        function snapshot(){return order.map(function(id){return rows[id];});}
        function hasPreferred(){
          return snapshot().some(function(row){
            return filmSourceFamily(row)==='alloha'&&
              filmValidUrl(row.url,true)&&row.show!==false&&
              row.show!=='false'&&row.show!==0&&row.show!=='0';
          })||Object.keys(sourceCatalog).some(function(id){
            var row=sourceCatalog[id];
            return filmSourceFamily({balanser:id,name:row&&row.name})==='alloha'&&
              row&&row.show&&filmValidUrl(row.url,true);
          });
        }
        function settle(error){
          if(done)return;
          done=true;clearTimeout(life_wait_timer);
          if(error)reject(error);else resolve(snapshot());
        }
        function poll(){
          if(done)return;
          attempts++;
          var req=new Network();
          if(req.timeout)req.timeout(economy?2800:3700);
          req.silent(account(url),function(json){
            if(done)return;
            if(json&&json.accsdb)return settle(json);
            remember(json&&json.online);
            if(hasPreferred()||Date.now()>=until||(economy&&attempts>=2))
              return settle(null);
            life_wait_timer=setTimeout(poll,1450);
          },function(){
            if(done)return;
            if(Date.now()>=until||(economy&&attempts>=2))return settle(null);
            life_wait_timer=setTimeout(poll,1450);
          },false,{headers:{'X-Kit-AesGcm':Lampa.Storage.get('aesgcmkey','')}});
        }
        var cutoff=setTimeout(function(){settle(null);},economy?4000:12300);
        var originalSettle=settle;
        settle=function(error){clearTimeout(cutoff);originalSettle(error);};
        poll();
      });
    };
        this.createSource = function() {
      var _this4 = this;
      return new Promise(function(resolve, reject) {
        var url = _this4.requestParams(Defined.localhost + 'lite/events?life=true');
        network.timeout(filmSearchMode()==='economy'?8500:12000);
        network.silent(account(url), function(json) {
          if(!json||typeof json!=='object')
            return reject(new Error('Пустой ответ каталога источников'));
          if (json.accsdb) return reject(json);
          if(json&&Array.isArray(json.online))json.online.forEach(function(row){
            if(row&&eligibleProvider(row)){
              var key=balanserName(row);
              sourceCatalog[key]={url:String(row.url||''),name:String(row.name||key),
                                  seasonCount:Number(row.season_count||0)||0,
                                  show:row.show!==false&&row.show!=='false'&&
                                      filmValidUrl(row.url,true)};
            }
          });
          if (json.life) {
			_this4.memkey = json.memkey;
            // Keep original Lampa metadata: provider title is not authoritative.
            // No persistent header spinner. The episode list already shows
            // loading state while the finite live-source request runs.
            _this4.lifeSource().then(function(rows){
              return _this4.startSource(rows);
            }).then(resolve)["catch"](reject);
          } else {
            _this4.startSource(json).then(resolve)["catch"](reject);
          }
        }, reject, false, {
			headers: {'X-Kit-AesGcm': Lampa.Storage.get('aesgcmkey', '')}
		  });      
    });
    };
    /**
     * Подготовка
     */
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
    this.find = function() {
      this.request(this.requestParams(source));
    };
    this.request = function(url) {
      activeContentUrl=String(url||'');
      var self=this, revision=++requestRevision, selected=balanser;
      number_of_requests++;
      if(number_of_requests>=10)return this.empty();
      // Prevent the 1.8/2.8s probe timeout being inherited by video requests.
      if(network.timeout)network.timeout(filmSearchMode()==='economy'?6200:12500);
      network.native(account(url),function(data){
        if(revision===requestRevision&&selected===balanser)self.parse(data);
      },function(error){
        if(revision===requestRevision&&selected===balanser)
          self.doesNotAnswer(error);
      },false,{
        dataType:'text',
        headers:{'X-Kit-AesGcm':Lampa.Storage.get('aesgcmkey','')}
      });
      clearTimeout(number_of_requests_timer);
      number_of_requests_timer=setTimeout(function(){
        number_of_requests=0;
      },4000);
    };
    // A single malformed data-json record must not hide every other episode.
    this.parseJsonDate = function(str,name) {
      var elems=[];
      if(typeof str!=='string'||!str||str.length>4*1024*1024)return elems;
      try{
        var html=$('<div></div>');
        if($.parseHTML&&typeof document!=='undefined')
          html.append($.parseHTML(str,document,false));
        else html.html(str);
        html.find(name).each(function(){
          try{
            var item=$(this), raw=item.attr('data-json');
            if(!raw)return;
            var data=JSON.parse(raw);
            if(!data||typeof data!=='object'||Array.isArray(data))return;
            var season=item.attr('s'),episode=item.attr('e'),title=item.text();
            // Important: never remove prohibited VOICE BUTTONS here.
            // The caller must inspect ALL buttons to determine which studio
            // the Skaz server activated by default before filtering them.
            // Prematurely dropping "Гоблин" made bannedActive always false.
            if(name!=='.videos__button'&&
                (filmVoiceTitleBlocked(title)||
                 filmVoiceFieldsBlocked(data)))return;
            if(!isEpisodeMedia(object.movie)){
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
            elems.push(data);
          }catch(malformed){/* isolated item, not entire series */}
        });
      }catch(invalid){/* malformed provider HTML */}
      return elems;
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
          _this5.getFileUrl(item, function(json, json_call) {
            if (json && json.url) {
              var playlist = [];
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
                      if (Lampa.Storage.field('player') !== 'inner') {
                        cell.url = elem.stream;
						delete cell.quality;
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
                  if(typeof cell.url!=='function'&&
                      _this5.setDefaultQuality(cell)===false)cell.url='';
                  playlist.push(cell);
                }); //Lampa.Player.playlist(playlist) 
              } else {
                playlist.push(first);
              }
              if (playlist.length > 1) first.playlist = playlist;
              if (first.url) {
                var element = first;
				element.iptv = true;
				element.isonline = true;
                if (element.url && element.isonline) {
  // online.js
} 
else if (element.url) {
  if (false) {
    if (Platform.is('browser') && location.host.indexOf("127.0.0.1") !== -1) {
      Noty.show('Видео открыто в playerInner', {time: 3000});
      $.get('http://online'+dd+'3.skaz.tv/player-inner/' + element.url);
      return;
    }

    Player.play(element);
  } 
  else {
    if (true && Platform.is('browser') && location.host.indexOf("127.0.0.1") !== -1)
      Noty.show('Внешний плеер можно указать в init.conf (playerInner)', {time: 3000});
    Player.play(element);
  }
}	
                Lampa.Player.play(element);
                Lampa.Player.playlist(playlist);
				if(element.subtitles_call) _this5.loadSubtitles(element.subtitles_call)
                item.mark();

              } else {
                Lampa.Noty.show(Lampa.Lang.translate('lampac_nolink'));
              }
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
        var items=this.parseJsonDate(str,'.videos__item');
        var rawButtons=this.parseJsonDate(str,'.videos__button');
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
        buttons.sort(function(a,b){
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
          suitable.sort(function(a,b){
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
      scroll.clear();
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
        scroll.append(item);
      });
      scroll.append('<div class="cso-end-spacer" aria-hidden="true"></div>');
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
      markEpisodeFocus(null);
      ++requestRevision;
      ++drawGeneration; // invalidate any late TMDB metadata callback
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
      filter_items.source = filter_sources;
      select.push({
        title: Lampa.Lang.translate('torrent_parser_reset'),
        reset: true
      });
      // This screen's season selector is a dedicated button; the filter
      // dropdown contains ONLY voice and reset, with no duplicate season.
      if(filter_items.voice&&filter_items.voice.length)
        add('voice',Lampa.Lang.translate('torrent_parser_voice'));
      filter.set('filter',select);
      var voiceControl=filter.render().find('.filter--filter');
      if(voiceControl&&voiceControl.toggleClass)
        voiceControl.toggleClass('hide',!(filter_items.voice&&filter_items.voice.length>1));
      filter.set('sort', filter_sources.map(function(e) {
        return {
          title: sources[e].name+(sources[e].show?'':' · недоступен'),
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
      filter.chosen('sort', [sources[balanser]?sources[balanser].name:balanser||'—']);
    };
    // TMDB metadata is optional presentation data, not a prerequisite for
    // displaying playable episodes. Deduplicate, cache and impose a deadline.
    var metadataCache=Object.create(null);
    this.getEpisodes = function(season, call) {
      var rawId=(object.movie.source==='tmdb'||!object.movie.source)
        ? object.movie.id : object.movie.tmdb_id;
      var id=Number(rawId), key=id+':'+Number(season||0);
      if(!isEpisodeMedia(object.movie) || !isFinite(id) || id<1 ||
         !Lampa.Api || !Lampa.Api.sources || !Lampa.Api.sources.tmdb ||
         !Lampa.Api.sources.tmdb.get) return call([]);
      var cached=metadataCache[key];
      if(cached && cached.expire>Date.now())return call(cached.episodes);
      var delivered=false, timer=0;
      function deliver(rows){
        if(delivered)return;
        delivered=true;clearTimeout(timer);
        call(rows);
      }
      timer=setTimeout(function(){
        // Render without metadata instead of blocking navigation indefinitely.
        metadataCache[key]={episodes:[],expire:Date.now()+12000};
        deliver([]);
      },850);
      try{
        Lampa.Api.sources.tmdb.get('tv/'+id+'/season/'+season,{},function(data){
          var rows=data&&Array.isArray(data.episodes)?data.episodes:[];
          metadataCache[key]={episodes:rows,expire:Date.now()+
            (rows.length?20*60*1000:45*1000)};
          deliver(rows);
        },function(){
          metadataCache[key]={episodes:[],expire:Date.now()+45000};
          deliver([]);
        });
      }catch(error){
        metadataCache[key]={episodes:[],expire:Date.now()+45000};
        deliver([]);
      }
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
      var _this8 = this;
      var params = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      if (!items.length) return this.empty();
      // Keep the previous list on screen until the replacement is complete.
      // Emptying the scroll before an async TMDB response produced blank flashes.
      this.getEpisodes(items[0].season, function(episodes) {
        if(generation!==drawGeneration)return; // a different series/voice won
        // Lampa.Scroll.append ultimately calls DOM append(). Repeatedly
        // appending dozens of rows caused layout/paint churn on TV WebView.
        var stagedRows=document.createDocumentFragment();
        function stageRow(row){if(row&&row[0])stagedRows.appendChild(row[0]);}
        var viewed = Lampa.Storage.cache('online_view', 5000, []);
        var serial = isEpisodeMedia(object.movie);
        var choice = _this8.getChoice();
        var fully = window.innerWidth > 480;
        var scroll_to_element = false;
        var scroll_to_mark = false;
        items.forEach(function(element, index) {
          var episode = serial && episodes.length && !params.similars ? episodes.find(function(e) {
            return e.episode_number == element.episode;
          }) : false;
          var episode_num = element.episode || index + 1;
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
            element.translate_episode_end = _this8.getLastEpisode(items);
            element.translate_voice = element.voice_name;
          }
          if (element.text && !episode) element.title = element.text;
          element.timeline = Lampa.Timeline.view(hash_timeline);
          if (episode) {
            element.title = episode.name;
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
          var still=posterThumbUrl(episode?episode.still_path:
              (serial?'':object.movie.backdrop_path));
          if(img&&(still||episodePoster())){
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
          }else{
            loader.remove();
            if(serial)image.append('<div class="online-prestige__episode-number">'+
                ('0'+(element.episode||index+1)).slice(-2)+'</div>');
          }
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
            markEpisodeFocus(focused);
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
              markEpisodeFocus(focused);
              scheduleFocusScroll(focused);
            });
            html.css('opacity', '0.5');
            stageRow(html);
          });
        }
        // One atomic DOM swap rather than a blank frame + progressive rows.
        scroll.clear();
        if(!object.balanser)
          scroll.append(Lampa.Template.get('lampac_prestige_watched',{}));
        _this8.updateWatched();
        scroll.append(stagedRows);
        // Lampa's bottom player/navigation chrome can cover the last row.
        // A real non-focusable scroll item increases the scrollable extent.
        scroll.append('<div class="cso-end-spacer" aria-hidden="true"></div>');
        var rootBody=scroll.body(), rowFocus=null;
        if(lastFocusedEpisode){
          rowFocus=rootBody.find('.online-prestige--full[data-cso-episode="'+
            lastFocusedEpisode.replace(/[^0-9:]/g,'')+'"]').first();
        }
        if(scroll_to_element)last=scroll_to_element[0];
        else if(scroll_to_mark)last=scroll_to_mark[0];
        else if(rowFocus&&rowFocus.length)last=rowFocus[0];
        else last=rootBody.find('.online-prestige--full.selector').first()[0]||false;
        markEpisodeFocus(last);
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
      });
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
      markEpisodeFocus(null);
      ++drawGeneration;
      ++requestRevision;
      cancelFocusScroll();
      clearTimeout(number_of_requests_timer);
      clearTimeout(life_wait_timer);
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
      version: '0.15.2',
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
        if(!isEpisodeMedia(movie))return window.__capsuleFilmAutoLaunch(movie);
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

    window.__capsuleOpenSkazChoices=function(movie){
      if(!movie||!Lampa.Activity||!Lampa.Activity.push)return false;
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
    var lastActivated=0;
    function activate(){
        // A Lampa selector may emit hover:enter and click for one touch.
        var now=Date.now();
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
 * Capsule Online for Lampa 0.15.2
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
                root.__capsuleSerialAllowed&&!root.__capsuleSerialAllowed(row))
                return;
            if(!film&&providerFamily(row)==='mirkinoz')return;
            if(root.__capsuleFilmPriorities&&root.__capsuleFilmPriorities.enabled&&
                !root.__capsuleFilmPriorities.enabled(row))return;
            if(film&&root.__capsuleFilmHelpers&&
                !root.__capsuleFilmHelpers.allow(movie,row))return;
            var key=keyOf(row);
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
            // Catalog season_count is not a quality or language score.
            result.sort(function(a,b){
                var priorities=root.__capsuleFilmPriorities;
                var order=priorities&&priorities.sources?priorities.sources():[];
                var aa=providerFamily({balanser:a.key,name:a.name});
                var bb=providerFamily({balanser:b.key,name:b.name});
                var ia=order.indexOf(aa),ib=order.indexOf(bb);
                return (ia<0?999:ia)-(ib<0?999:ib)||a.key.localeCompare(b.key);
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
        function fallback(reason){
            if(!get('auto',true)||!get('fallback',true)||
               session.manualSelection||session.attempts>=8||
               !sameActivity(instance))return false;
            // A lifeevents update may contain only one provider; the core
            // catalog holds the complete set of available alternatives.
            if(typeof instance.currentSourceRows==='function'){
                var all=sourceOrder(instance.currentSourceRows(),movie);
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
            session.sourceOrder=sourceOrder(rows,movie);
            var result=raw.startSource.apply(this,arguments);
            if(result&&typeof result.then==='function')
                return result.then(function(value){
                    if(typeof instance.currentSourceRows==='function'){
                        var all=sourceOrder(instance.currentSourceRows(),movie);
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
            '.cso-root .cso-end-spacer{display:block;clear:both;flex:0 0 auto;width:100%;height:clamp(7rem,16vh,13rem);min-height:calc(6rem + env(safe-area-inset-bottom,0px));pointer-events:none;user-select:none}',
            '.cso-root .online-prestige::after{content:""!important;display:block!important;position:absolute!important;inset:0!important;width:auto!important;height:auto!important;margin:0!important;padding:0!important;pointer-events:none!important;border:2px solid transparent!important;border-radius:inherit!important;box-shadow:none!important;opacity:0;z-index:12!important;box-sizing:border-box!important;transition:opacity .14s ease-out}',
            '.cso-root .online-prestige.focus::after,.cso-root .online-prestige.cso-row-focused::after{border-color:rgba(255,255,255,.96)!important;opacity:1!important}',
            '.cso-root .online-prestige.focus,.cso-root .online-prestige.cso-row-focused{background:rgba(255,255,255,.085)}',
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
            '.cso-root .torrent-filter .capsule-season-button{order:2;flex:0 1 auto}',
            '.cso-root .torrent-filter .filter--filter{order:3;flex:0 1 auto}',
            '.cso-root .torrent-filter .filter--search{order:4;flex:0 1 auto;min-width:0}',
            '.cso-root .torrent-filter .selector.focus{background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.65)}',
            '.cso-root .torrent-filter .simple-button--filter span,.cso-root .torrent-filter .simple-button--filter div,.cso-root .torrent-filter .filter--sort span,.cso-root .torrent-filter .filter--filter span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%}',
            '.cso-root .torrent-filter .capsule-season-button>span{font-weight:650}',
            '.cso-root .torrent-filter .capsule-season-button>div{opacity:.65;font-size:.9em}',
            '.cso-root .cso-status{display:none;padding:0 0 .65em;font-size:.82em;opacity:.8}',
            '.cso-root .cso-status[data-state=recover]{display:block;opacity:.88}',
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
        note(sources,'sources_info','Доступные балансеры',
          'Выключенные не появятся при поиске и не используются резервным переключением.');
        [
          ['alloha','Alloha'],['filmix','Filmix'],['kinopub','KinoPub / КПУ'],
          ['mirkinoz','Мир кино Z'],['rezka','Rezka'],['hdrezka','HDRezka'],
          ['skaztv','Skaz TV'],['collaps','Collaps'],['kodik','Kodik'],
          ['redheadsound','RedHeadSound'],['vibix','Vibix']
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
        select(system,'debug','Диагностика',
          'Технические сообщения без ссылок на видео и токенов.',
          {true:'Включена',false:'Выключена'},false);
        note(system,'cache_info','Кэш версий отключён',
          'Старые записи выбора источника и озвучки удаляются однократно. Прогресс просмотра сохраняется.');
        note(system,'version','Версия: 0.15.2',
          'Групповые настройки, очистка старых записей и полный скролл последней серии.');
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
