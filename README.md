# Argus — Personal Web Truth Engine

**Argus** is a privacy-first Chrome extension that extracts claims from any webpage (text, images, or short audio), searches a local evidence corpus, shows provenance, and generates citation-backed rebuttals and slide exports — all processed locally by default.

---

## Highlights (why Argus matters)
- **On-device, private** claim verification powered by Chrome Built-in AI (Prompt/Writer/Rewriter).  
- **Multimodal extraction**: text, nearby images, and short audio are analyzed to produce canonical claims.  
- **Provenance-first**: every evidence item links to a highlighted snippet in the original page for auditability.  
- **One-click outputs**: generate a citation-backed evidence card (PDF / Markdown / slide) ready to share.

---

## What's included
- `manifest.json`, `background.js`, `content_script.js`, popup & options UI.  
- `/demo-pages/` — offline pages for reproducible evaluation.  
- `/assets/` — hero screenshot, slide template, and sample evidence card PDF.  
- `/evaluation/` — golden outputs, test claims, and metrics harness.  
- `privacy.md` — privacy and opt-in cloud fallback details.

---

## Quick judge reproduction (≤ 5 minutes)
1. Download or clone this repo and unzip `release.zip`.  
2. Open Chrome (v121+) → `chrome://extensions` → enable **Developer mode** → Load unpacked → choose the extension folder.  
3. Open `demo-pages/index.html` in Chrome. Highlight a claim and click the Argus toolbar icon.  
4. Verify: claim JSON appears → supporting/contradicting evidence displays → click evidence to see the highlighted provenance → click **Export PDF** to download a citation-backed slide.

---

## Recommended evaluation checklist
- Does Argus extract a normalized claim and display JSON?  
- Are top supporting/contradicting snippets shown with provenance highlights?  
- Can the extension export a PDF with numbered citations that map to evidence?  
- Is the core flow local by default and reproducible from `/demo-pages`?

---

## Architecture (brief)
- **Content script**: extracts selection, context, images, and DOM selectors.  
- **Background**: orchestrates model calls (Prompt/Writer), embedding generation, local IndexedDB store, and RAG retrieval.  
- **Popup UI**: displays claim, evidence cards, provenance controls, and export actions.  
- **Optional hybrid**: opt-in cloud fallback that sends only a canonical claim to a secured proxy for web-scale corroboration.

---

## Privacy & Security
Argus is **local-first** by default (see `privacy.md`). Cloud deep checks are opt-in and explicitly consented. Evidence storage is in IndexedDB; optional encryption available in Options.

---

## Metrics & Reproducibility
See `/evaluation/metrics.csv` for extraction success, retrieval precision, and latency numbers measured on the demo pages. Full instructions to reproduce the evaluation are included in `evaluation/README.md`.

---

## License & contact
MIT License — see `LICENSE`.  
Repo / Demo: `https://github.com/<you>/argus`  
For questions: open an Issue on the repo.
