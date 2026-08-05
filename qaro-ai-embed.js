/**
 * QARO AI Chat Widget - Standalone Embed Script
 *
 * Na rozdiel od embed.js (ktorý počíta s tým, že kontajner, tlačidlo aj CSS
 * dodá šablóna qaro-fe) je tento skript sebestačný. Na ľubovoľnú stránku
 * stačí vložiť:
 *
 *   <script>
 *     window.QARO_AI_CONFIG = {
 *       cityId: "019a7d2d-aae2-76bd-9528-a2ca90dff7f6",
 *       cityName: "Štramberk",
 *       apiUrl: "https://ai.qaro.cz"
 *     };
 *   </script>
 *   <script src="https://ai.qaro.cz/embed-standalone.js" defer></script>
 *
 * Skript si sám vytvorí kontajner, plávajúce tlačidlo aj štýly.
 */

(function () {
  'use strict';

  if (window.QARO_AI_LOADED) {
    console.warn('[QARO AI] Widget already loaded');
    return;
  }
  window.QARO_AI_LOADED = true;

  var STORAGE_KEY = 'qaro_ai_chat_open';
  var CONTAINER_ID = 'qaro-ai-widget-container';
  var BUTTON_ID = 'qaro-ai-widget-button';
  var STYLE_ID = 'qaro-ai-widget-styles';
  var MOBILE_BREAKPOINT = 768;

  var DEFAULT_CONFIG = {
    cityId: 'default',
    cityName: 'QARO',
    apiUrl: window.location.origin,
    locale: 'cs',
    position: 'bottom-right', // bottom-right | bottom-left
    panelWidth: 400,
    panelHeight: 620,
    offset: 24,
    zIndex: 2147483000,
    buttonLabel: 'Otevřít chat s AI asistentem',
    autoButton: true, // false = tlačidlo si dodáš sám a voláš window.QARO_AI.open()
    theme: {
      primaryColor: '#ff40a0',
      backgroundColor: '#ffffff',
    },
  };

  var userConfig = window.QARO_AI_CONFIG || {};
  var config = Object.assign({}, DEFAULT_CONFIG, userConfig);
  config.theme = Object.assign({}, DEFAULT_CONFIG.theme, userConfig.theme || {});

  // apiUrl bez koncového lomítka, aby sa nerobilo "https://x//widget"
  config.apiUrl = String(config.apiUrl).replace(/\/+$/, '');

  var apiOrigin;
  try {
    apiOrigin = new URL(config.apiUrl, window.location.href).origin;
  } catch (e) {
    console.error('[QARO AI] Neplatná apiUrl:', config.apiUrl);
    return;
  }

  /**
   * Primárna farba: config má prednosť, potom CSS premenná hostiteľa, potom default.
   * (embed.js čítal iba --color-main a config.theme.primaryColor ignoroval.)
   */
  function resolvePrimaryColor() {
    if (userConfig.theme && userConfig.theme.primaryColor) {
      return userConfig.theme.primaryColor;
    }
    try {
      var cssVar = getComputedStyle(document.documentElement)
        .getPropertyValue('--color-main')
        .trim();
      if (cssVar) return cssVar;
    } catch (e) {
      /* ignore */
    }
    return DEFAULT_CONFIG.theme.primaryColor;
  }

  function saveOpenState(isOpen) {
    try {
      sessionStorage.setItem(STORAGE_KEY, isOpen ? 'true' : 'false');
    } catch (e) {
      /* sessionStorage nedostupné (private mode) */
    }
  }

  function loadOpenState() {
    try {
      return sessionStorage.getItem(STORAGE_KEY) === 'true';
    } catch (e) {
      return false;
    }
  }

  function isMobile() {
    return window.innerWidth <= MOBILE_BREAKPOINT;
  }

  function injectStyles(primaryColor) {
    if (document.getElementById(STYLE_ID)) return;

    var side = config.position === 'bottom-left' ? 'left' : 'right';
    var css = [
      '#' + CONTAINER_ID + ' {',
      '  position: fixed;',
      '  bottom: ' + (config.offset + 72) + 'px;',
      '  ' + side + ': ' + config.offset + 'px;',
      '  width: ' + config.panelWidth + 'px;',
      '  max-width: calc(100vw - ' + config.offset * 2 + 'px);',
      '  height: ' + config.panelHeight + 'px;',
      '  max-height: calc(100vh - ' + (config.offset * 2 + 72) + 'px);',
      '  z-index: ' + config.zIndex + ';',
      '  border-radius: 16px;',
      '  overflow: hidden;',
      '  background: ' + config.theme.backgroundColor + ';',
      '  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);',
      '  opacity: 0;',
      '  visibility: hidden;',
      '  pointer-events: none;',
      '  transform: translateY(16px) scale(0.98);',
      '  transition: opacity .22s ease, transform .22s ease, visibility .22s;',
      '}',
      '#' + CONTAINER_ID + '.qaro-widget-open {',
      '  opacity: 1;',
      '  visibility: visible;',
      '  pointer-events: auto;',
      '  transform: translateY(0) scale(1);',
      '}',
      '#' + CONTAINER_ID + ' iframe {',
      '  width: 100%;',
      '  height: 100%;',
      '  border: 0;',
      '  display: block;',
      '}',
      '#' + BUTTON_ID + ' {',
      '  position: fixed;',
      '  bottom: ' + config.offset + 'px;',
      '  ' + side + ': ' + config.offset + 'px;',
      '  width: 56px;',
      '  height: 56px;',
      '  border-radius: 50%;',
      '  border: 0;',
      '  padding: 0;',
      '  cursor: pointer;',
      '  background: ' + primaryColor + ';',
      '  color: #fff;',
      '  display: flex;',
      '  align-items: center;',
      '  justify-content: center;',
      '  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.22);',
      '  z-index: ' + (config.zIndex + 1) + ';',
      '  transition: transform .18s ease, box-shadow .18s ease;',
      '}',
      '#' + BUTTON_ID + ':hover { transform: scale(1.06); box-shadow: 0 8px 26px rgba(0,0,0,.28); }',
      '#' + BUTTON_ID + ':focus-visible { outline: 3px solid ' + primaryColor + '; outline-offset: 3px; }',
      '#' + BUTTON_ID + ' img, #' + BUTTON_ID + ' svg { width: 28px; height: 28px; pointer-events: none; }',
      '#' + BUTTON_ID + ' .qaro-icon-close { display: none; }',
      '#' + BUTTON_ID + '.qaro-button-open .qaro-icon-open { display: none; }',
      '#' + BUTTON_ID + '.qaro-button-open .qaro-icon-close { display: block; }',
      '@media (max-width: ' + MOBILE_BREAKPOINT + 'px) {',
      '  #' + CONTAINER_ID + ' {',
      '    inset: 0;',
      '    width: 100%;',
      '    max-width: 100%;',
      '    height: 100%;',
      '    max-height: 100%;',
      '    border-radius: 0;',
      '  }',
      '  #' + BUTTON_ID + '.qaro-button-open { display: none; }',
      '}',
      '@media (prefers-reduced-motion: reduce) {',
      '  #' + CONTAINER_ID + ' { transition: none; }',
      '  #' + BUTTON_ID + ' { transition: none; }',
      '}',
    ].join('\n');

    var style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function buildIframe(primaryColor) {
    var iframe = document.createElement('iframe');
    iframe.id = 'qaro-ai-widget-iframe';
    iframe.title = 'QARO AI Chat Widget';
    iframe.setAttribute('allowtransparency', 'true');
    iframe.src =
      config.apiUrl +
      '/widget?' +
      new URLSearchParams({
        cityId: config.cityId,
        cityName: config.cityName,
        locale: config.locale,
        primaryColor: primaryColor,
        backgroundColor: config.theme.backgroundColor,
        siteUrl: window.location.origin,
      }).toString();
    return iframe;
  }

  function buildButton(primaryColor) {
    var button = document.createElement('button');
    button.id = BUTTON_ID;
    button.type = 'button';
    button.setAttribute('aria-label', config.buttonLabel);
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', CONTAINER_ID);

    // Zámerne SVG a nie /copilot-icon.png — logo je ružové a na farebnom
    // tlačidle by splynulo s pozadím. Biela linka drží kontrast na každej farbe.
    var openIcon = document.createElement('span');
    openIcon.className = 'qaro-icon-open';
    openIcon.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>' +
      '</svg>';

    var closeIcon = document.createElement('span');
    closeIcon.className = 'qaro-icon-close';
    closeIcon.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M18 6 6 18M6 6l12 12"/>' +
      '</svg>';

    button.appendChild(openIcon);
    button.appendChild(closeIcon);
    return button;
  }

  function createWidget() {
    var primaryColor = resolvePrimaryColor();
    injectStyles(primaryColor);

    // Kontajner buď prevezmeme (ak si ho stránka dodala sama), alebo vytvoríme.
    var container = document.getElementById(CONTAINER_ID);
    if (!container) {
      container = document.createElement('div');
      container.id = CONTAINER_ID;
      document.body.appendChild(container);
    }

    var iframe = buildIframe(primaryColor);
    container.appendChild(iframe);

    var button = null;
    if (config.autoButton) {
      button = buildButton(primaryColor);
      document.body.appendChild(button);
    }

    var isOpen = false;

    function setState(open, notifyIframe) {
      isOpen = open;
      container.classList.toggle('qaro-widget-open', open);
      if (button) {
        button.classList.toggle('qaro-button-open', open);
        button.setAttribute('aria-expanded', open ? 'true' : 'false');
      }
      if (notifyIframe && iframe.contentWindow) {
        iframe.contentWindow.postMessage(
          { type: open ? 'QARO_AI_OPEN' : 'QARO_AI_CLOSE' },
          apiOrigin
        );
      }
      saveOpenState(open);
      window.dispatchEvent(
        new CustomEvent('qaro-ai-state-change', { detail: open ? 'open' : 'closed' })
      );
    }

    if (button) {
      button.addEventListener('click', function () {
        setState(!isOpen, true);
      });
    }

    // ESC zavrie panel (klávesa stlačená mimo iframu)
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && isOpen) {
        setState(false, true);
      }
    });

    window.addEventListener('message', function (event) {
      var data = event.data;
      if (!data || typeof data.type !== 'string' || data.type.indexOf('QARO_AI') !== 0) {
        return;
      }
      if (event.origin !== apiOrigin) {
        console.warn('[QARO AI] Origin mismatch:', event.origin, 'expected:', apiOrigin);
        return;
      }

      // Krížik vnútri panelu
      if (data.type === 'QARO_AI_WIDGET_STATE' && data.state === 'closed') {
        setState(false, false);
      }

      if (data.type === 'QARO_AI_WIDGET_READY') {
        window.dispatchEvent(new CustomEvent('qaro-ai-ready'));
        // Obnova stavu po prechode na inú podstránku
        if (loadOpenState()) {
          setState(true, true);
        }
      }
    });

    window.QARO_AI = {
      open: function () {
        setState(true, true);
      },
      close: function () {
        setState(false, true);
      },
      toggle: function () {
        setState(!isOpen, true);
      },
      isOpen: function () {
        return isOpen;
      },
      sendMessage: function (message) {
        if (iframe.contentWindow) {
          iframe.contentWindow.postMessage(
            { type: 'QARO_AI_SEND_MESSAGE', message: message },
            apiOrigin
          );
        }
      },
      clearHistory: function () {
        if (iframe.contentWindow) {
          iframe.contentWindow.postMessage({ type: 'QARO_AI_CLEAR_HISTORY' }, apiOrigin);
        }
      },
      getConfig: function () {
        return config;
      },
    };

    console.log('[QARO AI] Standalone widget ready:', config.apiUrl + '/widget');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createWidget);
  } else {
    createWidget();
  }
})();
