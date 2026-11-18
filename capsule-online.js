/* Capsule Online 0.7.0 — unified Skaz films and curated series, energy-conscious UI.
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
    var number_of_requests = 0;
    var number_of_requests_timer;
    var life_wait_timer;
    var filter_sources = [], sourceCatalog = Object.create(null);
    var requestRevision=0, seasonButton=null, lastSeasonTap=0;
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
	
    function balanserName(row) {
      var id=String(row&&row.balanser||'').toLowerCase().trim();
      if(id)return id;
      var name=String(row&&row.name||'').toLowerCase().trim();
      if(/^hd\s*[-.]?\s*rezka\b/.test(name))return 'hdrezka';
      if(/^veo\s+veo\b/.test(name))return 'veoveo';
      if(/^skaz\s+tv\b/.test(name))return 'skaztv';
      return name.split(/[\s.:/-]+/)[0];
    }
    window.__capsuleSerialKey=balanserName;
    // Only the six requested serial source families can enter playback/UI.
    function allowedSeriesProvider(row) {
      var id=String(typeof row==='string'?row:row&&row.balanser||'').toLowerCase().trim();
      var name=String(row&&row.name||'').toLowerCase().trim();
      if(/^(?:hd)?rezka(?:tv)?$/.test(id))return true;
      if(/^alloha(?:tv)?$/.test(id))return true;
      if(/^filmix(?:tv)?$/.test(id))return true;
      if(/^skaz(?:tv|online)?$/.test(id))return true;
      if(/^kinopub$/.test(id))return true;
      if(/^(?:veoveo|veo2|veo)$/.test(id))return true;
      // Some Skaz versions omit balanser. The display name must START
      // with the provider, so "Umbrella Filmix" cannot pass.
      if(id)return false;
      return /^(?:(?:hd\s*[-.]?\s*)?rezka|alloha|filmix|skaz\s*tv|skaz|kinopub|veo\s*veo)(?:\b|\s|[-.:]|$)/i.test(name);
    }
    window.__capsuleSerialAllowed=allowedSeriesProvider;
    function isEpisodeMedia(movie){
      if(!movie)return false;
      // Explicit Lampa media type wins over mixed or recycled metadata.
      if(movie.media_type==='movie'||movie.type==='movie')return false;
      if(movie.media_type==='tv'||movie.type==='tv')return true;
      if(Number(movie.number_of_seasons)>0)return true;
      return !!(movie.name&&!movie.title&&!movie.release_date);
    }
    function filmSourceScore(row){
      var key=balanserName(row);
      // A stability preference, not a claim that any provider always works.
      var scores={rezka:120,hdrezka:118,alloha:108,filmix:101,
          kinopub:96,skaztv:90,skaz:90,veoveo:83,veo:83};
      var score=Object.prototype.hasOwnProperty.call(scores,key)?scores[key]:30;
      var title=String(row&&row.name||'').toLowerCase();
      if(/\b(?:camrip|telesync|экранка|трейлер|trailer|teaser)\b/i.test(title))score-=80;
      return score;
    }
    function sameFilmTitle(a,b){
      function norm(value){
        return String(value||'').toLowerCase().replace(/ё/g,'е')
            .replace(/[^a-zа-я0-9]+/g,' ').trim().replace(/\s+/g,' ');
      }
      var x=norm(a),y=norm(b);
      if(!x||!y)return false;
      if(x===y)return true;
      var shorter=x.length<y.length?x:y,longer=x.length<y.length?y:x;
      return shorter.length>=8&&(longer.indexOf(shorter+' ')===0||
          longer.lastIndexOf(' '+shorter)===longer.length-shorter.length-1);
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
      var stated=String(row.movie_title||row.film_title||row.original_title||'').trim();
      if(row.similar)stated=String(row.title||row.text||stated).trim();
      if(stated&&!sameFilmTitle(stated,movie.title||movie.name)&&
          !sameFilmTitle(stated,movie.original_title||movie.original_name))return false;
      return true;
    }
    function eligibleProvider(row){
      if(isEpisodeMedia(object.movie))return allowedSeriesProvider(row);
      var url=String(row&&row.url||'').trim();
      return !!(row&&typeof row==='object'&&
          /^(?:https?:\/\/|\/(?!\/))/i.test(url)&&
          String(row.balanser||row.name||'').trim()&&
          filmItemAllowed(object.movie,row));
    }
    // Pure helpers also serve the series/film wrapper and tests.
    window.__capsuleFilmHelpers={
      isSeries:isEpisodeMedia,sourceScore:filmSourceScore,
      allow:filmItemAllowed,eligible:eligibleProvider
    };
    // Always show these seven named entries (six provider families).
    // A missing/hidden service is a disabled menu item, NEVER a made-up URL.
    var serialProviderSlots=[
      ['rezka','Rezka'],['hdrezka','HDRezka'],['alloha','Alloha'],
      ['filmix','Filmix'],['skaztv','Skaz TV'],['kinopub','KinoPub'],
      ['veoveo','Veo Veo']
    ];
    function completeSerialCatalog(){
      serialProviderSlots.forEach(function(slot){
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
        if(isEpisodeMedia(object.movie)&&!allowedSeriesProvider({balanser:object.balanser})){
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
    this.updateBalanser = function(name) {
      if(!sources[name]||!sources[name].show)return;
      var recent=Lampa.Storage.cache('amedia_auto_last_balanser',3000,{})||{};
      recent[object.movie.id]=name;
      Lampa.Storage.set('amedia_auto_last_balanser',recent);
    };
    // One source of truth: swap the selected URL and refresh the existing
    // screen. Activity.replace() destroyed the selected state and fell back
    // to the first balancer before each new playback request.
    this.changeBalanser = function(name) {
      var next=sources[name];
      if(!next||next.show===false||!next.url){
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
      // Keep voice/season preferences isolated to each provider.
      balanser=name;
      source=next.url;
      object.lampac_custom_select=name;
      Lampa.Storage.set('amedia_auto_active_balanser',name);
      this.updateBalanser(name);
      // Invalidate in-flight callbacks and redraw only this source screen.
      ++requestRevision;
      clearTimeout(number_of_requests_timer);
      number_of_requests=0;
      filter_find={season:[],voice:[]};
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
    this.startSource = function(json) {
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
          sourceCatalog[key]={
            url:url,name:String(row.name||existing&&existing.name||key),
            show:row.show!==false && row.show!=='false' &&
                 row.show!==0 && row.show!=='0' && !!url
          };
        });
        Object.keys(sourceCatalog).forEach(function(key){
          if(!seen[key])sourceCatalog[key].show=false;
        });
        if(isEpisodeMedia(object.movie))completeSerialCatalog();
        sources=sourceCatalog;
        filter_sources=Object.keys(sources);
        var ready=arrival.filter(function(key){
          return !!(sources[key]&&sources[key].show&&sources[key].url);
        });
        if(!isEpisodeMedia(object.movie)){
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
            return {title:sources[key].name,source:key,selected:false,ghost:true};
          }));
          return reject(new Error(isEpisodeMedia(object.movie) ? 'Нет доступных источников сериала' : 'Нет подходящих источников фильма в Skaz'));
        }
        var pin=object.lampac_custom_select;
        var routing=window.__capsuleSerialRouting;
        if(!pin&&routing&&routing.id===String(object.movie.id)&&
           Date.now()-routing.at<30000)pin=routing.chosen;
        balanser=pin&&sources[pin]&&sources[pin].show?pin:ready[0];
        source=sources[balanser].url;
        Lampa.Storage.set('amedia_auto_active_balanser',balanser);
        resolve(rows);
      });
    };
            // Gated, bounded life-events check: no 15-second polling and no probing
    // every balancer. Accept first advertised available catalog response.
    this.lifeSource = function() {
      var owner=this;
      return new Promise(function(resolve,reject) {
        var url=owner.requestParams(Defined.localhost+'lifeevents?memkey='+(owner.memkey||''));
        var attempts=0,done=false;
        function settle(error,rows) {
          if(done)return;
          done=true;
          clearTimeout(life_wait_timer);
          if(error)reject(error);else resolve(rows);
        }
        function poll() {
          if(done)return;
          attempts++;
          network.timeout(2800);
          network.silent(account(url),function(json){
            if(done)return;
            if(json&&json.accsdb)return settle(json);
            var all=json&&Array.isArray(json.online)?json.online:[];
            var ready=all.filter(function(row){
              return row&&row.url&&row.show!==false&&eligibleProvider(row);
            });
            if(ready.length)
              return settle(null,all.filter(function(row){
                return row&&row.url&&eligibleProvider(row);
              }));
            if(attempts>=2)return settle(new Error('Нет доступных разрешённых источников'));
            life_wait_timer=setTimeout(poll,650);
          },function(error){
            if(done)return;
            if(attempts>=2)return settle(error||new Error('Сервис не отвечает'));
            life_wait_timer=setTimeout(poll,650);
          },false,{headers:{'X-Kit-AesGcm':Lampa.Storage.get('aesgcmkey','')}});
        }
        poll();
      });
    };
        this.createSource = function() {
      var _this4 = this;
      return new Promise(function(resolve, reject) {
        var url = _this4.requestParams(Defined.localhost + 'lite/events?life=true');
        network.timeout(8500);
        network.silent(account(url), function(json) {
          if(!json||typeof json!=='object')
            return reject(new Error('Пустой ответ каталога источников'));
          if (json.accsdb) return reject(json);
          if(json&&Array.isArray(json.online))json.online.forEach(function(row){
            if(row&&row.url&&eligibleProvider(row)){
              var key=balanserName(row);
              sourceCatalog[key]={url:row.url,name:String(row.name||key),
                                  show:row.show!==false};
            }
          });
          if (json.life) {
			_this4.memkey = json.memkey;
			if (json.title) {
              if (object.movie.name) object.movie.name = json.title;
              if (object.movie.title) object.movie.title = json.title;
			}
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
      var self=this, revision=++requestRevision, selected=balanser;
      number_of_requests++;
      if(number_of_requests>=10)return this.empty();
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
            data.active=item.hasClass('active');
            elems.push(data);
          }catch(malformed){/* isolated item, not entire series */}
        });
      }catch(invalid){/* malformed provider HTML */}
      return elems;
    };
    this.getFileUrl = function(file, call, waiting_rch) {
	  var _this = this;
      if(!file||!file.url){if(typeof call==='function')call(false,{});return;}
	  
      if(Lampa.Storage.field('player') !== 'inner' && file.stream && Lampa.Platform.is('apple')){
		  var newfile = Lampa.Arrays.clone(file);
		  newfile.method = 'play';
		  newfile.url = file.stream;
		  call(newfile, {});
	  }
      else if (file.method == 'play') call(file, {});
      else {
        Lampa.Loading.start(function() {
          Lampa.Loading.stop();
          Lampa.Controller.toggle('content');
          network.clear();
        });
        network["native"](account(file.url), function(json) {
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
      if(!map||typeof map!=='object'||Array.isArray(map))return;
      var target=Number(Lampa.Storage.field('video_quality_default'))||0;
      Object.keys(map).forEach(function(label){
        var url=map[label];
        if(typeof url!=='string')return;
        if(parseInt(label,10)===target){
          data.url=url;this.orUrlReserve(data);
        }
        if(url.indexOf(' or ')!==-1)map[label]=url.split(' or ')[0];
      },this);
    };
    this.display = function(videos) {
      var _this5 = this;
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
              _this5.setDefaultQuality(first);
              if (item.season) {
                videos.forEach(function(elem) {
                  var cell = _this5.toPlayElement(elem);
                  if (elem == item) cell.url = json.url;
                  else {
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
                              _this5.setDefaultQuality(cell);
                              elem.mark();
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
                  _this5.setDefaultQuality(cell);
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
                _this5.updateBalanser(balanser);
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
        var items = this.parseJsonDate(str, '.videos__item');
        var buttons = this.parseJsonDate(str, '.videos__button');
        if(!isEpisodeMedia(object.movie)){
          items=items.filter(function(item){return filmItemAllowed(object.movie,item);});
          if(!items.length){
            this.doesNotAnswer(new Error('Источник вернул сериал или другой фильм'));
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
              if (find_voice_url && !find_voice_url.active) {
                //console.log('Lampac', 'go to voice', find_voice_url);
                this.replaceChoice({
                  voice: buttons.indexOf(find_voice_url),
                  voice_name: find_voice_url.text
                });
                this.request(find_voice_url.url);
              } else if (find_voice_name && !find_voice_name.active) {
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
              this.replaceChoice({
                voice: 0,
                voice_url: '',
                voice_name: ''
              });
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
      var data=Lampa.Storage.cache('amedia_auto_choice_'+(for_balanser||balanser),3000,{});
      if(!data||typeof data!=='object'||Array.isArray(data))data={};
      var save=data[object.movie.id];
      if(!save||typeof save!=='object'||Array.isArray(save))save={};
      Lampa.Arrays.extend(save,{
        season:0,voice:0,voice_name:'',voice_id:0,
        episodes_view:{},movie_view:''
      });
      if(!save.episodes_view||typeof save.episodes_view!=='object'||
         Array.isArray(save.episodes_view))save.episodes_view={};
      save.season=Math.max(0,Math.trunc(Number(save.season)||0));
      save.voice=Math.max(0,Math.trunc(Number(save.voice)||0));
      return save;
    };
    this.saveChoice = function(choice, for_balanser) {
      var data = Lampa.Storage.cache('amedia_auto_choice_' + (for_balanser || balanser), 3000, {});
      if(!data||typeof data!=='object'||Array.isArray(data))data={};
      data[object.movie.id] = choice;
      Lampa.Storage.set('amedia_auto_choice_' + (for_balanser || balanser), data);
      this.updateBalanser(for_balanser || balanser);
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
          self.replaceChoice({season:item.index,voice:0,voice_url:''});
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
          selected: e == balanser,
          ghost: !sources[e].show||!sources[e].url
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
      if(object.movie.__capsuleMixedMedia){call([]);return;}
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
        if (watched.balanser_name) line.push(watched.balanser_name);
        if (watched.voice_name) line.push(watched.voice_name);
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
          var voice_name = choice.voice_name || (filter_find.voice[0] ? filter_find.voice[0].title : false) || element.voice_name || (serial ? 'Неизвестно' : element.text) || 'Неизвестно';
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
          if (!serial) {
            if (choice.movie_view == hash_behold) scroll_to_element = html;
          } else if (typeof episode_last !== 'undefined' && episode_last == episode_num) {
            scroll_to_element = html;
          }
          if (serial && !episode) {
            image.append('<div class="online-prestige__episode-number">' + ('0' + (element.episode || index + 1)).slice(-2) + '</div>');
            loader.remove();
          }
		  else if (!serial && object.movie.backdrop_path == 'undefined') loader.remove();
          else {
            var img = html.find('img')[0];
            img.onerror = function() {
              img.onerror = null; // Never loop if fallback image is missing.
              img.src = './img/img_broken.svg';
            };
            img.onload = function() {
              image.addClass('online-prestige__img--loaded');
              loader.remove();
              if (serial) image.append('<div class="online-prestige__episode-number">' + ('0' + (element.episode || index + 1)).slice(-2) + '</div>');
            };
            img.loading = 'lazy';
            img.decoding = 'async';
            img.src = Lampa.TMDB.image('t/p/w300' + (episode ? episode.still_path : object.movie.backdrop_path));
            images.push(img);
			element.thumbnail = img.src
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
            if (!serial) {
              choice.movie_view = hash_behold;
            } else {
              choice.episodes_view[element.season] = episode_num;
            }
            _this8.saveChoice(choice);
            var voice_name_text = choice.voice_name || element.voice_name || element.title;
            if (voice_name_text.length > 30) voice_name_text = voice_name_text.slice(0, 30) + '...';
            _this8.watched({
              balanser: balanser,
              balanser_name: Lampa.Utils.capitalizeFirstLetter(sources[balanser] ? sources[balanser].name.split(' ')[0] : balanser),
              voice_id: choice.voice_id,
              voice_name: voice_name_text,
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
            if (episode.still_path) {
              img.onerror = function() {
                img.onerror = null;
                img.src = './img/img_broken.svg';
              };
              img.onload = function() {
                image.addClass('online-prestige__img--loaded');
                loader.remove();
                image.append('<div class="online-prestige__episode-number">' + ('0' + episode.episode_number).slice(-2) + '</div>');
              };
              img.loading = 'lazy';
              img.decoding = 'async';
              img.src = Lampa.TMDB.image('t/p/w300' + episode.still_path);
              images.push(img);
            } else {
              loader.remove();
              image.append('<div class="online-prestige__episode-number">' + ('0' + episode.episode_number).slice(-2) + '</div>');
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
      version: '0.7.0',
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
		  if (watchedData.balanser_name) line.push(watchedData.balanser_name);
		  if (watchedData.voice_name) line.push(watchedData.voice_name);
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

		      if (sel.continue_yes && watchedData.balanser) {
		        var last_select_balanser = Lampa.Storage.cache('amedia_auto_last_balanser', 3000, {});
		        last_select_balanser[object.id] = watchedData.balanser;
		        Lampa.Storage.set('amedia_auto_last_balanser', last_select_balanser);

		        var choiceData = Lampa.Storage.cache('amedia_auto_choice_' + watchedData.balanser, 3000, {});
		        if (!choiceData[object.id]) choiceData[object.id] = {};
		        var seasonIdx = (parseInt(watchedData.season) || 1) - 1;
		        if (seasonIdx < 0) seasonIdx = 0;
		        choiceData[object.id].season = seasonIdx;
		        if (watchedData.voice_name) choiceData[object.id].voice_name = watchedData.voice_name;
		        Lampa.Storage.set('amedia_auto_choice_' + watchedData.balanser, choiceData);

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
		          lampac_continue_episode: parseInt(watchedData.episode) || 1
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
          search_two:String(card.original_title||card.original_name||title),
          capsuleFallback:!isEpisodeMedia(card)
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
            window.__capsuleOpenSkazChoices(movie);
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
          if (watchedData.balanser_name) line.push(watchedData.balanser_name);
          if (watchedData.voice_name) line.push(watchedData.voice_name);
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

              if (sel.continue_yes && watchedData.balanser) {
                var last_select_balanser = Lampa.Storage.cache('amedia_auto_last_balanser', 3000, {});
                last_select_balanser[e.movie.id] = watchedData.balanser;
                Lampa.Storage.set('amedia_auto_last_balanser', last_select_balanser);

                var choiceData = Lampa.Storage.cache('amedia_auto_choice_' + watchedData.balanser, 3000, {});
                if (!choiceData[e.movie.id]) choiceData[e.movie.id] = {};
                var seasonIdx = (parseInt(watchedData.season) || 1) - 1;
                if (seasonIdx < 0) seasonIdx = 0;
                choiceData[e.movie.id].season = seasonIdx;
                if (watchedData.voice_name) choiceData[e.movie.id].voice_name = watchedData.voice_name;
                Lampa.Storage.set('amedia_auto_choice_' + watchedData.balanser, choiceData);

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
                  lampac_continue_episode: parseInt(watchedData.episode) || 1
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
        Lampa.Storage.sync('amedia_auto_choice_' + name, 'object_object');
      });
      Lampa.Storage.sync('amedia_auto_watched_last', 'object_object');
      Lampa.Storage.sync('amedia_auto_last_balanser', 'object_object');
      Lampa.Storage.sync('amedia_auto_continue_play', 'bool');
    }
  }
  if (!window.capsule_amedia_core_plugin) startPlugin();
})();
/* CAPSULE AUTOPICK MODULE START */
/*
 * Capsule Online for Lampa 0.7.0
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
        if(/^veo\s+veo\b/.test(name))return 'veoveo';
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
        // No trusted connection estimate: use stable Full HD rather than gamble
        // on 4K (MSE support does not establish 4K decode performance).
        if (height >= 2000 && network >= 22) return 2160;
        if (network && network < 5) return 480;
        if (network && network < 10) return 720;
        return 1080;
    }
    // Curated series providers only. A large quality claim does not make an
    // unknown aggregator (Umbrella etc.) a safe automatic choice.
    function providerFamily(item) {
        var key=keyOf(item),name=String(item&&item.name||'').toLowerCase().trim();
        if(/^(?:hd)?rezka(?:tv)?$/.test(key)||
            (key==='hd'&&/^hd\s*[-.]?\s*rezka\b/.test(name)))return 'rezka';
        if(/^alloha(?:tv)?$/.test(key))return 'alloha';
        if(/^filmix(?:tv)?$/.test(key))return 'filmix';
        if(/^skaz(?:tv|online)?$/.test(key))return 'skaz';
        if(/^kinopub$/.test(key))return 'kinopub';
        if(/^(?:veoveo|veo|veo2)$/.test(key))return 'veoveo';
        return '';
    }
    function sourceOrder(rows,movie){
        var film=!!movie&&!isSeries(movie);
        var order=[],latest=Object.create(null),available=
            Array.isArray(rows)?rows:rows&&Array.isArray(rows.online)?rows.online:[];
        available.forEach(function(row){
            if(!row||!row.url)return;
            if(!film&&(!providerFamily(row)||
               root.__capsuleSerialAllowed&&!root.__capsuleSerialAllowed(row)))return;
            if(film&&(!/^(?:https?:\/\/|\/(?!\/))/i.test(String(row.url||''))||
                (root.__capsuleFilmHelpers&&!root.__capsuleFilmHelpers.allow(movie,row))))return;
            var key=keyOf(row);
            if(!key)return;
            if(!Object.prototype.hasOwnProperty.call(latest,key))order.push(key);
            latest[key]=row; // final provider status is authoritative
        });
        var result=order.filter(function(key){
            var row=latest[key];
            return !!(row&&row.url&&row.show!==false&&
                      row.show!=='false'&&row.show!==0&&row.show!=='0');
        }).map(function(key,index){
            var row=latest[key];
            return {key:key,name:String(row.name||key),
                score:film&&root.__capsuleFilmHelpers?
                    root.__capsuleFilmHelpers.sourceScore(row):0,
                original:index};
        });
        if(film)result.sort(function(a,b){
            return b.score-a.score||a.original-b.original;
        });
        return result;
    }
        function voiceScore(label) {
        var s = String(label || '').toLowerCase();
        var points = 0;
        if (/red.?head.?sound|\brhs\b/.test(s)) points += 40;
        if (/lostfilm/.test(s)) points += 38;
        if (/newstudio|new.?studio/.test(s)) points += 36;
        if (/jaskier/.test(s)) points += 35;
        if (/кубик|куб в кубе/.test(s)) points += 29;
        if (/hdrezka|rezka|дубляж/.test(s)) points += 27;
        if (/профессиональн|многоголос/.test(s)) points += 24;
        if (/официальн|лицензионн/.test(s)) points += 21;
        if (/оригинал|original/.test(s)) points += 6;
        if (/одноголос|любительск|нейросет|автоперевод/.test(s)) points -= 18;
        if (/комментар|описательн|тифлокомментар/.test(s)) points -= 30;
        if (/18\+/.test(s)) points -= 4;
        return points;
    }
    function qualityCandidate(qualityMap) {
        if (!qualityMap || typeof qualityMap !== 'object'||Array.isArray(qualityMap))return null;
        var limit = qualityLimit(), best = null, fallback = null;
        Object.keys(qualityMap).forEach(function(label){
            var url = qualityMap[label];
            if (url && typeof url === 'object') url = url.url || url.src;
            if (typeof url !== 'string') return;
            url = url.split(' or ')[0].trim();
            if (!/^https?:\/\//i.test(url)) return;
            var height = resolution(label);
            if (!height) return;
            var item = {label:label,url:url,height:height};
            if (!fallback || height < fallback.height) fallback = item;
            if (height <= limit && (!best || height > best.height)) best = item;
        });
        return best || fallback;
    }
    function filmVideoScore(video){
        var score=video&&video.method==='play'?12:0;
        var label=String(video&&(
            video.voice_name||video.translate_voice||video.text||video.title)||'');
        score+=voiceScore(label);
        var poor=/\b(?:camrip|telesync|cam|ts|trailer|teaser|sample)\b|экранка|трейлер/i;
        if(poor.test(label))score-=100;
        var quality=video&&(video.qualitys||video.quality);
        if(quality&&typeof quality==='object'){
            var best=qualityCandidate(quality);
            if(best)score+=Math.min(best.height,2160)/120;
        }else{
            var height=resolution(label);
            if(height)score+=Math.min(height,1080)/180;
        }
        return score;
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
               session.manualSelection||session.attempts>=3||
               !sameActivity(instance))return false;
            var current=activeSource();
            if(current)session.bad[current]=true;
            var next=session.sourceOrder.filter(function(row){
                return row.key!==current&&!session.bad[row.key];
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
            return raw.startSource.apply(this,arguments);
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
        if(typeof raw.parse==='function')instance.parse=function(data){
            if(get('auto',true)&&get('voice','smart')!=='original'&&
               typeof data==='string'&&typeof this.parseJsonDate==='function'){
                try{
                    var buttons=this.parseJsonDate(data,'.videos__button');
                    if(buttons&&buttons.length>1){
                        var previous=this.getChoice&&this.getChoice(activeSource());
                        if(!previous||!previous.voice_name||get('voice','smart')==='force'){
                            var best=buttons.slice().sort(function(a,b){
                                return voiceScore(b.text)-voiceScore(a.text);
                            })[0];
                            var once=activeSource()+'|'+String(best&&best.url||'');
                            if(best&&best.url&&!best.active&&
                               !session.voiceTried[once]&&voiceScore(best.text)>0){
                                session.voiceTried[once]=true;
                                this.replaceChoice({voice:buttons.indexOf(best),
                                    voice_name:best.text,voice_url:best.url});
                            }
                        }
                    }
                }catch(e){debug('Озвучка: '+e.message);}
            }
            return raw.parse.apply(this,arguments);
        };
        if(typeof raw.quality==='function')instance.setDefaultQuality=function(data){
            var result=raw.quality.apply(this,arguments);
            if(get('auto',true)){
                var selected=qualityCandidate(data&&data.quality);
                if(selected){data.url=selected.url;data.__capsuleQuality=selected.label;}
            }
            return result;
        };
        if(typeof raw.getFileUrl==='function'&&!isSeries(movie))
            instance.getFileUrl=function(file,callback,waiting){
                var owner=this,settled=false;
                return raw.getFileUrl.call(owner,file,function(stream,details){
                    if(settled)return;
                    settled=true;
                    if((!stream||!stream.url)&&!session.manualSelection)
                        fallback('не удалось получить ссылку фильма');
                    if(typeof callback==='function')callback(stream,details);
                },waiting);
            };
        if(typeof raw.display==='function')instance.display=function(videos){
            var selected=videos;
            if(!isSeries(movie)&&Array.isArray(videos)&&videos.length>1){
                selected=videos.slice().sort(function(a,b){
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
            '.cso-root .online-prestige::after{content:""!important;display:block!important;position:absolute!important;inset:0!important;width:auto!important;height:auto!important;margin:0!important;padding:0!important;pointer-events:none!important;border:2px solid transparent!important;border-radius:inherit!important;box-shadow:none!important;opacity:0;z-index:12!important;box-sizing:border-box!important;transition:opacity .14s ease-out}',
            '.cso-root .online-prestige.focus::after,.cso-root .online-prestige.cso-row-focused::after{border-color:rgba(255,255,255,.96)!important;opacity:1!important}',
            '.cso-root .online-prestige.focus,.cso-root .online-prestige.cso-row-focused{background:rgba(255,255,255,.085)}',
            '.cso-root .online-prestige__body{padding:1em 1.25em;min-width:0}',
            '.cso-root .online-prestige__img{width:11.8em;min-height:7em}',
            '.cso-root .online-prestige__img>img{border-radius:.8em 0 0 .8em;transition:opacity .25s ease-out}',
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
        if (settingsInstalled || !L || !L.SettingsApi ||
            !L.SettingsApi.addComponent || !L.SettingsApi.addParam) return;
        settingsInstalled=true;
        L.SettingsApi.addComponent({
            component:COMPONENT,name:'Capsule Online · Автовыбор',
            icon:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12h6l3-7 3 14 3-7h3"/></svg>'
        });
        [
          ['auto','Автовыбор для фильмов и сериалов',
              'Фильмы: проверка соответствия, приоритет источника, озвучки и качества; сериалы: проверенные балансеры.',
              {true:'Включён',false:'Выключен'},true],
          ['quality','Качество видео','Авто учитывает экран и известную скорость сети. При неизвестной скорости выбирается до 1080p.',
              {auto:'Авто · стабильно',max:'Максимальное',2160:'До 4K',1080:'До 1080p',720:'До 720p'},'auto'],
          ['voice','Озвучка','Учитывать прежний ручной выбор и рейтинг озвучки.',
              {smart:'Авто · с памятью выбора',force:'Авто · всегда выбирать лучшую',original:'Не менять выбор'},'smart'],
          ['fallback','Резервный источник','При ошибках Skaz переключать на другой доступный источник без потери ручного выбора.',
              {true:'Включён',false:'Выключен'},true],
          ['debug','Отладка','Только технические сообщения без ссылок, заголовков и токенов.',
              {true:'Включена',false:'Выключена'},false]
        ].forEach(function(row){
            var values={};
            Object.keys(row[3]).forEach(function(key){
                values[key]=row[3][key];
            });
            L.SettingsApi.addParam({
                component:COMPONENT,
                param:{name:PREFIX+row[0],type:'select',values:values,default:row[4]},
                field:{name:row[1],description:row[2]}
            });
        });
        L.SettingsApi.addParam({component:COMPONENT,
            param:{name:PREFIX+'version',type:'static'},
            field:{name:'Версия: 0.7.0 · единый Skaz для фильмов и сериалов',
                description:'Полный код выбора и интерфейса включён; видеопотоки от серверов источников.'}
        });
    }

    function boot() {
        if (!root.Lampa || !root.Lampa.Component || !root.Lampa.Storage) {
            if (++BOOT_ATTEMPTS < 35) setTimeout(boot,300);
            return;
        }
        L=root.Lampa;
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
