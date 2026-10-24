# Onceover — Accessibility First-Look Tool

An accessibility first-look tool designed specifically for small business owners, providing rapid, understandable, and actionable accessibility assessments of HTML snippets or pages using the Clew Labs design system.

---

## User Review & Critical Decisions

> [!IMPORTANT]
> The proposed 10-file structure is confirmed exactly as specified, adhering strictly to the one-responsibility-per-file constraint with zero extraneous features:
> 1. `index.html` — UI shell (gate notice, acknowledgement checkbox, input textarea, buttons, status banner, results container, cannot-see panel)
> 2. `style.css` — Clew Labs design system (navy `#0A1F2E`, text `#E8E0CC`, accents `#1FB5B7`, focus 2px `#E85A1F`, parchment cards `#F1E8D2`, fonts Cinzel / Source Serif 4 / JetBrains Mono)
> 3. `mapping.json` — 6 WCAG 2.2 criteria mappings with plain URL strings
> 4. `sanitize.js` — Strips `<script>` tags and inline `on*` event handlers
> 5. `scanner.js` — Sandboxed `<iframe>`, injects axe-core 4.14.0 CDN, runs axe tests
> 6. `customChecks.js` — Deterministic vague-link-text check ("click here", "here", "read more", "more")
> 7. `geminiClient.js` — Server-side API call passing ONLY metadata, plus client-side banned-word filter
> 8. `render.js` — Renders cards and banners strictly via `textContent`, never `innerHTML`
> 9. `main.js` — Wires gate checkbox, validation, sample fetch, and execution flow
> 10. `sample-bakery.html` — Empty placeholder file
>
> In addition, a lightweight `server.ts` Express entry point will proxy `/api/explain` to invoke `@google/genai` on the server (passing only violation metadata and no user PII/DOM scripts), preserving strict runtime constraints and security rules.

---

## 1. Overview & Core Concept

- **What It Does**: Onceover provides an initial automated and deterministic accessibility inspection of HTML snippets or sample websites. Small business owners can paste HTML or load a sample bakery template to identify common accessibility pitfalls (contrast, alt text, form labels, headings, vague link text).
- **Target Audience**: Small business owners who need plain-English, non-punitive explanations of web accessibility requirements.
- **Key Value**: Immediate, secure client-side scanning via axe-core 4.14.0 within a sandboxed frame, combined with plain-language, small-business-oriented guidance for detected WCAG 2.2 violations.

---

## 2. User Experience & Visual Design

- **Gate Notice & Acknowledgement**:
  - Displays clear upfront disclosure that automated scanning cannot detect all accessibility barriers (the "cannot-see panel").
  - An explicit acknowledgement checkbox gates the scan action until accepted.
- **Input & Action Controls**:
  - Clean HTML paste area (`textarea`) with character count and clear/reset actions.
  - "Load Sample Bakery" button to populate sample markup for demonstration.
  - Primary "Run Onceover" button, active only after acknowledgement.
- **Status Banner & Progress**:
  - Distinct status banner with states: *Idle*, *Sanitizing*, *Scanning*, *Interpreting*, *Complete*, and *Error*.
- **Results Container**:
  - Cards styled in Clew Labs parchment (`#F1E8D2`) with navy text (`#0A1F2E`) on the dark navy backdrop (`#0A1F2E`).
  - Summarizes violations categorized by severity and WCAG 2.2 criteria.
  - Strictly rendered via `textContent` / `createElement` — no `innerHTML` usage.
- **Visual Palette & Typography**:
  - **Background**: Deep Navy (`#0A1F2E`)
  - **Text / Foreground**: Warm Sand / Cream (`#E8E0CC`)
  - **Parchment Cards**: Off-white Warm Parchment (`#F1E8D2`) with dark ink text
  - **Accents**: Muted Teal (`#1FB5B7`)
  - **Focus Ring**: High-visibility Orange (`2px solid #E85A1F`)
  - **Typography**: Cinzel for headlines, Source Serif 4 for body text, JetBrains Mono for code snippets and selectors.

---

