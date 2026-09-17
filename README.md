<p align="center">
  <img src="assets/logo.png" width="180" alt="PrivAI Logo"/>
</p>

<h1 align="center">PrivAI: Privacy Middleware for AI</h1>

<p align="center">
  <strong>Zero-Trust Privacy Middleware & Anonymization Engine</strong> designed to sanitize user prompts before sending them to external AI services (ChatGPT, Claude, Gemini) and reconstruct AI responses locally without leaking PII or sensitive corporate data.
</p>

---

## Architecture Overview

```
 ┌─────────────────────────────────────────────────────────────────────────┐
 │                           USER ENVIRONMENT                              │
 │                                                                         │
 │  ┌───────────────────────────────────────────────────────────────────┐  │
 │  │                     Chrome Web Browser (Manifest V3)              │  │
 │  │                                                                   │  │
 │  │  ┌──────────────────┐  ┌────────────────────┐  ┌───────────────┐  │  │
 │  │  │ Popup Dashboard  │  │ Options / Settings │  │ Injected UI   │  │  │
 │  │  │ (Stats, Rules)   │  │ (Custom RegEx, Test│  │ (Shield Bar,  │  │  │
 │  │  │                  │  │  Bench Sandbox)    │  │ Entity Badge) │  │  │
 │  │  └────────┬─────────┘  └─────────┬──────────┘  └───────┬───────┘  │  │
 │  │           │                      │                     │          │  │
 │  │  ┌────────┴──────────────────────┴─────────────────────┴───────┐  │  │
 │  │  │           Content Script & Background Service Worker        │  │  │
 │  │  │   - DOM Input Interceptor (ChatGPT, Claude, Gemini)         │  │  │
 │  │  │   - In-Browser PII Regex Engine & Anonymizer                │  │  │
 │  │  │   - Local Session Mapping Vault (Encrypted Storage)         │  │  │
 │  │  │   - Response Unmasker & Reconstructor                       │  │  │
 │  │  └───────────────────────────────┬─────────────────────────────┘  │  │
 │  └──────────────────────────────────┼────────────────────────────────┘  │
 │                                     │ (Optional REST Sync: localhost:8080)
 │  ┌──────────────────────────────────▼────────────────────────────────┐  │
 │  │           Local Spring Boot Privacy Microservice (Java 17+)       │  │
 │  │   - Enterprise PII & Contextual Detection Engine                   │  │
 │  │   - Advanced NER / Aadhaar / PAN / Financial Validation Engine    │  │
 │  │   - REST API: /api/v1/sanitize, /api/v1/reconstruct, /rules       │  │
 │  └───────────────────────────────────────────────────────────────────┘  │
 └─────────────────────────────────────────────────────────────────────────┘
                                       │
                      Sanitized Prompt (Only Placeholders)
                      e.g., "Email [PERSON_1] regarding [AADHAAR_1]"
                                       │
                                       ▼
 ┌─────────────────────────────────────────────────────────────────────────┐
 │                          EXTERNAL AI MODEL                              │
 │                   (ChatGPT / Claude / Gemini APIs)                      │
 └─────────────────────────────────────────────────────────────────────────┘
```

---

## Modules

### 1. `chrome-extension/` (Manifest V3)
- **100% In-Browser Zero-Trust**: Runs locally in Chrome without sending any data anywhere.
- **Auto DOM Interception**: Detects active inputs on `chatgpt.com`, `claude.ai`, and `gemini.google.com`.
- **Floating Shield Bar**: Injects a dark-mode glassmorphic floating toolbar over input boxes with live PII counters, detected entity badges, and one-click "Sanitize" triggers.
- **AI Response Unmasker**: Adds an inline **"🔓 PrivAI: Unmask Locally"** button onto incoming AI responses, restoring original context inside the browser without remote leaks.
- **Popup Dashboard**: Real-time stats, engine mode switch, and quick category toggles.
- **Interactive Security Center (Options)**: 3-column Live Test Bench Sandbox, custom blacklist manager, custom regex builder, and session vault inspector.

### 2. `springboot-backend/` (Java 17+ / Spring Boot 3)
- **Local Microservice**: Binds strictly to `127.0.0.1:8080`.
- **Endpoints**:
  - `GET /api/v1/health`: Heartbeat connectivity check.
  - `POST /api/v1/sanitize`: Prompt masking endpoint.
  - `POST /api/v1/reconstruct`: AI answer unmasking endpoint.
  - `GET /api/v1/rules`: Active rule catalog.
- **Algorithms**: Verhoeff checksum validation for Aadhaar numbers, Luhn algorithm for credit card numbers, and structured PAN format verification.

---

## Supported PII & Sensitive Entity Types

| Entity Category | Formats & Detection Techniques | Sample Masked Token |
|-----------------|-------------------------------|---------------------|
| **Indian Aadhaar** | 12-digit format with Verhoeff Checksum (`\b[2-9]\d{3}[\s\-]?\d{4}[\s\-]?\d{4}\b`) | `[AADHAAR_1]` |
| **Indian PAN** | 10-char Tax ID with status validation (`[A-Z]{5}[0-9]{4}[A-Z]`) | `[PAN_1]` |
| **Passport** | Indian & International alphanumeric standard | `[PASSPORT_1]` |
| **Credit / Debit Cards** | 13 to 19 digits validated with **Luhn Checksum Algorithm** | `[CREDIT_CARD_1]` |
| **Bank IFSC & UPI** | Bank IFSC codes (`[A-Z]{4}0[A-Z0-9]{6}`) and UPI handles (`user@okhdfcbank`) | `[IFSC_CODE_1]`, `[UPI_ID_1]` |
| **Email Addresses** | Standard RFC-compliant email regex | `[EMAIL_1]` |
| **Phone Numbers** | Indian mobile (`+91 9876543210`) & Global ITU E.164 formats | `[PHONE_1]` |
| **Developer Secrets** | OpenAI (`sk-...`), AWS (`AKIA...`), GitHub (`ghp_...`), JWT tokens | `[API_KEY_1]`, `[JWT_TOKEN_1]` |
| **Corporate Confidential** | Custom keywords blacklist & customizable RegEx rules | `[CONFIDENTIAL_1]` |

---

## Getting Started

### Load Chrome Extension in Browser
1. Open Google Chrome and navigate to `chrome://extensions`.
2. Enable **Developer mode** (toggle in top-right corner).
3. Click **Load unpacked**.
4. Select the folder: `c:\Users\dell\Desktop\PrivAI\chrome-extension`.
5. The PrivAI shield icon will appear in your Chrome toolbar!
6. Click the extension icon to view the dashboard or right-click to open **Options** to access the **Interactive Privacy Test Bench**.

### Run Spring Boot Local Backend (Optional)
The extension works standalone out-of-the-box. To enable enterprise microservice mode:
```powershell
cd c:\Users\dell\Desktop\PrivAI\springboot-backend
mvn spring-boot:run
```
Once running on `http://localhost:8080`, switch the engine mode to **Spring Boot API** in the extension popup.

---

## Testing & Verification

### Chrome Extension Unit Tests
```powershell
cd c:\Users\dell\Desktop\PrivAI\chrome-extension
node test-pii-engine.js
```

### Spring Boot Backend Tests
```powershell
cd c:\Users\dell\Desktop\PrivAI\springboot-backend
mvn test
```
#   P r i v A I  
 