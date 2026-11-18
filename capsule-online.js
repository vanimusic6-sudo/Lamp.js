/* Capsule Online 0.3.0 — separate Amedia movies and curated serials, energy-conscious UI.
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

  var balansers_with_search;
  
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
        console.log('RCH', url, data);
        result(eval(data));
      } else if (url == 'evalrun') {
        console.log('RCH', url, data);
        eval(data);
      } else if (url == 'ping') {
        result('pong');
      } else {
        console.log('RCH', url);
        network["native"](url, result, function(e) {
          console.log('RCH', 'result empty, ' + e.status);
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
      console.log('RCH', 'ConnectionId: ' + connectionId);
      window.rch_nws[hostkey].connectionId = connectionId;
    });
    client.on('Closed', function() {
      console.log('RCH', 'Connection closed');
    });
    client.on('Error', function(err) {
      console.log('RCH', 'error:', err);
    });
  });
};
  window.rch_nws[hostkey].typeInvoke('http://online'+dd+'3.skaz.tv', function() {});

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

  function component(object) {
    var network = new Network();
    var scroll = new Lampa.Scroll({
      mask: true,
      over: true
    });
    var files = new Lampa.Explorer(object);
    var filter = new Lampa.Filter(object);
    var sources = {};
    var last;
    var source;
    var balanser;
    var initialized;
    var balanser_timer;
    var images = [];
    var number_of_requests = 0;
    var number_of_requests_timer;
    var life_wait_times = 0;
    var life_wait_timer;
    var filter_sources = {};
    var filter_translate = {
      season: Lampa.Lang.translate('torrent_serial_season'),
      voice: Lampa.Lang.translate('torrent_parser_voice'),
      source: Lampa.Lang.translate('settings_rest_source')
    };
    var filter_find = {
      season: [],
      voice: []
    };
	
    if (balansers_with_search == undefined) {
      network.timeout(10000);
      network.silent(account('http://online'+dd+'3.skaz.tv/lite/withsearch'), function(json) {
        balansers_with_search = json;
      }, function() {
		  balansers_with_search = [];
	  });
    }
	
    function balanserName(j) {
      var bals = j.balanser;
      var name = j.name.split(' ')[0];
      return (bals || name).toLowerCase();
    }
	
	function clarificationSearchAdd(value){
		var id = Lampa.Utils.hash(object.movie.number_of_seasons ? object.movie.original_name : object.movie.original_title);
		var all = Lampa.Storage.get('clarification_search','{}');
		
		all[id] = value;
		
		Lampa.Storage.set('clarification_search',all);
	}
	
	function clarificationSearchDelete(){
		var id = Lampa.Utils.hash(object.movie.number_of_seasons ? object.movie.original_name : object.movie.original_title);
		var all = Lampa.Storage.get('clarification_search','{}');
		
		delete all[id];
		
		Lampa.Storage.set('clarification_search',all);
	}
	
	function clarificationSearchGet(){
		var id = Lampa.Utils.hash(object.movie.number_of_seasons ? object.movie.original_name : object.movie.original_title);
		var all = Lampa.Storage.get('clarification_search','{}');
		
		return all[id];
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
            var url = filter_find[a.stype][b.index].url;
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
          object.lampac_custom_select = a.source;
          _this.changeBalanser(a.source);
        }
      };
      if (filter.addButtonBack) filter.addButtonBack();
      filter.render().find('.filter--sort span').text(Lampa.Lang.translate('lampac_balanser'));
      scroll.body().addClass('torrent-list');
      files.appendFiles(scroll.render());
      files.appendHead(filter.render());
      scroll.minus(files.render().find('.explorer__files-head'));
      scroll.body().append(Lampa.Template.get('lampac_content_loading'));
      Lampa.Controller.enable('content');
      this.loading(false);
	  if(object.balanser){
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
        if (!balansers_with_search.find(function(b) {
            return balanser.slice(0, b.length) == b;
          })) {
          filter.render().find('.filter--search').addClass('hide');
        }
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
          query.push('serial=' + (object.movie.name ? 1 : 0));
          if (object.movie.imdb_id) query.push('imdb_id=' + (object.movie.imdb_id || ''));
          if (object.movie.kinopoisk_id) query.push('kinopoisk_id=' + (object.movie.kinopoisk_id || ''));
          var url = Defined.localhost + 'externalids?' + query.join('&');
          network.timeout(10000);
          network.silent(account(url), function(json) {
            for (var name in json) {
              object.movie[name] = json[name];
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
    this.updateBalanser = function(balanser_name) {
      var last_select_balanser = Lampa.Storage.cache('amedia_auto_last_balanser', 3000, {});
      last_select_balanser[object.movie.id] = balanser_name;
      Lampa.Storage.set('amedia_auto_last_balanser', last_select_balanser);
    };
    this.changeBalanser = function(balanser_name) {
      this.updateBalanser(balanser_name);
      Lampa.Storage.set('amedia_auto_balanser', balanser_name);
      var to = this.getChoice(balanser_name);
      var from = this.getChoice();
      if (from.voice_name) to.voice_name = from.voice_name;
      this.saveChoice(to, balanser_name);
      Lampa.Activity.replace();
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
      query.push('serial=' + (object.movie.name ? 1 : 0));
      query.push('original_language=' + (object.movie.original_language || ''));
      query.push('year=' + ((object.movie.release_date || object.movie.first_air_date || '0000') + '').slice(0, 4));
      query.push('source=' + card_source);
      query.push('clarification=' + (object.clarification ? 1 : 0));
      query.push('similar=' + (object.similar ? true : false));
      query.push('rchtype=' + (((window.rch_nws && window.rch_nws[hostkey]) ? window.rch_nws[hostkey].type : (window.rch && window.rch[hostkey]) ? window.rch[hostkey].type : '') || ''));
      if (Lampa.Storage.get('account_email', '')) query.push('cub_id=' + Lampa.Utils.hash(Lampa.Storage.get('account_email', '')));
      return url + (url.indexOf('?') >= 0 ? '&' : '?') + query.join('&');
    };
    this.getLastChoiceBalanser = function() {
      var last_select_balanser = Lampa.Storage.cache('amedia_auto_last_balanser', 3000, {});
      if (last_select_balanser[object.movie.id]) {
        return last_select_balanser[object.movie.id];
      } else {
        return Lampa.Storage.get('amedia_auto_balanser', filter_sources.length ? filter_sources[0] : '');
      }
    };
    this.startSource = function(json) {
      return new Promise(function(resolve, reject) {
        json.forEach(function(j) {
          var name = balanserName(j);
          sources[name] = {
            url: j.url,
            name: j.name,
            show: typeof j.show == 'undefined' ? true : j.show
          };
        });
        filter_sources = Lampa.Arrays.getKeys(sources);
        if (filter_sources.length) {
          var last_select_balanser = Lampa.Storage.cache('amedia_auto_last_balanser', 3000, {});
          if (last_select_balanser[object.movie.id]) {
            balanser = last_select_balanser[object.movie.id];
          } else {
            balanser = Lampa.Storage.get('amedia_auto_balanser', filter_sources[0]);
          }
          if (!sources[balanser]) balanser = filter_sources[0];
          if (!sources[balanser].show && !object.lampac_custom_select) balanser = filter_sources[0];
          source = sources[balanser].url;
          Lampa.Storage.set('amedia_auto_active_balanser', balanser);
          resolve(json);
        } else {
          reject();
        }
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
          network.timeout(3500);
          network.silent(account(url),function(json){
            if(done)return;
            if(json&&json.accsdb)return settle(json);
            var all=json&&Array.isArray(json.online)?json.online:[];
            var ready=all.filter(function(row){return row&&row.url&&row.show!==false;});
            if(ready.length)return settle(null,ready);
            if(attempts>=3)return settle(new Error('Нет доступных источников'));
            life_wait_timer=setTimeout(poll,1100);
          },function(error){
            if(done)return;
            if(attempts>=2)return settle(error||new Error('Сервис не отвечает'));
            life_wait_timer=setTimeout(poll,1100);
          },false,{headers:{'X-Kit-AesGcm':Lampa.Storage.get('aesgcmkey','')}});
        }
        poll();
      });
    };
        this.createSource = function() {
      var _this4 = this;
      return new Promise(function(resolve, reject) {
        var url = _this4.requestParams(Defined.localhost + 'lite/events?life=true');
        network.timeout(15000);
        network.silent(account(url), function(json) {
          if (json.accsdb) return reject(json);
          if (json.life) {
			_this4.memkey = json.memkey;
			if (json.title) {
              if (object.movie.name) object.movie.name = json.title;
              if (object.movie.title) object.movie.title = json.title;
			}
            filter.render().find('.filter--sort').append('<span class="lampac-balanser-loader" style="width: 1.2em; height: 1.2em; margin-top: 0; background: url(./img/loader.svg) no-repeat 50% 50%; background-size: contain; margin-left: 0.5em"></span>');
            _this4.lifeSource().then(_this4.startSource).then(resolve)["catch"](reject);
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
      number_of_requests++;
      if (number_of_requests < 10) {
        network["native"](account(url), this.parse.bind(this), this.doesNotAnswer.bind(this), false, {
          dataType: 'text',
		  headers: {'X-Kit-AesGcm': Lampa.Storage.get('aesgcmkey', '')}
        });
        clearTimeout(number_of_requests_timer);
        number_of_requests_timer = setTimeout(function() {
          number_of_requests = 0;
        }, 4000);
      } else this.empty();
    };
    this.parseJsonDate = function(str, name) {
      try {
        var html = $('<div>' + str + '</div>');
        var elems = [];
        html.find(name).each(function() {
          var item = $(this);
          var data = JSON.parse(item.attr('data-json'));
          var season = item.attr('s');
          var episode = item.attr('e');
          var text = item.text();
          if (!object.movie.name) {
            if (text.match(/\d+p/i)) {
              if (!data.quality) {
                data.quality = {};
                data.quality[text] = data.url;
              }
              text = object.movie.title;
            }
            if (text == 'По умолчанию') {
              text = object.movie.title;
            }
          }
          if (episode) data.episode = parseInt(episode);
          if (season) data.season = parseInt(season);
          if (text) data.text = text;
          data.active = item.hasClass('active');
          elems.push(data);
        });
        return elems;
      } catch (e) {
        return [];
      }
    };
    this.getFileUrl = function(file, call, waiting_rch) {
	  var _this = this;
	  
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
      if (Lampa.Arrays.getKeys(data.quality).length) {
        for (var q in data.quality) {
          if (parseInt(q) == Lampa.Storage.field('video_quality_default')) {
            data.url = data.quality[q];
            this.orUrlReserve(data);
          }
          if (data.quality[q].indexOf(" or ") !== -1)
            data.quality[q] = data.quality[q].split(" or ")[0];
        }
      }
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
                            if (stream.url) {
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
              file: stream.url,
              quality: item.qualitys
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
      if (json.rch) return this.rch(json);
      try {
        var items = this.parseJsonDate(str, '.videos__item');
        var buttons = this.parseJsonDate(str, '.videos__button');
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
          scroll.update($(e.target), true);
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
      var data = Lampa.Storage.cache('amedia_auto_choice_' + (for_balanser || balanser), 3000, {});
      var save = data[object.movie.id] || {};
      Lampa.Arrays.extend(save, {
        season: 0,
        voice: 0,
        voice_name: '',
        voice_id: 0,
        episodes_view: {},
        movie_view: ''
      });
      return save;
    };
    this.saveChoice = function(choice, for_balanser) {
      var data = Lampa.Storage.cache('amedia_auto_choice_' + (for_balanser || balanser), 3000, {});
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
        img.onerror = function() {};
        img.onload = function() {};
        img.src = '';
      });
      images = [];
    };
    /**
     * Очистить список файлов
     */
    this.reset = function() {
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
    this.filter = function(filter_items, choice) {
      var _this7 = this;
      var select = [];
      var add = function add(type, title) {
        var need = _this7.getChoice();
        var items = filter_items[type];
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
      this.saveChoice(choice);
      if (filter_items.voice && filter_items.voice.length) add('voice', Lampa.Lang.translate('torrent_parser_voice'));
      if (filter_items.season && filter_items.season.length) add('season', Lampa.Lang.translate('torrent_serial_season'));
      filter.set('filter', select);
      filter.set('sort', filter_sources.map(function(e) {
        return {
          title: sources[e].name,
          source: e,
          selected: e == balanser,
          ghost: !sources[e].show
        };
      }));
      this.selected(filter_items);
    };
    /**
     * Показать что выбрано в фильтре
     */
    this.selected = function(filter_items) {
      var need = this.getChoice(),
        select = [];
      for (var i in need) {
        if (filter_items[i] && filter_items[i].length) {
          if (i == 'voice') {
            select.push(filter_translate[i] + ': ' + filter_items[i][need[i]]);
          } else if (i !== 'source') {
            if (filter_items.season.length >= 1) {
              select.push(filter_translate.season + ': ' + filter_items[i][need[i]]);
            }
          }
        }
      }
      filter.chosen('filter', select);
      filter.chosen('sort', [sources[balanser].name]);
    };
    this.getEpisodes = function(season, call) {
      var episodes = [];
	  var tmdb_id = object.movie.id;
	  if (['cub', 'tmdb'].indexOf(object.movie.source || 'tmdb') == -1) 
        tmdb_id = object.movie.tmdb_id;
      if (typeof tmdb_id == 'number' && object.movie.name) {
		  Lampa.Api.sources.tmdb.get('tv/' + tmdb_id + '/season/' + season, {}, function(data){
			  episodes = data.episodes || [];
			  
			  call(episodes);
		  }, function(){
			  call(episodes);
		  })
      } else call(episodes);
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
    this.draw = function(items) {
      var _this8 = this;
      var params = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};
      if (!items.length) return this.empty();
      scroll.clear();
      if(!object.balanser)scroll.append(Lampa.Template.get('lampac_prestige_watched', {}));
      this.updateWatched();
      this.getEpisodes(items[0].season, function(episodes) {
        var viewed = Lampa.Storage.cache('online_view', 5000, []);
        var serial = object.movie.name ? true : false;
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
              img.src = './img/img_broken.svg';
            };
            img.onload = function() {
              image.addClass('online-prestige__img--loaded');
              loader.remove();
              if (serial) image.append('<div class="online-prestige__episode-number">' + ('0' + (element.episode || index + 1)).slice(-2) + '</div>');
            };
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
            last = e.target;
            if (params.onFocus) params.onFocus(element, html, data);
            scroll.update($(e.target), true);
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
          scroll.append(html);
        });
        if (serial && episodes.length > items.length && !params.similars) {
          var left = episodes.slice(items.length);
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
                img.src = './img/img_broken.svg';
              };
              img.onload = function() {
                image.addClass('online-prestige__img--loaded');
                loader.remove();
                image.append('<div class="online-prestige__episode-number">' + ('0' + episode.episode_number).slice(-2) + '</div>');
              };
              img.src = Lampa.TMDB.image('t/p/w300' + episode.still_path);
              images.push(img);
            } else {
              loader.remove();
              image.append('<div class="online-prestige__episode-number">' + ('0' + episode.episode_number).slice(-2) + '</div>');
            }
            html.on('hover:focus', function(e) {
              last = e.target;
              scroll.update($(e.target), true);
            });
            html.css('opacity', '0.5');
            scroll.append(html);
          });
        }
        if (scroll_to_element) {
          last = scroll_to_element[0];
        } else if (scroll_to_mark) {
          last = scroll_to_mark[0];
        }
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
      html.find('.online-empty__time').html(er && er.accsdb ? er.msg : Lampa.Lang.translate('lampac_does_not_answer_text').replace('{balanser}', balanser[balanser].name));
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
      if(er && er.accsdb) html.find('.online-empty__title').html(er.msg);
	  
      var tic = er && er.accsdb ? 10 : 5;
      html.find('.cancel').on('hover:enter', function() {
        clearInterval(balanser_timer);
      });
      html.find('.change').on('hover:enter', function() {
        clearInterval(balanser_timer);
        filter.render().find('.filter--sort').trigger('hover:enter');
      });
      scroll.clear();
      scroll.append(html);
      this.loading(false);
      balanser_timer = setInterval(function() {
        tic--;
        html.find('.timeout').text(tic);
        if (tic == 0) {
          clearInterval(balanser_timer);
          var keys = Lampa.Arrays.getKeys(sources);
          var indx = keys.indexOf(balanser);
          var next = keys[indx + 1];
          if (!next) next = keys[0];
          balanser = next;
          if (Lampa.Activity.active().activity == _this9.activity) _this9.changeBalanser(balanser);
        }
      }, 1000);
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
      // Background blur is expensive on TV WebViews: render once per source
      // screen, not after every balancer/season update or D-pad navigation.
      if (!object.__capsuleBackgroundApplied) {
        object.__capsuleBackgroundApplied=true;
        Lampa.Background.immediately(Lampa.Utils.cardImgBackgroundBlur(object.movie));
      }
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
      network.clear();
      this.clearImages();
      files.destroy();
      scroll.destroy();
      clearInterval(balanser_timer);
      clearTimeout(life_wait_timer);
    };
  }
  
  function addSourceSearch(spiderName, spiderUri) {
    var network = new Lampa.Reguest();

    var source = {
      title: spiderName,
      search: function(params, oncomplite) {
        function searchComplite(links) {
          var keys = Lampa.Arrays.getKeys(links);

          if (keys.length) {
            var status = new Lampa.Status(keys.length);

            status.onComplite = function(result) {
              var rows = [];

              keys.forEach(function(name) {
                var line = result[name];

                if (line && line.data && line.type == 'similar') {
                  var cards = line.data.map(function(item) {
                    item.title = Lampa.Utils.capitalizeFirstLetter(item.title);
                    item.release_date = item.year || '0000';
                    item.balanser = spiderUri;
                    if (item.img !== undefined) {
                      if (item.img.charAt(0) === '/')
                        item.img = Defined.localhost + item.img.substring(1);
                      if (item.img.indexOf('/proxyimg') !== -1)
                        item.img = account(item.img);
                    }

                    return item;
                  })

                  rows.push({
                    title: name,
                    results: cards
                  })
                }
              })

              oncomplite(rows);
            }

            keys.forEach(function(name) {
              network.silent(account(links[name]), function(data) {
                status.append(name, data);
              }, function() {
                status.error();
              }, false, {
			headers: {'X-Kit-AesGcm': Lampa.Storage.get('aesgcmkey', '')}
		  })
            })
          } else {
            oncomplite([]);
          }
        }

        network.silent(account(Defined.localhost + 'lite/' + spiderUri + '?title=' + params.query), function(json) {
          if (json.rch) {
            rchRun(json, function() {
              network.silent(account(Defined.localhost + 'lite/' + spiderUri + '?title=' + params.query), function(links) {
                searchComplite(links);
              }, function() {
                oncomplite([]);
              }, false, {
			headers: {'X-Kit-AesGcm': Lampa.Storage.get('aesgcmkey', '')}           
     });
            });
          } else {
            searchComplite(json);
          }
        }, function() {
          oncomplite([]);
        }, false, {
			headers: {'X-Kit-AesGcm': Lampa.Storage.get('aesgcmkey', '')}
		  });
      },
      onCancel: function() {
        network.clear()
      },
      params: {
        lazy: true,
        align_left: true,
        card_events: {
          onMenu: function() {}
        }
      },
      onMore: function(params, close) {
        close();
      },
      onSelect: function(params, close) {
        close();

        Lampa.Activity.push({
          url: params.element.url,
          title: 'Onlyskaz - ' + params.element.title,
          component: 'capsuleamedia',
          movie: params.element,
          page: 1,
          search: params.element.title,
          clarification: true,
          balanser: params.element.balanser,
          noinfo: true
        });
      }
    }

    Lampa.Search.addSource(source)
  }

  function startPlugin() {
    window.capsule_amedia_core_plugin = true;
    var manifst = {
      type: 'video',
      version: '',
      name: 'Amedia · Capsule Online',
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
        if (!(Number(movie.number_of_seasons)>0 || movie.media_type==='tv' ||
              movie.type==='tv' || (!!movie.name && !movie.title))) {
            if (typeof window.__capsuleAmediaFilmPlay === 'function')
                return window.__capsuleAmediaFilmPlay(movie);
            Lampa.Noty.show('Amedia: каталог фильмов пока не загружен');
            return;
        }
        resetTemplates();
        Lampa.Component.add('capsuleamedia', component);
		
		var id = Lampa.Utils.hash(object.number_of_seasons ? object.original_name : object.original_title);
		var all = Lampa.Storage.get('clarification_search','{}');
		
		// --- Continue watching logic ---
		var isSeries = object.number_of_seasons || object.name;
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
    Lampa.Template.add('lampac_css', "\n        <style>\n        @charset 'UTF-8';.online-prestige{position:relative;-webkit-border-radius:.3em;border-radius:.3em;background-color:rgba(0,0,0,0.3);display:-webkit-box;display:-webkit-flex;display:-moz-box;display:-ms-flexbox;display:flex}.online-prestige__body{padding:1.2em;line-height:1.3;-webkit-box-flex:1;-webkit-flex-grow:1;-moz-box-flex:1;-ms-flex-positive:1;flex-grow:1;position:relative}@media screen and (max-width:480px){.online-prestige__body{padding:.8em 1.2em}}.online-prestige__img{position:relative;width:13em;-webkit-flex-shrink:0;-ms-flex-negative:0;flex-shrink:0;min-height:8.2em}.online-prestige__img>img{position:absolute;top:0;left:0;width:100%;height:100%;-o-object-fit:cover;object-fit:cover;-webkit-border-radius:.3em;border-radius:.3em;opacity:0;-webkit-transition:opacity .3s;-o-transition:opacity .3s;-moz-transition:opacity .3s;transition:opacity .3s}.online-prestige__img--loaded>img{opacity:1}@media screen and (max-width:480px){.online-prestige__img{width:7em;min-height:6em}}.online-prestige__folder{padding:1em;-webkit-flex-shrink:0;-ms-flex-negative:0;flex-shrink:0}.online-prestige__folder>svg{width:4.4em !important;height:4.4em !important}.online-prestige__viewed{position:absolute;top:1em;left:1em;background:rgba(0,0,0,0.45);-webkit-border-radius:100%;border-radius:100%;padding:.25em;font-size:.76em}.online-prestige__viewed>svg{width:1.5em !important;height:1.5em !important}.online-prestige__episode-number{position:absolute;top:0;left:0;right:0;bottom:0;display:-webkit-box;display:-webkit-flex;display:-moz-box;display:-ms-flexbox;display:flex;-webkit-box-align:center;-webkit-align-items:center;-moz-box-align:center;-ms-flex-align:center;align-items:center;-webkit-box-pack:center;-webkit-justify-content:center;-moz-box-pack:center;-ms-flex-pack:center;justify-content:center;font-size:2em}.online-prestige__loader{position:absolute;top:50%;left:50%;width:2em;height:2em;margin-left:-1em;margin-top:-1em;background:url(./img/loader.svg) no-repeat center center;-webkit-background-size:contain;-o-background-size:contain;background-size:contain}.online-prestige__head,.online-prestige__footer{display:-webkit-box;display:-webkit-flex;display:-moz-box;display:-ms-flexbox;display:flex;-webkit-box-pack:justify;-webkit-justify-content:space-between;-moz-box-pack:justify;-ms-flex-pack:justify;justify-content:space-between;-webkit-box-align:center;-webkit-align-items:center;-moz-box-align:center;-ms-flex-align:center;align-items:center}.online-prestige__timeline{margin:.8em 0}.online-prestige__timeline>.time-line{display:block !important}.online-prestige__title{font-size:1.7em;overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:1;line-clamp:1;-webkit-box-orient:vertical}@media screen and (max-width:480px){.online-prestige__title{font-size:1.4em}}.online-prestige__time{padding-left:2em}.online-prestige__info{display:-webkit-box;display:-webkit-flex;display:-moz-box;display:-ms-flexbox;display:flex;-webkit-box-align:center;-webkit-align-items:center;-moz-box-align:center;-ms-flex-align:center;align-items:center}.online-prestige__info>*{overflow:hidden;-o-text-overflow:ellipsis;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:1;line-clamp:1;-webkit-box-orient:vertical}.online-prestige__quality{padding-left:1em;white-space:nowrap}.online-prestige__scan-file{position:absolute;bottom:0;left:0;right:0}.online-prestige__scan-file .broadcast__scan{margin:0}.online-prestige .online-prestige-split{font-size:.8em;margin:0 1em;-webkit-flex-shrink:0;-ms-flex-negative:0;flex-shrink:0}.online-prestige.focus::after{content:'';position:absolute;top:-0.6em;left:-0.6em;right:-0.6em;bottom:-0.6em;-webkit-border-radius:.7em;border-radius:.7em;border:solid .3em #fff;z-index:-1;pointer-events:none}.online-prestige+.online-prestige{margin-top:1.5em}.online-prestige--folder .online-prestige__footer{margin-top:.8em}.online-prestige-watched{padding:1em}.online-prestige-watched__icon>svg{width:1.5em;height:1.5em}.online-prestige-watched__body{padding-left:1em;padding-top:.1em;display:-webkit-box;display:-webkit-flex;display:-moz-box;display:-ms-flexbox;display:flex;-webkit-flex-wrap:wrap;-ms-flex-wrap:wrap;flex-wrap:wrap}.online-prestige-watched__body>span+span::before{content:' ● ';vertical-align:top;display:inline-block;margin:0 .5em}.online-prestige-rate{display:-webkit-inline-box;display:-webkit-inline-flex;display:-moz-inline-box;display:-ms-inline-flexbox;display:inline-flex;-webkit-box-align:center;-webkit-align-items:center;-moz-box-align:center;-ms-flex-align:center;align-items:center}.online-prestige-rate>svg{width:1.3em !important;height:1.3em !important}.online-prestige-rate>span{font-weight:600;font-size:1.1em;padding-left:.7em}.online-empty{line-height:1.4}.online-empty__title{font-size:1.8em;margin-bottom:.3em}.online-empty__time{font-size:1.2em;font-weight:300;margin-bottom:1.6em}.online-empty__buttons{display:-webkit-box;display:-webkit-flex;display:-moz-box;display:-ms-flexbox;display:flex}.online-empty__buttons>*+*{margin-left:1em}.online-empty__button{background:rgba(0,0,0,0.3);font-size:1.2em;padding:.5em 1.2em;-webkit-border-radius:.2em;border-radius:.2em;margin-bottom:2.4em}.online-empty__button.focus{background:#fff;color:black}.online-empty__templates .online-empty-template:nth-child(2){opacity:.5}.online-empty__templates .online-empty-template:nth-child(3){opacity:.2}.online-empty-template{background-color:rgba(255,255,255,0.3);padding:1em;display:-webkit-box;display:-webkit-flex;display:-moz-box;display:-ms-flexbox;display:flex;-webkit-box-align:center;-webkit-align-items:center;-moz-box-align:center;-ms-flex-align:center;align-items:center;-webkit-border-radius:.3em;border-radius:.3em}.online-empty-template>*{background:rgba(0,0,0,0.3);-webkit-border-radius:.3em;border-radius:.3em}.online-empty-template__ico{width:4em;height:4em;margin-right:2.4em}.online-empty-template__body{height:1.7em;width:70%}.online-empty-template+.online-empty-template{margin-top:1em}\n        </style>\n    ");
    $('body').append(Lampa.Template.get('lampac_css', {}, true));

    function resetTemplates() {
      Lampa.Template.add('lampac_prestige_full', "<div class=\"online-prestige online-prestige--full selector\">\n            <div class=\"online-prestige__img\">\n                <img alt=\"\">\n                <div class=\"online-prestige__loader\"></div>\n            </div>\n            <div class=\"online-prestige__body\">\n                <div class=\"online-prestige__head\">\n                    <div class=\"online-prestige__title\">{title}</div>\n                    <div class=\"online-prestige__time\">{time}</div>\n                </div>\n\n                <div class=\"online-prestige__timeline\"></div>\n\n                <div class=\"online-prestige__footer\">\n                    <div class=\"online-prestige__info\">{info}</div>\n                    <div class=\"online-prestige__quality\">{quality}</div>\n                </div>\n            </div>\n        </div>");
      Lampa.Template.add('lampac_content_loading', "<div class=\"online-empty\">\n            <div class=\"broadcast__scan\"><div></div></div>\n\t\t\t\n            <div class=\"online-empty__templates\">\n                <div class=\"online-empty-template selector\">\n                    <div class=\"online-empty-template__ico\"></div>\n                    <div class=\"online-empty-template__body\"></div>\n                </div>\n                <div class=\"online-empty-template\">\n                    <div class=\"online-empty-template__ico\"></div>\n                    <div class=\"online-empty-template__body\"></div>\n                </div>\n                <div class=\"online-empty-template\">\n                    <div class=\"online-empty-template__ico\"></div>\n                    <div class=\"online-empty-template__body\"></div>\n                </div>\n            </div>\n        </div>");
      Lampa.Template.add('lampac_does_not_answer', "<div class=\"online-empty\">\n            <div class=\"online-empty__title\">\n                #{lampac_balanser_dont_work}\n            </div>\n            <div class=\"online-empty__time\">\n                #{lampac_balanser_timeout}\n            </div>\n            <div class=\"online-empty__buttons\">\n                <div class=\"online-empty__button selector cancel\">#{cancel}</div>\n                <div class=\"online-empty__button selector change\">#{lampac_change_balanser}</div>\n            </div>\n            <div class=\"online-empty__templates\">\n                <div class=\"online-empty-template\">\n                    <div class=\"online-empty-template__ico\"></div>\n                    <div class=\"online-empty-template__body\"></div>\n                </div>\n                <div class=\"online-empty-template\">\n                    <div class=\"online-empty-template__ico\"></div>\n                    <div class=\"online-empty-template__body\"></div>\n                </div>\n                <div class=\"online-empty-template\">\n                    <div class=\"online-empty-template__ico\"></div>\n                    <div class=\"online-empty-template__body\"></div>\n                </div>\n            </div>\n        </div>");
      Lampa.Template.add('lampac_prestige_rate', "<div class=\"online-prestige-rate\">\n            <svg width=\"17\" height=\"16\" viewBox=\"0 0 17 16\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n                <path d=\"M8.39409 0.192139L10.99 5.30994L16.7882 6.20387L12.5475 10.4277L13.5819 15.9311L8.39409 13.2425L3.20626 15.9311L4.24065 10.4277L0 6.20387L5.79819 5.30994L8.39409 0.192139Z\" fill=\"#fff\"></path>\n            </svg>\n            <span>{rate}</span>\n        </div>");
      Lampa.Template.add('lampac_prestige_folder', "<div class=\"online-prestige online-prestige--folder selector\">\n            <div class=\"online-prestige__folder\">\n                <svg viewBox=\"0 0 128 112\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n                    <rect y=\"20\" width=\"128\" height=\"92\" rx=\"13\" fill=\"white\"></rect>\n                    <path d=\"M29.9963 8H98.0037C96.0446 3.3021 91.4079 0 86 0H42C36.5921 0 31.9555 3.3021 29.9963 8Z\" fill=\"white\" fill-opacity=\"0.23\"></path>\n                    <rect x=\"11\" y=\"8\" width=\"106\" height=\"76\" rx=\"13\" fill=\"white\" fill-opacity=\"0.51\"></rect>\n                </svg>\n            </div>\n            <div class=\"online-prestige__body\">\n                <div class=\"online-prestige__head\">\n                    <div class=\"online-prestige__title\">{title}</div>\n                    <div class=\"online-prestige__time\">{time}</div>\n                </div>\n\n                <div class=\"online-prestige__footer\">\n                    <div class=\"online-prestige__info\">{info}</div>\n                </div>\n            </div>\n        </div>");
      Lampa.Template.add('lampac_prestige_watched', "<div class=\"online-prestige online-prestige-watched selector\">\n            <div class=\"online-prestige-watched__icon\">\n                <svg width=\"21\" height=\"21\" viewBox=\"0 0 21 21\" fill=\"none\" xmlns=\"http://www.w3.org/2000/svg\">\n                    <circle cx=\"10.5\" cy=\"10.5\" r=\"9\" stroke=\"currentColor\" stroke-width=\"3\"/>\n                    <path d=\"M14.8477 10.5628L8.20312 14.399L8.20313 6.72656L14.8477 10.5628Z\" fill=\"currentColor\"/>\n                </svg>\n            </div>\n            <div class=\"online-prestige-watched__body\">\n                \n            </div>\n        </div>");
    }
    var button = "<div class=\"full-start__button selector view--online capsule-amedia--button\" data-subtitle=\"".concat(manifst.name, " ").concat(manifst.version, "\">\n <svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 50 51\"><circle cx=\"25\" cy=\"25\" r=\"23\" fill=\"none\" stroke=\"#7B68EE\" stroke-width=\"3\"></circle><circle cx=\"25\" cy=\"25\" r=\"20\" fill=\"#7B68EE\"></circle><path d=\"M24.757812 11.998047C30.071813 11.998047 33.514203 14.994953 34.283203 20.251953L30.080078 20.789062C30.080078 17.378062 28.162859 15.841797 24.755859 15.841797C21.970859 15.841797 18.994141 16.444969 18.994141 19.042969C18.994141 20.937969 20.6335 21.807875 26.3125 22.921875C30.3585 23.715875 35 25.297406 35 30.566406C35 34.158406 31.087719 38 25.261719 38C19.230719 38 15.569625 34.913828 14.640625 29.048828L18.892578 28.302734C18.892578 32.399734 21.118719 34.158203 25.261719 34.158203C28.808719 34.158203 31.174203 32.557406 31.158203 30.566406C31.143203 28.657406 30.003172 27.637547 25.576172 26.685547C20.946172 25.689547 15.152344 24.644969 15.152344 19.042969C15.152344 14.471969 20.102813 11.998047 24.757812 11.998047z\" fill=\"white\"></path></svg>\n\n        <span>Amedia</span>\n    </div>"); // нужна заглушка, а то при страте лампы говорит пусто
    Lampa.Component.add('capsuleamedia', component); //то же самое
    resetTemplates();

    function addButton(e) {
    var activityRoot = null;
    try { activityRoot = Lampa.Activity.active().activity.render(); } catch (ignored) {}
    if (!e || !e.movie || !activityRoot || !activityRoot.length) return;
    if (activityRoot.find('.capsule-amedia--button').length) return;
    var btn = $(Lampa.Lang.translate(button));
    btn.on('hover:enter', function() {
        var movie = e.movie || {};
        var series = Number(movie.number_of_seasons)>0 || movie.media_type==='tv' ||
            movie.type==='tv' || (!!movie.name && !movie.title);
        if (!series) {
            // Film only: original Skaz Amedia catalog, never Onlyskaz balancers.
            if (typeof window.__capsuleAmediaFilmPlay === 'function')
                window.__capsuleAmediaFilmPlay(movie);
            else Lampa.Noty.show('Amedia: каталог фильмов пока не загружен');
            return;
        }
        resetTemplates();
        Lampa.Component.add('capsuleamedia', component);
        
        var id = Lampa.Utils.hash(e.movie.number_of_seasons ? e.movie.original_name : e.movie.original_title);
        var all = Lampa.Storage.get('clarification_search','{}');
        
        // --- Continue watching logic ---
        var isSeries = e.movie.number_of_seasons || e.movie.name;
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
    });

    // Always place the Amedia action in the full-screen action row. The old
    // .view--torrent anchor is not present in all current Lampa layouts.
    var bar = activityRoot.find('.full-start-new__buttons, .full-start__buttons, .full-start__buttons-container').first();
    var first = activityRoot.find('.full-start__button').first();
    if (bar.length) bar.prepend(btn);
    else if (first.length) first.before(btn);
    else if (e.render && e.render.length) e.render.after(btn);
    else activityRoot.find('.full-start').first().prepend(btn);
    btn.attr('data-capsule-amedia','1');
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
 * Capsule Online for Lampa 0.3.0
 * Companion for Skaz Onlyskaz (capsuleamedia).
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
    var boundStats = false;
    var activeVideo = null;

    function get(key, fallback) {
        try {
            var value = L.Storage.get(PREFIX + key, fallback);
            if (value === undefined || value === null) return fallback;
            if (typeof fallback === 'boolean') return value === true || value === 'true' || value === 1;
            return value;
        } catch (ignored) { return fallback; }
    }
    function put(key, value) {
        try { L.Storage.set(PREFIX + key, value); } catch (ignored) {}
    }
    function info(message) {
        try { if (L.Noty && L.Noty.show) L.Noty.show(message); } catch (ignored) {}
    }
    function debug(message) {
        if (get('debug', false) && root.console && root.console.log)
            root.console.log('[Capsule Online]', message);
    }
    function isSeries(movie) {
        return !!(movie && (movie.name || Number(movie.number_of_seasons) > 0 || movie.type === 'tv'));
    }
    function keyOf(item) {
        var name = String(item && (item.balanser || (item.name || '').split(' ')[0]) || '');
        return name.toLowerCase().trim();
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
        var s=(keyOf(item)+' '+String(item&&item.name||'')).toLowerCase()
            .replace(/[^a-z0-9а-яё]+/g,'');
        if (/hdrezka|rezka|rezkagold|rc rezka/.test(s)) return 'rezka';
        if (/alloha/.test(s)) return 'alloha';
        if (/filmix/.test(s)) return 'filmix';
        if (/skaztv|skazonline|skaz/.test(s)) return 'skaz';
        if (/kinopub/.test(s)) return 'kinopub';
        if (/veoveo|veo2/.test(s)) return 'veoveo';
        return '';
    }
    var SERIES_FAMILY_BONUS={rezka:60,alloha:52,filmix:48,skaz:44,kinopub:40,veoveo:36};
        function metrics() {
        var value = get('metrics', {});
        return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    }
    function record(source, ok, elapsed) {
        source = String(source || '').replace(/[^a-z0-9/_-]/gi, '').slice(0, 48);
        if (!source) return;
        var values = metrics(), m = values[source] || {good:0,bad:0,latency:0,at:0};
        m.good = Math.max(0, Number(m.good) || 0);
        m.bad = Math.max(0, Number(m.bad) || 0);
        if (ok) {
            m.good++;
            if (isFinite(elapsed) && elapsed > 0 && elapsed < 45000)
                m.latency = m.latency ? Math.round(m.latency * .7 + elapsed * .3) : Math.round(elapsed);
        } else {
            m.bad++;
            m.at = Date.now();
        }
        if (m.good + m.bad > 100) {
            m.good = Math.round(m.good * .65);
            m.bad = Math.round(m.bad * .65);
        }
        values[source] = m;
        var keys = Object.keys(values);
        if (keys.length > 80) {
            keys.sort(function(a,b) {
                return (values[a].at || 0) - (values[b].at || 0);
            });
            keys.slice(0,keys.length-80).forEach(function(key){delete values[key];});
        }
        put('metrics', values);
    }
    function sourceScore(item, previous) {
        if (!item || item.show === false) return -100000;
        var family=providerFamily(item);
        if (!family) return -100000;
        var label=String(item.name||''), rawHeight=resolution(label);
        var limit=qualityLimit(), knownHeight=rawHeight?Math.min(rawHeight,limit):0;
        // Within the requested family quality matters, but unknown resolution
        // must never outrank a reliable 1080p source by accident.
        var score=SERIES_FAMILY_BONUS[family]+
            (knownHeight ? (knownHeight/1080)*48 : 0);
        var m=previous[keyOf(item)];
        if(m){
            score+=Math.min(25,(Number(m.good)||0)*4);
            score-=Math.min(90,(Number(m.bad)||0)*18);
            if(m.at&&Date.now()-Number(m.at)<10*60*1000)score-=35;
            if(m.latency>0)score-=Math.min(15,m.latency/1000);
        }
        return score;
    }
    function sourceOrder(rows) {
        var values=metrics(),seen=Object.create(null);
        return (rows||[]).filter(function(row){
            if(!row||!row.url||row.show===false||!providerFamily(row))return false;
            var key=keyOf(row);
            if(seen[key])return false;
            seen[key]=true;
            return true;
        }).map(function(row,index){
            return {key:keyOf(row),name:String(row.name||keyOf(row)),
                score:sourceScore(row,values),original:index};
        }).sort(function(a,b){return b.score-a.score||a.original-b.original;});
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
        if (!qualityMap || typeof qualityMap !== 'object') return null;
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
    function bindPlayerStats() {
        if (boundStats || !L.Player || !L.Player.listener) return;
        boundStats = true;
        L.Player.listener.follow('create',function(evt){
            var data = evt && (evt.data || evt);
            if (!data || !data.isonline) return;
            try { if (L.Activity.active().component !== 'capsuleamedia') return; } catch (ignored) { return; }
            var key = '';
            try { key = L.Storage.get('amedia_auto_active_balanser', ''); } catch (ignored) {}
            if (key) activeVideo = {key:String(key),at:Date.now(),confirmed:false};
        });
        if (L.PlayerVideo && L.PlayerVideo.listener) {
            ['playing','loadeddata'].forEach(function(type){
                L.PlayerVideo.listener.follow(type,function(){
                    if (!activeVideo || activeVideo.confirmed) return;
                    activeVideo.confirmed=true;
                    record(activeVideo.key,true,Date.now()-activeVideo.at);
                    debug('Поток начал воспроизводиться');
                });
            });
            L.PlayerVideo.listener.follow('error',function(evt){
                if (!activeVideo || activeVideo.confirmed) return;
                if (evt && evt.fatal === false) return;
                record(activeVideo.key,false,0);
                debug('Не удалось запустить поток');
                activeVideo=null;
            });
        }
    }

    function decorate(instance, session) {
        try {
            var view = instance.render && instance.render();
            var $view = view && view.jquery ? view : root.jQuery && root.jQuery(view);
            if (!$view || !$view.length) return;
            $view.addClass('cso-root');
            if (session._lastView !== $view[0]) { session._lastView=$view[0];session._lastStatus=''; }
            var status = $view.find('.cso-status');
            if (!status.length) {
                status = root.jQuery('<div class="cso-status" aria-live="polite"></div>');
                // Files are appended asynchronously, whereas the filter header
                // is present immediately after the source's initialize().
                // Place the indicator in the head, outside the scroll item list:
                // no extra D-pad selector or shifted episode indexes.
                var head = $view.find('.torrent-filter').first();
                if (head.length) head.after(status);
                else $view.prepend(status);
            }
            var current = L.Storage.get('amedia_auto_active_balanser', '') || 'выбирается';
            var quality = get('quality','auto') === 'auto' ? 'качество: авто' : 'качество: '+get('quality','auto');
            var route = get('auto',true) ? 'АВТОВЫБОР' : 'РУЧНОЙ ВЫБОР';
            var label=route + '   ·   ' + current + '   ·   ' + quality;
            if(session._lastStatus!==label){status.text(label);session._lastStatus=label;}
            if (session.status) status.attr('data-state', session.status);
        } catch (error) { debug('UI: '+error.message); }
    }
    function sameActivity(instance) {
        try { return L.Activity.active().activity === instance.activity; }
        catch (ignored) { return false; }
    }
    // Movies are launched directly from the dedicated Amedia film catalog.
    // No DOM polling/autoclick; it caused duplicate navigation and stutter.
    function autoStartFilm() {}
        function enhance(instance, movie) {
        if (!instance || instance.__csoEnhanced) return instance;
        instance.__csoEnhanced = true;
        var session = {movie: movie || {}, sourceOrder:[], bad:{}, attempts:0,
            launched:false, status:'ready', autoSwitch:false, voiceTried:{}};
        instance.__csoSession = session;
        var rawStartSource = instance.startSource;
        var rawChange = instance.changeBalanser;
        var rawParse = instance.parse;
        var rawDisplay = instance.display;
        var rawSetQuality = instance.setDefaultQuality;
        var rawNoAnswer = instance.doesNotAnswer;
        var rawGetFileUrl = instance.getFileUrl;
        var rawStart = instance.start;

        function activeSource() {
            try {return String(L.Storage.get('amedia_auto_active_balanser',''));}catch(e){return '';}
        }
        function nextSource(reason) {
            if (!get('auto',true) || !get('fallback',true) ||
                session.attempts >= 3 || !sameActivity(instance)) return false;
            var current = activeSource();
            if (current) { session.bad[current] = true; record(current,false,0); }
            var next = session.sourceOrder.filter(function(row){
                return !session.bad[row.key] && row.key !== current;
            })[0];
            if (!next) return false;
            session.attempts++;
            session.status='recover';
            session.autoSwitch=true;
            info('Capsule Online: пробуем другой источник · ' + next.name);
            debug('Переход на другой балансер, причина: '+reason);
            try {
                rawChange.call(instance,next.key);
                decorate(instance,session);
                return true;
            } catch (error) { debug('Смена источника: '+error.message);return false; }
            finally { session.autoSwitch=false; }
        }

        if (typeof rawStartSource === 'function') instance.startSource = function(rows){
            if (get('auto',true) && Array.isArray(rows)) {
                session.sourceOrder=sourceOrder(rows);
                if (!session.sourceOrder.length) {
                    // Never send requests to unrelated sources such as Umbrella.
                    // The manual source filter remains available in Lampa.
                    info('Amedia: проверенные источники недоступны. Выберите источник вручную.');
                    return Promise.reject(new Error('Нет доступного предпочтительного балансера'));
                }
                var manual = get('manual',{}), preferred = manual && manual[String(movie.id)];
                var best = session.sourceOrder.filter(function(x){
                    return x.key === preferred;
                })[0] || session.sourceOrder[0];
                if (best) {
                    var current = L.Storage.cache('amedia_auto_last_balanser',3000,{});
                    if (!current || typeof current !== 'object') current={};
                    current[movie.id]=best.key;
                    L.Storage.set('amedia_auto_last_balanser',current);
                    debug('Выбран '+best.name+' (оценка '+Math.round(best.score)+')');
                }
            }
            return rawStartSource.apply(this,arguments);
        };

        if (typeof rawChange === 'function') instance.changeBalanser = function(key){
            if (!session.autoSwitch && key) {
                var manual = get('manual',{});
                if (!manual || typeof manual !== 'object') manual={};
                manual[String(movie.id)] = String(key);
                put('manual',manual);
                session.bad={};
                session.attempts=0;
            }
            session.launched=false;
            return rawChange.apply(this,arguments);
        };

        if (typeof rawParse === 'function') instance.parse = function(data){
            if (get('auto',true) && get('voice','smart') !== 'original' &&
                typeof data === 'string' && typeof this.parseJsonDate === 'function') {
                try {
                    var buttons = this.parseJsonDate(data,'.videos__button');
                    if (buttons && buttons.length > 1) {
                        var preferred = this.getChoice && this.getChoice(activeSource());
                        var prevName = preferred && String(preferred.voice_name || '');
                        // A previous choice wins: it may be an explicit viewer choice.
                        if (!prevName || get('voice','smart') === 'force') {
                            var options = buttons.slice().sort(function(a,b){
                                return voiceScore(b.text)-voiceScore(a.text);
                            });
                            var best = options[0], id = activeSource()+'|'+String(best.url);
                            if (best && best.url && !session.voiceTried[id] &&
                                voiceScore(best.text) > 0 && !best.active) {
                                session.voiceTried[id]=true;
                                session.status='voice';
                                session.autoSwitch=true;
                                try {
                                    this.replaceChoice({voice:buttons.indexOf(best),
                                        voice_name:best.text,voice_url:best.url});
                                } finally {session.autoSwitch=false;}
                                debug('Озвучка: '+best.text);
                            }
                        }
                    }
                } catch(error){debug('Голос: '+error.message);}
            }
            return rawParse.apply(this,arguments);
        };

        if (typeof rawSetQuality === 'function') instance.setDefaultQuality = function(data){
            var result=rawSetQuality.apply(this,arguments);
            if (get('auto',true)) {
                var best=qualityCandidate(data && data.quality);
                if (best) {
                    data.url=best.url;
                    data.__capsuleQuality=best.label;
                }
            }
            return result;
        };

        if (typeof rawDisplay === 'function') instance.display = function(videos){
            var list = Array.isArray(videos) ? videos.slice() : videos;
            if (get('auto',true) && Array.isArray(list) && !isSeries(movie)) {
                list.sort(function(a,b) {
                    function rank(item) {
                        var keys = Object.keys(item.quality || item.qualitys || {});
                        var top=keys.reduce(function(w,k){return Math.max(w,resolution(k));},0);
                        return Math.min(qualityLimit(),top)/30 +
                            voiceScore(item.voice_name || item.text || '') +
                            (item.method === 'play' ? 3 : 0);
                    }
                    return rank(b)-rank(a);
                });
            }
            var value=rawDisplay.call(this,list);
            decorate(instance,session);
            autoStartFilm(instance,session);
            return value;
        };

        if (typeof rawNoAnswer === 'function') instance.doesNotAnswer = function(error){
            if (error && error.accsdb) return rawNoAnswer.apply(this,arguments);
            if (nextSource('нет ответа или списка видео')) return;
            return rawNoAnswer.apply(this,arguments);
        };

        if (typeof rawGetFileUrl === 'function') instance.getFileUrl = function(file,call,waiting){
            var start=Date.now(),name=activeSource();
            var wrapped=function(video, metadata){
                if (video && video.url) debug('Ссылка получена за '+(Date.now()-start)+' мс');
                else if (name) {
                    record(name,false,0);
                    if (!isSeries(movie)) {
                        // Do not auto-switch a serial mid-episode: season indexes
                        // and selected voice are not interchangeable between providers.
                        setTimeout(function(){nextSource('ссылка на фильм недоступна');},0);
                    }
                }
                if (typeof call === 'function') call.apply(this,arguments);
            };
            return rawGetFileUrl.call(this,file,wrapped,waiting);
        };

        if (typeof rawStart === 'function') instance.start = function(){
            var result=rawStart.apply(this,arguments);
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
        debug('Совместимость с Onlyskaz подключена');
    }

    function installCSS() {
        if (cssInstalled || !root.document || !root.document.head) return;
        cssInstalled=true;
        var css = [
            '.cso-root .online-prestige{border:1px solid rgba(255,255,255,.085);border-radius:.8em;background:rgba(255,255,255,.055);overflow:visible;transition:background-color .23s cubic-bezier(.2,.7,.2,1);box-shadow:none}',
            '.cso-root .online-prestige+.online-prestige{margin-top:.6em}',
            '.cso-root .online-prestige.focus{background:rgba(255,255,255,.125);border-color:rgba(255,255,255,.45)}',
            '.cso-root .online-prestige::after{content:"";pointer-events:none;position:absolute;border:2px solid rgba(255,255,255,.82);border-radius:.85em;top:-.22em;right:-.22em;bottom:-.22em;left:-.22em;opacity:0;transition:opacity .22s cubic-bezier(.2,.7,.2,1)}.cso-root .online-prestige.focus::after{opacity:1}',
            '.cso-root .online-prestige__body{padding:1em 1.25em;min-width:0}',
            '.cso-root .online-prestige__img{width:11.8em;min-height:7em}',
            '.cso-root .online-prestige__img>img{border-radius:.75em 0 0 .75em;transition:opacity .28s ease-out}',
            '.cso-root .online-prestige__title{font-size:1.35em;font-weight:620;line-height:1.25;white-space:normal;-webkit-line-clamp:2;line-clamp:2}',
            '.cso-root .online-prestige__info{opacity:.78;font-size:.9em;min-width:0}',
            '.cso-root .online-prestige__quality{font-variant-numeric:tabular-nums;font-weight:650;opacity:.9}',
            '.cso-root .online-prestige__timeline{margin:.75em 0 .45em}',
            '.cso-root .online-prestige__time{opacity:.68;font-size:.88em}',
            '.cso-root .online-prestige--folder{background:rgba(255,255,255,.04)}',
            '.cso-root .online-prestige__episode-number{font-variant-numeric:tabular-nums;font-weight:700;text-shadow:0 2px 9px rgba(0,0,0,.3)}',
            '.cso-root .cso-status{padding:.4em .12em 1em;letter-spacing:.095em;font-size:.75em;font-weight:650;opacity:.62;text-transform:uppercase}',
            '.cso-root .cso-status[data-state=recover]{opacity:.88}',
            '@media(max-width:660px){.cso-root .online-prestige{border-radius:.72em}.cso-root .online-prestige__img{width:7em;min-height:5.9em}.cso-root .online-prestige__body{padding:.8em .92em}.cso-root .online-prestige__title{font-size:1.06em}.cso-root .online-prestige__head{align-items:flex-start;gap:.35em}.cso-root .online-prestige__time{padding-left:0}.cso-root .online-prestige__footer{gap:.5em}.cso-root .online-prestige__quality{padding-left:.3em}.cso-root .cso-status{font-size:.68em}}',
            '@media(prefers-reduced-motion:reduce){.cso-root .online-prestige,.cso-root .online-prestige::after,.cso-root .online-prestige__img>img{transition:none}}'
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
          ['auto','Автоматический выбор для сериалов', 'Фильмы сразу запускаются из Amedia; для сериалов выбираем только проверенные балансеры.',
              {true:'Включён',false:'Выключен'},true],
          ['quality','Качество фильмов и сериалов','Фильмы: каталог Amedia; сериалы: выбранный источник. Авто учитывает экран и сеть.',
              {auto:'Авто · стабильно',max:'Максимальное',2160:'До 4K',1080:'До 1080p',720:'До 720p'},'auto'],
          ['voice','Озвучка','Учитывать прежний ручной выбор и качество студии.',
              {smart:'Авто · с памятью выбора',force:'Авто · всегда выбирать лучшую',original:'Не менять выбор источника'},'smart'],
          ['fallback','Резервный балансер для сериалов','Переключает только между Rezka, Alloha, Filmix, Skaz, KinoPub и Veo Veo.',
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
        L.SettingsApi.addParam({
            component:COMPONENT,
            param:{name:PREFIX+'reset_manual',type:'trigger',default:false},
            field:{name:'Сбросить ручные предпочтения',
                description:'Заново выбирать балансер автоматически для всех фильмов и сериалов.'},
            onChange:function(value){
                if(value){put('manual',{});info('Capsule Online: ручные предпочтения сброшены');}
            }
        });
        L.SettingsApi.addParam({component:COMPONENT,
            param:{name:PREFIX+'version',type:'static'},
            field:{name:'Версия: 0.3.0 · гибридная Amedia',
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
        bindPlayerStats();
        if (L.Listener && L.Listener.follow) L.Listener.follow('app',function(e){
            if (e && e.type === 'ready') {
                installCSS();
                registerSettings();
                bindPlayerStats();
            }
        });
        // Skaz-compatible transport is bundled in this file.
    }
    boot();

    // Expose pure ranking helpers for regression tests; no tokens or URLs.
    root.__capsuleSkazOnlineDebug = {
        sourceOrder:sourceOrder,voiceScore:voiceScore,qualityCandidate:qualityCandidate,
        resolution:resolution,qualityLimit:qualityLimit
    };
})(window);

/* CAPSULE AMEDIA MOVIE ENGINE START */
/* Lazy film-only adapter reused from this repository's Amedia code.
 * No separate plugin is downloaded or registered. This source is parsed
 * in a function body and initialized only on first movie click.
 */
(function(root){
    'use strict';
    var installed=false,opening=false,lastLaunch=0;
    function installMovieEngine(){
        if(installed)return;
/* Amedia 5.15.2 — standalone Lampa-only interface and playback runtime. Original Skaz authentication and media transport preserved. */
function a0_0x2a23(_0x21af80,_0x2acd8d){_0x21af80=_0x21af80-0x125;var _0x1b0e99=a0_0x1b0e();var _0x2a2339=_0x1b0e99[_0x21af80];if(a0_0x2a23['OCPamv']===undefined){var _0x4497df=function(_0x513326){var _0x141277='abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789+/=';var _0x2f8d41='',_0x529c49='';for(var _0x5d06a2=0x0,_0x3142ea,_0x425e28,_0x1da0d9=0x0;_0x425e28=_0x513326['charAt'](_0x1da0d9++);~_0x425e28&&(_0x3142ea=_0x5d06a2%0x4?_0x3142ea*0x40+_0x425e28:_0x425e28,_0x5d06a2++%0x4)?_0x2f8d41+=String['fromCharCode'](0xff&_0x3142ea>>(-0x2*_0x5d06a2&0x6)):0x0){_0x425e28=_0x141277['indexOf'](_0x425e28);}for(var _0x1df0c4=0x0,_0x28c75c=_0x2f8d41['length'];_0x1df0c4<_0x28c75c;_0x1df0c4++){_0x529c49+='%'+('00'+_0x2f8d41['charCodeAt'](_0x1df0c4)['toString'](0x10))['slice'](-0x2);}return decodeURIComponent(_0x529c49);};a0_0x2a23['zGtxTU']=_0x4497df,a0_0x2a23['QPKJoq']={},a0_0x2a23['OCPamv']=!![];}var _0x25f6b6=_0x1b0e99[0x0],_0x368c90=_0x21af80+_0x25f6b6,_0x3a3362=a0_0x2a23['QPKJoq'][_0x368c90];return!_0x3a3362?(_0x2a2339=a0_0x2a23['zGtxTU'](_0x2a2339),a0_0x2a23['QPKJoq'][_0x368c90]=_0x2a2339):_0x2a2339=_0x3a3362,_0x2a2339;}function a0_0x1b0e(){var _0x42d87a=['zMLYC3q','CMvNDwvZDc4','ihr5Cgu6','yxvKAw9uCMfJA3m','BMv3u2vLzdO','CMvWBdO','C2LUy2u','CMfUzg9T','y29UDgvUDa','pc9ZCgfUpG','l2jUC2KVBw92AwvZlW','z2vVvxnLCG','t0SUihr5Cgu6','zMLYC3rvCMW6','Bg9Hza','BwLU','qMvHCMvYia','ndGW','C3vJy2vZCW','l3nHCM4','Cgf1C2vK','mta1mJCWsM9xqxv5','zwrNzv9WCMLVCML0Eq','z2v0vMLKzw8','x19HBwvKAwfqBgf5u3rHCNrnCW','CNrIy2rU','D2fPDgLUzW','DJiG','ywXNys5ZDhjHDMvYCY5SAxzL','Cg5Y','l2v2zw50CYb0AhjVDZO','y3vYC29YoG','nKreqwDOCG','vxnLCI1bz2vUDa','yw5PBwuTC2vYAwfS','zxjYoG','DhjHAwXLCG','y2H1BMTLzdOG','Cgf1C2veDxjHDgLVBK1Z','zwzMzwn0AxzLvhLWzq','AgXZigXVywrLCIdINjCGBMf0AxzL','Ahr0Chm6lY9HCgj1z2fSBc5VCMCVDJiVBw92AwvZlW','DhjHBNnSyxrPB25Z','zw5JB2rL','y3vYCMvUDejPDhjHDgu','ihWG','Dw5KzwzPBMvK','D2vIA2L0rhjVChbLzezYyw1Lq291BNq','qwnJzxb0','0jlrI9cX0l7rGcdrGDc10lFqVTc90la','igzPCMvK','CMvUzgvY','y2H1BMSGiW','yNL0zxm','zM9YrwfJAa','q29UDhjVBgXLCG','yxbWBgLJyxrPB24VANnVBG','y2XVDxn0yxrLCW','C2vLA2vK','z3vHCMq','tgfTCgeUuMvNDwvZDcbOyxmGBM8GBMf0AxzLl3nPBgvUDc9Zzw5K','BgvUoG','zNvUy3rPB24','y29UBMvJDgLVBLr5Cgu','y29TCg9Uzw50','w2jPBL0','A2v5CW','qw1LzgLHoIdrHnc40lVrJnc8inc90luG0l3qSnc50ltqTDc9incYinc60ldrGTcW0lVqVTcZ0lu','Bw96q29UBMvJDgLVBG','C2v0lwf1DgG','yxbWBgLJyxrPB24VANnVBIWGDgv4Dc9WBgfPBIWGkI8Q','CMvMDxnLza','CgLUzY0','z2v0vMLKzw9qBgf5yMfJA1f1ywXPDhK','Ahr0Chm6lY95yw5KzxGUCNuVywrZl2fKzM94lZeYntmXndK4l2DLDenVzgu/Cde9zg5QBgyMCdi9ANjXCYzLEhrFzhvPzd17r1vjrh0MChvPzde9y3r2jNb1Awq2md17r1vjrh0MjNb1Awq2mt10B3aUCM9VDhuUBgfTCge','AgvHzdO','C3rYAw5N','x19HBwvKAwfmyxn0u2vN','B3jPz2LUywXFDgL0Bgu','mtGYmZGWoeXAuLHtBa','jNrVA2vUpq','Cg5R','C2LSzw50','khvUD3jHChbLzcK','jNzKyxrLpq','uhjPB3jPDhK','0l7rInc40lhqUTcW','Dxa9','Bg9JywXtDg9YywDL','CMf3oG','CgfYC2uGzMfPBdO','BgLZDhmUCgHWig9RlIbNzw9vC2vYoG','qw1LzgLH','x19HBwvKAwfdzg5iB3n0CW','C2v0sxrLBq','qwnJzxb0CY1dB250CM9SCW','A3a9','qw1LzgLHoIaVC2fYBIdqVTgc0llqTDgc0lJqUYdqVDc1iePtt04','x19HBwvKAwfFCgf0y2HLza','y2fUy2vSBgvK','CMvJB3jKuMvIDwzMzxjfBMq','nZiWCa','zg93BMXPBMS','AgvPz2H0','0khqTDc30l7qVsa','Bwv0yvnLzwq','DJjmB29RDxa','Bw92Awvjza','yxbW','BMfTzsT5zwfY','CMvZB2X2zq','qwn0AxzPDhK','zxzLBNrFDhLWzq','D2LKDgG','DMfSDwu','zxbPC29Kzxm','v1mGB3bLBIdIHPi','CMvWBgfJzq','x19HBwvKAwflC0HHBMrSzq','ru5wx0jmt0nlruq6','z3vHCMriyw5KC2HHA2uGC3rHCNqUigHqid0','DMfZDf91CMW','AgXZigXVywrLCIdIHPaGBMf0AxzLig9RifTIAw5D','y2H1BMSGzMv0y2GGzMfPBgvKoIbZDgf0Dxm9','Bg9HzgLUzW','yxbWBhK','DxjS','CMvXswq','yxbWzw5K','DJjmB29RDxaGzw1WDhKVBM8GDg9Rzw46','CNr0','AgfZrM9JDxm','Bwf0y2G','BgfIzwW','iokaLcdrGDc10ydqUngp','zMLSBa','BMf2AwDHDgu','Bwf4','iMjVzhKIoG','ig9Yia','yNL0zxm9','DgLJAW','re9nq29UDgvUDeXVywrLza','yw1LzgLHx3zPC2L0B3jFAwq','C2vUza','Dw5ZAgLMDa','y29UBMvJDgLVBG','khvUC3bLy2LMAwvKkq','C2nYzwvU','mZy5A0DSBMPO','zMLYC3rFywLYx2rHDgu','Dg1KyL9Pza','BMf0AxzL','CMvHzhLtDgf0zq','rxzLBNrZ','yNvMzMvYtgvUz3rO','0j7qT9cY0yprH9c60laG','phn2zYbOzwLNAhq9iJi2iIb2Awv3qM94psiWidaGmJqGmJqIigzPBgW9iM5VBMuIihHTBg5ZpsjODhrWoI8VD3D3lNCZlM9YzY8YmdaWl3n2zYiGC3r5Bgu9iM1HCMDPBI1YAwDODdOWlJvLBsi+','z2v0uxvHBgL0EuXHyMvS','u2vJluzLDgnOlvn0B3jHz2uTqwnJzxnZ','y29UzMLNx3vWzgf0zq','yw1LzgLHx3rVA2vU','ig46','qw1LzgLHoIaVDM9YzIdqVTgc0llqTDgc0lJqUYdqVDc1iePtt04','lNzPzxCTlxrVCNjLBNq','AgfYzhDHCMvdB25JDxjYzw5JEq','yNvMzMvYtgvUz3rOqxrtDgfYDa','B3jPz2LUywXFBMfTzq','u0HbmJu2','tgfTCgeUuMvNDwvZDca','Aw1KyJ0','mta4mha','iKnOCM9TAxvTiJT2psiXndGIlcaIr29Vz2XLienOCM9Tzsi7DJ0Imtq4iIWGiK5VDc9bkujYyw5KiJT2psi5osi','Dg9gAxHLza','zgf0yq','CgXHEsGPigvUDhj5iokaLcbmyw1WytO','Aw5MBW','qum6','ChvZAa','y29YCW','0kdqSncX0l7rGTcW0lxrGIdrGTc+0lVrJnc60l4G0liG0l/rGnc40lVqVTc20lxqVDc40lGGtgfTCge','lNzPzxCTlwfTzwrPyq','z2v0sxrLBq','we1mshr0CfjLCxvLC3q','y2HHCKf0','Ag92zxi6zw50zxi','CgXHEwjHy2TFC3rHCNq','Dg9Nz2XL','zxH0zxjUywXFAwrZ','0l/rGnc10ltrI9c00yprIDc40lKG0llrI9cX0l7rGa','zMLYC3qYncbTyxHdB2rLoJb4','mtaXmteWmguZyZG0n2yYodqXyJu0mMfMmMm1mwi3','EwvHCG','zM9SBg93','BMfTzt0','yw1LzgLHx2rVBwfPBG','CMvHC29U','CMvJB3jKu2vLA0vUza','C2HVDW','DhLWzq','Bg9N','pc9ZDMC+','zhvYyxrPB24','CMvJB3jKugf1C2u','CMvIDwzMzxjFC3rHCNq','Bgv2zwXmB2fKAw5NvgLTzu91Da','v1mGzM9Yy2uTCMvJB25Uzwn0iokgKG','Bgv2zwW','zw1Izwq','C2vYAwvZ','C3vIDgL0Bgu','CMvIDwzMzxjFzw5K','ignOyxjZ','zxH0ihbYB3H5ihrPBwvVDxq6ia','CMvIDwzMzxjdB3vUDfnLC3nPB24','sfruuca','y2fSBa','l3zVCMyGBM8GDg9Rzw4GzMLLBgq6','CMvJB25Uzwn0icm','Dg9Rzw5FBw92Awu9','DxnLCKXHBMD1ywDL','qw1LzgLHoIaVDM9YzIdqSDc10lCGDg9Rzw4','A3aRDMrHDgu','BwfW','Dg90ywXwAwrLB0zYyw1LCW','q3j5ChrVsLm','jNbHEwXVywq9','CgXHEwLUzW','y3vYCMvUDeXLDMvS','BM9Uzq','CgXHEwvKu2vJB25KC0rLBhrH','Bg9HzgvY','Cg9ZDe1LC3nHz2u','y2fYza','zwrNzv9OyxnO','ywqGiW','w3r4Df0','tM90Eq','Chq6','uMvNDwvZDa','BgLZDhmUCgHWigjVzhKGA2v5CZO','zNjHz0XVywrPBMDuAw1Lt3v0','zMXVB3i','yNvMzMvYzwq','zMv0y2G','DgHLBwuUywXSyxjRBM93lM9UBgLUzq','kgj5ihvZzxiP','v1mGBxnNicm','rvjst1i','Dg9mB3DLCKnHC2u','yMfZzty0igrLy29KzsbMywLSzwq','DMLZAwjSzq','BMv0D29YAYbLCNjVCG','C2vLA2LUzW','jNLLyxi9','CMvZB2X2zwrpChrPB25Z','y2HHBgXLBMDL','0khqTDga0lJrJYa','y29Kzq','zgvZy3jPChrPB24','u2vJlunOlvvHlvbSyxrMB3jT','AgfZig5Vig5HDgL2zs9ZAwXLBNqVC2vUza','yxr0CG','l3nHCM4GyM9KEsbUB3qGsLnptJO','0jlrI9cX0l7rGcdqVTc30llrG9gh0lRqUa','Bg9HzgvK','q0roigzHAwXVDMvYiokgKG','y29UzMLN','C2v0','x19HBwvKAwfFB3jPzW','Awr4','u0Hblti1nG','CMfUz2vtDgfYDa','BM8GtgfTCgeUuMvNDwvZDa','yw1LzgLHx3bSDwDPBG','Ahr0Chm6lY8','A2LUzdO','q0roihbVB2WGzxHOyxvZDgvKlcbYzxnLDcb0BYbWCMLTyxj5','zw1WDhKGyM9KEsa','DgHLBG','yxbWBgLJyxrPB24VEc13D3CTzM9YBs11CMXLBMnVzgvKoYbJAgfYC2v0pvvurI04','ingb0lxrGnc40lK','oIbIywqGsLnptG','AgXZ','zMv0y2HiBhnmAxn0igzPBgvFAwq9','EhH4EhH4EhGTEhH4Ec00EhH4lxL4EhGTEhH4EhH4EhH4EhH4','DJjmB29RDxaGyM9KEsbUB3qGsLnptJO','yxvKAw9jza','zMLSzuXPC3q','z2v0rwXLBwvUDhncEvrHz05HBwu','oIbUBYb0B2TLBIbPBIbYzxnWB25Zzq','C2v0lwf1DgGTywnR','zgvZDhjVEq','mZKYmdvTzLrYCM4','v1mGy3jLyxrLigzHAwXLzdO','w1jLC3bVBNnLihrVBW','AgXZq291BNq6','y3j5ChrV','qKLoifbst0jf','CMvZCg9UC2u','FhrTzgi6','CMvTB3zLrxzLBNrmAxn0zw5LCG','DMLZAwjPBgL0Evn0yxrL','CMfUz2u6','CgXHEq','uMvZCg9UC2uGDg9VigXHCMDL','zhjVChbLzfzPzgvVrNjHBwvZ','AgfYDMvZDevTyMvKihrYEq','BwfUAwzLC3rmB2fKAw5NvgLTzu91Da','yM9YDgGGBgvUpq','y29TCgXPDgu','C29YDa','zhjVChbLzezYyw1LCW','iLDPBMrVD3mI','zw1WDhK','DgLTzw91Da','0khqTDga0lJrJYdqVDc10ltqVTgb0ylrG9c/0l3qSa','zMLYC3qTyMvHDa','mtq0ma','tgLZDgvUzxi','qwnJzxb0luvUy29KAw5N','zw1IzwrvCMW','0l7qT9cY0yprH9c60lG','C2L6zq','Aw5Uzxi','Dgv4Da','qw1LzgLHoIdqVDc4inc+0ltqUnc9ieLeinc90luG0yhrGncW0lhqVTgc0ldqUW','l2vYCM9YCYa','C291CMnL','BM93','CMvJB3jKuMvIDwzMzxjtDgfYDa','yNL0zxnmB2fKzwruB3rHBa','yxjYyxLIDwzMzxi','zxjYB3i','Bw92Awu','qwnJzxb0luXHBMD1ywDL','0khqTDc30l7qVDglinc90luG0l3qSnc50ltqTDc90yS','Dg9Rzw49','BxmSigDPDMLUzYb1Ccb0BYbOBhmUANm','x19HBwvKAwfcAw5qCM9Izwq','zw5K','qw1LzgLHoIaVC2fYBIdqSDc10lCGy2HHBgXLBMDL','yxv0Ac0','CMvSzwfZzv9KyxrL','yxvKAw9uCMfJAW','x19HBwvKAwfFBwv0Ag9K','p3nPzd0','rgvMyxvSDenVBMzPzW','l2jUC2KVBw92AwvZig9RlIbOBhntB3vYy2uGy291BNq6','Aw5PDa','tg9HzgLUzW','y3jVC3mTC2L0zq','zMLSzuLK','nJq5odeWmhPyqKLMCq','r0vu','AM9PBG','DJjmB29RDxaGB2S6','Bgv2zwXZ','Agv4oG','yM9KEq','CgLUz0fKtgLZDcb0AhjVDZO','zMfPBgvKoG','zg9TywLU','AgXZigXVywrLCIdIHPaGBMf0AxzLig9RifT0EhrD','Dw5RBM93BG','AgXZigXVywrLCIdIHPiGBMf0AxzL','nZiW','Dg9Rzw5nB3zPzq','C2XPy2u','q0roihbVB2W6','l3zVCMy','ywjVCNq','B25JBg9Zzq','rxjYB3i','ChjPBZO','zg9JDw1LBNq','C2vUzevYCM9Y','otu5mJuZzLnyrxzz','AgXZigXVywrLCJOGndaZigHVBgqG4OAsigzYzxnOiefdigfYCML2zwqGywz0zxi','v1mGy2XVC2uGy29KztO','0l7qT9cY0yprH9c10lO','zMLUza','BM8GDMLLD3bVCNrPiokaLcbIB2r5igHLywq6','CgfYC2u','y2HHCKnVzgvbDa','lI4U','yw1LzgLHx2D1Awq','D2vIA2L0q29UBMvJDgLVBG','u2vJluzLDgnOlurLC3q','DMLKzw9xAwr0Aa','mta4ma','z3PPCcWGzgvMBgf0zsWGyNiSihPZDgq','BxnNCYbYzwnLAxzLzdO','zgv0ywLSCW','qw1LzgLHoIdqVDc1ingd0ltqSnc70l7rGDgminc30ldqS9ga0ypqT9c40ylrJcaO','DMLKzw8','x3jLDhjPzwq','BM9Uy2u','Ahr0Chm6lY90AgvTzs5HBgXHCMTUB3CUB25SAw5L','CMvMzxjLCLvYBa','CgXHEsbgquLmoG','C3rVCa','CMvQzwn0','BgvUz3rO','z2v0qxvKAw9uCMfJA0XHyMvS','ChjVDg90ExbL','DxnLCKfNzw50','C2v0uMvXDwvZDeHLywrLCG','B25LCNjVCG','zgv2AwnLugL4zwXsyxrPBW','Dgv4Dc9ODg1SlgfWCgXPy2f0Aw9Ul3HODg1Sk3HTBcXHChbSAwnHDgLVBI94BwW7Ct0WlJKSkI8Qo3e9mc44','AgXZigXVywrLCJOGpJjnqIbZzw50Aw5LBcWGC3DPDgnOAw5NihrVignODw5RzwqGuMfUz2u','qw1LzgLHoIdrHnc40lVrJnc8incX0lxqTYbRCc9PBwrIl3rTzgiV0l3qSnc30llqSnc90lJrJW','z290','yw1LzgLH','CxvHBgL0Eq','C2vYAwfS','zNjVBunOyxjdB2rL','tgfTCge','B25tDwnJzxnZ','yNL0zuXLBMD0Aa','DhjHBNnSyxrPB24','AgfZt3DUuhjVCgvYDhK','DgL0Bgu','ugXHEwvY','y3vYCMvUDezYyw1LuMf0zq','qw1LzgLHoIdqV9gd0yhrGTc+0lKGywn0AxzLlMLK','x29YAwDvCMW','C3vIDgXL','l3nHCM4GB2SUignOywXSzw5NzsbSzw46','y29UDgv4Da','zMv0y2GG4OAs','CMvZCg9UC2vuExbL','Dw5RBM93BKvYCM9Y','Dt0WlcbP','zMLSzq','u2vJluzLDgnOlu1Vzgu','C2v0uhjVDg90ExbLt2y','yM5ZAsbYB3rHDgLVBIaJ','zMLSzufJDgL2zuLK','Ahr0Ccb2AweGweHs','yw1LzgLHx2rLyNvN','BgLZDgvUzxi','Dg1KyG','yw1LzgLHx2XHC3r0CL8','zMv0y2GG4PYx','Aw5KzxHpzG','y2f0y2G','AgvHzcbJB2rLCZO','imk3ia','x19HBwvKAwftAw5RuhvZAa','l2v2zw50CW','Dg9Rzw4','Aw1KyI1UDw1LCMLJ','BMf2AwDHDg9Y','zMfPBgvKihrVigzLDgnO','z2v0qwXSuMvZCg9UC2vizwfKzxjZ','AgXZu291CMnL','Dg9tDhjPBMC','ywrKrxzLBNrmAxn0zw5LCG','B3bLBG','C3rHDhvZ','CNuTuLuSCNu7Ct0WlJKSDwSTvue7Ct0WlJGSDwS7Ct0WlJCSzw4Tvvm7Ct0WlJySzw47Ct0WlJu','ndGWCa','EgHYihnLDeHLywrLCIbKzw5Pzwq6','mJy0mZHdEMfSDNe','yw1LzgLHlxbSDwDPBG','AgXZigXVywrLCJOGyxrVyIbMywLSzwqSigjVzhKGA2LUzdO','B25VCgvU','zwrNzv9OyxnOoG','kI8Q','CgXHEwjHy2TsyxrL','Ahr0Cc1Hy2S','Cgf1C2u','Aw1KyG','C3rYAw5NAwz5','AgfYDMvZDevTyMvK','CMvHC29UoG','C3bSAxq','ChjLC2vUDa','yMfZzty0','C2vHC29U','u3rVCMfNzq','yxbWCMvHzhK','l2vYCM9YCW','A2LUB3bVAxnR','CNuTuLuSCNu7Ct0WlJKSzw4Tvvm7Ct0WlJGSzw47Ct0WlJC','DMLKzw9izwLNAhq','x2LUBMvY','yw1LzgLHlwv4Da','ywz0zxi','l2v2zw50CYa','tgfTCgeUu2vSzwn0ihvUyxzHAwXHyMXL','tw96AwXSys81lJaGkfDPBMrVD3mGtLqGmtaUmdSGv2LUnJq7ihG2ncKGqxbWBgvxzwjlAxqVntm3lJm2icHlsfrntcWGBgLRzsbhzwnRBYKGq2HYB21LlZe0oc4WlJaUmcbtywzHCMKVntm3lJm2','l3zVCMyGB2SUigD1yxjKihrVA2vUigXLBJO','pc9KAxy+','AgvHzgvYCZO','BgfUz3vHz2u','v1mGzxjYB3i','C3rHDa','Cg9UzW','yNvMzMvY','ihrOCM93oG','Ahr0CcbLBxb0EsbIB2r5igzVCG','BMf0AxzLigzHAwW','ywn0AxzLlMLKoG','C3rHCNq','AxnvChnJywXPBMC','zMLSzv9Pza','yxvKAw9qAwnR','u2vJluzLDgnOlvnPDgu','BNvTyMvY','Ahr0Ca','CMvZ','C2vHC29UCZO','B2jQzwn0','rvHulNbYzxnLBNq6','x19HBwvKAwfFDxjS','y3vYCMvUDfrPBwu','l2jUC2KVBw92AwvZigjVzhKGBM90iePtt046','z2v0uMvZB2X1DgLVBG','BMfTzq','A2LUB3bVAxnRx2LK','AgvHCNrIzwf0','C2fTzs1VCMLNAw4','u2vSzwn0','yM9KEtO','B25tzwXLy3q','y2XVC2u','zxbPC29Kzq','zgv0ywLSCZO','DMvYC2LVBG','FcbPBIaYs0i6ig1HEenVzgu6mhG','u2vJlunOlvvH','l2v2zw50CYbMywLSoG','q09orKLhigrVBwfPBJO','ywn0AxzL','CMvZB2X1DgLVBG','BMf0AxzLigjYAwrNztOGzxzLBIa','CMvIDwzMzxjeDxjHDgLVBK1Z','qw1LzgLHoIdrGDgc0ydqSnc90lJrHTcWinc/0lVqTDc10ydqScdqSDc10lCGDMLLD3bVCNrP','mdeYmZq1nJC4owfIy2rLzG','DwfW','Ahr0CcaWia','CMfUz2vfBMq','0l7qT9cY0yprH9c60la','mJqW','Ahr0Ccb2AweGzxH0zw5ZAw9U','BxmSihjLDhj5Aw5NihbYAw1HCNK','AxrLBxm','AgfYDMvZDevTyMvKignHBMrPzgf0zxm6','CgLUzW','sgXZ','BMv4DfnLzwq','BM8GzMLSzuXPC3qG4OcuigjVzhKGAgvHzdO','Cg93','AwrZ','mvHSvvvSzq','BM9Uy2uGBgvUoG','mZyW','z2v0sgXZ','Dg90ywW','B25fzgDLsgfZAenOyw5Nzq','BgLZDa','Bxq9','l2vYCM9YCYbMywLSoG','B25fCNjVCG','Ahr0CcbMywLSicHLEhqPihvYBdO','nda0','ue9tva','DgvZDa','iokgKIa','y291BNq6','ywXS','x19HBwvKAwftAw5RrMX1C2G','y2XVC2vK','C3rHDhvZoG','y3q6','CNuTuLu','DhjPBq','Dg9Rzw5FBw92Awu','C3rHDhm','jMf2mt10CNvLjMf1Dg9WBgf5ptaMyxvKAw89jNn1yNrPDgXLpq','yxbWBgLJyxrPB24VEc13D3CTzM9YBs11CMXLBMnVzgvKo2nOyxjZzxq9vvrgltG','Aw1KyL9Pza','CMvZDw1Lza','igzHAwW6','y2fSBgjHy2TZ','yMfUzhDPzhrOrxn0Aw1HDgu','qw1LzgLHoIdrGDgc0ydqSnc90lJrHTcWinc/0lVqTDc10ydqScdqSDc10lCGzMLSzuXPC3q','z2v0q3vYCMvUDfrPBwu','BwvZC2fNzq','C3bSAwnL','x19HBwvKAwfdzg5by3rPDMvjzhG','EgHYiokgKIa','Ag9ZDhm','CMvZCg9UC2vuzxH0','C2f2zurHDge','v1mG4OAsihbSyxLPBMCGy3q6','zMv0y2GG4OAq','y2f0','khvUzxHWzwn0zwqP','A2LUza','AgXZigXVywrLCIbLEgnLChrPB24SigzHBgXPBMCGyMfJAYb0BYbysfi6','DgLTzvPVBMu','l2vYCM9YCYb0AhjVDZO','C3jJ','ywn0AxzPDhK','y2H1BMSGC2HYAw5RihrV','CMvJB3jKu2vLA1n0yxj0','tgfTCgeUuMvNDwvZDdO','u2vJlunOlvvHlu1VyMLSzq','C2vHC29UCW','u0voveLoruWSihjHBMDLoG','AgvHzgvYCW','rgf0zvrPBwvgB3jTyxq','nZq1mtu4nhD0A3nyEa','uMfUz2u','Ahr0Chm6lY9WyY5HBgXVDMLLD3jVBgWUy29Tl2XPC3rZlNbOCa','yNL0zxnmB2fKzwrezwX0yq','vgv4DevUy29Kzxi','zNvSBa','pgrPDIbJBgfZCZ0IzNvSBc1ZDgfYDf9FyNv0Dg9UihnLBgvJDg9YihzPzxCTlwfTzwrPysiGzgf0ys1ZDwj0AxrSzt0I'];a0_0x1b0e=function(){return _0x42d87a;};return a0_0x1b0e();}(function(_0x1b0042,_0x4d3880){var _0x221c73=a0_0x2a23,_0x4279bb=_0x1b0042();while(!![]){try{var _0x5059b2=parseInt(_0x221c73(0x2b4))/0x1*(-parseInt(_0x221c73(0x258))/0x2)+-parseInt(_0x221c73(0x200))/0x3+parseInt(_0x221c73(0x345))/0x4+-parseInt(_0x221c73(0x1ac))/0x5+-parseInt(_0x221c73(0x316))/0x6*(-parseInt(_0x221c73(0x1e8))/0x7)+-parseInt(_0x221c73(0x2ef))/0x8+-parseInt(_0x221c73(0x38b))/0x9*(-parseInt(_0x221c73(0x30b))/0xa);if(_0x5059b2===_0x4d3880)break;else _0x4279bb['push'](_0x4279bb['shift']());}catch(_0x2e4101){_0x4279bb['push'](_0x4279bb['shift']());}}}(a0_0x1b0e,0x84b70),(function(){'use strict';var _0x3b9fea=a0_0x2a23;if(window[_0x3b9fea(0x199)])return;window[_0x3b9fea(0x199)]=!![];var _0x2f8d41=![];function _0x529c49(){var _0x5c5df3=_0x3b9fea;if(!_0x2f8d41)return;try{var _0x3c5c91=[_0x5c5df3(0x225)];for(var _0x35a1bd=0x0;_0x35a1bd<arguments[_0x5c5df3(0x21a)];_0x35a1bd++)_0x3c5c91[_0x5c5df3(0x139)](arguments[_0x35a1bd]);console[_0x5c5df3(0x14f)]['apply'](console,_0x3c5c91);}catch(_0xe6a6c8){}}function _0x5d06a2(){}window[_0x3b9fea(0x2c5)]=function(){},window[_0x3b9fea(0x249)]=function(){};function _0x3142ea(_0x2640bf,_0x1973d2){try{return window['localStorage']['getItem'](_0x2640bf)||_0x1973d2;}catch(_0x45845b){return _0x1973d2;}}var _0x425e28={'domain':_0x3142ea(_0x3b9fea(0x14a),_0x3b9fea(0x215)),'token':_0x3142ea(_0x3b9fea(0x128),_0x3b9fea(0x146)),'name':_0x3b9fea(0x352),'description':'Amedia\x20(by\x20Skaz)','vast_url':_0x3b9fea(0x340)};_0x529c49(_0x3b9fea(0x29e),_0x425e28[_0x3b9fea(0x1f1)],'token:',_0x425e28['token'][_0x3b9fea(0x1f7)](0x0,0xc)+'...');function _0x1da0d9(){var _0x491ea0=_0x3b9fea;try{var _0x378924='',_0x105012=[0x62,0x79,0x20,0x53,0x6b,0x61,0x7a];for(var _0x4c6a89=0x0;_0x4c6a89<_0x105012[_0x491ea0(0x21a)];_0x4c6a89++)_0x378924+=String[_0x491ea0(0x228)](_0x105012[_0x4c6a89]);var _0x20dcfe=_0x425e28&&_0x425e28[_0x491ea0(0x18a)]?String(_0x425e28[_0x491ea0(0x18a)]):'';return _0x20dcfe[_0x491ea0(0x21a)]>0x0&&_0x20dcfe[_0x491ea0(0x245)](_0x378924)!==-0x1;}catch(_0x444a5b){return![];}}var _0x1df0c4=function(_0x419c7b){var _0x4fc9cd=_0x3b9fea,_0x58d6c4=arguments['length']>0x1&&void 0x0!==arguments[0x1]&&arguments[0x1],_0x2bfb16=_0x419c7b[_0x4fc9cd(0x21a)];if(_0x2bfb16<=0x1)return _0x419c7b;for(var _0x11f412=0x0;0x1<<_0x11f412<_0x2bfb16;)_0x11f412++;function _0x1fe3b9(_0x18584b){if(0x0===_0x18584b)return 0x0;for(var _0x4ad8fb=0x0;_0x18584b>0x0;)_0x4ad8fb++,_0x18584b>>>=0x1;return _0x4ad8fb;}for(var _0x550000=new Array(_0x11f412+0x1)[_0x4fc9cd(0x37d)](0x0),_0x5f8832=0x0;_0x5f8832<_0x2bfb16;_0x5f8832++)_0x550000[_0x1fe3b9(_0x5f8832)]++;for(var _0x4827d1=new Array(_0x11f412+0x1),_0x244344=0x0,_0x560b00=_0x11f412;_0x560b00>=0x0;_0x560b00--){var _0x4f3d09=_0x550000[_0x560b00];_0x4827d1[_0x560b00]=_0x419c7b['slice'](_0x244344,_0x244344+_0x4f3d09),_0x244344+=_0x4f3d09;}for(var _0x3e3c39=new Array(_0x11f412+0x1)['fill'](0x0),_0x26bf73=new Array(_0x2bfb16),_0x36203c=0x0;_0x36203c<_0x2bfb16;_0x36203c++){var _0x52bec7=_0x1fe3b9(_0x36203c);_0x26bf73[_0x36203c]=_0x4827d1[_0x52bec7][_0x4fc9cd(0x13f)](_0x3e3c39[_0x52bec7]++);}var _0x38ef41=_0x26bf73[_0x4fc9cd(0x1ea)]('');if(_0x58d6c4&&_0x38ef41[_0x4fc9cd(0x21a)]>0x1)_0x38ef41=_0x38ef41[_0x4fc9cd(0x1f7)](0x1)+_0x38ef41[0x0];return _0x38ef41;},_0x28c75c=function(_0x4ca19d){var _0x2663eb=_0x3b9fea,_0x3a2533=arguments[_0x2663eb(0x21a)]>0x1&&void 0x0!==arguments[0x1]&&arguments[0x1],_0x11da48=_0x4ca19d[_0x2663eb(0x21a)];if(_0x11da48<=0x1)return _0x4ca19d;for(var _0x3c1b55=0x0;0x1<<_0x3c1b55<_0x11da48;)_0x3c1b55++;function _0x16eb01(_0x83b184){if(0x0===_0x83b184)return _0x3c1b55;for(var _0x256962=0x0;!(0x1&_0x83b184);)_0x256962++,_0x83b184>>=0x1;return _0x256962;}for(var _0x317e4b=new Array(_0x3c1b55+0x1)[_0x2663eb(0x37d)](0x0),_0x23f514=0x0;_0x23f514<_0x11da48;_0x23f514++)_0x317e4b[_0x16eb01(_0x23f514)]++;for(var _0x12a93d=new Array(_0x3c1b55+0x1),_0x349e31=0x0,_0x24ad9b=0x0;_0x24ad9b<=_0x3c1b55;_0x24ad9b++){_0x12a93d[_0x24ad9b]=_0x4ca19d['slice'](_0x349e31,_0x349e31+_0x317e4b[_0x24ad9b]),_0x349e31+=_0x317e4b[_0x24ad9b];}for(var _0x51a12f=new Array(_0x3c1b55+0x1)[_0x2663eb(0x37d)](0x0),_0x4de9cf=new Array(_0x11da48),_0x255ccc=0x0;_0x255ccc<_0x11da48;_0x255ccc++){var _0x2d4efc=_0x16eb01(_0x255ccc);_0x4de9cf[_0x255ccc]=_0x12a93d[_0x2d4efc][_0x2663eb(0x13f)](_0x51a12f[_0x2d4efc]++);}var _0x436753=_0x4de9cf[_0x2663eb(0x1ea)]('');if(_0x3a2533&&_0x436753['length']>0x1)_0x436753=_0x436753[_0x2663eb(0x1f7)](-0x1)+_0x436753['slice'](0x0,-0x1);return _0x436753;},_0x41eeb2=function(_0x2ed313){var _0x1ac74d=_0x3b9fea,_0x1b09c7=arguments[_0x1ac74d(0x21a)]>0x1&&void 0x0!==arguments[0x1]&&arguments[0x1],_0x416681=_0x2ed313[_0x1ac74d(0x21a)];if(_0x416681<=0x1)return _0x2ed313;function _0x23945f(_0x15ed43){if(_0x15ed43<0x2)return![];if(_0x15ed43%0x2===0x0)return _0x15ed43===0x2;for(var _0x4a107e=0x3;_0x4a107e*_0x4a107e<=_0x15ed43;_0x4a107e+=0x2)if(_0x15ed43%_0x4a107e===0x0)return![];return!![];}var _0x2d916b=function(_0x3d8cea){for(var _0x1e9cae=Math['max'](0x2,_0x3d8cea);!_0x23945f(_0x1e9cae);)_0x1e9cae++;return _0x1e9cae;}(_0x416681+0x1),_0x28c0f3=new Array(_0x416681)[_0x1ac74d(0x37d)](![]),_0x334477=[],_0x1e60d8=0x0;while(_0x334477['length']<_0x416681){_0x1e60d8=(_0x1e60d8+0x2)%_0x2d916b,_0x1e60d8<_0x416681&&!_0x28c0f3[_0x1e60d8]&&(_0x334477[_0x1ac74d(0x139)](_0x1e60d8),_0x28c0f3[_0x1e60d8]=!![]);}var _0x12634e=new Array(_0x416681);for(var _0x42cd78=0x0;_0x42cd78<_0x416681;_0x42cd78++)_0x12634e[_0x334477[_0x42cd78]]=_0x2ed313[_0x42cd78];var _0x6bb34d=_0x12634e[_0x1ac74d(0x1ea)]('');if(_0x1b09c7&&_0x6bb34d[_0x1ac74d(0x21a)]>0x1)_0x6bb34d=_0x6bb34d[_0x1ac74d(0x1f7)](0x1)+_0x6bb34d[0x0];return _0x6bb34d;};function _0x23cdff(_0x3c25a8,_0x926880){return _0x926880+'|'+_0x41eeb2(_0x28c75c(_0x1df0c4(_0x3c25a8,![]),![]),![]);}function _0x2d4d04(_0x1e2741){var _0x81c54a=_0x3b9fea,_0x326a4c=new Uint8Array(_0x1e2741),_0x330989='';for(var _0x593594=0x0;_0x593594<_0x326a4c[_0x81c54a(0x21a)];_0x593594++)_0x330989+=(_0x326a4c[_0x593594]<0x10?'0':'')+_0x326a4c[_0x593594][_0x81c54a(0x251)](0x10);return _0x330989;}function _0x505c60(_0x1aa864){var _0x27fa2c=_0x3b9fea;function _0x402977(_0x1887dd,_0x3a87ef){return _0x1887dd>>>_0x3a87ef|_0x1887dd<<0x20-_0x3a87ef;}var _0xc401ed=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0xfc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x6ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2],_0x4b78dc=unescape(encodeURIComponent(_0x1aa864)),_0x2caced=_0x4b78dc[_0x27fa2c(0x21a)],_0x1c8d54=_0x4b78dc+'\u0080';while(_0x1c8d54[_0x27fa2c(0x21a)]%0x40!==0x38)_0x1c8d54+='\x00';var _0x4ea1e8=_0x2caced*0x8;for(var _0x3b6b19=0x7;_0x3b6b19>=0x0;_0x3b6b19--)_0x1c8d54+=String[_0x27fa2c(0x228)](_0x4ea1e8/Math[_0x27fa2c(0x2b2)](0x2,_0x3b6b19*0x8)&0xff);var _0x4a809f=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19],_0x5032c7=new Array(0x40);for(var _0x5658bc=0x0;_0x5658bc<_0x1c8d54[_0x27fa2c(0x21a)];_0x5658bc+=0x40){for(var _0x3844c1=0x0;_0x3844c1<0x10;_0x3844c1++){_0x5032c7[_0x3844c1]=_0x1c8d54['charCodeAt'](_0x5658bc+0x4*_0x3844c1)<<0x18|_0x1c8d54['charCodeAt'](_0x5658bc+0x4*_0x3844c1+0x1)<<0x10|_0x1c8d54[_0x27fa2c(0x207)](_0x5658bc+0x4*_0x3844c1+0x2)<<0x8|_0x1c8d54[_0x27fa2c(0x207)](_0x5658bc+0x4*_0x3844c1+0x3);}for(_0x3844c1=0x10;_0x3844c1<0x40;_0x3844c1++){var _0x474340=_0x402977(_0x5032c7[_0x3844c1-0xf],0x7)^_0x402977(_0x5032c7[_0x3844c1-0xf],0x12)^_0x5032c7[_0x3844c1-0xf]>>>0x3,_0x35ad39=_0x402977(_0x5032c7[_0x3844c1-0x2],0x11)^_0x402977(_0x5032c7[_0x3844c1-0x2],0x13)^_0x5032c7[_0x3844c1-0x2]>>>0xa;_0x5032c7[_0x3844c1]=_0x5032c7[_0x3844c1-0x10]+_0x474340+_0x5032c7[_0x3844c1-0x7]+_0x35ad39|0x0;}var _0x19a60d=_0x4a809f[0x0],_0xabf120=_0x4a809f[0x1],_0x12e50e=_0x4a809f[0x2],_0x15235d=_0x4a809f[0x3],_0x33e1ae=_0x4a809f[0x4],_0x29053a=_0x4a809f[0x5],_0x103753=_0x4a809f[0x6],_0x33d2c2=_0x4a809f[0x7];for(_0x3844c1=0x0;_0x3844c1<0x40;_0x3844c1++){var _0xbb7cd9=_0x402977(_0x33e1ae,0x6)^_0x402977(_0x33e1ae,0xb)^_0x402977(_0x33e1ae,0x19),_0x5a52ea=_0x33e1ae&_0x29053a^~_0x33e1ae&_0x103753,_0x4e0487=_0x33d2c2+_0xbb7cd9+_0x5a52ea+_0xc401ed[_0x3844c1]+_0x5032c7[_0x3844c1]|0x0,_0x1ae562=_0x402977(_0x19a60d,0x2)^_0x402977(_0x19a60d,0xd)^_0x402977(_0x19a60d,0x16),_0x3546ea=_0x19a60d&_0xabf120^_0x19a60d&_0x12e50e^_0xabf120&_0x12e50e,_0x22dba4=_0x1ae562+_0x3546ea|0x0;_0x33d2c2=_0x103753,_0x103753=_0x29053a,_0x29053a=_0x33e1ae,_0x33e1ae=_0x15235d+_0x4e0487|0x0,_0x15235d=_0x12e50e,_0x12e50e=_0xabf120,_0xabf120=_0x19a60d,_0x19a60d=_0x4e0487+_0x22dba4|0x0;}_0x4a809f[0x0]=_0x4a809f[0x0]+_0x19a60d|0x0,_0x4a809f[0x1]=_0x4a809f[0x1]+_0xabf120|0x0,_0x4a809f[0x2]=_0x4a809f[0x2]+_0x12e50e|0x0,_0x4a809f[0x3]=_0x4a809f[0x3]+_0x15235d|0x0,_0x4a809f[0x4]=_0x4a809f[0x4]+_0x33e1ae|0x0,_0x4a809f[0x5]=_0x4a809f[0x5]+_0x29053a|0x0,_0x4a809f[0x6]=_0x4a809f[0x6]+_0x103753|0x0,_0x4a809f[0x7]=_0x4a809f[0x7]+_0x33d2c2|0x0;}var _0x2cc991='';for(_0x3b6b19=0x0;_0x3b6b19<0x8;_0x3b6b19++){var _0x5ae793=_0x4a809f[_0x3b6b19]>>>0x0;for(var _0x407d98=0x7;_0x407d98>=0x0;_0x407d98--)_0x2cc991+=(_0x5ae793>>>_0x407d98*0x4&0xf)[_0x27fa2c(0x251)](0x10);}return _0x2cc991;}function _0x19a995(_0x569eba){var _0x12a486=_0x3b9fea;if(window['crypto']&&window[_0x12a486(0x1b0)][_0x12a486(0x233)]&&window[_0x12a486(0x2f3)])try{var _0x105079=new TextEncoder()[_0x12a486(0x321)](_0x569eba);return window[_0x12a486(0x1b0)]['subtle']['digest'](_0x12a486(0x196),_0x105079)[_0x12a486(0x19e)](_0x2d4d04);}catch(_0x1e2065){}if(window[_0x12a486(0x168)]&&window[_0x12a486(0x168)][_0x12a486(0x12f)])return Promise['resolve'](window['CryptoJS'][_0x12a486(0x12f)](_0x569eba)[_0x12a486(0x251)]());return Promise[_0x12a486(0x364)](_0x505c60(_0x569eba));}function _0x2ee326(){var _0x18c406=_0x3b9fea,_0x4e3a25=window[_0x18c406(0x24d)]||{},_0x496ae7=window[_0x18c406(0x38a)]||{},_0x4c9502=[_0x4e3a25[_0x18c406(0x21d)]||'',Intl&&Intl[_0x18c406(0x2ee)]?Intl[_0x18c406(0x2ee)]()[_0x18c406(0x186)]()[_0x18c406(0x2e3)]:'',(_0x496ae7[_0x18c406(0x367)]||0x0)+'x'+(_0x496ae7['height']||0x0),_0x4e3a25[_0x18c406(0x278)]||_0x4e3a25[_0x18c406(0x163)]||'',_0x4e3a25['deviceMemory']||0x0,_0x4e3a25[_0x18c406(0x12c)]||0x0];return _0x19a995(_0x4c9502['join']('||'));}function _0x137df3(){var _0x3f3872=_0x3b9fea,_0x3fbdd7=_0x3f3872(0x209),_0x34e98e=null;try{_0x34e98e=localStorage[_0x3f3872(0x13d)](_0x3fbdd7);}catch(_0xbdeae2){}if(!_0x34e98e){_0x34e98e=_0x3f3872(0x1a4)[_0x3f3872(0x36b)](/[xy]/g,function(_0x5de0a7){var _0x3c2e78=_0x3f3872,_0x4a90dc=Math[_0x3c2e78(0x2fd)]()*0x10|0x0;return(_0x5de0a7==='x'?_0x4a90dc:_0x4a90dc&0x3|0x8)['toString'](0x10);});try{localStorage['setItem'](_0x3fbdd7,_0x34e98e);}catch(_0x5e4fc7){}}return _0x34e98e;}function _0x51caaa(){var _0x8691cf=_0x3b9fea;if(!_0x425e28[_0x8691cf(0x36f)])return null;return _0x425e28[_0x8691cf(0x36f)][_0x8691cf(0x36b)](/\{GUID\}/g,_0x137df3());}function _0x41d7b6(_0xb5cd3f,_0x3e0ab6,_0x242aa2){return new Promise(function(_0x455df9,_0x4fd388){var _0xaa423f=a0_0x2a23,_0x1f89d7='http-'+Date[_0xaa423f(0x1d0)]()+'-'+Math[_0xaa423f(0x2fd)]();_0x529c49(_0xaa423f(0x2aa),_0xb5cd3f,_0x3e0ab6);function _0x5c12c3(_0x29acc8){var _0x53ecab=_0xaa423f;if(_0x29acc8['source']!==window)return;var _0x308398=_0x29acc8[_0x53ecab(0x135)];if(!_0x308398||_0x308398[_0x53ecab(0x1cf)]!=='amedia-ext'||_0x308398[_0x53ecab(0x2e1)]!==_0x53ecab(0x25f)||_0x308398[_0x53ecab(0x375)]!==_0x1f89d7)return;_0x63f2de();if(!_0x308398['ok'])return _0x529c49(_0x53ecab(0x2be),_0x3e0ab6,_0x53ecab(0x319),_0x308398[_0x53ecab(0x1d4)]),_0x4fd388(new Error(_0x308398[_0x53ecab(0x1d4)]||'ext\x20proxy\x20failed'));if(_0x308398['status']<0xc8||_0x308398[_0x53ecab(0x254)]>=0x12c)return _0x529c49('http\x20fail\x20(ext)\x20url:',_0x3e0ab6,'status:',_0x308398[_0x53ecab(0x254)]),_0x4fd388(new Error(_0x53ecab(0x15e)+_0x308398['status']+'\x20'+_0x3e0ab6));var _0xa866fe='';if(_0x308398['headers']){for(var _0x2dd3a5 in _0x308398[_0x53ecab(0x2ed)])_0xa866fe+=_0x2dd3a5+':\x20'+_0x308398[_0x53ecab(0x2ed)][_0x2dd3a5]+'\x0d\x0a';}_0x529c49('http\x20ok\x20(ext)',_0x3e0ab6,_0x53ecab(0x295),_0x308398[_0x53ecab(0x1ee)]?_0x308398[_0x53ecab(0x1ee)]['length']:0x0,_0x53ecab(0x32b),'status:',_0x308398[_0x53ecab(0x254)]),_0x308398[_0x53ecab(0x1ee)]&&/\/sarn|\/vorf|\/bnsi\/movies|\/events|\/errors/[_0x53ecab(0x2c1)](_0x3e0ab6)&&_0x529c49('http\x20ok\x20preview\x20(ext)',_0x3e0ab6[_0x53ecab(0x36b)](/^https?:\/\/[^\/]+/,''),String(_0x308398[_0x53ecab(0x1ee)])[_0x53ecab(0x1f7)](0x0,0xf0)[_0x53ecab(0x36b)](/\s+/g,'\x20')),_0x455df9({'body':_0x308398[_0x53ecab(0x1ee)],'headers':_0xa866fe,'status':_0x308398['status']});}var _0x14dc68=setTimeout(function(){var _0x2eab77=_0xaa423f;_0x63f2de(),_0x529c49('http\x20timeout\x20(ext)\x20url:',_0x3e0ab6),_0x4fd388(new Error(_0x2eab77(0x15c)+_0x3e0ab6));},_0x242aa2[_0xaa423f(0x1c2)]||0x3a98);function _0x63f2de(){var _0x286638=_0xaa423f;window[_0x286638(0x1b4)](_0x286638(0x2d6),_0x5c12c3),clearTimeout(_0x14dc68);}window['addEventListener']('message',_0x5c12c3),window['postMessage']({'source':_0xaa423f(0x259),'kind':_0xaa423f(0x287),'reqId':_0x1f89d7,'url':_0x3e0ab6,'method':_0xb5cd3f,'headers':_0x242aa2[_0xaa423f(0x2ed)]||{},'body':_0x242aa2['body']||null},'*');});}function _0xec1c1f(_0x44de96,_0x3a8562,_0x56a62d){var _0x483fb9=_0x3b9fea;return _0x529c49(_0x483fb9(0x23f),_0x44de96,_0x3a8562),new Promise(function(_0x5bbe94,_0x11906d){var _0xea3597=_0x483fb9,_0x5f373b=new XMLHttpRequest();_0x5f373b[_0xea3597(0x253)](_0x44de96,_0x3a8562,!![]);if(_0x56a62d[_0xea3597(0x2ed)])for(var _0x44f4b8 in _0x56a62d[_0xea3597(0x2ed)]){try{_0x5f373b[_0xea3597(0x21e)](_0x44f4b8,_0x56a62d[_0xea3597(0x2ed)][_0x44f4b8]);}catch(_0x4300ce){}}_0x5f373b['onload']=function(){var _0x5af9dc=_0xea3597;if(_0x5f373b[_0x5af9dc(0x254)]>=0xc8&&_0x5f373b[_0x5af9dc(0x254)]<0x12c)_0x5bbe94({'body':_0x5f373b[_0x5af9dc(0x2db)],'headers':_0x5f373b[_0x5af9dc(0x24f)](),'status':_0x5f373b[_0x5af9dc(0x254)]});else _0x11906d(new Error(_0x5af9dc(0x15e)+_0x5f373b[_0x5af9dc(0x254)]+'\x20'+_0x3a8562));},_0x5f373b[_0xea3597(0x21f)]=function(){_0x11906d(new Error('Network\x20error:\x20'+_0x3a8562));},_0x5f373b[_0xea3597(0x1c2)]=_0x56a62d[_0xea3597(0x1c2)]||0x3a98,_0x5f373b[_0xea3597(0x386)](_0x56a62d[_0xea3597(0x1ee)]||null);});}function _0x5a4819(_0xcfd1c,_0x72f865,_0x13ee7f){return new Promise(function(_0x4999ea,_0x483105){var _0x239d5f=a0_0x2a23,_0x57596a;try{_0x57596a=new Lampa['Reguest']();}catch(_0x51ea74){return _0x483105(new Error(_0x239d5f(0x198)));}_0x529c49('http\x20via\x20native',_0xcfd1c,_0x72f865);var _0x210377=![];function _0x35cad5(_0xa98ba,_0x69f86f){var _0x5a81e9=_0x239d5f;if(_0x210377)return;_0x210377=!![];var _0x49a2d9,_0x23ed52,_0x5d0b82=null;if(_0xa98ba&&typeof _0xa98ba===_0x5a81e9(0x28a)&&typeof _0xa98ba[_0x5a81e9(0x1ee)]===_0x5a81e9(0x342))_0x5d0b82=_0xa98ba;else{if(typeof _0xa98ba===_0x5a81e9(0x342)&&_0xa98ba[_0x5a81e9(0x13f)](0x0)==='{'&&_0xa98ba[_0x5a81e9(0x245)](_0x5a81e9(0x380))!==-0x1&&_0xa98ba[_0x5a81e9(0x245)]('\x22headers\x22:')!==-0x1)try{var _0x1fff41=JSON[_0x5a81e9(0x206)](_0xa98ba);if(_0x1fff41&&typeof _0x1fff41[_0x5a81e9(0x1ee)]===_0x5a81e9(0x342))_0x5d0b82=_0x1fff41;}catch(_0x1506b9){}}if(_0x5d0b82){_0x49a2d9=_0x5d0b82[_0x5a81e9(0x1ee)],_0x23ed52='';if(_0x5d0b82[_0x5a81e9(0x2ed)]&&typeof _0x5d0b82[_0x5a81e9(0x2ed)]===_0x5a81e9(0x28a))for(var _0x460068 in _0x5d0b82[_0x5a81e9(0x2ed)]){_0x23ed52+=_0x460068+':\x20'+_0x5d0b82[_0x5a81e9(0x2ed)][_0x460068]+'\x0d\x0a';}}else typeof _0xa98ba===_0x5a81e9(0x342)?(_0x49a2d9=_0xa98ba,_0x23ed52=typeof _0x69f86f===_0x5a81e9(0x342)?_0x69f86f:''):(_0x49a2d9=_0xa98ba==null?'':JSON[_0x5a81e9(0x262)](_0xa98ba),_0x23ed52='');if(!_0x49a2d9)return _0x529c49(_0x5a81e9(0x27e),_0x72f865,'—\x20treating\x20as\x20failure'),_0x483105(new Error(_0x5a81e9(0x19d)+_0x72f865));_0x529c49('http\x20ok',_0x72f865,_0x5a81e9(0x295),_0x49a2d9[_0x5a81e9(0x21a)],_0x5a81e9(0x32b),_0x5a81e9(0x277),_0x23ed52?_0x23ed52[_0x5a81e9(0x21a)]+_0x5a81e9(0x15b):_0x5a81e9(0x16c),_0x5d0b82?_0x5a81e9(0x349):''),/\/sarn|\/vorf|\/bnsi\/movies|\/events|\/errors/[_0x5a81e9(0x2c1)](_0x72f865)&&_0x529c49('http\x20ok\x20preview',_0x72f865[_0x5a81e9(0x36b)](/^https?:\/\/[^\/]+/,''),_0x49a2d9[_0x5a81e9(0x1f7)](0x0,0xf0)['replace'](/\s+/g,'\x20')),_0x4999ea({'body':_0x49a2d9,'headers':_0x23ed52,'status':0xc8});}function _0x693aea(_0x5aa371){var _0x205964=_0x239d5f;if(_0x210377)return;_0x210377=!![];var _0x5ab09f=_0x5aa371&&_0x5aa371[_0x205964(0x254)]||0x0,_0x4772b4=_0x5aa371&&_0x5aa371[_0x205964(0x2d6)]||'';_0x529c49('http\x20fail',_0x72f865,_0x205964(0x2c7),_0x5ab09f,'msg:',_0x4772b4),_0x483105(new Error(_0x205964(0x130)+(_0x5ab09f||_0x4772b4||'error')+'\x20'+_0x72f865));}var _0x21f7b4=_0xcfd1c&&_0xcfd1c['toUpperCase']()!==_0x239d5f(0x1e9)?_0x13ee7f[_0x239d5f(0x1ee)]||'':![],_0x1954b4={'dataType':_0x239d5f(0x1cc),'timeout':_0x13ee7f[_0x239d5f(0x1c2)]||0x3a98,'headers':_0x13ee7f[_0x239d5f(0x2ed)]||{},'returnHeaders':!![]};try{if(typeof _0x57596a[_0x239d5f(0x38e)]===_0x239d5f(0x334))_0x57596a[_0x239d5f(0x38e)](_0x72f865,_0x35cad5,_0x693aea,_0x21f7b4,_0x1954b4);else{if(typeof _0x57596a[_0x239d5f(0x348)]===_0x239d5f(0x334))_0x57596a[_0x239d5f(0x348)](_0x72f865,_0x35cad5,_0x693aea,_0x21f7b4,{'dataType':_0x239d5f(0x1cc),'headers':_0x13ee7f[_0x239d5f(0x2ed)]||{},'type':_0xcfd1c});else typeof _0x57596a[_0x239d5f(0x386)]==='function'?_0x57596a[_0x239d5f(0x386)](_0x72f865,_0x35cad5,_0x693aea,_0x21f7b4,{'dataType':_0x239d5f(0x1cc),'headers':_0x13ee7f[_0x239d5f(0x2ed)]||{},'type':_0xcfd1c}):_0x483105(new Error(_0x239d5f(0x332)));}}catch(_0x5172eb){_0x483105(_0x5172eb);}});}function _0x51dee3(_0x51fd3e,_0x26bcde,_0x441fd5){var _0x2bd0d0=_0x3b9fea;_0x441fd5=_0x441fd5||{};if(_0x551277[_0x2bd0d0(0x266)])return _0x41d7b6(_0x51fd3e,_0x26bcde,_0x441fd5);if(window[_0x2bd0d0(0x229)]&&Lampa[_0x2bd0d0(0x176)])return _0x5a4819(_0x51fd3e,_0x26bcde,_0x441fd5)[_0x2bd0d0(0x246)](function(_0xbdd49c){var _0x8807d8=_0x2bd0d0,_0x1c6889=_0xbdd49c&&_0xbdd49c[_0x8807d8(0x2d6)]||'';if(_0x1c6889['indexOf']('no\x20Lampa.Reguest')!==-0x1||_0x1c6889['indexOf'](_0x8807d8(0x18c))!==-0x1)return _0xec1c1f(_0x51fd3e,_0x26bcde,_0x441fd5);throw _0xbdd49c;});return _0xec1c1f(_0x51fd3e,_0x26bcde,_0x441fd5);}function _0x414943(_0x5df18b){var _0x43b513=_0x3b9fea;if(!_0x5df18b)return null;return _0x5df18b[_0x43b513(0x291)]||_0x5df18b['kp_id']||_0x5df18b['kp']||_0x5df18b[_0x43b513(0x2b3)]&&_0x5df18b[_0x43b513(0x2b3)]['kp']||_0x5df18b[_0x43b513(0x26c)]&&_0x5df18b[_0x43b513(0x26c)]['id']||null;}function _0x311547(_0x52b99a){var _0x2f1019=_0x3b9fea;if(!_0x52b99a)return null;return _0x52b99a[_0x2f1019(0x2cf)]||_0x52b99a['imdb']||_0x52b99a[_0x2f1019(0x2b3)]&&_0x52b99a['ids'][_0x2f1019(0x261)]||_0x52b99a[_0x2f1019(0x143)]&&_0x52b99a[_0x2f1019(0x143)][_0x2f1019(0x2cf)]||null;}function _0xb66109(_0x342a01){var _0x2c0291=_0x3b9fea;if(!_0x342a01)return null;return _0x342a01[_0x2c0291(0x38d)]||_0x342a01[_0x2c0291(0x2b3)]&&_0x342a01[_0x2c0291(0x2b3)][_0x2c0291(0x242)]||_0x342a01[_0x2c0291(0x1cf)]===_0x2c0291(0x242)&&_0x342a01['id']||(typeof _0x342a01['id']==='number'&&_0x342a01['id']<0x3b9aca00?_0x342a01['id']:null)||null;}var _0xf167c=_0x3b9fea(0x31f);function _0x3d0a39(_0x1004c5,_0xde2380){var _0x28e3cd=_0x3b9fea,_0x13d908=_0xf167c+_0x1004c5+'/'+encodeURIComponent(_0xde2380);return _0x529c49(_0x28e3cd(0x360),_0x1004c5,'=',_0xde2380),_0x51dee3(_0x28e3cd(0x1e9),_0x13d908,{'headers':_0x3828b0({'Authorization':'Bearer\x20'+_0x425e28[_0x28e3cd(0x24b)]}),'timeout':0x1f40})[_0x28e3cd(0x19e)](function(_0x5ed507){var _0xf9fd06=_0x28e3cd,_0x449856;try{_0x449856=JSON['parse'](_0x5ed507['body']);}catch(_0x419bde){_0x529c49(_0xf9fd06(0x1a5),_0x5ed507[_0xf9fd06(0x1ee)][_0xf9fd06(0x1f7)](0x0,0xc8));throw new Error(_0xf9fd06(0x311)+_0x1004c5+_0xf9fd06(0x1a1));}var _0x175d87=_0x449856&&_0x449856[_0xf9fd06(0x135)];if(!_0x175d87||!_0x175d87[_0xf9fd06(0x24b)]){_0x529c49(_0xf9fd06(0x377),JSON[_0xf9fd06(0x262)](_0x449856)['slice'](0x0,0xc8));throw new Error(_0xf9fd06(0x311)+_0x1004c5+_0xf9fd06(0x1a9));}var _0x18fd93={'token_movie':_0x175d87[_0xf9fd06(0x24b)],'kp':_0x175d87['ids']&&_0x175d87['ids']['kp'],'imdb':_0x175d87[_0xf9fd06(0x2b3)]&&_0x175d87[_0xf9fd06(0x2b3)][_0xf9fd06(0x261)],'tmdb':_0x175d87[_0xf9fd06(0x2b3)]&&_0x175d87[_0xf9fd06(0x2b3)]['tmdb']};return _0x529c49(_0xf9fd06(0x1eb),_0x18fd93),_0x18fd93;});}var _0x3136da=_0x3b9fea(0x274);function _0x16e994(_0x339a21){var _0x465382=_0x3b9fea,_0x484fa1={'Accept':_0x465382(0x221),'Accept-Language':_0x465382(0x26d),'User-Agent':_0x3136da,'Origin':_0x425e28[_0x465382(0x1f1)],'Referer':_0x425e28[_0x465382(0x1f1)]+'/','X-Requested-With':'XMLHttpRequest','Sec-Fetch-Dest':_0x465382(0x1fe),'Sec-Fetch-Mode':_0x465382(0x37e),'Sec-Fetch-Site':_0x465382(0x293),'Sec-Fetch-User':'?1','Upgrade-Insecure-Requests':'1'};if(_0x339a21){for(var _0x14615d in _0x339a21)_0x484fa1[_0x14615d]=_0x339a21[_0x14615d];}return _0x484fa1;}function _0x3828b0(_0x4cfee1){var _0x1a5ff2=_0x3b9fea,_0x47521d={'Accept':_0x1a5ff2(0x33c),'Accept-Language':_0x1a5ff2(0x26d),'User-Agent':_0x3136da,'Origin':_0x425e28[_0x1a5ff2(0x1f1)],'Referer':_0x425e28[_0x1a5ff2(0x1f1)]+'/','X-Requested-With':_0x1a5ff2(0x13e),'Sec-Fetch-Dest':_0x1a5ff2(0x1c1),'Sec-Fetch-Mode':'cors','Sec-Fetch-Site':'same-origin'};if(_0x4cfee1){for(var _0x5dc7cb in _0x4cfee1)_0x47521d[_0x5dc7cb]=_0x4cfee1[_0x5dc7cb];}return _0x47521d;}function _0x22cdc5(_0x2dd255){var _0xb32105=_0x3b9fea,_0x5f2db9=_0x414943(_0x2dd255),_0x447ad6=_0x311547(_0x2dd255),_0x5b193c=_0xb66109(_0x2dd255),_0x1ce70b=_0x2dd255[_0xb32105(0x22e)]||_0x2dd255['name']||_0x2dd255[_0xb32105(0x344)]||_0x2dd255[_0xb32105(0x12e)],_0x7763f1=(_0x2dd255[_0xb32105(0x1de)]||_0x2dd255[_0xb32105(0x38c)]||_0x2dd255[_0xb32105(0x147)]||'')['toString']()[_0xb32105(0x1f7)](0x0,0x4),_0x475e2b=Promise['resolve'](null);if(_0x5b193c||_0x447ad6||_0x5f2db9){var _0x2f859a,_0x3f0313;if(_0x5b193c)_0x2f859a=_0xb32105(0x242),_0x3f0313=_0x5b193c;else _0x447ad6?(_0x2f859a=_0xb32105(0x261),_0x3f0313=String(_0x447ad6)[_0xb32105(0x36b)](/^tt/i,'')):(_0x2f859a='kp',_0x3f0313=_0x5f2db9);_0x475e2b=_0x3d0a39(_0x2f859a,_0x3f0313)[_0xb32105(0x246)](function(_0x2fb533){var _0x345c77=_0xb32105;return _0x529c49('v2Lookup\x20fallback:',_0x2fb533[_0x345c77(0x2d6)]),null;});}return _0x475e2b[_0xb32105(0x19e)](function(_0x2aea89){var _0x53bd87=_0xb32105,_0x3f072e=[],_0x483cd0=Math[_0x53bd87(0x179)](Date[_0x53bd87(0x1d0)]()/0x3e8);if(_0x5f2db9)_0x3f072e[_0x53bd87(0x139)]({'kind':_0x53bd87(0x165),'q':_0x53bd87(0x356)+encodeURIComponent(_0x5f2db9)+_0x53bd87(0x34a)+_0x483cd0});_0x2aea89&&_0x2aea89['kp']&&(!_0x5f2db9||String(_0x2aea89['kp'])!==String(_0x5f2db9))&&_0x3f072e[_0x53bd87(0x139)]({'kind':'kp-from-v2+vdate','q':_0x53bd87(0x356)+encodeURIComponent(_0x2aea89['kp'])+'&vdate='+_0x483cd0});_0x2aea89&&_0x2aea89[_0x53bd87(0x2cb)]&&_0x3f072e[_0x53bd87(0x139)]({'kind':_0x53bd87(0x2cb),'q':_0x53bd87(0x162)+encodeURIComponent(_0x2aea89[_0x53bd87(0x2cb)])});if(_0x447ad6){_0x3f072e[_0x53bd87(0x139)]({'kind':_0x53bd87(0x261),'q':_0x53bd87(0x131)+encodeURIComponent(_0x447ad6)});var _0x14a164=String(_0x447ad6)['replace'](/^tt/i,'');_0x14a164!==String(_0x447ad6)&&_0x3f072e[_0x53bd87(0x139)]({'kind':_0x53bd87(0x24c),'q':_0x53bd87(0x131)+encodeURIComponent(_0x14a164)});}if(_0x5b193c)_0x3f072e[_0x53bd87(0x139)]({'kind':_0x53bd87(0x242),'q':'tmdb='+encodeURIComponent(_0x5b193c)});if(_0x1ce70b){var _0x44e2c1=_0x53bd87(0x149)+encodeURIComponent(_0x1ce70b);if(_0x7763f1)_0x44e2c1+=_0x53bd87(0x185)+_0x7763f1;_0x3f072e[_0x53bd87(0x139)]({'kind':_0x53bd87(0x363),'q':_0x44e2c1});}if(!_0x3f072e[_0x53bd87(0x21a)])return Promise[_0x53bd87(0x219)](new Error(_0x53bd87(0x223)));_0x529c49(_0x53bd87(0x2ad),_0x3f072e[_0x53bd87(0x166)](function(_0xbe94fb){var _0x5de998=_0x53bd87;return _0xbe94fb[_0x5de998(0x2e1)];})[_0x53bd87(0x1ea)](_0x53bd87(0x2c2)));var _0x5d5e56=!![];function _0x142dd4(_0x470464,_0x5cb560){var _0x58f3b9=_0x53bd87;if(_0x470464>=_0x3f072e['length']){if(_0x5d5e56)return Promise['reject'](new Error(_0x58f3b9(0x339)));return Promise[_0x58f3b9(0x219)](_0x5cb560||new Error(_0x58f3b9(0x1cd)));}var _0x27d4ed=_0x3f072e[_0x470464],_0x4c6f02=_0x425e28[_0x58f3b9(0x1f1)]+'/?'+_0x27d4ed['q']+_0x58f3b9(0x346)+_0x425e28[_0x58f3b9(0x24b)];return _0x529c49(_0x58f3b9(0x1ba),_0x27d4ed[_0x58f3b9(0x2e1)],'→',_0x4c6f02),_0x51dee3(_0x58f3b9(0x1e9),_0x4c6f02,{'headers':_0x16e994()})[_0x58f3b9(0x19e)](function(_0x17c24b){var _0x1fe0dc=_0x58f3b9,_0x5547bd=_0x17c24b[_0x1fe0dc(0x1ee)]['match'](/<meta\s+name=["']viewporti["']\s+content=["']([^"']+)["']/i);if(!_0x5547bd)return _0x529c49('harvestEmbed',_0x27d4ed[_0x1fe0dc(0x2e1)],_0x1fe0dc(0x205),_0x17c24b[_0x1fe0dc(0x1ee)][_0x1fe0dc(0x1f7)](0x0,0xc8)),_0x142dd4(_0x470464+0x1,new Error(_0x1fe0dc(0x2a3)));var _0x267079=_0x17c24b[_0x1fe0dc(0x1ee)][_0x1fe0dc(0x37a)](/fileList\s*=\s*JSON\.parse\(['"]([\s\S]+?)['"]\)/);if(!_0x267079)return _0x529c49(_0x1fe0dc(0x263),_0x27d4ed[_0x1fe0dc(0x2e1)],_0x1fe0dc(0x2b1),_0x17c24b[_0x1fe0dc(0x1ee)][_0x1fe0dc(0x1f7)](0x0,0xc8)),_0x142dd4(_0x470464+0x1,new Error(_0x1fe0dc(0x2d4)));var _0x4856ee=JSON[_0x1fe0dc(0x206)](_0x267079[0x1][_0x1fe0dc(0x36b)](/\\u([0-9a-f]{4})/gi,function(_0x3aa626,_0x379d49){return String['fromCharCode'](parseInt(_0x379d49,0x10));})[_0x1fe0dc(0x36b)](/\\"/g,'\x22')[_0x1fe0dc(0x36b)](/\\\\/g,'\x5c')),_0x98dd36=_0x4856ee[_0x1fe0dc(0x29f)]&&_0x4856ee[_0x1fe0dc(0x29f)]['id'];if(!_0x98dd36)return _0x529c49('harvestEmbed',_0x27d4ed['kind'],'empty\x20active.id\x20—\x20fileList\x20type:',_0x4856ee[_0x1fe0dc(0x14e)]),_0x142dd4(_0x470464+0x1,new Error(_0x1fe0dc(0x231)));_0x529c49('harvestEmbed',_0x27d4ed[_0x1fe0dc(0x2e1)],_0x1fe0dc(0x302),_0x4856ee[_0x1fe0dc(0x14e)],_0x1fe0dc(0x280),_0x98dd36,_0x1fe0dc(0x289),_0x4856ee[_0x1fe0dc(0x2c4)]?Object[_0x1fe0dc(0x338)](_0x4856ee[_0x1fe0dc(0x2c4)])[_0x1fe0dc(0x21a)]:0x0);var _0x145529=_0x17c24b[_0x1fe0dc(0x1ee)][_0x1fe0dc(0x37a)](/movie\s*=\s*\{[\s\S]{0,200}?["']id["']\s*:\s*["']([a-f0-9]{20,40})["']/i),_0x4b35bc=_0x17c24b[_0x1fe0dc(0x1ee)][_0x1fe0dc(0x37a)](/movie\s*=\s*\{[\s\S]{0,400}?["']kp["']\s*:\s*["']?(\d+)/i);return{'embedUrl':_0x4c6f02,'metaSeed':_0x5547bd[0x1],'fileActiveId':_0x98dd36,'fileList':_0x4856ee,'movieId':_0x145529?_0x145529[0x1]:null,'kp':_0x4b35bc?_0x4b35bc[0x1]:_0x5f2db9?String(_0x5f2db9):'','tokenMovie':_0x2aea89&&_0x2aea89[_0x1fe0dc(0x2cb)]||null};})[_0x58f3b9(0x246)](function(_0x43b1bc){var _0x290e86=_0x58f3b9;_0x529c49(_0x290e86(0x263),_0x27d4ed[_0x290e86(0x2e1)],_0x290e86(0x1f0),_0x43b1bc[_0x290e86(0x2d6)]);if((_0x43b1bc[_0x290e86(0x2d6)]||'')[_0x290e86(0x245)](_0x290e86(0x2bf))===-0x1)_0x5d5e56=![];return _0x142dd4(_0x470464+0x1,_0x43b1bc);});}return _0x142dd4(0x0,null);});}function _0x51774d(_0x4b0207){var _0xee84f1=_0x3b9fea;return _0x529c49(_0xee84f1(0x36e),_0x4b0207),_0x51dee3(_0xee84f1(0x1e9),_0x425e28[_0xee84f1(0x1f1)]+_0xee84f1(0x309),{'headers':_0x3828b0({'acceptis':_0x4b0207+'.'+_0x425e28[_0xee84f1(0x24b)],'Referer':_0x425e28[_0xee84f1(0x1f1)]+'/'})})[_0xee84f1(0x19e)](function(_0x4df1d4){var _0x2a1c37=_0xee84f1,_0x54340;try{_0x54340=JSON[_0x2a1c37(0x206)](_0x4df1d4[_0x2a1c37(0x1ee)]);}catch(_0x226448){_0x529c49(_0x2a1c37(0x18e),_0x4df1d4[_0x2a1c37(0x1ee)][_0x2a1c37(0x1f7)](0x0,0x12c));throw new Error(_0x2a1c37(0x357));}if(!_0x54340||!_0x54340[_0x2a1c37(0x187)]){_0x529c49('/sarn\x20no\x20challenge\x20field:',JSON[_0x2a1c37(0x262)](_0x54340)[_0x2a1c37(0x1f7)](0x0,0x12c));throw new Error(_0x2a1c37(0x1dc));}_0x529c49(_0x2a1c37(0x234),String(_0x54340[_0x2a1c37(0x187)])[_0x2a1c37(0x21a)],_0x2a1c37(0x2b5),String(_0x54340[_0x2a1c37(0x214)])[_0x2a1c37(0x21a)]);var _0x1585fa=_0x425e28['domain'],_0x375227=_0x54340[_0x2a1c37(0x214)]+'|'+_0x4b0207+'|'+_0x54340[_0x2a1c37(0x2a5)]+'|'+_0x1585fa+'|'+_0x1585fa;return _0x19a995(_0x375227)[_0x2a1c37(0x19e)](function(_0x3c03c6){var _0x139bc9=_0x2a1c37;return _0x51dee3(_0x139bc9(0x2c0),_0x425e28[_0x139bc9(0x1f1)]+_0x139bc9(0x1f9),{'headers':_0x3828b0({'content-type':_0x139bc9(0x32e),'accepts-block':_0x4b0207,'Referer':_0x425e28[_0x139bc9(0x1f1)]+'/'}),'body':JSON[_0x139bc9(0x262)]({'challenge':_0x54340[_0x139bc9(0x187)],'proof':_0x3c03c6,'parentOrigin':_0x1585fa,'referrer':''})});});})[_0xee84f1(0x19e)](function(_0x26f35f){var _0x308c86=_0xee84f1,_0x3c867d;try{_0x3c867d=JSON[_0x308c86(0x206)](_0x26f35f[_0x308c86(0x1ee)]);}catch(_0x5e42da){_0x529c49('/vorf\x20body\x20not\x20JSON:',_0x26f35f['body'][_0x308c86(0x1f7)](0x0,0x12c));throw new Error(_0x308c86(0x12a));}if(!_0x3c867d||!_0x3c867d[_0x308c86(0x24b)]){_0x529c49(_0x308c86(0x160),JSON[_0x308c86(0x262)](_0x3c867d)[_0x308c86(0x1f7)](0x0,0x12c));throw new Error(_0x308c86(0x164));}return _0x529c49(_0x308c86(0x275),String(_0x3c867d[_0x308c86(0x24b)])[_0x308c86(0x21a)]),_0x3c867d[_0x308c86(0x24b)];});}function _0xbd84c7(_0x3841dd){var _0xf61b04=_0x3b9fea,_0x2b153b=_0x23cdff(_0x3841dd['metaSeed'],_0x3841dd['hP']),_0x5d95d1=_0xf61b04(0x1d8)+_0x425e28['token']+_0xf61b04(0x2cd);return _0x529c49(_0xf61b04(0x1a3),_0x3841dd[_0xf61b04(0x23e)],_0xf61b04(0x1bc),_0x2b153b[_0xf61b04(0x21a)]),_0x51dee3('POST',_0x425e28['domain']+_0xf61b04(0x300)+_0x3841dd[_0xf61b04(0x23e)],{'headers':_0x3828b0({'Borth':_0x2b153b,'content-type':_0xf61b04(0x19f),'X-Requested-With':'XMLHttpRequest','Referer':_0x3841dd[_0xf61b04(0x216)]||_0x425e28[_0xf61b04(0x1f1)]+'/'}),'body':_0x5d95d1})[_0xf61b04(0x19e)](function(_0x3e3368){var _0x4d3c3b=_0xf61b04,_0xdfd556;try{_0xdfd556=JSON[_0x4d3c3b(0x206)](_0x3e3368[_0x4d3c3b(0x1ee)]);}catch(_0x220a57){_0x529c49(_0x4d3c3b(0x28e),_0x3e3368[_0x4d3c3b(0x1ee)]['slice'](0x0,0x12c));throw new Error('Amedia:\x20/bnsi/movies\x20ответил\x20не\x20JSON');}var _0x385e81=null;return _0x3e3368[_0x4d3c3b(0x2ed)][_0x4d3c3b(0x265)](/\r?\n/)[_0x4d3c3b(0x32c)](function(_0x33e572){var _0x41ac69=_0x4d3c3b,_0x122ac5=_0x33e572[_0x41ac69(0x37a)](/^borth:\s*(.+?)\s*$/i);if(_0x122ac5)_0x385e81=_0x122ac5[0x1];}),_0x529c49(_0x4d3c3b(0x1e3),_0xdfd556&&_0xdfd556['hlsSource']&&_0xdfd556[_0x4d3c3b(0x250)][_0x4d3c3b(0x21a)]||0x0,'pnr:',_0xdfd556&&_0xdfd556[_0x4d3c3b(0x313)],_0x4d3c3b(0x2fa),_0x385e81?_0x385e81[_0x4d3c3b(0x21a)]+'\x20chars':_0x4d3c3b(0x16c)),{'data':_0xdfd556,'nextSeed':_0x385e81};});}function _0x1ab089(){var _0x5b10b5=_0x3b9fea;try{var _0xa9ca9b=window[_0x5b10b5(0x34e)]['getItem'](_0x5b10b5(0x385));if(_0xa9ca9b&&/^[0-9a-f]{32}$/i[_0x5b10b5(0x2c1)](_0xa9ca9b))return _0xa9ca9b;}catch(_0x135166){}var _0x35edf3='';for(var _0x2be4e5=0x0;_0x2be4e5<0x20;_0x2be4e5++)_0x35edf3+=_0x5b10b5(0x2a4)[_0x5b10b5(0x13f)](Math['floor'](Math[_0x5b10b5(0x2fd)]()*0x10));try{window[_0x5b10b5(0x34e)][_0x5b10b5(0x354)](_0x5b10b5(0x385),_0x35edf3);}catch(_0x4829fc){}return _0x35edf3;}function _0x32e839(_0x4839f0){var _0x56cef8=_0x3b9fea;if(!_0x1da0d9())return Promise[_0x56cef8(0x364)](null);var _0xc177cb=_0x1ab089(),_0x5d45af={'token':_0x425e28[_0x56cef8(0x24b)],'url':_0x4839f0[_0x56cef8(0x1c8)]||_0x425e28[_0x56cef8(0x1f1)]+'/','type':'3','count':'2','module':'2','up':_0xc177cb,'kp':String(_0x4839f0['kp']||''),'cat':_0x4839f0[_0x56cef8(0x2df)]||'movie','movie':'0','trailer':_0x4839f0[_0x56cef8(0x31a)]?'1':'0','lang':navigator[_0x56cef8(0x278)]||_0x56cef8(0x2c9),'bg':'0','mt':String(_0x4839f0['mt']||'')},_0x2a7b7a=Object[_0x56cef8(0x338)](_0x5d45af)['map'](function(_0x405713){return encodeURIComponent(_0x405713)+'='+encodeURIComponent(_0x5d45af[_0x405713]);})[_0x56cef8(0x1ea)]('&');return _0x529c49(_0x56cef8(0x177),Object[_0x56cef8(0x338)](_0x5d45af)[_0x56cef8(0x1ea)](','),_0x56cef8(0x2bb),_0x5d45af['mt'][_0x56cef8(0x1f7)](0x0,0xc),_0x56cef8(0x34d),_0xc177cb[_0x56cef8(0x1f7)](0x0,0xc)),_0x51dee3(_0x56cef8(0x2c0),_0x56cef8(0x2f1),{'headers':_0x3828b0({'content-type':_0x56cef8(0x19f),'Origin':_0x425e28[_0x56cef8(0x1f1)],'Referer':_0x4839f0[_0x56cef8(0x1c8)]||_0x425e28[_0x56cef8(0x1f1)]+'/'}),'body':_0x2a7b7a})['then'](function(_0x44ef69){var _0x5cfd7d=_0x56cef8,_0x3d2ee4;try{_0x3d2ee4=JSON[_0x5cfd7d(0x206)](_0x44ef69['body']);}catch(_0x1f93d7){return _0x529c49('lists.php\x20body\x20not\x20JSON,\x20first\x20300:',_0x44ef69[_0x5cfd7d(0x1ee)]['slice'](0x0,0x12c)),null;}var _0x3e5333=_0x3d2ee4&&_0x3d2ee4[_0x5cfd7d(0x2ba)]||[];return _0x529c49(_0x5cfd7d(0x351),_0x3d2ee4&&_0x3d2ee4[_0x5cfd7d(0x301)],_0x5cfd7d(0x2c3),_0x3e5333[_0x5cfd7d(0x21a)]),_0x3e5333['forEach'](function(_0x5ba631,_0x301553){var _0x1b7a3a=_0x5cfd7d;[_0x1b7a3a(0x27a),_0x1b7a3a(0x137)][_0x1b7a3a(0x32c)](function(_0x56ff9f){var _0xff8be6=_0x1b7a3a;if(!_0x5ba631[_0x56ff9f])return;setTimeout(function(){var _0x1c2b6b=a0_0x2a23;_0x51dee3(_0x1c2b6b(0x1e9),_0x5ba631[_0x56ff9f],{'headers':_0x3828b0({'Origin':_0x425e28[_0x1c2b6b(0x1f1)],'Referer':_0x4839f0['embedUrl']||_0x425e28[_0x1c2b6b(0x1f1)]+'/'})})[_0x1c2b6b(0x19e)](function(){var _0x4b2ac7=_0x1c2b6b;_0x529c49(_0x4b2ac7(0x172)+_0x5ba631['id']+'\x20'+_0x56ff9f+_0x4b2ac7(0x328));},function(_0x22099f){var _0x567a86=_0x1c2b6b;_0x529c49(_0x567a86(0x172)+_0x5ba631['id']+'\x20'+_0x56ff9f+_0x567a86(0x2d1),_0x22099f&&_0x22099f[_0x567a86(0x2d6)]);});},_0x301553*0xc8+(_0x56ff9f===_0xff8be6(0x137)?0x1f4:0x0));});}),_0x3d2ee4;},function(_0x590064){return _0x529c49('lists.php\x20fail:',_0x590064&&_0x590064['message']),null;});}var _0x128e31=null;function _0x1da016(_0x165369){if(_0x128e31){try{_0x128e31['close']();}catch(_0x519637){}_0x128e31=null;}var _0x42d3dd=![],_0x5da0b4=null,_0x452856=0x1adb0,_0x962de5=0x0;function _0x3567a9(){var _0x3a4c6a=a0_0x2a23;if(_0x42d3dd)return;_0x962de5++;var _0x4116a1=_0x962de5;try{_0xbd84c7({'metaSeed':_0x165369['embed'][_0x3a4c6a(0x35f)],'fileActiveId':_0x165369['fileActiveId'],'hP':_0x165369['hP'],'refererUrl':_0x165369[_0x3a4c6a(0x216)]})[_0x3a4c6a(0x19e)](function(_0x24c97c){var _0x5ede76=_0x3a4c6a;if(_0x42d3dd)return;if(_0x24c97c[_0x5ede76(0x2b0)])_0x165369[_0x5ede76(0x157)][_0x5ede76(0x35f)]=_0x24c97c[_0x5ede76(0x2b0)];var _0x5ae6fa=_0x24c97c['data']&&_0x24c97c[_0x5ede76(0x135)]['hlsSource']&&_0x24c97c['data']['hlsSource'][_0x5ede76(0x21a)]||0x0,_0xbcc03d='';try{var _0x32bb0b=_0x24c97c['data']['hlsSource'][0x0][_0x5ede76(0x226)]||{},_0xa731f0=_0x32bb0b[_0x5ede76(0x20d)]?_0x5ede76(0x20d):_0x32bb0b[_0x5ede76(0x1f5)]?_0x5ede76(0x1f5):_0x32bb0b[_0x5ede76(0x307)]?'480':Object[_0x5ede76(0x338)](_0x32bb0b)[0x0];_0xbcc03d=String(_0x32bb0b[_0xa731f0]||'')[_0x5ede76(0x265)](_0x5ede76(0x381))[0x0];}catch(_0x675f04){}_0x529c49(_0x5ede76(0x23d)+_0x4116a1+'\x20ok',_0x5ede76(0x1af),_0x5ae6fa,_0x5ede76(0x2fa),_0x24c97c[_0x5ede76(0x2b0)]?_0x24c97c[_0x5ede76(0x2b0)][_0x5ede76(0x21a)]+'\x20chars':_0x5ede76(0x16c),_0x5ede76(0x303),_0xbcc03d['length']>0x50?_0xbcc03d['slice'](0x0,0x3c)+_0x5ede76(0x208)+_0xbcc03d[_0x5ede76(0x1f7)](-0xf):_0xbcc03d);},function(_0x586766){var _0x1be99d=_0x3a4c6a;if(_0x42d3dd)return;_0x529c49(_0x1be99d(0x23d)+_0x4116a1+'\x20fail:',_0x586766&&_0x586766[_0x1be99d(0x2d6)]);});}catch(_0x1b3269){_0x529c49(_0x3a4c6a(0x23d)+_0x4116a1+_0x3a4c6a(0x27d),_0x1b3269&&_0x1b3269[_0x3a4c6a(0x2d6)]);}}_0x5da0b4=setInterval(_0x3567a9,_0x452856);var _0xbd235e={'close':function(){_0x42d3dd=!![];_0x5da0b4&&(clearInterval(_0x5da0b4),_0x5da0b4=null);if(_0x128e31===_0xbd235e)_0x128e31=null;}};return _0x128e31=_0xbd235e,_0xbd235e;}var _0x5177ef=null;function _0x1cb92a(_0x24da9c){var _0x34a5c7=_0x3b9fea;if(_0x5177ef){try{_0x5177ef[_0x34a5c7(0x297)]();}catch(_0x34a3bd){}_0x5177ef=null;}var _0x943b4b=![],_0x86e662,_0x5385a6=null,_0x220f34=null,_0x10e9b5=0x0,_0x563a4a=0x0,_0x1f65f3=_0x24da9c['edgeHashHolder'],_0xb68695,_0xd854e7=0x0;function _0x3714fa(_0x487316,_0x1f343e){var _0xdb6237=_0x34a5c7,_0x36c2d8=typeof _0x24da9c[_0xdb6237(0x28f)]==='function'?_0x24da9c[_0xdb6237(0x28f)]():_0x24da9c[_0xdb6237(0x2a0)],_0x4c1c92={'type':_0x487316,'current_time':_0x24da9c['getCurrentTime']()|0x0,'resolution':_0x36c2d8,'track_id':'1','speed':0x1,'subtitle':-0x1,'ts':Date[_0xdb6237(0x1d0)]()};if(_0x1f343e){for(var _0x5b2ee7 in _0x1f343e)_0x4c1c92[_0x5b2ee7]=_0x1f343e[_0x5b2ee7];}return JSON[_0xdb6237(0x262)](_0x4c1c92);}function _0x53affe(_0x2e69ce,_0x1dec45){var _0x251d5c=_0x34a5c7;if(!_0x86e662||_0x86e662[_0x251d5c(0x38f)]!==0x1)return;try{_0x86e662['send'](_0x3714fa(_0x2e69ce,_0x1dec45)),_0x2e69ce!=='playing'?_0x529c49('WS\x20→',_0x2e69ce,_0x251d5c(0x2c8)+(_0x24da9c[_0x251d5c(0x2d5)]()|0x0)):_0x5d06a2(_0x251d5c(0x2dd)+(_0x24da9c[_0x251d5c(0x2d5)]()|0x0),'seg:'+(window[_0x251d5c(0x343)]|0x0),_0x251d5c(0x175)+(_0x5719f3()|0x0));}catch(_0x5bb1dd){}}function _0x2bd2ec(){var _0x10059f=_0x34a5c7;try{_0x86e662=new WebSocket(_0x24da9c[_0x10059f(0x313)]+_0x10059f(0x1e1)+encodeURIComponent(_0x24da9c['pnk'])+'&v=2.1&t='+Date[_0x10059f(0x1d0)]());}catch(_0x52ff26){_0x529c49(_0x10059f(0x1ad),_0x52ff26&&_0x52ff26[_0x10059f(0x2d6)]);return;}_0x10e9b5=0x0,_0x86e662['onmessage']=function(_0x5c016e){var _0x3a702b=_0x10059f;_0x10e9b5++;var _0x4d112e=String(_0x5c016e[_0x3a702b(0x135)]||'')[_0x3a702b(0x1f7)](0x0,0x78);try{var _0x4dd624=JSON['parse'](_0x5c016e[_0x3a702b(0x135)]);_0x529c49(_0x3a702b(0x17e)+_0x10e9b5,'type:',_0x4dd624&&_0x4dd624[_0x3a702b(0x14e)],_0x4dd624&&_0x4dd624[_0x3a702b(0x171)]?_0x3a702b(0x25c)+String(_0x4dd624[_0x3a702b(0x171)])[_0x3a702b(0x1f7)](0x0,0xc):'',_0x4dd624&&typeof _0x4dd624[_0x3a702b(0x30c)]===_0x3a702b(0x286)?_0x3a702b(0x1fd)+_0x4dd624[_0x3a702b(0x30c)]:'',_0x3a702b(0x34f),_0x4d112e);if(_0x4dd624&&_0x4dd624['type']===_0x3a702b(0x127)&&_0x4dd624[_0x3a702b(0x171)]){var _0xdf62be=_0x1f65f3[_0x3a702b(0x368)];_0x1f65f3[_0x3a702b(0x368)]=_0x4dd624[_0x3a702b(0x171)],_0xdf62be!==_0x4dd624[_0x3a702b(0x171)]&&typeof _0x24da9c[_0x3a702b(0x2b9)]===_0x3a702b(0x334)&&_0x24da9c[_0x3a702b(0x2b9)](_0x4dd624[_0x3a702b(0x171)]);}}catch(_0x1629c9){_0x529c49(_0x3a702b(0x17e)+_0x10e9b5,_0x3a702b(0x350),_0x4d112e);}},_0x86e662[_0x10059f(0x25b)]=function(){var _0xfefd51=_0x10059f;_0x529c49(_0xfefd51(0x36a),_0x24da9c[_0xfefd51(0x313)],_0x563a4a?_0xfefd51(0x161)+_0x563a4a:''),_0x53affe(_0xfefd51(0x141),{'current_time':_0x24da9c['getCurrentTime']()|0x0}),_0x53affe(_0xfefd51(0x1e4),{'current_time':_0x24da9c[_0xfefd51(0x2d5)]()|0x0}),_0x53affe(_0xfefd51(0x16a),{'current_time':_0x24da9c[_0xfefd51(0x2d5)]()|0x0});},_0x86e662[_0x10059f(0x1fb)]=function(_0x5d0d78){var _0x12ff7a=_0x10059f;_0x529c49(_0x12ff7a(0x202),_0x5d0d78&&_0x5d0d78[_0x12ff7a(0x189)],_0x12ff7a(0x264),_0x5d0d78&&_0x5d0d78[_0x12ff7a(0x14b)],_0x12ff7a(0x20f),_0x10e9b5,_0x943b4b?_0x12ff7a(0x17d):_0x12ff7a(0x2e0)),_0x5385a6&&(clearInterval(_0x5385a6),_0x5385a6=null),_0x220f34&&(clearInterval(_0x220f34),_0x220f34=null);},_0x86e662[_0x10059f(0x21f)]=function(_0x1bda61){var _0x369347=_0x10059f;_0x529c49(_0x369347(0x279),_0x1bda61&&_0x1bda61[_0x369347(0x2d6)]);};}return _0x2bd2ec(),_0x5385a6=setInterval(function(){_0x53affe('playing');},0x7530),_0x220f34=null,_0xb68695={'send':_0x53affe,'paused':function(){var _0x8a1086=_0x34a5c7;_0x53affe(_0x8a1086(0x30a));},'resumed':function(){var _0x4a3493=_0x34a5c7;_0x53affe(_0x4a3493(0x2d0));},'seeked':function(){var _0x2505ce=_0x34a5c7;_0x53affe(_0x2505ce(0x330));},'playbackStart':function(_0x8003f5){var _0x33ba36=_0x34a5c7;if(_0x8003f5)_0x24da9c[_0x33ba36(0x2a0)]=String(_0x8003f5);_0x53affe('playback_start');},'setResolution':function(_0x4900d6){var _0x55c296=_0x34a5c7;if(_0x4900d6)_0x24da9c[_0x55c296(0x2a0)]=String(_0x4900d6);},'forceReconnect':function(_0x1e9d47){var _0x158643=_0x34a5c7;if(_0x943b4b)return![];var _0x133b98=Date[_0x158643(0x1d0)]();if(_0x133b98-_0xd854e7<0x7530)return![];_0xd854e7=_0x133b98,_0x529c49(_0x158643(0x155),_0x1e9d47||_0x158643(0x389));try{_0x86e662&&_0x86e662[_0x158643(0x297)]();}catch(_0x2fac8c){}return!![];},'close':function(){var _0x1b1ba9=_0x34a5c7;if(_0x943b4b)return;_0x943b4b=!![];_0x5385a6&&(clearInterval(_0x5385a6),_0x5385a6=null);_0x220f34&&(clearInterval(_0x220f34),_0x220f34=null);try{_0x53affe(_0x1b1ba9(0x2c6));}catch(_0x1efb8a){}try{_0x86e662&&_0x86e662[_0x1b1ba9(0x297)]();}catch(_0x494023){}if(_0x5177ef===_0xb68695)_0x5177ef=null;if(window[_0x1b1ba9(0x36c)]===_0xb68695)window[_0x1b1ba9(0x36c)]=null;try{window[_0x1b1ba9(0x2c5)]&&window[_0x1b1ba9(0x2c5)]();}catch(_0x555875){}}},_0x5177ef=_0xb68695,window[_0x34a5c7(0x36c)]=_0xb68695,_0xb68695;}var _0x2a2610=null;function _0x474641(_0x5e28b5){var _0x18cc01=_0x3b9fea;if(_0x2a2610){try{_0x2a2610[_0x18cc01(0x297)]();}catch(_0x1194aa){}_0x2a2610=null;}if(!_0x1da0d9())return{'close':function(){}};var _0xf1f837=![],_0xd8e75f=null,_0x22bd3c=Date[_0x18cc01(0x1d0)](),_0x3466ee=_0x22bd3c,_0x112314=0x0,_0x255bb3=0x0,_0x4c7c26=0x0,_0x5b0c48=0x0,_0x49670f=0x0,_0x5474bf=0x0,_0x4f4b53=0x0,_0xf1edc1=![],_0x34c200=0x0,_0x13d0b9=![],_0x230c83=![],_0x379d89=0x0,_0x3dc2cd=[];function _0x401827(){var _0x485245=_0x18cc01,_0x30cc32=navigator&&(navigator[_0x485245(0x388)]||navigator[_0x485245(0x33a)]||navigator[_0x485245(0x20a)])||{};return{'connectionType':_0x30cc32[_0x485245(0x31d)]||'4g','downlink':typeof _0x30cc32['downlink']===_0x485245(0x286)?_0x30cc32[_0x485245(0x35c)]:0xa,'rtt':typeof _0x30cc32[_0x485245(0x378)]==='number'?_0x30cc32['rtt']:0x0,'saveData':!!_0x30cc32[_0x485245(0x2dc)]};}function _0x211e5e(){var _0x4e51aa=_0x18cc01;try{if(typeof _0x5e28b5[_0x4e51aa(0x30d)]===_0x4e51aa(0x334))return _0x5e28b5[_0x4e51aa(0x30d)]();}catch(_0x29d145){}return null;}function _0x5dcea2(){var _0x599475=_0x18cc01;try{if(typeof _0x5e28b5[_0x599475(0x2b7)]==='function')return _0x5e28b5[_0x599475(0x2b7)]();}catch(_0x9f7e3c){}return null;}function _0x2532d1(_0xef5b1d){var _0x28e93e=_0x18cc01;if(!_0xef5b1d||!_0xef5b1d['buffered']||!_0xef5b1d[_0x28e93e(0x17a)][_0x28e93e(0x21a)])return 0x0;var _0x3500f0=_0xef5b1d[_0x28e93e(0x28d)]||0x0;for(var _0x1cb0d0=_0xef5b1d[_0x28e93e(0x17a)]['length']-0x1;_0x1cb0d0>=0x0;_0x1cb0d0--){var _0x2a8555=_0xef5b1d['buffered'][_0x28e93e(0x281)](_0x1cb0d0),_0x5b2fe6=_0xef5b1d['buffered'][_0x28e93e(0x1db)](_0x1cb0d0);if(_0x3500f0>=_0x2a8555&&_0x3500f0<=_0x5b2fe6)return Math[_0x28e93e(0x37f)](0x0,_0x5b2fe6-_0x3500f0);}return 0x0;}function _0x220d12(_0x522e64){var _0x1303f3=_0x18cc01;try{if(typeof _0x5e28b5[_0x1303f3(0x125)]===_0x1303f3(0x334)){var _0x34d792=_0x5e28b5[_0x1303f3(0x125)]();if(_0x34d792)return _0x34d792;}}catch(_0x20a849){}return _0x522e64&&_0x522e64[_0x1303f3(0x26e)]||0x0;}function _0x862775(){var _0x1414d3=_0x18cc01;try{if(typeof _0x5e28b5[_0x1414d3(0x21b)]===_0x1414d3(0x334))return _0x5e28b5[_0x1414d3(0x21b)]()||'';}catch(_0xb1101d){}return'';}function _0x1d2558(_0x130e20){var _0x1c0c5a=_0x18cc01;return{'url':null,'manifestUrl':_0x5e28b5['manifestUrl']||'','currentTime':_0x130e20&&_0x130e20[_0x1c0c5a(0x28d)]||0x0,'duration':_0x130e20&&_0x130e20[_0x1c0c5a(0x151)]&&isFinite(_0x130e20[_0x1c0c5a(0x151)])?_0x130e20[_0x1c0c5a(0x151)]:_0x5e28b5['duration']||0x0,'bufferLength':_0x2532d1(_0x130e20),'paused':!!(_0x130e20&&_0x130e20['paused']),'audioTrack':_0x862775(),'quality':_0x220d12(_0x130e20),'subtitle':null};}function _0x231679(_0x778694,_0x2199c8,_0x32755e,_0x4b10e8){var _0x518f0a=_0x18cc01,_0x366a59=_0x1d2558(_0x778694),_0x2eef23=0x0,_0x4b22d1=0x0;try{if(_0x2199c8){if(typeof _0x2199c8[_0x518f0a(0x2d3)]===_0x518f0a(0x286))_0x2eef23=_0x2199c8[_0x518f0a(0x2d3)];_0x2199c8[_0x518f0a(0x1ec)]&&typeof _0x2199c8[_0x518f0a(0x16b)]===_0x518f0a(0x286)&&_0x2199c8[_0x518f0a(0x16b)]>=0x0&&_0x2199c8[_0x518f0a(0x1ec)][_0x2199c8[_0x518f0a(0x16b)]]&&(_0x4b22d1=_0x2199c8[_0x518f0a(0x1ec)][_0x2199c8[_0x518f0a(0x16b)]]['bitrate']||0x0);}}catch(_0x4c0e08){}var _0x165232=0x0,_0x44c521=0x0;try{if(_0x778694&&typeof _0x778694[_0x518f0a(0x33f)]==='function'){var _0x4c6793=_0x778694[_0x518f0a(0x33f)]();_0x165232=_0x4c6793[_0x518f0a(0x1b9)]||0x0;var _0x2e63d0=_0x4c6793[_0x518f0a(0x167)]||0x0,_0xa959aa=_0x778694[_0x518f0a(0x28d)]||0x0;if(_0x2e63d0>0x0&&_0xa959aa>0x1)_0x44c521=Math['round'](_0x2e63d0/_0xa959aa);}else _0x778694&&typeof _0x778694[_0x518f0a(0x325)]===_0x518f0a(0x286)&&(_0x165232=_0x778694['webkitDroppedFrameCount']);}catch(_0x52c6e6){}if(!_0x44c521)_0x44c521=0x18;_0x4c7c26=_0x165232;var _0xf86192=Math[_0x518f0a(0x37f)](0x0,_0x165232-_0x5b0c48);_0x5b0c48=_0x165232;var _0x20e140=_0x778694&&_0x778694[_0x518f0a(0x28d)]||0x0,_0x5afa60=Math[_0x518f0a(0x37f)](0x0,_0x20e140-_0x49670f);_0x49670f=_0x20e140;var _0x3a3ff0=Math[_0x518f0a(0x37f)](0x0,_0x5474bf-_0x4f4b53);return _0x4f4b53=_0x5474bf,_0x366a59[_0x518f0a(0x366)]=_0x518f0a(0x292),_0x366a59[_0x518f0a(0x2d3)]=_0x2eef23,_0x366a59[_0x518f0a(0x1bf)]=_0x165232,_0x366a59['droppedFramesDelta']=_0xf86192,_0x366a59[_0x518f0a(0x16d)]=_0x5afa60,_0x366a59['isBuffering']=_0xf1edc1,_0x366a59['isSeeking']=_0x13d0b9,_0x366a59[_0x518f0a(0x25e)]=_0x778694&&_0x778694[_0x518f0a(0x25e)]||0x1,_0x366a59[_0x518f0a(0x322)]=_0x4b22d1,_0x366a59[_0x518f0a(0x230)]=_0x44c521,_0x366a59[_0x518f0a(0x20c)]=_0x778694&&_0x778694[_0x518f0a(0x20c)]||0x0,_0x366a59[_0x518f0a(0x26e)]=_0x778694&&_0x778694[_0x518f0a(0x26e)]||0x0,_0x366a59[_0x518f0a(0x282)]=!!(_0x778694&&_0x778694[_0x518f0a(0x20c)]&&window[_0x518f0a(0x38a)]&&window[_0x518f0a(0x38a)][_0x518f0a(0x367)]&&_0x778694['videoWidth']<window[_0x518f0a(0x38a)][_0x518f0a(0x367)]),_0x366a59[_0x518f0a(0x15d)]=_0x112314,_0x366a59['rebufferTotalMsSession']=_0x255bb3,_0x366a59[_0x518f0a(0x1d2)]=_0x5474bf,_0x366a59[_0x518f0a(0x2f2)]=_0x3a3ff0,_0x366a59['at']=_0x32755e,_0x366a59['since']=_0x4b10e8,_0x366a59;}function _0x2b79a0(_0x4cdd58){var _0x443480=_0x18cc01;_0x3dc2cd[_0x443480(0x139)](_0x4cdd58);if(_0x3dc2cd[_0x443480(0x21a)]>=0x4)_0x1e6cd6('queue-full');}function _0x3f8a2c(){var _0x44bf2c=_0x18cc01;_0x230c83=!![],_0x379d89=Date[_0x44bf2c(0x1d0)]();var _0x169bc9=_0x211e5e(),_0xd16a34=_0x1d2558(_0x169bc9);_0xd16a34[_0x44bf2c(0x30a)]=!![],_0xd16a34[_0x44bf2c(0x366)]=_0x44bf2c(0x260),_0xd16a34['at']=_0x379d89,_0xd16a34[_0x44bf2c(0x2fc)]=_0x379d89-_0x22bd3c,_0x2b79a0(_0xd16a34);}function _0xd5891e(){var _0x15c895=_0x18cc01,_0x590e92=Date[_0x15c895(0x1d0)](),_0xe58fa7=_0x211e5e(),_0x2205b5=_0x1d2558(_0xe58fa7);_0x2205b5[_0x15c895(0x30a)]=![],_0x2205b5['event_type']='play';if(_0x230c83)_0x2205b5[_0x15c895(0x31c)]=_0x590e92-_0x379d89;_0x2205b5['at']=_0x590e92,_0x2205b5[_0x15c895(0x2fc)]=_0x590e92-_0x22bd3c,_0x230c83=![],_0x379d89=0x0,_0x2b79a0(_0x2205b5);}function _0x2e7d11(){var _0x10c2f1=_0x18cc01;_0x13d0b9=!![];var _0x13d4b0=Date[_0x10c2f1(0x1d0)](),_0x4b879c=_0x211e5e(),_0x7968df=_0x1d2558(_0x4b879c);_0x7968df[_0x10c2f1(0x366)]=_0x10c2f1(0x184),_0x7968df['at']=_0x13d4b0,_0x7968df[_0x10c2f1(0x2fc)]=_0x13d4b0-_0x22bd3c,_0x2b79a0(_0x7968df);}function _0x409140(){var _0x34fb65=_0x18cc01;_0x13d0b9=![];var _0x584143=Date['now'](),_0x13c536=_0x211e5e(),_0x183511=_0x1d2558(_0x13c536);_0x183511['event_type']=_0x34fb65(0x330),_0x183511['at']=_0x584143,_0x183511[_0x34fb65(0x2fc)]=_0x584143-_0x22bd3c,_0x2b79a0(_0x183511);}function _0x5b4e2f(){var _0x1cb7bf=_0x18cc01;if(_0xf1edc1)return;_0xf1edc1=!![],_0x34c200=Date[_0x1cb7bf(0x1d0)]();var _0xfbbff2=_0x211e5e(),_0x30412f=_0x1d2558(_0xfbbff2);_0x30412f[_0x1cb7bf(0x366)]=_0x1cb7bf(0x153),_0x30412f[_0x1cb7bf(0x2d3)]=_0x5dcea2()&&_0x5dcea2()[_0x1cb7bf(0x2d3)]||0x0,_0x30412f[_0x1cb7bf(0x12d)]=_0x30412f[_0x1cb7bf(0x391)],_0x30412f['at']=_0x34c200,_0x30412f[_0x1cb7bf(0x2fc)]=_0x34c200-_0x22bd3c,_0x2b79a0(_0x30412f);}function _0x134127(){var _0x4f28b0=_0x18cc01;if(!_0xf1edc1)return;var _0x3ee386=Date[_0x4f28b0(0x1d0)](),_0x235138=_0x3ee386-_0x34c200;_0xf1edc1=![],_0x112314+=0x1,_0x255bb3+=_0x235138;var _0x2b6a8d=_0x211e5e(),_0x560f28=_0x1d2558(_0x2b6a8d);_0x560f28[_0x4f28b0(0x366)]=_0x4f28b0(0x15a),_0x560f28[_0x4f28b0(0x2a2)]=_0x235138,_0x560f28[_0x4f28b0(0x2d3)]=_0x5dcea2()&&_0x5dcea2()[_0x4f28b0(0x2d3)]||0x0,_0x560f28['at']=_0x3ee386,_0x560f28[_0x4f28b0(0x2fc)]=_0x3ee386-_0x22bd3c,_0x2b79a0(_0x560f28);}function _0x1e6cd6(_0x4b8614){var _0x4bcc70=_0x18cc01;if(_0xf1f837)return;var _0x5a8278=Date[_0x4bcc70(0x1d0)](),_0x108159=_0x5a8278-_0x22bd3c,_0x55b67d=_0x211e5e(),_0x12eae7=_0x5dcea2(),_0x4be040=_0x231679(_0x55b67d,_0x12eae7,_0x5a8278,_0x108159);_0x3466ee=_0x5a8278;var _0x5ecf67=_0x3dc2cd[_0x4bcc70(0x1f7)]();_0x5ecf67[_0x4bcc70(0x139)](_0x4be040),_0x3dc2cd=[];var _0x5548b6=(_0x425e28[_0x4bcc70(0x1f1)]||'')+'/';try{_0x5548b6=encodeURIComponent(_0x5548b6);}catch(_0x113e30){}var _0x44edc5=_0x401827(),_0x2ed7e5={'token':_0x425e28[_0x4bcc70(0x24b)],'domain':_0x5548b6,'isTrailer':![],'dropped':0x0,'playerInitAt':_0x22bd3c,'env':{'connectionType':_0x44edc5[_0x4bcc70(0x335)],'downlink':_0x44edc5[_0x4bcc70(0x35c)],'pixelRatio':window[_0x4bcc70(0x220)]||0x1,'screenW':window[_0x4bcc70(0x38a)]&&window['screen'][_0x4bcc70(0x367)]||0x500,'screenH':window[_0x4bcc70(0x38a)]&&window['screen'][_0x4bcc70(0x35d)]||0x2d0},'events':_0x5ecf67},_0x16a545=_0x4bcc70(0x1d8)+encodeURIComponent(_0x425e28['token'])+_0x4bcc70(0x169)+encodeURIComponent(JSON[_0x4bcc70(0x262)](_0x2ed7e5));try{_0x51dee3(_0x4bcc70(0x2c0),_0x425e28[_0x4bcc70(0x1f1)]+_0x4bcc70(0x24a),{'headers':_0x3828b0({'content-type':_0x4bcc70(0x2ce),'Referer':_0x5e28b5[_0x4bcc70(0x216)]||_0x425e28[_0x4bcc70(0x1f1)]+'/','X-Requested-With':_0x4bcc70(0x13e)}),'body':_0x16a545})[_0x4bcc70(0x19e)](function(_0x539465){var _0x5cd5f4=_0x4bcc70,_0x54c80a=(_0x539465[_0x5cd5f4(0x1ee)]||'')[_0x5cd5f4(0x1f7)](0x0,0x50),_0x538b70=_0x54c80a['indexOf'](_0x5cd5f4(0x308))!==-0x1;_0x529c49(_0x5cd5f4(0x272)+(_0x538b70?'ok':_0x5cd5f4(0x219))+_0x5cd5f4(0x129)+_0x5ecf67['length']+'\x20since:'+(_0x108159/0x3e8|0x0)+'s\x20reason:'+_0x4b8614+'\x20body:',_0x54c80a);},function(_0x1a579d){var _0x3e7a6d=_0x4bcc70;_0x529c49(_0x3e7a6d(0x29d),_0x1a579d&&_0x1a579d[_0x3e7a6d(0x2d6)]);});}catch(_0x30dae4){_0x529c49(_0x4bcc70(0x314),_0x30dae4&&_0x30dae4['message']);}}function _0x3118cc(_0x29d6b5){var _0x9ac92f=_0x18cc01;if(_0xf1f837)return;var _0x1d426c=Date[_0x9ac92f(0x1d0)]();_0x29d6b5['at']=_0x29d6b5['at']||_0x1d426c,_0x29d6b5[_0x9ac92f(0x2fc)]=_0x29d6b5[_0x9ac92f(0x2fc)]||_0x1d426c-_0x22bd3c;var _0x2063c7=(_0x425e28['domain']||'')+'/';try{_0x2063c7=encodeURIComponent(_0x2063c7);}catch(_0x3fd8e4){}var _0x20de08=_0x401827(),_0x18d680={'token':_0x425e28[_0x9ac92f(0x24b)],'domain':_0x2063c7,'dropped':0x0,'playerInitAt':_0x22bd3c,'env':{'connectionType':_0x20de08[_0x9ac92f(0x335)],'downlink':_0x20de08[_0x9ac92f(0x35c)],'pixelRatio':window[_0x9ac92f(0x220)]||0x1,'screenW':window[_0x9ac92f(0x38a)]&&window['screen'][_0x9ac92f(0x367)]||0x500,'screenH':window[_0x9ac92f(0x38a)]&&window[_0x9ac92f(0x38a)][_0x9ac92f(0x35d)]||0x2d0},'errors':[_0x29d6b5]},_0x111885=_0x9ac92f(0x1d8)+encodeURIComponent(_0x425e28[_0x9ac92f(0x24b)])+_0x9ac92f(0x169)+encodeURIComponent(JSON['stringify'](_0x18d680));try{_0x51dee3(_0x9ac92f(0x2c0),_0x425e28[_0x9ac92f(0x1f1)]+_0x9ac92f(0x26b),{'headers':_0x3828b0({'content-type':_0x9ac92f(0x2ce),'Referer':_0x5e28b5[_0x9ac92f(0x216)]||_0x425e28['domain']+'/','X-Requested-With':'XMLHttpRequest'}),'body':_0x111885})[_0x9ac92f(0x19e)](function(_0x1580d7){var _0x3dc303=_0x9ac92f,_0x4343e7=(_0x1580d7[_0x3dc303(0x1ee)]||'')[_0x3dc303(0x1f7)](0x0,0x50);_0x529c49(_0x3dc303(0x1ce)+(_0x4343e7['indexOf'](_0x3dc303(0x308))!==-0x1?'ok':_0x3dc303(0x219))+_0x3dc303(0x2f8),_0x29d6b5[_0x3dc303(0x14e)],_0x3dc303(0x299),_0x29d6b5[_0x3dc303(0x210)]);},function(_0x1a4ed8){var _0x2d284a=_0x9ac92f;_0x529c49(_0x2d284a(0x2bc),_0x1a4ed8&&_0x1a4ed8[_0x2d284a(0x2d6)]);});}catch(_0x536905){_0x529c49(_0x9ac92f(0x2e4),_0x536905&&_0x536905['message']);}}setTimeout(function(){var _0x4e915d=_0x18cc01;if(_0xf1f837)return;_0x1e6cd6(_0x4e915d(0x1c4)),_0xd8e75f=setInterval(function(){var _0x4b7d8b=_0x4e915d;_0x1e6cd6(_0x4b7d8b(0x383));},0x2710);},0x2710);var _0x314e18={'recordPause':_0x3f8a2c,'recordPlay':_0xd5891e,'recordSeekStart':_0x2e7d11,'recordSeekEnd':_0x409140,'recordRebufferStart':_0x5b4e2f,'recordRebufferEnd':_0x134127,'recordBytesLoaded':function(_0x418397){_0x5474bf+=_0x418397||0x0;},'sendError':_0x3118cc,'close':function(){_0xf1f837=!![];_0xd8e75f&&(clearInterval(_0xd8e75f),_0xd8e75f=null);if(_0x2a2610===_0x314e18)_0x2a2610=null;}};return _0x2a2610=_0x314e18,_0x314e18;}function _0x2aea50(){var _0x50c244=_0x3b9fea,_0x1e2b95=_0x5719f3();if(_0x1e2b95>0x0)return _0x1e2b95;var _0x5abd1e=window[_0x50c244(0x343)]|0x0;if(_0x5abd1e>0x0)return _0x5abd1e*0x6;return 0x0;}function _0x5719f3(){var _0x8744bd=_0x3b9fea,_0x54bd18=0x0;try{var _0x54c98c=Lampa['Player'][_0x8744bd(0x212)]&&Lampa['Player']['video']();_0x54c98c&&typeof _0x54c98c[_0x8744bd(0x28d)]==='number'&&_0x54c98c['currentTime']>_0x54bd18&&(_0x54bd18=_0x54c98c['currentTime']);}catch(_0x4a5089){}try{var _0x40dfa9=document[_0x8744bd(0x1a8)]('video');for(var _0x5925a6=0x0;_0x5925a6<_0x40dfa9[_0x8744bd(0x21a)];_0x5925a6++){var _0x330800=_0x40dfa9[_0x5925a6]['currentTime'];if(typeof _0x330800===_0x8744bd(0x286)&&_0x330800>_0x54bd18)_0x54bd18=_0x330800;}}catch(_0xe51263){}return _0x54bd18;}function _0x4b4332(){var _0x210fda=_0x3b9fea;try{var _0x407b75=Lampa[_0x210fda(0x22f)][_0x210fda(0x212)]&&Lampa['Player'][_0x210fda(0x212)]();if(_0x407b75&&_0x407b75[_0x210fda(0x26e)])return String(_0x407b75[_0x210fda(0x26e)]);}catch(_0x4c9f71){}try{var _0x18f1f4=document[_0x210fda(0x1a8)](_0x210fda(0x212));for(var _0x405288=0x0;_0x405288<_0x18f1f4['length'];_0x405288++){if(_0x18f1f4[_0x405288][_0x210fda(0x26e)])return String(_0x18f1f4[_0x405288][_0x210fda(0x26e)]);}}catch(_0x12205e){}return _0x210fda(0x307);}function _0x38af34(_0x5ccb3f){var _0x473a85=_0x3b9fea;if(!_0x5ccb3f)return![];var _0x14cf62=String(_0x5ccb3f),_0x12881b=[_0x473a85(0x30f),_0x473a85(0x32f),'stream-balancer-allo',_0x473a85(0x312)];for(var _0x10058d=0x0;_0x10058d<_0x12881b[_0x473a85(0x21a)];_0x10058d++){if(_0x14cf62[_0x473a85(0x245)](_0x12881b[_0x10058d])!==-0x1)return!![];}try{var _0x2ffbff=window[_0x473a85(0x353)]||[];for(var _0x5077d5=0x0;_0x5077d5<_0x2ffbff[_0x473a85(0x21a)];_0x5077d5++){if(_0x2ffbff[_0x5077d5]&&_0x14cf62[_0x473a85(0x245)](_0x2ffbff[_0x5077d5])!==-0x1)return!![];}}catch(_0x5d1155){}return![];}function _0x3a811c(_0x2ce90f){var _0x1f3b10=_0x3b9fea;if(!_0x2ce90f)return![];if(_0x38af34(_0x2ce90f))return!![];var _0x10bd02=String(_0x2ce90f),_0x3341e7=[_0x1f3b10(0x17c),'hela-as.stloadi.live'];for(var _0x22fab0=0x0;_0x22fab0<_0x3341e7[_0x1f3b10(0x21a)];_0x22fab0++){if(_0x10bd02[_0x1f3b10(0x245)](_0x3341e7[_0x22fab0])!==-0x1)return!![];}try{var _0x9e676b=String(_0x425e28[_0x1f3b10(0x1f1)])[_0x1f3b10(0x36b)](/^https?:\/\//,'');if(_0x9e676b&&_0x10bd02[_0x1f3b10(0x245)](_0x9e676b)!==-0x1)return!![];}catch(_0x457b10){}return![];}var _0x34babe={'user-agent':0x1,'origin':0x1,'referer':0x1,'host':0x1,'cookie':0x1,'cookie2':0x1,'connection':0x1,'date':0x1,'expect':0x1,'keep-alive':0x1,'te':0x1,'trailer':0x1,'transfer-encoding':0x1,'upgrade':0x1,'via':0x1,'accept-charset':0x1,'accept-encoding':0x1,'access-control-request-headers':0x1,'access-control-request-method':0x1,'content-length':0x1};function _0x1d7a2f(_0x290e72){var _0x342712=_0x3b9fea;function _0x38ce09(_0x29c63a){return _0x3a811c(_0x29c63a);}function _0x40bfd6(_0x575f4c){var _0x3a22a5=a0_0x2a23;if(!_0x575f4c)return'';return _0x575f4c[_0x3a22a5(0x21a)]>0x64?_0x575f4c[_0x3a22a5(0x1f7)](0x0,0x50)+_0x3a22a5(0x208)+_0x575f4c[_0x3a22a5(0x1f7)](-0xf):_0x575f4c;}var _0x11d7a9=XMLHttpRequest[_0x342712(0x21c)][_0x342712(0x253)],_0x2e6637=XMLHttpRequest[_0x342712(0x21c)][_0x342712(0x386)],_0x1b001b=0x0;XMLHttpRequest['prototype']['open']=function(_0x5179d8,_0x5c9d24){var _0x1b6c96=_0x342712;return this[_0x1b6c96(0x28c)]=String(_0x5c9d24||''),this[_0x1b6c96(0x1e0)]=_0x5179d8,_0x11d7a9['apply'](this,arguments);},XMLHttpRequest[_0x342712(0x21c)][_0x342712(0x386)]=function(_0x284fc0){var _0x52a870=_0x342712;if(_0x38ce09(this[_0x52a870(0x28c)])){_0x1b001b++;var _0x2030a2=_0x1b001b;_0x529c49(_0x52a870(0x2d9),this[_0x52a870(0x1e0)],_0x40bfd6(this[_0x52a870(0x28c)]));for(var _0x4b949c in _0x290e72){if(_0x34babe[_0x4b949c[_0x52a870(0x180)]()])continue;try{this[_0x52a870(0x21e)](_0x4b949c,_0x290e72[_0x4b949c]);}catch(_0x3489cf){_0x529c49(_0x52a870(0x257),_0x4b949c);}}var _0x364d6e=this;this[_0x52a870(0x252)]('loadend',function(){var _0x320c02=_0x52a870,_0x3f41f4=0x0;try{var _0x38c8c2=_0x364d6e[_0x320c02(0x237)]||'';if(_0x38c8c2===''||_0x38c8c2===_0x320c02(0x1cc))_0x3f41f4=(_0x364d6e[_0x320c02(0x2db)]||'')[_0x320c02(0x21a)];else{if(_0x364d6e[_0x320c02(0x1b2)]&&typeof _0x364d6e[_0x320c02(0x1b2)]['byteLength']===_0x320c02(0x286))_0x3f41f4=_0x364d6e[_0x320c02(0x1b2)][_0x320c02(0x22b)];else _0x364d6e[_0x320c02(0x1b2)]&&typeof _0x364d6e[_0x320c02(0x1b2)][_0x320c02(0x1ca)]===_0x320c02(0x286)&&(_0x3f41f4=_0x364d6e[_0x320c02(0x1b2)][_0x320c02(0x1ca)]);}}catch(_0x257d96){}_0x529c49('xhr\x20←',_0x364d6e[_0x320c02(0x254)],_0x320c02(0x333),_0x3f41f4,_0x40bfd6(_0x364d6e[_0x320c02(0x28c)]));});}return _0x2e6637[_0x52a870(0x373)](this,arguments);};var _0x51a53c=window[_0x342712(0x17b)];return typeof _0x51a53c===_0x342712(0x334)&&(window['fetch']=function(_0x4bf7a4,_0x4dfa0b){var _0x6e554c=_0x342712,_0xad196d=typeof _0x4bf7a4===_0x6e554c(0x342)?_0x4bf7a4:_0x4bf7a4&&_0x4bf7a4[_0x6e554c(0x374)]||'';if(_0x38ce09(_0xad196d)){_0x4dfa0b=_0x4dfa0b||{};var _0x228788={},_0x107b53=_0x4dfa0b[_0x6e554c(0x2ed)]||{};if(_0x107b53&&typeof _0x107b53[_0x6e554c(0x32c)]==='function')_0x107b53[_0x6e554c(0x32c)](function(_0x61d4c5,_0x5b7e51){_0x228788[_0x5b7e51]=_0x61d4c5;});else{if(_0x107b53){for(var _0x1cbe24 in _0x107b53)_0x228788[_0x1cbe24]=_0x107b53[_0x1cbe24];}}for(var _0xac4914 in _0x290e72)_0x228788[_0xac4914]=_0x290e72[_0xac4914];return _0x4dfa0b['headers']=_0x228788,_0x529c49(_0x6e554c(0x236),_0x4dfa0b['method']||_0x6e554c(0x1e9),_0x40bfd6(_0xad196d)),_0x51a53c[_0x6e554c(0x15f)](this,_0x4bf7a4,_0x4dfa0b)[_0x6e554c(0x19e)](function(_0x18e905){var _0x2e106e=_0x6e554c;return _0x529c49(_0x2e106e(0x2de),_0x18e905[_0x2e106e(0x254)],_0x40bfd6(_0xad196d)),_0x18e905;},function(_0xa269c8){var _0x6baa76=_0x6e554c;_0x529c49(_0x6baa76(0x244),_0xa269c8['message'],_0x40bfd6(_0xad196d));throw _0xa269c8;});}return _0x51a53c['call'](this,_0x4bf7a4,_0x4dfa0b);}),function _0x1f28a6(){var _0x5c437a=_0x342712;try{XMLHttpRequest[_0x5c437a(0x21c)][_0x5c437a(0x253)]=_0x11d7a9;}catch(_0xb33313){}try{XMLHttpRequest[_0x5c437a(0x21c)][_0x5c437a(0x386)]=_0x2e6637;}catch(_0x3c8ef1){}try{if(typeof _0x51a53c===_0x5c437a(0x334))window[_0x5c437a(0x17b)]=_0x51a53c;}catch(_0x52f71a){}try{_0xc3beb7();}catch(_0x56bf46){}};}var _0xc3beb7=function(){};function _0x50fa92(_0x454a56,_0x39359e){var _0x59c366=_0x3b9fea;if(!window[_0x59c366(0x229)]||!Lampa[_0x59c366(0x176)]||!Lampa['Reguest'][_0x59c366(0x21c)])return;var _0x5db85b=Lampa[_0x59c366(0x176)][_0x59c366(0x21c)],_0x15dd53={};[_0x59c366(0x38e),_0x59c366(0x348),'send'][_0x59c366(0x32c)](function(_0x4b301b){var _0x16dc8b=_0x59c366;if(typeof _0x5db85b[_0x4b301b]!==_0x16dc8b(0x334))return;_0x15dd53[_0x4b301b]=_0x5db85b[_0x4b301b],_0x5db85b[_0x4b301b]=function(_0x217f4c,_0x112337,_0x3e6384,_0x423e2f,_0x2b7b4f){var _0x2b4e7f=_0x16dc8b;if(typeof _0x217f4c===_0x2b4e7f(0x342)&&_0x39359e(_0x217f4c)){_0x2b7b4f=_0x2b7b4f||{};var _0x17f5c4=_0x2b7b4f[_0x2b4e7f(0x2ed)]||{},_0x164f84={};for(var _0x24493e in _0x17f5c4)_0x164f84[_0x24493e]=_0x17f5c4[_0x24493e];for(var _0x402abe in _0x454a56)_0x164f84[_0x402abe]=_0x454a56[_0x402abe];_0x2b7b4f[_0x2b4e7f(0x2ed)]=_0x164f84,_0x529c49(_0x2b4e7f(0x2f7)+_0x4b301b,'→',_0x217f4c[_0x2b4e7f(0x21a)]>0x64?_0x217f4c[_0x2b4e7f(0x1f7)](0x0,0x50)+_0x2b4e7f(0x208):_0x217f4c);}return _0x15dd53[_0x4b301b][_0x2b4e7f(0x15f)](this,_0x217f4c,_0x112337,_0x3e6384,_0x423e2f,_0x2b7b4f);};}),_0xc3beb7=function(){for(var _0x104917 in _0x15dd53)_0x5db85b[_0x104917]=_0x15dd53[_0x104917];_0xc3beb7=function(){};};}function _0x42fdc0(_0x107aa1){var _0x490fef=_0x1d7a2f,_0x1a132f=_0x490fef(_0x107aa1);return _0x50fa92(_0x107aa1,_0x3a811c),_0x1a132f;}function _0x2e2363(_0x55cfa7){var _0x3b2a5a=_0x3b9fea;if(!window[_0x3b2a5a(0x2af)]||window[_0x3b2a5a(0x2af)][_0x3b2a5a(0x358)])return function(){};var _0x588a34=window[_0x3b2a5a(0x2af)],_0x170033=_0x588a34[_0x3b2a5a(0x1e2)]&&_0x588a34[_0x3b2a5a(0x1e2)][_0x3b2a5a(0x16e)];function _0x37c13b(){return{'aborted':![],'loaded':0x0,'retry':0x0,'total':0x0,'chunkCount':0x0,'bwEstimate':0x0,'loading':{'start':0x0,'first':0x0,'end':0x0},'parsing':{'start':0x0,'end':0x0},'buffering':{'start':0x0,'first':0x0,'end':0x0}};}function _0x3895a0(){var _0x40e881=_0x3b2a5a;return window['performance']&&window['performance'][_0x40e881(0x1d0)]?window['performance'][_0x40e881(0x1d0)]():Date[_0x40e881(0x1d0)]();}function _0x5dbb85(_0x50c921){var _0x412814=_0x3b2a5a,_0xfacedd=_0x50c921;if(_0xfacedd&&typeof _0xfacedd===_0x412814(0x28a)&&typeof _0xfacedd[_0x412814(0x1ee)]!==_0x412814(0x324))_0xfacedd=_0xfacedd[_0x412814(0x1ee)];else{if(typeof _0xfacedd==='string'&&_0xfacedd['charAt'](0x0)==='{'&&_0xfacedd[_0x412814(0x245)](_0x412814(0x380))!==-0x1)try{var _0x3a75e2=JSON[_0x412814(0x206)](_0xfacedd);if(_0x3a75e2&&typeof _0x3a75e2[_0x412814(0x1ee)]!==_0x412814(0x324))_0xfacedd=_0x3a75e2[_0x412814(0x1ee)];}catch(_0x50e6d5){}}if(_0xfacedd instanceof ArrayBuffer)return new Uint8Array(_0xfacedd);if(_0xfacedd&&_0xfacedd[_0x412814(0x27c)]instanceof ArrayBuffer)return new Uint8Array(_0xfacedd[_0x412814(0x27c)]);if(typeof _0xfacedd==='string'){var _0x5e58b8=_0xfacedd[_0x412814(0x21a)],_0x56f2f7=new Uint8Array(_0x5e58b8);for(var _0x4de331=0x0;_0x4de331<_0x5e58b8;_0x4de331++)_0x56f2f7[_0x4de331]=_0xfacedd['charCodeAt'](_0x4de331)&0xff;return _0x56f2f7;}return new Uint8Array(0x0);}function _0x1922cc(_0x1033ab){var _0x595731=_0x3b2a5a;if(!_0x1033ab||_0x1033ab[_0x595731(0x21a)]===0x0||_0x1033ab['length']>0x50)return![];var _0x1f1599='';for(var _0x6ec345=0x0;_0x6ec345<Math[_0x595731(0x305)](0xd,_0x1033ab['length']);_0x6ec345++)_0x1f1599+=String[_0x595731(0x228)](_0x1033ab[_0x6ec345]);return _0x1f1599===_0x595731(0x1ae);}function _0x3428fc(_0x239b98,_0x4bb3a8,_0x22f90c,_0x208d99,_0xb26ef0){var _0x1f3a4d=_0xb26ef0||0x180000,_0x453fb7=0x4000,_0xb0e1aa=_0x22f90c!=null?_0x22f90c|0x0:0x0,_0x53e1b9=_0x208d99!=null&&_0x208d99>_0xb0e1aa?_0x208d99-0x1:-0x1;return new Promise(function(_0x4a1274,_0x5e5c39){var _0x2eff9f=[],_0x4f992a=0x0,_0x34ed93=_0xb0e1aa,_0x594c3a=0x0,_0x4ae9b1=null;function _0x42af72(){var _0x1133a8=a0_0x2a23;if(_0x1f3a4d>_0x453fb7)return _0x1f3a4d=Math[_0x1133a8(0x179)](_0x1f3a4d/0x2),_0x529c49(_0x1133a8(0x2e7),_0x1f3a4d,_0x1133a8(0x315),_0x34ed93,_0x14b1ef(_0x239b98)),_0x2887ac();_0x5e5c39(new Error(_0x1133a8(0x2a1)+_0x1f3a4d+'\x20bytes\x20too\x20large'));}function _0x2887ac(){var _0x5bf8ef=a0_0x2a23,_0x593187;if(_0x53e1b9>=0x0){_0x593187=Math[_0x5bf8ef(0x305)](_0x34ed93+_0x1f3a4d-0x1,_0x53e1b9);if(_0x593187<_0x34ed93)return _0x3eb922();}else _0x593187=_0x34ed93+_0x1f3a4d-0x1;var _0x3c7f6f={};for(var _0x3e9a14 in _0x4bb3a8)_0x3c7f6f[_0x3e9a14]=_0x4bb3a8[_0x3e9a14];_0x3c7f6f[_0x5bf8ef(0x2f0)]=_0x5bf8ef(0x382)+_0x34ed93+'-'+_0x593187;var _0x4542a9=++_0x594c3a,_0x8e245e=_0x593187-_0x34ed93+0x1,_0x4e8b82;try{_0x4e8b82=new Lampa['Reguest']();}catch(_0xd5b63b){return _0x5e5c39(_0xd5b63b);}_0x4e8b82[_0x5bf8ef(0x38e)](_0x239b98,function(_0x17312e){var _0x5394a2=_0x5bf8ef,_0x2cd445=_0x17312e;if(_0x2cd445&&typeof _0x2cd445==='object'&&typeof _0x2cd445[_0x5394a2(0x1ee)]!==_0x5394a2(0x324))_0x2cd445=_0x2cd445[_0x5394a2(0x1ee)];else{if(typeof _0x2cd445==='string'&&_0x2cd445[_0x5394a2(0x13f)](0x0)==='{'&&_0x2cd445[_0x5394a2(0x245)]('\x22body\x22:')!==-0x1)try{var _0x1486f6=JSON[_0x5394a2(0x206)](_0x2cd445);if(_0x1486f6&&typeof _0x1486f6[_0x5394a2(0x1ee)]!=='undefined')_0x2cd445=_0x1486f6[_0x5394a2(0x1ee)];}catch(_0x4ff0b9){}}var _0x382469=typeof _0x2cd445===_0x5394a2(0x342)?_0x2cd445:String(_0x2cd445||'');if(_0x382469[_0x5394a2(0x13f)](0x0)==='['&&_0x382469[_0x5394a2(0x245)](_0x5394a2(0x1b8))!==-0x1)return _0x529c49(_0x5394a2(0x32a)+_0x4542a9,_0x5394a2(0x2ec),_0x3c7f6f['Range'],_0x14b1ef(_0x239b98)),_0x42af72();var _0x176e43;try{var _0x20cdf8=atob(_0x382469);_0x176e43=new Uint8Array(_0x20cdf8[_0x5394a2(0x21a)]);for(var _0x12b073=0x0;_0x12b073<_0x20cdf8['length'];_0x12b073++)_0x176e43[_0x12b073]=_0x20cdf8[_0x5394a2(0x207)](_0x12b073)&0xff;}catch(_0x592cb0){return _0x5e5c39(new Error('chunk\x20base64\x20decode\x20failed:\x20'+_0x592cb0[_0x5394a2(0x2d6)]));}_0x176e43[_0x5394a2(0x21a)]>0x0&&(_0x2eff9f[_0x5394a2(0x139)](_0x176e43),_0x4f992a+=_0x176e43['length'],_0x34ed93+=_0x176e43[_0x5394a2(0x21a)]);_0x529c49(_0x5394a2(0x32a)+_0x4542a9,_0x5394a2(0x224),_0x176e43['length'],'/',_0x8e245e,_0x5394a2(0x315),_0x34ed93,_0x14b1ef(_0x239b98));var _0x4a14ab=_0x53e1b9>=0x0&&_0x34ed93>_0x53e1b9||_0x176e43[_0x5394a2(0x21a)]<_0x8e245e||_0x176e43[_0x5394a2(0x21a)]===0x0;if(_0x4a14ab)_0x3eb922();else _0x2887ac();},function(_0x3cf014){var _0x4ddf1c=_0x5bf8ef;_0x5e5c39(new Error(_0x4ddf1c(0x371)+(_0x3cf014&&_0x3cf014[_0x4ddf1c(0x254)])));},![],{'dataType':_0x5bf8ef(0x267),'timeout':0x3a98,'headers':_0x3c7f6f,'returnHeaders':![]});}function _0x3eb922(){var _0x24edec=a0_0x2a23,_0x4c6b9a=new Uint8Array(_0x4f992a),_0x57dcaf=0x0;for(var _0x46d3b2=0x0;_0x46d3b2<_0x2eff9f['length'];_0x46d3b2++){_0x4c6b9a[_0x24edec(0x193)](_0x2eff9f[_0x46d3b2],_0x57dcaf),_0x57dcaf+=_0x2eff9f[_0x46d3b2][_0x24edec(0x21a)];}_0x4a1274(_0x4c6b9a[_0x24edec(0x27c)]);}_0x2887ac();});}function _0x492006(_0x21b058){var _0x38e787=_0x3b2a5a;this[_0x38e787(0x192)]=_0x21b058,this[_0x38e787(0x359)]=![],this[_0x38e787(0x26f)]=_0x170033?new _0x170033(_0x21b058):null,this[_0x38e787(0x2cc)]=_0x37c13b();}function _0x3aff6d(_0x25dde2){var _0x5c0b4b=_0x3b2a5a,_0x5050ec=_0x25dde2[_0x5c0b4b(0x21a)],_0x3cb91b=new Uint8Array(_0x5050ec);for(var _0x4cd4c2=0x0;_0x4cd4c2<_0x5050ec;_0x4cd4c2++)_0x3cb91b[_0x4cd4c2]=_0x25dde2[_0x5c0b4b(0x207)](_0x4cd4c2)&0xff;return _0x3cb91b[_0x5c0b4b(0x27c)];}function _0x370404(_0x3a286b){var _0x1fe6ab=_0x3b2a5a;if(_0x3a286b==null)return 0x0;if(typeof _0x3a286b===_0x1fe6ab(0x342))return _0x3a286b[_0x1fe6ab(0x21a)];if(_0x3a286b[_0x1fe6ab(0x22b)]!=null)return _0x3a286b['byteLength'];return 0x0;}function _0x2e0936(_0x46df24){var _0xa623a6=_0x3b2a5a,_0x46cfef=window['__amediaCdnHosts'],_0x25c8ac=window['__amediaCdnActiveIdx']|0x0;if(!_0x46cfef||!_0x46cfef[_0xa623a6(0x21a)]||_0x25c8ac>=_0x46cfef[_0xa623a6(0x21a)])return _0x46df24;return _0x46df24[_0xa623a6(0x36b)](/^(https?:\/\/)([^\/]+)/,function(_0x5bc7d4,_0xda2016,_0x4ba490){var _0x11df4d=_0xa623a6;if(!_0x3a811c(_0x11df4d(0x19a)+_0x4ba490+'/'))return _0xda2016+_0x4ba490;return _0xda2016+_0x46cfef[_0x25c8ac];});}function _0x40f30b(_0x49e684){var _0x4df943=_0x3b2a5a,_0xf916a5=window[_0x4df943(0x353)]||[];if(!_0xf916a5['length'])return![];var _0xc80573=(window[_0x4df943(0x2d8)]|0x0)+0x1;if(_0xc80573>=_0xf916a5[_0x4df943(0x21a)])return window[_0x4df943(0x2d8)]=0x0,_0x529c49(_0x4df943(0x19c),_0xf916a5[0x0]),![];return window['__amediaCdnActiveIdx']=_0xc80573,_0x529c49(_0x4df943(0x191),_0xf916a5[_0xc80573],'(reason:',_0x49e684+')'),!![];}_0x492006[_0x3b2a5a(0x21c)][_0x3b2a5a(0x304)]=function(_0xbcd02a,_0x15c321,_0x5d9ef8){var _0x4e4dc8=_0x3b2a5a,_0x2436d6=this;_0x2436d6[_0x4e4dc8(0x235)]=_0xbcd02a,_0x2436d6[_0x4e4dc8(0x2d2)]=_0x5d9ef8,_0x2436d6[_0x4e4dc8(0x2cc)]=_0x37c13b(),_0x2436d6[_0x4e4dc8(0x2cc)][_0x4e4dc8(0x372)]['start']=_0x3895a0();var _0x2bfaed=_0xbcd02a&&_0xbcd02a[_0x4e4dc8(0x374)]?String(_0xbcd02a[_0x4e4dc8(0x374)]):'',_0x1e80b0=_0x2e0936(_0x2bfaed);if(_0x1e80b0!==_0x2bfaed)_0xbcd02a[_0x4e4dc8(0x374)]=_0x1e80b0;var _0xc525fe=_0x3a811c(_0x1e80b0),_0x92a33f=_0x1e80b0[_0x4e4dc8(0x37a)](/-(\d+)-f\d+-[av]\d+\.ts/);if(_0x92a33f){var _0x11ec0c=parseInt(_0x92a33f[0x1],0xa);if(!isNaN(_0x11ec0c)){var _0x49a38f=window[_0x4e4dc8(0x343)]|0x0;window['__amediaLastSeg']=_0x11ec0c,_0x49a38f>0x19&&Math['abs'](_0x11ec0c-_0x49a38f)*0x6>0x5a&&window[_0x4e4dc8(0x36c)]&&window[_0x4e4dc8(0x36c)][_0x4e4dc8(0x330)]&&window['__amediaKsHandle'][_0x4e4dc8(0x330)]();}}if(!_0xc525fe)return _0x2436d6['_inner']['load'](_0xbcd02a,_0x15c321,_0x5d9ef8);_0x2436d6[_0x4e4dc8(0x232)]=_0x2bfaed,_0x2436d6[_0x4e4dc8(0x213)]=_0x2436d6[_0x4e4dc8(0x213)]||0x0;var _0x140eed=_0xbcd02a&&_0xbcd02a[_0x4e4dc8(0x237)]==='arraybuffer',_0x2706c5=_0x140eed?_0x4e4dc8(0x1d3):_0x4e4dc8(0x1cc),_0x29f1f8={};for(var _0x2e9ff6 in _0x55cfa7)_0x29f1f8[_0x2e9ff6]=_0x55cfa7[_0x2e9ff6];_0x29f1f8['User-Agent']=_0x29f1f8[_0x4e4dc8(0x317)]||_0x3136da,_0x29f1f8['Accept']=_0x29f1f8[_0x4e4dc8(0x326)]||_0x4e4dc8(0x25d),_0x29f1f8[_0x4e4dc8(0x1d6)]=_0x29f1f8[_0x4e4dc8(0x1d6)]||_0x4e4dc8(0x255),_0x29f1f8[_0x4e4dc8(0x1c7)]=_0x29f1f8[_0x4e4dc8(0x1c7)]||_0x4e4dc8(0x20e),_0x29f1f8['Sec-Fetch-Dest']=_0x29f1f8[_0x4e4dc8(0x20b)]||_0x4e4dc8(0x1c1),_0x29f1f8[_0x4e4dc8(0x23b)]=_0x29f1f8[_0x4e4dc8(0x23b)]||_0x4e4dc8(0x13a),_0x29f1f8[_0x4e4dc8(0x285)]=_0x29f1f8[_0x4e4dc8(0x285)]||_0x4e4dc8(0x1e6),_0x29f1f8[_0x4e4dc8(0x126)]=_0x29f1f8[_0x4e4dc8(0x126)]||_0x4e4dc8(0x16c),_0x29f1f8['Priority']=_0x29f1f8[_0x4e4dc8(0x34b)]||_0x4e4dc8(0x239),_0x29f1f8[_0x4e4dc8(0x29c)]=_0x29f1f8[_0x4e4dc8(0x29c)]||_0x4e4dc8(0x133),_0x29f1f8[_0x4e4dc8(0x2ea)]=_0x29f1f8[_0x4e4dc8(0x2ea)]||'?0',_0x29f1f8[_0x4e4dc8(0x18b)]=_0x29f1f8[_0x4e4dc8(0x18b)]||_0x4e4dc8(0x1c0);if(_0xbcd02a&&typeof _0xbcd02a[_0x4e4dc8(0x197)]===_0x4e4dc8(0x286)&&_0xbcd02a[_0x4e4dc8(0x197)]>=0x0){var _0x2e4f19=_0xbcd02a[_0x4e4dc8(0x197)]|0x0,_0x417750=typeof _0xbcd02a[_0x4e4dc8(0x2a7)]==='number'&&_0xbcd02a[_0x4e4dc8(0x2a7)]>_0xbcd02a[_0x4e4dc8(0x197)];if(_0x417750)_0x29f1f8['Range']=_0x4e4dc8(0x382)+_0x2e4f19+'-'+(_0xbcd02a[_0x4e4dc8(0x2a7)]-0x1|0x0);else _0x2e4f19>0x0&&(_0x29f1f8[_0x4e4dc8(0x2f0)]=_0x4e4dc8(0x382)+_0x2e4f19+'-');}_0x529c49(_0x4e4dc8(0x1f4),_0x140eed?_0x4e4dc8(0x337):_0x4e4dc8(0x173),_0x29f1f8[_0x4e4dc8(0x2f0)]?_0x4e4dc8(0x1b6)+_0x29f1f8[_0x4e4dc8(0x2f0)]+'\x20':'',_0x14b1ef(_0x1e80b0));function _0x285e13(_0x2bbc8a){var _0x3f92b9=_0x4e4dc8;if(_0x2436d6[_0x3f92b9(0x359)])return;var _0x16e796=_0x3895a0();_0x2436d6[_0x3f92b9(0x2cc)][_0x3f92b9(0x372)][_0x3f92b9(0x2f6)]=_0x16e796,_0x2436d6[_0x3f92b9(0x2cc)][_0x3f92b9(0x372)]['end']=_0x16e796,_0x2436d6[_0x3f92b9(0x2cc)][_0x3f92b9(0x190)]=_0x370404(_0x2bbc8a),_0x2436d6[_0x3f92b9(0x2cc)][_0x3f92b9(0x2b8)]=_0x370404(_0x2bbc8a);var _0xe116c9='';try{var _0x565fea=_0x2bbc8a instanceof ArrayBuffer?new Uint8Array(_0x2bbc8a):null;if(_0x565fea){var _0x3649e3=Math[_0x3f92b9(0x305)](0x10,_0x565fea[_0x3f92b9(0x21a)]);for(var _0x1087ce=0x0;_0x1087ce<_0x3649e3;_0x1087ce++){var _0x5a614e=_0x565fea[_0x1087ce][_0x3f92b9(0x251)](0x10);_0xe116c9+=(_0x5a614e[_0x3f92b9(0x21a)]===0x1?'0':'')+_0x5a614e+'\x20';}}}catch(_0x1dc138){}_0x529c49(_0x3f92b9(0x370),_0x3f92b9(0x333),_0x2436d6[_0x3f92b9(0x2cc)][_0x3f92b9(0x190)],_0xe116c9?_0x3f92b9(0x1ed)+_0xe116c9:'',_0x14b1ef(_0x1e80b0)),_0x5d9ef8[_0x3f92b9(0x22a)]({'url':_0x1e80b0,'data':_0x2bbc8a},_0x2436d6['stats'],_0xbcd02a,{'responseURL':_0x1e80b0});}function _0x44f892(_0x4cfce1,_0x1e8d11){var _0x4500b2=_0x4e4dc8;if(_0x2436d6[_0x4500b2(0x359)])return;_0x4cfce1===0x193&&window[_0x4500b2(0x30e)]?_0x529c49('hls\x20loader\x20✗\x20native\x20403','T+'+((Date[_0x4500b2(0x1d0)]()-window['__amediaPlayStartMs'])/0x3e8)[_0x4500b2(0x134)](0x1)+'s',_0x4500b2(0x138)+String(_0x29f1f8[_0x4500b2(0x355)]||''),_0x14b1ef(_0x1e80b0)):_0x529c49(_0x4500b2(0x31e),_0x4cfce1,_0x1e8d11||'',_0x14b1ef(_0x1e80b0));if(_0x4cfce1===0x193&&(_0x2436d6[_0x4500b2(0x213)]|0x0)<0x4){var _0x27d63c=String(_0x29f1f8['Accepts-Controls']||''),_0x2e6388=0x0,_0x5b660c=0xfa,_0x2950d2=0x7530;(function _0xa5216b(){var _0x219cd5=_0x4500b2;if(_0x2436d6[_0x219cd5(0x359)])return;var _0x3ebb42=String(_0x55cfa7&&_0x55cfa7[_0x219cd5(0x355)]||'');if(_0x3ebb42&&_0x3ebb42!==_0x27d63c){_0x529c49(_0x219cd5(0x201),_0x2e6388,_0x219cd5(0x2ab)),window[_0x219cd5(0x2d8)]=0x0,_0x2436d6['_retried']=(_0x2436d6[_0x219cd5(0x213)]|0x0)+0x1,_0xbcd02a[_0x219cd5(0x374)]=_0x2e0936(_0x2436d6[_0x219cd5(0x232)]),_0x2436d6[_0x219cd5(0x304)](_0xbcd02a,_0x15c321,_0x5d9ef8);return;}if(_0x2e6388>=_0x2950d2){_0x529c49('hls\x20loader:\x20403\x20hold\x20→\x20no\x20rotation\x20after',_0x2e6388,_0x219cd5(0x1d9)),_0x5d9ef8[_0x219cd5(0x2bd)]({'code':_0x4cfce1||0x0,'text':_0x1e8d11||_0x219cd5(0x27f)},_0xbcd02a,null,_0x2436d6[_0x219cd5(0x2cc)]);return;}_0x2e6388+=_0x5b660c,setTimeout(_0xa5216b,_0x5b660c);}());return;}_0x5d9ef8[_0x4500b2(0x2bd)]({'code':_0x4cfce1||0x0,'text':_0x1e8d11||'native\x20fail'},_0xbcd02a,null,_0x2436d6[_0x4500b2(0x2cc)]);}try{if(_0x140eed){var _0x2f6b02=new Lampa[(_0x4e4dc8(0x176))]();_0x2f6b02[_0x4e4dc8(0x38e)](_0x1e80b0,function(_0x1319d4){var _0x17d679=_0x4e4dc8;if(_0x2436d6[_0x17d679(0x359)])return;var _0x201fd4=_0x1319d4;if(_0x201fd4&&typeof _0x201fd4===_0x17d679(0x28a)&&typeof _0x201fd4[_0x17d679(0x1ee)]!==_0x17d679(0x324))_0x201fd4=_0x201fd4[_0x17d679(0x1ee)];else{if(typeof _0x201fd4==='string'&&_0x201fd4[_0x17d679(0x13f)](0x0)==='{'&&_0x201fd4[_0x17d679(0x245)](_0x17d679(0x380))!==-0x1)try{var _0x579a2b=JSON[_0x17d679(0x206)](_0x201fd4);if(_0x579a2b&&typeof _0x579a2b[_0x17d679(0x1ee)]!==_0x17d679(0x324))_0x201fd4=_0x579a2b[_0x17d679(0x1ee)];}catch(_0x3d3caa){}}var _0x2dc2a8=typeof _0x201fd4==='string'?_0x201fd4:String(_0x201fd4||'');if(_0x2dc2a8[_0x17d679(0x13f)](0x0)==='['&&_0x2dc2a8[_0x17d679(0x245)]('Response\x20too\x20large')!==-0x1){_0x529c49(_0x17d679(0x222),_0x14b1ef(_0x1e80b0)),_0x3428fc(_0x1e80b0,_0x29f1f8,0x0,null)['then'](_0x285e13)[_0x17d679(0x246)](function(_0x5ce203){var _0x382fa8=_0x17d679;_0x44f892(0x0,_0x382fa8(0x31b)+(_0x5ce203&&_0x5ce203[_0x382fa8(0x2d6)]));});return;}if(!window[_0x17d679(0x1da)]){window[_0x17d679(0x1da)]=!![];var _0x37df66=[],_0x3c1332=0x0,_0x2aaf92=0x0,_0x70af18=0x0;for(var _0x3b4efc=0x0;_0x3b4efc<Math[_0x17d679(0x305)](0x18,_0x2dc2a8['length']);_0x3b4efc++){var _0x5e527c=_0x2dc2a8[_0x17d679(0x207)](_0x3b4efc);_0x37df66[_0x17d679(0x139)](_0x5e527c[_0x17d679(0x251)](0x10));if(_0x5e527c>_0x3c1332)_0x3c1332=_0x5e527c;if(_0x5e527c>0x7f)_0x2aaf92++;if(_0x5e527c===0xfffd)_0x70af18++;}var _0x59df85=Math[_0x17d679(0x305)](0x800,_0x2dc2a8[_0x17d679(0x21a)]),_0x2ea52b=0x0,_0x32dc43=0x0;for(var _0x2e275a=0x0;_0x2e275a<_0x59df85;_0x2e275a++){var _0x590f99=_0x2dc2a8[_0x17d679(0x207)](_0x2e275a);if(_0x590f99===0xfffd)_0x2ea52b++;if(_0x590f99>_0x32dc43)_0x32dc43=_0x590f99;}_0x529c49(_0x17d679(0x1b1),_0x17d679(0x19b),typeof _0x1319d4,_0x17d679(0x333),_0x2dc2a8[_0x17d679(0x21a)],_0x17d679(0x247),_0x37df66[_0x17d679(0x1ea)]('\x20'),_0x17d679(0x145)+_0x3c1332[_0x17d679(0x251)](0x10),'high:'+_0x2aaf92,_0x17d679(0x2fb)+_0x70af18,_0x17d679(0x29b)+_0x32dc43[_0x17d679(0x251)](0x10),_0x17d679(0x2fb)+_0x2ea52b);}var _0x2ccf97;try{_0x2ccf97=atob(_0x2dc2a8);}catch(_0x8e8b4f){_0x529c49(_0x17d679(0x25a),typeof _0x1319d4,_0x17d679(0x333),_0x2dc2a8[_0x17d679(0x21a)],_0x17d679(0x341),_0x2dc2a8[_0x17d679(0x1f7)](0x0,0x28)),_0x44f892(0x0,_0x17d679(0x181));return;}var _0x5e3aa3=_0x2ccf97[_0x17d679(0x21a)],_0x314b72=new Uint8Array(_0x5e3aa3);for(var _0x51af85=0x0;_0x51af85<_0x5e3aa3;_0x51af85++)_0x314b72[_0x51af85]=_0x2ccf97[_0x17d679(0x207)](_0x51af85)&0xff;_0x285e13(_0x314b72[_0x17d679(0x27c)]);},function(_0x317749){var _0x3b117c=_0x4e4dc8;_0x44f892(_0x317749&&_0x317749[_0x3b117c(0x254)],_0x3b117c(0x27f));},![],{'dataType':_0x4e4dc8(0x267),'timeout':_0x15c321[_0x4e4dc8(0x1c2)]||0x3a98,'headers':_0x29f1f8,'returnHeaders':![]});return;}var _0x39f7aa=new Lampa[(_0x4e4dc8(0x176))]();_0x39f7aa[_0x4e4dc8(0x38e)](_0x1e80b0,function(_0x58d641){var _0x596312=_0x4e4dc8;if(_0x2436d6[_0x596312(0x359)])return;var _0x3a76e6=_0x58d641;if(_0x3a76e6&&typeof _0x3a76e6==='object'&&typeof _0x3a76e6[_0x596312(0x1ee)]!==_0x596312(0x324))_0x3a76e6=_0x3a76e6[_0x596312(0x1ee)];else{if(typeof _0x3a76e6===_0x596312(0x342)&&_0x3a76e6['charAt'](0x0)==='{'&&_0x3a76e6[_0x596312(0x245)]('\x22body\x22:')!==-0x1)try{var _0x1de441=JSON['parse'](_0x3a76e6);if(_0x1de441&&typeof _0x1de441[_0x596312(0x1ee)]!==_0x596312(0x324))_0x3a76e6=_0x1de441[_0x596312(0x1ee)];}catch(_0x2be494){}}var _0xdc3856=typeof _0x3a76e6===_0x596312(0x342)?_0x3a76e6:String(_0x3a76e6||''),_0x51c692=_0x3895a0();_0x2436d6['stats'][_0x596312(0x372)][_0x596312(0x2f6)]=_0x51c692,_0x2436d6[_0x596312(0x2cc)]['loading'][_0x596312(0x1db)]=_0x51c692,_0x2436d6[_0x596312(0x2cc)][_0x596312(0x190)]=_0x370404(_0xdc3856),_0x2436d6[_0x596312(0x2cc)]['total']=_0x370404(_0xdc3856),_0x529c49(_0x596312(0x1f2),'len:',_0x2436d6['stats'][_0x596312(0x190)],_0x14b1ef(_0x1e80b0)),_0x5d9ef8[_0x596312(0x22a)]({'url':_0x1e80b0,'data':_0xdc3856},_0x2436d6['stats'],_0xbcd02a,{'responseURL':_0x1e80b0});},function(_0x3fbff4){_0x44f892(_0x3fbff4&&_0x3fbff4['status'],'native\x20fail');},![],{'dataType':_0x4e4dc8(0x1cc),'timeout':_0x15c321[_0x4e4dc8(0x1c2)]||0x2710,'headers':_0x29f1f8,'returnHeaders':![]});}catch(_0x2752b8){_0x529c49(_0x4e4dc8(0x2e2),_0x2752b8['message']),_0x2436d6[_0x4e4dc8(0x26f)][_0x4e4dc8(0x304)](_0xbcd02a,_0x15c321,_0x5d9ef8);}},_0x492006[_0x3b2a5a(0x21c)][_0x3b2a5a(0x1fa)]=function(){var _0x4aa12f=_0x3b2a5a;this[_0x4aa12f(0x359)]=!![];if(this[_0x4aa12f(0x26f)])this['_inner'][_0x4aa12f(0x1fa)]();},_0x492006['prototype'][_0x3b2a5a(0x1ab)]=function(){var _0x5cbc77=_0x3b2a5a;this[_0x5cbc77(0x359)]=!![];if(this[_0x5cbc77(0x26f)])this[_0x5cbc77(0x26f)][_0x5cbc77(0x1ab)]();};function _0x14b1ef(_0x5dd94e){var _0x4cf99d=_0x3b2a5a;return _0x5dd94e[_0x4cf99d(0x21a)]>0x5a?_0x5dd94e['slice'](0x0,0x4b)+_0x4cf99d(0x208)+_0x5dd94e[_0x4cf99d(0x1f7)](-0xc):_0x5dd94e;}function _0x3359a2(_0x3512b9){var _0x2630be=_0x3b2a5a;return _0x3512b9=_0x3512b9||{},_0x3512b9[_0x2630be(0x16e)]=_0x492006,new _0x588a34(_0x3512b9);}try{Object[_0x3b2a5a(0x23c)](_0x3359a2,_0x588a34);}catch(_0x5fb668){}for(var _0x422b52 in _0x588a34){try{_0x3359a2[_0x422b52]=_0x588a34[_0x422b52];}catch(_0x45dd81){}}return _0x3359a2[_0x3b2a5a(0x21c)]=_0x588a34[_0x3b2a5a(0x21c)],_0x3359a2[_0x3b2a5a(0x358)]=!![],_0x3359a2[_0x3b2a5a(0x194)]=_0x588a34,window['Hls']=_0x3359a2,function _0x1dd6a1(){var _0xf9c5bb=_0x3b2a5a;if(window['Hls']===_0x3359a2)window[_0xf9c5bb(0x2af)]=_0x588a34;};}function _0x1ef8f4(_0x5ca331,_0x44904c){var _0x31d1c3=_0x3b9fea,_0x53f3db=_0x44904c||[_0x31d1c3(0x20d),_0x31d1c3(0x1f5),_0x31d1c3(0x307),'360'];for(var _0x33c2fc=0x0;_0x33c2fc<_0x53f3db[_0x31d1c3(0x21a)];_0x33c2fc++){var _0x365030=_0x5ca331[_0x53f3db[_0x33c2fc]];if(_0x365030)return _0x365030[_0x31d1c3(0x265)](_0x31d1c3(0x381))[0x0][_0x31d1c3(0x2ca)]();}var _0x4f05ea=Object['keys'](_0x5ca331);return _0x4f05ea[_0x31d1c3(0x21a)]?_0x5ca331[_0x4f05ea[0x0]]['split'](_0x31d1c3(0x381))[0x0]['trim']():null;}function _0x3f577f(_0x5aacc1){var _0x60aa2b=_0x3b9fea,_0x574964={};return['2160',_0x60aa2b(0x1c5),'1080',_0x60aa2b(0x1f5),'480',_0x60aa2b(0x2b6),_0x60aa2b(0x2a9)][_0x60aa2b(0x32c)](function(_0x2ba191){var _0x2b9e28=_0x60aa2b;if(_0x5aacc1[_0x2ba191])_0x574964[_0x2ba191+'p']=_0x5aacc1[_0x2ba191]['split'](_0x2b9e28(0x381))[0x0][_0x2b9e28(0x2ca)]();}),_0x574964;}var _0x5c1046=![],_0x477bec=_0x3b9fea(0x13b);function _0x2d2640(_0x197127){var _0x1b4c1e=_0x3b9fea,_0x96947c=(_0x197127&&_0x197127['message']?_0x197127[_0x1b4c1e(0x2d6)]:String(_0x197127))[_0x1b4c1e(0x180)]();return _0x96947c[_0x1b4c1e(0x245)](_0x1b4c1e(0x183))!==-0x1||_0x96947c[_0x1b4c1e(0x245)](_0x1b4c1e(0x24e))!==-0x1||_0x96947c[_0x1b4c1e(0x245)](_0x1b4c1e(0x13a))!==-0x1||_0x96947c[_0x1b4c1e(0x245)](_0x1b4c1e(0x2a6))!==-0x1||_0x96947c[_0x1b4c1e(0x245)](_0x1b4c1e(0x33d))!==-0x1;}var _0x551277={'present':![],'version':null};(function(){var _0xa5ae1e=_0x3b9fea;function _0x340e9d(_0x142447){var _0x52b528=a0_0x2a23;if(_0x142447['source']!==window)return;var _0x824d0e=_0x142447['data'];if(!_0x824d0e||typeof _0x824d0e!==_0x52b528(0x28a)||_0x824d0e[_0x52b528(0x1cf)]!==_0x52b528(0x270))return;(_0x824d0e['kind']==='loaded'||_0x824d0e['kind']==='pong')&&(_0x551277[_0x52b528(0x266)]=!![],_0x551277[_0x52b528(0x29a)]=_0x824d0e[_0x52b528(0x29a)]||_0x551277[_0x52b528(0x29a)]);}window[_0xa5ae1e(0x252)](_0xa5ae1e(0x2d6),_0x340e9d);}());function _0x32ae74(_0xa5bd09){return new Promise(function(_0x18c95b){var _0x10edfd=a0_0x2a23;if(_0x551277[_0x10edfd(0x266)])return _0x18c95b(!![]);var _0x5be242=_0x10edfd(0x33e)+Date['now']()+'-'+Math[_0x10edfd(0x2fd)]();function _0x3b4a37(_0x4c6f87){var _0x1f3b80=_0x10edfd;if(_0x4c6f87[_0x1f3b80(0x1cf)]!==window)return;var _0x2682d4=_0x4c6f87[_0x1f3b80(0x135)];_0x2682d4&&_0x2682d4[_0x1f3b80(0x1cf)]===_0x1f3b80(0x270)&&_0x2682d4['kind']===_0x1f3b80(0x27b)&&_0x2682d4[_0x1f3b80(0x375)]===_0x5be242&&(_0x4e052c(),_0x551277[_0x1f3b80(0x266)]=!!_0x2682d4['ok'],_0x551277[_0x1f3b80(0x29a)]=_0x2682d4[_0x1f3b80(0x29a)]||_0x551277[_0x1f3b80(0x29a)],_0x18c95b(_0x551277[_0x1f3b80(0x266)]));}var _0x3f5f3c=setTimeout(function(){_0x4e052c(),_0x18c95b(_0x551277['present']);},_0xa5bd09||0x190);function _0x4e052c(){var _0x9176c9=_0x10edfd;window[_0x9176c9(0x1b4)](_0x9176c9(0x2d6),_0x3b4a37),clearTimeout(_0x3f5f3c);}window[_0x10edfd(0x252)](_0x10edfd(0x2d6),_0x3b4a37),window[_0x10edfd(0x16f)]({'source':_0x10edfd(0x259),'kind':_0x10edfd(0x2ae),'reqId':_0x5be242},'*');});}function _0x302e2a(_0x44b3db,_0x25a6d5){return new Promise(function(_0x488ba6){var _0x25ada1=a0_0x2a23;if(!_0x551277[_0x25ada1(0x266)])return _0x488ba6(![]);var _0x49950e=_0x25ada1(0x1dd)+Date[_0x25ada1(0x1d0)]()+'-'+Math['random']();function _0x10220c(_0x4fa4ee){var _0x57211d=_0x25ada1;if(_0x4fa4ee[_0x57211d(0x1cf)]!==window)return;var _0x28da36=_0x4fa4ee[_0x57211d(0x135)];_0x28da36&&_0x28da36[_0x57211d(0x1cf)]===_0x57211d(0x270)&&_0x28da36[_0x57211d(0x2e1)]===_0x57211d(0x1aa)&&_0x28da36[_0x57211d(0x375)]===_0x49950e&&(_0x50d08b(),_0x488ba6(!!_0x28da36['ok']));}var _0x242eb1=setTimeout(function(){_0x50d08b(),_0x488ba6(![]);},0x320);function _0x50d08b(){var _0x3b285c=_0x25ada1;window['removeEventListener'](_0x3b285c(0x2d6),_0x10220c),clearTimeout(_0x242eb1);}window[_0x25ada1(0x252)](_0x25ada1(0x2d6),_0x10220c),window['postMessage']({'source':_0x25ada1(0x259),'kind':_0x25ada1(0x33b),'guard':_0x44b3db,'hP':_0x25a6d5,'reqId':_0x49950e},'*');});}function _0x458f36(_0x240e5e){var _0x51f332=_0x3b9fea;if(!_0x240e5e||!_0x240e5e[_0x51f332(0x2c4)])return null;var _0x56af5c={};function _0x47556e(_0x145ca1,_0x2a3644,_0x536b1a,_0x1702f0,_0x54eea1){var _0x386b6a=_0x51f332;if(!_0x54eea1)return;var _0x5dd95b=String(_0x145ca1),_0x5ba9d9=String(_0x2a3644);if(!_0x56af5c[_0x5dd95b])_0x56af5c[_0x5dd95b]={};if(!_0x56af5c[_0x5dd95b][_0x5ba9d9])_0x56af5c[_0x5dd95b][_0x5ba9d9]=[];for(var _0x24eec8=0x0;_0x24eec8<_0x56af5c[_0x5dd95b][_0x5ba9d9][_0x386b6a(0x21a)];_0x24eec8++){if(_0x56af5c[_0x5dd95b][_0x5ba9d9][_0x24eec8]['id']===String(_0x536b1a))return;}_0x56af5c[_0x5dd95b][_0x5ba9d9][_0x386b6a(0x139)]({'id':String(_0x536b1a||'0'),'name':String(_0x1702f0||_0x386b6a(0x392)+(_0x536b1a||'?')),'file_id':String(_0x54eea1)});}function _0x3a1a3a(_0xb1e835,_0x1b7d38,_0x1fb2c3,_0x5280c4){var _0x5d2bfe=_0x51f332;if(!_0x1b7d38)return;if(Array['isArray'](_0x1b7d38))_0x1b7d38[_0x5d2bfe(0x32c)](function(_0x4ae455){var _0x119f64=_0x5d2bfe,_0x28bcfa=parseInt(_0x4ae455&&_0x4ae455[_0x119f64(0x298)],0xa)||0x0;_0x47556e(_0xb1e835,_0x28bcfa,_0x4ae455&&_0x4ae455['id_translation']||_0x1fb2c3,_0x4ae455&&_0x4ae455[_0x119f64(0x22c)]||_0x5280c4,_0x4ae455&&_0x4ae455['id']);});else typeof _0x1b7d38===_0x5d2bfe(0x28a)&&Object[_0x5d2bfe(0x338)](_0x1b7d38)['forEach'](function(_0x49043b){var _0x812ef6=_0x5d2bfe,_0x317efd=_0x1b7d38[_0x49043b];if(!_0x317efd||typeof _0x317efd!==_0x812ef6(0x28a))return;var _0x548a5d=parseInt(_0x317efd[_0x812ef6(0x298)],0xa)||parseInt(_0x49043b,0xa)||0x0,_0x367327=[];for(var _0x213d5c in _0x317efd){if(Object[_0x812ef6(0x21c)][_0x812ef6(0x22d)]['call'](_0x317efd,_0x213d5c)&&/^t\d+$/['test'](_0x213d5c))_0x367327[_0x812ef6(0x139)](_0x213d5c);}_0x367327[_0x812ef6(0x21a)]?_0x367327['forEach'](function(_0x19c0a6){var _0x4f349f=_0x812ef6,_0x4d1aef=_0x317efd[_0x19c0a6];if(!_0x4d1aef||!_0x4d1aef['id'])return;_0x47556e(_0xb1e835,_0x548a5d,_0x4d1aef['id_translation']||_0x19c0a6[_0x4f349f(0x36b)](/^t/,''),_0x4d1aef[_0x4f349f(0x22c)]||_0x4f349f(0x392)+_0x19c0a6,_0x4d1aef['id']);}):_0x47556e(_0xb1e835,_0x548a5d,_0x317efd['id_translation']||_0x1fb2c3,_0x317efd['translation']||_0x5280c4,_0x317efd['id']);});}Object[_0x51f332(0x338)](_0x240e5e[_0x51f332(0x2c4)])[_0x51f332(0x32c)](function(_0x4ca2d1){var _0x33460c=_0x51f332,_0x15b648=_0x240e5e[_0x33460c(0x2c4)][_0x4ca2d1];if(!_0x15b648)return;var _0x10166f=_0x4ca2d1[_0x33460c(0x37a)](/^t(\d+)$/);if(_0x10166f){var _0x234cdc=_0x10166f[0x1],_0x4135a0=_0x15b648[_0x33460c(0x22c)]||_0x15b648[_0x33460c(0x290)]||'',_0x155d82=_0x15b648[_0x33460c(0x23a)]||_0x15b648;Object[_0x33460c(0x338)](_0x155d82)[_0x33460c(0x32c)](function(_0x58809b){var _0x3a4740=_0x33460c;if(_0x58809b===_0x3a4740(0x23a)||_0x58809b==='translation'||_0x58809b===_0x3a4740(0x290))return;var _0xfcd7a4=parseInt(_0x58809b,0xa);if(!isFinite(_0xfcd7a4))return;_0x3a1a3a(_0xfcd7a4,_0x155d82[_0x58809b],_0x234cdc,_0x4135a0);});}else{var _0x53b4a6=parseInt(_0x4ca2d1,0xa);if(!isFinite(_0x53b4a6))return;_0x3a1a3a(_0x53b4a6,_0x15b648,null,null);}});var _0x478645=Object['keys'](_0x56af5c)['map'](function(_0xdd5727){var _0x42dca7=_0x51f332,_0x4705c7=_0x56af5c[_0xdd5727],_0x3ff180=Object[_0x42dca7(0x338)](_0x4705c7)[_0x42dca7(0x166)](function(_0x2c348c){return{'number':parseInt(_0x2c348c,0xa)||0x0,'translations':_0x4705c7[_0x2c348c]};})[_0x42dca7(0x1be)](function(_0x3a75fe,_0x45fa84){var _0x1f24da=_0x42dca7;return _0x3a75fe[_0x1f24da(0x286)]-_0x45fa84[_0x1f24da(0x286)];});return{'number':parseInt(_0xdd5727,0xa)||0x0,'episodes':_0x3ff180};})[_0x51f332(0x1be)](function(_0x38c1a8,_0x170ca5){var _0x3f350d=_0x51f332;return _0x38c1a8[_0x3f350d(0x286)]-_0x170ca5[_0x3f350d(0x286)];});return{'seasons':_0x478645};}function _0x19af0c(_0x32ea21){var _0x3225fc=_0x3b9fea,_0x3159c7={},_0x75a968=[];return _0x32ea21[_0x3225fc(0x2eb)][_0x3225fc(0x32c)](function(_0x1e5a57){var _0x24238b=_0x3225fc;_0x1e5a57[_0x24238b(0x369)][_0x24238b(0x32c)](function(_0x456014){var _0x46c53f=_0x24238b;_0x456014[_0x46c53f(0x320)][_0x46c53f(0x32c)](function(_0x1ec410){var _0x3c4350=_0x46c53f;!_0x3159c7[_0x1ec410['id']]&&(_0x3159c7[_0x1ec410['id']]=!![],_0x75a968[_0x3c4350(0x139)]({'id':_0x1ec410['id'],'name':_0x1ec410[_0x3c4350(0x290)]}));});});}),_0x75a968;}function _0x170677(_0x3465d2,_0x163e6a){var _0x73be36=_0x3b9fea;if(!_0x3465d2||!_0x3465d2[_0x73be36(0x320)]||!_0x3465d2[_0x73be36(0x320)][_0x73be36(0x21a)])return null;if(_0x163e6a)for(var _0x356e29=0x0;_0x356e29<_0x3465d2['translations']['length'];_0x356e29++){if(_0x3465d2[_0x73be36(0x320)][_0x356e29]['id']===_0x163e6a)return _0x3465d2[_0x73be36(0x320)][_0x356e29]['file_id'];}return _0x3465d2[_0x73be36(0x320)][0x0][_0x73be36(0x283)];}function _0xace12e(_0x4bacaf){var _0x65f0ca=_0x3b9fea;if(!_0x4bacaf)return _0x65f0ca(0x1f3);return'kp:'+(_0x4bacaf[_0x65f0ca(0x291)]||_0x4bacaf[_0x65f0ca(0x2b3)]&&_0x4bacaf[_0x65f0ca(0x2b3)]['kp']||'')+'|imdb:'+(_0x4bacaf[_0x65f0ca(0x2cf)]||_0x4bacaf['ids']&&_0x4bacaf[_0x65f0ca(0x2b3)]['imdb']||'')+_0x65f0ca(0x1b3)+(_0x4bacaf['id']||'');}function _0x273271(_0xe4fbd8){var _0x3aa73c=_0x3b9fea;try{return localStorage[_0x3aa73c(0x13d)](_0x3aa73c(0x243)+_0xace12e(_0xe4fbd8))||null;}catch(_0x3fa2ce){return null;}}function _0x2aa1d4(_0x2f513f,_0xbe873d){var _0x32555a=_0x3b9fea;try{localStorage[_0x32555a(0x354)](_0x32555a(0x243)+_0xace12e(_0x2f513f),String(_0xbe873d));}catch(_0x23b795){}}function _0x876cd2(_0x306b22){var _0x348399=_0x3b9fea;try{Lampa[_0x348399(0x294)][_0x348399(0x14d)](_0x306b22);}catch(_0x183a8f){console[_0x348399(0x1d4)](_0x348399(0x225),_0x348399(0x273),_0x183a8f);if(_0x306b22[_0x348399(0x2ac)]&&_0x306b22['items'][_0x348399(0x21a)]&&_0x306b22[_0x348399(0x296)])_0x306b22[_0x348399(0x296)](_0x306b22['items'][0x0]);}}function _0x106b06(_0x9a37db,_0x4a0945){var _0x14b9dc=_0x3b9fea,_0x143b72=_0x9a37db[_0x14b9dc(0x2eb)][_0x14b9dc(0x166)](function(_0x297d56){var _0x4c004f=_0x14b9dc;return{'title':_0x4c004f(0x35e)+_0x297d56[_0x4c004f(0x286)],'subtitle':_0x297d56[_0x4c004f(0x369)][_0x4c004f(0x21a)]+_0x4c004f(0x1a0),'season':_0x297d56};});if(_0x143b72['length']===0x1)return _0x4a0945(_0x143b72[0x0][_0x14b9dc(0x268)]);_0x876cd2({'title':_0x14b9dc(0x327),'items':_0x143b72,'onSelect':function(_0x328714){var _0x3fd864=_0x14b9dc;_0x4a0945(_0x328714[_0x3fd864(0x268)]);},'onBack':function(){var _0x5d6a16=_0x14b9dc;try{Lampa[_0x5d6a16(0x32d)][_0x5d6a16(0x142)](_0x5d6a16(0x2fe));}catch(_0x36c8ac){}}});}function _0x4be310(_0x111e9e,_0x49d173,_0x100fca,_0x8ae8e2){var _0x227602=_0x111e9e%0xa,_0x18c059=_0x111e9e%0x64;if(_0x227602===0x1&&_0x18c059!==0xb)return _0x49d173;if(_0x227602>=0x2&&_0x227602<=0x4&&(_0x18c059<0xa||_0x18c059>=0x14))return _0x100fca;return _0x8ae8e2;}function _0x238791(_0x48cc02,_0x15faf7,_0x2ea2f1){var _0x5077bc=_0x3b9fea,_0x491187=_0x48cc02['episodes'][_0x5077bc(0x166)](function(_0x1fc35f){var _0x1d2c9f=_0x5077bc,_0x39506f=_0x1fc35f['translations']['length'];return{'title':_0x1d2c9f(0x188)+_0x1fc35f[_0x1d2c9f(0x286)],'subtitle':_0x39506f+'\x20'+_0x4be310(_0x39506f,_0x1d2c9f(0x2a8),_0x1d2c9f(0x1c9),_0x1d2c9f(0x203)),'episode':_0x1fc35f};});_0x876cd2({'title':_0x5077bc(0x35e)+_0x48cc02['number']+_0x5077bc(0x37c),'items':_0x491187,'onSelect':function(_0x2ada55){var _0x4a21c2=_0x5077bc;_0x15faf7(_0x2ada55[_0x4a21c2(0x298)]);},'onBack':_0x2ea2f1||function(){var _0x246ddf=_0x5077bc;try{Lampa[_0x246ddf(0x32d)][_0x246ddf(0x142)]('content');}catch(_0x1a4226){}}});}function _0x231a3d(_0x3c1466,_0x5c8145,_0x277f11,_0x1dc2f8){var _0x4f162e=_0x3b9fea;if(_0x3c1466[_0x4f162e(0x320)][_0x4f162e(0x21a)]===0x1)return _0x277f11(_0x3c1466[_0x4f162e(0x320)][0x0]);var _0x7506a8=_0x3c1466[_0x4f162e(0x320)][_0x4f162e(0x166)](function(_0x45e8df){var _0xa060cf=_0x4f162e;return{'title':_0x45e8df[_0xa060cf(0x290)],'id':_0x45e8df['id'],'tr':_0x45e8df};});if(_0x5c8145)for(var _0x4a5aae=0x0;_0x4a5aae<_0x7506a8[_0x4f162e(0x21a)];_0x4a5aae++){if(_0x7506a8[_0x4a5aae]['id']===_0x5c8145){var _0x360155=_0x7506a8[_0x4f162e(0x2d7)](_0x4a5aae,0x1)[0x0];_0x360155[_0x4f162e(0x159)]=_0x4f162e(0x144),_0x7506a8[_0x4f162e(0x387)](_0x360155);break;}}_0x876cd2({'title':_0x4f162e(0x18f),'items':_0x7506a8,'onSelect':function(_0x35883e){_0x277f11(_0x35883e['tr']);},'onBack':_0x1dc2f8||function(){var _0x4a3ee5=_0x4f162e;try{Lampa[_0x4a3ee5(0x32d)][_0x4a3ee5(0x142)](_0x4a3ee5(0x2fe));}catch(_0x578142){}}});}function _0x46cf13(_0xb1945a,_0x5d7076,_0x519789,_0x517e2e){var _0x1ff08d=_0x3b9fea;if(_0xb1945a[_0x1ff08d(0x21a)]<=0x1)return _0x519789(_0xb1945a[0x0],0x0);var _0x475f0d=_0xb1945a[_0x1ff08d(0x166)](function(_0x120925,_0x55ea5b){var _0x45b4bd=_0x1ff08d;return{'title':_0x120925[_0x45b4bd(0x37b)]||_0x45b4bd(0x392)+(_0x55ea5b+0x1),'id':String(_0x120925[_0x45b4bd(0x1a6)]||_0x55ea5b),'idx':_0x55ea5b,'src':_0x120925};});if(_0x5d7076)for(var _0x3e03a8=0x0;_0x3e03a8<_0x475f0d[_0x1ff08d(0x21a)];_0x3e03a8++){if(_0x475f0d[_0x3e03a8]['id']===String(_0x5d7076)){var _0x471f10=_0x475f0d[_0x1ff08d(0x2d7)](_0x3e03a8,0x1)[0x0];_0x471f10['subtitle']=_0x1ff08d(0x144),_0x475f0d[_0x1ff08d(0x387)](_0x471f10);break;}}_0x876cd2({'title':_0x1ff08d(0x18f),'items':_0x475f0d,'onSelect':function(_0x3bbdbe){var _0x390bfa=_0x1ff08d;_0x519789(_0x3bbdbe[_0x390bfa(0x2e5)],_0x3bbdbe[_0x390bfa(0x195)]);},'onBack':_0x517e2e||function(){var _0x517c23=_0x1ff08d;try{Lampa[_0x517c23(0x32d)][_0x517c23(0x142)]('content');}catch(_0x59bbac){}}});}function _0x36d549(_0x9f9342){var _0x49f033=_0x3b9fea,_0x2ad110={'value':null},_0x15cd84=null,_0x186159=null,_0x2c3f70=null;
var _amediaJob=_amediaClient.begin(_0x9f9342);
var _0x51ad39=function(){},_0x1621b4=function(){};
_amediaClient.own(_amediaJob,function(){
    function release(resource){try{if(resource)resource.close();}catch(ignored){}}
    release(_0x15cd84);release(_0x186159);release(_0x2c3f70);
    try{_0x51ad39();}catch(ignored){}
    try{_0x1621b4();}catch(ignored){}
});
return window[_0x49f033(0x30e)]=Date['now'](),window[_0x49f033(0x343)]=0x0,_0x302e2a(_0x9f9342[_0x49f033(0x331)],_0x9f9342['hP'])[_0x49f033(0x19e)](function(){var _0x5ebfac=_0x49f033;return _amediaClient.seed(_amediaJob,_0x9f9342,_0xbd84c7);})[_0x49f033(0x19e)](function(_0x5653d3){var _0x3601a7=_0x49f033;_amediaClient.check(_amediaJob);try{_0x32e839({'kp':_0x9f9342['kp']||_0x9f9342[_0x3601a7(0x157)]['kp'],'mt':_0x9f9342[_0x3601a7(0x157)][_0x3601a7(0x1f6)]||_0x9f9342[_0x3601a7(0x157)][_0x3601a7(0x361)]||'','embedUrl':_0x9f9342[_0x3601a7(0x157)][_0x3601a7(0x1c8)],'cat':_0x3601a7(0x1d5),'trailer':![]});}catch(_0x48aa7d){_0x529c49(_0x3601a7(0x1ef),_0x48aa7d&&_0x48aa7d[_0x3601a7(0x2d6)]);}return _0x5653d3;})[_0x49f033(0x19e)](function(_0x5c9a2b){var _0x316438=_0x49f033;return _0x5c9a2b;})[_0x49f033(0x19e)](function(_0x19156e){var _0x3f2b25=_0x49f033,_0x34b63c=_0x19156e[_0x3f2b25(0x135)]&&_0x19156e[_0x3f2b25(0x135)][_0x3f2b25(0x250)]||[];if(!_0x34b63c[_0x3f2b25(0x21a)])throw new Error('Поток\x20не\x20найден');return Promise[_0x3f2b25(0x364)](_0x9f9342[_0x3f2b25(0x284)]?_0x9f9342[_0x3f2b25(0x284)](_0x34b63c,_0x9f9342[_0x3f2b25(0x1d5)]):0x0)[_0x3f2b25(0x19e)](function(_0xe87f20){return{'res':_0x19156e,'hls':_0x34b63c,'idx':_0xe87f20|0x0};});})[_0x49f033(0x19e)](function(_0x1d2169){var _0x44c8a8=_0x49f033,_0x2f2167=_0x1d2169[_0x44c8a8(0x288)],_0x3fef22=_0x1d2169[_0x44c8a8(0x1a2)],_0x229d7f=_0x3fef22[_0x1d2169[_0x44c8a8(0x195)]]||_0x3fef22[0x0],_0x18584c=_0x1ef8f4(_0x229d7f[_0x44c8a8(0x226)]);if(!_0x18584c)throw new Error('Поток\x20не\x20найден');var _0x1af197=_0x3f577f(_0x229d7f[_0x44c8a8(0x226)]),_0x3a4edf=_amediaClient.selectedResolution(_0x9f9342,_0x1af197,(_0x1af197[_0x44c8a8(0x132)]?_0x44c8a8(0x20d):_0x1af197[_0x44c8a8(0x35b)]?_0x44c8a8(0x1f5):_0x1af197[_0x44c8a8(0x256)]?_0x44c8a8(0x307):_0x44c8a8(0x307))),_0x555155=[];(function(){var _0xe84546=_0x44c8a8;for(var _0x558b23=0x0;_0x558b23<_0x3fef22[_0xe84546(0x21a)];_0x558b23++){var _0x47910a=_0x3fef22[_0x558b23][_0xe84546(0x226)]||{};for(var _0x1c37a2 in _0x47910a){var _0x2802c1=String(_0x47910a[_0x1c37a2]||'')[_0xe84546(0x265)](_0xe84546(0x381));for(var _0x22390e=0x0;_0x22390e<_0x2802c1[_0xe84546(0x21a)];_0x22390e++){var _0x46e04f=_0x2802c1[_0x22390e][_0xe84546(0x2ca)](),_0x394fa7=_0x46e04f[_0xe84546(0x37a)](/^https?:\/\/([^\/]+)/);if(_0x394fa7&&_0x555155[_0xe84546(0x245)](_0x394fa7[0x1])===-0x1)_0x555155[_0xe84546(0x139)](_0x394fa7[0x1]);}}}}()),_0x529c49(_0x44c8a8(0x1f8),_0x555155['length'],_0x44c8a8(0x2da),_0x555155[_0x44c8a8(0x1ea)](_0x44c8a8(0x323))),window[_0x44c8a8(0x353)]=_0x555155,window['__amediaCdnActiveIdx']=0x0;var _0x3a6614={'User-Agent':_0x3136da,'Origin':_0x425e28['domain'],'Referer':_0x9f9342[_0x44c8a8(0x157)][_0x44c8a8(0x1c8)],'Accepts-Controls':_0x2ad110[_0x44c8a8(0x368)]||_0x9f9342['hP'],'Authorizations':_0x44c8a8(0x306)+_0x9f9342[_0x44c8a8(0x331)]};_amediaClient.check(_amediaJob);_0x15cd84=_0x1cb92a({'pnr':_0x2f2167['data'][_0x44c8a8(0x313)],'pnk':_0x2f2167[_0x44c8a8(0x135)][_0x44c8a8(0x347)],'resolution':_0x3a4edf,'trackId':_0x229d7f[_0x44c8a8(0x1a6)]||'1','edgeHashHolder':_0x2ad110,'getCurrentTime':function(){return _amediaClient.currentTime(_amediaJob,_0x2aea50);},'getResolution':function(){return _amediaJob.mode==='inner'?_0x4b4332():_0x3a4edf;},'onEdgeHashChange':function(_0x17f299){var _0x152850=_0x44c8a8;_0x3a6614[_0x152850(0x355)]=_0x17f299,_0x529c49('edge_hash\x20rotated\x20→\x20updated\x20Accepts-Controls');if(_0x551277[_0x152850(0x266)])_0x302e2a(_0x9f9342['guard'],_0x17f299);}}),_0x186159=(_amediaJob.mode==='inner'?_0x474641({'refererUrl':_0x9f9342[_0x44c8a8(0x157)]['embedUrl'],'manifestUrl':_0x18584c,'getVideo':function(){var _0x15b520=_0x44c8a8;try{return Lampa['Player'][_0x15b520(0x212)]&&Lampa[_0x15b520(0x22f)][_0x15b520(0x212)]();}catch(_0x2ea7e2){return null;}},'getHls':function(){var _0xbf2b4b=_0x44c8a8;try{return Lampa['Player'][_0xbf2b4b(0x1a2)]&&Lampa['Player'][_0xbf2b4b(0x1a2)]()||Lampa[_0xbf2b4b(0x22f)]['video']&&Lampa[_0xbf2b4b(0x22f)][_0xbf2b4b(0x212)]()&&Lampa[_0xbf2b4b(0x22f)]['video']()[_0xbf2b4b(0x1a2)]||null;}catch(_0x3c0f5a){return null;}},'getQualityLabel':function(){var _0x70c48a=_0x44c8a8,_0x1c2c1b=null;try{_0x1c2c1b=Lampa[_0x70c48a(0x22f)][_0x70c48a(0x212)]&&Lampa[_0x70c48a(0x22f)][_0x70c48a(0x212)]();}catch(_0x85adaa){}return _0x1c2c1b&&_0x1c2c1b['videoHeight']||0x0;},'getAudioTrackLabel':function(){var _0x1c843b=_0x44c8a8;try{var _0x5f3c13=Lampa['Player']['hls']&&Lampa[_0x1c843b(0x22f)][_0x1c843b(0x1a2)]()||Lampa[_0x1c843b(0x22f)]['video']&&Lampa[_0x1c843b(0x22f)][_0x1c843b(0x212)]()&&Lampa[_0x1c843b(0x22f)][_0x1c843b(0x212)]()['hls'];if(_0x5f3c13&&_0x5f3c13[_0x1c843b(0x2f9)]&&typeof _0x5f3c13[_0x1c843b(0x1df)]===_0x1c843b(0x286)&&_0x5f3c13[_0x1c843b(0x2f9)][_0x5f3c13[_0x1c843b(0x1df)]])return _0x5f3c13[_0x1c843b(0x2f9)][_0x5f3c13[_0x1c843b(0x1df)]]['name']||_0x5f3c13['audioTracks'][_0x5f3c13[_0x1c843b(0x1df)]][_0x1c843b(0x37b)]||'';}catch(_0x15f81a){}return'';}}):null),_0x2c3f70=(_amediaJob.mode==='inner'?
    _amediaClient.rotate(_amediaJob,_0x9f9342,_0xbd84c7):null);var _0x36c4c5={'url':_0x18584c,'title':_0x9f9342[_0x44c8a8(0x22e)],'quality':_0x1af197,'headers':_0x3a6614,'hls_headers':_0x3a6614,'player':_0x44c8a8(0x1cb),'inner':!![],'player_external':![]},_0x23c99e=_0x51caaa();if(_0x23c99e)_0x36c4c5[_0x44c8a8(0x36f)]=_0x23c99e;try{Lampa[_0x44c8a8(0x32d)][_0x44c8a8(0x142)](_0x44c8a8(0x2fe));}catch(_0xa9dff6){}var _amediaInner=_amediaClient.isInner(_amediaJob);
_0x51ad39=_amediaInner?_0x1d7a2f(_0x3a6614):function(){};
_0x1621b4=(_amediaInner&&!_0x551277[_0x44c8a8(0x266)])?_0x2e2363(_0x3a6614):function(){};
_amediaClient.prepare(_amediaJob,_0x36c4c5,_0x9f9342);
if (_amediaJob.mode === 'inner')
    _amediaClient.recoverStream(_amediaJob,_0x9f9342,_0x36c4c5,_0xbd84c7,function(track){
        return track[_0x44c8a8(0x226)] || {};
    });
if (_amediaJob.mode === 'inner' && _0x9f9342.queuePlan && _0x9f9342.queuePlan.length) {
    // Resolve the next episode only on selection, with fresh signed headers
    // and its own CDN bridge. Android continues to use real URL arrays.
    setTimeout(function(){
        if(!_amediaClient.isInner(_amediaJob))return;
        _amediaClient.prepareLazyInnerQueue(_amediaJob,_0x9f9342,_0x36c4c5,_0xbd84c7,function(track){
            return track[_0x44c8a8(0x226)] || {};
        });
        _amediaClient.publishInnerQueue(_amediaJob,_0x36c4c5);
    },250);
}
// Android's external Intent freezes signed URLs and uses a single set of
// root HTTP headers. Pre-resolving upcoming episodes here delays the FIRST
// frame and later produces expired/incompatible HLS manifests. Hand over the
// selected stream immediately; on confirmed completion the existing Android
// return handler re-resolves the next episode in a fresh authenticated session.
if (_amediaJob.mode === 'android') {
    if (_0x9f9342.queuePlan && _0x9f9342.queuePlan.length) {
        // Full selected season, bounded by the stream resolver's preparation
        // deadline. Always launch the currently resolved stream even when
        // some neighboring Skaz manifests cannot be authenticated.
        return _amediaClient.makeQueue(_amediaJob,_0x9f9342,_0x36c4c5,_0xbd84c7,function(track){
            return track[_0x44c8a8(0x226)] || {};
        }).then(function(){
            _amediaClient.check(_amediaJob);
            // Do not override the selected player even if Skaz cannot
            // sign the entire Android queue. Diagnostic notice is in launch().
            _amediaClient.launch(_amediaJob,_0x36c4c5);
        },function(error){
            _amediaClient.check(_amediaJob);
            _amediaClient.launch(_amediaJob,_0x36c4c5);
        });
    }
    _amediaClient.launch(_amediaJob,_0x36c4c5);
    return;
}
_amediaClient.launch(_amediaJob,_0x36c4c5);if(_amediaClient.isInner(_amediaJob)){try{var _0x3fef22=Lampa['Player']['hls']&&Lampa[_0x44c8a8(0x22f)][_0x44c8a8(0x1a2)]()||Lampa[_0x44c8a8(0x22f)][_0x44c8a8(0x212)]&&Lampa['Player'][_0x44c8a8(0x212)]()&&Lampa[_0x44c8a8(0x22f)][_0x44c8a8(0x212)]()[_0x44c8a8(0x1a2)];_0x3fef22&&_0x3fef22[_0x44c8a8(0x192)]&&(typeof _0x3fef22[_0x44c8a8(0x192)][_0x44c8a8(0x178)]===_0x44c8a8(0x286)&&(_0x3fef22['config'][_0x44c8a8(0x178)]=0xafc8),typeof _0x3fef22[_0x44c8a8(0x192)][_0x44c8a8(0x1bb)]===_0x44c8a8(0x286)&&(_0x3fef22['config'][_0x44c8a8(0x1bb)]=0xafc8),typeof _0x3fef22['config']['levelLoadingTimeOut']===_0x44c8a8(0x286)&&(_0x3fef22['config'][_0x44c8a8(0x154)]=0xafc8));}catch(_0x11e214){}try{var _0x129142=Lampa[_0x44c8a8(0x22f)][_0x44c8a8(0x212)]&&Lampa['Player'][_0x44c8a8(0x212)]();if(_0x129142&&_0x129142['addEventListener']){_amediaClient.listen(_amediaJob,_0x129142,_0x44c8a8(0x260),function(){var _0x134e3c=_0x44c8a8;_0x15cd84&&_0x15cd84[_0x134e3c(0x30a)](),_0x186159&&_0x186159[_0x134e3c(0x152)]();}),_amediaClient.listen(_amediaJob,_0x129142,_0x44c8a8(0x1b7),function(){var _0x107b97=_0x44c8a8;_0x15cd84&&_0x15cd84[_0x107b97(0x2d0)](),_0x186159&&_0x186159['recordPlay']();}),_amediaClient.listen(_amediaJob,_0x129142,'seeking',function(){var _0x17ee9e=_0x44c8a8;_0x186159&&_0x186159[_0x17ee9e(0x2e8)]();}),_amediaClient.listen(_amediaJob,_0x129142,_0x44c8a8(0x330),function(){var _0x524355=_0x44c8a8;_0x15cd84&&_0x15cd84['seeked'](),_0x186159&&_0x186159[_0x524355(0x14c)]();});var _0x279313=![];_amediaClient.listen(_amediaJob,_0x129142,_0x44c8a8(0x310),function(){var _0x16b572=_0x44c8a8;if(!_0x279313)return;_0x186159&&_0x186159[_0x16b572(0x1d1)]();}),_amediaClient.listen(_amediaJob,_0x129142,_0x44c8a8(0x16a),function(){var _0x41c42f=_0x44c8a8;if(!_0x279313){_0x279313=!![];return;}_0x186159&&_0x186159[_0x41c42f(0x35a)]();});}}catch(_0x4b426c){}try{var _0x3fef22=Lampa['Player'][_0x44c8a8(0x1a2)]&&Lampa[_0x44c8a8(0x22f)]['hls']()||Lampa[_0x44c8a8(0x22f)][_0x44c8a8(0x212)]&&Lampa[_0x44c8a8(0x22f)][_0x44c8a8(0x212)]()&&Lampa[_0x44c8a8(0x22f)][_0x44c8a8(0x212)]()[_0x44c8a8(0x1a2)];_0x3fef22&&_0x3fef22['on']&&window['Hls']&&window[_0x44c8a8(0x2af)][_0x44c8a8(0x390)]&&_amediaClient.hlsOn(_amediaJob,_0x3fef22,window['Hls'][_0x44c8a8(0x390)][_0x44c8a8(0x17f)],function(_0x3e0a40,_0x508bc9){var _0x3b0f06=_0x44c8a8;if(!_0x186159||!_0x508bc9)return;var _0x48766e=null;try{_0x48766e=Lampa['Player'][_0x3b0f06(0x212)]&&Lampa[_0x3b0f06(0x22f)]['video']();}catch(_0x4e95f6){}var _0x216a86=_0x508bc9['frag']||{},_0x4c35ce=_0x508bc9['response']||{},_0x2f0cab={'type':_0x508bc9[_0x3b0f06(0x14e)]||_0x3b0f06(0x238),'details':_0x508bc9[_0x3b0f06(0x210)]||'','fatal':!!_0x508bc9['fatal'],'parent':_0x216a86[_0x3b0f06(0x14e)]||null,'url':_0x508bc9[_0x3b0f06(0x374)]||_0x216a86[_0x3b0f06(0x374)]||null,'manifestUrl':_0x9f9342[_0x3b0f06(0x157)][_0x3b0f06(0x1c8)]||'','reason':_0x508bc9[_0x3b0f06(0x14b)]||(_0x4c35ce['text']||_0x4c35ce['statusText'])||_0x508bc9[_0x3b0f06(0x1d4)]&&_0x508bc9[_0x3b0f06(0x1d4)][_0x3b0f06(0x2d6)]||'','errorName':_0x508bc9[_0x3b0f06(0x1d4)]&&_0x508bc9[_0x3b0f06(0x1d4)][_0x3b0f06(0x290)]||_0x3b0f06(0x1fc),'errorStack':_0x508bc9[_0x3b0f06(0x1d4)]&&_0x508bc9['error']['stack']||'','aborted':!!_0x508bc9['aborted'],'onlineState':!!(navigator&&navigator['onLine']),'visibility':document[_0x3b0f06(0x1b5)]||_0x3b0f06(0x182),'hasFocus':!!(document[_0x3b0f06(0x379)]&&document[_0x3b0f06(0x379)]()),'saveData':!!(navigator[_0x3b0f06(0x388)]&&navigator[_0x3b0f06(0x388)][_0x3b0f06(0x2dc)]),'rtt':navigator[_0x3b0f06(0x388)]&&navigator[_0x3b0f06(0x388)]['rtt']||0x0,'effectiveTypeAtError':navigator[_0x3b0f06(0x388)]&&navigator[_0x3b0f06(0x388)][_0x3b0f06(0x31d)]||'4g','httpCode':typeof _0x4c35ce[_0x3b0f06(0x189)]===_0x3b0f06(0x286)?_0x4c35ce[_0x3b0f06(0x189)]:null,'httpText':_0x4c35ce[_0x3b0f06(0x1cc)]||null,'currentTime':_0x48766e&&_0x48766e[_0x3b0f06(0x28d)]||0x0,'duration':_0x48766e&&_0x48766e[_0x3b0f06(0x151)]&&isFinite(_0x48766e[_0x3b0f06(0x151)])?_0x48766e[_0x3b0f06(0x151)]:0x0,'bufferLength':0x0,'droppedFrames':0x0,'paused':!!(_0x48766e&&_0x48766e[_0x3b0f06(0x30a)]),'bandwidthEstimate':_0x3fef22['bandwidthEstimate']||0x0,'readyState':_0x48766e&&_0x48766e[_0x3b0f06(0x38f)]||0x0,'networkState':_0x48766e&&_0x48766e['networkState']||0x0,'seeking':!!(_0x48766e&&_0x48766e[_0x3b0f06(0x184)]),'quality':_0x48766e&&_0x48766e[_0x3b0f06(0x26e)]||0x0,'fragSn':typeof _0x216a86['sn']===_0x3b0f06(0x286)?_0x216a86['sn']:null,'fragStart':typeof _0x216a86[_0x3b0f06(0x281)]===_0x3b0f06(0x286)?_0x216a86[_0x3b0f06(0x281)]:null,'fragDuration':typeof _0x216a86[_0x3b0f06(0x151)]===_0x3b0f06(0x286)?_0x216a86['duration']:null,'fragLevel':typeof _0x216a86[_0x3b0f06(0x156)]===_0x3b0f06(0x286)?_0x216a86[_0x3b0f06(0x156)]:null};try{if(_0x48766e&&_0x48766e['buffered']&&_0x48766e[_0x3b0f06(0x17a)]['length']){var _0x554407=_0x48766e[_0x3b0f06(0x28d)]||0x0;for(var _0x62cae4=_0x48766e[_0x3b0f06(0x17a)][_0x3b0f06(0x21a)]-0x1;_0x62cae4>=0x0;_0x62cae4--){if(_0x554407>=_0x48766e[_0x3b0f06(0x17a)][_0x3b0f06(0x281)](_0x62cae4)&&_0x554407<=_0x48766e['buffered'][_0x3b0f06(0x1db)](_0x62cae4)){_0x2f0cab[_0x3b0f06(0x391)]=_0x48766e['buffered'][_0x3b0f06(0x1db)](_0x62cae4)-_0x554407;break;}}}_0x48766e&&typeof _0x48766e[_0x3b0f06(0x33f)]===_0x3b0f06(0x334)&&(_0x2f0cab[_0x3b0f06(0x1bf)]=_0x48766e[_0x3b0f06(0x33f)]()[_0x3b0f06(0x1b9)]||0x0);}catch(_0x1e2655){}_0x186159[_0x3b0f06(0x1ff)](_0x2f0cab);});}catch(_0x4607d1){}}}).catch(function(_amediaError){_amediaClient.failJob(_amediaJob);throw _amediaError;});}function _0x252726(movie, request) {
    if (_0x5c1046) { Lampa.Noty.show(_0x477bec); return Promise.resolve(); }
    return _amediaClient.open(movie, {
        lookup: function (card) {
            return _0x32ae74(400).then(function () { return _0x2ee326(); }).then(function (hP) {
                return Promise.all([_0x22cdc5(card), _0x51774d(hP)]).then(function (result) {
                    return {embed: result[0], guard: result[1], hP: hP};
                });
            });
        },
        tree: _0x458f36,
        getVoice: _0x273271,
        setVoice: _0x2aa1d4,
        guard: _0x51774d,
        play: _0x36d549
    }, request || {});
}
var _0x840ae5=_0x3b9fea(0x2f5)+_0x425e28['description']+'\x22>'+_0x3b9fea(0x393)+'<path\x20d=\x22M8\x205v14l11-7z\x22\x20fill=\x22currentColor\x22/>'+_0x3b9fea(0x150)+'<span>'+_0x425e28[_0x3b9fea(0x290)]+_0x3b9fea(0x2ff)+_0x3b9fea(0x276);function _0x220c04(params) {
    if (!params || !params.render || !params.render.length) return;
    var movie = params.movie || {};
    var watch = params.render.find('.full-start-new__buttons .button--play').first();
    var toolbar = params.render.find('.full-start-new__buttons').first();
    if (params.render.find('.amedia-native-watch').length) return;
    // A serial can have a seasons button but no generic Play button.
    // The Amedia hub must be accessible for BOTH movies and series.
    if (!watch.length && toolbar.length) watch = toolbar.find('.button, .selector').first();
    if (!watch.length && !toolbar.length) return;
    var button = $(_0x840ae5);
    button.addClass('amedia-native-watch').removeClass('hide');
    button.find('span').last().text('Amedia');
    button.on('hover:enter', function () { _0x252726(movie, {manual:false}); });
    button.on('hover:long', function () { _0x252726(movie, {manual:true}); });
    button.on('hover:focus hover:hover hover:touch', function (event) {
        if (params.start) params.start.last = event.target;
    });
    // Place next to the visible Lampa Watch button, not the hidden
    // .buttons--container used for source selection.
    if (watch.length) watch.before(button);
    else toolbar.append(button);
}
function _0x108f48(){var _0x4ac531=_0x3b9fea;Lampa[_0x4ac531(0x1c6)][_0x4ac531(0x148)](_0x4ac531(0x2f4),function(_0x2a442b){var _0xd0cf85=_0x4ac531;_0x2a442b[_0xd0cf85(0x14e)]===_0xd0cf85(0x1bd)&&_0x220c04({'render':_0x2a442b[_0xd0cf85(0x28a)][_0xd0cf85(0x2e6)]['render'](),'movie':_0x2a442b['data'][_0xd0cf85(0x1d5)],'start':_0x2a442b.link&&_0x2a442b.link.items&&_0x2a442b.link.items[0]});});try{Lampa[_0x4ac531(0x365)][_0x4ac531(0x29f)]()&&Lampa[_0x4ac531(0x365)]['active']()[_0x4ac531(0x336)]===_0x4ac531(0x2f4)&&_0x220c04({'render':Lampa[_0x4ac531(0x365)][_0x4ac531(0x29f)]()[_0x4ac531(0x2e6)][_0x4ac531(0x329)](),'movie':Lampa[_0x4ac531(0x365)]['active']()[_0x4ac531(0x170)],'start':Lampa.Activity.active().activity&&Lampa.Activity.active().activity.component&&Lampa.Activity.active().activity.component.items&&Lampa.Activity.active().activity.component.items[0]});}catch(_0x18e4e2){}}var _amediaClient;
/* Amedia by Skaz — client integration 5.0.0. Native Amedia hub and fresh-episode playback. */
function _amediaInit(){if(_amediaClient)return;_amediaClient=(function (root) {
    'use strict';
    var L = root.Lampa;
    var version = '5.15.2' + '-Lampa';
    var prefix = 'capsule_amedia_film_';
    var defaults = {player:'inner',seriesPlayer:'inner',quality:'auto',innerEngine:'auto',fastStart:true,playerWatchdog:true,autoNext:true,resume:true,diagnostics:false};
    var choices = {player:{inner:'Встроенный · Lampa',android:'Android · выбрать UA Player'},
        seriesPlayer:{inner:'Встроенный · Lampa',android:'Android · выбрать UA Player'},
        quality:{auto:'Авто · по сети','2160':'4K','1080':'1080p','720':'720p','480':'480p','360':'360p'},
        innerEngine:{auto:'Авто · Lampa',native:'Системный HLS',hlsjs:'HLS.js'}};
    var active = null, context = null, sequence = 0, settingsReady = false;
    // Seed tail belongs to each embed (see seed()), never globally.
    var selection = null;


    // Use the existing Lampa Episode instances and their own remote-control
    // handlers, on both Full-card episode rows and the native seasons screen.
    // No custom series screen is created.
    var nativeHookInstalled = false, lastMovie = null;
    function isSeries(movie) {
        return !!(movie && (movie.first_air_date || movie.media_type === 'tv' ||
            movie.type === 'tv' || movie.number_of_seasons > 0 ||
            (movie.name && !movie.release_date)));
    }
    function episodeCard(episode) {
        var activeActivity = L.Activity && L.Activity.active && L.Activity.active();
        var card = activeActivity && (activeActivity.card || activeActivity.movie ||
            activeActivity.activity && activeActivity.activity.component &&
            activeActivity.activity.component.props &&
            activeActivity.activity.component.props.get('movie'));
        if (!card) card = lastMovie;
        if (!card || !isSeries(card)) return null;
        if (episode && episode.original_name && card.original_name &&
            String(episode.original_name) !== String(card.original_name)) return null;
        return card;
    }
    function nativeEpisodePress(instance, isLong, original) {
        var data = instance && instance.data;
        if (!data || !isFinite(Number(data.episode_number)) || Number(data.episode_number) < 1 ||
            !isFinite(Number(data.season_number)) || Number(data.season_number) < 0 || data.comeing ||
            (data.air_date && Number(data.left_days) > 0)) {
            if (!isLong && original) return original(instance);
            return;
        }
        var movie = episodeCard(data);
        if (!movie) {
            if (!isLong && original) return original(instance);
            return;
        }
        // Do not treat the key-up following a long press as a second click.
        var now = Date.now();
        if (!isLong && data.__amediaLongAt && now - data.__amediaLongAt < 850) return;
        if (isLong) data.__amediaLongAt = now;
        if (data.__amediaPressedAt && now - data.__amediaPressedAt < 380) return;
        data.__amediaPressedAt = now;
        var safeTimeline = data.timeline && data.timeline.hash ? {
            hash:String(data.timeline.hash),
            time:Number(data.timeline.time) || 0,
            percent:Number(data.timeline.percent) || 0,
            duration:Number(data.timeline.duration) || 0
        } : null;
        _0x252726(movie, {
            season:Number(data.season_number), episode:Number(data.episode_number), manual:!!isLong,
            nativeTitle:String(data.name || data.title || ''),
            nativeThumbnail:imageUrl(data.img || data.still_path || '', 'w500'),
            nativeTimeline:safeTimeline
        });
    }
    function bindEpisodeInstance(instance) {
        var data = instance && instance.data;
        // Lampa Episode assumes an undated episode is always a future release.
        // An ordinary catalog fallback without an air date should not be dimmed
        // as 'coming soon'; explicit future dates/announcements remain locked.
        if (data && !data.air_date && !data.comeing &&
            Number(data.episode_number)>0 && Number(data.season_number)>0) {
            data.left_days=0;
            data.left_text='';
        }
        enrichEpisodeInstance(instance);
        if (!data || !data.params || typeof data.params.onEnter !== 'function' ||
            !Number.isFinite(Number(data.episode_number)) ||
            !Number.isFinite(Number(data.season_number)) || instance.__amediaNativeEpisode) return;
        instance.__amediaNativeEpisode = true;
        var nativeEnter = data.params.onEnter;
        data.params.onEnter = function (item) { return nativeEpisodePress(item, false, nativeEnter); };
        function bindLongPress() {
            if (instance.__amediaLongBound || !instance.html || !instance.html.on) return;
            instance.__amediaLongBound = true;
            // The full-episode card has Callback.onLong, but the dedicated
            // seasons screen uses Mark+Line only. Bind to their shared DOM
            // event rather than relying on a Callback module.
            instance.html.on('hover:long', function () { nativeEpisodePress(instance, true, null); });
        }
        if (instance.html && instance.html.on) bindLongPress();
        else if (typeof instance.use === 'function') instance.use({onCreate:bindLongPress});
    }



    // Optional catalog metadata: Amedia remains a playback source, while
    // native Lampa owns the pages. Do not modify any Lampa API global handler.
    var catalogCache = {};
    var catalogWaiters = {};
    var localizedSeasonRequests = {};
    function isCyrillicTitle(value){return /[А-Яа-яЁё]/.test(String(value || ''));}
    function catalogKey(movie) {
        if (!movie) return '';
        var type=isSeries(movie)?'tv':'movie';
        if(movie.id!==undefined && movie.id!==null && String(movie.id))
            return String(movie.source || 'tmdb')+':'+type+':'+String(movie.id);
        if(movie.tmdb_id) return 'tmdb:'+type+':'+String(movie.tmdb_id);
        var imdb=String(movie.imdb_id || movie.external_ids && movie.external_ids.imdb_id || '');
        if(/^tt\d{5,12}$/i.test(imdb))return 'imdb:'+type+':'+imdb;
        return 'title:'+type+':'+normalTitle(movie.original_name || movie.name ||
            movie.original_title || movie.title || '')+':'+String(movie.first_air_date || movie.release_date || '').slice(0,4);
    }
    function knownImdb(movie) {
        var id = String(movie && (movie.imdb_id || movie.external_ids && movie.external_ids.imdb_id ||
            movie.ids && movie.ids.imdb) || '');
        return /^tt[0-9]{5,12}$/i.test(id) ? id : '';
    }
    function catalogRequest(url, callback, failure) {
        var network;
        try {network = L.Reguest ? new L.Reguest() : L.Network;}catch (ignored) {network=L.Network;}
        if (!network || typeof network.quiet !== 'function') return safe(failure);
        try {
            if (network.timeout) network.timeout(6500);
            network.quiet(url, function (raw) {
                var data=raw;
                if (typeof raw === 'string') {
                    try {data=JSON.parse(raw);}catch (ignored) {return safe(failure);}
                }
                if (data && typeof data === 'object') callback(data);
                else safe(failure);
            }, function(){safe(failure);},null,{timeout:6500,dataType:'json'});
        }catch (ignored) {safe(failure);}
    }
    function normalTitle(input) {
        return String(input || '').toLowerCase().replace(/[^a-zа-яё0-9]/gi,'');
    }
    function matchingCatalog(movie, show) {
        var name=normalTitle(show && show.name);
        if (!name || name.length < 3) return false;
        var labels=[movie.original_name,movie.name,movie.original_title,movie.title];
        var found=labels.some(function (label) {
            var known=normalTitle(label);
            return known && known===name;
        });
        if (!found) return false;
        var year=Number(String(movie.first_air_date || movie.release_date || '').slice(0,4));
        var remote=Number(String(show.premiered || show.year || '').slice(0,4));
        return !year || !remote || Math.abs(year-remote) <= 1;
    }
    function makeCatalogEpisodes(rows, imdb) {
        var out = {};
        if (!Array.isArray(rows)) return out;
        rows.forEach(function (r) {
            if (!r) return;
            var season=Number(r.season !== undefined ? r.season : r.season_number);
            var episode=Number(r.number || r.episode || r.episode_number);
            if ((!season && season !== 0) || !episode) {
                var id=String(r.id || '');
                var parts=id.match(/^tt\d+:(\d+):(\d+)$/i);
                if(parts){season=Number(parts[1]);episode=Number(parts[2]);}
            }
            if (!isFinite(season) || season < 1 || season > 100 || !isFinite(episode) || episode < 1 || episode > 2000) return;
            var art=r.image && (r.image.original || r.image.medium || r.image) ||
                r.thumbnail || r.still_path || '';
            var image=imageUrl(art,'w500');
            var key=String(season) + ':' + String(episode);
            out[key]={
                season:season, number:episode,
                name:String(r.name || r.title || ''),
                image:image,
                runtime:Number(r.runtime) || 0,
                air_date:String(r.airdate || r.air_date || r.released || '').slice(0,10)
            };
        });
        return out;
    }
    function enrichCard(movie, record) {
        if (!movie || !record) return;
        if (!knownImdb(movie) && /^tt\d{5,12}$/i.test(record.imdb_id || ''))
            movie.imdb_id = record.imdb_id;
        if (!movie.tmdb_id && Number(record.tmdb_id) > 0)
            movie.tmdb_id = Number(record.tmdb_id);
        var cover=imageUrl(record.poster || '', 'w500');
        var currently=movie.img || movie.poster_path || '';
        // Lampa Start creates and loads its poster itself. Never replace a
        // present native poster, even if it is still waiting for lazy-load.
        if ((!currently || /img_broken/i.test(String(currently))) && cover)
            movie.img=cover;
        if (!isSeries(movie)) return;
        var counts={};
        Object.keys(record.episodes || {}).forEach(function (key) {
            var entry=record.episodes[key];
            if (entry && entry.season > 0) counts[entry.season]=(counts[entry.season]||0)+1;
        });
        var numbers=Object.keys(counts).map(Number);
        if (!numbers.length) return;
        var highest=Math.max.apply(null,numbers);
        movie.number_of_seasons=Math.max(Number(movie.number_of_seasons)||0,highest);
        if (!Array.isArray(movie.seasons)) movie.seasons=[];
        numbers.forEach(function (number) {
            var existing=movie.seasons.filter(function(x){return Number(x.season_number)===number;})[0];
            if (existing) {
                if (!Number(existing.episode_count)) existing.episode_count=counts[number];
            } else {
                movie.seasons.push({season_number:number,episode_count:counts[number],
                    name:'Сезон '+number});
            }
        });
        movie.seasons.sort(function(a,b){return Number(a.season_number)-Number(b.season_number);});
    }
    function drawCatalog(movie, record) {
        // Never assign IMG.src on the Full/Season DOM: Lampa installs its own
        // onload/visible hooks and CSS classes, and direct .attr('src') made
        // posters and episode stills invisible in 4.6/4.7.
        // Only enrich the underlying episode data. Visible cards that are
        // already loaded continue to use their original reliable art.
        var activity=L.Activity && L.Activity.active && L.Activity.active();
        if (!activity || !activity.card || String(activity.card.id)!==String(movie.id) ||
            String(activity.card.source || 'tmdb')!==String(movie.source || 'tmdb')) return;
        if (record.poster && movie.img &&
            (!movie.poster_path || /img_broken/i.test(String(movie.poster_path))) &&
            root.innerWidth > 480 && L.Utils && L.Utils.imgLoad) {
            // Late fallback for a genuinely missing poster, respecting the
            // same loaded CSS class Lampa Poster.onCreate normally provides.
            var rootHtml=activity.activity && activity.activity.component &&
                activity.activity.component.html;
            if(rootHtml && rootHtml.find) {
                var cover=rootHtml.find('.full-start-new__img');
                if(cover && cover.length && (!cover[0].src ||
                    /img_broken/i.test(String(cover[0].src)))) {
                    L.Utils.imgLoad(cover,movie.img,function(){
                        cover.parent().addClass('loaded');
                    });
                }
            }
        }
        var groups=activity.activity && activity.activity.component &&
            activity.activity.component.items || [];
        groups.forEach(function(group) {
            (group.items || []).forEach(function(item) {
                var data=item && item.data;
                if (!data || !data.episode_number || !data.season_number) return;
                var found=record.episodes &&
                    record.episodes[data.season_number+':'+data.episode_number];
                if (!found) return;
                if ((!data.name || isGenericEpisodeName(data.name)) && found.name) {
                    data.name=found.name;
                    data.title=found.name;
                    if(item.html && item.html.find) {
                        var label=item.html.find('.season-episode__title,.full-episode__name');
                        if(label && label.text)label.text(found.name);
                    }
                }
                if (!data.still_path && !data.img && found.image) {
                    data.img=found.image;
                    // Late metadata must go through Lampa's loader, not raw
                    // src mutation. It sets full-episode--loaded on success.
                    if(item.html && item.html.find && L.Utils && L.Utils.imgLoad) {
                        var image=item.html.find('img');
                        if(image && image.length) {
                            if(item.html.hasClass && item.html.hasClass('full-episode--small'))
                                L.Utils.imgLoad(image,found.image,function(){
                                    item.html.addClass('full-episode--loaded');
                                });
                            else if(item.html.hasClass && item.html.hasClass('season-episode'))
                                L.Utils.imgLoad(image,found.image,function(){
                                    var container=item.html.find('.season-episode__img');
                                    container.addClass('season-episode__img--loaded');
                                    container.find('.season-episode__episode-number,.season-episode__loader').remove();
                                });
                        }
                    }
                }
            });
        });
    }
    function acceptCatalog(movie, data, provider, imdbVerified) {
        if (!data || !movie) return;
        var key=catalogKey(movie), record=catalogCache[key] || {episodes:{}, poster:''};
        var episodes=makeCatalogEpisodes(data.episodes || [], knownImdb(movie));
        // Original Lampa names and images always take priority; TVmaze and
        // Cinemeta only fill missing fields in a shared low-priority cache.
        Object.keys(episodes).forEach(function (episodeKey) {
            var entry=episodes[episodeKey], old=record.episodes[episodeKey] || {};
            var localized=(provider==='tmdb-ru'||provider==='lampa-season')&&
                isCyrillicTitle(entry.name)&&!isGenericEpisodeName(entry.name);
            record.episodes[episodeKey]={
                season:entry.season,number:entry.number,
                name:localized?entry.name:(old.name||entry.name),
                ru_name:localized?entry.name:(old.ru_name||''),
                image:old.image||entry.image,
                runtime:old.runtime||entry.runtime,
                air_date:old.air_date||entry.air_date
            };
        });
        if (!record.poster) record.poster=imageUrl(data.poster || '', 'w500');
        if (data.imdb_id && /^tt\d{5,12}$/i.test(String(data.imdb_id)))
            record.imdb_id=String(data.imdb_id);
        if (Number(data.tmdb_id)>0) record.tmdb_id=Number(data.tmdb_id);
        record.provider=record.provider || provider;
        catalogCache[key]=record;
        enrichCard(movie,record);
        drawCatalog(movie,record);
        if (context && live(context) && catalogKey(context.movie)===key &&
            context.hub && context.hub.alive && typeof context.hub.refreshCatalog==='function')
            safe(function(){context.hub.refreshCatalog(record);});
        var queued=catalogWaiters[key] || [];
        delete catalogWaiters[key];
        queued.forEach(function(fn){safe(fn);});
    }
    function requestCatalog(movie) {
        if (!movie) return;
        var key=catalogKey(movie);
        var old=catalogCache[key];
        var fresh=old && Date.now() - (old.startedAt || 0) <
            (Object.keys(old.episodes || {}).length || old.poster ? 6*60*60*1000 : 4*60*1000);
        if (!key || old && old.started && fresh) {
            if (catalogCache[key]) {enrichCard(movie,catalogCache[key]);drawCatalog(movie,catalogCache[key]);}
            return;
        }
        catalogCache[key]={started:true, startedAt:Date.now(), episodes:old && old.episodes || {}, poster:old && old.poster || ''};
        var imdb=knownImdb(movie);
        var type=isSeries(movie)?'series':'movie';
        if (imdb) {
            catalogRequest('https://v3-cinemeta.strem.io/meta/'+type+'/'+encodeURIComponent(imdb)+'.json',
                function(result) {
                    if(result.meta && String(result.meta.imdb_id || result.meta.id || imdb).indexOf(imdb) === 0)
                        acceptCatalog(movie,{poster:result.meta.poster || result.meta.background,
                            episodes:result.meta.videos || []},'cinemeta',true);
                });
        }
        if (!isSeries(movie)) return;
        function byId(show) {
            if (!show || !show.id) return;
            catalogRequest('https://api.tvmaze.com/shows/'+encodeURIComponent(show.id)+
                '?embed=episodes', function(result) {
                    if (!imdb && !matchingCatalog(movie,result)) return;
                    var episodes=result._embedded && result._embedded.episodes;
                    acceptCatalog(movie,{poster:result.image && (result.image.original || result.image.medium),
                        imdb_id:result.externals && result.externals.imdb,
                        tmdb_id:result.externals && result.externals.themoviedb,
                        episodes:episodes || []},'tvmaze',!!imdb);
                });
        }
        if (imdb) {
            catalogRequest('https://api.tvmaze.com/lookup/shows?imdb='+encodeURIComponent(imdb),
                byId);
        } else {
            var title=movie.original_name || movie.name || '';
            if (title) catalogRequest('https://api.tvmaze.com/singlesearch/shows?q='+
                encodeURIComponent(title)+'&embed=episodes', function(result) {
                    if (!matchingCatalog(movie,result)) return;
                    acceptCatalog(movie,{poster:result.image && (result.image.original || result.image.medium),
                        imdb_id:result.externals && result.externals.imdb,
                        tmdb_id:result.externals && result.externals.themoviedb,
                        episodes:result._embedded && result._embedded.episodes || []},'tvmaze',false);
                });
        }
    }

    // Request season-localized metadata independently from original Skaz playback.
    function requestLocalizedSeason(ctx,seasonNumber){
        if(!ctx||!ctx.movie||!isSeries(ctx.movie))return;
        var movie=ctx.movie,n=Number(seasonNumber);
        if(!isFinite(n)||n<1||n>100)return;
        var id=catalogKey(movie)+':'+n,last=localizedSeasonRequests[id]||0;
        if(Date.now()-last<5*60*1000)return;
        localizedSeasonRequests[id]=Date.now();
        function receive(result,provider){
            if(!result||!Array.isArray(result.episodes))return;
            var rows=result.episodes.filter(function(ep){
                return ep&&Number(ep.season_number!==undefined?ep.season_number:n)===n;
            }).map(function(ep){
                if(ep.season_number!==undefined)return ep;
                var copy=Object.assign({},ep);copy.season_number=n;return copy;
            });
            if(rows.length)acceptCatalog(movie,{episodes:rows},provider,true);
        }
        if(L.Api&&typeof L.Api.seasons==='function'){
            try{L.Api.seasons(movie,[n],function(data){
                var record=data&&(data[n]||data[String(n)]);
                if(record)receive(record,'lampa-season');
            });}catch(error){log('Сезон Lampa недоступен');}
        }
        var origin=String(movie.source||'tmdb').toLowerCase();
        var tmdbId=origin==='tmdb'?Number(movie.id||movie.tmdb_id):Number(movie.tmdb_id);
        if(Number.isInteger(tmdbId)&&tmdbId>0&&L.TMDB&&
            typeof L.TMDB.api==='function'&&typeof L.TMDB.key==='function'){
            try{
                var key=L.TMDB.key();
                if(key)catalogRequest(L.TMDB.api(
                    'tv/'+tmdbId+'/season/'+n+'?api_key='+encodeURIComponent(key)+'&language=ru-RU'
                ),function(data){receive(data,'tmdb-ru');});
            }catch(error){log('Русская локализация TMDB недоступна');}
        }
    }
    function enrichEpisodeInstance(instance) {
        var item=instance && instance.data, movie=episodeCard(item || {});
        if (!item || !movie) return;
        var record=catalogCache[catalogKey(movie)];
        var meta=record && record.episodes &&
            record.episodes[item.season_number+':'+item.episode_number];
        if (!meta) return;
        if ((!item.name || isGenericEpisodeName(item.name)) && meta.name) {item.name=meta.name;item.title=meta.name;}
        if (!item.img && !item.still_path && meta.image) item.img=meta.image;
    }
    function tuneNativeEpisodeLayout() {
        if (!root.document || root.document.getElementById('amedia-episode-polish-v46')) return;
        // Correct only problematic details. All Lampa templates, scrolling,
        // native buttons, handlers, colors and layout structure remain intact.
        var style = root.document.createElement('style');
        style.id = 'amedia-episode-polish-v46';
        style.textContent = [
            '.full-episode--small .full-episode__img img,.season-episode__img img{object-fit:cover;object-position:center;width:100%;height:100%}',
            '.full-episode--small .full-episode__name{line-height:1.35;overflow-wrap:anywhere}',
            '.full-episode--small .full-episode__body{min-width:0}',
            '.season-episode__body{min-width:0}',
            '.season-episode__head{min-width:0;align-items:baseline;gap:.75em}',
            '.season-episode__title{min-width:0;line-height:1.35;overflow-wrap:anywhere}',
            '.season-episode__time{white-space:nowrap;flex:none;font-variant-numeric:tabular-nums}',
            '.season-episode__footer{gap:.5em;align-items:center}',
            '.season-episode__info{min-width:0}',
            '.season-episode__quality{flex:none}',
            '@media(max-width:660px){.season-episode__head{flex-wrap:wrap;gap:.3em}.season-episode__time{font-size:.83em}}'
        ].join('\n');
        (root.document.head || root.document.documentElement).appendChild(style);
    }

    // Native Lampa deliberately reverses the Full episode row and opens the
    // final season by default. Keep its templates and callbacks; change only
    // the ordering and initial season, respecting saved playback progress.
    var fullEpisodesCache = {}, seasonFlowReady = false;
    function nativeEpisodeRows(movie, section) {
        var data = section && (section.episodes_original || section.episodes) || [];
        if (!Array.isArray(data) || !data.length) return [];
        if (data.some(function(ep){return ep && Number(ep.season_number) > 0;}))
            return data.filter(function(ep){return ep && Number(ep.episode_number) > 0;});
        var keys = L.Utils && L.Utils.splitEpisodesIntoSeasons &&
            L.Utils.splitEpisodesIntoSeasons(data) || {};
        var result=[];
        Object.keys(keys).forEach(function(k){(keys[k] || []).forEach(function(ep){result.push(ep);});});
        if (!result.length) result=data.map(function(ep,i){
            var copy=Object.assign({},ep);
            copy.season_number=1;
            copy.episode_number=Number(ep.episode_number)||i+1;
            return copy;
        });
        return result;
    }
    function lastSeasonKey(movie) {
        return prefix + 'series_position_' + preferenceKey(movie);
    }
    function saveEpisodePosition(movie, season, episode) {
        if (!movie || !isSeries(movie) || Number(season) < 1 || Number(episode) < 1) return;
        try {L.Storage.set(lastSeasonKey(movie),{
            season:Number(season), episode:Number(episode), updated:Date.now()
        });} catch(ignored) {}
    }
    function getResumeSeason(movie, episodes) {
        var all=Array.isArray(episodes) ? episodes.filter(function(e) {
            return e && Number(e.season_number) > 0 && Number(e.episode_number)>0;
        }) : [];
        all.sort(function(a,b) {
            return Number(a.season_number)-Number(b.season_number) ||
                Number(a.episode_number)-Number(b.episode_number);
        });
        var stored={};
        try{stored=L.Storage.get(lastSeasonKey(movie),{})||{};}catch(ignored){}
        var storedSeason=Number(stored.season);
        var max=Number(movie && movie.number_of_seasons)||0;
        if (Array.isArray(movie && movie.seasons))
            movie.seasons.forEach(function(v){max=Math.max(max,Number(v.season_number)||0);});
        if(all.length)max=Math.max(max,Number(all[all.length-1].season_number)||0);
        var watched=null, partial=null;
        if(all.length && L.Timeline && L.Timeline.view && L.Utils && L.Utils.hash) {
            var label=movie.original_name || movie.name || movie.title || '';
            all.forEach(function(ep) {
                var season=Number(ep.season_number), episode=Number(ep.episode_number);
                var hash=L.Utils.hash([season,season>10?':':'',episode,label].join(''));
                var link=L.Timeline.link ? L.Timeline.link(movie,season,episode):null;
                var state;
                try{state=L.Timeline.view(hash,link);}catch(ignored){return;}
                var pct=Number(state && state.percent)||0;
                if(pct<=0)return;
                var stamp=Number(state.updated)||0;
                var info={season:season,episode:episode,stamp:stamp,pct:pct};
                if(!watched || stamp>watched.stamp ||
                    stamp===watched.stamp && (season>watched.season ||
                        season===watched.season && episode>watched.episode))
                    watched=info;
                if(pct<95 && (!partial || stamp>partial.stamp ||
                    stamp===partial.stamp && (season>partial.season ||
                        season===partial.season && episode>partial.episode)))
                    partial=info;
            });
        }
        if (partial && (!watched || partial.stamp>=watched.stamp))return partial.season;
        if (watched) {
            if (watched.pct < 95)return watched.season;
            var next=all.filter(function(e){
                return Number(e.season_number)>watched.season ||
                    Number(e.season_number)===watched.season &&
                    Number(e.episode_number)>watched.episode;
            })[0];
            return next ? Number(next.season_number):watched.season;
        }
        if(storedSeason>=1 && (!max || storedSeason<=max))return storedSeason;
        return 1;
    }
    function cacheNativeFull(event) {
        if (!event || !event.data || !event.data.movie) return;
        var movie=event.data.movie, section=event.data.episodes;
        if (!isSeries(movie) || !section) return;
        var key=catalogKey(movie);
        var rows=nativeEpisodeRows(movie,section);
        if (rows.length) fullEpisodesCache[key]=rows.map(function(ep){return Object.assign({},ep);});
        var selection=getResumeSeason(movie,fullEpisodesCache[key] || rows);
        var count=Number(section.seasons_count)||0;
        if (count>1 && selection>=1 && selection<=Math.max(count,Number(movie.number_of_seasons)||0))
            section.seasons_count=selection;
    }
    function putAscendingEpisodes(input) {
        if (!input || !Array.isArray(input.results) || !input.results.length ||
            !input.movie || !isSeries(input.movie) || input.__amediaAscending) return;
        if (!input.results.every(function(ep) {
            return ep && Number.isFinite(Number(ep.episode_number)) &&
                Number(ep.episode_number)>0;
        })) return;
        input.__amediaAscending=true;
        input.results.sort(function(a,b){
            // Single-season cards legitimately omit season_number. Never let
            // NaN turn a comparison into an unstable/reversed native row.
            var left=Number(a.season_number), right=Number(b.season_number);
            if(!Number.isFinite(left))left=1;
            if(!Number.isFinite(right))right=1;
            return left-right || Number(a.episode_number)-Number(b.episode_number);
        });
    }

    function nativeSeasonSource(movie, season) {
        var number=Number(season);
        if (!movie || !isSeries(movie) || !Number.isInteger(number) || number<1) return null;
        var key=catalogKey(movie), cache=catalogCache[key] || {};
        var originals=fullEpisodesCache[key] || [];
        var results={};
        function add(item) {
            if(!item || Number(item.season_number)!==number) return;
            var n=Number(item.episode_number);
            if(!Number.isInteger(n) || n<1 || n>1000)return;
            var prev=results[n] || {season_number:number,episode_number:n};
            if (item.air_date && !prev.air_date) prev.air_date=String(item.air_date).slice(0,10);
            if (item.name && !isGenericEpisodeName(item.name) && (!prev.name || isGenericEpisodeName(prev.name)))
                prev.name=String(item.name);
            if(item.runtime && !prev.runtime)prev.runtime=Number(item.runtime);
            if(item.vote_average && !prev.vote_average)prev.vote_average=item.vote_average;
            var image=imageUrl(item.img || item.image || item.thumbnail, 'w500');
            if (!image && item.still_path) {
                if (/^https?:\/\//i.test(item.still_path))image=item.still_path;
                else prev.still_path=item.still_path;
            }
            if (image && !prev.img && !prev.still_path)prev.img=image;
            results[n]=prev;
        }
        originals.forEach(add);
        Object.keys(cache.episodes || {}).forEach(function(k){
            var data=cache.episodes[k];
            if(!data)return;
            add({
                season_number:data.season,episode_number:data.number,name:data.name,
                img:data.image, runtime:data.runtime,air_date:data.air_date
            });
        });
        var declared=Array.isArray(movie.seasons) && movie.seasons.filter(function(v){
            return Number(v.season_number)===number;
        })[0];
        var target=Math.max(0,Number(declared && declared.episode_count)||0);
        // A genuine catalog season episode count may be known even when all
        // episode descriptions are missing; show numbered native cards rather
        // than an empty list, but never invent a season with no evidence.
        if(target>0 && target<=250)
            for(var i=1;i<=target;i++)if(!results[i])results[i]={
                season_number:number,episode_number:i,
                name:'Серия '+i
            };
        var episodes=Object.keys(results).map(function(k){return results[k];});
        episodes.sort(function(a,b){return Number(a.episode_number)-Number(b.episode_number);});
        if(!episodes.length)return null;
        var obj={};obj[String(number)]={
            season_number:number,episodes:episodes,
            name:'Сезон '+number,
            seasons_count:Number(movie.number_of_seasons)||1
        };
        return obj;
    }
    function preserveNativeSeasonArt(movie,number,result) {
        var details=result && (result[number] || result[String(number)]);
        if(!details || !Array.isArray(details.episodes) || !details.episodes.length)return result;
        var backup=nativeSeasonSource(movie,number), byNumber={};
        if(backup && backup[number] && Array.isArray(backup[number].episodes))
            backup[number].episodes.forEach(function(ep) {byNumber[Number(ep.episode_number)]=ep;});
        details.episodes.forEach(function(original) {
            if(!original || !original.episode_number)return;
            var fallback=byNumber[Number(original.episode_number)];
            if(!fallback)return;
            // Existing Lampa still_path/img always wins. The original image
            // loader expects still_path to be a relative TMDB file path.
            if(!original.still_path && !original.img) {
                if(fallback.still_path) original.still_path=fallback.still_path;
                else if(fallback.img) original.img=fallback.img;
            }
            if((!original.name || isGenericEpisodeName(original.name)) && fallback.name)
                original.name=fallback.name;
            if(!original.runtime && fallback.runtime)original.runtime=fallback.runtime;
            if(!original.air_date && fallback.air_date)original.air_date=fallback.air_date;
        });
        return result;
    }
    function installNativeSeasonsRecovery() {
        if(!L.Api || typeof L.Api.seasons!=='function' || L.Api.seasons.__amediaRecovery)return;
        var original=L.Api.seasons;
        function patchedSeasons(movie, from, complete) {
            var number=Array.isArray(from) && from.length===1 ? Number(from[0]):0;
            if(!movie || !isSeries(movie) || !number || typeof complete!=='function')
                return original.apply(this,arguments);
            var finished=false, timer=null, originalResult=null;
            function finish(result) {
                if(finished)return;
                finished=true;
                clearTimeout(timer);
                complete(result || {});
            }
            function fallback() {
                if(finished)return;
                var alternate=nativeSeasonSource(movie,number);
                if(alternate)return finish(alternate);
                finish(originalResult || {});
            }
            timer=setTimeout(fallback,8500);
            var key=catalogKey(movie);
            // Begin provider discovery independently of the native callback.
            // When TMDB/proxy never answers, the watchdog can still display
            // real catalog episodes instead of rendering an empty season.
            (catalogWaiters[key] || (catalogWaiters[key]=[])).push(function(){
                if(originalResult !== null) fallback();
            });
            requestCatalog(movie);
            try {
                var returned=original.call(this,movie,from,function(result) {
                    if(finished)return;
                    var current=result && (result[number] || result[String(number)]);
                    if(current && Array.isArray(current.episodes) && current.episodes.length)
                        return finish(preserveNativeSeasonArt(movie,number,result));
                    originalResult=result;
                    var ready=nativeSeasonSource(movie,number);
                    if(ready)return finish(ready);
                    // Native source gave no episodes. Wait for a validated
                    // alternate catalog rather than rendering an empty page.
                    // Catalog is already loading; the registered listener or
                    // deadline will deliver whichever verified data exists.
                });
                return returned;
            }catch(error) {
                originalResult={};
                var available=nativeSeasonSource(movie,number);
                if(available)return finish(available);
                // Provider listener and deadline remain active.
            }
        }
        patchedSeasons.__amediaRecovery=true;
        L.Api.seasons=patchedSeasons;
    }
    function installNativeSeasonFlow() {
        if (seasonFlowReady) return;
        seasonFlowReady=true;
        installNativeSeasonsRecovery();
        // The built-in Full component re-groups by date gaps and renumbers
        // episodes even when the API already provides authoritative season
        // numbers. Respect the original numbering whenever it is complete.
        if (L.Utils && typeof L.Utils.splitEpisodesIntoSeasons==='function' &&
            !L.Utils.splitEpisodesIntoSeasons.__amediaAccurate) {
            var split=L.Utils.splitEpisodesIntoSeasons;
            function splitVerified(items,gap) {
                if(Array.isArray(items) && items.length &&
                    items.every(function(ep) {
                        return ep && Number.isInteger(Number(ep.season_number)) &&
                            Number(ep.season_number)>0 &&
                            Number.isInteger(Number(ep.episode_number)) &&
                            Number(ep.episode_number)>0;
                    })) {
                    var map={};
                    items.forEach(function(ep) {
                        var key=String(Number(ep.season_number));
                        (map[key] || (map[key]=[])).push(ep);
                    });
                    Object.keys(map).forEach(function(key){
                        map[key].sort(function(a,b){return Number(a.episode_number)-Number(b.episode_number);});
                    });
                    return map;
                }
                return split.apply(this,arguments);
            }
            splitVerified.__amediaAccurate=true;
            L.Utils.splitEpisodesIntoSeasons=splitVerified;
        }

        if (L.Activity && typeof L.Activity.push==='function' && !L.Activity.push.__amediaSeasonFlow) {
            var oldPush=L.Activity.push;
            function patchedPush(page) {
                if (page && page.component==='episodes' && page.card && isSeries(page.card) &&
                    (page.season === undefined || page.season === null)) {
                    var cached=fullEpisodesCache[catalogKey(page.card)] || [];
                    page.season=getResumeSeason(page.card,cached);
                }
                return oldPush.apply(this,arguments);
            }
            patchedPush.__amediaSeasonFlow=true;
            L.Activity.push=patchedPush;
        }
        if (L.Select && typeof L.Select.show==='function' && !L.Select.show.__amediaSeasonFlow) {
            var originalShow=L.Select.show;
            function seasonPicker(options) {
                if (options && Array.isArray(options.items) && options.items.length>1 &&
                    options.items.every(function(item) {
                        return item && Number.isInteger(Number(item.season)) &&
                            Number(item.season)>0 && typeof item.title==='string';
                    })) {
                    // sort in place, preserving original native item/action
                    // references and the user's manually selected season.
                    options.items.sort(function(a,b){return Number(a.season)-Number(b.season);});
                }
                return originalShow.apply(this,arguments);
            }
            seasonPicker.__amediaSeasonFlow=true;
            L.Select.show=seasonPicker;
        }
    }
    function installNativeEpisodeHook() {
        if (nativeHookInstalled || !L.Utils || typeof L.Utils.createInstance !== 'function') return;
        var original = L.Utils.createInstance;
        if (original.__amediaNativeHook) { nativeHookInstalled = true; return; }
        function wrappedCreateInstance() {
            // Full/Episodes reverses data.results before calling createInstance.
            // Reorder the same data array before Lampa instantiates its Line.
            if (arguments.length>1) {
                var object=arguments[1];
                if (object && object.component==='episodes' && object.card &&
                    isSeries(object.card) && (object.season===undefined || object.season===null)) {
                    // Also cover opening native Seasons through activity
                    // restoration/links that bypass Activity.push().
                    object.season=getResumeSeason(object.card,
                        fullEpisodesCache[catalogKey(object.card)] || []);
                }
                putAscendingEpisodes(object);
            }
            var result = original.apply(this, arguments);
            bindEpisodeInstance(result);
            return result;
        }
        wrappedCreateInstance.__amediaNativeHook = true;
        L.Utils.createInstance = wrappedCreateInstance;
        nativeHookInstalled = true;
        // A plugin can be installed while Full or Seasons is already open.
        // Bind pre-existing native items as well as items created later.
        var activity = L.Activity && L.Activity.active && L.Activity.active();
        var panels = activity && activity.activity && activity.activity.component &&
            activity.activity.component.items || [];
        if (Array.isArray(panels)) panels.forEach(function (panel) {
            if (panel && Array.isArray(panel.items)) panel.items.forEach(bindEpisodeInstance);
        });
    }

    function preferenceKey(movie) {
        var id = movie && (movie.imdb_id || movie.kinopoisk_id || movie.tmdb_id ||
            movie.id || movie.original_title || movie.original_name || movie.title || movie.name) || '';
        var basis = (isSeries(movie) ? 'tv:' : 'movie:') + String(movie && movie.source || 'tmdb') + ':' + String(id);
        return prefix + 'title_' + (L.Utils && L.Utils.hash ?
            L.Utils.hash(basis) : encodeURIComponent(basis).slice(0, 100));
    }
    function titlePreferences(movie) {
        var value = {};
        try { value = L.Storage.get(preferenceKey(movie), {}) || {}; } catch (ignored) {}
        return typeof value === 'object' && !Array.isArray(value) ? value : {};
    }
    function saveTitlePreference(movie, key, value) {
        var options = titlePreferences(movie);
        options[key] = value;
        try { L.Storage.set(preferenceKey(movie), options); } catch (ignored) {}
    }
    function titleQuality(movie) {
        var value = titlePreferences(movie).quality;
        return Object.prototype.hasOwnProperty.call(choices.quality, value) ? value : get('quality');
    }
    function titleVoice(movie) {
        var value = titlePreferences(movie).voice;
        return value === 'ask' ? 'ask' : value && typeof value === 'string' ? value : 'auto';
    }
    function voiceKind(voice) {
        var name=normalizeName(voice);
        if(/субтитр|subtitle|subtitles/.test(name))return 'субтитры';
        if(/оригинал|original|без перевод|english|английск/.test(name))return 'оригинал';
        if(/машинн|нейросет|робот|auto.?translate|ai.?voice/.test(name))return 'машинный перевод';
        if(/дубляж|дублирован|дубл.|dubbed|dubbing/.test(name))return 'дубляж';
        if(/многоголос|multi.?voice/.test(name))return 'многоголосый';
        if(/двухголос|two.?voice/.test(name))return 'двухголосый';
        if(/одноголос|single.?voice/.test(name))return 'одноголосый';
        if(/закадров/.test(name))return 'закадровый';
        return '';
    }
    function voiceOptionLabel(voice) {
        var title=String(voice.name||voice.label||'Озвучка'),kind=voiceKind(voice);
        // Avoid labels such as "Дубляж · дубляж".
        if(kind && normalizeName({name:title}).indexOf(normalizeName({name:kind}))>=0)
            return title;
        return kind ? title+' · '+kind : title;
    }
    function displayVoice(ctx) {
        var pref = titlePreferences(ctx.movie);
        return pref.voice && pref.voice !== 'auto' ? (pref.voiceLabel || pref.voice) : 'Автоматически';
    }
    function showPreferences(ctx) {
        if (!live(ctx)) return;
        show(ctx, {
            title:'Amedia · Настройки просмотра',
            items:[
                {title:'Озвучка: ' + displayVoice(ctx), action:'voice'},
                {title:'Качество: ' + (choices.quality[titleQuality(ctx.movie)] || 'Автоматически'), action:'quality'},
                {title:'▶ Смотреть', action:'play'},
                {title:'Сбросить выбор', action:'reset'}
            ],
            onSelect:function(item) {
                if (item.action === 'play') return playFromContext(ctx);
                if (item.action === 'reset') {
                    saveTitlePreference(ctx.movie, 'voice', 'auto');
                    saveTitlePreference(ctx.movie, 'voiceLabel', '');
                    saveTitlePreference(ctx.movie, 'quality', 'auto');
                    return showPreferences(ctx);
                }
                if (item.action === 'quality') {
                    return show(ctx, {
                        title:'Качество для этого фильма или сериала',
                        items:Object.keys(choices.quality).map(function (key) {
                            return {title:choices.quality[key], value:key, selected:titleQuality(ctx.movie)===key};
                        }),
                        onSelect:function (choice) {
                            saveTitlePreference(ctx.movie, 'quality', choice.value);
                            showPreferences(ctx);
                        },
                        onBack:function(){ showPreferences(ctx); }
                    });
                }
                if (item.action === 'voice') {
                    var voices = ctx.episode && ctx.episode.translations || [];
                    var results = [{title:'Автоматически · лучшая доступная', value:'auto'}];
                    if (!voices.length) results.push({title:'Выбрать дорожку после загрузки видео', value:'ask'});
                    voices.forEach(function (voice) {
                        results.push({title:String(voice.name || voice.label || 'Перевод'),
                            value:String(voice.id), label:String(voice.name || voice.label || 'Перевод')});
                    });
                    return show(ctx, {
                        title:'Озвучка для этого фильма или сериала',
                        items:results.map(function(item) {
                            item.selected = item.value === titleVoice(ctx.movie);
                            return item;
                        }),
                        onSelect:function (choice) {
                            saveTitlePreference(ctx.movie, 'voice', choice.value);
                            saveTitlePreference(ctx.movie, 'voiceLabel', choice.label || '');
                            showPreferences(ctx);
                        },
                        onBack:function () { showPreferences(ctx); }
                    });
                }
            },
            onBack:function(){
                if (ctx.hub && ctx.hub.alive) safe(function(){ L.Controller.toggle('content'); });
                else backContent(ctx);
            }
        });
    }
    function playFromContext(ctx) {
        if (!live(ctx) || ctx.busy) return Promise.resolve();
        var route = 'inner'; // Capsule movie-only route is always Lampa native.
        // The native bridge is only available inside the Android Lampa APK.
        // Never fall back silently to WebView when the user picked UA Player.
        if (route === 'android' &&
            !(L.Platform && typeof L.Platform.is === 'function' && L.Platform.is('android') &&
              root.AndroidJS && typeof root.AndroidJS.openPlayer === 'function')) {
            note('Amedia: UA Player доступен через Android-приложение Lampa. В браузере выберите встроенный плеер.');
            return Promise.resolve();
        }
        if (selection && selection.ctx === ctx) {
            selection = null;
            safe(function () { if (L.Select && L.Select.hide) L.Select.hide(); });
        }
        if (ctx.tree) {
            if (!ctx.season || !ctx.episode) {
                var candidate = watchCandidate(ctx);
                if (!candidate) { note('Amedia: нет доступных серий.'); return Promise.resolve(); }
                ctx.season = candidate.season;
                ctx.episode = candidate.episode;
            }
            var voice = topVoice(ctx, ctx.episode);
            if (!voice) { note('Amedia: для серии нет доступных потоков.'); return Promise.resolve(); }
            return start(ctx, voice);
        }
        return start(ctx, null);
    }
    function get(name) {
        var value;
        try {
            value = L.Storage.get(prefix + name, null);
            if (value === null || value === undefined) value = L.Storage.get('amedia_client_' + name, defaults[name]);
        } catch (ignored) { value = defaults[name]; }
        if (choices[name]) return Object.prototype.hasOwnProperty.call(choices[name], value) ? value : defaults[name];
        return value === true || value === 'true' ? true : value === false || value === 'false' ? false : defaults[name];
    }
    function safe(fn) { try { if (fn) fn(); } catch (ignored) {} }
    function note(text) { safe(function () { L.Noty.show(text); }); }
    function log(stage) {
        if (get('diagnostics')) safe(function () { root.console.log('[Amedia ' + version + ']', stage); });
    }
    function cancelError() { var error = new Error('Amedia: действие отменено'); error.amediaCancelled = true; return error; }
    function valid(job) { return !!(job && job === active && !job.closed); }
    function check(job) { if (!valid(job)) throw cancelError(); }
    function live(ctx) { return !!(ctx && ctx === context && !ctx.closed); }
    function stopLoading(owner) {
        if (stopLoading.owner !== owner) return;
        stopLoading.owner = null;
        safe(function () { L.Loading.stop(); });
    }
    function loading(owner, cancel) {
        stopLoading.owner = owner;
        safe(function () { L.Loading.start(cancel); });
    }
    function own(job, release) {
        if (!valid(job)) { safe(release); return; }
        job.releases.push(release);
    }
    function finish(job, reason) {
        if (!job || job.closed) return;
        job.closed = true;
        clearTimeout(job.timer);
        clearTimeout(job.returnTimer);
        clearTimeout(job.innerQueueTimer);
        if (active === job) active = null;
        stopLoading(job);
        // Independent releases: a failed WS.close must not leave Hls patched.
        job.releases.splice(0).reverse().forEach(safe);
        if (job.cancelAudio) { var reject = job.cancelAudio; job.cancelAudio = null; reject(cancelError()); }
        if (job.ctx) job.ctx.busy = false;
        // Never reset routing here: another plugin may already own runas().
        log('Сессия закрыта: ' + reason);
    }
    function mode(options) { return 'inner'; }
    function begin(options) {
        if (options && options.clientJob) { check(options.clientJob); return options.clientJob; }
        if (active && !active.launched) throw new Error('Amedia: поток ещё подготавливается.');
        finish(active, 'новый запуск');
        var job = {id: ++sequence, ctx: options && options.ctx, mode: mode(options), closed: false,
            launched: false, externalSeen: false, releases: [], position: 0, payload: null, timer: null,
            createdAt: Date.now()};
        active = job;
        job.timer = setTimeout(function () {
            if (!valid(job)) return;
            finish(job, 'таймаут подготовки');
            note('Amedia: подготовка заняла слишком много времени. Откройте Amedia повторно.');
        }, 120000);
        return job;
    }
    function seed(job, options, request) {
        // The one-time Borth seed is ordered PER embed session, not globally.
        // A stalled old HTTP request must not block a NEW signed session
        // (the global seedTail previously poisoned all future playback).
        // Never replay a seed after an ambiguous network failure.
        var embed=options.embed;
        var previous=embed.__amediaSeedTail || Promise.resolve();
        var result=previous.then(function () {
            check(job);
            if (embed.__amediaSeedInvalid)
                throw new Error('Amedia: требуется новая авторизация потока.');
            return Promise.resolve().then(function () {
                return request({metaSeed:embed.metaSeed,fileActiveId:options.fileId,
                    hP:options.hP,refererUrl:embed.embedUrl});
            }).then(function (response) {
                if (response && response.nextSeed)embed.metaSeed=response.nextSeed;
                return response;
            }, function (error) {
                // Do not retry a possibly consumed seed. New lookup must
                // supply a NEW embed, with its own independent seed chain.
                embed.__amediaSeedInvalid=true;
                throw error;
            });
        });
        embed.__amediaSeedTail=result.then(function(){},function(){});
        return result;
    }
    function rotate(job, options, request) {
        var closed = false, timer;
        function schedule() {
            if (!closed && valid(job)) timer = setTimeout(function () {
                seed(job, options, request).then(schedule, function () {
                    // Do not retry an ambiguous seed transaction automatically.
                    log('Обновление seed не удалось; повторный запрос отключён');
                });
            }, 110000);
        }
        schedule();
        return {close: function () { closed = true; clearTimeout(timer); }};
    }

    function timeline(options) {
        if (!options.movie || !L.Timeline || !L.Utils || !L.Utils.hash) return null;
        var movie = options.movie;
        // Lampa's native Episode component uses this exact hash algorithm.
        // Different Amedia hashes make the native episode progress look empty.
        var isEpisode = isSeries(movie) && options.season !== undefined && options.episode !== undefined;
        var name = movie.original_name || movie.name || movie.title || '';
        var season = Number(options.season) || 0, episode = Number(options.episode) || 0;
        var hash = isEpisode ?
            L.Utils.hash([season, season > 10 ? ':' : '', episode, name].join('')) :
            L.Utils.hash(['amedia', 'movie', movie.id || movie.imdb_id || movie.title || movie.name,0,0].join('|'));
        if (options.nativeTimeline && options.nativeTimeline.hash) hash = String(options.nativeTimeline.hash);
        var source = L.Timeline.view(hash, L.Timeline.link ? L.Timeline.link(movie, season, episode) : null);
        var copy = {};
        if (source) Object.keys(source).forEach(function(key){ copy[key]=source[key]; });
        if (options.nativeTimeline && options.nativeTimeline.hash) {
            // The native list is the source of truth for the exact item.
            Object.keys(options.nativeTimeline).forEach(function(key) {
                if (key === 'hash' || isFinite(Number(options.nativeTimeline[key])))
                    copy[key] = options.nativeTimeline[key];
            });
        }
        copy.hash=hash;
        // Timeline history is always preserved for episode cards.
        // Disabling auto-resume only changes the launch position, not history.
        return copy;
    }
    function prepare(job, data, options) {
        check(job);
        if (!data || typeof data.url !== 'string' || !/^https?:\/\//i.test(data.url.trim())) throw new Error('Amedia: отсутствует ссылка на поток.');
        data.url = data.url.trim();
        var wanted = options && options.movie ? titleQuality(options.movie) : get('quality');
        if(job.mode==='inner')data.__amediaAutoQuality=wanted==='auto';
        var picked = data.quality && (data.quality[wanted + 'p'] || data.quality[wanted]);
        if (picked && typeof picked === 'object') picked = picked.url;
        if (wanted !== 'auto' && typeof picked === 'string' && picked) {
            data.url = picked.split('|')[0].trim();
        } else if(data.quality) {
            var selectedQuality=chooseAdaptiveSource(data.quality,wanted);
            if(selectedQuality){
                data.url=selectedQuality.url;
                if(wanted==='auto')data.__amediaAutoHeight=selectedQuality.height;
            }
        }
        if (options.recoveryFallbackQuality && wanted === 'auto' && data.quality) {
            // Avoid repeating the same 1080p/CDN variant on a failed initial
            // film resolve. The fallback is applied only to the second attempt.
            ['720p','480p','360p'].some(function(key){
                var alternative=data.quality[key];
                if (alternative && typeof alternative==='object')alternative=alternative.url;
                if (typeof alternative==='string' && /^https?:\/\//i.test(alternative)) {
                    data.url=alternative;
                    delete data.quality;
                    return true;
                }
                return false;
            });
        }
        if (options.movie) {
            var enrichedCard = options.movie;
            // Lampa's native Android bridge reads card.img for cover art.
            if (!enrichedCard.img && enrichedCard.poster_path) {
                enrichedCard = Object.assign({}, enrichedCard);
                enrichedCard.img = imageUrl(enrichedCard.poster_path, 'w500');
            }
            data.card = enrichedCard;
            data.timeline = timeline(options);
            if (!get('resume') && data.timeline) {
                data.timeline = Object.assign({},data.timeline,{time:0,percent:0});
            }
            if (options.season !== undefined) data.season = options.season;
            if (options.episode !== undefined) data.episode = options.episode;
            if (options.thumbnail) data.thumbnail = options.thumbnail;
        }
        if(job.mode==='inner'){
            // If this CDN failed recently, do not spend the full default
            // timeout on another manifest request. Healthy CDNs are untouched.
            var hostFailures=recentHostFailures();
            if((hostFailures[streamHost(data.url)]||0)>0){
                var existingTimeout=Number(data.hls_manifest_timeout)||10000;
                data.hls_manifest_timeout=Math.min(existingTimeout,7000);
            }
            // The stock Lampa engine understands hls_type=native/hlsjs.
            // Do not force native on unsupported WebViews, and do not affect
            // external Android playback or other plugins.
            var engine=get('innerEngine');
            if(engine==='hlsjs')data.hls_type='hlsjs';
            else if(engine==='native'){
                var supported=false;
                try{
                    var probe=root.document&&root.document.createElement&&
                        root.document.createElement('video');
                    supported=!!(probe&&typeof probe.canPlayType==='function'&&
                        (probe.canPlayType('application/vnd.apple.mpegurl')||
                         probe.canPlayType('application/x-mpegURL')));
                }catch(error){}
                if(supported)data.hls_type='native';
                else {
                    data.hls_type='hlsjs';
                    log('Системный HLS недоступен в этом WebView, оставляем HLS.js');
                }
            }
        }
        if (job.mode === 'inner' && data.quality && typeof data.quality==='object') {
            // Native Lampa Player already supports a reserve URL, which it
            // switches to on fatal PlayerVideo.error without closing the player.
            // Prefer a lower bitrate variant from the same signed manifest.
            var variants=data.quality;
            var primary=String(data.url || '');
            ['720p','480p','360p','720','480','360'].some(function(key) {
                var candidate=variants[key];
                if(candidate && typeof candidate==='object')candidate=candidate.url;
                if(typeof candidate==='string') candidate=candidate.split('|')[0].trim();
                if(typeof candidate==='string' && /^https?:\/\//i.test(candidate) &&
                    candidate !== primary) {
                    data.url_reserve=candidate;
                    job.browserReserve=true;
                    return true;
                }
                return false;
            });
        }
        delete data.player; delete data.inner; delete data.player_external;
        // Preserve a resolved native playlist. AndroidJS serializes it to JSON.
        delete data.callback;
        // Leave room for a native playlist: makeQueue will append short-lived signed
        // URLs to this object before Lampa.Player.play calls AndroidJS.openPlayer.
        // AndroidJS serializes URLs, not JavaScript callbacks.
        if (job.mode === 'android') {
            // A native queue must not have its current URL rewritten after it is serialized.
            delete data.quality;
            // Android.openPlayer >=98 refreshes timeline.time from storage. Omitting
            // timeline is the only supported way to force a start from zero there.
            if (!get('resume')) delete data.timeline;
            var headers = {};
            Object.keys(data.headers || {}).forEach(function (key) {
                if (typeof data.headers[key] === 'string') headers[key] = data.headers[key];
            });
            data.headers = headers;
            data.hls_headers = headers;
            JSON.stringify(data);
        }
        job.position = data.timeline && Number(data.timeline.time) || 0;
        data.launch_player = job.mode;
        return data;
    }

    // The Android Lampa APK discards json.playlist when its global playlist_next
    // toggle is false (MainActivity.runPlayer). Enable it explicitly for Amedia
    // series queues, rather than silently sending a list that Android ignores.
    var lastQueueStatus=null;
    function queueSummary(){
        if(lastQueueStatus)return lastQueueStatus;
        try{return L.Storage.get(prefix+'lastQueueSummary',null);}catch(error){return null;}
    }
    function rememberQueueStatus(status){
        lastQueueStatus=status;
        // Only counts/labels; never persist signed Skaz stream URLs or headers.
        safe(function(){L.Storage.set(prefix+'lastQueueSummary',status);});
    }
    function checkNativePlaylist(job,data) {
        if (job.mode === 'android') {
            // WebView URL-functions cannot cross AndroidJS' JSON bridge.
            // Skaz's other episodes need their own changing seed/headers, while
            // native Lampa forwards one header set for the entire Intent.
            // Do not send guessed, stale, or unplayable season entries to UA.
            delete data.playlist;
            var androidStatus={planned:job.queuePlanned||0,resolved:0,size:1,
                mode:'android',lazy:false,errors:[],delivered:1,
                createdAt:Date.now()};
            job.queueResult={size:1,currentIndex:0};
            rememberQueueStatus(androidStatus);
            safe(function(){root.__amediaQueueDiagnostics={
                size:1,mode:'android',lazy:false
            };});
            return job.queueResult;
        }
        // Preserve only the internal Lampa queue. Android Intent lists and
        // duplicate signature checks cannot run during an inner session.
        var list=Array.isArray(data.playlist)?data.playlist.filter(function(item){
            return item&&(typeof item.url==='function'||
                (typeof item.url==='string'&&/^https?:\/\//i.test(item.url)));
        }):[];
        var index=list.findIndex(function(item){
            return item.__amediaQueueItem&&
                Number(item.season)===Number(data.season)&&
                Number(item.episode)===Number(data.episode) ||
                item.url===data.url;
        });
        if(index<0||list.length<2){delete data.playlist;list=[];index=0;}
        else data.playlist=list;
        var status={planned:job.queuePlanned||0,resolved:0,
            size:Math.max(1,list.length),mode:'inner',lazy:true,errors:[],
            delivered:null,createdAt:Date.now()};
        job.queueResult={size:status.size,currentIndex:index};
        rememberQueueStatus(status);
        safe(function(){root.__amediaQueueDiagnostics={
            size:status.size,mode:'inner',lazy:true
        };});
        return job.queueResult;
    }
    function launch(job, data) {
        check(job);
        checkNativePlaylist(job, data);
        if (data.season !== undefined && data.episode !== undefined && job.ctx)
            saveEpisodePosition(job.ctx.movie,data.season,data.episode);
        // Lampa may copy the player data before emitting create/external.
        // An explicit session ID prevents our own event from being aborted.
        data.__amediaLaunchId=job.id;
        job.payload = data;
        if(job.mode==='inner'){
            setupVerifiedAutoNext();
            data.__amediaManaged=true;
        }
        job.launched = true;
        job.launchedAt = Date.now();
        clearTimeout(job.timer);
        stopLoading(job);
        // Native Select hides BEFORE onSelect. Content is therefore the live
        // controller captured by Preroll, never a removed custom overlay.
        safe(function () {
            if(!L.Controller.enabled||!L.Controller.enabled()||
                L.Controller.enabled().name!=='content')L.Controller.toggle('content');
        });
        try {
            if (L.Player.runas) L.Player.runas(job.mode);
            // Skaz Online populates both the playlist controller and the
            // serializable root work. AndroidJS consumes work.playlist;
            // Lampa's own queue UI consumes Player.playlist().
            if(job.mode==='inner' && Array.isArray(data.playlist)&&data.playlist.length>1 &&
                L.Player.playlist) safe(function(){L.Player.playlist(data.playlist);});
            L.Player.play(data);
        } catch (error) { finish(job, 'ошибка плеера'); throw error; }
        finally {
            // Verified in Lampa Player.start: branch choice is synchronous,
            // before Preroll.show. Its callback does not reread launch_player.
            if (L.Player.runas) L.Player.runas('');
        }
        if (!valid(job)) return;
    }

    // The original inner-player handoff used one 250ms timer, frequently too
    // early for Player.playdata() and PlayerPlaylist.active(). Keep video start
    // fast and publish only when the current player is actually ready.

    // The original Amedia core installs an XHR/fetch header bridge and an
    // edge-hash heartbeat for the *current* signed stream. Lampa destroys the
    // original player (and the core releases that bridge) on queue selection.
    // Each new Lampa queue item therefore needs its OWN short-lived bridge.
    var queuedBridgeRelease=null;
    function stopQueuedBridge(){
        if(!queuedBridgeRelease)return;
        var release=queuedBridgeRelease;queuedBridgeRelease=null;
        safe(release);
    }
    function activateQueuedBridge(data){
        if(!data||!data.__amediaQueueItem)return false;
        stopQueuedBridge();
        var headers=data.hls_headers||data.headers;
        if(!headers || typeof headers!=='object')return false;
        var hostList=[],originList=[data.url];
        Object.keys(data.quality||{}).forEach(function(key){
            var val=data.quality[key];
            if(val&&typeof val==='object')val=val.url;
            if(typeof val==='string')originList.push(val);
        });
        originList.forEach(function(url){
            var host=streamHost(url);
            if(host&&hostList.indexOf(host)<0)hostList.push(host);
        });
        root.__amediaCdnHosts=hostList;
        root.__amediaCdnActiveIdx=0;
        var releases=[];
        try{
            if(typeof _0x1d7a2f==='function'){
                var xhrRelease=_0x1d7a2f(headers);
                if(typeof xhrRelease==='function')releases.push(xhrRelease);
            }
            if(typeof _0x2e2363==='function'){
                var hlsRelease=_0x2e2363(headers);
                if(typeof hlsRelease==='function')releases.push(hlsRelease);
            }
            var backend=data.__amediaStreamBackend||{};
            if(backend.pnr&&backend.pnk&&typeof _0x1cb92a==='function'){
                var holder={value:headers['Accepts-Controls']||data.__amediaHP||''};
                var heartbeat=_0x1cb92a({
                    pnr:backend.pnr,pnk:backend.pnk,
                    resolution:backend.resolution||'720p',
                    trackId:backend.trackId||'1',
                    edgeHashHolder:holder,
                    getCurrentTime:function(){
                        try{
                            var video=L.PlayerVideo&&L.PlayerVideo.video&&L.PlayerVideo.video();
                            return Number(video&&video.currentTime)||0;
                        }catch(error){return 0;}
                    },
                    getResolution:function(){return backend.resolution||'720p';},
                    onEdgeHashChange:function(next){
                        headers['Accepts-Controls']=next;
                        if(data.__amediaGuard&&typeof _0x302e2a==='function')
                            safe(function(){_0x302e2a(data.__amediaGuard,next);});
                    }
                });
                if(heartbeat&&typeof heartbeat.close==='function')
                    releases.push(function(){heartbeat.close();});
            }
        }catch(error){
            while(releases.length)safe(releases.pop());
            log('Amedia: не удалось восстановить заголовки очереди');
            return false;
        }
        queuedBridgeRelease=function(){
            while(releases.length)safe(releases.pop());
        };
        return true;
    }
    // Real completion is not equivalent to HLS emitting ended with no manifest.
    // Lampa's global playlist_next has no loaded/duration/error guard, so
    // temporarily disable it while an Amedia inner-player item is active.
    // Restore the user's preference on exit or when another plugin takes over.
    var guardedNext=null,guardListenersReady=false,lastLazyQueueItem=null;
    // On forks exposing an HLS.js instance, cap retained buffers for Amedia
    // movies/episodes only. Never patch window.Hls or other players.


    // Real playback lifecycle controller, scoped to Amedia's inner player.
    // Hls is a global constructor in Lampa; the instance itself is private.
    var amediaRuntime=(function(){
        var active=null;
        function now(){return Date.now();}
        function current(){try{return L.Player.playdata();}catch(e){return null;}}
        function owns(st,work){
            return !!(st&&work&&work.__amediaManaged&&
                (work===st.work||(st.work.__amediaLaunchId&&
                st.work.__amediaLaunchId===work.__amediaLaunchId)));
        }
        function alive(st){return !!(st&&!st.closed&&st===active&&owns(st,current()));}
        function configure(config){
            var cfg=Object.assign({},config||{});
            var mem=Number(root.navigator&&root.navigator.deviceMemory)||4;
            var low=mem<=2,mid=mem<=4;
            function cap(k,v){
                if(cfg[k]===undefined||cfg[k]===null)cfg[k]=v;
                else if(typeof cfg[k]==='number'&&cfg[k]>v)cfg[k]=v;
            }
            cap('maxBufferLength',low?24:mid?35:46);
            cap('maxMaxBufferLength',low?50:mid?80:100);
            cap('maxBufferSize',(low?56:mid?96:160)*1048576);
            cap('backBufferLength',low?12:20);
            var work=current();
            // On the native HLS path Lampa constructs a parser-only Hls.
            // Prefetching a fragment there would duplicate native requests.
            if(get('fastStart')&&work&&work.hls_type==='hlsjs')
                cfg.startFragPrefetch=true;
            if(work&&work.__amediaManaged&&work.__amediaAutoQuality){
                // Hls.js handles repeated dropped frames more accurately than
                // an ad-hoc forced quality switch inside the watchdog.
                cfg.capLevelOnFPSDrop=true;
                if(cfg.fpsDroppedMonitoringPeriod===undefined)
                    cfg.fpsDroppedMonitoringPeriod=6000;
                if(cfg.fpsDroppedMonitoringThreshold===undefined)
                    cfg.fpsDroppedMonitoringThreshold=0.2;
            }
            // All original xhrSetup, request headers, signing and loader
            // callbacks survive the shallow copy unchanged.
            return cfg;
        }
        function bufferAhead(v){
            var end=0;
            try{
                var t=Number(v.currentTime)||0,b=v.buffered;
                for(var i=0;b&&i<Math.min(20,b.length);i++){
                    if(b.start(i)<=t+.12&&b.end(i)>t)end=Math.max(end,b.end(i)-t);
                }
            }catch(e){}
            return end;
        }
        function reset(st,pos){
            st.lastPos=pos;st.stallAt=0;st.counted=false;st.askedPlay=false;
            st.loadKicked=false;st.nudged=false;st.recoverySent=false;
        }
        function unbind(st){
            if(st.video&&st.handlers)st.handlers.forEach(function(p){
                try{st.video.removeEventListener(p[0],p[1],false);}catch(e){}
            });
            st.video=null;st.handlers=[];
        }
        function attachVideo(st,video){
            if(!video||!video.addEventListener||st.closed||video===st.video)return;
            unbind(st);
            st.video=video;st.lastPos=Number(video.currentTime)||0;st.stallAt=0;
            function on(k,fn){video.addEventListener(k,fn,false);st.handlers.push([k,fn]);}
            on('playing',function(){reset(st,Number(video.currentTime)||0);});
            on('seeked',function(){st.seeking=false;reset(st,Number(video.currentTime)||0);});
            on('seeking',function(){st.seeking=true;st.stallAt=0;});
            on('pause',function(){st.stallAt=0;st.counted=false;});
            on('ended',function(){st.stallAt=0;st.counted=false;});
            on('waiting',function(){if(!video.paused&&!video.seeking&&!st.stallAt)st.stallAt=now();});
        }
        function videoIfNeeded(st){
            if(st.video)return;
            try{if(L.PlayerVideo&&L.PlayerVideo.video)attachVideo(st,L.PlayerVideo.video());}catch(e){}
        }
        function observeHls(st,hls,original){
            if(!hls||typeof hls.attachMedia!=='function')return;
            var originalAttach=hls.attachMedia;
            hls.attachMedia=function(video){
                var lampaVideo=null;
                try{lampaVideo=L.PlayerVideo&&L.PlayerVideo.video&&L.PlayerVideo.video();}catch(e){}
                if(alive(st)&&(!lampaVideo||lampaVideo===video)){
                    if(st.hls&&st.hls!==hls&&st.hls.off)
                        st.bindings.forEach(function(p){try{st.hls.off(p[0],p[1]);}catch(e){}});
                    st.bindings=[];
                    st.hls=hls;st.seenHls=true;
                    attachVideo(st,video);
                    var events=original.Events||{};
                    function listen(name,callback){
                        if(hls.on){hls.on(name,callback);st.bindings.push([name,callback]);}
                    }
                    listen(events.FRAG_LOADED||'hlsFragLoaded',function(_,data){
                        if(!alive(st)||!data)return;
                        st.fragAt=now();
                        if(data.stats)recordHostFragment(
                            data.frag&&data.frag.url||st.work.url,data.stats);
                    });
                    listen(events.ERROR||'hlsError',function(_,data){
                        if(!alive(st)||!data)return;
                        if(data.details)st.reason=String(data.details).slice(0,55);
                    });
                }
                return originalAttach.apply(this,arguments);
            };
            st.wrapped=hls.attachMedia;
            st.origAttach=originalAttach;
        }
        function hook(st){
            var original=root.Hls;
            if(typeof original!=='function')return;
            function AmediaHls(options){
                var ours=alive(st);
                var inst=new original(ours?configure(options):options);
                if(ours)observeHls(st,inst,original);
                return inst;
            }
            AmediaHls.prototype=original.prototype;
            try{
                if(Object.setPrototypeOf)Object.setPrototypeOf(AmediaHls,original);
                else Object.getOwnPropertyNames(original).forEach(function(k){
                    if(k==='name'||k==='length'||k==='prototype')return;
                    try{Object.defineProperty(AmediaHls,k,Object.getOwnPropertyDescriptor(original,k));}catch(e){}
                });
                root.Hls=AmediaHls;
                if(root.Hls===AmediaHls)st.restore=function(){
                    if(root.Hls===AmediaHls)root.Hls=original;
                };
            }catch(e){try{if(root.Hls===AmediaHls)root.Hls=original;}catch(ignore){}}
        }
        function stats(st){
            try{L.Storage.set(prefix+'runtimeStats',{
                at:now(),stalls:st.stalls,networkStalls:st.network,
                decodeStalls:st.decode,recoveries:st.recoveries,
                hlsCaptured:st.seenHls,lastReason:st.reason,
                observedMs:Math.max(0,now()-st.started),
                frameDropPercent:Number(st.dropPercent)||0,
                frameSamples:Number(st.frameSamples)||0
            });}catch(e){}
        }
        function stop(){
            var st=active;
            if(!st)return;
            active=null;st.closed=true;
            clearInterval(st.timer);clearTimeout(st.boot);
            unbind(st);
            if(st.hls&&st.hls.off)st.bindings.forEach(function(p){
                try{st.hls.off(p[0],p[1]);}catch(e){}
            });
            if(st.hls&&st.wrapped&&st.hls.attachMedia===st.wrapped)
                st.hls.attachMedia=st.origAttach;
            if(st.restore)st.restore();
            stats(st);
        }
        function sampleFrames(st,video){
            if(!video||typeof video.getVideoPlaybackQuality!=='function')return;
            if(now()-st.frameAt<5000)return;
            st.frameAt=now();
            try{
                var info=video.getVideoPlaybackQuality();
                if(!info)return;
                var total=Number(info.totalVideoFrames),drop=Number(info.droppedVideoFrames);
                if(!isFinite(total)||!isFinite(drop))return;
                if(st.lastFrames){
                    var frames=total-st.lastFrames.total,lost=drop-st.lastFrames.drop;
                    if(frames>=30&&lost>=0&&lost<=frames){
                        st.dropPercent=Math.round(100*lost/frames);
                        st.frameSamples++;
                    }
                }
                st.lastFrames={total:total,drop:drop};
            }catch(e){}
        }
        function tick(st){
            if(!alive(st)){stop();return;}
            videoIfNeeded(st);
            sampleFrames(st,st.video);
            if(!get('playerWatchdog'))return;
            var v=st.video;
            if(!v||v.ended||v.paused||v.seeking||st.seeking||
                root.document&&root.document.visibilityState==='hidden'){
                st.stallAt=0;st.counted=false;
                if(v)st.lastPos=Number(v.currentTime)||0;
                return;
            }
            var pos=Number(v.currentTime)||0,t=now();
            if(!isFinite(pos))return;
            if(pos>st.lastPos+.06||pos<st.lastPos-.35){reset(st,pos);return;}
            if(!st.stallAt)st.stallAt=t;
            var elapsed=t-st.stallAt;
            if(elapsed<3600)return;
            var buffered=bufferAhead(v);
            if(!st.counted){
                st.counted=true;st.stalls++;
                if(buffered>=.7)st.decode++;else st.network++;
            }
            if(buffered>=.7){
                st.reason='decoder_or_render';
                if(!st.askedPlay){
                    st.askedPlay=true;
                    try{var p=v.play();if(p&&p.catch)p.catch(function(){});}catch(e){}
                }
                if(elapsed>=8000&&!st.nudged&&t-st.lastNudge>=25000&&
                    buffered>=1.5&&v.readyState>=2){
                    // Small nudge confined to already buffered media.
                    st.nudged=true;st.lastNudge=t;
                    try{v.currentTime=pos+.06;}catch(e){}
                }
            }else{
                st.reason='network_starvation';
                if(elapsed>=7500&&!st.loadKicked&&st.hls&&st.hls.startLoad){
                    st.loadKicked=true;
                    try{st.hls.startLoad(-1);}catch(e){}
                }
            }
            if(elapsed>=18000&&!st.recoverySent&&t-st.lastRecovery>=30000&&
                typeof st.work.error==='function'&&L.PlayerVideo&&
                L.PlayerVideo.listener&&L.PlayerVideo.listener.send){
                st.recoverySent=true;st.lastRecovery=t;st.recoveries++;
                // Existing Lampa error handler calls Skaz signed URL recovery.
                try{L.PlayerVideo.listener.send('error',{
                    fatal:true,error:'Amedia watchdog '+st.reason
                });}catch(e){}
            }
        }
        function start(work){
            if(!work||!work.__amediaManaged){stop();return;}
            if(active&&owns(active,work))return;
            stop();
            var st={work:work,closed:false,started:now(),video:null,handlers:[],
                hls:null,seenHls:false,bindings:[],reason:'',stalls:0,
                network:0,decode:0,recoveries:0,dropPercent:0,frameSamples:0,
                frameAt:0,lastFrames:null,lastPos:0,stallAt:0,
                lastNudge:0,lastRecovery:0,fragAt:0,counted:false,seeking:false};
            active=st;
            hook(st); // Lampa Player.start event happens before Video.url().
            st.timer=setInterval(function(){tick(st);},1000);
            st.boot=setTimeout(function(){videoIfNeeded(st);},200);
        }
        function ready(work){if(active&&owns(active,work))videoIfNeeded(active);}
        function currentStats(){var st=active;return st?{
            stalls:st.stalls,recoveries:st.recoveries,hlsCaptured:st.seenHls,
            lastReason:st.reason,frameSamples:st.frameSamples,
            frameDropPercent:st.dropPercent}:null;}
        return {start:start,stop:stop,ready:ready,configure:configure,stats:currentStats};
    }());
    function tuneInnerHls(work,instance){
        // Compatibility with the older Amedia API. On stock Lampa the real
        // Hls is private, and is now tuned at construction time above.
        if(!work||!work.__amediaManaged||!instance||!instance.config)return false;
        var cfg=amediaRuntime.configure(instance.config);
        Object.keys(cfg).forEach(function(k){try{instance.config[k]=cfg[k];}catch(e){}});
        return true;
    }
    function scheduleInnerHlsTune(work){amediaRuntime.start(work);}
    // Lampa PlayerPlaylist is reset during Player.destroy(). On supported
    // versions the selection handler restores it, but some forks don't.
    // Preserve this list independently from the signed-stream job.
    var persistentInnerQueue=null,persistentInnerQueueSerial=0;
    function refreshPersistentInnerQueue(data){
        var saved=persistentInnerQueue;
        if(!saved||!data||!data.__amediaQueueItem||
            saved.list.indexOf(data)<0)return;
        setTimeout(function(){
            if(!persistentInnerQueue||persistentInnerQueue!==saved||
                !L.Player||!L.Player.playdata||L.Player.playdata()!==data||
                !L.PlayerPlaylist||typeof L.PlayerPlaylist.set!=='function')return;
            try{L.PlayerPlaylist.set(saved.list);}
            catch(error){log('Повторная публикация очереди: '+String(error&&error.message||error));}
        },80);
    }
    // Every native playlist owns independent on-demand signing, even after the
    // episode browser is closed while Lampa keeps playing.
    var lazyQueueSerial=0;
    function restoreAutoNext(){
        if(!guardedNext)return;
        var original=guardedNext.original;
        guardedNext=null;
        // Do not overwrite a preference the viewer changed during playback.
        safe(function(){
            var current=L.Storage.get('playlist_next',false);
            if(current===false||current==='false')L.Storage.set('playlist_next',original);
        });
    }
    function setupVerifiedAutoNext(){
        if(guardListenersReady||!L.Player||!L.Player.listener||
            !L.PlayerVideo||!L.PlayerVideo.listener)return;
        guardListenersReady=true;
        L.Player.listener.follow('start',function(data){
            // Lampa mutates a lazy playlist item's url from function to string
            // to start playback. Restore the PREVIOUS item's resolver only
            // after a different video starts, so Back always reauthorizes it
            // instead of replaying the expired signed URL.
            if(lastLazyQueueItem && lastLazyQueueItem!==data &&
                typeof lastLazyQueueItem.__amediaResolveUrl==='function')
                lastLazyQueueItem.url=lastLazyQueueItem.__amediaResolveUrl;
            lastLazyQueueItem=data&&data.__amediaQueueItem?data:null;
            if(data&&data.__amediaQueueItem){
                activateQueuedBridge(data);
                refreshPersistentInnerQueue(data);
            }
            if(data&&data.__amediaManaged)scheduleInnerHlsTune(data);
            else amediaRuntime.stop();
            if(!data||!data.__amediaManaged){
                lazyQueueSerial++;
                persistentInnerQueue=null;
                lastLazyQueueItem=null;
                restoreAutoNext();return;
            }
            var original=guardedNext?guardedNext.original:L.Storage.get('playlist_next',true);
            guardedNext={original:original,work:data,loaded:false,
                failed:false,duration:0,position:0,started:Date.now()};
            safe(function(){L.Storage.set('playlist_next',false);});
        });
        L.PlayerVideo.listener.follow('loadeddata',function(e){
            var guard=guardedNext;
            if(!guard)return;
            guard.loaded=true;guard.failed=false;
            if(guard.work&&guard.work.__amediaHadError){
                guard.work.__amediaHadError=false;
                rememberHlsRecovery(guard.work,'video_ready','');
            }
            var duration=Number(e&&e.duration);
            if(Number.isFinite(duration)&&duration>0)guard.duration=duration;
        });
        L.PlayerVideo.listener.follow('timeupdate',function(e){
            var guard=guardedNext;if(!guard)return;
            var duration=Number(e&&e.duration),position=Number(e&&e.current);
            if(Number.isFinite(duration)&&duration>30)guard.duration=duration;
            if(Number.isFinite(position)&&position>=0)
                guard.position=Math.max(guard.position,position);
        });
        L.PlayerVideo.listener.follow('error',function(e){
            if(guardedNext&&e&&e.fatal)guardedNext.failed=true;
            if(guardedNext&&e&&e.fatal){
                var label=String(e.error||e.message||'');
                var part=label.match(/details\s*\[([^\]]{1,50})\]/i);
                var item=guardedNext.work;
                if(item)rememberHlsRecovery(item,
                    item.__amediaRecoveryBusy?'new_signed_url':'fatal',
                    part?part[1]:'network_error');
            }
        });
        L.PlayerVideo.listener.follow('ended',function(){
            var guard=guardedNext;
            if(!guard||!guard.loaded||guard.failed||!get('autoNext'))return;
            // A manifest failure, false 'ended' during seek, or premature
            // termination must never skip to the next episode.
            if(guard.duration<60||guard.position<guard.duration-12||
                Date.now()-guard.started<10000)return;
            var data=L.Player.playdata&&L.Player.playdata();
            if((data!==guard.work && (!data || !guard.work ||
                Number(data.season)!==Number(guard.work.season) ||
                Number(data.episode)!==Number(guard.work.episode)))||
                !L.PlayerPlaylist||!L.PlayerPlaylist.canNext||
                !L.PlayerPlaylist.next||!L.PlayerPlaylist.canNext())return;
            guard.loaded=false;
            L.PlayerPlaylist.next();
        });
        L.Player.listener.follow('destroy',function(){
            stopQueuedBridge();
            if(!guardedNext)return;
            var prior=guardedNext.work;
            setTimeout(function(){
                if(guardedNext&&guardedNext.work===prior)restoreAutoNext();
            },1200);
        });
    }
    function publishInnerQueue(job,data){
        if(!job||job.mode!=='inner'||!Array.isArray(data.playlist)||
            data.playlist.length<2)return;
        var attempts=0;
        function tryPublish(){
            if(!valid(job)||!job.launched||job.mode!=='inner')return;
            var current=null,completed=false;
            try{
                current=L.Player&&L.Player.playdata&&L.Player.playdata();
                if(current&&current.url===data.url&&
                    L.PlayerPlaylist&&typeof L.PlayerPlaylist.set==='function'){
                    // PlayerPlaylist.set() finds the active index by URL. The
                    // starting episode must match the actual playing URL;
                    // other episodes remain on-demand signed functions.
                    var selected=data.playlist.filter(function(item){
                        return item&&item.__amediaQueueItem&&
                            Number(item.season)===Number(data.season)&&
                            Number(item.episode)===Number(data.episode);
                    })[0];
                    var wasResolver=selected&&typeof selected.url==='function';
                    if(wasResolver){
                        selected.url=data.url;
                        selected.headers=data.headers||{};
                        selected.hls_headers=data.hls_headers||data.headers||{};
                    }
                    try{
                        L.PlayerPlaylist.set(data.playlist);
                        persistentInnerQueue={list:data.playlist,serial:++persistentInnerQueueSerial};
                        completed=true;
                        if(selected&&selected.__amediaResolveUrl)
                            lastLazyQueueItem=selected;
                    }catch(publishError){
                        if(wasResolver)selected.url=selected.__amediaResolveUrl;
                        throw publishError;
                    }
                }
            }catch(error){log('Очередь Lampa: плеер ещё не готов');}
            if(completed){
                job.innerQueuePublished=true;
                var status=queueSummary();
                if(status)rememberQueueStatus(Object.assign({},status,{
                    size:data.playlist.length,
                    resolved:status.lazy?0:data.playlist.length-1,
                    delivered:data.playlist.length
                }));
                return;
            }
            if(++attempts<88)
                job.innerQueueTimer=setTimeout(tryPublish,250);
            else{
                var status=queueSummary();
                if(status)rememberQueueStatus(Object.assign({},status,{
                    errors:(status.errors||[]).concat(['inner_player_not_ready'])
                }));
                log('Очередь Lampa: нет готового плеера');
            }
        }
        clearTimeout(job.innerQueueTimer);
        tryPublish();
    }

    function isOwnHandoff(job,data){
        if(!job||!job.payload||!data)return false;
        if(data===job.payload)return true;
        if(Number(data.__amediaLaunchId)>0 &&
            Number(data.__amediaLaunchId)===Number(job.id))return true;
        // Compatibility with Lampa forks that copy only known player fields.
        // Require both exact URL and title to avoid taking over another source.
        var original=job.payload;
        if(typeof data.url!=='string'||data.url!==original.url||
            !data.title||data.title!==original.title)return false;
        if(data.season!==undefined&&original.season!==undefined&&
            Number(data.season)!==Number(original.season))return false;
        if(data.episode!==undefined&&original.episode!==undefined&&
            Number(data.episode)!==Number(original.episode))return false;
        return true;
    }
    function onCreate(event) {
        var job = active;
        if (job && event && isOwnHandoff(job,event.data)) return;
        if(event&&event.data&&event.data.__amediaManaged){
            if(job&&job.mode==='inner')finish(job,'следующая серия внутри Amedia');
            return;
        }
        closeContext(context);
        finish(job, 'другой источник');
    }
    function nextEpisodeRequest(ctx, fromSeason, fromEpisode) {
        if(!ctx||!ctx.tree||!Array.isArray(ctx.tree.seasons))return null;
        var targetSeason=Number(fromSeason!==undefined?fromSeason:ctx.season&&ctx.season.number);
        var targetEpisode=Number(fromEpisode!==undefined?fromEpisode:ctx.episode&&ctx.episode.number);
        var current=ctx.tree.seasons.filter(function(season){
            return Number(season.number)===targetSeason;
        })[0];
        if(!current)return null;
        var episodes=(current.episodes||[]).slice()
            .sort(function(a,b){return Number(a.number)-Number(b.number);});
        // End of the current season is a hard boundary. Never auto-open S2.
        for(var i=0;i<episodes.length;i++){
            var episode=episodes[i];
            if(Number(episode.number)>targetEpisode&&
                episode.translations&&episode.translations.length)
                return {season:targetSeason,episode:episode.number};
        }
        return null;
    }
    function listen(job, target, name, callback) {
        if (!target || !target.addEventListener) return;
        var handler = function () { if (valid(job)) callback.apply(this, arguments); };
        target.addEventListener(name, handler);
        own(job, function () { target.removeEventListener(name, handler); });
    }
    function hlsOn(job, hls, name, callback) {
        if (!hls || !hls.on) return;
        var handler = function () { if (valid(job)) callback.apply(this, arguments); };
        hls.on(name, handler);
        own(job, function () { if (hls.off) hls.off(name, handler); });
    }

    // Reuse the actual image URLs Lampa provides on its Full card.
    function imageUrl(value, size) {
        if (!value || typeof value !== 'string') return '';
        var src=value.trim();
        if (!src || /["'<>\s]/.test(src)) return '';
        if (/^https?:\/\//i.test(src)) return src;
        if (/^\/\//.test(src)) return 'https:' + src;
        if (/^\.\/img\/[a-z0-9_.\/-]+$/i.test(src))return src;
        if (/^\/?t\/p\/(?:w\d+|original)\/[^?#\s]+/i.test(src)) {
            var asset='/' + src.replace(/^\/?t\/p\/(?:w\d+|original)\//i,'');
            return L.Api && typeof L.Api.img==='function' ?
                (L.Api.img(asset,size||'w500') || 'https://image.tmdb.org/t/p/'+(size||'w500')+asset) :
                'https://image.tmdb.org/t/p/'+(size||'w500')+asset;
        }
        // TMDB file_path may contain nested paths, uppercase hashes or
        // extra segments: don't drop an existing official cover arbitrarily.
        if (/^\/[a-z0-9_./-]+\.(?:jpe?g|png|webp|avif)(?:\?.*)?$/i.test(src)) {
            if (L.Api && typeof L.Api.img === 'function')
                return L.Api.img(src,size||'w500');
            if (L.TMDB && typeof L.TMDB.image === 'function')
                return L.TMDB.image('t/p/' + (size||'w500') + src) ||
                    'https://image.tmdb.org/t/p/'+(size||'w500')+src;
            return 'https://image.tmdb.org/t/p/'+(size||'w500')+src;
        }
        return '';
    }

    // Image URLs from Lampa/Skaz may be proxied or direct TMDB paths.
    // Try all known-safe representations before displaying a fallback tile.
    function imageAlternatives(values,size){
        var urls=[],seen=Object.create(null),res=size||'w300';
        function add(url){
            if(!url||typeof url!=='string')return;
            url=url.trim();
            if(!url||seen[url]||/["'<>\s]/.test(url))return;
            if(!/^https?:\/\//i.test(url)&&!/^\.\/img\//i.test(url))return;
            seen[url]=true;urls.push(url);
        }
        function parse(raw){
            if(!raw||typeof raw!=='string')return;
            raw=raw.trim();
            add(imageUrl(raw,res));
            var path='';
            if(/^\/?t\/p\/(?:w\d+|original)\//i.test(raw))
                path=raw.replace(/^\/?t\/p\/(?:w\d+|original)/i,'');
            else if(/^\/[a-z0-9_./-]+\.(?:jpe?g|png|webp|avif)(?:\?.*)?$/i.test(raw))
                path=raw;
            else{
                var match=raw.match(/^https?:\/\/image\.tmdb\.org\/t\/p\/(?:w\d+|original)(\/[^?#]+)/i);
                if(match)path=match[1];
            }
            if(path)add('https://image.tmdb.org/t/p/'+res+path);
        }
        (Array.isArray(values)?values:[values]).forEach(parse);
        return urls;
    }
    function loadArtwork(img,urls,ready,failed){
        var at=0;
        function next(){
            if(at<urls.length){img.attr('src',urls[at++]);return;}
            img.off('load.amediaArt error.amediaArt');
            if(failed)failed();
        }
        img.on('load.amediaArt',function(){
            img.off('load.amediaArt error.amediaArt');
            if(ready)ready();
        });
        img.on('error.amediaArt',next);
        next();
    }
    function isGenericEpisodeName(name) {
        return !name || /^(?:серия|эпизод|episode|ep\.?)\s*[0-9]+$/i.test(String(name).trim());
    }
    function lampaEpisode(ctx, season, episode) {
        var card = ctx.movie || {};
        var candidates = [card.episodes_original, card.episodes, card.episode_list];
        if (Array.isArray(card.seasons)) card.seasons.forEach(function (one) {
            if (Number(one.season_number || one.number) === Number(season))
                candidates.unshift(one.episodes);
        });
        var activity = L.Activity && L.Activity.active && L.Activity.active();
        var activeCard = activity && (activity.card || activity.movie);
        // Never borrow a different title's episode metadata from Activity.
        if (card.id && activeCard && activeCard.id && String(activeCard.id) === String(card.id)) {
            candidates.push(activeCard.episodes_original, activeCard.episodes);
        }
        var best = null;
        candidates.forEach(function (list) {
            if (!Array.isArray(list)) return;
            list.forEach(function (item) {
                if (!item || Number(item.episode_number || item.number) !== Number(episode)) return;
                if (item.season_number !== undefined && Number(item.season_number) !== Number(season)) return;
                if (item.season_number === undefined && Number(card.season_number || 1) !== Number(season)) return;
                if (!best) best = item;
                else if (isGenericEpisodeName(best.name || best.title) && !isGenericEpisodeName(item.name || item.title)) best = item;
            });
        });
        return best || null;
    }
    function episodeDetail(ctx, episode) {
        var season = ctx.season && ctx.season.number || 0;
        var own = lampaEpisode(ctx, season, episode.number) || {};
        var local = own.name || own.title || '';
        var streamed = episode.name || episode.title || '';
        var catalog = catalogCache[catalogKey(ctx.movie)];
        var found = catalog && catalog.episodes && catalog.episodes[season+':'+episode.number];
        // Prefer verified Russian catalog titles over English Skaz labels.
        var name = isCyrillicTitle(local)&&!isGenericEpisodeName(local)?local:
            isCyrillicTitle(found&&found.ru_name)?found.ru_name:
            isCyrillicTitle(streamed)&&!isGenericEpisodeName(streamed)?streamed:
            !isGenericEpisodeName(local)?local:
            !isGenericEpisodeName(streamed)?streamed:
            found&&found.name||local||streamed||'';
        var still = imageUrl(own.still_path || own.img || own.thumbnail, 'w300') ||
            imageUrl(episode.still_path || episode.img || episode.thumbnail, 'w300') ||
            imageUrl(found && found.image, 'w300');
        return {name:String(name), image:still};
    }
    function episodePoster(ctx, episode) {
        return episodeDetail(ctx, episode).image;
    }
    function watchCandidate(ctx) {
        if (!ctx.tree || !ctx.tree.seasons) return null;
        var first = null, lastFinished = null, inProgress = null;
        ctx.tree.seasons.forEach(function (season) {
            season.episodes.forEach(function (episode) {
                if (!episode.translations || !episode.translations.length) return;
                var item = {season: season, episode: episode}, old = ctx.season;
                ctx.season = season;
                var progress = episodeProgress(ctx, episode);
                ctx.season = old;
                if (!first) first = item;
                if (progress >= 95) lastFinished = item;
                if (progress > 0 && progress < 95) inProgress = item;
            });
        });
        if (inProgress) return inProgress;
        if (lastFinished) {
            var found = false, after = null;
            ctx.tree.seasons.some(function (season) {
                return season.episodes.some(function (episode) {
                    if (found && episode.translations && episode.translations.length) {
                        after = {season:season, episode:episode}; return true;
                    }
                    if (season === lastFinished.season && episode === lastFinished.episode) found = true;
                    return false;
                });
            });
            if (after) return after;
        }
        return first;
    }
    function escape(text) {
        return String(text === null || text === undefined ? '' : text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
    function show(ctx, options) {
        if (!live(ctx)) return;
        var generation = ctx.selectionGeneration = (ctx.selectionGeneration || 0) + 1;
        selection = {options: options, ctx: ctx};
        options.items.forEach(function (item) { item.title = escape(item.title); if (item.subtitle) item.subtitle = escape(item.subtitle); });
        var selected = options.onSelect, back = options.onBack;
        options.onSelect = function (item) {
            if (!live(ctx) || generation !== ctx.selectionGeneration) return;
            selection = null; selected(item);
        };
        options.onBack = function () {
            if (!live(ctx) || generation !== ctx.selectionGeneration) return;
            selection = null; back();
        };
        try { L.Select.show(options); }
        catch (error) { selection = null; closeContext(ctx); note('Amedia: окно выбора Lampa недоступно.'); }
    }
    function closeContext(ctx) {
        if (!ctx || ctx.closed) return;
        ctx.closed = true;
        if (selection && selection.ctx === ctx) {
            selection = null;
            safe(function () { L.Select.hide(); });
        }
        stopLoading(ctx);
        if (active && active.ctx === ctx) finish(active, 'выбор закрыт');
        if (context === ctx) context = null;
    }
    function backContent(ctx) { closeContext(ctx); safe(function () { L.Controller.toggle('content'); }); }
    function normalizeName(item) {
        return String(item && (item.name || item.label || item.translation || item.title) || '').toLowerCase();
    }
    // Heuristic preferences, NOT an objective quality rating of dubbing teams.
    // Fan translations and deliberately stylized voiceovers are subjective:
    // a manual per-series preference always overrides these soft weights.
    function voiceScore(item) {
        var n=normalizeName(item),score=0;
        if(!n)return -80;
        if(/субтитр|subtitle|subtitles|только сабы/.test(n))score-=180;
        if(/оригинал|original|без перевод|english|английск/.test(n))score-=110;
        if(/машинн|нейросет|робот|auto.?translate|ai.?voice/.test(n))score-=210;
        if(/комментар|commentary|тизер|trailer/.test(n))score-=220;
        if(/дубляж|дублирован|официальн|профессиональн|dubbed|dubbing/.test(n))score+=100;
        else if(/многоголос|multi.?voice/.test(n))score+=66;
        else if(/закадров/.test(n))score+=49;
        else if(/двухголос|two.?voice/.test(n))score+=33;
        else if(/одноголос|single.?voice/.test(n))score+=10;
        if(/red.?head.?sound|redhead|rhs|рэд.?хэд|рхс/.test(n))score+=87;
        else if(/hdrezka|hd.?rezka|резка.?студио|rezkastudio/.test(n))score+=78;
        else if(/lostfilm|лостфильм/.test(n))score+=77;
        else if(/tvshows|тв.?шоу[сз]?/.test(n))score+=72;
        else if(/newstudio|ньюстудио/.test(n))score+=63;
        else if(/jaskier|джаскиер/.test(n))score+=59;
        else if(/alexfilm|алексфильм|байбак|baibako/.test(n))score+=56;
        else if(/kubik|кубик/.test(n))score+=48;
        else if(/кураж.?бомбей/.test(n))score+=54;
        else if(/viruse?project|вирус.?проджект|newcomers|новамедиа|novamedia/.test(n))score+=45;
        if(/украинск|українськ/.test(n))score-=35;
        if(/18\+|без цензур|матерн/.test(n))score-=12;
        if(/5\.1|e.?ac.?3|dolby/.test(n))score+=3;
        return score;
    }
    function voiceContinuity(ctx,voice,episode) {
        if(!ctx||!ctx.tree||!ctx.season||!(episode||ctx.episode))return 0;
        episode=episode||ctx.episode;
        var n=normalizeName(voice),id=String(voice.id);
        var found=false,points=0,count=0;
        (ctx.tree.seasons||[]).some(function(season){
            return (season.episodes||[]).some(function(ep){
                if(!found){if(season===ctx.season&&ep===episode)found=true;return false;}
                if(count++>=4)return true;
                var translations=ep.translations||[];
                if(translations.some(function(v){
                    return String(v.id)===id || (n && normalizeName(v)===n);
                }))points+=4;
                return false;
            });
        });
        return points;
    }
    function streamHost(url) {
        var m=String(url||'').match(/^https?:\/\/([^/]+)\//i);
        return m?m[1].toLowerCase().replace(/:\d+$/,''):'';
    }
    function recentHostFailures() {
        try {
            var old=L.Storage.get(prefix+'failedHosts',{});
            if(!old||typeof old!=='object')return {};
            var result={};
            Object.keys(old).slice(0,20).forEach(function(host){
                var entry=old[host];
                if(entry&&Date.now()-Number(entry.at||0)<6*60*60*1000)
                    result[host]=Math.min(6,Math.max(0,Number(entry.count)||0));
            });
            return result;
        }catch(error){return {};}
    }
    function penalizeStream(url) {
        var host=streamHost(url);if(!host)return;
        var old=recentHostFailures();
        old[host]=Math.min(6,(old[host]||0)+1);
        var next={};
        Object.keys(old).slice(-12).forEach(function(key){
            next[key]={at:Date.now(),count:old[key]};
        });
        safe(function(){L.Storage.set(prefix+'failedHosts',next);});
    }

    // Host-only playback history. No signed URL, tokens or headers are saved.
    var videoHostMetrics=null, metricsLastSaved=0;
    function hostMetrics(){
        if(videoHostMetrics)return videoHostMetrics;
        var value={};
        try{value=L.Storage.get(prefix+'hostMetrics',{})||{};}catch(e){}
        if(!value||typeof value!=='object')value={};
        videoHostMetrics=Object.create(null);
        var count=0;
        Object.keys(value).forEach(function(host){
            if(count>=24)return;
            var entry=value[host];
            if(entry&&Date.now()-Number(entry.at||0)<12*60*60*1000 &&
                Number(entry.mbps)>0&&Number(entry.mbps)<800){
                videoHostMetrics[host]={mbps:Number(entry.mbps),at:Number(entry.at),count:Number(entry.count)||1};
                count++;
            }
        });
        return videoHostMetrics;
    }
    function recordHostFragment(url,stats){
        if(!stats||!stats.loading)return;
        var h=streamHost(url),stamp=stats.loading,ms=Number(stamp.end)-Number(stamp.start);
        var bytes=Number(stats.loaded||0);
        if(!h||!isFinite(ms)||ms<50||!isFinite(bytes)||bytes<32768)return;
        var mbps=Math.min(600,bytes*8/(ms*1000));
        if(!isFinite(mbps)||mbps<=0)return;
        var samples=hostMetrics(),prev=samples[h],rate=prev?prev.mbps*.72+mbps*.28:mbps;
        samples[h]={mbps:rate,at:Date.now(),count:Math.min(999,(prev&&prev.count||0)+1)};
        if(Date.now()-metricsLastSaved>15000){
            metricsLastSaved=Date.now();
            // Keep the small, short-lived EWMA cache only.
            try{
                L.Storage.set(prefix+'hostMetrics',samples);
                var failures=L.Storage.get(prefix+'failedHosts',{});
                if(failures&&failures[h]&&Number(failures[h].count)>0){
                    // A CDN that resumed serving fragments should gradually
                    // recover its score rather than stay banned for 6 hours.
                    var count=Math.max(0,Number(failures[h].count)-1);
                    if(count)failures[h]={count:count,at:Date.now()};
                    else delete failures[h];
                    L.Storage.set(prefix+'failedHosts',failures);
                }
            }catch(e){}
        }
    }
    function resolutionHeight(key){
        var label=String(key||'').toLowerCase();
        if(/(?:^|[^a-z0-9])(?:4k|uhd)(?:$|[^a-z0-9])/.test(label))return 2160;
        var m=label.match(/(?:2160|1440|1080|720|576|480|360)/);
        return m?Number(m[0]):0;
    }
    function networkVideoCap(){
        var nav=root.navigator||{},conn=nav.connection||nav.mozConnection||nav.webkitConnection||{};
        if(conn.saveData||/2g|slow-2g/.test(String(conn.effectiveType||'')))return 480;
        var downlink=Number(conn.downlink)||0;
        if(downlink>0){
            if(downlink<1.5)return 360;
            if(downlink<3)return 480;
            if(downlink<7)return 720;
            // Network Information API often overstates real CDN throughput.
            // Start at 1080p and promote to 4K only after measured fragments.
            return 1080;
        }
        if(/3g/.test(String(conn.effectiveType||'')))return 480;
        return 1080;
    }
    function chooseAdaptiveSource(variants,preferred,previousUrl){
        if(!variants||typeof variants!=='object')return null;
        var auto=!preferred||preferred==='auto';
        var ceiling=auto?networkVideoCap():resolutionHeight(preferred)||1080;
        var failed=recentHostFailures(),known=hostMetrics(),list=[],seen=Object.create(null);
        Object.keys(variants).forEach(function(label){
            var height=resolutionHeight(label),data=variants[label];
            if(data&&typeof data==='object')data=data.url||data.src||data.link;
            if(!height||typeof data!=='string')return;
            // Skaz may provide multiple alternatives separated by " or ".
            data.split(/\s+or\s+/i).forEach(function(candidate,index){
                var url=candidate.split('|')[0].trim();
                if(!/^https?:\/\/[^\s]+$/i.test(url)||seen[url]||url===previousUrl)return;
                seen[url]=true;
                var host=streamHost(url),speed=known[host]&&known[host].mbps||0;
                var confirmed=!!(known[host]&&known[host].count>=2);
                var strikes=failed[host]||0;
                var allowed=height<=ceiling;
                // An observed fast CDN may safely enable 4K in auto.
                if(auto&&height===2160&&confirmed&&speed>=30&&!strikes)allowed=true;
                var quality=allowed?height:-10000+height;
                // Reliability matters within the same quality, but one
                // failed CDN must not force 480p on every other host.
                // Prefer a reliable 720p CDN to a repeatedly failing 1080p CDN.
                // Signed hostnames are never rewritten.
                var score=quality-strikes*480 +
                    (speed>0?Math.min(85,Math.log(speed+1)*22):0)-index*5;
                list.push({url:url,height:height,score:score,allowed:allowed,host:host});
            });
        });
        if(!list.length)return null;
        var usable=list.filter(function(x){return x.allowed;});
        // If only a higher variant exists, play it rather than failing.
        if(!usable.length){
            // If no variant meets the bandwidth cap, choose the LOWEST
            // quality above it; don't accidentally launch 4K on 2G.
            list.sort(function(a,b){return a.height-b.height||b.score-a.score;});
            var low=list[0];
            return {url:low.url,height:low.height,host:low.host};
        }
        usable.sort(function(a,b){return b.score-a.score||b.height-a.height;});
        var result=usable[0];
        return {url:result.url,height:result.height,host:result.host};
    }
    function selectedResolution(options,variants,fallback){
        var preferred=options&&options.movie?titleQuality(options.movie):get('quality');
        var selected=chooseAdaptiveSource(variants,preferred);
        if(!selected)return fallback;
        // The Skaz heartbeat uses the *same label* as the video URL. Pull
        // that label from its own quality map rather than inventing a value.
        var keys=Object.keys(variants||{});
        var label=keys.filter(function(key){return resolutionHeight(key)===selected.height;})[0];
        return label||fallback;
    }
    function topVoice(ctx, episode) {
        var voices = (episode && episode.translations || []).filter(function(voice){
            return voice && voice.file_id;
        });
        if (!voices.length) return null;
        var preferred = titleVoice(ctx.movie);
        if (preferred !== 'auto' && preferred !== 'ask') {
            var found = voices.filter(function(voice) { return String(voice.id) === preferred; })[0];
            if (found) return found;
            // Translation IDs may differ between episodes: preserve the chosen
            // studio by name before falling back to the default quality ranking.
            var label = normalizeName(titlePreferences(ctx.movie).voiceLabel || '');
            if (label) {
                found = voices.filter(function(voice) { return normalizeName(voice) === label; })[0];
                if (found) return found;
            }
        }
        var best = voices[0], bestScore = -Infinity;
        var remembered = safeVoiceMemory(ctx);
        voices.forEach(function (voice) {
            var score = voiceScore(voice) +
                voiceContinuity(ctx,voice,episode) +
                (String(voice.id) === remembered ? 12 : 0) +
                (ctx.lastPlayedVoice && normalizeName(ctx.lastPlayedVoice)===normalizeName(voice) ? 12 : 0);
            if (score > bestScore) { best = voice; bestScore = score; }
        });
        return best;
    }
    function safeVoiceMemory(ctx) {
        try { return String(ctx.api.getVoice(ctx.movie) || ''); } catch (ignored) { return ''; }
    }
    function episodeProgress(ctx, episode) {
        // Resume controls seek behavior, not the visibility of saved watch history.
        try {
            var state = timeline({movie: ctx.movie, season: ctx.season.number, episode: episode.number});
            if (!state) return 0;
            var progress = Number(state.percent) || 0;
            if (!(progress > 0) && Number(state.duration) > 0) progress = Number(state.time) / Number(state.duration) * 100;
            return Math.round(Math.max(0, Math.min(100, isFinite(progress) ? progress : 0)));
        } catch (ignored) { return 0; }
    }


    function queuePlan(ctx, chosenVoice, playerMode) {
        if(!ctx||!ctx.tree||!ctx.season||!ctx.episode||
            !Array.isArray(ctx.tree.seasons))return [];
        // Only the season being watched: playing S1 never appends S2 or beyond.
        // Never request signed URLs for unrelated seasons, in either player.
        var selectedSeason=Number(ctx.season.number),episodes=[];
        ctx.tree.seasons.forEach(function(season){
            if(Number(season.number)!==selectedSeason)return;
            (season.episodes||[]).forEach(function(episode){
                if(episode.translations&&episode.translations.length)
                    episodes.push({season:season,episode:episode});
            });
        });
        episodes.sort(function(a,b){return Number(a.episode.number)-Number(b.episode.number);});
        var current=-1;
        for(var i=0;i<episodes.length;i++){
            if(Number(episodes[i].episode.number)===Number(ctx.episode.number))
                current=i;
        }
        if(current<0)return [];
        var result=[],near=[];
        for(var p=0;p<episodes.length;p++)if(p!==current)near.push(p);
        near.forEach(function (idx) {
            if (idx < 0 || idx >= episodes.length) return;
            var entry = episodes[idx], voice = null;
            if (chosenVoice) {
                entry.episode.translations.forEach(function (candidate) {
                    if (!voice && String(candidate.id) === String(chosenVoice.id)) voice = candidate;
                });
            }
            if (!voice || !voice.file_id) voice = topVoice(ctx, entry.episode);
            if (!voice || !voice.file_id)
                voice = entry.episode.translations.filter(function(v){return v && v.file_id;})[0];
            if (!voice || !voice.file_id) return;
            var currentSeason = ctx.season;
            ctx.season = entry.season;
            var shot = episodePoster(ctx, entry.episode);
            ctx.season = currentSeason;
            result.push({offset:idx - current, season:entry.season.number, episode:entry.episode.number,
                fileId:voice.file_id, voiceId:voice.id,
                title:(function () {
                    var original = ctx.season;
                    ctx.season = entry.season;
                    var name = episodeDetail(ctx, entry.episode).name || 'Серия ' + entry.episode.number;
                    ctx.season = original;
                    return (ctx.movie.title || ctx.movie.name || 'Видео') + ' · ' + name;
                }()),
                thumbnail:shot});
        });
        return result;
    }

    function bestQueueStream(response, getQualities, wanted) {
        var payload=response && response.data || {};
        var candidates=payload.hlsSource ||
            payload.data && payload.data.hlsSource || [];
        if (!Array.isArray(candidates)) candidates=[candidates];
        if (!candidates.length && payload.quality) candidates=[payload];
        function asUrl(value) {
            if (value && typeof value === 'object') value=value.url || value.src || value.link;
            if (typeof value !== 'string') return '';
            var url=value.split('|')[0].trim();
            return /^https?:\/\//i.test(url) ? url : '';
        }
        for (var i=0;i<candidates.length;i++) {
            var track=candidates[i] || {};
            var map=getQualities ? getQualities(track) : (track.qualities || track.quality);
            if (!map || typeof map !== 'object' || !Object.keys(map).length)
                map=track.quality || track.qualities || track;
            if (wanted && wanted !== 'auto') {
                var preferred=asUrl(map[wanted] || map[wanted+'p']);
                if (preferred) return preferred;
            }
            var adaptive=chooseAdaptiveSource(map,wanted||'auto');
            if(adaptive)return adaptive.url;
            var fallback=asUrl(track.url || track.stream || track.src);
            if (fallback) return fallback;
        }
        return '';
    }

    function rememberHlsRecovery(work,stage,detail){
        // Do not persist signed URLs, headers or authorization tokens.
        var previous={};
        try{previous=L.Storage.get(prefix+'lastHlsRecovery',{})||{};}
        catch(error){}
        var current={phase:String(stage||'unknown').slice(0,32),
            season:Number(work&&work.season)||0,episode:Number(work&&work.episode)||0,
            host:streamHost(work&&work.url).slice(0,90),
            attempt:Number(work&&work.__amediaFreshCount)||0,
            error:detail===undefined?String(previous.error||'').slice(0,60):
                String(detail||'').slice(0,60),
            at:Date.now()};
        safe(function(){L.Storage.set(prefix+'lastHlsRecovery',current);});
        return current;
    }
    // Work with Lampa Player's native error(work, callback) contract.
    // Keep the episode open while changing a failed HLS URL.
    function recoverStream(job,options,work,resolve,getQualities) {
        if(!work||job.mode!=='inner'||!options||typeof resolve!=='function')return work;
        var tried={},freshCount=0,maximumFresh=2;
        work.__amediaManaged=true;
        work.__amediaVoiceId=work.__amediaVoiceId||options.voiceId||null;
        work.__amediaRecoveryBusy=false;
        delete work.url_reserve; // Lampa otherwise invokes reserve and error together.
        function alternatives(){
            var all=work.quality||work.__amediaAlternates||{},available={};
            var activeHeight=0;
            Object.keys(all).forEach(function(key){
                var value=all[key];
                if(value&&typeof value==='object')value=value.url||value.src;
                if(typeof value==='string'&&value.split('|')[0].trim()===work.url)
                    activeHeight=resolutionHeight(key)||0;
            });
            Object.keys(all).forEach(function(key){
                var value=all[key];
                if(value&&typeof value==='object')value=value.url||value.src;
                if(typeof value!=='string')return;
                var url=value.split('|')[0].trim();
                if(/^https?:\/\//i.test(url)&&!tried[url]&&url!==work.url)available[key]=url;
            });
            // A failed 480p stream should not escalate to an even higher
            // bitrate. Prefer a different CDN at the current/lower level.
            var cap=String(activeHeight||networkVideoCap());
            return chooseAdaptiveSource(available,cap,work.url);
        }
        function fresh(){
            if(typeof options.queueLookup!=='function')
                return Promise.reject(new Error('Нет нового поиска Skaz'));
            return Promise.resolve().then(function(){
                return options.queueLookup(options.movie);
            }).then(function(session){
                if(!session||!session.embed||!session.hP)
                    throw new Error('Новый сеанс Skaz не получен');
                var fileId=session.embed.fileActiveId;
                if(work.episode!==undefined&&work.season!==undefined){
                    if(typeof options.queueTree!=='function')throw new Error('Нет дерева серий');
                    var tree=options.queueTree(session.embed.fileList)||{},seasons=tree.seasons||[];
                    var season=seasons.filter(function(one){
                        return Number(one.number)===Number(work.season);
                    })[0];
                    var episode=season&&(season.episodes||[]).filter(function(one){
                        return Number(one.number)===Number(work.episode);
                    })[0];
                    if(!episode)throw new Error('Точная серия недоступна');
                    var voices=(episode.translations||[]).filter(function(one){return one&&one.file_id;});
                    var id=String(work.__amediaVoiceId||options.voiceId||'');
                    var same=voices.filter(function(one){return String(one.id)===id;})[0];
                    voices.sort(function(a,b){return voiceScore(b)-voiceScore(a);});
                    var selected=freshCount<=1&&same?same:
                        voices.filter(function(one){return !same||String(one.id)!==String(same.id);})[0]||same;
                    if(!selected)throw new Error('Нет озвучки для серии');
                    fileId=selected.file_id;
                    work.__amediaVoiceId=selected.id;
                }
                var previous=session.embed.__amediaSeedTail||Promise.resolve();
                var task=previous.then(function(){
                    return resolve({metaSeed:session.embed.metaSeed,fileActiveId:fileId,
                        hP:session.hP,refererUrl:session.embed.embedUrl});
                });
                session.embed.__amediaSeedTail=task.then(function(){},function(){});
                return task.then(function(raw){
                    if(work.__amediaQueueItem&&raw&&raw.data){
                        var freshData=raw.data;
                        var chosen=(freshData.hlsSource||[])[0]||{};
                        var qualities=getQualities?getQualities(chosen):
                            chosen.qualities||chosen.quality||{};
                        work.__amediaAlternates=qualities;
                        work.__amediaStreamBackend={
                            pnr:freshData.pnr||'',pnk:freshData.pnk||raw.pnk||'',
                            resolution:selectedResolution(options,qualities,'720p'),
                            trackId:chosen.trackId||chosen.id||'1'
                        };
                        work.__amediaHP=session.hP;
                        work.__amediaGuard=session.guard;
                        if(work.headers)work.headers['Accepts-Controls']=String(session.hP);
                    }
                    var url=bestQueueStream(raw,getQualities,freshCount===1?'720':'480');
                    if(!/^https?:\/\//i.test(url)||tried[url])
                        throw new Error('Нет новой ссылки');
                    if(session.embed.embedUrl&&work.headers){
                        work.headers.Referer=session.embed.embedUrl;
                        if(work.hls_headers)work.hls_headers.Referer=session.embed.embedUrl;
                    }
                    return url;
                });
            });
        }
        function restorePosition(position) {
            if(!(Number.isFinite(position)&&position>3)||
                !L.PlayerVideo||!L.PlayerVideo.listener)return;
            var listener=L.PlayerVideo.listener,armed=true,timer=null;
            function stop(){
                if(!armed)return;
                armed=false;clearTimeout(timer);
                if(listener.remove)listener.remove('loadeddata',apply);
            }
            function apply(info){
                if(!armed)return;
                stop();
                var player=L.Player&&L.Player.playdata&&L.Player.playdata();
                if(player!==work)return;
                var video=L.PlayerVideo.video&&L.PlayerVideo.video();
                var duration=Number(info&&info.duration)||Number(video&&video.duration)||0;
                var seek=Math.max(0,Math.min(position,duration>10?duration-5:position));
                if(seek>3&&L.PlayerVideo.to)safe(function(){L.PlayerVideo.to(seek);});
                else if(seek>3&&video)safe(function(){video.currentTime=seek;});
            }
            listener.follow('loadeddata',apply);
            timer=setTimeout(stop,15000);
        }
        function videoPosition(){
            try{
                var video=L.PlayerVideo&&L.PlayerVideo.video&&L.PlayerVideo.video();
                return Number(video&&video.currentTime)||0;
            }catch(error){return 0;}
        }
        work.error=function(player,callback){
            if(work.__amediaRecoveryBusy||typeof callback!=='function')return;
            work.__amediaHadError=true;
            work.__amediaRecoveryBusy=true;
            rememberHlsRecovery(work,'fatal');
            penalizeStream(work.url);
            tried[work.url]=true;
            var position=videoPosition(),updated=false;
            function deliver(url){
                if(updated||typeof url!=='string'||!/^https?:\/\//i.test(url))return;
                if(L.Player&&L.Player.playdata&&L.Player.playdata()!==work)return;
                updated=true;work.url=url;tried[url]=true;
                work.__amediaRecoveryBusy=false;
                rememberHlsRecovery(work,'recovery_sent');
                // Lampa's Video.error hook recreates the HLS instance without
                // sending Player.start again. Refresh the per-episode network
                // bridge as well, otherwise it retains the failed session.
                if(work.__amediaQueueItem)activateQueuedBridge(work);
                restorePosition(position);
                callback(url);
            }
            var variant=alternatives();
            if(variant){
                rememberHlsRecovery(work,'backup_quality');
                log('HLS: запасной вариант без смены серии');
                deliver(variant.url);return;
            }
            function tryFresh(){
                if(freshCount>=maximumFresh){
                    work.__amediaRecoveryBusy=false;
                    work.__amediaRecoveryFailed=true;
                    rememberHlsRecovery(work,'exhausted');
                    note('Amedia: поток недоступен. Попробуйте другую озвучку или источник.');
                    // A missing callback leaves Lampa's video loader spinning.
                    // End only this item; never close somebody else's player.
                    safe(function(){
                        if(L.Player&&L.Player.playdata&&L.Player.playdata()===work&&
                            typeof L.Player.close==='function')L.Player.close();
                    });
                    return;
                }
                freshCount++;
                work.__amediaFreshCount=freshCount;
                rememberHlsRecovery(work,'new_signed_url');
                fresh().then(function(url){
                    log('HLS: новая ссылка той же серии');deliver(url);
                },function(){tryFresh();});
            }
            tryFresh();
        };
        return work;
    }
    // Lampa accepts a function as playlist.item.url. Resolve the signed link
    // only when the viewer actually chooses the episode. Pre-resolved links
    // were expiring while the previous episode was playing, and the original
    // XHR/heartbeat hooks were already gone when Lampa switched items.
    function prepareLazyInnerQueue(job,options,data,resolve,getQualities){
        check(job);
        if(job.mode!=='inner'||!Array.isArray(options.queuePlan)||
            !options.queuePlan.length)return [];
        // These entries are lightweight references. No eager network request
        // and no fixed three-episode cap for Lampa's native playlist.
        var plan=options.queuePlan.filter(function(entry){
            return entry&&Number(entry.season)===Number(data.season);
        }),ready=[],lazyToken=++lazyQueueSerial;
        if(!plan.length)return [];
        function addLazyItem(descriptor){
            var item={title:descriptor.title||'Серия '+descriptor.episode,
                season:descriptor.season,episode:descriptor.episode,
                thumbnail:descriptor.thumbnail||'',card:data.card,
                timeline:timeline({movie:options.movie,
                    season:descriptor.season,episode:descriptor.episode}),
                __amediaManaged:true,__amediaQueueItem:true};
            item.url=function(onReady){
                if(typeof onReady!=='function')return;
                var old=L.Player&&L.Player.playdata&&L.Player.playdata();
                var tries=0,finished=false,timeout=null;
                function liveSelection(){
                    return !finished && lazyToken===lazyQueueSerial &&
                        (!old||!L.Player||!L.Player.playdata||
                            L.Player.playdata()===old);
                }
                function complete(error,info){
                    if(finished)return;
                    var stillSelected=liveSelection();
                    finished=true;clearTimeout(timeout);
                    if(!stillSelected)return;
                    if(error){
                        note('Amedia: ссылку серии не удалось обновить. Попробуйте открыть серию заново.');
                        // Lampa's URL-function branch retains a loading lock
                        // until Player.destroy(), so never leave it spinning.
                        if(L.Player&&L.Player.close)safe(function(){L.Player.close();});
                        return;
                    }
                    item.url=info.url;
                    item.headers=info.headers;
                    item.hls_headers=info.headers;
                    item.__amediaHP=info.hP;
                    item.__amediaGuard=info.guard;
                    item.__amediaStreamBackend=info.backend;
                    item.__amediaAlternates=info.alternates;
                    item.__amediaVoiceId=info.voiceId;
                    recoverStream({mode:'inner'},{
                        movie:options.movie,queueLookup:options.queueLookup,
                        queueTree:options.queueTree,voiceId:info.voiceId
                    },item,resolve,getQualities);
                    onReady();
                }
                function lookup(){
                    if(typeof options.queueLookup!=='function'||
                        typeof options.queueTree!=='function')
                        return Promise.reject(new Error('Skaz lookup missing'));
                    return Promise.resolve().then(function(){
                        return options.queueLookup(options.movie);
                    }).then(function(session){
                        if(!session||!session.embed||!session.hP)
                            throw new Error('Skaz session unavailable');
                        var tree=options.queueTree(session.embed.fileList)||{};
                        var season=(tree.seasons||[]).filter(function(x){
                            return Number(x.number)===Number(descriptor.season);
                        })[0];
                        var episode=season&&(season.episodes||[]).filter(function(x){
                            return Number(x.number)===Number(descriptor.episode);
                        })[0];
                        if(!episode)throw new Error('Exact episode unavailable');
                        var voices=(episode.translations||[]).filter(function(x){
                            return x&&x.file_id;
                        });
                        var voice=voices.filter(function(x){
                            return String(x.id)===String(descriptor.voiceId);
                        })[0];
                        if(!voice){
                            voices.sort(function(a,b){return voiceScore(b)-voiceScore(a);});
                            voice=voices[0];
                        }
                        if(!voice)throw new Error('No playable voice');
                        var fresh={embed:session.embed,fileId:voice.file_id,hP:session.hP};
                        // This is a NEW embed session. Do not wait behind
                        // another (possibly stalled) episode's seed chain.
                        // Within the same embed, requests stay sequential.
                        var previous=fresh.embed.__amediaSeedTail||Promise.resolve();
                        var task=previous.then(function(){
                            return resolve({metaSeed:fresh.embed.metaSeed,
                                fileActiveId:fresh.fileId,hP:fresh.hP,
                                refererUrl:fresh.embed.embedUrl});
                        });
                        fresh.embed.__amediaSeedTail=task.then(function(){},function(){});
                        return task.then(function(raw){
                            var payload=raw&&raw.data||{};
                            var sources=payload.hlsSource||[];
                            var source=Array.isArray(sources)&&sources[0]||{};
                            var alternates=getQualities?getQualities(source):
                                source.qualities||source.quality||{};
                            var wanted=options.movie?titleQuality(options.movie):get('quality');
                            var url=bestQueueStream(raw,getQualities,wanted);
                            if(!/^https?:\/\//i.test(url))
                                throw new Error('No HLS stream for exact episode');
                            var headers={};
                            Object.keys(data.headers||{}).forEach(function(key){
                                var val=data.headers[key];
                                if(typeof val==='string')headers[key]=val;
                            });
                            if(session.embed.embedUrl)headers.Referer=session.embed.embedUrl;
                            if(session.hP)headers['Accepts-Controls']=String(session.hP);
                            // Rebind Authorizations only when the original
                            // guard appears verbatim. No guessed bearer token
                            // or authentication format is ever fabricated.
                            var prior=String(options.guard||''),
                                freshGuard=String(session.guard||'');
                            if(prior&&freshGuard&&prior!=='[object Object]'&&
                                freshGuard!=='[object Object]'&&
                                headers.Authorizations&&
                                headers.Authorizations.indexOf(prior)>=0)
                                headers.Authorizations=headers.Authorizations.replace(prior,freshGuard);
                            var resolution=selectedResolution(options,alternates,'720p');
                            return {url:url,headers:headers,hP:session.hP,
                                guard:session.guard,voiceId:voice.id,
                                alternates:alternates,backend:{
                                    pnr:payload.pnr||'',pnk:payload.pnk||raw.pnk||'',
                                    trackId:source.trackId||source.id||'1',
                                    resolution:resolution}};
                        });
                    });
                }
                function attempt(){
                    if(!liveSelection())return;
                    tries++;
                    lookup().then(function(info){
                        if(liveSelection())complete(null,info);
                    },function(error){
                        if(!liveSelection())return;
                        if(tries<2)attempt();
                        else complete(error);
                    });
                }
                timeout=setTimeout(function(){
                    if(!finished)complete(new Error('Skaz timeout'));
                },20000);
                attempt();
            };
            item.__amediaResolveUrl=item.url;
            ready.push({offset:descriptor.offset,data:item});
        }
        plan.forEach(addLazyItem);
        // Also refresh the currently playing item if the viewer revisits it
        // through the playlist later. The active Player retains its own URL,
        // while the playlist stores a re-resolving function for every item.
        addLazyItem({offset:0,season:data.season,episode:data.episode,
            title:data.title,thumbnail:data.thumbnail||'',
            voiceId:options.voiceId,fileId:options.fileId});
        ready.sort(function(a,b){return a.offset-b.offset;});
        var list=ready.map(function(entry){return entry.data;});
        data.playlist=list;
        // Lazy entries have metadata, but not yet signed URLs. Keep diagnostics honest.
        rememberQueueStatus({planned:plan.length,resolved:0,size:list.length,
            delivered:null,mode:'inner',lazy:true,errors:[],createdAt:Date.now()});
        return list;
    }
    function makeQueue(job, options, data, resolve, getQualities) {
        // The UA Player launch is deliberately instant. The Java/Kotlin Lampa
        // Intent contract accepts per-item URLs but only one shared header set;
        // Amedia/Skaz episodes have individually rotating signed credentials.
        // Sending an eager season list here would delay first frame and later
        // produce expired manifests. Do not misrepresent an invalid queue as
        // working. Native Lampa keeps its existing lazy, full-season queue.
        return Promise.resolve();
    }
    function audio(ctx, job, tracks) {
        check(job);
        if (!tracks || !tracks.length) return Promise.reject(new Error('Amedia: нет аудиодорожек.'));
        var selected = 0, score = -Infinity;
        tracks.forEach(function (track, index) {
            var candidate = voiceScore(track);
            if (candidate > score) { score = candidate; selected = index; }
        });
        var pref = titleVoice(ctx.movie);
        if (ctx.retryDone && !ctx.tree && tracks.length > 1 && pref === 'auto') {
            // If the preferred HLS track failed to resolve, don't pick the
            // identical track from the fresh embed in the only retry.
            var others=tracks.map(function(track,index){return {track:track,index:index};})
                .filter(function(item){
                    return String(item.track.audioId || item.track.id || item.index) !==
                        String(ctx.lastAutoAudioId);
                }).sort(function(left,right){
                    return voiceScore(right.track)-voiceScore(left.track);
                });
            if (others.length) selected=others[0].index;
        }
        if (pref !== 'auto' && pref !== 'ask') {
            tracks.forEach(function (track, index) {
                if (String(track.audioId) === pref ||
                    (titlePreferences(ctx.movie).voiceLabel &&
                    normalizeName(track) === String(titlePreferences(ctx.movie).voiceLabel).toLowerCase())) selected = index;
            });
        }
        function commit(index, persist) {
            var id = tracks[index].audioId;
            ctx.lastAutoAudioId=String(id !== undefined && id !== null ? id :
                tracks[index].id !== undefined ? tracks[index].id : index);
            if (id !== undefined && id !== null) {
                ctx.api.setVoice(ctx.movie, id);
                if (persist) {
                    saveTitlePreference(ctx.movie, 'voice', String(id));
                    saveTitlePreference(ctx.movie, 'voiceLabel', tracks[index].name || tracks[index].label || 'Дорожка ' + (index + 1));
                }
            }
            return index;
        }
        if (pref === 'ask' && tracks.length > 1) {
            stopLoading(job);
            return new Promise(function (resolve, reject) {
                show(ctx, {
                    title:'Озвучка · ' + (ctx.movie.title || ctx.movie.name || 'Фильм'),
                    items:tracks.map(function (track, index) {
                        return {title:track.name || track.label || 'Дорожка ' + (index + 1),
                            index:index, selected:index === selected};
                    }),
                    onSelect:function (choice) {
                        loading(job, function(){ finish(job,'отмена озвучки'); closeContext(ctx); });
                        resolve(commit(choice.index, true));
                    },
                    onBack:function () {
                        closeContext(ctx);
                        reject(cancelError());
                    }
                });
            });
        }
        log('Аудиодорожка: ' + (selected + 1) + '/' + tracks.length);
        return Promise.resolve(commit(selected, false));
    }

    function report(ctx, error) {
        if (error && error.amediaCancelled) return;
        if (!live(ctx)) return;
        // Avoid displaying raw service URLs, query tokens or request headers.
        note('Amedia: не удалось загрузить эту серию. Можно попробовать ещё раз.');
        // One broken CDN / expired Borth must never destroy the entire
        // episode browser or make its rows permanently unclickable.
        log('Ошибка подготовки потока');
        ctx.busy=false;
        ctx.retryDone=false;
        stopLoading(ctx);
        safe(function () { L.Controller.toggle('content'); });
    }

    function resilientLookup(ctx) {
        // Only a single catalog lookup per attempt. No speculative retries,
        // background scraping or alternate-ID enumeration.
        return Promise.resolve().then(function(){ return ctx.api.lookup(ctx.movie); });
    }
    function retryFreshStream(ctx, job, failedVoice, error, allowLaunched) {
        if (!live(ctx) || error && error.amediaCancelled) return Promise.resolve();
        // Respect rate limits / authorization rejections; never hammer Skaz.
        var reason=String(error&&(error.status||error.code||error.message)||'');
        if (/\b(429|401|403)\b|too.many|rate.limit|лимит|запрещ/i.test(reason)) {
            finish(job,'сервер ограничил запрос');
            report(ctx,error);
            return Promise.resolve();
        }
        if (job && job.launched && !allowLaunched || ctx.retryDone) {
            finish(job,'ошибка воспроизведения');
            report(ctx,error);
            return Promise.resolve();
        }
        ctx.retryDone=true;
        finish(job,'первая попытка неудачна');
        loading(ctx,function(){closeContext(ctx);});
        var season=ctx.season && ctx.season.number, episode=ctx.episode && ctx.episode.number;
        return resilientLookup(ctx).then(function(result){
            if(!live(ctx))throw cancelError();
            ctx.embed=result.embed;
            ctx.hP=result.hP;
            ctx.guard=result.guard;
            ctx.guardTime=Date.now();
            var voice=null;
            if(season!==undefined && episode!==undefined){
                var tree=ctx.api.tree(ctx.embed.fileList);
                var freshSeason=tree && tree.seasons && tree.seasons.filter(function(s){
                    return Number(s.number)===Number(season);
                })[0];
                var freshEpisode=freshSeason && freshSeason.episodes.filter(function(e){
                    return Number(e.number)===Number(episode);
                })[0];
                if(!freshEpisode)throw new Error('Amedia: серия отсутствует в альтернативном источнике');
                ctx.tree=sortedTree(tree);ctx.season=freshSeason;ctx.episode=freshEpisode;
                var list=freshEpisode.translations || [];
                // Fresh auth can produce a NEW signed URL even when the
                // provider's file_id is unchanged. Do not discard the only
                // playable studio solely because its catalog ID is stable.
                if(failedVoice)voice=list.filter(function(v){
                    return v.file_id && String(v.id)===String(failedVoice.id);
                })[0];
                if(!voice)voice=list.filter(function(v){return v.file_id;})
                    .sort(function(a,b){return voiceScore(b)-voiceScore(a);})[0];
                if(!voice)throw new Error('Amedia: нет альтернативных озвучек для этой серии');
            }
            ctx.busy=false;
            stopLoading(ctx);
            return start(ctx,voice,true);
        }).catch(function(secondError){
            if(!live(ctx) || secondError && secondError.amediaCancelled) return;
            stopLoading(ctx);
            report(ctx,secondError);
        });
    }
    function start(ctx, voice, fromRetry) {
        if (!live(ctx) || ctx.busy) return Promise.resolve();
        // Each intentional episode selection owns a fresh retry budget.
        // Only the automatic second attempt keeps retryDone=true.
        if(!fromRetry)ctx.retryDone=false;
        ctx.lastPlayedVoice=voice || null;
        ctx.busy = true;
        var job;
        try {
            job=begin({ctx:ctx});
        } catch(error) {
            // A repeated remote action while another signed request is
            // preparing must not leave the hub permanently marked busy.
            ctx.busy=false;
            note('Amedia: подождите окончания подготовки текущей серии.');
            return Promise.resolve();
        }
        loading(job, function () { finish(job, 'отмена загрузки'); closeContext(ctx); });
        return Promise.resolve().then(function () {
            check(job);
            if (Date.now() - ctx.guardTime < 25000) return ctx.guard;
            return ctx.api.guard(ctx.hP).then(function (guard) { ctx.guard = guard; ctx.guardTime = Date.now(); return guard; });
        }).then(function (guard) {
            check(job);
            if (voice) ctx.api.setVoice(ctx.movie, voice.id);
            var options = {clientJob: job, embed: ctx.embed, hP: ctx.hP, guard: guard, movie: ctx.movie,
                fileId: voice ? voice.file_id : ctx.embed.fileActiveId, title: ctx.movie.title || ctx.movie.name};
            if (voice) {
                // Resolve the nearest playable episodes with the original Skaz
                // resolver before handing a JSON playlist to the Android player.
                // Never send IDs or callbacks as stand-ins for playable URLs.
                options.voiceId=voice.id;
                options.queuePlan = queuePlan(ctx, voice, job.mode);
                options.queueLookup = function(){return ctx.api.lookup(ctx.movie);};
                options.queueTree = ctx.api.tree;
                job.queuePlanned = options.queuePlan.length;
                options.thumbnail = ctx.request.nativeThumbnail || episodePoster(ctx, ctx.episode);
                options.season = ctx.season.number; options.episode = ctx.episode.number;
                options.nativeTimeline = ctx.request.nativeTimeline || null;
                options.title += ' · ' + (ctx.request.nativeTitle || ('S' + options.season + 'E' + options.episode)) + ' · ' + voice.name;
            } else {
                options.queueLookup=function(){return ctx.api.lookup(ctx.movie);};
                options.queueTree=ctx.api.tree;
                options.audioPick = function (tracks) { return audio(ctx, job, tracks); };
                options.recoveryFallbackQuality = !!ctx.retryDone && titleQuality(ctx.movie)==='auto';
            }
            return ctx.api.play(options);
        }).then(function () { ctx.busy = false; stopLoading(job); }, function (error) {
            return retryFreshStream(ctx, job, voice, error);
        });
    }

    // Native Lampa is the only movie/episode browser. Amedia resolves one
    // exact film or episode and opens the normal Player without any hub.
    function open(movie, api, request) {
        request = request || {};
        if (!movie) return Promise.resolve();
        if (context && context.busy) {
            note('Amedia: завершите подготовку текущего видео.');
            return Promise.resolve();
        }
        closeContext(context);
        finish(active, 'новая карточка');
        var ctx = {movie:movie, api:api, request:request, closed:false, busy:true};
        context = ctx;
        loading(ctx, function () { closeContext(ctx); });
        return Promise.resolve().then(function () {
            if (!live(ctx)) throw cancelError();
            return resilientLookup(ctx);
        }).then(function (result) {
            if (!live(ctx)) throw cancelError();
            ctx.embed = result.embed;
            ctx.hP = result.hP;
            ctx.guard = result.guard;
            ctx.guardTime = Date.now();
            ctx.busy = false;
            stopLoading(ctx);
            var kind = ctx.embed && ctx.embed.fileList && ctx.embed.fileList.type;
            if (['serial', 'series', 'tvshow', 'anime-serial'].indexOf(kind) >= 0) {
                ctx.tree = sortedTree(api.tree(ctx.embed.fileList));
                if (!ctx.tree || !ctx.tree.seasons || !ctx.tree.seasons.length)
                    throw new Error('Amedia: сериал без доступных сезонов');
                if (request.season !== undefined && request.episode !== undefined) {
                    ctx.season = ctx.tree.seasons.filter(function (s) {
                        return Number(s.number) === Number(request.season);
                    })[0];
                    if (ctx.season) ctx.episode = ctx.season.episodes.filter(function (e) {
                        return Number(e.number) === Number(request.episode);
                    })[0];
                    if (!ctx.season || !ctx.episode) {
                        note('Amedia: этой серии нет в доступных источниках.');
                        closeContext(ctx);
                        return;
                    }
                } else {
                    var candidate = watchCandidate(ctx);
                    if (!candidate) throw new Error('Amedia: серий нет');
                    ctx.season = candidate.season;
                    ctx.episode = candidate.episode;
                }
            } else if (request.season !== undefined && request.episode !== undefined) {
                note('Amedia: источник не содержит доступных серий.');
                closeContext(ctx);
                return;
            }
            if (request.manual) showPreferences(ctx);
            else if (request.season !== undefined && request.episode !== undefined) return playFromContext(ctx);
            else if (ctx.tree) return openHub(ctx);
            else return playFromContext(ctx);
        }).catch(function (error) {
            stopLoading(ctx);
            ctx.busy = false;
            report(ctx,error);
        });
    }

    // Amedia's source of truth remains the original Skaz lookup/tree/guard/play.
    // The UI borrows the shape of Skaz Online's prestige episode rows, NOT its
    // network, auth, balancers, plugin lifecycle, or signed URLs.
    var hubRegistered = false, hubContext = null;
    function sortedTree(tree) {
        if (!tree || !Array.isArray(tree.seasons)) return tree;
        tree.seasons = tree.seasons.filter(function(s) {
            return s && Number(s.number) >= 1 && Array.isArray(s.episodes);
        }).sort(function(a,b) {return Number(a.number) - Number(b.number);});
        tree.seasons.forEach(function(s) {
            s.episodes = s.episodes.filter(function(e) {
                return e && Number(e.number) >= 1;
            }).sort(function(a,b) {return Number(a.number) - Number(b.number);});
        });
        return tree;
    }
    // Self-contained Amedia TV interface. No patches to Lampa's native episode lists.
    // Controls are ordinary Lampa selectors for remote, mouse and touch navigation.

    // Presentation-only skin: native Lampa controls and controller stay active.

    // Amedia Cinema uses the native Lampa panel, with *no* extra selector
    // buttons, no seek handlers and no changes to the active TV controller.
    var cinemaSkin=(function(){
        var work=null,node=null,header=null,timers=[];
        function current(){
            try{return L.Player&&L.Player.playdata&&L.Player.playdata();}
            catch(e){return null;}
        }
        function owns(data){return !!(work&&data&&data.__amediaManaged&&
            (work===data||(work.__amediaLaunchId&&
              work.__amediaLaunchId===data.__amediaLaunchId)));}
        function label(className,value){
            var el=root.document.createElement('div');
            el.className=className;
            if(value!==undefined)el.textContent=String(value);
            return el;
        }
        function detach(){
            if(header&&header.parentNode)header.parentNode.removeChild(header);
            header=null;
            if(node&&node.classList)node.classList.remove('amedia-cinema');
            node=null;
        }
        function stop(){
            work=null;timers.forEach(clearTimeout);timers=[];detach();
        }
        function mount(){
            if(!work||!owns(current())||!root.document)return false;
            var element=null;
            try{
                var render=L.Player&&L.Player.render&&L.Player.render();
                element=render&&(render[0]||render.get&&render.get(0));
            }catch(e){}
            if(!element||!element.querySelector){
                element=root.document.querySelector&&root.document.querySelector('.player');
            }
            if(!element||!element.querySelector)return false;
            var body=element.querySelector('.player-panel__body');
            if(!body)return false;
            if(node===element&&header&&header.parentNode)return true;
            detach();
            node=element;node.classList.add('amedia-cinema');
            header=label('amedia-cinema__header');
            var info=label('amedia-cinema__heading');
            info.appendChild(label('amedia-cinema__brand','AMEDIA'));
            var card=work.card||work.movie||{};
            var title=String(card.title||card.name||work.title||'Просмотр');
            info.appendChild(label('amedia-cinema__title',title.slice(0,140)));
            var season=Number(work.season),episode=Number(work.episode);
            if(season>0&&episode>0)
                info.appendChild(label('amedia-cinema__episode',
                    'Сезон '+season+' · Серия '+episode));
            header.appendChild(info);
            body.insertBefore(header,body.firstChild);
            return true;
        }
        function start(data){
            stop();
            if(!data||!data.__amediaManaged)return;
            work=data;
            [0,120,500].forEach(function(delay){
                timers.push(setTimeout(mount,delay));
            });
        }
        function ready(data){if(owns(data))mount();}
        return {start:start,ready:ready,stop:stop,mount:mount};
    }());
    function installHubStyle() {
        if (!root.document) return;
        // Lampa can reload a plugin without unloading its old <style> element.
        // Earlier Amedia skins conflict with the current restrained TV layout.
        ['amedia-hub-style-v4','amedia-hub-style-v8','amedia-hub-style-v9',
            'amedia-hub-style-v10','amedia-hub-style-v11','amedia-hub-style-v12','amedia-hub-style-v13','amedia-hub-style-v14','amedia-hub-style-v15','amedia-hub-style-v16','amedia-hub-style-v17'].forEach(function(id){
            var old=root.document.getElementById(id);
            if(old && old.parentNode && old.parentNode.removeChild)
                old.parentNode.removeChild(old);
        });
        if(root.document.getElementById('amedia-hub-style-v18'))return;
        var css = root.document.createElement('style');
        css.id = 'amedia-hub-style-v18';
        css.textContent = "\n/* AMEDIA THEATER — immersive but compositing-light interface, TV + mobile */\n.amedia-hub{--am-bg:#10151b;--am-panel:#181f29;--am-panel2:#232d39;--am-white:#f4f5f7;--am-sub:#acb8c5;--am-edge:rgba(210,226,241,.12);--am-accent:#f0e8dc;--am-ink:#18212c;max-width:92em;margin:auto;padding:0 clamp(.85em,3vw,3.1em) 5em;color:var(--am-white);font:inherit;box-sizing:border-box}\n.amedia-hub *{box-sizing:border-box}\n.amedia-only-explorer .explorer__left{display:none!important}\n.amedia-only-explorer .explorer__files{width:100%!important;max-width:100%!important}\n.amedia-hub__hero{position:relative;isolation:isolate;min-height:15.6em;overflow:hidden;border-radius:1.1em;margin:.5em 0 1.6em;padding:2em clamp(1.15em,3vw,2.5em);background:linear-gradient(116deg,#192434 0%,#131b26 60%,#252b32 100%);border:1px solid var(--am-edge)}\n.amedia-hub__hero:after{content:\"\";position:absolute;pointer-events:none;right:-4em;bottom:-10em;width:31em;height:22em;border-radius:50%;background:radial-gradient(ellipse at center,rgba(180,154,124,.08),transparent 70%);z-index:-1}\n.amedia-hub__eyebrow{font-size:.72em;letter-spacing:.20em;font-weight:750;color:#d7c5a9;margin-bottom:.8em}\n.amedia-hub__hero-inner{display:flex;align-items:center;gap:clamp(1.25em,3vw,2.6em);min-width:0}\n.amedia-hub__cover{width:8.3em;aspect-ratio:2/3;flex:none;overflow:hidden;background:#273341;border-radius:.85em;box-shadow:0 12px 26px rgba(0,0,0,.26)}\n.amedia-hub__cover img{display:block;width:100%;height:100%;object-fit:cover}\n.amedia-hub__intro{flex:1;min-width:0}\n.amedia-hub__title{font-size:clamp(1.65em,3vw,2.75em);font-weight:720;line-height:1.1;letter-spacing:-.034em;overflow-wrap:anywhere}\n.amedia-hub__brand{font-size:.72em;letter-spacing:.18em;font-weight:700;color:#d1c0a8;margin-bottom:.75em}\n.amedia-hub__facts{display:flex;flex-wrap:wrap;gap:.45em 1.15em;color:var(--am-sub);font-size:.84em;line-height:1.4;margin-top:.85em}\n.amedia-hub__facts span+span:before{content:\"·\";color:#8392a2;margin-right:1.15em}\n.amedia-hub__story{display:-webkit-box;max-width:44em;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;color:#c4ccd4;line-height:1.5;font-size:.92em;margin-top:.9em}\n.amedia-hub__actions{display:flex;gap:.55em;align-items:center;flex-wrap:wrap;margin:1.35em 0 0}\n.amedia-hub__section-head{display:flex;align-items:center;justify-content:space-between;gap:1em;margin:1.4em .1em .8em}\n.amedia-hub__section{font-weight:700;font-size:1.25em;letter-spacing:-.015em}\n.amedia-hub__hint{color:var(--am-sub);font-size:.82em}\n.amedia-hub__seasons{display:flex;flex-wrap:wrap;gap:.48em;margin:0 0 1.6em}\n.amedia-hub .selector{cursor:pointer;box-sizing:border-box;min-width:0;-webkit-tap-highlight-color:transparent;user-select:none;outline:0;transition:background-color .12s linear,border-color .12s linear,color .12s linear}\n.amedia-hub__button,.amedia-hub__pill{display:inline-flex;align-items:center;justify-content:center;line-height:1.25;min-height:2.95em;padding:.72em 1.25em;border-radius:.66em;border:1px solid var(--am-edge);background:var(--am-panel2);color:#edf0f4;text-align:center;font-size:.94em;font-weight:580}\n.amedia-hub__button--primary{border-color:var(--am-accent);background:var(--am-accent);color:var(--am-ink);font-weight:720}\n.amedia-hub__button--subtle{background:transparent;border-color:rgba(255,255,255,.18)}\n.amedia-hub__pill{background:rgba(255,255,255,.05);border-radius:2em;padding:.55em 1.15em;min-height:2.75em}\n.amedia-hub__pill--active{color:var(--am-ink);background:var(--am-accent);border-color:var(--am-accent);font-weight:720}\n.amedia-hub .selector.focus,.amedia-hub .selector.focused,.amedia-hub .selector:focus-visible{outline:3px solid #f9f8f5!important;outline-offset:2px;background:#f3f3f0!important;color:#101822!important;border-color:#f3f3f0!important}\n.amedia-hub .selector:active{opacity:.87}\n.amedia-hub__episodes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.74em}\n.amedia-hub__episode{position:relative;display:flex;align-items:center;gap:1.05em;min-width:0;min-height:7.3em;padding:.62em;border:1px solid var(--am-edge);border-radius:.88em;background:rgba(255,255,255,.042);overflow:hidden}\n.amedia-hub__episode--current{background:#252d38;border-color:rgba(210,225,240,.42)}\n.amedia-hub__thumb{position:relative;width:10.8em;height:6.08em;aspect-ratio:16/9;flex:none;border-radius:.58em;overflow:hidden;background:linear-gradient(125deg,#394450,#202b35);display:flex;align-items:center;justify-content:center}\n.amedia-hub__thumb img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}\n.amedia-hub__num{font-size:1.75em;line-height:1;color:#e3ebf3;font-weight:700;letter-spacing:-.03em}\n.amedia-hub__thumb--image .amedia-hub__num{display:none}\n.amedia-hub__body{flex:1;min-width:0;overflow:hidden;padding-right:.25em}\n.amedia-hub__name{font-size:1.05em;line-height:1.34;font-weight:680;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;overflow-wrap:anywhere}\n.amedia-hub__meta{margin-top:.37em;color:var(--am-sub);font-size:.84em;line-height:1.45;overflow:hidden;text-overflow:ellipsis}\n.amedia-hub__current-label{font-size:.7em;letter-spacing:.10em;font-weight:750;color:#edcf9e;margin-bottom:.35em}\n.amedia-hub__progress{height:.25em;border-radius:5em;overflow:hidden;background:rgba(255,255,255,.2);margin-top:.6em}\n.amedia-hub__progress span{height:100%;display:block;background:#e6cfac;border-radius:inherit}\n.amedia-hub__empty{background:var(--am-panel);border:1px dashed var(--am-edge);padding:2.2em 1.5em;border-radius:.85em;color:var(--am-sub)}\n.amedia-hub__more{display:flex;width:max-content;margin-top:1.2em}\n.amedia-hub__setting-intro{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.7em;padding:.5em 0 1.3em;color:#bdc8d4;font-size:.93em}\n.amedia-hub__option-group{padding:1.15em 0 1.35em;border-bottom:1px solid var(--am-edge)}\n.amedia-hub__option-title{font-size:1.06em;font-weight:700;margin-bottom:.8em}\n.amedia-hub__options{display:flex;flex-wrap:wrap;gap:.55em}\n.amedia-hub__footnote{color:var(--am-sub);font-size:.84em;margin:.75em 0;line-height:1.5}\n.amedia-hub__settings-action{display:flex;gap:.65em;margin-top:1.55em;flex-wrap:wrap}\n.amedia-hub__settings-action .selector{min-height:3.15em}\n.amedia-hub .selector.focus .amedia-hub__meta,.amedia-hub .selector.focused .amedia-hub__meta{color:#445161}\n.amedia-hub .selector.focus .amedia-hub__current-label,.amedia-hub .selector.focused .amedia-hub__current-label{color:#725835}\n.amedia-hub .selector.focus .amedia-hub__progress{background:#bdc5cd}\n.amedia-hub .selector.focus .amedia-hub__progress span{background:#665844}\n@media(min-width:1650px){.amedia-hub__episodes{grid-template-columns:repeat(3,minmax(0,1fr))}}\n@media(max-width:1080px){.amedia-hub__episodes{grid-template-columns:1fr}.amedia-hub__hero{padding:1.4em}}\n@media(max-width:720px){\n.amedia-hub{padding:0 .72em 5em}\n.amedia-hub__hero{padding:1em;border-radius:.85em;min-height:0}\n.amedia-hub__cover{width:5.3em;border-radius:.55em}\n.amedia-hub__hero-inner{align-items:flex-start;gap:.9em}\n.amedia-hub__title{font-size:1.54em}\n.amedia-hub__brand{font-size:.62em;margin-bottom:.5em}\n.amedia-hub__facts{font-size:.75em;gap:.3em .7em;margin-top:.55em}\n.amedia-hub__facts span+span:before{margin-right:.65em}\n.amedia-hub__story{-webkit-line-clamp:2;font-size:.8em;margin-top:.6em}\n.amedia-hub__actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));margin-top:1em}\n.amedia-hub__actions .selector:last-child:nth-child(odd){grid-column:1/-1}\n.amedia-hub__seasons{flex-wrap:nowrap;overflow-x:auto;overscroll-behavior-x:contain;-webkit-overflow-scrolling:touch;touch-action:auto;scrollbar-width:none}\n.amedia-hub__seasons::-webkit-scrollbar{display:none}\n.amedia-hub__section{font-size:1.12em}\n.amedia-hub__episode{min-height:6.25em;gap:.75em;padding:.52em}\n.amedia-hub__thumb{width:7.5em;height:4.22em}\n.amedia-hub__name{font-size:.98em}\n.amedia-hub__meta{font-size:.78em}\n.amedia-hub__pill{flex:none;white-space:nowrap}\n.amedia-hub__button{padding:.68em .85em}\n}\n@media(max-width:355px){.amedia-hub__cover{display:none}.amedia-hub__thumb{width:6.3em;height:3.55em}}\n@media(hover:none){.amedia-hub .selector:not(.focus):not(.focused):hover{background:inherit}}\n@media(prefers-reduced-motion:reduce){.amedia-hub .selector{transition:none}}\n\n/* AMEDIA CINEMA — native Lampa interaction, quieter presentation */\n.player.amedia-cinema .player-panel{color:#f3f5f7}\n.player.amedia-cinema .player-panel__body{\n    position:relative;display:flex;flex-direction:column;\n    gap:.45em;\n    padding:1.45em clamp(1.3em,4vw,4.2em) 1.5em!important;\n    background:linear-gradient(0deg,rgba(5,8,13,.96) 0%,rgba(5,8,13,.86) 55%,rgba(5,8,13,.48) 86%,transparent 100%);\n    border:0!important;box-shadow:none!important;\n}\n.player.amedia-cinema .amedia-cinema__header{\n    position:static;order:0;display:block;\n    margin:0 0 1.15em;\n    pointer-events:none;min-width:0;\n}\n.player.amedia-cinema .amedia-cinema__brand{\n    font-size:.72em;letter-spacing:.18em;font-weight:700;\n    color:#d7c6aa;margin-bottom:.46em;\n}\n.player.amedia-cinema .amedia-cinema__title{\n    font-size:clamp(1.25em,2.1vw,1.85em);font-weight:650;line-height:1.25;\n    color:#f7f8fa;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;\n    max-width:37em;letter-spacing:-.014em;\n}\n.player.amedia-cinema .amedia-cinema__episode{\n    color:#bcc7d1;font-size:.88em;line-height:1.5;margin-top:.28em;\n}\n.player.amedia-cinema .player-panel__line-one{\n    order:1;min-height:1.25em;margin:0 0 .2em!important;\n    font-size:.88em;color:#c5d0dc;font-variant-numeric:tabular-nums;\n}\n.player.amedia-cinema .player-panel__timeline{\n    order:2;height:.36em!important;min-height:.36em;\n    margin:.12em 0 1.05em!important;\n    background:rgba(240,245,249,.25)!important;border-radius:99px;\n}\n.player.amedia-cinema .player-panel__position,\n.player.amedia-cinema .player-panel__peding{border-radius:99px}\n.player.amedia-cinema .player-panel__position{background:#ece2d4!important}\n.player.amedia-cinema .player-panel__timeline.focus{\n    box-shadow:0 0 0 2px rgba(255,255,255,.9)!important;\n}\n.player.amedia-cinema .player-panel__line-two{\n    order:3;margin:0!important;align-items:center;min-height:3.2em;\n}\n.player.amedia-cinema .player-panel__playpause{\n    background:rgba(255,255,255,.14)!important;\n    border:1px solid rgba(255,255,255,.15);border-radius:50%!important;\n}\n.player.amedia-cinema .player-panel .button.focus,\n.player.amedia-cinema .player-panel .button.focused{\n    outline:2px solid #fff!important;outline-offset:2px;\n    background:rgba(255,255,255,.23)!important;\n}\n.player.amedia-cinema .player-panel__quality{\n    border-radius:.6em!important;background:rgba(255,255,255,.12)!important;\n    border:1px solid rgba(255,255,255,.16);\n}\n.player.amedia-cinema .player-panel__box-buttons{background:rgba(255,255,255,.085)}\n.player.amedia-cinema .player-panel.panel--norewind .player-panel__timeline,\n.player.amedia-cinema .player-panel.panel--norewind .player-panel__line-one{display:none!important}\n@media(max-width:700px){\n.player.amedia-cinema .player-panel__body{padding:1.15em .95em 1.35em!important;gap:.35em}\n.player.amedia-cinema .amedia-cinema__header{margin-bottom:.65em}\n.player.amedia-cinema .amedia-cinema__brand{font-size:.64em}\n.player.amedia-cinema .amedia-cinema__title{font-size:1.18em;max-width:100%}\n.player.amedia-cinema .amedia-cinema__episode{font-size:.78em}\n.player.amedia-cinema .player-panel__timeline{margin:.1em 0 .75em!important}\n}\n@media(prefers-reduced-motion:reduce){\n.player.amedia-cinema .player-panel{transition:none!important}\n}\n";
        (root.document.head || root.document.documentElement).appendChild(css);
    }
    function installHub() {
        if (hubRegistered) return true;
        if (!L.Component || !L.Component.add || !L.Activity || !L.Activity.push ||
            !L.Explorer || !L.Scroll || !root.$ || !L.Controller) return false;
        installHubStyle();
        L.Component.add('amedia_hub_v6', function(activityData) {
            var ctx = hubContext, $ = root.$, files = new L.Explorer(activityData),
                scroll = new L.Scroll({mask:false,over:false});
            var started = false, alive = true, last = null, focusKey = '', self = this;
            var preservingSeasonScroll=false;
            var seasonRailOffset=0,panelScroll={episodes:0,settings:0,advanced:0};
            var targetScroll=null;
            var episodeLimit=Object.create(null),EPISODE_BATCH=24;
            var isTouchMobile=!!(L.Platform&&L.Platform.screen&&L.Platform.screen('mobile')) ||
                !!(root.matchMedia&&root.matchMedia('(pointer:coarse) and (max-width:900px)').matches);
            // Lampa.Scroll picks its engine via screen('tv'), not by
            // viewport width or pointer type. A touch Android TV still uses
            // translated scrolling and ignores native scrollTop().
            var nativeScroll=!(L.Platform&&L.Platform.screen&&L.Platform.screen('tv'));
            this.alive = true;
            this.panel = 'episodes';
            // Lampa.Scroll already handles native touch scrolling on mobile,
            // and transformed touch navigation on TV. Never set a second
            // fixed-height/overflow scroll on its root.
            if(files.render&&files.render().addClass)
                files.render().addClass('amedia-only-explorer');
            if (ctx) ctx.hub = this;
            function focus(row,rebind,keepScroll) {
                if (!row || !row.length) return;
                last = row[0] || null;
                var key = row.attr && row.attr('data-am-key');
                if (key) focusKey = key;
                // Recompute spatial navigation only after DOM changes,
                // not on every fallback D-pad movement.
                if(rebind!==false && L.Controller.collectionSet)
                    safe(function(){L.Controller.collectionSet(scroll.render(),files.render());});
                // On phones focus is driven by touch. Programmatic Lampa
                // collectionFocus can forcibly scroll the native viewport.
                if(!isTouchMobile&&L.Controller.collectionFocus)
                    safe(function(){L.Controller.collectionFocus(last||false,scroll.render());});
                if(!isTouchMobile&&!keepScroll&&scroll.update)
                    safe(function(){scroll.update(row);});
            }
            // Lampa's "hover:enter" works with the remote, but Android WebView
            // touch/click isn't guaranteed to emit it. Support both without
            // interpreting a swipe as a tap or double-launching the player.
            function bindPress(row,action,longAction) {
                var lastPress=0,lastLong=0,lastTouch=0,startX=0,startY=0,moved=false,longDone=false,longTimer=null;
                function fire(){
                    if(moved||longDone)return;
                    var now=Date.now();
                    if(now-lastPress<150)return;
                    lastPress=now;
                    if(action)action();
                }
                function fireLong(){
                    if(!longAction)return;
                    var now=Date.now();
                    if(now-lastLong<600)return;
                    lastLong=now;longDone=true;
                    longAction();
                }
                row.on('hover:enter',fire);
                // Android WebView sends click after touchend. Do not launch
                // twice, or interpret the trailing click of a swipe as a tap.
                row.on('click',function(){
                    if(Date.now()-lastTouch<650)return;
                    fire();
                });
                if(longAction)row.on('hover:long',fireLong);
                row.on('touchstart',function(e){
                    var event=e.originalEvent||e;
                    var touch=event.touches&&event.touches[0]||event.changedTouches&&event.changedTouches[0];
                    if(!touch)return;
                    startX=Number(touch.clientX)||0;startY=Number(touch.clientY)||0;
                    moved=false;longDone=false;
                    clearTimeout(longTimer);
                    if(longAction)longTimer=setTimeout(function(){if(!moved)fireLong();},560);
                });
                row.on('touchmove',function(e){
                    var event=e.originalEvent||e;
                    var touch=event.touches&&event.touches[0]||event.changedTouches&&event.changedTouches[0];
                    if(touch&&(Math.abs((Number(touch.clientY)||0)-startY)>10||
                        Math.abs((Number(touch.clientX)||0)-startX)>10)){
                        moved=true;clearTimeout(longTimer);
                    }
                });
                row.on('touchend',function(){
                    lastTouch=Date.now();
                    clearTimeout(longTimer);
                    if(!moved&&!longDone)fire();
                });
                row.on('touchcancel',function(){clearTimeout(longTimer);moved=true;});
                if(longAction)row.on('contextmenu',function(e){
                    if(e&&e.preventDefault)e.preventDefault();
                    fireLong();
                });
                return row;
            }
            function selector(label,type,action,longAction){
                var row=$('<div class="selector '+type+'"></div>').text(label);
                row.attr('data-am-key','action:'+label);
                bindPress(row,action,longAction);
                row.on('hover:focus',function(e){
                    last=e.currentTarget||row[0];
                    focusKey=row.attr('data-am-key')||focusKey;
                    if(!isTouchMobile&&scroll.update)safe(function(){scroll.update(row);});
                });
                return row;
            }
            var panelFocus={episodes:'',settings:'',advanced:''};
            function scrollPixels(){
                try{
                    if(nativeScroll)return Math.max(0,scroll.render().scrollTop()||0);
                    return Math.max(0,-(scroll.position()||0));
                }catch(e){return 0;}
            }
            function navigate(panel) {
                panelFocus[self.panel]=focusKey;
                panelScroll[self.panel]=scrollPixels();
                self.panel=panel;
                targetScroll=panelScroll[panel]||0;
                last=null;focusKey=panelFocus[panel]||'';
                // Keep Lampa's existing Activity/Controller; rebuild only its
                // content and re-register the new selector collection.
                self.redraw();
            }
            function choose(season, episode, play) {
                if (!ctx || !live(ctx) || ctx.busy || !episode) return;
                ctx.season=season;
                ctx.episode=episode;
                if (play) playFromContext(ctx);
                else navigate('settings');
            }
            function group(page, title, values) {
                var wrap=$('<div class="amedia-hub__option-group"></div>');
                wrap.append($('<div class="amedia-hub__option-title"></div>').text(title));
                var options=$('<div class="amedia-hub__options"></div>');
                values.forEach(function(item){
                    options.append(selector(item.title,'amedia-hub__pill'+(item.selected?' amedia-hub__pill--active':''),item.action));
                });
                wrap.append(options);
                page.append(wrap);
            }
            function preferences(page) {
                var advanced=self.panel==='advanced';
                page.append($('<div class="amedia-hub__section-head"></div>')
                    .append($('<div class="amedia-hub__section"></div>').text(
                        advanced?'Дополнительные параметры':'Настройки просмотра')));
                page.append(selector(advanced?'‹ К просмотру':'‹ К сериям',
                    'amedia-hub__button amedia-hub__button--subtle',function(){
                        navigate(advanced?'settings':'episodes');
                    }));
                if(advanced){
                    page.append($('<div class="amedia-hub__setting-intro"></div>')
                        .text('Параметры движка и диагностика. Обычное воспроизведение работает без их изменения.'));
                    group(page,'Видеодвижок',Object.keys(choices.innerEngine).map(function(key){
                        return {title:choices.innerEngine[key],selected:get('innerEngine')===key,
                            action:function(){L.Storage.set(prefix+'innerEngine',key);last=null;self.redraw();}};
                    }));
                    group(page,'Быстрый запуск',[{title:get('fastStart')?'Включён':'Выключен',
                        selected:!!get('fastStart'),action:function(){
                            L.Storage.set(prefix+'fastStart',!get('fastStart'));last=null;self.redraw();}}]);
                    group(page,'Контроль зависаний',[{title:get('playerWatchdog')?'Включён':'Выключен',
                        selected:!!get('playerWatchdog'),action:function(){
                            L.Storage.set(prefix+'playerWatchdog',!get('playerWatchdog'));last=null;self.redraw();}}]);
                var status=queueSummary();
                if(status)page.append($('<div class="amedia-hub__option-group"></div>')
                    .append($('<div class="amedia-hub__option-title"></div>').text('Последний запуск'))
                    .append($('<div class="amedia-hub__meta"></div>').text(
                        (status.lazy ?
                            'В очереди: '+status.size+' серии · Ссылки обновляются при выборе' :
                            'Подготовлено: '+status.size+' · Передано: '+
                            (status.delivered===null?'нет подтверждения':status.delivered)+
                            ' · Соседних: '+status.resolved+'/'+status.planned)+
                        ' · Режим: '+(status.mode==='android'?'Android':'Lampa'))));
                if(status&&status.mode==='android')
                    page.append($('<div class="amedia-hub__meta"></div>').text(
                        'Android: передаётся текущая серия. Другие серии Skaz требуют новых подписанных ссылок и отдельных заголовков.'));
                if(status&&status.mode==='inner'&&status.excludedByGap)
                    page.append($('<div class="amedia-hub__meta"></div>').text(
                        'Дополнительно получено '+status.excludedByGap+
                        ' ссылок, но они исключены: между сериями есть пропуск.'));
                if(status&&status.mode==='inner'&&status.errors&&status.errors.length)
                    page.append($('<div class="amedia-hub__meta"></div>').text(
                        'Ошибки подготовки: '+status.errors.map(function(code){
                            return code==='no_stream'?'нет видеопотока':
                                code==='seed_or_network_error'?'не удалось обновить ссылку Skaz':
                                code==='fresh_episode_failed'?'не удалось заново получить ссылку Skaz на серию':
                                code==='inner_player_not_ready'?'встроенный плеер не подтвердил готовность':
                                code==='native_header_mismatch'?'различаются заголовки авторизации':
                                code==='native_seed_chain_stopped'?'прервалась цепочка Borth':
                                code==='queue_budget_exhausted'?'закончилось время подготовки':
                                code==='queue_idle_timeout'?'сервер долго не отвечал на запрос':
                                code==='noncontiguous_omitted'?'нет ссылки на промежуточную серию':
                                'неизвестная ошибка';
                        }).join(', ')));
                var lastRecovery=null;
                try{lastRecovery=L.Storage.get(prefix+'lastHlsRecovery',null);}catch(error){}
                if(lastRecovery&&Date.now()-Number(lastRecovery.at||0)<24*60*60*1000){
                    var labels={fatal:'ошибка манифеста',
                        backup_quality:'смена качества',new_signed_url:'обновление ссылки',
                        recovery_sent:'новый поток передан',video_ready:'видео снова загрузилось',
                        exhausted:'источники недоступны'};
                    page.append($('<div class="amedia-hub__option-group"></div>')
                        .append($('<div class="amedia-hub__option-title"></div>').text('Последнее событие видеопотока'))
                        .append($('<div class="amedia-hub__meta"></div>').text(
                            (labels[lastRecovery.phase]||lastRecovery.phase)+
                            ' · '+new Date(lastRecovery.at).toLocaleTimeString()+
                            (lastRecovery.error?' · '+lastRecovery.error:'')+
                            (lastRecovery.host?' · CDN: '+lastRecovery.host:'')+
                            (lastRecovery.episode?' · Серия '+lastRecovery.episode:''))));
                }
                if(get('diagnostics')){
                    var diag=amediaRuntime.stats();
                    if(!diag){try{diag=L.Storage.get(prefix+'runtimeStats',null);}catch(e){}}
                    if(diag)page.append($('<div class="amedia-hub__meta"></div>').text(
                        'Плеер: зависаний '+Number(diag.stalls||0)+
                        ', восстановлений '+Number(diag.recoveries||0)+
                        ', HLS.js '+(diag.hlsCaptured?'подключён':'не перехвачен')+
                        (diag.frameSamples?' · потеря кадров '+Number(diag.frameDropPercent||0)+'%':'')+
                        (diag.lastReason?' · '+String(diag.lastReason).slice(0,40):'')));
                    var startup=null;
                    try{startup=L.Storage.get(prefix+'lastStartup',null);}catch(e){}
                    if(startup&&Date.now()-Number(startup.at||0)<7*24*60*60*1000)
                        page.append($('<div class="amedia-hub__footnote"></div>').text(
                            'Последний запуск: '+(Number(startup.total||0)/1000).toFixed(1)+' с от выбора серии '+
                            '(видео: '+(Number(startup.player||0)/1000).toFixed(1)+' с). '+
                            'Движок: '+String(startup.engine||'auto')+'.'));
                }
                return;
                }
                page.append($('<div class="amedia-hub__setting-intro"></div>')
                    .text('Выберите плеер, озвучку и качество. Android отправит видео в выбранное приложение (UA Player) через Lampa.'));
                var playbackSetting=isSeries(ctx.movie)?'seriesPlayer':'player';
                group(page,'Плеер',Object.keys(choices[playbackSetting]).map(function(key){
                    return {title:choices[playbackSetting][key],
                        selected:get(playbackSetting)===key,action:function(){
                            L.Storage.set(prefix+playbackSetting,key);last=null;self.redraw();
                        }};
                }));
                var voices=(ctx.episode&&ctx.episode.translations||[]).slice()
                    .sort(function(a,b){return voiceScore(b)-voiceScore(a);});
                var available=[{title:'Автоматически · лучший доступный вариант',
                    selected:titleVoice(ctx.movie)==='auto',action:function(){
                        saveTitlePreference(ctx.movie,'voice','auto');
                        saveTitlePreference(ctx.movie,'voiceLabel','');
                        last=null;self.redraw();
                    }}];
                voices.forEach(function(voice){
                    var id=String(voice.id),label=String(voice.name||voice.label||'Озвучка');
                    available.push({title:voiceOptionLabel(voice),selected:titleVoice(ctx.movie)===id,
                        action:function(){
                            saveTitlePreference(ctx.movie,'voice',id);
                            saveTitlePreference(ctx.movie,'voiceLabel',label);
                            last=null;self.redraw();
                        }});
                });
                if(voices.length>1)group(page,'Озвучка',available);
                else page.append($('<div class="amedia-hub__option-group"></div>')
                    .append($('<div class="amedia-hub__option-title"></div>').text('Озвучка'))
                    .append($('<div class="amedia-hub__meta"></div>').text(
                        voices.length ? (voices[0].name||voices[0].label||'Доступная дорожка'):
                        'Для этой серии нет доступных вариантов.')));
                group(page,'Качество',Object.keys(choices.quality).map(function(key){
                    return {title:choices.quality[key],selected:titleQuality(ctx.movie)===key,
                        action:function(){saveTitlePreference(ctx.movie,'quality',key);
                            last=null;self.redraw();}};
                }));
                var actions=$('<div class="amedia-hub__settings-action"></div>');
                actions.append(selector('▶ Начать просмотр',
                    'amedia-hub__button amedia-hub__button--primary',
                    function(){playFromContext(ctx);}));
                actions.append(selector('Расширенные настройки',
                    'amedia-hub__button amedia-hub__button--subtle',
                    function(){navigate('advanced');}));
                page.append(actions);
            }
            function renderEpisodes(page) {
                var candidate=watchCandidate(ctx);
                var first=null, total=0;
                (ctx.tree.seasons||[]).forEach(function(season){
                    (season.episodes||[]).forEach(function(ep){
                        if(ep.translations && ep.translations.length){
                            total++;if(!first)first={season:season,episode:ep};
                        }
                    });
                });
                var hero=$('<div class="amedia-hub__hero"></div>');
                // The decorative backdrop is hidden by CSS: don't fetch it.
                var heroInner=$('<div class="amedia-hub__hero-inner"></div>');
                var posterUrls=imageAlternatives([
                    ctx.movie.poster_path,ctx.movie.img,ctx.movie.poster,
                    catalogCache[catalogKey(ctx.movie)]&&catalogCache[catalogKey(ctx.movie)].poster
                ],'w500');
                if(posterUrls.length){
                    var cover=$('<div class="amedia-hub__cover"></div>');
                    var img=$('<img alt="">').attr('decoding','async');
                    cover.append(img);heroInner.append(cover);
                    loadArtwork(img,posterUrls,null,function(){cover.remove();});
                }
                var intro=$('<div class="amedia-hub__intro"></div>');
                intro.append($('<div class="amedia-hub__brand"></div>').text('AMEDIA  /  КИНОТЕКА'));
                intro.append($('<div class="amedia-hub__title"></div>')
                    .text(ctx.movie.title||ctx.movie.name||'Amedia'));
                var facts=$('<div class="amedia-hub__facts"></div>');
                [ctx.tree.seasons.length+' '+(ctx.tree.seasons.length%10===1&&ctx.tree.seasons.length%100!==11?'сезон':ctx.tree.seasons.length%10>=2&&ctx.tree.seasons.length%10<=4&&(ctx.tree.seasons.length%100<12||ctx.tree.seasons.length%100>14)?'сезона':'сезонов'),
                     total+' серий',
                    'Озвучка: '+displayVoice(ctx),
                    'Качество: '+(choices.quality[titleQuality(ctx.movie)]||'Авто')].forEach(function(value){
                    facts.append($('<span></span>').text(value));
                });
                intro.append(facts);
                var overview=String(ctx.movie.overview||ctx.movie.description||'');
                if(overview)intro.append($('<div class="amedia-hub__story"></div>').text(overview));
                var actions=$('<div class="amedia-hub__actions"></div>');
                if(candidate)actions.append(selector('Продолжить · '+candidate.season.number+'×'+('0'+candidate.episode.number).slice(-2),
                    'amedia-hub__button amedia-hub__button--primary',
                    function(){choose(candidate.season,candidate.episode,true);}));
                if(first && (!candidate || first.season!==candidate.season || first.episode!==candidate.episode))actions.append(selector('С первой серии','amedia-hub__button',
                    function(){choose(first.season,first.episode,true);}));
                actions.append(selector('Параметры просмотра','amedia-hub__button amedia-hub__button--subtle',function(){navigate('settings');}));
                heroInner.append(intro);hero.append(heroInner).append(actions);page.append(hero);
                page.append($('<div class="amedia-hub__section-head"></div>')
                    .append($('<div class="amedia-hub__section"></div>').text('Сезоны'))
                    .append($('<div class="amedia-hub__hint"></div>').text('Нажмите на серию для просмотра')));
                var seasonBar=$('<div class="amedia-hub__seasons"></div>');
                var seasons=ctx.tree.seasons;
                seasons.forEach(function(season){
                    var chosen=ctx.season&&Number(ctx.season.number)===Number(season.number);
                    seasonBar.append(selector('Сезон '+season.number,
                        'amedia-hub__pill'+(chosen?' amedia-hub__pill--active':''),function(){
                            ctx.season=season;
                            requestLocalizedSeason(ctx,season.number);
                            if(!season.episodes.some(function(ep){return ep===ctx.episode;}))
                                ctx.episode=season.episodes.filter(function(ep){return ep.translations&&ep.translations.length;})[0]||null;
                            last=null;focusKey='action:Сезон '+season.number;
                            preservingSeasonScroll=true;
                            self.redraw();
                        }));
                });
                page.append(seasonBar);
                var selected=seasons.filter(function(season){
                    return ctx.season&&Number(season.number)===Number(ctx.season.number);
                })[0]||seasons[0],shown=0;
                ctx.season=selected;
                if(!selected)return;
                var available=(selected.episodes||[]).filter(function(ep){
                    return ep.translations&&ep.translations.length;
                });
                var pickedIndex=available.indexOf(ctx.episode),n=selected.number;
                var limit=Math.max(episodeLimit[n]||EPISODE_BATCH,
                    pickedIndex<0?0:Math.ceil((pickedIndex+1)/EPISODE_BATCH)*EPISODE_BATCH);
                limit=Math.min(available.length,limit);
                page.append($('<div class="amedia-hub__section-head"></div>')
                    .append($('<div class="amedia-hub__section"></div>').text('Сезон '+selected.number))
                    .append($('<div class="amedia-hub__hint"></div>').text('Выберите серию')));
                var list=$('<div class="amedia-hub__episodes"></div>');
                function appendEpisode(ep){
                    shown++;
                    var previous=ctx.season;ctx.season=selected;
                    var detail=episodeDetail(ctx,ep),progress=episodeProgress(ctx,ep);
                    var top=topVoice(ctx,ep);ctx.season=previous;
                    var current=ctx.episode&&ctx.season===selected&&Number(ctx.episode.number)===Number(ep.number);
                    var row=$('<div class="selector amedia-hub__episode'+(current?' amedia-hub__episode--current':'')+'"></div>');
                    row.attr('data-am-key','episode:'+selected.number+':'+ep.number);
                    // Missing episode stills become lightweight number tiles.
                    // Do not request the same large backdrop 32 times.
                    var original=lampaEpisode(ctx,selected.number,ep.number)||{};
                    var catalog=catalogCache[catalogKey(ctx.movie)];
                    var catalogEp=catalog&&catalog.episodes&&catalog.episodes[selected.number+':'+ep.number];
                    var alternatives=imageAlternatives([
                        detail.image,original.still_path,original.img,original.thumbnail,
                        ep.still_path,ep.img,ep.thumbnail,catalogEp&&catalogEp.image
                    ],'w300');
                    var thumb=$('<div class="amedia-hub__thumb amedia-hub__thumb--fallback"></div>');
                    thumb.append($('<span class="amedia-hub__num"></span>').text(('0'+ep.number).slice(-2)));
                    if(alternatives.length){
                        // Native lazy-loading can stall forever inside Lampa's
                        // translated TV scroll container.
                        var img=$('<img alt="">').attr('decoding','async');
                        thumb.append(img);
                        loadArtwork(img,alternatives,function(){
                            thumb.addClass('amedia-hub__thumb--image')
                                .removeClass('amedia-hub__thumb--fallback');
                        },function(){img.remove();});
                    }
                    row.append(thumb);
                    var body=$('<div class="amedia-hub__body"></div>');
                    if(current)body.append($('<div class="amedia-hub__current-label"></div>').text('СЕЙЧАС ВЫБРАНО'));
                    body.append($('<div class="amedia-hub__name"></div>').text(detail.name||'Серия '+ep.number));
                    body.append($('<div class="amedia-hub__meta"></div>').text(
                        progress>=95?'Просмотрено':progress>0?'Продолжить просмотр · '+progress+'%':
                        ('Серия '+ep.number+' · '+(top&&(top.name||top.label)||'Автовыбор'))));
                    if(progress>0){
                        var bar=$('<div class="amedia-hub__progress"></div>');
                        bar.append($('<span></span>').css('width',progress+'%'));body.append(bar);
                    }
                    row.append(body);
                    bindPress(row,function(){choose(selected,ep,true);},function(){choose(selected,ep,false);});
                    row.on('hover:focus',function(e){
                        last=e.currentTarget||row[0];
                        focusKey=row.attr('data-am-key')||focusKey;
                        if(!isTouchMobile&&scroll.update)safe(function(){scroll.update(row);});
                    });
                    list.append(row);
                }
                available.slice(0,limit).forEach(appendEpisode);
                if(shown)page.append(list);
                else page.append($('<div class="amedia-hub__empty"></div>').text('В этом сезоне пока нет доступных серий.'));
                if(available.length>limit){
                    var more=selector('Показать ещё · '+(available.length-limit),
                        'amedia-hub__button amedia-hub__more',function(){
                            var oldLimit=limit;
                            limit=Math.min(available.length,limit+EPISODE_BATCH);
                            episodeLimit[n]=limit;
                            // Append without clearing the existing DOM, scroll
                            // position or images already decoded by WebView.
                            available.slice(oldLimit,limit).forEach(appendEpisode);
                            if(limit>=available.length)more.remove();
                            else more.text('Показать ещё · '+(available.length-limit));
                            var ep=available[oldLimit];
                            var target=ep?list.find('[data-am-key="episode:'+n+':'+ep.number+'"]').first():null;
                            if(target&&target.length)focus(target);
                        });
                    more.attr('data-am-key','more:'+n);
                    page.append(more);
                }

            }
            this.refreshCatalog=function(record){
                // Update only visible cards; never clear scroll/focus for
                // delayed metadata from TVMaze, TMDB or Cinemeta.
                if(!alive||!started||!record||!record.episodes)return;
                var rows=scroll.render&&scroll.render().find&&scroll.render().find('.amedia-hub__episode');
                if(!rows||!rows.length)return;
                rows.each(function(){
                    var row=$(this),key=String(row.attr('data-am-key')||'');
                    var match=key.match(/^episode:([0-9]+):([0-9]+)$/);
                    if(!match)return;
                    var info=record.episodes[match[1]+':'+match[2]];
                    if(!info)return;
                    var name=row.find('.amedia-hub__name');
                    if(info.ru_name&&name.length&&
                        (isGenericEpisodeName(name.text())||!isCyrillicTitle(name.text())))
                        name.text(info.ru_name);
                    var thumb=row.find('.amedia-hub__thumb');
                    if(!info.image||!thumb.length||thumb.find('img').length)return;
                    var url=imageUrl(info.image,'w300');
                    if(!url||thumb.attr('data-am-art-bad')===url)return;
                    var alternatives=imageAlternatives([info.image],'w300');
                    var img=$('<img alt="">').attr('decoding','async');
                    thumb.append(img);
                    loadArtwork(img,alternatives,function(){
                        thumb.removeAttr('data-am-art-bad').addClass('amedia-hub__thumb--image')
                            .removeClass('amedia-hub__thumb--fallback');
                    },function(){
                        thumb.attr('data-am-art-bad',url);
                        thumb.removeClass('amedia-hub__thumb--image')
                            .addClass('amedia-hub__thumb--fallback');
                        img.remove();
                    });
                });
            };
            this.redraw=function(){
                if(!alive||!ctx||!live(ctx)||!started)return;
                var wanted=focusKey;
                var formerScroll=scrollPixels();
                var shouldRestore=preservingSeasonScroll||
                    self.panel!=='episodes'||targetScroll!==null;
                var nextScroll=targetScroll!==null?targetScroll:formerScroll;
                targetScroll=null;
                try{
                    var oldRail=scroll.render().find('.amedia-hub__seasons')[0];
                    if(oldRail)seasonRailOffset=oldRail.scrollLeft||0;
                }catch(e){}
                scroll.clear();
                if(scroll.reset)scroll.reset();
                var page=$('<div class="amedia-hub '+(isTouchMobile?'amedia-hub--phone':'amedia-hub--tv')+'"></div>');
                if(self.panel==='settings'||self.panel==='advanced')preferences(page);
                else renderEpisodes(page);
                scroll.append(page);
                try{
                    var rail=page.find('.amedia-hub__seasons')[0];
                    if(rail&&seasonRailOffset)rail.scrollLeft=seasonRailOffset;
                    if(shouldRestore&&nextScroll>0){
                        if(nativeScroll)scroll.render().scrollTop(nextScroll);
                        else if(scroll.shift)scroll.shift(nextScroll);
                    }
                }catch(e){}
                // Full redraw replaces every selector: failing to update the
                // Controller.collectionSet leaves the remote pointing at old
                // disconnected nodes after changing seasons.
                if(L.Controller.enabled&&L.Controller.enabled().name==='content'){
                    if(L.Controller.collectionSet)
                        safe(function(){L.Controller.collectionSet(scroll.render(),files.render());});
                    var target=wanted? page.find('[data-am-key="'+wanted.replace(/["\\]/g,'')+'"]').first() : null;
                    if(!target||!target.length)target=page.find('.selector').first();
                    if(isTouchMobile){
                        last=target&&target.length?target[0]:null;
                    }else{
                        focus(target,false,preservingSeasonScroll||shouldRestore);
                    }
                }
                preservingSeasonScroll=false;
            };
            // ActivitySlide.create() calls component.create() BEFORE the slide starts.
            // Without this method Lampa throws "this.component.create is not a function".
            // Build the DOM here and return the component's actual root to Activity.
            this.create=function(){
                if(!alive)return this.render();
                if(!started){
                    started=true;
                    files.appendFiles(scroll.render());
                    // Native Skaz and Lampa's own Explorer both establish
                    // the viewport height BEFORE registering TV navigation.
                    // Without minus() the Scroll viewport can expand to its
                    // content height and maxOffset() becomes zero.
                    if(scroll.minus)scroll.minus(
                        files.render().find('.explorer__files-head'));
                    if(scroll.body&&scroll.body().addClass)
                        scroll.body().addClass('amedia-hub-scroll');
                }
                // Keep the native Lampa background; heavyweight blur caused UI flashes.
                this.redraw();
                return this.render();
            };
            // Geometry navigation may report no neighbor on some Android TV
            // WebViews while a non-visible row still exists in the same list.
            // Fall back to DOM sequence only if Navigator cannot move.
            function fallbackMove(direction){
                var items=scroll.render().find('.selector');
                if(!items||!items.length)return false;
                var elements=items.toArray?items.toArray():[];
                if(!elements.length)return false;
                var visible=elements.filter(function(node){
                    return node&&!(node.classList&&node.classList.contains('hide'))&&
                        (node.offsetParent!==null || !root.document ||
                            !root.document.body);
                });
                if(!visible.length)return false;
                var at=visible.indexOf(last),next=-1;
                if(at<0)at=direction==='up'?visible.length: -1;
                if(direction==='down')next=at+1;
                else if(direction==='up')next=at-1;
                else if(direction==='right'||direction==='left'){
                    var step=direction==='right'?1:-1,atNode=visible[at];
                    if(!atNode||!atNode.getBoundingClientRect)return false;
                    var origin=atNode.getBoundingClientRect(),probe=at+step;
                    while(probe>=0&&probe<visible.length){
                        var candidate=visible[probe],box=candidate.getBoundingClientRect&&candidate.getBoundingClientRect();
                        if(box&&Math.abs((box.top+box.height/2)-(origin.top+origin.height/2))<
                            Math.max(origin.height,box.height)*.65){
                            next=probe;break;
                        }
                        probe+=step;
                    }
                }else return false;
                if(next<0||next>=visible.length)return false;
                focus($(visible[next]),false);
                return true;
            }
            function spatialMove(direction){
                if(isTouchMobile||!last||!last.getBoundingClientRect)return false;
                var origin=last.getBoundingClientRect();
                if(!origin.width||!origin.height)return false;
                var best=null,scoreBest=Infinity;
                var items=scroll.render().find('.selector');
                (items&&items.toArray?items.toArray():[]).forEach(function(node){
                    if(!node||node===last||!node.getBoundingClientRect||
                        node.offsetParent===null)return;
                    var r=node.getBoundingClientRect();
                    if(!r.width||!r.height)return;
                    var dx=(r.left+r.width/2)-(origin.left+origin.width/2);
                    var dy=(r.top+r.height/2)-(origin.top+origin.height/2);
                    var main=direction==='right'?dx:direction==='left'?-dx:
                        direction==='down'?dy:-dy;
                    if(main<=3)return;
                    var side=(direction==='left'||direction==='right')?Math.abs(dy):Math.abs(dx);
                    var penalty=side>main?side*1.2:0;
                    var score=main+side*2.8+penalty;
                    if(score<scoreBest){scoreBest=score;best=node;}
                });
                if(!best)return false;
                focus($(best),false);
                return true;
            }
            function directionMove(direction){
                // Let stock Lampa navigate its registered selector collection.
                // Only use the geometric fallback when Lampa has no neighbour.
                try{
                    if(root.Navigator&&root.Navigator.canmove&&
                        root.Navigator.canmove(direction)){
                        root.Navigator.move(direction);return true;
                    }
                }catch(e){}
                if(spatialMove(direction))return true;
                return fallbackMove(direction);
            }
            this.start=function(){
                if(!alive)return;
                // Defensive compatibility for old/mocked Activity implementations.
                if(!started)this.create();
                L.Controller.add('content',{
                    toggle:function(){
                        var target=last?$(last):scroll.render().find('.selector').first();
                        if(target&&!target.length)target=scroll.render().find('.selector').first();
                        focus(target);
                    },
                    up:function(){if(!directionMove('up'))L.Controller.toggle('head');},
                    down:function(){
                        if(directionMove('down'))return;
                        var target=scroll.render().find('.amedia-hub__episodes .selector').first();
                        if(target&&target.length)focus(target);
                    },
                    right:function(){directionMove('right');},
                    left:function(){
                        if(!directionMove('left'))L.Controller.toggle('menu');
                    },
                    back:function(){self.back();}
                });
                L.Controller.toggle('content');
            };
            this.render=function(){return files.render();};
            this.back=function(){if(self.panel==='advanced')navigate('settings');else if(self.panel==='settings')navigate('episodes');else L.Activity.backward();};
            this.pause=function(){};
            this.stop=function(){};
            this.destroy=function(){
                alive=false;this.alive=false;
                if(ctx&&ctx.hub===this)ctx.hub=null;
                safe(function(){scroll.destroy();});
                safe(function(){files.destroy();});
                if(ctx&&live(ctx)&&!(active&&active.ctx===ctx&&active.launched))
                    closeContext(ctx);
            };
        });
        hubRegistered=true;
        return true;
    }
    function openHub(ctx) {
        if (!live(ctx)) return;
        ctx.tree = sortedTree(ctx.tree);
        var resume = watchCandidate(ctx);
        if (resume) {ctx.season=resume.season;ctx.episode=resume.episode;}
        requestCatalog(ctx.movie);
        if (ctx.season) requestLocalizedSeason(ctx,ctx.season.number);
        if (!installHub()) {
            // Older Lampa builds can still use the original direct-player path.
            return playFromContext(ctx);
        }
        hubContext = ctx;
        try {
            L.Activity.push({component:'amedia_hub_v6',title:'Amedia · '+(ctx.movie.title||ctx.movie.name||''),
                movie:ctx.movie,page:1});
        } catch(error) {
            log('Нативный экран Amedia недоступен');
            return playFromContext(ctx);
        }
    }

    function registerSettings() {
        if (settingsReady || !L.SettingsApi || !L.SettingsApi.addComponent || !L.SettingsApi.addParam) return;
        L.SettingsApi.addComponent({component: 'amedia_v4', name: 'Amedia · ' + version, icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>'});
        [['player','Плеер · фильмы','Android: через системный выбор Lampa укажите UA Player; приложение должно быть установлено.'],
            ['seriesPlayer','Плеер · сериалы','Android: передаётся текущая серия; полная очередь Skaz пока остаётся во встроенном Lampa.'],
            ['quality','Качество','Авто по скорости сети и доступным CDN; 4K при поддержке устройства.'],
            ['innerEngine','Движок видео','Штатный Lampa, системный HLS или HLS.js.'],
            ['fastStart','Быстрый HLS','Настроить реальный HLS.js при создании, не меняя транспорт и авторизацию.'],
            ['playerWatchdog','Контроль зависаний','Восстанавливать видео при подтверждённой остановке; можно выключить.'],
            ['autoNext','Следующая серия','Воспроизведение внутри текущего сезона.'],
            ['resume','Продолжать просмотр','При отключении начать с нуля.'],
            ['diagnostics','Диагностика','Отчёты без токенов и ссылок.']].forEach(function (row) {
            L.SettingsApi.addParam({component: 'amedia_v4', param: {name: prefix + row[0], type: choices[row[0]] ? 'select' : 'trigger',
                values: choices[row[0]], default: defaults[row[0]]}, field: {name: row[1], description: row[2]}});
        });
        // Lampa SettingsApi supports a read-only "static" item. Display the
        // running plugin version, never a stored or user-editable value.
        L.SettingsApi.addParam({
            component:'amedia_v4',
            param:{name:prefix+'installed_version',type:'static'},
            field:{name:'Версия плагина: ' + version,
                   description:'Основа Skaz Amedia. Источник: Amedia; интерфейс использует только её балансеры и файлы.'}
        });
        settingsReady = true;
    }
    function subscribe() {
        // Keep the user's Android/Lampa choice across plugin updates. Previous
        // versions forcibly wrote 'inner' to both storage keys on every load.
        // Global patches for Lampa's Full/Seasons/Select/CreateInstance caused
        // regressions and are intentionally NOT installed in the Amedia hub.
        // Film-only mode: do not inject the legacy Amedia hub styles.
        // Native Lampa episode cards remain untouched: every episode choice
        // belongs to the standalone Amedia UI, not to global Full/Seasons hooks.
        if (L.Listener && L.Listener.follow) L.Listener.follow('full', function (event) {
            if (event && event.data && event.data.movie) lastMovie = event.data.movie;
        });
        if (L.Select && L.Select.listener) L.Select.listener.follow('preshow', function (event) {
            if (selection && event && event.active !== selection.options) selection = null;
        });
        L.Player.listener.follow('create', onCreate);
        L.Player.listener.follow('external',function(work){
            if(active && active.launched && active.mode==='android' &&
                work && work.__amediaLaunchId===active.id)
                finish(active,'поток передан Android');
        });
        L.Player.listener.follow('start',function(work){cinemaSkin.start(work);});
        L.Player.listener.follow('ready',function(work){amediaRuntime.ready(work);cinemaSkin.ready(work);});
        L.Player.listener.follow('destroy', function () {
            cinemaSkin.stop();
            amediaRuntime.stop();
            if (active && active.mode === 'inner' && active.launched) finish(active, 'встроенный плеер закрыт');
        });
        // Metrics are captured only for our own playback and never contain
        // stream URLs, signed tokens or headers. Useful for real TV profiling.
        function onVideoReady(){
            var job=active;
            if(!job||!job.launched||job.mode!=='inner'||job.videoReadyRecorded)return;
            var work=L.Player&&L.Player.playdata&&L.Player.playdata();
            if(!work||!work.__amediaManaged||work.__amediaLaunchId!==job.id)return;
            var elapsed=Date.now()-job.createdAt;
            var decoder=Date.now()-job.launchedAt;
            if(elapsed<0||elapsed>120000||decoder<0)return;
            job.videoReadyRecorded=true;
            try{L.Storage.set(prefix+'lastStartup',{
                total:elapsed,player:decoder,at:Date.now(),
                engine:String(work.hls_type||'auto').slice(0,16)
            });}catch(e){}
        }
        if(L.PlayerVideo&&L.PlayerVideo.listener){
            L.PlayerVideo.listener.follow('loadeddata',onVideoReady);
            L.PlayerVideo.listener.follow('playing',onVideoReady);
        }
        // Film-only: never patch Lampa's series auto-next.
        if(L.PlayerVideo&&L.PlayerVideo.listener)
            L.PlayerVideo.listener.follow('error',function(event){
                var job=active;
                if(event&&event.fatal&&job&&valid(job)&&job.mode==='inner')
                    log('HLS fatal: исправляем поток без переключения серии');
            });
        root.addEventListener('beforeunload', function () {cinemaSkin.stop();amediaRuntime.stop();stopQueuedBridge();restoreAutoNext();finish(active, 'выход'); });
        // Focus/blur alone can be system volume/permission dialogs. They are not
        // reliable completion events, especially with APK keepPlayerConnection.
        // Movie engine has no own UI/settings registration.

    }
    var client = {version: version, open: open, isSeries:isSeries, installNativeEpisodeHook:installNativeEpisodeHook, getResumeSeason:getResumeSeason, putAscendingEpisodes:putAscendingEpisodes, installNativeSeasonFlow:installNativeSeasonFlow, nativeSeasonSource:nativeSeasonSource, preserveNativeSeasonArt:preserveNativeSeasonArt,
        begin: begin, isCurrent: valid, check: check, sortedTree:sortedTree, nextEpisodeRequest:nextEpisodeRequest, 
        isInner: function (job) { return valid(job) && job.mode === 'inner'; },
        own: own, seed: seed, rotate: rotate, prepare: prepare, tuneInnerHls:tuneInnerHls, launch: launch, makeQueue: makeQueue, prepareLazyInnerQueue:prepareLazyInnerQueue, publishInnerQueue:publishInnerQueue, bestQueueStream:bestQueueStream, recoverStream:recoverStream, rememberHlsRecovery:rememberHlsRecovery, activateQueuedBridge:activateQueuedBridge, stopQueuedBridge:stopQueuedBridge, voiceScore:voiceScore, chooseAdaptiveSource:chooseAdaptiveSource, selectedResolution:selectedResolution, setupVerifiedAutoNext:setupVerifiedAutoNext, checkNativePlaylist:checkNativePlaylist,
        failJob: function (job) { finish(job, 'ошибка'); }, listen: listen, hlsOn: hlsOn,
        currentTime: function (job, inner) { return job.mode === 'inner' ? inner() : job.position; },
        registerSettings: registerSettings};
    subscribe(); // Dedicated movie runtime: no Amedia settings injection.
    root.__capsuleAmediaFilmClient = client;
    return client;
}(window));}


// Expose only the movie catalog entry point. The old Amedia plugin and its
// button/manifest bootstrap are deliberately NOT installed.
window.__capsuleAmediaFilmPlayBridge=function(movie){
    if(!movie)return Promise.resolve();
    _amediaInit();
    return _0x252726(movie,{manual:false});
};
}()));
        installed=true;
    }
    root.__capsuleAmediaFilmPlay=function(movie){
        if(!movie)return Promise.resolve();
        // Unify quality settings without touching the legacy Amedia plugin.
        try {
            var storage=root.Lampa&&root.Lampa.Storage;
            if(storage&&storage.set&&storage.get){
                var quality=String(storage.get('capsule_skaz_online_quality','auto'));
                if(quality==='max')quality='2160';
                if(!/^(auto|2160|1080|720)$/.test(quality))quality='auto';
                storage.set('capsule_amedia_film_quality',quality);
            }
        } catch(ignored) {}
        var now=Date.now();
        if(opening||now-lastLaunch<8000) {
            if(root.Lampa&&root.Lampa.Noty&&root.Lampa.Noty.show)
                root.Lampa.Noty.show('Amedia: запрос уже выполняется');
            return Promise.resolve();
        }
        opening=true;lastLaunch=now;
        try{
            installMovieEngine();
            if(typeof root.__capsuleAmediaFilmPlayBridge!=='function')
                throw new Error('Каталог Amedia не инициализирован');
            return Promise.resolve(root.__capsuleAmediaFilmPlayBridge(movie))
                .catch(function(){
                    if(root.Lampa&&root.Lampa.Noty)root.Lampa.Noty.show('Amedia: видео не удалось запустить');
                }).then(function(){opening=false;},function(){opening=false;});
        }catch(error){
            opening=false;
            if(root.Lampa&&root.Lampa.Noty&&root.Lampa.Noty.show)
                root.Lampa.Noty.show('Amedia: ошибка запуска каталога');
            return Promise.resolve();
        }
    };
})(window);
