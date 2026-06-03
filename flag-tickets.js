// flag-tickets.js - Board-view ticket flagging ("check later")
// Right-click a card -> pick a colour. Stored per-browser in chrome.storage.local.
// Visually distinct from the age highlighter (corner badge, not a border) so the
// two never compete.

(function() {
  'use strict';

  const CARD_SELECTOR = '[data-test-id="cdb-card"]';
  const STORAGE_KEY = 'ticketFlags';

  const COLOURS = {
    orange: '#ff8c42',
    red:    '#e53935',
    green:  '#43a047',
    blue:   '#1e88e5'
  };

  const LABELS = {
    orange: 'Følg opp',
    red:    'Haster',
    green:  'OK / sjekket',
    blue:   'Til info'
  };

  function isTicketPage() {
    return location.href.includes('/objects/0-5/') || location.href.includes('/tickets/');
  }

  function getTicketId(card) {
    const link = card.querySelector('a[data-test-id="board-card-section-title-link"]');
    const m = link?.getAttribute('href')?.match(/\/0-5\/(\d+)\//);
    return m?.[1] ?? null;
  }

  let flagsCache = {};
  let menuEl = null;
  let rafQueued = false;

  function loadFlags() {
    return new Promise((resolve) => {
      if (typeof chrome === 'undefined' || !chrome.storage) { resolve({}); return; }
      chrome.storage.local.get([STORAGE_KEY], (r) => resolve(r[STORAGE_KEY] || {}));
    });
  }

  function saveFlags(flags) {
    flagsCache = flags;
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ [STORAGE_KEY]: flags });
    }
  }

  function setFlag(id, colour) {
    const flags = { ...flagsCache };
    if (colour) flags[id] = { colour, ts: Date.now() };
    else delete flags[id];
    saveFlags(flags);
    applyFlags();
  }

  function applyFlags() {
    if (!isTicketPage()) return;
    document.querySelectorAll(CARD_SELECTOR).forEach((card) => {
      const id = getTicketId(card);
      const f = id ? flagsCache[id] : null;
      if (f) {
        card.classList.add('thx-flagged');
        card.dataset.thxFlag = f.colour;
      } else if (card.dataset.thxFlag) {
        card.classList.remove('thx-flagged');
        delete card.dataset.thxFlag;
      }
    });
  }

  function scheduleApply() {
    if (rafQueued) return;
    rafQueued = true;
    requestAnimationFrame(() => { rafQueued = false; applyFlags(); });
  }

  function closeMenu() {
    if (!menuEl) return;
    menuEl.remove();
    menuEl = null;
    document.removeEventListener('mousedown', onOutside, true);
  }

  function onOutside(e) {
    if (menuEl && !menuEl.contains(e.target)) closeMenu();
  }

  function showMenu(x, y, id) {
    closeMenu();
    menuEl = document.createElement('div');
    menuEl.className = 'thx-flag-menu';
    Object.assign(menuEl.style, {
      position: 'absolute',
      left: x + 'px',
      top: y + 'px',
      zIndex: '2147483647'
    });

    const current = flagsCache[id]?.colour;

    Object.keys(COLOURS).forEach((name) => {
      const item = document.createElement('button');
      item.className = 'thx-flag-item' + (current === name ? ' thx-flag-active' : '');
      item.innerHTML =
        '<span class="thx-dot" style="background:' + COLOURS[name] + '"></span>' +
        '<span class="thx-label">' + LABELS[name] + '</span>';
      // mousedown (not click): the outside-close listener fires on mousedown too,
      // so handling it here and stopping propagation keeps ordering predictable.
      item.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        setFlag(id, name);
        closeMenu();
      });
      menuEl.appendChild(item);
    });

    if (current) {
      const clear = document.createElement('button');
      clear.className = 'thx-flag-item thx-flag-clear';
      clear.textContent = 'Fjern flagg';
      clear.addEventListener('mousedown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        setFlag(id, null);
        closeMenu();
      });
      menuEl.appendChild(clear);
    }

    document.body.appendChild(menuEl);

    // keep inside viewport
    const r = menuEl.getBoundingClientRect();
    if (r.right > window.innerWidth) menuEl.style.left = (x - r.width) + 'px';
    if (r.bottom > window.innerHeight) menuEl.style.top = (y - r.height) + 'px';

    setTimeout(() => {
      document.addEventListener('mousedown', onOutside, true);
      document.addEventListener('scroll', closeMenu, { once: true, capture: true });
      window.addEventListener('blur', closeMenu, { once: true });
    }, 0);
  }

  document.addEventListener('contextmenu', (e) => {
    if (!isTicketPage()) return;
    const card = e.target.closest(CARD_SELECTOR);
    if (!card) return;
    const id = getTicketId(card);
    if (!id) return;
    e.preventDefault();
    showMenu(e.pageX, e.pageY, id);
  });

  const observer = new MutationObserver(scheduleApply);

  function init() {
    applyFlags();
    observer.observe(document.body, { childList: true, subtree: true });
  }

  loadFlags().then((flags) => {
    flagsCache = flags;
    init();
  });

  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[STORAGE_KEY]) {
        flagsCache = changes[STORAGE_KEY].newValue || {};
        applyFlags();
      }
    });
  }

})();
