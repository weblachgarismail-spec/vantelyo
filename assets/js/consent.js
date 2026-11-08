/* =========================================
   SmartLife Innovations — Consent & AdSense
   Ads stay disabled until a real publisher ID
   is configured below AND the visitor opts in.
   ========================================= */
(function () {
  'use strict';

  // TODO: replace with your real AdSense publisher ID, e.g. "ca-pub-1234567890123456".
  // Leave empty to keep ads disabled.
  var ADSENSE_CLIENT = '';
  var CONSENT_KEY = 'sli-consent';

  function tr(key, fallback) {
    return typeof t === 'function' ? t(key) : fallback;
  }

  function readConsent() {
    try {
      var raw = window.localStorage.getItem(CONSENT_KEY);
      if (!raw) return null;
      // Backwards compatibility with the old "accepted"/"declined" values.
      if (raw === 'accepted') return { necessary: true, analytics: true, ads: true };
      if (raw === 'declined') return { necessary: true, analytics: false, ads: false };
      var parsed = JSON.parse(raw);
      return {
        necessary: true,
        analytics: !!parsed.analytics,
        ads: !!parsed.ads
      };
    } catch (e) {
      return null;
    }
  }

  function writeConsent(choice) {
    try {
      window.localStorage.setItem(
        CONSENT_KEY,
        JSON.stringify({
          necessary: true,
          analytics: !!choice.analytics,
          ads: !!choice.ads,
          ts: Date.now()
        })
      );
    } catch (e) {}
  }

  function hasRealClient() {
    return /^ca-pub-\d{10,}$/.test(ADSENSE_CLIENT);
  }

  // Google Consent Mode v2. We always push a denied default first, then update
  // it to match the visitor's choice. This keeps the signal correct if a
  // Google tag or AdSense script is loaded later.
  function pushConsent(type, choice) {
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () {
      window.dataLayer.push(arguments);
    };
    var ads = choice && choice.ads ? 'granted' : 'denied';
    var analytics = choice && choice.analytics ? 'granted' : 'denied';
    var payload = {
      ad_storage: ads,
      ad_user_data: ads,
      ad_personalization: ads,
      analytics_storage: analytics
    };
    if (type === 'default') payload.wait_for_update = 500;
    window.gtag('consent', type, payload);
  }

  pushConsent('default', null);

  function loadAdSense() {
    if (!hasRealClient()) return;
    var consent = readConsent();
    if (!consent || !consent.ads) return;
    if (document.querySelector('script[data-adsense-loader]')) return;

    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + encodeURIComponent(ADSENSE_CLIENT);
    script.crossOrigin = 'anonymous';
    script.setAttribute('data-adsense-loader', '1');
    document.head.appendChild(script);

    document.querySelectorAll('.ad-slot').forEach(function (slot) {
      if (slot.getAttribute('data-ad-ready') === '1') return;
      var slotId = slot.getAttribute('data-ad-slot');
      if (!slotId) return;
      slot.classList.remove('ad-slot--empty');
      slot.innerHTML =
        '<ins class="adsbygoogle" style="display:block" data-ad-client="' + ADSENSE_CLIENT +
        '" data-ad-slot="' + slotId + '" data-ad-format="auto" data-full-width-responsive="true"></ins>';
      try {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) {}
      slot.setAttribute('data-ad-ready', '1');
    });
  }

  function disableAds() {
    document.querySelectorAll('.ad-slot').forEach(function (slot) {
      slot.classList.remove('ad-slot--active');
      slot.classList.add('ad-slot--empty');
      slot.innerHTML = '';
      slot.removeAttribute('data-ad-ready');
    });
  }

  function applyChoice(choice) {
    writeConsent(choice);
    pushConsent('update', choice);
    if (choice.ads) {
      loadAdSense();
    } else {
      disableAds();
    }
  }

  function checkbox(id, label, description, checked, disabled) {
    return (
      '<label class="consent-option">' +
        '<input type="checkbox" id="' + id + '" data-consent="' + id + '"' +
          (checked ? ' checked' : '') + (disabled ? ' disabled' : '') + '>' +
        '<span class="consent-option-text">' +
          '<strong>' + label + '</strong>' +
          (description ? '<small>' + description + '</small>' : '') +
        '</span>' +
      '</label>'
    );
  }

  function buildBanner(current) {
    var choice = current || { necessary: true, analytics: false, ads: false };
    var banner = document.createElement('div');
    banner.className = 'consent-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-modal', 'false');
    banner.setAttribute('aria-label', tr('consentTitle', 'Cookie and advertising preferences'));
    banner.innerHTML =
      '<div class="consent-inner">' +
        '<div class="consent-text">' +
          '<strong>' + tr('consentTitle', 'Cookie and advertising preferences') + '</strong>' +
          '<p>' + tr('consentText', 'We use essential cookies to run this site. With your consent, we may also use Google AdSense cookies to show ads. You can accept, reject, or choose categories.') + '</p>' +
        '</div>' +
        '<div class="consent-options" role="group" aria-label="' + tr('consentTitle', 'Cookie and advertising preferences') + '">' +
          checkbox('necessary', tr('consentNecessary', 'Essential'), tr('consentNecessaryDesc', 'Required for the site to work. Always on.'), true, true) +
          checkbox('analytics', tr('consentAnalytics', 'Analytics'), tr('consentAnalyticsDesc', 'Anonymous audience measurement.'), choice.analytics, false) +
          checkbox('ads', tr('consentAds', 'Advertising'), tr('consentAdsDesc', 'Google AdSense advertising cookies.'), choice.ads, false) +
        '</div>' +
        '<div class="consent-actions">' +
          '<button type="button" class="btn btn-outline consent-reject">' + tr('consentRejectAll', 'Reject all') + '</button>' +
          '<button type="button" class="btn btn-outline consent-save">' + tr('consentSave', 'Save choices') + '</button>' +
          '<button type="button" class="btn btn-primary consent-accept">' + tr('consentAcceptAll', 'Accept all') + '</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(banner);

    function readBoxes() {
      return {
        necessary: true,
        analytics: !!banner.querySelector('#analytics').checked,
        ads: !!banner.querySelector('#ads').checked
      };
    }

    function close() {
      banner.remove();
    }

    banner.querySelector('.consent-accept').addEventListener('click', function () {
      applyChoice({ necessary: true, analytics: true, ads: true });
      close();
    });
    banner.querySelector('.consent-reject').addEventListener('click', function () {
      applyChoice({ necessary: true, analytics: false, ads: false });
      close();
    });
    banner.querySelector('.consent-save').addEventListener('click', function () {
      applyChoice(readBoxes());
      close();
    });

    return banner;
  }

  function openSettings() {
    var existing = document.querySelector('.consent-banner');
    if (existing) existing.remove();
    buildBanner(readConsent());
  }

  document.addEventListener('DOMContentLoaded', function () {
    // Re-open link in the footer
    document.querySelectorAll('.js-consent-settings').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        openSettings();
      });
    });

    var consent = readConsent();
    if (consent) {
      pushConsent('update', consent);
      if (consent.ads) {
        loadAdSense();
      } else {
        disableAds();
      }
    } else {
      disableAds();
      buildBanner(null);
    }
  });
})();
