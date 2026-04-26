// content.js — runs on every page (idle).
// Listens for messages from the popup/background and injects the vanilla TAPE
// SDK into the page's main world so it has access to the host's DOM events.

(function () {
  let injected = false;

  function inject() {
    if (injected) return;
    injected = true;
    // Inject the bundled vanilla SDK into the page main world via a <script src> tag.
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('vanilla.js');
    script.onload = function () {
      this.remove();
      // Give the bundle a tick, then dispatch an init.
      const init = document.createElement('script');
      init.textContent =
        'try { (window.UseTape && window.UseTape.Tape && window.UseTape.Tape.init({ shortcut: "Alt+T", vision: true, position: "bottom-right" })); } catch (e) { console.warn("TAPE init failed", e); }';
      (document.head || document.documentElement).appendChild(init);
      init.remove();
    };
    (document.head || document.documentElement).appendChild(script);
  }

  function toggle() {
    inject();
    // Bridge message into the page main world via a dispatched event.
    const ev = new CustomEvent('tape-toggle');
    window.dispatchEvent(ev);
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === 'tape:inject') {
      inject();
      sendResponse({ ok: true });
    } else if (msg && msg.type === 'tape:toggle') {
      toggle();
      sendResponse({ ok: true });
    }
    return true;
  });
})();
