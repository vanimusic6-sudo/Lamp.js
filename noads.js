(function () {
    'use strict';

    if (window.__capsule_noads_loaded) return;
    window.__capsule_noads_loaded = true;

    // Keep the official feature flag enabled as well, in case Lampa starts
    // honoring it directly in future versions.
    try {
        if (window.lampa_settings && window.lampa_settings.disable_features) {
            window.lampa_settings.disable_features.ads = true;
        }
    } catch (e) {}

    // Lampa loads its own preroll/banner lists through /api/ad/get/*.
    // Replace only those responses with an empty ad list; all other XHRs
    // keep using the untouched native implementation.
    var XHR = window.XMLHttpRequest;
    var URLApi = window.URL || window.webkitURL;
    var emptyAdsUrl = 'data:application/json;charset=utf-8,%7B%22ad%22%3A%5B%5D%7D';

    try {
        if (URLApi && URLApi.createObjectURL && window.Blob) {
            emptyAdsUrl = URLApi.createObjectURL(
                new Blob(['{"ad":[]}'], { type: 'application/json' })
            );
        }
    } catch (e) {}

    if (XHR && XHR.prototype && !XHR.prototype.__capsule_noads_patched) {
        var nativeOpen = XHR.prototype.open;
        var adEndpoint = /\/api\/ad\/get\/(?:preroll|banner)(?:[/?#]|$)/i;

        XHR.prototype.open = function (method, url) {
            if (adEndpoint.test(String(url || ''))) {
                arguments[1] = emptyAdsUrl;
            }

            return nativeOpen.apply(this, arguments);
        };

        XHR.prototype.__capsule_noads_patched = true;
    }

    // Some online-source plugins can attach their own VAST ad URLs directly
    // to Player data. Remove only those ad-specific fields before playback.
    function stripVast(data) {
        if (!data || typeof data !== 'object') return;

        delete data.vast_url;
        delete data.vast_banner;
        delete data.vast_region;
        delete data.vast_platform;
        delete data.vast_screen;
        delete data.vast_msg;

        if (Array.isArray(data.playlist)) {
            data.playlist.forEach(stripVast);
        }
    }

    function attachPlayerHook() {
        if (!window.Lampa || !Lampa.Player || !Lampa.Player.listener) {
            setTimeout(attachPlayerHook, 100);
            return;
        }

        Lampa.Player.listener.follow('create', function (event) {
            stripVast(event && event.data);
        });

        // IPTV starts through a separate path and does not emit Player:create.
        if (Lampa.Player.iptv && !Lampa.Player.iptv.__capsule_noads_wrapped) {
            var nativeIptv = Lampa.Player.iptv;
            var wrappedIptv = function (data) {
                stripVast(data);
                return nativeIptv.apply(this, arguments);
            };

            wrappedIptv.__capsule_noads_wrapped = true;
            Lampa.Player.iptv = wrappedIptv;
        }

        console.log('[CAPSULE No Ads] enabled');
    }

    attachPlayerHook();
})();
