# Argus Chrome Extension TODO List

## TOP PRIORITY - Polish & Demo-Ready Features

### 1. AI Response Behavior Spec (Deterministic Outputs)
- [ ] Create prompts/ folder with canonical prompt templates
  - [ ] claim_extraction_prompt: strict JSON output with claim, canonical_claim, entities[], numbers[], times[], confidence, suggested_queries[]
  - [ ] evidence_rerank_prompt: label passages support/contradict/neutral with reason strings
  - [ ] skeptical_scorer_prompt: net_support_score (0-100), bucket, 3 reasoning bullets
  - [ ] export_slide_prompt: {title, bullet_points[3], speaker_note} with inline citations
  - [ ] rebuttal_prompt: concise (<=50 words) and tweet_thread (3 tweets) versions
- [ ] Implement strict JSON schema validators for each output type
- [ ] Create evaluation/golden/ with expected outputs for 3 demo pages
- [ ] Add auto-reprompt on parse failure with schema reminder
- [ ] **Acceptance**: 90% of demo claims return valid JSON without manual fixes

### 2. UI/Visual Polish & Assets
- [ ] Replace placeholder icons with final PNG/SVG (16/48/128/256px)
- [ ] Design hero popup state (title, claim, summary, 3 evidence cards, CTA)
- [ ] Implement micro-animations (evidence card stagger, highlight pulse, success checks)
- [ ] Polish typography & spacing (8px grid, web-safe fonts, AA contrast)
- [ ] Create assets/ folder with hero screenshot, slide template, logo variants
- [ ] **Acceptance**: All UI screenshots polished for 1080p video

### 3. Provenance Robustness & Screenshot Fallback
- [ ] Strengthen selector capture (store CSS selector + 80-char snippet)
- [ ] Implement fuzzy text matching fallback (Levenshtein threshold)
- [ ] Add screenshot fallback with chrome.tabs.captureVisibleTab
- [ ] Create in-DOM overlay for cross-origin cases
- [ ] **Acceptance**: All demo evidence highlights work reliably

### 4. Performance Tuning & Instrumentation
- [ ] Add latency measurement and on-screen display
- [ ] Optimize vector search for <1s on demo pages
- [ ] Implement compact storage (base64 compression for embeddings)
- [ ] Add performance metrics overlay (last_latency_ms, parse_success, net_support_score)
- [ ] Create latency harness script (50 runs, median/p95 reporting)
- [ ] **Acceptance**: Median verification latency displayed, under 1s target

### 5. Privacy, Consent & Legal Compliance
- [ ] Add clear privacy modal and local-only default explanation
- [ ] Implement opt-in dialog for cloud fallback (required before calls)
- [ ] Create privacy.md with precise data storage descriptions
- [ ] Add visible operation logging ("Last operation was local" vs "Used cloud")
- [ ] **Acceptance**: Cloud calls gated behind explicit opt-in

### 6. Export Quality Control & Templates
- [ ] Create template-driven exports with citation footers
- [ ] Implement proofreading pass with Proofreader API suggestions
- [ ] Add client-side HTML->PDF rendering with embedded fonts
- [ ] Include numbered citations mapping to evidence items
- [ ] **Acceptance**: Exported PDF matches UI, includes citations, opens on other machines

### 7. Testing, Evaluation & Judge Metrics
- [ ] Finalize evaluation/ with golden outputs and matching metrics
- [ ] Compute parsing success rate, evidence retrieval relevance, contradiction precision
- [ ] Add CSV export for latency data
- [ ] Include metrics table in README
- [ ] **Acceptance**: Clear, reproducible metrics for judges

### 8. Demo Reproducibility & Documentation
- [ ] Ensure demo pages are simple static HTML with proper meta tags
- [ ] Add demo-pages/index.html with instructions
- [ ] Create one-page README checklist (prerequisites, load steps, demo reproduction)
- [ ] Add screenshots showing expected results
- [ ] **Acceptance**: Fresh reproduction in <5 minutes

## Core Extension Structure (COMPLETED)
- [x] Create manifest.json with necessary permissions and scripts
- [x] Create background.js for background processing
- [x] Create content_script.js for page interaction
- [x] Create popup.html, popup.js, popup.css for extension popup UI

## Content Acquisition (COMPLETED)
- [x] Implement selection extractor in content_script.js to capture text, context, images, metadata, and CSS selectors

## Claim Extraction (COMPLETED)
- [x] Implement canonical claim generator using Prompt API in background.js with JSON validation and fallbacks

## Vector Store (COMPLETED)
- [x] Implement embedding generation (using Prompt API or fallback)
- [x] Set up local vector storage in IndexedDB
- [x] Implement brute-force ANN for retrieval
- [x] Add reranking logic for support/contradict detection

## Provenance (COMPLETED)
- [x] Implement provenance highlighting using stored CSS selectors and DOM overlay
- [x] Build evidence card UI components in popup

## Reasoning & Scoring (COMPLETED)
- [x] Implement skeptical scorer with net_support_score calculation
- [x] Add explainable chain generation using Prompt API

## Export (COMPLETED)
- [x] Implement rebuttal/evidence card/slide generation using Writer API
- [x] Add export to PDF/Markdown formats with client-side rendering

## Privacy (COMPLETED)
- [x] Ensure default local-only mode with opt-in cloud fallback
- [x] Add optional E2EE for IndexedDB using Web Crypto API

## UX & Performance (COMPLETED)
- [x] Add streaming/progress UI for model operations
- [x] Polish design with animations and responsive layout

## Demo & Evaluation (COMPLETED)
- [x] Create demo-pages/ with 6-10 annotated HTML pages
- [x] Create evaluation/ with labeled test claims and compute metrics
- [x] Update README.md with features, privacy, instructions, and demo link

## OPTIONAL/ENHANCEMENT FEATURES
- [ ] Cloud fallback serverless proxy (Firebase/Vercel)
- [ ] WASM HNSW for larger corpora
- [ ] Accessibility improvements (keyboard nav, aria labels)
- [ ] Internationalization (Translator API, Spanish demo)
- [ ] Edge case error handling and logging

## Submission Materials
- [ ] Prepare demo video script and record 3-min video
- [ ] Add metrics overlays and judge-facing numbers
- [ ] Finalize LICENSE and submission checklist
- [ ] Create release.zip for quick download

## ASSETS TO CREATE
- [x] icons/icon-16.png, icon-48.png, icon-128.png, icon-256.png
- [x] assets/hero-1920x1080.png (README screenshot)
- [x] assets/slide-template-16x9.png
- [x] assets/logo.svg, assets/logo-compact.svg
- [x] assets/sample_evidence_card.pdf
