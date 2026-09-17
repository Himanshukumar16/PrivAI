/**
 * PrivAI Popup Controller
 */
document.addEventListener('DOMContentLoaded', () => {
  const masterSwitch = document.getElementById('master-switch');
  const statusDot = document.getElementById('status-dot');
  const statusTitle = document.getElementById('status-title');
  const statusSubtitle = document.getElementById('status-subtitle');

  const statEntities = document.getElementById('stat-entities');
  const statPrompts = document.getElementById('stat-prompts');

  const engineLocal = document.getElementById('engine-local');
  const engineBackend = document.getElementById('engine-backend');
  const backendStatusText = document.getElementById('backend-status-text');

  const openOptionsBtn = document.getElementById('open-options');

  const testInput = document.getElementById('test-input');
  const btnQuickSanitize = document.getElementById('btn-quick-sanitize');
  const btnQuickReconstruct = document.getElementById('btn-quick-reconstruct');
  const testResult = document.getElementById('test-result');

  const categoryIds = [
    'cat-aadhaar',
    'cat-creditCard',
    'cat-email',
    'cat-phone',
    'cat-secrets',
    'cat-customKeywords'
  ];

  const engine = new window.PrivAiEngine.PiiEngine();
  const vault = new window.PrivAiVault.Vault('popup_sandbox');

  // Load storage state
  chrome.storage.local.get([
    'privai_enabled',
    'privai_use_backend',
    'privai_backend_url',
    'privai_stats',
    'privai_categories'
  ], (res) => {
    const isEnabled = res.privai_enabled !== false;
    masterSwitch.checked = isEnabled;
    updateUIState(isEnabled);

    // Stats
    const stats = res.privai_stats || { totalEntitiesSanitized: 0, totalPromptsSanitized: 0 };
    statEntities.innerText = stats.totalEntitiesSanitized.toLocaleString();
    statPrompts.innerText = stats.totalPromptsSanitized.toLocaleString();

    // Engine Mode
    const useBackend = !!res.privai_use_backend;
    if (useBackend) {
      engineBackend.checked = true;
    } else {
      engineLocal.checked = true;
    }

    // Ping backend
    checkBackendHealth(res.privai_backend_url || 'http://localhost:8080');

    // Categories
    const categories = res.privai_categories || {};
    categoryIds.forEach(id => {
      const key = id.replace('cat-', '');
      const el = document.getElementById(id);
      if (el && categories[key] !== undefined) {
        el.checked = categories[key];
      }
    });
  });

  // Master Switch listener
  masterSwitch.addEventListener('change', () => {
    const isEnabled = masterSwitch.checked;
    chrome.storage.local.set({ privai_enabled: isEnabled });
    updateUIState(isEnabled);
  });

  function updateUIState(isEnabled) {
    if (isEnabled) {
      statusDot.className = 'status-indicator active';
      statusTitle.innerText = 'Real-time Shield Active';
      statusSubtitle.innerText = 'Sanitizing prompts for ChatGPT, Claude & Gemini';
    } else {
      statusDot.className = 'status-indicator';
      statusTitle.innerText = 'Shield Paused';
      statusSubtitle.innerText = 'No prompts are being intercepted';
    }
  }

  // Check Spring Boot status
  function checkBackendHealth(url) {
    fetch(`${url}/api/v1/health`, { method: 'GET' })
      .then(res => res.json())
      .then(data => {
        if (data.status === 'UP' || data.status === 'HEALTHY' || data.service) {
          backendStatusText.innerHTML = '<span style="color: #34d399">● Online (8080)</span>';
        } else {
          backendStatusText.innerHTML = '<span style="color: #f59e0b">● Ready</span>';
        }
      })
      .catch(() => {
        backendStatusText.innerHTML = '<span style="color: #94a3b8">Offline (Local Fallback)</span>';
      });
  }

  // Engine Mode Switch
  engineLocal.addEventListener('change', () => {
    if (engineLocal.checked) {
      chrome.storage.local.set({ privai_use_backend: false });
    }
  });

  engineBackend.addEventListener('change', () => {
    if (engineBackend.checked) {
      chrome.storage.local.set({ privai_use_backend: true });
    }
  });

  // Category Toggles
  categoryIds.forEach(id => {
    const el = document.getElementById(id);
    el.addEventListener('change', () => {
      chrome.storage.local.get(['privai_categories'], (res) => {
        const categories = res.privai_categories || { ...window.PrivAiEngine.DEFAULT_CATEGORIES };
        const key = id.replace('cat-', '');
        categories[key] = el.checked;
        chrome.storage.local.set({ privai_categories: categories });
      });
    });
  });

  // Quick Mini-Test Sandbox
  btnQuickSanitize.addEventListener('click', () => {
    const text = testInput.value;
    if (!text.trim()) return;

    const result = engine.sanitize(text, vault);
    testResult.classList.remove('hidden');
    testResult.innerText = result.sanitizedText;

    if (result.entities.length > 0) {
      // Temporarily bump visual stat
      statEntities.innerText = (parseInt(statEntities.innerText.replace(/,/g, ''), 10) + result.entities.length).toLocaleString();
    }
  });

  btnQuickReconstruct.addEventListener('click', () => {
    const currentResultText = testResult.innerText || testInput.value;
    if (!currentResultText.trim()) return;

    const restored = vault.reconstruct(currentResultText);
    testResult.classList.remove('hidden');
    testResult.innerText = restored.reconstructedText;
  });

  // Open Options Page
  openOptionsBtn.addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options/options.html'));
    }
  });
});
