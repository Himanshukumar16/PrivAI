/**
 * PrivAI Core PII Detection & Anonymization Engine
 * Zero external dependencies. Works in browsers (MV3) and Node.js.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PrivAiEngine = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Verhoeff multiplication and permutation tables for Aadhaar validation
  const verhoeffD = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
    [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
    [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
    [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
    [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
    [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
    [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
    [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
    [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
  ];

  const verhoeffP = [
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
    [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
    [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
    [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
    [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
    [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
    [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
  ];

  const verhoeffInv = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

  function validateVerhoeff(numStr) {
    const clean = String(numStr).replace(/\D/g, '');
    if (clean.length !== 12) return false;
    let c = 0;
    const reversed = clean.split('').reverse().map(Number);
    for (let i = 0; i < reversed.length; i++) {
      c = verhoeffD[c][verhoeffP[i % 8][reversed[i]]];
    }
    return c === 0;
  }

  function validateLuhn(ccStr) {
    const clean = String(ccStr).replace(/\D/g, '');
    if (clean.length < 13 || clean.length > 19) return false;
    let sum = 0;
    let shouldDouble = false;
    for (let i = clean.length - 1; i >= 0; i--) {
      let digit = parseInt(clean.charAt(i), 10);
      if (shouldDouble) {
        digit *= 2;
        if (digit > 9) digit -= 9;
      }
      sum += digit;
      shouldDouble = !shouldDouble;
    }
    return sum % 10 === 0;
  }

  function validatePan(panStr) {
    const clean = String(panStr).trim().toUpperCase();
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(clean)) return false;
    const valid4th = ['P', 'C', 'H', 'F', 'A', 'T', 'B', 'L', 'J', 'G'];
    return valid4th.includes(clean[3]);
  }

  const DEFAULT_CATEGORIES = {
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
  };

  class PiiEngine {
    constructor() {
      this.categories = { ...DEFAULT_CATEGORIES };
    }

    setCategories(categories) {
      this.categories = { ...this.categories, ...categories };
    }

    /**
     * Finds all sensitive entities in the provided text.
     * Returns an array of entity objects sorted by start position.
     */
    detect(text, customOptions = {}) {
      if (!text || typeof text !== 'string') return [];

      const categories = { ...this.categories, ...(customOptions.categories || {}) };
      const customKeywords = customOptions.customKeywords || [];
      const customRegexList = customOptions.customRegexList || [];
      const entities = [];

      // Helper to add entity avoiding duplicates or overlaps
      function addEntity(type, rawValue, start, end, score = 1.0, metadata = {}) {
        if (!rawValue || start < 0 || end <= start) return;
        // Check overlap with existing entities
        const overlaps = entities.some(e => !(end <= e.start || start >= e.end));
        if (!overlaps) {
          entities.push({
            type,
            value: rawValue,
            start,
            end,
            score,
            metadata
          });
        }
      }

      // 1. Secrets, API Keys & JWT (High Priority)
      if (categories.secrets) {
        // JWT
        const jwtRegex = /\beyJ[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*\b/g;
        let match;
        while ((match = jwtRegex.exec(text)) !== null) {
          addEntity('JWT_TOKEN', match[0], match.index, match.index + match[0].length, 0.99);
        }

        // Standard API Keys (OpenAI, AWS, GitHub, Google)
        const apiKeyRegex = /\b(?:sk-[a-zA-Z0-9]{20,}|AKIA[0-9A-Z]{16}|ghp_[a-zA-Z0-9]{36}|AIza[0-9A-Za-z-_]{35}|[0-9a-f]{32,64})\b/g;
        while ((match = apiKeyRegex.exec(text)) !== null) {
          if (!/^\d+$/.test(match[0])) {
            addEntity('API_KEY', match[0], match.index, match.index + match[0].length, 0.95);
          }
        }
      }

      // 2. Email Addresses
      if (categories.email) {
        const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;
        let match;
        while ((match = emailRegex.exec(text)) !== null) {
          addEntity('EMAIL', match[0], match.index, match.index + match[0].length, 0.99);
        }
      }

      // 3. Credit / Debit Cards (with Luhn algorithm - Evaluated before Aadhaar)
      if (categories.creditCard) {
        // Matches 13 to 19 digit strings formatted with spaces or dashes
        const ccRegex = /\b(?:\d{4}[-\s]?){3}\d{4}\b|\b\d{13,19}\b/g;
        let match;
        while ((match = ccRegex.exec(text)) !== null) {
          const raw = match[0];
          if (validateLuhn(raw)) {
            addEntity('CREDIT_CARD', raw, match.index, match.index + match[0].length, 1.0, {
              validLuhn: true
            });
          }
        }
      }

      // 4. Indian Aadhaar Card (12 digits, must not be followed by additional digits)
      if (categories.aadhaar) {
        const aadhaarRegex = /\b[2-9]\d{3}[\s\-]?[0-9]{4}[\s\-]?[0-9]{4}(?![\s\-]?\d)\b/g;
        let match;
        while ((match = aadhaarRegex.exec(text)) !== null) {
          const raw = match[0];
          const isValidChecksum = validateVerhoeff(raw);
          addEntity('AADHAAR', raw, match.index, match.index + raw.length, isValidChecksum ? 1.0 : 0.85, {
            validChecksum: isValidChecksum
          });
        }
      }

      // 5. Indian PAN Card
      if (categories.pan) {
        const panRegex = /\b[A-Z]{5}[0-9]{4}[A-Z]\b/g;
        let match;
        while ((match = panRegex.exec(text)) !== null) {
          const raw = match[0];
          const isValidStructure = validatePan(raw);
          addEntity('PAN', raw, match.index, match.index + raw.length, isValidStructure ? 1.0 : 0.88, {
            validPanFormat: isValidStructure
          });
        }
      }

      // 6. Passport (Indian & Global format: 1 letter + 7-8 digits)
      if (categories.passport) {
        const passportRegex = /\b[A-PR-WYa-pr-wy][1-9]\d\s?\d{4}[1-9]\b/g;
        let match;
        while ((match = passportRegex.exec(text)) !== null) {
          addEntity('PASSPORT', match[0], match.index, match.index + match[0].length, 0.90);
        }
      }

      // 7. Bank Information: IFSC & UPI ID
      if (categories.bankInfo) {
        // IFSC Code: 4 uppercase letters, 0, 6 alphanumeric
        const ifscRegex = /\b[A-Z]{4}0[A-Z0-9]{6}\b/g;
        let match;
        while ((match = ifscRegex.exec(text)) !== null) {
          addEntity('IFSC_CODE', match[0], match.index, match.index + match[0].length, 0.95);
        }

        // UPI ID: username@bank
        const upiRegex = /\b[a-zA-Z0-9.\-_]{2,256}@(okhdfcbank|okaxis|oksbi|okicici|paytm|ybl|apl|upi)\b/gi;
        while ((match = upiRegex.exec(text)) !== null) {
          addEntity('UPI_ID', match[0], match.index, match.index + match[0].length, 0.98);
        }
      }

      // 8. Phone Numbers (Indian + Global)
      if (categories.phone) {
        // Indian mobile: +91 9876543210 or 98765 43210
        const indianPhoneRegex = /(?:\+91[\-\s]?)?[6-9]\d{4}[\-\s]?\d{5}\b/g;
        let match;
        while ((match = indianPhoneRegex.exec(text)) !== null) {
          addEntity('PHONE', match[0], match.index, match.index + match[0].length, 0.92);
        }

        // International / US Phone numbers
        const globalPhoneRegex = /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;
        while ((match = globalPhoneRegex.exec(text)) !== null) {
          const digitsOnly = match[0].replace(/\D/g, '');
          if (digitsOnly.length >= 10 && digitsOnly.length <= 15) {
            addEntity('PHONE', match[0], match.index, match.index + match[0].length, 0.88);
          }
        }
      }

      // 9. Person Names (Contextual detection)
      if (categories.personNames) {
        const nameContextRegex = /(?:my name is|i am|this is|contact|mr\.|ms\.|mrs\.|dr\.)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\b/gi;
        let match;
        while ((match = nameContextRegex.exec(text)) !== null) {
          if (match[1] && match[1].length > 2) {
            const nameStart = match.index + match[0].indexOf(match[1]);
            addEntity('PERSON', match[1], nameStart, nameStart + match[1].length, 0.82);
          }
        }
      }

      // 10. Custom Keywords Blacklist
      if (categories.customKeywords && Array.isArray(customKeywords)) {
        for (const kw of customKeywords) {
          if (!kw || typeof kw !== 'string' || !kw.trim()) continue;
          const escaped = kw.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const kwRegex = new RegExp(`\\b${escaped}\\b`, 'gi');
          let match;
          while ((match = kwRegex.exec(text)) !== null) {
            addEntity('CONFIDENTIAL', match[0], match.index, match.index + match[0].length, 1.0);
          }
        }
      }

      // 11. Custom Regex Rules
      if (Array.isArray(customRegexList)) {
        for (const rule of customRegexList) {
          if (!rule || !rule.pattern || !rule.label) continue;
          try {
            const flags = rule.flags || 'g';
            const rx = new RegExp(rule.pattern, flags);
            let match;
            while ((match = rx.exec(text)) !== null) {
              const matchedStr = match[0];
              if (matchedStr) {
                addEntity(rule.label.toUpperCase().replace(/\s+/g, '_'), matchedStr, match.index, match.index + matchedStr.length, 0.95);
              }
            }
          } catch (e) {
            console.warn('[PrivAI] Invalid custom regex:', rule.pattern, e);
          }
        }
      }

      // Sort entities by start index
      entities.sort((a, b) => a.start - b.start);
      return entities;
    }

    /**
     * Sanitizes input text by replacing detected entities with vault tokens.
     * Returns { sanitizedText, entities, tokenMap }
     */
    sanitize(text, vault, customOptions = {}) {
      const entities = this.detect(text, customOptions);
      if (!entities || entities.length === 0) {
        return {
          sanitizedText: text,
          entities: [],
          tokenMap: {}
        };
      }

      let result = '';
      let lastIndex = 0;
      const tokenMap = {};

      for (const entity of entities) {
        // Append text before entity
        result += text.slice(lastIndex, entity.start);

        // Get or generate token from vault
        let token;
        if (vault && typeof vault.getOrRegisterToken === 'function') {
          token = vault.getOrRegisterToken(entity.type, entity.value);
        } else {
          // Standalone fallback token
          token = `[${entity.type}_MASKED]`;
        }

        tokenMap[token] = entity.value;
        result += token;
        lastIndex = entity.end;
      }

      // Append remainder of text
      result += text.slice(lastIndex);

      return {
        sanitizedText: result,
        entities,
        tokenMap
      };
    }
  }

  return {
    PiiEngine,
    validateVerhoeff,
    validateLuhn,
    validatePan,
    DEFAULT_CATEGORIES
  };
});
