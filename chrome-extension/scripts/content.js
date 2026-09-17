/**
 * PrivAI Content Script - DOM Interception, Shield Bar, & Response Unmasking
 */
(function () {
  'use strict';

  // Prevent duplicate script injection
  if (window.__PRIVAI_CONTENT_INITIALIZED__) return;
  window.__PRIVAI_CONTENT_INITIALIZED__ = true;

  const engine = new window.PrivAiEngine.PiiEngine();
  const vault = new window.PrivAiVault.Vault('web_session_' + window.location.hostname);

  let isProtectionEnabled = true;
  let autoSanitize = false;
  let useBackendEngine = false;
  let backendUrl = 'http://localhost:8080';
  let enabledCategories = { ...window.PrivAiEngine.DEFAULT_CATEGORIES };
  let customKeywords = [];
  let customRegexList = [];

  let currentTargetInput = null;
  let floatingBarEl = null;
  let debounceTimer = null;

  // Load preferences from storage
  function loadSettings() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get([
        'privai_enabled',
        'privai_auto_sanitize',
        'privai_use_backend',
        'privai_backend_url',
        'privai_categories',
        'privai_keywords',
        'privai_regex_list'
      ], (res) => {
        if (res.privai_enabled !== undefined) isProtectionEnabled = res.privai_enabled;
        if (res.privai_auto_sanitize !== undefined) autoSanitize = res.privai_auto_sanitize;
        if (res.privai_use_backend !== undefined) useBackendEngine = res.privai_use_backend;
        if (res.privai_backend_url) backendUrl = res.privai_backend_url;
        if (res.privai_categories) enabledCategories = res.privai_categories;
        if (res.privai_keywords) customKeywords = res.privai_keywords;
        if (res.privai_regex_list) customRegexList = res.privai_regex_list;
      });
    }
  }

  loadSettings();

  // Listen for setting changes from popup or options
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local') {
        if (changes.privai_enabled) isProtectionEnabled = changes.privai_enabled.newValue;
        if (changes.privai_auto_sanitize) autoSanitize = changes.privai_auto_sanitize.newValue;
        if (changes.privai_use_backend) useBackendEngine = changes.privai_use_backend.newValue;
        if (changes.privai_categories) enabledCategories = changes.privai_categories.newValue;
        if (changes.privai_keywords) customKeywords = changes.privai_keywords.newValue;
        if (changes.privai_regex_list) customRegexList = changes.privai_regex_list.newValue;
        if (currentTargetInput) handleInputChange(currentTargetInput);
      }
    });
  }

  // Create or retrieve floating shield bar
  function getOrCreateFloatingBar() {
    if (floatingBarEl) return floatingBarEl;

    floatingBarEl = document.createElement('div');
    floatingBarEl.id = 'privai-floating-bar';
    floatingBarEl.innerHTML = `
      <div class="privai-brand">
        <img class="privai-logo-img-floating" src="${typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL ? chrome.runtime.getURL('assets/icon16.png') : ''}" alt="PrivAI">
        PrivAI
      </div>
      <div class="privai-status" id="privai-bar-status">Secured</div>
      <div class="privai-pills" id="privai-bar-pills"></div>
      <button type="button" class="privai-btn privai-btn-sanitize" id="privai-bar-btn-sanitize">
        🛡️ Sanitize
      </button>
    `;

    document.body.appendChild(floatingBarEl);

    // Click handler for manual Sanitize button
    const sanitizeBtn = floatingBarEl.querySelector('#privai-bar-btn-sanitize');
    sanitizeBtn.addEventListener('mousedown', (e) => {
      e.preventDefault(); // Prevent input blur
      if (currentTargetInput) {
        performSanitization(currentTargetInput);
      }
    });

    return floatingBarEl;
  }

  // Position floating bar above current input
  function updateBarPosition(inputEl) {
    if (!floatingBarEl || !inputEl) return;
    const rect = inputEl.getBoundingClientRect();
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const scrollLeft = window.scrollX || document.documentElement.scrollLeft;

    let top = rect.top + scrollTop - 44;
    let left = rect.left + scrollLeft + 8;

    if (top < scrollTop + 10) {
      // Invert to bottom if not enough space on top
      top = rect.bottom + scrollTop + 8;
    }

    floatingBarEl.style.top = `${top}px`;
    floatingBarEl.style.left = `${left}px`;
  }

  // Extract raw text from any input or contenteditable element
  function getInputText(el) {
    if (!el) return '';
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      return el.value || '';
    }
    if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') {
      return el.innerText || el.textContent || '';
    }
    return '';
  }

  // Write sanitized text back to the input element with synthetic events
  function setInputText(el, newText) {
    if (!el) return;
    if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
      el.value = newText;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (el.isContentEditable || el.getAttribute('contenteditable') === 'true') {
      el.innerText = newText;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  // Core sanitization execution
  async function performSanitization(el) {
    const rawText = getInputText(el);
    if (!rawText.trim()) return;

    if (useBackendEngine) {
      try {
        const response = await fetch(`${backendUrl}/api/v1/sanitize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: rawText,
            sessionId: vault.sessionId
          })
        });
        if (response.ok) {
          const data = await response.json();
          setInputText(el, data.sanitizedText);
          showSanitizedSuccess(data.entities ? data.entities.length : 0);
          return;
        }
      } catch (err) {
        console.warn('[PrivAI] Spring Boot backend unavailable, falling back to local JS engine', err);
      }
    }

    // Local JS In-Browser Sanitization
    const result = engine.sanitize(rawText, vault, {
      categories: enabledCategories,
      customKeywords,
      customRegexList
    });

    if (result.sanitizedText !== rawText) {
      setInputText(el, result.sanitizedText);
      showSanitizedSuccess(result.entities.length);
      // Notify background for global stats
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({
          type: 'PRIVAI_STATS_RECORD',
          count: result.entities.length
        }).catch(() => {});
      }
    }
  }

  function showSanitizedSuccess(count) {
    const bar = getOrCreateFloatingBar();
    const statusEl = bar.querySelector('#privai-bar-status');
    const pillsEl = bar.querySelector('#privai-bar-pills');
    const btn = bar.querySelector('#privai-bar-btn-sanitize');

    statusEl.innerHTML = `<span style="color: #34d399; font-weight:600;">✨ ${count} Sanitized</span>`;
    pillsEl.innerHTML = '';
    btn.style.display = 'none';

    setTimeout(() => {
      if (currentTargetInput) {
        handleInputChange(currentTargetInput);
      }
    }, 2500);
  }

  // Handle typing & input evaluation
  function handleInputChange(el) {
    if (!isProtectionEnabled) {
      if (floatingBarEl) floatingBarEl.classList.remove('privai-visible');
      return;
    }

    const bar = getOrCreateFloatingBar();
    const statusEl = bar.querySelector('#privai-bar-status');
    const pillsEl = bar.querySelector('#privai-bar-pills');
    const btn = bar.querySelector('#privai-bar-btn-sanitize');

    const text = getInputText(el);
    if (!text || text.trim().length === 0) {
      statusEl.className = 'privai-status';
      statusEl.innerText = 'PrivAI Ready';
      pillsEl.innerHTML = '';
      btn.style.display = 'none';
      updateBarPosition(el);
      bar.classList.add('privai-visible');
      return;
    }

    const entities = engine.detect(text, {
      categories: enabledCategories,
      customKeywords,
      customRegexList
    });

    updateBarPosition(el);
    bar.classList.add('privai-visible');

    if (entities.length > 0) {
      statusEl.className = 'privai-status privai-has-pii';
      statusEl.innerHTML = `<span class="privai-badge-count">🛡️ ${entities.length} PII</span>`;

      // Unique detected entity categories for pills
      const uniqueTypes = [...new Set(entities.map(e => e.type))];
      pillsEl.innerHTML = uniqueTypes.map(t => `<span class="privai-pill">${t}</span>`).join('');
      btn.style.display = 'inline-flex';

      if (autoSanitize) {
        performSanitization(el);
      }
    } else {
      statusEl.className = 'privai-status';
      statusEl.innerText = 'Clean (No PII)';
      pillsEl.innerHTML = '';
      btn.style.display = 'none';
    }
  }

  // Global listeners for input detection
  document.addEventListener('focusin', (e) => {
    const target = e.target;
    if (
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'INPUT' ||
      target.isContentEditable ||
      (target.getAttribute && target.getAttribute('contenteditable') === 'true')
    ) {
      currentTargetInput = target;
      handleInputChange(target);
    }
  }, true);

  document.addEventListener('input', (e) => {
    const target = e.target;
    if (target === currentTargetInput) {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => handleInputChange(target), 150);
    }
  }, true);

  document.addEventListener('click', (e) => {
    if (floatingBarEl && !floatingBarEl.contains(e.target) && e.target !== currentTargetInput) {
      // Delay hiding slightly
      setTimeout(() => {
        if (document.activeElement !== currentTargetInput && floatingBarEl) {
          floatingBarEl.classList.remove('privai-visible');
        }
      }, 300);
    }
  });

  // Reposition on scroll/resize
  window.addEventListener('resize', () => {
    if (currentTargetInput) updateBarPosition(currentTargetInput);
  });
  window.addEventListener('scroll', () => {
    if (currentTargetInput) updateBarPosition(currentTargetInput);
  }, true);

  // Intercept Enter key submit on chat platforms to sanitize if PII exists
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && currentTargetInput && isProtectionEnabled) {
      const text = getInputText(currentTargetInput);
      const entities = engine.detect(text, {
        categories: enabledCategories,
        customKeywords,
        customRegexList
      });
      if (entities.length > 0) {
        // Automatically sanitize before submission
        performSanitization(currentTargetInput);
      }
    }
  }, true);

  // ==========================================
  // AI Response Observer & Unmasker
  // ==========================================
  function scanAndInjectUnmaskButtons() {
    // Selectors covering ChatGPT, Claude, and Gemini response containers
    const responseSelectors = [
      '[data-message-author-role="assistant"]',
      '.font-claude-message',
      '.model-response-text',
      '.markdown',
      'model-response',
      '.chat-response-content'
    ];

    const elements = document.querySelectorAll(responseSelectors.join(','));
    elements.forEach(node => {
      if (node.dataset.privaiScanned) return;

      const text = node.innerText || '';
      // Check if text contains any vault tokens like [AADHAAR_1], [PAN_1], etc.
      const tokenPattern = /\[[A-Z0-9_]+_\d+\]/g;
      const matches = text.match(tokenPattern);

      if (matches && matches.length > 0) {
        node.dataset.privaiScanned = 'true';
        node.dataset.privaiOriginal = text;

        const unmaskBar = document.createElement('div');
        unmaskBar.className = 'privai-unmask-container';
        unmaskBar.innerHTML = `
          <span class="privai-unmask-tag">🛡️ PrivAI Protected</span>
          <span>Found ${matches.length} masked tokens</span>
          <button type="button" class="privai-unmask-btn">🔓 Unmask Locally</button>
        `;

        const btn = unmaskBar.querySelector('.privai-unmask-btn');
        let isUnmasked = false;

        btn.addEventListener('click', () => {
          if (!isUnmasked) {
            const reconstructed = vault.reconstruct(node.innerText);
            node.innerText = reconstructed.reconstructedText;
            btn.innerText = '🔒 Re-mask';
            isUnmasked = true;
          } else {
            node.innerText = node.dataset.privaiOriginal;
            btn.innerText = '🔓 Unmask Locally';
            isUnmasked = false;
          }
        });

        node.prepend(unmaskBar);
      }
    });
  }

  // Observe dynamically streamed AI answers
  const observer = new MutationObserver(() => {
    scanAndInjectUnmaskButtons();
  });
  observer.observe(document.body, { childList: true, subtree: true });

})();