## 3. Key Product Decisions & Trade-Offs

- **Single-Responsibility Architecture**:
  - Each module is isolated into its own file with a single exported function or object.
  - Zero intermingling of parsing, scanning, rendering, and API communication.
- **Deterministic Vague-Link Detection**:
  - Checked separately via `customChecks.js` for exact matches ("click here", "here", "read more", "more", case-insensitive) to ensure consistent and immediate feedback.
- **Privacy & Security First**:
  - `sanitize.js` aggressively purges `<script>` elements and all `on*` event attributes before injecting into the scanner frame.
  - Sandboxed `<iframe>` prevents DOM breakout.
  - `geminiClient.js` sends only structured issue metadata (WCAG rule, element tag, reason code) to the server — raw user HTML/scripts are never transmitted.
  - Client-side banned-word filter rejects any non-compliant responses before rendering.
- **XSS-Immune Rendering**:
  - `render.js` relies entirely on DOM methods (`document.createElement`, `element.textContent`, `element.setAttribute`) to prevent any injection vector.

---

## 4. Technical Architecture & Data Strategy

```
┌─────────────────────────────────────────────────────────────┐
│                         index.html                          │
│  ┌───────────────────────┐       ┌───────────────────────┐  │
│  │     Gate Notice       │       │   Cannot-See Panel    │  │
│  │ [x] Acknowledgement   │       │ (What auto-scans miss)│  │
│  └───────────┬───────────┘       └───────────────────────┘  │
│              ▼                                              │
│  ┌───────────────────────┐       ┌───────────────────────┐  │
│  │    HTML Input Area    │──────▶│   Status Banner       │  │
│  │ (Paste or Load Sample)│       └───────────────────────┘  │
│  └───────────┬───────────┘                                  │
└──────────────┼──────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│                          main.js                            │
│  Controls execution flow & coordinates workers / modules    │
│                                                             │
│  1. sanitize.js      ──▶ Strips <script> & on* handlers     │
│  2. scanner.js       ──▶ Runs axe-core 4.14.0 in sandbox    │
│  3. customChecks.js  ──▶ Checks vague links ("click here")  │
│  4. mapping.json     ──▶ Links 6 WCAG 2.2 criteria URLs     │
│  5. geminiClient.js  ──▶ Calls /api/explain (metadata only) │
│                          + applies banned-word filter       │
│  6. render.js        ──▶ Strict textContent-only DOM render │
└─────────────────────────────────────────────────────────────┘
               │
               ▼
┌─────────────────────────────────────────────────────────────┐
│              server.ts (Backend Proxy Route)                │
│  POST /api/explain                                          │
│  Invokes @google/genai with gemini-3.8-flash                │
│  Returns plain-language remediation tip for small business  │
└─────────────────────────────────────────────────────────────┘
```

### Module Responsibilities:
1. `index.html`: Structural markup for gate notice, acknowledgement, input, buttons, status banner, results, and cannot-see educational panel.
2. `style.css`: Clew Labs styles, custom properties, typography imports, high-contrast focus indicators.
3. `mapping.json`: WCAG 2.2 criteria mappings (1.1.1 Non-text Content, 1.4.3 Contrast Minimum, 2.4.4 Link Purpose, 2.4.6 Headings and Labels, 4.1.2 Name Role Value, 1.3.1 Info and Relationships) with official W3C URLs.
4. `sanitize.js`: Pure function stripping dangerous tags and inline handlers.
5. `scanner.js`: Creates a sandboxed `<iframe>`, injects sanitized HTML and axe-core CDN, runs `axe.run()`, returns findings.
6. `customChecks.js`: Evaluates DOM tree for links with vague text content.
7. `geminiClient.js`: Client-side fetcher sending metadata to `/api/explain` and enforcing word bans (disallowing misleading legal jargon or technical guarantee claims).
8. `render.js`: Builds result card nodes purely using `textContent` and standard DOM operations.
9. `main.js`: Event listeners, gate checkbox logic, sample bakery fetch, orchestration.
10. `sample-bakery.html`: Target empty placeholder file as requested.
