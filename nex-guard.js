/*
 * NEX SSO guard pro interní statické nástroje DigiDay.
 * Vložit jako první script v <head>:
 *   <script src="https://tools.digiday.cz/nex-guard.js"></script>
 *
 * Rozcestník (tools.digiday.cz) předává token v URL fragmentu #nex=…,
 * guard ho ověří přes digiday-tools-auth a uloží do localStorage,
 * takže další návštěvy stejného originu už token v URL nepotřebují.
 * Bez platného tokenu přesměruje na přihlášení na rozcestníku.
 *
 * Předvyplnění z NEXu: ostatní parametry ve fragmentu (#nex=…&subjekt=…)
 * se po načtení stránky zapíšou do polí s atributem data-prefill="subjekt"
 * a vyvolá se na nich událost input, aby se překreslil náhled.
 */
(function () {
  var KEY = 'nexAuth';
  var VERIFY = 'https://digiday-tools-auth.vercel.app/api/verify';
  var LOGIN = 'https://tools.digiday.cz/';

  document.documentElement.style.visibility = 'hidden';

  function show() { document.documentElement.style.visibility = ''; }
  function deny() { location.replace(LOGIN); }

  function stored() {
    try {
      var a = JSON.parse(localStorage.getItem(KEY));
      if (a && a.token && a.exp > Date.now()) return a;
    } catch (e) {}
    return null;
  }

  var m = (location.hash || '').match(/[#&]nex=([^&]+)/);
  var token = m ? decodeURIComponent(m[1]) : null;

  var prefill = {};
  (location.hash || '').replace(/^#/, '').split('&').forEach(function (kv) {
    var i = kv.indexOf('=');
    if (i < 1) return;
    var k = decodeURIComponent(kv.slice(0, i));
    if (k === 'nex') return;
    try { prefill[k] = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' ')); } catch (e) {}
  });

  function applyPrefill() {
    if (!Object.keys(prefill).length) return;
    history.replaceState(null, '', location.pathname + location.search);
    // pole, která NEX neposlal, vyprázdnit (ať nezůstanou data jiného zákazníka z localStorage); datum nechat
    Array.prototype.forEach.call(document.querySelectorAll('[data-prefill]'), function (el) {
      var k = el.getAttribute('data-prefill');
      if (k in prefill) el.value = prefill[k];
      else if (el.type !== 'date') el.value = '';
      else return;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  // 'load' až po inline skriptech stránky (ty můžou obnovit uložený stav z localStorage)
  window.addEventListener('load', applyPrefill);

  if (token) {
    fetch(VERIFY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token })
    })
    .then(function (r) { return r.json(); })
    .then(function (d) {
      if (d.ok) {
        localStorage.setItem(KEY, JSON.stringify({ user: d.user, exp: d.exp, token: token }));
        history.replaceState(null, '', location.pathname + location.search);
        show();
      } else if (stored()) {
        show();
      } else {
        deny();
      }
    })
    .catch(function () { stored() ? show() : deny(); });
  } else if (stored()) {
    show();
  } else {
    deny();
  }
})();
