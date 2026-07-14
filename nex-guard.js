/*
 * NEX SSO guard pro interní statické nástroje DigiDay.
 * Vložit jako první script v <head>:
 *   <script src="https://tools.digiday.cz/nex-guard.js"></script>
 *
 * Rozcestník (tools.digiday.cz) předává token v URL fragmentu #nex=…,
 * guard ho ověří přes digiday-tools-auth a uloží do localStorage,
 * takže další návštěvy stejného originu už token v URL nepotřebují.
 * Bez platného tokenu přesměruje na přihlášení na rozcestníku.
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
