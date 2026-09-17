/**
 * PrivAI Local Session Mapping Vault
 * Manages zero-leakage token mapping, persistence, and local reconstruction.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PrivAiVault = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  class Vault {
    constructor(sessionId = 'default') {
      this.sessionId = sessionId;
      this.tokenToRaw = new Map(); // '[AADHAAR_1]' -> '2345 6789 0123'
      this.rawToToken = new Map(); // '2345 6789 0123' -> '[AADHAAR_1]'
      this.typeCounters = new Map(); // 'AADHAAR' -> 1
      this.createdAt = Date.now();
      this.loadFromStorage();
    }

    /**
     * Resets or switches session
     */
    setSession(sessionId) {
      this.sessionId = sessionId;
      this.clear();
      this.loadFromStorage();
    }

    /**
     * Retrieves existing token or creates a deterministic new token for the value
     */
    getOrRegisterToken(entityType, rawValue) {
      if (!rawValue) return '';
      const cleanType = String(entityType).toUpperCase().replace(/[^A-Z0-9_]/g, '');

      // Check if value already has an assigned token in this session
      if (this.rawToToken.has(rawValue)) {
        return this.rawToToken.get(rawValue);
      }

      // Next counter for this type
      const currentCount = (this.typeCounters.get(cleanType) || 0) + 1;
      this.typeCounters.set(cleanType, currentCount);

      const token = `[${cleanType}_${currentCount}]`;
      this.tokenToRaw.set(token, rawValue);
      this.rawToToken.set(rawValue, token);

      this.saveToStorage();
      return token;
    }

    /**
     * Reconstructs text replacing tokens with their original sensitive values
     */
    reconstruct(text) {
      if (!text || typeof text !== 'string') return text;
      let restored = text;
      const replacements = [];

      // Replace each known token
      for (const [token, rawValue] of this.tokenToRaw.entries()) {
        if (restored.includes(token)) {
          // Global token replacement
          restored = restored.split(token).join(rawValue);
          replacements.push({ token, rawValue });
        }
      }

      return {
        reconstructedText: restored,
        replacementsCount: replacements.length,
        replacements
      };
    }

    /**
     * Returns an array of current session mappings for dashboard inspection
     */
    getMappings() {
      const items = [];
      for (const [token, rawValue] of this.tokenToRaw.entries()) {
        items.push({
          token,
          rawValue,
          maskedPreview: this.maskPreview(rawValue)
        });
      }
      return items;
    }

    maskPreview(val) {
      if (!val || val.length <= 4) return '****';
      const visibleStart = Math.min(2, Math.floor(val.length / 4));
      const visibleEnd = Math.min(2, Math.floor(val.length / 4));
      const maskedPart = '*'.repeat(val.length - visibleStart - visibleEnd);
      return val.substring(0, visibleStart) + maskedPart + val.substring(val.length - visibleEnd);
    }

    clear() {
      this.tokenToRaw.clear();
      this.rawToToken.clear();
      this.typeCounters.clear();
      this.saveToStorage();
    }

    saveToStorage() {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        const payload = {
          [`privai_vault_${this.sessionId}`]: {
            tokenToRaw: Array.from(this.tokenToRaw.entries()),
            typeCounters: Array.from(this.typeCounters.entries()),
            updatedAt: Date.now()
          }
        };
        chrome.storage.local.set(payload).catch(() => {});
      }
    }

    loadFromStorage() {
      if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get([`privai_vault_${this.sessionId}`], (res) => {
          const data = res && res[`privai_vault_${this.sessionId}`];
          if (data && Array.isArray(data.tokenToRaw)) {
            // Re-populate maps
            this.tokenToRaw.clear();
            this.rawToToken.clear();
            for (const [token, raw] of data.tokenToRaw) {
              this.tokenToRaw.set(token, raw);
              this.rawToToken.set(raw, token);
            }
            if (Array.isArray(data.typeCounters)) {
              this.typeCounters = new Map(data.typeCounters);
            }
          }
        });
      }
    }
  }

  return {
    Vault
  };
});
