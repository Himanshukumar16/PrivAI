/**
 * PrivAI Service Worker (Manifest V3 Background)
 */

const DEFAULT_SETTINGS = {
  privai_enabled: true,
  privai_auto_sanitize: false,
  privai_use_backend: false,
  privai_backend_url: 'http://localhost:8080',
  privai_stats: {
    totalEntitiesSanitized: 0,
    totalPromptsSanitized: 0
  },
  privai_categories: {
    aadhaar: true,
    pan: true,
    passport: true,
    creditCard: true,
    bankInfo: true,
    email: true,
    phone: true,
    secrets: true,
    personNames: true,
    customKeywords: true
  },
  privai_keywords: [
    'Confidential',
    'SecretProject',
    'Acquisition',
    'QuarterlyEarnings'
  ],
  privai_regex_list: [
    { label: 'Employee ID', pattern: '\\bEMP-[0-9]{4,6}\\b', flags: 'g' }
  ]
};

// Initialize settings on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.get(null, (existing) => {
    const toSet = {};
    for (const [key, defaultVal] of Object.entries(DEFAULT_SETTINGS)) {
      if (existing[key] === undefined) {
        toSet[key] = defaultVal;
      }
    }
    if (Object.keys(toSet).length > 0) {
      chrome.storage.local.set(toSet);
    }
  });

  updateBadge(true);

  // Setup context menu
  if (chrome.contextMenus) {
    chrome.contextMenus.create({
      id: 'privai-sanitize-selection',
      title: 'PrivAI: Sanitize Selection',
      contexts: ['selection', 'editable']
    });
  }
});

// Update extension icon badge
function updateBadge(isEnabled, count = null) {
  if (!isEnabled) {
    chrome.action.setBadgeText({ text: 'OFF' });
    chrome.action.setBadgeBackgroundColor({ color: '#64748b' });
  } else if (count !== null && count > 0) {
    chrome.action.setBadgeText({ text: String(count) });
    chrome.action.setBadgeBackgroundColor({ color: '#f59e0b' });
  } else {
    chrome.action.setBadgeText({ text: 'ON' });
    chrome.action.setBadgeBackgroundColor({ color: '#6366f1' });
  }
}

// Listen for storage changes to update badge
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.privai_enabled) {
    updateBadge(changes.privai_enabled.newValue);
  }
});

// Handle incoming messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PRIVAI_STATS_RECORD') {
    chrome.storage.local.get(['privai_stats'], (res) => {
      const stats = res.privai_stats || { totalEntitiesSanitized: 0, totalPromptsSanitized: 0 };
      stats.totalEntitiesSanitized += (message.count || 1);
      stats.totalPromptsSanitized += 1;
      chrome.storage.local.set({ privai_stats: stats });
    });
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'PRIVAI_CHECK_BACKEND') {
    const backendUrl = message.url || 'http://localhost:8080';
    fetch(`${backendUrl}/api/v1/health`, { method: 'GET' })
      .then(res => res.json())
      .then(data => sendResponse({ online: true, data }))
      .catch(err => sendResponse({ online: false, error: err.message }));
    return true; // Keep channel open for async response
  }
});
