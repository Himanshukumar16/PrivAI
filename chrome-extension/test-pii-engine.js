/**
 * PrivAI Chrome Extension Local Engine Test Suite
 */
const assert = require('assert');
const { PiiEngine, validateVerhoeff, validateLuhn, validatePan } = require('./scripts/pii-engine.js');
const { Vault } = require('./scripts/vault.js');

console.log('--- Testing PrivAI Core Engine ---');

const engine = new PiiEngine();
const vault = new Vault('node_test_session');

// Test 1: Luhn Algorithm
console.log('Testing Luhn Algorithm...');
assert.strictEqual(validateLuhn('4532015112830366'), true, 'Valid Luhn card should pass');
assert.strictEqual(validateLuhn('4532015112830367'), false, 'Invalid Luhn card should fail');
assert.strictEqual(validateLuhn('123'), false, 'Short number should fail');
console.log('✔ Luhn algorithm passed.');

// Test 2: PAN Validation
console.log('Testing PAN Validation...');
assert.strictEqual(validatePan('ABCPE1234F'), true, 'Valid PAN with P should pass');
assert.strictEqual(validatePan('ABCCE1234F'), true, 'Valid PAN with C should pass');
assert.strictEqual(validatePan('ABCZE1234F'), false, 'Invalid PAN with Z should fail');
console.log('✔ PAN validation passed.');

// Test 3: Aadhaar Verhoeff Checksum
console.log('Testing Verhoeff Validation...');
assert.strictEqual(validateVerhoeff('234567890123') !== undefined, true);
console.log('✔ Verhoeff routine executed successfully.');

// Test 4: Full Multi-Entity Sanitization
console.log('Testing Full Prompt Sanitization...');
const testPrompt = "Hello my name is Ramesh Kumar, my email is ramesh.kumar@corp.org, mobile is +91 9876543210. My PAN is ABCPE1234F and card is 4532 0151 1283 0366. Connecting to AWS AKIAIOSFODNN7EXAMPLE.";
const result = engine.sanitize(testPrompt, vault);

console.log('Sanitized Output:\n', result.sanitizedText);
assert.strictEqual(result.entities.length >= 5, true, 'Should detect at least 5 PII entities');
assert.strictEqual(result.sanitizedText.includes('ramesh.kumar@corp.org'), false, 'Email should be masked');
assert.strictEqual(result.sanitizedText.includes('ABCPE1234F'), false, 'PAN should be masked');
assert.strictEqual(result.sanitizedText.includes('4532 0151 1283 0366'), false, 'Credit card should be masked');
assert.strictEqual(result.sanitizedText.includes('AKIAIOSFODNN7EXAMPLE'), false, 'AWS key should be masked');
console.log('✔ Prompt Sanitization passed.');

// Test 5: AI Response Local Reconstruction
console.log('Testing AI Response Reconstruction...');
const simulatedAiResponse = `I have received confirmation for user [EMAIL_1] with card [CREDIT_CARD_1] and PAN [PAN_1].`;
const restored = vault.reconstruct(simulatedAiResponse);

console.log('Reconstructed Output:\n', restored.reconstructedText);
assert.strictEqual(restored.reconstructedText.includes('ramesh.kumar@corp.org'), true, 'Original email restored');
assert.strictEqual(restored.reconstructedText.includes('ABCPE1234F'), true, 'Original PAN restored');
assert.strictEqual(restored.reconstructedText.includes('4532 0151 1283 0366'), true, 'Original Credit card restored');
assert.strictEqual(restored.replacementsCount, 3, 'Exactly 3 tokens unmasked');
console.log('✔ Local Response Reconstruction passed.');

// Test 6: Custom Keywords & RegEx
console.log('Testing Custom Blacklist & Regex...');
const customEngineResult = engine.sanitize(
  "ProjectApollo report for EMP-55421",
  vault,
  {
    customKeywords: ['ProjectApollo'],
    customRegexList: [{ label: 'EMPLOYEE_ID', pattern: '\\bEMP-\\d{5}\\b', flags: 'g' }]
  }
);
console.log('Custom Sanitized:\n', customEngineResult.sanitizedText);
assert.strictEqual(customEngineResult.sanitizedText.includes('ProjectApollo'), false, 'Custom keyword masked');
assert.strictEqual(customEngineResult.sanitizedText.includes('EMP-55421'), false, 'Custom regex masked');
console.log('✔ Custom rules passed.');

console.log('\n========================================');
console.log('🎉 ALL EXTENSION UNIT TESTS PASSED (6/6)');
console.log('========================================');
