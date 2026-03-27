(function() {
  'use strict';

  function isTicketPage() {
    return window.location.href.includes('/objects/0-5/') || 
           window.location.href.includes('/tickets/');
  }

  const CONFIG = {
    enabled: true,
    showIndicator: true,
    urgentKeywords: ['urgent', 'haster', 'kritisk', 'critical', 'asap'],
    freshTicketDays: 2,
    warningTicketDays: 5,
    highlightUnassigned: true,
    enableTableHighlighting: true,
    categoryHighlights: { bug: 'urgent', feil: 'urgent', error: 'urgent' }
  };

  const MONTH_NAMES = {
    'jan': 0, 'january': 0,
    'feb': 1, 'february': 1,
    'mar': 2, 'march': 2,
    'apr': 3, 'april': 3,
    'may': 4,
    'jun': 5, 'june': 5,
    'jul': 6, 'july': 6,
    'aug': 7, 'august': 7,
    'sep': 8, 'sept': 8, 'september': 8,
    'oct': 9, 'october': 9,
    'nov': 10, 'november': 10,
    'dec': 11, 'december': 11,
    'januar': 0, 'februari': 1, 'mars': 2, 'mai': 4,
    'juni': 5, 'juli': 6, 'augusti': 7,
    'oktober': 9, 'desember': 11,
    'märz': 2, 'mär': 2,
    'dezember': 11, 'dez': 11,
    'enero': 0, 'ene': 0, 'febrero': 1, 'marzo': 2, 'abril': 3, 'abr': 3,
    'mayo': 4, 'junio': 5, 'julio': 6, 'agosto': 7, 'ago': 7,
    'septiembre': 8, 'octubre': 9, 'noviembre': 10, 'diciembre': 11, 'dic': 11,
    'janvier': 0, 'janv': 0, 'février': 1, 'févr': 1, 'fév': 1,
    'avril': 3, 'avr': 3,
    'juillet': 6, 'juil': 6, 'août': 7, 'aoû': 7,
    'octobre': 9, 'décembre': 11, 'déc': 11
  };

  const TODAY_WORDS = ['today', 'i dag', 'idag', 'heute', 'hoy', "aujourd'hui", 'vandaag'];
  const YESTERDAY_WORDS = ['yesterday', 'i går', 'igår', 'gestern', 'ayer', 'hier', 'gisteren'];

  function parseHubSpotDate(dateString) {
    if (!dateString || typeof dateString !== 'string') return null;
    
    const text = dateString.toLowerCase().trim();
    const now = new Date();
    
    for (const todayWord of TODAY_WORDS) {
      if (text.includes(todayWord)) {
        return now;
      }
    }
    
    for (const yesterdayWord of YESTERDAY_WORDS) {
      if (text.includes(yesterdayWord)) {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        return yesterday;
      }
    }
    
    const dotMatch = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (dotMatch) {
      const day = parseInt(dotMatch[1]);
      const month = parseInt(dotMatch[2]) - 1;
      const year = parseInt(dotMatch[3]);
      return new Date(year, month, day);
    }
    
    const isoMatch = text.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      return new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]));
    }
    
    const euroMatch = text.match(/(\d{1,2})\.?\s*([a-zäöüéè]+)\.?\s*(\d{4})/i);
    if (euroMatch) {
      const day = parseInt(euroMatch[1]);
      const monthStr = euroMatch[2].toLowerCase();
      const year = parseInt(euroMatch[3]);
      const month = MONTH_NAMES[monthStr];
      if (month !== undefined) {
        return new Date(year, month, day);
      }
    }
    
    const usMatch = text.match(/([a-zäöüéè]+)\.?\s*(\d{1,2}),?\s*(\d{4})/i);
    if (usMatch) {
      const monthStr = usMatch[1].toLowerCase();
      const day = parseInt(usMatch[2]);
      const year = parseInt(usMatch[3]);
      const month = MONTH_NAMES[monthStr];
      if (month !== undefined) {
        return new Date(year, month, day);
      }
    }
    
    const parsed = new Date(dateString);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
    
    return null;
  }

  function getDaysSinceDate(dateOrString) {
    let date;
    
    if (typeof dateOrString === 'string') {
      date = parseHubSpotDate(dateOrString);
    } else if (dateOrString instanceof Date) {
      date = dateOrString;
    } else {
      return null;
    }
    
    if (!date || isNaN(date.getTime())) return null;
    
    const now = new Date();
    const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dateMidnight = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    
    const diffTime = nowMidnight - dateMidnight;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }

  function highlightElements() {
    if (!CONFIG.enabled) return;
    
    if (!isTicketPage()) return;

    highlightTicketCards();
    
    if (CONFIG.enableTableHighlighting) {
      highlightTableRows();
    }
    
    if (CONFIG.showIndicator) {
      showActiveIndicator();
    }
  }

  function getCardWrapper(element) {
    let current = element;
    while (current && current !== document.body) {
      if (current.getAttribute('data-rbd-draggable-id') || 
          current.classList.toString().includes('BoardCard') ||
          current.classList.toString().includes('DraggableCard')) {
        return current;
      }
      current = current.parentElement;
    }
    return null;
  }

  function getAgeHighlightType(daysSinceActivity) {
    if (daysSinceActivity <= CONFIG.freshTicketDays) {
      return 'fresh';
    } else if (daysSinceActivity <= CONFIG.warningTicketDays) {
      return 'attention';
    } else {
      return 'overdue';
    }
  }

  function highlightTicketCards() {
    const cardContainers = document.querySelectorAll('[data-test-id="title-hover-container"]');
    
    cardContainers.forEach(container => {
      const card = getCardWrapper(container) || container.closest('[class*="Card"]') || container;
      
      if (card.dataset.hsHighlighted) return;
      card.dataset.hsHighlighted = 'true';
      
      const titleEl = container.querySelector('[data-test-id="board-card-section-title-link"]');
      const title = titleEl ? titleEl.textContent.toLowerCase() : '';
      const cardText = container.textContent || '';
      
      let lastActivityDate = null;
      const lastActivityMatch = cardText.match(/last activity date[:\s]+(\d{1,2}\.\d{1,2}\.\d{4})/i) ||
                                cardText.match(/siste aktivitet[:\s]+(\d{1,2}\.\d{1,2}\.\d{4})/i);
      if (lastActivityMatch) {
        lastActivityDate = lastActivityMatch[1];
      }
      
      const propertyLabels = container.querySelectorAll('[data-test-id="cdbc-property-label"]');
      let hasOwner = false;
      let category = '';
      
      propertyLabels.forEach(label => {
        const labelText = label.textContent.toLowerCase();
        const valueEl = label.parentElement?.querySelector('[data-test-id="cdbc-property-value"]');
        const value = valueEl ? valueEl.textContent.trim() : '';
        
        if (labelText.includes('ticket owner') || labelText.includes('eier') || labelText.includes('owner')) {
          hasOwner = true;
        }
        
        if (labelText.includes('category') || labelText.includes('kategori')) {
          category = value.toLowerCase();
        }
        
        if (!lastActivityDate && (labelText.includes('last activity') || labelText.includes('siste aktivitet'))) {
          lastActivityDate = value;
        }
      });
      
      if (!hasOwner && (cardText.toLowerCase().includes('ticket owner:') || cardText.toLowerCase().includes('eier:'))) {
        hasOwner = true;
      }
      
      const daysSinceActivity = lastActivityDate ? getDaysSinceDate(lastActivityDate) : null;
      const isUnassigned = !hasOwner;

      let highlightType = null;
      if (CONFIG.urgentKeywords.some(kw => title.includes(kw.toLowerCase()))) {
        highlightType = 'urgent';
      } else if (category && CONFIG.categoryHighlights[category]) {
        highlightType = CONFIG.categoryHighlights[category];
      } else if (daysSinceActivity !== null) {
        highlightType = getAgeHighlightType(daysSinceActivity);
      }

      applyCardHighlight(card, highlightType, isUnassigned);
    });
  }

  function applyCardHighlight(card, type, isUnassigned) {
    card.classList.remove('hs-card-urgent', 'hs-card-fresh', 'hs-card-attention', 'hs-card-overdue', 'hs-card-unassigned');
    if (type) card.classList.add(`hs-card-${type}`);
    if (isUnassigned && CONFIG.highlightUnassigned) card.classList.add('hs-card-unassigned');
  }

  function highlightTableRows() {
    const tables = document.querySelectorAll('table');
    let mainTable = null;
    let maxRows = 0;
    
    tables.forEach(table => {
      if (table.closest('table') !== table.parentElement?.closest('table') && table.parentElement?.closest('table')) {
        return;
      }
      
      const rowCount = table.querySelectorAll('tbody > tr').length;
      if (rowCount > maxRows) {
        maxRows = rowCount;
        mainTable = table;
      }
    });
    
    if (!mainTable || maxRows < 2) {
      return;
    }
    
    const headerRow = mainTable.querySelector('thead > tr');
    if (!headerRow) return;
    
    const headers = headerRow.querySelectorAll('th');
    let dateColIndex = -1;

    headers.forEach((header, index) => {
      const text = header.textContent.toLowerCase().trim();
      if (text.includes('create date') || text.includes('opprettet')) {
        dateColIndex = index;
      } else if (dateColIndex === -1 && (text.includes('last activity') || text.includes('siste aktivitet') || text.includes('date'))) {
        dateColIndex = index;
      }
    });
    
    const rows = mainTable.querySelectorAll('tbody > tr');

    rows.forEach((row) => {
      if (row.dataset.hsHighlighted === 'true') return;

      const cells = row.querySelectorAll(':scope > td');
      if (cells.length < 3) return;
      if (row.querySelector('table')) return;

      row.dataset.hsHighlighted = 'true';
      const rowText = row.textContent.toLowerCase();
      
      if (CONFIG.urgentKeywords.some(keyword => rowText.includes(keyword.toLowerCase()))) {
        applyRowHighlight(row, 'urgent');
        return;
      }
      
      if (dateColIndex >= 0 && cells[dateColIndex]) {
        const dateText = cells[dateColIndex].textContent.trim();
        const daysSince = getDaysSinceDate(dateText);
        
        if (daysSince !== null) {
          applyRowHighlight(row, getAgeHighlightType(daysSince));
          return;
        }
      }
      
      for (let i = 0; i < cells.length; i++) {
        const cellText = cells[i].textContent.trim();
        if (cellText.includes('Today') || cellText.includes('Yesterday') || 
            cellText.includes('dag') || cellText.match(/\d{1,2}[.\s].*\d{4}/)) {
          const daysSince = getDaysSinceDate(cellText);
          if (daysSince !== null) {
            const highlightType = getAgeHighlightType(daysSince);
            applyRowHighlight(row, highlightType);
            return;
          }
        }
      }
    });
  }

  function applyRowHighlight(row, type) {
    row.classList.remove('hs-row-urgent', 'hs-row-fresh', 'hs-row-attention', 'hs-row-overdue');
    if (type) row.classList.add(`hs-row-${type}`);
  }

  function showActiveIndicator() {
    if (document.querySelector('.hs-highlighter-active')) return;
    const indicator = document.createElement('div');
    indicator.className = 'hs-highlighter-active';
    indicator.textContent = '🎨 Highlighter Active';
    document.body.appendChild(indicator);
    setTimeout(() => indicator.classList.add('visible'), 500);
    setTimeout(() => indicator.classList.remove('visible'), 3000);
  }

  let lastUrl = window.location.href;
  
  function checkUrlChange() {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      
      document.querySelectorAll('[data-hs-highlighted]').forEach(el => {
        delete el.dataset.hsHighlighted;
      });
      
      const indicator = document.querySelector('.hs-highlighter-active');
      if (indicator) indicator.remove();
      
      if (isTicketPage()) {
        setTimeout(highlightElements, 500);
      }
    }
  }

  let debounceTimer;
  const observer = new MutationObserver(() => {
    checkUrlChange();
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(highlightElements, 200);
  });

  function init() {
    highlightElements();
    setTimeout(highlightElements, 500);
    setTimeout(highlightElements, 1000);
    setTimeout(highlightElements, 2000);
    
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    setInterval(checkUrlChange, 1000);
  }

  if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.sync.get(['highlighterConfig'], (result) => {
      if (result.highlighterConfig) Object.assign(CONFIG, result.highlighterConfig);
      init();
    });
    chrome.storage.onChanged.addListener((changes) => {
      if (changes.highlighterConfig) {
        Object.assign(CONFIG, changes.highlighterConfig.newValue);
        document.querySelectorAll('[data-hs-highlighted]').forEach(el => delete el.dataset.hsHighlighted);
        highlightElements();
      }
    });
  } else {
    init();
  }

})();
