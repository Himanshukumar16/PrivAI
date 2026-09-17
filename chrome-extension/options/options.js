/**
 * PrivAI Security Center - Options & Sandbox Controller
 */
document.addEventListener('DOMContentLoaded', () => {
  // Navigation Tabs
  const navItems = document.querySelectorAll('.nav-item');
  const tabPanes = document.querySelectorAll('.tab-pane');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      const tabId = item.dataset.tab;
      navItems.forEach(n => n.classList.remove('active'));
      tabPanes.forEach(p => p.classList.remove('active'));

      item.classList.add('active');
      const targetPane = document.getElementById(tabId);
      if (targetPane) targetPane.classList.add('active');

      if (tabId === 'tab-vault') {
        refreshVaultTable();
      }
    });
  });

  // Engine & Vault Instances
  const engine = new window.PrivAiEngine.PiiEngine();
  const vault = new window.PrivAiVault.Vault('options_sandbox');

  // ==========================================
  // TAB 1: Live Interactive Test Bench
  // ==========================================
  const rawInput = document.getElementById('bench-raw-input');
  const sanitizedOutput = document.getElementById('bench-sanitized-output');
  const entitySummary = document.getElementById('bench-entity-summary');
  const reconstructedOutput = document.getElementById('bench-reconstructed-output');
  const unmaskSummary = document.getElementById('bench-unmask-summary');

  const btnSanitize = document.getElementById('btn-bench-sanitize');
  const btnSimulateAi = document.getElementById('btn-bench-simulate-ai');
  const btnUnmask = document.getElementById('btn-bench-unmask');

  const PRESETS = {
    kyc: "My name is Vikram Malhotra, Aadhaar number is 2345 6789 0123 and PAN is ABCDE1234F. My registered phone is +91 9876543210 and email is vikram.m@fintech.in. Please review my loan application.",
    dev: "Please debug this AWS Lambda function. Connecting with AWS access key AKIAIOSFODNN7EXAMPLE and OpenAI secret sk-abc1234567890abcdef123456789012. Also inspect the test JWT token eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.t-IDcSemACt8x4iTMC6Y9NrDhmtMWzkxmWwUOihqlFQ for user authentication.",
    corp: "The executive committee has approved the ProjectApollo acquisition under Confidential discussion. We will release QuarterlyEarnings next Tuesday to stakeholders."
  };

  // Preset Buttons
  document.querySelectorAll('.btn-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      const type = btn.dataset.preset;
      if (PRESETS[type]) {
        rawInput.value = PRESETS[type];
        btnSanitize.click();
      }
    });
  });

  // Step 1: Sanitize
  btnSanitize.addEventListener('click', () => {
    const text = rawInput.value;
    if (!text.trim()) {
      sanitizedOutput.innerHTML = '<span class="placeholder-text">Please enter a prompt first...</span>';
      return;
    }

    const startTime = performance.now();
    chrome.storage.local.get(['privai_keywords', 'privai_regex_list', 'privai_categories'], (res) => {
      const result = engine.sanitize(text, vault, {
        categories: res.privai_categories || window.PrivAiEngine.DEFAULT_CATEGORIES,
        customKeywords: res.privai_keywords || [],
        customRegexList: res.privai_regex_list || []
      });
      const duration = (performance.now() - startTime).toFixed(1);

      sanitizedOutput.innerText = result.sanitizedText;
      entitySummary.innerHTML = `<span>🛡️ <strong>${result.entities.length}</strong> sensitive items masked in <strong>${duration}ms</strong></span>`;

      // Auto-simulate AI response for instant wow factor
      simulateAiResponse(result.sanitizedText);
    });
  });

  // Step 2: Simulate AI Reply
  function simulateAiResponse(sanitizedText) {
    let reply = `Assistant: I have received your request. Here is the confirmation:\n`;
    const tokens = sanitizedText.match(/\[[A-Z0-9_]+_\d+\]/g) || [];

    if (tokens.length === 0) {
      reply += "No masked PII tokens were detected in your prompt. Processing query directly.";
    } else {
      reply += `Identified credentials: ${tokens.join(', ')}.\n` +
               `I have verified all accounts securely without seeing your original private information.`;
    }

    reconstructedOutput.innerText = reply;
    unmaskSummary.innerHTML = `<span>AI received zero raw PII. Ready to reconstruct locally.</span>`;
  }

  btnSimulateAi.addEventListener('click', () => {
    simulateAiResponse(sanitizedOutput.innerText);
  });

  // Step 3: Unmask Locally
  btnUnmask.addEventListener('click', () => {
    const currentReply = reconstructedOutput.innerText;
    if (!currentReply.trim() || currentReply.includes('Reconstructed answer with')) return;

    const restored = vault.reconstruct(currentReply);
    reconstructedOutput.innerText = restored.reconstructedText;
    unmaskSummary.innerHTML = `<span style="color: #34d399">✨ <strong>${restored.replacementsCount}</strong> tokens unmasked locally inside browser memory.</span>`;
  });

  // Load default preset on open
  rawInput.value = PRESETS.kyc;
  btnSanitize.click();

  // ==========================================
  // TAB 2: Custom Rules & Keywords
  // ==========================================
  const keywordsInput = document.getElementById('rules-keywords-input');
  const btnSaveKeywords = document.getElementById('btn-save-keywords');
  const keywordsSaveStatus = document.getElementById('keywords-save-status');

  const regexLabel = document.getElementById('regex-label');
  const regexPattern = document.getElementById('regex-pattern');
  const btnAddRegex = document.getElementById('btn-add-regex');
  const customRulesList = document.getElementById('custom-rules-list');

  // Load saved rules
  chrome.storage.local.get(['privai_keywords', 'privai_regex_list'], (res) => {
    if (res.privai_keywords) {
      keywordsInput.value = res.privai_keywords.join(', ');
    }
    renderRegexList(res.privai_regex_list || []);
  });

  // Save Keywords
  btnSaveKeywords.addEventListener('click', () => {
    const raw = keywordsInput.value;
    const keywords = raw.split(',').map(k => k.trim()).filter(Boolean);

    chrome.storage.local.set({ privai_keywords: keywords }, () => {
      keywordsSaveStatus.innerText = 'Saved!';
      setTimeout(() => { keywordsSaveStatus.innerText = ''; }, 2000);
    });
  });

  // Add Custom Regex Rule
  btnAddRegex.addEventListener('click', () => {
    const label = regexLabel.value.trim();
    const pattern = regexPattern.value.trim();

    if (!label || !pattern) {
      alert('Please provide both a label and a regular expression pattern.');
      return;
    }

    try {
      new RegExp(pattern); // Validate pattern syntax
    } catch (e) {
      alert('Invalid Regular Expression pattern: ' + e.message);
      return;
    }

    chrome.storage.local.get(['privai_regex_list'], (res) => {
      const list = res.privai_regex_list || [];
      list.push({ label, pattern, flags: 'g' });
      chrome.storage.local.set({ privai_regex_list: list }, () => {
        regexLabel.value = '';
        regexPattern.value = '';
        renderRegexList(list);
      });
    });
  });

  function renderRegexList(list) {
    if (!list || list.length === 0) {
      customRulesList.innerHTML = '<div style="color: #64748b; font-size: 13px;">No custom regex rules created yet.</div>';
      return;
    }

    customRulesList.innerHTML = list.map((rule, idx) => `
      <div class="rule-row">
        <div class="rule-info">
          <span class="rule-name">${escapeHtml(rule.label)}</span>
          <span class="rule-pat">${escapeHtml(rule.pattern)}</span>
        </div>
        <button type="button" class="btn-del-rule" data-index="${idx}">Delete</button>
      </div>
    `).join('');

    customRulesList.querySelectorAll('.btn-del-rule').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.index, 10);
        list.splice(idx, 1);
        chrome.storage.local.set({ privai_regex_list: list }, () => {
          renderRegexList(list);
        });
      });
    });
  }

  // ==========================================
  // TAB 3: Session Vault Inspector
  // ==========================================
  const vaultTableBody = document.getElementById('vault-table-body');
  const vaultCount = document.getElementById('vault-count');
  const btnClearVault = document.getElementById('btn-clear-vault');

  function refreshVaultTable() {
    const mappings = vault.getMappings();
    vaultCount.innerText = mappings.length;

    if (mappings.length === 0) {
      vaultTableBody.innerHTML = `
        <tr>
          <td colspan="4" class="empty-cell">No active session mappings in vault. Type in the sandbox or visit ChatGPT to populate.</td>
        </tr>
      `;
      return;
    }

    vaultTableBody.innerHTML = mappings.map(m => `
      <tr>
        <td><span class="vault-token-badge">${escapeHtml(m.token)}</span></td>
        <td style="font-family: monospace; color: #fcd34d;">${escapeHtml(m.maskedPreview)}</td>
        <td style="font-family: monospace; color: #cbd5e1;">${escapeHtml(m.rawValue)}</td>
        <td><span style="color: #34d399;">Active In Memory</span></td>
      </tr>
    `).join('');
  }

  btnClearVault.addEventListener('click', () => {
    vault.clear();
    refreshVaultTable();
  });

  // ==========================================
  // TAB 4: Spring Boot Backend Settings
  // ==========================================
  const backendUrlInput = document.getElementById('backend-url-input');
  const btnPingBackend = document.getElementById('btn-ping-backend');
  const pingIndicator = document.getElementById('backend-ping-indicator');
  const pingResult = document.getElementById('backend-ping-result');

  chrome.storage.local.get(['privai_backend_url'], (res) => {
    if (res.privai_backend_url) {
      backendUrlInput.value = res.privai_backend_url;
    }
  });

  btnPingBackend.addEventListener('click', () => {
    const url = backendUrlInput.value.trim().replace(/\/$/, '');
    chrome.storage.local.set({ privai_backend_url: url });

    pingIndicator.className = 'status-indicator';
    pingResult.innerText = 'Pinging ' + url + '/api/v1/health ...';

    const start = performance.now();
    fetch(`${url}/api/v1/health`, { method: 'GET' })
      .then(res => res.json())
      .then(data => {
        const ms = (performance.now() - start).toFixed(0);
        pingIndicator.className = 'status-indicator active';
        pingResult.innerHTML = `<span style="color: #34d399">Connected! Service: <strong>${data.service || 'PrivAI Microservice'}</strong> (Ping: ${ms}ms)</span>`;
      })
      .catch(err => {
        pingIndicator.className = 'status-indicator';
        pingResult.innerHTML = `<span style="color: #f87171">Offline or unreachable: ${err.message}. Ensure Spring Boot is running on port 8080.</span>`;
      });
  });

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, m => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m]));
  }
});
