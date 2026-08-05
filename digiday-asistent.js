/*
 * DigiDay asistent — plovoucí chat nad interními nástroji.
 *
 * Vložit na konec <body> libovolné stránky na tools.digiday.cz:
 *   <script src="digiday-asistent.js" defer></script>
 *
 * Skript si sám vytvoří tlačítko, panel i styly. Odpovídá backend na Verceli,
 * který drží klíč k Anthropic API; sem se posílá jen NEX token z localStorage,
 * takže asistent funguje pouze přihlášeným kolegům.
 */
(function () {
  'use strict';

  if (window.DIGIDAY_ASISTENT_LOADED) return;
  window.DIGIDAY_ASISTENT_LOADED = true;

  var API_URL = 'https://digiday-tools-chat.vercel.app/api/chat';
  var AUTH_KEY = 'nexAuth';
  var PINK = '#e0007a';
  var DARK = '#313746';

  var messages = [];
  var busy = false;
  var els = {};

  function getToken() {
    try {
      var auth = JSON.parse(localStorage.getItem(AUTH_KEY));
      if (auth && auth.token && auth.exp > Date.now()) return auth.token;
    } catch (e) {}
    return null;
  }

  function injectStyles() {
    var css = [
      '#dd-asistent-btn{position:fixed;right:24px;bottom:24px;z-index:2147483000;',
      'width:56px;height:56px;border:none;border-radius:50%;cursor:pointer;',
      'background:' + PINK + ';color:#fff;font-size:22px;line-height:1;',
      'box-shadow:0 6px 20px rgba(224,0,122,.35);transition:transform .15s}',
      '#dd-asistent-btn:hover{transform:translateY(-2px)}',
      '#dd-asistent-panel{position:fixed;right:24px;bottom:92px;z-index:2147483000;',
      'width:380px;max-width:calc(100vw - 32px);height:520px;max-height:calc(100vh - 120px);',
      'display:none;flex-direction:column;background:#fff;border:1px solid #e5e7eb;',
      'border-radius:12px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,.16);',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Helvetica Neue",Arial,sans-serif}',
      '#dd-asistent-panel.dd-open{display:flex}',
      '#dd-asistent-head{padding:14px 16px;background:' + DARK + ';color:#fff;',
      'display:flex;align-items:center;justify-content:space-between}',
      '#dd-asistent-head b{font-size:10.5pt}',
      '#dd-asistent-head span{font-size:8.5pt;opacity:.7;display:block;margin-top:2px}',
      '#dd-asistent-close{background:none;border:none;color:#fff;font-size:20px;',
      'cursor:pointer;opacity:.7;padding:0 4px}',
      '#dd-asistent-close:hover{opacity:1}',
      '#dd-asistent-log{flex:1;overflow-y:auto;padding:16px;background:#f4f4f7}',
      '.dd-msg{max-width:85%;padding:10px 13px;border-radius:10px;margin-bottom:10px;',
      'font-size:10pt;line-height:1.5;white-space:pre-wrap;word-wrap:break-word}',
      '.dd-user{margin-left:auto;background:' + PINK + ';color:#fff;border-bottom-right-radius:3px}',
      '.dd-bot{background:#fff;color:' + DARK + ';border:1px solid #e5e7eb;border-bottom-left-radius:3px}',
      '.dd-err{background:#fdecea;color:#c0392b;border:1px solid #f5c6cb}',
      '.dd-hint{font-size:9pt;color:#6b7280;line-height:1.5;margin-bottom:12px}',
      '#dd-asistent-form{display:flex;gap:8px;padding:12px;border-top:1px solid #e5e7eb;background:#fff}',
      '#dd-asistent-input{flex:1;padding:10px 12px;font-size:10pt;font-family:inherit;',
      'border:1px solid #e5e7eb;border-radius:8px;outline:none;resize:none;max-height:96px}',
      '#dd-asistent-input:focus{border-color:' + PINK + '}',
      '#dd-asistent-send{padding:0 16px;font-size:10pt;font-weight:700;color:#fff;',
      'background:' + PINK + ';border:none;border-radius:8px;cursor:pointer}',
      '#dd-asistent-send:disabled{opacity:.5;cursor:default}',
      '@media(max-width:480px){#dd-asistent-panel{right:8px;left:8px;width:auto;bottom:84px}}',
    ].join('');
    var style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  function build() {
    var btn = document.createElement('button');
    btn.id = 'dd-asistent-btn';
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Otevřít asistenta nástrojů');
    btn.textContent = '💬';

    var panel = document.createElement('div');
    panel.id = 'dd-asistent-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', 'DigiDay asistent');
    panel.innerHTML =
      '<div id="dd-asistent-head">' +
      '<span><b>DigiDay asistent</b><span>Poradí s interními nástroji</span></span>' +
      '<button id="dd-asistent-close" type="button" aria-label="Zavřít">×</button>' +
      '</div>' +
      '<div id="dd-asistent-log"></div>' +
      '<form id="dd-asistent-form">' +
      '<textarea id="dd-asistent-input" rows="1" placeholder="Zeptej se na nástroje…" ' +
      'autocomplete="off"></textarea>' +
      '<button id="dd-asistent-send" type="submit">Odeslat</button>' +
      '</form>';

    document.body.appendChild(btn);
    document.body.appendChild(panel);

    els.btn = btn;
    els.panel = panel;
    els.log = panel.querySelector('#dd-asistent-log');
    els.form = panel.querySelector('#dd-asistent-form');
    els.input = panel.querySelector('#dd-asistent-input');
    els.send = panel.querySelector('#dd-asistent-send');

    var hint = document.createElement('div');
    hint.className = 'dd-hint';
    hint.textContent =
      'Zeptej se třeba „čím vygeneruju předávací protokol?“ nebo „jak nasadím chatbota na web obce?“.';
    els.log.appendChild(hint);

    btn.addEventListener('click', toggle);
    panel.querySelector('#dd-asistent-close').addEventListener('click', toggle);
    els.form.addEventListener('submit', onSubmit);
    els.input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSubmit(e);
      }
    });
    els.input.addEventListener('input', function () {
      els.input.style.height = 'auto';
      els.input.style.height = Math.min(els.input.scrollHeight, 96) + 'px';
    });
  }

  function toggle() {
    var open = els.panel.classList.toggle('dd-open');
    els.btn.textContent = open ? '×' : '💬';
    if (open) els.input.focus();
  }

  function addBubble(cls, text) {
    var div = document.createElement('div');
    div.className = 'dd-msg ' + cls;
    div.textContent = text;
    els.log.appendChild(div);
    els.log.scrollTop = els.log.scrollHeight;
    return div;
  }

  function onSubmit(e) {
    e.preventDefault();
    if (busy) return;

    var text = els.input.value.trim();
    if (!text) return;

    var token = getToken();
    if (!token) {
      addBubble('dd-msg dd-err', 'Přihlas se prosím znovu na rozcestníku.');
      return;
    }

    els.input.value = '';
    els.input.style.height = 'auto';
    addBubble('dd-user', text);
    messages.push({ role: 'user', content: text });

    busy = true;
    els.send.disabled = true;
    var bubble = addBubble('dd-bot', '…');

    ask(token, bubble);
  }

  function ask(token, bubble) {
    var answer = '';

    fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: messages, token: token }),
    })
      .then(function (response) {
        if (!response.ok) {
          return response.json().then(
            function (d) { throw new Error(d.error || 'Chyba serveru.'); },
            function () { throw new Error('Chyba serveru.'); }
          );
        }
        return readStream(response, function (chunk) {
          answer += chunk;
          bubble.textContent = answer;
          els.log.scrollTop = els.log.scrollHeight;
        });
      })
      .then(function () {
        if (answer) {
          messages.push({ role: 'assistant', content: answer });
        } else {
          bubble.className = 'dd-msg dd-err';
          bubble.textContent = 'Asistent neodpověděl, zkus to prosím znovu.';
          messages.pop();
        }
      })
      .catch(function (err) {
        bubble.className = 'dd-msg dd-err';
        bubble.textContent = err.message || 'Nepodařilo se spojit s asistentem.';
        messages.pop();
      })
      .finally(function () {
        busy = false;
        els.send.disabled = false;
        els.input.focus();
      });
  }

  /** Čte Server-Sent Events z odpovědi a předává text po částech. */
  function readStream(response, onText) {
    var reader = response.body.getReader();
    var decoder = new TextDecoder();
    var buffer = '';

    function pump() {
      return reader.read().then(function (result) {
        if (result.done) return;
        buffer += decoder.decode(result.value, { stream: true });

        var blocks = buffer.split('\n\n');
        buffer = blocks.pop();

        blocks.forEach(function (block) {
          var event = '';
          var data = '';
          block.split('\n').forEach(function (line) {
            if (line.indexOf('event: ') === 0) event = line.slice(7);
            else if (line.indexOf('data: ') === 0) data = line.slice(6);
          });
          if (!data) return;
          var payload;
          try { payload = JSON.parse(data); } catch (e) { return; }

          if (event === 'delta' && payload.text) onText(payload.text);
          else if (event === 'error') throw new Error(payload.message);
        });

        return pump();
      });
    }

    return pump();
  }

  function init() {
    if (!getToken()) return; // nepřihlášeným se asistent vůbec nezobrazí
    injectStyles();
    build();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
